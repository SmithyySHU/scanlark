import { createHash } from "node:crypto";
import {
  getOperationsEmailMessageDetail,
  loadOperationsEmailAttachmentBytes,
  saveOperationsEmailFinalRender,
  type OperationsEmailAttachmentSafeRow,
  type OperationsEmailSmtpConfig,
} from "@scanlark/db";
import {
  estimateOperationsEmailMimeBytes,
  getOperationsEmailAttachmentLimits,
} from "./operationsEmailAttachments";
import { buildOperationsEmailMime } from "./operationsEmailMime";
import { renderOperationsEmailFinal } from "./operationsEmailRender";

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function requiredSourceTypes(snapshot: Record<string, unknown>) {
  const requirements = Array.isArray(snapshot.attachmentRequirements)
    ? snapshot.attachmentRequirements
    : [];
  const required = new Set<"report_pdf" | "quote_pdf">();
  for (const item of requirements) {
    if (
      !item ||
      typeof item !== "object" ||
      (item as { required?: unknown }).required !== true
    )
      continue;
    const key = (item as { key?: unknown }).key;
    if (key === "quote_pdf") required.add("quote_pdf");
    if (key === "client_report_pdf" || key === "updated_report_pdf")
      required.add("report_pdf");
  }
  return [...required];
}

function safeAttachment(
  attachment: OperationsEmailAttachmentSafeRow & { bytes: Buffer | null },
) {
  const { bytes: _bytes, ...metadata } = attachment;
  return metadata;
}

export async function prepareOperationsEmailFinal(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
}) {
  const message = await getOperationsEmailMessageDetail(
    input.workspaceId,
    input.messageId,
  );
  if (!message) return { outcome: "not_found" as const };
  if (message.revision !== input.expectedRevision)
    return { outcome: "stale_revision" as const, message };
  if (!(["draft", "ready"] as string[]).includes(message.status))
    return { outcome: "invalid_state" as const, message };

  const loaded = await loadOperationsEmailAttachmentBytes(
    input.workspaceId,
    input.messageId,
  );
  const errors: string[] = [];
  let totalBytes = 0;
  for (const attachment of loaded) {
    totalBytes += Number(attachment.size_bytes);
    if (!attachment.bytes)
      errors.push(
        `${attachment.display_filename}: source bytes are unavailable.`,
      );
    else if (attachment.bytes.length !== Number(attachment.size_bytes))
      errors.push(`${attachment.display_filename}: stored size has changed.`);
    else if (hash(attachment.bytes) !== attachment.sha256)
      errors.push(
        `${attachment.display_filename}: stored content hash has changed.`,
      );
  }
  const required = requiredSourceTypes(message.source_snapshot_json);
  for (const sourceType of required) {
    if (!loaded.some((attachment) => attachment.source_type === sourceType)) {
      errors.push(
        sourceType === "report_pdf"
          ? "A persisted report PDF is required."
          : "A persisted quote PDF is required.",
      );
    }
  }
  const limits = getOperationsEmailAttachmentLimits();
  if (totalBytes > limits.maxTotalBytes)
    errors.push("The active attachments exceed the total size limit.");
  const rendered = renderOperationsEmailFinal(message);
  errors.push(...rendered.errors);
  const estimatedMimeBytes = estimateOperationsEmailMimeBytes(
    Buffer.byteLength(rendered.html) + Buffer.byteLength(rendered.plainText),
    totalBytes,
  );
  if (estimatedMimeBytes > limits.maxEstimatedMimeBytes)
    errors.push("The estimated encoded message exceeds the MIME size limit.");
  const attachmentSetSha256 = hash(
    JSON.stringify(
      loaded.map((attachment) => ({
        id: attachment.id,
        sourceType: attachment.source_type,
        filename: attachment.display_filename,
        sizeBytes: Number(attachment.size_bytes),
        sha256: attachment.sha256,
        sourceVersion: attachment.source_version,
        sourceRenderId:
          attachment.source_report_render_id ??
          attachment.source_quote_render_id,
      })),
    ),
  );
  if (errors.length) {
    return {
      outcome: "validation_failed" as const,
      message,
      errors,
      warnings: rendered.warnings,
      requiredAttachmentTypes: required,
      attachments: loaded.map(safeAttachment),
      estimatedMimeBytes,
    };
  }
  const saved = await saveOperationsEmailFinalRender({
    workspaceId: input.workspaceId,
    messageId: input.messageId,
    expectedRevision: input.expectedRevision,
    actorUserId: input.actorUserId,
    attachmentSetSha256,
    html: rendered.html,
    plainText: rendered.plainText,
    htmlSha256: rendered.htmlSha256,
    plainTextSha256: rendered.plainTextSha256,
    rendererVersion: rendered.rendererVersion,
    renderMetadataJson: {
      previewKind: "final_direct_send",
      finalMimeFrozen: false,
      editorRevision: message.revision,
      attachmentSetSha256,
      htmlSha256: rendered.htmlSha256,
      plainTextSha256: rendered.plainTextSha256,
    },
  });
  if (!saved)
    return {
      outcome: "stale_revision" as const,
      message: await getOperationsEmailMessageDetail(
        input.workspaceId,
        input.messageId,
      ),
    };
  return {
    outcome: "prepared" as const,
    message: saved,
    html: rendered.html,
    plainText: rendered.plainText,
    htmlSha256: rendered.htmlSha256,
    plainTextSha256: rendered.plainTextSha256,
    attachmentSetSha256,
    warnings: rendered.warnings,
    errors: [],
    requiredAttachmentTypes: required,
    attachments: loaded.map(safeAttachment),
    totalAttachmentBytes: totalBytes,
    estimatedMimeBytes,
  };
}

