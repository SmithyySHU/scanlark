import dotenv from "dotenv";
import express from "express";
import type { Response } from "express";
import cors from "cors";
import type {
  ExportClassification,
  IgnoreRuleType,
  LinkClassification,
  ReportShareWithToken,
  ScanIssueCategory,
  ScanIssueType,
  ScanIssueSeverity,
  ScanIssueStatus,
  ScanDiffChangeType,
  ScanLinkOccurrenceRow,
  SiteMetadataFields,
} from "@scanlark/db";
import {
  applyIgnoreRulesForScanRun,
  cacheSiteAvatarForUser,
  cancelScanJob,
  cancelScanRun,
  createSiteForUser,
  createOrRotateReportShareForRunForUser,
  createIgnoreRule,
  createScanAppNotificationsForRun,
  deleteIgnoreRule,
  deleteSiteForUser,
  disableReportShareForRunForUser,
  enqueueExistingScanRunIfIdle,
  enqueueManualScanIfIdle,
  formatIssuePresentation,
  getDiffBetweenRunsForUser,
  getBaselineRunForDiff,
  getCompletedRunForSite,
  getFixQueueForRuns,
  getJobForScanRun,
  getLatestCompletedScanForSiteForUser,
  getLatestScanForSiteForUser,
  getUnreadAppNotificationCount,
  getUserNotificationPreferences,
  getOccurrencesForScanLinkForUser,
  getRecentScanRunsForSiteForUser,
  getRecentScansForSiteForUser,
  getReportShareForRunForUser,
  getResultsForScanRunForUser,
  getResultsSummaryForScanRunForUser,
  getSharedReportAccessByToken,
  getScanLinkByIdForUser,
  getScanLinkByRunAndUrlForUser,
  getScanCategoryScoresForUser,
  getScanLinksForRun,
  getScanLinksForExportFilteredForUser,
  getScanLinksForExportForUser,
  getScanLinksForRunForUser,
  getScanLinksSummary,
  getScanLinksSummaryForUser,
  getScanDiff,
  getScanRunByIdForUser,
  getScanRunById,
  getSiteAvatarForUser,
  getSiteByIdForUser,
  getSiteById,
  getSiteNotificationSettingsForUser,
  getScanTechnicalDiagnosticsForUser,
  listSitesForUser,
  getSiteScheduleForUser,
  getTimeoutCountForRun,
  getTimeoutCountForRunForUser,
  getTopLinksByClassification,
  getTopLinksByClassificationForUser,
  insertIgnoredOccurrence,
  isValidEmailAddress,
  getLinkNoteForSiteByUrlForUser,
  getIgnoreRuleByIdForUser,
  listIgnoreRulesForUser,
  listIgnoreRulesForSiteForUser,
  listIgnoredLinksForRun,
  listIgnoredLinksForRunForUser,
  listIgnoredOccurrences,
  listIgnoredOccurrencesForUser,
  listRecentAppNotificationsForUser,
  listIssuesForScanRun,
  listIssuesForScanRunForUser,
  listLinkNotesForSiteForUser,
  markAllAppNotificationsReadForUser,
  markAppNotificationReadForUser,
  markSiteAvatarUnavailableForUser,
  recordReportShareView,
  replaceIssuesForScanRun,
  setIgnoreRuleEnabled,
  setScanLinkIgnoredForRun,
  setScanRunIssueGenerationStatus,
  setScanRunStatus,
  deleteLinkNoteForSiteForUser,
  updateLinkNoteForSiteForUser,
  upsertLinkNoteForSiteForUser,
  updateSiteNotificationSettingsForUser,
  updateSiteScheduleForUser,
  updateUserProfile,
  updateUserNotificationPreferences,
  updateScanLinkAfterRecheck,
  upsertIgnoredLink,
  updateSiteMetadataForUser,
  USER_NOTIFICATION_PREFERENCE_FIELDS,
  validateSafeRegexPattern,
  type UserNotificationPreferences,
} from "@scanlark/db";
import validateLink from "../../../packages/crawler/src/validateLink";
import { validateCrawlTarget } from "../../../packages/crawler/src/fetchUrl";
import { classifyStatus } from "../../../packages/crawler/src/classifyStatus";
import {
  MAX_REDIRECTS,
  REQUEST_TIMEOUT_MS,
  SCANLARK_USER_AGENT,
} from "../../../packages/crawler/src/limits";
import { mountScanRunEvents } from "./routes/scanRunEvents";
import { serializeScanRun } from "./serializers";
import { notifyIfNeeded, sendTestEmail } from "./notifyOnScanComplete";
import { authMiddleware, initDemoAuth } from "./authMiddleware";
import { sessionMiddleware } from "./auth";
import { mountAuthRoutes } from "./routes/auth";
import { initEventRelay, mountEventStream } from "./events";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

const LINK_CLASSIFICATIONS = new Set<LinkClassification>([
  "ok",
  "broken",
  "blocked",
  "no_response",
]);
const EXPORT_CLASSIFICATIONS = new Set<ExportClassification>([
  "all",
  "ok",
  "broken",
  "blocked",
  "no_response",
  "timeout",
]);
const STATUS_GROUPS = new Set(["all", "no_response", "http_error"]);
const STATUS_FILTERS = new Set(["401/403/429", "404", "5xx", "no_response"]);
const EXPORT_SORT_OPTIONS = new Set([
  "severity",
  "occ_desc",
  "status_asc",
  "status_desc",
  "recent",
]);
const DIFF_CHANGE_TYPES = new Set<ScanDiffChangeType>([
  "new_issue",
  "fixed",
  "changed",
  "added",
  "removed",
]);
const SCHEDULE_FREQUENCIES = new Set(["manual", "daily", "weekly", "monthly"]);
const NOTIFY_ON_OPTIONS = new Set([
  "always",
  "issues",
  "issues_exist",
  "new_issues_only",
  "never",
]);
const LINK_NOTE_STATUSES = new Set(["open", "snoozed", "resolved", "all"]);
const ISSUE_CATEGORIES = new Set<ScanIssueCategory>([
  "link_integrity",
  "seo_basic",
  "ssl_https",
  "security_header",
  "sitemap",
  "robots",
  "performance_basic",
]);
const ISSUE_SEVERITIES = new Set<ScanIssueSeverity>([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);
const ISSUE_STATUSES = new Set<ScanIssueStatus>(["open", "resolved"]);
const EMAIL_TEST_TO = process.env.EMAIL_TEST_TO;
const API_INTERNAL_TOKEN = process.env.API_INTERNAL_TOKEN;
const DASHBOARD_ISSUE_CATEGORIES: ScanIssueCategory[] = [
  "link_integrity",
  "seo_basic",
  "robots",
  "sitemap",
  "ssl_https",
  "security_header",
  "performance_basic",
];

function isValidTimeUtc(value: string) {
  const parts = value.split(":");
  if (parts.length < 2) return false;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;
  return true;
}

type ExportSortOption =
  | "severity"
  | "occ_desc"
  | "status_asc"
  | "status_desc"
  | "recent";
const IGNORE_RULE_TYPES = new Set<IgnoreRuleType>([
  "contains",
  "regex",
  "exact",
  "status_code",
  "classification",
  "domain",
  "path_prefix",
]);

function parseClassification(value: unknown): LinkClassification | undefined {
  if (typeof value !== "string") return undefined;
  return LINK_CLASSIFICATIONS.has(value as LinkClassification)
    ? (value as LinkClassification)
    : undefined;
}

function parseExportClassification(value: unknown): ExportClassification {
  if (typeof value !== "string") return "all";
  return EXPORT_CLASSIFICATIONS.has(value as ExportClassification)
    ? (value as ExportClassification)
    : "all";
}

function parseStatusGroup(
  value: unknown,
): "all" | "no_response" | "http_error" {
  if (typeof value !== "string") return "all";
  return STATUS_GROUPS.has(value)
    ? (value as "all" | "no_response" | "http_error")
    : "all";
}

function parseStatusFilters(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.filter((part) => STATUS_FILTERS.has(part));
}

function parseSortOption(value: unknown): ExportSortOption {
  if (typeof value !== "string") return "severity";
  return EXPORT_SORT_OPTIONS.has(value)
    ? (value as ExportSortOption)
    : "severity";
}

function parseIgnoreRuleType(value: unknown): IgnoreRuleType | null {
  if (typeof value !== "string") return null;
  return IGNORE_RULE_TYPES.has(value as IgnoreRuleType)
    ? (value as IgnoreRuleType)
    : null;
}

function parseLinkNoteStatus(
  value: unknown,
  fallback: "all" | "open" = "all",
): "open" | "snoozed" | "resolved" | "all" {
  if (typeof value !== "string") return fallback;
  return LINK_NOTE_STATUSES.has(value)
    ? (value as "open" | "snoozed" | "resolved" | "all")
    : fallback;
}

function parseIssueStatus(value: unknown): ScanIssueStatus | null {
  if (typeof value !== "string") return null;
  return ISSUE_STATUSES.has(value as ScanIssueStatus)
    ? (value as ScanIssueStatus)
    : null;
}

function parseIssueSeverity(value: unknown): ScanIssueSeverity | null {
  if (typeof value !== "string") return null;
  return ISSUE_SEVERITIES.has(value as ScanIssueSeverity)
    ? (value as ScanIssueSeverity)
    : null;
}

function parseIssueCategory(value: unknown): ScanIssueCategory | null {
  if (typeof value !== "string") return null;
  return ISSUE_CATEGORIES.has(value as ScanIssueCategory)
    ? (value as ScanIssueCategory)
    : null;
}

function parseOptionalSiteMetadataField(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return "__invalid__";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNotifyOn(value: string): string {
  if (value === "issues") return "issues_exist";
  return value;
}

function serializeIssueWithPresentation<
  T extends {
    first_seen_at: Date | string;
    last_seen_at: Date | string;
    resolved_at: Date | string | null;
    title: string;
    description: string;
    issue_type: ScanIssueType;
    affected_url: string;
    source_url: string | null;
    evidence_json: Record<string, unknown>;
  },
>(issue: T) {
  return {
    ...issue,
    presentation: formatIssuePresentation(issue),
    first_seen_at:
      issue.first_seen_at instanceof Date
        ? issue.first_seen_at.toISOString()
        : issue.first_seen_at,
    last_seen_at:
      issue.last_seen_at instanceof Date
        ? issue.last_seen_at.toISOString()
        : issue.last_seen_at,
    resolved_at:
      issue.resolved_at instanceof Date
        ? issue.resolved_at.toISOString()
        : issue.resolved_at,
  };
}

async function rebuildIssuesForRun(scanRunId: string) {
  await setScanRunIssueGenerationStatus(scanRunId, "pending");
  try {
    const result = await replaceIssuesForScanRun(scanRunId);
    await setScanRunIssueGenerationStatus(scanRunId, "completed", null);
    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "issue_generation_failed";
    await setScanRunIssueGenerationStatus(scanRunId, "failed", message);
    throw err;
  }
}

function validateIgnoreRulePattern(
  ruleType: IgnoreRuleType,
  pattern: string,
): string | null {
  if (ruleType === "regex") {
    return validateSafeRegexPattern(pattern);
  }
  return null;
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const MAX_SITE_AVATAR_BYTES = 256 * 1024;
const MAX_AVATAR_HTML_BYTES = 200 * 1024;
const AVATAR_IMAGE_CONTENT_TYPES = new Set([
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
  "image/gif",
]);

type AvatarFetchResult =
  | {
      ok: true;
      finalUrl: string;
      contentType: string;
      content: Buffer;
    }
  | { ok: false; error: string };

function normalizeContentType(value: string | null) {
  return value?.split(";")[0]?.trim().toLowerCase() ?? "";
}

async function readResponseBufferWithLimit(
  res: globalThis.Response,
  maxBytes: number,
): Promise<Buffer | null> {
  if (!res.body) {
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.byteLength <= maxBytes ? buffer : null;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function fetchAvatarCandidate(
  rawUrl: string,
): Promise<AvatarFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let currentUrl = (await validateCrawlTarget(rawUrl)).toString();
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": SCANLARK_USER_AGENT,
          accept: "image/*,*/*;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, error: "redirect_without_location" };
        if (i === MAX_REDIRECTS)
          return { ok: false, error: "too_many_redirects" };
        currentUrl = (
          await validateCrawlTarget(new URL(location, currentUrl).toString())
        ).toString();
        continue;
      }

      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

      const contentType = normalizeContentType(res.headers.get("content-type"));
      if (!AVATAR_IMAGE_CONTENT_TYPES.has(contentType)) {
        return { ok: false, error: "unsupported_content_type" };
      }

      const contentLength = Number(res.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_SITE_AVATAR_BYTES
      ) {
        return { ok: false, error: "response_too_large" };
      }

      const content = await readResponseBufferWithLimit(
        res,
        MAX_SITE_AVATAR_BYTES,
      );
      if (!content || content.byteLength === 0) {
        return {
          ok: false,
          error: content ? "empty_response" : "response_too_large",
        };
      }

      return { ok: true, finalUrl: currentUrl, contentType, content };
    }
    return { ok: false, error: "too_many_redirects" };
  } catch (err: unknown) {
    return { ok: false, error: getErrorMessage(err) };
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractHtmlAttributes(tag: string) {
  const attrs: Record<string, string> = {};
  const attrPattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/g;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(tag)) !== null) {
    const raw = match[2];
    const value =
      raw.startsWith('"') || raw.startsWith("'") ? raw.slice(1, -1) : raw;
    attrs[match[1].toLowerCase()] = decodeHtmlAttribute(value);
  }
  return attrs;
}

function discoverIconCandidatesFromHtml(html: string, baseUrl: string) {
  const iconCandidates: string[] = [];
  const appleCandidates: string[] = [];
  const linkPattern = /<link\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const attrs = extractHtmlAttributes(match[0]);
    const relTokens = (attrs.rel ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (!attrs.href || relTokens.length === 0) continue;
    const isApple = relTokens.includes("apple-touch-icon");
    const isIcon = relTokens.includes("icon") && !isApple;
    if (!isIcon && !isApple) continue;
    try {
      const resolved = new URL(attrs.href, baseUrl).toString();
      if (isApple) appleCandidates.push(resolved);
      else iconCandidates.push(resolved);
    } catch {}
  }
  return [...iconCandidates, ...appleCandidates];
}

async function fetchHomepageHtmlForAvatar(siteUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let currentUrl = (await validateCrawlTarget(siteUrl)).toString();
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": SCANLARK_USER_AGENT,
          accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location || i === MAX_REDIRECTS) return null;
        currentUrl = (
          await validateCrawlTarget(new URL(location, currentUrl).toString())
        ).toString();
        continue;
      }
      if (!res.ok) return null;
      const contentType = normalizeContentType(res.headers.get("content-type"));
      if (contentType && !contentType.includes("html")) return null;
      const buffer = await readResponseBufferWithLimit(
        res,
        MAX_AVATAR_HTML_BYTES,
      );
      if (!buffer) return null;
      return { html: buffer.toString("utf8"), finalUrl: currentUrl };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function refreshSiteAvatar(userId: string, siteId: string) {
  const site = await getSiteByIdForUser(userId, siteId);
  if (!site) return null;

  const candidates: string[] = [];
  try {
    const origin = new URL(site.url).origin;
    candidates.push(new URL("/favicon.ico", origin).toString());
  } catch {
    const updated = await markSiteAvatarUnavailableForUser(
      userId,
      siteId,
      "failed",
      "invalid_site_url",
    );
    return updated;
  }

  const homepage = await fetchHomepageHtmlForAvatar(site.url);
  if (homepage) {
    candidates.push(
      ...discoverIconCandidatesFromHtml(homepage.html, homepage.finalUrl),
    );
  }

  const uniqueCandidates = Array.from(new Set(candidates));
  let lastError: string | null = null;
  for (const candidate of uniqueCandidates) {
    const result = await fetchAvatarCandidate(candidate);
    if (result.ok) {
      return cacheSiteAvatarForUser(userId, siteId, {
        sourceUrl: result.finalUrl,
        contentType: result.contentType,
        content: result.content,
      });
    }
    lastError = result.error;
  }

  return markSiteAvatarUnavailableForUser(
    userId,
    siteId,
    "missing",
    lastError ?? "no_favicon_found",
  );
}

