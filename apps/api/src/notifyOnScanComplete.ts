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
import { apiRuntimeConfig } from "./runtimeConfig";

const APP_URL = apiRuntimeConfig.appBaseUrl ?? "http://localhost:5173";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSiteHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value;
  }
}

function buildAppLink(siteId: string, runId: string) {
  const base = APP_URL.replace(/\/+$/, "");
  return `${base}/?siteId=${encodeURIComponent(
    siteId,
  )}&runId=${encodeURIComponent(runId)}`;
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

function formatIssueHtml(issue: IssueNotificationDigest["topIssues"][number]) {
  return `<li><strong>${escapeHtml(issue.severity)}</strong> ${escapeHtml(
    issue.title,
  )} <span>(${escapeHtml(
    issue.category,
  )})</span><br /><code>${escapeHtml(issue.affectedUrl)}</code></li>`;
}

function buildIssueListText(digest: IssueNotificationDigest) {
  if (digest.topIssues.length === 0) return "No open issues recorded.";
  return digest.topIssues.map(formatIssueText).join("\n");
}

function buildIssueListHtml(digest: IssueNotificationDigest) {
  if (digest.topIssues.length === 0) return "<p>No open issues recorded.</p>";
  return `<ul>${digest.topIssues.map(formatIssueHtml).join("")}</ul>`;
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

function buildIssueEmail(params: {
  kind: "high_priority_issues_found" | "weekly_scan_summary";
  siteUrl: string;
  siteId: string;
  scanRunId: string;
  finishedAt: Date | null;
  digest: IssueNotificationDigest;
}) {
  const siteHost = getSiteHost(params.siteUrl);
  const appLink = buildAppLink(params.siteId, params.scanRunId);
  const finishedAt = params.finishedAt ?? new Date();
  const { severityCounts, categoryCounts, summaryLine } =
    buildIssueSummaryLines(params.digest);
  const isHighPriority = params.kind === "high_priority_issues_found";
  const subject = isHighPriority
    ? `Scanlark: high-priority issues found on ${siteHost}`
    : `Scanlark: weekly scan summary for ${siteHost}`;
  const heading = isHighPriority
    ? "High-priority issues found"
    : "Weekly scan summary";
  const intro = isHighPriority
    ? "This scheduled scan found new critical or high severity issues."
    : "This is the weekly scheduled scan summary.";

  const text = [
    `${heading} for ${params.siteUrl}`,
    intro,
    "Status: completed",
    `Finished: ${finishedAt.toISOString()}`,
    summaryLine,
    `By severity: ${severityCounts}`,
    `By category: ${categoryCounts}`,
    "",
    "Top issues:",
    buildIssueListText(params.digest),
    "",
    `View report: ${appLink}`,
    "You can change alert settings in Scanlark.",
  ].join("\n");

  const html = `
    <p><strong>${escapeHtml(heading)}</strong> for ${escapeHtml(
      params.siteUrl,
    )}</p>
    <p>${escapeHtml(intro)}</p>
    <p>Status: completed</p>
    <p>Finished: ${escapeHtml(finishedAt.toISOString())}</p>
    <p>${escapeHtml(summaryLine)}</p>
    <p>By severity: ${escapeHtml(severityCounts)}</p>
    <p>By category: ${escapeHtml(categoryCounts)}</p>
    <h3>Top issues</h3>
    ${buildIssueListHtml(params.digest)}
    <p><a href="${escapeHtml(appLink)}">View report</a></p>
    <p>You can change alert settings in Scanlark.</p>
  `;

  return { subject, text, html };
}

function buildFailureEmail(params: {
  siteUrl: string;
  siteId: string;
  scanRunId: string;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
}) {
  const siteHost = getSiteHost(params.siteUrl);
  const appLink = buildAppLink(params.siteId, params.scanRunId);
  const subject = `Scanlark: scheduled scan failed for ${siteHost}`;
  const errorMessage = params.errorMessage ?? "Unknown error";
  const finishedLine = params.finishedAt
    ? `Finished: ${params.finishedAt.toISOString()}`
    : "Finished: not recorded";
  const text = [
    `Scheduled scan failed for ${params.siteUrl}`,
    "Status: failed",
    `Started: ${params.startedAt.toISOString()}`,
    finishedLine,
    `Error: ${errorMessage}`,
    "",
    `View report: ${appLink}`,
  ].join("\n");
  const html = `
    <p><strong>Scheduled scan failed</strong> for ${escapeHtml(
      params.siteUrl,
    )}</p>
    <p>Status: failed</p>
    <p>Started: ${escapeHtml(params.startedAt.toISOString())}</p>
    <p>${escapeHtml(finishedLine)}</p>
    <p>Error: ${escapeHtml(errorMessage)}</p>
    <p><a href="${escapeHtml(appLink)}">View report</a></p>
  `;
  return { subject, text, html };
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

  try {
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
  } catch (err) {
    console.error("Failed to send scan notification email", {
      kind: params.kind,
      siteId: params.siteId,
      scanRunId: params.scanRunId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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
    let email;
    try {
      email = buildFailureEmail({
        siteUrl: site.url,
        siteId: run.site_id,
        scanRunId: run.id,
        startedAt: run.started_at,
        finishedAt: run.finished_at,
        errorMessage: run.error_message,
      });
    } catch (err) {
      console.error("Failed to build failed-scan email", {
        kind: "scan_failed",
        siteId: run.site_id,
        scanRunId: run.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
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
      let email;
      try {
        email = buildIssueEmail({
          kind: "high_priority_issues_found",
          siteUrl: site.url,
          siteId: run.site_id,
          scanRunId: run.id,
          finishedAt: run.finished_at,
          digest,
        });
      } catch (err) {
        console.error("Failed to build issue notification email", {
          kind: "high_priority_issues_found",
          siteId: run.site_id,
          scanRunId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
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
      let email;
      try {
        email = buildIssueEmail({
          kind: "weekly_scan_summary",
          siteUrl: site.url,
          siteId: run.site_id,
          scanRunId: run.id,
          finishedAt: run.finished_at,
          digest,
        });
      } catch (err) {
        console.error("Failed to build weekly summary email", {
          kind: "weekly_scan_summary",
          siteId: run.site_id,
          scanRunId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
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
    const subject = `Scanlark: test alert for ${getSiteHost(site.url)}`;
    let html;
    let text;
    try {
      html = `
        <p>This is a test alert for ${escapeHtml(site.url)}.</p>
        <p>No scans have completed yet, so there is no data to summarize.</p>
        <p><a href="${escapeHtml(APP_URL)}">Open dashboard</a></p>
      `;
      text = `This is a test alert for ${site.url}.\nNo scans have completed yet, so there is no data to summarize.\nOpen dashboard: ${APP_URL}`;
    } catch (err) {
      console.error("Failed to build test alert email", {
        kind: "test",
        siteId,
        scanRunId: null,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
    await sendEmail({
      to: toEmail,
      subject,
      html,
      text,
      userId,
      siteId,
      scanRunId: null,
      metadata: { test: true },
    });
    await recordNotificationEvent({
      siteId,
      scanRunId: null,
      kind: "test",
      toEmail,
      subject,
      payload: { test: true, hasScan: false },
    });
    return;
  }

  const digest = await getIssueNotificationDigestForRun(latestRun.id);
  let email;
  try {
    email = buildIssueEmail({
      kind: "weekly_scan_summary",
      siteUrl: site.url,
      siteId,
      scanRunId: latestRun.id,
      finishedAt: latestRun.finished_at,
      digest,
    });
  } catch (err) {
    console.error("Failed to build test summary email", {
      kind: "test",
      siteId,
      scanRunId: latestRun.id,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  await sendEmail({
    to: toEmail,
    subject: `Scanlark: test alert for ${getSiteHost(site.url)}`,
    html: email.html,
    text: email.text,
    userId,
    siteId,
    scanRunId: null,
    metadata: { test: true, digest },
  });
  await recordNotificationEvent({
    siteId,
    scanRunId: null,
    kind: "test",
    toEmail,
    subject: `Scanlark: test alert for ${getSiteHost(site.url)}`,
    payload: { test: true, digest },
  });
}
