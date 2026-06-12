import express from "express";
import type { Request, Response } from "express";
import {
  cancelScanJob,
  cancelScanRun,
  enqueueExistingScanRunIfIdle,
  getAdminFailedEmailForRetry,
  getAdminOverview,
  getAdminSiteDetail,
  getAdminUserDetail,
  getJobForScanRun,
  getScanRunById,
  listAdminAuditLog,
  listAdminEmailOutbox,
  listAdminScans,
  listAdminShareLinks,
  listAdminSites,
  listAdminUptime,
  listAdminUsers,
  recordAdminAuditLog,
  revokeAdminShareLink,
  setAdminSiteDisabled,
  setAdminSiteSchedulePaused,
  setAdminUptimePaused,
  setAdminUserDisabled,
  setScanRunStatus,
  type AdminActor,
} from "@scanlark/db";
import { adminGuard } from "../adminAccess";
import { sendEmail } from "../email";

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
