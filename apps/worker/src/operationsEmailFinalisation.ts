import {
  claimDueOperationsEmailCrmFinalisation,
  finaliseClaimedOperationsEmailCrm,
  markOperationsEmailCrmFinalisationFailed,
  recordOperationsEmailSystemAudit,
} from "@scanlark/db";

const FINALISATION_POLL_MS = 2_000;
const FINALISATION_LEASE_SECONDS = 60;
const FINALISATION_MAX_ATTEMPTS = 5;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function processOneOperationsEmailCrmFinalisation(input: {
  workerId: string;
}) {
  const claim = await claimDueOperationsEmailCrmFinalisation({
    workerId: input.workerId,
    leaseSeconds: FINALISATION_LEASE_SECONDS,
  });
  if (!claim) return false;
  const startedAt = Date.now();

  await recordOperationsEmailSystemAudit({
    workspaceId: claim.workspace_id,
    deliveryId: claim.delivery_id,
    messageId: claim.message_id,
    action: "operations.email.crm_finalisation_claimed",
    metadata: { attemptNumber: claim.attempt_count },
  });

  try {
    const finalised = await finaliseClaimedOperationsEmailCrm({
      workspaceId: claim.workspace_id,
      finalisationId: claim.id,
      workerId: input.workerId,
    });
    if (!finalised) throw new Error("crm_finalisation_eligibility_changed");
    await recordOperationsEmailSystemAudit({
      workspaceId: claim.workspace_id,
      deliveryId: claim.delivery_id,
      messageId: claim.message_id,
      action: "operations.email.crm_finalised",
      metadata: {
        sentCommunicationId: finalised.sent_communication_id,
        communicationCreated: finalised.communication_created,
        smtpAcceptedAtUsed: true,
      },
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: claim.workspace_id,
      deliveryId: claim.delivery_id,
      messageId: claim.message_id,
      action: finalised.communication_created
        ? "operations.email.final_communication_created"
        : "operations.email.final_communication_reused",
      metadata: { sentCommunicationId: finalised.sent_communication_id },
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: claim.workspace_id,
      deliveryId: claim.delivery_id,
      messageId: claim.message_id,
      action: "operations.email.business_last_contacted_reconciled",
      metadata: { smtpAcceptanceTimestampUsed: true },
    });
    console.log(
      JSON.stringify({
        scope: "operations_email_crm_finalisation",
        event: "finalised",
        workerId: input.workerId,
        messageId: claim.message_id,
        deliveryId: claim.delivery_id,
        finalisationState: "finalised",
        attemptCount: claim.attempt_count,
        elapsedMs: Date.now() - startedAt,
      }),
    );
  } catch (error) {
    const retry = claim.attempt_count < FINALISATION_MAX_ATTEMPTS;
    await markOperationsEmailCrmFinalisationFailed({
      workspaceId: claim.workspace_id,
      finalisationId: claim.id,
      workerId: input.workerId,
      safeError: retry
        ? "CRM recording is delayed and will be retried. The email was already sent."
        : "The email was sent, but CRM recording requires manual investigation.",
      nextAttemptAt: retry
        ? new Date(
            Date.now() +
              Math.min(300_000, 15_000 * 2 ** (claim.attempt_count - 1)),
          )
        : null,
    });
    await recordOperationsEmailSystemAudit({
      workspaceId: claim.workspace_id,
      deliveryId: claim.delivery_id,
      messageId: claim.message_id,
      action: "operations.email.crm_finalisation_failed",
      metadata: {
        attemptNumber: claim.attempt_count,
        retryScheduled: retry,
        errorCode:
          error instanceof Error ? error.message.slice(0, 100) : "unknown",
      },
    });
    console.warn(
      JSON.stringify({
        scope: "operations_email_crm_finalisation",
        event: "failed",
        workerId: input.workerId,
        messageId: claim.message_id,
        deliveryId: claim.delivery_id,
        finalisationState: "failed",
        attemptCount: claim.attempt_count,
        retryScheduled: retry,
        elapsedMs: Date.now() - startedAt,
      }),
    );
  }
  return true;
}

export async function runOperationsEmailCrmFinalisationWorker(input: {
  workerId: string;
  signal: AbortSignal;
}) {
  while (!input.signal.aborted) {
    try {
      const processed = await processOneOperationsEmailCrmFinalisation(input);
      if (!processed) await sleep(FINALISATION_POLL_MS, input.signal);
    } catch (error) {
      console.error(
        JSON.stringify({
          scope: "operations_email_crm_finalisation",
          event: "isolated_iteration_failure",
          workerId: input.workerId,
          errorCode: error instanceof Error ? error.name : "unknown",
        }),
      );
      await sleep(FINALISATION_POLL_MS, input.signal);
    }
  }
}
