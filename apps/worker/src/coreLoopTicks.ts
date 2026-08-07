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
  recordUptimeCheck,
  recoverStaleQueuedScanJobs,
  requeueExpiredScanJobs,
  setScanJobRunId,
  setScanRunStatus,
  type ScanJobRow,
  type UptimeCheckInput,
  type UptimeSettingsRow,
} from "@scanlark/db";
import { checkUptime } from "../../../packages/crawler/src/checkUptime";
import { runScanForSite } from "../../../packages/crawler/src/scanService";
import type { WorkerFailureClass } from "./workerHealth";
import type { WorkerTickResult } from "./workerSupervisor";

export type CoreLoopTickOptions = {
  workerId: string;
  claimLeaseSeconds: number;
  leaseHeartbeatMs: number;
  staleQueuedJobMinutes: number;
  uptimeBatchSize: number;
  notifyScanRun(scanRunId: string): Promise<void>;
  log(message: string): void;
  warn(message: string, error?: unknown): void;
  /** Test-only seam. Production callers omit this and always use the crawler. */
  runScan?: typeof runScanForSite;
};

export function classifyCoreLoopFailure(error: unknown): {
  failureClass: WorkerFailureClass;
  safeErrorCode: string;
} {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "").toLowerCase()
      : "";
  if (
    /^(econnrefused|econnreset|etimedout|57p01|57p02|57p03|0800[0-7])$/.test(
      code,
    )
  ) {
    return {
      failureClass: "transient_infrastructure",
      safeErrorCode: "database_unavailable",
    };
  }
  return { failureClass: "unknown", safeErrorCode: "core_tick_failure" };
}

