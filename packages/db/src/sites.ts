import { ensureConnected } from "./client";

export interface DbSiteRow {
  id: string;
  user_id: string;
  url: string;
  created_at: Date;
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
}

export type SiteMetadataFields = {
  siteDisplayName: string | null;
  clientName: string | null;
  reportDisplayName: string | null;
  internalNotes: string | null;
};

type NormalizedSiteMetadataFields = {
  siteDisplayName: string | null | undefined;
  clientName: string | null | undefined;
  reportDisplayName: string | null | undefined;
  internalNotes: string | null | undefined;
};

const SITE_SELECT_COLUMNS = `
  id,
  user_id,
  url,
  created_at,
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
  internal_notes
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
      internal_notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
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
    ],
  );

  return result.rows[0];
}

export async function createSiteForUser(
  userId: string,
  url: string,
  metadata: Partial<SiteMetadataFields> = {},
): Promise<DbSiteRow> {
  return createSite(userId, url, metadata);
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
  };

  const db = await ensureConnected();
  const result = await db.query<DbSiteRow>(
    `
    UPDATE sites
    SET site_display_name = $3,
        client_name = $4,
        report_display_name = $5,
        internal_notes = $6
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
    ],
  );

  return result.rows[0] ?? null;
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
