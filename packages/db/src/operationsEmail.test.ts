import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { DATABASE_URL } from "./env";
import { closeConnection } from "./client";
import {
  addOperationsEmailAttachmentMetadata,
  cancelOperationsEmailForManualWorkflow,
  claimDueOperationsEmailSmtpDelivery,
  claimPendingOperationsEmailSentCopy,
  createOperationsEmailDeliveryAttempt,
  createOperationsEmailMessageWithoutSource,
  createOperationsEmailStandaloneDraft,
  createOrGetAndQueueOperationsEmailRealDelivery,
  createOrGetOperationsEmailMessageFromCommunication,
  createOrGetOperationsEmailTestDelivery,
  getOperationsEmailMessage,
  getOperationsEmailMessageDetail,
  getOperationsEmailSmtpReadiness,
  getOperationsEmailSourceLinks,
  getOperationsEmailTransferSource,
  getOperationsQuotePdfRender,
  listActiveOperationsEmailAttachments,
  listOperationsEmailDeliveryAttempts,
  listOperationsEmailMessageSummaries,
  markOperationsEmailMessageReady,
  markOperationsEmailSentCopyFailed,
  markOperationsEmailSentCopyPending,
  recordOperationsEmailDeliveryUncertain,
  recordOperationsEmailSafePreSendFailure,
  recordOperationsEmailSmtpAcceptance,
  requeueOperationsEmailDeliveryWithFrozenMime,
  returnOperationsEmailMessageToDraft,
  saveOperationsQuotePdfRender,
  saveOperationsQuotePdfRenderAtNextRevision,
  setOperationsEmailSmtpReadiness,
  softRemoveOperationsEmailAttachment,
  updateOperationsEmailMessageEditor,
  type OperationsEmailMessageRow,
} from "./operationsEmail";
import { markOperationsCommunicationSent } from "./operationsCommunications";
import {
  claimDueOperationsEmailCrmFinalisation,
  claimOperationsEmailCrmFinalisationForMessage,
  finaliseClaimedOperationsEmailCrm,
  requestOperationsEmailPostSendLink,
} from "./operationsEmailFinalisation";
import {
  addOperationsEmailGeneratedAttachment,
  addOperationsEmailManualAttachment,
  getOperationsEmailAttachmentDownload,
  listOperationsEmailAttachmentOptions,
  listOperationsEmailAttachmentsSafe,
  loadOperationsEmailAttachmentBytes,
  removeOperationsEmailAttachment,
  saveOperationsEmailFinalRender,
} from "./operationsEmailPreparation";

const db = new Client({ connectionString: DATABASE_URL });
const testKey = randomUUID();
let actorUserId = "";
let workspaceId = "";
let otherWorkspaceId = "";
let businessId = "";
let otherBusinessId = "";
let contactId = "";
let quoteId = "";
let communicationsBeforeMigration = 0;
let communicationsAfterMigration = 0;

const frozenMime = {
  fixedMessageId: `<${testKey}@scanlark.test>`,
  dateHeader: new Date("2026-08-04T12:00:00.000Z"),
  envelopeSender: "connor@scanlark.com",
  envelopeRecipient: "client@example.com",
  rawMimeBytes: Buffer.from("From: test\r\n\r\nCheckpoint 2 fixture"),
  mimeSha256: "a".repeat(64),
  frozenMetadataJson: { fixture: "checkpoint-2" },
};

before(async () => {
  await db.connect();
  const beforeCount = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM operations_communications`,
  );
  communicationsBeforeMigration = Number(beforeCount.rows[0].count);

  const foundationMigration = readFileSync(
    new URL(
      "../migrations/045_operations_email_foundation.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.query("BEGIN");
  try {
    await db.query(foundationMigration);
    await db.query(
      readFileSync(
        new URL(
          "../migrations/046_operations_email_content_preparation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      readFileSync(
        new URL(
          "../migrations/047_operations_email_smtp_queue.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      readFileSync(
        new URL(
          "../migrations/048_operations_email_standalone_drafts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      readFileSync(
        new URL(
          "../migrations/049_operations_email_crm_finalisation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  const afterCount = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM operations_communications`,
  );
  communicationsAfterMigration = Number(afterCount.rows[0].count);

  const user = await db.query<{ id: string }>(
    `
      INSERT INTO users (email, password_hash)
      VALUES ($1, 'checkpoint-2-test-hash')
      RETURNING id
    `,
    [`checkpoint-2-${testKey}@scanlark.test`],
  );
  actorUserId = user.rows[0].id;

  const workspaces = await db.query<{ id: string }>(
    `
      INSERT INTO internal_workspaces (name, code)
      VALUES
        ('Checkpoint 2 workspace', $1),
        ('Checkpoint 2 other workspace', $2)
      RETURNING id
    `,
    [`checkpoint-2-${testKey}`, `checkpoint-2-other-${testKey}`],
  );
  workspaceId = workspaces.rows[0].id;
  otherWorkspaceId = workspaces.rows[1].id;

  await db.query(
    `
      INSERT INTO internal_workspace_memberships (workspace_id, user_id, role)
      VALUES ($1, $3, 'owner'), ($2, $3, 'owner')
    `,
    [workspaceId, otherWorkspaceId, actorUserId],
  );

  const businesses = await db.query<{ id: string }>(
    `
      INSERT INTO operations_businesses (
        name, internal_workspace_id, created_by_user_id
      )
      VALUES
        ('Checkpoint 2 business', $1, $3),
        ('Checkpoint 2 other business', $2, $3)
      RETURNING id
    `,
    [workspaceId, otherWorkspaceId, actorUserId],
  );
  businessId = businesses.rows[0].id;
  otherBusinessId = businesses.rows[1].id;

  const contact = await db.query<{ id: string }>(
    `
      INSERT INTO operations_contacts (business_id, first_name, email)
      VALUES ($1, 'Client', 'client@example.com')
      RETURNING id
    `,
    [businessId],
  );
  contactId = contact.rows[0].id;

  const quote = await db.query<{ id: string }>(
    `
      INSERT INTO operations_quotes (
        business_id, contact_id, quote_number, title, created_by_user_id
      )
      VALUES ($1, $2, $3, 'Checkpoint 2 quote', $4)
      RETURNING id
    `,
    [businessId, contactId, `SL-TEST-${testKey}`, actorUserId],
  );
  quoteId = quote.rows[0].id;
});