function logJobEvent(
  options: CoreLoopTickOptions,
  event: string,
  job: Pick<ScanJobRow, "id" | "site_id" | "scan_run_id">,
  details?: string,
) {
  const suffix = details ? ` ${details}` : "";
  options.log(
    `[worker ${options.workerId}] ${event} job=${job.id} site=${job.site_id} run=${job.scan_run_id ?? "none"}${suffix}`,
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function buildFailedUptimeCheck(
  monitor: UptimeSettingsRow,
  error: unknown,
): UptimeCheckInput {
  return {
    checkedUrl: monitor.check_url,
    status: "down",
    statusCode: null,
    responseTimeMs: null,
    redirectCount: 0,
    errorCode: "worker_exception",
    errorMessage: getErrorMessage(error, "uptime_check_failed").slice(0, 500),
  };
}

/** One claimed scan at most; scan-job retries remain owned by the existing DB model. */
export async function tickScanWorker(
  options: CoreLoopTickOptions,
  signal: AbortSignal,
): Promise<WorkerTickResult> {
  if (signal.aborted) return { kind: "idle" };
  const job = await claimNextScanJob({
    workerId: options.workerId,
    leaseSeconds: options.claimLeaseSeconds,
  });
  if (!job) return { kind: "idle" };

  logJobEvent(
    options,
    "claimed",
    job,
    `attempts=${job.attempts}/${job.max_attempts}`,
  );
  let scanRunId = job.scan_run_id;
  let run = scanRunId ? await getScanRunById(scanRunId) : null;
  if (!run) {
    const site = await getSiteById(job.site_id);
    if (!site) {
      const failed = await failScanJob(job.id, "site_not_found");
      if (failed)
        logJobEvent(options, "failed", failed, "error=site_not_found");
      return { kind: "worked" };
    }
    scanRunId = await createScanRun(site.id, site.url, {
      triggerType: "scheduled",
    });
    await setScanJobRunId(job.id, scanRunId);
    run = await getScanRunById(scanRunId);
  }
  if (!run) {
    const failed = await failScanJob(job.id, "scan_run_not_found");
    if (failed)
      logJobEvent(options, "failed", failed, "error=scan_run_not_found");
    return { kind: "worked" };
  }

  await setScanRunStatus(run.id, "in_progress", {
    errorMessage: null,
    clearFinishedAt: true,
  });
  logJobEvent(options, "started", { ...job, scan_run_id: run.id });
  const leaseHeartbeat = setInterval(() => {
    void extendScanJobLease(job.id, {
      leaseSeconds: options.claimLeaseSeconds,
    }).catch((error) =>
      options.warn(
        `[worker ${options.workerId}] lease heartbeat failed job=${job.id}`,
        error,
      ),
    );
  }, options.leaseHeartbeatMs);

  try {
    await (options.runScan ?? runScanForSite)(
      run.site_id,
      run.start_url,
      run.id,
    );
    const updatedRun = await getScanRunById(run.id);
    if (updatedRun?.status === "cancelled") {
      await cancelScanJob(job.id);
      logJobEvent(options, "cancelled", { ...job, scan_run_id: run.id });
      return { kind: "worked" };
    }
    if (updatedRun?.status === "failed") {
      const errorMessage = updatedRun.error_message ?? "scan_failed";
      const exhausted = job.attempts >= job.max_attempts;
      const failed = await failScanJob(job.id, errorMessage);
      if (failed)
        logJobEvent(
          options,
          exhausted ? "failed" : "requeued",
          { ...failed, scan_run_id: run.id },
          `error=${errorMessage}`,
        );
      if (exhausted) {
        await setScanRunStatus(run.id, "failed", {
          errorMessage,
          setFinishedAt: true,
        });
        await options.notifyScanRun(run.id);
      } else {
        await setScanRunStatus(run.id, "queued", {
          errorMessage,
          clearFinishedAt: true,
        });
      }
      return { kind: "worked" };
    }
    const completed = await completeScanJob(job.id);
    if (completed)
      logJobEvent(options, "completed", { ...completed, scan_run_id: run.id });
    await options.notifyScanRun(run.id);
    return { kind: "worked" };
  } catch (error) {
    // Preserve the existing job-level failure/requeue path for scan-specific failures.
    const errorMessage = getErrorMessage(error, "scan_failed_unexpected");
    const exhausted = job.attempts >= job.max_attempts;
    const failed = await failScanJob(job.id, errorMessage);
    if (failed)
      logJobEvent(
        options,
        exhausted ? "failed" : "requeued",
        { ...failed, scan_run_id: run.id },
        `error=${errorMessage}`,
      );
    if (exhausted) {
      await setScanRunStatus(run.id, "failed", {
        errorMessage,
        setFinishedAt: true,
      });
      await options.notifyScanRun(run.id);
    } else {
      await setScanRunStatus(run.id, "queued", {
        errorMessage,
        clearFinishedAt: true,
      });
    }
    return { kind: "worked" };
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

export async function tickScheduler(
  options: CoreLoopTickOptions,
  signal?: AbortSignal,
): Promise<WorkerTickResult> {
  if (signal?.aborted) return { kind: "idle" };
  const now = new Date();
  const dueSites = await getDueSites(25);
  let enqueued = 0;
  let skipped = 0;
  for (const site of dueSites) {
    if (signal?.aborted) break;
    const result = await enqueueScheduledScanIfDue(site.id, now);
    if (result.created) {
      enqueued += 1;
      options.log(
        `[scheduler] enqueued site=${site.id} run=${result.scanRunId} next=${result.nextScheduledAt?.toISOString() ?? "none"}`,
      );
    } else {
      skipped += 1;
      options.log(
        `[scheduler] skipped site=${site.id} reason=${result.reason}${result.active?.scanRunId ? ` activeRun=${result.active.scanRunId}` : ""}${result.active?.jobId ? ` activeJob=${result.active.jobId}` : ""}`,
      );
    }
  }
  options.log(
    `[scheduler] due=${dueSites.length} enqueued=${enqueued} skipped=${skipped}`,
  );
  return dueSites.length > 0 ? { kind: "worked" } : { kind: "idle" };
}

export async function tickReaper(
  options: CoreLoopTickOptions,
  signal?: AbortSignal,
): Promise<WorkerTickResult> {
  if (signal?.aborted) return { kind: "idle" };
  const recovered = await requeueExpiredScanJobs();
  for (const job of recovered)
    logJobEvent(
      options,
      "abandoned-recovered",
      job,
      `attempts=${job.attempts}/${job.max_attempts}`,
    );
  if (signal?.aborted)
    return recovered.length ? { kind: "worked" } : { kind: "idle" };
  const staleQueued = await recoverStaleQueuedScanJobs({
    olderThanMinutes: options.staleQueuedJobMinutes,
  });
  for (const job of staleQueued)
    logJobEvent(options, "stale-queued-recovered", job);
  return recovered.length || staleQueued.length
    ? { kind: "worked" }
    : { kind: "idle" };
}

async function processUptimeMonitor(
  options: CoreLoopTickOptions,
  monitor: UptimeSettingsRow,
) {
  options.log(
    `[uptime ${options.workerId}] checking settings=${monitor.id} site=${monitor.site_id} url=${monitor.check_url}`,
  );
  try {
    const result = await checkUptime(monitor.check_url);
    const recorded = await recordUptimeCheck(monitor.id, result);
    options.log(
      `[uptime ${options.workerId}] recorded settings=${monitor.id} site=${monitor.site_id} check=${recorded.check.id} status=${recorded.check.status} statusCode=${recorded.check.status_code ?? "none"} responseMs=${recorded.check.response_time_ms ?? "none"} next=${monitor.next_check_at?.toISOString() ?? "none"}`,
    );
  } catch (checkError) {
    // A target failure is monitoring data, not a worker-loop failure. A failure
    // to persist that data deliberately escapes to the supervisor.
    options.warn(
      `[uptime ${options.workerId}] target check failed settings=${monitor.id} site=${monitor.site_id}`,
    );
    const recorded = await recordUptimeCheck(
      monitor.id,
      buildFailedUptimeCheck(monitor, checkError),
    );
    options.log(
      `[uptime ${options.workerId}] recorded failure settings=${monitor.id} site=${monitor.site_id} check=${recorded.check.id}`,
    );
  }
}

export async function tickUptime(
  options: CoreLoopTickOptions,
  signal?: AbortSignal,
): Promise<WorkerTickResult> {
  if (signal?.aborted) return { kind: "idle" };
  const monitors = await claimDueUptimeMonitors(options.uptimeBatchSize);
  options.log(`[uptime ${options.workerId}] due=${monitors.length}`);
  for (const monitor of monitors) {
    if (signal?.aborted) break;
    await processUptimeMonitor(options, monitor);
  }
  return monitors.length ? { kind: "worked" } : { kind: "idle" };
}
