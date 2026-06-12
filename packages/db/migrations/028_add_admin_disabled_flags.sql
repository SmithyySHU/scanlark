-- Required by auth disabled-account checks and future admin disable/enable actions.
-- Safe to run after 027_admin_console_mvp.sql because every operation is idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS users_disabled_at_idx
  ON users(disabled_at);

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS sites_disabled_at_idx
  ON sites(disabled_at);
