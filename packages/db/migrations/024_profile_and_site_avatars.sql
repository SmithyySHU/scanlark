ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS avatar_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS avatar_source_url text,
  ADD COLUMN IF NOT EXISTS avatar_content_type text,
  ADD COLUMN IF NOT EXISTS avatar_content bytea,
  ADD COLUMN IF NOT EXISTS avatar_size_bytes int,
  ADD COLUMN IF NOT EXISTS avatar_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS avatar_error text;

ALTER TABLE sites
  DROP CONSTRAINT IF EXISTS sites_avatar_status_check;

ALTER TABLE sites
  ADD CONSTRAINT sites_avatar_status_check
    CHECK (avatar_status IN ('pending', 'cached', 'missing', 'failed', 'removed'));
