ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_schedule_frequency_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_schedule_frequency_check
  CHECK (schedule_frequency IN ('manual', 'daily', 'weekly', 'monthly'));

ALTER TABLE sites
  ALTER COLUMN schedule_frequency SET DEFAULT 'manual';

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS schedule_day_of_month int;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_schedule_day_of_month_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_schedule_day_of_month_check
  CHECK (
    schedule_day_of_month IS NULL
    OR (schedule_day_of_month >= 1 AND schedule_day_of_month <= 31)
  );

WITH ranked_active_jobs AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY site_id
      ORDER BY
        CASE WHEN status = 'running' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM scan_jobs
  WHERE status IN ('queued', 'running')
)
UPDATE scan_jobs j
SET status = 'cancelled',
    locked_at = NULL,
    lock_expires_at = NULL,
    last_error = CASE
      WHEN j.last_error IS NULL THEN 'duplicate_active_job_cancelled_by_migration'
      ELSE j.last_error || E'\nduplicate_active_job_cancelled_by_migration'
    END,
    updated_at = NOW()
FROM ranked_active_jobs ranked
WHERE j.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS scan_jobs_active_site_unique_idx
  ON scan_jobs(site_id)
  WHERE status IN ('queued', 'running');
