export const SITE_PERMISSION_CONFIRMATION_TEXT =
  "I confirm I own this website or have permission from the website owner to scan and monitor it with Scanlark.";

export const SITE_PERMISSION_CONFIRMATION_TEXT_VERSION = "2026-06-12";

export const SAMPLE_SITE_URL = "https://demo.scanlark.test";
export const LEGACY_SAMPLE_SITE_URLS = new Set([
  "https://example.com",
  "https://example.com/",
]);

export const SITE_URL_VALIDATION_MESSAGE =
  "Please enter a valid website address, for example site.com or https://site.com.";

const UNSUPPORTED_PROTOCOL_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

export function normalizeSiteUrlInput(input: string): string {
  let value = input.trim();
  if (!value) {
    throw new Error("empty_url");
  }

  value = value.replace(/^(https?)\/\/:/i, "$1://");

  if (!UNSUPPORTED_PROTOCOL_PATTERN.test(value)) {
    value = `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("unsupported_protocol");
  }

  if (!url.hostname || !url.hostname.includes(".")) {
    throw new Error("invalid_hostname");
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  ) {
    url.port = "";
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/") && !url.search) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.origin}${path}${url.search}`;
}

export function isSampleSiteUrl(url: string): boolean {
  const normalized = normalizeSiteUrlInput(url);
  return (
    normalized === SAMPLE_SITE_URL || LEGACY_SAMPLE_SITE_URLS.has(normalized)
  );
}
