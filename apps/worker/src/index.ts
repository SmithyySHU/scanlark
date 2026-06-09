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
import { createLogger } from "./logger";
import { workerRuntimeConfig } from "./runtimeConfig";

const workerId = `${os.hostname()}-${process.pid}`;
const IDLE_WAIT_MS = 1200;
const SCHEDULE_TICK_MS = 60000;
const CLAIM_LEASE_SECONDS = 120;
const LEASE_HEARTBEAT_MS = 30000;
const REAPER_TICK_MS = 120000;
const STALE_QUEUED_JOB_MINUTES = 15;
const UPTIME_TICK_MS = 60000;
const UPTIME_BATCH_SIZE = 25;
const SHUTDOWN_GRACE_MS = 30000;
const LOOP_RESTART_DELAY_MS = 1000;
const API_BASE_URL = workerRuntimeConfig.apiBaseUrl;
const API_INTERNAL_TOKEN = workerRuntimeConfig.apiInternalToken;
const logger = createLogger({
  service: "scanlark-worker",
  workerId,
  pid: process.pid,
  hostname: os.hostname(),
});

let shutdownRequested = false;
let shutdownSignal: string | null = null;
let shutdownPromise: Promise<void> | null = null;
const sleepResolvers = new Set<() => void>();
const activeOperations = new Set<Promise<unknown>>();
let supervisedLoops: Promise<void>[] = [];

function sleep(ms: number) {
  if (shutdownRequested) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      sleepResolvers.delete(wake);
      resolve();
    }, ms);
    const wake = () => {
      clearTimeout(timer);
      sleepResolvers.delete(wake);
      resolve();
    };
    sleepResolvers.add(wake);
  });
}

function wakeSleeps() {
  for (const wake of sleepResolvers) {
    wake();
  }
}

async function trackOperation<T>(_operation: string, fn: () => Promise<T>) {
  const promise = fn();
  activeOperations.add(promise);
  try {
    return await promise;
  } finally {
    activeOperations.delete(promise);
  }
}

function logJobEvent(
  event: string,
  job: { id: string; site_id: string; scan_run_id: string | null },
  details?: string,
) {
  logger.info("worker.scan_job", "Scan job event", {
    jobId: job.id,
    siteId: job.site_id,
    scanRunId: job.scan_run_id,
    status: event,
    details,
  });
}

async function processJob() {
  if (shutdownRequested) return false;

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
      logger.warn(
        "worker.scan_job.lease_heartbeat_failed",
        "Lease heartbeat failed",
        {
          jobId: job.id,
          siteId: job.site_id,
          scanRunId: run.id,
        },
      );
      logger.error(
        "worker.scan_job.lease_heartbeat_failed.error",
        "Lease heartbeat error",
        {
          jobId: job.id,
          siteId: job.site_id,
          scanRunId: run.id,
        },
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
      logger.warn(
        "worker.scan_run_notify.failed",
        "Scan run notify request failed",
        {
          scanRunId,
          statusCode: res.status,
          responseSnippet: text.slice(0, 120),
        },
      );
    }
  } catch (err) {
    logger.error(
      "worker.scan_run_notify.error",
      "Scan run notify request errored",
      { scanRunId },
      err,
    );
  }
}

async function runLoop() {
  logger.info("worker.scan_loop.started", "Scan job loop started");
  while (!shutdownRequested) {
    try {
      const didWork = await trackOperation("scan_job_tick", () => processJob());
      if (!didWork) {
        await sleep(IDLE_WAIT_MS);
      }
    } catch (err) {
      logger.error(
        "worker.scan_loop.tick_failed",
        "Scan job loop tick failed",
        {},
        err,
      );
      await sleep(IDLE_WAIT_MS);
    }
  }
  logger.info("worker.scan_loop.stopped", "Scan job loop stopped");
}