after(async () => {
  await closeConnection();
  if (workspaceId && otherWorkspaceId) {
    const workspaceIds = [workspaceId, otherWorkspaceId];
    await db.query(
      `DELETE FROM operations_email_delivery_attempts WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_email_smtp_readiness WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_email_imap_readiness WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_email_crm_finalisations WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_email_deliveries WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_email_attachments WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_quote_pdf_renders WHERE operations_quote_id = $1`,
      [quoteId],
    );
    await db.query(
      `DELETE FROM operations_email_messages WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM operations_communications WHERE business_id = ANY($1::uuid[])`,
      [[businessId, otherBusinessId]],
    );
    await db.query(`DELETE FROM operations_quotes WHERE id = $1`, [quoteId]);
    await db.query(
      `DELETE FROM operations_contacts WHERE business_id = ANY($1::uuid[])`,
      [[businessId, otherBusinessId]],
    );
    await db.query(
      `DELETE FROM operations_businesses WHERE id = ANY($1::uuid[])`,
      [[businessId, otherBusinessId]],
    );
    await db.query(
      `DELETE FROM internal_workspace_memberships WHERE workspace_id = ANY($1::uuid[])`,
      [workspaceIds],
    );
    await db.query(
      `DELETE FROM internal_workspaces WHERE id = ANY($1::uuid[])`,
      [workspaceIds],
    );
  }
  if (actorUserId) {
    await db.query(`DELETE FROM users WHERE id = $1`, [actorUserId]);
  }
  await db.end();
});

async function createSourceCommunication(
  options: {
    workspace?: "primary" | "other";
    status?: "draft" | "ready" | "sent";
  } = {},
) {
  const selectedBusiness =
    options.workspace === "other" ? otherBusinessId : businessId;
  const status = options.status ?? "ready";
  const res = await db.query<{ id: string }>(
    `
      INSERT INTO operations_communications (
        business_id,
        contact_id,
        direction,
        channel,
        status,
        subject,
        body,
        sender_name,
        sender_email,
        recipient_name,
        recipient_email,
        sent_at,
        created_by_user_id
      )
      VALUES (
        $1,
        $2,
        'outbound',
        'email',
        $3,
        'Checkpoint 2 message',
        'Checkpoint 2 body',
        'Connor Smith',
        'connor@scanlark.com',
        'Client',
        'client@example.com',
        CASE WHEN $3 = 'sent' THEN now() ELSE NULL END,
        $4
      )
      RETURNING id
    `,
    [
      selectedBusiness,
      options.workspace === "other" ? null : contactId,
      status,
      actorUserId,
    ],
  );
  return res.rows[0].id;
}

function editorInput() {
  return {
    fromName: "Connor Smith",
    fromAddress: "connor@scanlark.com",
    recipientName: "Client",
    recipientAddress: "client@example.com",
    subject: "Checkpoint 2 message",
    editorBody: "Checkpoint 2 body",
    plainText: "Checkpoint 2 body",
  };
}

async function createSourceMessage() {
  const sourceCommunicationId = await createSourceCommunication();
  const result = await createOrGetOperationsEmailMessageFromCommunication({
    workspaceId,
    sourceCommunicationId,
    actorUserId,
    contactId,
    ...editorInput(),
  });
  assert.ok(result);
  return { sourceCommunicationId, message: result.message };
}

async function createReadyMessage() {
  const created = await createSourceMessage();
  const html = "<p>Checkpoint 4 final HTML</p>";
  const plainText = "Checkpoint 4 final text";
  const rendered = await saveOperationsEmailFinalRender({
    workspaceId,
    messageId: created.message.id,
    expectedRevision: created.message.revision,
    actorUserId,
    attachmentSetSha256: createHash("sha256").update("[]").digest("hex"),
    html,
    plainText,
    htmlSha256: createHash("sha256").update(html).digest("hex"),
    plainTextSha256: createHash("sha256").update(plainText).digest("hex"),
    rendererVersion: "checkpoint-4-test",
    renderMetadataJson: { fixture: true },
  });
  assert.ok(rendered);
  const ready = await markOperationsEmailMessageReady({
    workspaceId,
    messageId: created.message.id,
    expectedRevision: created.message.revision,
    actorUserId,
  });
  assert.equal(ready.outcome, "updated");
  return {
    sourceCommunicationId: created.sourceCommunicationId,
    message: ready.message as OperationsEmailMessageRow,
  };
}

async function queueReal(
  message: OperationsEmailMessageRow,
  key = randomUUID(),
) {
  const result = await createOrGetAndQueueOperationsEmailRealDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: key,
    frozenMime: {
      ...frozenMime,
      fixedMessageId: `<${key}@scanlark.test>`,
      frozenMetadataJson: {
        ...frozenMime.frozenMetadataJson,
        subject: message.subject,
        attachmentCount: 0,
      },
    },
  });
  assert.ok(result.delivery);
  return result;
}

async function deferAllClaims() {
  await db.query(
    `
      UPDATE operations_email_deliveries
      SET next_attempt_at = now() + interval '1 day',
          sent_copy_next_attempt_at = now() + interval '1 day'
      WHERE workspace_id = $1
    `,
    [workspaceId],
  );
  await db.query(
    `UPDATE operations_email_crm_finalisations SET next_attempt_at = now() + interval '1 day' WHERE workspace_id = $1`,
    [workspaceId],
  );
}

test("migration 045 applies cleanly and leaves Communications unchanged", () => {
  assert.equal(communicationsAfterMigration, communicationsBeforeMigration);
});

