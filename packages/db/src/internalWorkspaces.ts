import { ensureConnected } from "./client";

export type InternalWorkspaceRole =
  | "owner"
  | "operations_admin"
  | "operations_member"
  | "viewer";

export type InternalWorkspaceRow = {
  id: string;
  name: string;
  code: string;
  created_at: Date;
  updated_at: Date;
};

export type InternalWorkspaceMembershipRow = {
  workspace_id: string;
  user_id: string;
  role: InternalWorkspaceRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  workspace_name?: string;
  workspace_code?: string;
  user_email?: string;
};

export const SCANLARK_OPERATIONS_WORKSPACE_CODE = "scanlark-operations";

export const SITE_ACCESS_EXISTS_SQL = `
  (
    {siteAlias}.user_id = {userParam}
    OR EXISTS (
      SELECT 1
      FROM operations_business_sites access_obs
      JOIN operations_businesses access_business
        ON access_business.id = access_obs.business_id
      JOIN internal_workspace_memberships access_membership
        ON access_membership.workspace_id = access_business.internal_workspace_id
      WHERE access_obs.site_id = {siteAlias}.id
        AND access_membership.user_id = {userParam}
        AND access_membership.is_active = true
    )
  )
`;

export function siteAccessPredicate(siteAlias: string, userParam: string) {
  return SITE_ACCESS_EXISTS_SQL.split("{siteAlias}")
    .join(siteAlias)
    .split("{userParam}")
    .join(userParam);
}

export function siteManagePredicate(siteAlias: string, userParam: string) {
  return `
    (
      ${siteAlias}.user_id = ${userParam}
      OR EXISTS (
        SELECT 1
        FROM operations_business_sites access_obs
        JOIN operations_businesses access_business
          ON access_business.id = access_obs.business_id
        JOIN internal_workspace_memberships access_membership
          ON access_membership.workspace_id = access_business.internal_workspace_id
        WHERE access_obs.site_id = ${siteAlias}.id
          AND access_membership.user_id = ${userParam}
          AND access_membership.is_active = true
          AND access_membership.role IN ('owner', 'operations_admin', 'operations_member')
      )
    )
  `;
}

export async function getInternalWorkspaceByCode(
  code: string,
): Promise<InternalWorkspaceRow | null> {
  const client = await ensureConnected();
  const res = await client.query<InternalWorkspaceRow>(
    `
      SELECT id, name, code, created_at, updated_at
      FROM internal_workspaces
      WHERE code = $1
      LIMIT 1
    `,
    [code],
  );
  return res.rows[0] ?? null;
}

export async function getUserInternalWorkspaceMemberships(
  userId: string,
): Promise<InternalWorkspaceMembershipRow[]> {
  const client = await ensureConnected();
  const res = await client.query<InternalWorkspaceMembershipRow>(
    `
      SELECT m.workspace_id,
             m.user_id,
             m.role,
             m.is_active,
             m.created_at,
             m.updated_at,
             w.name AS workspace_name,
             w.code AS workspace_code
      FROM internal_workspace_memberships m
      JOIN internal_workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = $1
      ORDER BY w.name ASC
    `,
    [userId],
  );
  return res.rows;
}

export async function canAccessOperationsWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM internal_workspace_memberships
      WHERE workspace_id = $1
        AND user_id = $2
        AND is_active = true
      LIMIT 1
    `,
    [workspaceId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canManageOperationsWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM internal_workspace_memberships
      WHERE workspace_id = $1
        AND user_id = $2
        AND is_active = true
        AND role IN ('owner', 'operations_admin')
      LIMIT 1
    `,
    [workspaceId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canManageInternalWorkspaceMemberships(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM internal_workspace_memberships
      WHERE workspace_id = $1
        AND user_id = $2
        AND is_active = true
        AND role = 'owner'
      LIMIT 1
    `,
    [workspaceId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canAccessSite(userId: string, siteId: string) {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM sites s
      WHERE s.id = $1
        AND ${siteAccessPredicate("s", "$2")}
      LIMIT 1
    `,
    [siteId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canManageSite(userId: string, siteId: string) {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM sites s
      WHERE s.id = $1
        AND ${siteManagePredicate("s", "$2")}
      LIMIT 1
    `,
    [siteId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canAccessScanRun(userId: string, scanRunId: string) {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1
        AND ${siteAccessPredicate("s", "$2")}
      LIMIT 1
    `,
    [scanRunId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function canAccessTechnicalReport(
  userId: string,
  scanRunId: string,
) {
  return canAccessScanRun(userId, scanRunId);
}

export async function canAccessOperationsBusiness(
  userId: string,
  businessId: string,
) {
  const client = await ensureConnected();
  const res = await client.query(
    `
      SELECT 1
      FROM operations_businesses b
      JOIN internal_workspace_memberships m
        ON m.workspace_id = b.internal_workspace_id
      WHERE b.id = $1
        AND m.user_id = $2
        AND m.is_active = true
      LIMIT 1
    `,
    [businessId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function listInternalWorkspaceMembers(
  workspaceId: string,
): Promise<InternalWorkspaceMembershipRow[]> {
  const client = await ensureConnected();
  const res = await client.query<InternalWorkspaceMembershipRow>(
    `
      SELECT m.workspace_id,
             m.user_id,
             m.role,
             m.is_active,
             m.created_at,
             m.updated_at,
             u.email AS user_email
      FROM internal_workspace_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = $1
      ORDER BY m.is_active DESC, u.email ASC
    `,
    [workspaceId],
  );
  return res.rows;
}

export async function upsertInternalWorkspaceMembership(input: {
  workspaceId: string;
  userId: string;
  role: InternalWorkspaceRole;
  isActive?: boolean;
}): Promise<InternalWorkspaceMembershipRow> {
  const client = await ensureConnected();
  const res = await client.query<InternalWorkspaceMembershipRow>(
    `
      INSERT INTO internal_workspace_memberships (
        workspace_id, user_id, role, is_active
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (workspace_id, user_id) DO UPDATE
      SET role = EXCLUDED.role,
          is_active = EXCLUDED.is_active,
          updated_at = now()
      RETURNING *
    `,
    [input.workspaceId, input.userId, input.role, input.isActive ?? true],
  );
  return res.rows[0];
}

export async function setInternalWorkspaceMembershipActive(input: {
  workspaceId: string;
  userId: string;
  isActive: boolean;
}): Promise<InternalWorkspaceMembershipRow | null> {
  const client = await ensureConnected();
  const res = await client.query<InternalWorkspaceMembershipRow>(
    `
      UPDATE internal_workspace_memberships
      SET is_active = $3,
          updated_at = now()
      WHERE workspace_id = $1
        AND user_id = $2
      RETURNING *
    `,
    [input.workspaceId, input.userId, input.isActive],
  );
  return res.rows[0] ?? null;
}