function startSiteAvatarRefresh(userId: string, siteId: string) {
  void refreshSiteAvatar(userId, siteId).catch((err) => {
    console.warn("Failed to refresh site avatar", { siteId, err });
  });
}

type ApiErrorPayload = {
  error: string;
  message: string;
  details?: string;
};

type UptimeMonitorStatus = "up" | "down" | "degraded" | "unknown";

type UptimeStatusResponse = {
  settingsId: string;
  siteId: string;
  enabled: boolean;
  checkUrl: string;
  intervalMinutes: number;
  failureThreshold: number;
  status: UptimeMonitorStatus;
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastUpAt: string | null;
  lastDownAt: string | null;
  lastRecoveredAt: string | null;
  lastResponseTimeMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  uptime30d: number | null;
  activeIncidentId: string | null;
  recentChecks: Array<{
    id: string;
    status: UptimeMonitorStatus;
    status_code: number | null;
    response_time_ms: number | null;
    error_message: string | null;
    checked_at: string;
  }>;
};

type UptimeModule = {
  getUptimeStatusForSiteForUser: (
    userId: string,
    siteId: string,
    recentLimit?: number,
  ) => Promise<UptimeStatusResponse>;
  updateUptimeMonitorSettingsForUser: (
    userId: string,
    siteId: string,
    fields: {
      enabled?: boolean;
      checkUrl?: string;
      failureThreshold?: number;
    },
  ) => Promise<unknown>;
};

async function loadUptimeModule(): Promise<UptimeModule> {
  const modulePath = "../../../packages/db/src/uptimeMonitors.js";
  return (await import(modulePath)) as UptimeModule;
}

function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
  details?: string,
) {
  const payload: ApiErrorPayload = { error, message };
  if (details) payload.details = details;
  return res.status(status).json(payload);
}

function sendInternalError(res: Response, message: string, err?: unknown) {
  return sendApiError(
    res,
    500,
    "internal_error",
    message,
    err ? getErrorMessage(err) : undefined,
  );
}

function sendNotFound(res: Response) {
  return sendApiError(res, 404, "not_found", "Not found");
}

function serializeReportShare(
  req: express.Request,
  share: ReportShareWithToken,
) {
  const baseUrl = `${req.protocol}://${req.get("host") ?? "localhost"}`;
  return {
    id: share.id,
    enabled: share.enabled,
    created_at:
      share.created_at instanceof Date
        ? share.created_at.toISOString()
        : share.created_at,
    disabled_at:
      share.disabled_at instanceof Date
        ? share.disabled_at.toISOString()
        : share.disabled_at,
    last_viewed_at:
      share.last_viewed_at instanceof Date
        ? share.last_viewed_at.toISOString()
        : share.last_viewed_at,
    view_count: share.view_count,
    shareToken: share.shareToken,
    shareUrl: `${baseUrl}/shared-reports/${encodeURIComponent(share.shareToken)}`,
  };
}

function applyPublicReportHeaders(res: Response) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "private, no-store");
}

function serializePublicReportSite(
  site: Awaited<ReturnType<typeof getSiteById>>,
) {
  return site
    ? {
        site_display_name: site.site_display_name ?? null,
        client_name: site.client_name ?? null,
        report_display_name: site.report_display_name ?? null,
        url: site.url,
      }
    : null;
}

function serializeAuthenticatedReportSite(
  site: Awaited<ReturnType<typeof getSiteByIdForUser>>,
) {
  return site
    ? {
        id: site.id,
        site_display_name: site.site_display_name ?? null,
        client_name: site.client_name ?? null,
        report_display_name: site.report_display_name ?? null,
        url: site.url,
        developer_tabs_enabled: site.developer_tabs_enabled,
      }
    : null;
}

async function requireSharedReportAccess(
  req: express.Request,
  res: express.Response,
  token: string,
) {
  applyPublicReportHeaders(res);
  const access = await getSharedReportAccessByToken(token);
  if (!access) {
    sendNotFound(res);
    return null;
  }
  return access;
}

async function requireSiteForUser(
  req: express.Request,
  res: express.Response,
  siteId: string,
) {
  const userId = req.user?.id;
  if (!userId) {
    sendApiError(res, 401, "unauthorized", "Unauthorized");
    return null;
  }
  const site = await getSiteByIdForUser(userId, siteId);
  if (!site) {
    sendNotFound(res);
    return null;
  }
  return site;
}

async function requireScanRunForUser(
  req: express.Request,
  res: express.Response,
  scanRunId: string,
) {
  const userId = req.user?.id;
  if (!userId) {
    sendApiError(res, 401, "unauthorized", "Unauthorized");
    return null;
  }
  const run = await getScanRunByIdForUser(userId, scanRunId);
  if (!run) {
    sendNotFound(res);
    return null;
  }
  return { run };
}

function parseShowIgnored(value: unknown): boolean {
  return value === "true" || value === "1";
}

function parseBooleanParam(value: unknown, defaultValue: boolean): boolean {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return defaultValue;
}

function parseDiffChangeTypes(value: unknown): ScanDiffChangeType[] | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const filtered = parts.filter((part): part is ScanDiffChangeType =>
    DIFF_CHANGE_TYPES.has(part as ScanDiffChangeType),
  );
  return filtered.length > 0 ? filtered : [];
}

function parseExportScope(value: unknown): "all" | "page" {
  if (value === "page") return "page";
  return "all";
}

function parseUnchangedScope(value: unknown): "issues" | "ok" | "all" {
  if (value === "issues" || value === "ok") return value;
  return "all";
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

const app = express();

const corsOrigins = new Set(
  [process.env.WEB_ORIGIN, "http://localhost:5173", "http://localhost:3000"]
    .filter(Boolean)
    .map((origin) => origin as string),
);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (corsOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.set("trust proxy", 1);
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(sessionMiddleware);

if (process.env.DEV_BYPASS_AUTH === "true") {
  void initDemoAuth();
}

mountAuthRoutes(app);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "scanlark-api" });
});

app.use(authMiddleware);

mountEventStream(app);
mountScanRunEvents(app);

app.get("/me", (req, res) => {
  if (!req.user) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  const displayName = req.user.displayName ?? req.user.name ?? null;
  return res.json({
    id: req.user.id,
    email: req.user.email,
    displayName,
    name: displayName,
  });
});

app.get("/account/profile", (req, res) => {
  if (!req.user) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  const displayName = req.user.displayName ?? req.user.name ?? null;
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName,
      name: displayName,
    },
  });
});

app.patch("/account/profile", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendApiError(
      res,
      400,
      "invalid_body",
      "Request body must be an object",
    );
  }
  const keys = Object.keys(body);
  if (keys.some((key) => key !== "displayName")) {
    return sendApiError(
      res,
      400,
      "invalid_field",
      "Only displayName can be updated",
    );
  }
  const displayName = (body as { displayName?: unknown }).displayName;
  if (
    displayName !== undefined &&
    displayName !== null &&
    typeof displayName !== "string"
  ) {
    return sendApiError(
      res,
      400,
      "invalid_display_name",
      "displayName must be a string or null",
    );
  }
  if (typeof displayName === "string" && displayName.trim().length > 120) {
    return sendApiError(
      res,
      400,
      "invalid_display_name",
      "displayName must be 120 characters or fewer",
    );
  }

  try {
    const user = await updateUserProfile(userId, {
      displayName:
        typeof displayName === "string" || displayName === null
          ? displayName
          : null,
    });
    if (!user) return sendNotFound(res);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        name: user.displayName,
      },
    });
  } catch (err: unknown) {
    console.error("Error in PATCH /account/profile", err);
    return sendInternalError(res, "Failed to update profile", err);
  }
});

app.get("/sites", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const sites = await listSitesForUser(userId);

    res.json({
      userId,
      count: sites.length,
      sites,
    });
  } catch (err: unknown) {
    console.error("Error fetching sites", err);
    sendInternalError(res, "Failed to fetch sites", err);
  }
});

app.get("/sites/:siteId/schedule", async (req, res) => {
  const siteId = req.params.siteId;
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const schedule = await getSiteScheduleForUser(userId, siteId);
    if (!schedule) {
      return sendNotFound(res);
    }
    res.json({ siteId, ...schedule });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/schedule", err);
    sendInternalError(res, "Failed to fetch schedule", err);
  }
});

app.put("/sites/:siteId/schedule", async (req, res) => {
  const siteId = req.params.siteId;
  const { enabled, frequency, timeUtc, dayOfWeek, dayOfMonth } = req.body ?? {};

  if (typeof enabled !== "boolean") {
    return sendApiError(res, 400, "invalid_enabled", "enabled must be boolean");
  }
  if (typeof frequency !== "string" || !SCHEDULE_FREQUENCIES.has(frequency)) {
    return sendApiError(
      res,
      400,
      "invalid_frequency",
      "frequency must be daily or weekly",
    );
  }
  if (typeof timeUtc !== "string" || !isValidTimeUtc(timeUtc)) {
    return sendApiError(res, 400, "invalid_time", "timeUtc must be HH:MM");
  }
  const frequencyValue =
    frequency === "manual" ||
    frequency === "daily" ||
    frequency === "weekly" ||
    frequency === "monthly"
      ? frequency
      : "weekly";
  let resolvedDay: number | null = null;
  let resolvedDayOfMonth: number | null = null;
  if (enabled && frequencyValue === "manual") {
    return sendApiError(
      res,
      400,
      "invalid_frequency",
      "manual frequency cannot be enabled",
    );
  }
  if (frequencyValue === "weekly") {
    if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
      return sendApiError(
        res,
        400,
        "invalid_day",
        "dayOfWeek must be 0-6 for weekly schedules",
      );
    }
    resolvedDay = dayOfWeek;
  }
  if (frequencyValue === "monthly") {
    if (
      typeof dayOfMonth !== "number" ||
      !Number.isInteger(dayOfMonth) ||
      dayOfMonth < 1 ||
      dayOfMonth > 31
    ) {
      return sendApiError(
        res,
        400,
        "invalid_day_of_month",
        "dayOfMonth must be 1-31 for monthly schedules",
      );
    }
    resolvedDayOfMonth = dayOfMonth;
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const schedule = await updateSiteScheduleForUser(userId, siteId, {
      scheduleEnabled: enabled,
      scheduleFrequency: frequencyValue,
      scheduleTimeUtc: timeUtc,
      scheduleDayOfWeek: resolvedDay,
      scheduleDayOfMonth: resolvedDayOfMonth,
    });
    res.json({ siteId, ...schedule });
  } catch (err: unknown) {
    console.error("Error in PUT /sites/:siteId/schedule", err);
    sendInternalError(res, "Failed to update schedule", err);
  }
});

async function handleGetNotificationSettings(
  req: express.Request,
  res: express.Response,
) {
  const siteId = req.params.siteId;
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const settings = await getSiteNotificationSettingsForUser(userId, siteId);
    if (!settings) {
      return sendNotFound(res);
    }
    res.json({ siteId, ...settings });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/notification-settings", err);
    sendInternalError(res, "Failed to fetch notification settings", err);
  }
}

