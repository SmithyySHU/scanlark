import { ensureConnected } from "./client";
import { createAppNotification } from "./appNotifications";

export type UptimeStatus = "unknown" | "up" | "degraded" | "down";
export type UptimeCheckStatus = Exclude<UptimeStatus, "unknown">;
export type UptimeIncidentStatus = "open" | "resolved";

export type UptimeSettingsRow = {
  id: string;
  site_id: string;
  user_id: string;
  enabled: boolean;
  check_url: string;
  interval_minutes: number;
  failure_threshold: number;
  next_check_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UptimeCheckRow = {
  id: string;
  settings_id: string;
  site_id: string;
  checked_url: string;
  status: UptimeCheckStatus;
  status_code: number | null;
  response_time_ms: number | null;
  redirect_count: number;
  error_code: string | null;
  error_message: string | null;
  checked_at: Date;
};

export type UptimeIncidentRow = {
  id: string;
  settings_id: string;
  site_id: string;
  started_at: Date;
  resolved_at: Date | null;
  status: UptimeIncidentStatus;
  failure_count: number;
  first_error: string | null;
  last_error: string | null;
  last_status_code: number | null;
  last_response_time_ms: number | null;
  last_checked_at: Date | null;
  notification_sent_at: Date | null;
  recovery_notification_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type UptimeStatusSummary = {
  settingsId: string;
  siteId: string;
  enabled: boolean;
  checkUrl: string;
  intervalMinutes: number;
  failureThreshold: number;
  status: UptimeStatus;
  consecutiveFailures: number;
  lastCheckedAt: Date | null;
  lastUpAt: Date | null;
  lastDownAt: Date | null;
  lastRecoveredAt: Date | null;
  lastResponseTimeMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  uptime30d: number | null;
  activeIncidentId: string | null;
  recentChecks: UptimeCheckRow[];
};

export type ClaimedUptimeMonitor = UptimeSettingsRow;

export type UptimeCheckInput = {
  checkedUrl: string;
  status: UptimeCheckStatus;
  statusCode: number | null;
  responseTimeMs: number | null;
  redirectCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  checkedAt?: Date;
};

export type RecordedUptimeCheck = {
  settings: UptimeSettingsRow;
  check: UptimeCheckRow;
  incident: UptimeIncidentRow | null;
  shouldSendDownAlert: boolean;
  shouldSendRecoveryAlert: boolean;
  transitionAt: Date | null;
};

export type UptimeIncidentNotificationContext = {
  incident: UptimeIncidentRow;
  settings: UptimeSettingsRow;
  site_url: string;
};

function toSiteRootUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.username = "";
  url.password = "";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString();
}

function toSettingsRow(row: UptimeSettingsRow): UptimeSettingsRow {
  return { ...row };
}

async function ensureSettingsForSite(
  siteId: string,
  userId?: string,
): Promise<UptimeSettingsRow> {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO site_uptime_settings (site_id, check_url, next_check_at)
      SELECT
        id,
        regexp_replace(url, '^(https?://[^/?#]+).*$', '\\1/'),
        NOW()
      FROM sites
      WHERE id = $1
        AND ($2::uuid IS NULL OR user_id = $2)
      ON CONFLICT (site_id) DO NOTHING
    `,
    [siteId, userId ?? null],
  );

  const res = await client.query<UptimeSettingsRow>(
    `
      SELECT
        s.id,
        s.site_id,
        site.user_id,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.created_at,
        s.updated_at
      FROM site_uptime_settings s
      JOIN sites site ON site.id = s.site_id
      WHERE s.site_id = $1
        AND ($2::uuid IS NULL OR site.user_id = $2)
    `,
    [siteId, userId ?? null],
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error("site_not_found");
  }
  return row;
}

async function getLatestOpenIncidentForUpdate(
  settingsId: string,
): Promise<UptimeIncidentRow | null> {
  const client = await ensureConnected();
  const res = await client.query<UptimeIncidentRow>(
    `
      SELECT *
      FROM uptime_incidents
      WHERE settings_id = $1
        AND status = 'open'
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [settingsId],
  );
  return res.rows[0] ?? null;
}

