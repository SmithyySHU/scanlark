import { chromium, type Browser } from "playwright";
import {
  formatSiteChangeCategoryLabel,
  formatSiteChangeImportanceLabel,
  formatIssuePresentation,
  getSiteById,
  getSiteByIdForUser,
  getScanCategoryScores,
  getScanCategoryScoresForUser,
  getSiteChangeEvents,
  getScanLinksSummary,
  getScanLinksSummaryForUser,
  getScanTechnicalDiagnostics,
  getScanTechnicalDiagnosticsForUser,
  getTimeoutCountForRun,
  getTimeoutCountForRunForUser,
  getTopLinksByClassification,
  getTopLinksByClassificationForUser,
  listIgnoredLinksForRun,
  listIgnoredLinksForRunForUser,
  listIssuesForScanRun,
  listIssuesForScanRunForUser,
  type DbSiteRow,
  type LinkClassification,
  type ResolvedScanIssue,
  type ScanCategoryScore,
  type ScanCategoryScoreKey,
  type ScanIssue,
  type ScanIssueCategory,
  type ScanIssueSeverity,
  type ScanIssuesSummary,
  type ScanRunRow,
  type SiteChangeEventCategory,
  type SiteChangeEventRow,
  type SiteChangeSummary,
  type ScanTechnicalDiagnosticsSummary,
} from "@scanlark/db";

type SerializedIssuePresentation = ReturnType<typeof formatIssuePresentation>;
type LinkSummaryRow = Awaited<ReturnType<typeof getScanLinksSummary>>;
type ScanLinkSummaryRow = LinkSummaryRow[number];
type TopLinkRow = Awaited<
  ReturnType<typeof getTopLinksByClassification>
>[number];

type IssueWithPresentation = (ScanIssue | ResolvedScanIssue) & {
  presentation: SerializedIssuePresentation;
};

type ScoreBand = "Excellent" | "Good" | "Needs attention" | "Poor" | "Critical";

type ReportScoreCard = {
  score: number | null;
  band: ScoreBand | null;
  detail: string;
};

type ReportScores = {
  overall: ReportScoreCard;
  linkIntegrity: ReportScoreCard;
  summary: string;
};

type ReportSummaryCounts = Record<LinkClassification, number>;

type ReportPdfSiteMetadata = Pick<
  DbSiteRow,
  "site_display_name" | "client_name" | "report_display_name"
>;

export type ReportPdfDocument = {
  fileName: string;
  title: string;
  generatedAt: string;
  host: string;
  displayTitle: string;
  clientName: string | null;
  run: ScanRunRow;
  summaryRows: ScanLinkSummaryRow[];
  summaryCounts: ReportSummaryCounts;
  ignoredTotal: number;
  timeoutCount: number;
  issuesSummary: ScanIssuesSummary;
  categorySummaries: Partial<Record<ScanIssueCategory, ScanIssuesSummary>>;
  categoryScores: ScanCategoryScore[];
  technicalDiagnostics: ScanTechnicalDiagnosticsSummary;
  scores: ReportScores;
  websiteChangesSummary: SiteChangeSummary;
  websiteChanges: SiteChangeEventRow[];
  topPriorityIssues: IssueWithPresentation[];
  resolvedIssues: IssueWithPresentation[];
  topLinks: Record<"broken" | "blocked" | "no_response", TopLinkRow[]>;
};

const PDF_BROKEN_LINK_LIMIT = 25;
const PDF_BLOCKED_LINK_LIMIT = 10;
const PDF_NO_RESPONSE_LINK_LIMIT = 25;
const PDF_OPEN_ISSUE_LIMIT = 200;
const PDF_RESOLVED_ISSUE_LIMIT = 20;
const PDF_URL_DISPLAY_MAX_LENGTH = 48;
const PDF_WEBSITE_CHANGE_LIMIT = 8;
const PDF_CATEGORIES: Array<{
  key: ScanCategoryScoreKey;
  label: string;
}> = [
  { key: "link_integrity", label: "Broken Links" },
  { key: "seo_basic", label: "SEO Basics" },
  { key: "search_engine_access", label: "Search Engine Access" },
  { key: "ssl_https", label: "SSL & HTTPS" },
  { key: "security_setup", label: "Security Setup" },
  { key: "speed_basics", label: "Speed Basics" },
];
const ISSUE_CATEGORIES: ScanIssueCategory[] = [
  "link_integrity",
  "seo_basic",
  "robots",
  "sitemap",
  "ssl_https",
  "security_header",
  "performance_basic",
];

let browserPromise: Promise<Browser> | null = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getScoreBand(score: number): ScoreBand {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs attention";
  if (score >= 25) return "Poor";
  return "Critical";
}

