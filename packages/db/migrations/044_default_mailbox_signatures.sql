ALTER TABLE operations_client_communication_templates
  ALTER COLUMN signature_mode SET DEFAULT 'use_mailbox_signature';

UPDATE operations_client_communication_templates
SET signature_mode = 'use_mailbox_signature',
    updated_at = now()
WHERE is_system_default = true
  AND signature_mode = 'include_scanlark_signature';
