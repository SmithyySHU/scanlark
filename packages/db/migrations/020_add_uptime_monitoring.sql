CREATE TABLE IF NOT EXISTS site_uptime_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  check_url text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 5,
  failure_threshold integer NOT NULL DEFAULT 3,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_uptime_settings_interval_check
    CHECK (interval_minutes > 0),
  CONSTRAINT site_uptime_settings_failure_threshold_check
    CHECK (failure_threshold >= 1)
);

CREATE INDEX IF NOT EXISTS site_uptime_settings_enabled_next_check_idx
  ON site_uptime_settings(enabled, next_check_at);

CREATE TABLE IF NOT EXISTS uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL REFERENCES site_uptime_settings(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  checked_url text NOT NULL,
  status text NOT NULL,
  status_code integer,
  response_time_ms integer,
  redirect_count integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uptime_checks_status_check
    CHECK (status IN ('up', 'degraded', 'down'))
);

CREATE INDEX IF NOT EXISTS uptime_checks_settings_checked_at_idx
  ON uptime_checks(settings_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS uptime_checks_site_checked_at_idx
  ON uptime_checks(site_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS uptime_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL REFERENCES site_uptime_settings(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  resolved_at timestamptz,
  status text NOT NULL DEFAULT 'open',
  failure_count integer NOT NULL DEFAULT 1,
  first_error text,
  last_error text,
  last_status_code integer,
  last_response_time_ms integer,
  last_checked_at timestamptz,
  notification_sent_at timestamptz,
  recovery_notification_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uptime_incidents_status_check
    CHECK (status IN ('open', 'resolved')),
  CONSTRAINT uptime_incidents_failure_count_check
    CHECK (failure_count >= 1)
);

CREATE INDEX IF NOT EXISTS uptime_incidents_settings_status_idx
  ON uptime_incidents(settings_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS uptime_incidents_site_started_at_idx
  ON uptime_incidents(site_id, started_at DESC);

INSERT INTO site_uptime_settings (site_id, check_url, next_check_at)
SELECT
  s.id,
  regexp_replace(s.url, '^(https?://[^/?#]+).*$','\1/'),
  NULL
FROM sites s
ON CONFLICT (site_id) DO NOTHING;

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_kind_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_kind_check
  CHECK (
    kind IN (
      'scan_completed',
      'scan_failed',
      'high_priority_issues_found',
      'weekly_scan_summary',
      'test',
      'uptime_down',
      'uptime_recovered'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_uptime_incident_kind_unique
  ON notification_events (
    site_id,
    kind,
    ((payload_json->>'incident_id'))
  )
  WHERE kind IN ('uptime_down', 'uptime_recovered');
