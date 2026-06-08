import { ensureConnected } from "./client";

export type ScanIssueCategory =
  | "link_integrity"
  | "seo_basic"
  | "ssl_https"
  | "security_header"
  | "sitemap"
  | "robots"
  | "performance_basic";

export type ScanIssueSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ScanIssueStatus = "open" | "resolved";
export type ScanIssueChangeStatus = "new" | "existing";

export type ScanIssueType =
  | "broken_link"
  | "blocked_link"
  | "no_response"
  | "ignored_safety_skip"
  | "missing_title"
  | "empty_title"
  | "duplicate_title"
  | "missing_meta_description"
  | "empty_meta_description"
  | "missing_h1"
  | "multiple_h1"
  | "noindex_detected"
  | "canonical_multiple"
  | "robots_missing"
  | "robots_unreachable"
  | "robots_blocks_all"
  | "robots_no_sitemap_reference"
  | "sitemap_missing"
  | "sitemap_unreachable"
  | "sitemap_invalid"
  | "sitemap_empty"
  | "sitemap_url_broken"
  | "https_unavailable"
  | "http_not_redirecting_to_https"
  | "ssl_certificate_expired"
  | "ssl_certificate_expiring_soon"
  | "ssl_certificate_hostname_mismatch"
  | "ssl_certificate_invalid"
  | "hsts_missing"
  | "csp_missing"
  | "frame_ancestors_missing"
  | "x_frame_options_missing"
  | "x_content_type_options_missing"
  | "referrer_policy_missing"
  | "permissions_policy_missing"
  | "set_cookie_missing_secure"
  | "set_cookie_missing_httponly"
  | "set_cookie_missing_samesite"
  | "homepage_response_slow"
  | "homepage_html_too_large"
  | "homepage_asset_count_high"
  | "homepage_image_count_high"
  | "homepage_script_count_high";

export interface ScanIssue {
  id: string;
  scan_run_id: string;
  site_id: string;
  category: ScanIssueCategory;
  severity: ScanIssueSeverity;
  status: ScanIssueStatus;
  issue_type: ScanIssueType;
  affected_url: string;
  source_url: string | null;
  title: string;
  description: string;
  evidence_json: Record<string, unknown>;
  change_status: ScanIssueChangeStatus | null;
  first_seen_at: Date;
  last_seen_at: Date;
  resolved_at: Date | null;
}

export interface ResolvedScanIssue {
  id: string;
  site_id: string;
  category: ScanIssueCategory;
  severity: ScanIssueSeverity;
  issue_type: ScanIssueType;
  affected_url: string;
  source_url: string | null;
  title: string;
  description: string;
  evidence_json: Record<string, unknown>;
  first_seen_at: Date;
  last_seen_at: Date;
  resolved_at: Date;
  resolved_scan_run_id: string;
  change_status: "resolved";
  status: "resolved";
}

type SiteIssueStateStatus = "open" | "resolved";

type SiteIssueState = {
  id: string;
  site_id: string;
  issue_fingerprint: string;
  category: ScanIssueCategory;
  issue_type: ScanIssueType;
  affected_url: string;
  latest_source_url: string | null;
  latest_title: string;
  latest_description: string;
  latest_severity: ScanIssueSeverity;
  latest_evidence_json: Record<string, unknown>;
  state_status: SiteIssueStateStatus;
  first_seen_at: Date;
  first_seen_scan_run_id: string;
  last_seen_at: Date;
  last_seen_scan_run_id: string;
  resolved_at: Date | null;
  resolved_scan_run_id: string | null;
};

type ScanLinkIssueCandidate = {
  affected_url: string;
  classification: "broken" | "blocked" | "no_response";
  status_code: number | null;
  error_message: string | null;
  occurrence_count: number;
  source_url: string | null;
};

type IgnoredIssueCandidate = {
  affected_url: string;
  status_code: number | null;
  error_message: string | null;
  occurrence_count: number;
  source_url: string | null;
  rule_type: string | null;
  rule_pattern: string | null;
};

type SeoPageCheckCandidate = {
  page_url: string;
  title: string | null;
  meta_description: string | null;
  h1_count: number;
  robots_meta: string | null;
  robots_noindex: boolean;
  canonical_count: number;
  canonical_href: string | null;
};

type SiteCheckCandidate = {
  check_type:
    | "robots_txt"
    | "sitemap_xml"
    | "sitemap_index_xml"
    | "https_root"
    | "http_root"
    | "tls_certificate"
    | "security_headers_https_root"
    | "performance_basic_https_root";
  target_url: string;
  status_code: number | null;
  ok: boolean;
  error_message: string | null;
  content_type: string | null;
  content_size_bytes: number | null;
  facts_json: Record<string, unknown>;
};

type StoredIssueInput = Omit<
  ScanIssue,
  "id" | "first_seen_at" | "last_seen_at" | "resolved_at"
>;

export type ScanIssuesSummary = {
  total: number;
  bySeverity: Record<ScanIssueSeverity, number>;
  byIssueType: Record<string, number>;
  byChangeStatus: Record<ScanIssueChangeStatus | "resolved", number>;
};

function getHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isInternalToRun(startUrl: string, affectedUrl: string): boolean {
  const startHost = getHostname(startUrl);
  const affectedHost = getHostname(affectedUrl);
  if (!startHost || !affectedHost) return false;
  return startHost === affectedHost;
}

function normalizeIssueFingerprintUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const isDefaultPort =
      (protocol === "http:" && (parsed.port === "" || parsed.port === "80")) ||
      (protocol === "https:" && (parsed.port === "" || parsed.port === "443"));
    const port = isDefaultPort || parsed.port === "" ? "" : `:${parsed.port}`;
    const pathname = parsed.pathname || "/";
    return `${protocol}//${hostname}${port}${pathname}${parsed.search}`;
  } catch {
    return value.trim();
  }
}

