CREATE TABLE IF NOT EXISTS operations_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pipeline_stage text NOT NULL DEFAULT 'discovered',
  relationship_type text NOT NULL DEFAULT 'prospect',
  source text,
  business_type text,
  location text,
  phone text,
  general_email text,
  website_url text,
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  next_action text,
  is_archived boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_businesses_pipeline_stage_check
    CHECK (pipeline_stage IN (
      'discovered',
      'researched',
      'ready_to_contact',
      'email_sent',
      'replied',
      'report_requested',
      'report_sent',
      'quote_sent',
      'won',
      'ongoing_client',
      'closed'
    )),
  CONSTRAINT operations_businesses_relationship_type_check
    CHECK (relationship_type IN (
      'prospect',
      'client',
      'former_client',
      'partner',
      'other'
    )),
  CONSTRAINT operations_businesses_name_present_check
    CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS operations_businesses_archived_idx
  ON operations_businesses(is_archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_businesses_pipeline_stage_idx
  ON operations_businesses(pipeline_stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_businesses_relationship_type_idx
  ON operations_businesses(relationship_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_businesses_next_follow_up_idx
  ON operations_businesses(next_follow_up_at)
  WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS operations_businesses_lower_name_idx
  ON operations_businesses(lower(name));

CREATE TABLE IF NOT EXISTS operations_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_contacts_contact_method_check
    CHECK (
      email IS NULL
      OR length(trim(email)) > 0
      OR phone IS NULL
      OR length(trim(phone)) > 0
      OR first_name IS NULL
      OR length(trim(first_name)) > 0
      OR last_name IS NULL
      OR length(trim(last_name)) > 0
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_contacts_one_primary_idx
  ON operations_contacts(business_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS operations_contacts_business_idx
  ON operations_contacts(business_id, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_contacts_lower_email_idx
  ON operations_contacts(lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_business_sites (
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (business_id, site_id)
);

CREATE INDEX IF NOT EXISTS operations_business_sites_site_idx
  ON operations_business_sites(site_id);

CREATE INDEX IF NOT EXISTS operations_business_sites_business_idx
  ON operations_business_sites(business_id);

CREATE TABLE IF NOT EXISTS operations_business_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT operations_business_notes_body_present_check
    CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS operations_business_notes_business_created_idx
  ON operations_business_notes(business_id, created_at DESC);
