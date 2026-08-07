import { createHash } from "node:crypto";
import {
  ImapFlow,
  type AppendResponseObject,
  type ListResponse,
} from "imapflow";
import {
  claimPendingOperationsEmailSentCopy,
  completeOperationsEmailDeliveryAttempt,
  createOperationsEmailDeliveryAttempt,
  markOperationsEmailSentCopyAppended,
  markOperationsEmailSentCopyFailed,
  operationsEmailSentCopyRetryDelayMs,
  recordOperationsEmailSystemAudit,
  renewOperationsEmailSentCopyLease,
  setOperationsEmailImapReadiness,
  type OperationsEmailImapConfig,
} from "@scanlark/db";
import type { WorkerTickResult } from "./workerSupervisor";

export type OperationsEmailImapClient = {
  connect(): Promise<void>;
  list(): Promise<ListResponse[]>;
  mailboxOpen(path: string): Promise<unknown>;
  search(
    query: { header: Record<string, string> },
    options: { uid: true },
  ): Promise<number[] | false>;
  append(
    path: string,
    content: Buffer,
    flags: string[],
    date: Date,
  ): Promise<AppendResponseObject | false>;
  logout(): Promise<void>;
  close(): void;
};

type ImapClientFactory = (
  config: OperationsEmailImapConfig,
) => OperationsEmailImapClient;

const MESSAGE_ID_RE = /^<[^<>\s]+@[^<>\s]+>$/;
let mailboxCache: { key: string; path: string; expiresAt: number } | null =
  null;

export function createOperationsEmailImapClient(
  config: OperationsEmailImapConfig,
) {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.securityMode === "tls",
    doSTARTTLS: config.securityMode === "starttls",
    auth: { user: config.username, pass: config.password },
    connectionTimeout: config.connectionTimeoutMs,
    socketTimeout: config.socketTimeoutMs,
    disableAutoIdle: true,
    logger: false,
  });
}

export function resolveOperationsEmailSentMailbox(
  mailboxes: Array<Pick<ListResponse, "path" | "specialUse">>,
  configuredMailbox: string | null,
) {
  if (configuredMailbox) {
    const exact = mailboxes.find(
      (mailbox) => mailbox.path === configuredMailbox,
    );
    if (!exact) throw new Error("configured_sent_mailbox_not_found");
    return exact.path;
  }
  const sent = mailboxes.filter((mailbox) => mailbox.specialUse === "\\Sent");
  if (sent.length === 0) throw new Error("sent_mailbox_not_discovered");
  if (sent.length > 1) throw new Error("sent_mailbox_ambiguous");
  return sent[0].path;
}

export async function appendExactOperationsEmailSentCopy(input: {
  client: OperationsEmailImapClient;
  mailbox: string;
  rawMimeBytes: Buffer;
  mimeSha256: string;
  fixedMessageId: string;
  dateHeader: Date;
  onAppendStart?: () => Promise<void>;
}) {
  if (!MESSAGE_ID_RE.test(input.fixedMessageId))
    throw new Error("fixed_message_id_invalid");
  const actualHash = createHash("sha256")
    .update(input.rawMimeBytes)
    .digest("hex");
  if (actualHash !== input.mimeSha256)
    throw new Error("frozen_mime_hash_mismatch");
  await input.client.mailboxOpen(input.mailbox);
  const existing = await input.client.search(
    { header: { "Message-ID": input.fixedMessageId } },
    { uid: true },
  );
  if (existing && existing.length)
    return { uid: existing[existing.length - 1], alreadyPresent: true };

  await input.onAppendStart?.();
  const appended = await input.client.append(
    input.mailbox,
    input.rawMimeBytes,
    ["\\Seen"],
    input.dateHeader,
  );
  let uid = appended && appended.uid ? appended.uid : null;
  if (uid == null) {
    const afterAppend = await input.client.search(
      { header: { "Message-ID": input.fixedMessageId } },
      { uid: true },
    );
    uid =
      afterAppend && afterAppend.length
        ? afterAppend[afterAppend.length - 1]
        : null;
  }
  if (uid == null) throw new Error("imap_append_uid_unconfirmed");
  return { uid, alreadyPresent: false };
}

function isManualFailure(error: unknown) {
  const value =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /auth|credential|configured_sent_mailbox|sent_mailbox_not|sent_mailbox_ambiguous|hash|message_id|date_header|mime|permanent|permission|quota|overquota|append.*reject/i.test(
    value,
  );
}

