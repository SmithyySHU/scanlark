CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);

ALTER TABLE sites ADD COLUMN IF NOT EXISTS user_id uuid;

INSERT INTO users (id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'demo@scanlark.local',
  '$argon2id$v=19$m=65536,t=3,p=4$nrjHN5eArg63vsMslJzNlw$9hf11/A9pZY1eAeWviIj8iZIclccO8RofGAdyyzbXb4'
)
ON CONFLICT (email) DO NOTHING;

UPDATE sites
SET user_id = '00000000-0000-0000-0000-000000000000'
WHERE user_id IS NULL;

ALTER TABLE sites
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sites_user_id_fkey'
  ) THEN
    ALTER TABLE sites
      ADD CONSTRAINT sites_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sites_user_id_idx ON sites(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE users TO scanlark;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_sessions TO scanlark;
