export const MAX_PAGES_PER_SCAN = 100;

export const MAX_LINKS_PER_SCAN = 1_000;

export const MAX_LINKS_PER_PAGE = 250;

export const REQUEST_TIMEOUT_MS = 10_000;

export const HTML_FETCH_TIMEOUT_MS = REQUEST_TIMEOUT_MS;

export const SITEMAP_REQUEST_TIMEOUT_MS = REQUEST_TIMEOUT_MS;

export const MAX_REDIRECTS = 5;

export const MAX_SITEMAP_REFERENCES_PER_SCAN = 10;

export const MAX_SITEMAP_URLS_PARSED = 500;

export const MAX_SITEMAP_URLS_CHECKED = 25;

export const MAX_SITEMAP_FILE_BYTES = 1_000_000;

export const MAX_PERFORMANCE_ROOT_HTML_BYTES = 1_000_000;

export const SSL_CERT_EXPIRING_SOON_DAYS = 30;

export const MAX_SCAN_DURATION_MS = 5 * 60 * 1000;

export const PAGE_CRAWL_CONCURRENCY = 3;

export const LINK_CHECK_CONCURRENCY = 8;

export const INSERT_CONCURRENCY = 6;

export const DOMAIN_CONCURRENCY = 2;

export const DOMAIN_MIN_DELAY_MS = 150;

export const SCANLARK_USER_AGENT =
  "ScanlarkBot/0.1 (+https://scanlark.com/bot)";

export const HTML_USER_AGENT = SCANLARK_USER_AGENT;
