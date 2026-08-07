import { ensureConnected } from "./client";

export type WorkerLoopHealthMode =
  | "starting"
  | "healthy"
  | "backing_off"
  | "degraded"
  | "stopped"
  | "disabled"
  | "shutting_down";

export type WorkerLoopHealthWriteInput = {
  workerInstanceId: string;
  loopName: string;
  mode: WorkerLoopHealthMode;
  processStartedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  retryCount: number;
  nextRetryAt: string | null;
  safeFailureClass: string | null;
  safeErrorCode: string | null;
  heartbeatAt: string;
  updatedAt: string;
};

export type WorkerLoopHealthRow = {
  worker_instance_id: string;
  loop_name: string;
  mode: WorkerLoopHealthMode;
  process_started_at: Date;
  last_success_at: Date | null;
  last_failure_at: Date | null;
  consecutive_failures: number;
  consecutive_successes: number;
  retry_count: number;
  next_retry_at: Date | null;
  safe_failure_class: string | null;
  safe_error_code: string | null;
  heartbeat_at: Date;
  updated_at: Date;
};

export async function upsertWorkerLoopHealth(
  input: WorkerLoopHealthWriteInput,
): Promise<WorkerLoopHealthRow> {
  const client = await ensureConnected();
  const result = await client.query<WorkerLoopHealthRow>(
    `INSERT INTO worker_loop_health (
      worker_instance_id, loop_name, mode, process_started_at, last_success_at,
      last_failure_at, consecutive_failures, consecutive_successes, retry_count,
      next_retry_at, safe_failure_class, safe_error_code, heartbeat_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    )
    ON CONFLICT (worker_instance_id, loop_name) DO UPDATE SET
      mode = EXCLUDED.mode,
      process_started_at = EXCLUDED.process_started_at,
      last_success_at = EXCLUDED.last_success_at,
      last_failure_at = EXCLUDED.last_failure_at,
      consecutive_failures = EXCLUDED.consecutive_failures,
      consecutive_successes = EXCLUDED.consecutive_successes,
      retry_count = EXCLUDED.retry_count,
      next_retry_at = EXCLUDED.next_retry_at,
      safe_failure_class = EXCLUDED.safe_failure_class,
      safe_error_code = EXCLUDED.safe_error_code,
      heartbeat_at = EXCLUDED.heartbeat_at,
      updated_at = EXCLUDED.updated_at
    RETURNING *`,
    [
      input.workerInstanceId,
      input.loopName,
      input.mode,
      input.processStartedAt,
      input.lastSuccessAt,
      input.lastFailureAt,
      input.consecutiveFailures,
      input.consecutiveSuccesses,
      input.retryCount,
      input.nextRetryAt,
      input.safeFailureClass,
      input.safeErrorCode,
      input.heartbeatAt,
      input.updatedAt,
    ],
  );
  return result.rows[0]!;
}

export async function listWorkerLoopHealth(
  input: {
    workerInstanceId?: string;
    loopName?: string;
  } = {},
): Promise<WorkerLoopHealthRow[]> {
  const client = await ensureConnected();
  const values: string[] = [];
  const where: string[] = [];
  if (input.workerInstanceId) {
    values.push(input.workerInstanceId);
    where.push(`worker_instance_id = $${values.length}`);
  }
  if (input.loopName) {
    values.push(input.loopName);
    where.push(`loop_name = $${values.length}`);
  }
  const result = await client.query<WorkerLoopHealthRow>(
    `SELECT * FROM worker_loop_health ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY worker_instance_id, loop_name`,
    values,
  );
  return result.rows;
}

export async function markWorkerLoopHealthStopped(input: {
  workerInstanceId: string;
  loopName: string;
  updatedAt?: string;
}): Promise<WorkerLoopHealthRow | null> {
  const client = await ensureConnected();
  const result = await client.query<WorkerLoopHealthRow>(
    `UPDATE worker_loop_health
        SET mode = 'stopped', next_retry_at = NULL, heartbeat_at = $3, updated_at = $3
      WHERE worker_instance_id = $1 AND loop_name = $2
      RETURNING *`,
    [
      input.workerInstanceId,
      input.loopName,
      input.updatedAt ?? new Date().toISOString(),
    ],
  );
  return result.rows[0] ?? null;
}
