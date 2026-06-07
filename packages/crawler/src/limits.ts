export const MAX_PAGES_PER_SCAN = 100;

export const MAX_LINKS_PER_SCAN = 1_000;

export const MAX_LINKS_PER_PAGE = 250;

export const REQUEST_TIMEOUT_MS = 10_000;

export const HTML_FETCH_TIMEOUT_MS = REQUEST_TIMEOUT_MS;

export const MAX_REDIRECTS = 5;

export const MAX_SCAN_DURATION_MS = 5 * 60 * 1000;

export const PAGE_CRAWL_CONCURRENCY = 3;

export const LINK_CHECK_CONCURRENCY = 8;

export const INSERT_CONCURRENCY = 6;

export const DOMAIN_CONCURRENCY = 2;

export const DOMAIN_MIN_DELAY_MS = 150;

export const SCANLARK_USER_AGENT =
  "ScanlarkBot/0.1 (+https://scanlark.com/bot)";

export const HTML_USER_AGENT = SCANLARK_USER_AGENT;
