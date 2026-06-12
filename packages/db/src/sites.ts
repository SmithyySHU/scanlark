import { ensureConnected } from "./client";

export interface DbSiteRow {
  id: string;
  user_id: string;
  url: string;
  created_at: Date;
  disabled_at: Date | null;
  permission_confirmed_at: Date | null;
  permission_confirmed_by_user_id: string | null;
  permission_confirmation_text_version: string | null;
  permission_confirmation_text: string | null;
  verification_status:
    | "unverified"
    | "permission_confirmed"
    | "legacy_alpha"
    | "sample_site";
  schedule_enabled: boolean;
  schedule_frequency: "manual" | "daily" | "weekly" | "monthly";
  schedule_time_utc: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_at: Date | null;
  last_scheduled_at: Date | null;
  notify_enabled: boolean;
  notify_email: string | null;
  notify_on: "always" | "issues" | "issues_exist" | "new_issues_only" | "never";
  notify_include_csv: boolean;
  notify_only_on_change: boolean;
  notify_include_blocked: boolean;
  notify_include_broken: boolean;
  last_notified_scan_run_id: string | null;
  summary_enabled: boolean;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  internal_notes: string | null;
  developer_tabs_enabled: boolean;
  avatar_status: "pending" | "cached" | "missing" | "failed" | "removed";
  avatar_source_url: string | null;
  avatar_content_type: string | null;
  avatar_size_bytes: number | null;
  avatar_fetched_at: Date | null;
  avatar_checked_at: Date | null;
  avatar_error: string | null;
}

export type SiteAvatarStatus = DbSiteRow["avatar_status"];

export type SiteAvatarAsset = {
  site_id: string;
  status: SiteAvatarStatus;
  source_url: string | null;
  content_type: string | null;
  content: Buffer | null;
  size_bytes: number | null;
  fetched_at: Date | null;
  checked_at: Date | null;
  error: string | null;
};

export type CacheSiteAvatarInput = {
  sourceUrl: string;
  contentType: string;
  content: Buffer;
};

export type SiteMetadataFields = {
  siteDisplayName: string | null;
  clientName: string | null;
  reportDisplayName: string | null;
  internalNotes: string | null;
  developerTabsEnabled: boolean;
};

export type SitePermissionConfirmationFields = {
  permissionConfirmedAt: Date | null;
  permissionConfirmedByUserId: string | null;
  permissionConfirmationTextVersion: string | null;
  permissionConfirmationText: string | null;
  verificationStatus:
    | "unverified"
    | "permission_confirmed"
    | "legacy_alpha"
    | "sample_site";
};

type NormalizedSiteMetadataFields = {
  siteDisplayName: string | null | undefined;
  clientName: string | null | undefined;
  reportDisplayName: string | null | undefined;
  internalNotes: string | null | undefined;
  developerTabsEnabled: boolean | undefined;
};

const SITE_SELECT_COLUMNS = `
  id,
  user_id,
  url,
  created_at,
  disabled_at,
  permission_confirmed_at,
  permission_confirmed_by_user_id,
  permission_confirmation_text_version,
  permission_confirmation_text,
  verification_status,
  schedule_enabled,
  schedule_frequency,
  schedule_time_utc,
  schedule_day_of_week,
  schedule_day_of_month,
  next_scheduled_at,
  last_scheduled_at,
  notify_enabled,
  notify_email,
  notify_on,
  notify_include_csv,
  notify_only_on_change,
  notify_include_blocked,
  notify_include_broken,
  last_notified_scan_run_id,
  summary_enabled,
  site_display_name,
  client_name,
  report_display_name,
  internal_notes,
  developer_tabs_enabled,
  avatar_status,
  avatar_source_url,
  avatar_content_type,
  avatar_size_bytes,
  avatar_fetched_at,
  avatar_checked_at,
  avatar_error
`;

function normalizeSiteMetadataValue(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSiteMetadataFields(
  fields: Partial<SiteMetadataFields> = {},
): NormalizedSiteMetadataFields {
  return {
    siteDisplayName: normalizeSiteMetadataValue(fields.siteDisplayName),
    clientName: normalizeSiteMetadataValue(fields.clientName),
    reportDisplayName: normalizeSiteMetadataValue(fields.reportDisplayName),
    internalNotes: normalizeSiteMetadataValue(fields.internalNotes),
    developerTabsEnabled:
      typeof fields.developerTabsEnabled === "boolean"
        ? fields.developerTabsEnabled
        : undefined,
  };
}

export async function getSitesForUser(userId: string): Promise<DbSiteRow[]> {
  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    SELECT ${SITE_SELECT_COLUMNS}
    FROM sites
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId],
  );

  return result.rows;
}

