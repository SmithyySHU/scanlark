import express from "express";
import type { Request, Response } from "express";
import {
  cancelScanJob,
  cancelScanRun,
  getEmailTemplate,
  enqueueExistingScanRunIfIdle,
  isEmailTemplateKey,
  isValidEmailAddress,
  getAdminFailedEmailForRetry,
  getAdminOverview,
  getAdminSiteDetail,
  getAdminUserDetail,
  getJobForScanRun,
  getScanRunById,
  listAdminAuditLog,
  listAdminEmailOutbox,
  listEmailTemplates,
  listAdminScans,
  listAdminShareLinks,
  listAdminSites,
  listAdminUptime,
  listAdminUsers,
  recordAdminAuditLog,
  restoreDefaultEmailTemplate,
  revokeAdminShareLink,
  setAdminSiteDisabled,
  setAdminSiteSchedulePaused,
  setAdminUptimePaused,
  setAdminUserDisabled,
  setScanRunStatus,
  updateEmailTemplate,
  type AdminActor,
} from "@scanlark/db";
import { adminGuard } from "../adminAccess";
import { sendEmail } from "../email";
import {
  getSampleTemplateVariables,
  renderTemplateParts,
  renderTransactionalEmail,
  sanitizeEmailHtml,
  type EmailTemplateVariables,
} from "../emailTemplates";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const SCAN_STATUSES = new Set([
  "queued",
  "running",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);
const EMAIL_STATUSES = new Set([
  "queued",
  "sent",
  "failed",
  "recorded",
  "suppressed",
]);

function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
) {
  return res.status(status).json({ error, message });
}

function getActor(req: Request): AdminActor {
  if (!req.user) throw new Error("admin_actor_missing");
  return { id: req.user.id, email: req.user.email };
}

function parsePagination(req: Request) {
  const rawLimit = typeof req.query.limit === "string" ? req.query.limit : "";
  const rawOffset =
    typeof req.query.offset === "string" ? req.query.offset : "";
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;
  const parsedOffset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
  return { limit, offset };
}

function parseSearch(req: Request) {
  return typeof req.query.search === "string" ? req.query.search : null;
}

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function getTemplateKey(req: Request, res: Response) {
  const key = req.params.key;
  if (!isEmailTemplateKey(key)) {
    sendApiError(
      res,
      404,
      "email_template_not_found",
      "Email template not found",
    );
    return null;
  }
  return key;
}

function parseTemplateBody(body: unknown) {
  const input = body as Record<string, unknown>;
  const subjectTemplate =
    typeof input.subjectTemplate === "string" ? input.subjectTemplate : "";
  const htmlTemplate =
    typeof input.htmlTemplate === "string" ? input.htmlTemplate : "";
  const rawTextTemplate =
    typeof input.textTemplate === "string" ? input.textTemplate : null;
  const enabled =
    typeof input.enabled === "boolean" ? input.enabled : Boolean(input.enabled);
  const changeNote =
    typeof input.changeNote === "string" && input.changeNote.trim()
      ? input.changeNote.trim().slice(0, 500)
      : null;
  return {
    subjectTemplate: subjectTemplate.trim(),
    htmlTemplate: sanitizeEmailHtml(htmlTemplate).trim(),
    textTemplate: rawTextTemplate,
    enabled,
    changeNote,
  };
}

function parseVariables(body: unknown): EmailTemplateVariables {
  const input = body as Record<string, unknown>;
  if (!input || typeof input.variables !== "object" || !input.variables) {
    return {};
  }
  return Object.entries(input.variables as Record<string, unknown>).reduce(
    (values, [key, value]) => {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) return values;
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null
      ) {
        values[key] = value;
      }
      return values;
    },
    {} as EmailTemplateVariables,
  );
}

