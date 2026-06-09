import crypto from "crypto";
import { ensureConnected } from "./client";
import type { ScanRunRow } from "./scans";

export type ReportShareRow = {
  id: string;
  scan_run_id: string;
  site_id: string;
  created_by_user_id: string;
  token_hash: string;
  enabled: boolean;
  created_at: Date;
  disabled_at: Date | null;
  last_viewed_at: Date | null;
  view_count: number;
};

export type ReportShareWithToken = ReportShareRow & {
  shareToken: string;
};

export type CreatedReportShareResult =
  | {
      share: ReportShareRow;
      created: true;
      shareToken: string;
    }
  | {
      share: ReportShareRow;
      created: false;
      shareToken: null;
    };

export type SharedReportAccess = {
  share: ReportShareRow;
  run: ScanRunRow;
};

type SharedAccessRow = ScanRunRow & {
  share_id: string;
  share_scan_run_id: string;
  share_site_id: string;
  share_created_by_user_id: string;
  share_token_hash: string;
  share_enabled: boolean;
  share_created_at: Date;
  share_disabled_at: Date | null;
  share_last_viewed_at: Date | null;
  share_view_count: number;
};

function getShareSecret() {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const isProductionLike = nodeEnv !== "development" && nodeEnv !== "test";
  const explicitSecret = process.env.REPORT_SHARE_TOKEN_SECRET?.trim();
  if (explicitSecret) return explicitSecret;
  if (isProductionLike) {
    throw new Error(
      "REPORT_SHARE_TOKEN_SECRET is required in production-like mode",
    );
  }
  return (
    process.env.SESSION_SECRET ??
    process.env.API_INTERNAL_TOKEN ??
    "scanlark-report-share-dev-secret"
  );
}

function buildShareToken(shareId: string) {
  const signature = crypto
    .createHmac("sha256", getShareSecret())
    .update(shareId)
    .digest("base64url");
  return `sr_${shareId.replace(/-/g, "")}.${signature}`;
}

function hashShareToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function withToken(row: ReportShareRow): ReportShareWithToken {
  return {
    ...row,
    shareToken: buildShareToken(row.id),
  };
}

async function getOwnedRun(
  userId: string,
  scanRunId: string,
): Promise<ScanRunRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ScanRunRow>(
    `
      SELECT
        r.id,
        r.site_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.notified_at,
        r.error_message,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.issue_generation_status,
        r.issue_generation_error
      FROM scan_runs r
      JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1
        AND s.user_id = $2
      LIMIT 1
    `,
    [scanRunId, userId],
  );
  return res.rows[0] ?? null;
}

export async function getReportShareForRunForUser(
  userId: string,
  scanRunId: string,
): Promise<ReportShareRow | null> {
  const run = await getOwnedRun(userId, scanRunId);
  if (!run) throw new Error("scan_run_not_found");

  const client = await ensureConnected();
  const res = await client.query<ReportShareRow>(
    `
      SELECT rs.*
      FROM report_shares rs
      WHERE rs.scan_run_id = $1
        AND rs.enabled = true
      ORDER BY rs.created_at DESC
      LIMIT 1
    `,
    [scanRunId],
  );
  return res.rows[0] ?? null;
}

export async function createOrRotateReportShareForRunForUser(
  userId: string,
  scanRunId: string,
): Promise<CreatedReportShareResult> {
  const run = await getOwnedRun(userId, scanRunId);
  if (!run) throw new Error("scan_run_not_found");
  if (run.status !== "completed") throw new Error("scan_run_not_shareable");

  const client = await ensureConnected();
  const activeRes = await client.query<ReportShareRow>(
    `
      SELECT rs.*
      FROM report_shares rs
      WHERE rs.scan_run_id = $1
        AND rs.enabled = true
      ORDER BY rs.created_at DESC
      LIMIT 1
    `,
    [scanRunId],
  );
  const active = activeRes.rows[0] ?? null;
  if (active) {
    return {
      share: active,
      created: false,
      shareToken: null,
    };
  }

  const shareId = crypto.randomUUID();
  const shareToken = buildShareToken(shareId);
  const tokenHash = hashShareToken(shareToken);
  const insertRes = await client.query<ReportShareRow>(
    `
      INSERT INTO report_shares (
        id,
        scan_run_id,
        site_id,
        created_by_user_id,
        token_hash,
        enabled
      )
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `,
    [shareId, run.id, run.site_id, userId, tokenHash],
  );
  return {
    share: insertRes.rows[0],
    created: true,
    shareToken,
  };
}

export async function disableReportShareForRunForUser(
  userId: string,
  scanRunId: string,
): Promise<boolean> {
  const run = await getOwnedRun(userId, scanRunId);
  if (!run) throw new Error("scan_run_not_found");

  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      UPDATE report_shares
      SET enabled = false,
          disabled_at = now()
      WHERE scan_run_id = $1
        AND enabled = true
      RETURNING id
    `,
    [scanRunId],
  );
  return res.rows.length > 0;
}

export async function getSharedReportAccessByToken(
  token: string,
): Promise<SharedReportAccess | null> {
  const client = await ensureConnected();
  const tokenHash = hashShareToken(token);
  const res = await client.query<SharedAccessRow>(
    `
      SELECT
        rs.id AS share_id,
        rs.scan_run_id AS share_scan_run_id,
        rs.site_id AS share_site_id,
        rs.created_by_user_id AS share_created_by_user_id,
        rs.token_hash AS share_token_hash,
        rs.enabled AS share_enabled,
        rs.created_at AS share_created_at,
        rs.disabled_at AS share_disabled_at,
        rs.last_viewed_at AS share_last_viewed_at,
        rs.view_count AS share_view_count,
        r.id,
        r.site_id,
        r.status,
        r.started_at,
        r.finished_at,
        r.notified_at,
        r.error_message,
        r.updated_at,
        r.start_url,
        r.total_links,
        r.checked_links,
        r.broken_links,
        r.trigger_type,
        r.issue_generation_status,
        r.issue_generation_error
      FROM report_shares rs
      JOIN scan_runs r ON r.id = rs.scan_run_id
      WHERE rs.token_hash = $1
        AND rs.enabled = true
        AND r.status = 'completed'
      LIMIT 1
    `,
    [tokenHash],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    share: {
      id: row.share_id,
      scan_run_id: row.share_scan_run_id,
      site_id: row.share_site_id,
      created_by_user_id: row.share_created_by_user_id,
      token_hash: row.share_token_hash,
      enabled: row.share_enabled,
      created_at: row.share_created_at,
      disabled_at: row.share_disabled_at,
      last_viewed_at: row.share_last_viewed_at,
      view_count: row.share_view_count,
    },
    run: {
      id: row.id,
      site_id: row.site_id,
      status: row.status,
      started_at: row.started_at,
      finished_at: row.finished_at,
      notified_at: row.notified_at,
      error_message: row.error_message,
      updated_at: row.updated_at,
      start_url: row.start_url,
      total_links: row.total_links,
      checked_links: row.checked_links,
      broken_links: row.broken_links,
      trigger_type: row.trigger_type,
      issue_generation_status: row.issue_generation_status,
      issue_generation_error: row.issue_generation_error,
    },
  };
}

export async function recordReportShareView(
  shareId: string,
): Promise<ReportShareRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ReportShareRow>(
    `
      UPDATE report_shares
      SET view_count = view_count + 1,
          last_viewed_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [shareId],
  );
  return res.rows[0] ?? null;
}
