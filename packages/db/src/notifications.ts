import { ensureConnected } from "./client";
import { isValidEmailAddress } from "./validation";

export type NotificationMode =
  | "new_issues_only"
  | "issues_exist"
  | "issues"
  | "always"
  | "never";

export type NotificationSettings = {
  notifyEnabled: boolean;
  notifyEmail: string | null;
  notifyOn: NotificationMode;
  notifyIncludeCsv: boolean;
  summaryEnabled: boolean;
};

export type NotificationEventKind =
  | "scan_failed"
  | "high_priority_issues_found"
  | "weekly_scan_summary"
  | "test";

export type NotificationEventInput = {
  siteId: string;
  scanRunId: string | null;
  kind: NotificationEventKind;
  toEmail: string;
  subject: string;
  payload: Record<string, unknown>;
};

export type LinkDeltaRow = {
  link_url: string;
  status_code: number | null;
  error_message: string | null;
  occurrence_count: number;
};

type SiteNotificationRow = {
  notify_enabled: boolean;
  notify_email: string | null;
  notify_on: "always" | "issues" | "issues_exist" | "new_issues_only" | "never";
  notify_include_csv: boolean;
  summary_enabled: boolean;
};

function normalizeNotifyOn(
  value: SiteNotificationRow["notify_on"],
): NotificationMode {
  if (value === "issues") return "issues_exist";
  return value;
}

type LinkCountRow = {
  classification: string;
  count: string;
};

export type IssueNotificationDigest = {
  totalOpenIssues: number;
  highPriorityCount: number;
  healthScore: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  topIssues: Array<{
    issueType: string;
    severity: string;
    category: string;
    affectedUrl: string;
    title: string;
    description: string;
  }>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computeIssueHealthScore(severityCounts: Record<string, number>) {
  const totalPenalty = clamp(
    Math.min(70, (severityCounts.critical ?? 0) * 25) +
      Math.min(40, (severityCounts.high ?? 0) * 12) +
      Math.min(30, (severityCounts.medium ?? 0) * 6) +
      Math.min(15, (severityCounts.low ?? 0) * 1),
    0,
    100,
  );
  return clamp(Math.round(100 - totalPenalty), 0, 100);
}

export async function getSiteNotificationSettings(
  siteId: string,
): Promise<NotificationSettings | null> {
  const client = await ensureConnected();
  const res = await client.query<SiteNotificationRow>(
    `
      SELECT notify_enabled,
             notify_email,
             notify_on,
             notify_include_csv,
             summary_enabled
      FROM sites
      WHERE id = $1
    `,
    [siteId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    notifyEnabled: row.notify_enabled,
    notifyEmail: row.notify_email,
    notifyOn: normalizeNotifyOn(row.notify_on),
    notifyIncludeCsv: row.notify_include_csv,
    summaryEnabled: row.summary_enabled,
  };
}

export async function getSiteNotificationSettingsForUser(
  userId: string,
  siteId: string,
): Promise<NotificationSettings | null> {
  const client = await ensureConnected();
  const res = await client.query<SiteNotificationRow>(
    `
      SELECT notify_enabled,
             notify_email,
             notify_on,
             notify_include_csv,
             summary_enabled
      FROM sites
      WHERE id = $1 AND user_id = $2
    `,
    [siteId, userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    notifyEnabled: row.notify_enabled,
    notifyEmail: row.notify_email,
    notifyOn: normalizeNotifyOn(row.notify_on),
    notifyIncludeCsv: row.notify_include_csv,
    summaryEnabled: row.summary_enabled,
  };
}

export async function updateSiteNotificationSettings(
  siteId: string,
  fields: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const existing = await getSiteNotificationSettings(siteId);
  if (!existing) throw new Error("site_not_found");
  const next: NotificationSettings = { ...existing, ...fields };
  const normalizedNotifyOn =
    next.notifyOn === "issues" ? "issues_exist" : next.notifyOn;
  if (
    next.notifyEnabled &&
    normalizedNotifyOn !== "never" &&
    (!next.notifyEmail || !isValidEmailAddress(next.notifyEmail))
  ) {
    throw new Error("invalid_notify_email");
  }
  const client = await ensureConnected();
  const res = await client.query<SiteNotificationRow>(
    `
      UPDATE sites
      SET notify_enabled = $2,
          notify_email = $3,
          notify_on = $4,
          notify_include_csv = $5,
          summary_enabled = $6
      WHERE id = $1
      RETURNING notify_enabled,
                notify_email,
                notify_on,
                notify_include_csv,
                summary_enabled
    `,
    [
      siteId,
      next.notifyEnabled,
      next.notifyEmail,
      normalizedNotifyOn,
      next.notifyIncludeCsv,
      next.summaryEnabled,
    ],
  );
  const row = res.rows[0];
  if (!row) throw new Error("site_not_found");
  return {
    notifyEnabled: row.notify_enabled,
    notifyEmail: row.notify_email,
    notifyOn: normalizeNotifyOn(row.notify_on),
    notifyIncludeCsv: row.notify_include_csv,
    summaryEnabled: row.summary_enabled,
  };
}

export async function updateSiteNotificationSettingsForUser(
  userId: string,
  siteId: string,
  fields: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const existing = await getSiteNotificationSettingsForUser(userId, siteId);
  if (!existing) throw new Error("site_not_found");
  const next: NotificationSettings = { ...existing, ...fields };
  const normalizedNotifyOn =
    next.notifyOn === "issues" ? "issues_exist" : next.notifyOn;
  if (
    next.notifyEnabled &&
    normalizedNotifyOn !== "never" &&
    (!next.notifyEmail || !isValidEmailAddress(next.notifyEmail))
  ) {
    throw new Error("invalid_notify_email");
  }
  const client = await ensureConnected();
  const res = await client.query<SiteNotificationRow>(
    `
      UPDATE sites
      SET notify_enabled = $3,
          notify_email = $4,
          notify_on = $5,
          notify_include_csv = $6,
          summary_enabled = $7
      WHERE id = $1 AND user_id = $2
      RETURNING notify_enabled,
                notify_email,
                notify_on,
                notify_include_csv,
                summary_enabled
    `,
    [
      siteId,
      userId,
      next.notifyEnabled,
      next.notifyEmail,
      normalizedNotifyOn,
      next.notifyIncludeCsv,
      next.summaryEnabled,
    ],
  );
  const row = res.rows[0];
  if (!row) throw new Error("site_not_found");
  return {
    notifyEnabled: row.notify_enabled,
    notifyEmail: row.notify_email,
    notifyOn: normalizeNotifyOn(row.notify_on),
    notifyIncludeCsv: row.notify_include_csv,
    summaryEnabled: row.summary_enabled,
  };
}

export async function recordNotificationEvent(
  input: NotificationEventInput,
): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO notification_events
        (site_id, scan_run_id, kind, to_email, subject, payload_json)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.siteId,
      input.scanRunId,
      input.kind,
      input.toEmail,
      input.subject,
      input.payload,
    ],
  );
}

