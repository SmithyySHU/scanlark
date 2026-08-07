import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { closeConnection } from "./client";
import { DATABASE_URL } from "./env";
import {
  listWorkerLoopHealth,
  markWorkerLoopHealthStopped,
  upsertWorkerLoopHealth,
} from "./workerLoopHealth";

function isDisposableDatabase(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      /test|audit|verify/i.test(url.pathname.slice(1)) &&
      process.env.NODE_ENV !== "production"
    );
  } catch {
    return false;
  }
}

const enabled = isDisposableDatabase(DATABASE_URL);
const directClient = new Client({ connectionString: DATABASE_URL });
const instanceA = randomUUID();
const instanceB = randomUUID();
const now = new Date().toISOString();

function input(workerInstanceId: string, loopName: string, mode = "healthy") {
  return {
    workerInstanceId,
    loopName,
    mode: mode as "healthy",
    processStartedAt: now,
    lastSuccessAt: now,
    lastFailureAt: null,
    consecutiveFailures: 0,
    consecutiveSuccesses: 1,
    retryCount: 0,
    nextRetryAt: null,
    safeFailureClass: null,
    safeErrorCode: null,
    heartbeatAt: now,
    updatedAt: now,
  };
}

before(async () => {
  if (enabled) await directClient.connect();
});

after(async () => {
  if (!enabled) return;
  await directClient.query(
    `DELETE FROM worker_loop_health WHERE worker_instance_id = ANY($1::uuid[])`,
    [[instanceA, instanceB]],
  );
  await directClient.end();
  await closeConnection();
});

test("worker loop health upserts by instance and loop and records stopped state", async () => {
  if (!enabled) return;
  await upsertWorkerLoopHealth(input(instanceA, "scan_loop"));
  await upsertWorkerLoopHealth({
    ...input(instanceA, "scan_loop"),
    mode: "backing_off",
    consecutiveFailures: 1,
    consecutiveSuccesses: 0,
    retryCount: 1,
    safeFailureClass: "transient_infrastructure",
    safeErrorCode: "db_unavailable",
  });
  await upsertWorkerLoopHealth(input(instanceA, "scheduler_loop"));
  await upsertWorkerLoopHealth(input(instanceB, "scan_loop"));

  const first = await listWorkerLoopHealth({ workerInstanceId: instanceA });
  assert.equal(first.length, 2);
  assert.equal(
    first.find((row) => row.loop_name === "scan_loop")!.mode,
    "backing_off",
  );
  assert.equal(
    first.find((row) => row.loop_name === "scan_loop")!.retry_count,
    1,
  );

  const stopped = await markWorkerLoopHealthStopped({
    workerInstanceId: instanceA,
    loopName: "scan_loop",
    updatedAt: new Date(Date.parse(now) + 1_000).toISOString(),
  });
  assert.equal(stopped!.mode, "stopped");
  assert.equal(stopped!.next_retry_at, null);
  const all = await listWorkerLoopHealth({ loopName: "scan_loop" });
  assert.equal(all.length, 2);
});
