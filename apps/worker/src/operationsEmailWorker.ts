import { createHash } from "node:crypto";
import {
  claimDueOperationsEmailSmtpDelivery,
  completeOperationsEmailDeliveryAttempt,
  createOperationsEmailDeliveryAttempt,
  getInternalWorkspaceByCode,
  markExpiredOperationsEmailRiskLeasesUncertain,
  markOperationsEmailTransmissionBegun,
  operationsEmailRetryDelayMs,
  recordOperationsEmailDeliveryUncertain,
  recordOperationsEmailPreTransmissionSmtpPhase,
  recordOperationsEmailSafePreSendFailure,
  recordOperationsEmailSmtpAcceptance,
  recordOperationsEmailSystemAudit,
  renewOperationsEmailSmtpLease,
  restoreOperationsEmailProvenPreTransmissionBoundary,
  SCANLARK_OPERATIONS_WORKSPACE_CODE,
  setOperationsEmailSmtpReadiness,
  type OperationsEmailSmtpConfig,
} from "@scanlark/db";
import {
  classifyOperationsEmailSmtpError,
  sendFrozenOperationsEmailMime,
  verifyOperationsEmailTransport,
  type OperationsEmailTransport,
} from "./operationsEmailTransport";
import type { WorkerTickResult } from "./workerSupervisor";

const UNCERTAIN_WARNING =
  "This message may already have been accepted by the mail provider. It will not be sent again automatically. Check the Connor mailbox and recipient outcome before preparing another communication.";

function logDeliveryEvent(input: {
  event: string;
  workerId: string;
  deliveryId: string;
  messageId: string;
  deliveryKind: string;
  attemptNumber: number;
  startedAt: number;
  smtpPhase?: string | null;
  failureClass?: string | null;
  retryPolicy?: string | null;
}) {
  console.log(
    JSON.stringify({
      scope: "operations_email_smtp",
      ...input,
      elapsedMs: Date.now() - input.startedAt,
    }),
  );
}

