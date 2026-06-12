import { ensureConnected } from "./client";
import { computeNextScheduledAt } from "./siteSchedule";

export type AdminActor = {
  id: string;
  email: string;
};

export type AdminAuditAction = {
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
};

export type AdminAuditLogRow = {
  id: string;
  admin_user_id: string | null;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown>;
  created_at: Date;
};

export type AdminUserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
  disabled_at: Date | null;
  site_count: number;
  scan_count: number;
};

export type AdminSiteRow = {
  id: string;
  user_id: string;
  owner_email: string;
  owner_display_name: string | null;
  url: string;
  created_at: Date;
  disabled_at: Date | null;
  permission_confirmed_at: Date | null;
  permission_confirmed_by_user_id: string | null;
  permission_confirmation_text_version: string | null;
  verification_status: string;
  schedule_enabled: boolean;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  uptime_enabled: boolean | null;
  last_scan_id: string | null;
  last_scan_status: string | null;
  last_scan_started_at: Date | null;
  last_scan_finished_at: Date | null;
};

export type AdminScanRow = {
  id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  user_id: string;
  owner_email: string;
  status: string;
  started_at: Date;
  finished_at: Date | null;
  updated_at: Date;
  start_url: string;
  total_links: number;
  checked_links: number;
  broken_links: number;
  trigger_type: string;
  error_message: string | null;
  job_id: string | null;
  job_status: string | null;
  job_attempts: number | null;
  job_max_attempts: number | null;
  job_last_error: string | null;
  job_created_at: Date | null;
  job_updated_at: Date | null;
};

export type AdminUptimeRow = {
  settings_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  user_id: string;
  owner_email: string;
  enabled: boolean;
  check_url: string;
  interval_minutes: number;
  failure_threshold: number;
  next_check_at: Date | null;
  updated_at: Date;
  last_check_status: string | null;
  last_checked_at: Date | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  active_incident_id: string | null;
  active_incident_started_at: Date | null;
  active_incident_failure_count: number | null;
};

export type AdminEmailOutboxRow = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  site_id: string | null;
  site_url: string | null;
  scan_run_id: string | null;
  email_type: string;
  to_email: string;
  subject: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
  failed_at: Date | null;
  suppressed_at: Date | null;
  last_error: string | null;
};

export type AdminEmailRetryEntry = AdminEmailOutboxRow & {
  html_body: string;
  text_body: string | null;
  metadata: Record<string, unknown> | null;
};

export type AdminShareLinkRow = {
  id: string;
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  created_by_user_id: string;
  created_by_email: string;
  enabled: boolean;
  created_at: Date;
  disabled_at: Date | null;
  last_viewed_at: Date | null;
  view_count: number;
  share_reference: string;
};

type CountRow = {
  count: string;
};

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function withPagination(params: unknown[], limit: number, offset: number) {
  params.push(limit, offset);
  return {
    limitPlaceholder: `$${params.length - 1}`,
    offsetPlaceholder: `$${params.length}`,
  };
}

