import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getWorkerRuntimeConfig } from "./workerConfig";
import { createWorkerRuntimeFoundation } from "./workerRuntime";
import { sleepWithAbort, type AbortableWait } from "./workerSupervisor";

const testConfig = {
  ...getWorkerRuntimeConfig({}),
  shutdownGraceMs: 100,
};

const quietLogger = { info: () => {}, warn: () => {} };

function createRuntime(
  input: {
    shutdownGraceMs?: number;
    setTimeout?: typeof globalThis.setTimeout;
    clearTimeout?: typeof globalThis.clearTimeout;
  } = {},
) {
  return createWorkerRuntimeFoundation({
    workerInstanceId: "00000000-0000-4000-8000-0000000000c4",
    config: { ...testConfig, shutdownGraceMs: input.shutdownGraceMs ?? 100 },
    writer: { upsertWorkerLoopHealth: async () => undefined },
    logger: quietLogger,
    shutdownLogger: quietLogger,
    setTimeout: input.setTimeout,
    clearTimeout: input.clearTimeout,
  });
}

test("runtime aborts all idle supervisors, waits for settlement, then cleans resources once", async () => {
  const runtime = createRuntime();
  const ticks = new Map<string, number>();
  const closed: string[] = [];
  runtime.registerCleanup("database", async () => {
    closed.push("database");
  });
  runtime.registerCleanup("smtp", async () => {
    closed.push("smtp");
  });
  const wait: AbortableWait = sleepWithAbort;
  const loops = [
    "scan",
    "scheduler",
    "reaper",
    "uptime",
    "email-smtp",
    "email-crm-finalisation",
    "email-sent-copy",
  ].map((name) =>
    runtime.runLoop({
      name,
      idleDelayMs: 10_000,
      wait,
      tick: async () => {
        ticks.set(name, (ticks.get(name) ?? 0) + 1);
        return { kind: "idle" } as const;
      },
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  const result = await runtime.shutdown("SIGTERM");
  await Promise.all(loops);

  assert.equal(result.state, "stopped");
  assert.equal(result.exitCode, 0);
  assert.equal(runtime.signal.aborted, true);
  assert.equal(runtime.getState(), "stopped");
  assert.deepEqual(closed, ["database", "smtp"]);
  for (const name of ticks.keys()) {
    assert.equal(ticks.get(name), 1, `${name} did not start another tick`);
    assert.equal(runtime.healthRegistry.getLoopHealth(name)?.mode, "stopped");
  }
});

test("repeated shutdown requests share one result and never duplicate resource cleanup", async () => {
  const runtime = createRuntime();
  let cleanupCalls = 0;
  runtime.registerCleanup("database", () => {
    cleanupCalls += 1;
  });
  const loop = runtime.runLoop({
    name: "scan",
    idleDelayMs: 10_000,
    wait: sleepWithAbort,
    tick: async () => ({ kind: "idle" }),
  });
  await new Promise((resolve) => setImmediate(resolve));

  const first = runtime.shutdown("SIGTERM");
  const second = runtime.shutdown("SIGINT");
  assert.strictEqual(first, second);
  const result = await first;
  await loop;
  assert.equal(result.exitCode, 0);
  assert.equal(cleanupCalls, 1);
});

test("normal shutdown flushes the stopped heartbeat before closing resources", async () => {
  const events: string[] = [];
  const runtime = createWorkerRuntimeFoundation({
    workerInstanceId: "00000000-0000-4000-8000-0000000000c5",
    config: testConfig,
    logger: quietLogger,
    shutdownLogger: quietLogger,
    writer: {
      upsertWorkerLoopHealth: async (input) => {
        events.push(`health:${input.mode}`);
      },
    },
  });
  runtime.registerCleanup("database", () => {
    events.push("cleanup:database");
  });
  const loop = runtime.runLoop({
    name: "scan",
    idleDelayMs: 10_000,
    wait: sleepWithAbort,
    tick: async () => ({ kind: "idle" }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  await runtime.shutdown("SIGTERM");
  await loop;

  assert.ok(events.includes("health:stopped"));
  assert.ok(
    events.indexOf("health:stopped") < events.indexOf("cleanup:database"),
  );
});

test("runtime does not close resources while an in-flight tick still has grace to finish", async () => {
  const runtime = createRuntime();
  let release: (() => void) | undefined;
  let cleanupCalls = 0;
  runtime.registerCleanup("smtp", () => {
    cleanupCalls += 1;
  });
  const loop = runtime.runLoop({
    name: "email-smtp",
    idleDelayMs: 0,
    tick: async () =>
      new Promise((resolve) => {
        release = () => resolve({ kind: "worked" });
      }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const shutdown = runtime.shutdown("SIGTERM");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cleanupCalls, 0);
  release?.();
  const result = await shutdown;
  await loop;
  assert.equal(result.state, "stopped");
  assert.equal(cleanupCalls, 1);
});

test("a grace timeout is explicit, reports only loop names, and still runs cleanup", async () => {
  const immediateTimeout = ((callback: () => void) => {
    queueMicrotask(callback);
    return {} as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
  const runtime = createRuntime({ setTimeout: immediateTimeout });
  let cleanupCalls = 0;
  runtime.registerCleanup("database", () => {
    cleanupCalls += 1;
  });
  void runtime.runLoop({
    name: "scan",
    idleDelayMs: 0,
    tick: async () => new Promise(() => undefined),
  });
  await new Promise((resolve) => setImmediate(resolve));

  const result = await runtime.shutdown("SIGTERM");
  assert.equal(result.state, "forced_timeout");
  assert.equal(result.exitCode, 1);
  assert.deepEqual(result.unsettledLoopNames, ["scan"]);
  assert.equal(runtime.getState(), "forced_timeout");
  assert.equal(cleanupCalls, 1);
});

test("only index owns signal registration and the single forced-timeout hard exit", () => {
  const indexSource = readFileSync(
    new URL("./index.ts", import.meta.url),
    "utf8",
  );
  const runtimeSource = readFileSync(
    new URL("./workerRuntime.ts", import.meta.url),
    "utf8",
  );
  assert.match(indexSource, /process\.once\(signal/);
  assert.match(indexSource, /process\.exit\(result\.exitCode\)/);
  assert.equal(runtimeSource.includes("process.exit"), false);
});
