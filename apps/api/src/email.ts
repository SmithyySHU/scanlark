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
    console.error("Failed to write email outbox entry", err);
  }

  if (!EMAIL_ENABLED) {
    console.log(
      `[email] disabled; would send to=${payload.to} subject="${payload.subject}"`,
    );
    return;
  }

  const transport = getTransport();
  if (!transport) return;

  await transport.sendMail({
    from: EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}