async function handlePatchNotificationSettings(
  req: express.Request,
  res: express.Response,
) {
  const siteId = req.params.siteId;
  const { enabled, email, notifyOn, includeCsv, summaryEnabled } =
    req.body ?? {};

  const patch: {
    notifyEnabled?: boolean;
    notifyEmail?: string | null;
    notifyOn?: "always" | "issues_exist" | "new_issues_only" | "never";
    notifyIncludeCsv?: boolean;
    summaryEnabled?: boolean;
  } = {};

  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      return sendApiError(
        res,
        400,
        "invalid_enabled",
        "enabled must be boolean",
      );
    }
    patch.notifyEnabled = enabled;
  }
  if (email !== undefined) {
    if (email != null && typeof email !== "string") {
      return sendApiError(res, 400, "invalid_email", "email must be a string");
    }
    if (email && !isValidEmailAddress(email)) {
      return sendApiError(res, 400, "invalid_email", "email is invalid");
    }
    patch.notifyEmail = email ?? null;
  }
  if (notifyOn !== undefined) {
    if (typeof notifyOn !== "string" || !NOTIFY_ON_OPTIONS.has(notifyOn)) {
      return sendApiError(
        res,
        400,
        "invalid_notify_on",
        "notifyOn must be new_issues_only, issues_exist, always, or never",
      );
    }
    patch.notifyOn = normalizeNotifyOn(notifyOn) as
      | "always"
      | "issues_exist"
      | "new_issues_only"
      | "never";
  }
  if (includeCsv !== undefined) {
    if (typeof includeCsv !== "boolean") {
      return sendApiError(
        res,
        400,
        "invalid_include_csv",
        "includeCsv must be boolean",
      );
    }
    patch.notifyIncludeCsv = includeCsv;
  }
  if (summaryEnabled !== undefined) {
    if (typeof summaryEnabled !== "boolean") {
      return sendApiError(
        res,
        400,
        "invalid_summary_enabled",
        "summaryEnabled must be boolean",
      );
    }
    patch.summaryEnabled = summaryEnabled;
  }

  if (Object.keys(patch).length === 0) {
    return sendApiError(res, 400, "empty_patch", "No fields to update");
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const updated = await updateSiteNotificationSettingsForUser(
      userId,
      siteId,
      patch,
    );
    res.json({ siteId, ...updated });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "site_not_found") {
      return sendNotFound(res);
    }
    if (err instanceof Error && err.message === "invalid_notify_email") {
      return sendApiError(
        res,
        400,
        "invalid_notify_email",
        "notify_email is required when notifications are enabled and notifyOn is not never",
      );
    }
    console.error("Error in PATCH /sites/:siteId/notification-settings", err);
    sendInternalError(res, "Failed to update notification settings", err);
  }
}

app.get("/sites/:siteId/notification-settings", handleGetNotificationSettings);
app.patch(
  "/sites/:siteId/notification-settings",
  handlePatchNotificationSettings,
);

// Backwards-compatible routes for older clients
app.get("/sites/:siteId/notifications", handleGetNotificationSettings);

app.put("/sites/:siteId/notifications", async (req, res) => {
  const { enabled, email, onlyOnChange } = req.body ?? {};
  const notifyOn = onlyOnChange === false ? "always" : "new_issues_only";
  req.body = { enabled, email, notifyOn };
  await handlePatchNotificationSettings(req, res);
});

async function handleSendTestAlert(
  req: express.Request,
  res: express.Response,
) {
  const siteId = req.params.siteId;
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const settings = await getSiteNotificationSettingsForUser(userId, siteId);
    if (!settings) {
      return sendNotFound(res);
    }
    const target = EMAIL_TEST_TO || settings.notifyEmail;
    if (!target) {
      return sendApiError(
        res,
        400,
        "missing_email",
        "notify_email is required",
      );
    }
    await sendTestEmail(userId, siteId, target);
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("Error in POST /sites/:siteId/notifications/test", err);
    sendInternalError(res, "Failed to send test alert", err);
  }
}

app.post("/sites/:siteId/notifications/test", handleSendTestAlert);
app.post("/sites/:siteId/alerts/test", handleSendTestAlert);

function serializeUserNotificationPreferences(
  preferences: UserNotificationPreferences,
) {
  return {
    inAppEnabled: preferences.in_app_enabled,
    scanCompletedEnabled: preferences.scan_completed_enabled,
    scanFailedEnabled: preferences.scan_failed_enabled,
    highPriorityIssuesEnabled: preferences.high_priority_issues_enabled,
    uptimeDownEnabled: preferences.uptime_down_enabled,
    uptimeRecoveredEnabled: preferences.uptime_recovered_enabled,
    systemNoticesEnabled: preferences.system_notices_enabled,
    createdAt:
      preferences.created_at instanceof Date
        ? preferences.created_at.toISOString()
        : preferences.created_at,
    updatedAt:
      preferences.updated_at instanceof Date
        ? preferences.updated_at.toISOString()
        : preferences.updated_at,
  };
}

const USER_NOTIFICATION_PREFERENCE_API_FIELDS = {
  inAppEnabled: "in_app_enabled",
  scanCompletedEnabled: "scan_completed_enabled",
  scanFailedEnabled: "scan_failed_enabled",
  highPriorityIssuesEnabled: "high_priority_issues_enabled",
  uptimeDownEnabled: "uptime_down_enabled",
  uptimeRecoveredEnabled: "uptime_recovered_enabled",
  systemNoticesEnabled: "system_notices_enabled",
} as const satisfies Record<
  string,
  (typeof USER_NOTIFICATION_PREFERENCE_FIELDS)[number]
>;

app.get("/account/notification-preferences", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const preferences = await getUserNotificationPreferences(userId);
    res.json({
      preferences: serializeUserNotificationPreferences(preferences),
    });
  } catch (err: unknown) {
    console.error("Error in GET /account/notification-preferences", err);
    sendInternalError(res, "Failed to fetch notification preferences", err);
  }
});

app.patch("/account/notification-preferences", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return sendApiError(
      res,
      400,
      "invalid_body",
      "Request body must be an object",
    );
  }

  const patch: Partial<
    Record<(typeof USER_NOTIFICATION_PREFERENCE_FIELDS)[number], boolean>
  > = {};
  for (const [key, value] of Object.entries(body)) {
    const dbField =
      USER_NOTIFICATION_PREFERENCE_API_FIELDS[
        key as keyof typeof USER_NOTIFICATION_PREFERENCE_API_FIELDS
      ];
    if (!dbField) {
      return sendApiError(
        res,
        400,
        "invalid_field",
        `Unknown notification preference field: ${key}`,
      );
    }
    if (typeof value !== "boolean") {
      return sendApiError(
        res,
        400,
        "invalid_field_value",
        `${key} must be a boolean`,
      );
    }
    patch[dbField] = value;
  }

  try {
    const preferences = await updateUserNotificationPreferences(userId, patch);
    res.json({
      preferences: serializeUserNotificationPreferences(preferences),
    });
  } catch (err: unknown) {
    console.error("Error in PATCH /account/notification-preferences", err);
    sendInternalError(res, "Failed to update notification preferences", err);
  }
});

function serializeAppNotification(
  notification: Awaited<
    ReturnType<typeof listRecentAppNotificationsForUser>
  >[number],
) {
  return {
    ...notification,
    read_at:
      notification.read_at instanceof Date
        ? notification.read_at.toISOString()
        : notification.read_at,
    created_at:
      notification.created_at instanceof Date
        ? notification.created_at.toISOString()
        : notification.created_at,
  };
}

app.get("/notifications", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  const rawLimit =
    typeof req.query.limit === "string" ? Number(req.query.limit) : 20;
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;
  const status = req.query.status === "all" ? "all" : "unread";
  try {
    const notifications = await listRecentAppNotificationsForUser(
      userId,
      limit,
      status,
    );
    res.json({
      notifications: notifications.map(serializeAppNotification),
    });
  } catch (err: unknown) {
    console.error("Error in GET /notifications", err);
    sendInternalError(res, "Failed to fetch notifications", err);
  }
});

app.get("/notifications/unread-count", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const unreadCount = await getUnreadAppNotificationCount(userId);
    res.json({ unreadCount });
  } catch (err: unknown) {
    console.error("Error in GET /notifications/unread-count", err);
    sendInternalError(res, "Failed to fetch unread notifications", err);
  }
});

app.patch("/notifications/:notificationId/read", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const result = await markAppNotificationReadForUser(
      userId,
      req.params.notificationId,
    );
    if (!result) return sendNotFound(res);
    res.json({
      notification: serializeAppNotification(result.notification),
      unreadCount: result.unreadCount,
    });
  } catch (err: unknown) {
    console.error("Error in PATCH /notifications/:notificationId/read", err);
    sendInternalError(res, "Failed to mark notification read", err);
  }
});

app.post("/notifications/mark-all-read", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const { updatedCount, readAt, unreadCount } =
      await markAllAppNotificationsReadForUser(userId);
    res.json({
      updatedCount,
      unreadCount,
      readAt: readAt instanceof Date ? readAt.toISOString() : readAt,
    });
  } catch (err: unknown) {
    console.error("Error in POST /notifications/mark-all-read", err);
    sendInternalError(res, "Failed to mark notifications read", err);
  }
});

app.get("/sites/:siteId/uptime", async (req, res) => {
  const siteId = req.params.siteId;
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const uptimeModule = await loadUptimeModule();
    const uptime = await uptimeModule.getUptimeStatusForSiteForUser(
      userId,
      siteId,
    );
    res.json(uptime);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "site_not_found") {
      return sendNotFound(res);
    }
    console.error("Error in GET /sites/:siteId/uptime", err);
    return sendInternalError(res, "Failed to fetch uptime settings", err);
  }
});

app.put("/sites/:siteId/uptime", async (req, res) => {
  const siteId = req.params.siteId;
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }

  const body = (req.body ?? {}) as {
    enabled?: unknown;
    checkUrl?: unknown;
    failureThreshold?: unknown;
  };

  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;
  const checkUrl =
    typeof body.checkUrl === "string" && body.checkUrl.trim()
      ? body.checkUrl.trim()
      : undefined;
  const failureThreshold =
    typeof body.failureThreshold === "number"
      ? body.failureThreshold
      : typeof body.failureThreshold === "string" &&
          body.failureThreshold.trim()
        ? Number(body.failureThreshold)
        : undefined;

  if (checkUrl) {
    try {
      const parsed = new URL(checkUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return sendApiError(
          res,
          400,
          "invalid_check_url",
          "checkUrl must use http or https",
        );
      }
    } catch {
      return sendApiError(
        res,
        400,
        "invalid_check_url",
        "checkUrl must be a valid absolute URL",
      );
    }
  }

  if (
    failureThreshold != null &&
    (!Number.isInteger(failureThreshold) ||
      failureThreshold < 1 ||
      failureThreshold > 10)
  ) {
    return sendApiError(
      res,
      400,
      "invalid_failure_threshold",
      "failureThreshold must be an integer between 1 and 10",
    );
  }

  try {
    const uptimeModule = await loadUptimeModule();
    await uptimeModule.updateUptimeMonitorSettingsForUser(userId, siteId, {
      enabled,
      checkUrl,
      failureThreshold,
    });
    const uptime = await uptimeModule.getUptimeStatusForSiteForUser(
      userId,
      siteId,
    );
    res.json(uptime);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "site_not_found") {
      return sendNotFound(res);
    }
    console.error("Error in PUT /sites/:siteId/uptime", err);
    return sendInternalError(res, "Failed to update uptime settings", err);
  }
});

app.post("/scan-runs/:scanRunId/notify", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    let userId = req.user?.id;
    let run = null;

    if (!userId) {
      const internalToken =
        typeof req.headers["x-internal-token"] === "string"
          ? req.headers["x-internal-token"]
          : "";
      if (!API_INTERNAL_TOKEN || internalToken !== API_INTERNAL_TOKEN) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }
      const internalRun = await getScanRunById(scanRunId);
      if (!internalRun) {
        return sendNotFound(res);
      }
      const site = await getSiteById(internalRun.site_id);
      if (!site || !site.user_id) {
        return sendNotFound(res);
      }
      userId = site.user_id;
      run = internalRun;
    } else {
      const result = await requireScanRunForUser(req, res, scanRunId);
      if (!result) return;
      run = result.run;
    }

    await createScanAppNotificationsForRun(userId, scanRunId);
    await notifyIfNeeded(userId, scanRunId);
    res.json({ ok: true, status: run.status });
  } catch (err: unknown) {
    console.error("Error in POST /scan-runs/:scanRunId/notify", err);
    sendInternalError(res, "Failed to notify", err);
  }
});

// Recent scans for a site
app.get("/sites/:siteId/scans", async (req, res) => {
  const siteId = req.params.siteId;
  const limitRaw = req.query.limit;
  const limit = limitRaw ? Number(limitRaw) : 10;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const scans = await getRecentScansForSiteForUser(userId, siteId, limit);

    res.json({
      siteId,
      count: scans.length,
      scans: scans.map(serializeScanRun),
    });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/scans", err);
    return sendInternalError(res, "Failed to fetch scans", err);
  }
});

// Recent scan runs for a site (history drawer)
app.get("/sites/:siteId/scan-runs", async (req, res) => {
  const siteId = req.params.siteId;
  const limitRaw = req.query.limit;
  const limit = limitRaw ? Number(limitRaw) : 10;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const runs = await getRecentScanRunsForSiteForUser(userId, siteId, limit);
    res.json({
      siteId,
      runs: runs.map(serializeScanRun),
    });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/scan-runs", err);
    return sendInternalError(res, "Failed to fetch scan runs", err);
  }
});

