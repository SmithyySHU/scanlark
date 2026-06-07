import fetchUrl from "./fetchUrl";
import extractLinks from "./extractLinks";
import validateLink from "./validateLink";
import { classifyStatus } from "./classifyStatus";
import { normaliseLink } from "./normaliseLink";
import {
  DOMAIN_CONCURRENCY,
  DOMAIN_MIN_DELAY_MS,
  INSERT_CONCURRENCY,
  LINK_CHECK_CONCURRENCY,
  MAX_LINKS_PER_PAGE,
  MAX_LINKS_PER_SCAN,
  MAX_PAGES_PER_SCAN,
  MAX_SCAN_DURATION_MS,
  PAGE_CRAWL_CONCURRENCY,
  REQUEST_TIMEOUT_MS,
} from "./limits";
import type { IgnoreRule } from "@scanlark/db";
import {
  completeScanRun,
  createScanRun,
  findMatchingIgnoreRule,
  getScanRunStatus,
  insertIgnoredOccurrence,
  insertScanLinkOccurrence,
  insertScanResult,
  listIgnoreRules,
  setScanRunStatus,
  touchScanRun,
  updateScanRunProgress,
  upsertIgnoredLink,
  upsertScanLink,
} from "@scanlark/db";

export interface ScanExecutionSummary {
  scanRunId: string;
  totalLinks: number;
  checkedLinks: number;
  brokenLinks: number;
  ignoredLinks: number;
}

/**
 * Create a scan run in the database and return the ID.
 * This allows the API to return immediately with a scanRunId,
 * then run the scan asynchronously in the background.
 */
export async function getScanRunIdOnly(
  siteId: string,
  startUrl: string,
): Promise<string> {
  return await createScanRun(siteId, startUrl);
}

function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          active--;
          next();
        }
      });
      next();
    });
  };
}

function createDomainLimiter(maxInFlight: number, minDelayMs: number) {
  const state = new Map<
    string,
    { active: number; queue: Array<() => void>; nextAllowedAt: number }
  >();

  const runNext = (key: string) => {
    const entry = state.get(key);
    if (!entry) return;
    if (entry.active >= maxInFlight) return;
    const job = entry.queue.shift();
    if (!job) return;
    const now = Date.now();
    const delay = Math.max(0, entry.nextAllowedAt - now);
    entry.active++;
    const start = () => {
      entry.nextAllowedAt = Date.now() + minDelayMs;
      job();
    };
    if (delay > 0) {
      setTimeout(start, delay);
    } else {
      start();
    }
  };

  return function schedule<T>(url: string, fn: () => Promise<T>): Promise<T> {
    const host = safeHost(url) ?? "unknown";
    const entry = state.get(host) ?? { active: 0, queue: [], nextAllowedAt: 0 };
    state.set(host, entry);

    return new Promise<T>((resolve, reject) => {
      entry.queue.push(async () => {
        try {
          const res = await fn();
          resolve(res);
        } catch (e) {
          reject(e);
        } finally {
          entry.active--;
          runNext(host);
        }
      });
      runNext(host);
    });
  };
}

function canonicalUrl(u: string) {
  const x = new URL(u);
  x.hash = "";
  x.hostname = x.hostname.toLowerCase();
  if (
    (x.protocol === "https:" && x.port === "443") ||
    (x.protocol === "http:" && x.port === "80")
  ) {
    x.port = "";
  }
  if (x.pathname.length > 1 && x.pathname.endsWith("/") && !x.search) {
    x.pathname = x.pathname.replace(/\/+$/, "");
  }
  return x.toString();
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Manual test plan:
// - Start a scan and confirm progress updates and last-updated timestamp.
// - Cancel a scan mid-way; ensure it stops and status becomes cancelled.
// - Verify blocked/no_response links are classified and filtered correctly.

function looksLikeNonHtmlPath(pathname: string) {
  const lower = pathname.toLowerCase();
  const exts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
    ".mjs",
    ".map",
    ".pdf",
    ".zip",
    ".rar",
    ".7z",
    ".gz",
    ".tar",
    ".mp3",
    ".mp4",
    ".mov",
    ".avi",
    ".mkv",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".xml",
    ".json",
  ];
  return exts.some((e) => lower.endsWith(e));
}