function mountListRoutes(router: express.Router) {
  router.get("/overview", async (_req, res) => {
    try {
      return res.json(await getAdminOverview());
    } catch (err) {
      console.error("Admin overview failed", err);
      return sendApiError(
        res,
        500,
        "admin_overview_failed",
        "Failed to load admin overview",
      );
    }
  });

  router.get("/users", async (req, res) => {
    try {
      return res.json({
        users: await listAdminUsers({
          ...parsePagination(req),
          search: parseSearch(req),
        }),
      });
    } catch (err) {
      console.error("Admin users list failed", err);
      return sendApiError(
        res,
        500,
        "admin_users_failed",
        "Failed to load users",
      );
    }
  });

  router.get("/users/:userId", async (req, res) => {
    try {
      const detail = await getAdminUserDetail(req.params.userId);
      if (!detail) {
        return sendApiError(res, 404, "not_found", "User not found");
      }
      return res.json(detail);
    } catch (err) {
      console.error("Admin user detail failed", err);
      return sendApiError(res, 500, "admin_user_failed", "Failed to load user");
    }
  });

  router.get("/sites", async (req, res) => {
    try {
      return res.json({
        sites: await listAdminSites({
          ...parsePagination(req),
          search: parseSearch(req),
        }),
      });
    } catch (err) {
      console.error("Admin sites list failed", err);
      return sendApiError(
        res,
        500,
        "admin_sites_failed",
        "Failed to load sites",
      );
    }
  });

  router.get("/sites/:siteId", async (req, res) => {
    try {
      const detail = await getAdminSiteDetail(req.params.siteId);
      if (!detail) {
        return sendApiError(res, 404, "not_found", "Site not found");
      }
      return res.json(detail);
    } catch (err) {
      console.error("Admin site detail failed", err);
      return sendApiError(res, 500, "admin_site_failed", "Failed to load site");
    }
  });

  router.get("/scans", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    if (status && !SCAN_STATUSES.has(status)) {
      return sendApiError(
        res,
        400,
        "invalid_status",
        "Scan status filter is invalid",
      );
    }
    try {
      return res.json({
        scans: await listAdminScans({
          ...parsePagination(req),
          status: status || null,
        }),
      });
    } catch (err) {
      console.error("Admin scans list failed", err);
      return sendApiError(
        res,
        500,
        "admin_scans_failed",
        "Failed to load scans",
      );
    }
  });

  router.get("/uptime", async (req, res) => {
    try {
      return res.json({
        monitors: await listAdminUptime(parsePagination(req)),
      });
    } catch (err) {
      console.error("Admin uptime list failed", err);
      return sendApiError(
        res,
        500,
        "admin_uptime_failed",
        "Failed to load uptime monitors",
      );
    }
  });

  router.get("/email-outbox", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : "";
    if (status && !EMAIL_STATUSES.has(status)) {
      return sendApiError(
        res,
        400,
        "invalid_status",
        "Email status filter is invalid",
      );
    }
    try {
      return res.json({
        emails: await listAdminEmailOutbox({
          ...parsePagination(req),
          status: status || null,
        }),
      });
    } catch (err) {
      console.error("Admin email list failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_failed",
        "Failed to load email outbox",
      );
    }
  });

  router.get("/email-templates", async (_req, res) => {
    try {
      return res.json({ templates: await listEmailTemplates() });
    } catch (err) {
      console.error("Admin email templates list failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_templates_failed",
        "Failed to load email templates",
      );
    }
  });

  router.get("/email-templates/:key", async (req, res) => {
    const key = getTemplateKey(req, res);
    if (!key) return;
    try {
      const template = await getEmailTemplate(key);
      if (!template) {
        return sendApiError(
          res,
          404,
          "email_template_not_found",
          "Email template not found",
        );
      }
      return res.json({ template });
    } catch (err) {
      console.error("Admin email template detail failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_template_failed",
        "Failed to load email template",
      );
    }
  });

  router.get("/share-links", async (req, res) => {
    try {
      return res.json({
        shares: await listAdminShareLinks(parsePagination(req)),
      });
    } catch (err) {
      console.error("Admin share list failed", err);
      return sendApiError(
        res,
        500,
        "admin_shares_failed",
        "Failed to load share links",
      );
    }
  });

  router.get("/audit-log", async (req, res) => {
    try {
      return res.json({
        actions: await listAdminAuditLog(parsePagination(req)),
      });
    } catch (err) {
      console.error("Admin audit log failed", err);
      return sendApiError(
        res,
        500,
        "admin_audit_failed",
        "Failed to load audit log",
      );
    }
  });
}

