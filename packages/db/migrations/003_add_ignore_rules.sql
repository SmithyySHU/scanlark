CREATE TABLE IF NOT EXISTS ignore_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  pattern text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ignore_rules_type_check
    CHECK (rule_type IN ('contains', 'regex', 'exact', 'status_code', 'classification', 'domain', 'path_prefix'))
);

CREATE INDEX IF NOT EXISTS ignore_rules_site_idx ON ignore_rules(site_id);
CREATE INDEX IF NOT EXISTS ignore_rules_enabled_idx ON ignore_rules(is_enabled);

CREATE TABLE IF NOT EXISTS scan_ignored_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  link_url text NOT NULL,
  rule_id uuid REFERENCES ignore_rules(id) ON DELETE SET NULL,
  status_code int,
  error_message text,
  occurrence_count int NOT NULL DEFAULT 1,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_ignored_links_run_url_unique
  ON scan_ignored_links(scan_run_id, link_url);
CREATE INDEX IF NOT EXISTS scan_ignored_links_run_idx
  ON scan_ignored_links(scan_run_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS scan_ignored_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_ignored_link_id uuid NOT NULL REFERENCES scan_ignored_links(id) ON DELETE CASCADE,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  link_url text NOT NULL,
  source_page text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_ignored_occurrences_link_idx
  ON scan_ignored_occurrences(scan_ignored_link_id, created_at DESC);
