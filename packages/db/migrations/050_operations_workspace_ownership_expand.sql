BEGIN;

ALTER TABLE operations_client_communication_templates
  ADD COLUMN IF NOT EXISTS internal_workspace_id uuid
  REFERENCES internal_workspaces(id) ON DELETE RESTRICT;

ALTER TABLE operations_quote_service_items
  ADD COLUMN IF NOT EXISTS internal_workspace_id uuid
  REFERENCES internal_workspaces(id) ON DELETE RESTRICT;

ALTER TABLE operations_service_plan_templates
  ADD COLUMN IF NOT EXISTS internal_workspace_id uuid
  REFERENCES internal_workspaces(id) ON DELETE RESTRICT;

-- A NULL business can only be inferred automatically from a single Email
-- workspace relationship. Conflicting relationships deliberately remain NULL
-- and make the migration fail below.
UPDATE operations_businesses b
SET internal_workspace_id = inferred.workspace_id
FROM (
  SELECT business_id, min(workspace_id::text)::uuid AS workspace_id
  FROM operations_email_messages
  GROUP BY business_id
  HAVING count(DISTINCT workspace_id) = 1
) inferred
WHERE b.id = inferred.business_id
  AND b.internal_workspace_id IS NULL;

DO $$
DECLARE
  workspace_count integer;
  sole_workspace_id uuid;
BEGIN
  SELECT count(*), min(id::text)::uuid
  INTO workspace_count, sole_workspace_id
  FROM internal_workspaces;

  IF workspace_count = 1 THEN
    UPDATE operations_businesses
    SET internal_workspace_id = sole_workspace_id
    WHERE internal_workspace_id IS NULL;

    UPDATE operations_client_communication_templates
    SET internal_workspace_id = sole_workspace_id
    WHERE internal_workspace_id IS NULL;

    UPDATE operations_quote_service_items
    SET internal_workspace_id = sole_workspace_id
    WHERE internal_workspace_id IS NULL;

    UPDATE operations_service_plan_templates
    SET internal_workspace_id = sole_workspace_id
    WHERE internal_workspace_id IS NULL;
  ELSE
    -- Creator membership is conclusive only when exactly one active membership
    -- exists. Rows without such provenance require an explicit reviewed mapping.
    UPDATE operations_client_communication_templates t
    SET internal_workspace_id = candidate.workspace_id
    FROM (
      SELECT user_id, min(workspace_id::text)::uuid AS workspace_id
      FROM internal_workspace_memberships
      WHERE is_active = true
      GROUP BY user_id
      HAVING count(*) = 1
    ) candidate
    WHERE t.internal_workspace_id IS NULL
      AND t.created_by_user_id = candidate.user_id;

    UPDATE operations_quote_service_items i
    SET internal_workspace_id = candidate.workspace_id
    FROM (
      SELECT user_id, min(workspace_id::text)::uuid AS workspace_id
      FROM internal_workspace_memberships
      WHERE is_active = true
      GROUP BY user_id
      HAVING count(*) = 1
    ) candidate
    WHERE i.internal_workspace_id IS NULL
      AND i.created_by_user_id = candidate.user_id;

    UPDATE operations_service_plan_templates p
    SET internal_workspace_id = candidate.workspace_id
    FROM (
      SELECT user_id, min(workspace_id::text)::uuid AS workspace_id
      FROM internal_workspace_memberships
      WHERE is_active = true
      GROUP BY user_id
      HAVING count(*) = 1
    ) candidate
    WHERE p.internal_workspace_id IS NULL
      AND p.created_by_user_id = candidate.user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM operations_businesses WHERE internal_workspace_id IS NULL)
     OR EXISTS (SELECT 1 FROM operations_client_communication_templates WHERE internal_workspace_id IS NULL)
     OR EXISTS (SELECT 1 FROM operations_quote_service_items WHERE internal_workspace_id IS NULL)
     OR EXISTS (SELECT 1 FROM operations_service_plan_templates WHERE internal_workspace_id IS NULL) THEN
    RAISE EXCEPTION 'operations_workspace_ownership_unresolved: run Batch A preflight and apply an explicit reviewed mapping';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM operations_email_messages m
    JOIN operations_businesses b ON b.id = m.business_id
    WHERE m.workspace_id IS DISTINCT FROM b.internal_workspace_id
  ) THEN
    RAISE EXCEPTION 'operations_workspace_ownership_conflict: Email/business workspace mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM operations_business_sites obs
    JOIN operations_businesses b ON b.id = obs.business_id
    GROUP BY obs.site_id
    HAVING count(DISTINCT b.internal_workspace_id) > 1
  ) THEN
    RAISE EXCEPTION 'operations_workspace_ownership_conflict: site linked across workspaces';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS operations_communication_templates_workspace_idx
  ON operations_client_communication_templates(internal_workspace_id, is_active, category, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_quote_service_items_workspace_idx
  ON operations_quote_service_items(internal_workspace_id, is_active, item_type, title);

CREATE INDEX IF NOT EXISTS operations_service_plans_workspace_idx
  ON operations_service_plan_templates(internal_workspace_id, is_active, archived_at, updated_at DESC);

ALTER TABLE operations_client_communication_templates
  DROP CONSTRAINT IF EXISTS operations_client_communication_templates_system_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS operations_communication_templates_workspace_system_key_uidx
  ON operations_client_communication_templates(internal_workspace_id, system_key)
  WHERE system_key IS NOT NULL;

ALTER TABLE operations_service_plan_templates
  DROP CONSTRAINT IF EXISTS operations_service_plan_templates_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS operations_service_plans_workspace_code_uidx
  ON operations_service_plan_templates(internal_workspace_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS operations_businesses_id_workspace_uidx
  ON operations_businesses(id, internal_workspace_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operations_email_messages_business_workspace_fkey'
  ) THEN
    ALTER TABLE operations_email_messages
      ADD CONSTRAINT operations_email_messages_business_workspace_fkey
      FOREIGN KEY (business_id, workspace_id)
      REFERENCES operations_businesses(id, internal_workspace_id)
      ON DELETE RESTRICT NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'operations_email_crm_business_workspace_fkey'
  ) THEN
    ALTER TABLE operations_email_crm_finalisations
      ADD CONSTRAINT operations_email_crm_business_workspace_fkey
      FOREIGN KEY (business_id, workspace_id)
      REFERENCES operations_businesses(id, internal_workspace_id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

COMMIT;