test("concurrent source transfers converge on one Email message", async () => {
  const sourceCommunicationId = await createSourceCommunication();
  const input = {
    workspaceId,
    sourceCommunicationId,
    actorUserId,
    contactId,
    ...editorInput(),
  };
  const [first, second] = await Promise.all([
    createOrGetOperationsEmailMessageFromCommunication(input),
    createOrGetOperationsEmailMessageFromCommunication(input),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.message.id, second.message.id);
  assert.equal([first.created, second.created].filter(Boolean).length, 1);
});

test("PostgreSQL enforces unique non-null source Communication links", async () => {
  const { message } = await createSourceMessage();
  await assert.rejects(
    db.query(
      `
        INSERT INTO operations_email_messages (
          workspace_id, source_communication_id, business_id,
          from_name, from_address, recipient_address, subject, editor_body
        )
        VALUES ($1, $2, $3, 'Connor Smith', 'connor@scanlark.com',
                'other@example.com', 'Duplicate', 'Duplicate')
      `,
      [workspaceId, message.source_communication_id, businessId],
    ),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505",
  );
});

test("source-less future messages are not blocked by source uniqueness", async () => {
  const first = await createOperationsEmailMessageWithoutSource({
    workspaceId,
    businessId,
    actorUserId,
    ...editorInput(),
  });
  const second = await createOperationsEmailMessageWithoutSource({
    workspaceId,
    businessId,
    actorUserId,
    ...editorInput(),
  });
  assert.ok(first);
  assert.ok(second);
  assert.notEqual(first.id, second.id);
});

test("standalone drafts need no Communication or CRM business and appear in Drafts", async () => {
  const created = await createOperationsEmailStandaloneDraft({
    workspaceId,
    actorUserId,
    fromName: "Connor Smith",
    fromAddress: "connor@scanlark.com",
    replyToAddress: "contact@scanlark.com",
  });
  assert.ok(created);
  assert.equal(created.source_communication_id, null);
  assert.equal(created.business_id, null);
  assert.equal(created.contact_id, null);
  assert.equal(created.recipient_address, "");
  assert.equal(created.subject, "");
  assert.equal(created.editor_body, "");
  assert.equal(created.status, "draft");
  assert.equal(created.created_by_user_id, actorUserId);
  assert.equal(created.revision, 1);

  const listed = await listOperationsEmailMessageSummaries({
    workspaceId,
    statuses: ["draft"],
    limit: 200,
    offset: 0,
  });
  const summary = listed.messages.find((item) => item.id === created.id);
  assert.equal(summary?.business_name, "Standalone email");
});

test("standalone drafts can queue test delivery without a source or business", async () => {
  const message = await createOperationsEmailStandaloneDraft({
    workspaceId,
    actorUserId,
    fromName: "Connor Smith",
    fromAddress: "connor@scanlark.com",
    replyToAddress: "contact@scanlark.com",
    recipientAddress: "test@example.com",
    subject: "Standalone test",
  });
  assert.ok(message);
  const result = await createOrGetOperationsEmailTestDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: randomUUID(),
    frozenMime: {
      ...frozenMime,
      envelopeRecipient: "checkpoint-operator@scanlark.test",
      fixedMessageId: `<standalone-${randomUUID()}@scanlark.test>`,
    },
  });
  assert.equal(result.outcome, "created");
  assert.equal(result.delivery?.delivery_kind, "test");
});

