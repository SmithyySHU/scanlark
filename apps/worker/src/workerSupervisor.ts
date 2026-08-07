import type {
  WorkerFailureClass,
  WorkerHealthClock,
  WorkerHealthRegistry,
  WorkerLoopHealthSnapshot,
} from "./workerHealth";

export type WorkerTickResult =
  | { kind: "worked" }
  | { kind: "idle" }
  | { kind: "disabled"; safeReason: string };

export type WorkerTickContext = { signal: AbortSignal };

export type WorkerSupervisorBackoff = Readonly<{
  initialDelayMs: number;
  multiplier: number;
  maximumDelayMs: number;
  jitterRatio: number;
  degradedThreshold: number;
  successResetThreshold: number;
}>;

export const DEFAULT_WORKER_SUPERVISOR_BACKOFF: WorkerSupervisorBackoff = {
  initialDelayMs: 1_000,
  multiplier: 2,
  maximumDelayMs: 60_000,
  jitterRatio: 0.2,
  degradedThreshold: 5,
  successResetThreshold: 3,
};

export type WorkerSupervisorLogEvent = Readonly<{
  event:
    | "worker_loop_starting"
    | "worker_loop_backing_off"
    | "worker_loop_degraded"
    | "worker_loop_recovered"
    | "worker_loop_disabled"
    | "worker_loop_shutting_down"
    | "worker_loop_stopped";
  loopName: string;
  mode?: string;
  failureClass?: WorkerFailureClass;
  safeErrorCode?: string;
  consecutiveFailures?: number;
  backoffMs?: number;
}>;

export type WorkerSupervisorLogger = {
  info(event: WorkerSupervisorLogEvent): void;
  warn(event: WorkerSupervisorLogEvent): void;
};

export type WorkerHealthPublisher = {
  publish(snapshot: WorkerLoopHealthSnapshot): void;
};

export type AbortableWait = (
  delayMs: number,
  signal: AbortSignal,
) => Promise<void>;

export class WorkerSupervisorError extends Error {
  readonly failureClass: WorkerFailureClass;
  readonly safeErrorCode: string;

  constructor(
    failureClass: WorkerFailureClass,
    safeErrorCode: string = "unknown_failure",
  ) {
    super(safeErrorCode);
    this.name = "WorkerSupervisorError";
    this.failureClass = failureClass;
    this.safeErrorCode = sanitizeSafeErrorCode(safeErrorCode);
  }
}

export type WorkerSupervisorOptions = {
  name: string;
  signal: AbortSignal;
  tick(context: WorkerTickContext): Promise<WorkerTickResult>;
  idleDelayMs: number;
  healthRegistry: WorkerHealthRegistry;
  backoff?: WorkerSupervisorBackoff;
  logger?: WorkerSupervisorLogger;
  healthPublisher?: WorkerHealthPublisher;
  clock?: WorkerHealthClock;
  random?: () => number;
  wait?: AbortableWait;
  classifyFailure?: (error: unknown) => {
    failureClass: WorkerFailureClass;
    safeErrorCode: string;
  };
};

const defaultClock: WorkerHealthClock = { now: () => Date.now() };
const defaultLogger: WorkerSupervisorLogger = {
  info: (event) => console.info(JSON.stringify(event)),
  warn: (event) => console.warn(JSON.stringify(event)),
};

function sanitizeSafeErrorCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_.-]{0,79}$/.test(normalized)
    ? normalized
    : "unknown_failure";
}

function clampRandom(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

export function validateWorkerSupervisorBackoff(
  backoff: WorkerSupervisorBackoff,
): WorkerSupervisorBackoff {
  const valid =
    Number.isInteger(backoff.initialDelayMs) &&
    backoff.initialDelayMs > 0 &&
    Number.isFinite(backoff.multiplier) &&
    backoff.multiplier >= 1 &&
    Number.isInteger(backoff.maximumDelayMs) &&
    backoff.maximumDelayMs >= backoff.initialDelayMs &&
    Number.isFinite(backoff.jitterRatio) &&
    backoff.jitterRatio >= 0 &&
    backoff.jitterRatio <= 1 &&
    Number.isInteger(backoff.degradedThreshold) &&
    backoff.degradedThreshold > 0 &&
    Number.isInteger(backoff.successResetThreshold) &&
    backoff.successResetThreshold > 0;
  if (!valid)
    throw new WorkerSupervisorError(
      "configuration",
      "invalid_supervisor_backoff",
    );
  return Object.freeze({ ...backoff });
}

export function calculateWorkerSupervisorBackoffDelay(
  consecutiveFailures: number,
  backoff: WorkerSupervisorBackoff = DEFAULT_WORKER_SUPERVISOR_BACKOFF,
  random: () => number = Math.random,
): number {
  const validated = validateWorkerSupervisorBackoff(backoff);
  const failures = Math.max(1, Math.floor(consecutiveFailures));
  const unjittered = Math.min(
    validated.maximumDelayMs,
    validated.initialDelayMs * validated.multiplier ** (failures - 1),
  );
  const jitter = 1 + (clampRandom(random()) * 2 - 1) * validated.jitterRatio;
  return Math.max(
    0,
    Math.min(validated.maximumDelayMs, Math.round(unjittered * jitter)),
  );
}

/** A wait that never leaves a timer or abort listener behind. */
export function sleepWithAbort(
  delayMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted || delayMs <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    signal.addEventListener("abort", finish, { once: true });
  });
}

