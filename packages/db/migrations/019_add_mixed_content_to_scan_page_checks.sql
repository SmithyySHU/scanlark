ALTER TABLE scan_page_checks
  ADD COLUMN IF NOT EXISTS mixed_content_json jsonb NOT NULL DEFAULT '[]'::jsonb;
