export type AppLinkEnv = Record<string, string | undefined>;

export const DEFAULT_PUBLIC_SITE_URL = "https://scanlark.com";
export const DEFAULT_APP_URL = "https://app.scanlark.com";

const LOCAL_APP_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

const APPLICATION_ONLY_PATH_PREFIXES = [
  "/login",
  "/register",
  "/dashboard",
  "/monitoring",
  "/account",
  "/settings",
  "/sites",
  "/admin",
  "/operations",
  "/shared-reports",
  "/shared-results",
  "/report",
  "/onboarding",
] as const;

const SAFE_QUERY_KEYS = new Set([
  "archived",
  "awaitingFollowUp",
  "billingCadence",
  "filter",
  "includeEnded",
  "next",
  "operationsBusinessId",
  "overdue",
  "planType",
  "print",
  "priority",
  "renewalsApproaching",
  "reportType",
  "reportsDue",
  "scanRunId",
  "search",
  "selectSite",
  "siteAttention",
  "sort",
  "status",
  "tab",
  "reviewsDue",
]);

export function normalizeOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getConfiguredPublicOrigin(env: AppLinkEnv): string {
  return (
    normalizeOrigin(env.VITE_PUBLIC_SITE_URL) ??
    normalizeOrigin(env.PUBLIC_SITE_URL) ??
    DEFAULT_PUBLIC_SITE_URL
  );
}

export function getConfiguredAppOrigin(
  env: AppLinkEnv,
  currentOrigin?: string,
): string {
  const configured =
    normalizeOrigin(env.VITE_APP_URL) ??
    normalizeOrigin(env.APP_URL) ??
    normalizeOrigin(env.VITE_APP_ORIGIN);
  if (configured) return configured;
  if (!currentOrigin) return DEFAULT_APP_URL;

  try {
    const current = new URL(currentOrigin);
    if (LOCAL_APP_HOSTNAMES.has(current.hostname)) return current.origin;
    if (current.hostname === new URL(DEFAULT_APP_URL).hostname) {
      return current.origin;
    }
  } catch {}

  return DEFAULT_APP_URL;
}

function normalizePathname(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function isApplicationOnlyPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return APPLICATION_ONLY_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isSafeQueryValue(value: string): boolean {
  return value.length <= 500 && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeRelativeAppPath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  try {
    const url = new URL(value, DEFAULT_APP_URL);
    return (
      url.origin === DEFAULT_APP_URL && isApplicationOnlyPath(url.pathname)
    );
  } catch {
    return false;
  }
}

export function buildSafeAppSearch(search: string): string {
  const source = new URLSearchParams(search.startsWith("?") ? search : search);
  const target = new URLSearchParams();

  for (const [key, value] of source.entries()) {
    if (!SAFE_QUERY_KEYS.has(key) || !isSafeQueryValue(value)) continue;
    if (key === "next" && !isSafeRelativeAppPath(value)) continue;
    target.append(key, value);
  }

  const query = target.toString();
  return query ? `?${query}` : "";
}

export function buildAppUrl(
  pathname: string,
  search: string | URLSearchParams | undefined,
  env: AppLinkEnv,
  currentOrigin?: string,
): string {
  const url = new URL(getConfiguredAppOrigin(env, currentOrigin));
  url.pathname = normalizePathname(pathname);
  url.search =
    search instanceof URLSearchParams
      ? buildSafeAppSearch(search.toString())
      : buildSafeAppSearch(search ?? "");
  url.hash = "";
  return url.toString();
}

export function getAppHostnameRedirectUrl(
  location: Pick<Location, "hostname" | "origin" | "pathname" | "search">,
  env: AppLinkEnv,
): string | null {
  if (!isApplicationOnlyPath(location.pathname)) return null;

  const appOrigin = getConfiguredAppOrigin(env, location.origin);
  const publicOrigin = getConfiguredPublicOrigin(env);
  const appHostname = new URL(appOrigin).hostname;
  const publicHostname = new URL(publicOrigin).hostname;

  if (location.hostname === appHostname) return null;
  if (
    location.hostname === publicHostname ||
    location.hostname === `www.${publicHostname}`
  ) {
    return buildAppUrl(
      location.pathname,
      location.search,
      env,
      location.origin,
    );
  }

  return null;
}
