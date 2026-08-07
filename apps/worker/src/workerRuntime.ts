import { randomUUID } from "node:crypto";
import { upsertWorkerLoopHealth } from "@scanlark/db";
import {
  getWorkerRuntimeConfig,
  type WorkerRuntimeConfig,
} from "./workerConfig";
import { WorkerHealthRegistry, type WorkerHealthClock } from "./workerHealth";
import {
  WorkerHealthPublisher,
  type WorkerHealthPublisherLogger,
  type WorkerLoopHealthWriter,
} from "./workerHealthPublisher";
import {
  runSupervisedLoop,
  type WorkerSupervisorLogger,
  type WorkerSupervisorOptions,
} from "./workerSupervisor";

export type WorkerRuntimeState =
  | "running"
  | "shutting_down"
  | "stopped"
  | "forced_timeout";

export type WorkerShutdownResult = Readonly<{
  state: Extract<WorkerRuntimeState, "stopped" | "forced_timeout">;
  exitCode: 0 | 1;
  reason: string;
  elapsedMs: number;
  unsettledLoopNames: readonly string[];
}>;

export type WorkerRuntimeShutdownLogger = {
  info(
    event: Readonly<{ event: string; reason?: string; elapsedMs?: number }>,
  ): void;
  warn(
    event: Readonly<{
      event: string;
      reason?: string;
      elapsedMs?: number;
      unsettledLoopNames?: readonly string[];
      resourceName?: string;
    }>,
  ): void;
};

export type WorkerRuntimeCleanup = () => void | Promise<void>;

export type WorkerRuntimeFoundationOptions = {
  workerInstanceId?: string;
  env?: NodeJS.ProcessEnv;
  config?: WorkerRuntimeConfig;
  clock?: WorkerHealthClock;
  writer?: WorkerLoopHealthWriter;
  logger?: WorkerSupervisorLogger & WorkerHealthPublisherLogger;
  shutdownLogger?: WorkerRuntimeShutdownLogger;
  setTimeout?: typeof globalThis.setTimeout;
  clearTimeout?: typeof globalThis.clearTimeout;
};

export type WorkerRuntimeFoundation = Readonly<{
  workerInstanceId: string;
  signal: AbortSignal;
  healthRegistry: WorkerHealthRegistry;
  config: WorkerRuntimeConfig;
  getState(): WorkerRuntimeState;
  runLoop(
    options: Omit<
      WorkerSupervisorOptions,
      | "signal"
      | "healthRegistry"
      | "healthPublisher"
      | "backoff"
      | "logger"
      | "clock"
    >,
  ): Promise<void>;
  registerCleanup(name: string, cleanup: WorkerRuntimeCleanup): () => void;
  awaitSettled(): Promise<void>;
  shutdown(reason?: string): Promise<WorkerShutdownResult>;
  abort(reason?: unknown): void;
  close(): void;
}>;

/**
 * C1's composition seam. It is deliberately not connected to index.ts until
 * the individual loops are migrated in C2 and later checkpoints.
 */
