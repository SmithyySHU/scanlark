CREATE TABLE IF NOT EXISTS scan_site_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  target_url text NOT NULL,
  status_code int,
  ok boolean NOT NULL DEFAULT false,
  error_message text,
  content_type text,
  content_size_bytes int,
  facts_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_site_checks_check_type_check
    CHECK (check_type IN ('robots_txt', 'sitemap_xml', 'sitemap_index_xml'))
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_site_checks_run_type_target_unique
  ON scan_site_checks(scan_run_id, check_type, target_url);
CREATE INDEX IF NOT EXISTS scan_site_checks_run_idx
  ON scan_site_checks(scan_run_id);
