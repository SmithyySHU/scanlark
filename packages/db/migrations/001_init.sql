CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  schedule_enabled boolean NOT NULL DEFAULT false,
  schedule_frequency text NOT NULL DEFAULT 'weekly',
  schedule_time_utc text NOT NULL DEFAULT '02:00',
  schedule_day_of_week int NOT NULL DEFAULT 1,
  next_scheduled_at timestamptz,
  last_scheduled_at timestamptz,
  notify_enabled boolean NOT NULL DEFAULT false,
  notify_email text,
  notify_on text NOT NULL DEFAULT 'issues',
  notify_include_csv boolean NOT NULL DEFAULT false,
  notify_only_on_change boolean NOT NULL DEFAULT false,
  notify_include_blocked boolean NOT NULL DEFAULT true,
  notify_include_broken boolean NOT NULL DEFAULT true,
  last_notified_scan_run_id uuid,
  CONSTRAINT sites_schedule_frequency_check
    CHECK (schedule_frequency IN ('daily', 'weekly')),
  CONSTRAINT sites_notify_on_check
    CHECK (notify_on IN ('issues', 'issues_exist', 'new_issues_only', 'always', 'never'))
);

CREATE INDEX IF NOT EXISTS sites_created_at_idx ON sites(created_at DESC);

CREATE TABLE IF NOT EXISTS scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  notified_at timestamptz,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  start_url text NOT NULL,
  total_links int NOT NULL DEFAULT 0,
  checked_links int NOT NULL DEFAULT 0,
  broken_links int NOT NULL DEFAULT 0,
  CONSTRAINT scan_runs_status_check
    CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS scan_runs_site_id_idx ON scan_runs(site_id);
CREATE INDEX IF NOT EXISTS scan_runs_started_at_idx ON scan_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS scan_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
  source_page text NOT NULL,
  link_url text NOT NULL,
  status_code int,
  classification text NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_results_classification_check
    CHECK (classification IN ('ok', 'broken', 'blocked', 'no_response'))
);

CREATE INDEX IF NOT EXISTS scan_results_run_id_idx ON scan_results(scan_run_id);
CREATE INDEX IF NOT EXISTS scan_results_classification_idx ON scan_results(classification);

CREATE TABLE IF NOT EXISTS scan_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_run_id uuid,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scan_jobs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS scan_jobs_status_idx ON scan_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS scan_jobs_site_idx ON scan_jobs(site_id);

CREATE TABLE IF NOT EXISTS notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  scan_run_id uuid REFERENCES scan_runs(id) ON DELETE SET NULL,
  kind text NOT NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_events_kind_check
    CHECK (kind IN ('scan_completed', 'scan_failed', 'test'))
);

CREATE INDEX IF NOT EXISTS notification_events_site_idx ON notification_events(site_id);
CREATE INDEX IF NOT EXISTS notification_events_kind_idx ON notification_events(kind);