export async function buildPreparedOperationsEmailMime(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  date: Date;
  messageIdHeader: string;
}) {
  const message = await getOperationsEmailMessageDetail(
    input.workspaceId,
    input.messageId,
  );
  if (!message) throw new Error("mime_message_not_found");
  if (!(message.status === "draft" || message.status === "ready"))
    throw new Error("mime_lifecycle_invalid");
  if (
    message.revision !== input.expectedRevision ||
    message.final_render_revision !== message.revision
  )
    throw new Error("mime_render_stale");
  if (
    !message.final_render_html ||
    !message.final_render_plain_text ||
    !message.final_render_attachment_set_sha256
  )
    throw new Error("mime_render_missing");
  if (
    hash(message.final_render_html) !== message.final_render_html_sha256 ||
    hash(message.final_render_plain_text) !==
      message.final_render_plain_text_sha256
  )
    throw new Error("mime_render_hash_mismatch");
  const loaded = await loadOperationsEmailAttachmentBytes(
    input.workspaceId,
    input.messageId,
  );
  const currentSetHash = hash(
    JSON.stringify(
      loaded.map((attachment) => ({
        id: attachment.id,
        sourceType: attachment.source_type,
        filename: attachment.display_filename,
        sizeBytes: Number(attachment.size_bytes),
        sha256: attachment.sha256,
        sourceVersion: attachment.source_version,
        sourceRenderId:
          attachment.source_report_render_id ??
          attachment.source_quote_render_id,
      })),
    ),
  );
  if (currentSetHash !== message.final_render_attachment_set_sha256)
    throw new Error("mime_attachment_set_stale");
  const limits = getOperationsEmailAttachmentLimits();
  return buildOperationsEmailMime({
    from: { name: message.from_name, address: message.from_address },
    replyTo: message.reply_to_address ?? "contact@scanlark.com",
    to: { name: message.recipient_name, address: message.recipient_address },
    subject: message.subject,
    date: input.date,
    messageId: input.messageIdHeader,
    html: message.final_render_html,
    plainText: message.final_render_plain_text,
    attachments: loaded.map((attachment) => ({
      filename: attachment.display_filename,
      contentType:
        attachment.verified_mime_type ?? attachment.declared_mime_type,
      bytes: attachment.bytes ?? Buffer.alloc(0),
      sha256: attachment.sha256 ?? "",
    })),
    maxBytes: limits.maxEstimatedMimeBytes,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildOperationsEmailTestVariant(input: {
  subject: string;
  html: string;
  plainText: string;
  intendedRecipient: string;
}) {
  return {
    subject: `[TEST] ${input.subject}`,
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border:2px solid #b45309;background:#fff7ed"><tr><td style="padding:12px;color:#7c2d12;font-family:Arial,sans-serif;font-weight:bold">TEST MESSAGE — intended client recipient: ${escapeHtml(input.intendedRecipient)}</td></tr></table>${input.html}`,
    plainText: `[TEST MESSAGE — intended client recipient: ${input.intendedRecipient}]\n\n${input.plainText}`,
  };
}

export async function freezeOperationsEmailDeliveryMime(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  deliveryKind: "test" | "real";
  actualRecipient: string;
  date: Date;
  messageIdHeader: string;
  smtpConfig: Pick<
    OperationsEmailSmtpConfig,
    "fromName" | "fromAddress" | "replyToAddress"
  >;
}) {
  const prepared = await prepareOperationsEmailFinal({
    workspaceId: input.workspaceId,
    messageId: input.messageId,
    expectedRevision: input.expectedRevision,
    actorUserId: input.actorUserId,
  });
  if (prepared.outcome !== "prepared") return prepared;
  const message = prepared.message;
  const attachments = await loadOperationsEmailAttachmentBytes(
    input.workspaceId,
    input.messageId,
  );
  const isTest = input.deliveryKind === "test";
  const content = isTest
    ? buildOperationsEmailTestVariant({
        subject: message.subject,
        html: prepared.html,
        plainText: prepared.plainText,
        intendedRecipient: message.recipient_address,
      })
    : {
        subject: message.subject,
        html: prepared.html,
        plainText: prepared.plainText,
      };
  const mime = await buildOperationsEmailMime({
    from: {
      name: input.smtpConfig.fromName,
      address: input.smtpConfig.fromAddress,
    },
    replyTo: input.smtpConfig.replyToAddress,
    to: {
      name: isTest ? "Scanlark test recipient" : message.recipient_name,
      address: input.actualRecipient,
    },
    subject: content.subject,
    date: input.date,
    messageId: input.messageIdHeader,
    html: content.html,
    plainText: content.plainText,
    attachments: attachments.map((attachment) => ({
      filename: attachment.display_filename,
      contentType:
        attachment.verified_mime_type ?? attachment.declared_mime_type,
      bytes: attachment.bytes ?? Buffer.alloc(0),
      sha256: attachment.sha256 ?? "",
    })),
    maxBytes: getOperationsEmailAttachmentLimits().maxEstimatedMimeBytes,
  });
  return {
    ...prepared,
    outcome: "frozen" as const,
    mime,
    subject: content.subject,
    actualRecipient: input.actualRecipient,
    frozenMime: {
      fixedMessageId: input.messageIdHeader,
      dateHeader: input.date,
      envelopeSender: input.smtpConfig.fromAddress,
      envelopeRecipient: input.actualRecipient,
      rawMimeBytes: mime.raw,
      mimeSha256: mime.sha256,
      frozenMetadataJson: {
        deliveryKind: input.deliveryKind,
        messageRevision: message.revision,
        intendedRecipient: message.recipient_address,
        actualRecipient: input.actualRecipient,
        subject: content.subject,
        attachmentSetSha256: prepared.attachmentSetSha256,
        htmlSha256: prepared.htmlSha256,
        plainTextSha256: prepared.plainTextSha256,
        attachmentCount: attachments.length,
        attachmentIds: attachments.map((attachment) => attachment.id),
        attachmentNames: attachments.map(
          (attachment) => attachment.display_filename,
        ),
        rawMimeByteSize: mime.byteSize,
      },
    },
  };
}
