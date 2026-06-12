ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS permission_confirmed_at timestamptz;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS permission_confirmed_by_user_id uuid;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS permission_confirmation_text_version text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS permission_confirmation_text text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sites_permission_confirmed_by_user_id_fkey'
  ) THEN
    ALTER TABLE sites
      ADD CONSTRAINT sites_permission_confirmed_by_user_id_fkey
      FOREIGN KEY (permission_confirmed_by_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE sites
SET verification_status = 'legacy_alpha',
    permission_confirmed_at = COALESCE(permission_confirmed_at, NOW()),
    permission_confirmed_by_user_id = COALESCE(permission_confirmed_by_user_id, user_id),
    permission_confirmation_text_version = COALESCE(
      permission_confirmation_text_version,
      'legacy_alpha'
    ),
    permission_confirmation_text = COALESCE(
      permission_confirmation_text,
      'Existing alpha site backfilled before technical ownership verification.'
    )
WHERE verification_status = 'unverified'
  AND permission_confirmed_at IS NULL;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_verification_status_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_verification_status_check
  CHECK (
    verification_status IN (
      'unverified',
      'permission_confirmed',
      'legacy_alpha',
      'sample_site'
    )
  );

CREATE INDEX IF NOT EXISTS sites_verification_status_idx
  ON sites(verification_status);

CREATE INDEX IF NOT EXISTS sites_permission_confirmed_at_idx
  ON sites(permission_confirmed_at);
