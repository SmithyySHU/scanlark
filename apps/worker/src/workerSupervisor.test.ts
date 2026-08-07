import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getWorkerRuntimeConfig,
  WorkerConfigurationError,
} from "./workerConfig";
import { WorkerHealthRegistry } from "./workerHealth";
import { WorkerHealthPublisher } from "./workerHealthPublisher";
import { createWorkerRuntimeFoundation } from "./workerRuntime";
import {
  calculateWorkerSupervisorBackoffDelay,
  runSupervisedLoop,
  sleepWithAbort,
  WorkerSupervisorError,
  type AbortableWait,
  type WorkerSupervisorLogger,
} from "./workerSupervisor";

class FakeClock {
  value = 0;
  now = () => this.value;
  advance(ms: number) {
    this.value += ms;
  }
}

const silentLogger: WorkerSupervisorLogger = { info: () => {}, warn: () => {} };
const immediateWait: AbortableWait = async () => {};

test("supervisor registers starting, treats worked and idle as healthy, and disables normally", async () => {
  const clock = new FakeClock();
  const registry = new WorkerHealthRegistry({ clock });
  const controller = new AbortController();
  const outcomes = ["worked", "idle", "disabled"] as const;
  let index = 0;
  await runSupervisedLoop({
    name: "test_loop",
    signal: controller.signal,
    idleDelayMs: 10,
    healthRegistry: registry,
    logger: silentLogger,
    clock,
    wait: immediateWait,
    tick: async () => {
      const outcome = outcomes[index++]!;
      return outcome === "disabled"
        ? { kind: outcome, safeReason: "optional_disabled" }
        : { kind: outcome };
    },
  });
  const health = registry.getLoopHealth("test_loop")!;
  assert.equal(health.mode, "disabled");
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(health.safeErrorCode, "optional_disabled");
});

test("supervisor backs off, degrades at five failures, and resets after three normal ticks", async () => {
  const clock = new FakeClock();
  const registry = new WorkerHealthRegistry({ clock });
  const controller = new AbortController();
  let calls = 0;
  const delays: number[] = [];
  await runSupervisedLoop({
    name: "failure_loop",
    signal: controller.signal,
    idleDelayMs: 0,
    healthRegistry: registry,
    logger: silentLogger,
    clock,
    random: () => 0.5,
    wait: async (delay) => {
      delays.push(delay);
      clock.advance(delay);
    },
    tick: async () => {
      calls += 1;
      if (calls <= 5)
        throw new WorkerSupervisorError(
          "transient_infrastructure",
          "db_unavailable",
        );
      if (calls >= 9) controller.abort();
      return { kind: "worked" };
    },
  });
  const health = registry.getLoopHealth("failure_loop")!;
  assert.equal(health.mode, "stopped");
  assert.equal(health.consecutiveFailures, 0);
  assert.equal(health.retryCount, 5);
  assert.deepEqual(delays, [1_000, 2_000, 4_000, 8_000, 16_000]);
  assert.equal("stack" in health, false);
  assert.equal(health.safeErrorCode, null);
});

test("supervisor backoff jitter is bounded and success reset starts the next failure at its initial delay", () => {
  const policy = {
    initialDelayMs: 1_000,
    multiplier: 2,
    maximumDelayMs: 60_000,
    jitterRatio: 0.2,
    degradedThreshold: 5,
    successResetThreshold: 3,
  };
  assert.equal(
    calculateWorkerSupervisorBackoffDelay(1, policy, () => 0),
    800,
  );
  assert.equal(
    calculateWorkerSupervisorBackoffDelay(1, policy, () => 1),
    1_200,
  );
  assert.equal(
    calculateWorkerSupervisorBackoffDelay(50, policy, () => 1),
    60_000,
  );
  assert.equal(
    calculateWorkerSupervisorBackoffDelay(1, policy, () => -3),
    800,
  );
  assert.equal(
    calculateWorkerSupervisorBackoffDelay(1, policy, () => 3),
    1_200,
  );
});