// Diff between a scan run and previous completed run for the same site
app.get("/sites/:siteId/scan-runs/:scanRunId/diff", async (req, res) => {
  const siteId = req.params.siteId;
  const scanRunId = req.params.scanRunId;
  const baselineRaw =
    typeof req.query.baseline === "string" ? req.query.baseline : "prev";
  const issuesOnly = parseBooleanParam(req.query.issuesOnly, true);
  const includeIgnored = parseBooleanParam(req.query.includeIgnored, false);
  const changeTypes = parseDiffChangeTypes(req.query.changeTypes);
  const includeUnchangedRaw = parseBooleanParam(
    req.query.includeUnchanged,
    false,
  );
  const unchangedOnly = parseBooleanParam(req.query.unchangedOnly, false);
  const unchangedScope = parseUnchangedScope(req.query.unchangedScope);
  const unchangedLimitRaw = req.query.unchangedLimit;
  const unchangedOffsetRaw = req.query.unchangedOffset;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const unchangedLimit = unchangedLimitRaw ? Number(unchangedLimitRaw) : 50;
  const unchangedOffset = unchangedOffsetRaw ? Number(unchangedOffsetRaw) : 0;
  const includeUnchanged = includeUnchangedRaw || unchangedOnly;
  const effectiveUnchangedScope = issuesOnly ? "issues" : unchangedScope;

  if (changeTypes && changeTypes.length === 0) {
    return sendApiError(
      res,
      400,
      "invalid_change_types",
      "changeTypes must include valid change types",
    );
  }

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  if (Number.isNaN(unchangedLimit) || unchangedLimit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_unchanged_limit",
      "unchangedLimit must be a positive number",
    );
  }

  if (Number.isNaN(unchangedOffset) || unchangedOffset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_unchanged_offset",
      "unchangedOffset must be 0 or greater",
    );
  }

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;
    if (run.site_id !== siteId) {
      return sendNotFound(res);
    }

    if (baselineRaw && baselineRaw !== "prev" && baselineRaw === scanRunId) {
      return sendApiError(
        res,
        400,
        "invalid_baseline",
        "baseline must be different from current run",
      );
    }

    const baselineRun =
      baselineRaw && baselineRaw !== "prev"
        ? await getCompletedRunForSite(siteId, baselineRaw)
        : await getBaselineRunForDiff(siteId, scanRunId);

    if (baselineRaw && baselineRaw !== "prev" && !baselineRun) {
      return sendApiError(
        res,
        404,
        "baseline_not_found",
        "Baseline scan run not found",
      );
    }

    const serializeRun = (row: {
      id: string;
      started_at: Date;
      finished_at: Date | null;
    }) => ({
      id: row.id,
      started_at: row.started_at.toISOString(),
      finished_at: row.finished_at ? row.finished_at.toISOString() : null,
    });

    if (!baselineRun) {
      return res.json({
        siteId,
        currentRun: serializeRun(run),
        baselineRun: null,
        summary: {
          newIssues: 0,
          fixedIssues: 0,
          changed: 0,
          outstandingIssues: 0,
          outstandingOk: 0,
          outstandingTotal: 0,
          removed: 0,
          added: 0,
        },
        meta: {
          includeUnchanged,
          unchangedOnly,
          unchangedScope: effectiveUnchangedScope,
          includeIgnored,
          unchangedLimit,
          unchangedOffset,
          unchangedReturned: 0,
          changesReturned: 0,
        },
        items: [],
      });
    }

    await applyIgnoreRulesForScanRun(scanRunId);
    await applyIgnoreRulesForScanRun(baselineRun.id);

    const diff = await getScanDiff(scanRunId, baselineRun.id, {
      issuesOnly,
      limit,
      offset,
      changeTypes,
      includeUnchanged,
      unchangedOnly,
      unchangedScope,
      unchangedLimit,
      unchangedOffset,
      includeIgnored,
    });

    return res.json({
      siteId,
      currentRun: serializeRun(run),
      baselineRun: serializeRun(baselineRun),
      summary: diff.summary,
      meta: { ...diff.meta, includeIgnored },
      items: diff.items,
    });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/scan-runs/:scanRunId/diff", err);
    return sendInternalError(res, "Failed to compute scan diff", err);
  }
});

app.get("/sites/:siteId/link-notes", async (req, res) => {
  const siteId = req.params.siteId;
  const status = parseLinkNoteStatus(req.query.status, "all");

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const notes = await listLinkNotesForSiteForUser(userId, siteId, status);
    return res.json({ siteId, count: notes.length, notes });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/link-notes", err);
    return sendInternalError(res, "Failed to fetch link notes", err);
  }
});

app.get("/sites/:siteId/link-notes/lookup", async (req, res) => {
  const siteId = req.params.siteId;
  const linkUrl = typeof req.query.url === "string" ? req.query.url : "";
  if (!linkUrl.trim()) {
    return sendApiError(
      res,
      400,
      "invalid_link_url",
      "url query param is required",
    );
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const note = await getLinkNoteForSiteByUrlForUser(userId, siteId, linkUrl);
    return res.json({ siteId, note });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/link-notes/lookup", err);
    return sendInternalError(res, "Failed to fetch link note", err);
  }
});

app.put("/sites/:siteId/link-notes", async (req, res) => {
  const siteId = req.params.siteId;
  const linkUrl =
    typeof req.body?.link_url === "string" ? req.body.link_url : "";
  const noteText = typeof req.body?.note === "string" ? req.body.note : "";
  const status = parseLinkNoteStatus(req.body?.status, "open");

  if (!linkUrl.trim()) {
    return sendApiError(res, 400, "invalid_link_url", "link_url is required");
  }
  if (!noteText.trim()) {
    return sendApiError(res, 400, "invalid_note", "note is required");
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const note = await upsertLinkNoteForSiteForUser({
      userId,
      siteId,
      linkUrl,
      note: noteText.trim(),
      status: status === "all" ? "open" : status,
    });
    if (!note) return sendNotFound(res);
    return res.json({ siteId, note });
  } catch (err: unknown) {
    console.error("Error in PUT /sites/:siteId/link-notes", err);
    return sendInternalError(res, "Failed to save link note", err);
  }
});

app.patch("/sites/:siteId/link-notes", async (req, res) => {
  const siteId = req.params.siteId;
  const linkUrl =
    typeof req.body?.link_url === "string" ? req.body.link_url : "";
  const noteRaw = req.body?.note;
  const statusRaw = req.body?.status;
  const nextNote = typeof noteRaw === "string" ? noteRaw.trim() : undefined;
  const status = parseLinkNoteStatus(statusRaw, "all");
  const hasNoteUpdate = typeof noteRaw === "string";
  const hasStatusUpdate = status !== "all";

  if (!linkUrl.trim()) {
    return sendApiError(res, 400, "invalid_link_url", "link_url is required");
  }
  if (!hasNoteUpdate && !hasStatusUpdate) {
    return sendApiError(
      res,
      400,
      "invalid_update",
      "note or status must be provided",
    );
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const note = await updateLinkNoteForSiteForUser({
      userId,
      siteId,
      linkUrl,
      note: nextNote && nextNote.length > 0 ? nextNote : undefined,
      status: status === "all" ? undefined : status,
    });
    if (!note) return sendNotFound(res);
    return res.json({ siteId, note });
  } catch (err: unknown) {
    console.error("Error in PATCH /sites/:siteId/link-notes", err);
    return sendInternalError(res, "Failed to update link note", err);
  }
});

app.delete("/sites/:siteId/link-notes", async (req, res) => {
  const siteId = req.params.siteId;
  const linkUrl =
    typeof req.body?.link_url === "string" ? req.body.link_url : "";
  if (!linkUrl.trim()) {
    return sendApiError(res, 400, "invalid_link_url", "link_url is required");
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const deleted = await deleteLinkNoteForSiteForUser(userId, siteId, linkUrl);
    if (!deleted) return sendNotFound(res);
    return res.json({ siteId, deleted: true });
  } catch (err: unknown) {
    console.error("Error in DELETE /sites/:siteId/link-notes", err);
    return sendInternalError(res, "Failed to delete link note", err);
  }
});

app.get("/sites/:siteId/fix-queue", async (req, res) => {
  const siteId = req.params.siteId;
  const runIdRaw = typeof req.query.runId === "string" ? req.query.runId : "";
  const baselineRaw =
    typeof req.query.baseline === "string" ? req.query.baseline : "prev";
  const includeOutstanding = parseBooleanParam(
    req.query.includeOutstanding,
    true,
  );
  const includeNew = parseBooleanParam(req.query.includeNew, true);
  const includeIgnored = parseBooleanParam(req.query.includeIgnored, false);
  const status = parseLinkNoteStatus(req.query.status, "open");
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;

    const currentRun = runIdRaw
      ? await getCompletedRunForSite(siteId, runIdRaw)
      : await getLatestCompletedScanForSiteForUser(userId, siteId);

    if (!currentRun) {
      return res.json({
        siteId,
        currentRun: null,
        baselineRun: null,
        summary: {
          newIssues: 0,
          outstandingIssues: 0,
          totalQueueItems: 0,
          withNotesOpen: 0,
          snoozed: 0,
          resolved: 0,
        },
        items: [],
      });
    }

    if (
      baselineRaw &&
      baselineRaw !== "prev" &&
      baselineRaw === currentRun.id
    ) {
      return sendApiError(
        res,
        400,
        "invalid_baseline",
        "baseline must be different from current run",
      );
    }

    const baselineRun =
      baselineRaw && baselineRaw !== "prev"
        ? await getCompletedRunForSite(siteId, baselineRaw)
        : await getBaselineRunForDiff(siteId, currentRun.id);

    if (baselineRaw && baselineRaw !== "prev" && !baselineRun) {
      return sendApiError(
        res,
        404,
        "baseline_not_found",
        "Baseline scan run not found",
      );
    }

    const serializeRun = (row: {
      id: string;
      started_at: Date;
      finished_at: Date | null;
    }) => ({
      id: row.id,
      started_at: row.started_at.toISOString(),
      finished_at: row.finished_at ? row.finished_at.toISOString() : null,
    });

    await applyIgnoreRulesForScanRun(currentRun.id);
    if (baselineRun) {
      await applyIgnoreRulesForScanRun(baselineRun.id);
    }

    const queue = await getFixQueueForRuns({
      userId,
      siteId,
      currentRunId: currentRun.id,
      baselineRunId: baselineRun?.id ?? null,
      includeNew,
      includeOutstanding,
      includeIgnored,
      status,
      limit,
      offset,
    });

    return res.json({
      siteId,
      currentRun: serializeRun(currentRun),
      baselineRun: baselineRun ? serializeRun(baselineRun) : null,
      summary: queue.summary,
      items: queue.items,
    });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/fix-queue", err);
    return sendInternalError(res, "Failed to fetch fix queue", err);
  }
});

// Latest scan for a site
app.get("/sites/:siteId/scans/latest", async (req, res) => {
  const siteId = req.params.siteId;

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const latest = await getLatestScanForSiteForUser(userId, siteId);

    if (!latest) {
      return sendNotFound(res);
    }

    res.json(serializeScanRun(latest));
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/scans/latest", err);
    return sendInternalError(res, "Failed to fetch latest scan", err);
  }
});

app.get("/sites/:siteId/dashboard-summary", async (req, res) => {
  const siteId = req.params.siteId;

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const [latestRun, history, notificationSettings] = await Promise.all([
      getLatestScanForSiteForUser(userId, siteId),
      getRecentScansForSiteForUser(userId, siteId, 8),
      getSiteNotificationSettingsForUser(userId, siteId),
    ]);

    if (!latestRun) {
      return res.json({
        site,
        latestRun: null,
        latestLinkSummary: [],
        latestIssueSummary: null,
        latestResolvedCount: 0,
        latestCategoryIssueSummaries: {},
        latestCategoryScores: [],
        latestTechnicalDiagnostics: null,
        latestDiffSummary: null,
        baselineRun: null,
        history: history.map(serializeScanRun),
        notificationSettings,
      });
    }

    await applyIgnoreRulesForScanRun(latestRun.id);

    const [
      latestLinkSummary,
      latestIssues,
      latestTechnicalDiagnostics,
      latestCategoryScores,
      baselineRun,
    ] = await Promise.all([
      getScanLinksSummaryForUser(userId, latestRun.id),
      listIssuesForScanRunForUser(userId, latestRun.id, {
        limit: 1,
        offset: 0,
      }),
      getScanTechnicalDiagnosticsForUser(userId, latestRun.id),
      getScanCategoryScoresForUser(userId, latestRun.id),
      getBaselineRunForDiff(siteId, latestRun.id),
    ]);

    const categoryEntries = await Promise.all(
      DASHBOARD_ISSUE_CATEGORIES.map(async (category) => {
        const issues = await listIssuesForScanRunForUser(userId, latestRun.id, {
          category,
          limit: 1,
          offset: 0,
        });
        return [category, issues.summary] as const;
      }),
    );

    const latestDiffSummary =
      baselineRun && latestRun.status === "completed"
        ? (
            await getScanDiff(latestRun.id, baselineRun.id, {
              issuesOnly: true,
              limit: 1,
              offset: 0,
            })
          ).summary
        : null;

    return res.json({
      site,
      latestRun: serializeScanRun(latestRun),
      latestLinkSummary,
      latestIssueSummary: latestIssues.summary,
      latestResolvedCount: latestIssues.resolvedCount,
      latestCategoryIssueSummaries: Object.fromEntries(categoryEntries),
      latestCategoryScores,
      latestTechnicalDiagnostics,
      latestDiffSummary,
      baselineRun,
      history: history.map(serializeScanRun),
      notificationSettings,
    });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/dashboard-summary", err);
    return sendInternalError(res, "Failed to fetch dashboard summary", err);
  }
});

// NEW: Get a scan run by id (live progress polling)
app.get("/scan-runs/:scanRunId", async (req, res) => {
  const scanRunId = req.params.scanRunId;

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;

    const serialized = serializeScanRun(run);
    return res.json(serialized);
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId", err);
    return sendInternalError(res, "Failed to fetch scan run", err);
  }
});

app.post("/scan-runs/:scanRunId/rebuild-issues", async (req, res) => {
  const scanRunId = req.params.scanRunId;

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;

    if (run.status !== "completed") {
      return sendApiError(
        res,
        400,
        "invalid_scan_status",
        "Only completed scan runs can rebuild issues",
      );
    }

    const rebuild = await rebuildIssuesForRun(scanRunId);
    const refreshed = await getScanRunByIdForUser(req.user!.id, scanRunId);
    if (!refreshed) return sendNotFound(res);

    return res.json({
      scanRunId,
      issueCount: rebuild.issueCount,
      scanRun: serializeScanRun(refreshed),
    });
  } catch (err: unknown) {
    console.error("Error in POST /scan-runs/:scanRunId/rebuild-issues", err);
    return sendInternalError(res, "Failed to rebuild scan issues", err);
  }
});