test("standalone emails can queue normal delivery without a source or business", async () => {
  await deferAllClaims();
  const communicationsBefore = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM operations_communications WHERE business_id = $1`,
    [businessId],
  );
  const draft = await createOperationsEmailStandaloneDraft({
    workspaceId,
    actorUserId,
    fromName: "Connor Smith",
    fromAddress: "connor@scanlark.com",
    replyToAddress: "contact@scanlark.com",
    recipientAddress: "valid-unlinked-recipient@example.net",
    subject: "Standalone normal delivery",
  });
  assert.ok(draft);
  const ready = await db.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages
      SET editor_body = 'A valid standalone email body.',
          plain_text = 'A valid standalone email body.',
          final_render_html = '<p>A valid standalone email body.</p>',
          final_render_plain_text = 'A valid standalone email body.',
          status = 'ready',
          ready_at = now()
      WHERE id = $1 AND workspace_id = $2
      RETURNING *
    `,
    [draft.id, workspaceId],
  );
  const message = ready.rows[0];
  assert.ok(message);
  const result = await createOrGetAndQueueOperationsEmailRealDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: randomUUID(),
    frozenMime: {
      ...frozenMime,
      envelopeRecipient: message.recipient_address,
      fixedMessageId: `<standalone-real-${randomUUID()}@scanlark.test>`,
      frozenMetadataJson: {
        ...frozenMime.frozenMetadataJson,
        subject: message.subject,
        attachmentCount: 0,
      },
    },
  });
  assert.equal(result.outcome, "created");
  assert.equal(result.delivery?.delivery_kind, "real");
  assert.equal(result.message?.business_id, null);
  assert.equal(result.message?.source_communication_id, null);
  const smtpClaim = await claimDueOperationsEmailSmtpDelivery({
    workerId: "standalone-smtp-worker",
    leaseSeconds: 60,
  });
  assert.equal(smtpClaim?.id, result.delivery?.id);
  await recordOperationsEmailSmtpAcceptance({
    workspaceId,
    deliveryId: result.delivery!.id,
    workerId: "standalone-smtp-worker",
    acceptedRecipients: [message.recipient_address],
  });
  const unlinkedState = await db.query<{ status: string }>(
    `SELECT status FROM operations_email_crm_finalisations WHERE message_id = $1`,
    [message.id],
  );
  assert.equal(unlinkedState.rows[0].status, "not_required");
  assert.equal(
    await claimDueOperationsEmailCrmFinalisation({
      workerId: "standalone-crm-worker",
      leaseSeconds: 60,
    }),
    null,
  );
  const communicationsStillUnchanged = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM operations_communications WHERE business_id = $1`,
    [businessId],
  );
  assert.equal(
    communicationsStillUnchanged.rows[0].count,
    communicationsBefore.rows[0].count,
  );

  const acceptedMessage = await getOperationsEmailMessage(
    workspaceId,
    message.id,
  );
  assert.equal(
    await requestOperationsEmailPostSendLink({
      workspaceId,
      messageId: message.id,
      businessId: otherBusinessId,
      contactId: null,
      expectedRevision: acceptedMessage!.revision,
      actorUserId,
    }),
    null,
  );
  assert.equal(
    await requestOperationsEmailPostSendLink({
      workspaceId,
      messageId: message.id,
      businessId,
      contactId: randomUUID(),
      expectedRevision: acceptedMessage!.revision,
      actorUserId,
    }),
    null,
  );
  const linked = await requestOperationsEmailPostSendLink({
    workspaceId,
    messageId: message.id,
    businessId,
    contactId,
    expectedRevision: acceptedMessage!.revision,
    actorUserId,
  });
  assert.equal(linked?.recipient_contact_mismatch, true);
  const postLinkClaim = await claimOperationsEmailCrmFinalisationForMessage({
    workspaceId,
    messageId: message.id,
    workerId: "post-link-crm-worker",
    leaseSeconds: 60,
  });
  assert.ok(postLinkClaim);
  const finalised = await finaliseClaimedOperationsEmailCrm({
    workspaceId,
    finalisationId: postLinkClaim!.id,
    workerId: "post-link-crm-worker",
  });
  assert.ok(finalised?.sent_communication_id);
  const repeated = await requestOperationsEmailPostSendLink({
    workspaceId,
    messageId: message.id,
    businessId,
    contactId,
    expectedRevision: acceptedMessage!.revision,
    actorUserId,
  });
  assert.equal(
    repeated?.sent_communication_id,
    finalised?.sent_communication_id,
  );
  await db.query(
    `UPDATE operations_email_deliveries SET sent_copy_next_attempt_at = now() + interval '1 day' WHERE id = $1`,
    [result.delivery!.id],
  );
});

test("optimistic editor updates increment current revisions and reject stale revisions", async () => {
  const { message } = await createSourceMessage();
  const updated = await updateOperationsEmailMessageEditor({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    patch: { subject: "Updated once" },
  });
  assert.equal(updated.outcome, "updated");
  assert.equal(updated.message.revision, message.revision + 1);
  const stale = await updateOperationsEmailMessageEditor({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    patch: { subject: "Stale overwrite" },
  });
  assert.equal(stale.outcome, "stale_revision");
  assert.equal(stale.message.subject, "Updated once");
});

test("transfer source and detail reads enforce workspace scope", async () => {
  const { sourceCommunicationId, message } = await createSourceMessage();
  const source = await getOperationsEmailTransferSource(
    workspaceId,
    sourceCommunicationId,
  );
  assert.equal(source?.business_name, "Checkpoint 2 business");
  assert.equal(
    await getOperationsEmailTransferSource(
      otherWorkspaceId,
      sourceCommunicationId,
    ),
    null,
  );
  const detail = await getOperationsEmailMessageDetail(workspaceId, message.id);
  assert.equal(detail?.business_name, "Checkpoint 2 business");
  assert.equal(
    await getOperationsEmailMessageDetail(otherWorkspaceId, message.id),
    null,
  );
});

test("Email list summaries omit editor bodies and return folder counts", async () => {
  const { message } = await createSourceMessage();
  const result = await listOperationsEmailMessageSummaries({
    workspaceId,
    statuses: ["draft"],
    search: "Checkpoint 2 business",
    limit: 50,
    offset: 0,
  });
  const summary = result.messages.find((item) => item.id === message.id);
  assert.ok(summary);
  assert.equal("editor_body" in summary, false);
  assert.equal("rendered_html" in summary, false);
  assert.ok(result.counts.draft >= 1);
});

test("manual mark-sent atomically cancels a linked draft Email", async () => {
  const { sourceCommunicationId, message } = await createSourceMessage();
  const result = await markOperationsCommunicationSent(
    { id: actorUserId, email: `checkpoint-2-${testKey}@scanlark.test` },
    businessId,
    sourceCommunicationId,
  );
  assert.ok(result && !("outcome" in result));
  assert.equal(result.status, "sent");
  const linked = await getOperationsEmailMessage(workspaceId, message.id);
  assert.equal(linked?.status, "cancelled");
  assert.equal(linked?.cancellation_reason, "manual_workflow_completed");
});

test("manual mark-sent is blocked once linked Email delivery is protected", async () => {
  const { sourceCommunicationId, message } = await createSourceMessage();
  await db.query(
    `
      UPDATE operations_email_messages
      SET status = 'queued', queued_at = now()
      WHERE id = $1
    `,
    [message.id],
  );
  const result = await markOperationsCommunicationSent(
    { id: actorUserId, email: `checkpoint-2-${testKey}@scanlark.test` },
    businessId,
    sourceCommunicationId,
  );
  assert.deepEqual(result, {
    outcome: "email_protected_state",
    messageId: message.id,
    status: "queued",
  });
  const source = await getOperationsEmailTransferSource(
    workspaceId,
    sourceCommunicationId,
  );
  assert.equal(source?.status, "ready");
});

test("invalid message lifecycle transitions are rejected", async () => {
  const { message } = await createSourceMessage();
  const result = await returnOperationsEmailMessageToDraft({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
  });
  assert.equal(result.outcome, "invalid_state");
});

test("manual completion cancels draft and ready Email but protects later states", async () => {
  for (const targetStatus of ["draft", "ready"] as const) {
    const created =
      targetStatus === "ready"
        ? await createReadyMessage()
        : await createSourceMessage();
    const result = await cancelOperationsEmailForManualWorkflow({
      workspaceId,
      sourceCommunicationId: created.sourceCommunicationId,
      actorUserId,
    });
    assert.equal(result.outcome, "cancelled");
    assert.equal(
      result.message.cancellation_reason,
      "manual_workflow_completed",
    );
  }

  for (const status of [
    "queued",
    "sending",
    "sent",
    "delivery_uncertain",
  ] as const) {
    const created = await createSourceMessage();
    await db.query(
      `
        UPDATE operations_email_messages
        SET status = $2,
            queued_at = CASE WHEN $2 IN ('queued', 'sending') THEN now() ELSE queued_at END,
            sending_at = CASE WHEN $2 = 'sending' THEN now() ELSE sending_at END,
            sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
            uncertain_at = CASE WHEN $2 = 'delivery_uncertain' THEN now() ELSE uncertain_at END
        WHERE id = $1
      `,
      [created.message.id, status],
    );
    const result = await cancelOperationsEmailForManualWorkflow({
      workspaceId,
      sourceCommunicationId: created.sourceCommunicationId,
      actorUserId,
    });
    assert.equal(result.outcome, "protected_state");
  }
});

test("test delivery idempotency permits different keys and converges repeated keys", async () => {
  const { message } = await createSourceMessage();
  const firstKey = randomUUID();
  const first = await createOrGetOperationsEmailTestDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: firstKey,
    frozenMime,
  });
  const repeated = await createOrGetOperationsEmailTestDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: firstKey,
    frozenMime,
  });
  const second = await createOrGetOperationsEmailTestDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: randomUUID(),
    frozenMime,
  });
  assert.ok(first.delivery);
  assert.ok(repeated.delivery);
  assert.ok(second.delivery);
  assert.equal(first.delivery.id, repeated.delivery.id);
  assert.notEqual(first.delivery.id, second.delivery.id);
});

test("real delivery creation is unique, idempotent, concurrent, and atomic with queueing", async () => {
  const { message } = await createReadyMessage();
  const first = await queueReal(message, randomUUID());
  assert.equal(first.outcome, "created");
  assert.equal(first.message.status, "queued");

  const repeated = await createOrGetAndQueueOperationsEmailRealDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: randomUUID(),
    frozenMime,
  });
  assert.equal(repeated.outcome, "existing");
  assert.equal(repeated.delivery?.id, first.delivery?.id);

  await assert.rejects(
    db.query(
      `
        INSERT INTO operations_email_deliveries (
          workspace_id, message_id, delivery_kind, idempotency_key
        ) VALUES ($1, $2, 'real', $3)
      `,
      [workspaceId, message.id, randomUUID()],
    ),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505",
  );

  const concurrentMessage = await createReadyMessage();
  const [concurrentA, concurrentB] = await Promise.all([
    createOrGetAndQueueOperationsEmailRealDelivery({
      workspaceId,
      messageId: concurrentMessage.message.id,
      expectedRevision: concurrentMessage.message.revision,
      actorUserId,
      idempotencyKey: randomUUID(),
      frozenMime,
    }),
    createOrGetAndQueueOperationsEmailRealDelivery({
      workspaceId,
      messageId: concurrentMessage.message.id,
      expectedRevision: concurrentMessage.message.revision,
      actorUserId,
      idempotencyKey: randomUUID(),
      frozenMime,
    }),
  ]);
  assert.ok(concurrentA.delivery);
  assert.ok(concurrentB.delivery);
  assert.equal(concurrentA.delivery.id, concurrentB.delivery.id);
});

test("queueing rejects missing frozen MIME without changing the message", async () => {
  const { message } = await createReadyMessage();
  await assert.rejects(
    createOrGetAndQueueOperationsEmailRealDelivery({
      workspaceId,
      messageId: message.id,
      expectedRevision: message.revision,
      actorUserId,
      idempotencyKey: randomUUID(),
      frozenMime: {
        ...frozenMime,
        rawMimeBytes: null,
        rawMimeStorageKey: null,
      },
    }),
    /frozen_mime_source_invalid/,
  );
  const unchanged = await getOperationsEmailMessage(workspaceId, message.id);
  assert.equal(unchanged?.status, "ready");
  assert.equal(unchanged?.revision, message.revision);
});

test("SMTP claims use exclusive leases and safely reclaim expired pre-transmission work", async () => {
  await deferAllClaims();
  const { message } = await createReadyMessage();
  const queued = await queueReal(message);
  assert.ok(queued.delivery);
  const firstClaim = await claimDueOperationsEmailSmtpDelivery({
    workerId: "worker-a",
    leaseSeconds: 60,
  });
  assert.equal(firstClaim?.id, queued.delivery.id);
  const duplicateClaim = await claimDueOperationsEmailSmtpDelivery({
    workerId: "worker-b",
    leaseSeconds: 60,
  });
  assert.equal(duplicateClaim, null);

  await db.query(
    `
      UPDATE operations_email_deliveries
      SET smtp_lock_expires_at = now() - interval '1 second',
          transmission_may_have_begun = false,
          retry_policy = 'automatic'
      WHERE id = $1
    `,
    [queued.delivery.id],
  );
  const reclaimed = await claimDueOperationsEmailSmtpDelivery({
    workerId: "worker-b",
    leaseSeconds: 60,
  });
  assert.equal(reclaimed?.id, queued.delivery.id);
  assert.equal(reclaimed?.smtp_lock_owner, "worker-b");
});

test("uncertain deliveries are never selected for automatic SMTP retry", async () => {
  await deferAllClaims();
  const { message } = await createReadyMessage();
  const queued = await queueReal(message);
  assert.ok(queued.delivery);
  const claimed = await claimDueOperationsEmailSmtpDelivery({
    workerId: "uncertain-worker",
    leaseSeconds: 60,
  });
  assert.equal(claimed?.id, queued.delivery.id);
  const uncertain = await recordOperationsEmailDeliveryUncertain({
    workspaceId,
    deliveryId: queued.delivery.id,
    workerId: "uncertain-worker",
    smtpPhase: "data",
    safeDisplayError:
      "Message may already have been accepted; investigate manually.",
  });
  assert.equal(uncertain?.status, "delivery_uncertain");
  const next = await claimDueOperationsEmailSmtpDelivery({
    workerId: "other-worker",
    leaseSeconds: 60,
  });
  assert.equal(next, null);
});

test("only transient pre-acceptance failures auto-retry and permanent failures need manual retry", async () => {
  await deferAllClaims();
  const transientMessage = await createReadyMessage();
  const transientDelivery = await queueReal(transientMessage.message);
  assert.ok(transientDelivery.delivery);
  await claimDueOperationsEmailSmtpDelivery({
    workerId: "transient-worker",
    leaseSeconds: 60,
  });
  const transient = await recordOperationsEmailSafePreSendFailure({
    workspaceId,
    deliveryId: transientDelivery.delivery.id,
    workerId: "transient-worker",
    failure: {
      smtpPhase: "connect",
      failureClass: "transient_pre_acceptance",
      retryPolicy: "automatic",
      safeDisplayError: "Provider temporarily unavailable",
      nextAttemptAt: new Date(Date.now() + 60_000),
    },
  });
  assert.equal(transient?.status, "queued");
  assert.equal(transient?.transmission_may_have_begun, false);

  await assert.rejects(
    recordOperationsEmailSafePreSendFailure({
      workspaceId,
      deliveryId: transientDelivery.delivery.id,
      workerId: "transient-worker",
      failure: {
        smtpPhase: "connect",
        failureClass: "permanent",
        retryPolicy: "automatic",
        safeDisplayError: "Permanent rejection",
        nextAttemptAt: new Date(Date.now() + 60_000),
      },
    }),
    /automatic_retry_requires_transient_failure/,
  );

  await deferAllClaims();
  const permanentMessage = await createReadyMessage();
  const permanentDelivery = await queueReal(permanentMessage.message);
  assert.ok(permanentDelivery.delivery);
  await claimDueOperationsEmailSmtpDelivery({
    workerId: "permanent-worker",
    leaseSeconds: 60,
  });
  const failed = await recordOperationsEmailSafePreSendFailure({
    workspaceId,
    deliveryId: permanentDelivery.delivery.id,
    workerId: "permanent-worker",
    failure: {
      smtpPhase: "envelope",
      failureClass: "permanent",
      retryPolicy: "manual",
      safeDisplayError: "Recipient rejected",
      responseCode: 550,
      responseClass: 5,
    },
  });
  assert.equal(failed?.status, "failed");
  const manuallyRetried = await requeueOperationsEmailDeliveryWithFrozenMime({
    workspaceId,
    deliveryId: permanentDelivery.delivery.id,
    actorUserId,
  });
  assert.equal(manuallyRetried?.status, "queued");
  assert.equal(manuallyRetried?.manual_retry_count, 1);
  assert.equal(
    manuallyRetried?.fixed_message_id,
    permanentDelivery.delivery.fixed_message_id,
  );
  assert.equal(
    manuallyRetried?.mime_sha256,
    permanentDelivery.delivery.mime_sha256,
  );
  assert.deepEqual(
    manuallyRetried?.raw_mime_bytes,
    permanentDelivery.delivery.raw_mime_bytes,
  );
});

test("SMTP readiness stores only safe workspace status", async () => {
  const verified = await setOperationsEmailSmtpReadiness({
    workspaceId,
    status: "verified",
    workerId: "checkpoint-5-test-worker",
  });
  assert.equal(verified.status, "verified");
  assert.ok(verified.verified_at);
  const unavailable = await setOperationsEmailSmtpReadiness({
    workspaceId,
    status: "unavailable",
    workerId: "checkpoint-5-test-worker",
    safeErrorCode: "smtp_verification_failed",
  });
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.safe_error_code, "smtp_verification_failed");
  const loaded = await getOperationsEmailSmtpReadiness(workspaceId);
  assert.equal(loaded?.status, "unavailable");
});

test("Sent-copy claims are independent and never requeue SMTP", async () => {
  await deferAllClaims();
  const { message, sourceCommunicationId } = await createReadyMessage();
  const beforeSideEffects = await db.query<{
    last_contacted_at: Date | null;
    communication_status: string;
    communication_body: string;
    follow_up_completed_at: Date | null;
  }>(
    `
      SELECT business.last_contacted_at,
             communication.status AS communication_status,
             communication.body AS communication_body,
             communication.follow_up_completed_at
      FROM operations_businesses business
      JOIN operations_communications communication ON communication.id = $2
      WHERE business.id = $1
    `,
    [businessId, sourceCommunicationId],
  );
  const queued = await queueReal(message);
  assert.ok(queued.delivery);
  const smtpClaim = await claimDueOperationsEmailSmtpDelivery({
    workerId: "smtp-worker",
    leaseSeconds: 60,
  });
  assert.equal(smtpClaim?.id, queued.delivery.id);
  const accepted = await recordOperationsEmailSmtpAcceptance({
    workspaceId,
    deliveryId: queued.delivery.id,
    workerId: "smtp-worker",
    acceptedRecipients: ["client@example.com"],
  });
  assert.equal(accepted?.status, "sent");
  assert.equal(accepted?.sent_copy_status, "pending");
  const acceptedMessage = await getOperationsEmailMessage(
    workspaceId,
    message.id,
  );
  assert.equal(acceptedMessage?.status, "sent");
  assert.equal(acceptedMessage?.sent_communication_id, null);
  const afterSideEffects = await db.query<{
    last_contacted_at: Date | null;
    communication_status: string;
    communication_body: string;
    follow_up_completed_at: Date | null;
  }>(
    `
      SELECT business.last_contacted_at,
             communication.status AS communication_status,
             communication.body AS communication_body,
             communication.follow_up_completed_at
      FROM operations_businesses business
      JOIN operations_communications communication ON communication.id = $2
      WHERE business.id = $1
    `,
    [businessId, sourceCommunicationId],
  );
  assert.deepEqual(afterSideEffects.rows[0], beforeSideEffects.rows[0]);

  const noSmtpRetry = await claimDueOperationsEmailSmtpDelivery({
    workerId: "smtp-worker-2",
    leaseSeconds: 60,
  });
  assert.equal(noSmtpRetry, null);
  const sentCopyClaim = await claimPendingOperationsEmailSentCopy({
    workerId: "imap-worker",
    leaseSeconds: 60,
  });
  assert.equal(sentCopyClaim?.id, queued.delivery.id);
  const failedAppend = await markOperationsEmailSentCopyFailed({
    workspaceId,
    deliveryId: queued.delivery.id,
    workerId: "imap-worker",
    safeDisplayError: "Sent folder temporarily unavailable",
    nextAttemptAt: new Date(Date.now() + 60_000),
  });
  assert.equal(failedAppend?.status, "sent");
  assert.equal(failedAppend?.sent_copy_status, "failed");
  const pendingAgain = await markOperationsEmailSentCopyPending({
    workspaceId,
    deliveryId: queued.delivery.id,
    nextAttemptAt: new Date(Date.now() + 60_000),
  });
  assert.equal(pendingAgain?.status, "sent");
  assert.equal(pendingAgain?.sent_copy_status, "pending");

  const crmClaim = await claimDueOperationsEmailCrmFinalisation({
    workerId: "crm-worker",
    leaseSeconds: 60,
  });
  assert.equal(crmClaim?.message_id, message.id);
  const finalised = await finaliseClaimedOperationsEmailCrm({
    workspaceId,
    finalisationId: crmClaim!.id,
    workerId: "crm-worker",
  });
  assert.equal(finalised?.status, "finalised");
  assert.equal(finalised?.communication_created, true);
  const finalMessage = await getOperationsEmailMessage(workspaceId, message.id);
  assert.equal(
    finalMessage?.sent_communication_id,
    finalised?.sent_communication_id,
  );
  const sourceAfterFinalisation = await db.query<{
    status: string;
    body: string;
  }>(`SELECT status, body FROM operations_communications WHERE id = $1`, [
    sourceCommunicationId,
  ]);
  assert.equal(
    sourceAfterFinalisation.rows[0].status,
    beforeSideEffects.rows[0].communication_status,
  );
  assert.equal(
    sourceAfterFinalisation.rows[0].body,
    beforeSideEffects.rows[0].communication_body,
  );
  const sentCount = await db.query<{
    count: string;
    subject: string;
    body: string;
    recipient_email: string;
    sent_at: Date;
  }>(
    `SELECT count(*)::text AS count, max(subject) AS subject, max(body) AS body,
            max(recipient_email) AS recipient_email, max(sent_at) AS sent_at
     FROM operations_communications WHERE id = $1 AND status = 'sent'`,
    [finalised?.sent_communication_id],
  );
  assert.equal(Number(sentCount.rows[0].count), 1);
  assert.equal(sentCount.rows[0].subject, message.subject);
  assert.equal(sentCount.rows[0].body, message.final_render_plain_text);
  assert.equal(sentCount.rows[0].recipient_email, accepted?.envelope_recipient);
  assert.equal(
    sentCount.rows[0].sent_at.getTime(),
    accepted?.smtp_accepted_at?.getTime(),
  );
  const reconciledBusiness = await db.query<{ last_contacted_at: Date }>(
    `SELECT last_contacted_at FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  assert.equal(
    reconciledBusiness.rows[0].last_contacted_at.getTime(),
    accepted?.smtp_accepted_at?.getTime(),
  );
  assert.equal(
    await claimDueOperationsEmailCrmFinalisation({
      workerId: "crm-worker-2",
      leaseSeconds: 60,
    }),
    null,
  );
});

