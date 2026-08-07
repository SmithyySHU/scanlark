export type WorkerFailureClass =
  | "transient_infrastructure"
  | "configuration"
  | "fatal_startup"
  | "unknown";

export type WorkerLoopHealthMode =
  | "starting"
  | "healthy"
  | "backing_off"
  | "degraded"
  | "stopped"
  | "disabled"
  | "shutting_down";

export type WorkerLoopHealthSnapshot = Readonly<{
  loopName: string;
  mode: WorkerLoopHealthMode;
  processStartedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  retryCount: number;
  nextRetryAt: string | null;
  safeFailureClass: WorkerFailureClass | null;
  safeErrorCode: string | null;
  updatedAt: string;
}>;

export type WorkerHealthClock = {
  now(): number;
};

export type WorkerFailureHealthInput = {
  failureClass: WorkerFailureClass;
  safeErrorCode: string;
  nextRetryAt: string | null;
  degradedThreshold: number;
};

type MutableWorkerLoopHealth = {
  loopName: string;
  mode: WorkerLoopHealthMode;
  processStartedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  retryCount: number;
  nextRetryAt: string | null;
  safeFailureClass: WorkerFailureClass | null;
  safeErrorCode: string | null;
  updatedAt: string;
};

function isoAt(clock: WorkerHealthClock) {
  return new Date(clock.now()).toISOString();
}

function safeErrorCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_.-]{0,79}$/.test(normalized)
    ? normalized
    : "unknown_failure";
}

function snapshot(record: MutableWorkerLoopHealth): WorkerLoopHealthSnapshot {
  return Object.freeze({ ...record });
}

/**
 * The process-local health source of truth. Persisted status is deliberately a
 * best-effort observer of this registry rather than a dependency of work.
 */
export class WorkerHealthRegistry {
  private readonly records = new Map<string, MutableWorkerLoopHealth>();
  private readonly listeners = new Set<
    (snapshot: WorkerLoopHealthSnapshot) => void
  >();
  private readonly clock: WorkerHealthClock;
  private readonly processStartedAt: string;

  constructor(
    input: { clock?: WorkerHealthClock; processStartedAt?: string } = {},
  ) {
    this.clock = input.clock ?? { now: () => Date.now() };
    this.processStartedAt = input.processStartedAt ?? isoAt(this.clock);
  }

  subscribe(
    listener: (snapshot: WorkerLoopHealthSnapshot) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  registerLoop(loopName: string): WorkerLoopHealthSnapshot {
    const existing = this.records.get(loopName);
    if (existing) return snapshot(existing);
    const now = isoAt(this.clock);
    const record: MutableWorkerLoopHealth = {
      loopName,
      mode: "starting",
      processStartedAt: this.processStartedAt,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      retryCount: 0,
      nextRetryAt: null,
      safeFailureClass: null,
      safeErrorCode: null,
      updatedAt: now,
    };
    this.records.set(loopName, record);
    return this.publish(record);
  }

  recordSuccess(
    loopName: string,
    successResetThreshold: number,
  ): WorkerLoopHealthSnapshot {
    const record = this.require(loopName);
    const hadFailures = record.consecutiveFailures > 0;
    record.mode = "healthy";
    record.lastSuccessAt = isoAt(this.clock);
    record.consecutiveSuccesses += 1;
    record.nextRetryAt = null;
    if (hadFailures && record.consecutiveSuccesses >= successResetThreshold) {
      record.consecutiveFailures = 0;
      record.safeFailureClass = null;
      record.safeErrorCode = null;
    }
    return this.publish(record);
  }

  recordFailure(
    loopName: string,
    input: WorkerFailureHealthInput,
  ): WorkerLoopHealthSnapshot {
    const record = this.require(loopName);
    record.consecutiveFailures += 1;
    record.consecutiveSuccesses = 0;
    record.retryCount += 1;
    record.lastFailureAt = isoAt(this.clock);
    record.nextRetryAt = input.nextRetryAt;
    record.safeFailureClass = input.failureClass;
    record.safeErrorCode = safeErrorCode(input.safeErrorCode);
    record.mode =
      record.consecutiveFailures >= input.degradedThreshold
        ? "degraded"
        : "backing_off";
    return this.publish(record);
  }

  markDisabled(loopName: string, safeReason: string): WorkerLoopHealthSnapshot {
    const record = this.require(loopName);
    record.mode = "disabled";
    record.nextRetryAt = null;
    record.safeFailureClass = "configuration";
    record.safeErrorCode = safeErrorCode(safeReason);
    return this.publish(record);
  }

  markShuttingDown(loopName?: string): WorkerLoopHealthSnapshot[] {
    const records = loopName
      ? [this.require(loopName)]
      : [...this.records.values()].filter(
          (record) => record.mode !== "disabled" && record.mode !== "stopped",
        );
    return records.map((record) => {
      record.mode = "shutting_down";
      record.nextRetryAt = null;
      return this.publish(record);
    });
  }

  markStopped(loopName: string): WorkerLoopHealthSnapshot {
    const record = this.require(loopName);
    record.mode = "stopped";
    record.nextRetryAt = null;
    return this.publish(record);
  }

  getLoopHealth(loopName: string): WorkerLoopHealthSnapshot | null {
    const record = this.records.get(loopName);
    return record ? snapshot(record) : null;
  }

  getAllLoopHealth(): WorkerLoopHealthSnapshot[] {
    return [...this.records.values()]
      .sort((left, right) => left.loopName.localeCompare(right.loopName))
      .map(snapshot);
  }

  private require(loopName: string): MutableWorkerLoopHealth {
    const record = this.records.get(loopName);
    if (!record) throw new Error(`worker_loop_not_registered:${loopName}`);
    return record;
  }

  private publish(record: MutableWorkerLoopHealth): WorkerLoopHealthSnapshot {
    record.updatedAt = isoAt(this.clock);
    const current = snapshot(record);
    for (const listener of this.listeners) listener(current);
    return current;
  }
}
