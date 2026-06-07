import { ensureConnected } from "./client";

export type LinkNoteStatus = "open" | "snoozed" | "resolved";

export interface LinkNote {
  id: string;
  user_id: string;
  site_id: string;
  link_url: string;
  note: string;
  status: LinkNoteStatus;
  created_at: Date;
  updated_at: Date;
}

export function normalizeLinkUrl(value: string): string {
  return value.trim();
}

export async function listLinkNotesForSiteForUser(
  userId: string,
  siteId: string,
  status?: LinkNoteStatus | "all",
): Promise<LinkNote[]> {
  const client = await ensureConnected();
  const statusFilter = status && status !== "all";
  const params: Array<string> = [userId, siteId];
  let statusClause = "";
  if (statusFilter) {
    params.push(status);
    statusClause = `AND n.status = $${params.length}`;
  }

  const res = await client.query<LinkNote>(
    `
      SELECT
        n.id,
        n.user_id,
        n.site_id,
        n.link_url,
        n.note,
        n.status,
        n.created_at,
        n.updated_at
      FROM link_notes n
      JOIN sites s ON s.id = n.site_id
      WHERE s.user_id = $1
        AND n.site_id = $2
        ${statusClause}
      ORDER BY n.updated_at DESC
    `,
    params,
  );

  return res.rows;
}

export async function getLinkNoteForSiteByUrlForUser(
  userId: string,
  siteId: string,
  linkUrl: string,
): Promise<LinkNote | null> {
  const client = await ensureConnected();
  const normalized = normalizeLinkUrl(linkUrl);
  const res = await client.query<LinkNote>(
    `
      SELECT
        n.id,
        n.user_id,
        n.site_id,
        n.link_url,
        n.note,
        n.status,
        n.created_at,
        n.updated_at
      FROM link_notes n
      JOIN sites s ON s.id = n.site_id
      WHERE s.user_id = $1
        AND n.site_id = $2
        AND n.link_url = $3
      LIMIT 1
    `,
    [userId, siteId, normalized],
  );
  return res.rows[0] ?? null;
}

export async function upsertLinkNoteForSiteForUser(args: {
  userId: string;
  siteId: string;
  linkUrl: string;
  note: string;
  status?: LinkNoteStatus;
}): Promise<LinkNote | null> {
  const client = await ensureConnected();
  const normalized = normalizeLinkUrl(args.linkUrl);
  const status = args.status ?? "open";

  const res = await client.query<LinkNote>(
    `
      INSERT INTO link_notes (user_id, site_id, link_url, note, status)
      SELECT $1, $2, $3, $4, $5
      WHERE EXISTS (
        SELECT 1 FROM sites WHERE id = $2 AND user_id = $1
      )
      ON CONFLICT (site_id, link_url)
      DO UPDATE SET
        note = EXCLUDED.note,
        status = EXCLUDED.status,
        updated_at = now(),
        user_id = EXCLUDED.user_id
      RETURNING
        id,
        user_id,
        site_id,
        link_url,
        note,
        status,
        created_at,
        updated_at
    `,
    [args.userId, args.siteId, normalized, args.note, status],
  );

  return res.rows[0] ?? null;
}

export async function updateLinkNoteForSiteForUser(args: {
  userId: string;
  siteId: string;
  linkUrl: string;
  note?: string;
  status?: LinkNoteStatus;
}): Promise<LinkNote | null> {
  const client = await ensureConnected();
  const normalized = normalizeLinkUrl(args.linkUrl);

  const updates: string[] = [];
  const params: Array<string> = [args.userId, args.siteId, normalized];

  if (typeof args.note === "string") {
    params.push(args.note);
    updates.push(`note = $${params.length}`);
  }
  if (args.status) {
    params.push(args.status);
    updates.push(`status = $${params.length}`);
  }

  if (updates.length === 0) {
    return getLinkNoteForSiteByUrlForUser(args.userId, args.siteId, normalized);
  }

  updates.push("updated_at = now()");

  const res = await client.query<LinkNote>(
    `
      UPDATE link_notes n
      SET ${updates.join(", ")}
      FROM sites s
      WHERE n.site_id = s.id
        AND s.user_id = $1
        AND n.site_id = $2
        AND n.link_url = $3
      RETURNING
        n.id,
        n.user_id,
        n.site_id,
        n.link_url,
        n.note,
        n.status,
        n.created_at,
        n.updated_at
    `,
    params,
  );

  return res.rows[0] ?? null;
}

export async function deleteLinkNoteForSiteForUser(
  userId: string,
  siteId: string,
  linkUrl: string,
): Promise<boolean> {
  const client = await ensureConnected();
  const normalized = normalizeLinkUrl(linkUrl);
  const res = await client.query(
    `
      DELETE FROM link_notes n
      USING sites s
      WHERE n.site_id = s.id
        AND s.user_id = $1
        AND n.site_id = $2
        AND n.link_url = $3
    `,
    [userId, siteId, normalized],
  );
  return (res.rowCount ?? 0) > 0;
}
