CREATE TABLE IF NOT EXISTS site_uptime_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  check_url text NOT NULL,
  interval_minutes integer NOT NULL DEFAULT 5,
  failure_threshold integer NOT NULL DEFAULT 3,
  next_check_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_uptime_settings_site_unique UNIQUE (site_id),
  CONSTRAINT site_uptime_settings_interval_check
    CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
  CONSTRAINT site_uptime_settings_failure_threshold_check
    CHECK (failure_threshold >= 1 AND failure_threshold <= 10),
  CONSTRAINT site_uptime_settings_check_url_check
    CHECK (check_url ~* '^https?://')
);

CREATE INDEX IF NOT EXISTS site_uptime_settings_due_idx
  ON site_uptime_settings(next_check_at)
  WHERE enabled = true;

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

CREATE INDEX IF NOT EXISTS uptime_checks_settings_checked_idx
  ON uptime_checks(settings_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS uptime_checks_site_checked_idx
  ON uptime_checks(site_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS uptime_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL REFERENCES site_uptime_settings(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
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
    CHECK (status IN ('open', 'resolved'))
);

CREATE INDEX IF NOT EXISTS uptime_incidents_settings_status_idx
  ON uptime_incidents(settings_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS uptime_incidents_site_status_idx
  ON uptime_incidents(site_id, status, started_at DESC);
