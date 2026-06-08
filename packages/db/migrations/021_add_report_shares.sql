CREATE TABLE IF NOT EXISTS report_shares (
  id uuid PRIMARY KEY,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  CONSTRAINT report_shares_view_count_check CHECK (view_count >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS report_shares_active_run_unique
  ON report_shares(scan_run_id)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS report_shares_site_created_at_idx
  ON report_shares(site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS report_shares_scan_run_created_at_idx
  ON report_shares(scan_run_id, created_at DESC);