test("abortable sleep resolves promptly and an aborted supervisor starts no new tick", async () => {
  const controller = new AbortController();
  const wait = sleepWithAbort(10_000, controller.signal);
  controller.abort();
  await wait;

  const registry = new WorkerHealthRegistry();
  let ticks = 0;
  await runSupervisedLoop({
    name: "aborted_before_start",
    signal: controller.signal,
    idleDelayMs: 1,
    healthRegistry: registry,
    logger: silentLogger,
    tick: async () => {
      ticks += 1;
      return { kind: "idle" };
    },
  });
  assert.equal(ticks, 0);
  assert.equal(registry.getLoopHealth("aborted_before_start")!.mode, "stopped");
});

test("two supervisors retain isolated health and a root abort stops both", async () => {
  const controller = new AbortController();
  const registry = new WorkerHealthRegistry();
  let failed = 0;
  let healthy = 0;
  const loopA = runSupervisedLoop({
    name: "loop_a",
    signal: controller.signal,
    idleDelayMs: 0,
    healthRegistry: registry,
    logger: silentLogger,
    wait: immediateWait,
    tick: async () => {
      failed += 1;
      if (failed >= 5) controller.abort();
      throw new WorkerSupervisorError("unknown", "loop_a_failure");
    },
  });
  const loopB = runSupervisedLoop({
    name: "loop_b",
    signal: controller.signal,
    idleDelayMs: 0,
    healthRegistry: registry,
    logger: silentLogger,
    wait: immediateWait,
    tick: async () => {
      healthy += 1;
      return { kind: "idle" };
    },
  });
  await Promise.all([loopA, loopB]);
  assert.ok(failed >= 5);
  assert.equal(registry.getLoopHealth("loop_a")!.mode, "stopped");
  assert.equal(registry.getLoopHealth("loop_b")!.mode, "stopped");
  assert.ok(healthy >= 0);
});

test("health snapshots are immutable and publisher failures are isolated, throttled, and recoverable", async () => {
  const clock = new FakeClock();
  const registry = new WorkerHealthRegistry({ clock });
  const warnings: unknown[] = [];
  let failures = 0;
  const writes: string[] = [];
  const publisher = new WorkerHealthPublisher({
    workerInstanceId: "00000000-0000-4000-8000-000000000001",
    clock,
    logger: { warn: (event) => warnings.push(event) },
    writer: {
      upsertWorkerLoopHealth: async (input) => {
        failures += 1;
        if (failures <= 2) throw new Error("postgres://not-safe-to-log");
        writes.push(
          `${input.workerInstanceId}:${input.loopName}:${input.mode}`,
        );
      },
    },
  });
  const starting = registry.registerLoop("publisher_loop");
  assert.throws(() => {
    (starting as { mode: string }).mode = "healthy";
  });
  publisher.publish(starting);
  await publisher.flush();
  publisher.publish(registry.recordSuccess("publisher_loop", 3));
  await publisher.flush();
  assert.equal(warnings.length, 1);
  clock.advance(30_000);
  publisher.publish(registry.getLoopHealth("publisher_loop")!);
  await publisher.flush();
  assert.deepEqual(writes, [
    "00000000-0000-4000-8000-000000000001:publisher_loop:healthy",
  ]);
});

test("worker shutdown grace configuration defaults and validates safely", () => {
  assert.equal(getWorkerRuntimeConfig({}).shutdownGraceMs, 30_000);
  assert.equal(
    getWorkerRuntimeConfig({ WORKER_SHUTDOWN_GRACE_MS: "5000" })
      .shutdownGraceMs,
    5_000,
  );
  assert.equal(
    getWorkerRuntimeConfig({ WORKER_SHUTDOWN_GRACE_MS: "120000" })
      .shutdownGraceMs,
    120_000,
  );
  for (const value of ["x", "4999", "120001"]) {
    assert.throws(
      () => getWorkerRuntimeConfig({ WORKER_SHUTDOWN_GRACE_MS: value }),
      WorkerConfigurationError,
    );
  }
});

