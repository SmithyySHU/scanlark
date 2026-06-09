import nodemailer from "nodemailer";
import { enqueueEmailOutbox } from "@scanlark/db";
import { apiRuntimeConfig } from "./runtimeConfig";

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId?: string | null;
  siteId?: string | null;
  scanRunId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const EMAIL_ENABLED = apiRuntimeConfig.email.enabled;
const EMAIL_FROM = apiRuntimeConfig.email.from;
const SMTP_HOST = apiRuntimeConfig.email.smtpHost;
const SMTP_PORT = apiRuntimeConfig.email.smtpPort;
const SMTP_USER = apiRuntimeConfig.email.smtpUser;
const SMTP_PASS = apiRuntimeConfig.email.smtpPass;

function buildEmailLogContext(payload: EmailPayload) {
  return {
    toDomain: payload.to.includes("@") ? payload.to.split("@")[1] : "invalid",
    subject: payload.subject,
    siteId: payload.siteId ?? null,
    scanRunId: payload.scanRunId ?? null,
    notificationKind:
      typeof payload.metadata?.kind === "string" ? payload.metadata.kind : null,
    incidentId:
      typeof payload.metadata?.incidentId === "string"
        ? payload.metadata.incidentId
        : null,
  };
}

function getLogError(error: unknown) {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  const text = String(error ?? "");
  return text || "unknown_error";
}

function getTransport() {
  if (!EMAIL_ENABLED) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const context = buildEmailLogContext(payload);
  try {
    await enqueueEmailOutbox({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      userId: payload.userId ?? null,
      siteId: payload.siteId ?? null,
      scanRunId: payload.scanRunId ?? null,
      metadata: payload.metadata ?? null,
    });
  } catch (err: unknown) {
    console.error("Failed to write email outbox entry", {
      ...context,
      error: getLogError(err),
    });
  }

  if (!EMAIL_ENABLED) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        service: "scanlark-api",
        event: "email.smtp.disabled",
        message: "SMTP sending disabled; email recorded in outbox only",
        ...context,
      }),
    );
    return;
  }

  const transport = getTransport();
  if (!transport) return;

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
  } catch (err: unknown) {
    console.error("SMTP send failed", {
      ...context,
      error: getLogError(err),
    });
    throw err;
  }
}
