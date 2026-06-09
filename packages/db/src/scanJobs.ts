import { ensureConnected } from "./client";
import { emitScanEvent } from "./events";

export type ScanJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type ScanJobRow = {
  id: string;
  scan_run_id: string | null;
  site_id: string;
  status: ScanJobStatus;
  attempts: number;
  max_attempts: number;
  locked_at: Date | null;
  lock_expires_at: Date | null;
  run_at: Date;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
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
  user_id: string;
};

export type ActiveSiteScan = {
  jobId: string | null;
  scanRunId: string | null;
  jobStatus: "queued" | "running" | null;
  scanStatus: "queued" | "in_progress" | null;
};

export type EnqueueIfIdleResult =
  | {
      created: true;
      scanRunId: string;
      jobId: string;
    }
  | {
      created: false;
      active: ActiveSiteScan | null;
    };

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
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

async function getActiveSiteScanTx(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  siteId: string,
): Promise<ActiveSiteScan | null> {
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
      jobStatus: activeJob.job_status,
      scanStatus: activeJob.scan_status,
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
    jobStatus: null,
    scanStatus: activeRun.scan_status,
  };
}

async function insertQueuedScanRunTx(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  siteId: string,
  startUrl: string,
): Promise<ScanRunEventRow> {
  const res = await client.query<ScanRunEventRow>(
    `
      WITH inserted AS (
        INSERT INTO scan_runs (site_id, start_url, status)
        VALUES ($1, $2, 'queued')
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
          broken_links
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

export async function getActiveSiteScan(
  siteId: string,
): Promise<ActiveSiteScan | null> {
  const client = await ensureConnected();
  return getActiveSiteScanTx(client, siteId);
}

export async function enqueueScanJob(params: {
  scanRunId?: string | null;
  siteId: string;
  runAt?: Date;
}): Promise<string> {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      INSERT INTO scan_jobs (scan_run_id, site_id, status, run_at)
      VALUES ($1, $2, 'queued', COALESCE($3, NOW()))
      RETURNING id
    `,
    [params.scanRunId ?? null, params.siteId, params.runAt ?? null],
  );
  return res.rows[0].id;
}