test("batch source-link lookup returns multiple Communications in one result", async () => {
  const first = await createSourceMessage();
  const second = await createSourceMessage();
  const missing = randomUUID();
  const links = await getOperationsEmailSourceLinks(workspaceId, [
    first.sourceCommunicationId,
    second.sourceCommunicationId,
    missing,
  ]);
  assert.equal(links.size, 2);
  assert.equal(
    links.get(first.sourceCommunicationId)?.messageId,
    first.message.id,
  );
  assert.equal(
    links.get(second.sourceCommunicationId)?.messageId,
    second.message.id,
  );
  assert.equal(links.has(missing), false);
});

test("workspace-scoped reads cannot retrieve another workspace's message", async () => {
  const sourceCommunicationId = await createSourceCommunication({
    workspace: "other",
  });
  const created = await createOrGetOperationsEmailMessageFromCommunication({
    workspaceId: otherWorkspaceId,
    sourceCommunicationId,
    actorUserId,
    ...editorInput(),
  });
  assert.ok(created);
  assert.equal(
    await getOperationsEmailMessage(workspaceId, created.message.id),
    null,
  );
  assert.equal(
    (await getOperationsEmailMessage(otherWorkspaceId, created.message.id))?.id,
    created.message.id,
  );
});

test("soft-removed attachments are excluded while remaining auditable", async () => {
  const { message } = await createSourceMessage();
  const attachment = await addOperationsEmailAttachmentMetadata({
    workspaceId,
    messageId: message.id,
    actorUserId,
    sourceType: "manual",
    displayFilename: "evidence.txt",
    storageFilename: "evidence.txt",
    declaredMimeType: "text/plain",
    sizeBytes: 0,
  });
  assert.ok(attachment);
  assert.equal(
    (await listActiveOperationsEmailAttachments(workspaceId, message.id))
      .length,
    1,
  );
  const removed = await softRemoveOperationsEmailAttachment({
    workspaceId,
    messageId: message.id,
    attachmentId: attachment.id,
    actorUserId,
  });
  assert.ok(removed?.removed_at);
  assert.equal(
    (await listActiveOperationsEmailAttachments(workspaceId, message.id))
      .length,
    0,
  );
  const stored = await db.query<{ removed_at: Date | null }>(
    `SELECT removed_at FROM operations_email_attachments WHERE id = $1`,
    [attachment.id],
  );
  assert.ok(stored.rows[0].removed_at);
});

