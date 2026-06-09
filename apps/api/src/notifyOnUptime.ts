import {
  getSiteNotificationSettingsForUser,
  getUptimeIncidentById,
  tryRecordNotificationEvent,
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

function buildSiteLink(siteId: string) {
  const base = APP_URL.replace(/\/+$/, "");
  return `${base}/?siteId=${encodeURIComponent(siteId)}`;
}

function formatStatusCode(statusCode: number | null) {
  return statusCode == null ? "No HTTP status" : `HTTP ${statusCode}`;
}

function buildUptimeEmail(params: {
  kind: "uptime_down" | "uptime_recovered";
  siteUrl: string;
  siteId: string;
  checkUrl: string;
  checkedAt: Date;
  statusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
}) {
  const siteHost = getSiteHost(params.siteUrl);
  const dashboardLink = buildSiteLink(params.siteId);
  if (params.kind === "uptime_down") {
    const subject = `Scanlark: homepage appears down for ${siteHost}`;
    const text = [
      `The homepage for ${params.siteUrl} appears unavailable after repeated checks.`,
      `Checked URL: ${params.checkUrl}`,
      `Checked at: ${params.checkedAt.toISOString()}`,
      `Latest result: ${formatStatusCode(params.statusCode)}`,
      `Last error: ${params.errorMessage ?? "No additional error detail"}`,
      "",
      `Open dashboard: ${dashboardLink}`,
    ].join("\n");
    const html = `
      <p>The homepage for ${escapeHtml(
        params.siteUrl,
      )} appears unavailable after repeated checks.</p>
      <p>Checked URL: <code>${escapeHtml(params.checkUrl)}</code></p>
      <p>Checked at: ${escapeHtml(params.checkedAt.toISOString())}</p>
      <p>Latest result: ${escapeHtml(formatStatusCode(params.statusCode))}</p>
      <p>Last error: ${escapeHtml(
        params.errorMessage ?? "No additional error detail",
      )}</p>
      <p><a href="${escapeHtml(dashboardLink)}">Open dashboard</a></p>
    `;
    return { subject, text, html };
  }

  const subject = `Scanlark: homepage reachable again for ${siteHost}`;
  const text = [
    `The homepage for ${params.siteUrl} is reachable again.`,
    `Checked URL: ${params.checkUrl}`,
    `Checked at: ${params.checkedAt.toISOString()}`,
    `Latest result: ${formatStatusCode(params.statusCode)}`,
    `Response time: ${
      params.responseTimeMs == null
        ? "Not recorded"
        : `${params.responseTimeMs} ms`
    }`,
    "",
    `Open dashboard: ${dashboardLink}`,
  ].join("\n");
  const html = `
    <p>The homepage for ${escapeHtml(params.siteUrl)} is reachable again.</p>
    <p>Checked URL: <code>${escapeHtml(params.checkUrl)}</code></p>
    <p>Checked at: ${escapeHtml(params.checkedAt.toISOString())}</p>
    <p>Latest result: ${escapeHtml(formatStatusCode(params.statusCode))}</p>
    <p>Response time: ${escapeHtml(
      params.responseTimeMs == null
        ? "Not recorded"
        : `${params.responseTimeMs} ms`,
    )}</p>
    <p><a href="${escapeHtml(dashboardLink)}">Open dashboard</a></p>
  `;
  return { subject, text, html };
}

export async function sendUptimeNotification(
  incidentId: string,
  kind: Extract<NotificationEventKind, "uptime_down" | "uptime_recovered">,
): Promise<boolean> {
  const context = await getUptimeIncidentById(incidentId);
  if (!context) return false;

  const settings = await getSiteNotificationSettingsForUser(
    context.settings.user_id,
    context.settings.site_id,
  );
  if (
    !settings?.notifyEnabled ||
    !settings.notifyEmail ||
    settings.notifyOn === "never"
  ) {
    return false;
  }

  const transitionAt =
    kind === "uptime_down"
      ? context.incident.notification_sent_at
      : context.incident.recovery_notification_sent_at;
  if (!transitionAt) return false;

  const email = buildUptimeEmail({
    kind,
    siteUrl: context.site_url,
    siteId: context.settings.site_id,
    checkUrl: context.settings.check_url,
    checkedAt: transitionAt,
    statusCode: context.incident.last_status_code,
    responseTimeMs: context.incident.last_response_time_ms,
    errorMessage: context.incident.last_error,
  });

  const reserved = await tryRecordNotificationEvent({
    siteId: context.settings.site_id,
    scanRunId: null,
    kind,
    toEmail: settings.notifyEmail,
    subject: email.subject,
    payload: {
      incident_id: context.incident.id,
      settings_id: context.settings.id,
      check_url: context.settings.check_url,
      status: context.incident.status,
      status_code: context.incident.last_status_code,
      last_error: context.incident.last_error,
    },
  });
  if (!reserved) return false;

  await sendEmail({
    to: settings.notifyEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
    userId: context.settings.user_id,
    siteId: context.settings.site_id,
    scanRunId: null,
    metadata: {
      kind,
      incidentId: context.incident.id,
      transitionAt: transitionAt.toISOString(),
    },
  });
  return true;
}
