import { ensureConnected } from "./client";
import { computeSeverityScore } from "./scanCategoryScores";

export type ScanStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface ScanRunRow {
  id: string;
  site_id: string;
  status: ScanStatus;
  started_at: Date;
  finished_at: Date | null;
  notified_at: Date | null;
  error_message: string | null;
  updated_at: Date;
  start_url: string;
  total_links: number;
  checked_links: number;
  broken_links: number;
  trigger_type: "manual" | "scheduled";
  issue_generation_status: "pending" | "completed" | "failed";
  issue_generation_error: string | null;
  overall_score?: number | null;
  score?: number | null;
  open_issues?: number;
  new_issues?: number;
  resolved_issues?: number;
  blocked_links?: number;
  no_response_links?: number;
}

type ScanRunSummaryRow = ScanRunRow & {
  open_issues: number;
  new_issues: number;
  resolved_issues: number;
  blocked_links: number;
  no_response_links: number;
  severity_critical: number;
  severity_high: number;
  severity_medium: number;
  severity_low: number;
  severity_info: number;
};

function applyRunSummaryMetrics(row: ScanRunSummaryRow): ScanRunRow {
  const severityCounts = {
    critical: row.severity_critical,
    high: row.severity_high,
    medium: row.severity_medium,
    low: row.severity_low,
    info: row.severity_info,
  };
  const metricsReady = row.status === "completed";
  const score = metricsReady ? computeSeverityScore(severityCounts) : null;
  return {
    ...row,
    open_issues: row.open_issues,
    new_issues: row.new_issues,
    resolved_issues: row.resolved_issues,
    blocked_links: row.blocked_links,
    no_response_links: row.no_response_links,
    overall_score: row.status === "completed" ? score : null,
    score: row.status === "completed" ? score : null,
  };
}

function runSummarySelectFields(): string {
  return `
    r.id,
    r.site_id,
    r.status,
    r.started_at,
    r.finished_at,
    r.notified_at,
    r.error_message,
    r.updated_at,
    r.start_url,
    r.total_links,
    r.checked_links,
    r.broken_links,
    r.trigger_type,
    r.issue_generation_status,
    r.issue_generation_error,
    COALESCE(issue_summary.open_issues, 0)::int AS open_issues,
    COALESCE(issue_summary.new_issues, 0)::int AS new_issues,
    COALESCE(resolved_summary.resolved_issues, 0)::int AS resolved_issues,
    COALESCE(link_summary.blocked_links, 0)::int AS blocked_links,
    COALESCE(link_summary.no_response_links, 0)::int AS no_response_links,
    COALESCE(issue_summary.severity_critical, 0)::int AS severity_critical,
    COALESCE(issue_summary.severity_high, 0)::int AS severity_high,
    COALESCE(issue_summary.severity_medium, 0)::int AS severity_medium,
    COALESCE(issue_summary.severity_low, 0)::int AS severity_low,
    COALESCE(issue_summary.severity_info, 0)::int AS severity_info
  `;
}

const runSummaryJoins = `
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE si.status = 'open')::int AS open_issues,
      COUNT(*) FILTER (
        WHERE si.status = 'open' AND si.change_status = 'new'
      )::int AS new_issues,
      COUNT(*) FILTER (
        WHERE si.severity = 'critical' AND si.status = 'open'
      )::int AS severity_critical,
      COUNT(*) FILTER (
        WHERE si.severity = 'high' AND si.status = 'open'
      )::int AS severity_high,
      COUNT(*) FILTER (
        WHERE si.severity = 'medium' AND si.status = 'open'
      )::int AS severity_medium,
      COUNT(*) FILTER (
        WHERE si.severity = 'low' AND si.status = 'open'
      )::int AS severity_low,
      COUNT(*) FILTER (
        WHERE si.severity = 'info' AND si.status = 'open'
      )::int AS severity_info
    FROM scan_issues si
    WHERE si.scan_run_id = r.id
  ) AS issue_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (
      WHERE sl.classification = 'blocked' AND sl.ignored = false
    )::int AS blocked_links,
    COUNT(*) FILTER (
      WHERE sl.classification = 'no_response' AND sl.ignored = false
    )::int AS no_response_links
    FROM scan_links sl
    WHERE sl.scan_run_id = r.id
  ) AS link_summary ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS resolved_issues
    FROM site_issue_states sis
    WHERE sis.resolved_scan_run_id = r.id
  ) AS resolved_summary ON TRUE
`;

