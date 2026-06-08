INSERT INTO users (id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'demo@scanlark.local',
  '$argon2id$v=19$m=65536,t=3,p=4$nrjHN5eArg63vsMslJzNlw$9hf11/A9pZY1eAeWviIj8iZIclccO8RofGAdyyzbXb4'
)
ON CONFLICT (email) DO NOTHING;

ALTER TABLE ignore_rules ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE ignore_rules r
SET user_id = s.user_id
FROM sites s
WHERE r.site_id = s.id
  AND r.user_id IS NULL;

UPDATE ignore_rules
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE ignore_rules
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ignore_rules_user_id_fkey'
  ) THEN
    ALTER TABLE ignore_rules
      ADD CONSTRAINT ignore_rules_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ignore_rules_user_id_idx ON ignore_rules(user_id);
CREATE INDEX IF NOT EXISTS ignore_rules_user_site_idx ON ignore_rules(user_id, site_id);
