ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS is_sample_site boolean NOT NULL DEFAULT false;

UPDATE sites
SET is_sample_site = true,
    verification_status = 'sample_site',
    schedule_enabled = false,
    next_scheduled_at = NULL,
    notify_enabled = false,
    summary_enabled = false
WHERE verification_status = 'sample_site'
  OR (
    url IN ('https://example.com', 'https://example.com/')
    AND (
      site_display_name = 'Sample site'
      OR report_display_name = 'Sample site'
    )
  );

UPDATE site_uptime_settings us
SET enabled = false,
    next_check_at = NULL,
    updated_at = NOW()
FROM sites s
WHERE s.id = us.site_id
  AND s.is_sample_site = true;

UPDATE scan_jobs j
SET status = 'cancelled',
    locked_at = NULL,
    lock_expires_at = NULL,
    last_error = CASE
      WHEN j.last_error IS NULL THEN 'sample_site_job_cancelled_by_migration'
      ELSE j.last_error || E'\nsample_site_job_cancelled_by_migration'
    END,
    updated_at = NOW()
FROM sites s
WHERE s.id = j.site_id
  AND s.is_sample_site = true
  AND j.status = 'queued';

CREATE INDEX IF NOT EXISTS sites_is_sample_site_idx
  ON sites(is_sample_site);