function defaultFailureClassification(error: unknown): {
  failureClass: WorkerFailureClass;
  safeErrorCode: string;
} {
  if (error instanceof WorkerSupervisorError) {
    return {
      failureClass: error.failureClass,
      safeErrorCode: error.safeErrorCode,
    };
  }
  return { failureClass: "unknown", safeErrorCode: "unknown_failure" };
}

/**
 * Runs a polling loop without owning business-level retry policy. Item retries
 * remain in their respective databases/queues; this only backs off a failed
 * loop iteration and never terminates the process.
 */
export async function runSupervisedLoop(
  options: WorkerSupervisorOptions,
): Promise<void> {
  const backoff = validateWorkerSupervisorBackoff(
    options.backoff ?? DEFAULT_WORKER_SUPERVISOR_BACKOFF,
  );
  const logger = options.logger ?? defaultLogger;
  const clock = options.clock ?? defaultClock;
  const random = options.random ?? Math.random;
  const wait = options.wait ?? sleepWithAbort;
  const classifyFailure =
    options.classifyFailure ?? defaultFailureClassification;
  const registry = options.healthRegistry;
  let lastFailureLogAt = Number.NEGATIVE_INFINITY;
  let hadFailure = false;
  let disabled = false;

  const publish = (health: WorkerLoopHealthSnapshot) => {
    try {
      options.healthPublisher?.publish(health);
    } catch {
      // Publishers must be best effort even when an injected implementation is faulty.
    }
    return health;
  };

  publish(registry.registerLoop(options.name));
  logger.info({
    event: "worker_loop_starting",
    loopName: options.name,
    mode: "starting",
  });

  try {
    while (!options.signal.aborted) {
      try {
        const result = await options.tick({ signal: options.signal });
        if (options.signal.aborted) break;
        if (result.kind === "disabled") {
          disabled = true;
          const health = publish(
            registry.markDisabled(options.name, result.safeReason),
          );
          logger.info({
            event: "worker_loop_disabled",
            loopName: options.name,
            mode: health.mode,
            safeErrorCode: health.safeErrorCode ?? undefined,
          });
          return;
        }

        const health = publish(
          registry.recordSuccess(options.name, backoff.successResetThreshold),
        );
        if (hadFailure && health.consecutiveFailures === 0) {
          logger.info({
            event: "worker_loop_recovered",
            loopName: options.name,
            mode: health.mode,
          });
          hadFailure = false;
        }
        if (result.kind === "idle")
          await wait(Math.max(0, options.idleDelayMs), options.signal);
      } catch (error) {
        if (options.signal.aborted) break;
        const failure = classifyFailure(error);
        if (failure.failureClass === "fatal_startup") {
          publish(
            registry.recordFailure(options.name, {
              failureClass: failure.failureClass,
              safeErrorCode: failure.safeErrorCode,
              nextRetryAt: null,
              degradedThreshold: backoff.degradedThreshold,
            }),
          );
          throw error;
        }
        if (failure.failureClass === "configuration") {
          disabled = true;
          const health = publish(
            registry.markDisabled(options.name, failure.safeErrorCode),
          );
          logger.info({
            event: "worker_loop_disabled",
            loopName: options.name,
            mode: health.mode,
            safeErrorCode: health.safeErrorCode ?? undefined,
          });
          return;
        }
        const prior = registry.getLoopHealth(options.name);
        const failures = (prior?.consecutiveFailures ?? 0) + 1;
        const delayMs = calculateWorkerSupervisorBackoffDelay(
          failures,
          backoff,
          random,
        );
        const health = publish(
          registry.recordFailure(options.name, {
            failureClass: failure.failureClass,
            safeErrorCode: failure.safeErrorCode,
            nextRetryAt: new Date(clock.now() + delayMs).toISOString(),
            degradedThreshold: backoff.degradedThreshold,
          }),
        );
        hadFailure = true;
        const event =
          health.mode === "degraded"
            ? "worker_loop_degraded"
            : "worker_loop_backing_off";
        if (
          health.consecutiveFailures === 1 ||
          health.consecutiveFailures === backoff.degradedThreshold ||
          clock.now() - lastFailureLogAt >= Math.max(1_000, delayMs)
        ) {
          logger.warn({
            event,
            loopName: options.name,
            mode: health.mode,
            failureClass: health.safeFailureClass ?? undefined,
            safeErrorCode: health.safeErrorCode ?? undefined,
            consecutiveFailures: health.consecutiveFailures,
            backoffMs: delayMs,
          });
          lastFailureLogAt = clock.now();
        }
        await wait(delayMs, options.signal);
      }
    }
  } finally {
    if (!disabled && options.signal.aborted) {
      publish(registry.markShuttingDown(options.name)[0]!);
      logger.info({
        event: "worker_loop_shutting_down",
        loopName: options.name,
        mode: "shutting_down",
      });
      publish(registry.markStopped(options.name));
      logger.info({
        event: "worker_loop_stopped",
        loopName: options.name,
        mode: "stopped",
      });
    }
  }
}
