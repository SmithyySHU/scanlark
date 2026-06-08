import fetchSiteResource from "./fetchSiteResource";
import { REQUEST_TIMEOUT_MS, SCANLARK_USER_AGENT } from "./limits";

export type UptimeCheckResult = {
  checkedUrl: string;
  status: "up" | "degraded" | "down";
  statusCode: number | null;
  responseTimeMs: number | null;
  redirectCount: number;
  errorCode: string | null;
  errorMessage: string | null;
};

export function classifyUptimeResult(result: {
  ok: boolean;
  status: number | null;
  error?: string;
}): UptimeCheckResult["status"] {
  if (result.ok) {
    return "up";
  }
  if (result.status === 401 || result.status === 403 || result.status === 429) {
    return "degraded";
  }
  if (result.status === 404 || result.status === 410) {
    return "down";
  }
  if (result.status != null && result.status >= 500 && result.status <= 599) {
    return "down";
  }
  return "down";
}

export async function checkUptime(rawUrl: string): Promise<UptimeCheckResult> {
  const startedAt = Date.now();
  const result = await fetchSiteResource(rawUrl, {
    timeoutMs: REQUEST_TIMEOUT_MS,
    userAgent: SCANLARK_USER_AGENT,
    readBody: false,
    accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  });
  const responseTimeMs = Math.max(Date.now() - startedAt, 0);

  if (result.ok) {
    return {
      checkedUrl: result.url,
      status: "up",
      statusCode: result.status,
      responseTimeMs,
      redirectCount: result.redirectCount,
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    checkedUrl: result.url,
    status: classifyUptimeResult(result),
    statusCode: result.status ?? null,
    responseTimeMs,
    redirectCount: result.redirectCount ?? 0,
    errorCode: result.error ?? null,
    errorMessage:
      result.status != null ? `HTTP ${result.status}` : (result.error ?? null),
  };
}
