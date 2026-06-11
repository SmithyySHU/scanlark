import { ensureConnected } from "./client";
import { emitScanEvent } from "./events";
import { computeSeverityScore } from "./scanCategoryScores";

export type AppNotificationKind =
  | "scan_completed"
  | "scan_failed"
  | "high_priority_issues"
  | "uptime_down"
  | "uptime_recovered";

export type AppNotificationSeverity =
  | "info"
  | "success"
  | "warning"
  | "critical";

export type AppNotification = {
  id: string;
  user_id: string;
  site_id: string | null;
  scan_run_id: string | null;
  kind: AppNotificationKind;
  severity: AppNotificationSeverity;
  title: string;
  message: string;
  action_url: string | null;
  read_at: Date | null;
  created_at: Date;
};

export type CreateAppNotificationInput = {
  userId: string;
  siteId?: string | null;
  scanRunId?: string | null;
  kind: AppNotificationKind;
  severity: AppNotificationSeverity;
  title: string;
  message: string;
  actionUrl?: string | null;
};

export type AppNotificationListStatus = "unread" | "all";

export type UserNotificationPreferences = {
  user_id: string | null;
  in_app_enabled: boolean;
  scan_completed_enabled: boolean;
  scan_failed_enabled: boolean;
  high_priority_issues_enabled: boolean;
  uptime_down_enabled: boolean;
  uptime_recovered_enabled: boolean;
  system_notices_enabled: boolean;
  created_at: Date | null;
  updated_at: Date | null;
};

export type UserNotificationPreferenceField =
  | "in_app_enabled"
  | "scan_completed_enabled"
  | "scan_failed_enabled"
  | "high_priority_issues_enabled"
  | "uptime_down_enabled"
  | "uptime_recovered_enabled"
  | "system_notices_enabled";

export type UpdateUserNotificationPreferencesInput = Partial<
  Pick<UserNotificationPreferences, UserNotificationPreferenceField>
>;

type ScanNotificationRunRow = {
  id: string;
  site_id: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "cancelled";
  error_message: string | null;
  checked_links: number;
  total_links: number;
  issue_generation_status: "pending" | "completed" | "failed";
  site_url: string;
  site_display_name: string | null;
  report_display_name: string | null;
};

const DEFAULT_USER_NOTIFICATION_PREFERENCES: Omit<
  UserNotificationPreferences,
  "user_id" | "created_at" | "updated_at"
> = {
  in_app_enabled: true,
  scan_completed_enabled: true,
  scan_failed_enabled: true,
  high_priority_issues_enabled: true,
  uptime_down_enabled: true,
  uptime_recovered_enabled: true,
  system_notices_enabled: true,
};

export const USER_NOTIFICATION_PREFERENCE_FIELDS: UserNotificationPreferenceField[] =
  [
    "in_app_enabled",
    "scan_completed_enabled",
    "scan_failed_enabled",
    "high_priority_issues_enabled",
    "uptime_down_enabled",
    "uptime_recovered_enabled",
    "system_notices_enabled",
  ];

const NOTIFICATION_KIND_PREFERENCE_FIELD: Record<
  AppNotificationKind,
  UserNotificationPreferenceField
> = {
  scan_completed: "scan_completed_enabled",
  scan_failed: "scan_failed_enabled",
  high_priority_issues: "high_priority_issues_enabled",
  uptime_down: "uptime_down_enabled",
  uptime_recovered: "uptime_recovered_enabled",
};

function getSiteLabel(
  row: Pick<
    ScanNotificationRunRow,
    "site_url" | "site_display_name" | "report_display_name"
  >,
) {
  if (row.report_display_name?.trim()) return row.report_display_name.trim();
  if (row.site_display_name?.trim()) return row.site_display_name.trim();
  try {
    return new URL(row.site_url).host;
  } catch {
    return row.site_url;
  }
}

function buildReportActionUrl(siteId: string, scanRunId: string) {
  return `/dashboard/reports?siteId=${encodeURIComponent(
    siteId,
  )}&runId=${encodeURIComponent(scanRunId)}`;
}

function buildDashboardActionUrl(siteId: string) {
  return `/dashboard?siteId=${encodeURIComponent(siteId)}`;
}

