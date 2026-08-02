import { ensureConnected } from "./client";
import { getOperationsBusinessCounts } from "./operationsCrm";

export type OperationsSummaryCounts = {
  followUpsDue: number;
  prospectsAwaitingContact: number;
  reportsAwaitingReview: number;
  criticalClientSites: number;
  quotesAwaitingResponse: number;
  openWorkItems: number;
};

export type OperationsMonitoringAttentionItem = {
  id: string;
  kind: "uptime_down" | "scan_failed" | "high_priority_issues";
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  siteId: string | null;
  scanRunId: string | null;
  occurredAt: Date | null;
};

export type OperationsActivityItem = {
  id: string;
  kind:
    | "site_added"
    | "scan_completed"
    | "scan_failed"
    | "report_created"
    | "report_shared"
    | "uptime_alert";
  title: string;
  detail: string;
  href: string;
  occurredAt: Date;
};

export type OperationsSummary = {
  counts: OperationsSummaryCounts;
  monitoringAttention: OperationsMonitoringAttentionItem[];
  recentActivity: OperationsActivityItem[];
  generatedAt: Date;
};

type CountRow = { count: string };

type DownSiteRow = {
  incident_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  check_url: string;
  started_at: Date;
};

type FailedScanRow = {
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  error_message: string | null;
  updated_at: Date;
};

type HighPrioritySiteRow = {
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  scan_run_id: string;
  critical_count: number;
  high_count: number;
  finished_at: Date;
};

type CompletedScanRow = {
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  finished_at: Date;
};

type SharedReportRow = {
  share_id: string;
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  created_at: Date;
};

type SiteAddedRow = {
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  created_at: Date;
};

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function siteLabel(row: {
  site_display_name: string | null;
  site_url: string;
}) {
  return row.site_display_name?.trim() || row.site_url;
}

function dashboardHref(siteId: string) {
  void siteId;
  return "/dashboard?selectSite=1";
}