app.get("/scan-runs/:scanRunId/issues", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const limit = limitRaw ? Number(limitRaw) : 50;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const status = parseIssueStatus(req.query.status);
  const severity = parseIssueSeverity(req.query.severity);
  const category = parseIssueCategory(req.query.category);

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }
  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const issues = await listIssuesForScanRunForUser(userId, scanRunId, {
      status,
      severity,
      category,
      limit,
      offset,
    });

    res.json({
      scanRunId,
      summary: issues.summary,
      countReturned: issues.countReturned,
      totalMatching: issues.totalMatching,
      resolvedCount: issues.resolvedCount,
      issues: issues.issues.map(serializeIssueWithPresentation),
      resolvedIssues: issues.resolvedIssues.map(serializeIssueWithPresentation),
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/issues", err);
    return sendInternalError(res, "Failed to fetch scan issues", err);
  }
});

// Scan report payload
app.get("/scan-runs/:scanRunId/report", async (req, res) => {
  const scanRunId = req.params.scanRunId;

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    await applyIgnoreRulesForScanRun(scanRunId);

    const summaryRows = await getScanLinksSummaryForUser(userId, scanRunId);
    const timeoutCount = await getTimeoutCountForRunForUser(userId, scanRunId);
    const byClassification: Record<string, number> = {
      ok: 0,
      broken: 0,
      blocked: 0,
      no_response: 0,
      timeout: timeoutCount,
    };
    const byStatusCode: Record<string, number> = {};

    summaryRows.forEach((row) => {
      byClassification[row.classification] =
        (byClassification[row.classification] ?? 0) + row.count;
      const statusKey =
        row.status_code == null ? "null" : String(row.status_code);
      byStatusCode[statusKey] = (byStatusCode[statusKey] ?? 0) + row.count;
    });

    const serializeTopRow = (row: {
      last_seen_at: Date;
      first_seen_at?: Date;
    }) => ({
      ...row,
      first_seen_at:
        row.first_seen_at instanceof Date
          ? row.first_seen_at.toISOString()
          : row.first_seen_at,
      last_seen_at:
        row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : row.last_seen_at,
    });

    const topBroken = await getTopLinksByClassificationForUser(
      userId,
      scanRunId,
      "broken",
      20,
    );
    const topBlocked = await getTopLinksByClassificationForUser(
      userId,
      scanRunId,
      "blocked",
      20,
    );
    const site = await getSiteByIdForUser(userId, run.site_id);

    return res.json({
      scanRun: serializeScanRun(run),
      site: serializeAuthenticatedReportSite(site),
      summary: { byClassification, byStatusCode },
      topBroken: topBroken.map(serializeTopRow),
      topBlocked: topBlocked.map(serializeTopRow),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/report", err);
    return sendInternalError(res, "Failed to build report", err);
  }
});

app.get("/scan-runs/:scanRunId/share", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const share = await getReportShareForRunForUser(userId, scanRunId);
    return res.json({
      share: share ? serializeReportShare(req, share) : null,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/share", err);
    return sendInternalError(res, "Failed to load report share", err);
  }
});

app.post("/scan-runs/:scanRunId/share", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const { share, created } = await createOrRotateReportShareForRunForUser(
      userId,
      scanRunId,
    );
    return res.json({
      created,
      share: serializeReportShare(req, share),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "scan_run_not_shareable") {
      return sendApiError(
        res,
        400,
        "scan_run_not_shareable",
        "Only completed scan runs can create share links",
      );
    }
    if (err instanceof Error && err.message === "scan_run_not_found") {
      return sendNotFound(res);
    }
    console.error("Error in POST /scan-runs/:scanRunId/share", err);
    return sendInternalError(res, "Failed to create report share", err);
  }
});

app.delete("/scan-runs/:scanRunId/share", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const revoked = await disableReportShareForRunForUser(userId, scanRunId);
    return res.json({ revoked });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "scan_run_not_found") {
      return sendNotFound(res);
    }
    console.error("Error in DELETE /scan-runs/:scanRunId/share", err);
    return sendInternalError(res, "Failed to revoke report share", err);
  }
});

app.get("/public/reports/:token/report", async (req, res) => {
  const token = req.params.token;
  try {
    const access = await requireSharedReportAccess(req, res, token);
    if (!access) return;
    const { run, share } = access;

    await applyIgnoreRulesForScanRun(run.id);
    await recordReportShareView(share.id);

    const [summaryRows, timeoutCount, topBroken, topBlocked, site] =
      await Promise.all([
        getScanLinksSummary(run.id),
        getTimeoutCountForRun(run.id),
        getTopLinksByClassification(run.id, "broken", 20),
        getTopLinksByClassification(run.id, "blocked", 20),
        getSiteById(run.site_id),
      ]);

    const byClassification: Record<string, number> = {
      ok: 0,
      broken: 0,
      blocked: 0,
      no_response: 0,
      timeout: timeoutCount,
    };
    const byStatusCode: Record<string, number> = {};

    summaryRows.forEach((row) => {
      byClassification[row.classification] =
        (byClassification[row.classification] ?? 0) + row.count;
      const statusKey =
        row.status_code == null ? "null" : String(row.status_code);
      byStatusCode[statusKey] = (byStatusCode[statusKey] ?? 0) + row.count;
    });

    const serializeTopRow = (row: {
      last_seen_at: Date;
      first_seen_at?: Date;
    }) => ({
      ...row,
      first_seen_at:
        row.first_seen_at instanceof Date
          ? row.first_seen_at.toISOString()
          : row.first_seen_at,
      last_seen_at:
        row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : row.last_seen_at,
    });

    return res.json({
      scanRun: serializeScanRun(run),
      site: serializePublicReportSite(site),
      summary: { byClassification, byStatusCode, rows: summaryRows },
      topBroken: topBroken.map(serializeTopRow),
      topBlocked: topBlocked.map(serializeTopRow),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error("Error in GET /public/reports/:token/report", err);
    return sendInternalError(res, "Failed to build shared report", err);
  }
});

app.get("/public/reports/:token/issues", async (req, res) => {
  const token = req.params.token;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const limit = limitRaw ? Number(limitRaw) : 50;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const status = parseIssueStatus(req.query.status);
  const severity = parseIssueSeverity(req.query.severity);
  const category = parseIssueCategory(req.query.category);

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }
  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const access = await requireSharedReportAccess(req, res, token);
    if (!access) return;
    const issues = await listIssuesForScanRun(access.run.id, {
      status,
      severity,
      category,
      limit,
      offset,
    });

    return res.json({
      scanRunId: access.run.id,
      summary: issues.summary,
      countReturned: issues.countReturned,
      totalMatching: issues.totalMatching,
      resolvedCount: issues.resolvedCount,
      issues: issues.issues.map(serializeIssueWithPresentation),
      resolvedIssues: issues.resolvedIssues.map(serializeIssueWithPresentation),
    });
  } catch (err: unknown) {
    console.error("Error in GET /public/reports/:token/issues", err);
    return sendInternalError(res, "Failed to fetch shared report issues", err);
  }
});

app.get("/public/reports/:token/technical-diagnostics", async (req, res) => {
  applyPublicReportHeaders(res);
  return sendNotFound(res);
});

app.get("/public/reports/:token/links", async (req, res) => {
  const token = req.params.token;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const classificationRaw = req.query.classification;
  const statusGroupRaw = req.query.statusGroup;
  const showIgnoredRaw = req.query.showIgnored;

  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const classification = parseClassification(classificationRaw);
  const statusGroup = parseStatusGroup(statusGroupRaw);
  const showIgnored = parseShowIgnored(showIgnoredRaw);

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }
  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const access = await requireSharedReportAccess(req, res, token);
    if (!access) return;
    await applyIgnoreRulesForScanRun(access.run.id);
    const paginatedLinks = await getScanLinksForRun(access.run.id, {
      limit,
      offset,
      classification,
      statusGroup,
      includeIgnored: showIgnored,
    });

    const serializedLinks = paginatedLinks.links.map((link) => ({
      ...link,
      first_seen_at:
        link.first_seen_at instanceof Date
          ? link.first_seen_at.toISOString()
          : link.first_seen_at,
      last_seen_at:
        link.last_seen_at instanceof Date
          ? link.last_seen_at.toISOString()
          : link.last_seen_at,
      created_at:
        link.created_at instanceof Date
          ? link.created_at.toISOString()
          : link.created_at,
      updated_at:
        link.updated_at instanceof Date
          ? link.updated_at.toISOString()
          : link.updated_at,
      ignored_at:
        link.ignored_at instanceof Date
          ? link.ignored_at.toISOString()
          : link.ignored_at,
    }));

    return res.json({
      scanRunId: access.run.id,
      classification,
      statusGroup,
      showIgnored,
      countReturned: paginatedLinks.countReturned,
      totalMatching: paginatedLinks.totalMatching,
      links: serializedLinks,
    });
  } catch (err: unknown) {
    console.error("Error in GET /public/reports/:token/links", err);
    return sendInternalError(res, "Failed to fetch shared report links", err);
  }
});

app.get("/public/reports/:token/ignored", async (req, res) => {
  const token = req.params.token;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }
  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const access = await requireSharedReportAccess(req, res, token);
    if (!access) return;
    await applyIgnoreRulesForScanRun(access.run.id);
    const result = await listIgnoredLinksForRun(access.run.id, limit, offset);
    const serialized = result.links.map((row) => ({
      ...row,
      first_seen_at:
        row.first_seen_at instanceof Date
          ? row.first_seen_at.toISOString()
          : row.first_seen_at,
      last_seen_at:
        row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : row.last_seen_at,
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : row.created_at,
    }));
    return res.json({
      scanRunId: access.run.id,
      countReturned: result.countReturned,
      totalMatching: result.totalMatching,
      links: serialized,
    });
  } catch (err: unknown) {
    console.error("Error in GET /public/reports/:token/ignored", err);
    return sendInternalError(res, "Failed to fetch shared ignored links", err);
  }
});

// Cancel a scan run
// curl -X POST "http://localhost:3001/scan-runs/<scanRunId>/cancel"
app.post("/scan-runs/:scanRunId/cancel", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const job = await getJobForScanRun(scanRunId);
    if (job && job.status !== "completed") {
      await cancelScanJob(job.id);
    }
    await cancelScanRun(scanRunId);
    return res.json({ ok: true, status: "cancelled" });
  } catch (err: unknown) {
    console.error("Error in POST /scan-runs/:scanRunId/cancel", err);
    return sendInternalError(res, "Failed to cancel scan run", err);
  }
});

app.post("/scan-runs/:scanRunId/retry", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;
    if (run.status !== "failed" && run.status !== "cancelled") {
      return sendApiError(
        res,
        400,
        "scan_run_not_retryable",
        "Scan run must be failed or cancelled to retry",
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
    return res.json({
      scanRunId,
      jobId: enqueueResult.jobId,
      status: "queued",
    });
  } catch (err: unknown) {
    console.error("Error in POST /scan-runs/:scanRunId/retry", err);
    return sendInternalError(res, "Failed to retry scan run", err);
  }
});

// Create a new site
app.post("/sites", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const body = req.body as {
      url?: string;
      name?: string;
      siteDisplayName?: string | null;
      clientName?: string | null;
      reportDisplayName?: string | null;
      internalNotes?: string | null;
      developerTabsEnabled?: boolean;
    };
    const url = body.url;

    if (!url) {
      return sendApiError(res, 400, "missing_url", "Missing 'url' in body");
    }

    const siteDisplayName = parseOptionalSiteMetadataField(
      body.siteDisplayName ?? body.name,
    );
    const clientName = parseOptionalSiteMetadataField(body.clientName);
    const reportDisplayName = parseOptionalSiteMetadataField(
      body.reportDisplayName,
    );
    const internalNotes = parseOptionalSiteMetadataField(body.internalNotes);

    if (
      siteDisplayName === "__invalid__" ||
      clientName === "__invalid__" ||
      reportDisplayName === "__invalid__" ||
      internalNotes === "__invalid__"
    ) {
      return sendApiError(
        res,
        400,
        "invalid_site_metadata",
        "Site metadata fields must be strings when provided",
      );
    }

    const site = await createSiteForUser(userId, url, {
      siteDisplayName,
      clientName,
      reportDisplayName,
      internalNotes,
      developerTabsEnabled:
        typeof body.developerTabsEnabled === "boolean"
          ? body.developerTabsEnabled
          : false,
    });

    startSiteAvatarRefresh(userId, site.id);

    res.status(201).json({ site });
  } catch (err: unknown) {
    console.error("Error creating site", err);
    return sendInternalError(res, "Failed to create site", err);
  }
});

app.get("/sites/:siteId/avatar", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const avatar = await getSiteAvatarForUser(userId, req.params.siteId);
    if (!avatar) return sendNotFound(res);
    if (avatar.status !== "cached" || !avatar.content || !avatar.content_type) {
      return sendNotFound(res);
    }
    res.setHeader("Content-Type", avatar.content_type);
    res.setHeader("Content-Length", String(avatar.content.byteLength));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(avatar.content);
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/avatar", err);
    return sendInternalError(res, "Failed to fetch site avatar", err);
  }
});

app.post("/sites/:siteId/avatar/refresh", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const site = await refreshSiteAvatar(userId, req.params.siteId);
    if (!site) return sendNotFound(res);
    return res.json({ site });
  } catch (err: unknown) {
    console.error("Error in POST /sites/:siteId/avatar/refresh", err);
    return sendInternalError(res, "Failed to refresh site avatar", err);
  }
});