function toIncidentError(input: UptimeCheckInput): string | null {
  if (input.errorMessage) return input.errorMessage;
  if (input.statusCode != null) return `HTTP ${input.statusCode}`;
  return input.errorCode;
}

function getSiteHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

async function createUptimeTransitionNotification(
  kind: "uptime_down" | "uptime_recovered",
  settings: UptimeSettingsRow,
  incident: UptimeIncidentRow,
): Promise<void> {
  if (!settings.user_id) return;

  const client = await ensureConnected();
  const siteRes = await client.query<{
    url: string;
    site_display_name: string | null;
    report_display_name: string | null;
  }>(
    `
      SELECT url, site_display_name, report_display_name
      FROM sites
      WHERE id = $1
    `,
    [settings.site_id],
  );
  const site = siteRes.rows[0];
  const siteLabel =
    site?.report_display_name ||
    site?.site_display_name ||
    getSiteHost(site?.url ?? settings.check_url);
  const actionUrl =
    kind === "uptime_down"
      ? `/dashboard/settings?siteId=${encodeURIComponent(
          settings.site_id,
        )}&incidentId=${encodeURIComponent(incident.id)}`
      : `/dashboard?siteId=${encodeURIComponent(
          settings.site_id,
        )}&incidentId=${encodeURIComponent(incident.id)}`;

  await createAppNotification({
    userId: settings.user_id,
    siteId: settings.site_id,
    scanRunId: null,
    kind,
    severity: kind === "uptime_down" ? "critical" : "success",
    title:
      kind === "uptime_down"
        ? `Availability down for ${siteLabel}`
        : `Availability recovered for ${siteLabel}`,
    message:
      kind === "uptime_down"
        ? `${settings.check_url} failed ${incident.failure_count} availability checks.`
        : `${settings.check_url} is reachable again.`,
    actionUrl,
  });
}

export async function getOrCreateUptimeMonitorForSite(
  siteId: string,
): Promise<UptimeSettingsRow> {
  return toSettingsRow(await ensureSettingsForSite(siteId));
}

export async function getOrCreateUptimeMonitorForSiteForUser(
  userId: string,
  siteId: string,
): Promise<UptimeSettingsRow> {
  return toSettingsRow(await ensureSettingsForSite(siteId, userId));
}

export async function getUptimeMonitorSettingsForUser(
  userId: string,
  siteId: string,
): Promise<{
  enabled: boolean;
  checkUrl: string;
  intervalMinutes: number;
  failureThreshold: number;
}> {
  const row = await ensureSettingsForSite(siteId, userId);
  return {
    enabled: row.enabled,
    checkUrl: row.check_url,
    intervalMinutes: row.interval_minutes,
    failureThreshold: row.failure_threshold,
  };
}

export async function updateUptimeMonitorSettingsForUser(
  userId: string,
  siteId: string,
  fields: {
    enabled?: boolean;
    checkUrl?: string;
    failureThreshold?: number;
  },
): Promise<{
  enabled: boolean;
  checkUrl: string;
  intervalMinutes: number;
  failureThreshold: number;
}> {
  const client = await ensureConnected();
  const current = await ensureSettingsForSite(siteId, userId);
  const nextEnabled = fields.enabled ?? current.enabled;
  const nextCheckUrl = fields.checkUrl
    ? toSiteRootUrl(fields.checkUrl)
    : current.check_url;
  const nextFailureThreshold =
    fields.failureThreshold ?? current.failure_threshold;
  const nextCheckAt = nextEnabled
    ? (current.next_check_at ?? new Date())
    : null;

  const res = await client.query<UptimeSettingsRow>(
    `
      UPDATE site_uptime_settings s
      SET enabled = $3,
          check_url = $4,
          failure_threshold = $5,
          next_check_at = $6,
          updated_at = NOW()
      FROM sites site
      WHERE s.site_id = $1
        AND site.id = s.site_id
        AND site.user_id = $2
        AND (site.is_sample_site = false OR $3 = false)
      RETURNING
        s.id,
        s.site_id,
        site.user_id,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.created_at,
        s.updated_at
    `,
    [
      siteId,
      userId,
      nextEnabled,
      nextCheckUrl,
      nextFailureThreshold,
      nextCheckAt,
    ],
  );
  const row = res.rows[0];
  if (!row) throw new Error("site_not_found");
  return {
    enabled: row.enabled,
    checkUrl: row.check_url,
    intervalMinutes: row.interval_minutes,
    failureThreshold: row.failure_threshold,
  };
}