function buildIssueFingerprint(
  category: ScanIssueCategory,
  issueType: ScanIssueType,
  affectedUrl: string,
): string {
  return `v1:${category}:${issueType}:${normalizeIssueFingerprintUrl(affectedUrl)}`;
}

function buildLinkIssue(
  scanRunId: string,
  siteId: string,
  startUrl: string,
  row: ScanLinkIssueCandidate,
): StoredIssueInput {
  const isInternal = isInternalToRun(startUrl, row.affected_url);
  if (row.classification === "broken") {
    return {
      scan_run_id: scanRunId,
      site_id: siteId,
      category: "link_integrity",
      severity: isInternal ? "high" : "medium",
      status: "open",
      issue_type: "broken_link",
      affected_url: row.affected_url,
      source_url: row.source_url,
      title: isInternal ? "Broken internal link" : "Broken external link",
      description: isInternal
        ? "This internal link failed during this scan and should be fixed or redirected."
        : "This external link failed during this scan and should be reviewed.",
      evidence_json: {
        classification: row.classification,
        status_code: row.status_code,
        error_message: row.error_message,
        occurrence_count: row.occurrence_count,
        is_internal: isInternal,
      },
      change_status: null,
    };
  }
  if (row.classification === "blocked") {
    return {
      scan_run_id: scanRunId,
      site_id: siteId,
      category: "link_integrity",
      severity: "low",
      status: "open",
      issue_type: "blocked_link",
      affected_url: row.affected_url,
      source_url: row.source_url,
      title: "Blocked link",
      description:
        "This link responded with access controls or blocking behavior during this scan and should be reviewed.",
      evidence_json: {
        classification: row.classification,
        status_code: row.status_code,
        error_message: row.error_message,
        occurrence_count: row.occurrence_count,
        is_internal: isInternal,
      },
      change_status: null,
    };
  }
  return {
    scan_run_id: scanRunId,
    site_id: siteId,
    category: "link_integrity",
    severity: "medium",
    status: "open",
    issue_type: "no_response",
    affected_url: row.affected_url,
    source_url: row.source_url,
    title: "No response link",
    description:
      "This link did not return a usable response during this scan and should be reviewed.",
    evidence_json: {
      classification: row.classification,
      status_code: row.status_code,
      error_message: row.error_message,
      occurrence_count: row.occurrence_count,
      is_internal: isInternal,
    },
    change_status: null,
  };
}

function buildIgnoredSafetyIssue(
  scanRunId: string,
  siteId: string,
  row: IgnoredIssueCandidate,
): StoredIssueInput {
  const skipReason = row.error_message?.startsWith("crawl_skipped:")
    ? row.error_message.slice("crawl_skipped:".length)
    : row.error_message;
  return {
    scan_run_id: scanRunId,
    site_id: siteId,
    category: "link_integrity",
    severity: "info",
    status: "open",
    issue_type: "ignored_safety_skip",
    affected_url: row.affected_url,
    source_url: row.source_url,
    title: "Skipped auth/action URL",
    description:
      "Scanlark intentionally skipped this URL because it matched a crawler safety rule.",
    evidence_json: {
      status_code: row.status_code,
      error_message: row.error_message,
      occurrence_count: row.occurrence_count,
      skip_reason: skipReason,
      rule_type: row.rule_type,
      rule_pattern: row.rule_pattern,
    },
    change_status: null,
  };
}

function buildSeoIssue(
  scanRunId: string,
  siteId: string,
  row: SeoPageCheckCandidate,
  issueType: ScanIssueType,
  title: string,
  description: string,
  severity: ScanIssueSeverity,
  extraEvidence?: Record<string, unknown>,
): StoredIssueInput {
  return {
    scan_run_id: scanRunId,
    site_id: siteId,
    category: "seo_basic",
    severity,
    status: "open",
    issue_type: issueType,
    affected_url: row.page_url,
    source_url: null,
    title,
    description,
    evidence_json: {
      title: row.title,
      meta_description: row.meta_description,
      h1_count: row.h1_count,
      robots_meta: row.robots_meta,
      canonical_count: row.canonical_count,
      canonical_href: row.canonical_href,
      ...extraEvidence,
    },
    change_status: null,
  };
}

