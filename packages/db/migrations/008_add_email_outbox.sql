CREATE TABLE IF NOT EXISTS email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  site_id uuid,
  scan_run_id uuid,
  to_email text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  text_body text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_outbox_user_idx ON email_outbox(user_id);
CREATE INDEX IF NOT EXISTS email_outbox_site_idx ON email_outbox(site_id);
CREATE INDEX IF NOT EXISTS email_outbox_created_idx ON email_outbox(created_at DESC);