export async function listSitesForUser(userId: string): Promise<DbSiteRow[]> {
  return getSitesForUser(userId);
}

export async function getAllSites(): Promise<DbSiteRow[]> {
  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    SELECT ${SITE_SELECT_COLUMNS}
    FROM sites
    ORDER BY created_at DESC
    `,
  );

  return result.rows;
}

export async function getSiteById(id: string): Promise<DbSiteRow | null> {
  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    SELECT ${SITE_SELECT_COLUMNS}
    FROM sites
    WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getSiteByIdForUser(
  userId: string,
  siteId: string,
): Promise<DbSiteRow | null> {
  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    SELECT ${SITE_SELECT_COLUMNS}
    FROM sites
    WHERE id = $1 AND user_id = $2
    `,
    [siteId, userId],
  );

  return result.rows[0] ?? null;
}

export async function createSite(
  userId: string,
  url: string,
  metadata: Partial<SiteMetadataFields> = {},
  permission: Partial<SitePermissionConfirmationFields> = {},
): Promise<DbSiteRow> {
  if (!userId) {
    throw new Error("userId is required");
  }
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("url is required");
  }

  const db = await ensureConnected();
  const normalized = normalizeSiteMetadataFields(metadata);

  const result = await db.query<DbSiteRow>(
    `
    INSERT INTO sites (
      user_id,
      url,
      schedule_day_of_week,
      site_display_name,
      client_name,
      report_display_name,
      internal_notes,
      developer_tabs_enabled,
      permission_confirmed_at,
      permission_confirmed_by_user_id,
      permission_confirmation_text_version,
      permission_confirmation_text,
      verification_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING ${SITE_SELECT_COLUMNS}
    `,
    [
      userId,
      url.trim(),
      1,
      normalized.siteDisplayName ?? null,
      normalized.clientName ?? null,
      normalized.reportDisplayName ?? null,
      normalized.internalNotes ?? null,
      normalized.developerTabsEnabled ?? false,
      permission.permissionConfirmedAt ?? null,
      permission.permissionConfirmedByUserId ?? null,
      permission.permissionConfirmationTextVersion ?? null,
      permission.permissionConfirmationText ?? null,
      permission.verificationStatus ?? "unverified",
    ],
  );

  return result.rows[0];
}

export async function createSiteForUser(
  userId: string,
  url: string,
  metadata: Partial<SiteMetadataFields> = {},
  permission: Partial<SitePermissionConfirmationFields> = {},
): Promise<DbSiteRow> {
  return createSite(userId, url, metadata, permission);
}

export async function updateSiteMetadataForUser(
  userId: string,
  siteId: string,
  fields: Partial<SiteMetadataFields>,
): Promise<DbSiteRow | null> {
  const existing = await getSiteByIdForUser(userId, siteId);
  if (!existing) return null;

  const normalized = normalizeSiteMetadataFields(fields);
  const next = {
    siteDisplayName:
      normalized.siteDisplayName !== undefined
        ? normalized.siteDisplayName
        : existing.site_display_name,
    clientName:
      normalized.clientName !== undefined
        ? normalized.clientName
        : existing.client_name,
    reportDisplayName:
      normalized.reportDisplayName !== undefined
        ? normalized.reportDisplayName
        : existing.report_display_name,
    internalNotes:
      normalized.internalNotes !== undefined
        ? normalized.internalNotes
        : existing.internal_notes,
    developerTabsEnabled:
      normalized.developerTabsEnabled !== undefined
        ? normalized.developerTabsEnabled
        : existing.developer_tabs_enabled,
  };

  const db = await ensureConnected();
  const result = await db.query<DbSiteRow>(
    `
    UPDATE sites
    SET site_display_name = $3,
        client_name = $4,
        report_display_name = $5,
        internal_notes = $6,
        developer_tabs_enabled = $7
    WHERE id = $1 AND user_id = $2
    RETURNING ${SITE_SELECT_COLUMNS}
    `,
    [
      siteId,
      userId,
      next.siteDisplayName,
      next.clientName,
      next.reportDisplayName,
      next.internalNotes,
      next.developerTabsEnabled,
    ],
  );

  return result.rows[0] ?? null;
}

