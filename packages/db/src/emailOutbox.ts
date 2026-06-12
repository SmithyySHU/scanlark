import { ensureConnected } from "./client";

export type EmailOutboxEntry = {
  id: string;
  user_id: string | null;
  site_id: string | null;
  scan_run_id: string | null;
  to_email: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  metadata: Record<string, unknown> | null;
  status: "queued" | "sent" | "failed" | "recorded" | "suppressed";
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
  failed_at: Date | null;
  suppressed_at: Date | null;
  last_error: string | null;
};

export async function enqueueEmailOutbox(input: {
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  userId?: string | null;
  siteId?: string | null;
  scanRunId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<EmailOutboxEntry> {
  const client = await ensureConnected();
  const res = await client.query<EmailOutboxEntry>(
    `
      INSERT INTO email_outbox (
        user_id,
        site_id,
        scan_run_id,
        to_email,
        subject,
        html_body,
        text_body,
        metadata,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')
      RETURNING *
    `,
    [
      input.userId ?? null,
      input.siteId ?? null,
      input.scanRunId ?? null,
      input.to,
      input.subject,
      input.html,
      input.text ?? null,
      input.metadata ?? null,
    ],
  );
  return res.rows[0];
}

export async function markEmailOutboxSent(
  entryId: string,
): Promise<EmailOutboxEntry | null> {
  const client = await ensureConnected();
  const res = await client.query<EmailOutboxEntry>(
    `
      UPDATE email_outbox
      SET status = 'sent',
          sent_at = NOW(),
          failed_at = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [entryId],
  );
  return res.rows[0] ?? null;
}

export async function markEmailOutboxFailed(
  entryId: string,
  error: string,
): Promise<EmailOutboxEntry | null> {
  const client = await ensureConnected();
  const res = await client.query<EmailOutboxEntry>(
    `
      UPDATE email_outbox
      SET status = 'failed',
          failed_at = NOW(),
          last_error = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [entryId, error.slice(0, 1000)],
  );
  return res.rows[0] ?? null;
}

export async function markEmailOutboxRecorded(
  entryId: string,
): Promise<EmailOutboxEntry | null> {
  const client = await ensureConnected();
  const res = await client.query<EmailOutboxEntry>(
    `
      UPDATE email_outbox
      SET status = 'recorded',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [entryId],
  );
  return res.rows[0] ?? null;
}