function buildSiteIssue(
  scanRunId: string,
  siteId: string,
  category:
    | "robots"
    | "sitemap"
    | "ssl_https"
    | "security_header"
    | "performance_basic",
  issueType: ScanIssueType,
  severity: ScanIssueSeverity,
  affectedUrl: string,
  title: string,
  description: string,
  evidence: Record<string, unknown>,
): StoredIssueInput {
  return {
    scan_run_id: scanRunId,
    site_id: siteId,
    category,
    severity,
    status: "open",
    issue_type: issueType,
    affected_url: affectedUrl,
    source_url: null,
    title,
    description,
    evidence_json: evidence,
    change_status: null,
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

const PERFORMANCE_RESPONSE_SLOW_MS = 3_000;
const PERFORMANCE_HTML_TOO_LARGE_BYTES = 500_000;
const PERFORMANCE_ASSET_COUNT_HIGH = 80;
const PERFORMANCE_IMAGE_COUNT_HIGH = 50;
const PERFORMANCE_SCRIPT_COUNT_HIGH = 30;

async function insertIssues(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  issues: StoredIssueInput[],
) {
  if (issues.length === 0) return;

  const params: Array<string | null | Record<string, unknown>> = [];
  const values = issues.map((issue, index) => {
    const base = index * 13;
    params.push(
      issue.scan_run_id,
      issue.site_id,
      issue.category,
      issue.severity,
      issue.status,
      issue.issue_type,
      issue.affected_url,
      issue.source_url,
      issue.title,
      issue.description,
      issue.evidence_json,
      issue.change_status,
      null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`;
  });

  await client.query(
    `
      INSERT INTO scan_issues (
        scan_run_id,
        site_id,
        category,
        severity,
        status,
        issue_type,
        affected_url,
        source_url,
        title,
        description,
        evidence_json,
        change_status,
        resolved_at
      )
      VALUES ${values.join(",\n")}
    `,
    params,
  );
}

async function reconcileIssueStatesForScanRun(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  scanRunId: string,
  siteId: string,
) {
  const [currentIssuesRes, siteStatesRes] = await Promise.all([
    client.query<ScanIssue>(
      `
        SELECT
          id,
          scan_run_id,
          site_id,
          category,
          severity,
          status,
          issue_type,
          affected_url,
          source_url,
          title,
          description,
          evidence_json,
          change_status,
          first_seen_at,
          last_seen_at,
          resolved_at
        FROM scan_issues
        WHERE scan_run_id = $1
      `,
      [scanRunId],
    ),
    client.query<SiteIssueState>(
      `
        SELECT
          id,
          site_id,
          issue_fingerprint,
          category,
          issue_type,
          affected_url,
          latest_source_url,
          latest_title,
          latest_description,
          latest_severity,
          latest_evidence_json,
          state_status,
          first_seen_at,
          first_seen_scan_run_id,
          last_seen_at,
          last_seen_scan_run_id,
          resolved_at,
          resolved_scan_run_id
        FROM site_issue_states
        WHERE site_id = $1
        FOR UPDATE
      `,
      [siteId],
    ),
  ]);

  const statesByFingerprint = new Map<string, SiteIssueState>();
  for (const state of siteStatesRes.rows) {
    statesByFingerprint.set(state.issue_fingerprint, state);
  }

  const seenFingerprints = new Set<string>();
  const now = new Date();

  for (const issue of currentIssuesRes.rows) {
    const fingerprint = buildIssueFingerprint(
      issue.category,
      issue.issue_type,
      issue.affected_url,
    );
    const existingState = statesByFingerprint.get(fingerprint);
    const nextChangeStatus: ScanIssueChangeStatus =
      existingState && existingState.state_status === "open"
        ? "existing"
        : "new";

    await client.query(
      `
        UPDATE scan_issues
        SET change_status = $2
        WHERE id = $1
      `,
      [issue.id, nextChangeStatus],
    );

    if (existingState) {
      await client.query(
        `
          UPDATE site_issue_states
          SET category = $2,
              issue_type = $3,
              affected_url = $4,
              latest_source_url = $5,
              latest_title = $6,
              latest_description = $7,
              latest_severity = $8,
              latest_evidence_json = $9,
              state_status = 'open',
              last_seen_at = $10,
              last_seen_scan_run_id = $11,
              resolved_at = NULL,
              resolved_scan_run_id = NULL
          WHERE id = $1
        `,
        [
          existingState.id,
          issue.category,
          issue.issue_type,
          issue.affected_url,
          issue.source_url,
          issue.title,
          issue.description,
          issue.severity,
          issue.evidence_json,
          now,
          scanRunId,
        ],
      );
    } else {
      await client.query(
        `
          INSERT INTO site_issue_states (
            site_id,
            issue_fingerprint,
            category,
            issue_type,
            affected_url,
            latest_source_url,
            latest_title,
            latest_description,
            latest_severity,
            latest_evidence_json,
            state_status,
            first_seen_at,
            first_seen_scan_run_id,
            last_seen_at,
            last_seen_scan_run_id
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open', $11, $12, $13, $14
          )
        `,
        [
          siteId,
          fingerprint,
          issue.category,
          issue.issue_type,
          issue.affected_url,
          issue.source_url,
          issue.title,
          issue.description,
          issue.severity,
          issue.evidence_json,
          now,
          scanRunId,
          now,
          scanRunId,
        ],
      );
    }

    seenFingerprints.add(fingerprint);
  }

  for (const state of siteStatesRes.rows) {
    if (state.state_status !== "open") continue;
    if (seenFingerprints.has(state.issue_fingerprint)) continue;
    await client.query(
      `
        UPDATE site_issue_states
        SET state_status = 'resolved',
            resolved_at = $2,
            resolved_scan_run_id = $3
        WHERE id = $1
      `,
      [state.id, now, scanRunId],
    );
  }
}

export async function replaceIssuesForScanRun(
  scanRunId: string,
): Promise<{ issueCount: number }> {
  const client = await ensureConnected();
  const runRes = await client.query<{ site_id: string; start_url: string }>(
    `
      SELECT site_id, start_url
      FROM scan_runs
      WHERE id = $1
      LIMIT 1
    `,
    [scanRunId],
  );
  const run = runRes.rows[0];
  if (!run) {
    throw new Error("scan_run_not_found");
  }

  await client.query("BEGIN");
  try {
    await client.query(`SELECT id FROM sites WHERE id = $1 FOR UPDATE`, [
      run.site_id,
    ]);
    await client.query(`DELETE FROM scan_issues WHERE scan_run_id = $1`, [
      scanRunId,
    ]);

    const linkRes = await client.query<ScanLinkIssueCandidate>(
      `
        SELECT
          l.link_url AS affected_url,
          l.classification,
          l.status_code,
          l.error_message,
          l.occurrence_count,
          occ.source_page AS source_url
        FROM scan_links l
        LEFT JOIN LATERAL (
          SELECT source_page
          FROM scan_link_occurrences o
          WHERE o.scan_link_id = l.id
          ORDER BY o.created_at ASC
          LIMIT 1
        ) occ ON true
        WHERE l.scan_run_id = $1
          AND l.ignored = false
          AND l.classification IN ('broken', 'blocked', 'no_response')
      `,
      [scanRunId],
    );

    const ignoredRes = await client.query<IgnoredIssueCandidate>(
      `
        SELECT
          sil.link_url AS affected_url,
          sil.status_code,
          sil.error_message,
          sil.occurrence_count,
          occ.source_page AS source_url,
          ir.rule_type,
          ir.pattern AS rule_pattern
        FROM scan_ignored_links sil
        LEFT JOIN ignore_rules ir ON ir.id = sil.rule_id
        LEFT JOIN LATERAL (
          SELECT source_page
          FROM scan_ignored_occurrences sio
          WHERE sio.scan_ignored_link_id = sil.id
          ORDER BY sio.created_at ASC
          LIMIT 1
        ) occ ON true
        WHERE sil.scan_run_id = $1
          AND sil.error_message LIKE 'crawl_skipped:%'
      `,
      [scanRunId],
    );

    const seoPageChecksRes = await client.query<SeoPageCheckCandidate>(
      `
        SELECT
          page_url,
          title,
          meta_description,
          h1_count,
          robots_meta,
          robots_noindex,
          canonical_count,
          canonical_href
        FROM scan_page_checks
        WHERE scan_run_id = $1
      `,
      [scanRunId],
    );

    const siteChecksRes = await client.query<SiteCheckCandidate>(
      `
        SELECT
          check_type,
          target_url,
          status_code,
          ok,
          error_message,
          content_type,
          content_size_bytes,
          facts_json
        FROM scan_site_checks
        WHERE scan_run_id = $1
      `,
      [scanRunId],
    );

    const duplicateTitleMap = new Map<string, SeoPageCheckCandidate[]>();
    for (const row of seoPageChecksRes.rows) {
      const normalizedTitle = row.title?.trim().toLowerCase() ?? "";
      if (!normalizedTitle) continue;
      const matches = duplicateTitleMap.get(normalizedTitle) ?? [];
      matches.push(row);
      duplicateTitleMap.set(normalizedTitle, matches);
    }

    const seoIssues: StoredIssueInput[] = [];
    for (const row of seoPageChecksRes.rows) {
      if (row.title === null) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "missing_title",
            "Missing title tag",
            "This page does not include a title tag.",
            "high",
          ),
        );
      } else if (row.title === "") {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "empty_title",
            "Empty title tag",
            "This page includes a title tag, but it is empty.",
            "high",
          ),
        );
      } else {
        const duplicatePages =
          duplicateTitleMap.get(row.title.trim().toLowerCase()) ?? [];
        if (duplicatePages.length > 1) {
          seoIssues.push(
            buildSeoIssue(
              scanRunId,
              run.site_id,
              row,
              "duplicate_title",
              "Duplicate title tag",
              "This page shares its title with other crawled pages in this scan.",
              "medium",
              {
                duplicate_count: duplicatePages.length,
                duplicate_page_urls: duplicatePages
                  .map((page) => page.page_url)
                  .slice(0, 10),
              },
            ),
          );
        }
      }

      if (row.meta_description === null) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "missing_meta_description",
            "Missing meta description",
            "This page does not include a meta description tag.",
            "low",
          ),
        );
      } else if (row.meta_description === "") {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "empty_meta_description",
            "Empty meta description",
            "This page includes a meta description tag, but it is empty.",
            "low",
          ),
        );
      }

      if (row.h1_count === 0) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "missing_h1",
            "Missing H1 heading",
            "This page does not include an H1 heading.",
            "medium",
          ),
        );
      } else if (row.h1_count > 1) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "multiple_h1",
            "Multiple H1 headings",
            "This page includes more than one H1 heading.",
            "low",
          ),
        );
      }

      if (row.robots_noindex) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "noindex_detected",
            "Noindex detected",
            "This page includes a robots noindex directive.",
            "info",
          ),
        );
      }

      if (row.canonical_count > 1) {
        seoIssues.push(
          buildSeoIssue(
            scanRunId,
            run.site_id,
            row,
            "canonical_multiple",
            "Multiple canonical tags",
            "This page includes more than one canonical link tag.",
            "low",
          ),
        );
      }
    }

    const siteIssues: StoredIssueInput[] = [];
    const httpsRootCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "https_root",
    );
    const httpRootCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "http_root",
    );
    const tlsCertificateCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "tls_certificate",
    );
    const securityHeadersCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "security_headers_https_root",
    );
    const performanceBasicCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "performance_basic_https_root",
    );
    const robotsCheck = siteChecksRes.rows.find(
      (row) => row.check_type === "robots_txt",
    );
    const robotsSitemapReferences = asStringArray(
      robotsCheck?.facts_json?.sitemap_references,
    );

    if (robotsCheck) {
      const blocksAll = asBoolean(robotsCheck.facts_json?.blocks_all);

      if (!robotsCheck.ok) {
        const robotsSeverity: ScanIssueSeverity =
          robotsCheck.status_code === 404 ? "low" : "medium";
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "robots",
            robotsCheck.status_code === 404
              ? "robots_missing"
              : "robots_unreachable",
            robotsSeverity,
            robotsCheck.target_url,
            robotsCheck.status_code === 404
              ? "robots.txt missing"
              : "robots.txt unreachable",
            robotsCheck.status_code === 404
              ? "The site did not return a public robots.txt file during this scan."
              : "Scanlark could not fetch robots.txt during this scan.",
            {
              status_code: robotsCheck.status_code,
              error_message: robotsCheck.error_message,
            },
          ),
        );
      } else {
        if (blocksAll) {
          siteIssues.push(
            buildSiteIssue(
              scanRunId,
              run.site_id,
              "robots",
              "robots_blocks_all",
              "high",
              robotsCheck.target_url,
              "robots.txt blocks all crawlers",
              "The robots.txt wildcard block disallows the entire site.",
              {
                status_code: robotsCheck.status_code,
                blocks_all: true,
                sitemap_references: robotsSitemapReferences,
              },
            ),
          );
        }

        if (robotsSitemapReferences.length === 0) {
          siteIssues.push(
            buildSiteIssue(
              scanRunId,
              run.site_id,
              "robots",
              "robots_no_sitemap_reference",
              "low",
              robotsCheck.target_url,
              "robots.txt has no sitemap reference",
              "The robots.txt file does not advertise a sitemap URL.",
              {
                status_code: robotsCheck.status_code,
                sitemap_references: robotsSitemapReferences,
              },
            ),
          );
        }
      }
    }

    const sitemapChecks = siteChecksRes.rows.filter(
      (row) =>
        row.check_type === "sitemap_xml" ||
        row.check_type === "sitemap_index_xml",
    );
    const authoritativeSitemapChecks =
      robotsSitemapReferences.length > 0
        ? sitemapChecks.filter((row) =>
            robotsSitemapReferences.includes(row.target_url),
          )
        : sitemapChecks;
    const anySitemapSuccess = sitemapChecks.some((row) => row.ok);

    for (const row of sitemapChecks) {
      const parsedUrlCount = asNumber(row.facts_json?.parsed_url_count) ?? 0;
      const checkedUrlCount = asNumber(row.facts_json?.checked_url_count) ?? 0;
      const brokenEntries = asObjectArray(row.facts_json?.broken_entries);

      if (!row.ok) {
        if (row.status_code !== 404) {
          siteIssues.push(
            buildSiteIssue(
              scanRunId,
              run.site_id,
              "sitemap",
              row.error_message === "invalid_xml"
                ? "sitemap_invalid"
                : "sitemap_unreachable",
              "medium",
              row.target_url,
              row.error_message === "invalid_xml"
                ? "Invalid sitemap XML"
                : "Sitemap unreachable",
              row.error_message === "invalid_xml"
                ? "This sitemap URL responded, but the XML was not valid for sitemap parsing."
                : "Scanlark could not fetch this sitemap URL during the scan.",
              {
                status_code: row.status_code,
                error_message: row.error_message,
                content_type: row.content_type,
                content_size_bytes: row.content_size_bytes,
              },
            ),
          );
        }
        continue;
      }

      if (parsedUrlCount === 0) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "sitemap",
            "sitemap_empty",
            "low",
            row.target_url,
            "Empty sitemap",
            "This sitemap was reachable but did not contain any URLs.",
            {
              status_code: row.status_code,
              parsed_url_count: parsedUrlCount,
              checked_url_count: checkedUrlCount,
            },
          ),
        );
      }

      for (const entry of brokenEntries) {
        const entryUrl =
          typeof entry.url === "string" && entry.url
            ? entry.url
            : row.target_url;
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "sitemap",
            "sitemap_url_broken",
            "low",
            entryUrl,
            "Broken sitemap URL",
            "A sampled URL from this sitemap did not return a healthy response during the scan.",
            {
              sitemap_url: row.target_url,
              status_code:
                typeof entry.status_code === "number"
                  ? entry.status_code
                  : null,
              error_message:
                typeof entry.error_message === "string"
                  ? entry.error_message
                  : null,
              final_url:
                typeof entry.final_url === "string" ? entry.final_url : null,
              redirect_count:
                typeof entry.redirect_count === "number"
                  ? entry.redirect_count
                  : null,
              checked_url_count: checkedUrlCount,
            },
          ),
        );
      }
    }

    if (!anySitemapSuccess) {
      const fallbackTarget =
        authoritativeSitemapChecks[0]?.target_url ??
        sitemapChecks[0]?.target_url ??
        `${new URL(run.start_url).origin}/sitemap.xml`;
      siteIssues.push(
        buildSiteIssue(
          scanRunId,
          run.site_id,
          "sitemap",
          "sitemap_missing",
          "low",
          fallbackTarget,
          "Sitemap missing",
          "No usable sitemap was found from the default sitemap URLs or robots.txt references.",
          {
            checked_sitemap_urls: sitemapChecks.map((row) => row.target_url),
            referenced_sitemap_urls: robotsSitemapReferences,
          },
        ),
      );
    }

    if (httpsRootCheck) {
      const finalScheme = asString(httpsRootCheck.facts_json?.final_scheme);
      const classification = asString(
        httpsRootCheck.facts_json?.classification,
      );
      if (
        !httpsRootCheck.ok ||
        finalScheme !== "https" ||
        classification !== "ok"
      ) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "https_unavailable",
            "high",
            httpsRootCheck.target_url,
            "HTTPS unavailable",
            "The scanned host did not produce a usable HTTPS response during this scan.",
            {
              status_code: httpsRootCheck.status_code,
              error_message: httpsRootCheck.error_message,
              final_url: httpsRootCheck.facts_json?.final_url,
              redirect_count: httpsRootCheck.facts_json?.redirect_count,
              classification,
              final_scheme: finalScheme,
              final_hostname: httpsRootCheck.facts_json?.final_hostname,
            },
          ),
        );
      }
    }

    if (httpRootCheck && httpRootCheck.ok) {
      const redirectsToHttps = asBoolean(
        httpRootCheck.facts_json?.redirects_to_https,
      );
      if (!redirectsToHttps) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "http_not_redirecting_to_https",
            "low",
            httpRootCheck.target_url,
            "HTTP does not redirect to HTTPS",
            "The scanned host responded on HTTP but did not end on HTTPS during this scan.",
            {
              status_code: httpRootCheck.status_code,
              error_message: httpRootCheck.error_message,
              final_url: httpRootCheck.facts_json?.final_url,
              redirect_count: httpRootCheck.facts_json?.redirect_count,
              classification: httpRootCheck.facts_json?.classification,
              redirects_to_https: redirectsToHttps,
            },
          ),
        );
      }
    }

    if (tlsCertificateCheck?.ok) {
      const isExpired = asBoolean(tlsCertificateCheck.facts_json?.is_expired);
      const isExpiringSoon = asBoolean(
        tlsCertificateCheck.facts_json?.is_expiring_soon,
      );
      const isHostnameMismatch = asBoolean(
        tlsCertificateCheck.facts_json?.is_hostname_mismatch,
      );
      const isInvalid = asBoolean(tlsCertificateCheck.facts_json?.is_invalid);
      const certificateEvidence = {
        status_code: tlsCertificateCheck.status_code,
        error_message: tlsCertificateCheck.error_message,
        hostname: tlsCertificateCheck.facts_json?.hostname,
        port: tlsCertificateCheck.facts_json?.port,
        authorized: tlsCertificateCheck.facts_json?.authorized,
        authorization_error:
          tlsCertificateCheck.facts_json?.authorization_error,
        subject: tlsCertificateCheck.facts_json?.subject,
        issuer: tlsCertificateCheck.facts_json?.issuer,
        valid_from: tlsCertificateCheck.facts_json?.valid_from,
        valid_to: tlsCertificateCheck.facts_json?.valid_to,
        days_until_expiry: tlsCertificateCheck.facts_json?.days_until_expiry,
        san_dns_names: tlsCertificateCheck.facts_json?.san_dns_names,
        hostname_matches: tlsCertificateCheck.facts_json?.hostname_matches,
      };

      if (isExpired) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "ssl_certificate_expired",
            "high",
            tlsCertificateCheck.target_url,
            "SSL certificate expired",
            "The scanned host presented an expired TLS certificate.",
            certificateEvidence,
          ),
        );
      } else if (isExpiringSoon) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "ssl_certificate_expiring_soon",
            "medium",
            tlsCertificateCheck.target_url,
            "SSL certificate expiring soon",
            "The scanned host TLS certificate will expire within 30 days.",
            certificateEvidence,
          ),
        );
      }

      if (isHostnameMismatch) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "ssl_certificate_hostname_mismatch",
            "high",
            tlsCertificateCheck.target_url,
            "SSL certificate hostname mismatch",
            "The scanned host presented a TLS certificate that does not match the hostname.",
            certificateEvidence,
          ),
        );
      }

      if (isInvalid) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "ssl_https",
            "ssl_certificate_invalid",
            "high",
            tlsCertificateCheck.target_url,
            "SSL certificate invalid",
            "The scanned host presented a TLS certificate that did not validate cleanly.",
            certificateEvidence,
          ),
        );
      }
    }

    if (securityHeadersCheck?.ok) {
      const headerEvidence = {
        status_code: securityHeadersCheck.status_code,
        error_message: securityHeadersCheck.error_message,
        final_url: securityHeadersCheck.facts_json?.final_url,
        redirect_count: securityHeadersCheck.facts_json?.redirect_count,
        has_hsts: securityHeadersCheck.facts_json?.has_hsts,
        has_csp: securityHeadersCheck.facts_json?.has_csp,
        has_x_frame_options:
          securityHeadersCheck.facts_json?.has_x_frame_options,
        has_frame_ancestors:
          securityHeadersCheck.facts_json?.has_frame_ancestors,
        has_x_content_type_options:
          securityHeadersCheck.facts_json?.has_x_content_type_options,
        has_referrer_policy:
          securityHeadersCheck.facts_json?.has_referrer_policy,
        has_permissions_policy:
          securityHeadersCheck.facts_json?.has_permissions_policy,
        hsts: securityHeadersCheck.facts_json?.hsts,
        csp: securityHeadersCheck.facts_json?.csp,
        x_frame_options: securityHeadersCheck.facts_json?.x_frame_options,
        referrer_policy: securityHeadersCheck.facts_json?.referrer_policy,
        permissions_policy: securityHeadersCheck.facts_json?.permissions_policy,
        cookies_set_count: securityHeadersCheck.facts_json?.cookies_set_count,
        cookies_missing_secure_count:
          securityHeadersCheck.facts_json?.cookies_missing_secure_count,
        cookies_missing_httponly_count:
          securityHeadersCheck.facts_json?.cookies_missing_httponly_count,
        cookies_missing_samesite_count:
          securityHeadersCheck.facts_json?.cookies_missing_samesite_count,
      };
      const hasCsp = asBoolean(securityHeadersCheck.facts_json?.has_csp);
      const hasFrameAncestors = asBoolean(
        securityHeadersCheck.facts_json?.has_frame_ancestors,
      );
      const hasXFrameOptions = asBoolean(
        securityHeadersCheck.facts_json?.has_x_frame_options,
      );
      const hasHsts = asBoolean(securityHeadersCheck.facts_json?.has_hsts);
      const hasXContentTypeOptions = asBoolean(
        securityHeadersCheck.facts_json?.has_x_content_type_options,
      );
      const hasReferrerPolicy = asBoolean(
        securityHeadersCheck.facts_json?.has_referrer_policy,
      );
      const hasPermissionsPolicy = asBoolean(
        securityHeadersCheck.facts_json?.has_permissions_policy,
      );
      const cookiesMissingSecureCount =
        asNumber(
          securityHeadersCheck.facts_json?.cookies_missing_secure_count,
        ) ?? 0;
      const cookiesMissingHttpOnlyCount =
        asNumber(
          securityHeadersCheck.facts_json?.cookies_missing_httponly_count,
        ) ?? 0;
      const cookiesMissingSameSiteCount =
        asNumber(
          securityHeadersCheck.facts_json?.cookies_missing_samesite_count,
        ) ?? 0;

      if (!hasHsts) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "hsts_missing",
            "medium",
            securityHeadersCheck.target_url,
            "HSTS header missing",
            "The final HTTPS root response did not include a Strict-Transport-Security header.",
            headerEvidence,
          ),
        );
      }
      if (!hasCsp) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "csp_missing",
            "medium",
            securityHeadersCheck.target_url,
            "CSP header missing",
            "The final HTTPS root response did not include a Content-Security-Policy header.",
            headerEvidence,
          ),
        );
      }
      if (!hasFrameAncestors) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "frame_ancestors_missing",
            "medium",
            securityHeadersCheck.target_url,
            "frame-ancestors missing",
            "The final HTTPS root response did not include CSP frame-ancestors protection.",
            headerEvidence,
          ),
        );
      }
      if (!hasFrameAncestors && !hasXFrameOptions) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "x_frame_options_missing",
            "low",
            securityHeadersCheck.target_url,
            "X-Frame-Options missing",
            "The final HTTPS root response did not include legacy X-Frame-Options protection.",
            headerEvidence,
          ),
        );
      }
      if (!hasXContentTypeOptions) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "x_content_type_options_missing",
            "low",
            securityHeadersCheck.target_url,
            "X-Content-Type-Options missing",
            "The final HTTPS root response did not include an X-Content-Type-Options header.",
            headerEvidence,
          ),
        );
      }
      if (!hasReferrerPolicy) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "referrer_policy_missing",
            "low",
            securityHeadersCheck.target_url,
            "Referrer-Policy missing",
            "The final HTTPS root response did not include a Referrer-Policy header.",
            headerEvidence,
          ),
        );
      }
      if (!hasPermissionsPolicy) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "permissions_policy_missing",
            "low",
            securityHeadersCheck.target_url,
            "Permissions-Policy missing",
            "The final HTTPS root response did not include a Permissions-Policy header.",
            headerEvidence,
          ),
        );
      }
      if (cookiesMissingSecureCount > 0) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "set_cookie_missing_secure",
            "high",
            securityHeadersCheck.target_url,
            "Cookie missing Secure flag",
            "One or more cookies on the final HTTPS root response were missing the Secure flag.",
            headerEvidence,
          ),
        );
      }
      if (cookiesMissingHttpOnlyCount > 0) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "set_cookie_missing_httponly",
            "medium",
            securityHeadersCheck.target_url,
            "Cookie missing HttpOnly flag",
            "One or more cookies on the final HTTPS root response were missing the HttpOnly flag.",
            headerEvidence,
          ),
        );
      }
      if (cookiesMissingSameSiteCount > 0) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "security_header",
            "set_cookie_missing_samesite",
            "low",
            securityHeadersCheck.target_url,
            "Cookie missing SameSite flag",
            "One or more cookies on the final HTTPS root response were missing the SameSite flag.",
            headerEvidence,
          ),
        );
      }
    }

    if (performanceBasicCheck?.ok) {
      const performanceEvidence = {
        status_code: performanceBasicCheck.status_code,
        error_message: performanceBasicCheck.error_message,
        final_url: performanceBasicCheck.facts_json?.final_url,
        response_time_ms: performanceBasicCheck.facts_json?.response_time_ms,
        html_size_bytes: performanceBasicCheck.facts_json?.html_size_bytes,
        image_count: performanceBasicCheck.facts_json?.image_count,
        script_count: performanceBasicCheck.facts_json?.script_count,
        stylesheet_count: performanceBasicCheck.facts_json?.stylesheet_count,
        asset_count: performanceBasicCheck.facts_json?.asset_count,
      };
      const responseTimeMs =
        asNumber(performanceBasicCheck.facts_json?.response_time_ms) ?? 0;
      const htmlSizeBytes =
        asNumber(performanceBasicCheck.facts_json?.html_size_bytes) ?? 0;
      const assetCount =
        asNumber(performanceBasicCheck.facts_json?.asset_count) ?? 0;
      const imageCount =
        asNumber(performanceBasicCheck.facts_json?.image_count) ?? 0;
      const scriptCount =
        asNumber(performanceBasicCheck.facts_json?.script_count) ?? 0;

      if (responseTimeMs > PERFORMANCE_RESPONSE_SLOW_MS) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "performance_basic",
            "homepage_response_slow",
            "medium",
            performanceBasicCheck.target_url,
            "Homepage response looked slow",
            "The final HTTPS root HTML response took over 3 seconds during this basic passive check. This is not a full performance audit.",
            performanceEvidence,
          ),
        );
      }
      if (htmlSizeBytes > PERFORMANCE_HTML_TOO_LARGE_BYTES) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "performance_basic",
            "homepage_html_too_large",
            "medium",
            performanceBasicCheck.target_url,
            "Homepage HTML looked large",
            "The final HTTPS root HTML was over 500 KB during this basic passive check. This is not a full performance audit.",
            performanceEvidence,
          ),
        );
      }
      if (assetCount > PERFORMANCE_ASSET_COUNT_HIGH) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "performance_basic",
            "homepage_asset_count_high",
            "low",
            performanceBasicCheck.target_url,
            "Homepage asset references looked high",
            "The final HTTPS root HTML referenced over 80 images, scripts, and stylesheets in this basic static count. This is not a full performance audit.",
            performanceEvidence,
          ),
        );
      }
      if (imageCount > PERFORMANCE_IMAGE_COUNT_HIGH) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "performance_basic",
            "homepage_image_count_high",
            "low",
            performanceBasicCheck.target_url,
            "Homepage image references looked high",
            "The final HTTPS root HTML referenced over 50 images in this basic static count. This is not a full performance audit.",
            performanceEvidence,
          ),
        );
      }
      if (scriptCount > PERFORMANCE_SCRIPT_COUNT_HIGH) {
        siteIssues.push(
          buildSiteIssue(
            scanRunId,
            run.site_id,
            "performance_basic",
            "homepage_script_count_high",
            "medium",
            performanceBasicCheck.target_url,
            "Homepage script references looked high",
            "The final HTTPS root HTML referenced over 30 external scripts in this basic static count. This is not a full performance audit.",
            performanceEvidence,
          ),
        );
      }
    }

    const issues: StoredIssueInput[] = [
      ...linkRes.rows.map((row) =>
        buildLinkIssue(scanRunId, run.site_id, run.start_url, row),
      ),
      ...ignoredRes.rows.map((row) =>
        buildIgnoredSafetyIssue(scanRunId, run.site_id, row),
      ),
      ...seoIssues,
      ...siteIssues,
    ];

    await insertIssues(client, issues);
    await reconcileIssueStatesForScanRun(client, scanRunId, run.site_id);
    await client.query("COMMIT");
    return { issueCount: issues.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function listIssuesForScanRunForUser(
  userId: string,
  scanRunId: string,
  options?: {
    status?: ScanIssueStatus | null;
    severity?: ScanIssueSeverity | null;
    category?: ScanIssueCategory | null;
    limit?: number;
    offset?: number;
  },
): Promise<{
  issues: ScanIssue[];
  resolvedIssues: ResolvedScanIssue[];
  countReturned: number;
  totalMatching: number;
  resolvedCount: number;
  summary: ScanIssuesSummary;
}> {
  const client = await ensureConnected();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  const params: Array<string | number> = [scanRunId, userId];
  const filters = ["si.scan_run_id = $1", "s.user_id = $2"];

  if (options?.status) {
    params.push(options.status);
    filters.push(`si.status = $${params.length}`);
  }
  if (options?.severity) {
    params.push(options.severity);
    filters.push(`si.severity = $${params.length}`);
  }
  if (options?.category) {
    params.push(options.category);
    filters.push(`si.category = $${params.length}`);
  }

  const whereClause = `WHERE ${filters.join(" AND ")}`;
  const includeOpen = options?.status !== "resolved";
  const includeResolved = options?.status !== "open";

  const countRes = includeOpen
    ? await client.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM scan_issues si
          JOIN sites s ON s.id = si.site_id
          ${whereClause}
        `,
        params,
      )
    : { rows: [{ count: "0" }] };

  const summaryRes = includeOpen
    ? await client.query<{
        severity: ScanIssueSeverity;
        issue_type: string;
        change_status: ScanIssueChangeStatus | null;
        count: string;
      }>(
        `
          SELECT severity, issue_type, change_status, COUNT(*) AS count
          FROM scan_issues si
          JOIN sites s ON s.id = si.site_id
          ${whereClause}
          GROUP BY severity, issue_type, change_status
        `,
        params,
      )
    : {
        rows: [] as Array<{
          severity: ScanIssueSeverity;
          issue_type: string;
          change_status: ScanIssueChangeStatus | null;
          count: string;
        }>,
      };

  const resolvedParams: Array<string | number> = [scanRunId, userId];
  const resolvedFilters = ["sis.resolved_scan_run_id = $1", "s.user_id = $2"];
  if (options?.severity) {
    resolvedParams.push(options.severity);
    resolvedFilters.push(`sis.latest_severity = $${resolvedParams.length}`);
  }
  if (options?.category) {
    resolvedParams.push(options.category);
    resolvedFilters.push(`sis.category = $${resolvedParams.length}`);
  }
  const resolvedWhereClause = `WHERE ${resolvedFilters.join(" AND ")}`;
  const resolvedCountRes = includeResolved
    ? await client.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM site_issue_states sis
          JOIN sites s ON s.id = sis.site_id
          ${resolvedWhereClause}
        `,
        resolvedParams,
      )
    : { rows: [{ count: "0" }] };

  const totalMatching = Number(countRes.rows[0]?.count ?? 0);
  const resolvedCount = Number(resolvedCountRes.rows[0]?.count ?? 0);
  const summary: ScanIssuesSummary = {
    total: totalMatching,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    byIssueType: {},
    byChangeStatus: {
      new: 0,
      existing: 0,
      resolved: resolvedCount,
    },
  };

  for (const row of summaryRes.rows) {
    const count = Number(row.count);
    summary.bySeverity[row.severity] += count;
    summary.byIssueType[row.issue_type] =
      (summary.byIssueType[row.issue_type] ?? 0) + count;
    if (row.change_status === "new" || row.change_status === "existing") {
      summary.byChangeStatus[row.change_status] += count;
    }
  }

  const pageParams = [...params, limit, offset];
  const issuesRes = includeOpen
    ? await client.query<ScanIssue>(
        `
          SELECT
            si.id,
            si.scan_run_id,
            si.site_id,
            si.category,
            si.severity,
            si.status,
            si.issue_type,
            si.affected_url,
            si.source_url,
            si.title,
            si.description,
            si.evidence_json,
            si.change_status,
            si.first_seen_at,
            si.last_seen_at,
            si.resolved_at
          FROM scan_issues si
          JOIN sites s ON s.id = si.site_id
          ${whereClause}
          ORDER BY
            CASE si.severity
              WHEN 'critical' THEN 0
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              ELSE 4
            END,
            CASE si.change_status
              WHEN 'new' THEN 0
              WHEN 'existing' THEN 1
              ELSE 2
            END,
            si.last_seen_at DESC,
            si.affected_url ASC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `,
        pageParams,
      )
    : { rows: [] as ScanIssue[] };

  const resolvedIssuesRes = includeResolved
    ? await client.query<ResolvedScanIssue>(
        `
          SELECT
            sis.id,
            sis.site_id,
            sis.category,
            sis.latest_severity AS severity,
            sis.issue_type,
            sis.affected_url,
            sis.latest_source_url AS source_url,
            sis.latest_title AS title,
            sis.latest_description AS description,
            sis.latest_evidence_json AS evidence_json,
            sis.first_seen_at,
            sis.last_seen_at,
            sis.resolved_at,
            sis.resolved_scan_run_id,
            'resolved'::text AS change_status,
            'resolved'::text AS status
          FROM site_issue_states sis
          JOIN sites s ON s.id = sis.site_id
          ${resolvedWhereClause}
          ORDER BY
            CASE sis.latest_severity
              WHEN 'critical' THEN 0
              WHEN 'high' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'low' THEN 3
              ELSE 4
            END,
            sis.resolved_at DESC,
            sis.affected_url ASC
        `,
        resolvedParams,
      )
    : { rows: [] as ResolvedScanIssue[] };

  return {
    issues: issuesRes.rows,
    resolvedIssues: resolvedIssuesRes.rows,
    countReturned: issuesRes.rows.length,
    totalMatching,
    resolvedCount,
    summary,
  };
}
