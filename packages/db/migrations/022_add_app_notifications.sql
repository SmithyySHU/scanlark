CREATE TABLE IF NOT EXISTS app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  scan_run_id uuid REFERENCES scan_runs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  severity text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_notifications_kind_check
    CHECK (kind IN (
      'scan_completed',
      'scan_failed',
      'high_priority_issues',
      'uptime_down',
      'uptime_recovered'
    )),
  CONSTRAINT app_notifications_severity_check
    CHECK (severity IN ('info', 'success', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS app_notifications_user_created_idx
  ON app_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS app_notifications_user_unread_idx
  ON app_notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS app_notifications_site_idx
  ON app_notifications(site_id);

CREATE INDEX IF NOT EXISTS app_notifications_scan_run_idx
  ON app_notifications(scan_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_scan_run_kind_unique
  ON app_notifications(scan_run_id, kind)
  WHERE scan_run_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_unread_uptime_down_unique
  ON app_notifications(site_id, kind)
  WHERE site_id IS NOT NULL
    AND kind = 'uptime_down'
    AND read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_site_kind_action_unique
  ON app_notifications(site_id, kind, action_url)
  WHERE scan_run_id IS NULL
    AND site_id IS NOT NULL
    AND action_url IS NOT NULL;