function mountActionRoutes(router: express.Router) {
  router.post("/users/:userId/disable", async (req, res) => {
    const actor = getActor(req);
    if (req.params.userId === actor.id) {
      return sendApiError(
        res,
        400,
        "cannot_disable_self",
        "Admins cannot disable their own account",
      );
    }
    try {
      const user = await setAdminUserDisabled(actor, req.params.userId, true);
      if (!user) return sendApiError(res, 404, "not_found", "User not found");
      return res.json({ user });
    } catch (err) {
      console.error("Admin disable user failed", err);
      return sendApiError(
        res,
        500,
        "admin_user_disable_failed",
        "Failed to disable user",
      );
    }
  });

  router.post("/users/:userId/enable", async (req, res) => {
    try {
      const user = await setAdminUserDisabled(
        getActor(req),
        req.params.userId,
        false,
      );
      if (!user) return sendApiError(res, 404, "not_found", "User not found");
      return res.json({ user });
    } catch (err) {
      console.error("Admin enable user failed", err);
      return sendApiError(
        res,
        500,
        "admin_user_enable_failed",
        "Failed to enable user",
      );
    }
  });

  router.post("/sites/:siteId/disable", async (req, res) => {
    try {
      const site = await setAdminSiteDisabled(
        getActor(req),
        req.params.siteId,
        true,
      );
      if (!site) return sendApiError(res, 404, "not_found", "Site not found");
      return res.json({ site });
    } catch (err) {
      console.error("Admin disable site failed", err);
      return sendApiError(
        res,
        500,
        "admin_site_disable_failed",
        "Failed to disable site",
      );
    }
  });

  router.post("/sites/:siteId/enable", async (req, res) => {
    try {
      const site = await setAdminSiteDisabled(
        getActor(req),
        req.params.siteId,
        false,
      );
      if (!site) return sendApiError(res, 404, "not_found", "Site not found");
      return res.json({ site });
    } catch (err) {
      console.error("Admin enable site failed", err);
      return sendApiError(
        res,
        500,
        "admin_site_enable_failed",
        "Failed to enable site",
      );
    }
  });

  router.post("/sites/:siteId/scheduled-scans/pause", async (req, res) => {
    try {
      const schedule = await setAdminSiteSchedulePaused(
        getActor(req),
        req.params.siteId,
        true,
      );
      if (!schedule) {
        return sendApiError(res, 404, "not_found", "Site not found");
      }
      return res.json({ schedule });
    } catch (err) {
      console.error("Admin pause schedule failed", err);
      return sendApiError(
        res,
        500,
        "admin_schedule_pause_failed",
        "Failed to pause scheduled scans",
      );
    }
  });

  router.post("/sites/:siteId/scheduled-scans/resume", async (req, res) => {
    try {
      const schedule = await setAdminSiteSchedulePaused(
        getActor(req),
        req.params.siteId,
        false,
      );
      if (!schedule) {
        return sendApiError(res, 404, "not_found", "Site not found");
      }
      return res.json({ schedule });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to resume scheduled scans");
      if (message === "manual_schedule_not_resumable") {
        return sendApiError(
          res,
          400,
          "manual_schedule_not_resumable",
          "Manual schedules cannot be resumed",
        );
      }
      if (message === "site_disabled") {
        return sendApiError(
          res,
          400,
          "site_disabled",
          "Enable the site before resuming scheduled scans",
        );
      }
      console.error("Admin resume schedule failed", err);
      return sendApiError(
        res,
        500,
        "admin_schedule_resume_failed",
        "Failed to resume scheduled scans",
      );
    }
  });

  router.post("/scans/:scanRunId/cancel", async (req, res) => {
    const scanRunId = req.params.scanRunId;
    try {
      const run = await getScanRunById(scanRunId);
      if (!run) return sendApiError(res, 404, "not_found", "Scan not found");
      if (run.status !== "queued" && run.status !== "in_progress") {
        return sendApiError(
          res,
          400,
          "scan_not_cancellable",
          "Only queued or running scans can be cancelled",
        );
      }
      const job = await getJobForScanRun(scanRunId);
      if (job && job.status !== "completed") {
        await cancelScanJob(job.id);
      }
      await cancelScanRun(scanRunId);
      await recordAdminAuditLog(getActor(req), {
        action: "scan.cancel",
        targetType: "scan_run",
        targetId: scanRunId,
        metadata: { siteId: run.site_id, previousStatus: run.status },
      });
      return res.json({ ok: true, status: "cancelled" });
    } catch (err) {
      console.error("Admin cancel scan failed", err);
      return sendApiError(
        res,
        500,
        "admin_scan_cancel_failed",
        "Failed to cancel scan",
      );
    }
  });

  router.post("/scans/:scanRunId/retry", async (req, res) => {
    const scanRunId = req.params.scanRunId;
    try {
      const run = await getScanRunById(scanRunId);
      if (!run) return sendApiError(res, 404, "not_found", "Scan not found");
      if (run.status !== "failed" && run.status !== "cancelled") {
        return sendApiError(
          res,
          400,
          "scan_not_retryable",
          "Only failed or cancelled scans can be retried",
        );
      }
      const enqueueResult = await enqueueExistingScanRunIfIdle({
        scanRunId,
        siteId: run.site_id,
      });
      if (!enqueueResult.created) {
        return res.status(409).json({
          error: "active_scan_exists",
          message: "This site already has queued or running scan work",
          active: enqueueResult.active,
        });
      }
      await setScanRunStatus(scanRunId, "queued", {
        errorMessage: null,
        clearFinishedAt: true,
      });
      await recordAdminAuditLog(getActor(req), {
        action: "scan.retry",
        targetType: "scan_run",
        targetId: scanRunId,
        metadata: { siteId: run.site_id, jobId: enqueueResult.jobId },
      });
      return res.json({
        scanRunId,
        jobId: enqueueResult.jobId,
        status: "queued",
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to retry scan");
      if (message === "site_not_found") {
        return sendApiError(
          res,
          400,
          "site_not_available",
          "The site is disabled or unavailable",
        );
      }
      console.error("Admin retry scan failed", err);
      return sendApiError(
        res,
        500,
        "admin_scan_retry_failed",
        "Failed to retry scan",
      );
    }
  });

  router.post("/uptime/:settingsId/pause", async (req, res) => {
    try {
      const monitor = await setAdminUptimePaused(
        getActor(req),
        req.params.settingsId,
        true,
      );
      if (!monitor) {
        return sendApiError(res, 404, "not_found", "Uptime monitor not found");
      }
      return res.json({ monitor });
    } catch (err) {
      console.error("Admin pause uptime failed", err);
      return sendApiError(
        res,
        500,
        "admin_uptime_pause_failed",
        "Failed to pause uptime monitor",
      );
    }
  });

  router.post("/uptime/:settingsId/resume", async (req, res) => {
    try {
      const monitor = await setAdminUptimePaused(
        getActor(req),
        req.params.settingsId,
        false,
      );
      if (!monitor) {
        return sendApiError(
          res,
          400,
          "uptime_not_resumable",
          "Uptime monitor was not found or its site is disabled",
        );
      }
      return res.json({ monitor });
    } catch (err) {
      console.error("Admin resume uptime failed", err);
      return sendApiError(
        res,
        500,
        "admin_uptime_resume_failed",
        "Failed to resume uptime monitor",
      );
    }
  });

  router.post("/email-outbox/:entryId/retry", async (req, res) => {
    const actor = getActor(req);
    try {
      const entry = await getAdminFailedEmailForRetry(req.params.entryId);
      if (!entry) {
        return sendApiError(
          res,
          404,
          "not_found",
          "Failed email outbox entry not found",
        );
      }
      let deliveryError: string | null = null;
      try {
        await sendEmail({
          to: entry.to_email,
          subject: entry.subject,
          html: entry.html_body,
          text: entry.text_body ?? undefined,
          userId: entry.user_id,
          siteId: entry.site_id,
          scanRunId: entry.scan_run_id,
          metadata: {
            ...(entry.metadata ?? {}),
            adminRetryOf: entry.id,
          },
        });
      } catch (err) {
        deliveryError = getErrorMessage(err, "email_send_failed");
      }
      await recordAdminAuditLog(actor, {
        action: "email.retry",
        targetType: "email_outbox",
        targetId: entry.id,
        metadata: {
          recipient: entry.to_email,
          subject: entry.subject,
          deliveryStatus: deliveryError ? "failed" : "sent_or_recorded",
          deliveryError,
        },
      });
      return res.status(deliveryError ? 202 : 200).json({
        ok: true,
        deliveryStatus: deliveryError ? "failed" : "sent_or_recorded",
        message: deliveryError
          ? "Retry attempted, but SMTP delivery failed"
          : "Email retry attempted",
      });
    } catch (err) {
      console.error("Admin retry email failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_retry_failed",
        "Failed to retry email",
      );
    }
  });

  router.patch("/email-templates/:key", async (req, res) => {
    const key = getTemplateKey(req, res);
    if (!key) return;
    const actor = getActor(req);
    const body = parseTemplateBody(req.body);
    if (!body.subjectTemplate || !body.htmlTemplate) {
      return sendApiError(
        res,
        400,
        "invalid_email_template",
        "Subject and HTML template are required",
      );
    }
    try {
      const template = await updateEmailTemplate(key, {
        ...body,
        changedByUserId: actor.id,
      });
      await recordAdminAuditLog(actor, {
        action: "email_template.update",
        targetType: "email_template",
        targetId: key,
        metadata: {
          enabled: template.enabled,
          version: template.version,
          changeNote: body.changeNote,
        },
      });
      return res.json({ template });
    } catch (err) {
      console.error("Admin update email template failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_template_update_failed",
        "Failed to update email template",
      );
    }
  });

  router.post("/email-templates/:key/preview", async (req, res) => {
    const key = getTemplateKey(req, res);
    if (!key) return;
    try {
      const input = req.body as Record<string, unknown>;
      const variables = getSampleTemplateVariables(
        key,
        parseVariables(req.body),
      );
      const subjectTemplate =
        typeof input.subjectTemplate === "string"
          ? input.subjectTemplate
          : undefined;
      const htmlTemplate =
        typeof input.htmlTemplate === "string" ? input.htmlTemplate : undefined;
      const textTemplate =
        typeof input.textTemplate === "string" ? input.textTemplate : undefined;

      if (subjectTemplate !== undefined || htmlTemplate !== undefined) {
        if (!subjectTemplate?.trim() || !htmlTemplate?.trim()) {
          return sendApiError(
            res,
            400,
            "invalid_email_template",
            "Subject and HTML template are required for preview",
          );
        }
        const preview = renderTemplateParts(
          {
            subjectTemplate,
            htmlTemplate: sanitizeEmailHtml(htmlTemplate),
            textTemplate: textTemplate ?? null,
          },
          variables,
        );
        return res.json({ preview, variables });
      }

      const preview = await renderTransactionalEmail(key, variables);
      return res.json({ preview, variables });
    } catch (err) {
      console.error("Admin preview email template failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_template_preview_failed",
        "Failed to preview email template",
      );
    }
  });

  router.post("/email-templates/:key/test", async (req, res) => {
    const key = getTemplateKey(req, res);
    if (!key) return;
    const actor = getActor(req);
    const input = req.body as Record<string, unknown>;
    const toEmail =
      typeof input.toEmail === "string" && input.toEmail.trim()
        ? input.toEmail.trim()
        : actor.email;
    if (!isValidEmailAddress(toEmail)) {
      return sendApiError(
        res,
        400,
        "invalid_email",
        "Please enter a valid email address",
      );
    }

    try {
      const email = await renderTransactionalEmail(
        key,
        getSampleTemplateVariables(key, {
          ...parseVariables(req.body),
          recipientEmail: toEmail,
        }),
      );
      let deliveryError: string | null = null;
      try {
        await sendEmail({
          to: toEmail,
          subject: email.subject,
          html: email.html,
          text: email.text,
          userId: actor.id,
          siteId: null,
          scanRunId: null,
          metadata: {
            adminTemplateTest: true,
            templateKey: key,
            templateSource: email.source,
          },
        });
      } catch (err) {
        deliveryError = getErrorMessage(err, "email_send_failed");
      }
      await recordAdminAuditLog(actor, {
        action: "email_template.test",
        targetType: "email_template",
        targetId: key,
        metadata: {
          recipient: toEmail,
          templateSource: email.source,
          deliveryStatus: deliveryError ? "failed" : "sent_or_recorded",
          deliveryError,
        },
      });
      return res.status(deliveryError ? 202 : 200).json({
        ok: true,
        deliveryStatus: deliveryError ? "failed" : "sent_or_recorded",
        message: deliveryError
          ? "Test email was recorded, but SMTP delivery failed"
          : "Test email send attempted",
      });
    } catch (err) {
      console.error("Admin test email template failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_template_test_failed",
        "Failed to send template test email",
      );
    }
  });

  router.post("/email-templates/:key/restore-default", async (req, res) => {
    const key = getTemplateKey(req, res);
    if (!key) return;
    const actor = getActor(req);
    try {
      const template = await restoreDefaultEmailTemplate(key, {
        changedByUserId: actor.id,
        changeNote: "Restored default template from admin console",
      });
      await recordAdminAuditLog(actor, {
        action: "email_template.restore_default",
        targetType: "email_template",
        targetId: key,
        metadata: {
          version: template.version,
        },
      });
      return res.json({ template });
    } catch (err) {
      console.error("Admin restore email template failed", err);
      return sendApiError(
        res,
        500,
        "admin_email_template_restore_failed",
        "Failed to restore default email template",
      );
    }
  });

  router.post("/share-links/:shareId/revoke", async (req, res) => {
    try {
      const share = await revokeAdminShareLink(
        getActor(req),
        req.params.shareId,
      );
      if (!share) {
        return sendApiError(res, 404, "not_found", "Share link not found");
      }
      return res.json({ share });
    } catch (err) {
      console.error("Admin revoke share failed", err);
      return sendApiError(
        res,
        500,
        "admin_share_revoke_failed",
        "Failed to revoke share link",
      );
    }
  });
}

export function mountAdminRoutes(app: express.Application) {
  const router = express.Router();
  router.use(adminGuard);
  mountListRoutes(router);
  mountActionRoutes(router);
  app.use("/admin", router);
}