test("delivery attempts receive transport-scoped sequential numbers", async () => {
  const { message } = await createSourceMessage();
  const delivery = await createOrGetOperationsEmailTestDelivery({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    idempotencyKey: randomUUID(),
    frozenMime,
  });
  assert.ok(delivery.delivery);
  await createOperationsEmailDeliveryAttempt({
    workspaceId,
    deliveryId: delivery.delivery.id,
    transportKind: "smtp",
    requestKind: "automatic",
    workerId: "attempt-worker",
  });
  await createOperationsEmailDeliveryAttempt({
    workspaceId,
    deliveryId: delivery.delivery.id,
    transportKind: "smtp",
    requestKind: "actor_requested",
    initiatedByUserId: actorUserId,
  });
  const attempts = await listOperationsEmailDeliveryAttempts(
    workspaceId,
    delivery.delivery.id,
  );
  assert.deepEqual(
    attempts.map((attempt) => attempt.attempt_number),
    [1, 2],
  );
});

test("quote PDF render bytes are versioned and durably retrievable", async () => {
  const pdfBytes = Buffer.from("%PDF-1.4 checkpoint-2");
  const render = await saveOperationsQuotePdfRender({
    quoteId,
    quoteRevision: 1,
    filename: "checkpoint-2-quote.pdf",
    pdfBytes,
    sha256: "b".repeat(64),
    generatedByUserId: actorUserId,
    generationSource: "actor",
  });
  assert.equal(render.quote_revision, 1);
  assert.equal(Number(render.size_bytes), pdfBytes.length);
  const stored = await getOperationsQuotePdfRender(quoteId, 1);
  assert.deepEqual(stored?.pdf_bytes, pdfBytes);
  assert.equal(stored?.sha256, "b".repeat(64));
});

