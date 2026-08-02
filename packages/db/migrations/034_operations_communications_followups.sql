ALTER TABLE operations_client_communication_templates
  ADD COLUMN IF NOT EXISTS default_follow_up_business_days integer;

ALTER TABLE operations_client_communication_templates
  DROP CONSTRAINT IF EXISTS operations_client_communication_templates_follow_up_days_check;

ALTER TABLE operations_client_communication_templates
  ADD CONSTRAINT operations_client_communication_templates_follow_up_days_check
    CHECK (
      default_follow_up_business_days IS NULL
      OR (
        default_follow_up_business_days >= 0
        AND default_follow_up_business_days <= 60
      )
    );

UPDATE operations_client_communication_templates
SET default_follow_up_business_days = CASE category
  WHEN 'warm_introduction' THEN 4
  WHEN 'cold_outreach' THEN 4
  WHEN 'report_offer' THEN 4
  WHEN 'report_delivery' THEN 3
  WHEN 'quote_delivery' THEN 5
  WHEN 'work_completed' THEN 7
  WHEN 'testimonial_request' THEN 7
  ELSE default_follow_up_business_days
END
WHERE default_follow_up_business_days IS NULL;

ALTER TABLE operations_contacts
  ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason text,
  ADD COLUMN IF NOT EXISTS preferred_channel text;

ALTER TABLE operations_contacts
  DROP CONSTRAINT IF EXISTS operations_contacts_preferred_channel_check;

ALTER TABLE operations_contacts
  ADD CONSTRAINT operations_contacts_preferred_channel_check
    CHECK (
      preferred_channel IS NULL
      OR preferred_channel IN ('email', 'phone', 'video_call', 'in_person', 'other')
    );

CREATE INDEX IF NOT EXISTS operations_contacts_do_not_contact_idx
  ON operations_contacts(business_id, do_not_contact)
  WHERE do_not_contact = true;