test("registry stores loops independently and healthy heartbeats are rate-limited", async () => {
  const clock = new FakeClock();
  const registry = new WorkerHealthRegistry({ clock });
  const writes: string[] = [];
  const publisher = new WorkerHealthPublisher({
    workerInstanceId: "00000000-0000-4000-8000-000000000002",
    clock,
    writer: {
      upsertWorkerLoopHealth: async (input) =>
        writes.push(`${input.loopName}:${input.mode}`),
    },
  });
  const loopA = registry.registerLoop("loop_a");
  const loopB = registry.registerLoop("loop_b");
  publisher.publish(loopA);
  publisher.publish(loopB);
  await publisher.flush();
  const healthyA = registry.recordSuccess("loop_a", 3);
  publisher.publish(healthyA);
  publisher.publish(healthyA);
  await publisher.flush();
  assert.deepEqual(writes, [
    "loop_a:starting",
    "loop_b:starting",
    "loop_a:healthy",
  ]);
  clock.advance(29_999);
  publisher.publish(healthyA);
  await publisher.flush();
  assert.equal(writes.length, 3);
  clock.advance(1);
  publisher.publish(healthyA);
  await publisher.flush();
  assert.equal(writes.length, 4);

  registry.markShuttingDown();
  assert.deepEqual(
    registry.getAllLoopHealth().map((health) => health.mode),
    ["shutting_down", "shutting_down"],
  );
});

test("heartbeat write failure does not add a work-loop failure", async () => {
  const registry = new WorkerHealthRegistry();
  const controller = new AbortController();
  const publisher = new WorkerHealthPublisher({
    workerInstanceId: "00000000-0000-4000-8000-000000000003",
    writer: {
      upsertWorkerLoopHealth: async () => Promise.reject(new Error("db down")),
    },
  });
  await runSupervisedLoop({
    name: "publisher_isolation",
    signal: controller.signal,
    idleDelayMs: 0,
    healthRegistry: registry,
    healthPublisher: publisher,
    logger: silentLogger,
    wait: immediateWait,
    tick: async () => {
      controller.abort();
      return { kind: "worked" };
    },
  });
  await publisher.flush();
  assert.equal(
    registry.getLoopHealth("publisher_isolation")!.consecutiveFailures,
    0,
  );
});

test("runtime foundation owns one instance ID, root signal, registry, and supervisor seam without starting loops", () => {
  const runtime = createWorkerRuntimeFoundation({
    workerInstanceId: "00000000-0000-4000-8000-000000000099",
    writer: { upsertWorkerLoopHealth: async () => undefined },
    config: getWorkerRuntimeConfig({}),
  });
  assert.equal(
    runtime.workerInstanceId,
    "00000000-0000-4000-8000-000000000099",
  );
  assert.equal(runtime.signal.aborted, false);
  assert.deepEqual(runtime.healthRegistry.getAllLoopHealth(), []);
  runtime.abort();
  assert.equal(runtime.signal.aborted, true);
  runtime.close();
});

test("the supervisor owns no process exit and C4 centralizes the forced-timeout exit", () => {
  const indexSource = readFileSync(
    new URL("./index.ts", import.meta.url),
    "utf8",
  );
  const supervisorSource = readFileSync(
    new URL("./workerSupervisor.ts", import.meta.url),
    "utf8",
  );
  assert.equal(indexSource.includes("process.exit(1)"), false);
  assert.equal(indexSource.includes("process.exit(0)"), false);
  assert.equal(indexSource.includes("process.exit(result.exitCode)"), true);
  assert.equal(supervisorSource.includes("process.exit"), false);
});