export function createWorkerRuntimeFoundation(
  options: WorkerRuntimeFoundationOptions = {},
): WorkerRuntimeFoundation {
  const config = options.config ?? getWorkerRuntimeConfig(options.env);
  const controller = new AbortController();
  const registry = new WorkerHealthRegistry({ clock: options.clock });
  const logger = options.logger;
  const workerInstanceId = options.workerInstanceId ?? randomUUID();
  const publisher = new WorkerHealthPublisher({
    workerInstanceId,
    writer: options.writer ?? { upsertWorkerLoopHealth },
    clock: options.clock,
    logger,
  });
  const unsubscribe = registry.subscribe((snapshot) =>
    publisher.publish(snapshot),
  );

  const shutdownLogger: WorkerRuntimeShutdownLogger =
    options.shutdownLogger ?? {
      info: (event) => console.info(JSON.stringify(event)),
      warn: (event) => console.warn(JSON.stringify(event)),
    };
  const setTimer = options.setTimeout ?? globalThis.setTimeout;
  const clearTimer = options.clearTimeout ?? globalThis.clearTimeout;
  const supervisors = new Map<string, Promise<void>>();
  const cleanups = new Map<string, WorkerRuntimeCleanup>();
  let state: WorkerRuntimeState = "running";
  let shutdownPromise: Promise<WorkerShutdownResult> | null = null;

  const runLoop: WorkerRuntimeFoundation["runLoop"] = (loopOptions) => {
    if (state !== "running" || controller.signal.aborted) {
      return Promise.resolve();
    }
    if (supervisors.has(loopOptions.name)) {
      throw new Error(`worker_loop_already_registered:${loopOptions.name}`);
    }
    const supervised = runSupervisedLoop({
      ...loopOptions,
      signal: controller.signal,
      healthRegistry: registry,
      healthPublisher: publisher,
      backoff: config.supervisorBackoff,
      logger,
      clock: options.clock,
    });
    const tracked = supervised.finally(() => {
      supervisors.delete(loopOptions.name);
    });
    supervisors.set(loopOptions.name, tracked);
    return tracked;
  };

  const awaitSettled = async () => {
    // Take a snapshot after abort. No later supervisor can be registered once
    // shutdown has begun, so this includes every active loop exactly once.
    await Promise.allSettled([...supervisors.values()]);
  };

  const runCleanups = (waitForCompletion: boolean): Promise<void> => {
    const cleanupEntries = [...cleanups.entries()];
    cleanups.clear();
    const executeResourceCleanups = () =>
      Promise.all(
        cleanupEntries.map(([name, cleanup]) =>
          Promise.resolve()
            .then(cleanup)
            .catch(() => {
              shutdownLogger.warn({
                event: "worker_resource_cleanup_failed",
                resourceName: name,
              });
            }),
        ),
      );
    const finishHealthPublishing = () => {
      publisher.close();
      unsubscribe();
    };
    // Terminal snapshots are queued before resource cleanup. This preserves a
    // best-effort stopped heartbeat while the database is still open. The
    // caller races this whole sequence against the existing grace deadline, so
    // observability can never extend shutdown indefinitely.
    const health = publisher.flush().catch(() => undefined);
    if (!waitForCompletion) {
      // Forced timeout prioritises resource release. Health persistence keeps
      // its best-effort attempt but cannot postpone SMTP/DB cleanup.
      void health.finally(finishHealthPublishing);
      void executeResourceCleanups();
      return Promise.resolve();
    }
    return health
      .then(() => {
        finishHealthPublishing();
        return executeResourceCleanups();
      })
      .then(() => undefined);
  };
  const shutdown = (reason = "shutdown_requested") => {
    if (shutdownPromise) {
      shutdownLogger.info({
        event: "worker_shutdown_already_in_progress",
        reason,
      });
      return shutdownPromise;
    }

    const startedAt = (options.clock ?? { now: () => Date.now() }).now();
    state = "shutting_down";
    registry.markShuttingDown();
    shutdownLogger.info({ event: "worker_shutdown_started", reason });
    controller.abort(reason);

    shutdownPromise = (async () => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settled = awaitSettled().then(() => "settled" as const);
      const graceExpired = new Promise<"timeout">((resolve) => {
        timer = setTimer(() => resolve("timeout"), config.shutdownGraceMs);
      });
      let outcome = await Promise.race([settled, graceExpired]);
      if (outcome === "settled") {
        // Resource cleanup is also inside the same shutdown grace deadline.
        // A hung close cannot turn an explicit bounded shutdown into an
        // unbounded one.
        outcome = await Promise.race([
          runCleanups(true).then(() => "settled" as const),
          graceExpired,
        ]);
      }
      if (timer) clearTimer(timer);

      const elapsedMs = Math.max(
        0,
        (options.clock ?? { now: () => Date.now() }).now() - startedAt,
      );
      if (outcome === "timeout") {
        const unsettledLoopNames = [...supervisors.keys()].sort();
        state = "forced_timeout";
        shutdownLogger.warn({
          event: "worker_shutdown_timeout",
          reason,
          elapsedMs,
          unsettledLoopNames,
        });
        // Initiate every cleanup, but never let a stuck close extend the
        // forced-timeout deadline before the central bootstrap exits.
        void runCleanups(false);
        return Object.freeze({
          state: "forced_timeout" as const,
          exitCode: 1 as const,
          reason,
          elapsedMs,
          unsettledLoopNames,
        });
      }

      state = "stopped";
      shutdownLogger.info({
        event: "worker_shutdown_completed",
        reason,
        elapsedMs,
      });
      return Object.freeze({
        state: "stopped" as const,
        exitCode: 0 as const,
        reason,
        elapsedMs,
        unsettledLoopNames: [],
      });
    })();
    return shutdownPromise;
  };

  return Object.freeze({
    workerInstanceId,
    signal: controller.signal,
    healthRegistry: registry,
    config,
    getState: () => state,
    runLoop,
    registerCleanup: (name, cleanup) => {
      if (cleanups.has(name))
        throw new Error(`worker_cleanup_already_registered:${name}`);
      if (state !== "running") {
        void Promise.resolve(cleanup()).catch(() => undefined);
        return () => undefined;
      }
      cleanups.set(name, cleanup);
      return () => cleanups.delete(name);
    },
    awaitSettled,
    shutdown,
    // Retained as a compatibility seam for C1/C2 callers. It deliberately
    // enters the same centralized lifecycle rather than bypassing cleanup.
    abort: (reason?: unknown) => {
      void shutdown(typeof reason === "string" ? reason : "abort_requested");
    },
    close: () => {
      void shutdown("runtime_closed");
    },
  });
}
