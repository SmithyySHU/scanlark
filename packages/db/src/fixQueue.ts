import { ensureConnected } from "./client";
import type { LinkClassification } from "./scanRuns";
import type { LinkNoteStatus } from "./linkNotes";

export type FixQueueChangeType = "new_issue" | "outstanding_issue";
export type FixQueueStatusFilter = LinkNoteStatus | "all";

export type FixQueueNote = {
  note: string;
  status: LinkNoteStatus;
  updated_at: Date;
};

export type FixQueueItem = {
  link_url: string;
  change_type: FixQueueChangeType;
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  source_pages: string[];
  ignored: boolean;
  ignore_reason: string | null;
  note: FixQueueNote | null;
};

export type FixQueueSummary = {
  newIssues: number;
  outstandingIssues: number;
  totalQueueItems: number;
  withNotesOpen: number;
  snoozed: number;
  resolved: number;
};

type FixQueueRow = {
  link_url: string;
  change_type: FixQueueChangeType;
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  source_pages: string[];
  ignored: boolean;
  ignore_reason: string | null;
  note: string | null;
  note_status: LinkNoteStatus | null;
  note_updated_at: Date | null;
};

type FixQueueSummaryRow = {
  new_issues: string;
  outstanding_issues: string;
  total_queue: string;
  with_notes_open: string;
  snoozed: string;
  resolved: string;
};

function noteStatusFilterClause(paramIndex: number) {
  return `
    AND (
      $${paramIndex}::text = 'all'
      OR (
        $${paramIndex}::text = 'open'
        AND (n.status IS NULL OR n.status = 'open')
      )
      OR ($${paramIndex}::text = 'snoozed' AND n.status = 'snoozed')
      OR ($${paramIndex}::text = 'resolved' AND n.status = 'resolved')
    )
  `;
}

function classificationOrderClause(column: string) {
  return `
    CASE ${column}
      WHEN 'broken' THEN 0
      WHEN 'blocked' THEN 1
      WHEN 'no_response' THEN 2
      WHEN 'ok' THEN 3
      ELSE 4
    END
  `;
}

