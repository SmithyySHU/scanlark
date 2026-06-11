CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_enabled boolean NOT NULL DEFAULT true,
  scan_completed_enabled boolean NOT NULL DEFAULT true,
  scan_failed_enabled boolean NOT NULL DEFAULT true,
  high_priority_issues_enabled boolean NOT NULL DEFAULT true,
  uptime_down_enabled boolean NOT NULL DEFAULT true,
  uptime_recovered_enabled boolean NOT NULL DEFAULT true,
  system_notices_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
