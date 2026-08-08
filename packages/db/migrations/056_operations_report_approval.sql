BEGIN;

ALTER TABLE operations_reports
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS approved_content_revision integer;

ALTER TABLE operations_reports
  ADD CONSTRAINT operations_reports_approval_snapshot_check
  CHECK (
    (approved_at IS NULL AND approved_by_user_id IS NULL AND approved_content_revision IS NULL)
    OR (
      approved_at IS NOT NULL
      AND approved_by_user_id IS NOT NULL
      AND approved_content_revision IS NOT NULL
      AND approved_content_revision >= 1
    )
  );

COMMIT;
