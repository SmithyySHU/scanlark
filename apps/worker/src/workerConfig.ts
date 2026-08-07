import {
  DEFAULT_WORKER_SUPERVISOR_BACKOFF,
  type WorkerSupervisorBackoff,
} from "./workerSupervisor";

export const DEFAULT_WORKER_SHUTDOWN_GRACE_MS = 30_000;
export const MIN_WORKER_SHUTDOWN_GRACE_MS = 5_000;
export const MAX_WORKER_SHUTDOWN_GRACE_MS = 120_000;

export type WorkerRuntimeConfig = {
  shutdownGraceMs: number;
  supervisorBackoff: WorkerSupervisorBackoff;
};

export class WorkerConfigurationError extends Error {
  readonly safeErrorCode: string;

  constructor(safeErrorCode: string) {
    super(safeErrorCode);
    this.name = "WorkerConfigurationError";
    this.safeErrorCode = safeErrorCode;
  }
}

export function getWorkerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerRuntimeConfig {
  const rawGrace = env.WORKER_SHUTDOWN_GRACE_MS?.trim();
  if (!rawGrace) {
    return {
      shutdownGraceMs: DEFAULT_WORKER_SHUTDOWN_GRACE_MS,
      supervisorBackoff: DEFAULT_WORKER_SUPERVISOR_BACKOFF,
    };
  }
  if (!/^\d+$/.test(rawGrace)) {
    throw new WorkerConfigurationError("worker_shutdown_grace_invalid");
  }
  const shutdownGraceMs = Number(rawGrace);
  if (
    !Number.isSafeInteger(shutdownGraceMs) ||
    shutdownGraceMs < MIN_WORKER_SHUTDOWN_GRACE_MS ||
    shutdownGraceMs > MAX_WORKER_SHUTDOWN_GRACE_MS
  ) {
    throw new WorkerConfigurationError("worker_shutdown_grace_out_of_range");
  }
  return {
    shutdownGraceMs,
    supervisorBackoff: DEFAULT_WORKER_SUPERVISOR_BACKOFF,
  };
}
