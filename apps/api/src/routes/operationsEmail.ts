import express from "express";
import type { Request, Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import multer from "multer";
import {
  addOperationsEmailGeneratedAttachment,
  addOperationsEmailManualAttachment,
  createOrGetAndQueueOperationsEmailRealDelivery,
  createOperationsEmailStandaloneDraft,
  createOrGetOperationsEmailTestDelivery,
  createOrGetOperationsEmailMessageFromCommunication,
  getOperationsEmailAttachmentDownload,
  getOperationsEmailMessageDetail,
  getOperationsEmailMessageDelivery,
  getOperationsEmailRealDeliveryForMessage,
  getOperationsEmailTestDeliveryByIdempotencyKey,
  getOperationsEmailQuotePdfRender,
  getOperationsEmailScopedQuoteForRender,
  getOperationsEmailSourceLinks,
  getOperationsEmailSmtpConfig,
  getOperationsEmailSmtpReadiness,
  getOperationsEmailImapConfig,
  getOperationsEmailImapReadiness,
  getOperationsEmailTransferSource,
  getOperationsQuotePreview,
  isValidEmailAddress,
  listOperationsEmailAttachmentOptions,
  listOperationsEmailAttachmentsSafe,
  listOperationsEmailMessageSummaries,
  listOperationsEmailDeliveryHistorySafe,
  listOperationsEmailClientLinkOptions,
  markOperationsEmailMessageReady,
  recordAdminAuditLog,
  recordOperationsEmailSystemAudit,
  requeueOperationsEmailDeliveryWithFrozenMime,
  requestOperationsEmailPostSendLink,
  claimOperationsEmailCrmFinalisationForMessage,
  finaliseClaimedOperationsEmailCrm,
  markOperationsEmailCrmFinalisationFailed,
  requestOperationsEmailSentCopyRetry,
  removeOperationsEmailAttachment,
  returnOperationsEmailMessageToDraft,
  saveOperationsQuotePdfRenderAtNextRevision,
  updateOperationsEmailMessageEditor,
  type OperationsEmailMessageStatus,
  type OperationsEmailOptimisticResult,
  deriveOperationsEmailTestRecipient,
  operationsEmailRealSendPolicy,
} from "@scanlark/db";
import {
  requireOperationsContext,
  requireOperationsEmailAccess,
} from "../operationsAccess";
import {
  findUnresolvedClientCommunicationPlaceholders,
  sanitizeClientEmailHtml,
} from "../operationsHelpers";
import {
  OPERATIONS_EMAIL_FOLDER_STATUSES,
  parseEmailFolder,
  parseExpectedRevision,
  parseOperationsEmailEditorPatch,
  parseOperationsEmailStandaloneDraft,
  renderOperationsEmailEditorPreview,
  validateOperationsEmailReady,
} from "../operationsEmailHelpers";
import {
  getOperationsEmailAttachmentLimits,
  validateOperationsEmailUpload,
} from "../operationsEmailAttachments";
import {
  freezeOperationsEmailDeliveryMime,
  prepareOperationsEmailFinal,
} from "../operationsEmailPreparation";
import {
  operationsQuotePdfFilename,
  renderOperationsQuotePdf,
} from "../operationsQuotePdf";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPERATIONS_EMAIL_FROM = {
  name: "Connor Smith",
  email: "connor@scanlark.com",
} as const;

function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return res.status(status).json({ error, message, ...(details ?? {}) });
}

function actor(req: Request) {
  if (!req.user) throw new Error("operations_email_actor_missing");
  return { id: req.user.id, email: req.user.email };
}

function uuidParam(req: Request, res: Response, name: string) {
  const value = req.params[name];
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    sendApiError(res, 400, "invalid_id", `Invalid ${name}`);
    return null;
  }
  return value;
}

function validationError(res: Response, error: unknown) {
  if (!(error instanceof Error)) return false;
  const knownPrefixes = [
    "invalid_",
    "unsupported_",
    "unresolved_",
    "subject_required",
    "editor_body_required",
    "recipient_address_required",
    "recipient_address_too_long",
    "subject_too_long",
    "preheader_too_long",
  ];
  if (
    !knownPrefixes.some((prefix) => error.message.startsWith(prefix)) &&
    !error.message.endsWith("_too_long")
  ) {
    return false;
  }
  sendApiError(
    res,
    400,
    "operations_email_validation_failed",
    error.message.split("_").join(" "),
  );
  return true;
}

function optimisticResponse(
  res: Response,
  result: OperationsEmailOptimisticResult,
) {
  if (result.outcome === "updated") {
    return res.json({ message: result.message });
  }
  if (result.outcome === "not_found") {
    return sendApiError(res, 404, "not_found", "Email message not found");
  }
  if (result.outcome === "stale_revision") {
    return sendApiError(
      res,
      409,
      "operations_email_revision_conflict",
      "This Email message changed after it was opened. Your local edits have not been discarded.",
      { latest: result.message },
    );
  }
  return sendApiError(
    res,
    409,
    "operations_email_state_conflict",
    `This Email message cannot be edited while it is ${result.message.status}.`,
    { latest: result.message },
  );
}

function attachmentMutationError(res: Response, outcome: string) {
  const responses: Record<string, [number, string, string]> = {
    not_found: [404, "not_found", "Email message or attachment not found"],
    stale_revision: [
      409,
      "operations_email_revision_conflict",
      "This Email message changed before the attachment update",
    ],
    invalid_state: [
      409,
      "operations_email_state_conflict",
      "Attachments cannot be changed in this Email lifecycle",
    ],
    source_not_found: [
      404,
      "generated_attachment_not_found",
      "The selected persisted document render is not eligible for this business",
    ],
    total_size_exceeded: [
      400,
      "attachment_total_size_exceeded",
      "The active attachments would exceed the 20 MiB total limit",
    ],
    duplicate_filename: [
      409,
      "attachment_filename_conflict",
      "An active attachment already uses that filename",
    ],
  };
  const [status, error, message] = responses[outcome] ?? [
    400,
    "attachment_update_failed",
    "The attachment could not be updated",
  ];
  return sendApiError(res, status, error, message);
}

function parseIdempotencyKey(value: unknown) {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (
    typeof record.idempotencyKey !== "string" ||
    record.idempotencyKey.length < 16 ||
    record.idempotencyKey.length > 200 ||
    !/^[A-Za-z0-9._:-]+$/.test(record.idempotencyKey)
  ) {
    throw new Error("invalid_idempotency_key");
  }
  return record.idempotencyKey;
}

