import dotenv from "dotenv";
import * as os from "node:os";
import {
  cancelScanJob,
  claimDueUptimeMonitors,
  claimNextScanJob,
  completeScanJob,
  createScanRun,
  enqueueScheduledScanIfDue,
  extendScanJobLease,
  failScanJob,
  getDueSites,
  getJobForScanRun,
  getScanRunById,
  getSiteById,
  recoverStaleQueuedScanJobs,
  requeueExpiredScanJobs,
  recordUptimeCheck,
  setScanRunStatus,
  setScanJobRunId,
} from "@scanlark/db";
import { runScanForSite } from "../../../packages/crawler/src/scanService";
import { checkUptime } from "../../../packages/crawler/src/checkUptime";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const workerId = `${os.hostname()}-${process.pid}`;
const IDLE_WAIT_MS = 1200;
const SCHEDULE_TICK_MS = 60000;
const CLAIM_LEASE_SECONDS = 120;
const LEASE_HEARTBEAT_MS = 30000;
const REAPER_TICK_MS = 120000;
const STALE_QUEUED_JOB_MINUTES = 15;
const UPTIME_TICK_MS = 60000;
const UPTIME_BATCH_SIZE = 25;
const API_BASE_URL = process.env.WORKER_API_BASE || "http://localhost:3001";
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logJobEvent(
  event: string,
  job: { id: string; site_id: string; scan_run_id: string | null },
  details?: string,
) {
  const suffix = details ? ` ${details}` : "";
  console.log(
    `[worker ${workerId}] ${event} job=${job.id} site=${job.site_id} run=${job.scan_run_id ?? "none"}${suffix}`,
  );
}

async function processJob() {
  const job = await claimNextScanJob({
    workerId,
    leaseSeconds: CLAIM_LEASE_SECONDS,
  });
  if (!job) return false;

  logJobEvent("claimed", job, `attempts=${job.attempts}/${job.max_attempts}`);

  let scanRunId = job.scan_run_id;
  let run = scanRunId ? await getScanRunById(scanRunId) : null;
  if (!run) {
    const site = await getSiteById(job.site_id);
    if (!site) {
      const failedJob = await failScanJob(job.id, "site_not_found");
      if (failedJob) {
        logJobEvent("failed", failedJob, "error=site_not_found");
      }
      return true;
    }
    scanRunId = await createScanRun(site.id, site.url, {
      triggerType: "scheduled",
    });
    await setScanJobRunId(job.id, scanRunId);
    run = await getScanRunById(scanRunId);
  }

  if (!run) {
    const failedJob = await failScanJob(job.id, "scan_run_not_found");
    if (failedJob) {
      logJobEvent("failed", failedJob, "error=scan_run_not_found");
    }
    return true;
  }

  await setScanRunStatus(run.id, "in_progress", {
    errorMessage: null,
    clearFinishedAt: true,
  });
  logJobEvent("started", { ...job, scan_run_id: run.id });

  const leaseHeartbeat = setInterval(() => {
    void extendScanJobLease(job.id, {
      leaseSeconds: CLAIM_LEASE_SECONDS,
    }).catch((err) => {
      console.warn(
        `[worker ${workerId}] lease heartbeat failed job=${job.id}`,
        err,
      );
    });
  }, LEASE_HEARTBEAT_MS);

  try {
    await runScanForSite(run.site_id, run.start_url, run.id);
    const updatedRun = await getScanRunById(run.id);
    if (updatedRun?.status === "cancelled") {
      await cancelScanJob(job.id);
      logJobEvent("cancelled", { ...job, scan_run_id: run.id });
      return true;
    }
    if (updatedRun?.status === "failed") {
      const errorMessage = updatedRun.error_message ?? "scan_failed";
      const exhausted = job.attempts >= job.max_attempts;
      const failedJob = await failScanJob(job.id, errorMessage);
      if (failedJob) {
        logJobEvent(
          exhausted ? "failed" : "requeued",
          { ...failedJob, scan_run_id: run.id },
          `error=${errorMessage}`,
        );
      }
      if (exhausted) {
        await setScanRunStatus(run.id, "failed", {
          errorMessage,
          setFinishedAt: true,
        });
        await notifyScanRun(run.id);
      } else {
        await setScanRunStatus(run.id, "queued", {
          errorMessage,
          clearFinishedAt: true,
        });
      }
      return true;
    }
    const completedJob = await completeScanJob(job.id);
    if (completedJob) {
      logJobEvent("completed", { ...completedJob, scan_run_id: run.id });
    }
    await notifyScanRun(run.id);
    return true;
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "scan_failed_unexpected";
    const exhausted = job.attempts >= job.max_attempts;
    const failedJob = await failScanJob(job.id, errorMessage);
    if (failedJob) {
      logJobEvent(
        exhausted ? "failed" : "requeued",
        { ...failedJob, scan_run_id: run.id },
        `error=${errorMessage}`,
      );
    }
    if (exhausted) {
      await setScanRunStatus(run.id, "failed", {
        errorMessage,
        setFinishedAt: true,
      });
      await notifyScanRun(run.id);
    } else {
      await setScanRunStatus(run.id, "queued", {
        errorMessage,
        clearFinishedAt: true,
      });
    }
    return true;
  } finally {
    clearInterval(leaseHeartbeat);
    const latestJob = await getJobForScanRun(run.id);
    if (latestJob?.status === "cancelled") {
      await setScanRunStatus(run.id, "cancelled", {
        errorMessage: latestJob.last_error ?? null,
        setFinishedAt: true,
      });
    }
  }
}