export async function recordAdminAuditLog(
  actor: AdminActor,
  input: AdminAuditAction,
): Promise<AdminAuditLogRow> {
  const client = await ensureConnected();
  const res = await client.query<AdminAuditLogRow>(
    `
      INSERT INTO admin_audit_log (
        admin_user_id,
        admin_email,
        action,
        target_type,
        target_id,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      actor.id,
      actor.email,
      input.action,
      input.targetType,
      input.targetId,
      input.metadata ?? {},
    ],
  );
  return res.rows[0];
}

export async function getAdminOverview() {
  const client = await ensureConnected();
  const [
    totalUsers,
    totalSites,
    recentScans,
    failedScans,
    activeScans,
    emailFailures,
    uptimeDown,
    recentActions,
  ] = await Promise.all([
    client.query<CountRow>(`SELECT COUNT(*)::text AS count FROM users`),
    client.query<CountRow>(`SELECT COUNT(*)::text AS count FROM sites`),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM scan_runs
        WHERE started_at >= NOW() - INTERVAL '7 days'
      `,
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM scan_runs WHERE status = 'failed'`,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM scan_runs
        WHERE status IN ('queued', 'in_progress')
      `,
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM email_outbox WHERE status = 'failed'`,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(DISTINCT settings_id)::text AS count
        FROM uptime_incidents
        WHERE status = 'open'
      `,
    ),
    client.query<AdminAuditLogRow>(
      `
        SELECT *
        FROM admin_audit_log
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ),
  ]);

  return {
    totals: {
      users: countValue(totalUsers.rows[0]),
      sites: countValue(totalSites.rows[0]),
      recentScans: countValue(recentScans.rows[0]),
      failedScans: countValue(failedScans.rows[0]),
      activeScans: countValue(activeScans.rows[0]),
      emailFailures: countValue(emailFailures.rows[0]),
      uptimeDown: countValue(uptimeDown.rows[0]),
    },
    recentAdminActions: recentActions.rows,
  };
}

export async function listAdminUsers(params: {
  search?: string | null;
  limit: number;
  offset: number;
}): Promise<AdminUserRow[]> {
  const client = await ensureConnected();
  const queryParams: unknown[] = [];
  const filters: string[] = [];
  if (params.search?.trim()) {
    queryParams.push(`%${params.search.trim()}%`);
    filters.push(`u.email ILIKE $${queryParams.length}`);
  }
  const { limitPlaceholder, offsetPlaceholder } = withPagination(
    queryParams,
    params.limit,
    params.offset,
  );
  const res = await client.query<AdminUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.created_at,
        u.updated_at,
        u.disabled_at,
        COALESCE(site_counts.count, 0)::int AS site_count,
        COALESCE(scan_counts.count, 0)::int AS scan_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM sites s
        WHERE s.user_id = u.id
      ) AS site_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE s.user_id = u.id
      ) AS scan_counts ON TRUE
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY u.created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    queryParams,
  );
  return res.rows;
}

export async function getAdminUserDetail(userId: string) {
  const client = await ensureConnected();
  const userRes = await client.query<AdminUserRow>(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        u.created_at,
        u.updated_at,
        u.disabled_at,
        COALESCE(site_counts.count, 0)::int AS site_count,
        COALESCE(scan_counts.count, 0)::int AS scan_count
      FROM users u
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM sites s
        WHERE s.user_id = u.id
      ) AS site_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE s.user_id = u.id
      ) AS scan_counts ON TRUE
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId],
  );
  const user = userRes.rows[0] ?? null;
  if (!user) return null;

  const [sites, scans] = await Promise.all([
    client.query<AdminSiteRow>(
      `
        SELECT
          s.id,
          s.user_id,
          u.email AS owner_email,
          u.display_name AS owner_display_name,
          s.url,
          s.created_at,
          s.disabled_at,
          s.permission_confirmed_at,
          s.permission_confirmed_by_user_id,
          s.permission_confirmation_text_version,
          s.verification_status,
          s.schedule_enabled,
          s.site_display_name,
          s.client_name,
          s.report_display_name,
          us.enabled AS uptime_enabled,
          latest.id AS last_scan_id,
          latest.status AS last_scan_status,
          latest.started_at AS last_scan_started_at,
          latest.finished_at AS last_scan_finished_at
        FROM sites s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN site_uptime_settings us ON us.site_id = s.id
        LEFT JOIN LATERAL (
          SELECT id, status, started_at, finished_at
          FROM scan_runs r
          WHERE r.site_id = s.id
          ORDER BY r.started_at DESC
          LIMIT 1
        ) AS latest ON TRUE
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 10
      `,
      [userId],
    ),
    client.query<AdminScanRow>(
      `
        SELECT
          r.id,
          r.site_id,
          s.url AS site_url,
          s.site_display_name,
          u.id AS user_id,
          u.email AS owner_email,
          r.status,
          r.started_at,
          r.finished_at,
          r.updated_at,
          r.start_url,
          r.total_links,
          r.checked_links,
          r.broken_links,
          r.trigger_type,
          r.error_message,
          j.id AS job_id,
          j.status AS job_status,
          j.attempts AS job_attempts,
          j.max_attempts AS job_max_attempts,
          j.last_error AS job_last_error,
          j.created_at AS job_created_at,
          j.updated_at AS job_updated_at
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        JOIN users u ON u.id = s.user_id
        LEFT JOIN LATERAL (
          SELECT *
          FROM scan_jobs sj
          WHERE sj.scan_run_id = r.id
          ORDER BY sj.created_at DESC
          LIMIT 1
        ) AS j ON TRUE
        WHERE u.id = $1
        ORDER BY r.started_at DESC
        LIMIT 10
      `,
      [userId],
    ),
  ]);

  return {
    user,
    recentSites: sites.rows,
    recentScans: scans.rows,
  };
}

export async function setAdminUserDisabled(
  actor: AdminActor,
  userId: string,
  disabled: boolean,
): Promise<AdminUserRow | null> {
  const client = await ensureConnected();
  const res = await client.query<AdminUserRow>(
    `
      WITH updated AS (
        UPDATE users
        SET disabled_at = CASE WHEN $2::boolean THEN COALESCE(disabled_at, NOW()) ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, display_name, created_at, updated_at, disabled_at
      )
      SELECT
        updated.*,
        COALESCE(site_counts.count, 0)::int AS site_count,
        COALESCE(scan_counts.count, 0)::int AS scan_count
      FROM updated
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM sites s
        WHERE s.user_id = updated.id
      ) AS site_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE s.user_id = updated.id
      ) AS scan_counts ON TRUE
    `,
    [userId, disabled],
  );
  const user = res.rows[0] ?? null;
  if (!user) return null;
  await recordAdminAuditLog(actor, {
    action: disabled ? "user.disable" : "user.enable",
    targetType: "user",
    targetId: userId,
    metadata: { email: user.email },
  });
  return user;
}

export async function listAdminSites(params: {
  search?: string | null;
  limit: number;
  offset: number;
}): Promise<AdminSiteRow[]> {
  const client = await ensureConnected();
  const queryParams: unknown[] = [];
  const filters: string[] = [];
  if (params.search?.trim()) {
    queryParams.push(`%${params.search.trim()}%`);
    filters.push(`(
      s.url ILIKE $${queryParams.length}
      OR u.email ILIKE $${queryParams.length}
      OR s.site_display_name ILIKE $${queryParams.length}
      OR s.client_name ILIKE $${queryParams.length}
    )`);
  }
  const { limitPlaceholder, offsetPlaceholder } = withPagination(
    queryParams,
    params.limit,
    params.offset,
  );
  const res = await client.query<AdminSiteRow>(
    `
      SELECT
        s.id,
        s.user_id,
        u.email AS owner_email,
        u.display_name AS owner_display_name,
        s.url,
        s.created_at,
        s.disabled_at,
        s.permission_confirmed_at,
        s.permission_confirmed_by_user_id,
        s.permission_confirmation_text_version,
        s.verification_status,
        s.schedule_enabled,
        s.site_display_name,
        s.client_name,
        s.report_display_name,
        us.enabled AS uptime_enabled,
        latest.id AS last_scan_id,
        latest.status AS last_scan_status,
        latest.started_at AS last_scan_started_at,
        latest.finished_at AS last_scan_finished_at
      FROM sites s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN site_uptime_settings us ON us.site_id = s.id
      LEFT JOIN LATERAL (
        SELECT id, status, started_at, finished_at
        FROM scan_runs r
        WHERE r.site_id = s.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY s.created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    queryParams,
  );
  return res.rows;
}

