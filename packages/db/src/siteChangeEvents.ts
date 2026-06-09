import { ensureConnected } from "./client";
import { getBaselineRunForDiff, type ScanDiffRun } from "./scanDiff";

export type SiteChangeEventCategory =
  | "page_metadata"
  | "page_inventory"
  | "robots"
  | "sitemap"
  | "ssl_https"
  | "security_headers"
  | "performance_basic";

export type SiteChangeEventImportance = "high" | "medium" | "low" | "info";

export interface SiteChangeEventRow {
  id: string;
  site_id: string;
  scan_run_id: string;
  baseline_scan_run_id: string;
  category: SiteChangeEventCategory;
  change_type: string;
  importance: SiteChangeEventImportance;
  subject_key: string;
  subject_url: string | null;
  previous_value_json: Record<string, unknown> | null;
  current_value_json: Record<string, unknown> | null;
  summary: string;
  created_at: Date;
}

export interface SiteChangeSummary {
  total: number;
  byImportance: Record<SiteChangeEventImportance, number>;
  byCategory: Record<SiteChangeEventCategory, number>;
  highPriorityCount: number;
}

export interface SiteChangeEventsResult {
  baselineRun: ScanDiffRun | null;
  summary: SiteChangeSummary;
  changes: SiteChangeEventRow[];
}

type CompletedRunContext = {
  id: string;
  site_id: string;
  start_url: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
};

type PageCheckRow = {
  page_url: string;
  title: string | null;
  meta_description: string | null;
  h1_count: number;
  robots_noindex: boolean;
  canonical_count: number;
  canonical_href: string | null;
};

type SiteCheckRow = {
  check_type: string;
  target_url: string;
  ok: boolean;
  status_code: number | null;
  error_message: string | null;
  facts_json: Record<string, unknown>;
};

type MaterializedEvent = Omit<SiteChangeEventRow, "id" | "created_at">;

const CATEGORY_KEYS: SiteChangeEventCategory[] = [
  "page_metadata",
  "page_inventory",
  "robots",
  "sitemap",
  "ssl_https",
  "security_headers",
  "performance_basic",
];
const IMPORTANCE_KEYS: SiteChangeEventImportance[] = [
  "high",
  "medium",
  "low",
  "info",
];
const PAGE_METADATA_LIMIT = 25;
const PAGE_INVENTORY_SAMPLE_LIMIT = 10;

