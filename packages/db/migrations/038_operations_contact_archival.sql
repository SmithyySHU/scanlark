ALTER TABLE operations_contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DROP INDEX IF EXISTS operations_contacts_one_primary_idx;

UPDATE operations_contacts
SET is_primary = false,
    updated_at = now()
WHERE archived_at IS NOT NULL
  AND is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS operations_contacts_one_primary_idx
  ON operations_contacts(business_id)
  WHERE is_primary = true
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS operations_contacts_archived_idx
  ON operations_contacts(business_id, archived_at)
  WHERE archived_at IS NOT NULL;