async function notifyScanRun(scanRunId: string) {
  try {
    const headers: Record<string, string> = {};
    if (API_INTERNAL_TOKEN) {
      headers["x-internal-token"] = API_INTERNAL_TOKEN;
    }
    const res = await fetch(
      `${API_BASE_URL}/scan-runs/${encodeURIComponent(scanRunId)}/notify`,
      { method: "POST", headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[worker ${workerId}] notify failed ${res.status}: ${text.slice(0, 120)}`,
      );
    }
  } catch (err) {
    console.warn(`[worker ${workerId}] notify error`, err);
  }
}

async function runLoop() {
  console.log(`[worker ${workerId}] started`);
  while (true) {
    const didWork = await processJob();
    if (!didWork) {
      await sleep(IDLE_WAIT_MS);
    }
  }
}

async function reapLoop() {
  console.log(`[reaper ${workerId}] started`);
  while (true) {
    const recovered = await requeueExpiredScanJobs();
    for (const job of recovered) {
      logJobEvent(
        "abandoned-recovered",
        job,
        `attempts=${job.attempts}/${job.max_attempts}`,
      );
    }
    const staleQueued = await recoverStaleQueuedScanJobs({
      olderThanMinutes: STALE_QUEUED_JOB_MINUTES,
    });
    for (const job of staleQueued) {
      logJobEvent("stale-queued-recovered", job);
    }
    await sleep(REAPER_TICK_MS);
  }
}

async function schedulerTick() {
  const now = new Date();
  const dueSites = await getDueSites(25);
  let enqueued = 0;
  let skipped = 0;

  for (const site of dueSites) {
    const result = await enqueueScheduledScanIfDue(site.id, now);
    if (result.created) {
      enqueued += 1;
      console.log(
        `[scheduler] enqueued site=${site.id} run=${result.scanRunId} next=${result.nextScheduledAt?.toISOString() ?? "none"}`,
      );
      continue;
    }

    skipped += 1;
    console.log(
      `[scheduler] skipped site=${site.id} reason=${result.reason}${result.active?.scanRunId ? ` activeRun=${result.active.scanRunId}` : ""}${result.active?.jobId ? ` activeJob=${result.active.jobId}` : ""}`,
    );
  }

  console.log(
    `[scheduler] due=${dueSites.length} enqueued=${enqueued} skipped=${skipped}`,
  );
}

async function runSchedulerLoop() {
  console.log(`[scheduler ${workerId}] started`);
  while (true) {
    try {
      await schedulerTick();
    } catch (err) {
      console.error(`[scheduler ${workerId}] error`, err);
    }
    await sleep(SCHEDULE_TICK_MS);
  }
}

async function notifyUptimeIncident(
  incidentId: string,
  kind: "uptime_down" | "uptime_recovered",
) {
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (API_INTERNAL_TOKEN) {
      headers["x-internal-token"] = API_INTERNAL_TOKEN;
    }
    const res = await fetch(
      `${API_BASE_URL}/uptime-incidents/${encodeURIComponent(incidentId)}/notify`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ kind }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[uptime ${workerId}] notify failed ${res.status}: ${text.slice(0, 120)}`,
      );
    }
  } catch (err) {
    console.warn(`[uptime ${workerId}] notify error`, err);
  }
}

async function uptimeTick() {
  const monitors = await claimDueUptimeMonitors(UPTIME_BATCH_SIZE);
  if (monitors.length === 0) {
    console.log("[uptime] due=0 processed=0");
    return;
  }

  for (const monitor of monitors) {
    try {
      const result = await checkUptime(monitor.check_url);
      const recorded = await recordUptimeCheck(monitor.id, result);
      console.log(
        `[uptime] checked site=${monitor.site_id} settings=${monitor.id} status=${recorded.check.status} failures=${recorded.incident?.failure_count ?? 0}`,
      );
      if (recorded.shouldSendDownAlert && recorded.incident) {
        await notifyUptimeIncident(recorded.incident.id, "uptime_down");
      } else if (recorded.shouldSendRecoveryAlert && recorded.incident) {
        await notifyUptimeIncident(recorded.incident.id, "uptime_recovered");
      }
    } catch (err) {
      console.error(
        `[uptime ${workerId}] check failed site=${monitor.site_id} monitor=${monitor.id}`,
        err,
      );
    }
  }

  console.log(`[uptime] due=${monitors.length} processed=${monitors.length}`);
}

async function runUptimeLoop() {
  console.log(`[uptime ${workerId}] started`);
  while (true) {
    try {
      await uptimeTick();
    } catch (err) {
      console.error(`[uptime ${workerId}] error`, err);
    }
    await sleep(UPTIME_TICK_MS);
  }
}

runLoop().catch((err) => {
  console.error(`[worker ${workerId}] fatal`, err);
  process.exit(1);
});

reapLoop().catch((err) => {
  console.error(`[reaper ${workerId}] fatal`, err);
});

runSchedulerLoop().catch((err) => {
  console.error(`[scheduler ${workerId}] fatal`, err);
});

runUptimeLoop().catch((err) => {
  console.error(`[uptime ${workerId}] fatal`, err);
});