function withDefaultNotificationPreferences(
  userId: string | null,
  row?: Partial<UserNotificationPreferences> | null,
): UserNotificationPreferences {
  return {
    user_id: userId,
    ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
    ...row,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function getUserNotificationPreferences(
  userId: string,
): Promise<UserNotificationPreferences> {
  const client = await ensureConnected();
  const res = await client.query<UserNotificationPreferences>(
    `
      SELECT *
      FROM user_notification_preferences
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId],
  );
  return withDefaultNotificationPreferences(userId, res.rows[0] ?? null);
}

export async function updateUserNotificationPreferences(
  userId: string,
  patch: UpdateUserNotificationPreferencesInput,
): Promise<UserNotificationPreferences> {
  const entries = USER_NOTIFICATION_PREFERENCE_FIELDS.filter(
    (field) => patch[field] !== undefined,
  ).map((field) => [field, patch[field]] as const);

  if (entries.length === 0) {
    return getUserNotificationPreferences(userId);
  }

  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO user_notification_preferences (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING
    `,
    [userId],
  );

  const assignments = entries.map(
    ([field], index) => `${field} = $${index + 2}`,
  );
  const values = entries.map(([, value]) => value);
  const res = await client.query<UserNotificationPreferences>(
    `
      UPDATE user_notification_preferences
      SET ${assignments.join(", ")},
        updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `,
    [userId, ...values],
  );

  return withDefaultNotificationPreferences(userId, res.rows[0] ?? null);
}

export async function shouldCreateAppNotification(
  userId: string,
  kind: AppNotificationKind,
): Promise<boolean> {
  const preferences = await getUserNotificationPreferences(userId);
  if (!preferences.in_app_enabled) return false;
  const field = NOTIFICATION_KIND_PREFERENCE_FIELD[kind];
  return preferences[field];
}

async function emitNotificationCountUpdated(
  userId: string,
  unreadCount: number,
) {
  try {
    await emitScanEvent({
      type: "notification_count_updated",
      user_id: userId,
      unread_count: unreadCount,
    });
  } catch (err) {
    console.warn("Failed to emit notification count event", err);
  }
}

async function emitNotificationCreated(notification: AppNotification) {
  try {
    const unreadCount = await getUnreadAppNotificationCount(
      notification.user_id,
    );
    await emitScanEvent({
      type: "notification_created",
      user_id: notification.user_id,
      notification,
      unread_count: unreadCount,
    });
  } catch (err) {
    console.warn("Failed to emit notification created event", err);
  }
}

export async function createAppNotification(
  input: CreateAppNotificationInput,
): Promise<AppNotification | null> {
  const enabled = await shouldCreateAppNotification(input.userId, input.kind);
  if (!enabled) return null;

  const client = await ensureConnected();
  const res = await client.query<AppNotification>(
    `
      INSERT INTO app_notifications
        (user_id, site_id, scan_run_id, kind, severity, title, message, action_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT DO NOTHING
      RETURNING *
    `,
    [
      input.userId,
      input.siteId ?? null,
      input.scanRunId ?? null,
      input.kind,
      input.severity,
      input.title,
      input.message,
      input.actionUrl ?? null,
    ],
  );
  const notification = res.rows[0] ?? null;
  if (notification) {
    await emitNotificationCreated(notification);
  }
  return notification;
}

export async function listRecentAppNotificationsForUser(
  userId: string,
  limit = 20,
  status: AppNotificationListStatus = "unread",
): Promise<AppNotification[]> {
  const client = await ensureConnected();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const res = await client.query<AppNotification>(
    `
      SELECT *
      FROM app_notifications
      WHERE user_id = $1
        AND ($3::text = 'all' OR read_at IS NULL)
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, safeLimit, status],
  );
  return res.rows;
}

export async function getUnreadAppNotificationCount(
  userId: string,
): Promise<number> {
  const client = await ensureConnected();
  const res = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM app_notifications
      WHERE user_id = $1
        AND read_at IS NULL
    `,
    [userId],
  );
  return Number(res.rows[0]?.count ?? 0);
}

export async function markAppNotificationReadForUser(
  userId: string,
  notificationId: string,
): Promise<{ notification: AppNotification; unreadCount: number } | null> {
  const client = await ensureConnected();
  const res = await client.query<AppNotification>(
    `
      UPDATE app_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE id = $1
        AND user_id = $2
      RETURNING *
    `,
    [notificationId, userId],
  );
  const notification = res.rows[0] ?? null;
  if (!notification) return null;
  const unreadCount = await getUnreadAppNotificationCount(userId);
  await emitNotificationCountUpdated(userId, unreadCount);
  return { notification, unreadCount };
}

export async function markAllAppNotificationsReadForUser(
  userId: string,
): Promise<{
  updatedCount: number;
  readAt: Date | null;
  unreadCount: number;
}> {
  const client = await ensureConnected();
  const res = await client.query<{
    updated_count: string;
    read_at: Date | null;
  }>(
    `
      WITH updated AS (
        UPDATE app_notifications
        SET read_at = NOW()
        WHERE user_id = $1
          AND read_at IS NULL
        RETURNING read_at
      )
      SELECT COUNT(*)::text AS updated_count, MAX(read_at) AS read_at
      FROM updated
    `,
    [userId],
  );
  const row = res.rows[0];
  const unreadCount = await getUnreadAppNotificationCount(userId);
  await emitNotificationCountUpdated(userId, unreadCount);
  return {
    updatedCount: Number(row?.updated_count ?? 0),
    readAt: row?.read_at ?? null,
    unreadCount,
  };
}

export async function createScanAppNotificationsForRun(
  userId: string,
  scanRunId: string,
): Promise<void> {
  const client = await ensureConnected();
  const runRes = await client.query<ScanNotificationRunRow>(
    `
      SELECT
        r.id,
        r.site_id,
        r.status,
        r.error_message,
        r.checked_links,
        r.total_links,
        r.issue_generation_status,
        s.url AS site_url,
        s.site_display_name,
        s.report_display_name
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1
        AND s.user_id = $2
      LIMIT 1
    `,
    [scanRunId, userId],
  );
  const run = runRes.rows[0];
  if (!run) return;

  const siteLabel = getSiteLabel(run);
  const reportUrl = buildReportActionUrl(run.site_id, run.id);

  if (run.status === "failed" || run.status === "cancelled") {
    await createAppNotification({
      userId,
      siteId: run.site_id,
      scanRunId: run.id,
      kind: "scan_failed",
      severity: "warning",
      title: `Scan failed for ${siteLabel}`,
      message: run.error_message
        ? `Scanlark could not finish this scan: ${run.error_message}`
        : "Scanlark could not finish this scan.",
      actionUrl: buildDashboardActionUrl(run.site_id),
    });
    return;
  }

  if (
    run.status !== "completed" ||
    run.issue_generation_status !== "completed"
  ) {
    return;
  }

  const countsRes = await client.query<{
    severity: string;
    change_status: string | null;
    count: string;
  }>(
    `
      SELECT severity, change_status, COUNT(*)::text AS count
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      GROUP BY severity, change_status
    `,
    [run.id],
  );

  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  let openIssues = 0;
  let newHighPriorityIssues = 0;

  for (const row of countsRes.rows) {
    const count = Number(row.count);
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + count;
    openIssues += count;
    if (
      row.change_status === "new" &&
      (row.severity === "critical" || row.severity === "high")
    ) {
      newHighPriorityIssues += count;
    }
  }

  const healthScore = computeSeverityScore(bySeverity);
  await createAppNotification({
    userId,
    siteId: run.site_id,
    scanRunId: run.id,
    kind: "scan_completed",
    severity: openIssues > 0 ? "info" : "success",
    title: `Scan completed for ${siteLabel}`,
    message: `Health score ${healthScore}% • ${openIssues} open issue${
      openIssues === 1 ? "" : "s"
    } • ${run.checked_links}/${run.total_links} links checked`,
    actionUrl: reportUrl,
  });

  if (newHighPriorityIssues > 0) {
    await createAppNotification({
      userId,
      siteId: run.site_id,
      scanRunId: run.id,
      kind: "high_priority_issues",
      severity: "critical",
      title: `New high-priority issues on ${siteLabel}`,
      message: `${newHighPriorityIssues} new critical/high issue${
        newHighPriorityIssues === 1 ? "" : "s"
      } need attention.`,
      actionUrl: reportUrl,
    });
  }
}