export async function getFixQueueForRuns(args: {
  userId: string;
  siteId: string;
  currentRunId: string;
  baselineRunId?: string | null;
  includeNew?: boolean;
  includeOutstanding?: boolean;
  includeIgnored?: boolean;
  status?: FixQueueStatusFilter;
  limit?: number;
  offset?: number;
}): Promise<{ summary: FixQueueSummary; items: FixQueueItem[] }> {
  const client = await ensureConnected();
  const includeNew = args.includeNew ?? true;
  const includeOutstanding = args.includeOutstanding ?? true;
  const includeIgnored = args.includeIgnored ?? false;
  const statusFilter = args.status ?? "open";
  const limit = args.limit ?? 200;
  const offset = args.offset ?? 0;
  const ignoredClause = includeIgnored ? "" : " AND l.ignored = false";

  const emptySummary: FixQueueSummary = {
    newIssues: 0,
    outstandingIssues: 0,
    totalQueueItems: 0,
    withNotesOpen: 0,
    snoozed: 0,
    resolved: 0,
  };

  if (!includeNew && !includeOutstanding) {
    return { summary: emptySummary, items: [] };
  }

  if (!args.baselineRunId) {
    if (!includeOutstanding) {
      return { summary: emptySummary, items: [] };
    }

    const baseCte = `
      WITH current_links AS (
        SELECT
          l.link_url,
          l.classification,
          l.status_code,
          l.error_message,
          l.ignored,
          l.ignore_reason,
          COALESCE(
            array_remove(array_agg(DISTINCT o.source_page), NULL),
            ARRAY[]::text[]
          ) AS source_pages
        FROM scan_links l
        LEFT JOIN scan_link_occurrences o
          ON o.scan_run_id = l.scan_run_id AND o.link_url = l.link_url
        WHERE l.scan_run_id = $1${ignoredClause}
        GROUP BY
          l.link_url,
          l.classification,
          l.status_code,
          l.error_message,
          l.ignored,
          l.ignore_reason
      ),
      notes AS (
        SELECT link_url, note, status, updated_at
        FROM link_notes
        WHERE site_id = $2 AND user_id = $3
      )
    `;

    const summaryRes = await client.query<FixQueueSummaryRow>(
      `
        ${baseCte},
        filtered AS (
          SELECT
            cur.link_url,
            cur.classification,
            cur.status_code,
            cur.error_message,
            cur.source_pages,
            cur.ignored,
            cur.ignore_reason,
            n.note,
            n.status AS note_status,
            n.updated_at AS note_updated_at
          FROM current_links cur
          LEFT JOIN notes n ON n.link_url = cur.link_url
          WHERE cur.classification IN ('broken', 'blocked', 'no_response')
          ${noteStatusFilterClause(4)}
        )
        SELECT
          0 AS new_issues,
          COUNT(*) AS outstanding_issues,
          COUNT(*) AS total_queue,
          COUNT(*) FILTER (WHERE note_status = 'open') AS with_notes_open,
          COUNT(*) FILTER (WHERE note_status = 'snoozed') AS snoozed,
          COUNT(*) FILTER (WHERE note_status = 'resolved') AS resolved
        FROM filtered
      `,
      [args.currentRunId, args.siteId, args.userId, statusFilter],
    );

    const summaryRow = summaryRes.rows[0];
    const summary: FixQueueSummary = {
      newIssues: 0,
      outstandingIssues: Number(summaryRow?.outstanding_issues ?? 0),
      totalQueueItems: Number(summaryRow?.total_queue ?? 0),
      withNotesOpen: Number(summaryRow?.with_notes_open ?? 0),
      snoozed: Number(summaryRow?.snoozed ?? 0),
      resolved: Number(summaryRow?.resolved ?? 0),
    };

    const itemsRes = await client.query<FixQueueRow>(
      `
        ${baseCte},
        filtered AS (
          SELECT
            cur.link_url,
            cur.classification,
            cur.status_code,
            cur.error_message,
            cur.source_pages,
            cur.ignored,
            cur.ignore_reason,
            n.note,
            n.status AS note_status,
            n.updated_at AS note_updated_at
          FROM current_links cur
          LEFT JOIN notes n ON n.link_url = cur.link_url
          WHERE cur.classification IN ('broken', 'blocked', 'no_response')
          ${noteStatusFilterClause(4)}
        )
        SELECT
          link_url,
          'outstanding_issue'::text AS change_type,
          classification,
          status_code,
          error_message,
          source_pages,
          ignored,
          ignore_reason,
          note,
          note_status,
          note_updated_at
        FROM filtered
        ORDER BY
          ${classificationOrderClause("classification")},
          link_url ASC
        LIMIT $5 OFFSET $6
      `,
      [
        args.currentRunId,
        args.siteId,
        args.userId,
        statusFilter,
        limit,
        offset,
      ],
    );

    const items: FixQueueItem[] = itemsRes.rows.map((row) => ({
      link_url: row.link_url,
      change_type: row.change_type,
      classification: row.classification,
      status_code: row.status_code,
      error_message: row.error_message,
      source_pages: row.source_pages ?? [],
      ignored: row.ignored,
      ignore_reason: row.ignore_reason,
      note:
        row.note && row.note_status && row.note_updated_at
          ? {
              note: row.note,
              status: row.note_status,
              updated_at: row.note_updated_at,
            }
          : null,
    }));

    return { summary, items };
  }

  const baseCte = `
    WITH current_links AS (
      SELECT
        l.link_url,
        l.classification,
        l.status_code,
        l.error_message,
        l.ignored,
        l.ignore_reason,
        COALESCE(
          array_remove(array_agg(DISTINCT o.source_page), NULL),
          ARRAY[]::text[]
        ) AS source_pages
      FROM scan_links l
      LEFT JOIN scan_link_occurrences o
        ON o.scan_run_id = l.scan_run_id AND o.link_url = l.link_url
      WHERE l.scan_run_id = $1${ignoredClause}
      GROUP BY
        l.link_url,
        l.classification,
        l.status_code,
        l.error_message,
        l.ignored,
        l.ignore_reason
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
      WHERE l.scan_run_id = $2${ignoredClause}
      GROUP BY l.link_url, l.classification, l.status_code, l.error_message
    ),
    joined AS (
      SELECT
        COALESCE(cur.link_url, base.link_url) AS link_url,
        cur.classification AS cur_classification,
        cur.status_code AS cur_status_code,
        cur.error_message AS cur_error_message,
        cur.source_pages AS cur_source_pages,
        cur.ignored AS cur_ignored,
        cur.ignore_reason AS cur_ignore_reason,
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
    ),
    notes AS (
      SELECT link_url, note, status, updated_at
      FROM link_notes
      WHERE site_id = $3 AND user_id = $4
    )
  `;

  const summaryRes = await client.query<FixQueueSummaryRow>(
    `
      ${baseCte},
      filtered AS (
        SELECT
          link_url,
          CASE
            WHEN $5::boolean = true AND change_type = 'new_issue' AND cur_is_issue THEN 'new_issue'
            WHEN $6::boolean = true AND unchanged AND cur_is_issue THEN 'outstanding_issue'
            ELSE NULL
          END AS queue_type,
          cur_classification,
          cur_status_code,
          cur_error_message,
          cur_source_pages,
          cur_ignored,
          cur_ignore_reason,
          n.note,
          n.status AS note_status,
          n.updated_at AS note_updated_at
        FROM joined j
        LEFT JOIN notes n ON n.link_url = j.link_url
        WHERE (
          ($5::boolean = true AND change_type = 'new_issue' AND cur_is_issue)
          OR ($6::boolean = true AND unchanged AND cur_is_issue)
        )
        ${noteStatusFilterClause(7)}
      )
      SELECT
        COUNT(*) FILTER (WHERE queue_type = 'new_issue') AS new_issues,
        COUNT(*) FILTER (WHERE queue_type = 'outstanding_issue') AS outstanding_issues,
        COUNT(*) AS total_queue,
        COUNT(*) FILTER (WHERE note_status = 'open') AS with_notes_open,
        COUNT(*) FILTER (WHERE note_status = 'snoozed') AS snoozed,
        COUNT(*) FILTER (WHERE note_status = 'resolved') AS resolved
      FROM filtered
    `,
    [
      args.currentRunId,
      args.baselineRunId,
      args.siteId,
      args.userId,
      includeNew,
      includeOutstanding,
      statusFilter,
    ],
  );

  const summaryRow = summaryRes.rows[0];
  const summary: FixQueueSummary = {
    newIssues: Number(summaryRow?.new_issues ?? 0),
    outstandingIssues: Number(summaryRow?.outstanding_issues ?? 0),
    totalQueueItems: Number(summaryRow?.total_queue ?? 0),
    withNotesOpen: Number(summaryRow?.with_notes_open ?? 0),
    snoozed: Number(summaryRow?.snoozed ?? 0),
    resolved: Number(summaryRow?.resolved ?? 0),
  };

  const itemsRes = await client.query<FixQueueRow>(
    `
      ${baseCte},
      filtered AS (
        SELECT
          link_url,
          CASE
            WHEN $5::boolean = true AND change_type = 'new_issue' AND cur_is_issue THEN 'new_issue'
            WHEN $6::boolean = true AND unchanged AND cur_is_issue THEN 'outstanding_issue'
            ELSE NULL
          END AS queue_type,
          cur_classification,
          cur_status_code,
          cur_error_message,
          cur_source_pages,
          cur_ignored,
          cur_ignore_reason,
          n.note,
          n.status AS note_status,
          n.updated_at AS note_updated_at
        FROM joined j
        LEFT JOIN notes n ON n.link_url = j.link_url
        WHERE (
          ($5::boolean = true AND change_type = 'new_issue' AND cur_is_issue)
          OR ($6::boolean = true AND unchanged AND cur_is_issue)
        )
        ${noteStatusFilterClause(7)}
      )
      SELECT
        link_url,
        queue_type AS change_type,
        cur_classification AS classification,
        cur_status_code AS status_code,
        cur_error_message AS error_message,
        COALESCE(cur_source_pages, ARRAY[]::text[]) AS source_pages,
        cur_ignored AS ignored,
        cur_ignore_reason AS ignore_reason,
        note,
        note_status,
        note_updated_at
      FROM filtered
      WHERE queue_type IS NOT NULL
      ORDER BY
        CASE queue_type
          WHEN 'new_issue' THEN 0
          WHEN 'outstanding_issue' THEN 1
          ELSE 2
        END,
        ${classificationOrderClause("cur_classification")},
        link_url ASC
      LIMIT $8 OFFSET $9
    `,
    [
      args.currentRunId,
      args.baselineRunId,
      args.siteId,
      args.userId,
      includeNew,
      includeOutstanding,
      statusFilter,
      limit,
      offset,
    ],
  );

  const items: FixQueueItem[] = itemsRes.rows.map((row) => ({
    link_url: row.link_url,
    change_type: row.change_type,
    classification: row.classification,
    status_code: row.status_code,
    error_message: row.error_message,
    source_pages: row.source_pages ?? [],
    ignored: row.ignored,
    ignore_reason: row.ignore_reason,
    note:
      row.note && row.note_status && row.note_updated_at
        ? {
            note: row.note,
            status: row.note_status,
            updated_at: row.note_updated_at,
          }
        : null,
  }));

  return { summary, items };
}
