import { ensureConnected } from "./client";

export type ScanSiteCheckType =
  | "robots_txt"
  | "sitemap_xml"
  | "sitemap_index_xml"
  | "https_root"
  | "http_root"
  | "tls_certificate"
  | "security_headers_https_root"
  | "performance_basic_https_root";

export interface ScanSiteCheckInput {
  scanRunId: string;
  siteId: string;
  checkType: ScanSiteCheckType;
  targetUrl: string;
  statusCode: number | null;
  ok: boolean;
  errorMessage: string | null;
  contentType: string | null;
  contentSizeBytes: number | null;
  factsJson?: Record<string, unknown>;
}

export interface ScanSiteCheckRow extends ScanSiteCheckInput {
  id: string;
  checkedAt: Date;
}

export async function listScanSiteCheckTypesForRun(
  scanRunId: string,
): Promise<ScanSiteCheckType[]> {
  const client = await ensureConnected();
  const res = await client.query<{ check_type: ScanSiteCheckType }>(
    `
      SELECT check_type
      FROM scan_site_checks
      WHERE scan_run_id = $1
    `,
    [scanRunId],
  );
  return res.rows.map((row) => row.check_type);
}

export async function upsertScanSiteCheck(
  input: ScanSiteCheckInput,
): Promise<void> {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO scan_site_checks (
        scan_run_id,
        site_id,
        check_type,
        target_url,
        status_code,
        ok,
        error_message,
        content_type,
        content_size_bytes,
        facts_json,
        checked_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
      ON CONFLICT (scan_run_id, check_type, target_url)
      DO UPDATE SET
        status_code = EXCLUDED.status_code,
        ok = EXCLUDED.ok,
        error_message = EXCLUDED.error_message,
        content_type = EXCLUDED.content_type,
        content_size_bytes = EXCLUDED.content_size_bytes,
        facts_json = EXCLUDED.facts_json,
        checked_at = now()
    `,
    [
      input.scanRunId,
      input.siteId,
      input.checkType,
      input.targetUrl,
      input.statusCode,
      input.ok,
      input.errorMessage,
      input.contentType,
      input.contentSizeBytes,
      input.factsJson ?? {},
    ],
  );
}
