import type {
  WorkerHealthClock,
  WorkerLoopHealthSnapshot,
} from "./workerHealth";

export type WorkerLoopHealthPersistenceInput = Readonly<{
  workerInstanceId: string;
  loopName: string;
  mode: WorkerLoopHealthSnapshot["mode"];
  processStartedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  retryCount: number;
  nextRetryAt: string | null;
  safeFailureClass: WorkerLoopHealthSnapshot["safeFailureClass"];
  safeErrorCode: string | null;
  heartbeatAt: string;
  updatedAt: string;
}>;

export type WorkerLoopHealthWriter = {
  upsertWorkerLoopHealth(
    input: WorkerLoopHealthPersistenceInput,
  ): Promise<unknown>;
};

export type WorkerHealthPublisherLogger = {
  warn(
    event: Readonly<{
      event: "worker_health_persistence_failed";
      loopName: string;
      safeErrorCode: "worker_health_persistence_failed";
    }>,
  ): void;
};

export type WorkerHealthPublisherOptions = {
  workerInstanceId: string;
  writer: WorkerLoopHealthWriter;
  clock?: WorkerHealthClock;
  logger?: WorkerHealthPublisherLogger;
  activeHeartbeatCadenceMs?: number;
  failureLogCadenceMs?: number;
};

const defaultClock: WorkerHealthClock = { now: () => Date.now() };
const defaultLogger: WorkerHealthPublisherLogger = {
  warn: (event) => console.warn(JSON.stringify(event)),
};
const DEFAULT_HEARTBEAT_CADENCE_MS = 30_000;

function persistenceInput(
  workerInstanceId: string,
  snapshot: WorkerLoopHealthSnapshot,
): WorkerLoopHealthPersistenceInput {
  return {
    workerInstanceId,
    loopName: snapshot.loopName,
    mode: snapshot.mode,
    processStartedAt: snapshot.processStartedAt,
    lastSuccessAt: snapshot.lastSuccessAt,
    lastFailureAt: snapshot.lastFailureAt,
    consecutiveFailures: snapshot.consecutiveFailures,
    consecutiveSuccesses: snapshot.consecutiveSuccesses,
    retryCount: snapshot.retryCount,
    nextRetryAt: snapshot.nextRetryAt,
    safeFailureClass: snapshot.safeFailureClass,
    safeErrorCode: snapshot.safeErrorCode,
    heartbeatAt: snapshot.updatedAt,
    updatedAt: snapshot.updatedAt,
  };
}

/**
 * A non-authoritative observer. Its failures are contained here and cannot
 * change loop health or work retry behavior.
 */
export class WorkerHealthPublisher {
  private readonly clock: WorkerHealthClock;
  private readonly logger: WorkerHealthPublisherLogger;
  private readonly activeHeartbeatCadenceMs: number;
  private readonly failureLogCadenceMs: number;
  private readonly lastPersistedAt = new Map<string, number>();
  private readonly lastSignature = new Map<string, string>();
  private readonly lastFailureLoggedAt = new Map<string, number>();
  private readonly pending = new Set<Promise<void>>();
  private closed = false;

  constructor(private readonly options: WorkerHealthPublisherOptions) {
    this.clock = options.clock ?? defaultClock;
    this.logger = options.logger ?? defaultLogger;
    this.activeHeartbeatCadenceMs =
      options.activeHeartbeatCadenceMs ?? DEFAULT_HEARTBEAT_CADENCE_MS;
    this.failureLogCadenceMs =
      options.failureLogCadenceMs ?? DEFAULT_HEARTBEAT_CADENCE_MS;
  }

  publish(snapshot: WorkerLoopHealthSnapshot): void {
    if (this.closed) return;
    const now = this.clock.now();
    const signature = JSON.stringify({
      mode: snapshot.mode,
      consecutiveFailures: snapshot.consecutiveFailures,
      retryCount: snapshot.retryCount,
      nextRetryAt: snapshot.nextRetryAt,
      safeFailureClass: snapshot.safeFailureClass,
      safeErrorCode: snapshot.safeErrorCode,
    });
    const changed = this.lastSignature.get(snapshot.loopName) !== signature;
    const lastPersisted = this.lastPersistedAt.get(snapshot.loopName);
    const due =
      lastPersisted === undefined ||
      now - lastPersisted >= this.activeHeartbeatCadenceMs;
    if (!changed && !due) return;

    this.lastSignature.set(snapshot.loopName, signature);
    this.lastPersistedAt.set(snapshot.loopName, now);
    const pending = Promise.resolve()
      .then(() => {
        if (this.closed) return;
        return this.options.writer.upsertWorkerLoopHealth(
          persistenceInput(this.options.workerInstanceId, snapshot),
        );
      })
      .then(() => undefined)
      .catch(() => {
        const previous =
          this.lastFailureLoggedAt.get(snapshot.loopName) ??
          Number.NEGATIVE_INFINITY;
        if (now - previous >= this.failureLogCadenceMs) {
          this.logger.warn({
            event: "worker_health_persistence_failed",
            loopName: snapshot.loopName,
            safeErrorCode: "worker_health_persistence_failed",
          });
          this.lastFailureLoggedAt.set(snapshot.loopName, now);
        }
      })
      .finally(() => this.pending.delete(pending));
    this.pending.add(pending);
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  /** Stop observation writes without affecting running work or health state. */
  close(): void {
    this.closed = true;
  }
}

export { DEFAULT_HEARTBEAT_CADENCE_MS };
