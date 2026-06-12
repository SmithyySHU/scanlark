import nodemailer from "nodemailer";
import {
  enqueueEmailOutbox,
  markEmailOutboxFailed,
  markEmailOutboxRecorded,
  markEmailOutboxSent,
} from "@scanlark/db";

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

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === "true";
const EMAIL_FROM = process.env.EMAIL_FROM || "Scanlark <alerts@scanlark.local>";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";

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
  let outboxEntryId: string | null = null;
  try {
    const entry = await enqueueEmailOutbox({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      userId: payload.userId ?? null,
      siteId: payload.siteId ?? null,
      scanRunId: payload.scanRunId ?? null,
      metadata: payload.metadata ?? null,
    });
    outboxEntryId = entry.id;
  } catch (err: unknown) {
    console.error("Failed to write email outbox entry", err);
  }

  if (!EMAIL_ENABLED) {
    if (outboxEntryId) {
      await markEmailOutboxRecorded(outboxEntryId);
    }
    console.log(
      `[email] disabled; would send to=${payload.to} subject="${payload.subject}"`,
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
    if (outboxEntryId) {
      await markEmailOutboxSent(outboxEntryId);
    }
  } catch (err: unknown) {
    if (outboxEntryId) {
      const message =
        err instanceof Error && err.message ? err.message : "email_send_failed";
      await markEmailOutboxFailed(outboxEntryId, message);
    }
    throw err;
  }
}