export async function tryRecordNotificationEvent(
  input: NotificationEventInput,
): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      INSERT INTO notification_events
        (site_id, scan_run_id, kind, to_email, subject, payload_json)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    [
      input.siteId,
      input.scanRunId,
      input.kind,
      input.toEmail,
      input.subject,
      input.payload,
    ],
  );
  return !!res.rows[0];
}

export async function markScanRunNotified(scanRunId: string): Promise<void> {
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

export async function getLastNotifiedScanRunId(
  siteId: string,
): Promise<string | null> {
  const client = await ensureConnected();
  const res = await client.query<{ last_notified_scan_run_id: string | null }>(
    `SELECT last_notified_scan_run_id FROM sites WHERE id = $1`,
    [siteId],
  );
  return res.rows[0]?.last_notified_scan_run_id ?? null;
}

export async function setLastNotifiedScanRunId(
  siteId: string,
  scanRunId: string | null,
): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE sites
      SET last_notified_scan_run_id = $2
      WHERE id = $1
    `,
    [siteId, scanRunId],
  );
}

export async function getLinkCountsForRun(scanRunId: string): Promise<{
  brokenCount: number;
  blockedCount: number;
  okCount: number;
  noResponseCount: number;
}> {
  const client = await ensureConnected();
  const res = await client.query<LinkCountRow>(
    `
      SELECT classification, COUNT(*)::text AS count
      FROM scan_links
      WHERE scan_run_id = $1 AND ignored = false
      GROUP BY classification
    `,
    [scanRunId],
  );
  const map = new Map<string, number>();
  res.rows.forEach((row) => {
    map.set(row.classification, Number(row.count));
  });
  return {
    brokenCount: map.get("broken") ?? 0,
    blockedCount: map.get("blocked") ?? 0,
    okCount: map.get("ok") ?? 0,
    noResponseCount: map.get("no_response") ?? 0,
  };
}

export async function getIssueNotificationDigestForRun(
  scanRunId: string,
): Promise<IssueNotificationDigest> {
  const client = await ensureConnected();
  const countsRes = await client.query<{
    severity: string;
    category: string;
    count: string;
  }>(
    `
      SELECT severity, category, COUNT(*)::text AS count
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      GROUP BY severity, category
    `,
    [scanRunId],
  );

  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const byCategory: Record<string, number> = {};
  let totalOpenIssues = 0;

  for (const row of countsRes.rows) {
    const count = Number(row.count);
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + count;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + count;
    totalOpenIssues += count;
  }

  const topIssuesRes = await client.query<{
    issue_type: string;
    severity: string;
    category: string;
    affected_url: string;
    title: string;
    description: string;
  }>(
    `
      SELECT issue_type,
             severity,
             category,
             affected_url,
             title,
             description
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 0
          WHEN 'high' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END,
        last_seen_at DESC,
        affected_url ASC
      LIMIT 5
    `,
    [scanRunId],
  );

  return {
    totalOpenIssues,
    highPriorityCount: (bySeverity.critical ?? 0) + (bySeverity.high ?? 0),
    healthScore: computeIssueHealthScore(bySeverity),
    bySeverity,
    byCategory,
    topIssues: topIssuesRes.rows.map((row) => ({
      issueType: row.issue_type,
      severity: row.severity,
      category: row.category,
      affectedUrl: row.affected_url,
      title: row.title,
      description: row.description,
    })),
  };
}

export async function getPreviousCompletedRunId(
  siteId: string,
  currentRunId: string,
): Promise<string | null> {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      SELECT id
      FROM scan_runs
      WHERE site_id = $1
        AND status = 'completed'
        AND id <> $2
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [siteId, currentRunId],
  );
  return res.rows[0]?.id ?? null;
}

export async function hasNotificationEvent(params: {
  siteId: string;
  scanRunId: string | null;
  kind: NotificationEventKind;
}): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      SELECT id
      FROM notification_events
      WHERE site_id = $1
        AND scan_run_id IS NOT DISTINCT FROM $2
        AND kind = $3
      LIMIT 1
    `,
    [params.siteId, params.scanRunId, params.kind],
  );
  return !!res.rows[0];
}