export async function getLatestScanForSite(
  siteId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();

  const res = await client.query<ScanRunRow>(
    `
      SELECT
        id,
        site_id,
        status,
        started_at,
        finished_at,
        notified_at,
        error_message,
        updated_at,
        start_url,
        total_links,
        checked_links,
        broken_links,
        trigger_type,
        issue_generation_status,
        issue_generation_error
      FROM scan_runs
      WHERE site_id = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [siteId],
  );

  if (res.rowCount === 0) {
    return null;
  }

  return res.rows[0];
}

export async function getLatestScanForSiteForUser(
  userId: string,
  siteId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanRunRow>(
    `
      SELECT
        r.id,
        r.site_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.notified_at,
        r.error_message,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.issue_generation_status,
        r.issue_generation_error
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.site_id = $1 AND s.user_id = $2
      ORDER BY r.started_at DESC
      LIMIT 1
    `,
    [siteId, userId],
  );

  if (res.rowCount === 0) {
    return null;
  }

  return res.rows[0];
}

export async function getLatestCompletedScanForSiteForUser(
  userId: string,
  siteId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanRunRow>(
    `
      SELECT
        r.id,
        r.site_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.notified_at,
        r.error_message,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.issue_generation_status,
        r.issue_generation_error
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.site_id = $1
        AND s.user_id = $2
        AND r.status = 'completed'
        AND r.finished_at IS NOT NULL
      ORDER BY r.finished_at DESC
      LIMIT 1
    `,
    [siteId, userId],
  );

  if (res.rowCount === 0) {
    return null;
  }

  return res.rows[0];
}

export async function getRecentScansForSite(
  siteId: string,
  limit: number,
): Promise<ScanRunRow[]> {
  const client = await ensureConnected();

  const res = await client.query<ScanRunRow>(
    `
      SELECT
        id,
        site_id,
        status,
        started_at,
        finished_at,
        notified_at,
        error_message,
        updated_at,
        start_url,
        total_links,
        checked_links,
        broken_links,
        trigger_type,
        issue_generation_status,
        issue_generation_error
      FROM scan_runs
      WHERE site_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `,
    [siteId, limit],
  );

  return res.rows;
}

export async function getRecentScansForSiteForUser(
  userId: string,
  siteId: string,
  limit: number,
): Promise<ScanRunRow[]> {
  const client = await ensureConnected();

  const res = await client.query<ScanRunSummaryRow>(
    `
      SELECT
        ${runSummarySelectFields()}
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      ${runSummaryJoins}
      WHERE r.site_id = $1 AND s.user_id = $2
      ORDER BY r.started_at DESC
      LIMIT $3
    `,
    [siteId, userId, limit],
  );

  return res.rows.map(applyRunSummaryMetrics);
}

export async function getScanRunById(
  scanRunId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();

  const res = await client.query<ScanRunRow>(
    `
      SELECT
        id,
        site_id,
        status,
        started_at,
        finished_at,
        notified_at,
        error_message,
        updated_at,
        start_url,
        total_links,
        checked_links,
        broken_links,
        trigger_type,
        issue_generation_status,
        issue_generation_error
      FROM scan_runs
      WHERE id = $1
      LIMIT 1
    `,
    [scanRunId],
  );

  return res.rows[0] ?? null;
}

export async function getScanRunByIdForUser(
  userId: string,
  scanRunId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();

  const res = await client.query<ScanRunRow>(
    `
      SELECT
        r.id,
        r.site_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.notified_at,
        r.error_message,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.issue_generation_status,
        r.issue_generation_error
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1 AND s.user_id = $2
      LIMIT 1
    `,
    [scanRunId, userId],
  );

  return res.rows[0] ?? null;
}

export async function setScanRunNotified(scanRunId: string): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE scan_runs
      SET notified_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [scanRunId],
  );
}
