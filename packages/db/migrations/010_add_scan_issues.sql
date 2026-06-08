CREATE TABLE IF NOT EXISTS scan_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  issue_type text NOT NULL,
  affected_url text NOT NULL,
  source_url text,
  title text NOT NULL,
  description text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT scan_issues_category_check
    CHECK (category IN (
      'link_integrity',
      'seo_basic',
      'ssl_https',
      'security_header',
      'sitemap',
      'robots',
      'performance_basic'
    )),
  CONSTRAINT scan_issues_severity_check
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT scan_issues_status_check
    CHECK (status IN ('open', 'resolved'))
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_issues_run_issue_unique
  ON scan_issues(scan_run_id, issue_type, affected_url, COALESCE(source_url, ''));
CREATE INDEX IF NOT EXISTS scan_issues_run_severity_idx
  ON scan_issues(scan_run_id, severity);
CREATE INDEX IF NOT EXISTS scan_issues_run_category_idx
  ON scan_issues(scan_run_id, category);
CREATE INDEX IF NOT EXISTS scan_issues_site_status_idx
  ON scan_issues(site_id, status);