test("manual bytes remain private while add and remove atomically invalidate Ready", async () => {
  const { message } = await createReadyMessage();
  const bytes = Buffer.from("name,value\nScanlark,1\n");
  const added = await addOperationsEmailManualAttachment({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    displayFilename: "evidence.csv",
    verifiedMimeType: "text/csv",
    contentBytes: bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    maxTotalBytes: 1024,
  });
  assert.equal(added.outcome, "updated");
  if (added.outcome !== "updated") return;
  assert.equal(added.messageRevision, message.revision + 1);
  assert.equal(added.messageStatus, "draft");
  assert.equal(added.readyInvalidated, true);
  assert.equal("content_bytes" in added.attachment, false);

  const listed = await listOperationsEmailAttachmentsSafe(
    workspaceId,
    message.id,
  );
  assert.equal(listed.length, 1);
  assert.equal("content_bytes" in listed[0], false);
  const download = await getOperationsEmailAttachmentDownload(
    workspaceId,
    message.id,
    added.attachment.id,
  );
  assert.deepEqual(download?.bytes, bytes);

  const removed = await removeOperationsEmailAttachment({
    workspaceId,
    messageId: message.id,
    attachmentId: added.attachment.id,
    expectedRevision: added.messageRevision,
    actorUserId,
  });
  assert.equal(removed.outcome, "updated");
  assert.equal(
    await getOperationsEmailAttachmentDownload(
      workspaceId,
      message.id,
      added.attachment.id,
    ),
    null,
  );
});

