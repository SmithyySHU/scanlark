ALTER TABLE scan_issues
  ADD COLUMN IF NOT EXISTS change_status text;

ALTER TABLE scan_issues
  DROP CONSTRAINT IF EXISTS scan_issues_change_status_check;

ALTER TABLE scan_issues
  ADD CONSTRAINT scan_issues_change_status_check
  CHECK (change_status IS NULL OR change_status IN ('new', 'existing'));

CREATE TABLE IF NOT EXISTS site_issue_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  issue_fingerprint text NOT NULL,
  category text NOT NULL,
  issue_type text NOT NULL,
  affected_url text NOT NULL,
  latest_source_url text,
  latest_title text NOT NULL,
  latest_description text NOT NULL,
  latest_severity text NOT NULL,
  latest_evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_status text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  resolved_at timestamptz,
  resolved_scan_run_id uuid REFERENCES scan_runs(id) ON DELETE SET NULL
);

ALTER TABLE site_issue_states
  DROP CONSTRAINT IF EXISTS site_issue_states_category_check;

ALTER TABLE site_issue_states
  ADD CONSTRAINT site_issue_states_category_check
  CHECK (category IN (
    'link_integrity',
    'seo_basic',
    'ssl_https',
    'security_header',
    'sitemap',
    'robots',
    'performance_basic'
  ));

ALTER TABLE site_issue_states
  DROP CONSTRAINT IF EXISTS site_issue_states_latest_severity_check;

ALTER TABLE site_issue_states
  ADD CONSTRAINT site_issue_states_latest_severity_check
  CHECK (latest_severity IN ('critical', 'high', 'medium', 'low', 'info'));

ALTER TABLE site_issue_states
  DROP CONSTRAINT IF EXISTS site_issue_states_state_status_check;

ALTER TABLE site_issue_states
  ADD CONSTRAINT site_issue_states_state_status_check
  CHECK (state_status IN ('open', 'resolved'));

CREATE UNIQUE INDEX IF NOT EXISTS site_issue_states_site_fingerprint_uidx
  ON site_issue_states(site_id, issue_fingerprint);

CREATE INDEX IF NOT EXISTS site_issue_states_site_status_idx
  ON site_issue_states(site_id, state_status);

CREATE INDEX IF NOT EXISTS site_issue_states_last_seen_scan_run_idx
  ON site_issue_states(last_seen_scan_run_id);

CREATE INDEX IF NOT EXISTS site_issue_states_resolved_scan_run_idx
  ON site_issue_states(resolved_scan_run_id);
