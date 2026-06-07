import { validateCrawlTarget } from "./fetchUrl";
import {
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
  SCANLARK_USER_AGENT,
} from "./limits";

export type SiteResourceFetchResult =
  | {
      ok: true;
      url: string;
      status: number;
      body: string;
      contentType: string | null;
      contentSizeBytes: number;
      redirectCount: number;
    }
  | {
      ok: false;
      url: string;
      status: number | null;
      error: string;
      contentType?: string | null;
      contentSizeBytes?: number | null;
      redirectCount?: number;
    };

type FetchSiteResourceOptions = {
  timeoutMs?: number;
  userAgent?: string;
  signal?: AbortSignal;
  accept?: string;
  maxBytes?: number;
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

export default async function fetchSiteResource(
  rawUrl: string,
  options?: FetchSiteResourceOptions,
): Promise<SiteResourceFetchResult> {
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const userAgent = options?.userAgent ?? SCANLARK_USER_AGENT;
  const accept = options?.accept ?? "text/plain,application/xml,text/xml,*/*;q=0.8";
  const maxBytes = options?.maxBytes ?? Number.POSITIVE_INFINITY;

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

  try {
    let currentUrl = (await validateCrawlTarget(rawUrl)).toString();
    let redirectCount = 0;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await fetch(currentUrl, {
        method: "GET",
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": userAgent,
          accept,
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return {
            ok: false,
            url: currentUrl,
            status: res.status,
            error: "redirect_without_location",
            redirectCount,
          };
        }
        if (i === MAX_REDIRECTS) {
          return {
            ok: false,
            url: currentUrl,
            status: null,
            error: "too_many_redirects",
            redirectCount,
          };
        }
        currentUrl = (await validateCrawlTarget(new URL(location, currentUrl).toString())).toString();
        redirectCount++;
        continue;
      }

      const contentType = res.headers.get("content-type");
      if (!res.ok) {
        return {
          ok: false,
          url: currentUrl,
          status: res.status,
          error: `HTTP ${res.status}`,
          contentType,
          redirectCount,
        };
      }

      const body = await res.text();
      const contentSizeBytes = Buffer.byteLength(body, "utf8");
      if (contentSizeBytes > maxBytes) {
        return {
          ok: false,
          url: currentUrl,
          status: res.status,
          error: "response_too_large",
          contentType,
          contentSizeBytes,
          redirectCount,
        };
      }

      return {
        ok: true,
        url: currentUrl,
        status: res.status,
        body,
        contentType,
        contentSizeBytes,
        redirectCount,
      };
    }

    return {
      ok: false,
      url: rawUrl,
      status: null,
      error: "too_many_redirects",
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : null;
    if (error?.name === "AbortError") {
      timedOut = timedOut || !aborted;
    }
    return {
      ok: false,
      url: rawUrl,
      status: null,
      error: classifyFetchError(error, timedOut, aborted),
    };
  } finally {
    clearTimeout(timer);
  }
}
