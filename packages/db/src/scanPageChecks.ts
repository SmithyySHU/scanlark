import { ensureConnected } from "./client";

export interface ScanPageCheckInput {
  scanRunId: string;
  siteId: string;
  pageUrl: string;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  robotsMeta: string | null;
  robotsNoindex: boolean;
  canonicalCount: number;
  canonicalHref: string | null;
}

export interface ScanPageCheckRow extends ScanPageCheckInput {
  id: string;
  fetchedAt: Date;
}

export async function upsertScanPageCheck(
  input: ScanPageCheckInput,
): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO scan_page_checks (
        scan_run_id,
        site_id,
        page_url,
        title,
        meta_description,
        h1_count,
        robots_meta,
        robots_noindex,
        canonical_count,
        canonical_href,
        fetched_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (scan_run_id, page_url)
      DO UPDATE SET
        title = EXCLUDED.title,
        meta_description = EXCLUDED.meta_description,
        h1_count = EXCLUDED.h1_count,
        robots_meta = EXCLUDED.robots_meta,
        robots_noindex = EXCLUDED.robots_noindex,
        canonical_count = EXCLUDED.canonical_count,
        canonical_href = EXCLUDED.canonical_href,
        fetched_at = now()
    `,
    [
      input.scanRunId,
      input.siteId,
      input.pageUrl,
      input.title,
      input.metaDescription,
      input.h1Count,
      input.robotsMeta,
      input.robotsNoindex,
      input.canonicalCount,
      input.canonicalHref,
    ],
  );
}
