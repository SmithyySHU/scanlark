import { ensureConnected } from "./client";

export interface DbSiteRow {
  id: string;
  user_id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  internal_notes: string | null;
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
}

export type SiteMetadataInput = {
  siteDisplayName?: string | null;
  clientName?: string | null;
  reportDisplayName?: string | null;
  internalNotes?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function getSitesForUser(userId: string): Promise<DbSiteRow[]> {
  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    SELECT id,
           user_id,
           url,
           site_display_name,
           client_name,
           report_display_name,
           internal_notes,
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
           summary_enabled
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
    SELECT id,
           user_id,
           url,
           site_display_name,
           client_name,
           report_display_name,
           internal_notes,
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
           summary_enabled
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
    SELECT id,
           user_id,
           url,
           site_display_name,
           client_name,
           report_display_name,
           internal_notes,
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
           summary_enabled
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
    SELECT id,
           user_id,
           url,
           site_display_name,
           client_name,
           report_display_name,
           internal_notes,
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
           summary_enabled
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
  metadata?: SiteMetadataInput,
): Promise<DbSiteRow> {
  if (!userId) {
    throw new Error("userId is required");
  }
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("url is required");
  }

  const db = await ensureConnected();

  const result = await db.query<DbSiteRow>(
    `
    INSERT INTO sites (
      user_id,
      url,
      site_display_name,
      client_name,
      report_display_name,
      internal_notes,
      schedule_day_of_week
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id,
              user_id,
              url,
              site_display_name,
              client_name,
              report_display_name,
              internal_notes,
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
              summary_enabled
    `,
    [
      userId,
      url.trim(),
      normalizeOptionalText(metadata?.siteDisplayName),
      normalizeOptionalText(metadata?.clientName),
      normalizeOptionalText(metadata?.reportDisplayName),
      normalizeOptionalText(metadata?.internalNotes),
      1,
    ],
  );

  return result.rows[0];
}

export async function createSiteForUser(
  userId: string,
  url: string,
  metadata?: SiteMetadataInput,
): Promise<DbSiteRow> {
  return createSite(userId, url, metadata);
}

export async function updateSiteMetadataForUser(
  userId: string,
  siteId: string,
  metadata: SiteMetadataInput,
): Promise<DbSiteRow | null> {
  const db = await ensureConnected();
  const nextSiteDisplayName =
    metadata.siteDisplayName === undefined
      ? null
      : normalizeOptionalText(metadata.siteDisplayName);
  const nextClientName =
    metadata.clientName === undefined
      ? null
      : normalizeOptionalText(metadata.clientName);
  const nextReportDisplayName =
    metadata.reportDisplayName === undefined
      ? null
      : normalizeOptionalText(metadata.reportDisplayName);
  const nextInternalNotes =
    metadata.internalNotes === undefined
      ? null
      : normalizeOptionalText(metadata.internalNotes);
  const result = await db.query<DbSiteRow>(
    `
    UPDATE sites
    SET site_display_name = CASE WHEN $3 THEN $4 ELSE site_display_name END,
        client_name = CASE WHEN $5 THEN $6 ELSE client_name END,
        report_display_name = CASE WHEN $7 THEN $8 ELSE report_display_name END,
        internal_notes = CASE WHEN $9 THEN $10 ELSE internal_notes END
    WHERE id = $1
      AND user_id = $2
    RETURNING id,
              user_id,
              url,
              site_display_name,
              client_name,
              report_display_name,
              internal_notes,
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
              summary_enabled
    `,
    [
      siteId,
      userId,
      metadata.siteDisplayName !== undefined,
      nextSiteDisplayName,
      metadata.clientName !== undefined,
      nextClientName,
      metadata.reportDisplayName !== undefined,
      nextReportDisplayName,
      metadata.internalNotes !== undefined,
      nextInternalNotes,
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
