BEGIN;

ALTER TABLE operations_reports
  ADD COLUMN IF NOT EXISTS content_revision integer NOT NULL DEFAULT 1;

ALTER TABLE operations_quotes
  ADD COLUMN IF NOT EXISTS content_revision integer NOT NULL DEFAULT 1;

ALTER TABLE operations_communications
  ADD COLUMN IF NOT EXISTS content_revision integer NOT NULL DEFAULT 1;

ALTER TABLE operations_reports
  DROP CONSTRAINT IF EXISTS operations_reports_content_revision_check,
  ADD CONSTRAINT operations_reports_content_revision_check
    CHECK (content_revision >= 1);

ALTER TABLE operations_quotes
  DROP CONSTRAINT IF EXISTS operations_quotes_content_revision_check,
  ADD CONSTRAINT operations_quotes_content_revision_check
    CHECK (content_revision >= 1);

ALTER TABLE operations_communications
  DROP CONSTRAINT IF EXISTS operations_communications_content_revision_check,
  ADD CONSTRAINT operations_communications_content_revision_check
    CHECK (content_revision >= 1);

COMMIT;