export async function claimDueUptimeMonitors(
  limit: number,
): Promise<ClaimedUptimeMonitor[]> {
  const client = await ensureConnected();
  const res = await client.query<UptimeSettingsRow>(
    `
      WITH due AS (
        SELECT s.id
        FROM site_uptime_settings s
        JOIN sites site ON site.id = s.site_id
        WHERE s.enabled = true
          AND site.disabled_at IS NULL
          AND site.is_sample_site = false
          AND (s.next_check_at IS NULL OR s.next_check_at <= NOW())
        ORDER BY s.next_check_at ASC NULLS FIRST
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE site_uptime_settings s
      SET next_check_at = NOW() + make_interval(mins => s.interval_minutes),
          updated_at = NOW()
      FROM due, sites site
      WHERE s.id = due.id
        AND site.id = s.site_id
      RETURNING
        s.id,
        s.site_id,
        site.user_id,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.created_at,
        s.updated_at
    `,
    [limit],
  );
  return res.rows.map(toSettingsRow);
}

export async function recordUptimeCheck(
  settingsId: string,
  input: UptimeCheckInput,
): Promise<RecordedUptimeCheck> {
  const client = await ensureConnected();
  const checkedAt = input.checkedAt ?? new Date();

  await client.query("BEGIN");
  try {
    const settingsRes = await client.query<UptimeSettingsRow>(
      `
        SELECT
          s.id,
          s.site_id,
          site.user_id,
          s.enabled,
          s.check_url,
          s.interval_minutes,
          s.failure_threshold,
          s.next_check_at,
          s.created_at,
          s.updated_at
        FROM site_uptime_settings s
        JOIN sites site ON site.id = s.site_id
        WHERE s.id = $1
        FOR UPDATE
      `,
      [settingsId],
    );
    const settings = settingsRes.rows[0];
    if (!settings) {
      throw new Error("uptime_settings_not_found");
    }

    const checkRes = await client.query<UptimeCheckRow>(
      `
        INSERT INTO uptime_checks (
          settings_id,
          site_id,
          checked_url,
          status,
          status_code,
          response_time_ms,
          redirect_count,
          error_code,
          error_message,
          checked_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
      [
        settings.id,
        settings.site_id,
        input.checkedUrl,
        input.status,
        input.statusCode,
        input.responseTimeMs,
        input.redirectCount,
        input.errorCode,
        input.errorMessage,
        checkedAt,
      ],
    );
    const check = checkRes.rows[0];
    const activeIncident = await getLatestOpenIncidentForUpdate(settings.id);
    const incidentError = toIncidentError(input);
    let incident: UptimeIncidentRow | null = activeIncident;
    let shouldSendDownAlert = false;
    let shouldSendRecoveryAlert = false;
    let transitionAt: Date | null = null;

    if (input.status === "down") {
      if (!activeIncident) {
        const shouldAlertOnCreate = settings.failure_threshold <= 1;
        const createdRes = await client.query<UptimeIncidentRow>(
          `
            INSERT INTO uptime_incidents (
              settings_id,
              site_id,
              started_at,
              status,
              failure_count,
              first_error,
              last_error,
              last_status_code,
              last_response_time_ms,
              last_checked_at,
              notification_sent_at
            )
            VALUES ($1, $2, $3, 'open', 1, $4, $5, $6, $7, $3, $8)
            RETURNING *
          `,
          [
            settings.id,
            settings.site_id,
            checkedAt,
            incidentError,
            incidentError,
            input.statusCode,
            input.responseTimeMs,
            shouldAlertOnCreate ? checkedAt : null,
          ],
        );
        incident = createdRes.rows[0];
      } else {
        const failureCount = activeIncident.failure_count + 1;
        const sendAlert =
          activeIncident.notification_sent_at == null &&
          failureCount >= settings.failure_threshold;
        const updatedRes = await client.query<UptimeIncidentRow>(
          `
            UPDATE uptime_incidents
            SET failure_count = $2,
                last_error = $3,
                last_status_code = $4,
                last_response_time_ms = $5,
                last_checked_at = $6,
                notification_sent_at = CASE
                  WHEN $7::boolean THEN $6
                  ELSE notification_sent_at
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `,
          [
            activeIncident.id,
            failureCount,
            incidentError,
            input.statusCode,
            input.responseTimeMs,
            checkedAt,
            sendAlert,
          ],
        );
        incident = updatedRes.rows[0];
      }

      if (
        incident &&
        incident.notification_sent_at != null &&
        (activeIncident == null ||
          activeIncident.notification_sent_at == null) &&
        incident.failure_count >= settings.failure_threshold
      ) {
        shouldSendDownAlert = true;
        transitionAt = incident.notification_sent_at;
      }
    } else if (activeIncident) {
      const sendRecovery = activeIncident.notification_sent_at != null;
      const resolvedRes = await client.query<UptimeIncidentRow>(
        `
          UPDATE uptime_incidents
          SET status = 'resolved',
              resolved_at = $2,
              last_status_code = $3,
              last_response_time_ms = $4,
              last_checked_at = $2,
              recovery_notification_sent_at = CASE
                WHEN $5::boolean THEN $2
                ELSE recovery_notification_sent_at
              END,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [
          activeIncident.id,
          checkedAt,
          input.statusCode,
          input.responseTimeMs,
          sendRecovery,
        ],
      );
      incident = resolvedRes.rows[0];
      if (sendRecovery) {
        shouldSendRecoveryAlert = true;
        transitionAt = checkedAt;
      }
    }

    await client.query("COMMIT");

    if (shouldSendDownAlert && incident) {
      await createUptimeTransitionNotification(
        "uptime_down",
        settings,
        incident,
      );
    }
    if (shouldSendRecoveryAlert && incident) {
      await createUptimeTransitionNotification(
        "uptime_recovered",
        settings,
        incident,
      );
    }

    return {
      settings: toSettingsRow(settings),
      check,
      incident,
      shouldSendDownAlert,
      shouldSendRecoveryAlert,
      transitionAt,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function getUptimeStatusForSiteForUser(
  userId: string,
  siteId: string,
  recentLimit = 10,
): Promise<UptimeStatusSummary> {
  const settings = await ensureSettingsForSite(siteId, userId);
  const client = await ensureConnected();
  const [
    recentChecksRes,
    uptimeRes,
    latestCheckRes,
    activeIncidentRes,
    lastUpRes,
    lastDownRes,
    lastRecoveredRes,
  ] = await Promise.all([
    client.query<UptimeCheckRow>(
      `
        SELECT *
        FROM uptime_checks
        WHERE settings_id = $1
        ORDER BY checked_at DESC
        LIMIT $2
      `,
      [settings.id, recentLimit],
    ),
    client.query<{ uptime_percentage: string | null }>(
      `
        SELECT
          CASE
            WHEN COUNT(*) = 0 THEN NULL
            ELSE ROUND(
              (
                COUNT(*) FILTER (WHERE status IN ('up', 'degraded'))::numeric
                / COUNT(*)::numeric
              ) * 100,
              2
            )::text
          END AS uptime_percentage
        FROM uptime_checks
        WHERE settings_id = $1
          AND checked_at >= NOW() - INTERVAL '30 days'
      `,
      [settings.id],
    ),
    client.query<UptimeCheckRow>(
      `
        SELECT *
        FROM uptime_checks
        WHERE settings_id = $1
        ORDER BY checked_at DESC
        LIMIT 1
      `,
      [settings.id],
    ),
    client.query<UptimeIncidentRow>(
      `
        SELECT *
        FROM uptime_incidents
        WHERE settings_id = $1
          AND status = 'open'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [settings.id],
    ),
    client.query<{ checked_at: Date }>(
      `
        SELECT checked_at
        FROM uptime_checks
        WHERE settings_id = $1
          AND status = 'up'
        ORDER BY checked_at DESC
        LIMIT 1
      `,
      [settings.id],
    ),
    client.query<{ checked_at: Date }>(
      `
        SELECT checked_at
        FROM uptime_checks
        WHERE settings_id = $1
          AND status = 'down'
        ORDER BY checked_at DESC
        LIMIT 1
      `,
      [settings.id],
    ),
    client.query<{ resolved_at: Date }>(
      `
        SELECT resolved_at
        FROM uptime_incidents
        WHERE settings_id = $1
          AND resolved_at IS NOT NULL
        ORDER BY resolved_at DESC
        LIMIT 1
      `,
      [settings.id],
    ),
  ]);

  const latestCheck = latestCheckRes.rows[0] ?? null;
  const activeIncident = activeIncidentRes.rows[0] ?? null;
  const uptime30dText = uptimeRes.rows[0]?.uptime_percentage ?? null;
  return {
    settingsId: settings.id,
    siteId: settings.site_id,
    enabled: settings.enabled,
    checkUrl: settings.check_url,
    intervalMinutes: settings.interval_minutes,
    failureThreshold: settings.failure_threshold,
    status: latestCheck?.status ?? "unknown",
    consecutiveFailures: activeIncident?.failure_count ?? 0,
    lastCheckedAt: latestCheck?.checked_at ?? null,
    lastUpAt: lastUpRes.rows[0]?.checked_at ?? null,
    lastDownAt: lastDownRes.rows[0]?.checked_at ?? null,
    lastRecoveredAt: lastRecoveredRes.rows[0]?.resolved_at ?? null,
    lastResponseTimeMs: latestCheck?.response_time_ms ?? null,
    lastStatusCode: latestCheck?.status_code ?? null,
    lastError:
      latestCheck?.status === "down"
        ? (latestCheck.error_message ?? null)
        : null,
    uptime30d: uptime30dText == null ? null : Number.parseFloat(uptime30dText),
    activeIncidentId: activeIncident?.id ?? null,
    recentChecks: recentChecksRes.rows,
  };
}

export async function getUptimeIncidentById(
  incidentId: string,
): Promise<UptimeIncidentNotificationContext | null> {
  const client = await ensureConnected();
  const res = await client.query<
    UptimeIncidentRow &
      Omit<UptimeSettingsRow, "id" | "created_at" | "updated_at"> & {
        settings_id: string;
        settings_created_at: Date;
        settings_updated_at: Date;
        site_url: string;
      }
  >(
    `
      SELECT
        i.id,
        i.settings_id,
        i.site_id,
        i.started_at,
        i.resolved_at,
        i.status,
        i.failure_count,
        i.first_error,
        i.last_error,
        i.last_status_code,
        i.last_response_time_ms,
        i.last_checked_at,
        i.notification_sent_at,
        i.recovery_notification_sent_at,
        i.created_at,
        i.updated_at,
        s.enabled,
        s.check_url,
        s.interval_minutes,
        s.failure_threshold,
        s.next_check_at,
        s.created_at AS settings_created_at,
        s.updated_at AS settings_updated_at,
        site.user_id,
        site.url AS site_url
      FROM uptime_incidents i
      JOIN site_uptime_settings s ON s.id = i.settings_id
      JOIN sites site ON site.id = i.site_id
      WHERE i.id = $1
    `,
    [incidentId],
  );
  const row = res.rows[0];
  if (!row) return null;

  return {
    incident: {
      id: row.id,
      settings_id: row.settings_id,
      site_id: row.site_id,
      started_at: row.started_at,
      resolved_at: row.resolved_at,
      status: row.status,
      failure_count: row.failure_count,
      first_error: row.first_error,
      last_error: row.last_error,
      last_status_code: row.last_status_code,
      last_response_time_ms: row.last_response_time_ms,
      last_checked_at: row.last_checked_at,
      notification_sent_at: row.notification_sent_at,
      recovery_notification_sent_at: row.recovery_notification_sent_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    settings: {
      id: row.settings_id,
      site_id: row.site_id,
      user_id: row.user_id,
      enabled: row.enabled,
      check_url: row.check_url,
      interval_minutes: row.interval_minutes,
      failure_threshold: row.failure_threshold,
      next_check_at: row.next_check_at,
      created_at: row.settings_created_at,
      updated_at: row.settings_updated_at,
    },
    site_url: row.site_url,
  };
}
