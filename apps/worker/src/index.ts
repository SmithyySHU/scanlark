import dotenv from "dotenv";
import * as os from "node:os";
import {
  closeConnection,
  getOperationsEmailSmtpConfig,
  getOperationsEmailImapConfig,
  isOperationsEmailModuleEnabled,
} from "@scanlark/db";
import {
  classifyCoreLoopFailure,
  tickReaper,
  tickScanWorker,
  tickScheduler,
  tickUptime,
  type CoreLoopTickOptions,
} from "./coreLoopTicks";
import { createOperationsEmailTransport } from "./operationsEmailTransport";
import {
  closeOperationsEmailSmtpTransport,
  createOperationsEmailSmtpTickState,
  tickOperationsEmailSmtp,
} from "./operationsEmailWorker";
import {
  FINALISATION_POLL_MS,
  tickOperationsEmailCrmFinalisation,
} from "./operationsEmailFinalisation";
import { tickOperationsEmailSentCopy } from "./operationsEmailSentCopy";
import { createWorkerRuntimeFoundation } from "./workerRuntime";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const workerId = `${os.hostname()}-${process.pid}`;
const IDLE_WAIT_MS = 1200;
const SCHEDULE_TICK_MS = 60000;
const CLAIM_LEASE_SECONDS = 120;
const LEASE_HEARTBEAT_MS = 30000;
const REAPER_TICK_MS = 120000;
const STALE_QUEUED_JOB_MINUTES = 15;
const UPTIME_TICK_MS = parsePositiveIntEnv("UPTIME_TICK_MS", 60000);
const UPTIME_BATCH_SIZE = parsePositiveIntEnv("UPTIME_BATCH_SIZE", 25);
const API_BASE_URL = process.env.WORKER_API_BASE || "http://localhost:3001";
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN;
const coreRuntime = createWorkerRuntimeFoundation();
coreRuntime.registerCleanup("database", closeConnection);

function requestShutdown(signal: "SIGTERM" | "SIGINT") {
  void coreRuntime
    .shutdown(signal)
    .then((result) => {
      process.exitCode = result.exitCode;
      // The only hard exit in the worker runtime is the centrally owned grace
      // timeout. Normal shutdown has no timers or clients left and exits
      // naturally with code 0.
      if (result.state === "forced_timeout") process.exit(result.exitCode);
    })
    .catch(() => {
      // The runtime contains cleanup failures, but preserve a non-zero outcome
      // should an unexpected bootstrap-level shutdown error escape.
      process.exitCode = 1;
    });
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => requestShutdown(signal));
}

function parsePositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

const coreTickOptions: CoreLoopTickOptions = {
  workerId,
  claimLeaseSeconds: CLAIM_LEASE_SECONDS,
  leaseHeartbeatMs: LEASE_HEARTBEAT_MS,
  staleQueuedJobMinutes: STALE_QUEUED_JOB_MINUTES,
  uptimeBatchSize: UPTIME_BATCH_SIZE,
  notifyScanRun,
  log: console.log,
  warn: console.warn,
};

function startCoreLoop(
  name: "scan" | "scheduler" | "reaper" | "uptime",
  idleDelayMs: number,
  tick: (signal: AbortSignal) => ReturnType<typeof tickScanWorker>,
) {
  void coreRuntime
    .runLoop({
      name,
      idleDelayMs,
      tick: ({ signal }) => tick(signal),
      classifyFailure: classifyCoreLoopFailure,
    })
    .catch((error) => {
      console.error(
        `[${name} ${workerId}] supervisor terminated`,
        error instanceof Error ? error.name : "unknown",
      );
    });
}

startCoreLoop("scan", IDLE_WAIT_MS, (signal) =>
  tickScanWorker(coreTickOptions, signal),
);
startCoreLoop("scheduler", SCHEDULE_TICK_MS, (signal) =>
  tickScheduler(coreTickOptions, signal),
);
startCoreLoop("reaper", REAPER_TICK_MS, (signal) =>
  tickReaper(coreTickOptions, signal),
);
startCoreLoop("uptime", UPTIME_TICK_MS, (signal) =>
  tickUptime(coreTickOptions, signal),
);

const operationsEmailSmtpConfig = getOperationsEmailSmtpConfig();
const operationsEmailImapConfig = getOperationsEmailImapConfig();
const operationsEmailModuleEnabled = isOperationsEmailModuleEnabled(
  process.env,
);

function startEmailLoop(
  name: "email-smtp" | "email-crm-finalisation" | "email-sent-copy",
  idleDelayMs: number,
  tick: (signal: AbortSignal) => ReturnType<typeof tickOperationsEmailSmtp>,
) {
  void coreRuntime
    .runLoop({
      name,
      idleDelayMs,
      tick: ({ signal }) => tick(signal),
      classifyFailure: classifyCoreLoopFailure,
    })
    .catch((error) => {
      console.error(
        `[${name} ${workerId}] supervisor terminated`,
        error instanceof Error ? error.name : "unknown",
      );
    });
}

if (operationsEmailModuleEnabled) {
  const smtpTransport = operationsEmailSmtpConfig.configured
    ? createOperationsEmailTransport(operationsEmailSmtpConfig)
    : null;
  coreRuntime.registerCleanup("smtp", () =>
    closeOperationsEmailSmtpTransport(smtpTransport),
  );
  const smtpState = createOperationsEmailSmtpTickState();
  startEmailLoop(
    "email-smtp",
    operationsEmailSmtpConfig.workerPollMs,
    (signal) =>
      tickOperationsEmailSmtp({
        workerId: `operations-email-${workerId}`,
        config: operationsEmailSmtpConfig,
        transport: smtpTransport,
        state: smtpState,
        signal,
      }),
  );
  startEmailLoop("email-crm-finalisation", FINALISATION_POLL_MS, (signal) =>
    tickOperationsEmailCrmFinalisation({
      workerId: `operations-email-crm-${workerId}`,
      signal,
    }),
  );
  startEmailLoop(
    "email-sent-copy",
    operationsEmailImapConfig.workerPollMs,
    (signal) =>
      tickOperationsEmailSentCopy({
        workerId: `operations-email-imap-${workerId}`,
        config: operationsEmailImapConfig,
        signal,
      }),
  );
  console.log(`[operations-email ${workerId}] supervised Email loops started`);
} else {
  console.log(
    `[operations-email ${workerId}] Email loops inactive reason=module_disabled`,
  );
}