export async function enqueueManualScanIfIdle(params: {
  siteId: string;
  startUrl: string;
}): Promise<EnqueueIfIdleResult> {
  const client = await ensureConnected();
  let scanRunRow: ScanRunEventRow | null = null;
  let jobId: string | null = null;

  await client.query("BEGIN");
  try {
    const siteRes = await client.query(
      `
        SELECT id
        FROM sites
        WHERE id = $1
        FOR UPDATE
      `,
      [params.siteId],
    );
    if ((siteRes.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      throw new Error("site_not_found");
    }

    const active = await getActiveSiteScanTx(client, params.siteId);
    if (active) {
      await client.query("ROLLBACK");
      return { created: false, active };
    }

    scanRunRow = await insertQueuedScanRunTx(
      client,
      params.siteId,
      params.startUrl,
    );
    const jobRes = await client.query<{ id: string }>(
      `
        INSERT INTO scan_jobs (scan_run_id, site_id, status, run_at)
        VALUES ($1, $2, 'queued', NOW())
        RETURNING id
      `,
      [scanRunRow.id, params.siteId],
    );
    jobId = jobRes.rows[0]?.id ?? null;
    if (!jobId) {
      throw new Error("scan_job_create_failed");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  if (!scanRunRow || !jobId) {
    return { created: false, active: null };
  }
  await emitScanStarted(scanRunRow);
  return {
    created: true,
    scanRunId: scanRunRow.id,
    jobId,
  };
}

export async function enqueueExistingScanRunIfIdle(params: {
  scanRunId: string;
  siteId: string;
}): Promise<EnqueueIfIdleResult> {
  const client = await ensureConnected();
  let jobId: string | null = null;

  await client.query("BEGIN");
  try {
    await client.query(
      `
        SELECT id
        FROM sites
        WHERE id = $1
        FOR UPDATE
      `,
      [params.siteId],
    );

    const runRes = await client.query<{
      id: string;
      site_id: string;
      status: string;
    }>(
      `
        SELECT id, site_id, status
        FROM scan_runs
        WHERE id = $1 AND site_id = $2
        FOR UPDATE
      `,
      [params.scanRunId, params.siteId],
    );
    if ((runRes.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      throw new Error("scan_run_not_found");
    }

    const active = await getActiveSiteScanTx(client, params.siteId);
    if (
      active &&
      (active.scanRunId !== params.scanRunId || active.jobStatus !== null)
    ) {
      await client.query("ROLLBACK");
      return { created: false, active };
    }

    if (active?.jobStatus && active.scanRunId === params.scanRunId) {
      await client.query("ROLLBACK");
      return { created: false, active };
    }

    const jobRes = await client.query<{ id: string }>(
      `
        INSERT INTO scan_jobs (scan_run_id, site_id, status, run_at)
        VALUES ($1, $2, 'queued', NOW())
        RETURNING id
      `,
      [params.scanRunId, params.siteId],
    );
    jobId = jobRes.rows[0]?.id ?? null;
    if (!jobId) {
      throw new Error("scan_job_create_failed");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  return {
    created: true,
    scanRunId: params.scanRunId,
    jobId: jobId as string,
  };
}

export async function claimNextScanJob(params: {
  workerId: string;
  leaseSeconds: number;
}): Promise<ScanJobRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      WITH next_job AS (
        SELECT id
        FROM scan_jobs
        WHERE status = 'queued'
          AND run_at <= NOW()
          AND NOT EXISTS (
            SELECT 1
            FROM scan_jobs active_jobs
            WHERE active_jobs.site_id = scan_jobs.site_id
              AND active_jobs.id <> scan_jobs.id
              AND active_jobs.status = 'running'
              AND (
                active_jobs.lock_expires_at IS NULL
                OR active_jobs.lock_expires_at > NOW()
              )
          )
        ORDER BY run_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE scan_jobs
      SET status = 'running',
          locked_at = NOW(),
          lock_expires_at = NOW() + ($1 * INTERVAL '1 second'),
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = (SELECT id FROM next_job)
      RETURNING *
    `,
    [params.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function completeScanJob(
  jobId: string,
): Promise<ScanJobRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      UPDATE scan_jobs
      SET status = 'completed',
          locked_at = NULL,
          lock_expires_at = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [jobId],
  );
  return res.rows[0] ?? null;
}

export async function extendScanJobLease(
  jobId: string,
  params: {
    leaseSeconds: number;
  },
): Promise<ScanJobRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      UPDATE scan_jobs
      SET lock_expires_at = NOW() + ($2 * INTERVAL '1 second'),
          updated_at = NOW()
      WHERE id = $1
        AND status = 'running'
      RETURNING *
    `,
    [jobId, params.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function failScanJob(
  jobId: string,
  error: string,
): Promise<ScanJobRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      UPDATE scan_jobs
      SET status = CASE
            WHEN attempts < max_attempts THEN 'queued'
            ELSE 'failed'
          END,
          run_at = CASE
            WHEN attempts < max_attempts THEN NOW() + CASE attempts
              WHEN 1 THEN INTERVAL '30 seconds'
              WHEN 2 THEN INTERVAL '2 minutes'
              ELSE INTERVAL '10 minutes'
            END
            ELSE run_at
          END,
          locked_at = NULL,
          lock_expires_at = NULL,
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [jobId, error],
  );
  return res.rows[0] ?? null;
}

export async function cancelScanJob(jobId: string): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE scan_jobs
      SET status = 'cancelled',
          locked_at = NULL,
          lock_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $1 AND status <> 'completed'
    `,
    [jobId],
  );
}

export async function getJobForScanRun(
  scanRunId: string,
): Promise<ScanJobRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      SELECT *
      FROM scan_jobs
      WHERE scan_run_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [scanRunId],
  );
  return res.rows[0] ?? null;
}

export async function setScanJobRunId(
  jobId: string,
  scanRunId: string,
): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE scan_jobs
      SET scan_run_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [jobId, scanRunId],
  );
}

export async function requeueExpiredScanJobs(): Promise<ScanJobRow[]> {
  const client = await ensureConnected();
  const res = await client.query<ScanJobRow>(
    `
      WITH recovered AS (
        UPDATE scan_jobs
        SET status = CASE
              WHEN attempts < max_attempts THEN 'queued'
              ELSE 'failed'
            END,
            run_at = CASE
              WHEN attempts < max_attempts THEN NOW()
              ELSE run_at
            END,
            locked_at = NULL,
            lock_expires_at = NULL,
            last_error = CASE
              WHEN attempts < max_attempts THEN
                CASE
                  WHEN last_error IS NULL THEN 'lock_expired_requeued'
                  ELSE last_error || E'\\nlock_expired_requeued'
                END
              ELSE
                CASE
                  WHEN last_error IS NULL THEN 'lock_expired_failed_max_attempts'
                  ELSE last_error || E'\\nlock_expired_failed_max_attempts'
                END
            END,
            updated_at = NOW()
        WHERE status = 'running'
          AND lock_expires_at IS NOT NULL
          AND lock_expires_at < NOW()
        RETURNING *
      ),
      reset_runs AS (
        UPDATE scan_runs r
        SET status = CASE
              WHEN recovered.status = 'queued' THEN 'queued'
              ELSE 'failed'
            END,
            error_message = CASE
              WHEN recovered.status = 'queued' THEN NULL
              ELSE recovered.last_error
            END,
            finished_at = CASE
              WHEN recovered.status = 'queued' THEN NULL
              ELSE COALESCE(r.finished_at, NOW())
            END,
            updated_at = NOW()
        FROM recovered
        WHERE r.id = recovered.scan_run_id
          AND r.status = 'in_progress'
        RETURNING r.id
      )
      SELECT *
      FROM recovered
    `,
  );
  return res.rows;
}

export async function recoverStaleQueuedScanJobs(params?: {
  olderThanMinutes?: number;
}): Promise<ScanJobRow[]> {
  const client = await ensureConnected();
  const olderThanMinutes = params?.olderThanMinutes ?? 15;
  const res = await client.query<ScanJobRow>(
    `
      UPDATE scan_jobs j
      SET status = 'cancelled',
          locked_at = NULL,
          lock_expires_at = NULL,
          last_error = CASE
            WHEN j.last_error IS NULL THEN 'stale_queued_job_cancelled'
            ELSE j.last_error || E'\\nstale_queued_job_cancelled'
          END,
          updated_at = NOW()
      FROM scan_runs r
      WHERE j.scan_run_id = r.id
        AND j.status = 'queued'
        AND j.created_at < NOW() - ($1 * INTERVAL '1 minute')
        AND r.status IN ('completed', 'failed', 'cancelled')
      RETURNING j.*
    `,
    [olderThanMinutes],
  );
  return res.rows;
}

export async function hasActiveJobForSite(siteId: string): Promise<boolean> {
  const active = await getActiveSiteScan(siteId);
  return active?.jobStatus === "queued" || active?.jobStatus === "running";
}
