import { ensureConnected } from "./client";
import { emitScanEvent } from "./events";

export type ScheduleFrequency = "manual" | "daily" | "weekly" | "monthly";

export type SiteScheduleFields = {
  scheduleEnabled: boolean;
  scheduleFrequency: ScheduleFrequency;
  scheduleTimeUtc: string;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
  nextScheduledAt: Date | null;
  lastScheduledAt: Date | null;
};

type ScheduleRow = {
  id: string;
  user_id?: string;
  url?: string;
  disabled_at?: Date | null;
  is_sample_site?: boolean;
  schedule_enabled: boolean;
  schedule_frequency: ScheduleFrequency;
  schedule_time_utc: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_at: Date | null;
  last_scheduled_at: Date | null;
};

type ScanRunEventRow = {
  id: string;
  site_id: string;
  status: "queued";
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
  user_id: string;
};

type ActiveScheduledWork = {
  jobId: string | null;
  scanRunId: string | null;
  scanStatus: "queued" | "in_progress" | null;
  jobStatus: "queued" | "running" | null;
};

export type ScheduledEnqueueResult =
  | {
      created: true;
      scanRunId: string;
      jobId: string;
      nextScheduledAt: Date | null;
    }
  | {
      created: false;
      reason:
        | "site_not_found"
        | "site_disabled"
        | "sample_site"
        | "schedule_disabled"
        | "schedule_not_due"
        | "schedule_invalid"
        | "active_work_exists";
      active?: ActiveScheduledWork;
    };

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function toSiteScheduleFields(row: ScheduleRow): SiteScheduleFields {
  return {
    scheduleEnabled: row.schedule_enabled,
    scheduleFrequency: row.schedule_frequency,
    scheduleTimeUtc: row.schedule_time_utc,
    scheduleDayOfWeek: row.schedule_day_of_week,
    scheduleDayOfMonth: row.schedule_day_of_month,
    nextScheduledAt: row.next_scheduled_at,
    lastScheduledAt: row.last_scheduled_at,
  };
}

async function emitScheduleUpdated(
  userId: string,
  siteId: string,
  row: ScheduleRow,
) {
  await emitScanEvent({
    type: "schedule_updated",
    user_id: userId,
    site_id: siteId,
    schedule_enabled: row.schedule_enabled,
    schedule_frequency: row.schedule_frequency,
    schedule_time_utc: row.schedule_time_utc,
    schedule_day_of_week: row.schedule_day_of_week,
    schedule_day_of_month: row.schedule_day_of_month,
    next_scheduled_at: toIso(row.next_scheduled_at),
    last_scheduled_at: toIso(row.last_scheduled_at),
  });
}

async function emitScanStarted(row: ScanRunEventRow) {
  await emitScanEvent({
    type: "scan_started",
    user_id: row.user_id,
    site_id: row.site_id,
    scan_run_id: row.id,
    status: row.status,
    started_at: toIso(row.started_at),
    finished_at: toIso(row.finished_at),
    updated_at: toIso(row.updated_at),
    start_url: row.start_url,
    total_links: row.total_links,
    checked_links: row.checked_links,
    broken_links: row.broken_links,
    error_message: row.error_message,
  });
}

function parseTimeUtc(timeUtc: string) {
  const parts = timeUtc.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    parts.length < 2 ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error("timeUtc must be HH:MM (24h)");
  }
  return { hours, minutes };
}

