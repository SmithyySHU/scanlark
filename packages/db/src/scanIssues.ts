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
  | "ignored_safety_skip";

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

    const issues: StoredIssueInput[] = [
      ...linkRes.rows.map((row) =>
        buildLinkIssue(scanRunId, run.site_id, run.start_url, row),
      ),
      ...ignoredRes.rows.map((row) =>
        buildIgnoredSafetyIssue(scanRunId, run.site_id, row),
      ),
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
