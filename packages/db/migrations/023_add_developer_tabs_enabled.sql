ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS developer_tabs_enabled boolean NOT NULL DEFAULT false;