function reportHref(scanRunId: string) {
  return `/report?scanRunId=${encodeURIComponent(scanRunId)}`;
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const client = await ensureConnected();
  const [
    downSites,
    failedScans,
    highPrioritySites,
    reportReviewCandidates,
    recentCompletedScans,
    recentFailedScans,
    recentShares,
    recentSites,
    highPrioritySiteCount,
    crmCounts,
  ] = await Promise.all([
    client.query<DownSiteRow>(
      `
        SELECT i.id AS incident_id,
               s.site_id,
               site.url AS site_url,
               site.site_display_name,
               s.check_url,
               i.started_at
        FROM uptime_incidents i
        JOIN site_uptime_settings s ON s.id = i.settings_id
        JOIN sites site ON site.id = s.site_id
        WHERE i.status = 'open'
        ORDER BY i.started_at DESC
        LIMIT 5
      `,
    ),
    client.query<FailedScanRow>(
      `
        SELECT r.id AS scan_run_id,
               r.site_id,
               s.url AS site_url,
               s.site_display_name,
               r.error_message,
               r.updated_at
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE r.status = 'failed'
        ORDER BY r.updated_at DESC
        LIMIT 5
      `,
    ),
    client.query<HighPrioritySiteRow>(
      `
        WITH latest_completed AS (
          SELECT DISTINCT ON (r.site_id)
                 r.id,
                 r.site_id,
                 r.finished_at
          FROM scan_runs r
          WHERE r.status = 'completed'
          ORDER BY r.site_id, r.finished_at DESC NULLS LAST, r.started_at DESC
        )
        SELECT lc.site_id,
               s.url AS site_url,
               s.site_display_name,
               lc.id AS scan_run_id,
               COUNT(*) FILTER (WHERE si.severity = 'critical')::int AS critical_count,
               COUNT(*) FILTER (WHERE si.severity = 'high')::int AS high_count,
               lc.finished_at
        FROM latest_completed lc
        JOIN sites s ON s.id = lc.site_id
        JOIN scan_issues si ON si.scan_run_id = lc.id
        WHERE si.status = 'open'
          AND si.severity IN ('critical', 'high')
        GROUP BY lc.site_id, s.url, s.site_display_name, lc.id, lc.finished_at
        ORDER BY critical_count DESC, high_count DESC, lc.finished_at DESC
        LIMIT 5
      `,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM scan_runs r
        WHERE r.status = 'completed'
          AND r.finished_at >= NOW() - INTERVAL '14 days'
      `,
    ),
    client.query<CompletedScanRow>(
      `
        SELECT r.id AS scan_run_id,
               r.site_id,
               s.url AS site_url,
               s.site_display_name,
               r.finished_at
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE r.status = 'completed'
          AND r.finished_at IS NOT NULL
        ORDER BY r.finished_at DESC
        LIMIT 5
      `,
    ),
    client.query<FailedScanRow>(
      `
        SELECT r.id AS scan_run_id,
               r.site_id,
               s.url AS site_url,
               s.site_display_name,
               r.error_message,
               r.updated_at
        FROM scan_runs r
        JOIN sites s ON s.id = r.site_id
        WHERE r.status = 'failed'
        ORDER BY r.updated_at DESC
        LIMIT 5
      `,
    ),
    client.query<SharedReportRow>(
      `
        SELECT rs.id AS share_id,
               rs.scan_run_id,
               rs.site_id,
               s.url AS site_url,
               s.site_display_name,
               rs.created_at
        FROM report_shares rs
        JOIN sites s ON s.id = rs.site_id
        ORDER BY rs.created_at DESC
        LIMIT 5
      `,
    ),
    client.query<SiteAddedRow>(
      `
        SELECT id AS site_id,
               url AS site_url,
               site_display_name,
               created_at
        FROM sites
        ORDER BY created_at DESC
        LIMIT 5
      `,
    ),
    client.query<CountRow>(
      `
        WITH latest_completed AS (
          SELECT DISTINCT ON (r.site_id)
                 r.id,
                 r.site_id
          FROM scan_runs r
          WHERE r.status = 'completed'
          ORDER BY r.site_id, r.finished_at DESC NULLS LAST, r.started_at DESC
        )
        SELECT COUNT(DISTINCT lc.site_id)::text AS count
        FROM latest_completed lc
        JOIN scan_issues si ON si.scan_run_id = lc.id
        WHERE si.status = 'open'
          AND si.severity IN ('critical', 'high')
      `,
    ),
    getOperationsBusinessCounts(),
  ]);

  const monitoringAttention: OperationsMonitoringAttentionItem[] = [
    ...downSites.rows.map((row) => ({
      id: `uptime:${row.incident_id}`,
      kind: "uptime_down" as const,
      severity: "critical" as const,
      title: `${siteLabel(row)} is currently unavailable`,
      detail: `Availability check is failing for ${row.check_url}.`,
      href: dashboardHref(row.site_id),
      siteId: row.site_id,
      scanRunId: null,
      occurredAt: row.started_at,
    })),
    ...highPrioritySites.rows.map((row) => {
      const total = row.critical_count + row.high_count;
      const critical =
        row.critical_count > 0 ? `${row.critical_count} critical` : "";
      const high = row.high_count > 0 ? `${row.high_count} high` : "";
      return {
        id: `issues:${row.scan_run_id}`,
        kind: "high_priority_issues" as const,
        severity:
          row.critical_count > 0 ? ("critical" as const) : ("warning" as const),
        title: `${siteLabel(row)} has ${total} high-priority issue${
          total === 1 ? "" : "s"
        }`,
        detail: [critical, high].filter(Boolean).join(" and "),
        href: reportHref(row.scan_run_id),
        siteId: row.site_id,
        scanRunId: row.scan_run_id,
        occurredAt: row.finished_at,
      };
    }),
    ...failedScans.rows.map((row) => ({
      id: `failed-scan:${row.scan_run_id}`,
      kind: "scan_failed" as const,
      severity: "warning" as const,
      title: `${siteLabel(row)} scan failed`,
      detail: row.error_message ?? "The latest failed scan needs review.",
      href: reportHref(row.scan_run_id),
      siteId: row.site_id,
      scanRunId: row.scan_run_id,
      occurredAt: row.updated_at,
    })),
  ]
    .sort((a, b) => {
      const aTime = a.occurredAt?.getTime() ?? 0;
      const bTime = b.occurredAt?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  const recentActivity: OperationsActivityItem[] = [
    ...recentCompletedScans.rows.map((row) => ({
      id: `scan-completed:${row.scan_run_id}`,
      kind: "scan_completed" as const,
      title: `Scan completed for ${siteLabel(row)}`,
      detail: "A completed report is ready to review.",
      href: reportHref(row.scan_run_id),
      occurredAt: row.finished_at,
    })),
    ...recentFailedScans.rows.map((row) => ({
      id: `scan-failed:${row.scan_run_id}`,
      kind: "scan_failed" as const,
      title: `Scan failed for ${siteLabel(row)}`,
      detail:
        row.error_message ?? "Review the failed scan and retry if needed.",
      href: reportHref(row.scan_run_id),
      occurredAt: row.updated_at,
    })),
    ...recentShares.rows.map((row) => ({
      id: `report-shared:${row.share_id}`,
      kind: "report_shared" as const,
      title: `Report shared for ${siteLabel(row)}`,
      detail: "A client-facing report share link was created.",
      href: reportHref(row.scan_run_id),
      occurredAt: row.created_at,
    })),
    ...recentSites.rows.map((row) => ({
      id: `site-added:${row.site_id}`,
      kind: "site_added" as const,
      title: `${siteLabel(row)} added`,
      detail: "A monitored website was added to Scanlark.",
      href: dashboardHref(row.site_id),
      occurredAt: row.created_at,
    })),
    ...downSites.rows.map((row) => ({
      id: `uptime-alert:${row.incident_id}`,
      kind: "uptime_alert" as const,
      title: `Availability alert for ${siteLabel(row)}`,
      detail: `${row.check_url} is currently down.`,
      href: dashboardHref(row.site_id),
      occurredAt: row.started_at,
    })),
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 10);

  return {
    counts: {
      followUpsDue: crmCounts.followUpsDue,
      prospectsAwaitingContact: crmCounts.prospectsAwaitingContact,
      reportsAwaitingReview: countValue(reportReviewCandidates.rows[0]),
      criticalClientSites: countValue(highPrioritySiteCount.rows[0]),
      quotesAwaitingResponse: 0,
      openWorkItems: crmCounts.openWorkItems,
    },
    monitoringAttention,
    recentActivity,
    generatedAt: new Date(),
  };
}