test("concurrent uploads cannot bypass the total attachment limit", async () => {
  const { message } = await createSourceMessage();
  const add = (filename: string, byte: number) => {
    const contentBytes = Buffer.alloc(10, byte);
    return addOperationsEmailManualAttachment({
      workspaceId,
      messageId: message.id,
      expectedRevision: message.revision,
      actorUserId,
      displayFilename: filename,
      verifiedMimeType: "text/plain",
      contentBytes,
      sha256: createHash("sha256").update(contentBytes).digest("hex"),
      maxTotalBytes: 15,
    });
  };
  const results = await Promise.all([add("one.txt", 49), add("two.txt", 50)]);
  assert.equal(
    results.filter((result) => result.outcome === "updated").length,
    1,
  );
  const active = await listOperationsEmailAttachmentsSafe(
    workspaceId,
    message.id,
  );
  assert.equal(active.length, 1);
  assert.equal(
    active.reduce((sum, item) => sum + Number(item.size_bytes), 0),
    10,
  );
});

test("generated quote attachment freezes one exact persisted render", async () => {
  const { message } = await createSourceMessage();
  const firstBytes = Buffer.from("%PDF-1.4 quote frozen one");
  const first = await saveOperationsQuotePdfRender({
    quoteId,
    quoteRevision: 2,
    filename: "quote-v2.pdf",
    pdfBytes: firstBytes,
    sha256: createHash("sha256").update(firstBytes).digest("hex"),
    generatedByUserId: actorUserId,
    generationSource: "actor",
    sourceSnapshotSha256: "c".repeat(64),
    sourceSnapshotJson: { revision: 2 },
  });
  const options = await listOperationsEmailAttachmentOptions(
    workspaceId,
    message.id,
  );
  assert.ok(options.some((option) => option.renderId === first.id));
  const added = await addOperationsEmailGeneratedAttachment({
    workspaceId,
    messageId: message.id,
    expectedRevision: message.revision,
    actorUserId,
    sourceType: "quote_pdf",
    renderId: first.id,
    maxTotalBytes: 1024,
  });
  assert.equal(added.outcome, "updated");

  const newerBytes = Buffer.from("%PDF-1.4 quote newer two");
  await saveOperationsQuotePdfRender({
    quoteId,
    quoteRevision: 3,
    filename: "quote-v3.pdf",
    pdfBytes: newerBytes,
    sha256: createHash("sha256").update(newerBytes).digest("hex"),
    generatedByUserId: actorUserId,
    generationSource: "actor",
    sourceSnapshotSha256: "d".repeat(64),
    sourceSnapshotJson: { revision: 3 },
  });
  const loaded = await loadOperationsEmailAttachmentBytes(
    workspaceId,
    message.id,
  );
  assert.equal(loaded[0].source_quote_render_id, first.id);
  assert.deepEqual(loaded[0].bytes, firstBytes);
});

test("concurrent quote snapshot persistence converges on one durable version", async () => {
  const pdfBytes = Buffer.from("%PDF-1.4 concurrent quote snapshot");
  const sourceSnapshotSha256 = "e".repeat(64);
  const save = () =>
    saveOperationsQuotePdfRenderAtNextRevision({
      quoteId,
      filename: "quote-concurrent.pdf",
      pdfBytes,
      sha256: createHash("sha256").update(pdfBytes).digest("hex"),
      generatedByUserId: actorUserId,
      generationSource: "actor",
      sourceSnapshotSha256,
      sourceUpdatedAt: new Date("2026-08-04T10:00:00.000Z"),
      sourceSnapshotJson: { snapshot: "concurrent" },
    });
  const [first, second] = await Promise.all([save(), save()]);
  assert.ok(first);
  assert.equal(second?.id, first?.id);
  const count = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM operations_quote_pdf_renders WHERE operations_quote_id = $1 AND source_snapshot_sha256 = $2`,
    [quoteId, sourceSnapshotSha256],
  );
  assert.equal(Number(count.rows[0].count), 1);
});