const NON_CRAWL_AUTH_PATH_SEGMENTS = new Set([
  "login",
  "signin",
  "sign-in",
  "log-in",
  "register",
  "signup",
  "sign-up",
]);

const PRIVATE_AREA_PATH_SEGMENTS = new Set([
  "account",
  "admin",
  "basket",
  "cart",
  "checkout",
  "delete",
  "logout",
  "my-account",
  "password",
  "remove",
  "reset-password",
  "user",
  "users",
  "wp-admin",
]);

const AUTH_LANDING_PATH_PATTERNS = [
  "/account/login",
  "/twid-log/",
  "/wp-login.php",
];

const ACTION_QUERY_PARTS = [
  "auth",
  "delete",
  "lostpassword",
  "logout",
  "remove",
  "redirect_to",
  "register",
  "session",
  "token",
];

const LARGE_DOWNLOAD_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".gz",
  ".tar",
  ".pdf",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
];

function isAuthLandingPageUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }

  const lowerPath = u.pathname.toLowerCase();
  if (AUTH_LANDING_PATH_PATTERNS.some((pattern) => lowerPath === pattern)) {
    return true;
  }

  const segments = lowerPath
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  return segments.some((segment) => NON_CRAWL_AUTH_PATH_SEGMENTS.has(segment));
}

function getScanSkipReason(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "invalid_url";
  }

  const segments = u.pathname
    .toLowerCase()
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const segment of segments) {
    if (PRIVATE_AREA_PATH_SEGMENTS.has(segment)) {
      return `private_area:${segment}`;
    }
  }

  const lowerPath = u.pathname.toLowerCase();
  if (
    lowerPath.includes("reset-password") ||
    lowerPath.includes("forgot-password") ||
    lowerPath.includes("lostpassword")
  ) {
    return "password_reset";
  }
  if (
    lowerPath.includes("/download") &&
    LARGE_DOWNLOAD_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))
  ) {
    return "large_download";
  }

  for (const [key, value] of u.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    const lowerValue = value.toLowerCase();
    if (
      ACTION_QUERY_PARTS.some(
        (part) => lowerKey.includes(part) || lowerValue.includes(part),
      )
    ) {
      return `action_query:${lowerKey}`;
    }
  }

  return null;
}

function getQueryVariantKey(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.search) return null;
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

type ValidationResult = {
  ok: boolean;
  status: number | null;
  error?: string;
  finalUrl?: string;
  redirectCount?: number;
  verdict: "ok" | "broken" | "blocked" | "no_response";
};

function shouldIgnoreUrl(siteId: string, url: string, rules: IgnoreRule[]) {
  return !!findMatchingIgnoreRule(siteId, url, null, rules);
}

