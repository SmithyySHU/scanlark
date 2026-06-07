import { validateCrawlTarget } from "./fetchUrl";
import {
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
  SCANLARK_USER_AGENT,
} from "./limits";

export type LinkCheckResult =
  | {
      ok: true;
      status: number;
      headers: Record<string, string>;
      finalUrl: string;
      redirectCount: number;
    }
  | {
      ok: false;
      status: number | null;
      error: string;
      headers?: Record<string, string>;
      finalUrl?: string;
      redirectCount?: number;
    };

function normalizeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

type ValidateLinkOptions = {
  timeoutMs?: number;
  userAgent?: string;
  signal?: AbortSignal;
};

function classifyFetchError(
  error: Error | null,
  timedOut: boolean,
  aborted: boolean,
): string {
  if (timedOut) return "timeout";
  if (aborted) return "aborted";
  if (!error) return "request_failed";
  const code = (error as { code?: string }).code;
  const message = error.message?.toLowerCase() ?? "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (code && code.startsWith("ERR_TLS")) return "tls";
  if (message.includes("tls") || message.includes("ssl")) return "tls";
  if (
    message.includes("refusing to crawl") ||
    message.includes("disallowed protocol") ||
    message.includes("disallowed port") ||
    message.includes("invalid url")
  ) {
    return "unsafe_destination";
  }
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT"
  ) {
    return "connection_failed";
  }
  return "request_failed";
}

export default async function validateLink(
  url: string,
  options?: ValidateLinkOptions,
): Promise<LinkCheckResult> {
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const userAgent = options?.userAgent ?? SCANLARK_USER_AGENT;

  const controller = new AbortController();
  let timedOut = false;
  let aborted = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  if (options?.signal) {
    if (options.signal.aborted) {
      aborted = true;
      controller.abort();
    } else {
      options.signal.addEventListener(
        "abort",
        () => {
          aborted = true;
          controller.abort();
        },
        { once: true },
      );
    }
  }

  const fetchWithRedirects = async (method: "HEAD" | "GET", rawUrl: string) => {
    let currentUrl = (await validateCrawlTarget(rawUrl)).toString();
    let redirectCount = 0;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await fetch(currentUrl, {
        method,
        signal: controller.signal,
        redirect: "manual",
        headers:
          method === "HEAD"
            ? { "user-agent": userAgent }
            : {
                "user-agent": userAgent,
                accept: "text/html,application/xhtml+xml,*/*;q=0.8",
              },
      });

      if (res.status < 300 || res.status >= 400) {
        return { res, finalUrl: currentUrl, redirectCount };
      }

      const location = res.headers.get("location");
      if (!location) {
        return { res, finalUrl: currentUrl, redirectCount };
      }

      if (i === MAX_REDIRECTS) {
        return {
          res: null,
          finalUrl: currentUrl,
          redirectCount,
          error: "too_many_redirects",
        };
      }

      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = (await validateCrawlTarget(nextUrl)).toString();
      redirectCount++;
    }

    return {
      res: null,
      finalUrl: currentUrl,
      redirectCount,
      error: "too_many_redirects",
    };
  };

  try {
    // HEAD first (cheaper). Some servers reject HEAD, so fallback to GET.
    let checked = await fetchWithRedirects("HEAD", url);

    if (checked.res?.status === 405 || checked.res?.status === 403) {
      checked = await fetchWithRedirects("GET", url);
    }

    if (!checked.res) {
      return {
        ok: false,
        status: null,
        error: checked.error ?? "request_failed",
        finalUrl: checked.finalUrl,
        redirectCount: checked.redirectCount,
      };
    }

    const normalizedHeaders = normalizeHeaders(checked.res.headers);
    return checked.res.ok
      ? {
          ok: true,
          status: checked.res.status,
          headers: normalizedHeaders,
          finalUrl: checked.finalUrl,
          redirectCount: checked.redirectCount,
        }
      : {
          ok: false,
          status: checked.res.status,
          error: `HTTP ${checked.res.status}`,
          headers: normalizedHeaders,
          finalUrl: checked.finalUrl,
          redirectCount: checked.redirectCount,
        };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : null;
    if (error?.name === "AbortError") {
      timedOut = timedOut || !aborted;
    }
    const msg = classifyFetchError(error, timedOut, aborted);
    return { ok: false, status: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
