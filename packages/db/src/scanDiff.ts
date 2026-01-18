import { ensureConnected } from "./client";
import type { LinkClassification } from "./scanRuns";

export type ScanDiffChangeType =
  | "new_issue"
  | "fixed"
  | "changed"
  | "unchanged"
  | "added"
  | "removed";

export type ScanDiffRun = {
  id: string;
  started_at: Date;
  finished_at: Date | null;
};

export type ScanDiffSide = {
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  source_pages: string[];
};

export type ScanDiffItem = {
  link_url: string;
  change_type: ScanDiffChangeType;
  current: ScanDiffSide | null;
  baseline: ScanDiffSide | null;
};

export type ScanDiffSummary = {
  newIssues: number;
  fixedIssues: number;
  changed: number;
  outstandingIssues: number;
  outstandingOk: number;
  outstandingTotal: number;
  added: number;
  removed: number;
};

export type ScanDiffMeta = {
  includeUnchanged: boolean;
  unchangedOnly: boolean;
  unchangedScope: "issues" | "ok" | "all";
  unchangedLimit: number;
  unchangedOffset: number;
  unchangedReturned: number;
  changesReturned: number;
};

export async function getBaselineRunForDiff(
  siteId: string,
  currentRunId: string,
): Promise<ScanDiffRun | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanDiffRun>(
    `
      SELECT id, started_at, finished_at
      FROM scan_runs
      WHERE site_id = $1
        AND status = 'completed'
        AND finished_at IS NOT NULL
        AND id <> $2
      ORDER BY finished_at DESC
      LIMIT 1
    `,
    [siteId, currentRunId],
  );
  return res.rows[0] ?? null;
}

export async function getCompletedRunForSite(
  siteId: string,
  runId: string,
): Promise<ScanDiffRun | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanDiffRun>(
    `
      SELECT id, started_at, finished_at
      FROM scan_runs
      WHERE id = $1
        AND site_id = $2
        AND status = 'completed'
        AND finished_at IS NOT NULL
      LIMIT 1
    `,
    [runId, siteId],
  );
  return res.rows[0] ?? null;
}

type ScanDiffRow = {
  link_url: string;
  change_type: ScanDiffChangeType;
  cur_classification: LinkClassification | null;
  cur_status_code: number | null;
  cur_error_message: string | null;
  cur_source_pages: string[] | null;
  base_classification: LinkClassification | null;
  base_status_code: number | null;
  base_error_message: string | null;
  base_source_pages: string[] | null;
};

