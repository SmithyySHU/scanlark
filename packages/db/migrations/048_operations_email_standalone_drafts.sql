ALTER TABLE operations_email_messages
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE operations_email_messages
  DROP CONSTRAINT IF EXISTS operations_email_messages_recipient_address_present_check,
  DROP CONSTRAINT IF EXISTS operations_email_messages_subject_present_check,
  DROP CONSTRAINT IF EXISTS operations_email_messages_editor_body_present_check,
  DROP CONSTRAINT IF EXISTS operations_email_messages_optional_crm_relationships_check;

ALTER TABLE operations_email_messages
  ADD CONSTRAINT operations_email_messages_optional_crm_relationships_check
  CHECK (
    business_id IS NOT NULL
    OR (
      contact_id IS NULL
      AND report_id IS NULL
      AND quote_id IS NULL
    )
  ),
  ADD CONSTRAINT operations_email_messages_recipient_address_present_check
  CHECK (
    status = 'draft'
    OR length(trim(recipient_address)) > 0
  ),
  ADD CONSTRAINT operations_email_messages_subject_present_check
  CHECK (
    status = 'draft'
    OR length(trim(subject)) > 0
  ),
  ADD CONSTRAINT operations_email_messages_editor_body_present_check
  CHECK (
    status = 'draft'
    OR length(trim(editor_body)) > 0
  );

COMMENT ON COLUMN operations_email_messages.business_id IS
  'Optional for standalone Email. Linked successful delivery may later be recorded in the client Communications timeline.';