app.delete("/sites/:siteId/avatar", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return sendApiError(res, 401, "unauthorized", "Unauthorized");
  }
  try {
    const site = await markSiteAvatarUnavailableForUser(
      userId,
      req.params.siteId,
      "removed",
      null,
    );
    if (!site) return sendNotFound(res);
    return res.json({ site });
  } catch (err: unknown) {
    console.error("Error in DELETE /sites/:siteId/avatar", err);
    return sendInternalError(res, "Failed to remove site avatar", err);
  }
});

app.patch("/sites/:siteId", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }

    const siteId = req.params.siteId;
    const body = req.body as {
      siteDisplayName?: string | null;
      clientName?: string | null;
      reportDisplayName?: string | null;
      internalNotes?: string | null;
      developerTabsEnabled?: boolean;
    };

    const siteDisplayName = parseOptionalSiteMetadataField(
      body.siteDisplayName,
    );
    const clientName = parseOptionalSiteMetadataField(body.clientName);
    const reportDisplayName = parseOptionalSiteMetadataField(
      body.reportDisplayName,
    );
    const internalNotes = parseOptionalSiteMetadataField(body.internalNotes);

    if (
      siteDisplayName === "__invalid__" ||
      clientName === "__invalid__" ||
      reportDisplayName === "__invalid__" ||
      internalNotes === "__invalid__"
    ) {
      return sendApiError(
        res,
        400,
        "invalid_site_metadata",
        "Site metadata fields must be strings when provided",
      );
    }

    const fields: Partial<SiteMetadataFields> = {};
    if (body.siteDisplayName !== undefined) {
      fields.siteDisplayName = siteDisplayName;
    }
    if (body.clientName !== undefined) {
      fields.clientName = clientName;
    }
    if (body.reportDisplayName !== undefined) {
      fields.reportDisplayName = reportDisplayName;
    }
    if (body.internalNotes !== undefined) {
      fields.internalNotes = internalNotes;
    }
    if (body.developerTabsEnabled !== undefined) {
      if (typeof body.developerTabsEnabled !== "boolean") {
        return sendApiError(
          res,
          400,
          "invalid_site_metadata",
          "developerTabsEnabled must be boolean when provided",
        );
      }
      fields.developerTabsEnabled = body.developerTabsEnabled;
    }

    if (Object.keys(fields).length === 0) {
      return sendApiError(res, 400, "empty_patch", "No fields to update");
    }

    const site = await updateSiteMetadataForUser(userId, siteId, fields);
    if (!site) {
      return sendNotFound(res);
    }

    return res.json({ site });
  } catch (err: unknown) {
    console.error("Error updating site metadata", err);
    return sendInternalError(res, "Failed to update site metadata", err);
  }
});

// Trigger a new scan
app.post("/sites/:siteId/scans", async (req, res) => {
  const siteId = req.params.siteId;
  const body = req.body as { startUrl?: string };

  if (!body.startUrl || typeof body.startUrl !== "string") {
    return sendApiError(
      res,
      400,
      "invalid_start_url",
      "body.startUrl must be a non-empty string",
    );
  }

  try {
    if (!(await requireSiteForUser(req, res, siteId))) return;
    const enqueueResult = await enqueueManualScanIfIdle({
      siteId,
      startUrl: body.startUrl,
    });
    if (!enqueueResult.created) {
      return res.status(409).json({
        error: "active_scan_exists",
        message: "This site already has queued or running scan work",
        active: enqueueResult.active,
      });
    }

    res.status(201).json({
      scanRunId: enqueueResult.scanRunId,
      jobId: enqueueResult.jobId,
      siteId,
      startUrl: body.startUrl,
    });
  } catch (err: unknown) {
    console.error("Error in POST /sites/:siteId/scans", err);
    return sendInternalError(res, "Failed to start scan", err);
  }
});

// Results for a scan run
app.get("/scan-runs/:scanRunId/results", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const classificationRaw = req.query.classification;

  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const classification = parseClassification(classificationRaw);

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const paginatedResults = await getResultsForScanRunForUser(
      userId,
      scanRunId,
      {
        limit,
        offset,
        classification,
      },
    );

    res.json({
      scanRunId,
      classification,
      countReturned: paginatedResults.countReturned,
      totalMatching: paginatedResults.totalMatching,
      results: paginatedResults.results,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/results", err);
    return sendInternalError(res, "Failed to fetch scan results", err);
  }
});

// Get results summary (counts by classification + status_code)
app.get("/scan-runs/:scanRunId/results/summary", async (req, res) => {
  const scanRunId = req.params.scanRunId;

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const summary = await getResultsSummaryForScanRunForUser(userId, scanRunId);

    res.json({
      scanRunId,
      summary,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/results/summary", err);
    return sendInternalError(res, "Failed to fetch results summary", err);
  }
});

// Summary for deduplicated scan links (excludes ignored)
app.get("/scan-runs/:scanRunId/links/summary", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const summary = await getScanLinksSummaryForUser(userId, scanRunId);
    const noResponse = summary
      .filter((row) => row.status_code == null)
      .reduce((acc, row) => acc + row.count, 0);
    res.json({ scanRunId, summary, no_response: noResponse });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/links/summary", err);
    return sendInternalError(res, "Failed to fetch link summary", err);
  }
});

app.get("/scan-runs/:scanRunId/technical-diagnostics", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const diagnostics = await getScanTechnicalDiagnosticsForUser(
      userId,
      scanRunId,
    );
    const categoryScores = await getScanCategoryScoresForUser(
      userId,
      scanRunId,
    );
    res.json({
      ...diagnostics,
      categoryScores,
      loadedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error(
      "Error in GET /scan-runs/:scanRunId/technical-diagnostics",
      err,
    );
    return sendInternalError(res, "Failed to fetch technical diagnostics", err);
  }
});

// Export deduplicated links as CSV
app.get("/scan-runs/:scanRunId/links/export.csv", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const classificationRaw = req.query.classification;
  const limitRaw = req.query.limit;
  const statusGroupRaw = req.query.statusGroup;
  const statusFiltersRaw = req.query.statusFilters;
  const searchRaw = req.query.search;
  const minOccurrencesRaw = req.query.minOccurrencesOnly;
  const sortRaw = req.query.sort;
  const showIgnoredRaw = req.query.showIgnored;
  const ignoredOnlyRaw = req.query.ignoredOnly;
  const classification = parseExportClassification(classificationRaw);
  const limit = typeof limitRaw === "string" ? Number(limitRaw) : 5000;
  if (
    classificationRaw &&
    typeof classificationRaw === "string" &&
    !EXPORT_CLASSIFICATIONS.has(classificationRaw as ExportClassification)
  ) {
    return sendApiError(
      res,
      400,
      "invalid_classification",
      "classification must be a supported value",
    );
  }
  if (Number.isNaN(limit) || limit <= 0 || limit > 20000) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be between 1 and 20000",
    );
  }

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    await applyIgnoreRulesForScanRun(scanRunId);
    const statusGroup = parseStatusGroup(statusGroupRaw);
    const statusFilters = parseStatusFilters(statusFiltersRaw);
    const searchQuery = typeof searchRaw === "string" ? searchRaw.trim() : "";
    const minOccurrencesOnly = minOccurrencesRaw === "true";
    const sortOption = parseSortOption(sortRaw);
    const showIgnored = showIgnoredRaw === "true";
    const ignoredOnly = ignoredOnlyRaw === "true";
    const useFiltered =
      statusGroupRaw ||
      statusFiltersRaw ||
      searchQuery ||
      minOccurrencesRaw ||
      sortRaw ||
      showIgnoredRaw ||
      ignoredOnlyRaw;
    const rows = useFiltered
      ? await getScanLinksForExportFilteredForUser(userId, scanRunId, {
          classification,
          statusGroup,
          statusFilters,
          searchQuery,
          minOccurrencesOnly,
          sortOption,
          showIgnored,
          ignoredOnly,
          limit,
        })
      : await getScanLinksForExportForUser(
          userId,
          scanRunId,
          classification,
          limit,
        );
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `scan-links-${scanRunId}-${classification}-${dateStamp}.csv`;
    const header = [
      "link_url",
      "classification",
      "status_code",
      "error_message",
      "occurrence_count",
      "first_seen_at",
      "last_seen_at",
    ];
    const csvRows = [
      header.map(csvEscape).join(","),
      ...rows.map((row) =>
        [
          row.link_url,
          row.classification,
          row.status_code ?? "",
          row.error_message ?? "",
          row.occurrence_count,
          row.first_seen_at instanceof Date
            ? row.first_seen_at.toISOString()
            : row.first_seen_at,
          row.last_seen_at instanceof Date
            ? row.last_seen_at.toISOString()
            : row.last_seen_at,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csvRows);
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/links/export.csv", err);
    return sendInternalError(res, "Failed to export links as CSV", err);
  }
});

// Export deduplicated links as JSON
app.get("/scan-runs/:scanRunId/links/export.json", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const classificationRaw = req.query.classification;
  const limitRaw = req.query.limit;
  const statusGroupRaw = req.query.statusGroup;
  const statusFiltersRaw = req.query.statusFilters;
  const searchRaw = req.query.search;
  const minOccurrencesRaw = req.query.minOccurrencesOnly;
  const sortRaw = req.query.sort;
  const showIgnoredRaw = req.query.showIgnored;
  const ignoredOnlyRaw = req.query.ignoredOnly;
  const classification = parseExportClassification(classificationRaw);
  const limit = typeof limitRaw === "string" ? Number(limitRaw) : 5000;
  if (
    classificationRaw &&
    typeof classificationRaw === "string" &&
    !EXPORT_CLASSIFICATIONS.has(classificationRaw as ExportClassification)
  ) {
    return sendApiError(
      res,
      400,
      "invalid_classification",
      "classification must be a supported value",
    );
  }
  if (Number.isNaN(limit) || limit <= 0 || limit > 20000) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be between 1 and 20000",
    );
  }

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    await applyIgnoreRulesForScanRun(scanRunId);
    const statusGroup = parseStatusGroup(statusGroupRaw);
    const statusFilters = parseStatusFilters(statusFiltersRaw);
    const searchQuery = typeof searchRaw === "string" ? searchRaw.trim() : "";
    const minOccurrencesOnly = minOccurrencesRaw === "true";
    const sortOption = parseSortOption(sortRaw);
    const showIgnored = showIgnoredRaw === "true";
    const ignoredOnly = ignoredOnlyRaw === "true";
    const useFiltered =
      statusGroupRaw ||
      statusFiltersRaw ||
      searchQuery ||
      minOccurrencesRaw ||
      sortRaw ||
      showIgnoredRaw ||
      ignoredOnlyRaw;
    const rows = useFiltered
      ? await getScanLinksForExportFilteredForUser(userId, scanRunId, {
          classification,
          statusGroup,
          statusFilters,
          searchQuery,
          minOccurrencesOnly,
          sortOption,
          showIgnored,
          ignoredOnly,
          limit,
        })
      : await getScanLinksForExportForUser(
          userId,
          scanRunId,
          classification,
          limit,
        );
    const dateStamp = new Date().toISOString().split("T")[0];
    const filename = `scan-links-${scanRunId}-${classification}-${dateStamp}.json`;
    const payload = rows.map((row) => ({
      ...row,
      first_seen_at:
        row.first_seen_at instanceof Date
          ? row.first_seen_at.toISOString()
          : row.first_seen_at,
      last_seen_at:
        row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : row.last_seen_at,
    }));

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(JSON.stringify(payload, null, 2));
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/links/export.json", err);
    return sendInternalError(res, "Failed to export links as JSON", err);
  }
});