export async function getAdminSiteDetail(siteId: string) {
  const client = await ensureConnected();
  const siteRes = await client.query<AdminSiteRow>(
    `
      SELECT
        s.id,
        s.user_id,
        u.email AS owner_email,
        u.display_name AS owner_display_name,
        s.url,
        s.created_at,
        s.disabled_at,
        s.permission_confirmed_at,
        s.permission_confirmed_by_user_id,
        s.permission_confirmation_text_version,
        s.verification_status,
        s.schedule_enabled,
        s.site_display_name,
        s.client_name,
        s.report_display_name,
        us.enabled AS uptime_enabled,
        latest.id AS last_scan_id,
        latest.status AS last_scan_status,
        latest.started_at AS last_scan_started_at,
        latest.finished_at AS last_scan_finished_at
      FROM sites s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN site_uptime_settings us ON us.site_id = s.id
      LEFT JOIN LATERAL (
        SELECT id, status, started_at, finished_at
        FROM scan_runs r
        WHERE r.site_id = s.id
        ORDER BY r.started_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      WHERE s.id = $1
      LIMIT 1
    `,
    [siteId],
  );
  const site = siteRes.rows[0] ?? null;
  if (!site) return null;

  const [scans, uptime] = await Promise.all([
    listAdminScans({ siteId, limit: 10, offset: 0 }),
    listAdminUptime({ siteId, limit: 5, offset: 0 }),
  ]);

  return { site, recentScans: scans, uptime };
}