function safeError(error: unknown, retry: boolean) {
  if (retry)
    return "Saving the sent copy to IONOS is delayed and will be retried. The recipient email was already accepted.";
  if (error instanceof Error && error.message.includes("mailbox"))
    return "The IONOS Sent folder could not be identified. Correct the configuration, then retry saving the sent copy.";
  return "The email was sent, but its IONOS Sent-folder copy requires manual investigation.";
}

export async function processOneOperationsEmailSentCopy(input: {
  workerId: string;
  config: OperationsEmailImapConfig;
  createClient?: ImapClientFactory;
}) {
  const delivery = await claimPendingOperationsEmailSentCopy({
    workerId: input.workerId,
    leaseSeconds: input.config.workerLeaseSeconds,
  });
  if (!delivery) return false;
  const startedAt = Date.now();
  const attempt = await createOperationsEmailDeliveryAttempt({
    workspaceId: delivery.workspace_id,
    deliveryId: delivery.id,
    transportKind: "imap_append",
    requestKind:
      delivery.sent_copy_attempt_count > 1 ? "actor_requested" : "automatic",
    initiatedByUserId: delivery.initiated_by_user_id,
    workerId: input.workerId,
  });
  if (!attempt) throw new Error("imap_append_attempt_not_created");
  const heartbeat = setInterval(
    () => {
      void renewOperationsEmailSentCopyLease({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        leaseSeconds: input.config.workerLeaseSeconds,
      }).catch(() => undefined);
    },
    Math.max(5_000, Math.floor((input.config.workerLeaseSeconds * 1_000) / 3)),
  );

  let client: OperationsEmailImapClient | null = null;
  try {
    if (!delivery.raw_mime_bytes || delivery.raw_mime_storage_key)
      throw new Error("frozen_mime_unavailable");
    if (
      !delivery.fixed_message_id ||
      !MESSAGE_ID_RE.test(delivery.fixed_message_id)
    )
      throw new Error("fixed_message_id_invalid");
    if (!delivery.date_header) throw new Error("date_header_missing");
    const hash = createHash("sha256")
      .update(delivery.raw_mime_bytes)
      .digest("hex");
    if (!delivery.mime_sha256 || hash !== delivery.mime_sha256)
      throw new Error("frozen_mime_hash_mismatch");

    client = (input.createClient ?? createOperationsEmailImapClient)(
      input.config,
    );
    await client.connect();
    const cacheKey = `${input.config.host}:${input.config.port}:${input.config.username}:${input.config.sentMailbox ?? "auto"}`;
    let mailbox: string;
    const cacheHit =
      mailboxCache?.key === cacheKey && mailboxCache.expiresAt > Date.now();
    if (cacheHit && mailboxCache) {
      mailbox = mailboxCache.path;
    } else {
      mailbox = resolveOperationsEmailSentMailbox(
        await client.list(),
        input.config.sentMailbox,
      );
      mailboxCache = {
        key: cacheKey,
        path: mailbox,
        expiresAt: Date.now() + input.config.mailboxCacheMs,
      };
    }
    await recordOperationsEmailSystemAudit({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      messageId: delivery.message_id,
      action: "operations.email.sent_folder_discovered",
      metadata: { attemptNumber: attempt.attempt_number, cached: cacheHit },
    });
    const appendResult = await appendExactOperationsEmailSentCopy({
      client,
      mailbox,
      rawMimeBytes: delivery.raw_mime_bytes,
      mimeSha256: delivery.mime_sha256,
      fixedMessageId: delivery.fixed_message_id,
      dateHeader: delivery.date_header,
      onAppendStart: async () => {
        await recordOperationsEmailSystemAudit({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          messageId: delivery.message_id,
          action: "operations.email.sent_append_started",
          metadata: {
            attemptNumber: attempt.attempt_number,
            exactFrozenMime: true,
          },
        });
      },
    });
    await markOperationsEmailSentCopyAppended({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      workerId: input.workerId,
      mailbox,
      appendedUid: appendResult.uid,
    });
    await completeOperationsEmailDeliveryAttempt({
      workspaceId: delivery.workspace_id,
      attemptId: attempt.id,
      outcome: "succeeded",
      retryPolicy: "never",
    });
    await setOperationsEmailImapReadiness({
      workspaceId: delivery.workspace_id,
      status: "available",
      workerId: input.workerId,
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      messageId: delivery.message_id,
      action: appendResult.alreadyPresent
        ? "operations.email.sent_copy_reused"
        : "operations.email.sent_copy_appended",
      metadata: {
        attemptNumber: attempt.attempt_number,
        exactFrozenMime: true,
      },
    });
    if (appendResult.alreadyPresent) {
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.sent_message_id_found",
        metadata: { attemptNumber: attempt.attempt_number },
      });
    }
    if (!appendResult.alreadyPresent) {
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.sent_append_succeeded",
        metadata: { attemptNumber: attempt.attempt_number },
      });
    }
    console.log(
      JSON.stringify({
        scope: "operations_email_sent_copy",
        event: appendResult.alreadyPresent ? "existing_confirmed" : "appended",
        workerId: input.workerId,
        messageId: delivery.message_id,
        deliveryId: delivery.id,
        sentCopyState: "appended",
        attemptCount: delivery.sent_copy_attempt_count,
        elapsedMs: Date.now() - startedAt,
      }),
    );
  } catch (error) {
    mailboxCache = null;
    const manual = isManualFailure(error);
    const retry =
      !manual && delivery.sent_copy_attempt_count < input.config.maxAttempts;
    const displayError = safeError(error, retry);
    await markOperationsEmailSentCopyFailed({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      workerId: input.workerId,
      safeDisplayError: displayError,
      nextAttemptAt: retry
        ? new Date(
            Date.now() +
              operationsEmailSentCopyRetryDelayMs(
                delivery.sent_copy_attempt_count,
                input.config,
              ),
          )
        : null,
    });
    await completeOperationsEmailDeliveryAttempt({
      workspaceId: delivery.workspace_id,
      attemptId: attempt.id,
      outcome: "failed",
      failureClass: manual ? "configuration" : "transient_pre_acceptance",
      retryPolicy: retry ? "automatic" : "manual",
      safeDisplayError: displayError,
      redactedInternalDiagnostic:
        error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    await setOperationsEmailImapReadiness({
      workspaceId: delivery.workspace_id,
      status: "unavailable",
      workerId: input.workerId,
      safeErrorCode: manual
        ? "configuration_required"
        : "connection_unavailable",
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      messageId: delivery.message_id,
      action: "operations.email.sent_copy_failed",
      metadata: {
        attemptNumber: attempt.attempt_number,
        retryScheduled: retry,
      },
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      messageId: delivery.message_id,
      action:
        error instanceof Error && error.message.includes("mailbox")
          ? "operations.email.sent_folder_discovery_failed"
          : "operations.email.sent_append_failed",
      metadata: {
        attemptNumber: attempt.attempt_number,
        failureClass: manual ? "manual_correction" : "transient",
      },
    });
    if (retry) {
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.sent_copy_automatic_retry_scheduled",
        metadata: { attemptNumber: attempt.attempt_number },
      });
    }
    console.warn(
      JSON.stringify({
        scope: "operations_email_sent_copy",
        event: "failed",
        workerId: input.workerId,
        messageId: delivery.message_id,
        deliveryId: delivery.id,
        sentCopyState: "failed",
        attemptCount: delivery.sent_copy_attempt_count,
        failureClass: manual ? "manual_correction" : "transient",
        retryScheduled: retry,
        elapsedMs: Date.now() - startedAt,
      }),
    );
  } finally {
    clearInterval(heartbeat);
    if (client) {
      try {
        await client.logout();
      } catch {
        client.close();
      }
    }
  }
  return true;
}

export async function tickOperationsEmailSentCopy(input: {
  workerId: string;
  config: OperationsEmailImapConfig;
  signal?: AbortSignal;
}): Promise<WorkerTickResult> {
  if (input.signal?.aborted) return { kind: "idle" };
  if (!input.config.configured)
    return { kind: "disabled", safeReason: "imap_configuration_unavailable" };
  const processed = await processOneOperationsEmailSentCopy(input);
  return processed ? { kind: "worked" } : { kind: "idle" };
}

/** @deprecated C3 production startup uses tickOperationsEmailSentCopy. */
export async function runOperationsEmailSentCopyWorker(input: {
  workerId: string;
  config: OperationsEmailImapConfig;
  signal: AbortSignal;
}) {
  return tickOperationsEmailSentCopy(input);
}