// CSV export for diff results
app.get("/sites/:siteId/scan-runs/:scanRunId/diff.csv", async (req, res) => {
  const siteId = req.params.siteId;
  const scanRunId = req.params.scanRunId;
  const baselineRaw =
    typeof req.query.baseline === "string" ? req.query.baseline : "prev";
  const issuesOnly = parseBooleanParam(req.query.issuesOnly, true);
  const includeIgnored = parseBooleanParam(req.query.includeIgnored, false);
  const exportScope = parseExportScope(req.query.exportScope);
  const changeTypes = parseDiffChangeTypes(req.query.changeTypes);
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (changeTypes && changeTypes.length === 0) {
    return sendApiError(
      res,
      400,
      "invalid_change_types",
      "changeTypes must include valid change types",
    );
  }

  if (exportScope === "page") {
    if (Number.isNaN(limit) || limit <= 0) {
      return sendApiError(
        res,
        400,
        "invalid_limit",
        "limit must be a positive number",
      );
    }

    if (Number.isNaN(offset) || offset < 0) {
      return sendApiError(
        res,
        400,
        "invalid_offset",
        "offset must be 0 or greater",
      );
    }
  }

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const { run } = result;
    if (run.site_id !== siteId) {
      return sendNotFound(res);
    }

    if (baselineRaw && baselineRaw !== "prev" && baselineRaw === scanRunId) {
      return sendApiError(
        res,
        400,
        "invalid_baseline",
        "baseline must be different from current run",
      );
    }

    const baselineRun =
      baselineRaw && baselineRaw !== "prev"
        ? await getCompletedRunForSite(siteId, baselineRaw)
        : await getBaselineRunForDiff(siteId, scanRunId);

    if (baselineRaw && baselineRaw !== "prev" && !baselineRun) {
      return sendApiError(
        res,
        404,
        "baseline_not_found",
        "Baseline scan run not found",
      );
    }

    const baselineId = baselineRun?.id ?? "no-baseline";
    const filename = `scanlark-diff-${siteId}-${scanRunId}-vs-${baselineId}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const headers = [
      "change_type",
      "link_url",
      "baseline_classification",
      "baseline_status_code",
      "baseline_error_message",
      "baseline_source_pages",
      "current_classification",
      "current_status_code",
      "current_error_message",
      "current_source_pages",
      "site_id",
      "current_run_id",
      "baseline_run_id",
    ];

    if (!baselineRun) {
      return res.status(200).send(`${headers.join(",")}\n`);
    }

    await applyIgnoreRulesForScanRun(scanRunId);
    await applyIgnoreRulesForScanRun(baselineRun.id);

    const pageLimit = exportScope === "page" ? limit : 2000;
    let pageOffset = exportScope === "page" ? offset : 0;
    const items: Array<{
      link_url: string;
      change_type: string;
      current: {
        classification: string;
        status_code: number | null;
        error_message: string | null;
        source_pages: string[];
      } | null;
      baseline: {
        classification: string;
        status_code: number | null;
        error_message: string | null;
        source_pages: string[];
      } | null;
    }> = [];

    while (true) {
      const diff = await getScanDiff(scanRunId, baselineRun.id, {
        issuesOnly,
        limit: pageLimit,
        offset: pageOffset,
        changeTypes: changeTypes ?? null,
        includeIgnored,
      });
      items.push(...diff.items);
      if (exportScope === "page" || diff.items.length < pageLimit) break;
      pageOffset += pageLimit;
    }

    const rows = items.map((item) => {
      const baseline = item.baseline;
      const current = item.current;
      const baselinePages = baseline?.source_pages ?? [];
      const currentPages = current?.source_pages ?? [];
      return [
        csvEscape(item.change_type),
        csvEscape(item.link_url),
        csvEscape(baseline?.classification ?? ""),
        csvEscape(baseline?.status_code ?? ""),
        csvEscape(baseline?.error_message ?? ""),
        csvEscape(baselinePages.join(" | ")),
        csvEscape(current?.classification ?? ""),
        csvEscape(current?.status_code ?? ""),
        csvEscape(current?.error_message ?? ""),
        csvEscape(currentPages.join(" | ")),
        csvEscape(siteId),
        csvEscape(scanRunId),
        csvEscape(baselineRun.id),
      ].join(",");
    });

    return res.status(200).send(`${headers.join(",")}\n${rows.join("\n")}`);
  } catch (err: unknown) {
    console.error(
      "Error in GET /sites/:siteId/scan-runs/:scanRunId/diff.csv",
      err,
    );
    return sendInternalError(res, "Failed to export scan diff", err);
  }
});

// Diff between two scan runs (dedup links)
app.get("/scan-runs/:scanRunId/diff", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const compareTo =
    typeof req.query.compareTo === "string" ? req.query.compareTo : "";
  if (!compareTo) {
    return sendApiError(
      res,
      400,
      "missing_compareTo",
      "compareTo query param is required",
    );
  }

  try {
    const result = await requireScanRunForUser(req, res, scanRunId);
    if (!result) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const diff = await getDiffBetweenRunsForUser(userId, scanRunId, compareTo);
    if (!diff) {
      return sendNotFound(res);
    }
    const serializeRow = (row: { last_seen_at: Date }) => ({
      ...row,
      last_seen_at:
        row.last_seen_at instanceof Date
          ? row.last_seen_at.toISOString()
          : row.last_seen_at,
    });

    res.json({
      scanRunId,
      compareTo,
      diff: {
        ...diff,
        added: diff.added.map(serializeRow),
        removed: diff.removed.map(serializeRow),
        changed: diff.changed.map((item) => ({
          before: serializeRow(item.before),
          after: serializeRow(item.after),
        })),
      },
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/diff", err);
    return sendInternalError(res, "Failed to compute diff", err);
  }
});

// Ignored links for a scan run
app.get("/scan-runs/:scanRunId/ignored", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = limitRaw ? Number(limitRaw) : 50;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }
  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const runCheck = await requireScanRunForUser(req, res, scanRunId);
    if (!runCheck) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const ignoredResult = await listIgnoredLinksForRunForUser(
      userId,
      scanRunId,
      limit,
      offset,
    );
    const serialized = ignoredResult.links.map((link) => ({
      ...link,
      first_seen_at:
        link.first_seen_at instanceof Date
          ? link.first_seen_at.toISOString()
          : link.first_seen_at,
      last_seen_at:
        link.last_seen_at instanceof Date
          ? link.last_seen_at.toISOString()
          : link.last_seen_at,
      created_at:
        link.created_at instanceof Date
          ? link.created_at.toISOString()
          : link.created_at,
    }));
    res.json({
      scanRunId,
      countReturned: ignoredResult.countReturned,
      totalMatching: ignoredResult.totalMatching,
      links: serialized,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/ignored", err);
    return sendInternalError(res, "Failed to fetch ignored links", err);
  }
});

// Ignored occurrences drill-down
app.get(
  "/scan-runs/:scanRunId/ignored/:ignoredLinkId/occurrences",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const ignoredLinkId = req.params.ignoredLinkId;
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;

    const limit = limitRaw ? Number(limitRaw) : 50;
    const offset = offsetRaw ? Number(offsetRaw) : 0;

    if (Number.isNaN(limit) || limit <= 0) {
      return sendApiError(
        res,
        400,
        "invalid_limit",
        "limit must be a positive number",
      );
    }
    if (Number.isNaN(offset) || offset < 0) {
      return sendApiError(
        res,
        400,
        "invalid_offset",
        "offset must be 0 or greater",
      );
    }

    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }
      const result = await listIgnoredOccurrencesForUser(
        userId,
        ignoredLinkId,
        limit,
        offset,
      );
      const serialized = result.occurrences.map((occ) => ({
        ...occ,
        created_at:
          occ.created_at instanceof Date
            ? occ.created_at.toISOString()
            : occ.created_at,
      }));
      res.json({
        scanRunId,
        ignoredLinkId,
        countReturned: result.countReturned,
        totalMatching: result.totalMatching,
        occurrences: serialized,
      });
    } catch (err: unknown) {
      console.error(
        "Error in GET /scan-runs/:scanRunId/ignored/:ignoredLinkId/occurrences",
        err,
      );
      return sendInternalError(res, "Failed to fetch ignored occurrences", err);
    }
  },
);

// ✅ NEW: Get unique links (deduplicated) from a scan run
// curl -s "http://localhost:3001/scan-runs/<scanRunId>/links?classification=no_response&limit=5&offset=0"
app.get("/scan-runs/:scanRunId/links", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;
  const classificationRaw = req.query.classification;
  const statusGroupRaw = req.query.statusGroup;
  const showIgnoredRaw = req.query.showIgnored;

  const limit = limitRaw ? Number(limitRaw) : 200;
  const offset = offsetRaw ? Number(offsetRaw) : 0;
  const classification = parseClassification(classificationRaw);
  const statusGroup = parseStatusGroup(statusGroupRaw);
  const showIgnored = parseShowIgnored(showIgnoredRaw);

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const runCheck = await requireScanRunForUser(req, res, scanRunId);
    if (!runCheck) return;
    await applyIgnoreRulesForScanRun(scanRunId);

    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const paginatedLinks = await getScanLinksForRunForUser(userId, scanRunId, {
      limit,
      offset,
      classification,
      statusGroup,
      includeIgnored: showIgnored,
    });

    // Serialize Date fields to ISO strings
    const serializedLinks = paginatedLinks.links.map((link) => ({
      ...link,
      first_seen_at:
        link.first_seen_at instanceof Date
          ? link.first_seen_at.toISOString()
          : link.first_seen_at,
      last_seen_at:
        link.last_seen_at instanceof Date
          ? link.last_seen_at.toISOString()
          : link.last_seen_at,
      created_at:
        link.created_at instanceof Date
          ? link.created_at.toISOString()
          : link.created_at,
      updated_at:
        link.updated_at instanceof Date
          ? link.updated_at.toISOString()
          : link.updated_at,
      ignored_at:
        link.ignored_at instanceof Date
          ? link.ignored_at.toISOString()
          : link.ignored_at,
    }));

    res.json({
      scanRunId,
      classification,
      statusGroup,
      showIgnored,
      countReturned: paginatedLinks.countReturned,
      totalMatching: paginatedLinks.totalMatching,
      links: serializedLinks,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-runs/:scanRunId/links", err);
    return sendInternalError(res, "Failed to fetch scan links", err);
  }
});

// ✅ NEW: Get occurrences of a specific link by link_url
app.get(
  "/scan-runs/:scanRunId/links/:encodedLinkUrl/occurrences",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const encodedLinkUrl = req.params.encodedLinkUrl;
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;

    const limit = limitRaw ? Number(limitRaw) : 100;
    const offset = offsetRaw ? Number(offsetRaw) : 0;

    if (Number.isNaN(limit) || limit <= 0) {
      return sendApiError(
        res,
        400,
        "invalid_limit",
        "limit must be a positive number",
      );
    }

    if (Number.isNaN(offset) || offset < 0) {
      return sendApiError(
        res,
        400,
        "invalid_offset",
        "offset must be 0 or greater",
      );
    }

    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const linkUrl = decodeURIComponent(encodedLinkUrl);
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }
      const scanLink = await getScanLinkByRunAndUrlForUser(
        userId,
        scanRunId,
        linkUrl,
      );
      const scanLinkId = scanLink?.id;
      const paginatedOccurrences = scanLinkId
        ? await getOccurrencesForScanLinkForUser(userId, scanLinkId, {
            limit,
            offset,
          })
        : {
            scanLinkId: scanLinkId ?? "",
            countReturned: 0,
            totalMatching: 0,
            occurrences: [],
          };

      // Serialize Date fields to ISO strings
      const serializedOccurrences = paginatedOccurrences.occurrences.map(
        (occ: ScanLinkOccurrenceRow) => ({
          ...occ,
          created_at:
            occ.created_at instanceof Date
              ? occ.created_at.toISOString()
              : occ.created_at,
        }),
      );

      res.json({
        scanRunId,
        scanLinkId: scanLinkId ?? null,
        link_url: scanLink?.link_url ?? linkUrl,
        countReturned: paginatedOccurrences.countReturned,
        totalMatching: paginatedOccurrences.totalMatching,
        occurrences: serializedOccurrences,
      });
    } catch (err: unknown) {
      console.error(
        "Error in GET /scan-runs/:scanRunId/links/:encodedLinkUrl/occurrences",
        err,
      );
      return sendInternalError(res, "Failed to fetch link occurrences", err);
    }
  },
);

// ✅ NEW: Get occurrences of a specific scan link (direct route without scanRunId)
// curl -s "http://localhost:3001/scan-links/<scanLinkId>/occurrences?limit=5&offset=0"
app.get("/scan-links/:scanLinkId/occurrences", async (req, res) => {
  const scanLinkId = req.params.scanLinkId;
  if (!scanLinkId) {
    return sendApiError(
      res,
      400,
      "missing_scan_link_id",
      "scanLinkId is required",
    );
  }
  const limitRaw = req.query.limit;
  const offsetRaw = req.query.offset;

  const limit = limitRaw ? Number(limitRaw) : 50;
  const offset = offsetRaw ? Number(offsetRaw) : 0;

  if (Number.isNaN(limit) || limit <= 0) {
    return sendApiError(
      res,
      400,
      "invalid_limit",
      "limit must be a positive number",
    );
  }

  if (Number.isNaN(offset) || offset < 0) {
    return sendApiError(
      res,
      400,
      "invalid_offset",
      "offset must be 0 or greater",
    );
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const link = await getScanLinkByIdForUser(userId, scanLinkId);
    if (!link) {
      return sendNotFound(res);
    }
    const result = await getOccurrencesForScanLinkForUser(userId, scanLinkId, {
      limit,
      offset,
    });

    // Serialize Date fields to ISO strings
    const serializedOccurrences = result.occurrences.map((occ) => ({
      ...occ,
      created_at:
        occ.created_at instanceof Date
          ? occ.created_at.toISOString()
          : occ.created_at,
    }));

    res.json({
      scanLinkId: result.scanLinkId,
      countReturned: result.countReturned,
      totalMatching: result.totalMatching,
      occurrences: serializedOccurrences,
    });
  } catch (err: unknown) {
    console.error("Error in GET /scan-links/:scanLinkId/occurrences", err);
    return sendInternalError(res, "Failed to fetch scan link occurrences", err);
  }
});

app.post("/scan-links/:scanLinkId/recheck", async (req, res) => {
  const scanLinkId = req.params.scanLinkId;
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const link = await getScanLinkByIdForUser(userId, scanLinkId);
    if (!link) {
      return sendNotFound(res);
    }
    if (link.ignored) {
      return sendApiError(
        res,
        400,
        "scan_link_ignored",
        "Ignored links cannot be rechecked",
      );
    }

    const result = await validateLink(link.link_url);
    const statusCode = result.ok ? result.status : result.status;
    const classification = classifyStatus(
      link.link_url,
      statusCode ?? undefined,
    );
    const errorMessage = result.ok ? null : result.error;

    const updated = await updateScanLinkAfterRecheck({
      scanLinkId,
      classification,
      statusCode,
      errorMessage,
    });
    if (!updated) {
      return sendApiError(
        res,
        500,
        "scan_link_update_failed",
        "Failed to update scan link",
      );
    }
    const serialized = {
      ...updated,
      first_seen_at:
        updated.first_seen_at instanceof Date
          ? updated.first_seen_at.toISOString()
          : updated.first_seen_at,
      last_seen_at:
        updated.last_seen_at instanceof Date
          ? updated.last_seen_at.toISOString()
          : updated.last_seen_at,
      created_at:
        updated.created_at instanceof Date
          ? updated.created_at.toISOString()
          : updated.created_at,
      updated_at:
        updated.updated_at instanceof Date
          ? updated.updated_at.toISOString()
          : updated.updated_at,
      ignored_at:
        updated.ignored_at instanceof Date
          ? updated.ignored_at.toISOString()
          : updated.ignored_at,
    };
    return res.json({ scanLink: serialized });
  } catch (err: unknown) {
    console.error("Error in POST /scan-links/:scanLinkId/recheck", err);
    return sendInternalError(res, "Failed to recheck scan link", err);
  }
});

// Ignore rules (global list)
app.get("/ignore-rules", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const rules = await listIgnoreRulesForUser(userId);
    res.json({ count: rules.length, rules });
  } catch (err: unknown) {
    console.error("Error in GET /ignore-rules", err);
    return sendInternalError(res, "Failed to fetch ignore rules", err);
  }
});

app.post("/ignore-rules", async (req, res) => {
  const pattern =
    typeof req.body?.pattern === "string" ? req.body.pattern.trim() : "";
  const enabled =
    typeof req.body?.enabled === "boolean" ? req.body.enabled : true;
  const ruleType = parseIgnoreRuleType(req.body?.ruleType) ?? "exact";
  const siteId = typeof req.body?.siteId === "string" ? req.body.siteId : null;

  if (!pattern) {
    return sendApiError(
      res,
      400,
      "invalid_pattern",
      "pattern must be a non-empty string",
    );
  }
  const invalidPattern = validateIgnoreRulePattern(ruleType, pattern);
  if (invalidPattern) {
    return sendApiError(
      res,
      400,
      "invalid_pattern",
      "pattern must be a valid value",
      invalidPattern,
    );
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    if (siteId) {
      const site = await requireSiteForUser(req, res, siteId);
      if (!site) return;
    }
    const rule = await createIgnoreRule(userId, siteId, ruleType, pattern);
    if (!enabled) {
      const updated = await setIgnoreRuleEnabled(rule.id, false);
      return res.status(201).json({ rule: updated ?? rule });
    }
    res.status(201).json({ rule });
  } catch (err: unknown) {
    console.error("Error in POST /ignore-rules", err);
    return sendInternalError(res, "Failed to create ignore rule", err);
  }
});

// Ignore rules for a site
app.get("/sites/:siteId/ignore-rules", async (req, res) => {
  const siteId = req.params.siteId;
  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const rules = await listIgnoreRulesForSiteForUser(userId, siteId);
    res.json({ siteId, count: rules.length, rules });
  } catch (err: unknown) {
    console.error("Error in GET /sites/:siteId/ignore-rules", err);
    return sendInternalError(res, "Failed to fetch site ignore rules", err);
  }
});

app.post("/sites/:siteId/ignore-rules", async (req, res) => {
  const siteId = req.params.siteId;
  const ruleType = parseIgnoreRuleType(req.body?.ruleType);
  const pattern =
    typeof req.body?.pattern === "string" ? req.body.pattern.trim() : "";
  const scope = req.body?.scope === "global" ? "global" : "site";

  if (!ruleType) {
    return sendApiError(
      res,
      400,
      "invalid_rule_type",
      "ruleType must be valid",
    );
  }
  if (!pattern) {
    return sendApiError(
      res,
      400,
      "invalid_pattern",
      "pattern must be a non-empty string",
    );
  }
  if (ruleType) {
    const invalidPattern = validateIgnoreRulePattern(ruleType, pattern);
    if (invalidPattern) {
      return sendApiError(
        res,
        400,
        "invalid_pattern",
        "pattern must be a valid value",
        invalidPattern,
      );
    }
  }

  try {
    const site = await requireSiteForUser(req, res, siteId);
    if (!site) return;
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const rule = await createIgnoreRule(
      userId,
      scope === "global" ? null : siteId,
      ruleType,
      pattern,
    );
    res.status(201).json({ rule });
  } catch (err: unknown) {
    console.error("Error in POST /sites/:siteId/ignore-rules", err);
    return sendInternalError(res, "Failed to create ignore rule", err);
  }
});

app.patch("/ignore-rules/:ruleId", async (req, res) => {
  const ruleId = req.params.ruleId;
  const isEnabled = req.body?.isEnabled;
  if (typeof isEnabled !== "boolean") {
    return sendApiError(
      res,
      400,
      "invalid_isEnabled",
      "isEnabled must be boolean",
    );
  }
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const existingRule = await getIgnoreRuleByIdForUser(userId, ruleId);
    if (!existingRule) {
      return sendNotFound(res);
    }
    const updatedRule = await setIgnoreRuleEnabled(ruleId, isEnabled);
    if (!updatedRule)
      return sendApiError(
        res,
        404,
        "ignore_rule_not_found",
        "Ignore rule not found",
      );
    res.json({ rule: updatedRule });
  } catch (err: unknown) {
    console.error("Error in PATCH /ignore-rules/:ruleId", err);
    return sendInternalError(res, "Failed to update ignore rule", err);
  }
});

app.delete("/ignore-rules/:ruleId", async (req, res) => {
  const ruleId = req.params.ruleId;
  try {
    const userId = req.user?.id;
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const rule = await getIgnoreRuleByIdForUser(userId, ruleId);
    if (!rule) {
      return sendNotFound(res);
    }
    await deleteIgnoreRule(ruleId);
    res.status(204).send();
  } catch (err: unknown) {
    console.error("Error in DELETE /ignore-rules/:ruleId", err);
    return sendInternalError(res, "Failed to delete ignore rule", err);
  }
});

// Ignore a link for this scan or create a site rule
app.post(
  "/scan-runs/:scanRunId/links/:encodedLinkUrl/ignore",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const encodedLinkUrl = req.params.encodedLinkUrl;
    const mode = req.body?.mode as
      | "this_scan"
      | "site_rule_contains"
      | "site_rule_exact"
      | "site_rule_regex"
      | undefined;
    const linkUrl = decodeURIComponent(encodedLinkUrl);

    if (!mode) {
      return sendApiError(res, 400, "invalid_mode", "mode must be provided");
    }

    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const { run } = runCheck;
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }

      if (mode === "this_scan") {
        await setScanLinkIgnoredForRun(scanRunId, linkUrl, true, {
          reason: "Manually ignored",
          source: "manual",
        });
        const scanLink = await getScanLinkByRunAndUrlForUser(
          userId,
          scanRunId,
          linkUrl,
        );
        if (scanLink) {
          const ignored = await upsertIgnoredLink({
            scanRunId,
            linkUrl,
            ruleId: null,
            statusCode: scanLink.status_code,
            errorMessage: scanLink.error_message ?? undefined,
          });
          const occ = await getOccurrencesForScanLinkForUser(
            userId,
            scanLink.id,
            {
              limit: 1,
              offset: 0,
            },
          );
          const first = occ.occurrences[0];
          if (first) {
            await insertIgnoredOccurrence({
              scanIgnoredLinkId: ignored.id,
              scanRunId,
              linkUrl,
              sourcePage: first.source_page,
            });
          }
        }
        await rebuildIssuesForRun(scanRunId);
        return res.json({ scanRunId, link_url: linkUrl, ignored: true });
      }

      const ruleType: IgnoreRuleType =
        mode === "site_rule_exact"
          ? "exact"
          : mode === "site_rule_regex"
            ? "regex"
            : "contains";
      const invalidPattern = validateIgnoreRulePattern(ruleType, linkUrl);
      if (invalidPattern) {
        return sendApiError(
          res,
          400,
          "invalid_pattern",
          "pattern must be a valid value",
          invalidPattern,
        );
      }
      const rule = await createIgnoreRule(
        userId,
        run.site_id,
        ruleType,
        linkUrl,
      );
      await applyIgnoreRulesForScanRun(scanRunId, { force: true });
      await rebuildIssuesForRun(scanRunId);
      return res.json({ scanRunId, link_url: linkUrl, rule });
    } catch (err: unknown) {
      console.error(
        "Error in POST /scan-runs/:scanRunId/links/:encodedLinkUrl/ignore",
        err,
      );
      return sendInternalError(res, "Failed to ignore link", err);
    }
  },
);

// Ignore a link by scan_link_id to avoid encoded URL path issues
app.post(
  "/scan-runs/:scanRunId/scan-links/:scanLinkId/ignore",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const scanLinkId = req.params.scanLinkId;
    const mode = req.body?.mode as
      | "this_scan"
      | "site_rule_contains"
      | "site_rule_exact"
      | "site_rule_regex"
      | undefined;

    if (!mode) {
      return sendApiError(res, 400, "invalid_mode", "mode must be provided");
    }

    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const { run } = runCheck;
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }

      const link = await getScanLinkByIdForUser(userId, scanLinkId);
      if (!link || link.scan_run_id !== scanRunId) {
        return sendNotFound(res);
      }

      if (mode === "this_scan") {
        await setScanLinkIgnoredForRun(scanRunId, link.link_url, true, {
          reason: "Manually ignored",
          source: "manual",
        });
        const ignored = await upsertIgnoredLink({
          scanRunId,
          linkUrl: link.link_url,
          ruleId: null,
          statusCode: link.status_code,
          errorMessage: link.error_message ?? undefined,
        });
        const occ = await getOccurrencesForScanLinkForUser(userId, link.id, {
          limit: 1,
          offset: 0,
        });
        const first = occ.occurrences[0];
        if (first) {
          await insertIgnoredOccurrence({
            scanIgnoredLinkId: ignored.id,
            scanRunId,
            linkUrl: link.link_url,
            sourcePage: first.source_page,
          });
        }
        await rebuildIssuesForRun(scanRunId);
        return res.json({ scanRunId, link_url: link.link_url, ignored: true });
      }

      const ruleType: IgnoreRuleType =
        mode === "site_rule_exact"
          ? "exact"
          : mode === "site_rule_regex"
            ? "regex"
            : "contains";
      const invalidPattern = validateIgnoreRulePattern(ruleType, link.link_url);
      if (invalidPattern) {
        return sendApiError(
          res,
          400,
          "invalid_pattern",
          "pattern must be a valid value",
          invalidPattern,
        );
      }
      const rule = await createIgnoreRule(
        userId,
        run.site_id,
        ruleType,
        link.link_url,
      );
      await applyIgnoreRulesForScanRun(scanRunId, { force: true });
      await rebuildIssuesForRun(scanRunId);
      return res.json({ scanRunId, link_url: link.link_url, rule });
    } catch (err: unknown) {
      console.error(
        "Error in POST /scan-runs/:scanRunId/scan-links/:scanLinkId/ignore",
        err,
      );
      return sendInternalError(res, "Failed to ignore scan link", err);
    }
  },
);

app.post(
  "/scan-runs/:scanRunId/links/:encodedLinkUrl/unignore",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const encodedLinkUrl = req.params.encodedLinkUrl;
    const linkUrl = decodeURIComponent(encodedLinkUrl);
    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }
      const link = await getScanLinkByRunAndUrlForUser(
        userId,
        scanRunId,
        linkUrl,
      );
      if (!link) return sendNotFound(res);
      if (link.ignored_source !== "manual") {
        return sendApiError(
          res,
          400,
          "cannot_unignore_rule",
          "Only manually ignored links can be unignored",
        );
      }
      await setScanLinkIgnoredForRun(scanRunId, linkUrl, false, {
        source: "none",
      });
      await rebuildIssuesForRun(scanRunId);
      return res.json({ scanRunId, link_url: linkUrl, ignored: false });
    } catch (err: unknown) {
      console.error(
        "Error in POST /scan-runs/:scanRunId/links/:encodedLinkUrl/unignore",
        err,
      );
      return sendInternalError(res, "Failed to unignore link", err);
    }
  },
);

app.post("/scan-runs/:scanRunId/reapply-ignore", async (req, res) => {
  const scanRunId = req.params.scanRunId;
  const force = req.query.force === "true" || req.query.force === "1";
  try {
    const runCheck = await requireScanRunForUser(req, res, scanRunId);
    if (!runCheck) return;
    const result = await applyIgnoreRulesForScanRun(scanRunId, { force });
    await rebuildIssuesForRun(scanRunId);
    res.json({ scanRunId, ...result });
  } catch (err: unknown) {
    console.error("Error in POST /scan-runs/:scanRunId/reapply-ignore", err);
    return sendInternalError(res, "Failed to reapply ignore rules", err);
  }
});

app.post(
  "/scan-runs/:scanRunId/scan-links/:scanLinkId/unignore",
  async (req, res) => {
    const scanRunId = req.params.scanRunId;
    const scanLinkId = req.params.scanLinkId;
    try {
      const runCheck = await requireScanRunForUser(req, res, scanRunId);
      if (!runCheck) return;
      const userId = req.user?.id;
      if (!userId) {
        return sendApiError(res, 401, "unauthorized", "Unauthorized");
      }
      const link = await getScanLinkByIdForUser(userId, scanLinkId);
      if (!link || link.scan_run_id !== scanRunId) {
        return sendNotFound(res);
      }
      if (link.ignored_source !== "manual") {
        return sendApiError(
          res,
          400,
          "cannot_unignore_rule",
          "Only manually ignored links can be unignored",
        );
      }
      await setScanLinkIgnoredForRun(scanRunId, link.link_url, false, {
        source: "none",
      });
      await rebuildIssuesForRun(scanRunId);
      return res.json({ scanRunId, link_url: link.link_url, ignored: false });
    } catch (err: unknown) {
      console.error(
        "Error in POST /scan-runs/:scanRunId/scan-links/:scanLinkId/unignore",
        err,
      );
      return sendInternalError(res, "Failed to unignore scan link", err);
    }
  },
);

// Delete a site (and its scans/results)
app.delete("/sites/:siteId", async (req, res) => {
  const siteId = req.params.siteId;
  const userId = req.user?.id;

  try {
    if (!userId) {
      return sendApiError(res, 401, "unauthorized", "Unauthorized");
    }
    const site = await getSiteByIdForUser(userId, siteId);
    if (!site) {
      return sendNotFound(res);
    }

    const deleted = await deleteSiteForUser(siteId, userId);

    if (!deleted) {
      return sendApiError(
        res,
        500,
        "delete_failed",
        `Could not delete site ${siteId}`,
      );
    }

    return res.status(204).send();
  } catch (err: unknown) {
    console.error("Error deleting site", err);
    return sendInternalError(res, "Failed to delete site", err);
  }
});

const PORT = Number(process.env.PORT) || 3001;

void initEventRelay().catch((err) => {
  console.error("Failed to start event relay", err);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:3001`);
});