export async function setAdminSiteDisabled(
  actor: AdminActor,
  siteId: string,
  disabled: boolean,
): Promise<AdminSiteRow | null> {
  const client = await ensureConnected();
  let site: AdminSiteRow | null = null;
  let pausedUptime = 0;

  await client.query("BEGIN");
  try {
    const res = await client.query<AdminSiteRow>(
      `
        WITH updated AS (
          UPDATE sites
          SET disabled_at = CASE WHEN $2::boolean THEN COALESCE(disabled_at, NOW()) ELSE NULL END,
              schedule_enabled = CASE WHEN $2::boolean THEN false ELSE schedule_enabled END,
              next_scheduled_at = CASE WHEN $2::boolean THEN NULL ELSE next_scheduled_at END
          WHERE id = $1
          RETURNING *
        )
        SELECT
          s.id,
          s.user_id,
          u.email AS owner_email,
          u.display_name AS owner_display_name,
          s.url,
          s.created_at,
          s.disabled_at,
          s.permission_confirmed_at,
          s.permission_confirmed_by_user_id,
          s.permission_confirmation_text_version,
          s.verification_status,
          s.schedule_enabled,
          s.site_display_name,
          s.client_name,
          s.report_display_name,
          us.enabled AS uptime_enabled,
          latest.id AS last_scan_id,
          latest.status AS last_scan_status,
          latest.started_at AS last_scan_started_at,
          latest.finished_at AS last_scan_finished_at
        FROM updated s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN site_uptime_settings us ON us.site_id = s.id
        LEFT JOIN LATERAL (
          SELECT id, status, started_at, finished_at
          FROM scan_runs r
          WHERE r.site_id = s.id
          ORDER BY r.started_at DESC
          LIMIT 1
        ) AS latest ON TRUE
      `,
      [siteId, disabled],
    );
    site = res.rows[0] ?? null;
    if (!site) {
      await client.query("ROLLBACK");
      return null;
    }

    if (disabled) {
      const uptimeRes = await client.query(
        `
          UPDATE site_uptime_settings
          SET enabled = false,
              next_check_at = NULL,
              updated_at = NOW()
          WHERE site_id = $1
            AND enabled = true
        `,
        [siteId],
      );
      pausedUptime = uptimeRes.rowCount ?? 0;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  await recordAdminAuditLog(actor, {
    action: disabled ? "site.disable" : "site.enable",
    targetType: "site",
    targetId: siteId,
    metadata: {
      url: site.url,
      pausedUptime,
      schedulePaused: disabled,
    },
  });
  return site;
}

export async function setAdminSiteSchedulePaused(
  actor: AdminActor,
  siteId: string,
  paused: boolean,
) {
  const client = await ensureConnected();
  const currentRes = await client.query<{
    id: string;
    url: string;
    disabled_at: Date | null;
    schedule_frequency: "manual" | "daily" | "weekly" | "monthly";
    schedule_time_utc: string;
    schedule_day_of_week: number | null;
    schedule_day_of_month: number | null;
  }>(
    `
      SELECT id,
             url,
             disabled_at,
             schedule_frequency,
             schedule_time_utc,
             schedule_day_of_week,
             schedule_day_of_month
      FROM sites
      WHERE id = $1
      LIMIT 1
    `,
    [siteId],
  );
  const current = currentRes.rows[0] ?? null;
  if (!current) return null;
  if (!paused && current.disabled_at) {
    throw new Error("site_disabled");
  }
  if (!paused && current.schedule_frequency === "manual") {
    throw new Error("manual_schedule_not_resumable");
  }
  const nextScheduledAt = paused
    ? null
    : computeNextScheduledAt({
        frequency: current.schedule_frequency,
        timeUtc: current.schedule_time_utc,
        dayOfWeek: current.schedule_day_of_week,
        dayOfMonth: current.schedule_day_of_month,
      });
  const res = await client.query<{ id: string; schedule_enabled: boolean }>(
    `
      UPDATE sites
      SET schedule_enabled = $2,
          next_scheduled_at = $3
      WHERE id = $1
      RETURNING id, schedule_enabled
    `,
    [siteId, !paused, nextScheduledAt],
  );
  const row = res.rows[0] ?? null;
  if (!row) return null;
  await recordAdminAuditLog(actor, {
    action: paused ? "site.schedule.pause" : "site.schedule.resume",
    targetType: "site",
    targetId: siteId,
    metadata: { url: current.url, nextScheduledAt },
  });
  return row;
}

export async function listAdminScans(params: {
  status?: string | null;
  siteId?: string | null;
  limit: number;
  offset: number;
}): Promise<AdminScanRow[]> {
  const client = await ensureConnected();
  const queryParams: unknown[] = [];
  const filters: string[] = [];
  if (params.status) {
    queryParams.push(params.status);
    filters.push(
      `(r.status = $${queryParams.length} OR j.status = $${queryParams.length})`,
    );
  }
  if (params.siteId) {
    queryParams.push(params.siteId);
    filters.push(`r.site_id = $${queryParams.length}`);
  }
  const { limitPlaceholder, offsetPlaceholder } = withPagination(
    queryParams,
    params.limit,
    params.offset,
  );
  const res = await client.query<AdminScanRow>(
    `
      SELECT
        r.id,
        r.site_id,
        s.url AS site_url,
        s.site_display_name,
        u.id AS user_id,
        u.email AS owner_email,
        r.status,
        r.started_at,
        r.finished_at,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.error_message,
        j.id AS job_id,
        j.status AS job_status,
        j.attempts AS job_attempts,
        j.max_attempts AS job_max_attempts,
        j.last_error AS job_last_error,
        j.created_at AS job_created_at,
        j.updated_at AS job_updated_at
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      JOIN users u ON u.id = s.user_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM scan_jobs sj
        WHERE sj.scan_run_id = r.id
        ORDER BY sj.created_at DESC
        LIMIT 1
      ) AS j ON TRUE
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY r.started_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    queryParams,
  );
  return res.rows;
}

export async function listAdminUptime(params: {
  siteId?: string | null;
  limit: number;
  offset: number;
}): Promise<AdminUptimeRow[]> {
  const client = await ensureConnected();
  const queryParams: unknown[] = [];
  const filters: string[] = [];
  if (params.siteId) {
    queryParams.push(params.siteId);
    filters.push(`s.site_id = $${queryParams.length}`);
  }
  const { limitPlaceholder, offsetPlaceholder } = withPagination(
    queryParams,
    params.limit,
    params.offset,
  );
  const res = await client.query<AdminUptimeRow>(
    `
      SELECT
        s.id AS settings_id,
        s.site_id,
        site.url AS site_url,
        site.site_display_name,
        u.id AS user_id,
        u.email AS owner_email,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.updated_at,
        latest.status AS last_check_status,
        latest.checked_at AS last_checked_at,
        latest.status_code AS last_status_code,
        latest.response_time_ms AS last_response_time_ms,
        incident.id AS active_incident_id,
        incident.started_at AS active_incident_started_at,
        incident.failure_count AS active_incident_failure_count
      FROM site_uptime_settings s
      JOIN sites site ON site.id = s.site_id
      JOIN users u ON u.id = site.user_id
      LEFT JOIN LATERAL (
        SELECT status, checked_at, status_code, response_time_ms
        FROM uptime_checks c
        WHERE c.settings_id = s.id
        ORDER BY c.checked_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, started_at, failure_count
        FROM uptime_incidents i
        WHERE i.settings_id = s.id
          AND i.status = 'open'
        ORDER BY i.started_at DESC
        LIMIT 1
      ) AS incident ON TRUE
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY COALESCE(latest.checked_at, s.updated_at) DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    queryParams,
  );
  return res.rows;
}

export async function setAdminUptimePaused(
  actor: AdminActor,
  settingsId: string,
  paused: boolean,
): Promise<AdminUptimeRow | null> {
  const client = await ensureConnected();
  const res = await client.query<AdminUptimeRow>(
    `
      WITH updated AS (
        UPDATE site_uptime_settings s
        SET enabled = $2,
            next_check_at = CASE WHEN $2::boolean THEN COALESCE(s.next_check_at, NOW()) ELSE NULL END,
            updated_at = NOW()
        FROM sites site
        WHERE s.id = $1
          AND site.id = s.site_id
          AND ($2::boolean = false OR site.disabled_at IS NULL)
        RETURNING s.*
      )
      SELECT
        s.id AS settings_id,
        s.site_id,
        site.url AS site_url,
        site.site_display_name,
        u.id AS user_id,
        u.email AS owner_email,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.updated_at,
        latest.status AS last_check_status,
        latest.checked_at AS last_checked_at,
        latest.status_code AS last_status_code,
        latest.response_time_ms AS last_response_time_ms,
        incident.id AS active_incident_id,
        incident.started_at AS active_incident_started_at,
        incident.failure_count AS active_incident_failure_count
      FROM updated s
      JOIN sites site ON site.id = s.site_id
      JOIN users u ON u.id = site.user_id
      LEFT JOIN LATERAL (
        SELECT status, checked_at, status_code, response_time_ms
        FROM uptime_checks c
        WHERE c.settings_id = s.id
        ORDER BY c.checked_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT id, started_at, failure_count
        FROM uptime_incidents i
        WHERE i.settings_id = s.id
          AND i.status = 'open'
        ORDER BY i.started_at DESC
        LIMIT 1
      ) AS incident ON TRUE
    `,
    [settingsId, !paused],
  );
  const row = res.rows[0] ?? null;
  if (!row) return null;
  await recordAdminAuditLog(actor, {
    action: paused ? "uptime.pause" : "uptime.resume",
    targetType: "uptime_monitor",
    targetId: settingsId,
    metadata: { siteId: row.site_id, checkUrl: row.check_url },
  });
  return row;
}

export async function listAdminEmailOutbox(params: {
  status?: string | null;
  limit: number;
  offset: number;
}): Promise<AdminEmailOutboxRow[]> {
  const client = await ensureConnected();
  const queryParams: unknown[] = [];
  const filters: string[] = [];
  if (params.status) {
    queryParams.push(params.status);
    filters.push(`e.status = $${queryParams.length}`);
  }
  const { limitPlaceholder, offsetPlaceholder } = withPagination(
    queryParams,
    params.limit,
    params.offset,
  );
  const res = await client.query<AdminEmailOutboxRow>(
    `
      SELECT
        e.id,
        e.user_id,
        u.email AS user_email,
        e.site_id,
        s.url AS site_url,
        e.scan_run_id,
        CASE
          WHEN e.metadata ? 'test' THEN 'test'
          WHEN e.scan_run_id IS NOT NULL THEN 'scan_notification'
          ELSE 'system'
        END AS email_type,
        e.to_email,
        e.subject,
        e.status,
        e.created_at,
        e.updated_at,
        e.sent_at,
        e.failed_at,
        e.suppressed_at,
        e.last_error
      FROM email_outbox e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN sites s ON s.id = e.site_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY e.created_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
    queryParams,
  );
  return res.rows;
}

export async function getAdminFailedEmailForRetry(
  entryId: string,
): Promise<AdminEmailRetryEntry | null> {
  const client = await ensureConnected();
  const res = await client.query<AdminEmailRetryEntry>(
    `
      SELECT
        e.id,
        e.user_id,
        u.email AS user_email,
        e.site_id,
        s.url AS site_url,
        e.scan_run_id,
        CASE
          WHEN e.metadata ? 'test' THEN 'test'
          WHEN e.scan_run_id IS NOT NULL THEN 'scan_notification'
          ELSE 'system'
        END AS email_type,
        e.to_email,
        e.subject,
        e.status,
        e.created_at,
        e.updated_at,
        e.sent_at,
        e.failed_at,
        e.suppressed_at,
        e.last_error,
        e.html_body,
        e.text_body,
        e.metadata
      FROM email_outbox e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN sites s ON s.id = e.site_id
      WHERE e.id = $1
        AND e.status = 'failed'
      LIMIT 1
    `,
    [entryId],
  );
  return res.rows[0] ?? null;
}

export async function listAdminShareLinks(params: {
  limit: number;
  offset: number;
}): Promise<AdminShareLinkRow[]> {
  const client = await ensureConnected();
  const res = await client.query<AdminShareLinkRow>(
    `
      SELECT
        rs.id,
        rs.scan_run_id,
        rs.site_id,
        s.url AS site_url,
        s.site_display_name,
        rs.created_by_user_id,
        u.email AS created_by_email,
        rs.enabled,
        rs.created_at,
        rs.disabled_at,
        rs.last_viewed_at,
        rs.view_count,
        'share_' || left(replace(rs.id::text, '-', ''), 10) AS share_reference
      FROM report_shares rs
      JOIN sites s ON s.id = rs.site_id
      JOIN users u ON u.id = rs.created_by_user_id
      ORDER BY rs.created_at DESC
      LIMIT $1
      OFFSET $2
    `,
    [params.limit, params.offset],
  );
  return res.rows;
}

export async function revokeAdminShareLink(
  actor: AdminActor,
  shareId: string,
): Promise<AdminShareLinkRow | null> {
  const client = await ensureConnected();
  const res = await client.query<AdminShareLinkRow>(
    `
      WITH updated AS (
        UPDATE report_shares
        SET enabled = false,
            disabled_at = COALESCE(disabled_at, NOW())
        WHERE id = $1
        RETURNING *
      )
      SELECT
        rs.id,
        rs.scan_run_id,
        rs.site_id,
        s.url AS site_url,
        s.site_display_name,
        rs.created_by_user_id,
        u.email AS created_by_email,
        rs.enabled,
        rs.created_at,
        rs.disabled_at,
        rs.last_viewed_at,
        rs.view_count,
        'share_' || left(replace(rs.id::text, '-', ''), 10) AS share_reference
      FROM updated rs
      JOIN sites s ON s.id = rs.site_id
      JOIN users u ON u.id = rs.created_by_user_id
    `,
    [shareId],
  );
  const share = res.rows[0] ?? null;
  if (!share) return null;
  await recordAdminAuditLog(actor, {
    action: "share_link.revoke",
    targetType: "report_share",
    targetId: shareId,
    metadata: { siteId: share.site_id, scanRunId: share.scan_run_id },
  });
  return share;
}

export async function listAdminAuditLog(params: {
  limit: number;
  offset: number;
}): Promise<AdminAuditLogRow[]> {
  const client = await ensureConnected();
  const res = await client.query<AdminAuditLogRow>(
    `
      SELECT *
      FROM admin_audit_log
      ORDER BY created_at DESC
      LIMIT $1
      OFFSET $2
    `,
    [params.limit, params.offset],
  );
  return res.rows;
}