export async function processOneOperationsEmailDelivery(input: {
  workerId: string;
  config: OperationsEmailSmtpConfig;
  transport: Pick<OperationsEmailTransport, "sendMail">;
}) {
  const delivery = await claimDueOperationsEmailSmtpDelivery({
    workerId: input.workerId,
    leaseSeconds: input.config.workerLeaseSeconds,
  });
  if (!delivery) return false;
  const startedAt = Date.now();
  const attempt = await createOperationsEmailDeliveryAttempt({
    workspaceId: delivery.workspace_id,
    deliveryId: delivery.id,
    transportKind: "smtp",
    requestKind:
      delivery.manual_retry_count > 0 ? "actor_requested" : "automatic",
    initiatedByUserId: delivery.initiated_by_user_id,
    workerId: input.workerId,
  });
  if (!attempt) throw new Error("operations_email_attempt_not_created");
  await recordOperationsEmailSystemAudit({
    workspaceId: delivery.workspace_id,
    deliveryId: delivery.id,
    messageId: delivery.message_id,
    action: "operations.email.smtp_claimed",
    metadata: {
      deliveryKind: delivery.delivery_kind,
      attemptNumber: attempt.attempt_number,
      lifecycle: "sending",
    },
  });
  const log = (
    event: string,
    details: Pick<
      Parameters<typeof logDeliveryEvent>[0],
      "smtpPhase" | "failureClass" | "retryPolicy"
    > = {},
  ) =>
    logDeliveryEvent({
      event,
      workerId: input.workerId,
      deliveryId: delivery.id,
      messageId: delivery.message_id,
      deliveryKind: delivery.delivery_kind,
      attemptNumber: attempt.attempt_number,
      startedAt,
      ...details,
    });
  log("claimed", { smtpPhase: "not_started" });
  const heartbeat = setInterval(
    () => {
      void renewOperationsEmailSmtpLease({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        leaseSeconds: input.config.workerLeaseSeconds,
      }).catch(() => undefined);
    },
    Math.max(5000, Math.floor((input.config.workerLeaseSeconds * 1000) / 3)),
  );

  try {
    if (!delivery.raw_mime_bytes || delivery.raw_mime_storage_key) {
      const safeDisplayError =
        "The frozen Email content is unavailable and requires manual investigation.";
      await recordOperationsEmailSafePreSendFailure({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        failure: {
          smtpPhase: "not_started",
          failureClass: "content",
          retryPolicy: "manual",
          safeDisplayError,
          redactedInternalError: "frozen_mime_bytes_unavailable",
        },
      });
      await completeOperationsEmailDeliveryAttempt({
        workspaceId: delivery.workspace_id,
        attemptId: attempt.id,
        outcome: "failed",
        smtpPhase: "not_started",
        failureClass: "content",
        retryPolicy: "manual",
        safeDisplayError,
      });
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.smtp_content_failure",
        metadata: {
          deliveryKind: delivery.delivery_kind,
          attemptNumber: attempt.attempt_number,
          failureClass: "content",
          retryPolicy: "manual",
        },
      });
      log("failed", {
        smtpPhase: "not_started",
        failureClass: "content",
        retryPolicy: "manual",
      });
      return true;
    }
    const actualHash = createHash("sha256")
      .update(delivery.raw_mime_bytes)
      .digest("hex");
    if (actualHash !== delivery.mime_sha256) {
      const safeDisplayError =
        "The frozen Email hash no longer matches. Nothing was sent; manual investigation is required.";
      await recordOperationsEmailSafePreSendFailure({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        failure: {
          smtpPhase: "not_started",
          failureClass: "content",
          retryPolicy: "manual",
          safeDisplayError,
          redactedInternalError: "frozen_mime_hash_mismatch",
        },
      });
      await completeOperationsEmailDeliveryAttempt({
        workspaceId: delivery.workspace_id,
        attemptId: attempt.id,
        outcome: "failed",
        smtpPhase: "not_started",
        failureClass: "content",
        retryPolicy: "manual",
        safeDisplayError,
      });
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.smtp_content_failure",
        metadata: {
          deliveryKind: delivery.delivery_kind,
          attemptNumber: attempt.attempt_number,
          failureClass: "content",
          retryPolicy: "manual",
        },
      });
      log("failed", {
        smtpPhase: "not_started",
        failureClass: "content",
        retryPolicy: "manual",
      });
      return true;
    }

    const connected = await recordOperationsEmailPreTransmissionSmtpPhase({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      workerId: input.workerId,
      smtpPhase: "connect",
    });
    if (!connected) throw new Error("operations_email_smtp_lease_lost");
    const enveloped = await recordOperationsEmailPreTransmissionSmtpPhase({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      workerId: input.workerId,
      smtpPhase: "envelope",
    });
    if (!enveloped) throw new Error("operations_email_smtp_lease_lost");
    const transmissionMarked = await markOperationsEmailTransmissionBegun({
      workspaceId: delivery.workspace_id,
      deliveryId: delivery.id,
      workerId: input.workerId,
    });
    if (!transmissionMarked)
      throw new Error("operations_email_transmission_marker_failed");

    try {
      const result = await sendFrozenOperationsEmailMime(input.transport, {
        rawMime: delivery.raw_mime_bytes,
        envelopeSender: delivery.envelope_sender!,
        envelopeRecipient: delivery.envelope_recipient!,
      });
      if (!result.accepted) {
        if (result.rejectedRecipients.length === 0) {
          throw {
            code: "EACCEPTANCEUNKNOWN",
            command: "DATA",
          };
        }
        await restoreOperationsEmailProvenPreTransmissionBoundary({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          workerId: input.workerId,
          smtpPhase: "envelope",
        });
        const safeDisplayError =
          "The mail provider did not accept the intended recipient. Review the address before retrying.";
        await recordOperationsEmailSafePreSendFailure({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          workerId: input.workerId,
          failure: {
            smtpPhase: "envelope",
            failureClass: "permanent",
            retryPolicy: "manual",
            safeDisplayError,
            redactedInternalError:
              "resolved_without_intended_recipient_acceptance",
          },
        });
        await completeOperationsEmailDeliveryAttempt({
          workspaceId: delivery.workspace_id,
          attemptId: attempt.id,
          outcome: "failed",
          smtpPhase: "envelope",
          failureClass: "permanent",
          retryPolicy: "manual",
          safeDisplayError,
        });
        await recordOperationsEmailSystemAudit({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          messageId: delivery.message_id,
          action: "operations.email.smtp_permanent_failure",
          metadata: {
            deliveryKind: delivery.delivery_kind,
            attemptNumber: attempt.attempt_number,
            smtpPhase: "envelope",
            failureClass: "permanent",
            retryPolicy: "manual",
          },
        });
        log("failed", {
          smtpPhase: "envelope",
          failureClass: "permanent",
          retryPolicy: "manual",
        });
        return true;
      }
      await recordOperationsEmailSmtpAcceptance({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        acceptedRecipients: result.acceptedRecipients,
        rejectedRecipients: result.rejectedRecipients,
        providerResponseId: result.providerResponseId,
      });
      await completeOperationsEmailDeliveryAttempt({
        workspaceId: delivery.workspace_id,
        attemptId: attempt.id,
        outcome: "succeeded",
        smtpPhase: "accepted",
        retryPolicy: "never",
        transmissionMayHaveBegun: true,
      });
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.smtp_accepted",
        metadata: {
          deliveryKind: delivery.delivery_kind,
          attemptNumber: attempt.attempt_number,
          smtpPhase: "accepted",
          lifecycle: "sent",
        },
      });
      log("accepted", { smtpPhase: "accepted", retryPolicy: "never" });
      return true;
    } catch (error) {
      const classification = classifyOperationsEmailSmtpError(error, {
        automaticAttemptCount: delivery.automatic_attempt_count,
        maxAutomaticAttempts: input.config.maxAutomaticAttempts,
      });
      if (!classification.transmissionMayHaveBegun) {
        await restoreOperationsEmailProvenPreTransmissionBoundary({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          workerId: input.workerId,
          smtpPhase: classification.smtpPhase as "connect" | "envelope",
        });
        const nextAttemptAt =
          classification.retryPolicy === "automatic"
            ? new Date(
                Date.now() +
                  operationsEmailRetryDelayMs(
                    delivery.automatic_attempt_count,
                    input.config,
                  ),
              )
            : null;
        await recordOperationsEmailSafePreSendFailure({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          workerId: input.workerId,
          failure: {
            ...classification,
            failureClass: classification.failureClass as Exclude<
              typeof classification.failureClass,
              "uncertain"
            >,
            nextAttemptAt,
            redactedInternalError: `smtp_${classification.sanitizedProviderCode ?? "error"}_${classification.sanitizedCommand ?? "unknown"}`,
          },
        });
        await completeOperationsEmailDeliveryAttempt({
          workspaceId: delivery.workspace_id,
          attemptId: attempt.id,
          outcome: "failed",
          ...classification,
          redactedInternalDiagnostic: "smtp_pre_transmission_failure",
        });
        await recordOperationsEmailSystemAudit({
          workspaceId: delivery.workspace_id,
          deliveryId: delivery.id,
          messageId: delivery.message_id,
          action:
            classification.retryPolicy === "automatic"
              ? "operations.email.smtp_retry_scheduled"
              : "operations.email.smtp_permanent_failure",
          metadata: {
            deliveryKind: delivery.delivery_kind,
            attemptNumber: attempt.attempt_number,
            smtpPhase: classification.smtpPhase,
            failureClass: classification.failureClass,
            retryPolicy: classification.retryPolicy,
            responseCode: classification.responseCode,
          },
        });
        log(
          classification.retryPolicy === "automatic"
            ? "retry_scheduled"
            : "failed",
          {
            smtpPhase: classification.smtpPhase,
            failureClass: classification.failureClass,
            retryPolicy: classification.retryPolicy,
          },
        );
        return true;
      }
      await recordOperationsEmailDeliveryUncertain({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        workerId: input.workerId,
        smtpPhase: classification.smtpPhase,
        safeDisplayError: UNCERTAIN_WARNING,
        redactedInternalError: `smtp_uncertain_${classification.sanitizedProviderCode ?? "error"}_${classification.sanitizedCommand ?? "unknown"}`,
      });
      await completeOperationsEmailDeliveryAttempt({
        workspaceId: delivery.workspace_id,
        attemptId: attempt.id,
        outcome: "delivery_uncertain",
        ...classification,
        safeDisplayError: UNCERTAIN_WARNING,
        redactedInternalDiagnostic: "smtp_outcome_uncertain",
      });
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.delivery_uncertain",
        metadata: {
          deliveryKind: delivery.delivery_kind,
          attemptNumber: attempt.attempt_number,
          smtpPhase: classification.smtpPhase,
          failureClass: "uncertain",
          retryPolicy: "never",
          responseCode: classification.responseCode,
        },
      });
      log("delivery_uncertain", {
        smtpPhase: classification.smtpPhase,
        failureClass: "uncertain",
        retryPolicy: "never",
      });
      return true;
    }
  } finally {
    clearInterval(heartbeat);
  }
}

