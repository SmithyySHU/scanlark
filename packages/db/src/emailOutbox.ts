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
  created_at: Date;
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
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
