import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyCoreLoopFailure } from "./coreLoopTicks";
import { WorkerHealthRegistry } from "./workerHealth";
import { runSupervisedLoop, type AbortableWait } from "./workerSupervisor";

const immediateWait: AbortableWait = async () => {};
const quietLogger = { info: () => {}, warn: () => {} };
const loopNames = ["scan", "scheduler", "reaper", "uptime"] as const;

test("core PostgreSQL failure classification is safe and narrow", () => {
  assert.deepEqual(classifyCoreLoopFailure({ code: "ECONNREFUSED" }), {
    failureClass: "transient_infrastructure",
    safeErrorCode: "database_unavailable",
  });
  assert.deepEqual(classifyCoreLoopFailure(new Error("unexpected")), {
    failureClass: "unknown",
    safeErrorCode: "core_tick_failure",
  });
});

for (const failedLoop of loopNames) {
  test(`${failedLoop} infrastructure failure backs off without stopping core peers`, async () => {
    const controller = new AbortController();
    const registry = new WorkerHealthRegistry();
    const calls = new Map<string, number>();
    const supervisors = loopNames.map((name) =>
      runSupervisedLoop({
        name,
        signal: controller.signal,
        idleDelayMs: 0,
        healthRegistry: registry,
        logger: quietLogger,
        wait: immediateWait,
        random: () => 0.5,
        classifyFailure: classifyCoreLoopFailure,
        tick: async () => {
          const call = (calls.get(name) ?? 0) + 1;
          calls.set(name, call);
          if (name === failedLoop && call === 1) {
            throw { code: "ECONNREFUSED" };
          }
          if (loopNames.every((loop) => (calls.get(loop) ?? 0) >= 2)) {
            controller.abort();
          }
          return { kind: "idle" };
        },
      }),
    );
    await Promise.all(supervisors);
    for (const name of loopNames) {
      assert.ok((calls.get(name) ?? 0) >= 2, `${name} kept ticking`);
      const health = registry.getLoopHealth(name)!;
      assert.equal(health.mode, "stopped");
      assert.equal(health.consecutiveFailures, name === failedLoop ? 1 : 0);
    }
  });
}

test("core topology has four supervised ticks and no recoverable scan process exit", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  for (const name of loopNames) {
    assert.match(source, new RegExp(`startCoreLoop\\("${name}"`));
  }
  assert.equal(source.includes("process.exit(1)"), false);
  assert.equal(source.includes("tickScanWorker(coreTickOptions"), true);
  assert.equal(source.includes("tickScheduler(coreTickOptions"), true);
  assert.equal(source.includes("tickReaper(coreTickOptions"), true);
  assert.equal(source.includes("tickUptime(coreTickOptions"), true);
  for (const name of [
    "email-smtp",
    "email-crm-finalisation",
    "email-sent-copy",
  ]) {
    assert.match(source, new RegExp(`startEmailLoop\\(\\s*"${name}"`));
  }
  assert.equal(source.includes("tickOperationsEmailSmtp"), true);
  assert.equal(source.includes("tickOperationsEmailCrmFinalisation"), true);
  assert.equal(source.includes("tickOperationsEmailSentCopy"), true);
});

test("Email workers expose bounded ticks and no unmanaged production polling loop", () => {
  for (const [file, tick] of [
    ["operationsEmailWorker.ts", "tickOperationsEmailSmtp"],
    ["operationsEmailFinalisation.ts", "tickOperationsEmailCrmFinalisation"],
    ["operationsEmailSentCopy.ts", "tickOperationsEmailSentCopy"],
  ]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.equal(source.includes("while (!input.signal.aborted)"), false);
    assert.equal(source.includes(`export async function ${tick}`), true);
  }
});
