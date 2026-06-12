CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  admin_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON admin_audit_log(target_type, target_id, created_at DESC);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS users_disabled_at_idx
  ON users(disabled_at);

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS sites_disabled_at_idx
  ON sites(disabled_at);

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS failed_at timestamptz;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS suppressed_at timestamptz;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE email_outbox
SET status = 'recorded'
WHERE status IS NULL;

UPDATE email_outbox
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE email_outbox
  ALTER COLUMN status SET DEFAULT 'recorded';

ALTER TABLE email_outbox
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE email_outbox
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE email_outbox
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_status_check;

ALTER TABLE email_outbox
  ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'recorded', 'suppressed'));

CREATE INDEX IF NOT EXISTS email_outbox_status_created_idx
  ON email_outbox(status, created_at DESC);

CREATE INDEX IF NOT EXISTS email_outbox_failed_created_idx
  ON email_outbox(created_at DESC)
  WHERE status = 'failed';
