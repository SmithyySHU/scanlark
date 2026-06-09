ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS site_display_name text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS client_name text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS report_display_name text;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS internal_notes text;
