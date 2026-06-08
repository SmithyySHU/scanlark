CREATE TABLE IF NOT EXISTS scan_page_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  title text,
  meta_description text,
  h1_count int NOT NULL DEFAULT 0,
  robots_meta text,
  robots_noindex boolean NOT NULL DEFAULT false,
  canonical_count int NOT NULL DEFAULT 0,
  canonical_href text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_page_checks_run_page_unique
  ON scan_page_checks(scan_run_id, page_url);
CREATE INDEX IF NOT EXISTS scan_page_checks_run_idx
  ON scan_page_checks(scan_run_id);