async function reapLoop() {
  logger.info("worker.reaper_loop.started", "Scan job reaper loop started");
  while (!shutdownRequested) {
    try {
      const recovered = await trackOperation("scan_job_reaper_tick", () =>
        requeueExpiredScanJobs(),
      );
      for (const job of recovered) {
        logJobEvent(
          job.status === "failed" ? "abandoned-failed" : "abandoned-recovered",
          job,
          `attempts=${job.attempts}/${job.max_attempts}`,
        );
      }
      const staleQueued = await trackOperation(
        "stale_queued_job_recovery_tick",
        () =>
          recoverStaleQueuedScanJobs({
            olderThanMinutes: STALE_QUEUED_JOB_MINUTES,
          }),
      );
      for (const job of staleQueued) {
        logJobEvent("stale-queued-recovered", job);
      }
    } catch (err) {
      logger.error(
        "worker.reaper_loop.tick_failed",
        "Reaper loop tick failed",
        {},
        err,
      );
    }
    await sleep(REAPER_TICK_MS);
  }
  logger.info("worker.reaper_loop.stopped", "Scan job reaper loop stopped");
}

async function schedulerTick() {
  if (shutdownRequested) return;

  const now = new Date();
  const dueSites = await getDueSites(25);
  let enqueued = 0;
  let skipped = 0;

  for (const site of dueSites) {
    if (shutdownRequested) break;
    try {
      const result = await enqueueScheduledScanIfDue(site.id, now);
      if (result.created) {
        enqueued += 1;
        logger.info("worker.scheduler.enqueued", "Scheduled scan enqueued", {
          siteId: site.id,
          scanRunId: result.scanRunId,
          jobId: result.jobId,
          nextScheduledAt: result.nextScheduledAt?.toISOString() ?? null,
        });
        continue;
      }

      skipped += 1;
      logger.info("worker.scheduler.skipped", "Scheduled scan skipped", {
        siteId: site.id,
        reason: result.reason,
        activeScanRunId: result.active?.scanRunId ?? null,
        activeJobId: result.active?.jobId ?? null,
      });
    } catch (err) {
      skipped += 1;
      logger.error(
        "worker.scheduler.site_failed",
        "Scheduled scan decision failed for site",
        { siteId: site.id },
        err,
      );
    }
  }

  logger.info("worker.scheduler.summary", "Scheduler tick completed", {
    dueSites: dueSites.length,
    enqueued,
    skipped,
    interruptedByShutdown: shutdownRequested,
  });
}

async function runSchedulerLoop() {
  logger.info("worker.scheduler_loop.started", "Scheduler loop started");
  while (!shutdownRequested) {
    try {
      await trackOperation("scheduler_tick", () => schedulerTick());
    } catch (err) {
      logger.error(
        "worker.scheduler_loop.tick_failed",
        "Scheduler loop tick failed",
        {},
        err,
      );
    }
    await sleep(SCHEDULE_TICK_MS);
  }
  logger.info("worker.scheduler_loop.stopped", "Scheduler loop stopped");
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
      logger.warn(
        "worker.uptime_notify.failed",
        "Uptime notification request failed",
        {
          incidentId,
          kind,
          statusCode: res.status,
          responseSnippet: text.slice(0, 120),
        },
      );
    }
  } catch (err) {
    logger.error(
      "worker.uptime_notify.error",
      "Uptime notification request errored",
      { incidentId, kind },
      err,
    );
  }
}

