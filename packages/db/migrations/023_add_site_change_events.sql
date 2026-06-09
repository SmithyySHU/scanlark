CREATE TABLE IF NOT EXISTS site_change_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  baseline_scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  category text NOT NULL,
  change_type text NOT NULL,
  importance text NOT NULL,
  subject_key text NOT NULL,
  subject_url text,
  previous_value_json jsonb,
  current_value_json jsonb,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_change_events_category_check CHECK (
    category IN (
      'page_metadata',
      'page_inventory',
      'robots',
      'sitemap',
      'ssl_https',
      'security_headers',
      'performance_basic'
    )
  ),
  CONSTRAINT site_change_events_importance_check CHECK (
    importance IN ('high', 'medium', 'low', 'info')
  ),
  CONSTRAINT site_change_events_unique_event UNIQUE (
    scan_run_id,
    category,
    change_type,
    subject_key
  )
);

CREATE INDEX IF NOT EXISTS site_change_events_scan_run_idx
  ON site_change_events(scan_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS site_change_events_site_idx
  ON site_change_events(site_id, created_at DESC);
