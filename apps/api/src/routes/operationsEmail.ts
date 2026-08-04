import express from "express";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import multer from "multer";
import {
  addOperationsEmailGeneratedAttachment,
  addOperationsEmailManualAttachment,
  createOrGetOperationsEmailMessageFromCommunication,
  getOperationsEmailAttachmentDownload,
  getInternalWorkspaceByCode,
  getOperationsEmailMessageDetail,
  getOperationsEmailQuotePdfRender,
  getOperationsEmailScopedQuoteForRender,
  getOperationsEmailSourceLinks,
  getOperationsEmailTransferSource,
  getOperationsQuotePreview,
  isValidEmailAddress,
  listOperationsEmailAttachmentOptions,
  listOperationsEmailAttachmentsSafe,
  listOperationsEmailMessageSummaries,
  markOperationsEmailMessageReady,
  recordAdminAuditLog,
  removeOperationsEmailAttachment,
  returnOperationsEmailMessageToDraft,
  saveOperationsQuotePdfRenderAtNextRevision,
  SCANLARK_OPERATIONS_WORKSPACE_CODE,
  updateOperationsEmailMessageEditor,
  type OperationsEmailMessageStatus,
  type OperationsEmailOptimisticResult,
} from "@scanlark/db";
import { requireOperationsEmailAccess } from "../operationsAccess";
import {
  findUnresolvedClientCommunicationPlaceholders,
  sanitizeClientEmailHtml,
} from "../operationsHelpers";
import {
  OPERATIONS_EMAIL_FOLDER_STATUSES,
  parseEmailFolder,
  parseExpectedRevision,
  parseOperationsEmailEditorPatch,
  renderOperationsEmailEditorPreview,
  validateOperationsEmailReady,
} from "../operationsEmailHelpers";
import {
  getOperationsEmailAttachmentLimits,
  validateOperationsEmailUpload,
} from "../operationsEmailAttachments";
import { prepareOperationsEmailFinal } from "../operationsEmailPreparation";
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

async function emailWorkspace(res: Response) {
  const workspace = await getInternalWorkspaceByCode(
    SCANLARK_OPERATIONS_WORKSPACE_CODE,
  );
  if (!workspace) {
    sendApiError(
      res,
      503,
      "operations_workspace_missing",
      "Operations workspace is not configured",
    );
    return null;
  }
  return workspace;
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
  if (!knownPrefixes.some((prefix) => error.message.startsWith(prefix))) {
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
  router.use(requireOperationsEmailAccess);
  const attachmentLimits = getOperationsEmailAttachmentLimits();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: attachmentLimits.maxFileBytes, files: 1, fields: 2 },
  });

  router.get("/config", (req, res) => {
    return res.json({
      enabled: req.operationsCapabilities?.operationsEmailEnabled === true,
      canUseEmail: req.operationsCapabilities?.canUseOperationsEmail === true,
      implementationStage: "checkpoint-4-content-preparation",
    });
  });

  router.get("/messages", async (req, res) => {
    try {
      const workspace = await emailWorkspace(res);
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
      const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
      const workspace = await emailWorkspace(res);
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
      const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
        const workspace = await emailWorkspace(res);
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
        const preview = await getOperationsQuotePreview(quoteId);
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
          quoteId,
          snapshotSha256,
        );
        const render =
          existing ??
          (await (async () => {
            const pdf = await renderOperationsQuotePdf(snapshot);
            const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
            return saveOperationsQuotePdfRenderAtNextRevision({
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
      const workspace = await emailWorkspace(res);
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

  router.patch("/messages/:messageId", async (req, res) => {
    const messageId = uuidParam(req, res, "messageId");
    if (!messageId) return;
    try {
      const workspace = await emailWorkspace(res);
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
      const workspace = await emailWorkspace(res);
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
      const workspace = await emailWorkspace(res);
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