function getDaysInMonthUtc(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function buildMonthlyScheduleCandidate(
  year: number,
  monthIndex: number,
  hours: number,
  minutes: number,
  dayOfMonth: number,
) {
  const clampedDay = Math.min(dayOfMonth, getDaysInMonthUtc(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, clampedDay, hours, minutes, 0, 0));
}

export function computeNextScheduledAt(
  params: {
    frequency: ScheduleFrequency;
    timeUtc: string;
    dayOfWeek?: number | null;
    dayOfMonth?: number | null;
  },
  now: Date = new Date(),
): Date {
  const { hours, minutes } = parseTimeUtc(params.timeUtc);

  if (params.frequency === "manual") {
    throw new Error("manual schedule cannot compute next scheduled time");
  }

  const base = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hours,
      minutes,
      0,
      0,
    ),
  );

  if (params.frequency === "daily") {
    if (base <= now) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    return base;
  }

  if (params.frequency === "weekly") {
    const targetDay =
      typeof params.dayOfWeek === "number" ? params.dayOfWeek : 1;
    const currentDay = now.getUTCDay();
    let daysAhead = (targetDay - currentDay + 7) % 7;
    if (daysAhead === 0 && base <= now) {
      daysAhead = 7;
    }
    base.setUTCDate(base.getUTCDate() + daysAhead);
    return base;
  }

  const targetDayOfMonth =
    typeof params.dayOfMonth === "number" ? params.dayOfMonth : 1;
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth();
  let candidate = buildMonthlyScheduleCandidate(
    year,
    month,
    hours,
    minutes,
    targetDayOfMonth,
  );
  if (candidate <= now) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = buildMonthlyScheduleCandidate(
      year,
      month,
      hours,
      minutes,
      targetDayOfMonth,
    );
  }
  return candidate;
}

function normalizeScheduleFields(fields: {
  scheduleEnabled: boolean;
  scheduleFrequency: ScheduleFrequency;
  scheduleTimeUtc: string;
  scheduleDayOfWeek: number | null;
  scheduleDayOfMonth: number | null;
}) {
  if (fields.scheduleEnabled && fields.scheduleFrequency === "manual") {
    throw new Error("manual schedule cannot be enabled");
  }

  const normalizeDayOfWeek = (value: number | null) => {
    if (value == null) return 1;
    if (!Number.isInteger(value) || value < 0 || value > 6) {
      throw new Error("scheduleDayOfWeek must be 0-6");
    }
    return value;
  };
  const normalizeDayOfMonth = (value: number | null) => {
    if (value == null) return 1;
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      throw new Error("scheduleDayOfMonth must be 1-31");
    }
    return value;
  };

  const scheduleDayOfWeek =
    fields.scheduleFrequency === "weekly"
      ? normalizeDayOfWeek(fields.scheduleDayOfWeek)
      : 1;
  const scheduleDayOfMonth =
    fields.scheduleFrequency === "monthly"
      ? normalizeDayOfMonth(fields.scheduleDayOfMonth)
      : null;
  const nextScheduledAt = fields.scheduleEnabled
    ? computeNextScheduledAt(
        {
          frequency: fields.scheduleFrequency,
          timeUtc: fields.scheduleTimeUtc,
          dayOfWeek: scheduleDayOfWeek,
          dayOfMonth: scheduleDayOfMonth,
        },
        new Date(),
      )
    : null;

  return {
    scheduleDayOfWeek,
    scheduleDayOfMonth,
    nextScheduledAt,
  };
}

async function getActiveScheduledWork(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  siteId: string,
): Promise<ActiveScheduledWork | null> {
  const activeJobRes = await client.query<{
    job_id: string;
    job_status: "queued" | "running";
    scan_run_id: string | null;
    scan_status: "queued" | "in_progress" | null;
  }>(
    `
      SELECT
        j.id AS job_id,
        j.status AS job_status,
        j.scan_run_id,
        r.status AS scan_status
      FROM scan_jobs j
      LEFT JOIN scan_runs r ON r.id = j.scan_run_id
      WHERE j.site_id = $1
        AND j.status IN ('queued', 'running')
        AND (
          j.status <> 'running'
          OR j.lock_expires_at IS NULL
          OR j.lock_expires_at > NOW()
        )
      ORDER BY
        CASE WHEN j.status = 'running' THEN 0 ELSE 1 END,
        j.created_at ASC
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    `,
    [siteId],
  );
  const activeJob = activeJobRes.rows[0];
  if (activeJob) {
    return {
      jobId: activeJob.job_id,
      scanRunId: activeJob.scan_run_id,
      scanStatus: activeJob.scan_status,
      jobStatus: activeJob.job_status,
    };
  }

  const activeRunRes = await client.query<{
    scan_run_id: string;
    scan_status: "queued" | "in_progress";
  }>(
    `
      SELECT id AS scan_run_id, status AS scan_status
      FROM scan_runs
      WHERE site_id = $1
        AND status IN ('queued', 'in_progress')
      ORDER BY started_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `,
    [siteId],
  );
  const activeRun = activeRunRes.rows[0];
  if (!activeRun) return null;
  return {
    jobId: null,
    scanRunId: activeRun.scan_run_id,
    scanStatus: activeRun.scan_status,
    jobStatus: null,
  };
}