async function uptimeTick() {
  if (shutdownRequested) return;

  const monitors = await claimDueUptimeMonitors(UPTIME_BATCH_SIZE);
  if (monitors.length === 0) {
    logger.info("worker.uptime.summary", "Uptime tick completed", {
      dueMonitors: 0,
      processed: 0,
    });
    return;
  }

  let processed = 0;
  for (const monitor of monitors) {
    if (shutdownRequested) {
      logger.info(
        "worker.uptime.interrupted",
        "Uptime tick interrupted by shutdown",
        {
          processed,
          claimed: monitors.length,
        },
      );
      break;
    }

    try {
      const result = await checkUptime(monitor.check_url);
      const recorded = await recordUptimeCheck(monitor.id, result);
      processed += 1;
      logger.info("worker.uptime.checked", "Uptime monitor checked", {
        siteId: monitor.site_id,
        monitorId: monitor.id,
        status: recorded.check.status,
        failureCount: recorded.incident?.failure_count ?? 0,
      });
      if (recorded.shouldSendDownAlert && recorded.incident) {
        await notifyUptimeIncident(recorded.incident.id, "uptime_down");
      } else if (recorded.shouldSendRecoveryAlert && recorded.incident) {
        await notifyUptimeIncident(recorded.incident.id, "uptime_recovered");
      }
    } catch (err) {
      logger.error(
        "worker.uptime.check_failed",
        "Uptime monitor check failed",
        {
          siteId: monitor.site_id,
          monitorId: monitor.id,
          checkUrl: monitor.check_url,
        },
        err,
      );
    }
  }

  logger.info("worker.uptime.summary", "Uptime tick completed", {
    dueMonitors: monitors.length,
    processed,
  });
}

async function runUptimeLoop() {
  logger.info("worker.uptime_loop.started", "Uptime loop started");
  while (!shutdownRequested) {
    try {
      await trackOperation("uptime_tick", () => uptimeTick());
    } catch (err) {
      logger.error(
        "worker.uptime_loop.tick_failed",
        "Uptime loop tick failed",
        {},
        err,
      );
    }
    await sleep(UPTIME_TICK_MS);
  }
  logger.info("worker.uptime_loop.stopped", "Uptime loop stopped");
}

async function superviseLoop(name: string, runner: () => Promise<void>) {
  while (!shutdownRequested) {
    try {
      await runner();
      if (!shutdownRequested) {
        logger.warn("worker.loop.exited", "Worker loop exited unexpectedly", {
          loop: name,
        });
      }
    } catch (err) {
      logger.error(
        "worker.loop.crashed",
        "Worker loop crashed",
        { loop: name },
        err,
      );
    }
    if (!shutdownRequested) {
      await sleep(LOOP_RESTART_DELAY_MS);
    }
  }
}

async function shutdown(signal: string) {
  if (shutdownPromise) return shutdownPromise;

  shutdownRequested = true;
  shutdownSignal = signal;
  wakeSleeps();
  logger.warn("worker.shutdown.started", "Worker shutdown requested", {
    signal,
    activeOperations: activeOperations.size,
  });

  shutdownPromise = (async () => {
    const timeout = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), SHUTDOWN_GRACE_MS);
    });
    const settled = Promise.allSettled(supervisedLoops).then(
      () => "completed" as const,
    );
    const result = await Promise.race([settled, timeout]);

    if (result === "timeout") {
      logger.error("worker.shutdown.timed_out", "Worker shutdown timed out", {
        signal: shutdownSignal,
        activeOperations: activeOperations.size,
        graceMs: SHUTDOWN_GRACE_MS,
      });
      process.exit(1);
      return;
    }

    logger.info("worker.shutdown.completed", "Worker shutdown completed", {
      signal: shutdownSignal,
      activeOperations: activeOperations.size,
    });
    process.exit(0);
  })();

  return shutdownPromise;
}

function registerSignalHandlers() {
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

async function main() {
  registerSignalHandlers();
  logger.info("worker.started", "Worker started", {
    nodeEnv: workerRuntimeConfig.nodeEnv,
    apiBaseUrl: API_BASE_URL,
  });
  supervisedLoops = [
    superviseLoop("scan", runLoop),
    superviseLoop("reaper", reapLoop),
    superviseLoop("scheduler", runSchedulerLoop),
    superviseLoop("uptime", runUptimeLoop),
  ];
  await Promise.all(supervisedLoops);
}

main().catch((err) => {
  logger.error("worker.fatal", "Worker process failed", {}, err);
  process.exit(1);
});