export async function getScanDiff(
  currentRunId: string,
  baselineRunId: string,
  options?: {
    issuesOnly?: boolean;
    limit?: number;
    offset?: number;
    changeTypes?: ScanDiffChangeType[] | null;
    includeUnchanged?: boolean;
    unchangedOnly?: boolean;
    unchangedScope?: "issues" | "ok" | "all";
    unchangedLimit?: number;
    unchangedOffset?: number;
  },
): Promise<{
  summary: ScanDiffSummary;
  items: ScanDiffItem[];
  meta: ScanDiffMeta;
}> {
  const client = await ensureConnected();

  const issuesOnly = options?.issuesOnly ?? true;
  const limit = options?.limit ?? 200;
  const offset = options?.offset ?? 0;
  const includeUnchanged = options?.includeUnchanged ?? false;
  const unchangedOnly = options?.unchangedOnly ?? false;
  const unchangedLimit = options?.unchangedLimit ?? 50;
  const unchangedOffset = options?.unchangedOffset ?? 0;
  const effectiveUnchangedScope = issuesOnly
    ? "issues"
    : (options?.unchangedScope ?? "all");

  const baseCte = `
    WITH current_links AS (
      SELECT
        l.link_url,
        l.classification,
        l.status_code,
        l.error_message,
        COALESCE(
          array_remove(array_agg(DISTINCT o.source_page), NULL),
          ARRAY[]::text[]
        ) AS source_pages
      FROM scan_links l
      LEFT JOIN scan_link_occurrences o
        ON o.scan_run_id = l.scan_run_id AND o.link_url = l.link_url
      WHERE l.scan_run_id = $1 AND l.ignored = false
      GROUP BY l.link_url, l.classification, l.status_code, l.error_message
    ),
    baseline_links AS (
      SELECT
        l.link_url,
        l.classification,
        l.status_code,
        l.error_message,
        COALESCE(
          array_remove(array_agg(DISTINCT o.source_page), NULL),
          ARRAY[]::text[]
        ) AS source_pages
      FROM scan_links l
      LEFT JOIN scan_link_occurrences o
        ON o.scan_run_id = l.scan_run_id AND o.link_url = l.link_url
      WHERE l.scan_run_id = $2 AND l.ignored = false
      GROUP BY l.link_url, l.classification, l.status_code, l.error_message
    ),
    joined AS (
      SELECT
        COALESCE(cur.link_url, base.link_url) AS link_url,
        cur.classification AS cur_classification,
        cur.status_code AS cur_status_code,
        cur.error_message AS cur_error_message,
        cur.source_pages AS cur_source_pages,
        base.classification AS base_classification,
        base.status_code AS base_status_code,
        base.error_message AS base_error_message,
        base.source_pages AS base_source_pages,
        (cur.classification IN ('broken', 'blocked', 'no_response')) AS cur_is_issue,
        (base.classification IN ('broken', 'blocked', 'no_response')) AS base_is_issue,
        (
          cur.link_url IS NOT NULL
          AND base.link_url IS NOT NULL
          AND cur.classification = base.classification
          AND cur.status_code IS NOT DISTINCT FROM base.status_code
          AND cur.error_message IS NOT DISTINCT FROM base.error_message
        ) AS unchanged,
        CASE
          WHEN cur.link_url IS NOT NULL AND base.link_url IS NULL THEN
            CASE
              WHEN cur.classification IN ('broken', 'blocked', 'no_response') THEN 'new_issue'
              ELSE 'added'
            END
          WHEN cur.link_url IS NULL AND base.link_url IS NOT NULL THEN
            CASE
              WHEN base.classification IN ('broken', 'blocked', 'no_response') THEN 'fixed'
              ELSE 'removed'
            END
          WHEN cur.link_url IS NOT NULL
            AND base.link_url IS NOT NULL
            AND (
              cur.classification <> base.classification
              OR cur.status_code IS DISTINCT FROM base.status_code
            ) THEN
            CASE
              WHEN base.classification IN ('broken', 'blocked', 'no_response')
                AND cur.classification NOT IN ('broken', 'blocked', 'no_response') THEN 'fixed'
              WHEN base.classification NOT IN ('broken', 'blocked', 'no_response')
                AND cur.classification IN ('broken', 'blocked', 'no_response') THEN 'new_issue'
              ELSE 'changed'
            END
          ELSE NULL
        END AS change_type
      FROM current_links cur
      FULL OUTER JOIN baseline_links base ON base.link_url = cur.link_url
    )
  `;

  const summaryRes = await client.query<{
    new_issues: string;
    fixed_issues: string;
    changed: string;
    outstanding_issues: string;
    outstanding_ok: string;
    outstanding_total: string;
    added: string;
    removed: string;
  }>(
    `
      ${baseCte}
      SELECT
        COUNT(*) FILTER (
          WHERE change_type = 'new_issue'
            AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
        ) AS new_issues,
        COUNT(*) FILTER (
          WHERE change_type = 'fixed'
            AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
        ) AS fixed_issues,
        COUNT(*) FILTER (
          WHERE change_type = 'changed'
            AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
        ) AS changed,
        COUNT(*) FILTER (
          WHERE unchanged AND cur_is_issue
        ) AS outstanding_issues,
        COUNT(*) FILTER (
          WHERE unchanged AND cur_classification = 'ok'
        ) AS outstanding_ok,
        COUNT(*) FILTER (
          WHERE unchanged
        ) AS outstanding_total,
        COUNT(*) FILTER (
          WHERE change_type = 'added'
            AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
        ) AS added,
        COUNT(*) FILTER (
          WHERE change_type = 'removed'
            AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
        ) AS removed
      FROM joined
    `,
    [currentRunId, baselineRunId, issuesOnly],
  );
  const summaryRow = summaryRes.rows[0];
  const outstandingIssues = Number(summaryRow?.outstanding_issues ?? 0);
  const outstandingOk = issuesOnly
    ? 0
    : Number(summaryRow?.outstanding_ok ?? 0);
  const summary: ScanDiffSummary = {
    newIssues: Number(summaryRow?.new_issues ?? 0),
    fixedIssues: Number(summaryRow?.fixed_issues ?? 0),
    changed: Number(summaryRow?.changed ?? 0),
    outstandingIssues,
    outstandingOk,
    outstandingTotal: issuesOnly
      ? outstandingIssues
      : Number(summaryRow?.outstanding_total ?? 0),
    added: Number(summaryRow?.added ?? 0),
    removed: Number(summaryRow?.removed ?? 0),
  };

  const changeTypes = options?.changeTypes ?? null;
  let changeRows: ScanDiffRow[] = [];
  let unchangedRows: ScanDiffRow[] = [];

  if (!unchangedOnly) {
    const itemsRes = await client.query<ScanDiffRow>(
      `
        ${baseCte}
        SELECT
          link_url,
          change_type,
          cur_classification,
          cur_status_code,
          cur_error_message,
          COALESCE(cur_source_pages, ARRAY[]::text[]) AS cur_source_pages,
          base_classification,
          base_status_code,
          base_error_message,
          COALESCE(base_source_pages, ARRAY[]::text[]) AS base_source_pages
        FROM joined
        WHERE change_type IS NOT NULL
          AND ($3::boolean = false OR (cur_is_issue OR base_is_issue))
          AND ($6::text[] IS NULL OR change_type = ANY($6))
        ORDER BY
          CASE change_type
            WHEN 'new_issue' THEN 0
            WHEN 'changed' THEN 1
            WHEN 'fixed' THEN 2
            WHEN 'removed' THEN 3
            WHEN 'added' THEN 4
            ELSE 5
          END,
          CASE COALESCE(cur_classification, base_classification)
            WHEN 'broken' THEN 0
            WHEN 'blocked' THEN 1
            WHEN 'no_response' THEN 2
            WHEN 'ok' THEN 3
            ELSE 4
          END,
          link_url ASC
        LIMIT $4 OFFSET $5
      `,
      [currentRunId, baselineRunId, issuesOnly, limit, offset, changeTypes],
    );
    changeRows = itemsRes.rows;
  }

  if (includeUnchanged || unchangedOnly) {
    const unchangedRes = await client.query<ScanDiffRow>(
      `
        ${baseCte}
        SELECT
          link_url,
          'unchanged'::text AS change_type,
          cur_classification,
          cur_status_code,
          cur_error_message,
          COALESCE(cur_source_pages, ARRAY[]::text[]) AS cur_source_pages,
          base_classification,
          base_status_code,
          base_error_message,
          COALESCE(base_source_pages, ARRAY[]::text[]) AS base_source_pages
        FROM joined
        WHERE unchanged = true
          AND ($3::text = 'all'
            OR ($3::text = 'issues' AND cur_classification IN ('broken', 'blocked', 'no_response'))
            OR ($3::text = 'ok' AND cur_classification = 'ok')
          )
        ORDER BY link_url ASC
        LIMIT $4 OFFSET $5
      `,
      [
        currentRunId,
        baselineRunId,
        effectiveUnchangedScope,
        unchangedLimit,
        unchangedOffset,
      ],
    );
    unchangedRows = unchangedRes.rows;
  }

  const rows = unchangedOnly ? unchangedRows : [...changeRows, ...unchangedRows];
  const items: ScanDiffItem[] = rows.map((row) => ({
    link_url: row.link_url,
    change_type: row.change_type,
    current: row.cur_classification
      ? {
          classification: row.cur_classification,
          status_code: row.cur_status_code,
          error_message: row.cur_error_message,
          source_pages: row.cur_source_pages ?? [],
        }
      : null,
    baseline: row.base_classification
      ? {
          classification: row.base_classification,
          status_code: row.base_status_code,
          error_message: row.base_error_message,
          source_pages: row.base_source_pages ?? [],
        }
      : null,
  }));

  return {
    summary,
    items,
    meta: {
      includeUnchanged,
      unchangedOnly,
      unchangedScope: effectiveUnchangedScope,
      unchangedLimit,
      unchangedOffset,
      unchangedReturned: unchangedRows.length,
      changesReturned: changeRows.length,
    },
  };
}
