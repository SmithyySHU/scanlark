CREATE TABLE IF NOT EXISTS link_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_id uuid NOT NULL,
  link_url text NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT link_notes_site_link_url_unique UNIQUE (site_id, link_url)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'link_notes_user_id_fkey'
  ) THEN
    ALTER TABLE link_notes
      ADD CONSTRAINT link_notes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'link_notes_site_id_fkey'
  ) THEN
    ALTER TABLE link_notes
      ADD CONSTRAINT link_notes_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'link_notes_status_check'
  ) THEN
    ALTER TABLE link_notes
      ADD CONSTRAINT link_notes_status_check
      CHECK (status IN ('open', 'snoozed', 'resolved'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS link_notes_user_site_idx ON link_notes(user_id, site_id);
CREATE INDEX IF NOT EXISTS link_notes_site_status_idx ON link_notes(site_id, status);