function smtpReadinessUsable(
  readiness: Awaited<ReturnType<typeof getOperationsEmailSmtpReadiness>>,
  readinessIntervalMs: number,
) {
  return (
    readiness?.status === "verified" &&
    Date.now() - readiness.checked_at.getTime() <= readinessIntervalMs * 2
  );
}

function safeDelivery(delivery: {
  id: string;
  delivery_kind: string;
  status: string;
  automatic_attempt_count: number;
  manual_retry_count: number;
  smtp_phase: string | null;
  failure_class: string | null;
  retry_policy: string | null;
  safe_display_error: string | null;
  next_attempt_at: Date;
  queued_at: Date;
  sending_at: Date | null;
  smtp_accepted_at: Date | null;
  failed_at: Date | null;
  uncertain_at: Date | null;
  envelope_recipient: string | null;
  mime_sha256: string | null;
  fixed_message_id: string | null;
}) {
  return {
    id: delivery.id,
    deliveryKind: delivery.delivery_kind,
    status: delivery.status,
    actualRecipient: delivery.envelope_recipient,
    automaticAttemptCount: delivery.automatic_attempt_count,
    manualRetryCount: delivery.manual_retry_count,
    smtpPhase: delivery.smtp_phase,
    failureClass: delivery.failure_class,
    retryPolicy: delivery.retry_policy,
    safeDisplayError: delivery.safe_display_error,
    nextAttemptAt: delivery.next_attempt_at,
    queuedAt: delivery.queued_at,
    sendingAt: delivery.sending_at,
    smtpAcceptedAt: delivery.smtp_accepted_at,
    failedAt: delivery.failed_at,
    uncertainAt: delivery.uncertain_at,
    hasFrozenMime: Boolean(delivery.mime_sha256 && delivery.fixed_message_id),
  };
}

async function auditEmail(
  req: Request,
  workspaceId: string,
  action: string,
  messageId: string,
  metadata: Record<string, unknown>,
) {
  await recordAdminAuditLog(actor(req), {
    action,
    targetType: "operations_email_message",
    targetId: messageId,
    metadata: { workspaceId, ...metadata },
  });
}

