CREATE TABLE IF NOT EXISTS report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS report_shares_site_id_idx
  ON report_shares(site_id);

CREATE INDEX IF NOT EXISTS report_shares_created_by_user_id_idx
  ON report_shares(created_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS report_shares_active_scan_run_idx
  ON report_shares(scan_run_id)
  WHERE enabled = true;