function buildEmptySummary(): SiteChangeSummary {
  return {
    total: 0,
    byImportance: {
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    byCategory: {
      page_metadata: 0,
      page_inventory: 0,
      robots: 0,
      sitemap: 0,
      ssl_https: 0,
      security_headers: 0,
      performance_basic: 0,
    },
    highPriorityCount: 0,
  };
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function stableStringify(value: unknown) {
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  return JSON.stringify(value);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function normalizePageIdentity(value: string) {
  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${pathname}`;
  } catch {
    return value.replace(/\/+$/, "") || value;
  }
}

function isHomepageUrl(pageUrl: string, startUrl: string) {
  return normalizePageIdentity(pageUrl) === normalizePageIdentity(startUrl);
}

function joinLabels(labels: string[]) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function formatCountChange(from: number | null, to: number | null) {
  return `${from ?? 0} -> ${to ?? 0}`;
}

function getTlsExpiryBucket(daysUntilExpiry: number | null) {
  if (daysUntilExpiry == null) return "unknown";
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry < 14) return "under_14_days";
  if (daysUntilExpiry < 30) return "under_30_days";
  if (daysUntilExpiry < 60) return "under_60_days";
  return "healthy";
}

function formatTlsExpiryBucket(bucket: string) {
  switch (bucket) {
    case "expired":
      return "expired";
    case "under_14_days":
      return "expiring within 14 days";
    case "under_30_days":
      return "expiring within 30 days";
    case "under_60_days":
      return "expiring within 60 days";
    case "healthy":
      return "healthy";
    default:
      return "unknown";
  }
}

function exceedsMeaningfulDelta(
  previousValue: number | null,
  currentValue: number | null,
  absoluteThreshold: number,
  relativeThreshold: number,
) {
  if (previousValue == null || currentValue == null) return false;
  const absoluteDelta = Math.abs(currentValue - previousValue);
  if (absoluteDelta < absoluteThreshold) return false;
  const baseline = Math.max(Math.abs(previousValue), 1);
  return absoluteDelta / baseline >= relativeThreshold;
}

function buildSummary(events: SiteChangeEventRow[]): SiteChangeSummary {
  const summary = buildEmptySummary();
  for (const event of events) {
    summary.total += 1;
    summary.byImportance[event.importance] += 1;
    summary.byCategory[event.category] += 1;
    if (event.importance === "high") {
      summary.highPriorityCount += 1;
    }
  }
  return summary;
}

async function getCompletedRunContext(
  scanRunId: string,
): Promise<CompletedRunContext | null> {
  const client = await ensureConnected();
  const res = await client.query<CompletedRunContext>(
    `
      SELECT id, site_id, start_url, status, started_at, finished_at
      FROM scan_runs
      WHERE id = $1
      LIMIT 1
    `,
    [scanRunId],
  );
  return res.rows[0] ?? null;
}

async function listPageChecksForRun(
  scanRunId: string,
): Promise<Map<string, PageCheckRow>> {
  const client = await ensureConnected();
  const res = await client.query<PageCheckRow>(
    `
      SELECT
        page_url,
        title,
        meta_description,
        h1_count,
        robots_noindex,
        canonical_count,
        canonical_href
      FROM scan_page_checks
      WHERE scan_run_id = $1
      ORDER BY page_url
    `,
    [scanRunId],
  );
  return new Map(res.rows.map((row) => [row.page_url, row]));
}

async function listSiteChecksForRun(
  scanRunId: string,
): Promise<Map<string, SiteCheckRow>> {
  const client = await ensureConnected();
  const res = await client.query<SiteCheckRow>(
    `
      SELECT
        check_type,
        target_url,
        ok,
        status_code,
        error_message,
        facts_json
      FROM scan_site_checks
      WHERE scan_run_id = $1
      ORDER BY check_type, target_url
    `,
    [scanRunId],
  );
  return new Map(
    res.rows.map((row) => [`${row.check_type}:${row.target_url}`, row]),
  );
}

function toEvent(
  run: CompletedRunContext,
  baselineRunId: string,
  event: Omit<
    MaterializedEvent,
    "site_id" | "scan_run_id" | "baseline_scan_run_id"
  >,
): MaterializedEvent {
  return {
    site_id: run.site_id,
    scan_run_id: run.id,
    baseline_scan_run_id: baselineRunId,
    ...event,
  };
}

function detectPageMetadataEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentPages: Map<string, PageCheckRow>,
  baselinePages: Map<string, PageCheckRow>,
) {
  const events: MaterializedEvent[] = [];

  for (const [pageUrl, current] of currentPages) {
    const baseline = baselinePages.get(pageUrl);
    if (!baseline) continue;

    const changedLabels: string[] = [];
    const previousValueJson: Record<string, unknown> = {};
    const currentValueJson: Record<string, unknown> = {};

    if (current.title !== baseline.title) {
      changedLabels.push("page title");
      previousValueJson.title = baseline.title;
      currentValueJson.title = current.title;
    }
    if (current.meta_description !== baseline.meta_description) {
      changedLabels.push("meta description");
      previousValueJson.meta_description = baseline.meta_description;
      currentValueJson.meta_description = current.meta_description;
    }
    if (current.h1_count !== baseline.h1_count) {
      changedLabels.push("heading count");
      previousValueJson.h1_count = baseline.h1_count;
      currentValueJson.h1_count = current.h1_count;
    }
    if (current.robots_noindex !== baseline.robots_noindex) {
      changedLabels.push("indexing rule");
      previousValueJson.robots_noindex = baseline.robots_noindex;
      currentValueJson.robots_noindex = current.robots_noindex;
    }
    if (
      current.canonical_href !== baseline.canonical_href ||
      current.canonical_count !== baseline.canonical_count
    ) {
      changedLabels.push("canonical tag");
      previousValueJson.canonical_href = baseline.canonical_href;
      previousValueJson.canonical_count = baseline.canonical_count;
      currentValueJson.canonical_href = current.canonical_href;
      currentValueJson.canonical_count = current.canonical_count;
    }
    if (changedLabels.length === 0) continue;

    const isHomepage = isHomepageUrl(pageUrl, run.start_url);
    let importance: SiteChangeEventImportance = "low";
    if (
      changedLabels.includes("indexing rule") &&
      current.robots_noindex &&
      isHomepage
    ) {
      importance = "high";
    } else if (
      changedLabels.includes("indexing rule") ||
      changedLabels.includes("canonical tag")
    ) {
      importance = "medium";
    }

    const label = isHomepage
      ? "Homepage metadata changed"
      : "Page metadata changed";
    const summary = `${label}: ${joinLabels(changedLabels)}.`;

    events.push(
      toEvent(run, baselineRunId, {
        category: "page_metadata",
        change_type: "page_metadata_changed",
        importance,
        subject_key: pageUrl,
        subject_url: pageUrl,
        previous_value_json: previousValueJson,
        current_value_json: currentValueJson,
        summary,
      }),
    );
  }

  return events
    .sort((a, b) => {
      const aHome = a.subject_url
        ? isHomepageUrl(a.subject_url, run.start_url)
        : false;
      const bHome = b.subject_url
        ? isHomepageUrl(b.subject_url, run.start_url)
        : false;
      if (aHome !== bHome) return aHome ? -1 : 1;
      const importanceDiff =
        IMPORTANCE_KEYS.indexOf(a.importance) -
        IMPORTANCE_KEYS.indexOf(b.importance);
      if (importanceDiff !== 0) return importanceDiff;
      return (a.subject_url ?? a.subject_key).localeCompare(
        b.subject_url ?? b.subject_key,
      );
    })
    .slice(0, PAGE_METADATA_LIMIT);
}

function detectPageInventoryEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentPages: Map<string, PageCheckRow>,
  baselinePages: Map<string, PageCheckRow>,
) {
  const events: MaterializedEvent[] = [];
  const currentUrls = new Set(currentPages.keys());
  const baselineUrls = new Set(baselinePages.keys());

  const addedUrls = [...currentUrls]
    .filter((url) => !baselineUrls.has(url))
    .sort();
  const removedUrls = [...baselineUrls]
    .filter((url) => !currentUrls.has(url))
    .sort();

  if (addedUrls.length > 0) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "page_inventory",
        change_type: "pages_added",
        importance: "low",
        subject_key: "pages_added",
        subject_url: null,
        previous_value_json: { count: 0, sample_urls: [] },
        current_value_json: {
          count: addedUrls.length,
          sample_urls: addedUrls.slice(0, PAGE_INVENTORY_SAMPLE_LIMIT),
        },
        summary: `${addedUrls.length} checked page${addedUrls.length === 1 ? "" : "s"} appeared since the previous completed scan.`,
      }),
    );
  }

  if (removedUrls.length > 0) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "page_inventory",
        change_type: "pages_removed",
        importance: "low",
        subject_key: "pages_removed",
        subject_url: null,
        previous_value_json: {
          count: removedUrls.length,
          sample_urls: removedUrls.slice(0, PAGE_INVENTORY_SAMPLE_LIMIT),
        },
        current_value_json: { count: 0, sample_urls: [] },
        summary: `${removedUrls.length} checked page${removedUrls.length === 1 ? "" : "s"} disappeared since the previous completed scan.`,
      }),
    );
  }

  return events;
}

function getSiteCheckByType(
  checks: Map<string, SiteCheckRow>,
  checkType: string,
) {
  for (const row of checks.values()) {
    if (row.check_type === checkType) return row;
  }
  return null;
}

function detectRobotsEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  const events: MaterializedEvent[] = [];
  const current = getSiteCheckByType(currentChecks, "robots_txt");
  const baseline = getSiteCheckByType(baselineChecks, "robots_txt");
  if (!current || !baseline) return events;

  if (current.ok !== baseline.ok) {
    const nowAvailable = current.ok;
    events.push(
      toEvent(run, baselineRunId, {
        category: "robots",
        change_type: "robots_availability_changed",
        importance: nowAvailable ? "info" : "medium",
        subject_key: "robots_txt",
        subject_url: current.target_url,
        previous_value_json: {
          ok: baseline.ok,
          status_code: baseline.status_code,
        },
        current_value_json: {
          ok: current.ok,
          status_code: current.status_code,
        },
        summary: nowAvailable
          ? "robots.txt became available again."
          : "robots.txt is no longer available.",
      }),
    );
  }

  const currentBlocksAll = asBoolean(current.facts_json?.blocks_all);
  const baselineBlocksAll = asBoolean(baseline.facts_json?.blocks_all);
  if (currentBlocksAll !== baselineBlocksAll) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "robots",
        change_type: "robots_blocks_all_changed",
        importance: currentBlocksAll ? "high" : "info",
        subject_key: "robots_blocks_all",
        subject_url: current.target_url,
        previous_value_json: { blocks_all: baselineBlocksAll },
        current_value_json: { blocks_all: currentBlocksAll },
        summary: currentBlocksAll
          ? "robots.txt now blocks all crawlers."
          : "robots.txt no longer blocks all crawlers.",
      }),
    );
  }

  const currentSitemaps = uniqueSorted(
    asStringArray(current.facts_json?.sitemap_references),
  );
  const baselineSitemaps = uniqueSorted(
    asStringArray(baseline.facts_json?.sitemap_references),
  );
  if (stableStringify(currentSitemaps) !== stableStringify(baselineSitemaps)) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "robots",
        change_type: "robots_sitemap_references_changed",
        importance: "low",
        subject_key: "robots_sitemap_references",
        subject_url: current.target_url,
        previous_value_json: { sitemap_references: baselineSitemaps },
        current_value_json: { sitemap_references: currentSitemaps },
        summary: "The sitemap references listed in robots.txt changed.",
      }),
    );
  }

  return events;
}

function buildSitemapState(checks: Map<string, SiteCheckRow>) {
  const rows = [...checks.values()].filter(
    (row) =>
      row.check_type === "sitemap_xml" ||
      row.check_type === "sitemap_index_xml",
  );
  return {
    rows,
    hasAvailableSitemap: rows.some((row) => row.ok),
    parsedUrlCount: rows.reduce(
      (sum, row) => sum + (asNumber(row.facts_json?.parsed_url_count) ?? 0),
      0,
    ),
    kinds: uniqueSorted(
      rows
        .map((row) => asString(row.facts_json?.sitemap_kind))
        .filter((value): value is string => Boolean(value)),
    ),
  };
}

function detectSitemapEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  const events: MaterializedEvent[] = [];
  const current = buildSitemapState(currentChecks);
  const baseline = buildSitemapState(baselineChecks);

  if (current.hasAvailableSitemap !== baseline.hasAvailableSitemap) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "sitemap",
        change_type: "sitemap_availability_changed",
        importance: current.hasAvailableSitemap ? "info" : "medium",
        subject_key: "sitemap_availability",
        subject_url: null,
        previous_value_json: { available: baseline.hasAvailableSitemap },
        current_value_json: { available: current.hasAvailableSitemap },
        summary: current.hasAvailableSitemap
          ? "A sitemap became available again."
          : "The sitemap is no longer available.",
      }),
    );
  }

  if (stableStringify(current.kinds) !== stableStringify(baseline.kinds)) {
    events.push(
      toEvent(run, baselineRunId, {
        category: "sitemap",
        change_type: "sitemap_kind_changed",
        importance: "low",
        subject_key: "sitemap_kind",
        subject_url: null,
        previous_value_json: { kinds: baseline.kinds },
        current_value_json: { kinds: current.kinds },
        summary: "The sitemap structure changed.",
      }),
    );
  }

  if (
    exceedsMeaningfulDelta(
      baseline.parsedUrlCount,
      current.parsedUrlCount,
      10,
      0.2,
    )
  ) {
    const importance =
      current.parsedUrlCount < baseline.parsedUrlCount &&
      current.parsedUrlCount === 0
        ? "medium"
        : "low";
    events.push(
      toEvent(run, baselineRunId, {
        category: "sitemap",
        change_type: "sitemap_size_changed",
        importance,
        subject_key: "sitemap_size",
        subject_url: null,
        previous_value_json: { parsed_url_count: baseline.parsedUrlCount },
        current_value_json: { parsed_url_count: current.parsedUrlCount },
        summary: `The sitemap URL count changed from ${baseline.parsedUrlCount} to ${current.parsedUrlCount}.`,
      }),
    );
  }

  return events;
}

function detectSslHttpsEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  const events: MaterializedEvent[] = [];
  const currentHttps = getSiteCheckByType(currentChecks, "https_root");
  const baselineHttps = getSiteCheckByType(baselineChecks, "https_root");
  const currentHttp = getSiteCheckByType(currentChecks, "http_root");
  const baselineHttp = getSiteCheckByType(baselineChecks, "http_root");
  const currentTls = getSiteCheckByType(currentChecks, "tls_certificate");
  const baselineTls = getSiteCheckByType(baselineChecks, "tls_certificate");

  if (currentHttps && baselineHttps && currentHttp && baselineHttp) {
    const currentFinalUrl = asString(currentHttps.facts_json?.final_url);
    const baselineFinalUrl = asString(baselineHttps.facts_json?.final_url);
    const currentFinalScheme = asString(currentHttps.facts_json?.final_scheme);
    const baselineFinalScheme = asString(
      baselineHttps.facts_json?.final_scheme,
    );
    const currentRedirectsToHttps = asBoolean(
      currentHttp.facts_json?.redirects_to_https,
    );
    const baselineRedirectsToHttps = asBoolean(
      baselineHttp.facts_json?.redirects_to_https,
    );

    if (
      currentFinalUrl !== baselineFinalUrl ||
      currentFinalScheme !== baselineFinalScheme ||
      currentRedirectsToHttps !== baselineRedirectsToHttps
    ) {
      const regression =
        currentFinalScheme !== "https" || currentRedirectsToHttps === false;
      events.push(
        toEvent(run, baselineRunId, {
          category: "ssl_https",
          change_type: "https_configuration_changed",
          importance: regression ? "high" : "info",
          subject_key: "https_configuration",
          subject_url: currentHttps.target_url,
          previous_value_json: {
            final_url: baselineFinalUrl,
            final_scheme: baselineFinalScheme,
            redirects_to_https: baselineRedirectsToHttps,
          },
          current_value_json: {
            final_url: currentFinalUrl,
            final_scheme: currentFinalScheme,
            redirects_to_https: currentRedirectsToHttps,
          },
          summary: "The HTTPS or redirect configuration changed.",
        }),
      );
    }
  }

  if (currentTls && baselineTls) {
    const currentAuthorized = asBoolean(currentTls.facts_json?.authorized);
    const baselineAuthorized = asBoolean(baselineTls.facts_json?.authorized);
    const currentHostnameMatches = asBoolean(
      currentTls.facts_json?.hostname_matches,
    );
    const baselineHostnameMatches = asBoolean(
      baselineTls.facts_json?.hostname_matches,
    );
    if (
      currentAuthorized !== baselineAuthorized ||
      currentHostnameMatches !== baselineHostnameMatches
    ) {
      const regression =
        currentAuthorized === false || currentHostnameMatches === false;
      events.push(
        toEvent(run, baselineRunId, {
          category: "ssl_https",
          change_type: "tls_validity_changed",
          importance: regression ? "high" : "info",
          subject_key: "tls_validity",
          subject_url: currentTls.target_url,
          previous_value_json: {
            authorized: baselineAuthorized,
            hostname_matches: baselineHostnameMatches,
          },
          current_value_json: {
            authorized: currentAuthorized,
            hostname_matches: currentHostnameMatches,
          },
          summary: "The TLS certificate validity status changed.",
        }),
      );
    }

    const currentIssuer = stableStringify(currentTls.facts_json?.issuer);
    const baselineIssuer = stableStringify(baselineTls.facts_json?.issuer);
    if (currentIssuer !== baselineIssuer) {
      events.push(
        toEvent(run, baselineRunId, {
          category: "ssl_https",
          change_type: "tls_issuer_changed",
          importance: "info",
          subject_key: "tls_issuer",
          subject_url: currentTls.target_url,
          previous_value_json: {
            issuer: baselineTls.facts_json?.issuer ?? null,
          },
          current_value_json: { issuer: currentTls.facts_json?.issuer ?? null },
          summary: "The TLS certificate issuer changed.",
        }),
      );
    }

    const currentExpiryBucket = getTlsExpiryBucket(
      asNumber(currentTls.facts_json?.days_until_expiry),
    );
    const baselineExpiryBucket = getTlsExpiryBucket(
      asNumber(baselineTls.facts_json?.days_until_expiry),
    );
    if (currentExpiryBucket !== baselineExpiryBucket) {
      const importance =
        currentExpiryBucket === "expired" ||
        currentExpiryBucket === "under_14_days"
          ? "high"
          : currentExpiryBucket === "under_30_days"
            ? "medium"
            : "info";
      events.push(
        toEvent(run, baselineRunId, {
          category: "ssl_https",
          change_type: "tls_expiry_bucket_changed",
          importance,
          subject_key: "tls_expiry_bucket",
          subject_url: currentTls.target_url,
          previous_value_json: { expiry_bucket: baselineExpiryBucket },
          current_value_json: { expiry_bucket: currentExpiryBucket },
          summary: `The certificate moved from ${formatTlsExpiryBucket(
            baselineExpiryBucket,
          )} to ${formatTlsExpiryBucket(currentExpiryBucket)}.`,
        }),
      );
    }
  }

  return events;
}

function detectSecurityHeaderEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  const current = getSiteCheckByType(
    currentChecks,
    "security_headers_https_root",
  );
  const baseline = getSiteCheckByType(
    baselineChecks,
    "security_headers_https_root",
  );
  if (!current || !baseline) return [];

  const comparedKeys = [
    ["has_hsts", "HSTS"],
    ["has_csp", "CSP"],
    ["has_frame_ancestors", "frame-ancestors"],
    ["has_x_frame_options", "X-Frame-Options"],
    ["has_x_content_type_options", "X-Content-Type-Options"],
    ["has_referrer_policy", "Referrer-Policy"],
    ["has_permissions_policy", "Permissions-Policy"],
    ["cookies_missing_secure_count", "cookies missing Secure"],
    ["cookies_missing_httponly_count", "cookies missing HttpOnly"],
    ["cookies_missing_samesite_count", "cookies missing SameSite"],
  ] as const;

  const previousValueJson: Record<string, unknown> = {};
  const currentValueJson: Record<string, unknown> = {};
  const changes: string[] = [];
  let worsened = false;

  for (const [key, label] of comparedKeys) {
    const previousValue = baseline.facts_json?.[key];
    const currentValue = current.facts_json?.[key];
    if (stableStringify(previousValue) === stableStringify(currentValue)) {
      continue;
    }
    previousValueJson[key] = previousValue ?? null;
    currentValueJson[key] = currentValue ?? null;
    changes.push(label);
    if (
      typeof previousValue === "boolean" &&
      typeof currentValue === "boolean"
    ) {
      if (previousValue && !currentValue) worsened = true;
    } else if (
      typeof previousValue === "number" &&
      typeof currentValue === "number" &&
      currentValue > previousValue
    ) {
      worsened = true;
    }
  }

  if (changes.length === 0) return [];

  return [
    toEvent(run, baselineRunId, {
      category: "security_headers",
      change_type: "security_headers_changed",
      importance: worsened ? "medium" : "info",
      subject_key: "security_headers",
      subject_url: current.target_url,
      previous_value_json: previousValueJson,
      current_value_json: currentValueJson,
      summary: `Security header posture changed: ${joinLabels(
        changes.slice(0, 4),
      )}.`,
    }),
  ];
}

function detectPerformanceEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  const current = getSiteCheckByType(
    currentChecks,
    "performance_basic_https_root",
  );
  const baseline = getSiteCheckByType(
    baselineChecks,
    "performance_basic_https_root",
  );
  if (!current || !baseline) return [];

  const previousValueJson: Record<string, unknown> = {};
  const currentValueJson: Record<string, unknown> = {};
  const summaryBits: string[] = [];
  let importance: SiteChangeEventImportance = "info";

  const prevResponse = asNumber(baseline.facts_json?.response_time_ms);
  const curResponse = asNumber(current.facts_json?.response_time_ms);
  if (exceedsMeaningfulDelta(prevResponse, curResponse, 300, 0.2)) {
    previousValueJson.response_time_ms = prevResponse;
    currentValueJson.response_time_ms = curResponse;
    summaryBits.push(
      `response time ${formatCountChange(prevResponse, curResponse)} ms`,
    );
    if ((curResponse ?? 0) > (prevResponse ?? 0)) {
      importance = "medium";
    }
  }

  const prevHtmlSize = asNumber(baseline.facts_json?.html_size_bytes);
  const curHtmlSize = asNumber(current.facts_json?.html_size_bytes);
  if (exceedsMeaningfulDelta(prevHtmlSize, curHtmlSize, 50 * 1024, 0.2)) {
    previousValueJson.html_size_bytes = prevHtmlSize;
    currentValueJson.html_size_bytes = curHtmlSize;
    summaryBits.push(
      `HTML size ${formatCountChange(prevHtmlSize, curHtmlSize)} bytes`,
    );
    if ((curHtmlSize ?? 0) > (prevHtmlSize ?? 0) && importance !== "medium") {
      importance = "low";
    }
  }

  const prevAssetCount = asNumber(baseline.facts_json?.asset_count);
  const curAssetCount = asNumber(current.facts_json?.asset_count);
  if (prevAssetCount != null && curAssetCount != null) {
    if (Math.abs(curAssetCount - prevAssetCount) >= 10) {
      previousValueJson.asset_count = prevAssetCount;
      currentValueJson.asset_count = curAssetCount;
      summaryBits.push(
        `asset count ${formatCountChange(prevAssetCount, curAssetCount)}`,
      );
      if (importance === "info") {
        importance = "low";
      }
    }
  }

  if (summaryBits.length === 0) return [];

  return [
    toEvent(run, baselineRunId, {
      category: "performance_basic",
      change_type: "performance_profile_changed",
      importance,
      subject_key: "performance_profile",
      subject_url: current.target_url,
      previous_value_json: previousValueJson,
      current_value_json: currentValueJson,
      summary: `Homepage performance profile changed: ${joinLabels(
        summaryBits.slice(0, 3),
      )}.`,
    }),
  ];
}

function detectEvents(
  run: CompletedRunContext,
  baselineRunId: string,
  currentPages: Map<string, PageCheckRow>,
  baselinePages: Map<string, PageCheckRow>,
  currentChecks: Map<string, SiteCheckRow>,
  baselineChecks: Map<string, SiteCheckRow>,
) {
  return [
    ...detectPageMetadataEvents(
      run,
      baselineRunId,
      currentPages,
      baselinePages,
    ),
    ...detectPageInventoryEvents(
      run,
      baselineRunId,
      currentPages,
      baselinePages,
    ),
    ...detectRobotsEvents(run, baselineRunId, currentChecks, baselineChecks),
    ...detectSitemapEvents(run, baselineRunId, currentChecks, baselineChecks),
    ...detectSslHttpsEvents(run, baselineRunId, currentChecks, baselineChecks),
    ...detectSecurityHeaderEvents(
      run,
      baselineRunId,
      currentChecks,
      baselineChecks,
    ),
    ...detectPerformanceEvents(
      run,
      baselineRunId,
      currentChecks,
      baselineChecks,
    ),
  ];
}

async function replaceEventsForRun(
  scanRunId: string,
  events: MaterializedEvent[],
): Promise<void> {
  const client = await ensureConnected();
  await client.query("BEGIN");
  try {
    await client.query(
      `DELETE FROM site_change_events WHERE scan_run_id = $1`,
      [scanRunId],
    );
    for (const event of events) {
      await client.query(
        `
          INSERT INTO site_change_events (
            site_id,
            scan_run_id,
            baseline_scan_run_id,
            category,
            change_type,
            importance,
            subject_key,
            subject_url,
            previous_value_json,
            current_value_json,
            summary
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
        `,
        [
          event.site_id,
          event.scan_run_id,
          event.baseline_scan_run_id,
          event.category,
          event.change_type,
          event.importance,
          event.subject_key,
          event.subject_url,
          event.previous_value_json == null
            ? null
            : JSON.stringify(event.previous_value_json),
          event.current_value_json == null
            ? null
            : JSON.stringify(event.current_value_json),
          event.summary,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function listStoredEventsForRun(scanRunId: string) {
  const client = await ensureConnected();
  const res = await client.query<SiteChangeEventRow>(
    `
      SELECT
        id,
        site_id,
        scan_run_id,
        baseline_scan_run_id,
        category,
        change_type,
        importance,
        subject_key,
        subject_url,
        previous_value_json,
        current_value_json,
        summary,
        created_at
      FROM site_change_events
      WHERE scan_run_id = $1
      ORDER BY
        CASE importance
          WHEN 'high' THEN 0
          WHEN 'medium' THEN 1
          WHEN 'low' THEN 2
          ELSE 3
        END,
        CASE category
          WHEN 'page_metadata' THEN 0
          WHEN 'page_inventory' THEN 1
          WHEN 'robots' THEN 2
          WHEN 'sitemap' THEN 3
          WHEN 'ssl_https' THEN 4
          WHEN 'security_headers' THEN 5
          ELSE 6
        END,
        created_at,
        subject_key
    `,
    [scanRunId],
  );
  return res.rows;
}

export async function ensureSiteChangeEventsForRun(
  scanRunId: string,
): Promise<ScanDiffRun | null> {
  const run = await getCompletedRunContext(scanRunId);
  if (!run || run.status !== "completed" || !run.finished_at) {
    return null;
  }

  const baselineRun = await getBaselineRunForDiff(run.site_id, run.id);
  if (!baselineRun) {
    await replaceEventsForRun(scanRunId, []);
    return null;
  }

  const existingEvents = await listStoredEventsForRun(scanRunId);
  if (existingEvents.length > 0) {
    return baselineRun;
  }

  const [currentPages, baselinePages, currentChecks, baselineChecks] =
    await Promise.all([
      listPageChecksForRun(run.id),
      listPageChecksForRun(baselineRun.id),
      listSiteChecksForRun(run.id),
      listSiteChecksForRun(baselineRun.id),
    ]);

  const events = detectEvents(
    run,
    baselineRun.id,
    currentPages,
    baselinePages,
    currentChecks,
    baselineChecks,
  );
  await replaceEventsForRun(scanRunId, events);
  return baselineRun;
}

export async function getSiteChangeEvents(
  scanRunId: string,
): Promise<SiteChangeEventsResult> {
  const baselineRun = await ensureSiteChangeEventsForRun(scanRunId);
  const changes = await listStoredEventsForRun(scanRunId);
  return {
    baselineRun,
    summary: buildSummary(changes),
    changes,
  };
}

export function formatSiteChangeCategoryLabel(
  category: SiteChangeEventCategory,
) {
  switch (category) {
    case "page_metadata":
      return "Page metadata";
    case "page_inventory":
      return "Checked pages";
    case "robots":
      return "robots.txt";
    case "sitemap":
      return "Sitemap";
    case "ssl_https":
      return "SSL / HTTPS";
    case "security_headers":
      return "Security headers";
    case "performance_basic":
      return "Performance";
  }
}

export function formatSiteChangeImportanceLabel(
  importance: SiteChangeEventImportance,
) {
  switch (importance) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "info":
      return "Info";
  }
}

export const SITE_CHANGE_EVENT_CATEGORIES = CATEGORY_KEYS;
export const SITE_CHANGE_EVENT_IMPORTANCE = IMPORTANCE_KEYS;
