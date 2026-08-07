BEGIN;

ALTER TABLE operations_quotes
  ADD COLUMN IF NOT EXISTS revision_series_id uuid,
  ADD COLUMN IF NOT EXISTS revision_number integer,
  ADD COLUMN IF NOT EXISTS supersedes_quote_id uuid;

UPDATE operations_quotes
SET revision_series_id = COALESCE(revision_series_id, gen_random_uuid()),
    revision_number = COALESCE(revision_number, 1)
WHERE revision_series_id IS NULL OR revision_number IS NULL;

ALTER TABLE operations_quotes
  ALTER COLUMN revision_series_id SET NOT NULL,
  ALTER COLUMN revision_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operations_quotes_supersedes_fk'
  ) THEN
    ALTER TABLE operations_quotes
      ADD CONSTRAINT operations_quotes_supersedes_fk
      FOREIGN KEY (supersedes_quote_id)
      REFERENCES operations_quotes(id)
      ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operations_quotes_revision_number_check'
  ) THEN
    ALTER TABLE operations_quotes
      ADD CONSTRAINT operations_quotes_revision_number_check
      CHECK (revision_number > 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operations_quotes_no_self_supersession_check'
  ) THEN
    ALTER TABLE operations_quotes
      ADD CONSTRAINT operations_quotes_no_self_supersession_check
      CHECK (supersedes_quote_id IS NULL OR supersedes_quote_id <> id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS operations_quotes_revision_series_number_idx
  ON operations_quotes(revision_series_id, revision_number);

CREATE INDEX IF NOT EXISTS operations_quotes_supersedes_idx
  ON operations_quotes(supersedes_quote_id)
  WHERE supersedes_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_quotes_revision_series_idx
  ON operations_quotes(revision_series_id, revision_number DESC);

COMMIT;
