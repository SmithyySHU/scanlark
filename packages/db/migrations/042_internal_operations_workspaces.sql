CREATE TABLE IF NOT EXISTS internal_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT internal_workspaces_name_present_check
    CHECK (length(trim(name)) > 0),
  CONSTRAINT internal_workspaces_code_present_check
    CHECK (length(trim(code)) > 0)
);

CREATE TABLE IF NOT EXISTS internal_workspace_memberships (
  workspace_id uuid NOT NULL REFERENCES internal_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT internal_workspace_memberships_role_check
    CHECK (role IN ('owner', 'operations_admin', 'operations_member', 'viewer'))
);

CREATE INDEX IF NOT EXISTS internal_workspace_memberships_user_idx
  ON internal_workspace_memberships(user_id, is_active);

CREATE INDEX IF NOT EXISTS internal_workspace_memberships_workspace_idx
  ON internal_workspace_memberships(workspace_id, is_active, role);

ALTER TABLE operations_businesses
  ADD COLUMN IF NOT EXISTS internal_workspace_id uuid REFERENCES internal_workspaces(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS operations_businesses_internal_workspace_idx
  ON operations_businesses(internal_workspace_id, is_archived, updated_at DESC);

INSERT INTO internal_workspaces (name, code)
VALUES ('Scanlark Operations', 'scanlark-operations')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    updated_at = now();

UPDATE operations_businesses
SET internal_workspace_id = (
  SELECT id FROM internal_workspaces WHERE code = 'scanlark-operations'
)
WHERE internal_workspace_id IS NULL;

INSERT INTO internal_workspace_memberships (workspace_id, user_id, role)
SELECT w.id, u.id, seed.role
FROM internal_workspaces w
JOIN (
  VALUES
    ('connor@scanlark.com', 'owner'),
    ('support@scanlark.com', 'operations_admin')
) AS seed(email, role) ON true
JOIN users u ON lower(u.email) = seed.email
WHERE w.code = 'scanlark-operations'
ON CONFLICT (workspace_id, user_id) DO UPDATE
SET role = EXCLUDED.role,
    is_active = true,
    updated_at = now();
