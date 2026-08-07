ALTER TABLE operations_email_messages
  VALIDATE CONSTRAINT operations_email_messages_business_workspace_fkey;

ALTER TABLE operations_email_crm_finalisations
  VALIDATE CONSTRAINT operations_email_crm_business_workspace_fkey;

ALTER TABLE operations_businesses
  ALTER COLUMN internal_workspace_id SET NOT NULL;

ALTER TABLE operations_client_communication_templates
  ALTER COLUMN internal_workspace_id SET NOT NULL;

ALTER TABLE operations_quote_service_items
  ALTER COLUMN internal_workspace_id SET NOT NULL;

ALTER TABLE operations_service_plan_templates
  ALTER COLUMN internal_workspace_id SET NOT NULL;
