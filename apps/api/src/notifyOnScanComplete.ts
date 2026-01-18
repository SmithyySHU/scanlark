import {
  applyIgnoreRulesForScanRun,
  getBaselineRunForDiff,
  getLinkCountsForRun,
  getScanRunByIdForUser,
  getSiteByIdForUser,
  getSiteNotificationSettingsForUser,
  getTopLinksByClassificationForUser,
  getScanDiff,
  hasNotificationEvent,
  markScanRunNotified,
  recordNotificationEvent,
  getLatestScanForSiteForUser,
} from "@scanlark/db";
import { sendEmail } from "./email";

const APP_URL =
  process.env.APP_BASE_URL || process.env.APP_URL || "http://localhost:5173";

type AlertIssueRow = {
  link_url: string;
  classification: string;
  status_code: number | null;
  error_message: string | null;
  source_pages?: string[];
};

type AlertEmailStats = {
  newIssuesCount: number;
  fixedCount: number;
  outstandingIssuesCount: number;
  changedCount: number;
  totalIssuesCount: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIssueStatus(row: AlertIssueRow) {
  const status = row.status_code ?? row.error_message ?? "No response";
  const classification = row.classification.replace("_", " ");
  return `${classification} (${status})`;
}

function formatIssueText(row: AlertIssueRow) {
  const status = formatIssueStatus(row);
  const pages = row.source_pages?.length ?? 0;
  const pagesLabel =
    pages > 0 ? ` · ${pages} page${pages === 1 ? "" : "s"}` : "";
  return `- ${row.link_url} — ${status}${pagesLabel}`;
}

function formatIssueHtml(row: AlertIssueRow) {
  const status = escapeHtml(formatIssueStatus(row));
  const pages = row.source_pages?.length ?? 0;
  const pagesLabel =
    pages > 0 ? ` · ${pages} page${pages === 1 ? "" : "s"}` : "";
  return `<li><code>${escapeHtml(
    row.link_url,
  )}</code> — ${status}${pagesLabel}</li>`;
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

async function getTopIssuesForRun(
  userId: string,
  scanRunId: string,
  limit: number,
): Promise<AlertIssueRow[]> {
  const classifications = ["broken", "blocked", "no_response"] as const;
  const items: AlertIssueRow[] = [];
  for (const classification of classifications) {
    if (items.length >= limit) break;
    const rows = await getTopLinksByClassificationForUser(
      userId,
      scanRunId,
      classification,
      limit,
    );
    if (!rows) continue;
    for (const row of rows) {
      items.push({
        link_url: row.link_url,
        classification: row.classification,
        status_code: row.status_code,
        error_message: row.error_message,
      });
      if (items.length >= limit) break;
    }
  }
  return items;
}

export async function buildScanAlertEmail(params: {
  userId: string;
  siteId: string;
  currentRunId: string;
  includeIgnored?: boolean;
}): Promise<{
  subject: string;
  html: string;
  text: string;
  stats: AlertEmailStats;
  baselineRunId: string | null;
}> {
  const { userId, siteId, currentRunId, includeIgnored } = params;
  const run = await getScanRunByIdForUser(userId, currentRunId);
  if (!run) throw new Error("scan_run_not_found");
  const site = await getSiteByIdForUser(userId, siteId);
  if (!site) throw new Error("site_not_found");

  const baselineRun = await getBaselineRunForDiff(siteId, currentRunId);
  const counts = await getLinkCountsForRun(currentRunId);
  const totalIssuesCount =
    counts.brokenCount + counts.blockedCount + counts.noResponseCount;

  let newIssuesCount = 0;
  let fixedCount = 0;
  let outstandingIssuesCount = 0;
  let changedCount = 0;
  let issueRows: AlertIssueRow[] = [];

  if (baselineRun) {
    const diff = await getScanDiff(currentRunId, baselineRun.id, {
      issuesOnly: true,
      limit: 10,
      offset: 0,
      changeTypes: ["new_issue"],
      includeIgnored: includeIgnored ?? false,
    });
    newIssuesCount = diff.summary.newIssues;
    fixedCount = diff.summary.fixedIssues;
    outstandingIssuesCount = diff.summary.outstandingIssues;
    changedCount = diff.summary.changed;
    issueRows = diff.items
      .map((item) => ({
        link_url: item.link_url,
        classification: item.current?.classification ?? "unknown",
        status_code: item.current?.status_code ?? null,
        error_message: item.current?.error_message ?? null,
        source_pages: item.current?.source_pages ?? [],
      }))
      .slice(0, 10);
  } else if (totalIssuesCount > 0) {
    newIssuesCount = totalIssuesCount;
    issueRows = await getTopIssuesForRun(userId, currentRunId, 10);
  }

  const stats: AlertEmailStats = {
    newIssuesCount,
    fixedCount,
    outstandingIssuesCount,
    changedCount,
    totalIssuesCount,
  };

  const siteHost = getSiteHost(site.url);
  const finishedAt = run.finished_at ?? new Date();
  const appLink = buildAppLink(siteId, currentRunId);

  const subject = baselineRun
    ? newIssuesCount > 0
      ? `Scanlark: ${newIssuesCount} new issues on ${siteHost}`
      : `Scanlark: No new issues on ${siteHost}`
    : `Scanlark: First scan completed for ${siteHost} (${totalIssuesCount} issues)`;

  const summaryLine = baselineRun
    ? `New issues: ${newIssuesCount} | Fixed: ${fixedCount} | Outstanding: ${outstandingIssuesCount} | Changed: ${changedCount} | Total issues now: ${totalIssuesCount}`
    : `Total issues now: ${totalIssuesCount}`;

  const listTitle = baselineRun ? "New issues" : "Issues found";
  const remainingIssues = Math.max(0, newIssuesCount - issueRows.length);

  const listText =
    issueRows.length > 0
      ? `${listTitle}:\n${issueRows
          .map(formatIssueText)
          .join(
            "\n",
          )}${remainingIssues > 0 ? `\n+${remainingIssues} more…` : ""}`
      : baselineRun
        ? "No new issues found."
        : "No issues found.";

  const listHtml =
    issueRows.length > 0
      ? `<h3>${escapeHtml(listTitle)}</h3><ul>${issueRows
          .map(formatIssueHtml)
          .join("")}</ul>${
          remainingIssues > 0 ? `<p>+${remainingIssues} more…</p>` : ""
        }`
      : `<p>${baselineRun ? "No new issues found." : "No issues found."}</p>`;

  const text = [
    `Scan complete for ${site.url}`,
    `Finished: ${finishedAt.toISOString()}`,
    summaryLine,
    "",
    listText,
    "",
    `View in dashboard: ${appLink}`,
    "You can change alert settings in Scanlark.",
  ].join("\n");

  const html = `
    <p><strong>Scan complete</strong> for ${escapeHtml(site.url)}</p>
    <p>Finished: ${escapeHtml(finishedAt.toISOString())}</p>
    <p>${escapeHtml(summaryLine)}</p>
    ${listHtml}
    <p><a href="${escapeHtml(appLink)}">View in dashboard</a></p>
    <p>You can change alert settings in Scanlark.</p>
  `;

  return { subject, html, text, stats, baselineRunId: baselineRun?.id ?? null };
}

export async function notifyIfNeeded(
  userId: string,
  scanRunId: string,
): Promise<void> {
  const run = await getScanRunByIdForUser(userId, scanRunId);
  if (!run) return;
  if (run.notified_at) return;

  const site = await getSiteByIdForUser(userId, run.site_id);
  if (!site) return;

  const settings = await getSiteNotificationSettingsForUser(
    userId,
    run.site_id,
  );
  if (!settings || !settings.notifyEnabled) return;
  if (settings.notifyOn === "never") return;
  if (!settings.notifyEmail) return;

  const toEmail = settings.notifyEmail;
  const alreadySent = await hasNotificationEvent({
    siteId: run.site_id,
    scanRunId: run.id,
    kind: run.status === "failed" ? "scan_failed" : "scan_completed",
  });
  if (alreadySent) return;

  if (run.status === "failed") {
    const subject = `Scanlark: ${site.url} — scan failed`;
    const html = `
      <p><strong>Scan failed</strong> for ${site.url}</p>
      <p>Started: ${run.started_at.toISOString()}</p>
      <p>Error: ${run.error_message ?? "Unknown error"}</p>
      <p><a href="${APP_URL}">View in dashboard</a></p>
    `;
    await sendEmail({
      to: toEmail,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, "").trim(),
      userId,
      siteId: run.site_id,
      scanRunId: run.id,
      metadata: { status: run.status },
    });
    await recordNotificationEvent({
      siteId: run.site_id,
      scanRunId: run.id,
      kind: "scan_failed",
      toEmail,
      subject,
      payload: { status: run.status, error: run.error_message },
    });
    await markScanRunNotified(run.id);
    return;
  }

  if (run.status !== "completed") return;

  await applyIgnoreRulesForScanRun(run.id);

  const email = await buildScanAlertEmail({
    userId,
    siteId: run.site_id,
    currentRunId: run.id,
  });

  const shouldSend =
    settings.notifyOn === "always" ||
    (settings.notifyOn === "issues_exist" &&
      email.stats.totalIssuesCount > 0) ||
    (settings.notifyOn === "new_issues_only" &&
      (email.baselineRunId === null || email.stats.newIssuesCount > 0)) ||
    (settings.notifyOn === "issues" &&
      (email.baselineRunId === null || email.stats.newIssuesCount > 0));

  if (!shouldSend) return;

  await sendEmail({
    to: toEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    userId,
    siteId: run.site_id,
    scanRunId: run.id,
    metadata: {
      stats: email.stats,
      baselineRunId: email.baselineRunId,
    },
  });
  await recordNotificationEvent({
    siteId: run.site_id,
    scanRunId: run.id,
    kind: "scan_completed",
    toEmail,
    subject: email.subject,
    payload: {
      stats: email.stats,
      baselineRunId: email.baselineRunId,
    },
  });
  await markScanRunNotified(run.id);
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
    const html = `
      <p>This is a test alert for ${escapeHtml(site.url)}.</p>
      <p>No scans have completed yet, so there is no data to compare.</p>
      <p><a href="${escapeHtml(APP_URL)}">Open dashboard</a></p>
    `;
    const text = `This is a test alert for ${site.url}.\nNo scans have completed yet, so there is no data to compare.\nOpen dashboard: ${APP_URL}`;
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

  const email = await buildScanAlertEmail({
    userId,
    siteId,
    currentRunId: latestRun.id,
  });
  await sendEmail({
    to: toEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    userId,
    siteId,
    scanRunId: latestRun.id,
    metadata: { test: true, stats: email.stats },
  });
  await recordNotificationEvent({
    siteId,
    scanRunId: latestRun.id,
    kind: "test",
    toEmail,
    subject: email.subject,
    payload: { test: true, stats: email.stats },
  });
}
