import { ensureConnected } from "./client";
import type { ScanIssueCategory, ScanIssueSeverity } from "./scanIssues";

export type ScanCategoryScoreKey =
  | "link_integrity"
  | "seo_basic"
  | "search_engine_access"
  | "ssl_https"
  | "security_setup"
  | "speed_basics";

export type ScanCategoryScoreStatus =
  | "healthy"
  | "needs_attention"
  | "not_checked";

export type ScanScoreBand =
  | "Excellent"
  | "Good"
  | "Needs attention"
  | "Poor"
  | "Critical";

export type SeverityCounts = Record<ScanIssueSeverity, number>;

export interface ScanCategoryScore {
  key: ScanCategoryScoreKey;
  label: string;
  score: number | null;
  band: ScanScoreBand | null;
  status: ScanCategoryScoreStatus;
  findingCount: number;
  severityCounts: SeverityCounts;
  checkCount: number;
  issueCategories: ScanIssueCategory[];
}

const CATEGORY_DEFINITIONS: Array<{
  key: ScanCategoryScoreKey;
  label: string;
  issueCategories: ScanIssueCategory[];
  checkTypes: string[];
}> = [
  {
    key: "link_integrity",
    label: "Broken Links",
    issueCategories: ["link_integrity"],
    checkTypes: [],
  },
  {
    key: "seo_basic",
    label: "SEO Basics",
    issueCategories: ["seo_basic"],
    checkTypes: [],
  },
  {
    key: "search_engine_access",
    label: "Search Engine Access",
    issueCategories: ["robots", "sitemap"],
    checkTypes: ["robots_txt", "sitemap_xml", "sitemap_index_xml"],
  },
  {
    key: "ssl_https",
    label: "SSL & HTTPS",
    issueCategories: ["ssl_https"],
    checkTypes: ["https_root", "http_root", "tls_certificate"],
  },
  {
    key: "security_setup",
    label: "Security Setup",
    issueCategories: ["security_header"],
    checkTypes: ["security_headers_https_root"],
  },
  {
    key: "speed_basics",
    label: "Speed Basics",
    issueCategories: ["performance_basic"],
    checkTypes: ["performance_basic_https_root"],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createEmptySeverityCounts(): SeverityCounts {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
}

export function computeSeverityScore(severityCounts: Record<string, number>) {
  const totalPenalty = clamp(
    Math.min(70, (severityCounts.critical ?? 0) * 25) +
      Math.min(40, (severityCounts.high ?? 0) * 12) +
      Math.min(30, (severityCounts.medium ?? 0) * 6) +
      Math.min(15, (severityCounts.low ?? 0) * 1),
    0,
    100,
  );
  return clamp(Math.round(100 - totalPenalty), 0, 100);
}

export function getScoreBand(score: number): ScanScoreBand {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs attention";
  if (score >= 25) return "Poor";
  return "Critical";
}

export async function getScanCategoryScoresForUser(
  userId: string,
  scanRunId: string,
): Promise<ScanCategoryScore[]> {
  const client = await ensureConnected();

  const [runRes, pageChecksRes, siteChecksRes, issueCountsRes] =
    await Promise.all([
      client.query<{ checked_links: number }>(
        `
          SELECT sr.checked_links
          FROM scan_runs sr
          JOIN sites s ON s.id = sr.site_id
          WHERE sr.id = $1
            AND s.user_id = $2
          LIMIT 1
        `,
        [scanRunId, userId],
      ),
      client.query<{ count: string }>(
        `
          SELECT COUNT(*) AS count
          FROM scan_page_checks pc
          JOIN sites s ON s.id = pc.site_id
          WHERE pc.scan_run_id = $1
            AND s.user_id = $2
        `,
        [scanRunId, userId],
      ),
      client.query<{ check_type: string; count: string }>(
        `
          SELECT sc.check_type, COUNT(*) AS count
          FROM scan_site_checks sc
          JOIN sites s ON s.id = sc.site_id
          WHERE sc.scan_run_id = $1
            AND s.user_id = $2
          GROUP BY sc.check_type
        `,
        [scanRunId, userId],
      ),
      client.query<{
        category: ScanIssueCategory;
        severity: ScanIssueSeverity;
        count: string;
      }>(
        `
          SELECT si.category, si.severity, COUNT(*) AS count
          FROM scan_issues si
          JOIN sites s ON s.id = si.site_id
          WHERE si.scan_run_id = $1
            AND s.user_id = $2
            AND si.status = 'open'
          GROUP BY si.category, si.severity
        `,
        [scanRunId, userId],
      ),
    ]);

  const checkedLinks = Number(runRes.rows[0]?.checked_links ?? 0);
  const pageChecks = Number(pageChecksRes.rows[0]?.count ?? 0);
  const siteCheckCounts = new Map<string, number>();
  for (const row of siteChecksRes.rows) {
    siteCheckCounts.set(row.check_type, Number(row.count));
  }

  const issueCounts = new Map<ScanIssueCategory, SeverityCounts>();
  for (const row of issueCountsRes.rows) {
    const counts = issueCounts.get(row.category) ?? createEmptySeverityCounts();
    counts[row.severity] += Number(row.count);
    issueCounts.set(row.category, counts);
  }

  return CATEGORY_DEFINITIONS.map((definition) => {
    const severityCounts = createEmptySeverityCounts();
    for (const category of definition.issueCategories) {
      const counts = issueCounts.get(category);
      if (!counts) continue;
      severityCounts.critical += counts.critical;
      severityCounts.high += counts.high;
      severityCounts.medium += counts.medium;
      severityCounts.low += counts.low;
      severityCounts.info += counts.info;
    }

    const findingCount =
      severityCounts.critical +
      severityCounts.high +
      severityCounts.medium +
      severityCounts.low +
      severityCounts.info;
    const checkCount =
      definition.key === "link_integrity"
        ? checkedLinks
        : definition.key === "seo_basic"
          ? pageChecks
          : definition.checkTypes.reduce(
              (sum, checkType) => sum + (siteCheckCounts.get(checkType) ?? 0),
              0,
            );

    if (checkCount <= 0) {
      return {
        key: definition.key,
        label: definition.label,
        score: null,
        band: null,
        status: "not_checked",
        findingCount,
        severityCounts,
        checkCount,
        issueCategories: definition.issueCategories,
      };
    }

    const score = computeSeverityScore(severityCounts);
    return {
      key: definition.key,
      label: definition.label,
      score,
      band: getScoreBand(score),
      status: findingCount > 0 ? "needs_attention" : "healthy",
      findingCount,
      severityCounts,
      checkCount,
      issueCategories: definition.issueCategories,
    };
  });
}