export async function cacheSiteAvatarForUser(
  userId: string,
  siteId: string,
  input: CacheSiteAvatarInput,
): Promise<DbSiteRow | null> {
  const db = await ensureConnected();
  const result = await db.query<DbSiteRow>(
    `
    UPDATE sites
    SET avatar_status = 'cached',
        avatar_source_url = $3,
        avatar_content_type = $4,
        avatar_content = $5,
        avatar_size_bytes = $6,
        avatar_fetched_at = NOW(),
        avatar_checked_at = NOW(),
        avatar_error = NULL
    WHERE id = $1 AND user_id = $2
    RETURNING ${SITE_SELECT_COLUMNS}
    `,
    [
      siteId,
      userId,
      input.sourceUrl,
      input.contentType,
      input.content,
      input.content.byteLength,
    ],
  );
  return result.rows[0] ?? null;
}

export async function markSiteAvatarUnavailableForUser(
  userId: string,
  siteId: string,
  status: Exclude<SiteAvatarStatus, "cached" | "pending">,
  error: string | null,
): Promise<DbSiteRow | null> {
  const db = await ensureConnected();
  const result = await db.query<DbSiteRow>(
    `
    UPDATE sites
    SET avatar_status = $3,
        avatar_source_url = NULL,
        avatar_content_type = NULL,
        avatar_content = NULL,
        avatar_size_bytes = NULL,
        avatar_fetched_at = NULL,
        avatar_checked_at = NOW(),
        avatar_error = $4
    WHERE id = $1 AND user_id = $2
    RETURNING ${SITE_SELECT_COLUMNS}
    `,
    [siteId, userId, status, error],
  );
  return result.rows[0] ?? null;
}

export async function getSiteAvatarForUser(
  userId: string,
  siteId: string,
): Promise<SiteAvatarAsset | null> {
  const db = await ensureConnected();
  const result = await db.query<{
    id: string;
    avatar_status: SiteAvatarStatus;
    avatar_source_url: string | null;
    avatar_content_type: string | null;
    avatar_content: Buffer | null;
    avatar_size_bytes: number | null;
    avatar_fetched_at: Date | null;
    avatar_checked_at: Date | null;
    avatar_error: string | null;
  }>(
    `
    SELECT
      id,
      avatar_status,
      avatar_source_url,
      avatar_content_type,
      avatar_content,
      avatar_size_bytes,
      avatar_fetched_at,
      avatar_checked_at,
      avatar_error
    FROM sites
    WHERE id = $1 AND user_id = $2
    LIMIT 1
    `,
    [siteId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    site_id: row.id,
    status: row.avatar_status,
    source_url: row.avatar_source_url,
    content_type: row.avatar_content_type,
    content: row.avatar_content,
    size_bytes: row.avatar_size_bytes,
    fetched_at: row.avatar_fetched_at,
    checked_at: row.avatar_checked_at,
    error: row.avatar_error,
  };
}

// Delete a site and all its scan data.
// For now we ignore user scoping and just delete by site ID so you
// can clean up any stray test data.
export async function deleteSite(id: string): Promise<boolean> {
  const db = await ensureConnected();

  await db.query("BEGIN");
  try {
    // Remove scan results for all runs on this site
    await db.query(
      `
      DELETE FROM scan_results
      WHERE scan_run_id IN (
        SELECT id FROM scan_runs WHERE site_id = $1
      )
      `,
      [id],
    );

    // Remove scan runs for this site
    await db.query(
      `
      DELETE FROM scan_runs
      WHERE site_id = $1
      `,
      [id],
    );

    // Remove the site itself
    const result = await db.query<{ id: string }>(
      `
      DELETE FROM sites
      WHERE id = $1
      RETURNING id
      `,
      [id],
    );

    await db.query("COMMIT");
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

// Backwards-compatible wrapper if anything still calls deleteSiteForUser
export async function deleteSiteForUser(
  siteId: string,
  userId: string,
): Promise<boolean> {
  const site = await getSiteByIdForUser(userId, siteId);
  if (!site) return false;
  return deleteSite(siteId);
}

export async function backfillSitesUserId(userId: string): Promise<number> {
  const db = await ensureConnected();
  const res = await db.query(
    `
      UPDATE sites
      SET user_id = $1
      WHERE user_id IS NULL
    `,
    [userId],
  );
  return res.rowCount ?? 0;
}