async function insertQueuedScanRun(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  siteId: string,
  startUrl: string,
): Promise<ScanRunEventRow> {
  const res = await client.query<ScanRunEventRow>(
    `
      WITH inserted AS (
        INSERT INTO scan_runs (site_id, start_url, status, trigger_type)
        VALUES ($1, $2, 'queued', 'scheduled')
        RETURNING
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
          trigger_type
      )
      SELECT inserted.*, s.user_id
      FROM inserted
      JOIN sites s ON s.id = inserted.site_id
    `,
    [siteId, startUrl],
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error("scan_run_create_failed");
  }
  return row;
}

export async function getSiteSchedule(
  siteId: string,
): Promise<SiteScheduleFields | null> {
  const client = await ensureConnected();
  const res = await client.query<ScheduleRow>(
    `
      SELECT id,
             schedule_enabled,
             schedule_frequency,
             schedule_time_utc,
             schedule_day_of_week,
             schedule_day_of_month,
             next_scheduled_at,
             last_scheduled_at
      FROM sites
      WHERE id = $1
    `,
    [siteId],
  );

  const row = res.rows[0];
  return row ? toSiteScheduleFields(row) : null;
}

export async function getSiteScheduleForUser(
  userId: string,
  siteId: string,
): Promise<SiteScheduleFields | null> {
  const client = await ensureConnected();
  const res = await client.query<ScheduleRow>(
    `
      SELECT id,
             schedule_enabled,
             schedule_frequency,
             schedule_time_utc,
             schedule_day_of_week,
             schedule_day_of_month,
             next_scheduled_at,
             last_scheduled_at
      FROM sites
      WHERE id = $1 AND user_id = $2
    `,
    [siteId, userId],
  );

  const row = res.rows[0];
  return row ? toSiteScheduleFields(row) : null;
}

export async function updateSiteSchedule(
  siteId: string,
  fields: {
    scheduleEnabled: boolean;
    scheduleFrequency: ScheduleFrequency;
    scheduleTimeUtc: string;
    scheduleDayOfWeek: number | null;
    scheduleDayOfMonth: number | null;
  },
): Promise<SiteScheduleFields> {
  const client = await ensureConnected();
  const normalized = normalizeScheduleFields(fields);

  const res = await client.query<ScheduleRow>(
    `
      UPDATE sites s
      SET schedule_enabled = $2,
          schedule_frequency = $3,
          schedule_time_utc = $4,
          schedule_day_of_week = $5,
          schedule_day_of_month = $6,
          next_scheduled_at = $7
      WHERE s.id = $1
      RETURNING id,
                user_id,
                schedule_enabled,
                schedule_frequency,
                schedule_time_utc,
                schedule_day_of_week,
                schedule_day_of_month,
                next_scheduled_at,
                last_scheduled_at
    `,
    [
      siteId,
      fields.scheduleEnabled,
      fields.scheduleFrequency,
      fields.scheduleTimeUtc,
      normalized.scheduleDayOfWeek,
      normalized.scheduleDayOfMonth,
      normalized.nextScheduledAt,
    ],
  );

  const row = res.rows[0];
  if (!row) throw new Error("site_not_found");
  if (row.user_id) {
    await emitScheduleUpdated(row.user_id, siteId, row);
  }
  return toSiteScheduleFields(row);
}