function buildScoreSummarySentence(
  score: number | null,
  severityCounts: Record<ScanIssueSeverity, number>,
) {
  if (score == null) {
    return "This score will be calculated when enough scan data is available.";
  }

  if ((severityCounts.critical ?? 0) > 0 || (severityCounts.high ?? 0) > 0) {
    if (score >= 75) {
      return "This scan found some high-impact link issues, but overall integrity is still holding up.";
    }
    if (score >= 25) {
      return "This scan found high-impact link issues that need attention.";
    }
    return "This scan found severe link-integrity problems that need urgent attention.";
  }

  if ((severityCounts.medium ?? 0) > 0) {
    if (score >= 75) {
      return "This scan found a few moderate link issues, but overall integrity remains solid.";
    }
    return "This scan found multiple link issues that should be reviewed.";
  }

  if ((severityCounts.low ?? 0) > 0 || (severityCounts.info ?? 0) > 0) {
    return "This scan is mostly healthy, with minor issues or intentional safety skips recorded.";
  }

  return "This scan did not generate any link-integrity issues.";
}

function calculateReportScores(
  run: ScanRunRow,
  overallIssueSummary: ScanIssuesSummary,
  linkIntegrityIssueSummary: ScanIssuesSummary | null,
): ReportScores {
  const overallSeverityCounts: Record<ScanIssueSeverity, number> = {
    critical: overallIssueSummary.bySeverity.critical ?? 0,
    high: overallIssueSummary.bySeverity.high ?? 0,
    medium: overallIssueSummary.bySeverity.medium ?? 0,
    low: overallIssueSummary.bySeverity.low ?? 0,
    info: overallIssueSummary.bySeverity.info ?? 0,
  };
  const linkSeverityCounts: Record<ScanIssueSeverity, number> = {
    critical: linkIntegrityIssueSummary?.bySeverity.critical ?? 0,
    high: linkIntegrityIssueSummary?.bySeverity.high ?? 0,
    medium: linkIntegrityIssueSummary?.bySeverity.medium ?? 0,
    low: linkIntegrityIssueSummary?.bySeverity.low ?? 0,
    info: linkIntegrityIssueSummary?.bySeverity.info ?? 0,
  };

  const checkedLinks = run.checked_links ?? 0;
  if (checkedLinks <= 0) {
    return {
      overall: { score: null, band: null, detail: "Not available" },
      linkIntegrity: { score: null, band: null, detail: "Not available" },
      summary:
        "This score is not available because this run did not record checked links.",
    };
  }

  const computeScore = (severityCounts: Record<ScanIssueSeverity, number>) => {
    const totalPenalty = clamp(
      Math.min(70, severityCounts.critical * 25) +
        Math.min(40, severityCounts.high * 12) +
        Math.min(30, severityCounts.medium * 6) +
        Math.min(15, severityCounts.low * 1),
      0,
      100,
    );
    const score = clamp(Math.round(100 - totalPenalty), 0, 100);
    return { score, band: getScoreBand(score) };
  };

  const overallComputed = computeScore(overallSeverityCounts);
  const linkComputed = computeScore(linkSeverityCounts);
  const summary = buildScoreSummarySentence(
    overallComputed.score,
    overallSeverityCounts,
  );

  return {
    overall: {
      score: overallComputed.score,
      band: overallComputed.band,
      detail: "Currently based on issue findings from this scan",
    },
    linkIntegrity: {
      score: linkComputed.score,
      band: linkComputed.band,
      detail: "Currently based on link integrity findings from this scan",
    },
    summary,
  };
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function getReportDisplayTitle(
  run: ScanRunRow,
  site: ReportPdfSiteMetadata | null,
) {
  const reportDisplayName = site?.report_display_name?.trim();
  if (reportDisplayName) return reportDisplayName;
  const siteDisplayName = site?.site_display_name?.trim();
  if (siteDisplayName) return siteDisplayName;
  return safeHost(run.start_url);
}

function sanitizeFilenameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildFileName(run: ScanRunRow) {
  const dateStamp = formatDateOnly(run.finished_at ?? run.started_at);
  const host = sanitizeFilenameSegment(safeHost(run.start_url));
  if (host && host !== "unknown") {
    return `scanlark-report-${host}-${dateStamp}.pdf`;
  }
  return `scanlark-report-scan-${run.id.slice(0, 8)}-${dateStamp}.pdf`;
}

function formatDateTime(value: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateOnly(value: Date | string | null) {
  if (!value) return "unknown-date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown-date";
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatIssueCategoryLabel(category: ScanIssueCategory) {
  if (category === "seo_basic") return "SEO Basics";
  if (category === "link_integrity") return "Link Integrity";
  if (category === "ssl_https") return "SSL / HTTPS";
  if (category === "security_header") return "Security Setup";
  if (category === "robots") return "Robots.txt";
  if (category === "sitemap") return "Sitemap";
  if (category === "performance_basic") return "Speed Basics";
  return String(category).replace(/_/g, " ");
}

function formatSeverity(value: ScanIssueSeverity) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatUrlDisplay(url: string, maxLength = PDF_URL_DISPLAY_MAX_LENGTH) {
  if (url.length <= maxLength) return url;

  try {
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.hostname}`;
    const tailSource =
      `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
    const reserved = origin.length + 3;
    const remaining = maxLength - reserved;

    if (remaining <= 12) {
      return `${url.slice(0, maxLength - 3)}...`;
    }

    const headLength = Math.max(10, Math.floor(remaining * 0.55));
    const tailLength = Math.max(8, remaining - headLength);
    return `${origin}${tailSource.slice(0, headLength)}...${tailSource.slice(-tailLength)}`;
  } catch {
    const startLength = Math.max(20, Math.floor(maxLength * 0.58));
    const endLength = Math.max(10, maxLength - startLength - 3);
    return `${url.slice(0, startLength)}...${url.slice(-endLength)}`;
  }
}

function getPdfLinkLimit(classification: "broken" | "blocked" | "no_response") {
  if (classification === "blocked") return PDF_BLOCKED_LINK_LIMIT;
  if (classification === "no_response") return PDF_NO_RESPONSE_LINK_LIMIT;
  return PDF_BROKEN_LINK_LIMIT;
}

function getPdfCategoryStatusLabel(score: ScanCategoryScore | null) {
  if (!score) return "Not checked";
  if (score.status === "healthy") return "Healthy";
  if (
    score.status === "needs_attention" &&
    score.score != null &&
    score.score > 90 &&
    (score.severityCounts.critical ?? 0) === 0 &&
    (score.severityCounts.high ?? 0) === 0
  ) {
    return "Minor findings";
  }
  if (score.status === "needs_attention") return "Needs attention";
  return "Not checked";
}

function summarizeReportClassifications(
  rows: ScanLinkSummaryRow[],
): ReportSummaryCounts {
  return rows.reduce<ReportSummaryCounts>(
    (acc, row) => {
      acc[row.classification] += row.count;
      return acc;
    },
    { ok: 0, broken: 0, blocked: 0, no_response: 0 },
  );
}

function withPresentation<T extends ScanIssue | ResolvedScanIssue>(issue: T) {
  return {
    ...issue,
    presentation: formatIssuePresentation(issue),
  };
}

function sortPriorityIssues(a: ScanIssue, b: ScanIssue) {
  const severityRank = (severity: ScanIssueSeverity) => {
    if (severity === "critical") return 0;
    if (severity === "high") return 1;
    if (severity === "medium") return 2;
    if (severity === "low") return 3;
    return 4;
  };
  const changeRank = (changeStatus: ScanIssue["change_status"]) => {
    if (changeStatus === "new") return 0;
    if (changeStatus === "existing") return 1;
    return 2;
  };
  const severityDiff = severityRank(a.severity) - severityRank(b.severity);
  if (severityDiff !== 0) return severityDiff;
  const changeDiff = changeRank(a.change_status) - changeRank(b.change_status);
  if (changeDiff !== 0) return changeDiff;
  return (
    new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime()
  );
}

async function buildDocument(
  run: ScanRunRow,
  site: ReportPdfSiteMetadata | null,
  readers: {
    getSummary(): Promise<ScanLinkSummaryRow[]>;
    getIgnoredTotal(): Promise<number>;
    getTimeoutCount(): Promise<number>;
    getIssues(): Promise<Awaited<ReturnType<typeof listIssuesForScanRun>>>;
    getWebsiteChanges(): Promise<
      Awaited<ReturnType<typeof getSiteChangeEvents>>
    >;
    getCategorySummary(category: ScanIssueCategory): Promise<ScanIssuesSummary>;
    getCategoryScores(): Promise<ScanCategoryScore[]>;
    getDiagnostics(): Promise<ScanTechnicalDiagnosticsSummary>;
    getTopLinks(
      classification: "broken" | "blocked" | "no_response",
    ): Promise<TopLinkRow[]>;
  },
) {
  const [
    summaryRows,
    ignoredTotal,
    timeoutCount,
    issuesResult,
    websiteChangesResult,
    categoryScores,
    diagnostics,
    brokenLinks,
    blockedLinks,
    noResponseLinks,
    ...categorySummariesList
  ] = await Promise.all([
    readers.getSummary(),
    readers.getIgnoredTotal(),
    readers.getTimeoutCount(),
    readers.getIssues(),
    readers.getWebsiteChanges(),
    readers.getCategoryScores(),
    readers.getDiagnostics(),
    readers.getTopLinks("broken"),
    readers.getTopLinks("blocked"),
    readers.getTopLinks("no_response"),
    ...ISSUE_CATEGORIES.map((category) => readers.getCategorySummary(category)),
  ]);

  const categorySummaries: Partial<
    Record<ScanIssueCategory, ScanIssuesSummary>
  > = {};
  ISSUE_CATEGORIES.forEach((category, index) => {
    categorySummaries[category] = categorySummariesList[index];
  });

  const summaryCounts = summarizeReportClassifications(summaryRows);
  const linkIntegritySummary = categorySummaries.link_integrity ?? null;
  const scores = calculateReportScores(
    run,
    issuesResult.summary,
    linkIntegritySummary,
  );
  const topPriorityIssues = issuesResult.issues
    .slice()
    .sort(sortPriorityIssues)
    .slice(0, 4)
    .map(withPresentation);
  const resolvedIssues = issuesResult.resolvedIssues
    .slice(0, PDF_RESOLVED_ISSUE_LIMIT)
    .map(withPresentation);
  const displayTitle = getReportDisplayTitle(run, site);
  const clientName = site?.client_name?.trim() || null;

  return {
    fileName: buildFileName(run),
    title: `Scanlark Report for ${displayTitle}`,
    generatedAt: new Date().toISOString(),
    host: safeHost(run.start_url),
    displayTitle,
    clientName,
    run,
    summaryRows,
    summaryCounts,
    ignoredTotal,
    timeoutCount,
    issuesSummary: issuesResult.summary,
    categorySummaries,
    categoryScores,
    technicalDiagnostics: diagnostics,
    scores,
    websiteChangesSummary: websiteChangesResult.summary,
    websiteChanges: websiteChangesResult.changes.slice(
      0,
      PDF_WEBSITE_CHANGE_LIMIT,
    ),
    topPriorityIssues,
    resolvedIssues,
    topLinks: {
      broken: brokenLinks,
      blocked: blockedLinks,
      no_response: noResponseLinks,
    },
  } satisfies ReportPdfDocument;
}

export async function buildReportPdfDocumentForUser(
  userId: string,
  run: ScanRunRow,
) {
  const site = await getSiteByIdForUser(userId, run.site_id);
  return buildDocument(run, site, {
    getSummary: () => getScanLinksSummaryForUser(userId, run.id),
    getIgnoredTotal: async () =>
      (await listIgnoredLinksForRunForUser(userId, run.id, 1, 0)).totalMatching,
    getTimeoutCount: () => getTimeoutCountForRunForUser(userId, run.id),
    getIssues: () =>
      listIssuesForScanRunForUser(userId, run.id, {
        limit: PDF_OPEN_ISSUE_LIMIT,
        offset: 0,
      }),
    getWebsiteChanges: () => getSiteChangeEvents(run.id),
    getCategorySummary: async (category) =>
      (
        await listIssuesForScanRunForUser(userId, run.id, {
          category,
          limit: 1,
          offset: 0,
        })
      ).summary,
    getCategoryScores: () => getScanCategoryScoresForUser(userId, run.id),
    getDiagnostics: () => getScanTechnicalDiagnosticsForUser(userId, run.id),
    getTopLinks: (classification) =>
      getTopLinksByClassificationForUser(
        userId,
        run.id,
        classification,
        getPdfLinkLimit(classification),
      ),
  });
}

export async function buildReportPdfDocumentForSharedRun(run: ScanRunRow) {
  const site = await getSiteById(run.site_id);
  return buildDocument(run, site, {
    getSummary: () => getScanLinksSummary(run.id),
    getIgnoredTotal: async () =>
      (await listIgnoredLinksForRun(run.id, 1, 0)).totalMatching,
    getTimeoutCount: () => getTimeoutCountForRun(run.id),
    getIssues: () =>
      listIssuesForScanRun(run.id, {
        limit: PDF_OPEN_ISSUE_LIMIT,
        offset: 0,
      }),
    getWebsiteChanges: () => getSiteChangeEvents(run.id),
    getCategorySummary: async (category) =>
      (
        await listIssuesForScanRun(run.id, {
          category,
          limit: 1,
          offset: 0,
        })
      ).summary,
    getCategoryScores: () => getScanCategoryScores(run.id),
    getDiagnostics: () => getScanTechnicalDiagnostics(run.id),
    getTopLinks: (classification) =>
      getTopLinksByClassification(
        run.id,
        classification,
        getPdfLinkLimit(classification),
      ),
  });
}

function renderMetricCard(
  label: string,
  value: string | number,
  hint?: string,
) {
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      ${hint ? `<div class="metric-hint">${escapeHtml(hint)}</div>` : ""}
    </div>
  `;
}

function renderIssueCard(issue: IssueWithPresentation) {
  return `
    <article class="issue-card">
      <div class="issue-card__header">
        <div>
          <div class="issue-title">${escapeHtml(issue.presentation.userTitle)}</div>
          <div class="issue-meta">
            <span>${escapeHtml(formatSeverity(issue.severity))}</span>
            <span>${escapeHtml(formatIssueCategoryLabel(issue.category))}</span>
            <span>${escapeHtml(issue.change_status ?? "open")}</span>
          </div>
        </div>
        <div class="issue-url">${escapeHtml(issue.affected_url)}</div>
      </div>
      <div class="issue-copy">${escapeHtml(issue.presentation.shortSummary)}</div>
      <div class="issue-detail">
        <div><strong>What it means:</strong> ${escapeHtml(issue.presentation.whatItMeans)}</div>
        <div><strong>Why it matters:</strong> ${escapeHtml(issue.presentation.whyItMatters)}</div>
        <div><strong>Next step:</strong> ${escapeHtml(issue.presentation.suggestedFix)}</div>
      </div>
    </article>
  `;
}

function renderTable(headers: string[], rows: string[][], emptyText: string) {
  if (rows.length === 0) {
    return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  }
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) =>
              `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderSectionTable(
  headers: string[],
  rows: string[][],
  emptyText: string,
  options?: {
    leadContentHtml?: string;
    sectionClassName?: string;
  },
) {
  const leadContentHtml = options?.leadContentHtml ?? "";
  const sectionClassName = options?.sectionClassName ?? "";

  return `
    <div class="section-table ${escapeHtml(sectionClassName)}">
      ${leadContentHtml}
      ${renderTable(headers, rows, emptyText)}
    </div>
  `;
}

function renderLinkEvidenceSection(title: string, rows: TopLinkRow[]) {
  const renderedRows = rows.map((row) => [
    `<div class="cell-url" title="${escapeHtml(row.link_url)}">${escapeHtml(
      formatUrlDisplay(row.link_url),
    )}</div>`,
    escapeHtml(row.occurrence_count),
    escapeHtml(
      row.status_code == null
        ? row.error_message === "timeout"
          ? "Timeout"
          : "No response"
        : row.status_code,
    ),
    escapeHtml(formatDateTime(row.last_seen_at)),
  ]);

  return `
    <section class="section">
      ${renderSectionTable(
        ["URL", "Occurrences", "Status", "Last seen"],
        renderedRows,
        `No ${title.toLowerCase()} were captured for this run.`,
        {
          leadContentHtml: `
            <div class="section-heading-group">
              <div class="section-heading">
                <h2>${escapeHtml(title)}</h2>
              </div>
            </div>
          `,
        },
      )}
    </section>
  `;
}

function renderTopPrioritySection(document: ReportPdfDocument) {
  const intro =
    document.topPriorityIssues.length > 0
      ? renderIssueCard(document.topPriorityIssues[0])
      : `<div class="empty-state">No high-priority issues were recorded for this run.</div>`;
  const remaining =
    document.topPriorityIssues.length > 1
      ? document.topPriorityIssues.slice(1).map(renderIssueCard).join("")
      : "";

  return `
    <section class="section">
      <div class="section-heading-group section-lead">
        <div class="section-heading"><h2>Top Priority Issues</h2></div>
        <div class="section-copy">
          Highest-severity issues from this scan, ordered for action.
        </div>
        ${intro}
      </div>
      ${remaining ? `<div class="issue-grid issue-grid--rest">${remaining}</div>` : ""}
    </section>
  `;
}

function renderWebsiteChangesSection(document: ReportPdfDocument) {
  if (
    document.websiteChangesSummary.total === 0 &&
    !document.websiteChangesSummary.highPriorityCount
  ) {
    return `
      <section class="section">
        <div class="section-heading-group">
          <div class="section-heading"><h2>Website Changes</h2></div>
          <div class="section-copy">
            No structured website changes were recorded between this scan and the previous completed scan.
          </div>
        </div>
      </section>
    `;
  }

  const categoryRows = Object.entries(document.websiteChangesSummary.byCategory)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => [
      escapeHtml(
        formatSiteChangeCategoryLabel(category as SiteChangeEventCategory),
      ),
      escapeHtml(count),
    ]);

  const changeItems = document.websiteChanges
    .map(
      (event) => `
        <div class="change-item">
          <div class="change-item__top">
            <span class="change-pill change-pill--${escapeHtml(event.importance)}">${escapeHtml(
              formatSiteChangeImportanceLabel(event.importance),
            )}</span>
            <span class="change-pill">${escapeHtml(
              formatSiteChangeCategoryLabel(event.category),
            )}</span>
          </div>
          <div class="change-item__summary">${escapeHtml(event.summary)}</div>
          ${
            event.subject_url
              ? `<div class="change-item__url">${escapeHtml(
                  formatUrlDisplay(event.subject_url),
                )}</div>`
              : ""
          }
        </div>
      `,
    )
    .join("");

  return `
    <section class="section">
      <div class="section-heading-group">
        <div class="section-heading"><h2>Website Changes</h2></div>
        <div class="section-copy">
          Structured changes detected between this scan and the previous completed scan.
        </div>
      </div>
      <div class="grid metrics metrics--changes">
        ${renderMetricCard("Total changes", document.websiteChangesSummary.total)}
        ${renderMetricCard(
          "High priority",
          document.websiteChangesSummary.highPriorityCount,
        )}
        ${renderMetricCard("Medium", document.websiteChangesSummary.byImportance.medium)}
        ${renderMetricCard("Low / info", document.websiteChangesSummary.byImportance.low + document.websiteChangesSummary.byImportance.info)}
      </div>
      <div class="website-change-grid">
        <div class="website-change-card">
          <div class="table-card-title">By category</div>
          ${renderTable(["Category", "Count"], categoryRows, "No category changes were recorded.")}
        </div>
        <div class="website-change-card">
          <div class="table-card-title">Highlights</div>
          ${changeItems || `<div class="empty-state">No change highlights were recorded.</div>`}
        </div>
      </div>
    </section>
  `;
}

export function renderReportPdfHtml(document: ReportPdfDocument) {
  const categoryScoresByKey = new Map(
    document.categoryScores.map((score) => [score.key, score]),
  );
  const highPriorityCount =
    (document.issuesSummary.bySeverity.critical ?? 0) +
    (document.issuesSummary.bySeverity.high ?? 0);
  const resolvedCount = document.issuesSummary.byChangeStatus.resolved ?? 0;
  const scanDate = formatDateTime(
    document.run.finished_at ?? document.run.started_at,
  );

  const categoryScoreRows = PDF_CATEGORIES.map(({ key, label }) => {
    const score = categoryScoresByKey.get(key) ?? null;
    const scoreValue = score?.score == null ? "N/A" : `${score.score}%`;
    const status = getPdfCategoryStatusLabel(score);
    const detail = score
      ? `${score.findingCount} findings across ${score.checkCount} checks`
      : "No score payload available";
    return [
      escapeHtml(label),
      escapeHtml(scoreValue),
      escapeHtml(status),
      escapeHtml(detail),
    ];
  });

  const issueSummaryRows = ISSUE_CATEGORIES.map((category) => {
    const summary = document.categorySummaries[category];
    return [
      escapeHtml(formatIssueCategoryLabel(category)),
      escapeHtml(summary?.total ?? 0),
      escapeHtml(summary?.bySeverity.critical ?? 0),
      escapeHtml(summary?.bySeverity.high ?? 0),
      escapeHtml(summary?.bySeverity.medium ?? 0),
      escapeHtml(summary?.bySeverity.low ?? 0),
      escapeHtml(summary?.bySeverity.info ?? 0),
    ];
  });

  const resolvedRows = document.resolvedIssues.map((issue) => [
    `<div class="cell-tight"><strong>${escapeHtml(
      issue.presentation.userTitle,
    )}</strong><br><span class="muted">${escapeHtml(
      issue.presentation.shortSummary,
    )}</span></div>`,
    escapeHtml(formatIssueCategoryLabel(issue.category)),
    escapeHtml(formatSeverity(issue.severity)),
    `<div class="cell-url" title="${escapeHtml(issue.affected_url)}">${escapeHtml(
      formatUrlDisplay(issue.affected_url),
    )}</div>`,
    escapeHtml(formatDateTime(issue.resolved_at)),
  ]);

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(document.title)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #172033;
          --muted: #60708a;
          --border: #d8dfeb;
          --panel: #f6f8fc;
          --panel-strong: #edf2fb;
          --accent: #1f6feb;
          --danger: #b42318;
          --warning: #b54708;
          --success: #067647;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          color: var(--ink);
          font-size: 11px;
          line-height: 1.45;
          background: #fff;
        }
        h1, h2, h3, p { margin: 0; }
        .document {
          padding: 24px 22px 30px;
        }
        .hero {
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 22px;
          background: linear-gradient(180deg, #f8fbff 0%, #eef4ff 100%);
        }
        .hero-top {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }
        .brand {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .hero h1 {
          margin-top: 8px;
          font-size: 26px;
          line-height: 1.15;
        }
        .hero-client {
          margin-top: 6px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 600;
        }
        .hero-subtitle {
          margin-top: 10px;
          color: var(--muted);
          max-width: 520px;
        }
        .hero-meta {
          min-width: 210px;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          background: rgba(255,255,255,0.82);
        }
        .hero-meta dt {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
        }
        .hero-meta dd {
          margin: 4px 0 10px;
          font-size: 12px;
          font-weight: 600;
          word-break: break-word;
        }
        .grid {
          display: grid;
          gap: 12px;
          margin-top: 18px;
        }
        .grid.metrics {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .grid.metrics--changes {
          margin-top: 0;
        }
        .metric-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          background: #fff;
        }
        .metric-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
        }
        .metric-value {
          margin-top: 8px;
          font-size: 24px;
          font-weight: 700;
          line-height: 1.1;
        }
        .metric-hint {
          margin-top: 7px;
          color: var(--muted);
          font-size: 10px;
        }
        .section {
          margin-top: 14px;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px;
          background: #fff;
          break-inside: auto;
        }
        .section-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }
        .section-heading-group {
          display: grid;
          gap: 10px;
          margin-bottom: 10px;
          break-inside: avoid;
          page-break-inside: avoid;
          break-after: avoid-page;
          page-break-after: avoid;
        }
        .section-lead {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .section-table {
          display: grid;
          gap: 6px;
        }
        .section-table--appendix {
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .section h2 {
          font-size: 15px;
          line-height: 1.2;
        }
        .section-copy {
          color: var(--muted);
        }
        .website-change-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .website-change-card {
          display: grid;
          gap: 8px;
        }
        .table-card-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink);
        }
        .change-item {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px 12px;
          background: var(--panel);
          display: grid;
          gap: 6px;
        }
        .change-item + .change-item {
          margin-top: 8px;
        }
        .change-item__top {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .change-item__summary {
          font-weight: 600;
          color: var(--ink);
        }
        .change-item__url {
          color: var(--muted);
          font-size: 10px;
          word-break: break-word;
        }
        .change-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          border: 1px solid var(--border);
          background: #fff;
          color: var(--ink);
        }
        .change-pill--high {
          color: var(--danger);
          border-color: rgba(180, 35, 24, 0.2);
        }
        .change-pill--medium {
          color: var(--warning);
          border-color: rgba(181, 71, 8, 0.2);
        }
        .change-pill--low,
        .change-pill--info {
          color: var(--accent);
          border-color: rgba(31, 111, 235, 0.18);
        }
        .score-summary {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: var(--panel);
          color: var(--muted);
        }
        .issue-grid {
          display: grid;
          gap: 10px;
        }
        .issue-grid--rest {
          margin-top: 10px;
        }
        .issue-card {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 10px;
          background: var(--panel);
          break-inside: avoid;
        }
        .issue-card__header {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
        }
        .issue-title {
          font-size: 12px;
          font-weight: 700;
        }
        .issue-meta {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
          color: var(--muted);
          font-size: 9px;
          text-transform: uppercase;
        }
        .issue-url {
          max-width: 230px;
          word-break: break-word;
          color: var(--muted);
          font-size: 10px;
        }
        .issue-copy {
          margin-top: 8px;
          font-size: 10.5px;
        }
        .issue-detail {
          display: grid;
          gap: 4px;
          margin-top: 8px;
          color: var(--muted);
          font-size: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        th, td {
          border-top: 1px solid var(--border);
          padding: 8px 6px;
          text-align: left;
          vertical-align: top;
        }
        th {
          border-top: none;
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        thead { display: table-header-group; }
        tr { break-inside: avoid; }
        .muted { color: var(--muted); }
        .cell-url {
          display: block;
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.2;
        }
        .cell-tight {
          line-height: 1.35;
        }
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .empty-state {
          padding: 12px;
          border-radius: 12px;
          background: var(--panel);
          color: var(--muted);
        }
      </style>
    </head>
    <body>
      <main class="document">
        <section class="hero">
          <div class="hero-top">
            <div>
              <div class="brand">Scanlark Report</div>
              <h1>${escapeHtml(document.displayTitle)}</h1>
              ${
                document.clientName
                  ? `<div class="hero-client">${escapeHtml(document.clientName)}</div>`
                  : ""
              }
              <div class="hero-subtitle">
                Client-friendly export of the completed scan report, including issue priorities, scoring, evidence summary, and capped raw link evidence.
              </div>
            </div>
            <dl class="hero-meta">
              <dt>Scan date</dt>
              <dd>${escapeHtml(scanDate)}</dd>
              <dt>Start URL</dt>
              <dd>${escapeHtml(document.run.start_url)}</dd>
              <dt>Scan ID</dt>
              <dd>${escapeHtml(document.run.id)}</dd>
              <dt>Generated</dt>
              <dd>${escapeHtml(formatDateTime(document.generatedAt))} UTC</dd>
            </dl>
          </div>
          <div class="grid metrics">
            ${renderMetricCard(
              "Overall score",
              document.scores.overall.score == null
                ? "N/A"
                : `${document.scores.overall.score}%`,
              document.scores.overall.band ?? document.scores.overall.detail,
            )}
            ${renderMetricCard(
              "Link integrity",
              document.scores.linkIntegrity.score == null
                ? "N/A"
                : `${document.scores.linkIntegrity.score}%`,
              document.scores.linkIntegrity.band ??
                document.scores.linkIntegrity.detail,
            )}
            ${renderMetricCard(
              "Open issues",
              document.issuesSummary.total,
              `${highPriorityCount} high priority`,
            )}
            ${renderMetricCard(
              "Resolved issues",
              resolvedCount,
              `${document.run.checked_links} links checked`,
            )}
          </div>
          <div class="score-summary">${escapeHtml(document.scores.summary)}</div>
        </section>

        <section class="section">
          <div class="section-heading-group">
            <div class="section-heading"><h2>Executive Summary</h2></div>
          </div>
          <div class="grid metrics">
            ${renderMetricCard("New issues", document.issuesSummary.byChangeStatus.new ?? 0)}
            ${renderMetricCard("Existing issues", document.issuesSummary.byChangeStatus.existing ?? 0)}
            ${renderMetricCard("Broken links", document.summaryCounts.broken)}
            ${renderMetricCard("Blocked / no response", document.summaryCounts.blocked + document.summaryCounts.no_response)}
          </div>
          <div class="grid metrics">
            ${renderMetricCard("Ignored / skipped", document.ignoredTotal)}
            ${renderMetricCard("OK links", document.summaryCounts.ok)}
            ${renderMetricCard("Critical / high", (document.issuesSummary.bySeverity.critical ?? 0) + (document.issuesSummary.bySeverity.high ?? 0))}
            ${renderMetricCard("Timeouts", document.timeoutCount)}
          </div>
        </section>

        <section class="section">
          ${renderSectionTable(
            ["Category", "Score", "Status", "Detail"],
            categoryScoreRows,
            "No category scores were recorded for this run.",
            {
              leadContentHtml: `
                <div class="section-heading-group">
                  <div class="section-heading"><h2>Category Scores</h2></div>
                </div>
              `,
            },
          )}
        </section>

        <section class="section">
          ${renderSectionTable(
            ["Category", "Open", "Critical", "High", "Medium", "Low", "Info"],
            issueSummaryRows,
            "No open issues were recorded for this run.",
            {
              leadContentHtml: `
                <div class="section-heading-group">
                  <div class="section-heading"><h2>Open Issue Summary</h2></div>
                </div>
              `,
            },
          )}
        </section>

        ${renderWebsiteChangesSection(document)}
        ${renderTopPrioritySection(document)}

        <section class="section">
          ${renderSectionTable(
            ["Issue", "Category", "Severity", "Affected URL", "Resolved"],
            resolvedRows,
            "No resolved issues were recorded for this run.",
            {
              leadContentHtml: `
                <div class="section-heading-group">
                  <div class="section-heading"><h2>Resolved Issues</h2></div>
                  <div class="section-copy">
                    Showing the first ${PDF_RESOLVED_ISSUE_LIMIT} resolved issues from this scan baseline comparison${resolvedCount > PDF_RESOLVED_ISSUE_LIMIT ? `, out of ${resolvedCount} total.` : "."}
                  </div>
                </div>
              `,
            },
          )}
        </section>

        <section class="section">
          <div class="section-heading-group">
            <div class="section-heading"><h2>Evidence Summary</h2></div>
          </div>
          <div class="two-col">
            ${renderTable(
              ["Signal", "Count"],
              [
                ["Broken links", String(document.summaryCounts.broken)],
                ["Blocked links", String(document.summaryCounts.blocked)],
                [
                  "No response links",
                  String(document.summaryCounts.no_response),
                ],
                ["Ignored / skipped", String(document.ignoredTotal)],
                ["OK links", String(document.summaryCounts.ok)],
              ].map(([label, value]) => [escapeHtml(label), escapeHtml(value)]),
              "No link summary was recorded for this run.",
            )}
            ${renderTable(
              ["Severity", "Count"],
              [
                [
                  "Critical",
                  String(document.issuesSummary.bySeverity.critical ?? 0),
                ],
                ["High", String(document.issuesSummary.bySeverity.high ?? 0)],
                [
                  "Medium",
                  String(document.issuesSummary.bySeverity.medium ?? 0),
                ],
                ["Low", String(document.issuesSummary.bySeverity.low ?? 0)],
                ["Info", String(document.issuesSummary.bySeverity.info ?? 0)],
              ].map(([label, value]) => [escapeHtml(label), escapeHtml(value)]),
              "No issue severity data was recorded for this run.",
            )}
          </div>
        </section>

        ${renderLinkEvidenceSection("Broken Link Evidence", document.topLinks.broken)}
        ${renderLinkEvidenceSection("Blocked Link Evidence", document.topLinks.blocked)}
        ${renderLinkEvidenceSection("No Response Link Evidence", document.topLinks.no_response)}

        <section class="section">
          ${renderSectionTable(
            ["Check area", "Checks", "Findings"],
            [
              [
                "SEO basics",
                document.technicalDiagnostics.seoBasic.pageChecksCount,
                document.technicalDiagnostics.seoBasic.issueCount,
              ],
              [
                "Robots.txt",
                document.technicalDiagnostics.robots.checksCount,
                document.technicalDiagnostics.robots.issueCount,
              ],
              [
                "Sitemap",
                document.technicalDiagnostics.sitemap.checksCount,
                document.technicalDiagnostics.sitemap.issueCount,
              ],
              [
                "SSL / HTTPS",
                document.technicalDiagnostics.sslHttps.checksCount,
                document.technicalDiagnostics.sslHttps.issueCount,
              ],
              [
                "Security Setup",
                document.technicalDiagnostics.securityHeader.checksCount,
                document.technicalDiagnostics.securityHeader.issueCount,
              ],
              [
                "Speed Basics",
                document.technicalDiagnostics.performanceBasic.checksCount,
                document.technicalDiagnostics.performanceBasic.issueCount,
              ],
              ["Timeouts", "-", document.timeoutCount],
            ].map(([label, checks, findings]) => [
              escapeHtml(label),
              escapeHtml(checks),
              escapeHtml(findings),
            ]),
            "No technical diagnostics were recorded for this run.",
            {
              sectionClassName: "section-table--appendix",
              leadContentHtml: `
                <div class="section-heading-group">
                  <div class="section-heading"><h2>Technical Diagnostics</h2></div>
                  <div class="section-copy">
                    Compact appendix of the passive checks and issue counts used in this report.
                  </div>
                </div>
              `,
            },
          )}
        </section>
      </main>
    </body>
  </html>`;
}

export async function generateReportPdfBuffer(document: ReportPdfDocument) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(renderReportPdfHtml(document), {
      waitUntil: "domcontentloaded",
    });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "16mm",
        right: "12mm",
        bottom: "18mm",
        left: "12mm",
      },
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: `
        <div style="width:100%;font-size:8px;color:#60708a;padding:0 12mm;display:flex;justify-content:space-between;">
          <span>Scanlark PDF Report</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
