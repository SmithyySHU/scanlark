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
  | "sitemap_url_broken";

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
  first_seen_at: Date;
  last_seen_at: Date;
  resolved_at: Date | null;
}

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
  check_type: "robots_txt" | "sitemap_xml" | "sitemap_index_xml";
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
  };
}

function buildSiteIssue(
  scanRunId: string,
  siteId: string,
  category: "robots" | "sitemap",
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

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

async function insertIssues(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  issues: StoredIssueInput[],
) {
  if (issues.length === 0) return;

  const params: Array<string | null | Record<string, unknown>> = [];
  const values = issues.map((issue, index) => {
    const base = index * 12;
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
      null,
    );
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
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
        resolved_at
      )
      VALUES ${values.join(",\n")}
    `,
    params,
  );
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
        row.check_type === "sitemap_xml" || row.check_type === "sitemap_index_xml",
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
          typeof entry.url === "string" && entry.url ? entry.url : row.target_url;
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
                typeof entry.status_code === "number" ? entry.status_code : null,
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
  countReturned: number;
  totalMatching: number;
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

  const countRes = await client.query<{ count: string }>(
    `
      SELECT COUNT(*) AS count
      FROM scan_issues si
      JOIN sites s ON s.id = si.site_id
      ${whereClause}
    `,
    params,
  );

  const summaryRes = await client.query<{
    severity: ScanIssueSeverity;
    issue_type: string;
    count: string;
  }>(
    `
      SELECT severity, issue_type, COUNT(*) AS count
      FROM scan_issues si
      JOIN sites s ON s.id = si.site_id
      ${whereClause}
      GROUP BY severity, issue_type
    `,
    params,
  );

  const totalMatching = Number(countRes.rows[0]?.count ?? 0);
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
  };

  for (const row of summaryRes.rows) {
    const count = Number(row.count);
    summary.bySeverity[row.severity] += count;
    summary.byIssueType[row.issue_type] =
      (summary.byIssueType[row.issue_type] ?? 0) + count;
  }

  const pageParams = [...params, limit, offset];
  const issuesRes = await client.query<ScanIssue>(
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
        si.last_seen_at DESC,
        si.affected_url ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `,
    pageParams,
  );

  return {
    issues: issuesRes.rows,
    countReturned: issuesRes.rows.length,
    totalMatching,
    summary,
  };
}