export async function getNewLinksSinceLastNotified(
  currentRunId: string,
  previousRunId: string | null,
  limit = 50,
): Promise<{
  newBroken: LinkDeltaRow[];
  newBlocked: LinkDeltaRow[];
  newNoResponse: LinkDeltaRow[];
}> {
  const client = await ensureConnected();

  const res = previousRunId
    ? await client.query<
        LinkDeltaRow & { classification: "broken" | "blocked" | "no_response" }
      >(
        `
          SELECT link_url,
                 status_code,
                 error_message,
                 occurrence_count,
                 classification
          FROM scan_links cur
          WHERE cur.scan_run_id = $1
            AND cur.classification IN ('broken', 'blocked', 'no_response')
            AND cur.ignored = false
            AND NOT EXISTS (
              SELECT 1 FROM scan_links prev
              WHERE prev.scan_run_id = $2
                AND prev.link_url = cur.link_url
                AND prev.classification = cur.classification
                AND prev.ignored = false
            )
          ORDER BY cur.occurrence_count DESC
          LIMIT $3
        `,
        [currentRunId, previousRunId, limit],
      )
    : await client.query<
        LinkDeltaRow & { classification: "broken" | "blocked" | "no_response" }
      >(
        `
          SELECT link_url,
                 status_code,
                 error_message,
                 occurrence_count,
                 classification
          FROM scan_links
          WHERE scan_run_id = $1
            AND classification IN ('broken', 'blocked', 'no_response')
            AND ignored = false
          ORDER BY occurrence_count DESC
          LIMIT $2
        `,
        [currentRunId, limit],
      );

  const newBroken: LinkDeltaRow[] = [];
  const newBlocked: LinkDeltaRow[] = [];
  const newNoResponse: LinkDeltaRow[] = [];

  res.rows.forEach((row) => {
    if (row.classification === "blocked") {
      newBlocked.push(row);
    } else if (row.classification === "no_response") {
      newNoResponse.push(row);
    } else {
      newBroken.push(row);
    }
  });

  return { newBroken, newBlocked, newNoResponse };
}