export function mountOperationsEmailRoutes(app: express.Application) {
  const router = express.Router();
  router.use(requireOperationsContext);
  router.use(requireOperationsEmailAccess);
  const attachmentLimits = getOperationsEmailAttachmentLimits();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: attachmentLimits.maxFileBytes, files: 1, fields: 2 },
  });

  router.get("/config", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const smtp = getOperationsEmailSmtpConfig();
      const imap = getOperationsEmailImapConfig();
      const readiness = await getOperationsEmailSmtpReadiness(workspace.id);
      const imapReadiness = await getOperationsEmailImapReadiness(workspace.id);
      const usable =
        smtp.configured &&
        smtpReadinessUsable(readiness, smtp.readinessIntervalMs);
      const testRecipient = deriveOperationsEmailTestRecipient(
        actor(req).email,
        smtp,
      );
      return res.json({
        enabled: req.operationsCapabilities?.operationsEmailEnabled === true,
        canUseEmail: req.operationsCapabilities?.canUseOperationsEmail === true,
        implementationStage: "checkpoint-6-crm-sent-copy",
        smtp: {
          configured: smtp.configured,
          readiness: readiness?.status ?? "not_checked",
          usable,
          checkedAt: readiness?.checked_at ?? null,
        },
        fixedSender: {
          name: smtp.fromName,
          address: smtp.fromAddress,
          replyTo: smtp.replyToAddress,
        },
        testSend: {
          available: usable && Boolean(testRecipient),
          recipient: testRecipient,
        },
        realSend: {
          mode: smtp.realSendMode,
          generallyAvailable: usable && smtp.realSendMode !== "disabled",
        },
        sentCopy: {
          configured: imap.configured,
          readiness: imapReadiness?.status ?? "not_checked",
          available: imap.configured && imapReadiness?.status === "available",
          checkedAt: imapReadiness?.checked_at ?? null,
        },
      });
    } catch (error) {
      console.error("Operations Email config failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_config_failed",
        "Failed to load safe Email configuration status",
      );
    }
  });

  router.get("/sent-copy-status", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const config = getOperationsEmailImapConfig();
      const readiness = await getOperationsEmailImapReadiness(workspace.id);
      return res.json({
        configured: config.configured,
        available: config.configured && readiness?.status === "available",
        lastChecked: readiness?.checked_at ?? null,
        state:
          readiness?.status ??
          (config.configured ? "configured" : "unavailable"),
      });
    } catch (error) {
      console.error("Operations Email Sent-copy status failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_sent_copy_status_failed",
        "Failed to load safe IONOS Sent-copy status",
      );
    }
  });

  router.post("/messages", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const initial = parseOperationsEmailStandaloneDraft(req.body);
      const smtp = getOperationsEmailSmtpConfig();
      const message = await createOperationsEmailStandaloneDraft({
        workspaceId: workspace.id,
        actorUserId: actor(req).id,
        fromName: smtp.fromName,
        fromAddress: smtp.fromAddress,
        replyToAddress: isValidEmailAddress(smtp.replyToAddress)
          ? smtp.replyToAddress
          : "contact@scanlark.com",
        ...initial,
      });
      if (!message) {
        return sendApiError(
          res,
          400,
          "operations_email_crm_relationship_invalid",
          "The selected business, contact, report, or quote is not available in this workspace",
        );
      }
      await auditEmail(
        req,
        workspace.id,
        "operations.email.standalone_draft_created",
        message.id,
        {
          sourceCommunicationId: null,
          businessId: message.business_id,
          contactId: message.contact_id,
          reportId: message.report_id,
          quoteId: message.quote_id,
        },
      );
      return res.status(201).json({
        message: await getOperationsEmailMessageDetail(
          workspace.id,
          message.id,
        ),
      });
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email standalone draft creation failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_create_failed",
        "Failed to create Email draft",
      );
    }
  });

  router.get("/messages", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const folder = parseEmailFolder(req.query.folder);
      const limit = Math.min(
        Math.max(
          Number.parseInt(String(req.query.limit ?? "100"), 10) || 100,
          1,
        ),
        200,
      );
      const offset = Math.max(
        Number.parseInt(String(req.query.offset ?? "0"), 10) || 0,
        0,
      );
      const result = await listOperationsEmailMessageSummaries({
        workspaceId: workspace.id,
        statuses: [
          ...OPERATIONS_EMAIL_FOLDER_STATUSES[folder],
        ] as OperationsEmailMessageStatus[],
        search: typeof req.query.search === "string" ? req.query.search : null,
        limit,
        offset,
      });
      return res.json({ folder, ...result });
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email list failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_list_failed",
        "Failed to load Email messages",
      );
    }
  });

  router.post("/source-links", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      const ids = Array.isArray(body.communicationIds)
        ? [...new Set(body.communicationIds)]
        : [];
      if (
        ids.length > 200 ||
        ids.some((id) => typeof id !== "string" || !UUID_RE.test(id))
      ) {
        return sendApiError(
          res,
          400,
          "invalid_communication_ids",
          "Provide up to 200 valid Communication IDs",
        );
      }
      const links = await getOperationsEmailSourceLinks(
        workspace.id,
        ids as string[],
      );
      return res.json({ links: Object.fromEntries(links) });
    } catch (error) {
      console.error("Operations Email source link lookup failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_source_links_failed",
        "Failed to load linked Email status",
      );
    }
  });

  router.post(
    "/messages/from-communication/:communicationId",
    async (req, res) => {
      const communicationId = uuidParam(req, res, "communicationId");
      if (!communicationId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const source = await getOperationsEmailTransferSource(
          workspace.id,
          communicationId,
        );
        if (!source) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        if (
          source.status !== "ready" ||
          source.direction !== "outbound" ||
          source.channel !== "email"
        ) {
          return sendApiError(
            res,
            409,
            "communication_not_transferable",
            "Only a ready outbound email Communication can be opened in Email.",
          );
        }
        const recipientAddress = (
          source.recipient_email ??
          source.contact_email ??
          ""
        ).trim();
        const subject = source.subject?.trim() ?? "";
        const editorBody = source.body.trim();
        if (!isValidEmailAddress(recipientAddress)) {
          throw new Error("invalid_recipient_address");
        }
        validateOperationsEmailReady({ recipientAddress, subject, editorBody });
        const unresolved = findUnresolvedClientCommunicationPlaceholders({
          subject,
          body: editorBody,
        });
        if (unresolved.length > 0)
          throw new Error(
            `unresolved_email_placeholders:${unresolved.join(",")}`,
          );
        const sender = OPERATIONS_EMAIL_FROM;
        const configuredReplyTo = process.env.OPERATIONS_REPLY_TO_EMAIL?.trim();
        const replyToAddress =
          configuredReplyTo && isValidEmailAddress(configuredReplyTo)
            ? configuredReplyTo
            : "contact@scanlark.com";
        const sourceHtml = source.html_document ?? source.html_fragment;
        const renderedHtml = sourceHtml
          ? sanitizeClientEmailHtml(sourceHtml)
          : renderOperationsEmailEditorPreview(editorBody);
        const result = await createOrGetOperationsEmailMessageFromCommunication(
          {
            workspaceId: workspace.id,
            sourceCommunicationId: source.id,
            actorUserId: actor(req).id,
            contactId: source.contact_id,
            reportId: source.report_id,
            quoteId: source.quote_id,
            fromName: sender.name,
            fromAddress: sender.email,
            replyToAddress,
            recipientName: source.recipient_name,
            recipientAddress,
            subject,
            preheader: source.preheader,
            editorBody,
            renderedHtml,
            plainText: source.plain_text_body ?? editorBody,
            sourceSnapshotJson: {
              communicationId: source.id,
              businessId: source.business_id,
              contactId: source.contact_id,
              templateId: source.template_id,
              subject: source.subject,
              body: source.body,
              preheader: source.preheader,
              htmlFragment: source.html_fragment,
              htmlDocument: source.html_document,
              plainTextBody: source.plain_text_body,
              layoutKey: source.layout_key,
              wordingVariantKey: source.wording_variant_key,
              signatureMode: source.signature_mode,
              senderIdentityKey: source.sender_identity_key,
              attachmentRequirements: source.attachment_requirements_json,
              sourceUpdatedAt: source.updated_at,
            },
            renderMetadataJson: {
              previewKind: sourceHtml
                ? "source_communication_snapshot"
                : "editor_preview",
              signatureMode: source.signature_mode ?? "use_mailbox_signature",
              finalMimeFrozen: false,
            },
          },
        );
        if (!result) {
          return sendApiError(
            res,
            409,
            "communication_not_transferable",
            "Communication is no longer ready for Email",
          );
        }
        await auditEmail(
          req,
          workspace.id,
          result.created
            ? "operations.email.transfer"
            : "operations.email.open_existing",
          result.message.id,
          {
            sourceCommunicationId: source.id,
            businessId: source.business_id,
            disposition: result.disposition,
          },
        );
        return res.status(result.created ? 201 : 200).json({
          message: await getOperationsEmailMessageDetail(
            workspace.id,
            result.message.id,
          ),
          disposition: result.disposition,
        });
      } catch (error) {
        if (validationError(res, error)) return;
        console.error("Operations Email transfer failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_transfer_failed",
          "Failed to open Communication in Email",
        );
      }
    },
  );

  router.get("/messages/:messageId", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const message = await getOperationsEmailMessageDetail(
        workspace.id,
        messageId,
      );
      if (!message)
        return sendApiError(res, 404, "not_found", "Email message not found");
      const attachments = await listOperationsEmailAttachmentsSafe(
        workspace.id,
        messageId,
      );
      return res.json({ message, attachments });
    } catch (error) {
      console.error("Operations Email detail failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_detail_failed",
        "Failed to load Email message",
      );
    }
  });

  router.get("/messages/:messageId/attachment-options", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const message = await getOperationsEmailMessageDetail(
        workspace.id,
        messageId,
      );
      if (!message)
        return sendApiError(res, 404, "not_found", "Email message not found");
      const [options, attachments] = await Promise.all([
        listOperationsEmailAttachmentOptions(workspace.id, messageId),
        listOperationsEmailAttachmentsSafe(workspace.id, messageId),
      ]);
      return res.json({ options, attachments });
    } catch (error) {
      console.error("Operations Email attachment options failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_attachment_options_failed",
        "Failed to load attachment options",
      );
    }
  });

  router.post(
    "/messages/:messageId/attachments/generated",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      if (!messageId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const body =
          req.body && typeof req.body === "object"
            ? (req.body as Record<string, unknown>)
            : {};
        const sourceType = body.sourceType;
        const renderId = body.renderId;
        if (
          (sourceType !== "report_pdf" && sourceType !== "quote_pdf") ||
          typeof renderId !== "string" ||
          !UUID_RE.test(renderId)
        ) {
          return sendApiError(
            res,
            400,
            "invalid_generated_attachment",
            "Choose a valid persisted report or quote PDF render",
          );
        }
        const expectedRevision = parseExpectedRevision(body);
        const result = await addOperationsEmailGeneratedAttachment({
          workspaceId: workspace.id,
          messageId,
          expectedRevision,
          actorUserId: actor(req).id,
          sourceType,
          renderId,
          maxTotalBytes: attachmentLimits.maxTotalBytes,
        });
        if (result.outcome !== "updated")
          return attachmentMutationError(res, result.outcome);
        await auditEmail(
          req,
          workspace.id,
          "operations.email.attachment_generated_added",
          messageId,
          {
            attachmentId: result.attachment.id,
            sourceType,
            sourceRenderId: renderId,
            filename: result.attachment.display_filename,
            sizeBytes: Number(result.attachment.size_bytes),
            readyInvalidated: result.readyInvalidated,
          },
        );
        return res.status(201).json(result);
      } catch (error) {
        if (validationError(res, error)) return;
        console.error("Operations Email generated attachment failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_attachment_failed",
          "Failed to attach the generated PDF",
        );
      }
    },
  );

  router.post(
    "/messages/:messageId/attachments/manual",
    (req, res, next) =>
      upload.single("file")(req, res, (error) => {
        if (error instanceof multer.MulterError) {
          sendApiError(
            res,
            400,
            "attachment_upload_rejected",
            error.code === "LIMIT_FILE_SIZE"
              ? "The file exceeds the 10 MiB upload limit"
              : "Upload exactly one bounded file",
          );
          return;
        }
        if (error) return next(error);
        next();
      }),
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      if (!messageId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        if (!req.file)
          return sendApiError(
            res,
            400,
            "attachment_file_required",
            "Choose one file to upload",
          );
        const expectedRevision = Number.parseInt(
          String(req.body?.expectedRevision ?? ""),
          10,
        );
        if (!Number.isInteger(expectedRevision) || expectedRevision < 1)
          throw new Error("invalid_expected_revision");
        const validated = await validateOperationsEmailUpload({
          originalFilename: req.file.originalname,
          declaredMimeType: req.file.mimetype,
          bytes: req.file.buffer,
          maxFileBytes: attachmentLimits.maxFileBytes,
        });
        const result = await addOperationsEmailManualAttachment({
          workspaceId: workspace.id,
          messageId,
          expectedRevision,
          actorUserId: actor(req).id,
          displayFilename: validated.filename,
          verifiedMimeType: validated.contentType,
          contentBytes: validated.bytes,
          sha256: validated.sha256,
          maxTotalBytes: attachmentLimits.maxTotalBytes,
        });
        if (result.outcome !== "updated")
          return attachmentMutationError(res, result.outcome);
        await auditEmail(
          req,
          workspace.id,
          "operations.email.attachment_manual_uploaded",
          messageId,
          {
            attachmentId: result.attachment.id,
            filename: result.attachment.display_filename,
            sizeBytes: Number(result.attachment.size_bytes),
            verifiedMimeType: result.attachment.verified_mime_type,
            readyInvalidated: result.readyInvalidated,
          },
        );
        return res.status(201).json(result);
      } catch (error) {
        if (validationError(res, error)) return;
        console.error("Operations Email manual attachment failed", error);
        return sendApiError(
          res,
          400,
          "attachment_validation_failed",
          error instanceof Error
            ? error.message.split("_").join(" ")
            : "The file was rejected",
        );
      }
    },
  );

  router.delete(
    "/messages/:messageId/attachments/:attachmentId",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      const attachmentId = uuidParam(req, res, "attachmentId");
      if (!messageId || !attachmentId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const result = await removeOperationsEmailAttachment({
          workspaceId: workspace.id,
          messageId,
          attachmentId,
          expectedRevision: parseExpectedRevision(req.body),
          actorUserId: actor(req).id,
        });
        if (result.outcome !== "updated")
          return attachmentMutationError(res, result.outcome);
        await auditEmail(
          req,
          workspace.id,
          "operations.email.attachment_removed",
          messageId,
          {
            attachmentId,
            filename: result.attachment.display_filename,
            sizeBytes: Number(result.attachment.size_bytes),
            readyInvalidated: result.readyInvalidated,
          },
        );
        return res.json(result);
      } catch (error) {
        if (validationError(res, error)) return;
        console.error("Operations Email attachment removal failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_attachment_remove_failed",
          "Failed to remove attachment",
        );
      }
    },
  );

  router.get(
    "/messages/:messageId/attachments/:attachmentId/download",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      const attachmentId = uuidParam(req, res, "attachmentId");
      if (!messageId || !attachmentId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const attachment = await getOperationsEmailAttachmentDownload(
          workspace.id,
          messageId,
          attachmentId,
        );
        if (!attachment?.bytes)
          return sendApiError(res, 404, "not_found", "Attachment not found");
        if (
          createHash("sha256").update(attachment.bytes).digest("hex") !==
          attachment.sha256
        ) {
          return sendApiError(
            res,
            409,
            "attachment_integrity_failed",
            "The attachment no longer matches its recorded hash",
          );
        }
        const filename = attachment.display_filename.replace(/["\r\n]/g, "-");
        res.setHeader("cache-control", "private, no-store");
        res.setHeader("x-content-type-options", "nosniff");
        res.setHeader(
          "content-type",
          attachment.verified_mime_type ?? "application/octet-stream",
        );
        res.setHeader(
          "content-disposition",
          `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        );
        return res.send(attachment.bytes);
      } catch (error) {
        console.error("Operations Email attachment download failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_attachment_download_failed",
          "Failed to download attachment",
        );
      }
    },
  );

  router.post(
    "/messages/:messageId/quote-renders/:quoteId",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      const quoteId = uuidParam(req, res, "quoteId");
      if (!messageId || !quoteId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const expectedRevision = parseExpectedRevision(req.body);
        const message = await getOperationsEmailMessageDetail(
          workspace.id,
          messageId,
        );
        if (!message)
          return sendApiError(res, 404, "not_found", "Email message not found");
        if (message.revision !== expectedRevision)
          return sendApiError(
            res,
            409,
            "operations_email_revision_conflict",
            "This Email message changed before the quote was rendered",
          );
        const scoped = await getOperationsEmailScopedQuoteForRender(
          workspace.id,
          messageId,
          quoteId,
        );
        if (!scoped)
          return sendApiError(
            res,
            404,
            "not_found",
            "Eligible quote not found",
          );
        const preview = await getOperationsQuotePreview(workspace.id, quoteId);
        if (!preview)
          return sendApiError(res, 404, "not_found", "Quote not found");
        if (preview.readinessIssues.length)
          return sendApiError(
            res,
            400,
            "quote_not_ready_for_pdf",
            "Complete the quote before generating a PDF",
            { readinessIssues: preview.readinessIssues },
          );
        const snapshot = {
          ...preview.payload,
          generatedAt: scoped.updated_at.toISOString(),
        };
        const snapshotJson = JSON.stringify(snapshot);
        const snapshotSha256 = createHash("sha256")
          .update(snapshotJson)
          .digest("hex");
        const existing = await getOperationsEmailQuotePdfRender(
          workspace.id,
          quoteId,
          snapshotSha256,
        );
        const render =
          existing ??
          (await (async () => {
            const pdf = await renderOperationsQuotePdf(snapshot);
            const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
            return saveOperationsQuotePdfRenderAtNextRevision({
              workspaceId: workspace.id,
              quoteId,
              filename: operationsQuotePdfFilename(snapshot),
              pdfBytes: pdf,
              sha256: pdfSha256,
              generatedByUserId: actor(req).id,
              generationSource: "actor",
              sourceSnapshotSha256: snapshotSha256,
              sourceUpdatedAt: scoped.updated_at,
              sourceSnapshotJson: snapshot,
            });
          })());
        if (!render) throw new Error("quote_pdf_render_persistence_failed");
        await auditEmail(
          req,
          workspace.id,
          "operations.email.quote_pdf_generated",
          messageId,
          {
            quoteId,
            quoteRenderId: render.id,
            quoteRevision: render.quote_revision,
            filename: render.filename,
            sizeBytes: Number(render.size_bytes),
          },
        );
        return res.status(existing ? 200 : 201).json({
          render: {
            id: render.id,
            quoteId: render.operations_quote_id,
            quoteRevision: render.quote_revision,
            filename: render.filename,
            contentType: render.content_type,
            sizeBytes: Number(render.size_bytes),
            sha256: render.sha256,
            generatedAt: render.generated_at,
            sourceSnapshotSha256: render.source_snapshot_sha256,
          },
        });
      } catch (error) {
        if (validationError(res, error)) return;
        console.error("Operations Email quote PDF render failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_quote_pdf_failed",
          "Failed to generate the quote PDF",
        );
      }
    },
  );

  router.post("/messages/:messageId/final-preview", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const result = await prepareOperationsEmailFinal({
        workspaceId: workspace.id,
        messageId,
        expectedRevision: parseExpectedRevision(req.body),
        actorUserId: actor(req).id,
      });
      res.setHeader("cache-control", "private, no-store");
      if (result.outcome === "not_found")
        return sendApiError(res, 404, "not_found", "Email message not found");
      if (result.outcome === "stale_revision")
        return sendApiError(
          res,
          409,
          "operations_email_revision_conflict",
          "This Email message changed before final rendering",
          { latest: result.message },
        );
      if (result.outcome === "invalid_state")
        return sendApiError(
          res,
          409,
          "operations_email_state_conflict",
          "This Email message can no longer be rendered",
        );
      if (result.outcome === "validation_failed")
        return res.status(422).json(result);
      await auditEmail(
        req,
        workspace.id,
        "operations.email.final_render_validated",
        messageId,
        {
          revision: result.message.revision,
          attachmentSetSha256: result.attachmentSetSha256,
          htmlSha256: result.htmlSha256,
          plainTextSha256: result.plainTextSha256,
        },
      );
      return res.json(result);
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email final preview failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_final_preview_failed",
        "Failed to render the final direct-send preview",
      );
    }
  });

  router.get("/messages/:messageId/deliveries", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const message = await getOperationsEmailMessageDetail(
        workspace.id,
        messageId,
      );
      if (!message)
        return sendApiError(res, 404, "not_found", "Email message not found");
      const deliveries = await listOperationsEmailDeliveryHistorySafe(
        workspace.id,
        messageId,
      );
      return res.json({ deliveries });
    } catch (error) {
      console.error("Operations Email delivery history failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_delivery_history_failed",
        "Failed to load Email delivery history",
      );
    }
  });

  router.get("/client-link-options", async (req, res) => {
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const options = await listOperationsEmailClientLinkOptions(workspace.id);
      return res.json({ options });
    } catch (error) {
      console.error("Operations Email client link options failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_client_options_failed",
        "Failed to load business and contact choices",
      );
    }
  });

  router.post("/messages/:messageId/link-client", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      if (typeof body.businessId !== "string" || !UUID_RE.test(body.businessId))
        return sendApiError(
          res,
          400,
          "invalid_business_id",
          "Select a valid business",
        );
      if (
        body.contactId != null &&
        (typeof body.contactId !== "string" || !UUID_RE.test(body.contactId))
      )
        return sendApiError(
          res,
          400,
          "invalid_contact_id",
          "Select a valid contact",
        );
      const expectedRevision = parseExpectedRevision(body.expectedRevision);
      const linked = await requestOperationsEmailPostSendLink({
        workspaceId: workspace.id,
        messageId,
        businessId: body.businessId,
        contactId: typeof body.contactId === "string" ? body.contactId : null,
        expectedRevision,
        actorUserId: actor(req).id,
      });
      if (!linked) {
        const current = await getOperationsEmailMessageDetail(
          workspace.id,
          messageId,
        );
        if (current?.sent_communication_id)
          return res.json({ message: current, alreadyFinalised: true });
        return sendApiError(
          res,
          409,
          "operations_email_link_conflict",
          "This sent email changed or is no longer eligible for client linking",
          { latest: current },
        );
      }
      await auditEmail(
        req,
        workspace.id,
        "operations.email.post_send_client_linked",
        messageId,
        {
          businessId: linked.business_id,
          contactId: linked.contact_id,
          frozenRecipientMismatch: linked.recipient_contact_mismatch,
        },
      );
      const finalisationWorkerId = `operations-email-api-${randomUUID()}`;
      const claim = await claimOperationsEmailCrmFinalisationForMessage({
        workspaceId: workspace.id,
        messageId,
        workerId: finalisationWorkerId,
        leaseSeconds: 60,
      });
      if (!claim)
        return res
          .status(202)
          .json({ message: linked, crmFinalisation: "pending" });
      try {
        const finalised = await finaliseClaimedOperationsEmailCrm({
          workspaceId: workspace.id,
          finalisationId: claim.id,
          workerId: finalisationWorkerId,
        });
        if (finalised) {
          await recordOperationsEmailSystemAudit({
            workspaceId: workspace.id,
            deliveryId: claim.delivery_id,
            messageId,
            action: finalised.communication_created
              ? "operations.email.final_communication_created"
              : "operations.email.final_communication_reused",
            metadata: {
              sentCommunicationId: finalised.sent_communication_id,
              postSendLink: true,
            },
          });
          await recordOperationsEmailSystemAudit({
            workspaceId: workspace.id,
            deliveryId: claim.delivery_id,
            messageId,
            action: "operations.email.business_last_contacted_reconciled",
            metadata: { smtpAcceptanceTimestampUsed: true, postSendLink: true },
          });
        }
        const message = await getOperationsEmailMessageDetail(
          workspace.id,
          messageId,
        );
        return res.json({
          message,
          sentCommunicationId: finalised?.sent_communication_id ?? null,
          crmFinalisation: finalised ? "finalised" : "pending",
        });
      } catch (error) {
        await markOperationsEmailCrmFinalisationFailed({
          workspaceId: workspace.id,
          finalisationId: claim.id,
          workerId: finalisationWorkerId,
          safeError:
            "The client link was saved, but CRM recording is delayed and will be retried.",
          nextAttemptAt: new Date(),
        });
        return res
          .status(202)
          .json({ message: linked, crmFinalisation: "pending" });
      }
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email post-send client link failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_client_link_failed",
        "Failed to link the sent email to the selected client",
      );
    }
  });

  router.post(
    "/messages/:messageId/deliveries/:deliveryId/retry-sent-copy",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      const deliveryId = uuidParam(req, res, "deliveryId");
      if (!messageId || !deliveryId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        if (!getOperationsEmailImapConfig().configured)
          return sendApiError(
            res,
            409,
            "imap_unavailable",
            "IONOS Sent-copy access is not configured",
          );
        const delivery = await getOperationsEmailMessageDelivery(
          workspace.id,
          messageId,
          deliveryId,
        );
        if (!delivery)
          return sendApiError(res, 404, "not_found", "Delivery not found");
        if (
          !delivery.raw_mime_bytes ||
          !delivery.mime_sha256 ||
          createHash("sha256").update(delivery.raw_mime_bytes).digest("hex") !==
            delivery.mime_sha256
        )
          return sendApiError(
            res,
            409,
            "frozen_mime_integrity_failed",
            "The exact sent MIME is unavailable and cannot be appended safely",
          );
        const retried = await requestOperationsEmailSentCopyRetry({
          workspaceId: workspace.id,
          deliveryId,
        });
        if (!retried)
          return sendApiError(
            res,
            409,
            "sent_copy_retry_not_allowed",
            "This delivery is not eligible for a Sent-folder retry",
          );
        await auditEmail(
          req,
          workspace.id,
          "operations.email.sent_copy_manual_retry",
          messageId,
          {
            deliveryId,
            doesNotResendRecipientEmail: true,
            reusesExactFrozenMime: true,
          },
        );
        return res.status(202).json({ delivery: safeDelivery(retried) });
      } catch (error) {
        console.error("Operations Email Sent-copy retry failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_sent_copy_retry_failed",
          "Failed to queue the IONOS Sent-folder retry",
        );
      }
    },
  );

  router.post("/messages/:messageId/test-send", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      if (
        Object.keys(body).some(
          (key) => !["expectedRevision", "idempotencyKey"].includes(key),
        )
      ) {
        return sendApiError(
          res,
          400,
          "unsupported_test_send_field",
          "The test recipient is derived from the authenticated actor",
        );
      }
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const expectedRevision = parseExpectedRevision(body);
      const idempotencyKey = parseIdempotencyKey(body);
      const existing = await getOperationsEmailTestDeliveryByIdempotencyKey(
        workspace.id,
        messageId,
        idempotencyKey,
      );
      if (existing) {
        if (
          existing.envelope_recipient?.toLowerCase() !==
          actor(req).email.trim().toLowerCase()
        ) {
          return sendApiError(
            res,
            403,
            "test_delivery_actor_mismatch",
            "This test delivery belongs to a different Operations actor",
          );
        }
        const message = await getOperationsEmailMessageDetail(
          workspace.id,
          messageId,
        );
        if (!message)
          return sendApiError(res, 404, "not_found", "Email message not found");
        await auditEmail(
          req,
          workspace.id,
          "operations.email.test_send_idempotent_replay",
          messageId,
          { deliveryId: existing.id, deliveryKind: "test" },
        );
        return res.json({
          outcome: "existing",
          delivery: safeDelivery(existing),
          message,
        });
      }
      const smtp = getOperationsEmailSmtpConfig();
      if (!smtp.configured) {
        return sendApiError(
          res,
          409,
          "smtp_unavailable",
          "Operations Email SMTP is not configured",
        );
      }
      const readiness = await getOperationsEmailSmtpReadiness(workspace.id);
      if (!smtpReadinessUsable(readiness, smtp.readinessIntervalMs)) {
        return sendApiError(
          res,
          409,
          "smtp_not_verified",
          "Operations Email SMTP has not been verified recently",
        );
      }
      const testRecipient = deriveOperationsEmailTestRecipient(
        actor(req).email,
        smtp,
      );
      if (!testRecipient) {
        return sendApiError(
          res,
          403,
          "test_recipient_not_allowed",
          "No approved test recipient is configured for this Operations actor",
        );
      }
      await auditEmail(
        req,
        workspace.id,
        "operations.email.test_send_requested",
        messageId,
        { deliveryKind: "test", revision: expectedRevision },
      );
      const date = new Date();
      const messageIdHeader = `<operations-email-test-${randomUUID()}@scanlark.com>`;
      const frozen = await freezeOperationsEmailDeliveryMime({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
        deliveryKind: "test",
        actualRecipient: testRecipient,
        date,
        messageIdHeader,
        smtpConfig: smtp,
      });
      if (frozen.outcome !== "frozen") {
        if (frozen.outcome === "not_found")
          return sendApiError(res, 404, "not_found", "Email message not found");
        if (frozen.outcome === "stale_revision")
          return sendApiError(
            res,
            409,
            "operations_email_revision_conflict",
            "This Email changed before the test was frozen",
            { latest: frozen.message },
          );
        if (frozen.outcome === "validation_failed")
          return res.status(422).json({
            error: "operations_email_test_validation_failed",
            message: "Resolve the final-render requirements before testing",
            details: frozen.errors,
          });
        return sendApiError(
          res,
          409,
          "operations_email_state_conflict",
          "This Email cannot be tested in its current lifecycle",
        );
      }
      const result = await createOrGetOperationsEmailTestDelivery({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
        idempotencyKey,
        frozenMime: frozen.frozenMime,
      });
      if (!result.delivery) {
        return sendApiError(
          res,
          result.outcome === "stale_revision" ? 409 : 422,
          "operations_email_test_queue_failed",
          "The test Email could not be queued",
        );
      }
      await auditEmail(
        req,
        workspace.id,
        result.outcome === "created"
          ? "operations.email.test_send_queued"
          : "operations.email.test_send_idempotent_replay",
        messageId,
        {
          deliveryId: result.delivery.id,
          deliveryKind: "test",
          revision: expectedRevision,
          rawMimeByteSize: frozen.mime.byteSize,
          mimeSha256: frozen.mime.sha256,
        },
      );
      return res.status(result.outcome === "created" ? 202 : 200).json({
        outcome: result.outcome,
        delivery: safeDelivery(result.delivery),
        message: result.message,
      });
    } catch (error) {
      if (validationError(res, error)) return;
      if (error instanceof Error && error.message.startsWith("mime_")) {
        return sendApiError(
          res,
          422,
          "operations_email_mime_validation_failed",
          "The final Email could not be safely frozen",
        );
      }
      console.error("Operations Email test queue failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_test_queue_failed",
        "Failed to queue the test Email",
      );
    }
  });

  router.post("/messages/:messageId/send", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const body =
        req.body && typeof req.body === "object"
          ? (req.body as Record<string, unknown>)
          : {};
      if (
        Object.keys(body).some(
          (key) => !["expectedRevision", "idempotencyKey"].includes(key),
        )
      ) {
        return sendApiError(
          res,
          400,
          "unsupported_real_send_field",
          "Recipient and confirmation details are loaded server-side",
        );
      }
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const expectedRevision = parseExpectedRevision(body);
      const idempotencyKey = parseIdempotencyKey(body);
      const current = await getOperationsEmailMessageDetail(
        workspace.id,
        messageId,
      );
      if (!current)
        return sendApiError(res, 404, "not_found", "Email message not found");
      const existing = await getOperationsEmailRealDeliveryForMessage(
        workspace.id,
        messageId,
      );
      if (existing) {
        await auditEmail(
          req,
          workspace.id,
          "operations.email.real_send_idempotent_replay",
          messageId,
          { deliveryId: existing.id, deliveryKind: "real" },
        );
        return res.json({
          outcome: "existing",
          delivery: safeDelivery(existing),
          message: current,
        });
      }
      const smtp = getOperationsEmailSmtpConfig();
      if (!smtp.configured)
        return sendApiError(
          res,
          409,
          "smtp_unavailable",
          "Operations Email SMTP is not configured",
        );
      const policy = operationsEmailRealSendPolicy(
        current.recipient_address,
        smtp,
      );
      if (!policy.allowed) {
        return sendApiError(
          res,
          403,
          policy.reason,
          policy.reason === "real_send_disabled"
            ? "Real sending remains disabled until the controlled rollout is approved"
            : "This recipient is not included in the controlled real-send allowlist",
        );
      }
      if (current.status !== "ready") {
        return sendApiError(
          res,
          409,
          "operations_email_state_conflict",
          "Only a current Ready Email can be sent",
        );
      }
      const readiness = await getOperationsEmailSmtpReadiness(workspace.id);
      if (!smtpReadinessUsable(readiness, smtp.readinessIntervalMs))
        return sendApiError(
          res,
          409,
          "smtp_not_verified",
          "Operations Email SMTP has not been verified recently",
        );
      await auditEmail(
        req,
        workspace.id,
        "operations.email.real_send_requested",
        messageId,
        {
          deliveryKind: "real",
          revision: expectedRevision,
          realSendMode: smtp.realSendMode,
        },
      );
      const date = new Date();
      const messageIdHeader = `<operations-email-${randomUUID()}@scanlark.com>`;
      const frozen = await freezeOperationsEmailDeliveryMime({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
        deliveryKind: "real",
        actualRecipient: current.recipient_address,
        date,
        messageIdHeader,
        smtpConfig: smtp,
      });
      if (frozen.outcome !== "frozen") {
        if (frozen.outcome === "stale_revision")
          return sendApiError(
            res,
            409,
            "operations_email_revision_conflict",
            "The send confirmation is stale because this Email changed",
            { latest: frozen.message },
          );
        if (frozen.outcome === "validation_failed")
          return res.status(422).json({
            error: "operations_email_send_validation_failed",
            message: "Resolve the final-render requirements before sending",
            details: frozen.errors,
          });
        return sendApiError(
          res,
          frozen.outcome === "not_found" ? 404 : 409,
          "operations_email_state_conflict",
          "Only a current Ready Email can be sent",
        );
      }
      const result = await createOrGetAndQueueOperationsEmailRealDelivery({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
        idempotencyKey,
        frozenMime: frozen.frozenMime,
      });
      if (!result.delivery) {
        return sendApiError(
          res,
          result.outcome === "stale_revision" ? 409 : 422,
          `operations_email_${result.outcome}`,
          result.outcome === "source_not_ready"
            ? "The source Communication is no longer Ready"
            : "The real Email could not be queued",
        );
      }
      await auditEmail(
        req,
        workspace.id,
        result.outcome === "created"
          ? "operations.email.real_send_queued"
          : "operations.email.real_send_idempotent_replay",
        messageId,
        {
          deliveryId: result.delivery.id,
          deliveryKind: "real",
          revision: expectedRevision,
          realSendMode: smtp.realSendMode,
          rawMimeByteSize: frozen.mime.byteSize,
          mimeSha256: frozen.mime.sha256,
        },
      );
      return res.status(result.outcome === "created" ? 202 : 200).json({
        outcome: result.outcome,
        delivery: safeDelivery(result.delivery),
        message: result.message,
      });
    } catch (error) {
      if (validationError(res, error)) return;
      if (error instanceof Error && error.message.startsWith("mime_"))
        return sendApiError(
          res,
          422,
          "operations_email_mime_validation_failed",
          "The final Email could not be safely frozen",
        );
      console.error("Operations Email real queue failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_real_queue_failed",
        "Failed to queue the real Email",
      );
    }
  });

  router.post(
    "/messages/:messageId/deliveries/:deliveryId/retry",
    async (req, res) => {
      const messageId = uuidParam(req, res, "messageId");
      const deliveryId = uuidParam(req, res, "deliveryId");
      if (!messageId || !deliveryId) return;
      try {
        const workspace = req.operationsContext!.workspace;
        if (!workspace) return;
        const smtp = getOperationsEmailSmtpConfig();
        if (!smtp.configured)
          return sendApiError(
            res,
            409,
            "smtp_unavailable",
            "Operations Email SMTP is not configured",
          );
        const delivery = await getOperationsEmailMessageDelivery(
          workspace.id,
          messageId,
          deliveryId,
        );
        if (!delivery)
          return sendApiError(res, 404, "not_found", "Delivery not found");
        if (delivery.delivery_kind === "test") {
          const actorTestRecipient = deriveOperationsEmailTestRecipient(
            actor(req).email,
            smtp,
          );
          if (
            !actorTestRecipient ||
            actorTestRecipient !== delivery.envelope_recipient?.toLowerCase()
          ) {
            return sendApiError(
              res,
              403,
              "test_retry_recipient_not_allowed",
              "This frozen test delivery is not addressed to the authenticated Operations actor",
            );
          }
        }
        if (
          delivery.delivery_kind === "real" &&
          !operationsEmailRealSendPolicy(
            delivery.envelope_recipient ?? "",
            smtp,
          ).allowed
        ) {
          return sendApiError(
            res,
            403,
            "real_send_policy_blocked",
            "The controlled real-send policy no longer permits this recipient",
          );
        }
        if (
          !delivery.raw_mime_bytes ||
          !delivery.mime_sha256 ||
          createHash("sha256").update(delivery.raw_mime_bytes).digest("hex") !==
            delivery.mime_sha256
        ) {
          return sendApiError(
            res,
            409,
            "frozen_mime_integrity_failed",
            "The frozen Email cannot be retried safely",
          );
        }
        const retried = await requeueOperationsEmailDeliveryWithFrozenMime({
          workspaceId: workspace.id,
          deliveryId,
          actorUserId: actor(req).id,
        });
        if (!retried)
          return sendApiError(
            res,
            409,
            "delivery_retry_not_allowed",
            "Only a definitely-not-sent delivery marked for manual retry can be retried",
          );
        await auditEmail(
          req,
          workspace.id,
          "operations.email.manual_retry_queued",
          messageId,
          {
            deliveryId,
            deliveryKind: retried.delivery_kind,
            reusesFrozenMime: true,
            mimeSha256: retried.mime_sha256,
          },
        );
        return res.status(202).json({ delivery: safeDelivery(retried) });
      } catch (error) {
        console.error("Operations Email retry failed", error);
        return sendApiError(
          res,
          500,
          "operations_email_retry_failed",
          "Failed to queue the frozen Email retry",
        );
      }
    },
  );

  router.patch("/messages/:messageId", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const { expectedRevision, patch } = parseOperationsEmailEditorPatch(
        req.body,
      );
      const repositoryPatch = {
        ...patch,
        ...(patch.editorBody !== undefined
          ? {
              plainText: patch.editorBody,
              renderedHtml: renderOperationsEmailEditorPreview(
                patch.editorBody,
              ),
              renderMetadataJson: {
                previewKind: "editor_preview",
                finalMimeFrozen: false,
              },
            }
          : {}),
      };
      const result = await updateOperationsEmailMessageEditor({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
        patch: repositoryPatch,
      });
      if (result.outcome === "updated") {
        await auditEmail(
          req,
          workspace.id,
          "operations.email.edit",
          messageId,
          {
            sourceCommunicationId: result.message.source_communication_id,
            businessId: result.message.business_id,
            changedFields: Object.keys(patch),
            previousRevision: expectedRevision,
            revision: result.message.revision,
          },
        );
      }
      return optimisticResponse(res, result);
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email update failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_update_failed",
        "Failed to save Email message",
      );
    }
  });

  router.post("/messages/:messageId/ready", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const expectedRevision = parseExpectedRevision(req.body);
      const current = await getOperationsEmailMessageDetail(
        workspace.id,
        messageId,
      );
      if (!current)
        return sendApiError(res, 404, "not_found", "Email message not found");
      validateOperationsEmailReady({
        recipientAddress: current.recipient_address,
        subject: current.subject,
        editorBody: current.editor_body,
      });
      if (current.source_communication_id) {
        const source = await getOperationsEmailTransferSource(
          workspace.id,
          current.source_communication_id,
        );
        if (
          !source ||
          source.status !== "ready" ||
          source.business_id !== current.business_id
        ) {
          return sendApiError(
            res,
            409,
            "email_source_changed",
            "The source Communication is no longer ready. Review it before marking Email ready.",
          );
        }
      }
      const prepared = await prepareOperationsEmailFinal({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
      });
      if (prepared.outcome === "validation_failed") {
        return res.status(422).json({
          error: "operations_email_not_ready",
          message:
            "Resolve the final-render and attachment requirements before marking ready",
          details: prepared.errors,
        });
      }
      if (prepared.outcome === "stale_revision") {
        return sendApiError(
          res,
          409,
          "operations_email_revision_conflict",
          "This Email message changed during final validation",
          { latest: prepared.message },
        );
      }
      if (prepared.outcome !== "prepared") {
        return sendApiError(
          res,
          prepared.outcome === "not_found" ? 404 : 409,
          "operations_email_state_conflict",
          "This Email message cannot be prepared",
        );
      }
      const result = await markOperationsEmailMessageReady({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
      });
      if (result.outcome === "updated") {
        await auditEmail(
          req,
          workspace.id,
          "operations.email.mark_ready",
          messageId,
          {
            sourceCommunicationId: result.message.source_communication_id,
            oldLifecycle: "draft",
            newLifecycle: "ready",
            previousRevision: expectedRevision,
            revision: result.message.revision,
          },
        );
      }
      return optimisticResponse(res, result);
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email mark ready failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_ready_failed",
        "Failed to mark Email ready",
      );
    }
  });

  router.post("/messages/:messageId/return-to-draft", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = req.operationsContext!.workspace;
      if (!workspace) return;
      const expectedRevision = parseExpectedRevision(req.body);
      const result = await returnOperationsEmailMessageToDraft({
        workspaceId: workspace.id,
        messageId,
        expectedRevision,
        actorUserId: actor(req).id,
      });
      if (result.outcome === "updated") {
        await auditEmail(
          req,
          workspace.id,
          "operations.email.return_to_draft",
          messageId,
          {
            sourceCommunicationId: result.message.source_communication_id,
            oldLifecycle: "ready",
            newLifecycle: "draft",
            previousRevision: expectedRevision,
            revision: result.message.revision,
          },
        );
      }
      return optimisticResponse(res, result);
    } catch (error) {
      if (validationError(res, error)) return;
      console.error("Operations Email return to draft failed", error);
      return sendApiError(
        res,
        500,
        "operations_email_draft_failed",
        "Failed to return Email to draft",
      );
    }
  });

  app.use("/operations/email", router);
}
