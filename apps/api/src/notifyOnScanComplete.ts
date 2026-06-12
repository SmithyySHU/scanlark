import {
  applyIgnoreRulesForScanRun,
  getIssueNotificationDigestForRun,
  getLatestScanForSiteForUser,
  getScanRunByIdForUser,
  getSiteByIdForUser,
  getSiteNotificationSettingsForUser,
  markScanRunNotified,
  recordNotificationEvent,
  tryRecordNotificationEvent,
  type IssueNotificationDigest,
  type NotificationEventKind,
} from "@scanlark/db";
import { sendEmail } from "./email";
import { renderTransactionalEmail } from "./emailTemplates";

const APP_URL =
  process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:5173";

function getSiteHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function buildAppLink(runId: string) {
  const base = APP_URL.replace(/\/+$/, "");
  return `${base}/report?scanRunId=${encodeURIComponent(runId)}`;
}

function formatCounts(counts: Record<string, number>) {
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name}: ${count}`)
    .join(" | ");
}

function formatIssueText(issue: IssueNotificationDigest["topIssues"][number]) {
  return `- [${issue.severity}] ${issue.title} (${issue.category}) — ${issue.affectedUrl}`;
}

function buildIssueListText(digest: IssueNotificationDigest) {
  if (digest.topIssues.length === 0) return "No open issues recorded.";
  return digest.topIssues.map(formatIssueText).join("\n");
}

function buildIssueSummaryLines(digest: IssueNotificationDigest) {
  const severityCounts = formatCounts(digest.bySeverity) || "none";
  const categoryCounts = formatCounts(digest.byCategory) || "none";
  return {
    severityCounts,
    categoryCounts,
    summaryLine: `Health score: ${digest.healthScore}% | Open issues: ${digest.totalOpenIssues} | High priority: ${digest.highPriorityCount}`,
  };
}

async function buildIssueEmail(params: {
  kind: "high_priority_issues_found" | "weekly_scan_summary";
  siteUrl: string;
  siteId: string;
  scanRunId: string;
  finishedAt: Date | null;
  digest: IssueNotificationDigest;
}) {
  const siteHost = getSiteHost(params.siteUrl);
  const appLink = buildAppLink(params.scanRunId);
  const finishedAt = params.finishedAt ?? new Date();
  const { severityCounts, categoryCounts } = buildIssueSummaryLines(
    params.digest,
  );
  const key =
    params.kind === "high_priority_issues_found"
      ? "high_priority_issues_found"
      : "weekly_summary";
  return renderTransactionalEmail(key, {
    appName: "Scanlark",
    siteName: siteHost,
    siteUrl: params.siteUrl,
    reportUrl: appLink,
    scanRunId: params.scanRunId,
    dashboardUrl: APP_URL.replace(/\/+$/, ""),
    unsubscribeOrPreferencesUrl: `${APP_URL.replace(/\/+$/, "")}/dashboard/settings`,
    completedAt: finishedAt.toISOString(),
    healthScore: `${params.digest.healthScore}%`,
    issueCount: params.digest.totalOpenIssues,
    criticalCount: params.digest.bySeverity.critical ?? 0,
    highCount: params.digest.bySeverity.high ?? 0,
    severityCounts,
    categoryCounts,
    topIssues: buildIssueListText(params.digest),
  });
}

async function buildFailureEmail(params: {
  siteUrl: string;
  siteId: string;
  scanRunId: string;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}) {
  const siteHost = getSiteHost(params.siteUrl);
  const appLink = buildAppLink(params.scanRunId);
  const errorMessage = params.errorMessage ?? "Unknown error";
  const finishedLine = params.finishedAt
    ? params.finishedAt.toISOString()
    : "not recorded";
  return renderTransactionalEmail("scan_failed", {
    appName: "Scanlark",
    siteName: siteHost,
    siteUrl: params.siteUrl,
    reportUrl: appLink,
    scanRunId: params.scanRunId,
    dashboardUrl: APP_URL.replace(/\/+$/, ""),
    unsubscribeOrPreferencesUrl: `${APP_URL.replace(/\/+$/, "")}/dashboard/settings`,
    startedAt: params.startedAt.toISOString(),
    completedAt: finishedLine,
    errorMessage,
  });
}

async function sendNotification(params: {
  kind: NotificationEventKind;
  toEmail: string;
  userId: string;
  siteId: string;
  scanRunId: string;
  subject: string;
  html: string;
  text: string;
  payload: Record<string, unknown>;
}) {
  const reserved = await tryRecordNotificationEvent({
    siteId: params.siteId,
    scanRunId: params.scanRunId,
    kind: params.kind,
    toEmail: params.toEmail,
    subject: params.subject,
    payload: params.payload,
  });
  if (!reserved) return false;

  await sendEmail({
    to: params.toEmail,
    subject: params.subject,
    html: params.html,
    text: params.text,
    userId: params.userId,
    siteId: params.siteId,
    scanRunId: params.scanRunId,
    metadata: {
      kind: params.kind,
      ...params.payload,
    },
  });
  return true;
}

export async function notifyIfNeeded(
  userId: string,
  scanRunId: string,
): Promise<void> {
  const run = await getScanRunByIdForUser(userId, scanRunId);
  if (!run) return;
  if (run.trigger_type !== "scheduled") return;

  const site = await getSiteByIdForUser(userId, run.site_id);
  if (!site) return;

  const settings = await getSiteNotificationSettingsForUser(
    userId,
    run.site_id,
  );
  if (!settings?.notifyEmail) return;

  let sentAny = false;
  if (run.status === "failed") {
    if (!settings.notifyEnabled || settings.notifyOn === "never") return;
    const email = await buildFailureEmail({
      siteUrl: site.url,
      siteId: run.site_id,
      scanRunId: run.id,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      errorMessage: run.error_message,
    });
    sentAny = await sendNotification({
      kind: "scan_failed",
      toEmail: settings.notifyEmail,
      userId,
      siteId: run.site_id,
      scanRunId: run.id,
      subject: email.subject,
      html: email.html,
      text: email.text,
      payload: {
        status: run.status,
        error: run.error_message,
      },
    });
  } else if (run.status === "completed") {
    await applyIgnoreRulesForScanRun(run.id);
    const digest = await getIssueNotificationDigestForRun(run.id);

    if (
      settings.notifyEnabled &&
      settings.notifyOn !== "never" &&
      digest.highPriorityCount > 0
    ) {
      const email = await buildIssueEmail({
        kind: "high_priority_issues_found",
        siteUrl: site.url,
        siteId: run.site_id,
        scanRunId: run.id,
        finishedAt: run.finished_at,
        digest,
      });
      sentAny =
        (await sendNotification({
          kind: "high_priority_issues_found",
          toEmail: settings.notifyEmail,
          userId,
          siteId: run.site_id,
          scanRunId: run.id,
          subject: email.subject,
          html: email.html,
          text: email.text,
          payload: { digest },
        })) || sentAny;
    }

    if (settings.summaryEnabled && site.schedule_frequency === "weekly") {
      const email = await buildIssueEmail({
        kind: "weekly_scan_summary",
        siteUrl: site.url,
        siteId: run.site_id,
        scanRunId: run.id,
        finishedAt: run.finished_at,
        digest,
      });
      sentAny =
        (await sendNotification({
          kind: "weekly_scan_summary",
          toEmail: settings.notifyEmail,
          userId,
          siteId: run.site_id,
          scanRunId: run.id,
          subject: email.subject,
          html: email.html,
          text: email.text,
          payload: { digest },
        })) || sentAny;
    }
  }

  if (sentAny) {
    await markScanRunNotified(run.id);
  }
}

export async function sendTestEmail(
  userId: string,
  siteId: string,
  toEmail: string,
): Promise<void> {
  const site = await getSiteByIdForUser(userId, siteId);
  if (!site) throw new Error("site_not_found");
  const latestRun = await getLatestScanForSiteForUser(userId, siteId);
  if (!latestRun) {
    const email = await renderTransactionalEmail("test_email", {
      appName: "Scanlark",
      siteName: getSiteHost(site.url),
      siteUrl: site.url,
      reportUrl: APP_URL.replace(/\/+$/, ""),
      scanRunId: "",
      dashboardUrl: APP_URL.replace(/\/+$/, ""),
      unsubscribeOrPreferencesUrl: `${APP_URL.replace(/\/+$/, "")}/dashboard/settings`,
      healthScore: "Not available",
      issueCount: "No scans yet",
      criticalCount: 0,
      highCount: 0,
    });
    await sendEmail({
      to: toEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
      userId,
      siteId,
      scanRunId: null,
      metadata: {
        test: true,
        templateKey: "test_email",
        templateSource: email.source,
      },
    });
    await recordNotificationEvent({
      siteId,
      scanRunId: null,
      kind: "test",
      toEmail,
      subject: email.subject,
      payload: { test: true, hasScan: false },
    });
    return;
  }

  const digest = await getIssueNotificationDigestForRun(latestRun.id);
  const email = await renderTransactionalEmail("test_email", {
    appName: "Scanlark",
    siteName: getSiteHost(site.url),
    siteUrl: site.url,
    reportUrl: buildAppLink(latestRun.id),
    scanRunId: latestRun.id,
    dashboardUrl: APP_URL.replace(/\/+$/, ""),
    unsubscribeOrPreferencesUrl: `${APP_URL.replace(/\/+$/, "")}/dashboard/settings`,
    healthScore: `${digest.healthScore}%`,
    issueCount: digest.totalOpenIssues,
    criticalCount: digest.bySeverity.critical ?? 0,
    highCount: digest.bySeverity.high ?? 0,
  });
  await sendEmail({
    to: toEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    userId,
    siteId,
    scanRunId: null,
    metadata: {
      test: true,
      digest,
      templateKey: "test_email",
      templateSource: email.source,
    },
  });
  await recordNotificationEvent({
    siteId,
    scanRunId: null,
    kind: "test",
    toEmail,
    subject: email.subject,
    payload: { test: true, digest },
  });
}
