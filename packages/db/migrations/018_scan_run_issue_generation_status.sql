ALTER TABLE scan_runs
  ADD COLUMN IF NOT EXISTS issue_generation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS issue_generation_error text;

ALTER TABLE scan_runs
  DROP CONSTRAINT IF EXISTS scan_runs_issue_generation_status_check;

ALTER TABLE scan_runs
  ADD CONSTRAINT scan_runs_issue_generation_status_check
  CHECK (issue_generation_status IN ('pending', 'completed', 'failed'));

UPDATE scan_runs sr
SET issue_generation_status = CASE
      WHEN sr.status IN ('queued', 'in_progress') THEN 'pending'
      WHEN EXISTS (
        SELECT 1
        FROM scan_issues si
        WHERE si.scan_run_id = sr.id
      ) THEN 'completed'
      WHEN sr.status = 'completed' THEN 'pending'
      ELSE 'pending'
    END,
    issue_generation_error = NULL
WHERE sr.issue_generation_status IS DISTINCT FROM CASE
      WHEN sr.status IN ('queued', 'in_progress') THEN 'pending'
      WHEN EXISTS (
        SELECT 1
        FROM scan_issues si
        WHERE si.scan_run_id = sr.id
      ) THEN 'completed'
      WHEN sr.status = 'completed' THEN 'pending'
      ELSE 'pending'
    END
   OR sr.issue_generation_error IS NOT NULL;