export async function updateSiteScheduleForUser(
  userId: string,
  siteId: string,
  fields: {
    scheduleEnabled: boolean;
    scheduleFrequency: ScheduleFrequency;
    scheduleTimeUtc: string;
    scheduleDayOfWeek: number | null;
    scheduleDayOfMonth: number | null;
  },
): Promise<SiteScheduleFields> {
  const client = await ensureConnected();
  const normalized = normalizeScheduleFields(fields);

  const res = await client.query<ScheduleRow>(
    `
      UPDATE sites s
      SET schedule_enabled = $3,
          schedule_frequency = $4,
          schedule_time_utc = $5,
          schedule_day_of_week = $6,
          schedule_day_of_month = $7,
          next_scheduled_at = $8
      WHERE s.id = $1 AND s.user_id = $2
        AND (s.is_sample_site = false OR $3 = false)
      RETURNING id,
                user_id,
                schedule_enabled,
                schedule_frequency,
                schedule_time_utc,
                schedule_day_of_week,
                schedule_day_of_month,
                next_scheduled_at,
                last_scheduled_at
    `,
    [
      siteId,
      userId,
      fields.scheduleEnabled,
      fields.scheduleFrequency,
      fields.scheduleTimeUtc,
      normalized.scheduleDayOfWeek,
      normalized.scheduleDayOfMonth,
      normalized.nextScheduledAt,
    ],
  );

  const row = res.rows[0];
  if (!row) throw new Error("site_not_found");
  await emitScheduleUpdated(userId, siteId, row);
  return toSiteScheduleFields(row);
}

export async function getDueSites(limit: number): Promise<
  Array<{
    id: string;
    url: string;
    schedule_frequency: ScheduleFrequency;
    schedule_time_utc: string;
    schedule_day_of_week: number | null;
    schedule_day_of_month: number | null;
    next_scheduled_at: Date | null;
    last_scheduled_at: Date | null;
  }>