export type OperationsEmailSmtpTickState = {
  workspaceId: string | null;
  lastReadinessCheck: number;
  lastRiskRecovery: number;
  smtpUsable: boolean;
};

export function createOperationsEmailSmtpTickState(): OperationsEmailSmtpTickState {
  return {
    workspaceId: null,
    lastReadinessCheck: 0,
    lastRiskRecovery: 0,
    smtpUsable: false,
  };
}

export async function tickOperationsEmailSmtp(input: {
  workerId: string;
  config: OperationsEmailSmtpConfig;
  transport: OperationsEmailTransport | null;
  state: OperationsEmailSmtpTickState;
  signal?: AbortSignal;
}): Promise<WorkerTickResult> {
  if (input.signal?.aborted) return { kind: "idle" };
  const transport = input.transport;
  if (!input.config.configured || !transport)
    return { kind: "disabled", safeReason: "smtp_configuration_unavailable" };
  if (!input.state.workspaceId) {
    const workspace = await getInternalWorkspaceByCode(
      SCANLARK_OPERATIONS_WORKSPACE_CODE,
    );
    if (!workspace)
      return {
        kind: "disabled",
        safeReason: "operations_workspace_unavailable",
      };
    input.state.workspaceId = workspace.id;
  }
  const workspaceId = input.state.workspaceId;
  const checkReadiness = async () => {
    const result = await verifyOperationsEmailTransport(transport);
    await setOperationsEmailSmtpReadiness({
      workspaceId,
      status: result.status,
      workerId: input.workerId,
      safeErrorCode: result.safeErrorCode,
    });
    await recordOperationsEmailSystemAudit({
      workspaceId,
      action: "operations.email.smtp_readiness_checked",
      metadata: { status: result.status },
    });
    input.state.lastReadinessCheck = Date.now();
    input.state.smtpUsable = result.status === "verified";
  };
  const recoverRiskLeases = async () => {
    const recovered = await markExpiredOperationsEmailRiskLeasesUncertain({
      safeDisplayError: UNCERTAIN_WARNING,
    });
    for (const delivery of recovered) {
      await recordOperationsEmailSystemAudit({
        workspaceId: delivery.workspace_id,
        deliveryId: delivery.id,
        messageId: delivery.message_id,
        action: "operations.email.delivery_uncertain",
        metadata: {
          reason: "expired_transmission_risk_lease",
          smtpPhase: delivery.smtp_phase,
          retryPolicy: "never",
        },
      });
    }
    input.state.lastRiskRecovery = Date.now();
  };
  if (input.state.lastReadinessCheck === 0) {
    await checkReadiness();
  } else if (
    Date.now() - input.state.lastReadinessCheck >=
    input.config.readinessIntervalMs
  ) {
    await checkReadiness();
  }
  if (input.state.lastRiskRecovery === 0) {
    await recoverRiskLeases();
  } else if (
    Date.now() - input.state.lastRiskRecovery >=
    Math.min(input.config.workerLeaseSeconds * 1000, 30_000)
  ) {
    await recoverRiskLeases();
  }
  if (!input.state.smtpUsable) return { kind: "idle" };
  const didWork = await processOneOperationsEmailDelivery({
    workerId: input.workerId,
    config: input.config,
    transport,
  });
  return didWork ? { kind: "worked" } : { kind: "idle" };
}

export function closeOperationsEmailSmtpTransport(
  transport: Pick<OperationsEmailTransport, "close"> | null,
) {
  transport?.close();
}

/** @deprecated C3 production startup uses tickOperationsEmailSmtp. */
export async function runOperationsEmailSmtpWorker(input: {
  workerId: string;
  config: OperationsEmailSmtpConfig;
  transport: OperationsEmailTransport;
  signal: AbortSignal;
}) {
  return tickOperationsEmailSmtp({
    ...input,
    state: createOperationsEmailSmtpTickState(),
  });
}
