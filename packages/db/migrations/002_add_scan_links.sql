CREATE TABLE IF NOT EXISTS scan_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  link_url text NOT NULL,
  classification text NOT NULL,
  status_code int,
  error_message text,
  ignored boolean NOT NULL DEFAULT false,
  ignored_by_rule_id uuid,
  ignored_at timestamptz,
  ignore_reason text,
  ignored_source text NOT NULL DEFAULT 'none',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrence_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_links_classification_check
    CHECK (classification IN ('ok', 'broken', 'blocked', 'no_response')),
  CONSTRAINT scan_links_ignored_source_check
    CHECK (ignored_source IN ('none', 'manual', 'rule'))
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_links_run_url_unique
  ON scan_links(scan_run_id, link_url);
CREATE INDEX IF NOT EXISTS scan_links_run_id_idx ON scan_links(scan_run_id);
CREATE INDEX IF NOT EXISTS scan_links_classification_idx ON scan_links(classification);

CREATE TABLE IF NOT EXISTS scan_link_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_link_id uuid NOT NULL REFERENCES scan_links(id) ON DELETE CASCADE,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  link_url text NOT NULL,
  source_page text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scan_link_occurrences_link_idx
  ON scan_link_occurrences(scan_link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_link_occurrences_run_idx
  ON scan_link_occurrences(scan_run_id, created_at DESC);

CREATE TABLE IF NOT EXISTS scan_ignore_apply_state (
  scan_run_id uuid PRIMARY KEY REFERENCES scan_runs(id) ON DELETE CASCADE,
  last_applied_at timestamptz NOT NULL DEFAULT now(),
  rules_hash text NOT NULL
);