> {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT id,
             url,
             schedule_frequency,
             schedule_time_utc,
             schedule_day_of_week,
             schedule_day_of_month,
             next_scheduled_at,
             last_scheduled_at
      FROM sites
      WHERE schedule_enabled = true
        AND disabled_at IS NULL
        AND is_sample_site = false
        AND next_scheduled_at IS NOT NULL
        AND next_scheduled_at <= NOW()
      ORDER BY next_scheduled_at ASC
      LIMIT $1
    `,
    [limit],
  );
  return res.rows;
}

export async function markSiteScheduled(
  siteId: string,
  runAt: Date,
): Promise<void> {
  const client = await ensureConnected();
  const res = await client.query<ScheduleRow>(
    `
      SELECT id,
             user_id,
             schedule_enabled,
             schedule_frequency,
             schedule_time_utc,
             schedule_day_of_week,
             schedule_day_of_month,
               next_scheduled_at,
               last_scheduled_at,
               is_sample_site
        FROM sites
        WHERE id = $1
    `,
    [siteId],
  );
  const row = res.rows[0];
  if (!row || !row.schedule_enabled || row.schedule_frequency === "manual") {
    return;
  }

  const nextScheduledAt = computeNextScheduledAt(
    {
      frequency: row.schedule_frequency,
      timeUtc: row.schedule_time_utc,
      dayOfWeek: row.schedule_day_of_week,
      dayOfMonth: row.schedule_day_of_month,
    },
    runAt,
  );

  const updated = await client.query<ScheduleRow>(
    `
      UPDATE sites
      SET last_scheduled_at = $2,
          next_scheduled_at = $3
      WHERE id = $1
      RETURNING id,
                user_id,
                schedule_enabled,
                schedule_frequency,
                schedule_time_utc,
                schedule_day_of_week,
                schedule_day_of_month,
                next_scheduled_at,
                last_scheduled_at
    `,
    [siteId, runAt, nextScheduledAt],
  );
  const updatedRow = updated.rows[0];
  if (updatedRow?.user_id) {
    await emitScheduleUpdated(updatedRow.user_id, siteId, updatedRow);
  }
}

export async function enqueueScheduledScanIfDue(
  siteId: string,
  runAt: Date = new Date(),
): Promise<ScheduledEnqueueResult> {
  const client = await ensureConnected();
  let scheduleRow: ScheduleRow | null = null;
  let scanRunRow: ScanRunEventRow | null = null;
  let jobId: string | null = null;

  await client.query("BEGIN");
  try {
    const siteRes = await client.query<ScheduleRow>(
      `
        SELECT id,
               user_id,
               url,
               schedule_enabled,
               schedule_frequency,
               schedule_time_utc,
               schedule_day_of_week,
               schedule_day_of_month,
               next_scheduled_at,
               last_scheduled_at,
               disabled_at
        FROM sites
        WHERE id = $1
        FOR UPDATE
      `,
      [siteId],
    );
    const site = siteRes.rows[0];
    if (!site) {
      await client.query("ROLLBACK");
      return { created: false, reason: "site_not_found" };
    }

    if (site.disabled_at) {
      await client.query("ROLLBACK");
      return { created: false, reason: "site_disabled" };
    }

    if (site.is_sample_site) {
      await client.query("ROLLBACK");
      return { created: false, reason: "sample_site" };
    }

    if (!site.schedule_enabled) {
      await client.query("ROLLBACK");
      return { created: false, reason: "schedule_disabled" };
    }

    if (site.schedule_frequency === "manual") {
      await client.query("ROLLBACK");
      return { created: false, reason: "schedule_invalid" };
    }

    if (!site.next_scheduled_at || site.next_scheduled_at > runAt) {
      await client.query("ROLLBACK");
      return { created: false, reason: "schedule_not_due" };
    }

    const active = await getActiveScheduledWork(client, siteId);
    if (active) {
      await client.query("ROLLBACK");
      return {
        created: false,
        reason: "active_work_exists",
        active,
      };
    }

    scanRunRow = await insertQueuedScanRun(client, siteId, site.url ?? "");
    const jobRes = await client.query<{ id: string }>(
      `
        INSERT INTO scan_jobs (scan_run_id, site_id, status, run_at)
        VALUES ($1, $2, 'queued', NOW())
        RETURNING id
      `,
      [scanRunRow.id, siteId],
    );
    jobId = jobRes.rows[0]?.id ?? null;
    if (!jobId) {
      throw new Error("scan_job_create_failed");
    }

    const nextScheduledAt = computeNextScheduledAt(
      {
        frequency: site.schedule_frequency,
        timeUtc: site.schedule_time_utc,
        dayOfWeek: site.schedule_day_of_week,
        dayOfMonth: site.schedule_day_of_month,
      },
      runAt,
    );

    const updatedScheduleRes = await client.query<ScheduleRow>(
      `
        UPDATE sites
        SET last_scheduled_at = $2,
            next_scheduled_at = $3
        WHERE id = $1
        RETURNING id,
                  user_id,
                  schedule_enabled,
                  schedule_frequency,
                  schedule_time_utc,
                  schedule_day_of_week,
                  schedule_day_of_month,
                  next_scheduled_at,
                  last_scheduled_at
      `,
      [siteId, runAt, nextScheduledAt],
    );
    scheduleRow = updatedScheduleRes.rows[0] ?? null;

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  if (!scanRunRow || !jobId) {
    return { created: false, reason: "schedule_invalid" };
  }

  await emitScanStarted(scanRunRow);
  if (scheduleRow?.user_id) {
    await emitScheduleUpdated(scheduleRow.user_id, siteId, scheduleRow);
  }

  return {
    created: true,
    scanRunId: scanRunRow.id,
    jobId,
    nextScheduledAt: scheduleRow?.next_scheduled_at ?? null,
  };
}