export async function runScanForSite(
  siteId: string,
  startUrl: string,
  scanRunId?: string,
): Promise<ScanExecutionSummary> {
  // Ensure the scan run exists before any background work starts.
  const actualScanRunId: string =
    scanRunId ?? (await createScanRun(siteId, startUrl));

  await setScanRunStatus(actualScanRunId, "in_progress");

  const MAX_DEPTH = 2;
  const CANCEL_POLL_MS = 1000;
  const PROGRESS_LOG_INTERVAL_MS = 5000; // Log progress every 5 seconds
  const QUERY_VARIANTS_PER_PATH = 10;
  const scanDeadlineAt = Date.now() + MAX_SCAN_DURATION_MS;

  // Concurrency caps protect both the target site and our DB.
  const limitPage = createLimiter(PAGE_CRAWL_CONCURRENCY);
  const limitLink = createLimiter(LINK_CHECK_CONCURRENCY);
  const limitInsert = createLimiter(INSERT_CONCURRENCY);
  const limitDomain = createDomainLimiter(
    DOMAIN_CONCURRENCY,
    DOMAIN_MIN_DELAY_MS,
  );

  let checkedUnique = 0;
  let brokenUnique = 0;
  let ignoredCount = 0;
  let cancelled = false;

  const discoveredLinks = new Set<string>();
  const validatedOnce = new Set<string>();
  const validationMap = new Map<string, Promise<ValidationResult>>();
  const queryVariantCounts = new Map<string, number>();

  let progressTimer: ReturnType<typeof setTimeout> | null = null;
  let lastTotal = 0;
  let lastChecked = 0;
  let lastBroken = 0;
  let lastProgressLog = Date.now();
  let dbErrorCount = 0;
  let linkLimitLogged = false;
  let pageLimitLogged = false;
  let scanDurationLogged = false;
  let validationErrorLogs = 0;

  // Log progress to console periodically
  const logProgress = () => {
    const now = Date.now();
    if (now - lastProgressLog >= PROGRESS_LOG_INTERVAL_MS) {
      lastProgressLog = now;
      const validated = validatedOnce.size;
      const pending = discoveredLinks.size - validated;
      console.log(
        `[Progress] Total: ${discoveredLinks.size} | Checked: ${checkedUnique} | Broken: ${brokenUnique} | Pending: ${pending} | Ignored: ${ignoredCount}`,
      );
    }
  };

  // Debounce progress updates to avoid noisy DB writes on every link.
  const scheduleProgressWrite = (totalLinks: number) => {
    if (progressTimer) return;
    progressTimer = setTimeout(async () => {
      progressTimer = null;

      const should =
        totalLinks !== lastTotal ||
        checkedUnique !== lastChecked ||
        brokenUnique !== lastBroken;

      if (!should) return;

      lastTotal = totalLinks;
      lastChecked = checkedUnique;
      lastBroken = brokenUnique;

      try {
        await updateScanRunProgress(actualScanRunId, {
          totalLinks,
          checkedLinks: checkedUnique,
          brokenLinks: brokenUnique,
        });
        dbErrorCount = 0; // Reset error counter on success
      } catch (err) {
        dbErrorCount++;
        console.error(
          `[DB Error] Failed to update progress (attempt ${dbErrorCount}):`,
          err instanceof Error ? err.message : err,
        );
        if (dbErrorCount > 10) {
          console.warn(
            "[Warning] Multiple database errors during scan. Continuing anyway...",
          );
        }
      }
    }, 250);
  };

  const flushProgressWrite = async (totalLinks: number) => {
    if (progressTimer) {
      clearTimeout(progressTimer);
      progressTimer = null;
    }
    try {
      await updateScanRunProgress(actualScanRunId, {
        totalLinks,
        checkedLinks: checkedUnique,
        brokenLinks: brokenUnique,
      });
    } catch (err) {
      console.error(
        "[DB Error] Failed to flush final progress:",
        err instanceof Error ? err.message : err,
      );
    }
  };

  let start: URL;
  try {
    start = new URL(startUrl);
  } catch {
    await setScanRunStatus(actualScanRunId, "failed", {
      errorMessage: "invalid_start_url",
      setFinishedAt: true,
    });
    return {
      scanRunId: actualScanRunId,
      totalLinks: 0,
      checkedLinks: 0,
      brokenLinks: 0,
      ignoredLinks: 0,
    };
  }

  const startHostname = start.hostname.toLowerCase();
  const startSkipReason = getScanSkipReason(startUrl);
  if (startSkipReason) {
    await setScanRunStatus(actualScanRunId, "failed", {
      errorMessage: `start_url_skipped:${startSkipReason}`,
      setFinishedAt: true,
    });
    return {
      scanRunId: actualScanRunId,
      totalLinks: 0,
      checkedLinks: 0,
      brokenLinks: 0,
      ignoredLinks: 0,
    };
  }

  console.log(
    `[Scan] Started run=${actualScanRunId} site=${siteId} start=${startUrl} maxPages=${MAX_PAGES_PER_SCAN} maxLinks=${MAX_LINKS_PER_SCAN}`,
  );

  let ignoreRules: IgnoreRule[] = [];
  const cancelController = new AbortController();

  const retryDelays = [400, 900];
  let cancelTimer: ReturnType<typeof setInterval> | null = null;
  let touchTimer: ReturnType<typeof setInterval> | null = null;

  const getValidation = (url: string): Promise<ValidationResult> => {
    const existing = validationMap.get(url);
    if (existing) return existing;

    const p = limitLink(async () => {
      let r = await limitDomain(url, () =>
        validateLink(url, {
          signal: cancelController.signal,
          timeoutMs: REQUEST_TIMEOUT_MS,
        }),
      );
      for (let i = 0; i < retryDelays.length; i++) {
        if (cancelled) break;
        if (r.status != null) break;
        if (!r.ok && r.error === "aborted") break;
        const jitter = Math.floor(Math.random() * 200);
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelays[i] + jitter),
        );
        r = await limitDomain(url, () =>
          validateLink(url, {
            signal: cancelController.signal,
            timeoutMs: REQUEST_TIMEOUT_MS,
          }),
        );
      }
      const verdict = classifyStatus(
        url,
        r.status ?? undefined,
        r.headers,
      ) as ValidationResult["verdict"];

      if (!validatedOnce.has(url)) {
        validatedOnce.add(url);
        checkedUnique++;
        if (verdict === "broken") brokenUnique++;
        if (!r.ok && r.status == null && validationErrorLogs < 20) {
          validationErrorLogs++;
          console.warn("[Scan] Link validation failed", {
            url,
            error: r.error,
          });
        }
        logProgress(); // Add progress logging
        scheduleProgressWrite(discoveredLinks.size);
      }

      return {
        ok: r.ok,
        status: r.status ?? null,
        error: r.ok ? undefined : r.error,
        finalUrl: r.finalUrl,
        redirectCount: r.redirectCount,
        verdict,
      };
    });

    validationMap.set(url, p);
    return p;
  };

  const insertSkippedOccurrence = async (
    sourcePage: string,
    linkUrl: string,
    reason: string,
  ) => {
    if (cancelled) return;
    try {
      const ignored = await upsertIgnoredLink({
        scanRunId: actualScanRunId,
        linkUrl,
        ruleId: null,
        statusCode: null,
        errorMessage: `crawl_skipped:${reason}`,
      });
      await insertIgnoredOccurrence({
        scanIgnoredLinkId: ignored.id,
        scanRunId: actualScanRunId,
        linkUrl,
        sourcePage,
      });
      ignoredCount++;
      console.log(`[Scan] Skipped ${linkUrl} reason=${reason}`);
    } catch (err) {
      console.error(
        `[DB Error] Failed to insert skipped occurrence for ${linkUrl}:`,
        err instanceof Error ? err.message : err,
      );
    }
  };

  const insertOccurrence = async (sourcePage: string, linkUrl: string) => {
    if (cancelled) return;
    try {
      const preRule = findMatchingIgnoreRule(
        siteId,
        linkUrl,
        null,
        ignoreRules,
      );
      if (preRule && preRule.rule_type !== "status_code") {
        const ignored = await upsertIgnoredLink({
          scanRunId: actualScanRunId,
          linkUrl,
          ruleId: preRule.id,
          statusCode: null,
        });
        await insertIgnoredOccurrence({
          scanIgnoredLinkId: ignored.id,
          scanRunId: actualScanRunId,
          linkUrl,
          sourcePage,
        });
        ignoredCount++;
        return;
      }

      const v = await getValidation(linkUrl);
      const matchRule = findMatchingIgnoreRule(
        siteId,
        linkUrl,
        v.status,
        ignoreRules,
      );
      if (matchRule) {
        const ignored = await upsertIgnoredLink({
          scanRunId: actualScanRunId,
          linkUrl,
          ruleId: matchRule.id,
          statusCode: v.status,
          errorMessage: v.ok ? undefined : v.error,
        });
        await insertIgnoredOccurrence({
          scanIgnoredLinkId: ignored.id,
          scanRunId: actualScanRunId,
          linkUrl,
          sourcePage,
        });
        ignoredCount++;
        return;
      }

      // ✅ Optional: write to legacy scan_results (disabled by default)
      const writeLegacy = process.env.WRITE_LEGACY_SCAN_RESULTS === "true";
      if (writeLegacy) {
        await insertScanResult({
          scanRunId: actualScanRunId,
          sourcePage,
          linkUrl,
          statusCode: v.status,
          classification: v.verdict,
          errorMessage: v.ok ? undefined : v.error,
        });
      }

      // ✅ Write to dedup tables (new primary storage)
      const scanLink = await upsertScanLink({
        scanRunId: actualScanRunId,
        linkUrl,
        classification: v.verdict,
        statusCode: v.status,
        errorMessage: v.ok ? undefined : v.error,
      });

      // ✅ Track this specific occurrence
      await insertScanLinkOccurrence({
        scanLinkId: scanLink.id,
        scanRunId: actualScanRunId,
        linkUrl,
        sourcePage,
      });
    } catch (err) {
      console.error(
        `[DB Error] Failed to insert occurrence for ${linkUrl}:`,
        err instanceof Error ? err.message : err,
      );
      // Continue scan even if individual occurrence insert fails
    }
  };

  type PageJob = { url: string; depth: number };
  const canonicalStartUrl = canonicalUrl(startUrl);
  const pageQueue: PageJob[] = [{ url: canonicalStartUrl, depth: 0 }];
  const visitedPages = new Set<string>();

  const occurrenceTasks: Array<Promise<void>> = [];

  const processPage = async (pageUrl: string, depth: number) => {
    if (Date.now() > scanDeadlineAt) {
      if (!scanDurationLogged) {
        scanDurationLogged = true;
        console.warn(
          `[Scan] Duration limit reached run=${actualScanRunId} limitMs=${MAX_SCAN_DURATION_MS}`,
        );
      }
      return;
    }

    const html = await limitDomain(pageUrl, () =>
      fetchUrl(pageUrl, {
        signal: cancelController.signal,
        timeoutMs: REQUEST_TIMEOUT_MS,
      }),
    );
    if (!html) return;

    const rawLinks = extractLinks(html);
    if (rawLinks.length > MAX_LINKS_PER_PAGE) {
      console.log(
        `[Scan] Link extraction limit page=${pageUrl} extracted=${rawLinks.length} used=${MAX_LINKS_PER_PAGE}`,
      );
    }
    const uniqueRawLinks = Array.from(
      new Set(rawLinks.slice(0, MAX_LINKS_PER_PAGE)),
    );

    for (const rawHref of uniqueRawLinks) {
      if (cancelled) break;
      if (Date.now() > scanDeadlineAt) break;

      const n = normaliseLink(rawHref, pageUrl);
      if (n.kind === "skip") continue;

      const linkUrl = canonicalUrl(n.url);
      const isAuthLandingPage = isAuthLandingPageUrl(linkUrl);
      const skipReason = getScanSkipReason(linkUrl);
      if (skipReason) {
        if (!discoveredLinks.has(linkUrl)) {
          if (discoveredLinks.size >= MAX_LINKS_PER_SCAN) {
            if (!linkLimitLogged) {
              linkLimitLogged = true;
              console.warn(
                `[Scan] Link limit reached run=${actualScanRunId} max=${MAX_LINKS_PER_SCAN}`,
              );
            }
            continue;
          }
          discoveredLinks.add(linkUrl);
          scheduleProgressWrite(discoveredLinks.size);
        }
        occurrenceTasks.push(
          limitInsert(() =>
            insertSkippedOccurrence(pageUrl, linkUrl, skipReason),
          ),
        );
        continue;
      }

      const queryVariantKey = getQueryVariantKey(linkUrl);
      if (queryVariantKey && !discoveredLinks.has(linkUrl)) {
        const count = queryVariantCounts.get(queryVariantKey) ?? 0;
        if (count >= QUERY_VARIANTS_PER_PATH) {
          if (!discoveredLinks.has(linkUrl)) {
            if (discoveredLinks.size >= MAX_LINKS_PER_SCAN) {
              if (!linkLimitLogged) {
                linkLimitLogged = true;
                console.warn(
                  `[Scan] Link limit reached run=${actualScanRunId} max=${MAX_LINKS_PER_SCAN}`,
                );
              }
              continue;
            }
            discoveredLinks.add(linkUrl);
            scheduleProgressWrite(discoveredLinks.size);
          }
          occurrenceTasks.push(
            limitInsert(() =>
              insertSkippedOccurrence(pageUrl, linkUrl, "query_variant_limit"),
            ),
          );
          continue;
        }
        queryVariantCounts.set(queryVariantKey, count + 1);
      }

      const isIgnored = shouldIgnoreUrl(siteId, linkUrl, ignoreRules);

      if (!discoveredLinks.has(linkUrl)) {
        if (discoveredLinks.size >= MAX_LINKS_PER_SCAN) {
          if (!linkLimitLogged) {
            linkLimitLogged = true;
            console.warn(
              `[Scan] Link limit reached run=${actualScanRunId} max=${MAX_LINKS_PER_SCAN}`,
            );
          }
          continue;
        }
        discoveredLinks.add(linkUrl);
        scheduleProgressWrite(discoveredLinks.size);
      }

      occurrenceTasks.push(
        limitInsert(() => insertOccurrence(pageUrl, linkUrl)),
      );

      try {
        const u = new URL(linkUrl);

        if (
          !isIgnored &&
          !isAuthLandingPage &&
          u.hostname.toLowerCase() === startHostname &&
          depth < MAX_DEPTH
        ) {
          if (!looksLikeNonHtmlPath(u.pathname)) {
            const nextPage = canonicalUrl(u.toString());
            if (
              !visitedPages.has(nextPage) &&
              visitedPages.size + pageQueue.length < MAX_PAGES_PER_SCAN
            ) {
              pageQueue.push({ url: nextPage, depth: depth + 1 });
            } else if (
              visitedPages.size + pageQueue.length >= MAX_PAGES_PER_SCAN &&
              !pageLimitLogged
            ) {
              pageLimitLogged = true;
              console.warn(
                `[Scan] Page limit reached run=${actualScanRunId} max=${MAX_PAGES_PER_SCAN}`,
              );
            }
          }
        }
      } catch {}
    }
  };

  try {
    ignoreRules = await listIgnoreRules(siteId, { enabledOnly: true });

    // ✅ FIX: use actualScanRunId
    await updateScanRunProgress(actualScanRunId, {
      totalLinks: 0,
      checkedLinks: 0,
      brokenLinks: 0,
    });

    discoveredLinks.add(canonicalStartUrl);
    scheduleProgressWrite(discoveredLinks.size);
    occurrenceTasks.push(
      limitInsert(() => insertOccurrence(canonicalStartUrl, canonicalStartUrl)),
    );

    const inFlight = new Set<Promise<void>>();
    let cancelCheckInFlight = false;
    cancelTimer = setInterval(async () => {
      if (cancelled || cancelCheckInFlight) return;
      cancelCheckInFlight = true;
      try {
        const status = await getScanRunStatus(actualScanRunId);
        if (status?.status === "cancelled") {
          cancelled = true;
          cancelController.abort();
        }
      } catch {
      } finally {
        cancelCheckInFlight = false;
      }
    }, CANCEL_POLL_MS);

    touchTimer = setInterval(() => {
      if (cancelled) return;
      void touchScanRun(actualScanRunId);
    }, 1000);

    while (pageQueue.length > 0 || inFlight.size > 0) {
      if (cancelled) break;
      while (
        pageQueue.length > 0 &&
        inFlight.size < PAGE_CRAWL_CONCURRENCY &&
        visitedPages.size < MAX_PAGES_PER_SCAN
      ) {
        if (Date.now() > scanDeadlineAt) {
          if (!scanDurationLogged) {
            scanDurationLogged = true;
            console.warn(
              `[Scan] Duration limit reached run=${actualScanRunId} limitMs=${MAX_SCAN_DURATION_MS}`,
            );
          }
          pageQueue.length = 0;
          break;
        }
        if (cancelled) break;
        const job = pageQueue.shift()!;
        const pageUrl = job.url;

        if (visitedPages.has(pageUrl)) continue;
        visitedPages.add(pageUrl);

        const p = limitPage(() => processPage(pageUrl, job.depth));
        inFlight.add(p);

        p.finally(() => {
          inFlight.delete(p);
        });
      }

      if (
        visitedPages.size >= MAX_PAGES_PER_SCAN &&
        pageQueue.length > 0 &&
        !pageLimitLogged
      ) {
        pageLimitLogged = true;
        console.warn(
          `[Scan] Page limit reached run=${actualScanRunId} max=${MAX_PAGES_PER_SCAN}`,
        );
      }
      if (visitedPages.size >= MAX_PAGES_PER_SCAN && pageQueue.length > 0) {
        pageQueue.length = 0;
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }

    await Promise.allSettled(occurrenceTasks);
    const validationResults = await Promise.allSettled(
      Array.from(validationMap.values()),
    );

    // Check for validation errors
    const validationErrors = validationResults.filter(
      (r) => r.status === "rejected",
    );
    if (validationErrors.length > 0) {
      console.warn(
        `[Warning] ${validationErrors.length} link validation(s) failed`,
      );
    }

    if (cancelTimer) clearInterval(cancelTimer);
    if (touchTimer) clearInterval(touchTimer);

    if (cancelled) {
      console.log("[Scan] Cancelled by user");
      await flushProgressWrite(discoveredLinks.size);
      return {
        scanRunId: actualScanRunId,
        totalLinks: discoveredLinks.size,
        checkedLinks: checkedUnique,
        brokenLinks: brokenUnique,
        ignoredLinks: ignoredCount,
      };
    }

    await flushProgressWrite(discoveredLinks.size);

    console.log(
      `[Scan] Complete: ${discoveredLinks.size} total, ${checkedUnique} checked, ${brokenUnique} broken, ${ignoredCount} ignored`,
    );

    await completeScanRun(actualScanRunId, "completed", {
      totalLinks: discoveredLinks.size,
      checkedLinks: checkedUnique,
      brokenLinks: brokenUnique,
    });

    return {
      scanRunId: actualScanRunId,
      totalLinks: discoveredLinks.size,
      checkedLinks: checkedUnique,
      brokenLinks: brokenUnique,
      ignoredLinks: ignoredCount,
    };
  } catch (err) {
    console.error(
      "[Scan Error] Unexpected error during scan:",
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error) {
      console.error("[Stack]", err.stack);
    }

    await flushProgressWrite(discoveredLinks.size);

    if (cancelTimer) clearInterval(cancelTimer);
    if (touchTimer) clearInterval(touchTimer);

    if (cancelled) {
      return {
        scanRunId: actualScanRunId,
        totalLinks: discoveredLinks.size,
        checkedLinks: checkedUnique,
        brokenLinks: brokenUnique,
        ignoredLinks: ignoredCount,
      };
    }

    const errorMsg =
      err instanceof Error ? err.message : "Unknown error during scan";
    await updateScanRunProgress(actualScanRunId, {
      totalLinks: discoveredLinks.size,
      checkedLinks: checkedUnique,
      brokenLinks: brokenUnique,
    });
    await setScanRunStatus(actualScanRunId, "failed", {
      errorMessage: errorMsg,
      setFinishedAt: true,
    });

    return {
      scanRunId: actualScanRunId,
      totalLinks: discoveredLinks.size,
      checkedLinks: checkedUnique,
      brokenLinks: brokenUnique,
      ignoredLinks: ignoredCount,
    };
  }
}
