ALTER TABLE scan_runs
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'manual';

ALTER TABLE scan_runs
  DROP CONSTRAINT IF EXISTS scan_runs_trigger_type_check;

ALTER TABLE scan_runs
  ADD CONSTRAINT scan_runs_trigger_type_check
  CHECK (trigger_type IN ('manual', 'scheduled'));

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS summary_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_notify_on_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_notify_on_check
  CHECK (notify_on IN (
    'issues',
    'issues_exist',
    'new_issues_only',
    'always',
    'never'
  ));

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_kind_check;

UPDATE notification_events
SET kind = 'high_priority_issues_found'
WHERE kind = 'scan_completed';

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_kind_check
  CHECK (kind IN (
    'scan_failed',
    'high_priority_issues_found',
    'weekly_scan_summary',
    'test'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS notification_events_run_kind_unique
  ON notification_events(scan_run_id, kind)
  WHERE scan_run_id IS NOT NULL;
