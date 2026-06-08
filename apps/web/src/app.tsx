import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AuthPage } from "./components/AuthPage";
import {
  CategoryStatusCard,
  MetricCard,
  ScoreRingCard,
  StatusBadge,
} from "./components/DashboardPrimitives";
import { MarketingPage } from "./components/MarketingPage";
import {
  FEATURED_LEARN_ARTICLE_SLUGS,
  LEARN_ARTICLES,
  LEARN_ARTICLES_BY_SLUG,
  LEARN_CATEGORY_ORDER,
  getLearnCategoryLabel,
  type LearnArticle,
  type LearnArticleCategory,
} from "./learnArticles";
import { ScanProgressHero } from "./components/ScanProgressHero";
import { ScanProgressBar } from "./components/ScanProgressBar";

type ScanStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";
type LinkClassification = "ok" | "broken" | "blocked" | "no_response";
type StatusGroup = "all" | "no_response" | "http_error";
type ThemeMode = "dark" | "light";
type ThemePreference = "system" | "dark" | "light";
type ActiveTab =
  | "all"
  | "broken"
  | "blocked"
  | "ok"
  | "no_response"
  | "ignored";
type SortOption =
  | "severity"
  | "occ_desc"
  | "status_asc"
  | "status_desc"
  | "recent";
type NotifyOnOption = "new_issues_only" | "issues_exist" | "always" | "never";
type LinkNoteStatus = "open" | "snoozed" | "resolved";
type FixQueueStatusFilter = LinkNoteStatus | "all";
type FixQueueView = "results" | "changes" | "fix_queue";
type AppRoute = "landing" | "login" | "app" | "report" | "learn";
type AppSection =
  | "dashboard"
  | "reports"
  | "schedule"
  | "alerts"
  | "ignore_rules"
  | "sites";
type LearnCategoryFilter = LearnArticleCategory | "all";

interface Site {
  id: string;
  user_id: string;
  url: string;
  created_at: string;
  schedule_enabled: boolean;
  schedule_frequency: "manual" | "daily" | "weekly" | "monthly";
  schedule_time_utc: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_at: string | null;
  last_scheduled_at: string | null;
  notify_enabled: boolean;
  notify_email: string | null;
  notify_on: NotifyOnOption;
  notify_include_csv: boolean;
  summary_enabled: boolean;
  last_notified_scan_run_id: string | null;
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

interface SitesResponse {
  userId?: string;
  count: number;
  sites: Site[];
}

interface ScanRunSummary {
  id: string;
  site_id: string;
  status: ScanStatus;
  started_at: string;
  finished_at: string | null;
  updated_at?: string | null;
  error_message?: string | null;
  start_url: string;
  total_links: number;
  checked_links: number;
  broken_links: number;
  issue_generation_status?: "pending" | "completed" | "failed";
  issue_generation_error?: string | null;
}

interface ScanHistoryResponse {
  siteId: string;
  count: number;
  scans: ScanRunSummary[];
}

interface ScanResultRow {
  id: string;
  scan_run_id: string;
  source_page: string;
  link_url: string;
  status_code: number | null;
  classification: LinkClassification;
  error_message: string | null;
  created_at: string;
}

interface ScanResultsResponse {
  scanRunId: string;
  classification?: string;
  countReturned: number;
  totalMatching: number;
  results: ScanResultRow[];
}

interface ScanLink {
  id: string;
  scan_run_id: string;
  link_url: string;
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  ignored: boolean;
  ignored_by_rule_id: string | null;
  ignored_at: string | null;
  ignore_reason: string | null;
  ignored_source: "none" | "manual" | "rule";
  first_seen_at: string;
  last_seen_at: string;
  occurrence_count: number;
  created_at: string;
  updated_at: string;
}

interface ScanLinkOccurrence {
  id: string;
  scan_link_id: string;
  source_page: string;
  created_at: string;
}

interface ScanLinkOccurrencesResponse {
  scanLinkId: string;
  countReturned: number;
  totalMatching: number;
  occurrences: ScanLinkOccurrence[];
}

interface IgnoreRule {
  id: string;
  site_id: string | null;
  rule_type:
    | "contains"
    | "regex"
    | "exact"
    | "status_code"
    | "classification"
    | "domain"
    | "path_prefix";
  pattern: string;
  is_enabled: boolean;
  created_at: string;
}

interface LinkNote {
  id: string;
  user_id: string;
  site_id: string;
  link_url: string;
  note: string;
  status: LinkNoteStatus;
  created_at: string;
  updated_at: string;
}

interface LinkNotesResponse {
  siteId: string;
  count: number;
  notes: LinkNote[];
}

interface FixQueueItem {
  link_url: string;
  change_type: "new_issue" | "outstanding_issue";
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  source_pages: string[];
  ignored: boolean;
  ignore_reason: string | null;
  note: {
    note: string;
    status: LinkNoteStatus;
    updated_at: string;
  } | null;
}

interface FixQueueResponse {
  siteId: string;
  currentRun: {
    id: string;
    started_at: string;
    finished_at: string | null;
  } | null;
  baselineRun: {
    id: string;
    started_at: string;
    finished_at: string | null;
  } | null;
  summary: {
    newIssues: number;
    outstandingIssues: number;
    totalQueueItems: number;
    withNotesOpen: number;
    snoozed: number;
    resolved: number;
  };
  items: FixQueueItem[];
}

interface ScanLinksResponse {
  scanRunId: string;
  classification?: LinkClassification;
  statusGroup?: StatusGroup;
  showIgnored?: boolean;
  countReturned: number;
  totalMatching: number;
  links: ScanLink[];
}

interface ScanLinksSummaryRow {
  classification: LinkClassification;
  status_code: number | null;
  count: number;
}

interface ScanLinksSummaryResponse {
  scanRunId: string;
  summary: ScanLinksSummaryRow[];
}

interface RecheckScanLinkResponse {
  scanLink: ScanLink;
}

interface IgnoredLinkRow {
  id: string;
  scan_run_id: string;
  link_url: string;
  rule_id: string | null;
  rule_type: string | null;
  rule_pattern: string | null;
  status_code: number | null;
  error_message: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

interface IgnoredLinksResponse {
  scanRunId: string;
  countReturned: number;
  totalMatching: number;
  links: IgnoredLinkRow[];
}

interface Phase0Diagnostics {
  scanRunId: string;
  ok: number | null;
  broken: number | null;
  blocked: number | null;
  noResponse: number | null;
  ignoredSkipped: number | null;
  categoryScores: ScanCategoryScore[] | null;
  seoBasic: {
    pageChecksCount: number | null;
    issueCount: number | null;
  } | null;
  robots: {
    checksCount: number | null;
    okChecksCount: number | null;
    issueCount: number | null;
    blocksAll: boolean | null;
    sitemapReferencesCount: number | null;
  } | null;
  sitemap: {
    checksCount: number | null;
    okChecksCount: number | null;
    issueCount: number | null;
    parsedUrlCount: number | null;
    sampledBrokenEntryCount: number | null;
  } | null;
  sslHttps: {
    checksCount: number | null;
    okChecksCount: number | null;
    issueCount: number | null;
    httpsAvailable: boolean | null;
    httpRedirectsToHttps: boolean | null;
    tlsAuthorized: boolean | null;
    hostnameMatches: boolean | null;
    daysUntilExpiry: number | null;
    expiringSoon: boolean | null;
  } | null;
  securityHeader: {
    checksCount: number | null;
    okChecksCount: number | null;
    issueCount: number | null;
    hasHsts: boolean | null;
    hasCsp: boolean | null;
    hasFrameAncestors: boolean | null;
    hasXFrameOptions: boolean | null;
    hasXContentTypeOptions: boolean | null;
    hasReferrerPolicy: boolean | null;
    hasPermissionsPolicy: boolean | null;
    cookiesSetCount: number | null;
    cookiesMissingSecureCount: number | null;
    cookiesMissingHttpOnlyCount: number | null;
    cookiesMissingSameSiteCount: number | null;
  } | null;
  performanceBasic: {
    checksCount: number | null;
    okChecksCount: number | null;
    issueCount: number | null;
    responseTimeMs: number | null;
    htmlSizeBytes: number | null;
    imageCount: number | null;
    scriptCount: number | null;
    stylesheetCount: number | null;
    assetCount: number | null;
  } | null;
  error: string | null;
  loadedAt: number | null;
}

interface ScanTechnicalDiagnosticsResponse {
  scanRunId: string;
  categoryScores: ScanCategoryScore[];
  seoBasic: NonNullable<Phase0Diagnostics["seoBasic"]>;
  robots: NonNullable<Phase0Diagnostics["robots"]>;
  sitemap: NonNullable<Phase0Diagnostics["sitemap"]>;
  sslHttps: NonNullable<Phase0Diagnostics["sslHttps"]>;
  securityHeader: NonNullable<Phase0Diagnostics["securityHeader"]>;
  performanceBasic: NonNullable<Phase0Diagnostics["performanceBasic"]>;
  loadedAt: string;
}

interface IgnoredOccurrencesResponse {
  scanRunId: string;
  ignoredLinkId: string;
  countReturned: number;
  totalMatching: number;
  occurrences: ScanLinkOccurrence[];
}

type ReportSectionKey = "broken" | "blocked" | "no_response";

type ReportLinkSectionState = {
  links: ScanLink[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type ReportIgnoredSectionState = {
  links: IgnoredLinkRow[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type ReportSummaryCounts = {
  ok: number;
  broken: number;
  blocked: number;
  no_response: number;
};

type ReportStatusCodeGroups = {
  notFound: number;
  blocked: number;
  serverError: number;
  noResponse: number;
  otherHttp: number;
};

type IssueSeverity = "critical" | "high" | "medium" | "low" | "info";
type IssueStatus = "open" | "resolved";
type IssueChangeStatus = "new" | "existing" | "resolved";
type IssueCategory =
  | "link_integrity"
  | "seo_basic"
  | "ssl_https"
  | "security_header"
  | "sitemap"
  | "robots"
  | "performance_basic";
type ScanCategoryScoreKey =
  | "link_integrity"
  | "seo_basic"
  | "search_engine_access"
  | "ssl_https"
  | "security_setup"
  | "speed_basics";
type ScanCategoryScoreStatus = "healthy" | "needs_attention" | "not_checked";
interface ScanCategoryScore {
  key: ScanCategoryScoreKey;
  label: string;
  score: number | null;
  band: ScoreBand | null;
  status: ScanCategoryScoreStatus;
  findingCount: number;
  severityCounts: Record<IssueSeverity, number>;
  checkCount: number;
  issueCategories: IssueCategory[];
}
type IssueType =
  | "broken_link"
  | "blocked_link"
  | "no_response"
  | "ignored_safety_skip"
  | "missing_title"
  | "empty_title"
  | "duplicate_title"
  | "missing_meta_description"
  | "empty_meta_description"
  | "missing_h1"
  | "multiple_h1"
  | "noindex_detected"
  | "canonical_multiple"
  | "robots_missing"
  | "robots_unreachable"
  | "robots_blocks_all"
  | "robots_no_sitemap_reference"
  | "sitemap_missing"
  | "sitemap_unreachable"
  | "sitemap_invalid"
  | "sitemap_empty"
  | "sitemap_url_broken"
  | "https_unavailable"
  | "http_not_redirecting_to_https"
  | "mixed_content_script"
  | "mixed_content_stylesheet"
  | "mixed_content_image"
  | "mixed_content_iframe"
  | "ssl_certificate_expired"
  | "ssl_certificate_expiring_soon"
  | "ssl_certificate_hostname_mismatch"
  | "ssl_certificate_invalid"
  | "hsts_missing"
  | "csp_missing"
  | "frame_ancestors_missing"
  | "x_frame_options_missing"
  | "x_content_type_options_missing"
  | "referrer_policy_missing"
  | "permissions_policy_missing"
  | "set_cookie_missing_secure"
  | "set_cookie_missing_httponly"
  | "set_cookie_missing_samesite"
  | "homepage_response_slow"
  | "homepage_html_too_large"
  | "homepage_asset_count_high"
  | "homepage_image_count_high"
  | "homepage_script_count_high";

interface ScanIssue {
  id: string;
  scan_run_id: string;
  site_id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
  issue_type: IssueType;
  affected_url: string;
  source_url: string | null;
  title: string;
  description: string;
  presentation: IssuePresentation;
  evidence_json: Record<string, unknown>;
  change_status: Exclude<IssueChangeStatus, "resolved"> | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
}

interface ResolvedScanIssue {
  id: string;
  site_id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  issue_type: IssueType;
  affected_url: string;
  source_url: string | null;
  title: string;
  description: string;
  presentation: IssuePresentation;
  evidence_json: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string;
  resolved_scan_run_id: string;
  change_status: "resolved";
  status: "resolved";
}

interface IssuePresentation {
  userTitle: string;
  shortSummary: string;
  whatItMeans: string;
  whyItMatters: string;
  suggestedFix: string;
  technicalDetail: string;
  learnSlug: string | null;
}

interface ScanIssuesResponse {
  scanRunId: string;
  summary: {
    total: number;
    bySeverity: Record<IssueSeverity, number>;
    byIssueType: Record<string, number>;
    byChangeStatus: Record<IssueChangeStatus, number>;
  };
  countReturned: number;
  totalMatching: number;
  resolvedCount: number;
  issues: ScanIssue[];
  resolvedIssues: ResolvedScanIssue[];
}

interface DashboardSummaryResponse {
  site: Site;
  latestRun: ScanRunSummary | null;
  latestLinkSummary: ScanLinksSummaryRow[];
  latestIssueSummary: ScanIssuesResponse["summary"] | null;
  latestResolvedCount: number;
  latestCategoryIssueSummaries: Partial<
    Record<IssueCategory, ScanIssuesResponse["summary"]>
  >;
  latestCategoryScores: ScanCategoryScore[];
  latestTechnicalDiagnostics: ScanTechnicalDiagnosticsResponse | null;
  latestDiffSummary: ScanDiffResponse["summary"] | null;
  baselineRun: ScanDiffRun | null;
  history: ScanRunSummary[];
  notificationSettings: {
    notifyEnabled: boolean;
    notifyEmail: string | null;
    notifyOn: NotifyOnOption;
    notifyIncludeCsv: boolean;
    summaryEnabled: boolean;
  } | null;
  uptime: UptimeSummaryResponse;
}

interface UptimeCheckResponse {
  id: string;
  settings_id: string;
  site_id: string;
  checked_url: string;
  status: "up" | "degraded" | "down";
  status_code: number | null;
  response_time_ms: number | null;
  redirect_count: number;
  error_code: string | null;
  error_message: string | null;
  checked_at: string;
}

interface UptimeSummaryResponse {
  settingsId: string;
  siteId: string;
  enabled: boolean;
  checkUrl: string;
  intervalMinutes: number;
  failureThreshold: number;
  status: "unknown" | "up" | "degraded" | "down";
  consecutiveFailures: number;
  lastCheckedAt: string | null;
  lastUpAt: string | null;
  lastDownAt: string | null;
  lastRecoveredAt: string | null;
  lastResponseTimeMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  uptime30d: number | null;
  activeIncidentId: string | null;
  recentChecks: UptimeCheckResponse[];
}

type ReportIssuesState = {
  issues: ScanIssue[];
  resolvedIssues: ResolvedScanIssue[];
  resolvedCount: number;
  summary: ScanIssuesResponse["summary"] | null;
  summariesByCategory: Partial<
    Record<IssueCategory, ScanIssuesResponse["summary"]>
  >;
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
};

type ReportIssueFilter =
  | "all"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "link_integrity"
  | "seo_basic"
  | "performance_basic";

type ScanDiffChangeType =
  | "new_issue"
  | "fixed"
  | "changed"
  | "unchanged"
  | "added"
  | "removed";

interface ScanDiffSide {
  classification: LinkClassification;
  status_code: number | null;
  error_message: string | null;
  source_pages: string[];
}

interface ScanDiffItem {
  link_url: string;
  change_type: ScanDiffChangeType;
  current: ScanDiffSide | null;
  baseline: ScanDiffSide | null;
}

interface ScanDiffRun {
  id: string;
  started_at: string;
  finished_at: string | null;
}

interface ScanDiffResponse {
  siteId: string;
  currentRun: ScanDiffRun;
  baselineRun: ScanDiffRun | null;
  summary: {
    newIssues: number;
    fixedIssues: number;
    changed: number;
    outstandingIssues: number;
    outstandingOk: number;
    outstandingTotal: number;
    removed: number;
    added: number;
  };
  meta: {
    includeUnchanged: boolean;
    unchangedOnly: boolean;
    unchangedScope: "issues" | "ok" | "all";
    includeIgnored?: boolean;
    unchangedLimit: number;
    unchangedOffset: number;
    unchangedReturned: number;
    changesReturned: number;
  };
  items: ScanDiffItem[];
}

type ScanEventPayload = {
  type: "scan_started" | "scan_progress" | "scan_completed" | "scan_failed";
  user_id: string;
  site_id: string;
  scan_run_id: string;
  status: ScanStatus;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string | null;
  start_url?: string | null;
  total_links: number;
  checked_links: number;
  broken_links: number;
  error_message: string | null;
};

type ScheduleEventPayload = {
  type: "schedule_updated";
  user_id: string;
  site_id: string;
  schedule_enabled: boolean;
  schedule_frequency: "manual" | "daily" | "weekly" | "monthly";
  schedule_time_utc: string;
  schedule_day_of_week: number | null;
  schedule_day_of_month: number | null;
  next_scheduled_at: string | null;
  last_scheduled_at: string | null;
};

type SsePayload = ScanEventPayload | ScheduleEventPayload;

const API_BASE = "http://localhost:3001";
const THEME_STORAGE_KEY = "theme";
const LINKS_PAGE_SIZE = 50;
const REPORT_INITIAL_VISIBLE_ROWS = 10;
const REPORT_VISIBLE_ROWS_INCREMENT = 10;
const OCCURRENCES_PAGE_SIZE = 50;
const IGNORED_OCCURRENCES_LIMIT = 20;
const PROGRESS_DISMISS_MS = 2000;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SAMPLE_SITE_URL = "https://example.com";
const SAMPLE_SITE_NAME = "Sample site";
const ONBOARDING_STORAGE_PREFIX = "onboarding_completed:";
const SITE_NAME_STORAGE_PREFIX = "site_names:";
const EMPTY_REPORT_SECTION: ReportLinkSectionState = {
  links: [],
  offset: 0,
  hasMore: false,
  loading: false,
  error: null,
};
const EMPTY_REPORT_SECTIONS: Record<ReportSectionKey, ReportLinkSectionState> =
  {
    broken: { ...EMPTY_REPORT_SECTION },
    blocked: { ...EMPTY_REPORT_SECTION },
    no_response: { ...EMPTY_REPORT_SECTION },
  };
const EMPTY_REPORT_IGNORED_SECTION: ReportIgnoredSectionState = {
  links: [],
  offset: 0,
  hasMore: false,
  loading: false,
  error: null,
};
const EMPTY_REPORT_ISSUES_STATE: ReportIssuesState = {
  issues: [],
  resolvedIssues: [],
  resolvedCount: 0,
  summary: null,
  summariesByCategory: {},
  offset: 0,
  hasMore: false,
  loading: false,
  error: null,
};

const REPORT_ISSUE_FILTERS: Array<{
  key: ReportIssueFilter;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "info", label: "Info" },
  { key: "link_integrity", label: "Link integrity" },
  { key: "seo_basic", label: "SEO basics" },
  { key: "performance_basic", label: "Speed Basics" },
];

const DASHBOARD_CATEGORIES: Array<{
  key: ScanCategoryScoreKey;
  label: string;
  description: string;
}> = [
  {
    key: "link_integrity",
    label: "Broken Links",
    description: "Broken, blocked, and no-response links",
  },
  {
    key: "seo_basic",
    label: "SEO Basics",
    description: "Titles, descriptions, H1s, canonicals, noindex",
  },
  {
    key: "search_engine_access",
    label: "Search Engine Access",
    description: "Robots.txt and sitemap discovery",
  },
  {
    key: "ssl_https",
    label: "SSL & HTTPS",
    description: "HTTPS reachability, redirects, and certificate checks",
  },
  {
    key: "security_setup",
    label: "Security Setup",
    description: "Basic passive response-header checks",
  },
  {
    key: "speed_basics",
    label: "Speed Basics",
    description: "Basic response size and asset-count signals",
  },
];

function isInProgress(status: ScanStatus | string | null | undefined) {
  return status === "in_progress" || status === "queued";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function percentBroken(total: number, broken: number) {
  if (!total) return "0.0%";
  const p = (broken / total) * 100;
  return `${p.toFixed(1)}%`;
}

function progressPercent(checked: number, total: number) {
  if (!total) return "0%";
  const pct = Math.min(100, Math.max(0, (checked / total) * 100));
  return `${pct.toFixed(0)}%`;
}

function summarizeReportClassifications(
  rows: ScanLinksSummaryRow[],
): ReportSummaryCounts {
  return rows.reduce<ReportSummaryCounts>(
    (acc, row) => {
      acc[row.classification] += row.count;
      return acc;
    },
    { ok: 0, broken: 0, blocked: 0, no_response: 0 },
  );
}

function summarizeReportStatusCodes(
  rows: ScanLinksSummaryRow[],
): ReportStatusCodeGroups {
  return rows.reduce<ReportStatusCodeGroups>(
    (acc, row) => {
      if (row.status_code == null) {
        acc.noResponse += row.count;
        return acc;
      }
      if (row.status_code === 404 || row.status_code === 410) {
        acc.notFound += row.count;
        return acc;
      }
      if (
        row.status_code === 401 ||
        row.status_code === 403 ||
        row.status_code === 429
      ) {
        acc.blocked += row.count;
        return acc;
      }
      if (row.status_code >= 500) {
        acc.serverError += row.count;
        return acc;
      }
      acc.otherHttp += row.count;
      return acc;
    },
    {
      notFound: 0,
      blocked: 0,
      serverError: 0,
      noResponse: 0,
      otherHttp: 0,
    },
  );
}

function getIgnoredRowSummary(row: IgnoredLinkRow) {
  if (row.error_message?.startsWith("crawl_skipped:")) {
    return "Skipped by crawler safety rule";
  }
  if (row.rule_type) {
    if (row.rule_type === "exact") return "Ignored by exact rule";
    return "Ignored by rule";
  }
  return "Ignored";
}

function formatIssueSeverity(value: IssueSeverity) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function issueSeverityTone(value: IssueSeverity) {
  if (value === "critical" || value === "high") return "var(--danger)";
  if (value === "medium") return "var(--warning)";
  if (value === "low") return "var(--accent)";
  return "var(--muted)";
}

function combineIssueSummaries(
  summaries: Array<ScanIssuesResponse["summary"] | null | undefined>,
): ScanIssuesResponse["summary"] {
  const combined: ScanIssuesResponse["summary"] = {
    total: 0,
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    byIssueType: {},
    byChangeStatus: {
      new: 0,
      existing: 0,
      resolved: 0,
    },
  };

  for (const summary of summaries) {
    if (!summary) continue;
    combined.total += summary.total ?? 0;
    combined.bySeverity.critical += summary.bySeverity.critical ?? 0;
    combined.bySeverity.high += summary.bySeverity.high ?? 0;
    combined.bySeverity.medium += summary.bySeverity.medium ?? 0;
    combined.bySeverity.low += summary.bySeverity.low ?? 0;
    combined.bySeverity.info += summary.bySeverity.info ?? 0;
    combined.byChangeStatus.new += summary.byChangeStatus.new ?? 0;
    combined.byChangeStatus.existing += summary.byChangeStatus.existing ?? 0;
    combined.byChangeStatus.resolved += summary.byChangeStatus.resolved ?? 0;
    for (const [issueType, count] of Object.entries(
      summary.byIssueType ?? {},
    )) {
      combined.byIssueType[issueType] =
        (combined.byIssueType[issueType] ?? 0) + count;
    }
  }

  return combined;
}

function formatIssueChangeStatus(value: IssueChangeStatus) {
  if (value === "new") return "New";
  if (value === "existing") return "Existing";
  return "Resolved";
}

function formatIssueCategoryLabel(category: IssueCategory) {
  if (category === "seo_basic") return "SEO basic";
  if (category === "link_integrity") return "Link integrity";
  if (category === "ssl_https") return "SSL / HTTPS";
  if (category === "security_header") return "Security Setup";
  if (category === "robots") return "Robots.txt";
  if (category === "sitemap") return "Sitemap";
  if (category === "performance_basic") return "Speed Basics";
  return String(category).replace(/_/g, " ");
}

function getDiagnosticIssueCount(
  category: IssueCategory,
  diagnostics: ScanTechnicalDiagnosticsResponse | null | undefined,
) {
  if (!diagnostics) return null;
  if (category === "seo_basic") return diagnostics.seoBasic.issueCount;
  if (category === "robots") return diagnostics.robots.issueCount;
  if (category === "sitemap") return diagnostics.sitemap.issueCount;
  if (category === "ssl_https") return diagnostics.sslHttps.issueCount;
  if (category === "security_header")
    return diagnostics.securityHeader.issueCount;
  if (category === "performance_basic")
    return diagnostics.performanceBasic.issueCount;
  return null;
}

function getDiagnosticCheckCount(
  category: IssueCategory,
  diagnostics: ScanTechnicalDiagnosticsResponse | null | undefined,
) {
  if (!diagnostics) return null;
  if (category === "seo_basic") return diagnostics.seoBasic.pageChecksCount;
  if (category === "robots") return diagnostics.robots.checksCount;
  if (category === "sitemap") return diagnostics.sitemap.checksCount;
  if (category === "ssl_https") return diagnostics.sslHttps.checksCount;
  if (category === "security_header")
    return diagnostics.securityHeader.checksCount;
  if (category === "performance_basic")
    return diagnostics.performanceBasic.checksCount;
  return null;
}

function getCategoryStatus(
  category: IssueCategory,
  issueSummary: ScanIssuesResponse["summary"] | null | undefined,
  diagnostics: ScanTechnicalDiagnosticsResponse | null | undefined,
) {
  const issueCount = issueSummary?.total ?? 0;
  const diagnosticIssues = getDiagnosticIssueCount(category, diagnostics);
  const checks = getDiagnosticCheckCount(category, diagnostics);

  if (issueCount > 0 || (diagnosticIssues ?? 0) > 0) {
    return { label: "Needs attention", tone: "warning" as const };
  }
  if (category !== "link_integrity" && (!checks || checks <= 0)) {
    return { label: "Warning", tone: "muted" as const };
  }
  return { label: "Healthy", tone: "success" as const };
}

function getCategoryDetail(
  category: IssueCategory,
  issueSummary: ScanIssuesResponse["summary"] | null | undefined,
  diagnostics: ScanTechnicalDiagnosticsResponse | null | undefined,
) {
  const issueCount = issueSummary?.total ?? 0;
  if (category === "link_integrity") {
    return `${issueCount} open issue${issueCount === 1 ? "" : "s"}`;
  }
  const checks = getDiagnosticCheckCount(category, diagnostics);
  const diagnosticIssues = getDiagnosticIssueCount(category, diagnostics);
  if (!checks || checks <= 0) return "Warning: no diagnostic evidence yet";
  const count = diagnosticIssues ?? issueCount;
  return `${count} finding${count === 1 ? "" : "s"}`;
}

function getCategoryScoreStatusLabel(status: ScanCategoryScoreStatus) {
  if (status === "healthy") return "Healthy";
  if (status === "needs_attention") return "Needs attention";
  return "Not checked";
}

function getCategoryScoreTone(score: ScanCategoryScore | null | undefined) {
  if (!score || score.status === "not_checked") return "default" as const;
  if (score.status === "healthy") return "success" as const;
  if (score.score != null && score.score < 55) return "danger" as const;
  return "warning" as const;
}

function getCategoryScoreValue(score: ScanCategoryScore | null | undefined) {
  if (!score || score.score == null) return "N/A";
  return `${score.score}%`;
}

function getCategoryScoreDetail(score: ScanCategoryScore | null | undefined) {
  if (!score) return "Score unavailable";
  if (score.status === "not_checked") return "No diagnostic evidence recorded";
  return `${score.findingCount} finding${score.findingCount === 1 ? "" : "s"} · ${score.checkCount} check${score.checkCount === 1 ? "" : "s"}`;
}

function getUptimeTone(
  uptime: UptimeSummaryResponse | null | undefined,
): "default" | "success" | "warning" | "danger" {
  if (!uptime?.enabled || uptime.status === "unknown") return "default";
  if (uptime.status === "up") return "success";
  if (uptime.status === "degraded") return "warning";
  return "danger";
}

function getUptimeStatusLabel(
  uptime: UptimeSummaryResponse | null | undefined,
) {
  if (!uptime?.enabled) return "Monitoring off";
  if (uptime.status === "unknown") return "Unknown";
  if (uptime.status === "up") return "Up";
  if (uptime.status === "degraded") return "Degraded";
  return "Down";
}

function formatUptimePercentage(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${value.toFixed(2)}%`;
}

function getSearchAccessCategoryDetail(
  score: ScanCategoryScore | null | undefined,
  summariesByCategory: Partial<
    Record<IssueCategory, ScanIssuesResponse["summary"]>
  >,
) {
  if (!score || score.key !== "search_engine_access") {
    return getCategoryScoreDetail(score);
  }
  const robotsCount = summariesByCategory.robots?.total ?? 0;
  const sitemapCount = summariesByCategory.sitemap?.total ?? 0;
  return `Robots ${robotsCount} finding${robotsCount === 1 ? "" : "s"} · Sitemap ${sitemapCount} finding${sitemapCount === 1 ? "" : "s"}`;
}

function getScanStageText(run: ScanRunSummary | null | undefined) {
  if (!run) return "No scan yet";
  if (run.status === "queued") return "Queued";
  if (run.status === "in_progress" && run.total_links <= 0) {
    return "Discovering links";
  }
  if (run.status === "in_progress") return "Checking links";
  if (
    run.status === "completed" &&
    run.issue_generation_status &&
    run.issue_generation_status !== "completed"
  ) {
    return "Building issue summary";
  }
  if (run.status === "completed") return "Scan complete";
  if (run.status === "failed") return "Scan failed";
  if (run.status === "cancelled") return "Scan cancelled";
  return "Scan status unavailable";
}

function matchesReportIssueFilter(
  issue: ScanIssue,
  filter: ReportIssueFilter,
): boolean {
  if (filter === "all") return true;
  if (
    filter === "high" ||
    filter === "medium" ||
    filter === "low" ||
    filter === "info"
  ) {
    return issue.severity === filter;
  }
  return issue.category === filter;
}

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

function getScoreBandTone(score: number | null) {
  if (score == null) return "var(--muted)";
  if (score >= 90) return "var(--success)";
  if (score >= 75) return "var(--accent)";
  if (score >= 55) return "var(--warning)";
  return "var(--danger)";
}

function buildScoreSummarySentence(
  score: number | null,
  severityCounts: Record<IssueSeverity, number>,
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
  run: ScanRunSummary | null,
  overallIssueSummary: ScanIssuesResponse["summary"] | null,
  linkIntegrityIssueSummary: ScanIssuesResponse["summary"] | null,
): ReportScores {
  const overallSeverityCounts: Record<IssueSeverity, number> = {
    critical: overallIssueSummary?.bySeverity.critical ?? 0,
    high: overallIssueSummary?.bySeverity.high ?? 0,
    medium: overallIssueSummary?.bySeverity.medium ?? 0,
    low: overallIssueSummary?.bySeverity.low ?? 0,
    info: overallIssueSummary?.bySeverity.info ?? 0,
  };
  const linkSeverityCounts: Record<IssueSeverity, number> = {
    critical: linkIntegrityIssueSummary?.bySeverity.critical ?? 0,
    high: linkIntegrityIssueSummary?.bySeverity.high ?? 0,
    medium: linkIntegrityIssueSummary?.bySeverity.medium ?? 0,
    low: linkIntegrityIssueSummary?.bySeverity.low ?? 0,
    info: linkIntegrityIssueSummary?.bySeverity.info ?? 0,
  };

  if (!run) {
    return {
      overall: {
        score: null,
        band: null,
        detail: "Calculating after scan completes",
      },
      linkIntegrity: {
        score: null,
        band: null,
        detail: "Calculating after scan completes",
      },
      summary:
        "This score will be calculated when enough scan data is available.",
    };
  }

  if (run.status === "queued" || run.status === "in_progress") {
    return {
      overall: {
        score: null,
        band: null,
        detail: "Calculating after scan completes",
      },
      linkIntegrity: {
        score: null,
        band: null,
        detail: "Calculating after scan completes",
      },
      summary:
        "This score will be calculated when enough scan data is available.",
    };
  }

  if (!overallIssueSummary && !linkIntegrityIssueSummary) {
    return {
      overall: {
        score: null,
        band: null,
        detail: "Calculating from current issue findings",
      },
      linkIntegrity: {
        score: null,
        band: null,
        detail: "Calculating from current issue findings",
      },
      summary:
        "This score will be calculated when enough issue data is available.",
    };
  }

  const checkedLinks = run.checked_links ?? 0;
  if (checkedLinks <= 0) {
    return {
      overall: {
        score: null,
        band: null,
        detail: "Not available",
      },
      linkIntegrity: {
        score: null,
        band: null,
        detail: "Not available",
      },
      summary:
        "This score is not available because this run did not record checked links.",
    };
  }

  const computeScore = (severityCounts: Record<IssueSeverity, number>) => {
    const totalPenalty = clamp(
      Math.min(70, severityCounts.critical * 25) +
        Math.min(40, severityCounts.high * 12) +
        Math.min(30, severityCounts.medium * 6) +
        Math.min(15, severityCounts.low * 1),
      0,
      100,
    );
    const score = clamp(Math.round(100 - totalPenalty), 0, 100);
    return {
      score,
      band: getScoreBand(score),
    };
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

function formatRelative(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.round(diffMs / 1000));
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

function normalizeTimeInput(value: string | null | undefined) {
  if (!value) return "02:00";
  if (value.length >= 5) return value.slice(0, 5);
  return value;
}

function getLocalTimeZone() {
  if (typeof Intl === "undefined") return "local";
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
}

function formatUtcDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function formatLocalDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseTimeUtc(timeUtc: string) {
  const [hours, minutes] = timeUtc.split(":").map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
}

function buildUtcScheduleAnchor(
  frequency: "manual" | "daily" | "weekly" | "monthly",
  timeUtc: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
) {
  const parsed = parseTimeUtc(timeUtc);
  if (!parsed) return null;
  if (frequency === "manual") return null;
  const now = new Date();
  const base = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      parsed.hours,
      parsed.minutes,
      0,
      0,
    ),
  );
  if (frequency === "daily") {
    if (base.getTime() <= now.getTime()) {
      base.setUTCDate(base.getUTCDate() + 1);
    }
    return base;
  }

  if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    const diff = (targetDay - base.getUTCDay() + 7) % 7;
    base.setUTCDate(base.getUTCDate() + diff);
    if (base.getTime() <= now.getTime()) {
      base.setUTCDate(base.getUTCDate() + 7);
    }
    return base;
  }

  const targetDayOfMonth = dayOfMonth ?? 1;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const clampDay = (candidateYear: number, candidateMonth: number) =>
    Math.min(
      targetDayOfMonth,
      new Date(Date.UTC(candidateYear, candidateMonth + 1, 0)).getUTCDate(),
    );
  let candidate = new Date(
    Date.UTC(
      year,
      month,
      clampDay(year, month),
      parsed.hours,
      parsed.minutes,
      0,
      0,
    ),
  );
  if (candidate.getTime() <= now.getTime()) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    candidate = new Date(
      Date.UTC(
        nextYear,
        nextMonth,
        clampDay(nextYear, nextMonth),
        parsed.hours,
        parsed.minutes,
        0,
        0,
      ),
    );
  }
  return candidate;
}

function formatScheduleUtcLabel(
  frequency: "manual" | "daily" | "weekly" | "monthly",
  timeUtc: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
) {
  if (frequency === "manual") return "Manual only";
  if (frequency === "weekly") {
    const dayLabel = WEEKDAY_LABELS[dayOfWeek ?? 1] ?? "Mon";
    return `${dayLabel} ${timeUtc}`;
  }
  if (frequency === "monthly") {
    return `Day ${dayOfMonth ?? 1} ${timeUtc}`;
  }
  return timeUtc;
}

function formatScheduleLocalLabel(
  frequency: "manual" | "daily" | "weekly" | "monthly",
  timeUtc: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
) {
  const anchor = buildUtcScheduleAnchor(
    frequency,
    timeUtc,
    dayOfWeek,
    dayOfMonth,
  );
  if (!anchor) return "-";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(anchor);
}

function runStatusTone(status: string | null | undefined) {
  if (!status) return "neutral";
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "queued" || status === "in_progress" || status === "running")
    return "warning";
  return "neutral";
}

function formatDuration(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (!start || !end) return "-";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs)
    return "-";
  const diffMs = endMs - startMs;
  const diffSec = Math.round(diffMs / 1000);
  const minutes = Math.floor(diffSec / 60);
  const seconds = diffSec % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatScheduleSummary(
  isEnabled: boolean,
  frequency: "manual" | "daily" | "weekly" | "monthly",
  timeUtc: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  nextScheduledAt: string | null,
) {
  if (!isEnabled && frequency === "manual") return "Auto-scan: Manual only";
  if (!isEnabled) return `Auto-scan: Paused (${frequency})`;
  const nextLabel = formatDate(nextScheduledAt);
  const localTimeZone = getLocalTimeZone();
  const localLabel = formatScheduleLocalLabel(
    frequency,
    timeUtc,
    dayOfWeek,
    dayOfMonth,
  );
  const localSuffix =
    localTimeZone && localTimeZone !== "UTC"
      ? ` / ${localLabel} (${localTimeZone})`
      : "";
  if (frequency === "weekly") {
    const dayLabel = WEEKDAY_LABELS[dayOfWeek ?? 1] ?? "Mon";
    return `Auto-scan: Weekly ${dayLabel} ${timeUtc} UTC${localSuffix} (Next: ${nextLabel})`;
  }
  if (frequency === "monthly") {
    return `Auto-scan: Monthly day ${dayOfMonth ?? 1} ${timeUtc} UTC${localSuffix} (Next: ${nextLabel})`;
  }
  return `Auto-scan: Daily ${timeUtc} UTC${localSuffix} (Next: ${nextLabel})`;
}

function formatAlertsSummary(isEnabled: boolean, notifyOn: NotifyOnOption) {
  if (!isEnabled || notifyOn === "never") return "Alerts: Disabled";
  if (notifyOn === "new_issues_only") return "Alerts: Enabled (New issues)";
  if (notifyOn === "issues_exist") return "Alerts: Enabled (Issues exist)";
  return "Alerts: Enabled (Always)";
}

function normalizeNotifyOn(value: string): NotifyOnOption {
  if (value === "issues") return "issues_exist";
  if (value === "new_issues_only") return "new_issues_only";
  if (value === "issues_exist") return "issues_exist";
  if (value === "always") return "always";
  return "never";
}

function normalizeSitesNotifyOn(sites: Site[]): Site[] {
  return sites.map((site) => ({
    ...site,
    notify_on: normalizeNotifyOn(site.notify_on),
  }));
}

function normalizeSiteNotifyOn(site: Site): Site {
  return {
    ...site,
    notify_on: normalizeNotifyOn(site.notify_on),
  };
}

function getStorageKey(prefix: string, userId: string) {
  return `${prefix}${userId}`;
}

function loadStorageMap(key: string) {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return {};
}

function saveStorageMap(key: string, value: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function getReportScanRunIdFromLocation() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "/report") {
    return url.searchParams.get("scanRunId");
  }
  return null;
}

function getRouteFromLocation(): AppRoute {
  if (typeof window === "undefined") return "landing";
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/landing") return "landing";
  if (path === "/login") return "login";
  if (path === "/report") return "report";
  if (path === "/learn" || path.startsWith("/learn/")) return "learn";
  return "app";
}

function getLearnSlugFromLocation() {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/learn") return null;
  if (!path.startsWith("/learn/")) return null;
  const rawSlug = path.slice("/learn/".length);
  if (!rawSlug) return null;
  try {
    return decodeURIComponent(rawSlug);
  } catch {
    return rawSlug;
  }
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}

const STATUS_TOOLTIPS: Record<number, string> = {
  401: "Unauthorized (auth required)",
  403: "Forbidden (access denied)",
  404: "Not found",
  429: "Rate limited",
  500: "Server error",
};

function statusTooltip(status: number | null) {
  if (status == null) return "No HTTP response";
  if (status >= 500) return STATUS_TOOLTIPS[500];
  return STATUS_TOOLTIPS[status] ?? "";
}

function statusCodeGroup(
  row: Pick<ScanLink, "status_code" | "classification">,
) {
  if (row.status_code == null) return "no_response";
  if (row.status_code >= 500) return "5xx";
  if (row.status_code === 404 || row.status_code === 410) return "404";
  if (
    row.status_code === 401 ||
    row.status_code === 403 ||
    row.status_code === 429
  )
    return "401/403/429";
  return "other";
}

function formatClassification(value: LinkClassification) {
  if (value === "no_response") return "No response";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function changeTypeLabel(value: ScanDiffChangeType) {
  if (value === "new_issue") return "New issue";
  if (value === "fixed") return "Fixed";
  if (value === "changed") return "Changed";
  if (value === "unchanged") return "Unchanged";
  if (value === "added") return "Added";
  return "Removed";
}

function changeTypeTone(value: ScanDiffChangeType | "outstanding_issue") {
  if (value === "new_issue") {
    return { bg: "var(--danger)", text: "white" };
  }
  if (value === "outstanding_issue") {
    return { bg: "var(--warning)", text: "var(--text)" };
  }
  if (value === "fixed") {
    return { bg: "var(--success)", text: "white" };
  }
  if (value === "changed") {
    return { bg: "var(--warning)", text: "var(--text)" };
  }
  if (value === "unchanged") {
    return { bg: "var(--panel-elev)", text: "var(--muted)" };
  }
  if (value === "added") {
    return { bg: "var(--accent)", text: "white" };
  }
  return { bg: "var(--panel-elev)", text: "var(--text)" };
}

function getWhyDetails(row: ScanLink) {
  const status = row.status_code;
  if (status === 401 || status === 403 || status === 429) {
    return {
      title: "Why this happened",
      body: [
        "Access controls or bot protection blocked the request.",
        "Try with authenticated headers or a different User-Agent.",
        "Rate limiting can clear after a cooldown window.",
      ],
    };
  }
  if (status === 404 || status === 410) {
    return {
      title: "Why this happened",
      body: [
        "The resource no longer exists or moved.",
        "Update the link to the new destination or remove it.",
        "Consider adding a redirect if this is your content.",
      ],
    };
  }
  if (status == null || row.classification === "no_response") {
    return {
      title: "Why this happened",
      body: [
        "The server did not respond in time or failed the request.",
        "DNS, TLS/cert, firewall, or network issues can cause timeouts.",
        "Retry later or from a different region to confirm.",
      ],
    };
  }
  if (status >= 500) {
    return {
      title: "Why this happened",
      body: [
        "The server returned an error response.",
        "Check server logs or retry to confirm this is transient.",
        "Consider alerting the owner if it persists.",
      ],
    };
  }
  return {
    title: "Why this happened",
    body: [
      "The response indicates this link needs attention.",
      "Review the source page for context and intended behavior.",
    ],
  };
}

function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function trimDisplayHost(hostname: string) {
  return hostname.replace(/^www\./i, "");
}

function buildAppUrl(
  pathname: string,
  params?: Record<string, string | null | undefined>,
) {
  const url = new URL(window.location.href);
  url.pathname = pathname;
  url.search = "";
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

function buildLearnArticlePath(slug: string) {
  return `/learn/${encodeURIComponent(slug)}`;
}

function buildScanLinksUrl(
  runId: string,
  classification: LinkClassification,
  offset: number,
  statusGroup: StatusGroup,
  showIgnored: boolean,
  limit = LINKS_PAGE_SIZE,
) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    classification,
    statusGroup,
  });
  if (showIgnored) params.set("showIgnored", "true");
  return `${API_BASE}/scan-runs/${encodeURIComponent(runId)}/links?${params.toString()}`;
}

function getFilenameFromDisposition(header: string | null) {
  if (!header) return null;
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? null;
}

function buildIgnoredLinksUrl(
  runId: string,
  offset: number,
  limit = LINKS_PAGE_SIZE,
) {
  return `${API_BASE}/scan-runs/${encodeURIComponent(runId)}/ignored?limit=${limit}&offset=${offset}`;
}

function getSummaryCount(
  rows: ScanLinksSummaryRow[],
  classification: LinkClassification,
) {
  return rows
    .filter((row) => row.classification === classification)
    .reduce((sum, row) => sum + row.count, 0);
}

function createEmptyReportSections(): Record<
  ReportSectionKey,
  ReportLinkSectionState
> {
  return {
    broken: { ...EMPTY_REPORT_SECTION, links: [] },
    blocked: { ...EMPTY_REPORT_SECTION, links: [] },
    no_response: { ...EMPTY_REPORT_SECTION, links: [] },
  };
}

function createEmptyReportIgnoredSection(): ReportIgnoredSectionState {
  return { ...EMPTY_REPORT_IGNORED_SECTION, links: [] };
}

function matchesLearnArticleQuery(article: LearnArticle, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const haystack = [
    article.title,
    article.summary,
    article.whatItMeans,
    article.whyItMatters,
    article.howToFix,
    article.technicalDetail,
    getLearnCategoryLabel(article.category),
    ...article.keywords,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalizedQuery);
}

type LearnExperienceProps = {
  isAuthenticated: boolean;
  currentArticle: LearnArticle | null;
  articleMissing: boolean;
  featuredArticles: LearnArticle[];
  filteredArticles: LearnArticle[];
  searchQuery: string;
  selectedCategory: LearnCategoryFilter;
  onSearchChange: (value: string) => void;
  onSelectCategory: (value: LearnCategoryFilter) => void;
  onOpenArticle: (slug: string) => void;
  onBackToIndex: () => void;
  onBackToLanding: () => void;
  onOpenApp: () => void;
  onOpenLogin: () => void;
  onClearFilters: () => void;
};

function LearnExperience({
  isAuthenticated,
  currentArticle,
  articleMissing,
  featuredArticles,
  filteredArticles,
  searchQuery,
  selectedCategory,
  onSearchChange,
  onSelectCategory,
  onOpenArticle,
  onBackToIndex,
  onBackToLanding,
  onOpenApp,
  onOpenLogin,
  onClearFilters,
}: LearnExperienceProps) {
  const relatedArticles = currentArticle
    ? currentArticle.relatedArticleSlugs
        .map((slug) => LEARN_ARTICLES_BY_SLUG[slug])
        .filter((article): article is LearnArticle => Boolean(article))
    : [];

  return (
    <div className="learn-page">
      <div className="learn-page__shell">
        <section className="learn-hero">
          <div className="learn-hero__copy">
            <div className="marketing-kicker">Scanlark Learn</div>
            <h1>
              {currentArticle
                ? currentArticle.title
                : "Plain-English guides for website health and monitoring reports."}
            </h1>
            <p>
              {currentArticle
                ? currentArticle.summary
                : "Search practical explanations for broken links, SEO basics, search access, security setup, speed checks, and report terminology."}
            </p>
          </div>
          <div className="learn-hero__actions">
            {currentArticle ? (
              <button className="secondary-button" onClick={onBackToIndex}>
                Back to Learn
              </button>
            ) : (
              <button className="secondary-button" onClick={onBackToLanding}>
                Back to landing
              </button>
            )}
            <button
              className="primary-button"
              onClick={isAuthenticated ? onOpenApp : onOpenLogin}
            >
              {isAuthenticated ? "Open dashboard" : "Sign in"}
            </button>
          </div>
        </section>

        {currentArticle ? (
          <section className="learn-detail">
            <div className="learn-detail__meta">
              <span className="marketing-chip">
                {getLearnCategoryLabel(currentArticle.category)}
              </span>
              <span className="marketing-chip">
                Audience:{" "}
                {currentArticle.audience === "mixed"
                  ? "Mixed"
                  : "Non-technical"}
              </span>
            </div>

            <div className="learn-detail__grid">
              <article className="learn-surface learn-detail__main">
                <div className="learn-detail__section">
                  <h2>What it means</h2>
                  <p>{currentArticle.whatItMeans}</p>
                </div>
                <div className="learn-detail__section">
                  <h2>Why it matters</h2>
                  <p>{currentArticle.whyItMatters}</p>
                </div>
                <div className="learn-detail__section">
                  <h2>What to do next</h2>
                  <p>{currentArticle.howToFix}</p>
                </div>
                <details className="learn-detail__technical">
                  <summary>Technical detail</summary>
                  <p>{currentArticle.technicalDetail}</p>
                </details>
              </article>

              <aside className="learn-surface learn-detail__side">
                <div className="learn-detail__side-block">
                  <div className="learn-detail__eyebrow">Related topics</div>
                  <div className="learn-related-list">
                    {relatedArticles.length > 0 ? (
                      relatedArticles.map((article) => (
                        <button
                          key={article.slug}
                          className="learn-related-card"
                          onClick={() => onOpenArticle(article.slug)}
                        >
                          <strong>{article.title}</strong>
                          <span>{article.summary}</span>
                        </button>
                      ))
                    ) : (
                      <div className="learn-empty-note">
                        More related topics will appear here as the library
                        grows.
                      </div>
                    )}
                  </div>
                </div>
                <div className="learn-detail__side-block">
                  <div className="learn-detail__eyebrow">Coverage</div>
                  <div className="learn-keyword-list">
                    {currentArticle.keywords.map((keyword) => (
                      <span key={keyword} className="learn-keyword">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : articleMissing ? (
          <section className="learn-surface learn-state">
            <div className="learn-detail__eyebrow">Article not found</div>
            <h2>This Learn article does not exist yet.</h2>
            <p>
              The slug is valid as a route, but there is no matching article in
              the current MVP catalogue. Use the index to continue browsing the
              available guides.
            </p>
            <div className="learn-state__actions">
              <button className="primary-button" onClick={onBackToIndex}>
                Browse Learn articles
              </button>
              <button className="secondary-button" onClick={onBackToLanding}>
                Back to landing
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="learn-surface learn-controls">
              <label className="field-label">
                Search topics
                <input
                  className="app-input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search reports, SEO, security, speed, and monitoring terms"
                />
              </label>

              <div className="learn-filter-row">
                <button
                  className={`learn-filter-chip ${selectedCategory === "all" ? "active" : ""}`}
                  onClick={() => onSelectCategory("all")}
                >
                  All topics
                </button>
                {LEARN_CATEGORY_ORDER.map((category) => (
                  <button
                    key={category}
                    className={`learn-filter-chip ${selectedCategory === category ? "active" : ""}`}
                    onClick={() => onSelectCategory(category)}
                  >
                    {getLearnCategoryLabel(category)}
                  </button>
                ))}
              </div>
            </section>

            <section className="learn-section">
              <div className="learn-section__header">
                <div>
                  <div className="learn-detail__eyebrow">Start here</div>
                  <h2>Popular guides</h2>
                </div>
              </div>
              <div className="learn-feature-grid">
                {featuredArticles.map((article) => (
                  <button
                    key={article.slug}
                    className="learn-feature-card"
                    onClick={() => onOpenArticle(article.slug)}
                  >
                    <span className="learn-feature-card__category">
                      {getLearnCategoryLabel(article.category)}
                    </span>
                    <strong>{article.title}</strong>
                    <p>{article.summary}</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="learn-section">
              <div className="learn-section__header">
                <div>
                  <div className="learn-detail__eyebrow">Knowledge base</div>
                  <h2>{filteredArticles.length} article(s)</h2>
                </div>
                {(searchQuery.trim() || selectedCategory !== "all") && (
                  <button className="ghost-button" onClick={onClearFilters}>
                    Clear filters
                  </button>
                )}
              </div>

              {filteredArticles.length === 0 ? (
                <div className="learn-surface learn-empty-state">
                  <h3>No articles match those filters.</h3>
                  <p>
                    Try a broader search term or switch back to all categories.
                  </p>
                </div>
              ) : (
                <div className="learn-article-grid">
                  {filteredArticles.map((article) => (
                    <button
                      key={article.slug}
                      className="learn-article-card"
                      onClick={() => onOpenArticle(article.slug)}
                    >
                      <div className="learn-article-card__top">
                        <span className="learn-article-card__category">
                          {getLearnCategoryLabel(article.category)}
                        </span>
                        <span className="learn-article-card__audience">
                          {article.audience === "mixed"
                            ? "Mixed audience"
                            : "Non-technical"}
                        </span>
                      </div>
                      <strong>{article.title}</strong>
                      <p>{article.summary}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

type LoadHistoryOpts = {
  preserveSelection?: boolean;
  skipResultsWhileInProgress?: boolean;
};

const App: React.FC = () => {
  const scansRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();

  const sseRef = useRef<EventSource | null>(null);
  const sseRetryTimerRef = useRef<number | null>(null);
  const sseFallbackTimerRef = useRef<number | null>(null);
  const sseBackoffRef = useRef(1000);
  const runStatusRef = useRef<Map<string, ScanStatus>>(new Map());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filterDropdownRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const detailsDrawerRef = useRef<HTMLDivElement | null>(null);
  const detailsCloseRef = useRef<HTMLButtonElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const progressDismissRef = useRef<number | null>(null);
  const lastRunStatusRef = useRef<{
    id: string | null;
    status: ScanStatus | null;
  }>({ id: null, status: null });

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authWorking, setAuthWorking] = useState(false);

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const res = await fetch(input, { ...init, credentials: "include" });
      if (res.status === 401) {
        setAuthUser(null);
      }
      return res;
    },
    [setAuthUser],
  );

  const selectedSiteIdRef = useRef<string | null>(null);
  const selectedRunIdRef = useRef<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteNameById, setSiteNameById] = useState<Record<string, string>>({});
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingSiteUrl, setOnboardingSiteUrl] = useState("");
  const [onboardingSiteName, setOnboardingSiteName] = useState("");
  const [onboardingWorking, setOnboardingWorking] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingScanRequested, setOnboardingScanRequested] = useState(false);

  const [history, setHistory] = useState<ScanRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [dashboardObservedScanRunId, setDashboardObservedScanRunId] = useState<
    string | null
  >(null);
  const [dashboardRecentlyFinishedRunId, setDashboardRecentlyFinishedRunId] =
    useState<string | null>(null);
  const [results, setResults] = useState<ScanLink[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => getRouteFromLocation());
  const [learnSlug, setLearnSlug] = useState<string | null>(() =>
    getLearnSlugFromLocation(),
  );
  const [learnSearchQuery, setLearnSearchQuery] = useState("");
  const [learnCategoryFilter, setLearnCategoryFilter] =
    useState<LearnCategoryFilter>("all");
  const [appSection, setAppSection] = useState<AppSection>("dashboard");
  const [viewMode, setViewMode] = useState<"dashboard" | "report">(() =>
    getReportScanRunIdFromLocation() ? "report" : "dashboard",
  );
  const [reportScanRunId, setReportScanRunId] = useState<string | null>(() =>
    getReportScanRunIdFromLocation(),
  );
  const [reportRunData, setReportRunData] = useState<ScanRunSummary | null>(
    null,
  );
  const [reportSummaryRows, setReportSummaryRows] = useState<
    ScanLinksSummaryRow[]
  >([]);
  const [reportIgnoredTotal, setReportIgnoredTotal] = useState<number | null>(
    null,
  );
  const [reportSections, setReportSections] = useState<
    Record<ReportSectionKey, ReportLinkSectionState>
  >(EMPTY_REPORT_SECTIONS);
  const [reportIgnoredSection, setReportIgnoredSection] =
    useState<ReportIgnoredSectionState>(EMPTY_REPORT_IGNORED_SECTION);
  const [reportIssues, setReportIssues] = useState<ReportIssuesState>(
    EMPTY_REPORT_ISSUES_STATE,
  );
  const [reportIssueFilter, setReportIssueFilter] =
    useState<ReportIssueFilter>("all");
  const [reportFilteredIssueStates, setReportFilteredIssueStates] = useState<
    Partial<Record<ReportIssueFilter, ReportIssuesState>>
  >({});
  const [reportVisibleIssueCount, setReportVisibleIssueCount] = useState(
    REPORT_INITIAL_VISIBLE_ROWS,
  );
  const [reportResolvedExpanded, setReportResolvedExpanded] = useState(false);
  const [reportVisibleSectionCounts, setReportVisibleSectionCounts] = useState<
    Record<ReportSectionKey, number>
  >({
    broken: REPORT_INITIAL_VISIBLE_ROWS,
    blocked: REPORT_INITIAL_VISIBLE_ROWS,
    no_response: REPORT_INITIAL_VISIBLE_ROWS,
  });
  const [reportVisibleIgnoredCount, setReportVisibleIgnoredCount] = useState(
    REPORT_INITIAL_VISIBLE_ROWS,
  );
  const [reportSectionsLoaded, setReportSectionsLoaded] = useState(false);
  const [reportLastLoadedAt, setReportLastLoadedAt] = useState<number | null>(
    null,
  );
  const [reportTechnicalDiagnostics, setReportTechnicalDiagnostics] =
    useState<Phase0Diagnostics | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Separate pagination tracking for broken and blocked
  const [brokenOffset, setBrokenOffset] = useState(0);
  const [brokenHasMore, setBrokenHasMore] = useState(false);
  const [blockedOffset, setBlockedOffset] = useState(0);
  const [blockedHasMore, setBlockedHasMore] = useState(false);
  const [okOffset, setOkOffset] = useState(0);
  const [okHasMore, setOkHasMore] = useState(false);
  const [noResponseOffset, setNoResponseOffset] = useState(0);
  const [noResponseHasMore, setNoResponseHasMore] = useState(false);
  const [ignoredResults, setIgnoredResults] = useState<IgnoredLinkRow[]>([]);
  const [ignoredOffset, setIgnoredOffset] = useState(0);
  const [ignoredHasMore, setIgnoredHasMore] = useState(false);
  const [ignoredLoading, setIgnoredLoading] = useState(false);
  const [ignoredError, setIgnoredError] = useState<string | null>(null);
  const [ignoredOccurrences, setIgnoredOccurrences] = useState<
    Record<string, ScanLinkOccurrence[]>
  >({});
  const [ignoredOccLoading, setIgnoredOccLoading] = useState<
    Record<string, boolean>
  >({});
  const [ignoredOccError, setIgnoredOccError] = useState<
    Record<string, string | null>
  >({});
  const [phase0Diagnostics, setPhase0Diagnostics] =
    useState<Phase0Diagnostics | null>(null);
  const [phase0DiagnosticsLoading, setPhase0DiagnosticsLoading] =
    useState(false);

  const [occurrencesByLinkId, setOccurrencesByLinkId] = useState<
    Record<string, ScanLinkOccurrence[]>
  >({});
  const [occurrencesOffsetByLinkId, setOccurrencesOffsetByLinkId] = useState<
    Record<string, number>
  >({});
  const [occurrencesHasMoreByLinkId, setOccurrencesHasMoreByLinkId] = useState<
    Record<string, boolean>
  >({});
  const [occurrencesLoadingByLinkId, setOccurrencesLoadingByLinkId] = useState<
    Record<string, boolean>
  >({});
  const [occurrencesTotalByLinkId, setOccurrencesTotalByLinkId] = useState<
    Record<string, number>
  >({});
  const [occurrencesErrorByLinkId, setOccurrencesErrorByLinkId] = useState<
    Record<string, string | null>
  >({});

  const [startUrl, setStartUrl] = useState("");
  const [triggeringScan, setTriggeringScan] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [creatingSite, setCreatingSite] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [lastProgressAtByRunId, setLastProgressAtByRunId] = useState<
    Record<string, number>
  >({});
  const [progressPhase, setProgressPhase] = useState<
    "hidden" | "running" | "completed"
  >("hidden");
  const [themePreference, setThemePreference] =
    useState<ThemePreference>("system");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [paneWidth, setPaneWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("all");
  const [showIgnored, setShowIgnored] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Record<string, boolean>>(
    {},
  );
  const [minOccurrencesOnly, setMinOccurrencesOnly] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>("severity");
  const [siteSearch, setSiteSearch] = useState("");
  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      message: string;
      tone?: "success" | "warning" | "info";
      action?: { label: string; onClick: () => void };
    }>
  >([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLinkId, setDetailsLinkId] = useState<string | null>(null);
  const [recheckLoadingId, setRecheckLoadingId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [ignoreRulesOpen, setIgnoreRulesOpen] = useState(false);
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([]);
  const [ignoreRulesLoading, setIgnoreRulesLoading] = useState(false);
  const [ignoreRulesError, setIgnoreRulesError] = useState<string | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState<
    "manual" | "daily" | "weekly" | "monthly"
  >("manual");
  const [scheduleTimeUtc, setScheduleTimeUtc] = useState("02:00");
  const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
  const [scheduleDayOfMonth, setScheduleDayOfMonth] = useState(1);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyOn, setNotifyOn] = useState<NotifyOnOption>("new_issues_only");
  const [notifyIncludeCsv, setNotifyIncludeCsv] = useState(false);
  const [summaryEnabled, setSummaryEnabled] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyTestSending, setNotifyTestSending] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [uptimeEnabled, setUptimeEnabled] = useState(false);
  const [uptimeCheckUrl, setUptimeCheckUrl] = useState("");
  const [uptimeFailureThreshold, setUptimeFailureThreshold] = useState(3);
  const [uptimeSaving, setUptimeSaving] = useState(false);
  const [uptimeError, setUptimeError] = useState<string | null>(null);
  const [newRuleType, setNewRuleType] =
    useState<IgnoreRule["rule_type"]>("domain");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleScope, setNewRuleScope] = useState<"site" | "global">("site");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [resultsView, setResultsView] = useState<FixQueueView>("results");
  const [scanWorkspaceOpen, setScanWorkspaceOpen] = useState(false);
  const [diffIssuesOnly, setDiffIssuesOnly] = useState(true);
  const [includeUnchanged, setIncludeUnchanged] = useState(false);
  const [unchangedOnly, setUnchangedOnly] = useState(false);
  const [unchangedOffset, setUnchangedOffset] = useState(0);
  const [unchangedLimit] = useState(50);
  const [diffOkTotal, setDiffOkTotal] = useState(0);
  const [diffIncludeIgnored, setDiffIncludeIgnored] = useState(false);
  const [diffExportFilter, setDiffExportFilter] = useState<
    "all" | "new_issue" | "fixed" | "changed" | "added" | "removed"
  >("all");
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteTargetUrl, setNoteTargetUrl] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<LinkNoteStatus>("open");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteDeleting, setNoteDeleting] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [fixQueueIncludeNew, setFixQueueIncludeNew] = useState(true);
  const [fixQueueIncludeOutstanding, setFixQueueIncludeOutstanding] =
    useState(true);
  const [fixQueueIncludeIgnored, setFixQueueIncludeIgnored] = useState(false);
  const [fixQueueStatus, setFixQueueStatus] =
    useState<FixQueueStatusFilter>("open");
  const [fixQueueOffset, setFixQueueOffset] = useState(0);
  const [fixQueueLimit] = useState(50);
  const [fixQueueExpanded, setFixQueueExpanded] = useState<
    Record<string, boolean>
  >({});
  const [isNarrow, setIsNarrow] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasSites = sites.length > 0;
  const localTimeZone = useMemo(() => getLocalTimeZone(), []);
  const onboardingStorageKey = authUser
    ? getStorageKey(ONBOARDING_STORAGE_PREFIX, authUser.id)
    : null;
  const siteNamesStorageKey = authUser
    ? getStorageKey(SITE_NAME_STORAGE_PREFIX, authUser.id)
    : null;
  const showLocalTimeZone = localTimeZone && localTimeZone !== "UTC";

  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId;
  }, [selectedSiteId]);

  useEffect(() => {
    selectedRunIdRef.current = selectedRunId;
  }, [selectedRunId]);

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  useEffect(() => {
    if (!siteNamesStorageKey) {
      setSiteNameById({});
      return;
    }
    const map = loadStorageMap(siteNamesStorageKey);
    setSiteNameById(map as Record<string, string>);
  }, [siteNamesStorageKey]);

  useEffect(() => {
    const handlePopState = () => {
      const nextRoute = getRouteFromLocation();
      const nextReportId = getReportScanRunIdFromLocation();
      setRoute(nextRoute);
      setLearnSlug(getLearnSlugFromLocation());
      setReportScanRunId(nextReportId);
      setViewMode(
        nextRoute === "report" && nextReportId ? "report" : "dashboard",
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!authUser || route !== "login") return;
    navigateTo("/app");
  }, [authUser, route]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!actionMenuOpenId) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu]")) return;
      setActionMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [actionMenuOpenId]);

  const pinnedRunId = activeRunId ?? selectedRunId;

  const selectedRun = useMemo(() => {
    if (pinnedRunId) {
      const found = history.find((r) => r.id === pinnedRunId);
      if (found) return found;
    }
    return history.length > 0 ? history[0] : null;
  }, [history, pinnedRunId]);

  const resetReportSections = useCallback(() => {
    setReportSections(createEmptyReportSections());
    setReportIgnoredSection(createEmptyReportIgnoredSection());
    setReportIssues(EMPTY_REPORT_ISSUES_STATE);
    setReportTechnicalDiagnostics(null);
    setReportFilteredIssueStates({});
    setReportIssueFilter("all");
    setReportVisibleIssueCount(REPORT_INITIAL_VISIBLE_ROWS);
    setReportResolvedExpanded(false);
    setReportVisibleSectionCounts({
      broken: REPORT_INITIAL_VISIBLE_ROWS,
      blocked: REPORT_INITIAL_VISIBLE_ROWS,
      no_response: REPORT_INITIAL_VISIBLE_ROWS,
    });
    setReportVisibleIgnoredCount(REPORT_INITIAL_VISIBLE_ROWS);
    setReportSectionsLoaded(false);
  }, []);

  const fetchReportScanLinksPage = useCallback(
    async (
      runId: string,
      classification: LinkClassification,
      offset: number,
    ): Promise<ScanLinksResponse> => {
      const res = await apiFetch(
        buildScanLinksUrl(runId, classification, offset, "all", false),
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(
          `Failed to load ${formatClassification(classification).toLowerCase()} links: ${res.status}`,
        );
      }
      return (await res.json()) as ScanLinksResponse;
    },
    [apiFetch],
  );

  const loadReportOverview = useCallback(
    async (scanRunId: string) => {
      const [runRes, summaryRes, ignoredRes, diagnosticsRes] =
        await Promise.all([
          apiFetch(`${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}`, {
            cache: "no-store",
          }),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/links/summary`,
            { cache: "no-store" },
          ),
          apiFetch(buildIgnoredLinksUrl(scanRunId, 0, 1), {
            cache: "no-store",
          }),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/technical-diagnostics`,
            { cache: "no-store" },
          ),
        ]);

      if (!runRes.ok) {
        if (runRes.status === 404) {
          throw new Error("Report not found for this scan run");
        }
        if (runRes.status === 401) {
          throw new Error("You do not have access to this scan report");
        }
        const text = await runRes.text().catch(() => "");
        throw new Error(
          `Failed to load scan run: ${runRes.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      if (!summaryRes.ok) {
        throw new Error(`Failed to load link summary: ${summaryRes.status}`);
      }
      if (!ignoredRes.ok) {
        throw new Error(`Failed to load ignored links: ${ignoredRes.status}`);
      }
      if (!diagnosticsRes.ok) {
        throw new Error(
          `Failed to load technical diagnostics: ${diagnosticsRes.status}`,
        );
      }

      const run = (await runRes.json()) as ScanRunSummary;
      const summaryData = (await summaryRes.json()) as ScanLinksSummaryResponse;
      const ignoredData = (await ignoredRes.json()) as IgnoredLinksResponse;
      const diagnosticsData =
        (await diagnosticsRes.json()) as ScanTechnicalDiagnosticsResponse;

      setReportRunData(run);
      setReportSummaryRows(summaryData.summary ?? []);
      setReportIgnoredTotal(ignoredData.totalMatching ?? 0);
      setReportLastLoadedAt(Date.now());
      setReportTechnicalDiagnostics({
        scanRunId,
        ok: null,
        broken: null,
        blocked: null,
        noResponse: null,
        ignoredSkipped: null,
        categoryScores: diagnosticsData.categoryScores ?? null,
        seoBasic: diagnosticsData.seoBasic,
        robots: diagnosticsData.robots,
        sitemap: diagnosticsData.sitemap,
        sslHttps: diagnosticsData.sslHttps,
        securityHeader: diagnosticsData.securityHeader,
        performanceBasic: diagnosticsData.performanceBasic,
        error: null,
        loadedAt: diagnosticsData.loadedAt
          ? new Date(diagnosticsData.loadedAt).getTime()
          : Date.now(),
      });

      return run;
    },
    [apiFetch],
  );

  const loadInitialReportSections = useCallback(
    async (scanRunId: string) => {
      setReportSectionsLoaded(false);
      setReportSections((prev) => ({
        broken: { ...prev.broken, loading: true, error: null },
        blocked: { ...prev.blocked, loading: true, error: null },
        no_response: { ...prev.no_response, loading: true, error: null },
      }));
      setReportIgnoredSection((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      const sectionEntries: Array<[ReportSectionKey, LinkClassification]> = [
        ["broken", "broken"],
        ["blocked", "blocked"],
        ["no_response", "no_response"],
      ];

      const sectionResults = await Promise.all(
        sectionEntries.map(async ([key, classification]) => {
          try {
            const data = await fetchReportScanLinksPage(
              scanRunId,
              classification,
              0,
            );
            return { key, data, error: null as string | null };
          } catch (err: unknown) {
            return {
              key,
              data: null,
              error: getErrorMessage(err, "Failed to load report section"),
            };
          }
        }),
      );

      setReportSections(() => {
        const next = createEmptyReportSections();
        sectionResults.forEach(({ key, data, error }) => {
          next[key] = {
            links: data?.links ?? [],
            offset: data?.countReturned ?? 0,
            hasMore: data ? data.countReturned < data.totalMatching : false,
            loading: false,
            error,
          };
        });
        return next;
      });

      try {
        const ignoredRes = await apiFetch(
          buildIgnoredLinksUrl(scanRunId, 0, LINKS_PAGE_SIZE),
          {
            cache: "no-store",
          },
        );
        if (!ignoredRes.ok) {
          throw new Error(`Failed to load ignored links: ${ignoredRes.status}`);
        }
        const ignoredData = (await ignoredRes.json()) as IgnoredLinksResponse;
        setReportIgnoredSection({
          links: ignoredData.links ?? [],
          offset: ignoredData.countReturned,
          hasMore: ignoredData.countReturned < ignoredData.totalMatching,
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        setReportIgnoredSection((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(err, "Failed to load ignored links"),
        }));
      }
      setReportSectionsLoaded(true);
    },
    [apiFetch, fetchReportScanLinksPage],
  );

  const loadInitialReportIssues = useCallback(
    async (scanRunId: string) => {
      setReportIssues((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const [
          allRes,
          linkRes,
          seoRes,
          robotsRes,
          sitemapRes,
          sslRes,
          securityRes,
          performanceRes,
        ] = await Promise.all([
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?limit=${LINKS_PAGE_SIZE}&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=link_integrity&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=seo_basic&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=robots&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=sitemap&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=ssl_https&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=security_header&limit=1&offset=0`,
            { cache: "no-store" },
          ),
          apiFetch(
            `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?category=performance_basic&limit=1&offset=0`,
            { cache: "no-store" },
          ),
        ]);
        if (!allRes.ok) {
          throw new Error(`Failed to load issues: ${allRes.status}`);
        }
        if (!linkRes.ok) {
          throw new Error(
            `Failed to load link integrity issue summary: ${linkRes.status}`,
          );
        }
        if (!seoRes.ok) {
          throw new Error(`Failed to load SEO issue summary: ${seoRes.status}`);
        }
        if (!robotsRes.ok) {
          throw new Error(
            `Failed to load robots issue summary: ${robotsRes.status}`,
          );
        }
        if (!sitemapRes.ok) {
          throw new Error(
            `Failed to load sitemap issue summary: ${sitemapRes.status}`,
          );
        }
        if (!sslRes.ok) {
          throw new Error(`Failed to load SSL issue summary: ${sslRes.status}`);
        }
        if (!securityRes.ok) {
          throw new Error(
            `Failed to load security issue summary: ${securityRes.status}`,
          );
        }
        if (!performanceRes.ok) {
          throw new Error(
            `Failed to load performance issue summary: ${performanceRes.status}`,
          );
        }
        const data = (await allRes.json()) as ScanIssuesResponse;
        const linkData = (await linkRes.json()) as ScanIssuesResponse;
        const seoData = (await seoRes.json()) as ScanIssuesResponse;
        const robotsData = (await robotsRes.json()) as ScanIssuesResponse;
        const sitemapData = (await sitemapRes.json()) as ScanIssuesResponse;
        const sslData = (await sslRes.json()) as ScanIssuesResponse;
        const securityData = (await securityRes.json()) as ScanIssuesResponse;
        const performanceData =
          (await performanceRes.json()) as ScanIssuesResponse;
        setReportIssues({
          issues: data.issues ?? [],
          resolvedIssues: data.resolvedIssues ?? [],
          resolvedCount: data.resolvedCount ?? 0,
          summary: data.summary,
          summariesByCategory: {
            link_integrity: linkData.summary,
            seo_basic: seoData.summary,
            robots: robotsData.summary,
            sitemap: sitemapData.summary,
            ssl_https: sslData.summary,
            security_header: securityData.summary,
            performance_basic: performanceData.summary,
          },
          offset: data.countReturned,
          hasMore: data.countReturned < data.totalMatching,
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        setReportIssues((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(err, "Failed to load issues"),
        }));
      }
    },
    [apiFetch],
  );

  const buildReportIssuesUrl = useCallback(
    (
      scanRunId: string,
      filter: ReportIssueFilter,
      offset: number,
      limit = LINKS_PAGE_SIZE,
    ) => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (
        filter === "high" ||
        filter === "medium" ||
        filter === "low" ||
        filter === "info"
      ) {
        params.set("severity", filter);
      } else if (
        filter === "link_integrity" ||
        filter === "seo_basic" ||
        filter === "performance_basic"
      ) {
        params.set("category", filter);
      }
      return `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?${params.toString()}`;
    },
    [],
  );

  const loadFilteredReportIssues = useCallback(
    async (scanRunId: string, filter: ReportIssueFilter, offset = 0) => {
      if (filter === "all") return;
      setReportFilteredIssueStates((prev) => ({
        ...prev,
        [filter]: {
          ...(prev[filter] ?? EMPTY_REPORT_ISSUES_STATE),
          loading: true,
          error: null,
        },
      }));
      try {
        const res = await apiFetch(
          buildReportIssuesUrl(scanRunId, filter, offset),
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Failed to load filtered issues: ${res.status}`);
        }
        const data = (await res.json()) as ScanIssuesResponse;
        setReportFilteredIssueStates((prev) => {
          const existing = prev[filter] ?? EMPTY_REPORT_ISSUES_STATE;
          const isInitial = offset === 0;
          return {
            ...prev,
            [filter]: {
              ...existing,
              issues: isInitial
                ? (data.issues ?? [])
                : [...existing.issues, ...(data.issues ?? [])],
              resolvedIssues: isInitial
                ? (data.resolvedIssues ?? [])
                : existing.resolvedIssues,
              resolvedCount: data.resolvedCount ?? existing.resolvedCount ?? 0,
              summary: data.summary,
              offset: isInitial
                ? data.countReturned
                : existing.offset + data.countReturned,
              hasMore: isInitial
                ? data.countReturned < data.totalMatching
                : existing.offset + data.countReturned < data.totalMatching,
              loading: false,
              error: null,
            },
          };
        });
      } catch (err: unknown) {
        setReportFilteredIssueStates((prev) => ({
          ...prev,
          [filter]: {
            ...(prev[filter] ?? EMPTY_REPORT_ISSUES_STATE),
            loading: false,
            error: getErrorMessage(err, "Failed to load filtered issues"),
          },
        }));
      }
    },
    [apiFetch, buildReportIssuesUrl],
  );

  const loadMoreReportIssues = useCallback(
    async (scanRunId: string) => {
      if (reportIssues.loading || !reportIssues.hasMore) return;
      setReportIssues((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await apiFetch(
          `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/issues?limit=${LINKS_PAGE_SIZE}&offset=${reportIssues.offset}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`Failed to load issues: ${res.status}`);
        }
        const data = (await res.json()) as ScanIssuesResponse;
        setReportIssues((prev) => ({
          ...prev,
          issues: [...prev.issues, ...(data.issues ?? [])],
          resolvedIssues:
            prev.resolvedIssues.length > 0
              ? prev.resolvedIssues
              : (data.resolvedIssues ?? []),
          resolvedCount: data.resolvedCount ?? prev.resolvedCount,
          summary: prev.summary ?? data.summary,
          offset: prev.offset + data.countReturned,
          hasMore: prev.offset + data.countReturned < data.totalMatching,
          loading: false,
          error: null,
        }));
      } catch (err: unknown) {
        setReportIssues((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(err, "Failed to load more issues"),
        }));
      }
    },
    [apiFetch, reportIssues],
  );

  const loadMoreReportSection = useCallback(
    async (scanRunId: string, section: ReportSectionKey) => {
      const current = reportSections[section];
      if (current.loading || !current.hasMore) return;
      setReportSections((prev) => ({
        ...prev,
        [section]: { ...prev[section], loading: true, error: null },
      }));
      try {
        const data = await fetchReportScanLinksPage(
          scanRunId,
          section,
          current.offset,
        );
        setReportSections((prev) => ({
          ...prev,
          [section]: {
            links: [...prev[section].links, ...(data.links ?? [])],
            offset: prev[section].offset + data.countReturned,
            hasMore:
              prev[section].offset + data.countReturned < data.totalMatching,
            loading: false,
            error: null,
          },
        }));
      } catch (err: unknown) {
        setReportSections((prev) => ({
          ...prev,
          [section]: {
            ...prev[section],
            loading: false,
            error: getErrorMessage(err, "Failed to load more results"),
          },
        }));
      }
    },
    [fetchReportScanLinksPage, reportSections],
  );

  const loadMoreReportIgnored = useCallback(
    async (scanRunId: string) => {
      if (reportIgnoredSection.loading || !reportIgnoredSection.hasMore) return;
      setReportIgnoredSection((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));
      try {
        const res = await apiFetch(
          buildIgnoredLinksUrl(
            scanRunId,
            reportIgnoredSection.offset,
            LINKS_PAGE_SIZE,
          ),
          { cache: "no-store" },
        );
        if (!res.ok)
          throw new Error(`Failed to load ignored links: ${res.status}`);
        const data = (await res.json()) as IgnoredLinksResponse;
        setReportIgnoredSection((prev) => ({
          links: [...prev.links, ...(data.links ?? [])],
          offset: prev.offset + data.countReturned,
          hasMore: prev.offset + data.countReturned < data.totalMatching,
          loading: false,
          error: null,
        }));
      } catch (err: unknown) {
        setReportIgnoredSection((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(err, "Failed to load more ignored links"),
        }));
      }
    },
    [apiFetch, reportIgnoredSection],
  );

  useEffect(() => {
    if (viewMode !== "report") return;
    if (!reportScanRunId) {
      setReportRunData(null);
      setReportSummaryRows([]);
      setReportIgnoredTotal(null);
      setReportLastLoadedAt(null);
      resetReportSections();
      setReportError("Missing scan run id");
      return;
    }
    let cancelled = false;
    const loadReport = async () => {
      setReportLoading(true);
      setReportError(null);
      try {
        resetReportSections();
        await loadReportOverview(reportScanRunId);
      } catch (err) {
        if (!cancelled) {
          setReportError(getErrorMessage(err, "Failed to load report"));
        }
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [loadReportOverview, reportScanRunId, resetReportSections, viewMode]);

  useEffect(() => {
    if (
      viewMode !== "report" ||
      !reportScanRunId ||
      !isInProgress(reportRunData?.status)
    ) {
      return;
    }
    const id = window.setTimeout(() => {
      void loadReportOverview(reportScanRunId).catch((err) => {
        setReportError(getErrorMessage(err, "Failed to refresh report"));
      });
    }, 3000);
    return () => window.clearTimeout(id);
  }, [
    loadReportOverview,
    reportRunData?.checked_links,
    reportRunData?.status,
    reportRunData?.total_links,
    reportRunData?.updated_at,
    reportScanRunId,
    viewMode,
  ]);

  useEffect(() => {
    if (
      viewMode !== "report" ||
      !reportScanRunId ||
      reportRunData?.status !== "completed" ||
      reportSectionsLoaded
    ) {
      return;
    }
    void Promise.all([
      loadInitialReportSections(reportScanRunId),
      loadInitialReportIssues(reportScanRunId),
    ]).catch((err) => {
      setReportError(getErrorMessage(err, "Failed to load report sections"));
    });
  }, [
    loadInitialReportIssues,
    loadInitialReportSections,
    reportRunData?.status,
    reportScanRunId,
    reportSectionsLoaded,
    viewMode,
  ]);

  useEffect(() => {
    if (
      viewMode !== "report" ||
      !reportScanRunId ||
      reportIssueFilter === "all" ||
      !reportIssues.hasMore
    ) {
      return;
    }
    const filteredState = reportFilteredIssueStates[reportIssueFilter];
    if (
      filteredState &&
      (filteredState.issues.length > 0 || filteredState.loading)
    ) {
      return;
    }
    void loadFilteredReportIssues(reportScanRunId, reportIssueFilter, 0);
  }, [
    loadFilteredReportIssues,
    reportFilteredIssueStates,
    reportIssueFilter,
    reportIssues.hasMore,
    reportScanRunId,
    viewMode,
  ]);

  const visibleResults = useMemo(
    () => (showIgnored ? results : results.filter((row) => !row.ignored)),
    [results, showIgnored],
  );

  const brokenResults = useMemo(
    () => visibleResults.filter((r) => r.classification === "broken"),
    [visibleResults],
  );

  const blockedResults = useMemo(
    () => visibleResults.filter((r) => r.classification === "blocked"),
    [visibleResults],
  );

  const noResponseResults = useMemo(
    () => visibleResults.filter((r) => r.classification === "no_response"),
    [visibleResults],
  );

  const currentPhase0Diagnostics =
    phase0Diagnostics?.scanRunId === selectedRunId ? phase0Diagnostics : null;
  const phase0BrokenCount =
    currentPhase0Diagnostics?.broken ??
    selectedRun?.broken_links ??
    brokenResults.length;
  const phase0BlockedCount =
    currentPhase0Diagnostics?.blocked ?? blockedResults.length;
  const phase0NoResponseCount =
    currentPhase0Diagnostics?.noResponse ?? noResponseResults.length;
  const phase0IgnoredSkippedCount =
    currentPhase0Diagnostics?.ignoredSkipped ?? ignoredResults.length;

  const filteredResults = useMemo(() => {
    const source =
      activeTab === "broken"
        ? brokenResults
        : activeTab === "blocked"
          ? blockedResults
          : activeTab === "ok"
            ? visibleResults.filter((row) => row.classification === "ok")
            : activeTab === "no_response"
              ? noResponseResults
              : visibleResults;
    const query = searchQuery.trim().toLowerCase();
    const activeStatusFilters = Object.keys(statusFilters).filter(
      (key) => statusFilters[key],
    );

    let next = source.filter((row) => {
      if (statusGroup === "no_response" && row.classification !== "no_response")
        return false;
      if (statusGroup === "http_error" && row.status_code == null) return false;
      if (query && !row.link_url.toLowerCase().includes(query)) return false;
      if (minOccurrencesOnly && row.occurrence_count <= 1) return false;
      if (
        activeStatusFilters.length > 0 &&
        !activeStatusFilters.includes(statusCodeGroup(row))
      )
        return false;
      return true;
    });

    const severityRank = (row: ScanLink) => {
      if (row.classification === "broken") return 0;
      if (row.classification === "blocked") return 1;
      if (row.classification === "no_response") return 2;
      return 3;
    };
    const lastSeenMs = (row: ScanLink) => {
      const parsed = Date.parse(row.last_seen_at);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    next = [...next].sort((a, b) => {
      if (sortOption === "occ_desc")
        return b.occurrence_count - a.occurrence_count;
      if (sortOption === "status_asc")
        return (a.status_code ?? 0) - (b.status_code ?? 0);
      if (sortOption === "status_desc")
        return (b.status_code ?? 0) - (a.status_code ?? 0);
      if (sortOption === "recent") return lastSeenMs(b) - lastSeenMs(a);
      const diff = severityRank(a) - severityRank(b);
      if (diff !== 0) return diff;
      const occDiff = b.occurrence_count - a.occurrence_count;
      if (occDiff !== 0) return occDiff;
      return lastSeenMs(b) - lastSeenMs(a);
    });

    return next;
  }, [
    activeTab,
    brokenResults,
    blockedResults,
    noResponseResults,
    visibleResults,
    searchQuery,
    statusFilters,
    minOccurrencesOnly,
    sortOption,
    statusGroup,
  ]);

  const hasActiveFilters =
    resultsView === "results" &&
    (activeTab !== "all" ||
      statusGroup !== "all" ||
      showIgnored ||
      searchQuery.trim().length > 0 ||
      minOccurrencesOnly ||
      Object.values(statusFilters).some(Boolean));
  const hasSecondaryFilters =
    statusGroup !== "all" ||
    showIgnored ||
    searchQuery.trim().length > 0 ||
    minOccurrencesOnly ||
    Object.values(statusFilters).some(Boolean);
  const exportDisabled = !selectedRunId;
  const exportLinksDisabled = !selectedRunId;

  const filteredSites = useMemo(() => {
    const query = siteSearch.trim().toLowerCase();
    if (!query) return sites;
    return sites.filter((site) => site.url.toLowerCase().includes(query));
  }, [sites, siteSearch]);

  const isSelectedRunInProgress = isInProgress(selectedRun?.status);
  const isQueued = selectedRun?.status === "queued";
  const isRunning = selectedRun?.status === "in_progress";
  const canCancelRun = !!selectedRun && (isQueued || isRunning);
  const canRetryRun =
    !!selectedRun &&
    (selectedRun.status === "failed" || selectedRun.status === "cancelled");
  const canRescan = !!selectedRun && selectedRun.status === "completed";
  const showProgress = progressPhase !== "hidden" && !!selectedRun;
  const lastProgressAt = useMemo(() => {
    if (!selectedRun) return null;
    if (selectedRun.updated_at) {
      const parsed = new Date(selectedRun.updated_at).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return lastProgressAtByRunId[selectedRun.id] ?? null;
  }, [lastProgressAtByRunId, selectedRun]);

  useEffect(() => {
    if (progressDismissRef.current) {
      window.clearTimeout(progressDismissRef.current);
      progressDismissRef.current = null;
    }

    if (!selectedRun) {
      setProgressPhase("hidden");
      lastRunStatusRef.current = { id: null, status: null };
      return;
    }

    const prev = lastRunStatusRef.current;
    const isSameRun = prev.id === selectedRun.id;
    const prevStatus = isSameRun ? prev.status : null;

    if (
      selectedRun.status === "in_progress" ||
      selectedRun.status === "queued"
    ) {
      setProgressPhase("running");
    } else if (
      selectedRun.status === "completed" &&
      prevStatus === "in_progress"
    ) {
      setProgressPhase("completed");
      progressDismissRef.current = window.setTimeout(() => {
        setProgressPhase("hidden");
      }, PROGRESS_DISMISS_MS);
    } else {
      setProgressPhase("hidden");
    }

    lastRunStatusRef.current = {
      id: selectedRun.id,
      status: selectedRun.status,
    };

    return () => {
      if (progressDismissRef.current) {
        window.clearTimeout(progressDismissRef.current);
        progressDismissRef.current = null;
      }
    };
  }, [selectedRun?.id, selectedRun?.status]);

  const linkNotesQuery = useQuery<LinkNotesResponse, Error>({
    queryKey: ["linkNotes", selectedSiteId],
    enabled: !!selectedSiteId,
    queryFn: async () => {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(
          selectedSiteId ?? "",
        )}/link-notes?status=all`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Link notes failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      return (await res.json()) as LinkNotesResponse;
    },
  });
  const linkNotes = linkNotesQuery.data?.notes ?? [];
  const linkNotesByUrl = useMemo(() => {
    const map = new Map<string, LinkNote>();
    for (const note of linkNotes) {
      map.set(note.link_url, note);
    }
    return map;
  }, [linkNotes]);

  const diffLimit = 200;
  const diffBaseline = compareRunId ?? "prev";
  const diffQueryEnabled = !!selectedSiteId && !!selectedRunId;
  const unchangedScope = diffIssuesOnly ? "issues" : "all";
  const diffQuery = useInfiniteQuery<ScanDiffResponse, Error>({
    queryKey: [
      "scanDiff",
      selectedSiteId,
      selectedRunId,
      diffBaseline,
      diffIssuesOnly,
      includeUnchanged,
      unchangedOnly,
      diffExportFilter,
      diffIncludeIgnored,
      unchangedScope,
      unchangedLimit,
      unchangedOffset,
    ],
    enabled: diffQueryEnabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const pageOffset = typeof pageParam === "number" ? pageParam : 0;
      const includeUnchangedParam = includeUnchanged && pageOffset === 0;
      const params = new URLSearchParams({
        baseline: diffBaseline,
        issuesOnly: diffIssuesOnly ? "true" : "false",
        limit: String(diffLimit),
        offset: String(pageOffset),
        includeUnchanged: includeUnchangedParam ? "true" : "false",
        unchangedOnly: unchangedOnly ? "true" : "false",
        unchangedScope,
        unchangedLimit: String(unchangedLimit),
        unchangedOffset: String(unchangedOffset),
        includeIgnored: diffIncludeIgnored ? "true" : "false",
      });
      if (!unchangedOnly && diffExportFilter !== "all") {
        params.set("changeTypes", diffExportFilter);
      }
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(
          selectedSiteId ?? "",
        )}/scan-runs/${encodeURIComponent(
          selectedRunId ?? "",
        )}/diff?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Diff failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      return (await res.json()) as ScanDiffResponse;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.items.length < diffLimit
        ? undefined
        : allPages.length * diffLimit,
  });

  const diffPages = diffQuery.data?.pages ?? [];
  const diffSummary = diffPages[0]?.summary ?? null;
  const diffBaselineRun = diffPages[0]?.baselineRun ?? null;
  const diffMeta = diffPages[0]?.meta ?? null;
  const diffItems = diffPages.flatMap<ScanDiffItem>((page) => page.items);
  const diffChangeItems = diffItems.filter(
    (item) => item.change_type !== "unchanged",
  );
  const diffUnchangedItems = (diffPages[0]?.items ?? []).filter(
    (item) => item.change_type === "unchanged",
  );
  const diffError = diffQuery.error
    ? getErrorMessage(diffQuery.error, "Failed to load changes")
    : null;
  const diffLoading = diffQuery.isLoading;
  const hasDiffChanges =
    !!diffSummary &&
    (diffSummary.newIssues > 0 ||
      diffSummary.fixedIssues > 0 ||
      diffSummary.changed > 0 ||
      diffSummary.added > 0 ||
      diffSummary.removed > 0);
  const outstandingTotal = diffSummary
    ? diffIssuesOnly
      ? diffSummary.outstandingIssues
      : diffSummary.outstandingTotal
    : 0;
  const canPrevUnchanged = includeUnchanged && unchangedOffset > 0;
  const canNextUnchanged =
    includeUnchanged && unchangedOffset + unchangedLimit < outstandingTotal;

  const fixQueueRunId =
    selectedRun?.status === "completed" ? selectedRun.id : null;
  const fixQueueBaseline =
    compareRunId && compareRunId !== fixQueueRunId ? compareRunId : "prev";
  const fixQueueQueryEnabled = !!selectedSiteId && !!fixQueueRunId;
  const fixQueueUnavailableReason =
    selectedRun && selectedRun.status !== "completed"
      ? "Fix queue is available after this scan completes."
      : null;
  const fixQueueQuery = useQuery<FixQueueResponse, Error>({
    queryKey: [
      "fixQueue",
      selectedSiteId,
      fixQueueRunId,
      fixQueueBaseline,
      fixQueueIncludeNew,
      fixQueueIncludeOutstanding,
      fixQueueIncludeIgnored,
      fixQueueStatus,
      fixQueueLimit,
      fixQueueOffset,
    ],
    enabled: fixQueueQueryEnabled,
    queryFn: async () => {
      const params = new URLSearchParams({
        baseline: fixQueueBaseline,
        includeOutstanding: fixQueueIncludeOutstanding ? "true" : "false",
        includeNew: fixQueueIncludeNew ? "true" : "false",
        includeIgnored: fixQueueIncludeIgnored ? "true" : "false",
        status: fixQueueStatus,
        limit: String(fixQueueLimit),
        offset: String(fixQueueOffset),
      });
      if (fixQueueRunId) {
        params.set("runId", fixQueueRunId);
      }
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(
          selectedSiteId ?? "",
        )}/fix-queue?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Fix queue failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      return (await res.json()) as FixQueueResponse;
    },
  });
  const fixQueueData = fixQueueQuery.data ?? null;
  const fixQueueError = fixQueueQuery.error
    ? getErrorMessage(fixQueueQuery.error, "Failed to load fix queue")
    : null;
  const fixQueueLoading = fixQueueQuery.isLoading;
  const fixQueueItems = fixQueueData?.items ?? [];
  const fixQueueSummary = fixQueueData?.summary ?? null;
  const fixQueueHasPrev = fixQueueOffset > 0;
  const fixQueueHasNext =
    fixQueueSummary &&
    fixQueueOffset + fixQueueLimit < fixQueueSummary.totalQueueItems;

  useEffect(() => {
    setFixQueueOffset(0);
  }, [
    fixQueueIncludeNew,
    fixQueueIncludeOutstanding,
    fixQueueIncludeIgnored,
    fixQueueStatus,
    selectedSiteId,
    fixQueueRunId,
    fixQueueBaseline,
  ]);
  const formatDiffSide = (side: ScanDiffSide | null) => {
    if (!side) return "Missing";
    const status = side.status_code == null ? "—" : side.status_code;
    return `${formatClassification(side.classification)} · ${status}`;
  };
  const renderDiffRow = (item: ScanDiffItem) => {
    const tone = changeTypeTone(item.change_type);
    const baselineText = formatDiffSide(item.baseline);
    const currentText = formatDiffSide(item.current);
    const baselinePages: string[] = item.baseline?.source_pages ?? [];
    const currentPages: string[] = item.current?.source_pages ?? [];
    const note = linkNotesByUrl.get(item.link_url);
    const hasNote = !!note;
    const menuId = `diff:${item.change_type}:${item.link_url}`;
    const menuOpen = actionMenuOpenId === menuId;
    return (
      <div
        key={`${item.change_type}:${item.link_url}`}
        className="change-row"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border)",
          background: "var(--panel-elev)",
          margin: "10px 16px",
          padding: "12px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              flex: 1,
            }}
          >
            <a
              href={item.link_url}
              target="_blank"
              rel="noreferrer"
              style={{
                color: "var(--text)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              {item.link_url}
            </a>
            {hasNote && (
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "11px",
                  padding: "2px 6px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                Note
              </span>
            )}
          </div>
          <div style={{ position: "relative" }} data-action-menu>
            <button
              onClick={() => setActionMenuOpenId(menuOpen ? null : menuId)}
              className="icon-button"
              style={{
                borderColor: "var(--border)",
                color: "var(--muted)",
                padding: "6px",
              }}
              aria-label="Open actions"
              title="Actions"
              data-no-drawer
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="19" cy="12" r="1.6" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="action-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: "220px",
                  zIndex: 40,
                }}
              >
                <button
                  onClick={() => {
                    void copyToClipboard(
                      item.link_url,
                      undefined,
                      "Copied link URL",
                    );
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Copy Link URL
                </button>
                <button
                  onClick={() => {
                    window.open(item.link_url, "_blank", "noopener,noreferrer");
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Open Link
                </button>
                <button
                  onClick={() => {
                    const source = currentPages[0];
                    if (source) openSourcePage(source);
                    else pushToast("No source page available", "warning");
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Open Source Page
                </button>
                {currentPages.length > 1 && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {currentPages.map((page) => (
                      <button
                        key={page}
                        onClick={() => {
                          openSourcePage(page);
                          setActionMenuOpenId(null);
                        }}
                        style={{
                          fontSize: "11px",
                          textAlign: "left",
                          color: "var(--muted)",
                          background: "transparent",
                          border: "1px solid transparent",
                          padding: "4px 6px",
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    void handleIgnoreLinkByUrl(item.link_url, selectedRunId);
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Ignore this link
                </button>
                <button
                  onClick={() => {
                    openNoteModal(item.link_url);
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  {hasNote ? "Edit Note" : "Add Note"}
                </button>
              </div>
            )}
          </div>
        </div>
        <div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "4px 10px",
              borderRadius: "999px",
              background: tone.bg,
              color: tone.text,
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {changeTypeLabel(item.change_type)}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          <span>Baseline: {baselineText}</span>
          <span>Current: {currentText}</span>
        </div>
        <div>
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontSize: "12px",
                color: "var(--text)",
              }}
            >
              Current {currentPages.length} • Baseline {baselinePages.length}
            </summary>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "8px",
                marginTop: "8px",
                fontSize: "12px",
                color: "var(--muted)",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: "4px",
                  }}
                >
                  Current
                </div>
                {currentPages.length === 0 && <div>—</div>}
                {currentPages.map((page) => (
                  <div
                    key={`cur:${item.link_url}:${page}`}
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {page}
                  </div>
                ))}
              </div>
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: "4px",
                  }}
                >
                  Baseline
                </div>
                {baselinePages.length === 0 && <div>—</div>}
                {baselinePages.map((page) => (
                  <div
                    key={`base:${item.link_url}:${page}`}
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {page}
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  };

  const reportView = viewMode === "report";
  const reportRun = reportRunData;
  const reportSummary = summarizeReportClassifications(reportSummaryRows);
  const reportStatusGroups = summarizeReportStatusCodes(reportSummaryRows);
  const reportHost = reportRun ? safeHost(reportRun.start_url) : null;
  const reportIssueSummary = reportIssues.summary;
  const reportLinkIntegrityIssueSummary =
    reportIssues.summariesByCategory.link_integrity ?? null;
  const canUseClientIssueFilter =
    reportIssueFilter === "all" || !reportIssues.hasMore;
  const clientFilteredIssues = useMemo(
    () =>
      reportIssues.issues.filter((issue) =>
        matchesReportIssueFilter(issue, reportIssueFilter),
      ),
    [reportIssueFilter, reportIssues.issues],
  );
  const activeFilteredIssueState =
    reportIssueFilter === "all"
      ? reportIssues
      : (reportFilteredIssueStates[reportIssueFilter] ??
        EMPTY_REPORT_ISSUES_STATE);
  const displayedIssueRows = canUseClientIssueFilter
    ? clientFilteredIssues
    : activeFilteredIssueState.issues;
  const getReportIssueFilterTotal = (filter: ReportIssueFilter) => {
    if (filter === "all")
      return reportIssueSummary?.total ?? reportIssues.issues.length;
    if (
      filter === "high" ||
      filter === "medium" ||
      filter === "low" ||
      filter === "info"
    ) {
      return reportIssueSummary?.bySeverity[filter] ?? 0;
    }
    if (
      filter === "link_integrity" ||
      filter === "seo_basic" ||
      filter === "performance_basic"
    ) {
      return reportIssues.summariesByCategory[filter]?.total ?? 0;
    }
    return displayedIssueRows.length;
  };
  const displayedIssueTotal = getReportIssueFilterTotal(reportIssueFilter);
  const visibleIssueRows = displayedIssueRows.slice(0, reportVisibleIssueCount);
  const reportScores = calculateReportScores(
    reportRun,
    reportIssueSummary,
    reportLinkIntegrityIssueSummary,
  );
  const reportCategoryScores = reportTechnicalDiagnostics?.categoryScores ?? [];
  const reportCategoryScoresByKey = Object.fromEntries(
    reportCategoryScores.map((score) => [score.key, score]),
  ) as Partial<Record<ScanCategoryScoreKey, ScanCategoryScore>>;
  const reportHighPriorityCount =
    (reportIssueSummary?.bySeverity.critical ?? 0) +
    (reportIssueSummary?.bySeverity.high ?? 0);
  const reportDateLabel = formatDate(
    reportRun?.finished_at ?? reportRun?.started_at ?? null,
  );
  const reportScanIdDisplay = reportRun?.id ?? reportScanRunId ?? "-";
  const reportScanIdShort =
    reportScanIdDisplay && reportScanIdDisplay !== "-"
      ? `${reportScanIdDisplay.slice(0, 8)}...`
      : "-";
  const reportIssueSummaryPending =
    reportRun?.status === "completed" &&
    reportRun.issue_generation_status !== "completed";
  const topPriorityIssues = useMemo(() => {
    const severityRank = (severity: IssueSeverity) => {
      if (severity === "critical") return 0;
      if (severity === "high") return 1;
      if (severity === "medium") return 2;
      if (severity === "low") return 3;
      return 4;
    };
    const changeRank = (
      changeStatus: Exclude<IssueChangeStatus, "resolved"> | null,
    ) => {
      if (changeStatus === "new") return 0;
      if (changeStatus === "existing") return 1;
      return 2;
    };

    return [...reportIssues.issues]
      .sort((a, b) => {
        const severityDiff =
          severityRank(a.severity) - severityRank(b.severity);
        if (severityDiff !== 0) return severityDiff;
        const changeDiff =
          changeRank(a.change_status) - changeRank(b.change_status);
        if (changeDiff !== 0) return changeDiff;
        return (
          new Date(b.last_seen_at).getTime() -
          new Date(a.last_seen_at).getTime()
        );
      })
      .slice(0, 4);
  }, [reportIssues.issues]);
  const reportTechnicalDiagnosticsNeedsAttention =
    !!reportRun?.issue_generation_error ||
    reportRun?.issue_generation_status === "pending" ||
    reportRun?.issue_generation_status === "failed" ||
    !reportTechnicalDiagnostics ||
    [
      reportTechnicalDiagnostics?.seoBasic?.issueCount,
      reportTechnicalDiagnostics?.robots?.issueCount,
      reportTechnicalDiagnostics?.sitemap?.issueCount,
      reportTechnicalDiagnostics?.sslHttps?.issueCount,
      reportTechnicalDiagnostics?.securityHeader?.issueCount,
      reportTechnicalDiagnostics?.performanceBasic?.issueCount,
    ].some((count) => (count ?? 0) > 0);
  const selectedLink = useMemo(
    () => results.find((row) => row.id === detailsLinkId) ?? null,
    [detailsLinkId, results],
  );
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );
  const selectedSiteName = selectedSite
    ? (siteNameById[selectedSite.id] ?? null)
    : null;
  const currentLearnArticle = useMemo(
    () => (learnSlug ? (LEARN_ARTICLES_BY_SLUG[learnSlug] ?? null) : null),
    [learnSlug],
  );
  const featuredLearnArticles = useMemo(
    () =>
      FEATURED_LEARN_ARTICLE_SLUGS.map(
        (slug) => LEARN_ARTICLES_BY_SLUG[slug],
      ).filter((article): article is LearnArticle => Boolean(article)),
    [],
  );
  const filteredLearnArticles = useMemo(
    () =>
      LEARN_ARTICLES.filter((article) => {
        if (
          learnCategoryFilter !== "all" &&
          article.category !== learnCategoryFilter
        ) {
          return false;
        }
        return matchesLearnArticleQuery(article, learnSearchQuery);
      }),
    [learnCategoryFilter, learnSearchQuery],
  );
  const learnArticleMissing =
    route === "learn" && !!learnSlug && !currentLearnArticle;
  const fetchDashboardSummary = useCallback(
    async (siteId: string) => {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(siteId)}/dashboard-summary`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(`Failed to load dashboard summary: ${res.status}`);
      }
      return (await res.json()) as DashboardSummaryResponse;
    },
    [apiFetch],
  );
  const dashboardSummaryQuery = useQuery({
    queryKey: ["dashboardSummary", selectedSiteId],
    enabled: !!selectedSiteId,
    queryFn: async () => {
      if (!selectedSiteId) throw new Error("site_required");
      return await fetchDashboardSummary(selectedSiteId);
    },
  });
  const refreshDashboardSummary = useCallback(
    async (
      siteId: string,
      _reason: string,
      opts?: {
        targetRunId?: string;
        waitForIssueSummary?: boolean;
        maxAttempts?: number;
      },
    ) => {
      const maxAttempts = opts?.maxAttempts ?? 1;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const data = await queryClient.fetchQuery({
            queryKey: ["dashboardSummary", siteId],
            queryFn: () => fetchDashboardSummary(siteId),
            staleTime: 0,
          });
          const latestRunId = data.latestRun?.id ?? null;
          const matchesRun =
            !opts?.targetRunId || latestRunId === opts.targetRunId;
          const latestIssueStatus = data.latestRun?.issue_generation_status;
          const issueSummaryReady =
            !opts?.waitForIssueSummary ||
            !matchesRun ||
            !data.latestRun ||
            data.latestRun.status !== "completed" ||
            (latestIssueStatus != null
              ? latestIssueStatus === "completed" ||
                latestIssueStatus === "failed"
              : data.latestIssueSummary != null);
          if (matchesRun && issueSummaryReady) {
            return data;
          }
        } catch {}
        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 700 * (attempt + 1));
          });
        }
      }
      return null;
    },
    [fetchDashboardSummary, queryClient],
  );
  const dashboardSummary = dashboardSummaryQuery.data ?? null;
  const dashboardUptime = dashboardSummary?.uptime ?? null;
  const dashboardObservedRun =
    selectedRun && dashboardObservedScanRunId === selectedRun.id
      ? selectedRun
      : null;
  const dashboardSummaryMatchesObservedRun =
    !!dashboardObservedRun &&
    dashboardSummary?.latestRun?.id === dashboardObservedRun.id;
  const dashboardTerminalSummaryPending =
    !!dashboardObservedRun &&
    !isInProgress(dashboardObservedRun.status) &&
    (!dashboardSummaryMatchesObservedRun ||
      (dashboardObservedRun.status === "completed" &&
        dashboardObservedRun.issue_generation_status != null &&
        dashboardObservedRun.issue_generation_status !== "completed"));
  const dashboardLatestRun =
    selectedRun &&
    (isInProgress(selectedRun.status) || dashboardTerminalSummaryPending)
      ? selectedRun
      : (dashboardSummary?.latestRun ?? selectedRun ?? null);
  const phase0SummaryRows = currentPhase0Diagnostics
    ? ([
        {
          classification: "ok",
          status_code: 200,
          count: currentPhase0Diagnostics.ok ?? 0,
        },
        {
          classification: "broken",
          status_code: null,
          count: currentPhase0Diagnostics.broken ?? 0,
        },
        {
          classification: "blocked",
          status_code: null,
          count: currentPhase0Diagnostics.blocked ?? 0,
        },
        {
          classification: "no_response",
          status_code: null,
          count: currentPhase0Diagnostics.noResponse ?? 0,
        },
      ] satisfies ScanLinksSummaryRow[])
    : [];
  const dashboardLinkSummaryRows =
    dashboardSummary?.latestLinkSummary ?? phase0SummaryRows;
  const dashboardLinkSummary = summarizeReportClassifications(
    dashboardLinkSummaryRows,
  );
  const dashboardSummaryMatchesLatestRun =
    !!dashboardLatestRun &&
    dashboardSummary?.latestRun?.id === dashboardLatestRun.id;
  const dashboardSummaryPending =
    !!dashboardLatestRun &&
    dashboardLatestRun.status === "completed" &&
    (!dashboardSummaryMatchesLatestRun ||
      (dashboardLatestRun.issue_generation_status != null &&
        dashboardLatestRun.issue_generation_status !== "completed"));
  const dashboardSummaryDataReady =
    !dashboardLatestRun ||
    (dashboardSummaryMatchesLatestRun && !dashboardSummaryPending);
  const dashboardIssueSummary = dashboardSummaryDataReady
    ? (dashboardSummary?.latestIssueSummary ?? null)
    : null;
  const dashboardCategorySummaries = dashboardSummaryDataReady
    ? (dashboardSummary?.latestCategoryIssueSummaries ?? {})
    : {};
  const dashboardCategoryScoreRows = dashboardSummaryDataReady
    ? (dashboardSummary?.latestCategoryScores ?? [])
    : [];
  const dashboardCategoryScoresByKey = Object.fromEntries(
    dashboardCategoryScoreRows.map((score) => [score.key, score]),
  ) as Partial<Record<ScanCategoryScoreKey, ScanCategoryScore>>;
  const dashboardLatestDiffSummary = dashboardSummaryDataReady
    ? (dashboardSummary?.latestDiffSummary ?? null)
    : null;
  const dashboardScores = calculateReportScores(
    dashboardLatestRun,
    dashboardIssueSummary,
    dashboardCategorySummaries.link_integrity ?? null,
  );
  const dashboardStage = getScanStageText(dashboardLatestRun);
  const dashboardProgress =
    dashboardLatestRun && dashboardLatestRun.total_links > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (dashboardLatestRun.checked_links /
              dashboardLatestRun.total_links) *
              100,
          ),
        )
      : 0;
  const dashboardIgnoredSkipped =
    currentPhase0Diagnostics?.ignoredSkipped ?? null;
  const dashboardIssueMovement = dashboardIssueSummary?.byChangeStatus ?? null;
  const dashboardHighPriority =
    (dashboardIssueSummary?.bySeverity.critical ?? 0) +
    (dashboardIssueSummary?.bySeverity.high ?? 0);
  const dashboardActiveLike =
    !!dashboardLatestRun &&
    (isInProgress(dashboardLatestRun.status) || dashboardSummaryPending);
  const dashboardSummaryMatchesActiveRun =
    !!dashboardLatestRun &&
    dashboardSummary?.latestRun?.id === dashboardLatestRun.id;
  const dashboardPhase0MatchesActiveRun =
    !!dashboardLatestRun &&
    currentPhase0Diagnostics?.scanRunId === dashboardLatestRun.id;
  const dashboardActiveCounterRows = dashboardActiveLike
    ? dashboardPhase0MatchesActiveRun
      ? phase0SummaryRows
      : dashboardSummaryMatchesActiveRun
        ? (dashboardSummary?.latestLinkSummary ?? [])
        : []
    : [];
  const dashboardActiveLinkSummary = summarizeReportClassifications(
    dashboardActiveCounterRows,
  );
  const dashboardTerminalLike =
    !!dashboardLatestRun &&
    !dashboardActiveLike &&
    (dashboardLatestRun.status === "completed" ||
      dashboardLatestRun.status === "failed" ||
      dashboardLatestRun.status === "cancelled");
  const dashboardRunningPreviewItems = [
    dashboardActiveLinkSummary.broken > 0
      ? {
          label: "Broken links detected",
          detail: `${dashboardActiveLinkSummary.broken} currently failing checks`,
        }
      : null,
    dashboardActiveLinkSummary.blocked > 0
      ? {
          label: "Blocked responses",
          detail: `${dashboardActiveLinkSummary.blocked} links are currently blocked`,
        }
      : null,
    dashboardActiveLinkSummary.no_response > 0
      ? {
          label: "No response",
          detail: `${dashboardActiveLinkSummary.no_response} links have no response yet`,
        }
      : null,
    dashboardIgnoredSkipped != null && dashboardIgnoredSkipped > 0
      ? {
          label: "Ignored or skipped",
          detail: `${dashboardIgnoredSkipped} links are excluded from active findings`,
        }
      : null,
  ].filter((item): item is { label: string; detail: string } => item != null);

  useEffect(() => {
    if (!selectedSiteId) {
      setDashboardObservedScanRunId(null);
      setDashboardRecentlyFinishedRunId(null);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (!dashboardLatestRun) return;
    if (dashboardActiveLike) {
      if (dashboardObservedScanRunId !== dashboardLatestRun.id) {
        setDashboardObservedScanRunId(dashboardLatestRun.id);
      }
      if (dashboardRecentlyFinishedRunId === dashboardLatestRun.id) {
        setDashboardRecentlyFinishedRunId(null);
      }
      return;
    }
    if (
      dashboardTerminalLike &&
      dashboardObservedScanRunId === dashboardLatestRun.id &&
      dashboardRecentlyFinishedRunId !== dashboardLatestRun.id
    ) {
      setDashboardRecentlyFinishedRunId(dashboardLatestRun.id);
    }
  }, [
    dashboardActiveLike,
    dashboardLatestRun,
    dashboardObservedScanRunId,
    dashboardRecentlyFinishedRunId,
    dashboardTerminalLike,
  ]);

  const shouldShowDashboardTerminalPanel =
    !!dashboardLatestRun &&
    dashboardTerminalLike &&
    dashboardRecentlyFinishedRunId === dashboardLatestRun.id;
  const dashboardHistoryItems =
    dashboardSummaryDataReady || !dashboardObservedRun
      ? (dashboardSummary?.history ?? history)
      : history;
  const primaryAppSections: Array<{ key: AppSection; label: string }> = [
    { key: "dashboard", label: "Dashboard" },
    { key: "reports", label: "Reports" },
  ];
  const isPublicLandingRoute = route === "landing";
  const isLoginRoute = route === "login";
  const isReportRoute = route === "report";
  const protectedRouteRequiresAuth = route === "app" || route === "report";
  const authPageTitle =
    isReportRoute && !authUser ? "Sign in to view this report" : "Welcome back";
  const authPageSubtitle =
    isReportRoute && !authUser
      ? "Reports stay behind your account so evidence and history remain private."
      : "Use your Scanlark account to open the monitoring dashboard.";

  const formatReportUrlLabel = (url: string) => {
    try {
      const parsed = new URL(url);
      const trimmedHost = trimDisplayHost(parsed.hostname);
      const search = parsed.search
        ? parsed.search.length > 48
          ? `${parsed.search.slice(0, 48)}…`
          : parsed.search
        : "";
      const pathWithQuery = `${parsed.pathname || "/"}${search}`;
      const isInternal = reportHost != null && parsed.hostname === reportHost;

      if (isInternal) {
        return pathWithQuery || "/";
      }

      if (!pathWithQuery || pathWithQuery === "/") {
        return trimmedHost;
      }

      return `${trimmedHost}${pathWithQuery}`;
    } catch {
      return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    }
  };

  const formatIssueSupportText = (description: string) => {
    if (description.length <= 84) return description;
    return `${description.slice(0, 84).trimEnd()}…`;
  };

  const formatEvidenceValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (value == null) return "null";
    if (Array.isArray(value)) {
      const rendered = value
        .slice(0, 4)
        .map((entry) => formatEvidenceValue(entry))
        .join(", ");
      return value.length > 4 ? `${rendered}, ...` : rendered;
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatEvidenceLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const getIssueSummaryText = (
    issue: { description: string; presentation?: IssuePresentation | null },
    maxLength = 84,
  ) => {
    const source = issue.presentation?.shortSummary ?? issue.description;
    if (source.length <= maxLength) return source;
    return `${source.slice(0, maxLength).trimEnd()}…`;
  };

  const getIssueDisplayTitle = (issue: {
    title: string;
    presentation?: IssuePresentation | null;
  }) => issue.presentation?.userTitle ?? issue.title;

  const renderIssueGuidanceDetails = (
    issue: {
      description: string;
      evidence_json: Record<string, unknown>;
      presentation?: IssuePresentation | null;
    },
    contextLabel = "View guidance",
  ) => {
    const presentation = issue.presentation;
    if (!presentation) return null;
    const evidenceEntries = Object.entries(issue.evidence_json ?? {});

    return (
      <details className="report-issue-guidance">
        <summary>{contextLabel}</summary>
        <div className="report-issue-guidance__body">
          <div className="report-issue-guidance__section">
            <div className="report-label">What it means</div>
            <p>{presentation.whatItMeans}</p>
          </div>
          <div className="report-issue-guidance__section">
            <div className="report-label">Why it matters</div>
            <p>{presentation.whyItMatters}</p>
          </div>
          <div className="report-issue-guidance__section">
            <div className="report-label">What to do next</div>
            <p>{presentation.suggestedFix}</p>
          </div>
          <details className="report-issue-tech">
            <summary>Technical detail</summary>
            <div className="report-issue-guidance__section">
              <p>{presentation.technicalDetail}</p>
            </div>
            <div className="report-issue-guidance__section">
              <div className="report-label">Stored summary</div>
              <p>{issue.description}</p>
            </div>
            <div className="report-issue-guidance__section">
              <div className="report-label">Raw evidence</div>
              {evidenceEntries.length === 0 ? (
                <p>No raw evidence was stored for this issue.</p>
              ) : (
                <div className="report-evidence-list">
                  {evidenceEntries.map(([key, value]) => (
                    <div key={key} className="report-evidence-item">
                      <strong>{formatEvidenceLabel(key)}</strong>
                      <span>{formatEvidenceValue(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </details>
    );
  };

  const formatSeoDiagnostics = (
    diagnostics: Phase0Diagnostics["seoBasic"] | null | undefined,
  ) => {
    if (!diagnostics || diagnostics.pageChecksCount == null) {
      return "2A SEO basics not recorded";
    }
    if (diagnostics.pageChecksCount === 0) {
      return "2A SEO basics recorded 0 pages";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2A SEO basics checked ${diagnostics.pageChecksCount} pages, ${diagnostics.issueCount} findings`;
    }
    return `2A SEO basics checked ${diagnostics.pageChecksCount} pages, positive result`;
  };

  const formatRobotsDiagnostics = (
    diagnostics: Phase0Diagnostics["robots"] | null | undefined,
  ) => {
    if (
      !diagnostics ||
      diagnostics.checksCount == null ||
      diagnostics.checksCount === 0
    ) {
      return "2B Robots not recorded";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2B Robots checked ${diagnostics.checksCount}, ${diagnostics.issueCount} findings`;
    }
    if (diagnostics.blocksAll) {
      return "2B Robots checked, blocks-all detected";
    }
    return `2B Robots checked ${diagnostics.checksCount}, positive result`;
  };

  const formatSitemapDiagnostics = (
    diagnostics: Phase0Diagnostics["sitemap"] | null | undefined,
  ) => {
    if (
      !diagnostics ||
      diagnostics.checksCount == null ||
      diagnostics.checksCount === 0
    ) {
      return "2B Sitemap not recorded";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2B Sitemap checked ${diagnostics.checksCount}, ${diagnostics.issueCount} findings`;
    }
    return `2B Sitemap checked ${diagnostics.checksCount}, positive result`;
  };

  const formatSslDiagnostics = (
    diagnostics: Phase0Diagnostics["sslHttps"] | null | undefined,
  ) => {
    if (
      !diagnostics ||
      diagnostics.checksCount == null ||
      diagnostics.checksCount === 0
    ) {
      return "2C SSL / HTTPS not recorded";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2C SSL / HTTPS checked ${diagnostics.checksCount}, ${diagnostics.issueCount} findings`;
    }
    const parts: string[] = [];
    if (diagnostics.httpsAvailable) parts.push("HTTPS ok");
    if (diagnostics.httpRedirectsToHttps) parts.push("HTTP→HTTPS ok");
    if (diagnostics.tlsAuthorized && diagnostics.hostnameMatches) {
      parts.push("TLS ok");
    }
    if (diagnostics.daysUntilExpiry != null) {
      parts.push(`cert ${diagnostics.daysUntilExpiry}d left`);
    }
    return parts.length > 0
      ? `2C SSL / HTTPS positive result: ${parts.join(", ")}`
      : `2C SSL / HTTPS checked ${diagnostics.checksCount}, positive result`;
  };

  const formatSecurityHeaderDiagnostics = (
    diagnostics: Phase0Diagnostics["securityHeader"] | null | undefined,
  ) => {
    if (
      !diagnostics ||
      diagnostics.checksCount == null ||
      diagnostics.checksCount === 0
    ) {
      return "2D Security headers not recorded";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2D Security headers checked ${diagnostics.checksCount}, ${diagnostics.issueCount} findings`;
    }
    const parts: string[] = [];
    if (diagnostics.hasHsts) parts.push("HSTS ok");
    if (diagnostics.hasCsp) parts.push("CSP ok");
    if (diagnostics.hasFrameAncestors || diagnostics.hasXFrameOptions) {
      parts.push("frame protection ok");
    }
    if (diagnostics.hasXContentTypeOptions) parts.push("XCTO ok");
    if (diagnostics.hasReferrerPolicy) parts.push("Referrer-Policy ok");
    if (diagnostics.hasPermissionsPolicy) parts.push("Permissions-Policy ok");
    if ((diagnostics.cookiesSetCount ?? 0) > 0) {
      parts.push(`cookies ${diagnostics.cookiesSetCount}`);
    }
    return parts.length > 0
      ? `2D Security headers positive result: ${parts.join(", ")}`
      : `2D Security headers checked ${diagnostics.checksCount}, positive result`;
  };

  const formatPerformanceDiagnostics = (
    diagnostics: Phase0Diagnostics["performanceBasic"] | null | undefined,
  ) => {
    if (
      !diagnostics ||
      diagnostics.checksCount == null ||
      diagnostics.checksCount === 0
    ) {
      return "2E Performance not recorded";
    }
    if ((diagnostics.issueCount ?? 0) > 0) {
      return `2E Performance checked root, ${diagnostics.issueCount} findings`;
    }
    const parts: string[] = [];
    if (diagnostics.responseTimeMs != null) {
      parts.push(`${diagnostics.responseTimeMs}ms`);
    }
    if (diagnostics.htmlSizeBytes != null) {
      parts.push(`${Math.round(diagnostics.htmlSizeBytes / 1024)}KB HTML`);
    }
    if (diagnostics.assetCount != null) {
      parts.push(`${diagnostics.assetCount} assets`);
    }
    return parts.length > 0
      ? `2E Performance positive result: ${parts.join(", ")}`
      : `2E Performance checked root, positive result`;
  };

  const handleShowMoreReportIssues = () => {
    const nextVisible = reportVisibleIssueCount + REPORT_VISIBLE_ROWS_INCREMENT;
    setReportVisibleIssueCount(nextVisible);
    if (
      reportScanRunId &&
      nextVisible > displayedIssueRows.length &&
      activeFilteredIssueState.hasMore &&
      !activeFilteredIssueState.loading
    ) {
      if (canUseClientIssueFilter) {
        void loadMoreReportIssues(reportScanRunId);
      } else {
        void loadFilteredReportIssues(
          reportScanRunId,
          reportIssueFilter,
          activeFilteredIssueState.offset,
        );
      }
    }
  };

  const handleShowMoreReportSection = (sectionKey: ReportSectionKey) => {
    const nextVisible =
      reportVisibleSectionCounts[sectionKey] + REPORT_VISIBLE_ROWS_INCREMENT;
    setReportVisibleSectionCounts((prev) => ({
      ...prev,
      [sectionKey]: nextVisible,
    }));
    const section = reportSections[sectionKey];
    if (
      reportScanRunId &&
      nextVisible > section.links.length &&
      section.hasMore &&
      !section.loading
    ) {
      void loadMoreReportSection(reportScanRunId, sectionKey);
    }
  };

  const handleShowMoreReportIgnored = () => {
    const nextVisible =
      reportVisibleIgnoredCount + REPORT_VISIBLE_ROWS_INCREMENT;
    setReportVisibleIgnoredCount(nextVisible);
    if (
      reportScanRunId &&
      nextVisible > reportIgnoredSection.links.length &&
      reportIgnoredSection.hasMore &&
      !reportIgnoredSection.loading
    ) {
      void loadMoreReportIgnored(reportScanRunId);
    }
  };

  const renderReportUrlCell = (
    url: string | null,
    options?: {
      copyLabel?: string;
      openLabel?: string;
      emptyLabel?: string;
    },
  ) => {
    if (!url) {
      return options?.emptyLabel ?? "-";
    }

    return (
      <div className="report-url-cell">
        <span className="report-url-text" title={url}>
          {formatReportUrlLabel(url)}
        </span>
        <div className="report-url-actions">
          <button
            type="button"
            className="report-url-action"
            onClick={() =>
              void copyToClipboard(
                url,
                undefined,
                options?.copyLabel ?? "Copied full URL",
              )
            }
            title="Copy full URL"
          >
            Copy
          </button>
          <button
            type="button"
            className="report-url-action"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            title="Open URL"
          >
            Open
          </button>
        </div>
      </div>
    );
  };

  const renderReportLinkSection = (
    title: string,
    sectionKey: ReportSectionKey,
    count: number,
  ) => {
    const section = reportSections[sectionKey];
    const visibleLinks = section.links.slice(
      0,
      reportVisibleSectionCounts[sectionKey],
    );
    const shownCount = Math.min(visibleLinks.length, count);
    return (
      <div className="report-card">
        <div className="report-card__header">
          <div className="report-table-title">
            {title} <span style={{ color: "var(--muted)" }}>({count})</span>
          </div>
        </div>
        {section.error && (
          <div style={{ fontSize: "12px", color: "var(--warning)" }}>
            {section.error}
          </div>
        )}
        <div className="report-table-wrap">
          <table className="report-table report-links-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>Status</th>
                <th>Result</th>
                <th>Occurrences</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {section.loading && section.links.length === 0 ? (
                <tr>
                  <td colSpan={5} className="report-empty">
                    Loading…
                  </td>
                </tr>
              ) : section.links.length === 0 ? (
                <tr>
                  <td colSpan={5} className="report-empty">
                    No links in this section for this scan.
                  </td>
                </tr>
              ) : (
                visibleLinks.map((row) => (
                  <tr key={row.id}>
                    <td>{renderReportUrlCell(row.link_url)}</td>
                    <td>{row.status_code ?? "-"}</td>
                    <td>
                      {row.error_message ??
                        formatClassification(row.classification)}
                    </td>
                    <td>{row.occurrence_count}</td>
                    <td>{formatDate(row.last_seen_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="report-table-meta">
          Showing {shownCount} of {count} links
        </div>
        {(shownCount < count || section.hasMore) && (
          <button
            className="report-button"
            onClick={() => handleShowMoreReportSection(sectionKey)}
            disabled={section.loading || !reportScanRunId}
          >
            {section.loading ? "Loading..." : "Show more"}
          </button>
        )}
      </div>
    );
  };

  const renderReportIgnoredSection = () => {
    const visibleIgnoredLinks = reportIgnoredSection.links.slice(
      0,
      reportVisibleIgnoredCount,
    );
    const shownCount = Math.min(
      visibleIgnoredLinks.length,
      reportIgnoredTotal ?? 0,
    );
    return (
      <div className="report-card">
        <div className="report-card__header">
          <div className="report-table-title">
            Ignored / skipped links{" "}
            <span style={{ color: "var(--muted)" }}>
              ({reportIgnoredTotal ?? 0})
            </span>
          </div>
        </div>
        {reportIgnoredSection.error && (
          <div style={{ fontSize: "12px", color: "var(--warning)" }}>
            {reportIgnoredSection.error}
          </div>
        )}
        <div className="report-table-wrap">
          <table className="report-table report-links-table">
            <thead>
              <tr>
                <th>Link</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Occurrences</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {reportIgnoredSection.loading &&
              reportIgnoredSection.links.length === 0 ? (
                <tr>
                  <td colSpan={5} className="report-empty">
                    Loading…
                  </td>
                </tr>
              ) : reportIgnoredSection.links.length === 0 ? (
                <tr>
                  <td colSpan={5} className="report-empty">
                    No ignored or skipped links were recorded for this scan.
                  </td>
                </tr>
              ) : (
                visibleIgnoredLinks.map((row) => (
                  <tr key={row.id}>
                    <td>{renderReportUrlCell(row.link_url)}</td>
                    <td>{row.status_code ?? "-"}</td>
                    <td>
                      <div>{getIgnoredRowSummary(row)}</div>
                      <div style={{ color: "var(--muted)", fontSize: "12px" }}>
                        {row.error_message ??
                          row.rule_pattern ??
                          row.rule_type ??
                          "No reason recorded"}
                      </div>
                    </td>
                    <td>{row.occurrence_count}</td>
                    <td>{formatDate(row.last_seen_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="report-table-meta">
          Showing {shownCount} of {reportIgnoredTotal ?? 0} links
        </div>
        {(shownCount < (reportIgnoredTotal ?? 0) ||
          reportIgnoredSection.hasMore) && (
          <button
            className="report-button"
            onClick={handleShowMoreReportIgnored}
            disabled={reportIgnoredSection.loading || !reportScanRunId}
          >
            {reportIgnoredSection.loading ? "Loading..." : "Show more"}
          </button>
        )}
      </div>
    );
  };

  const renderReportIssuesSection = () => (
    <div className="report-card">
      <div className="report-card__header">
        <div>
          <div className="report-table-title">
            Full issue table{" "}
            <span style={{ color: "var(--muted)" }}>
              ({reportIssueSummary?.total ?? reportIssues.issues.length})
            </span>
          </div>
          <div className="report-table-meta" style={{ marginTop: "4px" }}>
            New {reportIssueSummary?.byChangeStatus.new ?? 0} • Existing{" "}
            {reportIssueSummary?.byChangeStatus.existing ?? 0} • Resolved{" "}
            {reportIssueSummary?.byChangeStatus.resolved ??
              reportIssues.resolvedCount}
          </div>
        </div>
      </div>
      <div className="report-filter-row">
        {REPORT_ISSUE_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`report-filter-chip ${
              reportIssueFilter === filter.key ? "active" : ""
            }`}
            onClick={() => {
              setReportIssueFilter(filter.key);
              setReportVisibleIssueCount(REPORT_INITIAL_VISIBLE_ROWS);
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {reportIssues.error && (
        <div style={{ fontSize: "12px", color: "var(--warning)" }}>
          {reportIssues.error}
        </div>
      )}
      {!canUseClientIssueFilter && activeFilteredIssueState.error && (
        <div style={{ fontSize: "12px", color: "var(--warning)" }}>
          {activeFilteredIssueState.error}
        </div>
      )}
      <div className="report-table-wrap">
        <table className="report-table report-issues-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Title</th>
              <th>Affected URL</th>
              <th>Source URL</th>
              <th>Status</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {(canUseClientIssueFilter &&
              reportIssues.loading &&
              reportIssues.issues.length === 0) ||
            (!canUseClientIssueFilter &&
              activeFilteredIssueState.loading &&
              displayedIssueRows.length === 0) ? (
              <tr>
                <td colSpan={6} className="report-empty">
                  Loading…
                </td>
              </tr>
            ) : displayedIssueRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="report-empty">
                  {reportRun?.issue_generation_status === "failed"
                    ? "Issue generation failed for this scan. Raw scan evidence is still available below."
                    : reportRun?.issue_generation_status === "pending"
                      ? "Issue generation is still pending for this completed scan."
                      : "No issues match this filter for this scan."}
                </td>
              </tr>
            ) : (
              visibleIssueRows.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <span
                      className={`report-badge report-badge--severity severity-${issue.severity}`}
                    >
                      {formatIssueSeverity(issue.severity)}
                    </span>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span>{getIssueDisplayTitle(issue)}</span>
                      <span className="report-issue-category">
                        {formatIssueCategoryLabel(issue.category)}
                      </span>
                    </div>
                    <div
                      className="report-issue-support"
                      title={
                        issue.presentation?.shortSummary ?? issue.description
                      }
                    >
                      {getIssueSummaryText(issue)}
                    </div>
                    {renderIssueGuidanceDetails(issue)}
                  </td>
                  <td>
                    {renderReportUrlCell(issue.affected_url, {
                      copyLabel: "Copied affected URL",
                    })}
                  </td>
                  <td>
                    {renderReportUrlCell(issue.source_url, {
                      copyLabel: "Copied source URL",
                    })}
                  </td>
                  <td>
                    <div className="report-issue-badges">
                      <span className="report-badge report-badge--status">
                        {issue.status}
                      </span>
                      {issue.change_status && (
                        <span
                          className={`report-badge report-badge--change change-${issue.change_status}`}
                        >
                          {formatIssueChangeStatus(issue.change_status)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(issue.last_seen_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="report-table-meta">
        Showing {Math.min(visibleIssueRows.length, displayedIssueTotal)} of{" "}
        {displayedIssueTotal} issues
      </div>
      {(Math.min(visibleIssueRows.length, displayedIssueTotal) <
        displayedIssueTotal ||
        activeFilteredIssueState.hasMore) && (
        <button
          className="report-button"
          onClick={handleShowMoreReportIssues}
          disabled={activeFilteredIssueState.loading || !reportScanRunId}
        >
          {activeFilteredIssueState.loading ? "Loading..." : "Show more"}
        </button>
      )}
      {reportIssues.resolvedCount > 0 && (
        <details
          className="report-resolved-section"
          open={reportResolvedExpanded}
          onToggle={(event) =>
            setReportResolvedExpanded(
              (event.currentTarget as HTMLDetailsElement).open,
            )
          }
        >
          <summary>
            Resolved in this scan ({reportIssues.resolvedCount})
          </summary>
          <div className="report-table-wrap" style={{ marginTop: "10px" }}>
            <table className="report-table report-issues-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Affected URL</th>
                  <th>Source URL</th>
                  <th>Status</th>
                  <th>Resolved</th>
                </tr>
              </thead>
              <tbody>
                {reportIssues.resolvedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="report-empty">
                      No resolved issue rows were returned for this scan.
                    </td>
                  </tr>
                ) : (
                  reportIssues.resolvedIssues.map((issue) => (
                    <tr key={`resolved:${issue.id}`}>
                      <td>
                        <span
                          className={`report-badge report-badge--severity severity-${issue.severity}`}
                        >
                          {formatIssueSeverity(issue.severity)}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{getIssueDisplayTitle(issue)}</span>
                          <span className="report-issue-category">
                            {formatIssueCategoryLabel(issue.category)}
                          </span>
                        </div>
                        <div
                          className="report-issue-support"
                          title={
                            issue.presentation?.shortSummary ??
                            issue.description
                          }
                        >
                          {getIssueSummaryText(issue)}
                        </div>
                        {renderIssueGuidanceDetails(issue)}
                      </td>
                      <td>
                        {renderReportUrlCell(issue.affected_url, {
                          copyLabel: "Copied affected URL",
                        })}
                      </td>
                      <td>
                        {renderReportUrlCell(issue.source_url, {
                          copyLabel: "Copied source URL",
                        })}
                      </td>
                      <td>
                        <span className="report-badge report-badge--change change-resolved">
                          {formatIssueChangeStatus(issue.change_status)}
                        </span>
                      </td>
                      <td>{formatDate(issue.resolved_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );

  const renderTopPriorityIssues = () => {
    if (reportIssueSummaryPending || topPriorityIssues.length === 0) {
      return null;
    }
    return (
      <div className="report-card">
        <div className="report-card__header">
          <div>
            <div className="report-table-title">Top priority issues</div>
            <div className="report-table-meta" style={{ marginTop: "4px" }}>
              Highest-severity findings appear here first so the most important
              changes are readable before the full issue table.
            </div>
          </div>
        </div>
        <div className="report-priority-list">
          {topPriorityIssues.map((issue) => (
            <div key={`priority:${issue.id}`} className="report-priority-item">
              <div className="report-priority-item__top">
                <div className="report-priority-item__title">
                  {getIssueDisplayTitle(issue)}
                </div>
                <div className="report-issue-badges">
                  <span
                    className={`report-badge report-badge--severity severity-${issue.severity}`}
                  >
                    {formatIssueSeverity(issue.severity)}
                  </span>
                  {issue.change_status && (
                    <span
                      className={`report-badge report-badge--change change-${issue.change_status}`}
                    >
                      {formatIssueChangeStatus(issue.change_status)}
                    </span>
                  )}
                </div>
              </div>
              <div className="report-priority-item__meta">
                <span className="report-issue-category">
                  {formatIssueCategoryLabel(issue.category)}
                </span>
                <span>{formatDate(issue.last_seen_at)}</span>
              </div>
              <div className="report-priority-item__desc">
                {getIssueSummaryText(issue, 120)}
              </div>
              <div className="report-priority-item__next-step">
                <div className="report-label">What to do next</div>
                <div>
                  {issue.presentation?.suggestedFix ?? issue.description}
                </div>
              </div>
              <div className="report-priority-item__urls">
                <div>
                  <div className="report-label">Affected URL</div>
                  {renderReportUrlCell(issue.affected_url, {
                    copyLabel: "Copied affected URL",
                  })}
                </div>
                <div>
                  <div className="report-label">Source URL</div>
                  {renderReportUrlCell(issue.source_url, {
                    copyLabel: "Copied source URL",
                  })}
                </div>
              </div>
              {renderIssueGuidanceDetails(issue, "Open guidance")}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const resultsTitleCount =
    resultsView === "changes"
      ? diffChangeItems.length +
        (includeUnchanged ? diffUnchangedItems.length : 0)
      : resultsView === "fix_queue"
        ? (fixQueueSummary?.totalQueueItems ?? 0)
        : activeTab === "ignored"
          ? ignoredResults.length
          : filteredResults.length;
  const latestRunId = history[0]?.id ?? null;
  const isLatestRun = !!selectedRun && selectedRun.id === latestRunId;
  const runHeadingText = selectedRun
    ? selectedRun.status === "queued" || selectedRun.status === "in_progress"
      ? "Current scan"
      : isLatestRun
        ? "Last run"
        : "Selected run"
    : "Run summary";
  const onboardingSteps = [
    "Add your first site",
    "Run your first scan",
    "Review results",
    "Set a schedule",
    "Enable alerts",
  ];
  const onboardingStepIndex = Math.min(
    onboardingStep,
    onboardingSteps.length - 1,
  );

  function markRunProgress(runId: string) {
    setLastProgressAtByRunId((prev) => ({
      ...prev,
      [runId]: Date.now(),
    }));
  }

  function stopEventStream() {
    if (sseRetryTimerRef.current) {
      window.clearTimeout(sseRetryTimerRef.current);
      sseRetryTimerRef.current = null;
    }
    if (sseFallbackTimerRef.current) {
      window.clearTimeout(sseFallbackTimerRef.current);
      sseFallbackTimerRef.current = null;
    }
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }

  async function syncStateOnce() {
    const siteId = selectedSiteIdRef.current;
    const runId = selectedRunIdRef.current;
    if (siteId) {
      void loadHistory(siteId, {
        preserveSelection: true,
        skipResultsWhileInProgress: true,
      });
    }
    if (runId) {
      void refreshSelectedRun(runId);
    }
    void refreshSites();
  }

  function scheduleFallbackSync() {
    if (sseFallbackTimerRef.current) return;
    sseFallbackTimerRef.current = window.setTimeout(() => {
      sseFallbackTimerRef.current = null;
      if (sseRef.current) return;
      void syncStateOnce();
    }, 8000);
  }

  function scheduleSseReconnect() {
    if (sseRetryTimerRef.current) return;
    const backoff = sseBackoffRef.current;
    const jitter = Math.floor(Math.random() * 400);
    const delay = Math.min(30000, backoff + jitter);
    sseBackoffRef.current = Math.min(30000, backoff * 2);
    sseRetryTimerRef.current = window.setTimeout(() => {
      sseRetryTimerRef.current = null;
      if (authUser) {
        startEventStream();
      }
    }, delay);
  }

  function handleScanEvent(payload: ScanEventPayload) {
    if (payload.site_id === selectedSiteIdRef.current) {
      const runId = payload.scan_run_id;
      setHistory((prev) => {
        const idx = prev.findIndex((r) => r.id === runId);
        const next: ScanRunSummary = {
          id: runId,
          site_id: payload.site_id,
          status: payload.status,
          started_at: payload.started_at ?? new Date().toISOString(),
          finished_at: payload.finished_at ?? null,
          start_url:
            payload.start_url ?? (idx >= 0 ? prev[idx].start_url : startUrl),
          total_links: payload.total_links ?? 0,
          checked_links: payload.checked_links ?? 0,
          broken_links: payload.broken_links ?? 0,
          error_message: payload.error_message ?? null,
        };
        if (idx === -1) return [next, ...prev];
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...next };
        return copy;
      });

      markRunProgress(runId);
      maybeNotifyRunStatus({
        id: runId,
        site_id: payload.site_id,
        status: payload.status,
        started_at: payload.started_at ?? new Date().toISOString(),
        finished_at: payload.finished_at ?? null,
        start_url: payload.start_url ?? startUrl,
        total_links: payload.total_links ?? 0,
        checked_links: payload.checked_links ?? 0,
        broken_links: payload.broken_links ?? 0,
        error_message: payload.error_message ?? null,
      });

      if (payload.status === "queued" || payload.status === "in_progress") {
        setActiveRunId(runId);
        activeRunIdRef.current = runId;
        setSelectedRunId(runId);
        selectedRunIdRef.current = runId;
        void refreshDashboardSummary(payload.site_id, "scan_event_active", {
          targetRunId: runId,
          maxAttempts: 2,
        });
      } else if (activeRunIdRef.current === runId) {
        setActiveRunId(null);
        activeRunIdRef.current = null;
      }

      if (
        payload.status !== "queued" &&
        payload.status !== "in_progress" &&
        selectedRunIdRef.current === runId
      ) {
        void refreshSelectedRun(runId);
      }

      if (
        payload.status === "completed" ||
        payload.status === "failed" ||
        payload.status === "cancelled"
      ) {
        void refreshDashboardSummary(payload.site_id, "scan_event_terminal", {
          targetRunId: runId,
          waitForIssueSummary: payload.status === "completed",
          maxAttempts: payload.status === "completed" ? 6 : 2,
        });
        queryClient.invalidateQueries({
          queryKey: ["dashboardSummary", payload.site_id],
        });
        queryClient.invalidateQueries({
          queryKey: ["scanDiff", payload.site_id],
        });
        queryClient.invalidateQueries({
          queryKey: ["fixQueue", payload.site_id],
        });
      }
    }
  }

  function handleScheduleEvent(payload: ScheduleEventPayload) {
    queryClient.invalidateQueries({
      queryKey: ["dashboardSummary", payload.site_id],
    });
    setSites((prev) =>
      prev.map((site) =>
        site.id === payload.site_id
          ? {
              ...site,
              schedule_enabled: payload.schedule_enabled,
              schedule_frequency: payload.schedule_frequency,
              schedule_time_utc: payload.schedule_time_utc,
              schedule_day_of_week: payload.schedule_day_of_week,
              schedule_day_of_month: payload.schedule_day_of_month,
              next_scheduled_at: payload.next_scheduled_at,
              last_scheduled_at: payload.last_scheduled_at,
            }
          : site,
      ),
    );
  }

  function startEventStream() {
    if (sseRef.current) return;
    if (!authUser) return;

    const source = new EventSource(`${API_BASE}/events/stream`, {
      withCredentials: true,
    });
    sseRef.current = source;

    source.onopen = () => {
      sseBackoffRef.current = 1000;
      if (sseRetryTimerRef.current) {
        window.clearTimeout(sseRetryTimerRef.current);
        sseRetryTimerRef.current = null;
      }
      if (sseFallbackTimerRef.current) {
        window.clearTimeout(sseFallbackTimerRef.current);
        sseFallbackTimerRef.current = null;
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as SsePayload;
        if (payload.type === "schedule_updated") {
          handleScheduleEvent(payload);
          return;
        }
        handleScanEvent(payload as ScanEventPayload);
      } catch {}
    };

    source.addEventListener("scan_started", handleMessage as EventListener);
    source.addEventListener("scan_progress", handleMessage as EventListener);
    source.addEventListener("scan_completed", handleMessage as EventListener);
    source.addEventListener("scan_failed", handleMessage as EventListener);
    source.addEventListener("schedule_updated", handleMessage as EventListener);

    source.onerror = () => {
      if (sseRef.current !== source) return;
      stopEventStream();
      scheduleFallbackSync();
      scheduleSseReconnect();
    };
  }

  useEffect(() => {
    void loadMe();
  }, []);

  useEffect(() => {
    if (authUser) {
      void loadSites();
    } else if (!authLoading) {
      resetSessionState();
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    if (!authUser || !onboardingStorageKey) return;
    if (onboardingOpen) return;
    if (authLoading || sitesLoading) return;
    if (sites.length === 0) {
      const stored = localStorage.getItem(onboardingStorageKey);
      if (!stored) {
        setOnboardingStep(0);
        setOnboardingOpen(true);
      }
      return;
    }
    if (historyLoading) return;
    if (history.length === 0) {
      const stored = localStorage.getItem(onboardingStorageKey);
      if (!stored) {
        setOnboardingStep(1);
        setOnboardingOpen(true);
      }
    }
  }, [
    authLoading,
    authUser,
    history.length,
    historyLoading,
    onboardingOpen,
    onboardingStorageKey,
    sites.length,
    sitesLoading,
  ]);

  useEffect(() => {
    if (authUser) {
      startEventStream();
    } else {
      stopEventStream();
    }
  }, [authUser]);

  useEffect(() => {
    if (!onboardingOpen || onboardingStep !== 1) return;
    if (!onboardingScanRequested || !selectedRun) return;
    if (selectedRun.status === "completed") {
      setOnboardingStep(2);
    }
  }, [onboardingOpen, onboardingScanRequested, onboardingStep, selectedRun]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && authUser) {
        void syncStateOnce();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [authUser]);

  useEffect(() => {
    const stored = localStorage.getItem(
      THEME_STORAGE_KEY,
    ) as ThemePreference | null;
    if (stored === "dark" || stored === "light" || stored === "system") {
      setThemePreference(stored);
    } else {
      setThemePreference("system");
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("scanlark_pane_width");
    const value = stored ? Number(stored) : NaN;
    if (!Number.isNaN(value) && value >= 240 && value <= 520) {
      setPaneWidth(value);
    }
  }, []);

  useEffect(() => {
    if (themePreference === "system") {
      setThemeMode(getSystemTheme());
    } else {
      setThemeMode(themePreference);
    }
  }, [themePreference]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = themeMode;
    }
  }, [themeMode]);

  useEffect(() => {
    if (
      themePreference !== "system" ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setThemeMode(media.matches ? "dark" : "light");
    if (media.addEventListener) {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media.addListener?.(handler);
    return () => media.removeListener?.(handler);
  }, [themePreference]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (event: MouseEvent) => {
      const next = Math.min(520, Math.max(240, event.clientX - 24));
      setPaneWidth(next);
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isResizing]);

  useEffect(() => {
    localStorage.setItem("scanlark_pane_width", String(paneWidth));
  }, [paneWidth]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (event.key === "/" && searchInputRef.current && !isTyping) {
        event.preventDefault();
        searchInputRef.current.focus();
      }
      if (event.key === "n" && !isTyping) {
        if (!triggeringScan && selectedSiteId) {
          event.preventDefault();
          void handleRunScan();
        }
      }
      if (event.key === "a" && !isTyping) {
        event.preventDefault();
        setAddSiteOpen(true);
      }
      if (event.key === "?" && !isTyping) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
      if (event.key === "Escape") {
        setIsDrawerOpen(false);
        setDetailsOpen(false);
        setDetailsLinkId(null);
        setIgnoreRulesOpen(false);
        setHistoryOpen(false);
        setFiltersOpen(false);
        setAddSiteOpen(false);
        setShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (filterDropdownRef.current?.contains(target)) return;
      setFiltersOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [filtersOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (sidebarRef.current?.contains(target)) return;
      if (hamburgerRef.current?.contains(target)) return;
      setIsDrawerOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const id = window.requestAnimationFrame(() => {
      drawerCloseRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isDrawerOpen]);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1360);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (detailsOpen && detailsLinkId && !selectedLink) {
      setDetailsOpen(false);
    }
  }, [detailsLinkId, detailsOpen, selectedLink]);

  useEffect(() => {
    if (!detailsOpen) return;
    detailsCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const drawer = detailsDrawerRef.current;
      if (!drawer) return;
      const focusables = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [detailsOpen]);

  useEffect(() => {
    return () => {
      stopEventStream();
    };
  }, []);

  function resetSessionState() {
    setSites([]);
    setSelectedSiteId(null);
    selectedSiteIdRef.current = null;
    setHistory([]);
    setResults([]);
    setIgnoredResults([]);
    setReportRunData(null);
    setReportSummaryRows([]);
    setReportIgnoredTotal(null);
    setReportLastLoadedAt(null);
    resetReportSections();
    setSelectedRunId(null);
    selectedRunIdRef.current = null;
    setActiveRunId(null);
    activeRunIdRef.current = null;
    setDetailsOpen(false);
    setDetailsLinkId(null);
    setSiteNameById({});
    setOnboardingOpen(false);
    setOnboardingStep(0);
    setOnboardingSiteUrl("");
    setOnboardingSiteName("");
    setOnboardingWorking(false);
    setOnboardingError(null);
    setOnboardingScanRequested(false);
  }

  async function loadMe() {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await apiFetch(`${API_BASE}/me`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        setAuthUser(null);
        return;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to fetch session: ${res.status}${
            text ? ` - ${text.slice(0, 200)}` : ""
          }`,
        );
      }
      const data = (await res.json()) as AuthUser;
      setAuthUser(data);
    } catch (err: unknown) {
      setAuthError(getErrorMessage(err, "Failed to check session"));
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAuthSubmit() {
    const email = authEmail.trim();
    if (!email || !authPassword) {
      setAuthError("Email and password are required.");
      return;
    }
    setAuthWorking(true);
    setAuthError(null);
    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const res = await apiFetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: authPassword }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Auth failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as AuthUser;
      setAuthUser(data);
      setAuthPassword("");
      setAuthError(null);
      if (route === "login" || route === "landing") {
        navigateTo("/app");
      }
    } catch (err: unknown) {
      setAuthError(getErrorMessage(err, "Failed to authenticate"));
    } finally {
      setAuthWorking(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch (err) {
      console.error("Logout failed", err);
    } finally {
      setAuthUser(null);
      resetSessionState();
      navigateTo("/landing");
    }
  }

  function persistSiteName(siteId: string, name: string) {
    if (!siteNamesStorageKey || !name.trim()) return;
    setSiteNameById((prev) => {
      const next = { ...prev, [siteId]: name.trim() };
      saveStorageMap(siteNamesStorageKey, next);
      return next;
    });
  }

  function clearOnboardingState() {
    if (!onboardingStorageKey || typeof window === "undefined") return;
    window.localStorage.removeItem(onboardingStorageKey);
  }

  function completeOnboarding() {
    if (onboardingStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(
        onboardingStorageKey,
        new Date().toISOString(),
      );
    }
    setOnboardingOpen(false);
    setOnboardingStep(0);
    setOnboardingScanRequested(false);
    setOnboardingSiteUrl("");
    setOnboardingSiteName("");
    setOnboardingError(null);
    setOnboardingWorking(false);
  }

  function openOnboarding(step = 0) {
    setOnboardingError(null);
    setOnboardingScanRequested(false);
    setOnboardingStep(step);
    setOnboardingOpen(true);
  }

  async function loadSites() {
    setSitesLoading(true);
    setSitesError(null);
    try {
      const res = await apiFetch(`${API_BASE}/sites`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: SitesResponse = await res.json();

      const normalizedSites = normalizeSitesNotifyOn(data.sites);
      setSites(normalizedSites);

      if (normalizedSites.length > 0) {
        const first = normalizedSites[0];
        setSelectedSiteId(first.id);
        selectedSiteIdRef.current = first.id;

        setStartUrl(first.url);

        setActiveRunId(null);
        activeRunIdRef.current = null;

        setSelectedRunId(null);
        selectedRunIdRef.current = null;

        setResults([]);
        resetOccurrencesState();
        setHistory([]);

        await loadHistory(first.id, { preserveSelection: false });
      } else {
        setSelectedSiteId(null);
        selectedSiteIdRef.current = null;

        setHistory([]);
        setSelectedRunId(null);
        selectedRunIdRef.current = null;

        setResults([]);
        resetOccurrencesState();
        setStartUrl("");

        setActiveRunId(null);
        activeRunIdRef.current = null;
      }
    } catch (err: unknown) {
      setSitesError(getErrorMessage(err, "Failed to load sites"));
    } finally {
      setSitesLoading(false);
    }
  }

  async function refreshSites() {
    try {
      const res = await apiFetch(`${API_BASE}/sites`, { cache: "no-store" });
      if (!res.ok) return;
      const data: SitesResponse = await res.json();
      const normalizedSites = normalizeSitesNotifyOn(data.sites);
      setSites(normalizedSites);

      const currentId = selectedSiteIdRef.current;
      if (currentId) {
        const match = normalizedSites.find((site) => site.id === currentId);
        if (match) {
          setStartUrl(match.url);
          return;
        }
      }

      if (data.sites.length === 0) {
        setSelectedSiteId(null);
        selectedSiteIdRef.current = null;
        setStartUrl("");
        setHistory([]);
        setSelectedRunId(null);
        selectedRunIdRef.current = null;
        setActiveRunId(null);
        activeRunIdRef.current = null;
        setResults([]);
        resetOccurrencesState();
        return;
      }

      if (!currentId) {
        const first = data.sites[0];
        setSelectedSiteId(first.id);
        selectedSiteIdRef.current = first.id;
        setStartUrl(first.url);
        await loadHistory(first.id, { preserveSelection: false });
      }
    } catch {}
  }

  async function loadHistory(siteId: string, opts?: LoadHistoryOpts) {
    const preserveSelection = !!opts?.preserveSelection;
    const skipResultsWhileInProgress = !!opts?.skipResultsWhileInProgress;

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(siteId)}/scans?limit=10`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data: ScanHistoryResponse = await res.json();
      let scans = data.scans ?? [];

      const pinned = activeRunIdRef.current;
      if (pinned) {
        const localPinned = history.find((r) => r.id === pinned);
        const exists = scans.some((r) => r.id === pinned);
        if (!exists && localPinned) {
          scans = [localPinned, ...scans];
        }
      }

      setHistory(scans);

      if (scans.length === 0) {
        if (!preserveSelection) {
          setSelectedRunId(null);
          selectedRunIdRef.current = null;
        }
        setResults([]);
        resetOccurrencesState();
        return;
      }

      const prevSelected = selectedRunIdRef.current;
      const activePinned = activeRunIdRef.current;

      let nextSelectedId: string;
      if (activePinned) {
        nextSelectedId = activePinned;
      } else if (
        preserveSelection &&
        prevSelected &&
        scans.some((r) => r.id === prevSelected)
      ) {
        nextSelectedId = prevSelected;
      } else {
        nextSelectedId = scans[0].id;
      }

      if (nextSelectedId !== selectedRunIdRef.current) {
        setSelectedRunId(nextSelectedId);
        selectedRunIdRef.current = nextSelectedId;
      }

      const run = scans.find((r) => r.id === nextSelectedId) ?? scans[0];

      if (skipResultsWhileInProgress && isInProgress(run.status)) {
        return;
      }

      if (!isInProgress(run.status)) {
        await loadResults(nextSelectedId);
      }
    } catch (err: unknown) {
      setHistoryError(getErrorMessage(err, "Failed to load history"));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function fetchScanLinksPage(
    runId: string,
    classification: LinkClassification,
    offset: number,
    label: string,
  ): Promise<ScanLinksResponse> {
    const res = await apiFetch(
      buildScanLinksUrl(
        runId,
        classification,
        offset,
        statusGroup,
        showIgnored,
      ),
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Failed to load ${label}: ${res.status}`);
    return (await res.json()) as ScanLinksResponse;
  }

  async function loadResults(runId: string) {
    setResultsLoading(true);
    setResultsError(null);
    setResults([]);
    resetOccurrencesState();
    setBrokenOffset(0);
    setBlockedOffset(0);
    setOkOffset(0);
    setNoResponseOffset(0);
    try {
      const brokenData = await fetchScanLinksPage(
        runId,
        "broken",
        0,
        "broken links",
      );
      const blockedData = await fetchScanLinksPage(
        runId,
        "blocked",
        0,
        "blocked links",
      );
      const okData = await fetchScanLinksPage(runId, "ok", 0, "ok links");
      const noResponseData = await fetchScanLinksPage(
        runId,
        "no_response",
        0,
        "no response links",
      );

      // Combine links for display (we keep both, but filter separately via useMemo)
      setResults([
        ...brokenData.links,
        ...blockedData.links,
        ...okData.links,
        ...noResponseData.links,
      ]);

      // Update pagination state for broken links
      setBrokenOffset(LINKS_PAGE_SIZE);
      setBrokenHasMore(brokenData.countReturned < brokenData.totalMatching);

      // Update pagination state for blocked links
      setBlockedOffset(LINKS_PAGE_SIZE);
      setBlockedHasMore(blockedData.countReturned < blockedData.totalMatching);

      // Update pagination state for ok links
      setOkOffset(LINKS_PAGE_SIZE);
      setOkHasMore(okData.countReturned < okData.totalMatching);

      // Update pagination state for no_response links
      setNoResponseOffset(LINKS_PAGE_SIZE);
      setNoResponseHasMore(
        noResponseData.countReturned < noResponseData.totalMatching,
      );

      setSelectedRunId(runId);
      selectedRunIdRef.current = runId;
    } catch (err: unknown) {
      setResultsError(getErrorMessage(err, "Failed to load scan links"));
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadIgnoredResults(runId: string) {
    setIgnoredLoading(true);
    setIgnoredError(null);
    setIgnoredResults([]);
    setIgnoredOffset(0);
    try {
      const res = await apiFetch(
        buildIgnoredLinksUrl(runId, 0, LINKS_PAGE_SIZE),
        {
          cache: "no-store",
        },
      );
      if (!res.ok)
        throw new Error(`Failed to load ignored links: ${res.status}`);
      const data: IgnoredLinksResponse = await res.json();
      setIgnoredResults(data.links ?? []);
      setIgnoredOffset(LINKS_PAGE_SIZE);
      setIgnoredHasMore(data.countReturned < data.totalMatching);
    } catch (err: unknown) {
      setIgnoredError(getErrorMessage(err, "Failed to load ignored links"));
    } finally {
      setIgnoredLoading(false);
    }
  }

  async function loadMoreBrokenResults(runId: string) {
    if (resultsLoading) return;

    setResultsLoading(true);
    try {
      const data = await fetchScanLinksPage(
        runId,
        "broken",
        brokenOffset,
        "more broken links",
      );
      setResults((prev) => [...prev, ...data.links]);
      const nextOffset = brokenOffset + data.countReturned;
      setBrokenOffset((prev) => prev + LINKS_PAGE_SIZE);
      setBrokenHasMore(nextOffset < data.totalMatching);
    } catch (err: unknown) {
      setResultsError(getErrorMessage(err, "Failed to load more broken links"));
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadMoreBlockedResults(runId: string) {
    if (resultsLoading) return;

    setResultsLoading(true);
    try {
      const data = await fetchScanLinksPage(
        runId,
        "blocked",
        blockedOffset,
        "more blocked links",
      );
      setResults((prev) => [...prev, ...data.links]);
      const nextOffset = blockedOffset + data.countReturned;
      setBlockedOffset((prev) => prev + LINKS_PAGE_SIZE);
      setBlockedHasMore(nextOffset < data.totalMatching);
    } catch (err: unknown) {
      setResultsError(
        getErrorMessage(err, "Failed to load more blocked links"),
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadMoreOkResults(runId: string) {
    if (resultsLoading) return;

    setResultsLoading(true);
    try {
      const data = await fetchScanLinksPage(
        runId,
        "ok",
        okOffset,
        "more ok links",
      );
      setResults((prev) => [...prev, ...data.links]);
      const nextOffset = okOffset + data.countReturned;
      setOkOffset((prev) => prev + LINKS_PAGE_SIZE);
      setOkHasMore(nextOffset < data.totalMatching);
    } catch (err: unknown) {
      setResultsError(getErrorMessage(err, "Failed to load more ok links"));
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadMoreNoResponseResults(runId: string) {
    if (resultsLoading) return;

    setResultsLoading(true);
    try {
      const data = await fetchScanLinksPage(
        runId,
        "no_response",
        noResponseOffset,
        "more no response links",
      );
      setResults((prev) => [...prev, ...data.links]);
      const nextOffset = noResponseOffset + data.countReturned;
      setNoResponseOffset((prev) => prev + LINKS_PAGE_SIZE);
      setNoResponseHasMore(nextOffset < data.totalMatching);
    } catch (err: unknown) {
      setResultsError(
        getErrorMessage(err, "Failed to load more no response links"),
      );
    } finally {
      setResultsLoading(false);
    }
  }

  async function loadMoreIgnoredResults(runId: string) {
    if (ignoredLoading) return;
    setIgnoredLoading(true);
    try {
      const res = await apiFetch(
        buildIgnoredLinksUrl(runId, ignoredOffset, LINKS_PAGE_SIZE),
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const data: IgnoredLinksResponse = await res.json();
      setIgnoredResults((prev) => [...prev, ...data.links]);
      setIgnoredOffset((prev) => prev + data.countReturned);
      setIgnoredHasMore(
        ignoredOffset + data.countReturned < data.totalMatching,
      );
    } catch (err: unknown) {
      setIgnoredError(
        getErrorMessage(err, "Failed to load more ignored links"),
      );
    } finally {
      setIgnoredLoading(false);
    }
  }

  async function loadMoreAllResults(runId: string) {
    if (resultsLoading) return;

    setResultsLoading(true);
    try {
      const loadMoreByClassification = async (
        classification: "broken" | "blocked" | "ok" | "no_response",
        offset: number,
        setOffset: React.Dispatch<React.SetStateAction<number>>,
        setHasMore: React.Dispatch<React.SetStateAction<boolean>>,
      ) => {
        const res = await apiFetch(
          buildScanLinksUrl(
            runId,
            classification,
            offset,
            statusGroup,
            showIgnored,
          ),
          {
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const data: ScanLinksResponse = await res.json();
        setResults((prev) => [...prev, ...data.links]);
        const nextOffset = offset + data.countReturned;
        setOffset(nextOffset);
        setHasMore(nextOffset < data.totalMatching);
      };

      if (brokenHasMore) {
        await loadMoreByClassification(
          "broken",
          brokenOffset,
          setBrokenOffset,
          setBrokenHasMore,
        );
      }
      if (blockedHasMore) {
        await loadMoreByClassification(
          "blocked",
          blockedOffset,
          setBlockedOffset,
          setBlockedHasMore,
        );
      }
      if (okHasMore) {
        await loadMoreByClassification(
          "ok",
          okOffset,
          setOkOffset,
          setOkHasMore,
        );
      }
      if (noResponseHasMore) {
        await loadMoreByClassification(
          "no_response",
          noResponseOffset,
          setNoResponseOffset,
          setNoResponseHasMore,
        );
      }
    } catch (err: unknown) {
      setResultsError(getErrorMessage(err, "Failed to load more results"));
    } finally {
      setResultsLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedRunId) return;
    if (isInProgress(selectedRun?.status)) return;
    void loadResults(selectedRunId);
  }, [selectedRunId, statusGroup, showIgnored]);

  useEffect(() => {
    if (!selectedRunId) return;
    if (activeTab !== "ignored") return;
    void loadIgnoredResults(selectedRunId);
  }, [activeTab, selectedRunId]);

  useEffect(() => {
    setDetailsOpen(false);
    setDetailsLinkId(null);
  }, [selectedRunId]);

  useEffect(() => {
    if (!ignoreRulesOpen || !selectedSiteId) return;
    void loadIgnoreRules(selectedSiteId);
  }, [ignoreRulesOpen, selectedSiteId]);

  useEffect(() => {
    if (!selectedSiteId) {
      setIgnoreRulesOpen(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (!selectedSiteId) {
      setHistoryOpen(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    if (!selectedSite) return;
    setScheduleEnabled(selectedSite.schedule_enabled ?? false);
    setScheduleFrequency(selectedSite.schedule_frequency ?? "manual");
    setScheduleTimeUtc(normalizeTimeInput(selectedSite.schedule_time_utc));
    setScheduleDayOfWeek(selectedSite.schedule_day_of_week ?? 1);
    setScheduleDayOfMonth(selectedSite.schedule_day_of_month ?? 1);
    setScheduleError(null);
  }, [selectedSite]);

  useEffect(() => {
    if (!selectedSiteId) {
      setNotifyEnabled(false);
      setNotifyEmail("");
      setNotifyOn("new_issues_only");
      setNotifyIncludeCsv(false);
      setSummaryEnabled(false);
      setNotifyError(null);
      return;
    }
    void loadNotificationSettings(selectedSiteId);
  }, [selectedSiteId]);

  useEffect(() => {
    if (!selectedSiteId) {
      setUptimeEnabled(false);
      setUptimeCheckUrl("");
      setUptimeFailureThreshold(3);
      setUptimeError(null);
      return;
    }
    if (!dashboardUptime) return;
    setUptimeEnabled(dashboardUptime.enabled);
    setUptimeCheckUrl(dashboardUptime.checkUrl);
    setUptimeFailureThreshold(dashboardUptime.failureThreshold);
    setUptimeError(null);
  }, [dashboardUptime, selectedSiteId]);

  useEffect(() => {
    if (!selectedRunId || history.length === 0) {
      setCompareRunId(null);
      return;
    }
    const idx = history.findIndex((run) => run.id === selectedRunId);
    const fallback =
      idx >= 0
        ? (history.slice(idx + 1).find((run) => run.status === "completed")
            ?.id ?? null)
        : null;
    if (fallback && fallback !== compareRunId) {
      setCompareRunId(fallback);
    } else if (!fallback) {
      setCompareRunId(null);
    }
  }, [history, selectedRunId]);

  useEffect(() => {
    if (!includeUnchanged) {
      setUnchangedOffset(0);
      setUnchangedOnly(false);
    }
  }, [includeUnchanged]);

  useEffect(() => {
    setUnchangedOffset(0);
  }, [diffIssuesOnly]);

  useEffect(() => {
    setUnchangedOffset(0);
  }, [diffExportFilter, compareRunId, selectedRunId, diffIncludeIgnored]);

  useEffect(() => {
    if (!selectedRunId) {
      setDiffOkTotal(0);
      setPhase0Diagnostics(null);
      setPhase0DiagnosticsLoading(false);
      return;
    }
    let cancelled = false;
    const loadSummary = async () => {
      setPhase0DiagnosticsLoading(true);
      let summaryRows: ScanLinksSummaryRow[] = [];
      let ignoredSkipped = 0;
      let technicalDiagnostics: ScanTechnicalDiagnosticsResponse | null = null;
      let summaryLoaded = false;
      let ignoredLoaded = false;
      let technicalLoaded = false;
      const errors: string[] = [];

      try {
        const res = await apiFetch(
          `${API_BASE}/scan-runs/${encodeURIComponent(
            selectedRunId,
          )}/links/summary`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const data: ScanLinksSummaryResponse = await res.json();
          summaryRows = data.summary ?? [];
          summaryLoaded = true;
        } else {
          errors.push(`links summary ${res.status}`);
        }
      } catch (err: unknown) {
        errors.push(getErrorMessage(err, "links summary failed"));
      }

      try {
        const res = await apiFetch(buildIgnoredLinksUrl(selectedRunId, 0, 1), {
          cache: "no-store",
        });
        if (res.ok) {
          const data: IgnoredLinksResponse = await res.json();
          ignoredSkipped = data.totalMatching ?? 0;
          ignoredLoaded = true;
        } else {
          errors.push(`ignored summary ${res.status}`);
        }
      } catch (err: unknown) {
        errors.push(getErrorMessage(err, "ignored summary failed"));
      }

      try {
        const res = await apiFetch(
          `${API_BASE}/scan-runs/${encodeURIComponent(
            selectedRunId,
          )}/technical-diagnostics`,
          { cache: "no-store" },
        );
        if (res.ok) {
          technicalDiagnostics =
            (await res.json()) as ScanTechnicalDiagnosticsResponse;
          technicalLoaded = true;
        } else {
          errors.push(`technical diagnostics ${res.status}`);
        }
      } catch (err: unknown) {
        errors.push(getErrorMessage(err, "technical diagnostics failed"));
      }

      if (cancelled) return;

      const ok = getSummaryCount(summaryRows, "ok");
      setDiffOkTotal(ok);
      setPhase0Diagnostics({
        scanRunId: selectedRunId,
        ok: summaryLoaded ? ok : null,
        broken: summaryLoaded ? getSummaryCount(summaryRows, "broken") : null,
        blocked: summaryLoaded ? getSummaryCount(summaryRows, "blocked") : null,
        noResponse: summaryLoaded
          ? getSummaryCount(summaryRows, "no_response")
          : null,
        ignoredSkipped: ignoredLoaded ? ignoredSkipped : null,
        categoryScores: technicalLoaded
          ? (technicalDiagnostics?.categoryScores ?? null)
          : null,
        seoBasic: technicalLoaded
          ? (technicalDiagnostics?.seoBasic ?? null)
          : null,
        robots: technicalLoaded ? (technicalDiagnostics?.robots ?? null) : null,
        sitemap: technicalLoaded
          ? (technicalDiagnostics?.sitemap ?? null)
          : null,
        sslHttps: technicalLoaded
          ? (technicalDiagnostics?.sslHttps ?? null)
          : null,
        securityHeader: technicalLoaded
          ? (technicalDiagnostics?.securityHeader ?? null)
          : null,
        performanceBasic: technicalLoaded
          ? (technicalDiagnostics?.performanceBasic ?? null)
          : null,
        error: errors.length > 0 ? errors.join("; ") : null,
        loadedAt:
          technicalLoaded && technicalDiagnostics?.loadedAt
            ? new Date(technicalDiagnostics.loadedAt).getTime()
            : Date.now(),
      });
      setPhase0DiagnosticsLoading(false);
    };
    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [
    selectedRunId,
    selectedRun?.updated_at,
    selectedRun?.status,
    selectedRun?.checked_links,
    selectedRun?.total_links,
    selectedRun?.broken_links,
  ]);

  async function refreshSelectedRun(runId: string) {
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(runId)}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        return;
      }

      const run: ScanRunSummary = await res.json();

      setHistory((prev) => {
        const idx = prev.findIndex((r) => r.id === run.id);
        if (idx === -1) {
          return [run, ...prev];
        }
        const copy = [...prev];
        copy[idx] = run;
        return copy;
      });
      markRunProgress(run.id);
      maybeNotifyRunStatus(run);

      if (selectedRunIdRef.current !== run.id) {
        setSelectedRunId(run.id);
        selectedRunIdRef.current = run.id;
      }

      if (!isInProgress(run.status)) {
        setActiveRunId(null);
        activeRunIdRef.current = null;

        await refreshDashboardSummary(run.site_id, "refresh_selected_run", {
          targetRunId: run.id,
          waitForIssueSummary: run.status === "completed",
          maxAttempts: run.status === "completed" ? 6 : 2,
        });
        await loadHistory(run.site_id, { preserveSelection: true });
        await loadResults(run.id);
      }
    } catch {}
  }

  async function handleSelectSite(site: Site) {
    if (site.id === selectedSiteId) return;

    setIsDrawerOpen(false);
    setDetailsOpen(false);
    setDetailsLinkId(null);

    setActiveRunId(null);
    activeRunIdRef.current = null;

    setHistory([]);
    setResults([]);
    resetOccurrencesState();

    setSelectedRunId(null);
    selectedRunIdRef.current = null;

    setSelectedSiteId(site.id);
    selectedSiteIdRef.current = site.id;

    setStartUrl(site.url);

    await loadHistory(site.id, { preserveSelection: false });
  }

  async function handleSelectRunForWorkspace(run: ScanRunSummary) {
    setResults([]);
    resetOccurrencesState();
    setSelectedRunId(run.id);
    selectedRunIdRef.current = run.id;

    if (isInProgress(run.status)) {
      setActiveRunId(run.id);
      activeRunIdRef.current = run.id;
      await refreshSelectedRun(run.id);
      return;
    }

    setActiveRunId(null);
    activeRunIdRef.current = null;
    await loadResults(run.id);
  }

  async function handleRunScan() {
    await handleRunScanWithUrl(startUrl);
  }

  async function createSiteRecord(url: string, name?: string) {
    const res = await apiFetch(`${API_BASE}/sites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, name: name?.trim() || undefined }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Create failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
      );
    }

    const data = (await res.json()) as { site: Site };
    return data.site;
  }

  function applyCreatedSite(site: Site, name?: string) {
    const normalized = normalizeSiteNotifyOn(site);
    setSites((prev) => {
      const filtered = prev.filter((item) => item.id !== site.id);
      return [normalized, ...filtered];
    });
    setSelectedSiteId(site.id);
    selectedSiteIdRef.current = site.id;
    setStartUrl(site.url);
    setActiveRunId(null);
    activeRunIdRef.current = null;
    setSelectedRunId(null);
    selectedRunIdRef.current = null;
    setResults([]);
    resetOccurrencesState();
    setHistory([]);
    void loadHistory(site.id, { preserveSelection: false });
    if (name) {
      persistSiteName(site.id, name);
    }
  }

  function handleNewScanAction() {
    if (!hasSites) {
      setCreateError(null);
      setAddSiteOpen(true);
      return;
    }
    if (!selectedSiteId) {
      setIsDrawerOpen(true);
      pushToast("Select a site to start a new scan", "warning");
      return;
    }
    void handleRunScan();
  }

  function openFixQueue() {
    setScanWorkspaceOpen(true);
    setResultsView("fix_queue");
    setFixQueueIncludeNew(true);
    setFixQueueIncludeOutstanding(true);
    setFixQueueIncludeIgnored(false);
    setFixQueueStatus("open");
    setFixQueueOffset(0);
  }

  async function handleCancelScan() {
    if (!selectedRunId) return;
    try {
      await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(selectedRunId)}/cancel`,
        {
          method: "POST",
        },
      );
      setHistory((prev) =>
        prev.map((run) =>
          run.id === selectedRunId
            ? {
                ...run,
                status: "cancelled",
                finished_at: new Date().toISOString(),
              }
            : run,
        ),
      );
      pushToast("Cancelling scan…", "info");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to cancel scan"), "warning");
    }
  }

  async function handleCreateSite() {
    const url = newSiteUrl.trim();
    if (!url) return;

    setCreatingSite(true);
    setCreateError(null);
    try {
      const site = await createSiteRecord(url);
      applyCreatedSite(site);
      setNewSiteUrl("");
      setAddSiteOpen(false);
      pushToast("Site added", "success");
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "Failed to create site"));
    } finally {
      setCreatingSite(false);
    }
  }

  async function handleCreateSampleSite() {
    const existing = sites.find((site) => site.url === SAMPLE_SITE_URL);
    if (existing) {
      await handleSelectSite(existing);
      return;
    }
    try {
      setCreatingSite(true);
      const site = await createSiteRecord(SAMPLE_SITE_URL, SAMPLE_SITE_NAME);
      applyCreatedSite(site, SAMPLE_SITE_NAME);
      pushToast("Sample site added", "success");
    } catch (err: unknown) {
      setCreateError(getErrorMessage(err, "Failed to add sample site"));
    } finally {
      setCreatingSite(false);
    }
  }

  async function handleOnboardingCreateSite() {
    const url = onboardingSiteUrl.trim();
    if (!url) return;
    setOnboardingWorking(true);
    setOnboardingError(null);
    try {
      const site = await createSiteRecord(url, onboardingSiteName);
      applyCreatedSite(site, onboardingSiteName);
      setOnboardingSiteUrl("");
      setOnboardingSiteName("");
      setOnboardingStep(1);
    } catch (err: unknown) {
      setOnboardingError(getErrorMessage(err, "Failed to create site"));
    } finally {
      setOnboardingWorking(false);
    }
  }

  async function handleOnboardingSampleSite() {
    setOnboardingWorking(true);
    setOnboardingError(null);
    try {
      const existing = sites.find((site) => site.url === SAMPLE_SITE_URL);
      if (existing) {
        await handleSelectSite(existing);
      } else {
        const site = await createSiteRecord(SAMPLE_SITE_URL, SAMPLE_SITE_NAME);
        applyCreatedSite(site, SAMPLE_SITE_NAME);
      }
      setOnboardingStep(1);
    } catch (err: unknown) {
      setOnboardingError(getErrorMessage(err, "Failed to add sample site"));
    } finally {
      setOnboardingWorking(false);
    }
  }

  async function handleOnboardingRunScan() {
    if (!selectedSiteId) return;
    setOnboardingScanRequested(true);
    await handleRunScan();
  }

  async function handleDeleteSite(siteId: string) {
    const site = sites.find((s) => s.id === siteId);
    const label = site?.url ? `\n\n${site.url}` : "";

    const ok = window.confirm(
      `Delete this site and all scans/results?${label}`,
    );
    if (!ok) return;

    setDeletingSiteId(siteId);
    setDeleteError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(siteId)}`,
        {
          method: "DELETE",
        },
      );

      if (res.status === 404) {
        setDeleteError("Site not found (maybe already deleted).");
        await loadSites();
        return;
      }

      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Delete failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      if (selectedSiteId === siteId) {
        setSelectedSiteId(null);
        selectedSiteIdRef.current = null;

        setHistory([]);
        setResults([]);
        resetOccurrencesState();

        setSelectedRunId(null);
        selectedRunIdRef.current = null;

        setStartUrl("");

        setActiveRunId(null);
        activeRunIdRef.current = null;
      }

      await loadSites();
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, "Failed to delete site"));
    } finally {
      setDeletingSiteId(null);
    }
  }

  async function handleSaveSchedule() {
    if (!selectedSiteId) return;
    setScheduleSaving(true);
    setScheduleError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/schedule`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            enabled: scheduleEnabled,
            frequency: scheduleFrequency,
            timeUtc: scheduleTimeUtc,
            dayOfWeek:
              scheduleFrequency === "weekly" ? scheduleDayOfWeek : null,
            dayOfMonth:
              scheduleFrequency === "monthly" ? scheduleDayOfMonth : null,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Schedule update failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      const data = (await res.json()) as {
        scheduleEnabled: boolean;
        scheduleFrequency: "manual" | "daily" | "weekly" | "monthly";
        scheduleTimeUtc: string;
        scheduleDayOfWeek: number | null;
        scheduleDayOfMonth: number | null;
        nextScheduledAt: string | null;
        lastScheduledAt: string | null;
      };

      setSites((prev) =>
        prev.map((site) =>
          site.id === selectedSiteId
            ? {
                ...site,
                schedule_enabled: data.scheduleEnabled,
                schedule_frequency: data.scheduleFrequency,
                schedule_time_utc: data.scheduleTimeUtc,
                schedule_day_of_week: data.scheduleDayOfWeek,
                schedule_day_of_month: data.scheduleDayOfMonth,
                next_scheduled_at: data.nextScheduledAt,
                last_scheduled_at: data.lastScheduledAt,
              }
            : site,
        ),
      );

      pushToast("Schedule updated", "success");
    } catch (err: unknown) {
      setScheduleError(getErrorMessage(err, "Failed to update schedule"));
    } finally {
      setScheduleSaving(false);
    }
  }

  async function loadNotificationSettings(siteId: string) {
    setNotifyLoading(true);
    setNotifyError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(siteId)}/notification-settings`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Failed to load notification settings: ${res.status}${
            text ? ` - ${text.slice(0, 200)}` : ""
          }`,
        );
      }
      const data = (await res.json()) as {
        notifyEnabled: boolean;
        notifyEmail: string | null;
        notifyOn: NotifyOnOption;
        notifyIncludeCsv: boolean;
        summaryEnabled: boolean;
      };
      setNotifyEnabled(data.notifyEnabled);
      setNotifyEmail(data.notifyEmail ?? "");
      setNotifyOn(normalizeNotifyOn(data.notifyOn));
      setNotifyIncludeCsv(data.notifyIncludeCsv);
      setSummaryEnabled(data.summaryEnabled);
    } catch (err: unknown) {
      setNotifyError(
        getErrorMessage(err, "Failed to load notification settings"),
      );
    } finally {
      setNotifyLoading(false);
    }
  }

  async function handleSaveNotifications() {
    if (!selectedSiteId) return;
    if (notifyEnabled && notifyOn !== "never" && !notifyEmail.trim()) {
      setNotifyError(
        "Email is required when notifications are enabled and notify on is not never.",
      );
      return;
    }
    setNotifySaving(true);
    setNotifyError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/notification-settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            enabled: notifyEnabled,
            email: notifyEmail.trim() || null,
            notifyOn,
            includeCsv: notifyIncludeCsv,
            summaryEnabled,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Notifications update failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      const data = (await res.json()) as {
        notifyEnabled: boolean;
        notifyEmail: string | null;
        notifyOn: NotifyOnOption;
        notifyIncludeCsv: boolean;
        summaryEnabled: boolean;
      };

      setNotifyEnabled(data.notifyEnabled);
      setNotifyEmail(data.notifyEmail ?? "");
      setNotifyOn(normalizeNotifyOn(data.notifyOn));
      setNotifyIncludeCsv(data.notifyIncludeCsv);
      setSummaryEnabled(data.summaryEnabled);

      setSites((prev) =>
        prev.map((site) =>
          site.id === selectedSiteId
            ? {
                ...site,
                notify_enabled: data.notifyEnabled,
                notify_email: data.notifyEmail,
                notify_on: normalizeNotifyOn(data.notifyOn),
                notify_include_csv: data.notifyIncludeCsv,
                summary_enabled: data.summaryEnabled,
              }
            : site,
        ),
      );

      pushToast("Notifications updated", "success");
    } catch (err: unknown) {
      setNotifyError(getErrorMessage(err, "Failed to update notifications"));
    } finally {
      setNotifySaving(false);
    }
  }

  async function handleSaveUptime() {
    if (!selectedSiteId) return;
    if (!uptimeCheckUrl.trim()) {
      setUptimeError("Homepage URL is required.");
      return;
    }
    setUptimeSaving(true);
    setUptimeError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/uptime`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            enabled: uptimeEnabled,
            checkUrl: uptimeCheckUrl.trim(),
            failureThreshold: uptimeFailureThreshold,
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Uptime update failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      const data = (await res.json()) as UptimeSummaryResponse;
      setUptimeEnabled(data.enabled);
      setUptimeCheckUrl(data.checkUrl);
      setUptimeFailureThreshold(data.failureThreshold);
      await refreshDashboardSummary(selectedSiteId, "uptime_save");
      pushToast("Availability monitoring updated", "success");
    } catch (err: unknown) {
      setUptimeError(getErrorMessage(err, "Failed to update availability"));
    } finally {
      setUptimeSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!selectedSiteId) return;
    setNotifyTestSending(true);
    setNotifyError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/notifications/test`,
        { method: "POST" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Test alert failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      pushToast("Test alert generated", "success");
    } catch (err: unknown) {
      setNotifyError(getErrorMessage(err, "Failed to send test alert"));
      pushToast(getErrorMessage(err, "Failed to send test alert"), "warning");
    } finally {
      setNotifyTestSending(false);
    }
  }

  async function fetchOccurrencesForLink(scanLinkId: string, offset: number) {
    setOccurrencesLoadingByLinkId((prev) => ({ ...prev, [scanLinkId]: true }));
    setOccurrencesErrorByLinkId((prev) => ({ ...prev, [scanLinkId]: null }));

    try {
      const res = await apiFetch(
        `${API_BASE}/scan-links/${encodeURIComponent(scanLinkId)}/occurrences?limit=${OCCURRENCES_PAGE_SIZE}&offset=${offset}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch occurrences: ${res.status}`);
      }

      const data: ScanLinkOccurrencesResponse = await res.json();
      setOccurrencesByLinkId((prev) => ({
        ...prev,
        [scanLinkId]:
          offset === 0
            ? data.occurrences
            : [...(prev[scanLinkId] ?? []), ...data.occurrences],
      }));
      setOccurrencesOffsetByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: offset + data.countReturned,
      }));
      setOccurrencesTotalByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: data.totalMatching,
      }));
      setOccurrencesHasMoreByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: offset + data.countReturned < data.totalMatching,
      }));
      setOccurrencesLoadingByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: false,
      }));
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err, "Failed to load occurrences");
      setOccurrencesLoadingByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: false,
      }));
      setOccurrencesErrorByLinkId((prev) => ({
        ...prev,
        [scanLinkId]: errorMsg,
      }));
    }
  }

  async function handleLoadMoreOccurrences(scanLinkId: string) {
    const offset = occurrencesOffsetByLinkId[scanLinkId] ?? 0;
    await fetchOccurrencesForLink(scanLinkId, offset);
  }

  function resetOccurrencesState() {
    setOccurrencesByLinkId({});
    setOccurrencesOffsetByLinkId({});
    setOccurrencesHasMoreByLinkId({});
    setOccurrencesLoadingByLinkId({});
    setOccurrencesTotalByLinkId({});
    setOccurrencesErrorByLinkId({});
  }

  async function copyToClipboard(
    text: string,
    _feedbackKey?: string,
    toastMessage = "Copied to clipboard",
  ) {
    try {
      await navigator.clipboard.writeText(text);
      pushToast(toastMessage, "success");
    } catch (err) {
      pushToast("Copy failed", "warning");
    }
  }

  function openNoteModal(linkUrl: string) {
    const existing = linkNotesByUrl.get(linkUrl);
    setNoteTargetUrl(linkUrl);
    setNoteDraft(existing?.note ?? "");
    setNoteStatus(existing?.status ?? "open");
    setNoteError(null);
    setNoteModalOpen(true);
  }

  async function handleSaveNote() {
    if (!selectedSiteId || !noteTargetUrl) return;
    if (!noteDraft.trim()) {
      setNoteError("Note cannot be empty.");
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/link-notes`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            link_url: noteTargetUrl,
            note: noteDraft.trim(),
            status: noteStatus,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Save failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      setNoteModalOpen(false);
      setNoteTargetUrl(null);
      setNoteDraft("");
      queryClient.invalidateQueries({
        queryKey: ["linkNotes", selectedSiteId],
      });
      queryClient.invalidateQueries({ queryKey: ["fixQueue", selectedSiteId] });
      pushToast("Note saved", "success");
    } catch (err: unknown) {
      setNoteError(getErrorMessage(err, "Failed to save note"));
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleDeleteNote() {
    if (!selectedSiteId || !noteTargetUrl) return;
    setNoteDeleting(true);
    setNoteError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/link-notes`,
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ link_url: noteTargetUrl }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Delete failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      setNoteModalOpen(false);
      setNoteTargetUrl(null);
      setNoteDraft("");
      queryClient.invalidateQueries({
        queryKey: ["linkNotes", selectedSiteId],
      });
      queryClient.invalidateQueries({ queryKey: ["fixQueue", selectedSiteId] });
      pushToast("Note deleted", "info");
    } catch (err: unknown) {
      setNoteError(getErrorMessage(err, "Failed to delete note"));
    } finally {
      setNoteDeleting(false);
    }
  }

  async function handleIgnoreLinkByUrl(linkUrl: string, runId?: string | null) {
    const targetRunId = runId ?? selectedRunId;
    if (!targetRunId) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(
          targetRunId,
        )}/links/${encodeURIComponent(linkUrl)}/ignore`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Ignore failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      if (selectedRunId && selectedRunId === targetRunId) {
        await loadResults(selectedRunId);
        await loadIgnoredResults(selectedRunId);
      }
      queryClient.invalidateQueries({ queryKey: ["fixQueue", selectedSiteId] });
      pushToast("Ignored link", "info");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to ignore link"), "warning");
    }
  }

  function openSourcePage(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function openFirstSourceForResult(row: ScanLink) {
    const existing = occurrencesByLinkId[row.id] ?? [];
    if (existing.length > 0) {
      openSourcePage(existing[0].source_page);
      return;
    }
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-links/${encodeURIComponent(row.id)}/occurrences?limit=1&offset=0`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch source page: ${res.status}`);
      }
      const data = (await res.json()) as ScanLinkOccurrencesResponse;
      const first = data.occurrences?.[0];
      if (first?.source_page) {
        openSourcePage(first.source_page);
      } else {
        pushToast("No source page available", "warning");
      }
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to open source page"), "warning");
    }
  }

  function getExportClassification(): LinkClassification | "all" {
    if (
      activeTab === "broken" ||
      activeTab === "blocked" ||
      activeTab === "ok" ||
      activeTab === "no_response"
    ) {
      return activeTab;
    }
    return "all";
  }

  function buildReportLink(scanRunId: string) {
    return buildAppUrl("/report", { scanRunId });
  }

  function navigateTo(pathname: string) {
    const url = buildAppUrl(pathname);
    window.history.pushState({}, "", url);
    const nextRoute = getRouteFromLocation();
    setRoute(nextRoute);
    setLearnSlug(getLearnSlugFromLocation());
    setViewMode(nextRoute === "report" ? "report" : "dashboard");
  }

  function openLearnArticle(slug: string) {
    navigateTo(buildLearnArticlePath(slug));
  }

  function openReport(scanRunId: string) {
    const url = buildReportLink(scanRunId);
    window.history.pushState({}, "", url);
    setRoute("report");
    setLearnSlug(null);
    setReportScanRunId(scanRunId);
    setReportRunData(null);
    setReportSummaryRows([]);
    setReportIgnoredTotal(null);
    setReportLastLoadedAt(null);
    resetReportSections();
    setReportError(null);
    setViewMode("report");
  }

  function backToDashboard() {
    const url = buildAppUrl("/app");
    window.history.pushState({}, "", url);
    setRoute("app");
    setLearnSlug(null);
    setReportScanRunId(null);
    setReportRunData(null);
    setReportSummaryRows([]);
    setReportIgnoredTotal(null);
    setReportLastLoadedAt(null);
    resetReportSections();
    setReportError(null);
    setViewMode("dashboard");
  }

  function triggerExport(
    format: "csv" | "json",
    classificationOverride?: string,
  ) {
    if (!selectedRunId) return;
    const classification = classificationOverride ?? getExportClassification();
    const params = new URLSearchParams({
      classification,
      statusGroup,
      sort: sortOption,
    });
    if (activeTab === "ignored") params.set("ignoredOnly", "true");
    if (showIgnored) params.set("showIgnored", "true");
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (minOccurrencesOnly) params.set("minOccurrencesOnly", "true");
    const activeStatusFilters = Object.keys(statusFilters).filter(
      (key) => statusFilters[key],
    );
    if (activeStatusFilters.length > 0) {
      params.set("statusFilters", activeStatusFilters.join(","));
    }
    const url = `${API_BASE}/scan-runs/${encodeURIComponent(selectedRunId)}/links/export.${format}?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setExportMenuOpen(false);
    pushToast("Export started", "info");
  }

  async function handleRetryScan() {
    if (!selectedRunId) return;
    setTriggeringScan(true);
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(selectedRunId)}/retry`,
        { method: "POST" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Retry failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      setResults([]);
      resetOccurrencesState();
      setActiveRunId(selectedRunId);
      activeRunIdRef.current = selectedRunId;
      setHistory((prev) =>
        prev.map((run) =>
          run.id === selectedRunId ? { ...run, status: "queued" } : run,
        ),
      );
      pushToast("Scan queued", "info");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to retry scan"), "warning");
    } finally {
      setTriggeringScan(false);
    }
  }

  function updateScanLinkState(next: ScanLink) {
    setResults((prev) => prev.map((row) => (row.id === next.id ? next : row)));
  }

  async function handleRecheckLink(row: ScanLink) {
    if (row.ignored) {
      pushToast("Ignored links cannot be rechecked", "warning");
      return;
    }
    setRecheckLoadingId(row.id);
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-links/${encodeURIComponent(row.id)}/recheck`,
        { method: "POST" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Recheck failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as RecheckScanLinkResponse;
      if (data.scanLink) {
        updateScanLinkState(data.scanLink);
      }
      pushToast("Link rechecked", "success");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to recheck link"), "warning");
    } finally {
      setRecheckLoadingId(null);
    }
  }

  async function handleIgnoreLink(
    row: ScanLink,
    mode:
      | "this_scan"
      | "site_rule_contains"
      | "site_rule_exact"
      | "site_rule_regex",
  ) {
    if (!selectedRunId) return;
    try {
      setResults((prev) => prev.filter((item) => item.id !== row.id));
      setOccurrencesByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setOccurrencesOffsetByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setOccurrencesHasMoreByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setOccurrencesLoadingByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setOccurrencesTotalByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });
      setOccurrencesErrorByLinkId((prev) => {
        const copy = { ...prev };
        delete copy[row.id];
        return copy;
      });

      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(selectedRunId)}/scan-links/${encodeURIComponent(row.id)}/ignore`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Ignore failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      if (selectedRunId) {
        await loadResults(selectedRunId);
        await loadIgnoredResults(selectedRunId);
      }
      if (selectedSiteId) {
        queryClient.invalidateQueries({
          queryKey: ["fixQueue", selectedSiteId],
        });
      }
      pushToast("Ignored link", "info");
    } catch (err: unknown) {
      if (selectedRunId) {
        await loadResults(selectedRunId);
      }
      pushToast(getErrorMessage(err, "Failed to ignore link"), "warning");
    }
  }

  async function handleIgnoreLinkWithUndo(row: ScanLink) {
    if (!selectedRunId) return;
    try {
      setResults((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                ignored: true,
                ignored_source: "rule",
                ignored_at: new Date().toISOString(),
              }
            : item,
        ),
      );
      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(selectedRunId)}/scan-links/${encodeURIComponent(row.id)}/ignore`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "site_rule_exact" }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Ignore failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      const data = (await res.json()) as {
        scanRunId: string;
        link_url: string;
        rule?: IgnoreRule;
      };
      await loadResults(selectedRunId);
      if (selectedSiteId) {
        queryClient.invalidateQueries({
          queryKey: ["fixQueue", selectedSiteId],
        });
      }
      pushToast("Link ignored", "info", {
        label: "Undo",
        onClick: () => {
          void (async () => {
            try {
              if (data.rule?.id) {
                const deleteRes = await apiFetch(
                  `${API_BASE}/ignore-rules/${encodeURIComponent(data.rule.id)}`,
                  { method: "DELETE" },
                );
                if (!deleteRes.ok) {
                  throw new Error(`Undo failed: ${deleteRes.status}`);
                }
                await reapplyIgnoreRules(selectedRunId);
              } else {
                const unignoreRes = await apiFetch(
                  `${API_BASE}/scan-runs/${encodeURIComponent(
                    selectedRunId,
                  )}/links/${encodeURIComponent(data.link_url)}/unignore`,
                  { method: "POST" },
                );
                if (!unignoreRes.ok) {
                  throw new Error(`Undo failed: ${unignoreRes.status}`);
                }
              }
              await loadResults(selectedRunId);
              if (selectedSiteId) {
                queryClient.invalidateQueries({
                  queryKey: ["fixQueue", selectedSiteId],
                });
              }
              pushToast("Ignore undone", "success");
            } catch (err: unknown) {
              pushToast(
                getErrorMessage(err, "Failed to undo ignore"),
                "warning",
              );
            }
          })();
        },
      });
    } catch (err: unknown) {
      if (selectedRunId) {
        await loadResults(selectedRunId);
      }
      pushToast(getErrorMessage(err, "Failed to ignore link"), "warning");
    }
  }

  async function loadIgnoreRules(siteId: string) {
    setIgnoreRulesLoading(true);
    setIgnoreRulesError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(siteId)}/ignore-rules`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setIgnoreRules(data.rules ?? []);
    } catch (err: unknown) {
      setIgnoreRulesError(getErrorMessage(err, "Failed to load ignore rules"));
    } finally {
      setIgnoreRulesLoading(false);
    }
  }

  async function exportDiffCsv() {
    if (!selectedSiteId || !selectedRunId) return;
    try {
      const params = new URLSearchParams({
        baseline: diffBaseline,
        issuesOnly: diffIssuesOnly ? "true" : "false",
        exportScope: "all",
        includeIgnored: diffIncludeIgnored ? "true" : "false",
      });
      if (diffExportFilter !== "all") {
        params.set("changeTypes", diffExportFilter);
      }
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(
          selectedSiteId,
        )}/scan-runs/${encodeURIComponent(selectedRunId)}/diff.csv?${params.toString()}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Export failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        getFilenameFromDisposition(res.headers.get("Content-Disposition")) ??
        "scanlark-diff.csv";
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      if (!diffBaselineRun) {
        pushToast("No baseline scan yet – exported empty CSV", "info");
      } else {
        pushToast("Exported changes CSV", "success");
      }
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to export CSV"), "warning");
    }
  }

  async function toggleIgnoredOccurrences(
    ignoredLinkId: string,
    scanRunId: string,
  ) {
    if (ignoredOccurrences[ignoredLinkId]) {
      setIgnoredOccurrences((prev) => {
        const copy = { ...prev };
        delete copy[ignoredLinkId];
        return copy;
      });
      return;
    }

    setIgnoredOccLoading((prev) => ({ ...prev, [ignoredLinkId]: true }));
    setIgnoredOccError((prev) => ({ ...prev, [ignoredLinkId]: null }));
    try {
      const res = await apiFetch(
        `${API_BASE}/scan-runs/${encodeURIComponent(scanRunId)}/ignored/${encodeURIComponent(ignoredLinkId)}/occurrences?limit=${IGNORED_OCCURRENCES_LIMIT}&offset=0`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data: IgnoredOccurrencesResponse = await res.json();
      setIgnoredOccurrences((prev) => ({
        ...prev,
        [ignoredLinkId]: data.occurrences ?? [],
      }));
    } catch (err: unknown) {
      setIgnoredOccError((prev) => ({
        ...prev,
        [ignoredLinkId]: getErrorMessage(err, "Failed to load occurrences"),
      }));
    } finally {
      setIgnoredOccLoading((prev) => ({ ...prev, [ignoredLinkId]: false }));
    }
  }
  async function reapplyIgnoreRules(runId: string) {
    await apiFetch(
      `${API_BASE}/scan-runs/${encodeURIComponent(runId)}/reapply-ignore?force=1`,
      {
        method: "POST",
      },
    );
    if (selectedSiteId) {
      queryClient.invalidateQueries({ queryKey: ["fixQueue", selectedSiteId] });
    }
  }

  async function handleCreateIgnoreRule() {
    if (!selectedSiteId) return;
    const pattern = newRulePattern.trim();
    if (!pattern) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/ignore-rules`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ruleType: newRuleType,
            pattern,
            scope: newRuleScope,
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Create failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      setNewRulePattern("");
      await loadIgnoreRules(selectedSiteId);
      if (selectedRunId) await reapplyIgnoreRules(selectedRunId);
      pushToast("Ignore rule created", "success");
    } catch (err: unknown) {
      pushToast(
        getErrorMessage(err, "Failed to create ignore rule"),
        "warning",
      );
    }
  }

  async function handleToggleIgnoreRule(rule: IgnoreRule) {
    try {
      const res = await apiFetch(
        `${API_BASE}/ignore-rules/${encodeURIComponent(rule.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isEnabled: !rule.is_enabled }),
        },
      );
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      if (selectedSiteId) await loadIgnoreRules(selectedSiteId);
      if (selectedRunId) await reapplyIgnoreRules(selectedRunId);
      pushToast(rule.is_enabled ? "Rule disabled" : "Rule enabled", "info");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to update rule"), "warning");
    }
  }

  async function handleDeleteIgnoreRule(rule: IgnoreRule) {
    try {
      const res = await apiFetch(
        `${API_BASE}/ignore-rules/${encodeURIComponent(rule.id)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      if (selectedSiteId) await loadIgnoreRules(selectedSiteId);
      if (selectedRunId) await reapplyIgnoreRules(selectedRunId);
      pushToast("Rule deleted", "info");
    } catch (err: unknown) {
      pushToast(getErrorMessage(err, "Failed to delete rule"), "warning");
    }
  }

  async function handleRunScanWithUrl(url: string) {
    if (!selectedSiteId || !url.trim()) return;

    setTriggeringScan(true);
    setTriggerError(null);
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/scans`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startUrl: url }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Scan trigger failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }

      const data = await res.json();
      const scanRunId: string | undefined = data.scanRunId;

      if (scanRunId) {
        const optimistic: ScanRunSummary = {
          id: scanRunId,
          site_id: selectedSiteId,
          status: "queued",
          started_at: new Date().toISOString(),
          finished_at: null,
          start_url: url,
          total_links: 0,
          checked_links: 0,
          broken_links: 0,
        };

        setHistory((prev) => {
          const without = prev.filter((r) => r.id !== scanRunId);
          return [optimistic, ...without];
        });

        setResults([]);
        resetOccurrencesState();

        setSelectedRunId(scanRunId);
        selectedRunIdRef.current = scanRunId;

        setActiveRunId(scanRunId);
        activeRunIdRef.current = scanRunId;
        markRunProgress(scanRunId);

        void refreshDashboardSummary(selectedSiteId, "scan_start", {
          targetRunId: scanRunId,
          maxAttempts: 2,
        });
        void refreshSelectedRun(scanRunId);
        pushToast("Scan queued", "info");
      } else {
        await loadHistory(selectedSiteId, { preserveSelection: false });
      }
    } catch (err: unknown) {
      setTriggerError(getErrorMessage(err, "Failed to start scan"));
    } finally {
      setTriggeringScan(false);
    }
  }

  function handleThemeChange(next: ThemePreference) {
    setThemePreference(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }

  function handleThemeToggle() {
    const next = themeMode === "dark" ? "light" : "dark";
    handleThemeChange(next);
  }

  function pushToast(
    message: string,
    tone: "success" | "warning" | "info" = "info",
    action?: { label: string; onClick: () => void },
  ) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, tone, action }]);
    const ttl = action ? 4500 : 2200;
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, ttl);
  }

  function maybeNotifyRunStatus(run: ScanRunSummary) {
    const prev = runStatusRef.current.get(run.id);
    if (prev === run.status) return;
    runStatusRef.current.set(run.id, run.status);
    if (run.status === "completed") {
      const canUseResults =
        run.id === selectedRunIdRef.current && results.length > 0;
      const canUseDiagnostics =
        run.id === selectedRunIdRef.current && currentPhase0Diagnostics != null;
      const blockedCount = canUseDiagnostics
        ? phase0BlockedCount
        : canUseResults
          ? blockedResults.length
          : 0;
      const noResponseCount = canUseDiagnostics
        ? phase0NoResponseCount
        : canUseResults
          ? noResponseResults.length
          : 0;
      const checked = run.checked_links ?? 0;
      const total = run.total_links ?? 0;
      const broken = canUseDiagnostics
        ? phase0BrokenCount
        : (run.broken_links ?? 0);
      const message = `Scan complete: ${checked}/${total} checked • ${broken} broken • ${blockedCount} blocked • ${noResponseCount} no response`;
      pushToast(message, "success", {
        label: "View results",
        onClick: () => {
          setSelectedRunId(run.id);
          scansRef.current?.scrollIntoView({ behavior: "smooth" });
        },
      });
    }
    if (run.status === "failed") pushToast("Scan failed", "warning");
  }

  function toggleStatusFilter(key: string) {
    setStatusFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function createQuickIgnoreRule(
    ruleType: IgnoreRule["rule_type"],
    pattern: string,
  ) {
    if (!selectedSiteId) return;
    try {
      const res = await apiFetch(
        `${API_BASE}/sites/${encodeURIComponent(selectedSiteId)}/ignore-rules`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ruleType,
            pattern,
            scope: "site",
          }),
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Create failed: ${res.status}${text ? ` - ${text.slice(0, 200)}` : ""}`,
        );
      }
      await loadIgnoreRules(selectedSiteId);
      if (selectedRunId) await reapplyIgnoreRules(selectedRunId);
      if (selectedRunId) await loadResults(selectedRunId);
      pushToast("Ignore rule applied", "success");
    } catch (err: unknown) {
      pushToast(
        getErrorMessage(err, "Failed to create ignore rule"),
        "warning",
      );
    }
  }

  function openDetails(row: ScanLink) {
    setDetailsLinkId(row.id);
    setDetailsOpen(true);
    if (!occurrencesByLinkId[row.id]) {
      void fetchOccurrencesForLink(row.id, 0);
    }
  }

  function handleRowClick(
    event: React.MouseEvent<HTMLDivElement>,
    row: ScanLink,
  ) {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-no-drawer]")) return;
    openDetails(row);
  }

  function toggleFixQueueExpanded(linkUrl: string) {
    setFixQueueExpanded((prev) => ({
      ...prev,
      [linkUrl]: !prev[linkUrl],
    }));
  }

  type LinkRowTheme = {
    accent: string;
    border: string;
    copyBorder: string;
    copyColor: string;
    panelBg: string;
  };

  function renderLinkRows(
    rows: ScanLink[],
    themeForRow: (row: ScanLink) => LinkRowTheme,
  ) {
    return rows.map((row) => {
      const theme = themeForRow(row);
      const linkCopyKey = `link:${row.id}`;
      const host = safeHost(row.link_url);
      const note = linkNotesByUrl.get(row.link_url);
      const hasNote = !!note;
      const sourcePages = (occurrencesByLinkId[row.id] ?? []).map(
        (occ) => occ.source_page,
      );
      const menuId = `result:${row.id}`;
      const menuOpen = actionMenuOpenId === menuId;
      const statusChipBg =
        row.status_code == null
          ? "var(--border)"
          : row.status_code >= 500
            ? "var(--danger)"
            : row.status_code === 404 || row.status_code === 410
              ? "var(--danger)"
              : row.status_code === 401 ||
                  row.status_code === 403 ||
                  row.status_code === 429
                ? "var(--warning)"
                : "var(--success)";
      const statusChipText = row.status_code == null ? "var(--muted)" : "white";

      return (
        <div
          id={`scan-link-${row.id}`}
          key={row.id}
          className={`result-row severity-${row.classification}`}
          data-classification={row.classification}
          style={{
            borderLeft: `3px solid ${theme.border}`,
            background: theme.panelBg,
            boxShadow: row.ignored ? "none" : "var(--soft-shadow)",
            opacity: row.ignored ? 0.7 : 1,
          }}
          onClick={(event) => handleRowClick(event, row)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDetails(row);
            }
          }}
        >
          <div className="result-cell result-link">
            <div className="result-host">{host}</div>
            <div className="result-url" title={row.link_url}>
              {row.link_url}
            </div>
            <div className="result-meta">
              {row.error_message ? row.error_message : "Tap for details"}
              {hasNote && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  Note
                </span>
              )}
            </div>
          </div>
          <div className="result-cell result-status">
            <span
              className="status-chip"
              style={{ background: statusChipBg, color: statusChipText }}
              title={statusTooltip(row.status_code)}
            >
              {row.status_code ?? "No response"}
            </span>
            <span
              className="status-chip subtle"
              style={{ borderColor: theme.border }}
            >
              {formatClassification(row.classification)}
            </span>
            {row.ignored && <span className="status-chip subtle">Ignored</span>}
          </div>
          <div className="result-cell result-occ">
            <div className="occ-count">{row.occurrence_count}</div>
            <div className="occ-label">
              {row.occurrence_count === 1 ? "occurrence" : "occurrences"}
            </div>
          </div>
          <div
            className="result-cell result-actions row-actions"
            data-no-drawer
          >
            <div
              style={{ position: "relative", display: "inline-flex" }}
              data-action-menu
            >
              <button
                onClick={() => setActionMenuOpenId(menuOpen ? null : menuId)}
                className="icon-button"
                style={{
                  borderColor: theme.copyBorder,
                  color: theme.copyColor,
                  padding: "6px",
                }}
                aria-label="Open actions"
                title="Actions"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                  <circle cx="19" cy="12" r="1.6" fill="currentColor" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  className="action-menu"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 6px)",
                    background: "var(--panel)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    boxShadow: "var(--shadow)",
                    padding: "6px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    minWidth: "220px",
                    zIndex: 40,
                  }}
                >
                  <button
                    onClick={() => {
                      void copyToClipboard(
                        row.link_url,
                        linkCopyKey,
                        "Copied link URL",
                      );
                      setActionMenuOpenId(null);
                    }}
                    data-no-drawer
                  >
                    Copy Link URL
                  </button>
                  <button
                    onClick={() => {
                      window.open(
                        row.link_url,
                        "_blank",
                        "noopener,noreferrer",
                      );
                      setActionMenuOpenId(null);
                    }}
                    data-no-drawer
                  >
                    Open Link
                  </button>
                  <button
                    onClick={() => {
                      if (sourcePages.length > 0) {
                        openSourcePage(sourcePages[0]);
                      } else {
                        void openFirstSourceForResult(row);
                      }
                      setActionMenuOpenId(null);
                    }}
                    data-no-drawer
                  >
                    Open Source Page
                  </button>
                  {sourcePages.length > 1 && (
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      {sourcePages.map((page) => (
                        <button
                          key={page}
                          onClick={() => {
                            openSourcePage(page);
                            setActionMenuOpenId(null);
                          }}
                          style={{
                            fontSize: "11px",
                            textAlign: "left",
                            color: "var(--muted)",
                            background: "transparent",
                            border: "1px solid transparent",
                            padding: "4px 6px",
                          }}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      handleIgnoreLink(row, "site_rule_exact");
                      setActionMenuOpenId(null);
                    }}
                    disabled={row.ignored}
                    data-no-drawer
                  >
                    {row.ignored ? "Ignored" : "Ignore this link"}
                  </button>
                  <button
                    onClick={() => {
                      openNoteModal(row.link_url);
                      setActionMenuOpenId(null);
                    }}
                    data-no-drawer
                  >
                    {hasNote ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });
  }

  const brokenTheme: LinkRowTheme = {
    accent: "var(--danger)",
    border: "var(--danger)",
    copyBorder: "var(--danger)",
    copyColor: "var(--danger)",
    panelBg: "var(--panel-elev)",
  };

  const blockedTheme: LinkRowTheme = {
    accent: "var(--warning)",
    border: "var(--warning)",
    copyBorder: "var(--warning)",
    copyColor: "var(--warning)",
    panelBg: "var(--panel-elev)",
  };

  const okTheme: LinkRowTheme = {
    accent: "var(--success)",
    border: "var(--success)",
    copyBorder: "var(--success)",
    copyColor: "var(--success)",
    panelBg: "var(--panel-elev)",
  };

  const noResponseTheme: LinkRowTheme = {
    accent: "var(--muted)",
    border: "var(--border)",
    copyBorder: "var(--border)",
    copyColor: "var(--muted)",
    panelBg: "var(--panel-elev)",
  };

  const themeForClassification = (classification: LinkClassification) => {
    if (classification === "blocked") return blockedTheme;
    if (classification === "ok") return okTheme;
    if (classification === "no_response") return noResponseTheme;
    return brokenTheme;
  };

  const renderFixQueueRow = (item: FixQueueItem) => {
    const theme = themeForClassification(item.classification);
    const tone = changeTypeTone(item.change_type);
    const statusChipBg =
      item.status_code == null
        ? "var(--border)"
        : item.status_code >= 500
          ? "var(--danger)"
          : item.status_code === 404 || item.status_code === 410
            ? "var(--danger)"
            : item.status_code === 401 ||
                item.status_code === 403 ||
                item.status_code === 429
              ? "var(--warning)"
              : "var(--success)";
    const statusChipText = item.status_code == null ? "var(--muted)" : "white";
    const menuId = `fix:${item.change_type}:${item.link_url}`;
    const menuOpen = actionMenuOpenId === menuId;
    const isExpanded = !!fixQueueExpanded[item.link_url];
    const noteSnippet =
      item.note?.note && item.note.note.length > 120
        ? `${item.note.note.slice(0, 120)}…`
        : (item.note?.note ?? null);

    return (
      <div
        key={`${item.change_type}:${item.link_url}`}
        className="result-row"
        style={{
          borderLeft: `3px solid ${theme.border}`,
          background: theme.panelBg,
          boxShadow: "var(--soft-shadow)",
          opacity: item.ignored ? 0.6 : 1,
          margin: "10px 16px",
        }}
      >
        <div className="result-cell result-link">
          <div className="result-host">{safeHost(item.link_url)}</div>
          <div className="result-url" title={item.link_url}>
            {item.link_url}
          </div>
          <div className="result-meta">
            {item.error_message || "Focus this link in your queue"}
            {noteSnippet && (
              <>
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  {noteSnippet}
                </span>
                <span
                  style={{
                    marginLeft: "6px",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  {item.note?.status === "resolved"
                    ? "Resolved"
                    : item.note?.status === "snoozed"
                      ? "Snoozed"
                      : "Note"}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="result-cell result-status">
          <span
            className="status-chip"
            style={{ background: statusChipBg, color: statusChipText }}
          >
            {item.status_code ?? "No response"}
          </span>
          <span
            className="status-chip subtle"
            style={{ borderColor: theme.border }}
          >
            {formatClassification(item.classification)}
          </span>
          <span
            className="status-chip"
            style={{ background: tone.bg, color: tone.text }}
          >
            {item.change_type === "new_issue" ? "New" : "Outstanding"}
          </span>
          {item.ignored && <span className="status-chip subtle">Ignored</span>}
        </div>
        <div className="result-cell result-occ">
          <div className="occ-count">{item.source_pages.length}</div>
          <div className="occ-label">
            {item.source_pages.length === 1 ? "source page" : "source pages"}
          </div>
          {item.source_pages.length > 0 && (
            <button
              onClick={() => toggleFixQueueExpanded(item.link_url)}
              className="tab-pill"
              style={{ marginTop: "6px" }}
              data-no-drawer
            >
              {isExpanded ? "Hide sources" : "Show sources"}
            </button>
          )}
        </div>
        <div className="result-cell result-actions row-actions" data-no-drawer>
          <div style={{ position: "relative" }} data-action-menu>
            <button
              onClick={() => setActionMenuOpenId(menuOpen ? null : menuId)}
              className="icon-button"
              style={{
                borderColor: theme.copyBorder,
                color: theme.copyColor,
                padding: "6px",
              }}
              aria-label="Open actions"
              title="Actions"
              data-no-drawer
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="19" cy="12" r="1.6" fill="currentColor" />
              </svg>
            </button>
            {menuOpen && (
              <div
                className="action-menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 6px)",
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: "220px",
                  zIndex: 40,
                }}
              >
                <button
                  onClick={() => {
                    void copyToClipboard(
                      item.link_url,
                      undefined,
                      "Copied link URL",
                    );
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Copy Link URL
                </button>
                <button
                  onClick={() => {
                    window.open(item.link_url, "_blank", "noopener,noreferrer");
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Open Link
                </button>
                <button
                  onClick={() => {
                    const source = item.source_pages[0];
                    if (source) openSourcePage(source);
                    else pushToast("No source page available", "warning");
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Open Source Page
                </button>
                {item.source_pages.length > 1 && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    {item.source_pages.map((page) => (
                      <button
                        key={page}
                        onClick={() => {
                          openSourcePage(page);
                          setActionMenuOpenId(null);
                        }}
                        style={{
                          fontSize: "11px",
                          textAlign: "left",
                          color: "var(--muted)",
                          background: "transparent",
                          border: "1px solid transparent",
                          padding: "4px 6px",
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    void handleIgnoreLinkByUrl(
                      item.link_url,
                      fixQueueData?.currentRun?.id ?? null,
                    );
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  Ignore this link
                </button>
                <button
                  onClick={() => {
                    openNoteModal(item.link_url);
                    setActionMenuOpenId(null);
                  }}
                  data-no-drawer
                >
                  {item.note ? "Edit Note" : "Add Note"}
                </button>
              </div>
            )}
          </div>
        </div>
        {isExpanded && item.source_pages.length > 0 && (
          <div
            className="expand-panel"
            style={{
              padding: "10px 12px",
              margin: "0 12px 12px",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              background: "var(--panel)",
              boxShadow: "var(--soft-shadow)",
            }}
          >
            {item.source_pages.map((page) => (
              <div
                key={page}
                style={{
                  fontSize: "12px",
                  color: "var(--muted)",
                  overflowWrap: "anywhere",
                }}
              >
                {page}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const selectedOccurrences = useMemo(() => {
    if (!selectedLink) return [];
    return occurrencesByLinkId[selectedLink.id] ?? [];
  }, [occurrencesByLinkId, selectedLink]);
  const selectedOccurrencesTotal = selectedLink
    ? (occurrencesTotalByLinkId[selectedLink.id] ??
      selectedLink.occurrence_count)
    : 0;
  const selectedOccurrencesLoading = selectedLink
    ? (occurrencesLoadingByLinkId[selectedLink.id] ?? false)
    : false;
  const selectedOccurrencesError = selectedLink
    ? occurrencesErrorByLinkId[selectedLink.id]
    : null;
  const selectedOccurrencesHasMore = selectedLink
    ? (occurrencesHasMoreByLinkId[selectedLink.id] ?? false)
    : false;
  const showOccurrencesSkeleton =
    selectedOccurrencesLoading && selectedOccurrences.length === 0;
  const noteExisting = noteTargetUrl
    ? (linkNotesByUrl.get(noteTargetUrl) ?? null)
    : null;

  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        color: "var(--text)",
        padding: "24px",
        width: "100%",
        maxWidth: "100%",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        :root[data-theme="dark"] {
          --bg: #070b14;
          --surface: #0f172a;
          --surface-2: #111f3a;
          --surface-3: #0b1224;
          --border: rgba(148, 163, 184, 0.18);
          --text: #e2e8f0;
          --muted: #94a3b8;
          --accent: #38bdf8;
          --accent-2: #22d3ee;
          --danger: #f87171;
          --warning: #fbbf24;
          --success: #34d399;
          --shadow: 0 20px 60px rgba(2, 6, 23, 0.45);
          --soft-shadow: 0 10px 30px rgba(2, 6, 23, 0.32);
          --chip-bg: rgba(15, 23, 42, 0.9);
          --chip-text: #e2e8f0;
          --ghost: #0b1220;
          --surface-accent: rgba(56, 189, 248, 0.1);
        }
        :root[data-theme="light"] {
          --bg: #f8fafc;
          --surface: #ffffff;
          --surface-2: #f1f5f9;
          --surface-3: #eef2ff;
          --border: rgba(15, 23, 42, 0.12);
          --text: #0f172a;
          --muted: #64748b;
          --accent: #2563eb;
          --accent-2: #38bdf8;
          --danger: #dc2626;
          --warning: #d97706;
          --success: #16a34a;
          --shadow: 0 16px 36px rgba(15, 23, 42, 0.12);
          --soft-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
          --chip-bg: rgba(241, 245, 249, 0.9);
          --chip-text: #0f172a;
          --ghost: #ffffff;
          --surface-accent: rgba(37, 99, 235, 0.08);
        }
        :root {
          --panel: var(--surface);
          --panel-elev: var(--surface-2);
          --panel-faint: var(--surface-3);
          --font-body: "IBM Plex Sans", system-ui, -apple-system, sans-serif;
          --font-display: "Space Grotesk", "IBM Plex Sans", system-ui, sans-serif;
        }
        html, body {
          margin: 0;
          padding: 0;
        }
        * {
          box-sizing: border-box;
        }
        .app-container {
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
          font-family: var(--font-body);
          min-height: calc(100vh - 48px);
          min-width: 0;
        }
        .app-shell {
          background: radial-gradient(1200px 420px at 10% -20%, rgba(34, 211, 238, 0.2), transparent 60%),
            radial-gradient(900px 340px at 90% -10%, rgba(59, 130, 246, 0.18), transparent 60%),
            var(--bg);
        }
        .primary-button,
        .secondary-button,
        .ghost-button,
        .toggle-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 40px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
        }
        .primary-button:hover,
        .secondary-button:hover,
        .ghost-button:hover,
        .toggle-pill:hover {
          transform: translateY(-1px);
        }
        .primary-button:disabled,
        .secondary-button:disabled,
        .ghost-button:disabled,
        .toggle-pill:disabled {
          cursor: not-allowed;
          opacity: 0.65;
          transform: none;
        }
        .primary-button {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          border-color: color-mix(in srgb, var(--accent) 66%, white 8%);
          box-shadow: 0 14px 28px color-mix(in srgb, var(--accent) 22%, transparent);
        }
        .primary-button--large {
          min-height: 48px;
          padding: 12px 18px;
          font-size: 14px;
        }
        .secondary-button {
          background: color-mix(in srgb, var(--panel) 88%, white 6%);
          color: var(--text);
          box-shadow: var(--soft-shadow);
        }
        .ghost-button {
          background: transparent;
          color: var(--text);
        }
        .toggle-pill {
          background: transparent;
          color: var(--text-muted);
          border-radius: 999px;
        }
        .toggle-pill.active {
          background: var(--panel-elev);
          color: var(--text);
          border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
        }
        .field-label {
          display: grid;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .app-input {
          width: 100%;
          min-height: 42px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel-elev);
          color: var(--text);
          font: inherit;
        }
        .app-input:focus {
          outline: 2px solid color-mix(in srgb, var(--accent) 44%, transparent);
          border-color: color-mix(in srgb, var(--accent) 46%, var(--border));
        }
        .marketing-chip {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 72%, transparent);
          color: var(--text-muted);
          font-size: 12px;
          white-space: nowrap;
        }
        .marketing-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(420px, 0.95fr);
          gap: clamp(44px, 5vw, 88px);
          align-items: center;
          min-height: min(78vh, 820px);
          padding: clamp(24px, 5vh, 56px) 0 clamp(36px, 6vh, 72px);
        }
        .marketing-hero__content {
          display: grid;
          gap: 22px;
          align-content: center;
          min-width: 0;
          max-width: 620px;
        }
        .marketing-hero__headline {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(54px, 5.2vw, 86px);
          line-height: 0.94;
          font-weight: 700;
          max-width: 9.8ch;
          text-wrap: balance;
        }
        .marketing-hero__body {
          font-size: clamp(17px, 1.55vw, 19px);
          line-height: 1.7;
          color: var(--text-muted);
          max-width: 56ch;
        }
        .marketing-hero__actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 4px;
        }
        .marketing-hero__chips {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, max-content));
          gap: 10px 14px;
          align-items: start;
          padding-top: 8px;
        }
        .marketing-hero__preview-shell {
          position: relative;
          min-height: 0;
          display: grid;
          place-items: center;
          padding: clamp(12px, 2vw, 24px) 0;
        }
        .marketing-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(44px);
          opacity: 0.75;
        }
        .marketing-glow--primary {
          inset: 12% auto auto 8%;
          width: 220px;
          height: 220px;
          background: rgba(56, 189, 248, 0.28);
        }
        .marketing-glow--secondary {
          inset: auto 2% 8% auto;
          width: 180px;
          height: 180px;
          background: rgba(139, 92, 246, 0.22);
        }
        .marketing-mockup {
          position: relative;
          width: min(100%, 520px);
          min-width: 0;
          border-radius: 24px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, white 10%);
          background: color-mix(in srgb, var(--panel) 90%, rgba(15, 23, 42, 0.12));
          box-shadow: var(--shadow);
          backdrop-filter: blur(14px);
          padding: 20px;
          display: grid;
          gap: 16px;
        }
        .marketing-mockup__toolbar,
        .marketing-score-row,
        .marketing-category-grid,
        .marketing-pricing-grid,
        .marketing-faq-grid,
        .marketing-feature-grid,
        .marketing-step-grid {
          display: grid;
          gap: 12px;
        }
        .marketing-mockup__toolbar {
          display: flex;
          flex-wrap: wrap;
        }
        .marketing-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel-elev);
          font-size: 11px;
          font-weight: 700;
        }
        .marketing-badge--success {
          color: color-mix(in srgb, var(--success) 94%, white 6%);
          border-color: color-mix(in srgb, var(--success) 40%, var(--border));
          background: color-mix(in srgb, var(--success) 14%, var(--panel-elev));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success) 8%, transparent);
        }
        .marketing-badge--warning {
          color: color-mix(in srgb, var(--warning) 88%, white 12%);
          border-color: color-mix(in srgb, var(--warning) 38%, var(--border));
          background: color-mix(in srgb, var(--warning) 12%, var(--panel-elev));
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 8%, transparent);
        }
        .marketing-mockup__hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(136px, 164px);
          gap: 16px;
          align-items: center;
        }
        .marketing-kicker {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .marketing-score-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .marketing-score-card,
        .marketing-category-card,
        .marketing-history-card,
        .marketing-feature-card,
        .marketing-step-card,
        .marketing-boundary-card,
        .marketing-pricing-card,
        .marketing-faq-card {
          border-radius: 16px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 92%, rgba(15, 23, 42, 0.06));
          box-shadow: var(--soft-shadow);
        }
        .marketing-score-card,
        .marketing-history-card,
        .marketing-feature-card,
        .marketing-step-card,
        .marketing-boundary-card,
        .marketing-pricing-card,
        .marketing-faq-card {
          padding: 16px;
        }
        .marketing-score-card__label {
          font-size: 12px;
          color: var(--text-muted);
        }
        .marketing-score-card__value {
          margin-top: 8px;
          font-size: 34px;
          font-family: var(--font-display);
          font-weight: 700;
        }
        .marketing-score-ring {
          display: grid;
          place-items: center;
          min-width: 0;
        }
        .marketing-score-ring__inner {
          width: clamp(132px, 30vw, 154px);
          aspect-ratio: 1;
          border-radius: 50%;
          display: grid;
          place-items: center;
          text-align: center;
          background: conic-gradient(var(--accent) 0 62%, rgba(148, 163, 184, 0.16) 62% 100%);
          box-shadow: 0 18px 48px color-mix(in srgb, var(--accent) 18%, transparent);
          position: relative;
        }
        .marketing-score-ring__inner::after {
          content: "";
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          background: var(--panel);
          border: 1px solid var(--border);
        }
        .marketing-score-ring__content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          width: 100%;
          padding: 0 24px 2px;
          text-align: center;
          transform: translateY(2px);
        }
        .marketing-score-ring__content strong,
        .marketing-score-ring__content span {
          position: relative;
        }
        .marketing-score-ring__content strong {
          font-size: clamp(34px, 8vw, 42px);
          font-family: var(--font-display);
          line-height: 0.9;
        }
        .marketing-score-ring__content span {
          font-size: 11px;
          line-height: 1.1;
          color: var(--text-muted);
          max-width: 7ch;
        }
        .marketing-category-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .marketing-category-card {
          padding: 14px;
          display: grid;
          gap: 6px;
          font-size: 13px;
        }
        .marketing-category-card span,
        .marketing-history-row span:last-child {
          color: var(--text-muted);
        }
        .marketing-history-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          padding-top: 10px;
          margin-top: 10px;
          border-top: 1px solid var(--border);
          font-size: 12px;
        }
        @media (max-width: 1180px) {
          .marketing-hero {
            grid-template-columns: minmax(0, 1fr) minmax(360px, 0.9fr);
            gap: 40px;
            padding-top: 24px;
          }
          .marketing-hero__content {
            max-width: 560px;
          }
          .marketing-hero__headline {
            font-size: clamp(48px, 5vw, 72px);
            max-width: 10.6ch;
          }
          .marketing-hero__chips {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .marketing-mockup {
            width: min(100%, 480px);
          }
        }
        @media (max-width: 960px) {
          .marketing-hero {
            grid-template-columns: minmax(0, 1fr);
            gap: 36px;
            min-height: auto;
            padding: 20px 0 36px;
          }
          .marketing-hero__content {
            max-width: 100%;
          }
          .marketing-hero__headline {
            font-size: clamp(44px, 7vw, 64px);
            max-width: 11ch;
          }
          .marketing-hero__preview-shell {
            justify-items: start;
            padding: 0;
          }
          .marketing-mockup {
            width: min(100%, 560px);
          }
        }
        @media (max-width: 520px) {
          .marketing-hero {
            gap: 28px;
            padding: 12px 0 28px;
          }
          .marketing-hero__content {
            gap: 18px;
          }
          .marketing-hero__headline {
            font-size: clamp(36px, 12vw, 52px);
            line-height: 0.97;
            max-width: 11.5ch;
          }
          .marketing-hero__body {
            font-size: 16px;
          }
          .marketing-hero__chips {
            grid-template-columns: 1fr;
          }
          .marketing-hero__preview-shell {
            justify-items: stretch;
          }
          .marketing-mockup {
            padding: 16px;
            border-radius: 18px;
            width: 100%;
          }
          .marketing-mockup__hero,
          .marketing-score-row,
          .marketing-category-grid {
            grid-template-columns: 1fr;
          }
          .marketing-score-ring {
            justify-self: center;
          }
          .marketing-history-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .marketing-band {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }
        .marketing-trust-item {
          min-height: 56px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 82%, transparent);
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 600;
        }
        .marketing-section {
          display: grid;
          gap: 20px;
          padding: 8px 0;
        }
        .marketing-section--split {
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          align-items: start;
        }
        .marketing-section__heading {
          display: grid;
          gap: 10px;
          max-width: 64ch;
        }
        .marketing-section__heading h2,
        .marketing-boundary-card h2,
        .marketing-pricing-card h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.08;
        }
        .marketing-section__heading p,
        .marketing-boundary-card p,
        .marketing-pricing-card p,
        .marketing-faq-card p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
          font-size: 15px;
        }
        .marketing-feature-grid,
        .marketing-faq-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .marketing-step-grid {
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }
        .marketing-feature-card h3,
        .marketing-faq-card h3 {
          margin: 0 0 10px;
          font-size: 18px;
        }
        .marketing-feature-card p,
        .marketing-faq-card p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
          font-size: 14px;
        }
        .marketing-step-card__index {
          font-family: var(--font-display);
          font-size: 28px;
          color: var(--accent);
          margin-bottom: 10px;
        }
        .marketing-step-card p,
        .marketing-pricing-grid span {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .marketing-boundary-card ul {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 8px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .marketing-pricing-grid {
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          margin-top: 14px;
        }
        .marketing-pricing-grid strong {
          display: block;
          margin-bottom: 6px;
          font-size: 16px;
        }
        .marketing-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 24px 0 8px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .marketing-footer__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .surface-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          background: color-mix(in srgb, var(--panel) 94%, rgba(255, 255, 255, 0.02));
          box-shadow: var(--soft-shadow);
        }
        .surface-card--metric,
        .surface-card--category,
        .surface-card--summary,
        .surface-card--history {
          padding: 18px;
          display: grid;
          gap: 12px;
          box-shadow: var(--soft-shadow);
        }
        .surface-card--metric {
          min-height: 168px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 92%, rgba(56, 189, 248, 0.03)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .surface-card--metric.prominent {
          min-height: 220px;
          padding: 22px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 76%, rgba(56, 189, 248, 0.12)) 0%,
            color-mix(
                in srgb,
                var(--panel-elev) 84%,
                rgba(139, 92, 246, 0.08)
              )
              100%
          );
          box-shadow: var(--shadow);
        }
        .surface-card--metric.prominent .surface-card__value {
          font-size: clamp(38px, 6vw, 54px);
        }
        .surface-card--metric.prominent .surface-card__detail {
          font-size: 13px;
        }
        .surface-card__label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .surface-card__value {
          font-size: clamp(28px, 4vw, 36px);
          line-height: 1;
          font-weight: 700;
          font-family: var(--font-display);
        }
        .surface-card__detail {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .surface-card--category {
          min-height: 172px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 94%, rgba(255, 255, 255, 0.02)) 0%,
            color-mix(
                in srgb,
                var(--panel-elev) 88%,
                rgba(56, 189, 248, 0.025)
              )
              100%
          );
        }
        .surface-card--category[data-tone="success"] {
          border-color: color-mix(in srgb, var(--success) 18%, var(--border));
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(52, 211, 153, 0.05)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .surface-card--category[data-tone="warning"] {
          border-color: color-mix(in srgb, var(--warning) 22%, var(--border));
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(251, 191, 36, 0.06)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .surface-card--summary,
        .surface-card--history {
          padding: 0;
          overflow: hidden;
        }
        .score-ring-card {
          position: relative;
          overflow: hidden;
        }
        .score-ring-card::after {
          content: "";
          position: absolute;
          inset: auto -18% -34% auto;
          width: 220px;
          height: 220px;
          background: radial-gradient(
            circle,
            rgba(56, 189, 248, 0.18) 0%,
            rgba(56, 189, 248, 0) 72%
          );
          pointer-events: none;
        }
        .score-ring-card__body {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          min-height: 0;
        }
        .score-ring {
          --score-progress: 0%;
          --score-ring-color: var(--accent);
          position: relative;
          width: 154px;
          height: 154px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background:
            radial-gradient(
              circle at 50% 50%,
              color-mix(in srgb, var(--panel) 92%, transparent) 58%,
              transparent 59%
            ),
            conic-gradient(
              var(--score-ring-color) 0 var(--score-progress),
              color-mix(in srgb, var(--border) 86%, transparent)
                var(--score-progress)
                100%
            );
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--score-ring-color) 16%, var(--border)),
            0 18px 34px color-mix(in srgb, var(--score-ring-color) 18%, transparent);
        }
        .score-ring::before {
          content: "";
          position: absolute;
          inset: 12px;
          border-radius: 50%;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(255, 255, 255, 0.03)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
        }
        .score-ring__inner {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 6px;
          justify-items: center;
          text-align: center;
          padding: 12px;
        }
        .score-ring__value {
          font-size: clamp(34px, 4vw, 46px);
          line-height: 1;
          font-weight: 700;
          font-family: var(--font-display);
          color: var(--text);
        }
        .score-ring__caption {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .score-ring-card__content {
          display: grid;
          gap: 8px;
          min-width: 0;
          position: relative;
          z-index: 1;
        }
        .score-ring-card__status {
          font-size: clamp(18px, 2vw, 24px);
          line-height: 1.3;
          font-weight: 700;
          font-family: var(--font-display);
          color: var(--text);
        }
        .score-ring-card__helper {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          min-height: 32px;
          padding: 7px 11px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border));
          background: color-mix(
            in srgb,
            var(--panel-elev) 78%,
            rgba(56, 189, 248, 0.06)
          );
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
        }
        .score-ring-card__stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 2px;
        }
        .score-ring-card__stat {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel-elev) 78%,
            rgba(255, 255, 255, 0.025)
          );
        }
        .score-ring-card__stat span {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .score-ring-card__stat strong {
          font-size: 18px;
          line-height: 1.1;
          font-family: var(--font-display);
          color: var(--text);
        }
        .site-header-card {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 20px;
          padding: 20px;
          border: 1px solid var(--border);
          border-radius: 24px;
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--panel) 92%, rgba(56, 189, 248, 0.08)) 0%,
            color-mix(
                in srgb,
                var(--panel-elev) 86%,
                rgba(139, 92, 246, 0.06)
              )
              100%
          );
          box-shadow: var(--shadow);
          align-items: start;
        }
        .site-header-card__title {
          font-size: clamp(30px, 5vw, 40px);
          font-weight: 700;
          font-family: var(--font-display);
          line-height: 1.1;
          overflow-wrap: anywhere;
        }
        .site-header-card__subtitle {
          margin-top: 6px;
          font-size: 14px;
          color: var(--text-muted);
          overflow-wrap: anywhere;
        }
        .dashboard-health-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(260px, 0.9fr);
          gap: 16px;
          align-items: stretch;
        }
        .dashboard-hero-panel {
          padding: 22px;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--panel) 78%, rgba(56, 189, 248, 0.09)) 0%,
            color-mix(
                in srgb,
                var(--panel) 90%,
                rgba(139, 92, 246, 0.06)
              )
              52%,
            color-mix(in srgb, var(--panel-elev) 92%, transparent) 100%
          );
          box-shadow: var(--shadow);
          display: grid;
          gap: 16px;
        }
        .dashboard-hero-panel__header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .dashboard-hero-panel__eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent);
          font-weight: 700;
        }
        .dashboard-hero-panel__headline {
          margin-top: 6px;
          font-size: clamp(28px, 4vw, 38px);
          font-family: var(--font-display);
          font-weight: 700;
          line-height: 1.15;
        }
        .dashboard-hero-panel__copy {
          margin-top: 8px;
          font-size: 14px;
          color: var(--text-muted);
          line-height: 1.6;
          max-width: 60ch;
        }
        .dashboard-hero-panel__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: flex-start;
        }
        .dashboard-hero-panel__status-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dashboard-hero-panel__meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .dashboard-hero-meta-card {
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel-elev) 76%,
            rgba(255, 255, 255, 0.035)
          );
          display: grid;
          gap: 8px;
        }
        .dashboard-hero-meta-card span:first-child {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          font-weight: 700;
        }
        .dashboard-hero-meta-card span:last-child {
          font-size: 14px;
          color: var(--text);
          font-weight: 600;
        }
        .dashboard-hero-panel__footer-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .dashboard-score-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        .dashboard-category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
          gap: 14px;
        }
        .report-category-score-grid {
          margin-top: 14px;
        }
        .dashboard-history-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
          gap: 18px;
        }
        .dashboard-history-card__header,
        .dashboard-summary-card__header {
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--border);
          display: grid;
          gap: 4px;
        }
        .dashboard-history-card__title,
        .dashboard-summary-card__title {
          font-size: 16px;
          font-weight: 700;
        }
        .dashboard-history-card__meta,
        .dashboard-summary-card__meta {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .dashboard-history-row {
          padding: 18px 20px;
          border-top: 1px solid var(--border);
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.2fr) auto;
          gap: 16px;
          align-items: center;
        }
        .dashboard-history-row:first-of-type {
          border-top: none;
        }
        .dashboard-history-row__title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }
        .dashboard-history-row__meta {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .dashboard-history-row__meta-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .dashboard-history-row__stats {
          display: grid;
          gap: 4px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .dashboard-history-row__stats strong {
          font-size: 13px;
          color: var(--text);
          font-weight: 600;
        }
        .dashboard-summary-list {
          display: grid;
          gap: 14px;
          padding: 18px 20px 20px;
        }
        .dashboard-summary-item {
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel-elev) 76%,
            rgba(255, 255, 255, 0.03)
          );
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .dashboard-summary-item span:first-child {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .dashboard-summary-item strong {
          font-family: var(--font-display);
          font-size: 24px;
          line-height: 1;
        }
        .category-status-card__header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .category-status-card__title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
        }
        .category-status-card__description {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .category-status-card__score {
          color: var(--text);
          font-size: 28px;
          font-weight: 800;
          line-height: 1;
        }
        .category-status-card__summary {
          font-size: 13px;
          color: var(--text);
          line-height: 1.6;
          font-weight: 600;
        }
        .category-status-card__stats {
          color: var(--text-muted);
          font-size: 12px;
          font-weight: 700;
        }
        .scan-hero-card {
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 22px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel-elev) 82%, rgba(56, 189, 248, 0.08)) 0%,
            color-mix(in srgb, var(--panel) 96%, transparent) 100%
          );
          box-shadow: var(--shadow);
          display: grid;
          grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.15fr);
          gap: 22px;
          align-items: center;
        }
        .scan-hero-card[data-tone="success"] {
          border-color: color-mix(in srgb, var(--success) 20%, var(--border));
        }
        .scan-hero-card[data-tone="warning"] {
          border-color: color-mix(in srgb, var(--warning) 24%, var(--border));
        }
        .scan-hero-card[data-tone="danger"] {
          border-color: color-mix(in srgb, var(--danger) 22%, var(--border));
        }
        .scan-hero-card__ring {
          display: grid;
          place-items: center;
          gap: 10px;
        }
        .scan-hero-card__ring-outer {
          --scan-progress: 0%;
          --scan-ring-color: var(--accent);
          width: 196px;
          height: 196px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          position: relative;
          background: conic-gradient(
            var(--scan-ring-color) 0 var(--scan-progress),
            color-mix(in srgb, var(--border) 88%, transparent)
              var(--scan-progress)
              100%
          );
          transition: background 700ms ease;
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent),
            0 18px 40px color-mix(in srgb, var(--accent) 18%, transparent);
          animation: scanRingPulse 3s ease-in-out infinite;
        }
        .scan-hero-card__ring-outer.is-indeterminate {
          background: radial-gradient(
              circle at 50% 50%,
              transparent 62%,
              color-mix(in srgb, var(--scan-ring-color) 22%, transparent) 63%,
              color-mix(in srgb, var(--scan-ring-color) 28%, transparent) 68%,
              transparent 69%
            ),
            conic-gradient(
              from 0deg,
              color-mix(in srgb, var(--scan-ring-color) 82%, transparent) 0deg,
              color-mix(in srgb, var(--scan-ring-color) 14%, transparent) 72deg,
              transparent 160deg,
              color-mix(in srgb, var(--scan-ring-color) 10%, transparent) 360deg
            );
          transition: none;
        }
        .scan-hero-card__ring-orbit {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: color-mix(
            in srgb,
            var(--scan-ring-color) 72%,
            transparent
          );
          border-right-color: color-mix(
            in srgb,
            var(--scan-ring-color) 20%,
            transparent
          );
          opacity: 0.95;
          animation: scanRingOrbit 3.2s linear infinite;
        }
        .scan-hero-card__ring-outer:not(.is-indeterminate)
          .scan-hero-card__ring-orbit {
          inset: 10px;
          border-top-color: color-mix(
            in srgb,
            var(--scan-ring-color) 44%,
            transparent
          );
          border-right-color: transparent;
          opacity: 0.5;
        }
        .scan-hero-card__ring-inner {
          width: 142px;
          height: 142px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(255, 255, 255, 0.02)) 0%,
            color-mix(in srgb, var(--panel-elev) 86%, transparent) 100%
          );
          border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
          text-align: center;
          padding: 14px;
        }
        .scan-hero-card__ring-inner strong {
          font-size: 36px;
          line-height: 1;
          font-family: var(--font-display);
        }
        .scan-hero-card__ring-inner span {
          font-size: 11px;
          color: var(--text-muted);
        }
        .scan-hero-card__ring-fallback {
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
        }
        .scan-hero-card__title {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-display);
        }
        .scan-hero-card__summary,
        .scan-hero-card__note {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .scan-hero-card__counter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
          gap: 10px;
        }
        .scan-hero-card__counter {
          padding: 13px 14px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel) 90%,
            rgba(255, 255, 255, 0.025)
          );
          display: grid;
          gap: 6px;
        }
        .scan-hero-card__counter strong {
          font-size: 20px;
          font-family: var(--font-display);
        }
        .scan-hero-card__counter span {
          font-size: 12px;
          color: var(--text-muted);
        }
        .scan-hero-card__preview {
          display: grid;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 18px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel-elev) 78%,
            rgba(255, 255, 255, 0.025)
          );
        }
        .scan-hero-card__preview-title {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .scan-hero-card__preview-list {
          display: grid;
          gap: 10px;
        }
        .scan-hero-card__preview-item {
          display: grid;
          gap: 4px;
        }
        .scan-hero-card__preview-item strong {
          font-size: 13px;
          line-height: 1.4;
          color: var(--text);
        }
        .scan-hero-card__preview-item span {
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-muted);
        }
        .scan-hero-card__summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 10px;
        }
        .scan-hero-card__summary-item {
          display: grid;
          gap: 6px;
          padding: 12px 14px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel) 90%,
            rgba(255, 255, 255, 0.025)
          );
        }
        .scan-hero-card__summary-item span {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .scan-hero-card__summary-item strong {
          font-size: 20px;
          line-height: 1.1;
          color: var(--text);
          font-family: var(--font-display);
        }
        .scan-hero-card__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        @keyframes scanRingPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent),
              0 18px 40px color-mix(in srgb, var(--accent) 18%, transparent);
          }
          50% {
            transform: scale(1.012);
            box-shadow:
              inset 0 0 0 1px color-mix(in srgb, var(--border) 70%, transparent),
              0 22px 48px color-mix(in srgb, var(--accent) 24%, transparent);
          }
        }
        @keyframes scanRingOrbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .learn-page {
          min-height: 100vh;
          background:
            radial-gradient(1200px 560px at 10% -10%, rgba(56, 189, 248, 0.18), transparent 55%),
            radial-gradient(880px 420px at 88% 0%, rgba(139, 92, 246, 0.12), transparent 55%),
            linear-gradient(180deg, color-mix(in srgb, var(--bg) 90%, black 10%) 0%, var(--bg) 100%);
        }
        .learn-page__shell {
          width: min(1240px, 100%);
          margin: 0 auto;
          padding: 24px;
          display: grid;
          gap: 28px;
        }
        .learn-hero,
        .learn-surface {
          border-radius: 20px;
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .learn-hero {
          padding: clamp(28px, 5vw, 48px);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--panel) 92%, rgba(56, 189, 248, 0.06)) 0%, color-mix(in srgb, var(--panel-elev) 90%, rgba(139, 92, 246, 0.06)) 100%);
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: end;
        }
        .learn-hero__copy {
          display: grid;
          gap: 12px;
          max-width: 70ch;
        }
        .learn-hero__copy h1,
        .learn-section__header h2,
        .learn-state h2,
        .learn-empty-state h3,
        .learn-detail__section h2 {
          margin: 0;
          font-family: var(--font-display);
        }
        .learn-hero__copy h1 {
          font-size: clamp(34px, 4vw, 58px);
          line-height: 1.02;
          max-width: 14ch;
        }
        .learn-hero__copy p,
        .learn-state p,
        .learn-empty-state p,
        .learn-detail__section p,
        .learn-detail__technical p,
        .learn-related-card span,
        .learn-empty-note,
        .learn-feature-card p,
        .learn-article-card p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.7;
        }
        .learn-hero__actions,
        .learn-state__actions,
        .learn-filter-row,
        .learn-detail__meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .learn-surface {
          background: color-mix(in srgb, var(--panel) 94%, rgba(15, 23, 42, 0.06));
          padding: 20px;
        }
        .learn-controls {
          display: grid;
          gap: 18px;
        }
        .learn-filter-chip {
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 86%, transparent);
          color: var(--text);
          font: inherit;
          cursor: pointer;
        }
        .learn-filter-chip.active {
          background: color-mix(in srgb, var(--accent) 18%, var(--panel));
          border-color: color-mix(in srgb, var(--accent) 44%, var(--border));
        }
        .learn-section {
          display: grid;
          gap: 16px;
        }
        .learn-section__header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: end;
          flex-wrap: wrap;
        }
        .learn-feature-grid,
        .learn-article-grid {
          display: grid;
          gap: 14px;
        }
        .learn-feature-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .learn-article-grid {
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }
        .learn-feature-card,
        .learn-article-card,
        .learn-related-card {
          width: 100%;
          text-align: left;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 92%, rgba(255, 255, 255, 0.02));
          color: inherit;
          padding: 16px;
          display: grid;
          gap: 10px;
          cursor: pointer;
          font: inherit;
          transition:
            transform 150ms ease,
            border-color 150ms ease,
            background 150ms ease;
        }
        .learn-feature-card:hover,
        .learn-article-card:hover,
        .learn-related-card:hover {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--accent) 36%, var(--border));
          background: color-mix(in srgb, var(--panel-elev) 88%, rgba(56, 189, 248, 0.04));
        }
        .learn-feature-card strong,
        .learn-article-card strong,
        .learn-related-card strong {
          font-size: 17px;
          line-height: 1.35;
        }
        .learn-feature-card__category,
        .learn-article-card__category,
        .learn-detail__eyebrow {
          font-size: 12px;
          font-weight: 700;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .learn-article-card__top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        .learn-article-card__audience {
          font-size: 12px;
          color: var(--text-muted);
        }
        .learn-empty-state,
        .learn-state {
          display: grid;
          gap: 12px;
        }
        .learn-detail {
          display: grid;
          gap: 16px;
        }
        .learn-detail__grid {
          display: grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
          gap: 16px;
          align-items: start;
        }
        .learn-detail__main,
        .learn-detail__side {
          display: grid;
          gap: 18px;
        }
        .learn-detail__section {
          display: grid;
          gap: 8px;
        }
        .learn-detail__technical {
          border-top: 1px solid var(--border);
          padding-top: 16px;
        }
        .learn-detail__technical summary {
          cursor: pointer;
          font-weight: 700;
        }
        .learn-detail__side-block {
          display: grid;
          gap: 12px;
        }
        .learn-related-list,
        .learn-keyword-list {
          display: grid;
          gap: 10px;
        }
        .learn-keyword-list {
          grid-template-columns: repeat(auto-fit, minmax(120px, max-content));
        }
        .learn-keyword {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel-elev);
          font-size: 12px;
          color: var(--text-muted);
        }
        .learn-empty-note {
          font-size: 13px;
        }
        @media (max-width: 960px) {
          .learn-hero,
          .learn-detail__grid {
            grid-template-columns: 1fr;
          }
          .learn-hero__copy h1 {
            max-width: 16ch;
          }
        }
        @media (max-width: 640px) {
          .learn-page__shell {
            padding: 16px;
          }
          .learn-surface,
          .learn-hero {
            padding: 16px;
            border-radius: 16px;
          }
          .learn-article-grid,
          .learn-feature-grid {
            grid-template-columns: 1fr;
          }
        }
        .shell {
          display: block;
          min-height: 0;
          flex: 1;
        }
        .top-nav {
          position: sticky;
          top: 0;
          z-index: 20;
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(320px, 1.1fr) auto;
          align-items: center;
          gap: 18px;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: 16px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(56, 189, 248, 0.03)) 0%,
            color-mix(in srgb, var(--panel) 96%, transparent) 100%
          );
          box-shadow: var(--shadow);
        }
        .app-brand-block {
          display: flex;
          align-items: center;
          gap: 18px;
          min-width: 0;
        }
        .app-nav-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 4px;
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--panel-elev) 82%,
            rgba(255, 255, 255, 0.02)
          );
          border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
        }
        .app-nav-tab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .app-nav-tab.active {
          background: color-mix(
            in srgb,
            var(--panel) 86%,
            rgba(56, 189, 248, 0.08)
          );
          color: var(--text);
          border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
          box-shadow: var(--soft-shadow);
        }
        .app-site-switcher {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .app-site-switcher__label {
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .app-toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }
        .hamburger {
          display: none;
        }
        .drawer-close {
          display: none;
        }
        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          z-index: 30;
        }
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .modal {
          width: min(560px, 100%);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: var(--shadow);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sidebar.drawer {
          transition: transform 180ms ease;
        }
        .sidebar.drawer.open {
          transform: translateX(0);
        }
        .sidebar {
          display: none !important;
        }
        .sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 4px;
        }
        .main {
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 0;
          height: 100%;
        }
        .resizer {
          display: none !important;
        }
        .app-section-shell {
          display: grid;
          gap: 18px;
        }
        .app-section-heading {
          display: grid;
          gap: 8px;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, rgba(56, 189, 248, 0.04)) 0%, var(--panel) 100%);
          box-shadow: var(--soft-shadow);
        }
        .app-section-heading__title {
          font-family: var(--font-display);
          font-size: 28px;
          line-height: 1.1;
          font-weight: 700;
        }
        .app-section-heading__meta {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
        }
        .app-section-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 16px;
        }
        .app-settings-card {
          padding: 18px;
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--panel);
          box-shadow: var(--soft-shadow);
          display: grid;
          gap: 14px;
        }
        .app-settings-card__title {
          font-family: var(--font-display);
          font-size: 22px;
          font-weight: 700;
        }
        .app-settings-card__subtitle {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
        }
        .app-form-grid {
          display: grid;
          gap: 12px;
        }
        .app-form-grid--two {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        .app-site-list {
          display: grid;
          gap: 12px;
        }
        .app-site-row {
          padding: 14px;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 94%, rgba(255, 255, 255, 0.02));
          display: grid;
          gap: 10px;
        }
        .results-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
          min-width: 0;
        }
        .results-layout > * {
          min-width: 0;
        }
        .results-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 4px;
          color: var(--text);
        }
        .results-title__label {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .results-title__meta {
          margin-top: 4px;
          font-size: 11px;
          color: var(--muted);
        }
        .results-table {
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--panel);
          overflow: hidden;
          box-shadow: var(--soft-shadow);
          min-width: 0;
        }
        .results-footer-space {
          height: 16px;
        }
        .results-summary {
          position: sticky;
          top: 70px;
          z-index: 10;
          background: var(--panel);
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .results-summary__top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .results-summary__stats {
          font-size: 12px;
          color: var(--muted);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .results-summary__chip {
          font-size: 11px;
          color: var(--accent);
          background: var(--surface-accent);
          border: 1px solid var(--border);
          padding: 4px 10px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .results-summary__controls {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
        }
        .results-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .results-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        .results-controls input,
        .results-controls select {
          padding: 6px 10px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          font-size: 12px;
        }
        .results-controls select {
          appearance: none;
          background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
            linear-gradient(135deg, var(--muted) 50%, transparent 50%);
          background-position: calc(100% - 14px) calc(50% - 3px),
            calc(100% - 9px) calc(50% - 3px);
          background-size: 5px 5px, 5px 5px;
          background-repeat: no-repeat;
          padding-right: 24px;
        }
        .results-header {
          position: sticky;
          top: 0;
          z-index: 5;
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(160px, 0.6fr) 100px 140px;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(90deg, var(--surface), var(--surface-2));
          border-bottom: 1px solid var(--border);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          white-space: nowrap;
        }
        .results-header div:nth-child(3) {
          text-align: center;
        }
        .results-header div:last-child {
          text-align: right;
        }
        .results-header.single {
          grid-template-columns: minmax(0, 1fr);
        }
        .changes-header {
          grid-template-columns:
            minmax(0, 1.8fr)
            minmax(110px, 0.5fr)
            minmax(0, 1.2fr)
            minmax(0, 1fr);
        }
        .change-row {
          display: grid;
          grid-template-columns:
            minmax(0, 1.8fr)
            minmax(110px, 0.5fr)
            minmax(0, 1.2fr)
            minmax(0, 1fr);
          gap: 12px;
          align-items: start;
        }
        .summary-chip {
          font-size: 11px;
          color: var(--text);
          background: var(--panel-elev);
          border: 1px solid var(--border);
          padding: 4px 10px;
          border-radius: 999px;
          font-weight: 600;
        }
        .results-scroll {
          max-height: 560px;
          display: flex;
          flex-direction: column;
          gap: 0;
          overflow-y: auto;
          overflow-x: hidden;
          background: var(--panel);
          min-width: 0;
        }
        .result-row {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(160px, 0.6fr) 100px 140px;
          gap: 12px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          transition: box-shadow 140ms ease, background 140ms ease;
          position: relative;
          overflow: visible;
          cursor: pointer;
          align-items: center;
          min-width: 0;
        }
        .result-row::after {
          content: "";
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms ease;
        }
        .result-row.severity-broken::after {
          background: linear-gradient(90deg, rgba(248, 113, 113, 0.12), transparent 50%);
        }
        .result-row.severity-blocked::after {
          background: linear-gradient(90deg, rgba(251, 191, 36, 0.12), transparent 50%);
        }
        .result-row.severity-no_response::after {
          background: linear-gradient(90deg, rgba(148, 163, 184, 0.16), transparent 50%);
        }
        .result-row:hover {
          background: var(--surface-accent);
        }
        .result-row:hover::after,
        .result-row:focus-within::after {
          opacity: 1;
        }
        .result-row:last-child {
          border-bottom: none;
        }
        .ignored-row {
          display: flex;
          border-bottom: none;
        }
        .result-cell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .result-link {
          align-items: flex-start;
        }
        .result-actions {
          align-items: center;
          justify-content: flex-end;
          width: 100%;
        }
        .result-host {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .result-url {
          font-size: 12px;
          color: var(--accent);
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .result-meta {
          font-size: 11px;
          color: var(--muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .result-status {
          align-items: flex-start;
        }
        .status-chip {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          font-weight: 600;
          color: white;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1px solid transparent;
        }
        .status-chip.subtle {
          background: var(--chip-bg);
          color: var(--chip-text);
          border-color: var(--border);
          font-weight: 500;
        }
        .status-chip.run-status {
          background: rgba(148, 163, 184, 0.2);
          color: var(--text);
          border-color: rgba(148, 163, 184, 0.35);
          font-weight: 600;
          text-transform: capitalize;
        }
        .status-chip.run-status.success {
          background: rgba(34, 197, 94, 0.18);
          color: var(--success);
          border-color: rgba(34, 197, 94, 0.45);
        }
        .status-chip.run-status.warning {
          background: rgba(245, 158, 11, 0.2);
          color: var(--warning);
          border-color: rgba(245, 158, 11, 0.45);
        }
        .status-chip.run-status.danger {
          background: rgba(239, 68, 68, 0.18);
          color: var(--danger);
          border-color: rgba(239, 68, 68, 0.45);
        }
        .result-occ {
          align-items: center;
          text-align: center;
        }
        .occ-count {
          font-size: 20px;
          font-weight: 600;
          color: var(--text);
          font-family: var(--font-display);
        }
        .occ-label {
          font-size: 10px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .row-actions {
          display: inline-flex;
          gap: 6px;
          justify-content: flex-end;
          flex-wrap: wrap;
          align-items: center;
          opacity: 0.7;
          transition: opacity 140ms ease, transform 140ms ease;
          width: 100%;
        }
        .row-actions .icon-button {
          background: var(--surface-2);
          border-color: rgba(148, 163, 184, 0.35);
        }
        .result-row:hover .row-actions {
          opacity: 1;
        }
        .icon-button {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .icon-button:hover {
          background: var(--surface-2);
        }
        .icon-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .expand-panel {
          animation: expandFade 160ms ease;
          overflow: hidden;
          max-height: 640px;
          opacity: 1;
          transition: max-height 200ms ease, opacity 200ms ease;
        }
        @keyframes expandFade {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 980px) {
          .row-actions {
            opacity: 1;
          }
          .results-header {
            grid-template-columns: minmax(0, 1fr);
            gap: 6px;
          }
          .result-row {
            grid-template-columns: minmax(0, 1fr);
          }
          .changes-header {
            display: none;
          }
          .change-row {
            grid-template-columns: minmax(0, 1fr);
            gap: 8px;
          }
          .result-occ {
            align-items: flex-start;
            text-align: left;
          }
        }
        .results-layout.drawer-open {
          grid-template-columns: minmax(0, 1fr) minmax(320px, 420px);
        }
        .drawer {
          position: sticky;
          top: 16px;
          align-self: start;
          max-height: calc(100vh - 120px);
          overflow: hidden;
        }
        .details-overlay {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.55);
          z-index: 45;
        }
        .details-drawer {
          position: sticky;
          top: 16px;
          align-self: start;
          height: calc(100vh - 120px);
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--panel);
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: drawerSlide 200ms ease;
        }
        .details-drawer.overlay {
          position: fixed;
          right: 16px;
          left: 16px;
          top: 80px;
          bottom: 16px;
          height: auto;
          z-index: 50;
        }
        .drawer-header {
          padding: 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface-2);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .drawer-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          color: var(--text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .drawer-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .drawer-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow: auto;
        }
        .drawer-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .drawer-section h4 {
          margin: 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
        }
        .drawer-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .drawer-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 260px;
          overflow: auto;
        }
        .drawer-row {
          padding: 8px 10px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel-elev);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .drawer-row a {
          flex: 1;
          min-width: 0;
          color: var(--text);
          text-decoration: none;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
        }
        .drawer-row button {
          font-size: 11px;
        }
        @keyframes drawerSlide {
          from {
            transform: translateX(12px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .toast-stack {
          position: fixed;
          right: 24px;
          bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 50;
        }
        .toast {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--text);
          box-shadow: var(--shadow);
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .toast-action {
          margin-left: auto;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel-elev);
          color: var(--text);
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
        }
        .toast.success {
          border-color: rgba(52, 211, 153, 0.6);
        }
        .toast.warning {
          border-color: rgba(251, 191, 36, 0.7);
        }
        .toast.info {
          border-color: rgba(56, 189, 248, 0.6);
        }
        .skeleton {
          height: 44px;
          border-radius: 10px;
          background: linear-gradient(90deg, var(--panel-elev), var(--panel), var(--panel-elev));
          background-size: 200% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
        }
        .skeleton--site {
          height: 58px;
        }
        .skeleton--occ {
          height: 32px;
          border-radius: 12px;
        }
        .scan-progress {
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--panel-elev);
          display: flex;
          flex-direction: column;
          gap: 10px;
          box-shadow: var(--shadow);
        }
        .scan-progress.completed {
          border-color: rgba(34, 197, 94, 0.6);
        }
        .scan-progress.stopped {
          border-color: rgba(239, 68, 68, 0.6);
        }
        .scan-progress__header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .scan-progress__title {
          font-weight: 600;
          color: var(--text);
          font-size: 14px;
        }
        .scan-progress__subtitle {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          font-size: 12px;
          color: var(--muted);
        }
        .scan-progress__percent {
          font-weight: 600;
          color: var(--text);
          font-size: 14px;
        }
        .scan-progress__state {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
        }
        .scan-progress__state--complete {
          color: var(--success);
        }
        .scan-progress__state--stopped {
          color: var(--danger);
        }
        .scan-progress__check {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: var(--success);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          line-height: 1;
        }
        .scan-progress__track {
          position: relative;
          height: 8px;
          background: var(--border);
          border-radius: 999px;
          overflow: hidden;
        }
        .scan-progress__fill {
          height: 100%;
          background: linear-gradient(90deg, rgba(59, 130, 246, 0.2), var(--accent), rgba(59, 130, 246, 0.2));
          border-radius: inherit;
          transition: width 420ms ease;
        }
        .scan-progress.running .scan-progress__fill {
          background-size: 200% 100%;
          animation: scanProgressGlow 1.8s linear infinite;
        }
        .scan-progress.completed .scan-progress__fill {
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.2), var(--success), rgba(34, 197, 94, 0.2));
        }
        .scan-progress.stopped .scan-progress__fill {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.2), var(--danger), rgba(239, 68, 68, 0.2));
        }
        .scan-progress__track.indeterminate .scan-progress__fill {
          position: absolute;
          width: 40%;
          animation: progressSlide 1.2s ease-in-out infinite, scanProgressGlow 1.8s linear infinite;
        }
        .scan-progress__hint {
          font-size: 12px;
          color: var(--muted);
        }
        .filter-dropdown {
          position: relative;
        }
        .theme-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .theme-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: var(--shadow);
          padding: 6px;
          min-width: 160px;
          z-index: 30;
        }
        .theme-menu button {
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
        }
        .theme-menu button.active {
          background: var(--surface-2);
          border-color: var(--border);
        }
        .action-menu button {
          width: 100%;
          text-align: left;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
        }
        .action-menu button:hover {
          background: var(--surface-2);
        }
        .action-menu button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .filter-dropdown__panel {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 260px;
          max-width: 360px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel);
          box-shadow: var(--shadow);
          z-index: 20;
          animation: dropdownIn 160ms ease;
        }
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        .filter-row:last-child {
          margin-bottom: 0;
        }
        @media (max-width: 720px) {
          .filter-dropdown__panel {
            right: 0;
            left: auto;
            max-width: 90vw;
          }
        }
        @keyframes scanProgressGlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes progressSlide {
          0% { transform: translateX(-60%); }
          50% { transform: translateX(40%); }
          100% { transform: translateX(160%); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tab-pill {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel);
          color: var(--muted);
          cursor: pointer;
          font-size: 12px;
          transition: background 150ms ease, color 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
        }
        .tab-pill.active {
          background: linear-gradient(135deg, var(--accent), var(--accent-2));
          color: white;
          border-color: transparent;
          box-shadow: 0 8px 18px rgba(37, 99, 235, 0.25);
        }
        .tab-pill:hover {
          transform: translateY(-1px);
          border-color: rgba(148, 163, 184, 0.6);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
        }
        @media (max-width: 1100px) {
          .top-nav {
            grid-template-columns: 1fr;
            align-items: stretch;
          }
          .app-brand-block,
          .app-site-switcher,
          .app-toolbar {
            justify-content: flex-start;
          }
          .app-site-switcher {
            grid-template-columns: 1fr;
          }
          .shell {
            flex-direction: column;
          }
          .dashboard-health-layout,
          .dashboard-history-grid,
          .site-header-card {
            grid-template-columns: 1fr;
          }
          .dashboard-score-grid {
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
          .dashboard-history-row {
            grid-template-columns: 1fr;
            align-items: start;
          }
          .dashboard-hero-panel__actions {
            justify-content: flex-start;
          }
          .scan-hero-card {
            grid-template-columns: 1fr;
          }
          .score-ring-card__body {
            grid-template-columns: 1fr;
            justify-items: start;
          }
          .score-ring-card__stats {
            width: 100%;
          }
          .sidebar {
            width: 100%;
            max-width: 100%;
          }
          .resizer {
            display: none;
          }
          .results-layout.drawer-open {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 1200px) {
          .shell {
            flex-direction: column;
          }
          .sidebar {
            display: none;
          }
          .sidebar.drawer {
            display: flex;
            position: fixed;
            left: 0;
            top: 0;
            height: 100%;
            z-index: 40;
            transform: translateX(-100%);
          }
          .sidebar.drawer.open {
            transform: translateX(0);
          }
          .hamburger {
            display: inline-flex;
          }
          .drawer-close {
            display: inline-flex;
          }
        }
        @media (max-width: 860px) {
          .results-layout.drawer-open {
            grid-template-columns: 1fr;
          }
        }
        .top-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.1fr) minmax(280px, 1.6fr) minmax(280px, 1.3fr);
          gap: 16px;
        }
        .bottom-grid {
          display: grid;
          grid-template-columns: minmax(320px, 1.5fr) minmax(320px, 1fr) minmax(320px, 1fr);
          gap: 16px;
        }
        .card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          box-shadow: var(--shadow);
        }
        .focus-ring:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        button:focus-visible,
        input:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .scroll-y {
          overflow-y: auto;
          overflow-x: hidden;
        }
        .report-page {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .report-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 16px;
          align-items: start;
          padding: 22px 24px;
          border-radius: 22px;
          border: 1px solid var(--border);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--panel) 82%, rgba(56, 189, 248, 0.08)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, rgba(139, 92, 246, 0.05))
              100%
          );
          box-shadow: var(--shadow);
        }
        .report-title {
          font-size: clamp(28px, 4vw, 38px);
          font-weight: 700;
          font-family: var(--font-display);
          line-height: 1.1;
        }
        .report-subtitle {
          margin-top: 6px;
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .report-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .report-button {
          min-height: 36px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: var(--surface-2);
          color: var(--text);
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
        }
        .report-button:hover {
          transform: translateY(-1px);
          border-color: var(--accent);
        }
        .report-card {
          background: var(--panel);
          border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
          border-radius: 18px;
          padding: 16px;
          box-shadow: var(--soft-shadow);
        }
        .report-card__header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .report-meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 14px;
          padding-top: 14px;
        }
        .report-meta-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .report-label {
          font-size: 11px;
          color: var(--text-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .report-value {
          font-size: 13px;
          color: var(--text);
          overflow-wrap: anywhere;
          line-height: 1.5;
        }
        .report-overview-grid {
          display: grid;
          grid-template-columns: minmax(320px, 1.2fr) minmax(320px, 0.95fr);
          gap: 16px;
          align-items: stretch;
        }
        .report-overview-stack {
          display: grid;
          gap: 16px;
          min-width: 0;
        }
        .report-overview-score.surface-card--metric.prominent {
          min-height: 0;
          padding: 18px;
          box-shadow: var(--soft-shadow);
        }
        .report-overview-score .score-ring-card__body {
          gap: 14px;
          align-items: start;
        }
        .report-overview-score .score-ring {
          width: 124px;
          height: 124px;
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--score-ring-color) 16%, var(--border)),
            0 12px 28px color-mix(in srgb, var(--score-ring-color) 16%, transparent);
        }
        .report-overview-score .score-ring::before {
          inset: 10px;
        }
        .report-overview-score .score-ring__value {
          font-size: clamp(28px, 4vw, 38px);
        }
        .report-overview-score .score-ring__caption {
          font-size: 10px;
        }
        .report-overview-score .score-ring-card__content {
          gap: 6px;
        }
        .report-overview-score .score-ring-card__status {
          font-size: clamp(16px, 2vw, 22px);
        }
        .report-overview-score .score-ring-card__helper {
          min-height: 28px;
          padding: 6px 10px;
          font-size: 11px;
        }
        .report-overview-score .score-ring-card__stats {
          gap: 8px;
        }
        .report-overview-score .score-ring-card__stat {
          padding: 8px 10px;
        }
        .report-overview-score .score-ring-card__stat strong {
          font-size: 16px;
        }
        .report-summary-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 112px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 92%, rgba(255, 255, 255, 0.02)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .report-score-card {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 122px;
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 88%, rgba(56, 189, 248, 0.05)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .report-metric {
          font-size: clamp(26px, 3vw, 34px);
          font-weight: 700;
          color: var(--text);
          line-height: 1.1;
          font-family: var(--font-display);
        }
        .report-score-subtitle {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .report-score-band {
          font-size: 12px;
          font-weight: 600;
        }
        .report-status-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .report-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }
        .report-kpi-grid--expanded {
          grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
        }
        .report-mini-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }
        .report-mini-stat {
          display: grid;
          gap: 4px;
          min-height: 68px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(
            in srgb,
            var(--panel-elev) 78%,
            rgba(255, 255, 255, 0.025)
          );
        }
        .report-mini-stat span {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }
        .report-mini-stat strong {
          font-size: 20px;
          line-height: 1.1;
          font-family: var(--font-display);
          color: var(--text);
        }
        .report-kpi-card {
          min-height: 110px;
        }
        .report-change-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px;
        }
        .report-change-grid--dense {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .report-meta-details {
          padding: 14px 16px;
        }
        .report-meta-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          cursor: pointer;
          list-style: none;
        }
        .report-meta-summary::-webkit-details-marker {
          display: none;
        }
        .report-meta-summary__chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .report-meta-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(in srgb, var(--panel-elev) 84%, transparent);
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .report-table-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 16px;
        }
        .report-table-title {
          font-size: 16px;
          font-weight: 700;
          font-family: var(--font-display);
        }
        .report-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }
        .report-filter-chip {
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 92%, transparent);
          color: var(--text-muted);
          border-radius: 999px;
          padding: 6px 11px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .report-filter-chip.active {
          background: color-mix(
            in srgb,
            var(--panel-elev) 84%,
            rgba(56, 189, 248, 0.06)
          );
          color: var(--text);
          border-color: var(--accent);
        }
        .report-table-wrap {
          overflow-x: auto;
          min-width: 0;
          border-radius: 14px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          table-layout: fixed;
          background: color-mix(in srgb, var(--panel) 94%, transparent);
        }
        .report-table th,
        .report-table td {
          padding: 12px 12px;
          border-bottom: 1px solid var(--border);
          text-align: left;
          vertical-align: top;
        }
        .report-table th {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          background: color-mix(in srgb, var(--panel-elev) 82%, transparent);
        }
        .report-table td {
          overflow-wrap: normal;
          word-break: normal;
        }
        .report-links-table th:nth-child(1),
        .report-links-table td:nth-child(1) {
          width: 48%;
        }
        .report-links-table th:nth-child(2),
        .report-links-table td:nth-child(2) {
          width: 10%;
        }
        .report-links-table th:nth-child(4),
        .report-links-table td:nth-child(4) {
          width: 12%;
        }
        .report-links-table th:nth-child(5),
        .report-links-table td:nth-child(5) {
          width: 18%;
        }
        .report-issues-table th:nth-child(1),
        .report-issues-table td:nth-child(1) {
          width: 9%;
        }
        .report-issues-table th:nth-child(2),
        .report-issues-table td:nth-child(2) {
          width: 20%;
        }
        .report-issues-table th:nth-child(3),
        .report-issues-table td:nth-child(3) {
          width: 27%;
        }
        .report-issues-table th:nth-child(4),
        .report-issues-table td:nth-child(4) {
          width: 22%;
        }
        .report-issues-table th:nth-child(5),
        .report-issues-table td:nth-child(5) {
          width: 8%;
        }
        .report-issues-table th:nth-child(6),
        .report-issues-table td:nth-child(6) {
          width: 14%;
        }
        .report-url-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          max-width: 100%;
        }
        .report-url-text {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow-wrap: normal;
          word-break: normal;
        }
        .report-url-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }
        .report-url-action {
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--panel) 90%, transparent);
          color: var(--text-muted);
          border-radius: 999px;
          padding: 3px 8px;
          font-size: 11px;
          line-height: 1.2;
          cursor: pointer;
          white-space: nowrap;
        }
        .report-url-action:hover {
          border-color: var(--accent);
          color: var(--text);
        }
        .report-table td .report-url-cell,
        .report-table td .report-url-text {
          overflow-wrap: normal;
          word-break: normal;
        }
        .report-issue-support {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .report-issue-guidance {
          margin-top: 10px;
        }
        .report-issue-guidance summary,
        .report-issue-tech summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
        }
        .report-issue-guidance__body {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }
        .report-issue-guidance__section {
          display: grid;
          gap: 6px;
        }
        .report-issue-guidance__section p {
          margin: 0;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .report-issue-tech {
          display: grid;
          gap: 8px;
          padding-top: 2px;
        }
        .report-evidence-list {
          display: grid;
          gap: 8px;
        }
        .report-evidence-item {
          display: grid;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: color-mix(in srgb, var(--panel-elev) 84%, transparent);
        }
        .report-evidence-item strong {
          font-size: 11px;
          color: var(--text);
        }
        .report-evidence-item span {
          font-size: 12px;
          color: var(--text-muted);
          overflow-wrap: anywhere;
        }
        .report-issue-category {
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--panel-elev) 82%, transparent);
          color: var(--text-muted);
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          white-space: nowrap;
        }
        .report-issue-badges {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
        }
        .report-badge {
          display: inline-flex;
          align-items: center;
          min-height: 24px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }
        .report-badge--severity.severity-critical,
        .report-badge--severity.severity-high {
          background: rgba(248, 113, 113, 0.18);
          color: #fecaca;
          border-color: rgba(248, 113, 113, 0.3);
        }
        .report-badge--severity.severity-medium {
          background: rgba(251, 191, 36, 0.18);
          color: #fde68a;
          border-color: rgba(251, 191, 36, 0.32);
        }
        .report-badge--severity.severity-low {
          background: rgba(56, 189, 248, 0.16);
          color: #bae6fd;
          border-color: rgba(56, 189, 248, 0.28);
        }
        .report-badge--severity.severity-info {
          background: color-mix(in srgb, var(--panel-elev) 80%, transparent);
          color: var(--text);
          border-color: color-mix(in srgb, var(--border) 82%, transparent);
        }
        .report-badge--status {
          background: color-mix(in srgb, var(--panel-elev) 84%, transparent);
          color: var(--text);
          border-color: color-mix(in srgb, var(--border) 82%, transparent);
          text-transform: capitalize;
        }
        .report-badge--change.change-new {
          background: rgba(56, 189, 248, 0.16);
          color: #bae6fd;
          border-color: rgba(56, 189, 248, 0.26);
        }
        .report-badge--change.change-existing {
          background: color-mix(in srgb, var(--panel-elev) 84%, transparent);
          color: var(--text);
          border-color: color-mix(in srgb, var(--border) 82%, transparent);
        }
        .report-badge--change.change-resolved {
          background: rgba(52, 211, 153, 0.16);
          color: #bbf7d0;
          border-color: rgba(52, 211, 153, 0.28);
        }
        .report-table-meta {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .report-empty {
          padding: 16px;
          text-align: center;
          color: var(--text-muted);
        }
        .report-priority-list {
          display: grid;
          gap: 12px;
        }
        .report-priority-item {
          display: grid;
          gap: 10px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--panel) 90%, rgba(255, 255, 255, 0.02)) 0%,
            color-mix(in srgb, var(--panel-elev) 88%, transparent) 100%
          );
        }
        .report-priority-item__top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .report-priority-item__title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.5;
        }
        .report-priority-item__meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          font-size: 12px;
          color: var(--text-muted);
        }
        .report-priority-item__desc {
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.6;
        }
        .report-priority-item__next-step {
          display: grid;
          gap: 6px;
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.6;
        }
        .report-priority-item__urls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px 12px;
        }
        .report-footer {
          font-size: 12px;
          color: var(--text-muted);
          text-align: right;
        }
        @media print {
          .report-actions {
            display: none;
          }
          .app-shell {
            padding: 0;
          }
        }
        @media (max-width: 1100px) {
          .report-header {
            grid-template-columns: 1fr;
          }
          .report-actions {
            justify-content: flex-start;
          }
          .report-overview-grid {
            grid-template-columns: 1fr;
          }
          .report-change-grid--dense {
            grid-template-columns: 1fr;
          }
          .report-meta-summary {
            align-items: flex-start;
          }
          .top-grid {
            grid-template-columns: 1fr;
          }
          .bottom-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="app-container">
        {route === "learn" ? (
          <LearnExperience
            isAuthenticated={!!authUser}
            currentArticle={currentLearnArticle}
            articleMissing={learnArticleMissing}
            featuredArticles={featuredLearnArticles}
            filteredArticles={filteredLearnArticles}
            searchQuery={learnSearchQuery}
            selectedCategory={learnCategoryFilter}
            onSearchChange={setLearnSearchQuery}
            onSelectCategory={setLearnCategoryFilter}
            onOpenArticle={openLearnArticle}
            onBackToIndex={() => navigateTo("/learn")}
            onBackToLanding={() => navigateTo("/landing")}
            onOpenApp={() => navigateTo("/app")}
            onOpenLogin={() => navigateTo("/login")}
            onClearFilters={() => {
              setLearnSearchQuery("");
              setLearnCategoryFilter("all");
            }}
          />
        ) : authLoading ? (
          <div
            style={{
              minHeight: "60vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              fontSize: "13px",
            }}
          >
            Loading session...
          </div>
        ) : !authUser ? (
          isPublicLandingRoute ? (
            <MarketingPage
              isAuthenticated={false}
              onOpenApp={() => navigateTo("/login")}
              onOpenLogin={() => navigateTo("/login")}
              onOpenLearn={() => navigateTo("/learn")}
            />
          ) : isLoginRoute || protectedRouteRequiresAuth ? (
            <AuthPage
              authMode={authMode}
              authEmail={authEmail}
              authPassword={authPassword}
              authError={authError}
              authWorking={authWorking}
              title={authPageTitle}
              subtitle={authPageSubtitle}
              onAuthModeChange={setAuthMode}
              onAuthEmailChange={setAuthEmail}
              onAuthPasswordChange={setAuthPassword}
              onBackToLanding={() => navigateTo("/landing")}
              onSubmit={(event) => {
                event.preventDefault();
                void handleAuthSubmit();
              }}
            />
          ) : null
        ) : isPublicLandingRoute ? (
          <MarketingPage
            isAuthenticated
            onOpenApp={() => navigateTo("/app")}
            onOpenLogin={() => navigateTo("/app")}
            onOpenLearn={() => navigateTo("/learn")}
          />
        ) : reportView ? (
          <div className="report-page">
            <div className="report-header">
              <div>
                <div className="report-title">
                  {selectedSiteName ?? reportHost ?? "Scan report"}
                </div>
                <div className="report-subtitle">
                  Detailed scan document with summary, issue analysis, raw
                  evidence, and diagnostics for a single run.
                </div>
                <div className="report-status-row">
                  <StatusBadge
                    label={reportRun?.status.replace("_", " ") ?? "Loading"}
                    tone={
                      reportRun?.status === "completed"
                        ? "success"
                        : reportRun?.status === "failed"
                          ? "danger"
                          : reportRun?.status === "cancelled"
                            ? "warning"
                            : "accent"
                    }
                  />
                  {reportIssueSummaryPending && (
                    <StatusBadge label="Building issue summary" tone="accent" />
                  )}
                  {reportHost && (
                    <StatusBadge label={reportHost} tone="default" />
                  )}
                  {reportDateLabel !== "-" && (
                    <StatusBadge label={reportDateLabel} tone="default" />
                  )}
                </div>
              </div>
              <div className="report-actions">
                <button className="report-button" onClick={backToDashboard}>
                  Back to dashboard
                </button>
                <button
                  className="report-button"
                  onClick={() =>
                    reportScanRunId &&
                    copyToClipboard(
                      buildReportLink(reportScanRunId),
                      undefined,
                      "Copied link",
                    )
                  }
                  disabled={!reportScanRunId}
                >
                  Copy report link
                </button>
              </div>
            </div>

            {reportLoading && !reportRun && (
              <div
                className="report-card"
                style={{ fontSize: "13px", color: "var(--muted)" }}
              >
                Loading report…
              </div>
            )}
            {reportError && (
              <div
                className="report-card"
                style={{ fontSize: "13px", color: "var(--warning)" }}
              >
                {reportError}
              </div>
            )}

            {reportRun?.error_message && (
              <div
                className="report-card"
                style={{ fontSize: "13px", color: "var(--warning)" }}
              >
                Failure reason: {reportRun.error_message}
              </div>
            )}

            {reportRun && (
              <>
                <div className="report-overview-grid">
                  <ScoreRingCard
                    label="Overall health"
                    className="report-overview-score"
                    caption="Health score"
                    emptyValueText={
                      reportIssueSummaryPending ? "Pending" : "N/A"
                    }
                    score={
                      reportIssueSummaryPending
                        ? null
                        : reportScores.overall.score
                    }
                    status={
                      reportIssueSummaryPending
                        ? "Score pending"
                        : reportScores.overall.score == null
                          ? "Score unavailable"
                          : (reportScores.overall.band ??
                            reportScores.overall.detail)
                    }
                    detail={
                      reportIssueSummaryPending
                        ? "The crawl is complete. Final issue scoring appears when the report summary finishes."
                        : reportScores.overall.score == null
                          ? "Score unavailable for this run. Review the detailed findings and diagnostics below."
                          : reportScores.overall.detail
                    }
                    helper={
                      reportIssueSummaryPending
                        ? "Final issue scoring is still being prepared"
                        : `Links checked ${reportRun.checked_links} · Total issues ${
                            reportIssueSummary?.total ?? 0
                          }`
                    }
                    stats={[
                      {
                        label: "High priority",
                        value: reportHighPriorityCount,
                      },
                      {
                        label: "New issues",
                        value: reportIssueSummary?.byChangeStatus.new ?? 0,
                      },
                      {
                        label: "Resolved",
                        value:
                          reportIssueSummary?.byChangeStatus.resolved ??
                          reportIssues.resolvedCount,
                      },
                      {
                        label: "Links checked",
                        value: reportRun.checked_links,
                      },
                    ]}
                    tone={
                      reportScores.overall.score == null
                        ? "default"
                        : reportScores.overall.score >= 90
                          ? "success"
                          : reportScores.overall.score >= 75
                            ? "accent"
                            : reportScores.overall.score >= 60
                              ? "warning"
                              : "danger"
                    }
                  />
                  <div className="report-overview-stack">
                    <div className="report-card report-score-card report-kpi-card">
                      <div className="report-label">Link Integrity Score</div>
                      <div
                        className="report-metric"
                        style={{
                          color: getScoreBandTone(
                            reportScores.linkIntegrity.score,
                          ),
                        }}
                      >
                        {reportScores.linkIntegrity.score == null
                          ? reportScores.linkIntegrity.detail
                          : `${reportScores.linkIntegrity.score}%`}
                      </div>
                      {reportScores.linkIntegrity.band && (
                        <div
                          className="report-score-band"
                          style={{
                            color: getScoreBandTone(
                              reportScores.linkIntegrity.score,
                            ),
                          }}
                        >
                          {reportScores.linkIntegrity.band}
                        </div>
                      )}
                      <div className="report-score-subtitle">
                        {reportScores.linkIntegrity.detail}
                      </div>
                    </div>
                    <div className="report-change-grid report-change-grid--dense">
                      <div className="report-card report-summary-card">
                        <div className="report-label">What changed</div>
                        <div className="report-metric">
                          {reportIssueSummary?.byChangeStatus.new ?? 0}
                        </div>
                        <div className="report-score-subtitle">
                          New issues in this run
                        </div>
                      </div>
                      <div className="report-card report-summary-card">
                        <div className="report-label">Open issues</div>
                        <div className="report-metric">
                          {reportIssueSummary?.total ?? 0}
                        </div>
                        <div className="report-score-subtitle">
                          Existing and newly detected findings
                        </div>
                      </div>
                      <div className="report-card report-summary-card">
                        <div className="report-label">Resolved issues</div>
                        <div className="report-metric">
                          {reportIssueSummary?.byChangeStatus.resolved ??
                            reportIssues.resolvedCount}
                        </div>
                        <div className="report-score-subtitle">
                          Fixed since the previous baseline
                        </div>
                      </div>
                      <div className="report-card report-summary-card">
                        <div className="report-label">Links checked</div>
                        <div className="report-metric">
                          {reportRun.checked_links}
                        </div>
                        <div className="report-score-subtitle">
                          Broken {reportSummary.broken} · Blocked{" "}
                          {reportSummary.blocked}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="report-card report-category-scores">
                  <div className="report-card__header">
                    <div>
                      <div className="report-table-title">Category scores</div>
                      <div className="report-score-subtitle">
                        Deterministic scores from open findings in this scan.
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-category-grid report-category-score-grid">
                    {DASHBOARD_CATEGORIES.map((category) => {
                      const score =
                        reportCategoryScoresByKey[category.key] ?? null;
                      const scoreValue = reportIssueSummaryPending
                        ? "Pending"
                        : getCategoryScoreValue(score);
                      const statusLabel = reportIssueSummaryPending
                        ? "Pending"
                        : score
                          ? getCategoryScoreStatusLabel(score.status)
                          : "Score unavailable";
                      return (
                        <CategoryStatusCard
                          key={category.key}
                          title={category.label}
                          statusLabel={statusLabel}
                          tone={
                            reportIssueSummaryPending
                              ? "default"
                              : getCategoryScoreTone(score)
                          }
                          score={scoreValue}
                          description={category.description}
                          detail={
                            reportIssueSummaryPending
                              ? "Building issue summary"
                              : getSearchAccessCategoryDetail(
                                  score,
                                  reportIssues.summariesByCategory,
                                )
                          }
                          stats={
                            reportIssueSummaryPending
                              ? null
                              : score
                                ? `${score.findingCount} findings · ${score.checkCount} checks`
                                : "No score payload available"
                          }
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="report-kpi-grid report-kpi-grid--expanded">
                  <div className="report-card report-summary-card">
                    <div className="report-label">Total issues</div>
                    <div className="report-metric">
                      {reportIssueSummary?.total ?? 0}
                    </div>
                  </div>
                  <div className="report-card report-summary-card">
                    <div className="report-label">High priority</div>
                    <div className="report-metric">
                      {reportHighPriorityCount}
                    </div>
                  </div>
                  <div className="report-card report-summary-card">
                    <div className="report-label">New issues</div>
                    <div className="report-metric">
                      {reportIssueSummary?.byChangeStatus.new ?? 0}
                    </div>
                  </div>
                  <div className="report-card report-summary-card">
                    <div className="report-label">Existing issues</div>
                    <div className="report-metric">
                      {reportIssueSummary?.byChangeStatus.existing ?? 0}
                    </div>
                  </div>
                  <div className="report-card report-summary-card">
                    <div className="report-label">Resolved issues</div>
                    <div className="report-metric">
                      {reportIssueSummary?.byChangeStatus.resolved ??
                        reportIssues.resolvedCount}
                    </div>
                  </div>
                  <div className="report-card report-summary-card">
                    <div className="report-label">Links checked</div>
                    <div className="report-metric">
                      {reportRun.checked_links}
                    </div>
                  </div>
                </div>

                <div className="report-card report-score-subtitle">
                  {reportScores.summary}
                </div>

                <details className="report-card report-meta-details">
                  <summary className="report-meta-summary">
                    <div>
                      <div className="report-table-title">Scan details</div>
                      <div className="report-score-subtitle">
                        Run metadata, timestamps, URLs, and scan identifier.
                      </div>
                    </div>
                    <div className="report-meta-summary__chips">
                      <span className="report-meta-chip">
                        Duration{" "}
                        {formatDuration(
                          reportRun?.started_at,
                          reportRun?.finished_at,
                        )}
                      </span>
                      <span className="report-meta-chip">
                        Scan ID {reportScanIdShort}
                      </span>
                    </div>
                  </summary>
                  <div className="report-meta">
                    <div className="report-meta-item">
                      <div className="report-label">Status</div>
                      <div className="report-value">
                        {reportRun?.status.replace("_", " ") ?? "-"}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Issue generation</div>
                      <div className="report-value">
                        {reportRun.issue_generation_status ?? "pending"}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Site</div>
                      <div className="report-value">
                        {selectedSiteName ?? reportHost ?? "-"}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Checked links</div>
                      <div className="report-value">
                        {reportRun.checked_links} / {reportRun.total_links}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Scanned</div>
                      <div className="report-value">{reportDateLabel}</div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Scan ID</div>
                      <div className="report-value">
                        <span
                          style={{
                            fontSize: "12px",
                            color: "var(--text-muted)",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {reportScanIdDisplay}
                        </span>
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Start URL</div>
                      <div className="report-value">
                        {reportRun?.start_url ?? "-"}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Started</div>
                      <div className="report-value">
                        {formatDate(reportRun?.started_at ?? null)}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Finished</div>
                      <div className="report-value">
                        {formatDate(reportRun?.finished_at ?? null)}
                      </div>
                    </div>
                    <div className="report-meta-item">
                      <div className="report-label">Duration</div>
                      <div className="report-value">
                        {formatDuration(
                          reportRun?.started_at,
                          reportRun?.finished_at,
                        )}
                      </div>
                    </div>
                  </div>
                </details>

                {isInProgress(reportRun.status) && (
                  <ScanProgressHero
                    progress={
                      reportRun.total_links > 0
                        ? (reportRun.checked_links / reportRun.total_links) *
                          100
                        : 0
                    }
                    indeterminate={reportRun.total_links <= 0}
                    title="Scan still running"
                    stage={getScanStageText(reportRun)}
                    summary={`${
                      reportRun.checked_links
                    } / ${reportRun.total_links || "?"} links checked · Last update ${
                      reportLastLoadedAt
                        ? formatDate(new Date(reportLastLoadedAt).toISOString())
                        : "-"
                    }`}
                    counters={[
                      {
                        label: "Links checked",
                        value: reportRun.checked_links,
                      },
                      { label: "Broken", value: reportSummary.broken },
                      { label: "Blocked", value: reportSummary.blocked },
                      {
                        label: "No response",
                        value: reportSummary.no_response,
                      },
                      { label: "Ignored", value: reportIgnoredTotal ?? 0 },
                    ]}
                    note="This report stays locked to this exact run and refreshes as scan progress arrives."
                    statusTone="accent"
                  />
                )}

                {reportRun.status === "completed" && (
                  <>
                    {reportRun.issue_generation_status !== "completed" && (
                      <div
                        className="report-card"
                        style={{
                          display: "grid",
                          gap: "8px",
                          borderColor:
                            reportRun.issue_generation_status === "failed"
                              ? "var(--warning)"
                              : "var(--border)",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {reportRun.issue_generation_status === "failed"
                            ? "Issue generation failed"
                            : "Issue generation pending"}
                        </div>
                        <div
                          style={{ fontSize: "13px", color: "var(--muted)" }}
                        >
                          Scan completed, but issue generation{" "}
                          {reportRun.issue_generation_status === "failed"
                            ? "failed"
                            : "has not finished yet"}
                          . Raw scan evidence is still available.
                        </div>
                        {reportRun.issue_generation_error && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--warning)",
                            }}
                          >
                            {reportRun.issue_generation_error}
                          </div>
                        )}
                      </div>
                    )}
                    {renderTopPriorityIssues()}
                    {renderReportIssuesSection()}

                    <div className="report-card">
                      <div className="report-card__header">
                        <div>
                          <div className="report-table-title">
                            Evidence summary
                          </div>
                          <div
                            className="report-table-meta"
                            style={{ marginTop: "4px" }}
                          >
                            Link outcomes and severity counts for this exact
                            run.
                          </div>
                        </div>
                      </div>
                      <div className="report-mini-stats">
                        <div className="report-mini-stat">
                          <span>Broken</span>
                          <strong>{reportSummary.broken}</strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>Blocked</span>
                          <strong>{reportSummary.blocked}</strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>No response</span>
                          <strong>{reportSummary.no_response}</strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>Ignored / skipped</span>
                          <strong>{reportIgnoredTotal ?? 0}</strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>OK links</span>
                          <strong>{reportSummary.ok}</strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>High</span>
                          <strong>
                            {reportIssueSummary?.bySeverity.high ?? 0}
                          </strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>Medium</span>
                          <strong>
                            {reportIssueSummary?.bySeverity.medium ?? 0}
                          </strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>Low</span>
                          <strong>
                            {reportIssueSummary?.bySeverity.low ?? 0}
                          </strong>
                        </div>
                        <div className="report-mini-stat">
                          <span>Info</span>
                          <strong>
                            {reportIssueSummary?.bySeverity.info ?? 0}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="report-table-grid">
                      {renderReportLinkSection(
                        "Broken links",
                        "broken",
                        reportSummary.broken,
                      )}
                      {renderReportLinkSection(
                        "Blocked links",
                        "blocked",
                        reportSummary.blocked,
                      )}
                    </div>

                    <div className="report-table-grid">
                      {renderReportLinkSection(
                        "No response links",
                        "no_response",
                        reportSummary.no_response,
                      )}
                      {renderReportIgnoredSection()}
                    </div>

                    <div className="report-card">
                      <div className="report-table-title">OK links</div>
                      <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                        {reportSummary.ok} OK links were recorded in this scan.
                        Phase 1A keeps OK links as a summary-only count.
                      </div>
                    </div>
                  </>
                )}

                {reportRun.status !== "completed" &&
                  !isInProgress(reportRun.status) && (
                    <ScanProgressHero
                      progress={0}
                      title={
                        reportRun.status === "failed"
                          ? "Scan failed"
                          : "Scan cancelled"
                      }
                      stage={getScanStageText(reportRun)}
                      summary={
                        reportRun.error_message ??
                        "This report only shows the exact run state and any evidence captured before the scan stopped."
                      }
                      counters={[
                        {
                          label: "Links checked",
                          value: reportRun.checked_links,
                        },
                        { label: "Broken", value: reportSummary.broken },
                        { label: "Blocked", value: reportSummary.blocked },
                        {
                          label: "No response",
                          value: reportSummary.no_response,
                        },
                        { label: "Ignored", value: reportIgnoredTotal ?? 0 },
                      ]}
                      note="Detailed evidence remains available below for anything the scan captured before it stopped."
                      statusTone={
                        reportRun.status === "failed" ? "danger" : "warning"
                      }
                    />
                  )}

                <details
                  className="report-card"
                  open={reportTechnicalDiagnosticsNeedsAttention}
                  style={{ display: "grid", gap: "10px" }}
                >
                  <summary
                    className="report-table-title"
                    style={{ cursor: "pointer" }}
                  >
                    Technical diagnostics
                  </summary>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "12px",
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}
                  >
                    <span>Raw status {reportRun.status}</span>
                    <span>Site id {reportRun.site_id}</span>
                    <span>
                      Checked {reportRun.checked_links} /{" "}
                      {reportRun.total_links}
                    </span>
                    <span>404/410 {reportStatusGroups.notFound}</span>
                    <span>401/403/429 {reportStatusGroups.blocked}</span>
                    <span>5xx {reportStatusGroups.serverError}</span>
                    <span>No response {reportStatusGroups.noResponse}</span>
                    <span>Other HTTP {reportStatusGroups.otherHttp}</span>
                    <span>
                      Issue generation{" "}
                      {reportRun.issue_generation_status ?? "pending"}
                    </span>
                    {reportRun.issue_generation_error && (
                      <span title={reportRun.issue_generation_error}>
                        Issue generation error{" "}
                        {reportRun.issue_generation_error}
                      </span>
                    )}
                    <span>
                      {formatSeoDiagnostics(
                        reportTechnicalDiagnostics?.seoBasic,
                      )}
                    </span>
                    <span>
                      {formatRobotsDiagnostics(
                        reportTechnicalDiagnostics?.robots,
                      )}
                    </span>
                    <span>
                      {formatSitemapDiagnostics(
                        reportTechnicalDiagnostics?.sitemap,
                      )}
                    </span>
                    <span>
                      {formatSslDiagnostics(
                        reportTechnicalDiagnostics?.sslHttps,
                      )}
                    </span>
                    <span>
                      {formatSecurityHeaderDiagnostics(
                        reportTechnicalDiagnostics?.securityHeader,
                      )}
                    </span>
                    <span>
                      {formatPerformanceDiagnostics(
                        reportTechnicalDiagnostics?.performanceBasic,
                      )}
                    </span>
                    <span>
                      Refreshed{" "}
                      {reportLastLoadedAt
                        ? formatDate(new Date(reportLastLoadedAt).toISOString())
                        : "-"}
                    </span>
                  </div>
                </details>

                <div className="report-footer">
                  Last refreshed{" "}
                  {reportLastLoadedAt
                    ? formatDate(new Date(reportLastLoadedAt).toISOString())
                    : "-"}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <nav className="top-nav">
              <div className="app-brand-block">
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "18px",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    Scanlark
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Customer monitoring control centre
                  </div>
                </div>
                <div className="app-nav-tabs">
                  {primaryAppSections.map((item) => (
                    <button
                      key={item.key}
                      className={`app-nav-tab ${appSection === item.key ? "active" : ""}`}
                      onClick={() => setAppSection(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="app-site-switcher">
                <div style={{ minWidth: 0 }}>
                  <div className="app-site-switcher__label">Selected Site</div>
                  <select
                    value={selectedSiteId ?? ""}
                    onChange={(event) => {
                      const nextSite = sites.find(
                        (site) => site.id === event.target.value,
                      );
                      if (nextSite) void handleSelectSite(nextSite);
                    }}
                    className="app-input"
                    style={{ minHeight: "44px" }}
                  >
                    {!selectedSiteId && <option value="">Select a site</option>}
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {(siteNameById[site.id] ?? site.url).slice(0, 90)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setCreateError(null);
                    setAddSiteOpen(true);
                  }}
                  className="secondary-button"
                >
                  Add site
                </button>
                <button
                  onClick={() => setAppSection("sites")}
                  className="ghost-button"
                >
                  Manage
                </button>
              </div>

              <div className="app-toolbar">
                <button
                  onClick={handleNewScanAction}
                  disabled={
                    !!selectedSiteId && (triggeringScan || canCancelRun)
                  }
                  className="primary-button"
                >
                  {triggeringScan ? "Starting..." : "Run scan"}
                </button>
                {authUser && (
                  <div
                    ref={userMenuRef}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {authUser.name ?? authUser.email}
                    </div>
                    <button
                      onClick={() => setUserMenuOpen((prev) => !prev)}
                      className="secondary-button"
                    >
                      Account
                    </button>
                    {userMenuOpen && (
                      <div className="theme-menu">
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--muted)",
                            padding: "4px 8px",
                          }}
                        >
                          Theme
                        </div>
                        <button onClick={handleThemeToggle}>
                          Toggle {themeMode === "dark" ? "Light" : "Dark"}
                        </button>
                        {(["system", "dark", "light"] as const).map((mode) => (
                          <button
                            key={mode}
                            className={
                              themePreference === mode ? "active" : undefined
                            }
                            onClick={() => {
                              handleThemeChange(mode);
                              setUserMenuOpen(false);
                            }}
                          >
                            {mode === "system"
                              ? "System"
                              : mode === "dark"
                                ? "Dark"
                                : "Light"}
                          </button>
                        ))}
                        <div
                          style={{
                            height: "1px",
                            margin: "6px 0",
                            background: "var(--border)",
                          }}
                        />
                        <div
                          style={{
                            fontSize: "11px",
                            color: "var(--muted)",
                            padding: "4px 8px",
                          }}
                        >
                          Help
                        </div>
                        <button
                          onClick={() => {
                            openOnboarding(0);
                            setUserMenuOpen(false);
                          }}
                        >
                          Run onboarding
                        </button>
                        <button
                          onClick={() => {
                            clearOnboardingState();
                            openOnboarding(0);
                            setUserMenuOpen(false);
                          }}
                        >
                          Reset onboarding
                        </button>
                        <button
                          onClick={() => {
                            setShortcutsOpen(true);
                            setUserMenuOpen(false);
                          }}
                        >
                          Keyboard shortcuts
                        </button>
                        <div
                          style={{
                            height: "1px",
                            margin: "6px 0",
                            background: "var(--border)",
                          }}
                        />
                        <button onClick={() => void handleLogout()}>
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </nav>

            <div className="shell">
              <aside
                id="sidebar-drawer"
                ref={sidebarRef}
                className={`sidebar card drawer ${isDrawerOpen ? "open" : ""}`}
                style={{ width: paneWidth }}
                aria-label="Site navigation"
              >
                <div className="sidebar-content">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <h1
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          fontFamily: "var(--font-display)",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        Scanlark
                      </h1>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--muted)",
                          fontSize: "12px",
                        }}
                      >
                        Link integrity monitor
                      </p>
                    </div>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="drawer-close"
                      ref={drawerCloseRef}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        borderRadius: "10px",
                        padding: "4px 6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      title="Close menu"
                    >
                      ✕
                    </button>
                  </div>

                  <label style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Search sites
                    <input
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                      placeholder="Search by URL"
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        boxSizing: "border-box",
                      }}
                    />
                  </label>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginBottom: "8px",
                      }}
                    >
                      Sites
                    </div>
                    {sitesError && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--warning)",
                          marginBottom: "6px",
                        }}
                      >
                        {sitesError}
                      </div>
                    )}
                    <div
                      className="scroll-y"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxHeight: "220px",
                      }}
                    >
                      {sitesLoading &&
                        filteredSites.length === 0 &&
                        Array.from({ length: 4 }).map((_, idx) => (
                          <div
                            key={`site-skeleton-${idx}`}
                            className="skeleton skeleton--site"
                          />
                        ))}
                      {filteredSites.map((site) => {
                        const isSelected = site.id === selectedSiteId;
                        const isDeleting = deletingSiteId === site.id;

                        return (
                          <div
                            key={site.id}
                            style={{
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                              background: isSelected
                                ? "var(--panel-elev)"
                                : "var(--panel)",
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                            }}
                          >
                            <button
                              onClick={() => handleSelectSite(site)}
                              style={{
                                textAlign: "left",
                                border: "none",
                                background: "transparent",
                                color: "var(--text)",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {siteNameById[site.id] ?? site.url}
                              </div>
                              {siteNameById[site.id] && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--muted)",
                                    marginTop: "2px",
                                  }}
                                >
                                  {site.url}
                                </div>
                              )}
                              {site.url === SAMPLE_SITE_URL && (
                                <div
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--muted)",
                                    marginTop: "2px",
                                  }}
                                >
                                  Sample site
                                </div>
                              )}
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--muted)",
                                  marginTop: "2px",
                                }}
                              >
                                created {formatDate(site.created_at)}
                              </div>
                            </button>

                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                              }}
                            >
                              <button
                                onClick={() => handleDeleteSite(site.id)}
                                disabled={isDeleting}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--danger)",
                                  background: isDeleting
                                    ? "var(--panel-elev)"
                                    : "var(--panel)",
                                  color: "var(--danger)",
                                  cursor: isDeleting
                                    ? "not-allowed"
                                    : "pointer",
                                  fontSize: "11px",
                                }}
                              >
                                {isDeleting ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!sitesLoading && filteredSites.length === 0 && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--muted)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          {sites.length === 0 && !siteSearch.trim()
                            ? "No sites yet."
                            : "No sites match."}
                          {sites.length === 0 && !siteSearch.trim() && (
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                onClick={() => {
                                  setCreateError(null);
                                  setAddSiteOpen(true);
                                }}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                Add site
                              </button>
                              <button
                                onClick={() => void handleCreateSampleSite()}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                Try sample
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {deleteError && (
                      <p
                        style={{
                          color: "var(--warning)",
                          fontSize: "12px",
                          marginTop: "8px",
                        }}
                      >
                        {deleteError}
                      </p>
                    )}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginBottom: "8px",
                      }}
                    >
                      Schedule
                    </div>
                    <div
                      style={{
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {!selectedSite && (
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Select a site to configure auto-scans.
                        </div>
                      )}
                      {selectedSite && (
                        <>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              fontSize: "12px",
                              color: "var(--text)",
                            }}
                          >
                            <span>Auto-scan</span>
                            <input
                              type="checkbox"
                              checked={
                                scheduleFrequency === "manual"
                                  ? false
                                  : scheduleEnabled
                              }
                              onChange={(e) =>
                                setScheduleEnabled(e.target.checked)
                              }
                              disabled={scheduleFrequency === "manual"}
                            />
                          </label>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr",
                              gap: "8px",
                            }}
                          >
                            <label
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Frequency
                              <select
                                value={scheduleFrequency}
                                onChange={(e) => {
                                  const nextFrequency = e.target.value as
                                    | "manual"
                                    | "daily"
                                    | "weekly"
                                    | "monthly";
                                  setScheduleFrequency(nextFrequency);
                                  if (nextFrequency === "manual") {
                                    setScheduleEnabled(false);
                                  }
                                }}
                                style={{
                                  marginTop: "6px",
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "10px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                }}
                              >
                                <option value="manual">Manual</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </label>
                            {scheduleFrequency === "weekly" && (
                              <label
                                style={{
                                  fontSize: "12px",
                                  color: "var(--muted)",
                                }}
                              >
                                Day of week (UTC)
                                <select
                                  value={scheduleDayOfWeek}
                                  onChange={(e) =>
                                    setScheduleDayOfWeek(Number(e.target.value))
                                  }
                                  style={{
                                    marginTop: "6px",
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                  }}
                                >
                                  <option value={0}>Sunday</option>
                                  <option value={1}>Monday</option>
                                  <option value={2}>Tuesday</option>
                                  <option value={3}>Wednesday</option>
                                  <option value={4}>Thursday</option>
                                  <option value={5}>Friday</option>
                                  <option value={6}>Saturday</option>
                                </select>
                              </label>
                            )}
                            {scheduleFrequency === "monthly" && (
                              <label
                                style={{
                                  fontSize: "12px",
                                  color: "var(--muted)",
                                }}
                              >
                                Day of month (UTC)
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={scheduleDayOfMonth}
                                  onChange={(e) =>
                                    setScheduleDayOfMonth(
                                      Math.min(
                                        31,
                                        Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      ),
                                    )
                                  }
                                  style={{
                                    marginTop: "6px",
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                  }}
                                />
                              </label>
                            )}
                            <label
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Time (UTC)
                              <input
                                type="time"
                                value={scheduleTimeUtc}
                                onChange={(e) =>
                                  setScheduleTimeUtc(e.target.value)
                                }
                                style={{
                                  marginTop: "6px",
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "10px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                }}
                              />
                            </label>
                          </div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Time (UTC):{" "}
                            {formatScheduleUtcLabel(
                              scheduleFrequency,
                              scheduleTimeUtc,
                              scheduleDayOfWeek,
                              scheduleDayOfMonth,
                            )}
                          </div>
                          {showLocalTimeZone && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Your time:{" "}
                              {formatScheduleLocalLabel(
                                scheduleFrequency,
                                scheduleTimeUtc,
                                scheduleDayOfWeek,
                                scheduleDayOfMonth,
                              )}{" "}
                              ({localTimeZone})
                            </div>
                          )}
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Next run (UTC):{" "}
                            {formatUtcDateTime(selectedSite.next_scheduled_at)}
                          </div>
                          {showLocalTimeZone && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Next run (local):{" "}
                              {formatLocalDateTime(
                                selectedSite.next_scheduled_at,
                              )}{" "}
                              ({localTimeZone})
                            </div>
                          )}
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Last scheduled run:{" "}
                            {formatDate(selectedSite.last_scheduled_at)}
                          </div>
                          {scheduleError && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--warning)",
                              }}
                            >
                              {scheduleError}
                            </div>
                          )}
                          <button
                            onClick={() => void handleSaveSchedule()}
                            disabled={scheduleSaving}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: scheduleSaving
                                ? "var(--panel-elev)"
                                : "var(--panel)",
                              cursor: scheduleSaving
                                ? "not-allowed"
                                : "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                          >
                            {scheduleSaving ? "Saving..." : "Save schedule"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginBottom: "8px",
                      }}
                    >
                      Notifications
                    </div>
                    <div
                      style={{
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {!selectedSite && (
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Select a site to configure notifications.
                        </div>
                      )}
                      {selectedSite && (
                        <>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              fontSize: "12px",
                              color: "var(--text)",
                            }}
                          >
                            <span>Email alerts</span>
                            <input
                              type="checkbox"
                              checked={notifyEnabled}
                              disabled={notifyLoading}
                              onChange={(e) =>
                                setNotifyEnabled(e.target.checked)
                              }
                            />
                          </label>
                          <label
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Email address
                            <input
                              type="email"
                              value={notifyEmail}
                              onChange={(e) => setNotifyEmail(e.target.value)}
                              placeholder="you@example.com"
                              disabled={notifyLoading}
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: "var(--panel)",
                                color: "var(--text)",
                              }}
                            />
                          </label>
                          <label
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Notify on
                            <select
                              value={notifyOn}
                              onChange={(e) =>
                                setNotifyOn(e.target.value as NotifyOnOption)
                              }
                              disabled={notifyLoading}
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: "var(--panel)",
                                color: "var(--text)",
                              }}
                            >
                              <option value="new_issues_only">
                                Only when NEW issues appear
                              </option>
                              <option value="issues_exist">
                                Only when issues exist
                              </option>
                              <option value="always">Always</option>
                              <option value="never">Never</option>
                            </select>
                          </label>
                          <label
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              fontSize: "12px",
                              color: "var(--text)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={notifyIncludeCsv}
                              onChange={(e) =>
                                setNotifyIncludeCsv(e.target.checked)
                              }
                              disabled={notifyLoading}
                            />
                            Include CSV attachment (coming soon)
                          </label>
                          <label
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              fontSize: "12px",
                              color: "var(--text)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={summaryEnabled}
                              onChange={(e) =>
                                setSummaryEnabled(e.target.checked)
                              }
                              disabled={notifyLoading}
                            />
                            Weekly summary
                          </label>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            We email you based on the selected trigger.
                          </div>
                          {notifyLoading && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Loading notification settings...
                            </div>
                          )}
                          {notifyError && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--warning)",
                              }}
                            >
                              {notifyError}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => void handleSaveNotifications()}
                              disabled={
                                notifySaving ||
                                notifyLoading ||
                                (notifyEnabled &&
                                  notifyOn !== "never" &&
                                  !notifyEmail.trim())
                              }
                              style={{
                                padding: "6px 10px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: notifySaving
                                  ? "var(--panel-elev)"
                                  : "var(--panel)",
                                cursor:
                                  notifySaving ||
                                  notifyLoading ||
                                  (notifyEnabled &&
                                    notifyOn !== "never" &&
                                    !notifyEmail.trim())
                                    ? "not-allowed"
                                    : "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                              }}
                            >
                              {notifySaving ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => void handleSendTestEmail()}
                              disabled={
                                notifyTestSending ||
                                !notifyEmail.trim() ||
                                notifyLoading
                              }
                              style={{
                                padding: "6px 10px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: notifyTestSending
                                  ? "var(--panel-elev)"
                                  : "var(--panel)",
                                cursor:
                                  notifyTestSending ||
                                  !notifyEmail.trim() ||
                                  !notifyEnabled ||
                                  notifyOn === "never" ||
                                  notifyLoading
                                    ? "not-allowed"
                                    : "pointer",
                                fontSize: "12px",
                              }}
                            >
                              {notifyTestSending
                                ? "Sending..."
                                : "Send test alert"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--muted)",
                        marginBottom: "8px",
                      }}
                    >
                      Recent scans
                    </div>
                    <div
                      className="scroll-y"
                      style={{
                        maxHeight: "220px",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "12px",
                        }}
                      >
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            background: "var(--panel)",
                            zIndex: 1,
                          }}
                        >
                          <tr>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--border)",
                                color: "var(--muted)",
                                fontWeight: 500,
                              }}
                            >
                              Started
                            </th>
                            <th
                              style={{
                                textAlign: "right",
                                padding: "6px 8px",
                                borderBottom: "1px solid var(--border)",
                                color: "var(--muted)",
                                fontWeight: 500,
                              }}
                            >
                              Broken
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((run) => {
                            const isSelected = run.id === pinnedRunId;
                            const brokenPct = percentBroken(
                              run.checked_links || run.total_links,
                              run.broken_links,
                            );
                            return (
                              <tr
                                key={run.id}
                                onClick={() => {
                                  setResults([]);
                                  resetOccurrencesState();
                                  setSelectedRunId(run.id);
                                  selectedRunIdRef.current = run.id;

                                  if (isInProgress(run.status)) {
                                    setActiveRunId(run.id);
                                    activeRunIdRef.current = run.id;
                                    void refreshSelectedRun(run.id);
                                  } else {
                                    setActiveRunId(null);
                                    activeRunIdRef.current = null;
                                    void loadResults(run.id);
                                  }
                                }}
                                style={{
                                  cursor: "pointer",
                                  background: isSelected
                                    ? "var(--panel-elev)"
                                    : "transparent",
                                }}
                              >
                                <td
                                  style={{
                                    padding: "6px 8px",
                                    borderBottom: "1px solid var(--border)",
                                  }}
                                >
                                  {formatDate(run.started_at)}
                                </td>
                                <td
                                  style={{
                                    padding: "6px 8px",
                                    borderBottom: "1px solid var(--border)",
                                    textAlign: "right",
                                  }}
                                >
                                  {run.broken_links} ({brokenPct})
                                </td>
                              </tr>
                            );
                          })}
                          {history.length === 0 && !historyLoading && (
                            <tr>
                              <td
                                colSpan={2}
                                style={{
                                  padding: "10px",
                                  textAlign: "center",
                                  color: "var(--muted)",
                                }}
                              >
                                <div style={{ marginBottom: "6px" }}>
                                  No scans yet. Run your first scan to see what
                                  Scanlark finds (usually a minute or two).
                                </div>
                                <button
                                  onClick={handleRunScan}
                                  disabled={!selectedSiteId || triggeringScan}
                                  style={{
                                    padding: "4px 8px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    fontSize: "11px",
                                    cursor:
                                      !selectedSiteId || triggeringScan
                                        ? "not-allowed"
                                        : "pointer",
                                  }}
                                >
                                  {triggeringScan ? "Starting..." : "Run scan"}
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </aside>

              <div
                className="resizer"
                onMouseDown={() => setIsResizing(true)}
                title="Drag to resize"
              />

              <main className="main">
                <div className="app-section-shell">
                  {!hasSites && (
                    <div className="app-section-heading">
                      <div className="app-section-heading__title">
                        Add your first site
                      </div>
                      <div className="app-section-heading__meta">
                        Scanlark is ready. Add a site to start monitoring
                        health, reports, changes, and alerts.
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          onClick={() => {
                            setCreateError(null);
                            setAddSiteOpen(true);
                          }}
                          className="primary-button"
                        >
                          Add site
                        </button>
                        <button
                          onClick={() => void handleCreateSampleSite()}
                          className="secondary-button"
                        >
                          Try sample site
                        </button>
                      </div>
                    </div>
                  )}

                  {hasSites && appSection === "dashboard" && (
                    <div
                      style={{
                        display: "grid",
                        gap: "22px",
                      }}
                    >
                      <div className="dashboard-health-layout">
                        <div className="dashboard-hero-panel">
                          <div className="dashboard-hero-panel__header">
                            <div style={{ minWidth: 0 }}>
                              <div className="dashboard-hero-panel__eyebrow">
                                Site health overview
                              </div>
                              <div className="dashboard-hero-panel__headline">
                                {selectedSiteName ??
                                  (selectedSite?.url
                                    ? safeHost(selectedSite.url)
                                    : "No site selected")}
                              </div>
                              <div className="dashboard-hero-panel__copy">
                                {selectedSite?.url ??
                                  "Select a site to monitor"}{" "}
                                {dashboardSummaryPending
                                  ? "· Building issue summary"
                                  : dashboardScores.overall.band
                                    ? `· ${dashboardScores.overall.band}`
                                    : ""}
                              </div>
                            </div>
                            <div className="dashboard-hero-panel__actions">
                              <button
                                onClick={handleNewScanAction}
                                disabled={
                                  !!selectedSiteId &&
                                  (triggeringScan || canCancelRun)
                                }
                                className="primary-button primary-button--large"
                              >
                                {triggeringScan ? "Starting..." : "Run scan"}
                              </button>
                              <button
                                onClick={() =>
                                  dashboardLatestRun &&
                                  openReport(dashboardLatestRun.id)
                                }
                                disabled={
                                  !dashboardLatestRun ||
                                  dashboardLatestRun.status !== "completed"
                                }
                                className="secondary-button primary-button--large"
                              >
                                View latest report
                              </button>
                            </div>
                          </div>
                          <div className="dashboard-hero-panel__status-row">
                            <StatusBadge
                              label={
                                dashboardSummaryPending
                                  ? "Score pending"
                                  : (dashboardScores.overall.band ??
                                    "Monitoring")
                              }
                              tone="accent"
                            />
                            <StatusBadge
                              label={
                                dashboardSummary?.notificationSettings
                                  ?.notifyEnabled
                                  ? "Alerts enabled"
                                  : "Alerts off"
                              }
                              tone={
                                dashboardSummary?.notificationSettings
                                  ?.notifyEnabled
                                  ? "success"
                                  : "default"
                              }
                            />
                            <StatusBadge
                              label={`Schedule ${selectedSite?.schedule_frequency ?? "manual"}`}
                              tone="default"
                            />
                          </div>
                          <div className="dashboard-hero-panel__meta">
                            <div className="dashboard-hero-meta-card">
                              <span>Last scan</span>
                              <span>
                                {dashboardLatestRun
                                  ? formatDate(
                                      dashboardLatestRun.finished_at ??
                                        dashboardLatestRun.started_at,
                                    )
                                  : "No scan yet"}
                              </span>
                            </div>
                            <div className="dashboard-hero-meta-card">
                              <span>Next scan</span>
                              <span>
                                {formatDate(
                                  selectedSite?.next_scheduled_at ?? null,
                                )}
                              </span>
                            </div>
                            <div className="dashboard-hero-meta-card">
                              <span>Status</span>
                              <span>
                                {dashboardLatestRun
                                  ? dashboardLatestRun.status.replace("_", " ")
                                  : "Ready"}
                              </span>
                            </div>
                            <div className="dashboard-hero-meta-card">
                              <span>Actions</span>
                              <span>
                                Schedule, alerts, ignore rules, and reports are
                                one click away
                              </span>
                            </div>
                          </div>
                          <div className="dashboard-hero-panel__footer-actions">
                            <button
                              onClick={() => setAppSection("schedule")}
                              className="secondary-button"
                            >
                              Configure schedule
                            </button>
                            <button
                              onClick={() => setAppSection("alerts")}
                              className="secondary-button"
                            >
                              Configure alerts
                            </button>
                            <button
                              onClick={() => setAppSection("ignore_rules")}
                              disabled={!selectedSiteId}
                              className="secondary-button"
                            >
                              Ignore rules
                            </button>
                            <button
                              onClick={() => {
                                if (selectedSite?.url) {
                                  window.open(
                                    selectedSite.url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                                }
                              }}
                              disabled={!selectedSite?.url}
                              className="ghost-button"
                            >
                              Open site
                            </button>
                            <button
                              onClick={() => {
                                setAppSection("reports");
                                setScanWorkspaceOpen(true);
                              }}
                              className="ghost-button"
                            >
                              Open reports workspace
                            </button>
                          </div>
                        </div>
                        <ScoreRingCard
                          label="Overall score"
                          score={
                            dashboardSummaryPending
                              ? null
                              : dashboardScores.overall.score
                          }
                          status={
                            dashboardSummaryPending
                              ? "Score pending"
                              : (dashboardScores.overall.band ??
                                dashboardScores.overall.detail)
                          }
                          detail="A compact health view across site trust, link integrity, and current findings."
                          helper={
                            dashboardSummaryPending
                              ? "Building issue summary"
                              : `Link integrity ${
                                  dashboardScores.linkIntegrity.score == null
                                    ? "-"
                                    : `${dashboardScores.linkIntegrity.score}%`
                                }`
                          }
                          stats={[
                            {
                              label: "Open issues",
                              value: dashboardSummaryPending
                                ? "Pending"
                                : (dashboardIssueSummary?.total ?? 0),
                            },
                            {
                              label: "High priority",
                              value: dashboardSummaryPending
                                ? "Pending"
                                : dashboardHighPriority,
                            },
                            {
                              label: "Fixed this scan",
                              value: dashboardSummaryPending
                                ? "Pending"
                                : (dashboardLatestDiffSummary?.fixedIssues ??
                                  0),
                            },
                            {
                              label: "Links checked",
                              value: dashboardLatestRun?.checked_links ?? 0,
                            },
                          ]}
                          tone={
                            dashboardScores.overall.score == null
                              ? "default"
                              : dashboardScores.overall.score >= 90
                                ? "success"
                                : dashboardScores.overall.score >= 75
                                  ? "accent"
                                  : dashboardScores.overall.score >= 60
                                    ? "warning"
                                    : "danger"
                          }
                        />
                      </div>

                      {dashboardSummaryQuery.isLoading && (
                        <div className="skeleton" style={{ height: "80px" }} />
                      )}
                      {dashboardSummaryQuery.error && (
                        <div
                          style={{
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: "1px solid var(--border)",
                            color: "var(--warning)",
                          }}
                        >
                          {getErrorMessage(
                            dashboardSummaryQuery.error,
                            "Failed to load dashboard summary",
                          )}
                        </div>
                      )}

                      {dashboardLatestRun && dashboardActiveLike && (
                        <ScanProgressHero
                          progress={
                            dashboardSummaryPending ? 100 : dashboardProgress
                          }
                          indeterminate={
                            dashboardLatestRun.status === "queued" ||
                            dashboardLatestRun.total_links <= 0
                          }
                          title={
                            dashboardSummaryPending
                              ? "Finalising scan"
                              : "Scan running"
                          }
                          stage={dashboardStage}
                          summary={`${dashboardLatestRun.checked_links} / ${dashboardLatestRun.total_links || "?"} links checked · Last update ${formatRelative(dashboardLatestRun.updated_at ?? dashboardLatestRun.started_at)}`}
                          counters={[
                            {
                              label: "Links checked",
                              value: dashboardLatestRun.checked_links,
                            },
                            {
                              label: "Broken",
                              value: dashboardActiveLinkSummary.broken,
                            },
                            {
                              label: "Blocked",
                              value: dashboardActiveLinkSummary.blocked,
                            },
                            {
                              label: "No response",
                              value: dashboardActiveLinkSummary.no_response,
                            },
                            ...(dashboardIgnoredSkipped != null
                              ? [
                                  {
                                    label: "Ignored",
                                    value: dashboardIgnoredSkipped,
                                  },
                                ]
                              : dashboardActiveLike
                                ? [
                                    {
                                      label: "Ignored",
                                      value: "Pending",
                                    },
                                  ]
                                : []),
                          ]}
                          previewTitle="Live preview · read-only"
                          previewItems={
                            dashboardRunningPreviewItems.length > 0
                              ? dashboardRunningPreviewItems.slice(0, 4)
                              : [
                                  {
                                    label: "Scan is in progress",
                                    detail:
                                      "Counts update live as links are discovered and checked.",
                                  },
                                ]
                          }
                          note={
                            dashboardSummaryPending
                              ? "The crawl is complete. Scanlark is building the issue summary before the report is ready."
                              : "Live preview stays read-only while the scan is running. Open the report after completion for raw evidence and source pages."
                          }
                          statusTone={
                            dashboardSummaryPending ? "success" : "accent"
                          }
                          primaryAction={
                            canCancelRun ? (
                              <button
                                onClick={handleCancelScan}
                                className="secondary-button"
                                style={{
                                  borderColor: "var(--danger)",
                                  color: "var(--danger)",
                                }}
                              >
                                Cancel scan
                              </button>
                            ) : undefined
                          }
                        />
                      )}

                      {dashboardLatestRun &&
                        shouldShowDashboardTerminalPanel && (
                          <ScanProgressHero
                            progress={
                              dashboardLatestRun.status === "completed"
                                ? 100
                                : 0
                            }
                            title={
                              dashboardLatestRun.status === "completed"
                                ? "Scan complete"
                                : dashboardLatestRun.status === "failed"
                                  ? "Scan failed"
                                  : "Scan cancelled"
                            }
                            stage={dashboardStage}
                            summary={
                              dashboardLatestRun.status === "completed"
                                ? `${formatDate(dashboardLatestRun.finished_at ?? dashboardLatestRun.started_at)} · Report-ready summary is available below.`
                                : `${
                                    dashboardLatestRun.error_message ??
                                    "The scan stopped before completion."
                                  }`
                            }
                            counters={[
                              {
                                label: "Links checked",
                                value: dashboardLatestRun.checked_links,
                              },
                              {
                                label: "Broken",
                                value: dashboardLinkSummary.broken,
                              },
                              {
                                label: "Blocked",
                                value: dashboardLinkSummary.blocked,
                              },
                              {
                                label: "No response",
                                value: dashboardLinkSummary.no_response,
                              },
                              ...(dashboardIgnoredSkipped != null
                                ? [
                                    {
                                      label: "Ignored",
                                      value: dashboardIgnoredSkipped,
                                    },
                                  ]
                                : []),
                            ]}
                            summaryStats={
                              dashboardLatestRun.status === "completed"
                                ? [
                                    {
                                      label: "Latest score",
                                      value:
                                        !dashboardSummaryDataReady ||
                                        dashboardScores.overall.score == null
                                          ? "-"
                                          : `${dashboardScores.overall.score}%`,
                                    },
                                    {
                                      label: "Open issues",
                                      value: dashboardIssueSummary?.total ?? 0,
                                    },
                                    {
                                      label: "High priority",
                                      value: dashboardHighPriority,
                                    },
                                    {
                                      label: "New",
                                      value: dashboardIssueMovement?.new ?? 0,
                                    },
                                    {
                                      label: "Existing",
                                      value:
                                        dashboardIssueMovement?.existing ?? 0,
                                    },
                                    {
                                      label: "Resolved",
                                      value:
                                        dashboardIssueMovement?.resolved ?? 0,
                                    },
                                  ]
                                : undefined
                            }
                            previewTitle={
                              dashboardLatestRun.status === "completed"
                                ? "Scan completion snapshot"
                                : "Latest captured snapshot"
                            }
                            previewItems={
                              dashboardLatestRun.status === "completed"
                                ? [
                                    {
                                      label: "High-priority issues",
                                      detail: `${dashboardHighPriority} critical or high-priority issues need review`,
                                    },
                                    {
                                      label: "Open issues",
                                      detail: `${dashboardIssueSummary?.total ?? 0} issues remain in the latest report`,
                                    },
                                    {
                                      label: "Fixed this scan",
                                      detail: `${dashboardLatestDiffSummary?.fixedIssues ?? 0} issues were resolved compared with the previous baseline`,
                                    },
                                  ]
                                : dashboardRunningPreviewItems.slice(0, 3)
                            }
                            note={
                              dashboardLatestRun.status === "completed"
                                ? "Detailed evidence, source pages, and technical diagnostics remain in the report."
                                : "You can start a fresh scan immediately. Existing dashboard cards and history remain available below."
                            }
                            statusTone={
                              dashboardLatestRun.status === "completed"
                                ? "success"
                                : dashboardLatestRun.status === "failed"
                                  ? "danger"
                                  : "warning"
                            }
                            primaryAction={
                              dashboardLatestRun.status === "completed" ? (
                                <button
                                  onClick={() =>
                                    openReport(dashboardLatestRun.id)
                                  }
                                  className="primary-button"
                                >
                                  View report
                                </button>
                              ) : (
                                <button
                                  onClick={handleNewScanAction}
                                  disabled={
                                    !!selectedSiteId &&
                                    (triggeringScan || canCancelRun)
                                  }
                                  className="primary-button"
                                >
                                  {triggeringScan
                                    ? "Starting..."
                                    : "Run scan again"}
                                </button>
                              )
                            }
                            secondaryAction={
                              <button
                                onClick={() => {
                                  setDashboardRecentlyFinishedRunId(null);
                                }}
                                className="secondary-button"
                              >
                                Back to dashboard
                              </button>
                            }
                          />
                        )}

                      <div className="dashboard-score-grid">
                        <MetricCard
                          label="Link integrity"
                          value={
                            dashboardSummaryPending
                              ? "Pending"
                              : dashboardScores.linkIntegrity.score == null
                                ? "-"
                                : `${dashboardScores.linkIntegrity.score}%`
                          }
                          detail={
                            dashboardSummaryPending
                              ? "Building issue summary"
                              : (dashboardScores.linkIntegrity.band ??
                                dashboardScores.linkIntegrity.detail)
                          }
                          tone="accent"
                        />
                        <MetricCard
                          label="Website changes"
                          value={
                            dashboardSummaryPending
                              ? "Summary pending"
                              : `${dashboardIssueMovement?.new ?? 0} new issues`
                          }
                          detail={
                            dashboardSummaryPending
                              ? "Issue movement updates when the latest scan summary is ready."
                              : `${dashboardLatestDiffSummary?.fixedIssues ?? dashboardIssueMovement?.resolved ?? 0} fixed since last scan · ${dashboardIssueMovement?.existing ?? 0} still present`
                          }
                          tone="warning"
                        />
                        <MetricCard
                          label="Last scan"
                          value={
                            dashboardLatestRun
                              ? dashboardLatestRun.status.replace("_", " ")
                              : "None"
                          }
                          detail={formatDate(
                            dashboardLatestRun?.finished_at ?? null,
                          )}
                        />
                        <MetricCard
                          label="Schedule and alerts"
                          value={
                            dashboardSummary?.notificationSettings
                              ?.notifyEnabled
                              ? "Alerts on"
                              : "Alerts off"
                          }
                          detail={`${selectedSite?.schedule_frequency ?? "manual"} · next ${formatDate(selectedSite?.next_scheduled_at ?? null)}`}
                          tone={
                            dashboardSummary?.notificationSettings
                              ?.notifyEnabled
                              ? "success"
                              : "default"
                          }
                        />
                        <MetricCard
                          label="Availability"
                          value={getUptimeStatusLabel(dashboardUptime)}
                          detail={
                            dashboardUptime?.enabled
                              ? `${formatUptimePercentage(
                                  dashboardUptime.uptime30d,
                                )} over 30d · last ${formatDate(
                                  dashboardUptime.lastCheckedAt,
                                )}`
                              : "Homepage monitoring is currently disabled."
                          }
                          tone={getUptimeTone(dashboardUptime)}
                        />
                      </div>

                      <div className="dashboard-category-grid">
                        {DASHBOARD_CATEGORIES.map((category) => {
                          const score =
                            dashboardCategoryScoresByKey[category.key] ?? null;
                          const tone = dashboardSummaryPending
                            ? "default"
                            : getCategoryScoreTone(score);
                          const statusLabel = dashboardSummaryPending
                            ? "Pending"
                            : score
                              ? getCategoryScoreStatusLabel(score.status)
                              : "Score unavailable";
                          return (
                            <CategoryStatusCard
                              key={category.key}
                              title={category.label}
                              statusLabel={statusLabel}
                              tone={tone}
                              score={
                                dashboardSummaryPending
                                  ? "Pending"
                                  : getCategoryScoreValue(score)
                              }
                              description={category.description}
                              detail={
                                dashboardSummaryPending
                                  ? "Building issue summary"
                                  : getSearchAccessCategoryDetail(
                                      score,
                                      dashboardCategorySummaries,
                                    )
                              }
                              stats={
                                dashboardSummaryPending
                                  ? null
                                  : score
                                    ? `${score.findingCount} findings · ${score.checkCount} checks`
                                    : "No score payload available"
                              }
                            />
                          );
                        })}
                      </div>

                      <div className="dashboard-history-grid">
                        <div className="surface-card surface-card--history">
                          <div className="dashboard-history-card__header">
                            <div className="dashboard-history-card__title">
                              Report history
                            </div>
                            <div className="dashboard-history-card__meta">
                              Recent runs stay readable here. Open the report
                              for detailed evidence and issue breakdown.
                            </div>
                          </div>
                          {dashboardHistoryItems.slice(0, 5).map((run) => (
                            <div key={run.id} className="dashboard-history-row">
                              <div>
                                <div className="dashboard-history-row__title">
                                  {formatDate(run.started_at)}
                                </div>
                                <div className="dashboard-history-row__meta">
                                  <span className="dashboard-history-row__meta-status">
                                    <span>
                                      {formatRelative(run.started_at)}
                                    </span>
                                    <StatusBadge
                                      label={run.status.replace("_", " ")}
                                      tone={
                                        run.status === "completed"
                                          ? "success"
                                          : run.status === "failed"
                                            ? "danger"
                                            : run.status === "cancelled"
                                              ? "warning"
                                              : "accent"
                                      }
                                    />
                                  </span>
                                </div>
                              </div>
                              <div className="dashboard-history-row__stats">
                                <strong>
                                  Checked {run.checked_links}/{run.total_links}
                                </strong>
                                <span>
                                  Broken {run.broken_links} (
                                  {percentBroken(
                                    run.checked_links || run.total_links,
                                    run.broken_links,
                                  )}
                                  )
                                </span>
                              </div>
                              <button
                                onClick={() => openReport(run.id)}
                                disabled={run.status !== "completed"}
                                className="secondary-button"
                              >
                                View report
                              </button>
                            </div>
                          ))}
                          {dashboardHistoryItems.length === 0 && (
                            <div
                              style={{
                                padding: "16px",
                                color: "var(--muted)",
                                fontSize: "13px",
                              }}
                            >
                              No scans yet.
                            </div>
                          )}
                        </div>
                        <div className="surface-card surface-card--summary">
                          <div className="dashboard-summary-card__header">
                            <div className="dashboard-summary-card__title">
                              Latest scan summary
                            </div>
                            <div className="dashboard-summary-card__meta">
                              A compact snapshot of the most important numbers
                              from the latest dashboard run.
                            </div>
                          </div>
                          <div className="dashboard-summary-list">
                            <div className="dashboard-summary-item">
                              <span>High priority issues</span>
                              <strong>
                                {dashboardSummaryPending
                                  ? "Pending"
                                  : dashboardHighPriority}
                              </strong>
                            </div>
                            <div className="dashboard-summary-item">
                              <span>Open issues</span>
                              <strong>
                                {dashboardSummaryPending
                                  ? "Pending"
                                  : (dashboardIssueSummary?.total ?? 0)}
                              </strong>
                            </div>
                            <div className="dashboard-summary-item">
                              <span>Fixed this scan</span>
                              <strong>
                                {dashboardSummaryPending
                                  ? "Pending"
                                  : (dashboardLatestDiffSummary?.fixedIssues ??
                                    0)}
                              </strong>
                            </div>
                            <div className="dashboard-summary-item">
                              <span>Links checked</span>
                              <strong>
                                {dashboardLatestRun?.checked_links ?? 0}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="app-settings-card">
                        <div className="app-settings-card__title">
                          Availability Monitoring
                        </div>
                        <div className="app-settings-card__subtitle">
                          Lightweight homepage checks stay separate from scans
                          and reports. This monitors the root URL only.
                        </div>
                        {!selectedSite ? (
                          <div
                            style={{ fontSize: "13px", color: "var(--muted)" }}
                          >
                            Select a site to configure availability checks.
                          </div>
                        ) : (
                          <div className="app-form-grid">
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px",
                                fontSize: "13px",
                              }}
                            >
                              <span>Homepage monitoring</span>
                              <input
                                type="checkbox"
                                checked={uptimeEnabled}
                                onChange={(event) =>
                                  setUptimeEnabled(event.target.checked)
                                }
                              />
                            </label>
                            <div className="app-form-grid app-form-grid--two">
                              <label className="field-label">
                                Check URL
                                <input
                                  type="url"
                                  value={uptimeCheckUrl}
                                  onChange={(event) =>
                                    setUptimeCheckUrl(event.target.value)
                                  }
                                  className="app-input"
                                  placeholder={selectedSite.url}
                                />
                              </label>
                              <label className="field-label">
                                Failure threshold
                                <input
                                  type="number"
                                  min={1}
                                  value={uptimeFailureThreshold}
                                  onChange={(event) =>
                                    setUptimeFailureThreshold(
                                      Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    )
                                  }
                                  className="app-input"
                                />
                              </label>
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gap: "6px",
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              <div>
                                Current status:{" "}
                                {getUptimeStatusLabel(dashboardUptime)}
                              </div>
                              <div>
                                Last checked:{" "}
                                {formatDate(
                                  dashboardUptime?.lastCheckedAt ?? null,
                                )}
                              </div>
                              <div>
                                30-day uptime:{" "}
                                {formatUptimePercentage(
                                  dashboardUptime?.uptime30d,
                                )}
                              </div>
                              <div>
                                Response time:{" "}
                                {dashboardUptime?.lastResponseTimeMs == null
                                  ? "N/A"
                                  : `${dashboardUptime.lastResponseTimeMs} ms`}
                              </div>
                              <div>
                                Consecutive failures:{" "}
                                {dashboardUptime?.consecutiveFailures ?? 0}
                              </div>
                            </div>
                            {uptimeError && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--warning)",
                                }}
                              >
                                {uptimeError}
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: "10px",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                onClick={() => void handleSaveUptime()}
                                disabled={
                                  uptimeSaving || !uptimeCheckUrl.trim()
                                }
                                className="primary-button"
                              >
                                {uptimeSaving ? "Saving..." : "Save monitoring"}
                              </button>
                              <button
                                onClick={() => setAppSection("dashboard")}
                                className="ghost-button"
                              >
                                Stay on dashboard
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {hasSites && appSection === "reports" && (
                    <div style={{ display: "grid", gap: "18px" }}>
                      <div className="app-section-heading">
                        <div className="app-section-heading__title">
                          Reports and Scan History
                        </div>
                        <div className="app-section-heading__meta">
                          Review recent runs, open detailed reports, and use the
                          existing results workspace for raw evidence, changes,
                          and fix-queue workflows.
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="primary-button"
                            onClick={handleNewScanAction}
                            disabled={
                              !!selectedSiteId &&
                              (triggeringScan || canCancelRun)
                            }
                          >
                            {triggeringScan ? "Starting..." : "Run scan"}
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() =>
                              setScanWorkspaceOpen((prev) => !prev)
                            }
                          >
                            {scanWorkspaceOpen
                              ? "Hide results workspace"
                              : "Open results workspace"}
                          </button>
                        </div>
                      </div>

                      <div className="app-section-grid">
                        <div className="app-settings-card">
                          <div className="app-settings-card__title">
                            Scan history
                          </div>
                          <div className="app-settings-card__subtitle">
                            Select a run for the workspace or open the final
                            report artifact directly.
                          </div>
                          <div className="app-site-list">
                            {history.map((run) => (
                              <div key={run.id} className="app-site-row">
                                <div>
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: "14px",
                                    }}
                                  >
                                    {formatRelative(run.started_at)}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    {run.status.replace("_", " ")} · Checked{" "}
                                    {run.checked_links}/{run.total_links} ·
                                    Broken {run.broken_links}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    className="secondary-button"
                                    onClick={() => {
                                      void handleSelectRunForWorkspace(run);
                                      setScanWorkspaceOpen(true);
                                    }}
                                  >
                                    Open workspace
                                  </button>
                                  <button
                                    className="ghost-button"
                                    disabled={run.status !== "completed"}
                                    onClick={() => openReport(run.id)}
                                  >
                                    View report
                                  </button>
                                </div>
                              </div>
                            ))}
                            {history.length === 0 && !historyLoading && (
                              <div
                                style={{
                                  color: "var(--muted)",
                                  fontSize: "13px",
                                }}
                              >
                                No scans yet.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="app-settings-card">
                          <div className="app-settings-card__title">
                            Current report context
                          </div>
                          <div className="app-settings-card__subtitle">
                            Keep the dashboard focused on health. Use this area
                            when you need deeper evidence and detailed scan
                            operations.
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "10px",
                              fontSize: "13px",
                            }}
                          >
                            <StatusBadge
                              label={`Selected run ${selectedRun ? formatRelative(selectedRun.started_at) : "none"}`}
                              tone="default"
                            />
                            <StatusBadge
                              label={`Workspace ${scanWorkspaceOpen ? "open" : "hidden"}`}
                              tone="accent"
                            />
                            <div style={{ color: "var(--muted)" }}>
                              {selectedRun
                                ? `Current status: ${selectedRun.status.replace("_", " ")} · ${selectedRun.checked_links}/${selectedRun.total_links} links checked`
                                : "Select a run to load results, changes, or fix queue data."}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasSites && appSection === "schedule" && (
                    <div className="app-settings-card">
                      <div className="app-settings-card__title">
                        Schedule Settings
                      </div>
                      <div className="app-settings-card__subtitle">
                        Configure recurring scans without keeping schedules
                        pinned in a permanent sidebar.
                      </div>
                      {!selectedSite ? (
                        <div
                          style={{ fontSize: "13px", color: "var(--muted)" }}
                        >
                          Select a site to configure auto-scans.
                        </div>
                      ) : (
                        <div className="app-form-grid">
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              fontSize: "13px",
                            }}
                          >
                            <span>Auto-scan enabled</span>
                            <input
                              type="checkbox"
                              checked={
                                scheduleFrequency === "manual"
                                  ? false
                                  : scheduleEnabled
                              }
                              onChange={(e) =>
                                setScheduleEnabled(e.target.checked)
                              }
                              disabled={scheduleFrequency === "manual"}
                            />
                          </label>
                          <div className="app-form-grid app-form-grid--two">
                            <label className="field-label">
                              Frequency
                              <select
                                value={scheduleFrequency}
                                onChange={(e) => {
                                  const nextFrequency = e.target.value as
                                    | "manual"
                                    | "daily"
                                    | "weekly"
                                    | "monthly";
                                  setScheduleFrequency(nextFrequency);
                                  if (nextFrequency === "manual") {
                                    setScheduleEnabled(false);
                                  }
                                }}
                                className="app-input"
                              >
                                <option value="manual">Manual</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                              </select>
                            </label>
                            <label className="field-label">
                              Time (UTC)
                              <input
                                type="time"
                                value={scheduleTimeUtc}
                                onChange={(e) =>
                                  setScheduleTimeUtc(e.target.value)
                                }
                                className="app-input"
                              />
                            </label>
                            {scheduleFrequency === "weekly" && (
                              <label className="field-label">
                                Day of week (UTC)
                                <select
                                  value={scheduleDayOfWeek}
                                  onChange={(e) =>
                                    setScheduleDayOfWeek(Number(e.target.value))
                                  }
                                  className="app-input"
                                >
                                  <option value={0}>Sunday</option>
                                  <option value={1}>Monday</option>
                                  <option value={2}>Tuesday</option>
                                  <option value={3}>Wednesday</option>
                                  <option value={4}>Thursday</option>
                                  <option value={5}>Friday</option>
                                  <option value={6}>Saturday</option>
                                </select>
                              </label>
                            )}
                            {scheduleFrequency === "monthly" && (
                              <label className="field-label">
                                Day of month (UTC)
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  value={scheduleDayOfMonth}
                                  onChange={(e) =>
                                    setScheduleDayOfMonth(
                                      Math.min(
                                        31,
                                        Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      ),
                                    )
                                  }
                                  className="app-input"
                                />
                              </label>
                            )}
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gap: "6px",
                              fontSize: "12px",
                              color: "var(--muted)",
                            }}
                          >
                            <div>
                              Time (UTC):{" "}
                              {formatScheduleUtcLabel(
                                scheduleFrequency,
                                scheduleTimeUtc,
                                scheduleDayOfWeek,
                                scheduleDayOfMonth,
                              )}
                            </div>
                            {showLocalTimeZone && (
                              <div>
                                Your time:{" "}
                                {formatScheduleLocalLabel(
                                  scheduleFrequency,
                                  scheduleTimeUtc,
                                  scheduleDayOfWeek,
                                  scheduleDayOfMonth,
                                )}{" "}
                                ({localTimeZone})
                              </div>
                            )}
                            <div>
                              Next run (UTC):{" "}
                              {formatUtcDateTime(
                                selectedSite.next_scheduled_at,
                              )}
                            </div>
                            {showLocalTimeZone && (
                              <div>
                                Next run (local):{" "}
                                {formatLocalDateTime(
                                  selectedSite.next_scheduled_at,
                                )}{" "}
                                ({localTimeZone})
                              </div>
                            )}
                            <div>
                              Last scheduled run:{" "}
                              {formatDate(selectedSite.last_scheduled_at)}
                            </div>
                          </div>
                          {scheduleError && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--warning)",
                              }}
                            >
                              {scheduleError}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => void handleSaveSchedule()}
                              disabled={scheduleSaving}
                              className="primary-button"
                            >
                              {scheduleSaving ? "Saving..." : "Save schedule"}
                            </button>
                            <button
                              onClick={() => setAppSection("dashboard")}
                              className="ghost-button"
                            >
                              Back to dashboard
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {hasSites && appSection === "alerts" && (
                    <div className="app-settings-card">
                      <div className="app-settings-card__title">
                        Alert Settings
                      </div>
                      <div className="app-settings-card__subtitle">
                        Manage email alerts, delivery triggers, summaries, and
                        test sends as a dedicated panel.
                      </div>
                      {!selectedSite ? (
                        <div
                          style={{ fontSize: "13px", color: "var(--muted)" }}
                        >
                          Select a site to configure notifications.
                        </div>
                      ) : (
                        <div className="app-form-grid">
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "10px",
                              fontSize: "13px",
                            }}
                          >
                            <span>Email alerts</span>
                            <input
                              type="checkbox"
                              checked={notifyEnabled}
                              disabled={notifyLoading}
                              onChange={(e) =>
                                setNotifyEnabled(e.target.checked)
                              }
                            />
                          </label>
                          <div className="app-form-grid app-form-grid--two">
                            <label className="field-label">
                              Email address
                              <input
                                type="email"
                                value={notifyEmail}
                                onChange={(e) => setNotifyEmail(e.target.value)}
                                placeholder="you@example.com"
                                disabled={notifyLoading}
                                className="app-input"
                              />
                            </label>
                            <label className="field-label">
                              Notify on
                              <select
                                value={notifyOn}
                                onChange={(e) =>
                                  setNotifyOn(e.target.value as NotifyOnOption)
                                }
                                disabled={notifyLoading}
                                className="app-input"
                              >
                                <option value="new_issues_only">
                                  Only when NEW issues appear
                                </option>
                                <option value="issues_exist">
                                  Only when issues exist
                                </option>
                                <option value="always">Always</option>
                                <option value="never">Never</option>
                              </select>
                            </label>
                          </div>
                          <label
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={notifyIncludeCsv}
                              onChange={(e) =>
                                setNotifyIncludeCsv(e.target.checked)
                              }
                              disabled={notifyLoading}
                            />
                            Include CSV attachment (coming soon)
                          </label>
                          <label
                            style={{
                              display: "flex",
                              gap: "8px",
                              alignItems: "center",
                              fontSize: "13px",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={summaryEnabled}
                              onChange={(e) =>
                                setSummaryEnabled(e.target.checked)
                              }
                              disabled={notifyLoading}
                            />
                            Weekly summary
                          </label>
                          {notifyLoading && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Loading notification settings...
                            </div>
                          )}
                          {notifyError && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--warning)",
                              }}
                            >
                              {notifyError}
                            </div>
                          )}
                          <div
                            style={{
                              display: "flex",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              onClick={() => void handleSaveNotifications()}
                              disabled={
                                notifySaving ||
                                notifyLoading ||
                                (notifyEnabled &&
                                  notifyOn !== "never" &&
                                  !notifyEmail.trim())
                              }
                              className="primary-button"
                            >
                              {notifySaving ? "Saving..." : "Save alerts"}
                            </button>
                            <button
                              onClick={() => void handleSendTestEmail()}
                              disabled={
                                notifyTestSending ||
                                !notifyEmail.trim() ||
                                !notifyEnabled ||
                                notifyOn === "never" ||
                                notifyLoading
                              }
                              className="secondary-button"
                            >
                              {notifyTestSending
                                ? "Sending..."
                                : "Send test alert"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {hasSites && appSection === "ignore_rules" && (
                    <div className="app-settings-card">
                      <div className="app-settings-card__title">
                        Ignore Rules
                      </div>
                      <div className="app-settings-card__subtitle">
                        Manage site and global ignore rules as a dashboard tool
                        instead of permanent sidebar clutter.
                      </div>
                      <div
                        className="app-form-grid app-form-grid--two"
                        style={{ alignItems: "end" }}
                      >
                        <label className="field-label">
                          Scope
                          <select
                            value={newRuleScope}
                            onChange={(e) =>
                              setNewRuleScope(
                                e.target.value as "site" | "global",
                              )
                            }
                            className="app-input"
                          >
                            <option value="site">This site</option>
                            <option value="global">Global</option>
                          </select>
                        </label>
                        <label className="field-label">
                          Rule type
                          <select
                            value={newRuleType}
                            onChange={(e) =>
                              setNewRuleType(
                                e.target.value as IgnoreRule["rule_type"],
                              )
                            }
                            className="app-input"
                          >
                            <option value="domain">domain</option>
                            <option value="path_prefix">path_prefix</option>
                            <option value="regex">regex</option>
                            <option value="status_code">status_code</option>
                          </select>
                        </label>
                      </div>
                      <label className="field-label">
                        Pattern
                        <input
                          value={newRulePattern}
                          onChange={(e) => setNewRulePattern(e.target.value)}
                          placeholder="Pattern (e.g. walkers.co.uk, /login, 404)"
                          className="app-input"
                        />
                      </label>
                      <button
                        onClick={handleCreateIgnoreRule}
                        disabled={!selectedSiteId || !newRulePattern.trim()}
                        className="primary-button"
                      >
                        Add rule
                      </button>
                      {ignoreRulesError && (
                        <div
                          style={{ fontSize: "12px", color: "var(--warning)" }}
                        >
                          {ignoreRulesError}
                        </div>
                      )}
                      {!ignoreRulesLoading && ignoreRules.length > 0 && (
                        <div className="app-site-list">
                          {ignoreRules.map((rule) => (
                            <div key={rule.id} className="app-site-row">
                              <div>
                                <div
                                  style={{ fontSize: "13px", fontWeight: 700 }}
                                >
                                  {rule.rule_type}{" "}
                                  {rule.site_id ? "" : "· global"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--muted)",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {rule.pattern}
                                </div>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  onClick={() => handleToggleIgnoreRule(rule)}
                                  className="secondary-button"
                                >
                                  {rule.is_enabled ? "Enabled" : "Disabled"}
                                </button>
                                <button
                                  onClick={() => handleDeleteIgnoreRule(rule)}
                                  className="ghost-button"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {ignoreRulesLoading && (
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Loading rules…
                        </div>
                      )}
                      {!ignoreRulesLoading && ignoreRules.length === 0 && (
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          No ignore rules yet.
                        </div>
                      )}
                    </div>
                  )}

                  {hasSites && appSection === "sites" && (
                    <div className="app-settings-card">
                      <div className="app-settings-card__title">Sites</div>
                      <div className="app-settings-card__subtitle">
                        Select the active site, add new monitored sites, or
                        remove old ones from the workspace.
                      </div>
                      <div className="app-site-list">
                        {sites.map((site) => {
                          const isSelected = site.id === selectedSiteId;
                          const isDeleting = deletingSiteId === site.id;
                          return (
                            <div key={site.id} className="app-site-row">
                              <button
                                onClick={() => void handleSelectSite(site)}
                                style={{
                                  textAlign: "left",
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--text)",
                                  cursor: "pointer",
                                  padding: 0,
                                }}
                              >
                                <div
                                  style={{ fontWeight: 700, fontSize: "14px" }}
                                >
                                  {siteNameById[site.id] ?? site.url}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--muted)",
                                  }}
                                >
                                  {site.url}
                                </div>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--muted)",
                                  }}
                                >
                                  Created {formatDate(site.created_at)}
                                </div>
                              </button>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  className={
                                    isSelected
                                      ? "primary-button"
                                      : "secondary-button"
                                  }
                                  onClick={() => void handleSelectSite(site)}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </button>
                                <button
                                  onClick={() => handleDeleteSite(site.id)}
                                  disabled={isDeleting}
                                  className="ghost-button"
                                  style={{ color: "var(--danger)" }}
                                >
                                  {isDeleting ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {hasSites && appSection === "reports" && scanWorkspaceOpen && (
                  <div ref={scansRef} className="card" style={{ padding: "0" }}>
                    {showProgress && selectedRun && (
                      <div
                        style={{
                          padding: "16px 16px 0 16px",
                          display: "flex",
                          gap: "12px",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: "240px" }}>
                          <ScanProgressBar
                            status={
                              progressPhase === "completed"
                                ? "completed"
                                : selectedRun.status
                            }
                            totalLinks={selectedRun.total_links}
                            checkedLinks={selectedRun.checked_links}
                            brokenLinks={phase0BrokenCount}
                            blockedLinks={phase0BlockedCount}
                            noResponseLinks={phase0NoResponseCount}
                            lastUpdateAt={lastProgressAt ?? null}
                          />
                        </div>
                        {canCancelRun && (
                          <button
                            onClick={handleCancelScan}
                            style={{
                              padding: "10px 14px",
                              borderRadius: "10px",
                              border: "1px solid var(--danger)",
                              background: "var(--danger)",
                              color: "white",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Cancel scan
                          </button>
                        )}
                      </div>
                    )}
                    {!showProgress && (
                      <div style={{ padding: "16px 16px 0 16px" }} />
                    )}
                    <div
                      style={{
                        padding: "16px",
                        borderBottom: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {runHeadingText}
                          </div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            {selectedRun
                              ? `Started ${formatRelative(selectedRun.started_at)}`
                              : "No scans yet"}
                          </div>
                        </div>
                        {selectedRun && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                            }}
                          >
                            <span
                              className={`status-chip run-status ${runStatusTone(
                                selectedRun.status,
                              )}`}
                            >
                              {selectedRun.status.replace("_", " ")}
                            </span>
                            {selectedRun.status === "completed" && (
                              <button
                                onClick={() => openReport(selectedRun.id)}
                                className="report-button"
                              >
                                View report
                              </button>
                            )}
                            {(canRetryRun || canRescan) && (
                              <button
                                onClick={() => {
                                  if (canRescan) {
                                    void handleRunScan();
                                  } else {
                                    void handleRetryScan();
                                  }
                                }}
                                className="report-button"
                                disabled={
                                  (canRescan &&
                                    (!selectedSiteId || triggeringScan)) ||
                                  (!canRescan && !canRetryRun)
                                }
                              >
                                Retry scan
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {selectedRun && (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "16px",
                            fontSize: "12px",
                            color: "var(--muted)",
                          }}
                        >
                          <span>
                            Duration{" "}
                            {formatDuration(
                              selectedRun.started_at,
                              selectedRun.finished_at,
                            )}
                          </span>
                          <span>
                            Finished{" "}
                            {formatDate(selectedRun.finished_at ?? null)}
                          </span>
                          {selectedRun.error_message && (
                            <span style={{ color: "var(--warning)" }}>
                              {selectedRun.error_message}
                            </span>
                          )}
                        </div>
                      )}
                      {selectedRun && (
                        <div
                          style={{
                            paddingTop: "10px",
                            borderTop: "1px solid var(--border)",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "12px",
                            fontSize: "12px",
                            color: "var(--muted)",
                          }}
                        >
                          <span
                            style={{ fontWeight: 600, color: "var(--text)" }}
                          >
                            Technical diagnostics
                          </span>
                          <span>
                            Status {selectedRun.status.replace("_", " ")}
                          </span>
                          <span>
                            Started {formatDate(selectedRun.started_at)}
                          </span>
                          <span>
                            Finished{" "}
                            {formatDate(selectedRun.finished_at ?? null)}
                          </span>
                          <span>
                            Duration{" "}
                            {formatDuration(
                              selectedRun.started_at,
                              selectedRun.finished_at,
                            )}
                          </span>
                          <span>Pages crawled not tracked</span>
                          <span>
                            Links checked {selectedRun.checked_links}/
                            {selectedRun.total_links}
                          </span>
                          <span>Broken {phase0BrokenCount}</span>
                          <span>Blocked {phase0BlockedCount}</span>
                          <span>No response {phase0NoResponseCount}</span>
                          <span>
                            Ignored/skipped {phase0IgnoredSkippedCount}
                          </span>
                          <span>
                            {formatSeoDiagnostics(
                              currentPhase0Diagnostics?.seoBasic,
                            )}
                          </span>
                          <span>
                            {formatRobotsDiagnostics(
                              currentPhase0Diagnostics?.robots,
                            )}
                          </span>
                          <span>
                            {formatSitemapDiagnostics(
                              currentPhase0Diagnostics?.sitemap,
                            )}
                          </span>
                          <span>
                            {formatSslDiagnostics(
                              currentPhase0Diagnostics?.sslHttps,
                            )}
                          </span>
                          <span>
                            {formatSecurityHeaderDiagnostics(
                              currentPhase0Diagnostics?.securityHeader,
                            )}
                          </span>
                          <span>
                            {formatPerformanceDiagnostics(
                              currentPhase0Diagnostics?.performanceBasic,
                            )}
                          </span>
                          <span>Limits hit not tracked</span>
                          {phase0DiagnosticsLoading && (
                            <span>Refreshing...</span>
                          )}
                          {currentPhase0Diagnostics?.loadedAt && (
                            <span>
                              Diagnostics{" "}
                              {formatRelative(
                                new Date(
                                  currentPhase0Diagnostics.loadedAt,
                                ).toISOString(),
                              )}
                            </span>
                          )}
                          {selectedRun.error_message && (
                            <span style={{ color: "var(--warning)" }}>
                              Failure reason {selectedRun.error_message}
                            </span>
                          )}
                          {currentPhase0Diagnostics?.error && (
                            <span style={{ color: "var(--warning)" }}>
                              Diagnostics error {currentPhase0Diagnostics.error}
                            </span>
                          )}
                        </div>
                      )}
                      {selectedRun && diffBaselineRun && diffSummary && (
                        <div
                          style={{
                            paddingTop: "10px",
                            borderTop: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            fontSize: "12px",
                          }}
                        >
                          <span style={{ color: "var(--muted)" }}>
                            Compared to{" "}
                            {formatRelative(diffBaselineRun.started_at)} ·{" "}
                            {formatDate(diffBaselineRun.started_at)}
                          </span>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "12px",
                              color: "var(--text)",
                              fontWeight: 600,
                            }}
                          >
                            <span>New issues {diffSummary.newIssues}</span>
                            <span>Fixed {diffSummary.fixedIssues}</span>
                            <span>Changed {diffSummary.changed}</span>
                            <span>
                              Outstanding issues {diffSummary.outstandingIssues}
                            </span>
                            {!diffIssuesOnly && <span>OK {diffOkTotal}</span>}
                            {!diffIssuesOnly && (
                              <span>Added {diffSummary.added}</span>
                            )}
                            {!diffIssuesOnly && (
                              <span>Removed {diffSummary.removed}</span>
                            )}
                          </div>
                          {!hasDiffChanges && (
                            <span style={{ color: "var(--muted)" }}>
                              {diffIssuesOnly
                                ? "No issue changes since last run."
                                : "No changes since last run."}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!selectedRunId && (
                      <div style={{ padding: "16px" }}>
                        <div
                          style={{
                            padding: "20px",
                            borderRadius: "12px",
                            border: "1px dashed var(--border)",
                            textAlign: "center",
                            color: "var(--muted)",
                          }}
                        >
                          Select a scan run to explore results, or start a new
                          scan from the site panel.
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: "12px" }}>
                      <div className="results-summary">
                        <div className="results-summary__top">
                          {!isSelectedRunInProgress && (
                            <div className="results-summary__stats">
                              {resultsView === "changes" ? (
                                diffLoading ? (
                                  <div
                                    className="skeleton"
                                    style={{ height: "16px", width: "240px" }}
                                  />
                                ) : diffBaselineRun ? (
                                  <>
                                    Comparing to{" "}
                                    {formatRelative(diffBaselineRun.started_at)}{" "}
                                    · {formatDate(diffBaselineRun.started_at)}
                                  </>
                                ) : (
                                  "No previous scan to compare yet."
                                )
                              ) : resultsView === "fix_queue" ? (
                                fixQueueUnavailableReason ? (
                                  fixQueueUnavailableReason
                                ) : fixQueueSummary ? (
                                  <>
                                    New {fixQueueSummary.newIssues} •
                                    Outstanding{" "}
                                    {fixQueueSummary.outstandingIssues} • Total{" "}
                                    {fixQueueSummary.totalQueueItems}
                                  </>
                                ) : fixQueueLoading ? (
                                  <div
                                    className="skeleton"
                                    style={{ height: "16px", width: "260px" }}
                                  />
                                ) : (
                                  "No fix queue items yet."
                                )
                              ) : resultsLoading ? (
                                <div
                                  className="skeleton"
                                  style={{ height: "16px", width: "260px" }}
                                />
                              ) : (
                                <>
                                  Checked {selectedRun?.checked_links ?? 0} /{" "}
                                  {selectedRun?.total_links ?? 0} • Broken{" "}
                                  {phase0BrokenCount} • Blocked{" "}
                                  {phase0BlockedCount} • No response{" "}
                                  {phase0NoResponseCount} • Ignored/skipped{" "}
                                  {phase0IgnoredSkippedCount}
                                </>
                              )}
                            </div>
                          )}
                          {hasActiveFilters && (
                            <span className="results-summary__chip">
                              Filters active
                              <button
                                onClick={() => {
                                  setStatusFilters({});
                                  setMinOccurrencesOnly(false);
                                  setSearchQuery("");
                                  setActiveTab("all");
                                  setStatusGroup("all");
                                  setShowIgnored(false);
                                }}
                                className="report-button"
                                style={{ padding: "2px 8px" }}
                              >
                                Clear
                              </button>
                            </span>
                          )}
                        </div>
                        <div className="results-summary__controls">
                          <div className="results-tabs">
                            <button
                              className={`tab-pill ${resultsView === "results" ? "active" : ""}`}
                              onClick={() => setResultsView("results")}
                            >
                              Results
                            </button>
                            <button
                              className={`tab-pill ${resultsView === "changes" ? "active" : ""}`}
                              onClick={() => setResultsView("changes")}
                            >
                              Changes
                            </button>
                            <button
                              className={`tab-pill ${resultsView === "fix_queue" ? "active" : ""}`}
                              onClick={() => setResultsView("fix_queue")}
                            >
                              Fix Queue
                            </button>
                            {resultsView === "results" &&
                              (
                                [
                                  "all",
                                  "broken",
                                  "blocked",
                                  "no_response",
                                  "ok",
                                  "ignored",
                                ] as const
                              ).map((tab) => (
                                <button
                                  key={tab}
                                  className={`tab-pill ${activeTab === tab ? "active" : ""}`}
                                  onClick={() => setActiveTab(tab)}
                                >
                                  {tab === "ok"
                                    ? "OK"
                                    : tab === "no_response"
                                      ? "No response"
                                      : tab === "ignored"
                                        ? "Ignored"
                                        : tab[0].toUpperCase() + tab.slice(1)}
                                </button>
                              ))}
                          </div>
                          <div className="results-controls">
                            {resultsView === "results" ? (
                              <>
                                <div
                                  className="filter-dropdown"
                                  ref={filterDropdownRef}
                                >
                                  <button
                                    onClick={() =>
                                      setFiltersOpen((prev) => !prev)
                                    }
                                    className={`tab-pill ${hasActiveFilters ? "active" : ""}`}
                                  >
                                    Filters {filtersOpen ? "▴" : "▾"}
                                  </button>
                                  {filtersOpen && (
                                    <div className="filter-dropdown__panel">
                                      <div className="filter-row">
                                        {(
                                          [
                                            "all",
                                            "http_error",
                                            "no_response",
                                          ] as const
                                        ).map((group) => (
                                          <button
                                            key={group}
                                            onClick={() =>
                                              setStatusGroup(group)
                                            }
                                            className={`tab-pill ${statusGroup === group ? "active" : ""}`}
                                          >
                                            {group === "all"
                                              ? "All responses"
                                              : group === "http_error"
                                                ? "HTTP response"
                                                : "No response"}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="filter-row">
                                        {["401/403/429", "404", "5xx"].map(
                                          (key) => (
                                            <button
                                              key={key}
                                              onClick={() =>
                                                toggleStatusFilter(key)
                                              }
                                              className={`tab-pill ${statusFilters[key] ? "active" : ""}`}
                                            >
                                              {key}
                                            </button>
                                          ),
                                        )}
                                        <button
                                          onClick={() =>
                                            toggleStatusFilter("no_response")
                                          }
                                          className={`tab-pill ${statusFilters.no_response ? "active" : ""}`}
                                        >
                                          No response
                                        </button>
                                        <button
                                          onClick={() =>
                                            setMinOccurrencesOnly(
                                              (prev) => !prev,
                                            )
                                          }
                                          className={`tab-pill ${minOccurrencesOnly ? "active" : ""}`}
                                        >
                                          Occurrences &gt; 1
                                        </button>
                                        <button
                                          onClick={() =>
                                            setShowIgnored((prev) => !prev)
                                          }
                                          className={`tab-pill ${showIgnored ? "active" : ""}`}
                                        >
                                          {showIgnored
                                            ? "Showing ignored"
                                            : "Show ignored"}
                                        </button>
                                      </div>
                                      <div className="filter-row">
                                        <button
                                          onClick={() => {
                                            setStatusFilters({});
                                            setMinOccurrencesOnly(false);
                                            setSearchQuery("");
                                            setActiveTab("all");
                                            setStatusGroup("all");
                                            setShowIgnored(false);
                                          }}
                                          className="tab-pill"
                                        >
                                          Reset filters
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <input
                                  ref={searchInputRef}
                                  value={searchQuery}
                                  onChange={(e) =>
                                    setSearchQuery(e.target.value)
                                  }
                                  placeholder="Search links"
                                  style={{ width: "200px" }}
                                />
                                <select
                                  value={sortOption}
                                  onChange={(e) =>
                                    setSortOption(
                                      e.target.value as typeof sortOption,
                                    )
                                  }
                                >
                                  <option value="severity">Severity</option>
                                  <option value="occ_desc">
                                    Most occurrences
                                  </option>
                                  <option value="status_desc">
                                    Status code
                                  </option>
                                  <option value="recent">Recently seen</option>
                                </select>
                                {isSelectedRunInProgress && (
                                  <span
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    Updating…
                                  </span>
                                )}
                                <button
                                  onClick={() => setHistoryOpen(true)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  History
                                </button>
                                <div
                                  ref={exportMenuRef}
                                  style={{ position: "relative" }}
                                >
                                  <button
                                    onClick={() =>
                                      setExportMenuOpen((prev) => !prev)
                                    }
                                    disabled={exportDisabled}
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: "999px",
                                      border: "1px solid var(--border)",
                                      background: "var(--panel)",
                                      color: "var(--text)",
                                      cursor: exportDisabled
                                        ? "not-allowed"
                                        : "pointer",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Export
                                  </button>
                                  {exportMenuOpen && !exportDisabled && (
                                    <div
                                      className="export-menu"
                                      style={{
                                        position: "absolute",
                                        right: 0,
                                        top: "calc(100% + 6px)",
                                        background: "var(--panel)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "12px",
                                        boxShadow: "var(--shadow)",
                                        padding: "6px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "4px",
                                        minWidth: "180px",
                                        zIndex: 30,
                                      }}
                                    >
                                      <button
                                        onClick={() => triggerExport("csv")}
                                        disabled={exportLinksDisabled}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: "10px",
                                          border: "1px solid transparent",
                                          background: "transparent",
                                          textAlign: "left",
                                          cursor: exportLinksDisabled
                                            ? "not-allowed"
                                            : "pointer",
                                          color: "var(--text)",
                                        }}
                                      >
                                        Export CSV (current view)
                                      </button>
                                      <button
                                        onClick={() => triggerExport("json")}
                                        disabled={exportLinksDisabled}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: "10px",
                                          border: "1px solid transparent",
                                          background: "transparent",
                                          textAlign: "left",
                                          cursor: exportLinksDisabled
                                            ? "not-allowed"
                                            : "pointer",
                                          color: "var(--text)",
                                        }}
                                      >
                                        Export JSON (current view)
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (!selectedRunId) return;
                                          openReport(selectedRunId);
                                          setExportMenuOpen(false);
                                        }}
                                        style={{
                                          padding: "8px 10px",
                                          borderRadius: "10px",
                                          border: "1px solid transparent",
                                          background: "transparent",
                                          textAlign: "left",
                                          cursor: "pointer",
                                          color: "var(--text)",
                                        }}
                                      >
                                        Open Report
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : resultsView === "changes" ? (
                              <>
                                <button
                                  onClick={() =>
                                    setDiffIssuesOnly((prev) => !prev)
                                  }
                                  className={`tab-pill ${diffIssuesOnly ? "active" : ""}`}
                                >
                                  Issues only
                                </button>
                                <button
                                  onClick={() => {
                                    setIncludeUnchanged((prev) => !prev);
                                    setUnchangedOnly(false);
                                  }}
                                  className={`tab-pill ${includeUnchanged ? "active" : ""}`}
                                >
                                  Include unchanged
                                </button>
                                <button
                                  onClick={() =>
                                    setDiffIncludeIgnored((prev) => !prev)
                                  }
                                  className={`tab-pill ${diffIncludeIgnored ? "active" : ""}`}
                                >
                                  Include ignored
                                </button>
                                <select
                                  value={diffExportFilter}
                                  onChange={(e) =>
                                    setDiffExportFilter(
                                      e.target.value as typeof diffExportFilter,
                                    )
                                  }
                                  disabled={unchangedOnly}
                                  title={
                                    unchangedOnly
                                      ? "Filters disabled in outstanding-only view"
                                      : undefined
                                  }
                                >
                                  <option value="all">All changes</option>
                                  <option value="new_issue">
                                    New issues only
                                  </option>
                                  <option value="fixed">Fixed only</option>
                                  <option value="changed">Changed only</option>
                                  <option value="added">Added only</option>
                                  <option value="removed">Removed only</option>
                                </select>
                                <button
                                  onClick={exportDiffCsv}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Export CSV
                                </button>
                                <button
                                  onClick={() => setHistoryOpen(true)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  History
                                </button>
                              </>
                            ) : resultsView === "fix_queue" ? (
                              <>
                                <div
                                  className="changes-summary"
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                    padding: "12px 16px 0",
                                  }}
                                >
                                  {fixQueueSummary && (
                                    <>
                                      <span className="summary-chip">
                                        New issues {fixQueueSummary.newIssues}
                                      </span>
                                      <span className="summary-chip">
                                        Outstanding{" "}
                                        {fixQueueSummary.outstandingIssues}
                                      </span>
                                      <span className="summary-chip">
                                        Total {fixQueueSummary.totalQueueItems}
                                      </span>
                                      <span className="summary-chip">
                                        Notes open{" "}
                                        {fixQueueSummary.withNotesOpen}
                                      </span>
                                      <span className="summary-chip">
                                        Snoozed {fixQueueSummary.snoozed}
                                      </span>
                                      <span className="summary-chip">
                                        Resolved {fixQueueSummary.resolved}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {fixQueueData &&
                                  !fixQueueData.baselineRun &&
                                  fixQueueData.currentRun && (
                                    <div
                                      style={{
                                        padding: "10px 12px",
                                        borderRadius: "10px",
                                        border: "1px dashed var(--border)",
                                        color: "var(--muted)",
                                        margin: "12px 16px",
                                      }}
                                    >
                                      No baseline yet. Showing current issues as
                                      outstanding.
                                    </div>
                                  )}
                                <div className="results-header">
                                  <div>Link</div>
                                  <div>Status</div>
                                  <div>Source pages</div>
                                  <div>Actions</div>
                                </div>
                                {fixQueueError && (
                                  <div
                                    style={{
                                      padding: "10px 12px",
                                      borderRadius: "10px",
                                      border: "1px solid var(--border)",
                                      color: "var(--warning)",
                                      margin: "12px 16px",
                                    }}
                                  >
                                    {fixQueueError}
                                  </div>
                                )}
                                {fixQueueUnavailableReason && (
                                  <div
                                    style={{
                                      padding: "20px",
                                      borderRadius: "12px",
                                      border: "1px dashed var(--border)",
                                      textAlign: "center",
                                      color: "var(--muted)",
                                      margin: "12px 16px",
                                    }}
                                  >
                                    {fixQueueUnavailableReason}
                                  </div>
                                )}
                                {fixQueueLoading &&
                                  Array.from({ length: 5 }).map((_, idx) => (
                                    <div key={idx} className="skeleton" />
                                  ))}
                                {!fixQueueUnavailableReason &&
                                  !fixQueueLoading &&
                                  fixQueueItems.length === 0 && (
                                    <div
                                      style={{
                                        padding: "20px",
                                        borderRadius: "12px",
                                        border: "1px dashed var(--border)",
                                        textAlign: "center",
                                        color: "var(--muted)",
                                        margin: "12px 16px",
                                      }}
                                    >
                                      No queue items match these filters.
                                    </div>
                                  )}
                                {fixQueueItems.map(renderFixQueueRow)}
                              </>
                            ) : (
                              <>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    onClick={() => {
                                      setFixQueueIncludeNew(true);
                                      setFixQueueIncludeOutstanding(true);
                                    }}
                                    className={`tab-pill ${fixQueueIncludeNew && fixQueueIncludeOutstanding ? "active" : ""}`}
                                  >
                                    New + Outstanding
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFixQueueIncludeNew(true);
                                      setFixQueueIncludeOutstanding(false);
                                    }}
                                    className={`tab-pill ${fixQueueIncludeNew && !fixQueueIncludeOutstanding ? "active" : ""}`}
                                  >
                                    New only
                                  </button>
                                  <button
                                    onClick={() => {
                                      setFixQueueIncludeNew(false);
                                      setFixQueueIncludeOutstanding(true);
                                    }}
                                    className={`tab-pill ${!fixQueueIncludeNew && fixQueueIncludeOutstanding ? "active" : ""}`}
                                  >
                                    Outstanding only
                                  </button>
                                </div>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  {(
                                    [
                                      "open",
                                      "snoozed",
                                      "resolved",
                                      "all",
                                    ] as const
                                  ).map((status) => (
                                    <button
                                      key={status}
                                      onClick={() => setFixQueueStatus(status)}
                                      className={`tab-pill ${fixQueueStatus === status ? "active" : ""}`}
                                    >
                                      {status === "open"
                                        ? "Open"
                                        : status === "snoozed"
                                          ? "Snoozed"
                                          : status === "resolved"
                                            ? "Resolved"
                                            : "All"}
                                    </button>
                                  ))}
                                </div>
                                <button
                                  onClick={() =>
                                    setFixQueueIncludeIgnored((prev) => !prev)
                                  }
                                  className={`tab-pill ${fixQueueIncludeIgnored ? "active" : ""}`}
                                >
                                  {fixQueueIncludeIgnored
                                    ? "Including ignored"
                                    : "Exclude ignored"}
                                </button>
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--muted)",
                                  }}
                                >
                                  Sorted by severity
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`results-layout ${detailsOpen && !isNarrow ? "drawer-open" : ""}`}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="results-title">
                          <div>
                            <div className="results-title__label">
                              {resultsView === "changes"
                                ? "Changes"
                                : resultsView === "fix_queue"
                                  ? "Fix Queue"
                                  : "Results"}
                            </div>
                            <div className="results-title__meta">
                              Showing {resultsTitleCount}{" "}
                              {resultsView === "changes"
                                ? "change"
                                : resultsView === "fix_queue"
                                  ? "item"
                                  : "link"}
                              {resultsTitleCount === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                        <div className="results-table">
                          <div className="results-scroll">
                            {resultsView === "changes" ? (
                              <>
                                <div
                                  className="changes-summary"
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "8px",
                                    padding: "12px 16px 0",
                                  }}
                                >
                                  {diffSummary && (
                                    <>
                                      <span className="summary-chip">
                                        New issues {diffSummary.newIssues}
                                      </span>
                                      <span className="summary-chip">
                                        Fixed {diffSummary.fixedIssues}
                                      </span>
                                      <span className="summary-chip">
                                        Changed {diffSummary.changed}
                                      </span>
                                      <span className="summary-chip">
                                        Outstanding issues{" "}
                                        {diffSummary.outstandingIssues}
                                      </span>
                                      {!diffIssuesOnly && (
                                        <span className="summary-chip">
                                          OK {diffOkTotal}
                                        </span>
                                      )}
                                      {!diffIssuesOnly && (
                                        <span className="summary-chip">
                                          Added {diffSummary.added}
                                        </span>
                                      )}
                                      {!diffIssuesOnly && (
                                        <span className="summary-chip">
                                          Removed {diffSummary.removed}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="results-header changes-header">
                                  <div>Link</div>
                                  <div>Change</div>
                                  <div>Baseline → Current</div>
                                  <div>Source pages</div>
                                </div>
                                {diffError && (
                                  <div
                                    style={{
                                      padding: "10px 12px",
                                      borderRadius: "10px",
                                      border: "1px solid var(--border)",
                                      color: "var(--warning)",
                                      margin: "12px 16px",
                                    }}
                                  >
                                    {diffError}
                                  </div>
                                )}
                                {diffLoading &&
                                  Array.from({ length: 5 }).map((_, idx) => (
                                    <div key={idx} className="skeleton" />
                                  ))}
                                {!diffLoading && !diffBaselineRun && (
                                  <div
                                    style={{
                                      padding: "20px",
                                      borderRadius: "12px",
                                      border: "1px dashed var(--border)",
                                      textAlign: "center",
                                      color: "var(--muted)",
                                      margin: "12px 16px",
                                    }}
                                  >
                                    <div style={{ marginBottom: "8px" }}>
                                      No previous scan to compare yet. Run
                                      another scan to see changes over time.
                                    </div>
                                    {selectedSiteId && (
                                      <button
                                        onClick={handleRunScan}
                                        disabled={triggeringScan}
                                        style={{
                                          padding: "6px 10px",
                                          borderRadius: "999px",
                                          border: "1px solid var(--border)",
                                          background: "var(--panel)",
                                          fontSize: "12px",
                                          cursor: triggeringScan
                                            ? "not-allowed"
                                            : "pointer",
                                        }}
                                      >
                                        {triggeringScan
                                          ? "Starting..."
                                          : "Run a scan"}
                                      </button>
                                    )}
                                  </div>
                                )}
                                {!diffLoading &&
                                  diffBaselineRun &&
                                  diffChangeItems.length === 0 &&
                                  (!includeUnchanged ||
                                    diffUnchangedItems.length === 0) && (
                                    <div
                                      style={{
                                        padding: "20px",
                                        borderRadius: "12px",
                                        border: "1px dashed var(--border)",
                                        textAlign: "center",
                                        color: "var(--muted)",
                                        margin: "12px 16px",
                                      }}
                                    >
                                      <div style={{ marginBottom: "8px" }}>
                                        No changes match this view.
                                      </div>
                                      {diffIssuesOnly &&
                                        !includeUnchanged &&
                                        (diffSummary?.outstandingIssues ?? 0) >
                                          0 && (
                                          <>
                                            <div
                                              style={{ marginBottom: "8px" }}
                                            >
                                              No new issue changes since the
                                              last scan. You still have{" "}
                                              {diffSummary?.outstandingIssues ??
                                                0}{" "}
                                              outstanding issues.
                                            </div>
                                            <button
                                              onClick={() => {
                                                setIncludeUnchanged(true);
                                                setUnchangedOnly(true);
                                                setUnchangedOffset(0);
                                              }}
                                              style={{
                                                padding: "6px 10px",
                                                borderRadius: "999px",
                                                border:
                                                  "1px solid var(--border)",
                                                background: "var(--panel)",
                                                fontSize: "12px",
                                                cursor: "pointer",
                                              }}
                                            >
                                              Show outstanding issues
                                            </button>
                                          </>
                                        )}
                                    </div>
                                  )}
                                {diffChangeItems.map(renderDiffRow)}
                                {includeUnchanged && (
                                  <div
                                    style={{
                                      padding: "8px 16px 0",
                                      fontSize: "12px",
                                      color: "var(--muted)",
                                      display: "flex",
                                      flexWrap: "wrap",
                                      gap: "8px",
                                      justifyContent: "space-between",
                                    }}
                                  >
                                    <span>
                                      Outstanding (unchanged){" "}
                                      {diffIssuesOnly
                                        ? (diffSummary?.outstandingIssues ?? 0)
                                        : (diffSummary?.outstandingTotal ?? 0)}
                                    </span>
                                    {diffMeta && (
                                      <span>
                                        Showing {diffMeta.unchangedReturned} of{" "}
                                        {diffIssuesOnly
                                          ? (diffSummary?.outstandingIssues ??
                                            0)
                                          : (diffSummary?.outstandingTotal ??
                                            0)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {includeUnchanged &&
                                  diffUnchangedItems.length === 0 && (
                                    <div
                                      style={{
                                        padding: "20px",
                                        borderRadius: "12px",
                                        border: "1px dashed var(--border)",
                                        textAlign: "center",
                                        color: "var(--muted)",
                                        margin: "12px 16px",
                                      }}
                                    >
                                      No unchanged items in this slice.
                                    </div>
                                  )}
                                {includeUnchanged &&
                                  diffUnchangedItems.map(renderDiffRow)}
                              </>
                            ) : (
                              <>
                                <div
                                  className={`results-header ${activeTab === "ignored" ? "single" : ""}`}
                                >
                                  {activeTab === "ignored" ? (
                                    <div>Ignored links</div>
                                  ) : (
                                    <>
                                      <div>Link</div>
                                      <div>Status</div>
                                      <div>Hits</div>
                                      <div>Actions</div>
                                    </>
                                  )}
                                </div>
                                {activeTab !== "ignored" && (
                                  <>
                                    {(activeTab === "broken" ||
                                      activeTab === "blocked") && (
                                      <div
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                          gap: "8px",
                                        }}
                                      >
                                        <div
                                          style={{
                                            fontSize: "12px",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {activeTab === "broken"
                                            ? "Broken links"
                                            : "Blocked links"}
                                        </div>
                                        <button
                                          onClick={() =>
                                            triggerExport("csv", activeTab)
                                          }
                                          disabled={!selectedRunId}
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: "999px",
                                            border: "1px solid var(--border)",
                                            background: "var(--panel)",
                                            fontSize: "11px",
                                            cursor: !selectedRunId
                                              ? "not-allowed"
                                              : "pointer",
                                          }}
                                        >
                                          Export CSV
                                        </button>
                                      </div>
                                    )}
                                    {resultsError && (
                                      <div
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: "10px",
                                          border: "1px solid var(--border)",
                                          color: "var(--warning)",
                                        }}
                                      >
                                        {resultsError}
                                      </div>
                                    )}
                                    {resultsLoading &&
                                      Array.from({ length: 6 }).map(
                                        (_, idx) => (
                                          <div key={idx} className="skeleton" />
                                        ),
                                      )}
                                    {!resultsLoading &&
                                      activeTab === "broken" &&
                                      brokenResults.length === 0 &&
                                      results.length > 0 &&
                                      !hasSecondaryFilters && (
                                        <div
                                          style={{
                                            padding: "20px",
                                            borderRadius: "12px",
                                            border: "1px dashed var(--border)",
                                            textAlign: "center",
                                            color: "var(--muted)",
                                          }}
                                        >
                                          <div style={{ marginBottom: "8px" }}>
                                            All clear. No broken links to fix
                                            right now.
                                          </div>
                                          <div>
                                            Consider enabling schedules and
                                            alerts to stay ahead.
                                          </div>
                                        </div>
                                      )}
                                    {!resultsLoading &&
                                      filteredResults.length === 0 &&
                                      results.length > 0 &&
                                      !(
                                        activeTab === "broken" &&
                                        brokenResults.length === 0 &&
                                        !hasSecondaryFilters
                                      ) && (
                                        <div
                                          style={{
                                            padding: "20px",
                                            borderRadius: "12px",
                                            border: "1px dashed var(--border)",
                                            textAlign: "center",
                                            color: "var(--muted)",
                                          }}
                                        >
                                          <div style={{ marginBottom: "8px" }}>
                                            No results match these filters.
                                          </div>
                                          <button
                                            onClick={() => {
                                              setStatusFilters({});
                                              setMinOccurrencesOnly(false);
                                              setSearchQuery("");
                                              setActiveTab("all");
                                              setStatusGroup("all");
                                              setShowIgnored(false);
                                            }}
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: "999px",
                                              border: "1px solid var(--border)",
                                              background: "var(--panel)",
                                              fontSize: "12px",
                                              cursor: "pointer",
                                            }}
                                          >
                                            Clear filters
                                          </button>
                                        </div>
                                      )}
                                    {!resultsLoading &&
                                      filteredResults.length === 0 &&
                                      results.length === 0 && (
                                        <div
                                          style={{
                                            padding: "20px",
                                            borderRadius: "12px",
                                            border: "1px dashed var(--border)",
                                            textAlign: "center",
                                            color: "var(--muted)",
                                          }}
                                        >
                                          <div style={{ marginBottom: "8px" }}>
                                            No results yet. Run a scan to
                                            populate this list (usually a minute
                                            or two).
                                          </div>
                                          <button
                                            onClick={handleRunScan}
                                            disabled={
                                              !selectedSiteId || triggeringScan
                                            }
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: "999px",
                                              border: "1px solid var(--border)",
                                              background: "var(--panel)",
                                              fontSize: "12px",
                                              cursor:
                                                !selectedSiteId ||
                                                triggeringScan
                                                  ? "not-allowed"
                                                  : "pointer",
                                            }}
                                          >
                                            {triggeringScan
                                              ? "Starting..."
                                              : "Run scan"}
                                          </button>
                                        </div>
                                      )}
                                    {renderLinkRows(filteredResults, (row) => {
                                      if (row.classification === "blocked")
                                        return blockedTheme;
                                      if (row.classification === "ok")
                                        return okTheme;
                                      if (row.classification === "no_response")
                                        return noResponseTheme;
                                      return brokenTheme;
                                    })}
                                  </>
                                )}

                                {activeTab === "ignored" && (
                                  <>
                                    {ignoredError && (
                                      <div
                                        style={{
                                          padding: "10px 12px",
                                          borderRadius: "10px",
                                          border: "1px solid var(--border)",
                                          color: "var(--warning)",
                                        }}
                                      >
                                        {ignoredError}
                                      </div>
                                    )}
                                    {ignoredLoading &&
                                      Array.from({ length: 6 }).map(
                                        (_, idx) => (
                                          <div key={idx} className="skeleton" />
                                        ),
                                      )}
                                    {!ignoredLoading &&
                                      ignoredResults.length === 0 && (
                                        <div
                                          style={{
                                            padding: "20px",
                                            borderRadius: "12px",
                                            border: "1px dashed var(--border)",
                                            textAlign: "center",
                                            color: "var(--muted)",
                                          }}
                                        >
                                          No ignored links yet.
                                        </div>
                                      )}
                                    {ignoredResults.map((row) => {
                                      const isOpen =
                                        !!ignoredOccurrences[row.id];
                                      return (
                                        <div
                                          key={row.id}
                                          className="result-row ignored-row"
                                          style={{
                                            borderRadius: "10px",
                                            border: "1px solid var(--border)",
                                            background: "var(--panel-elev)",
                                            display: "flex",
                                            flexDirection: "column",
                                          }}
                                        >
                                          <div
                                            style={{
                                              padding: "8px 10px",
                                              display: "flex",
                                              gap: "8px",
                                              alignItems: "flex-start",
                                            }}
                                          >
                                            <button
                                              onClick={() =>
                                                selectedRunId &&
                                                toggleIgnoredOccurrences(
                                                  row.id,
                                                  selectedRunId,
                                                )
                                              }
                                              style={{
                                                background: "transparent",
                                                border: "none",
                                                cursor: "pointer",
                                                fontSize: "16px",
                                              }}
                                            >
                                              {isOpen ? "▼" : "▶"}
                                            </button>
                                            <div
                                              style={{ flex: 1, minWidth: 0 }}
                                            >
                                              <div
                                                style={{
                                                  display: "flex",
                                                  gap: "8px",
                                                  alignItems: "center",
                                                  flexWrap: "wrap",
                                                  marginBottom: "6px",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    fontSize: "11px",
                                                    padding: "2px 6px",
                                                    borderRadius: "999px",
                                                    background:
                                                      "var(--chip-bg)",
                                                    color: "var(--chip-text)",
                                                  }}
                                                >
                                                  {row.rule_type
                                                    ? "Ignored by rule"
                                                    : row.error_message?.startsWith(
                                                          "crawl_skipped:",
                                                        )
                                                      ? "Intentionally skipped"
                                                      : "Ignored"}
                                                </span>
                                                {row.rule_type &&
                                                  row.rule_pattern && (
                                                    <span
                                                      style={{
                                                        fontSize: "11px",
                                                        padding: "2px 6px",
                                                        borderRadius: "999px",
                                                        background:
                                                          "var(--panel)",
                                                        color: "var(--muted)",
                                                        border:
                                                          "1px solid var(--border)",
                                                      }}
                                                    >
                                                      {row.rule_type}:{" "}
                                                      {row.rule_pattern}
                                                    </span>
                                                  )}
                                                <span
                                                  style={{
                                                    fontSize: "11px",
                                                    color: "var(--muted)",
                                                  }}
                                                >
                                                  {row.status_code ??
                                                    "No HTTP response"}
                                                </span>
                                                <span
                                                  style={{
                                                    fontSize: "11px",
                                                    color: "var(--muted)",
                                                  }}
                                                >
                                                  {row.occurrence_count}x
                                                </span>
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: "12px",
                                                  color: "var(--text)",
                                                  overflowWrap: "anywhere",
                                                  wordBreak: "break-word",
                                                  whiteSpace: "normal",
                                                }}
                                                title={row.link_url}
                                              >
                                                {row.link_url}
                                              </div>
                                            </div>
                                          </div>
                                          {isOpen && (
                                            <div
                                              className="expand-panel"
                                              style={{
                                                padding: "10px 12px",
                                                margin: "0 12px 12px 34px",
                                                border:
                                                  "1px solid var(--border)",
                                                borderRadius: "10px",
                                                background: "var(--panel)",
                                                boxShadow: "var(--soft-shadow)",
                                              }}
                                            >
                                              {ignoredOccLoading[row.id] && (
                                                <div
                                                  style={{
                                                    fontSize: "12px",
                                                    color: "var(--muted)",
                                                  }}
                                                >
                                                  Loading…
                                                </div>
                                              )}
                                              {ignoredOccError[row.id] && (
                                                <div
                                                  style={{
                                                    fontSize: "12px",
                                                    color: "var(--warning)",
                                                  }}
                                                >
                                                  {ignoredOccError[row.id]}
                                                </div>
                                              )}
                                              {(
                                                ignoredOccurrences[row.id] ?? []
                                              ).map((occ) => (
                                                <div
                                                  key={occ.id}
                                                  style={{
                                                    fontSize: "12px",
                                                    color: "var(--muted)",
                                                    overflowWrap: "anywhere",
                                                  }}
                                                >
                                                  {occ.source_page}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </div>

                        {!isSelectedRunInProgress &&
                          resultsView === "results" && (
                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                gap: "12px",
                                flexWrap: "wrap",
                                justifyContent: "center",
                              }}
                            >
                              {activeTab === "all" &&
                                (brokenHasMore ||
                                  blockedHasMore ||
                                  okHasMore ||
                                  noResponseHasMore) && (
                                  <button
                                    onClick={() =>
                                      selectedRunId &&
                                      loadMoreAllResults(selectedRunId)
                                    }
                                    disabled={resultsLoading}
                                    style={{
                                      padding: "10px 18px",
                                      borderRadius: "999px",
                                      border: "1px solid var(--success)",
                                      background: "var(--success)",
                                      color: "white",
                                      cursor: resultsLoading
                                        ? "default"
                                        : "pointer",
                                      opacity: resultsLoading ? 0.6 : 1,
                                      fontSize: "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {resultsLoading
                                      ? "Loading..."
                                      : "Load More Results"}
                                  </button>
                                )}
                              {activeTab === "broken" && brokenHasMore && (
                                <button
                                  onClick={() =>
                                    selectedRunId &&
                                    loadMoreBrokenResults(selectedRunId)
                                  }
                                  disabled={resultsLoading}
                                  style={{
                                    padding: "10px 18px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--danger)",
                                    background: "var(--danger)",
                                    color: "white",
                                    cursor: resultsLoading
                                      ? "default"
                                      : "pointer",
                                    opacity: resultsLoading ? 0.6 : 1,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {resultsLoading
                                    ? "Loading..."
                                    : "Load More Results"}
                                </button>
                              )}
                              {activeTab === "blocked" && blockedHasMore && (
                                <button
                                  onClick={() =>
                                    selectedRunId &&
                                    loadMoreBlockedResults(selectedRunId)
                                  }
                                  disabled={resultsLoading}
                                  style={{
                                    padding: "10px 18px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--warning)",
                                    background: "var(--warning)",
                                    color: "white",
                                    cursor: resultsLoading
                                      ? "default"
                                      : "pointer",
                                    opacity: resultsLoading ? 0.6 : 1,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {resultsLoading
                                    ? "Loading..."
                                    : "Load More Results"}
                                </button>
                              )}
                              {activeTab === "ok" && okHasMore && (
                                <button
                                  onClick={() =>
                                    selectedRunId &&
                                    loadMoreOkResults(selectedRunId)
                                  }
                                  disabled={resultsLoading}
                                  style={{
                                    padding: "10px 18px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--success)",
                                    background: "var(--success)",
                                    color: "white",
                                    cursor: resultsLoading
                                      ? "default"
                                      : "pointer",
                                    opacity: resultsLoading ? 0.6 : 1,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {resultsLoading
                                    ? "Loading..."
                                    : "Load More Results"}
                                </button>
                              )}
                              {activeTab === "no_response" &&
                                noResponseHasMore && (
                                  <button
                                    onClick={() =>
                                      selectedRunId &&
                                      loadMoreNoResponseResults(selectedRunId)
                                    }
                                    disabled={resultsLoading}
                                    style={{
                                      padding: "10px 18px",
                                      borderRadius: "999px",
                                      border: "1px solid var(--border)",
                                      background: "var(--border)",
                                      color: "var(--text)",
                                      cursor: resultsLoading
                                        ? "default"
                                        : "pointer",
                                      opacity: resultsLoading ? 0.6 : 1,
                                      fontSize: "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {resultsLoading
                                      ? "Loading..."
                                      : "Load More Results"}
                                  </button>
                                )}
                              {activeTab === "ignored" && ignoredHasMore && (
                                <button
                                  onClick={() =>
                                    selectedRunId &&
                                    loadMoreIgnoredResults(selectedRunId)
                                  }
                                  disabled={ignoredLoading}
                                  style={{
                                    padding: "10px 18px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--border)",
                                    background: "var(--panel)",
                                    color: "var(--text)",
                                    cursor: ignoredLoading
                                      ? "default"
                                      : "pointer",
                                    opacity: ignoredLoading ? 0.6 : 1,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {ignoredLoading
                                    ? "Loading..."
                                    : "Load More Results"}
                                </button>
                              )}
                            </div>
                          )}
                        {!isSelectedRunInProgress &&
                          resultsView === "changes" && (
                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                gap: "12px",
                                flexWrap: "wrap",
                                justifyContent: "center",
                              }}
                            >
                              {!unchangedOnly && diffQuery.hasNextPage && (
                                <button
                                  onClick={() => diffQuery.fetchNextPage()}
                                  disabled={diffQuery.isFetchingNextPage}
                                  style={{
                                    padding: "10px 18px",
                                    borderRadius: "999px",
                                    border: "1px solid var(--accent)",
                                    background: "var(--accent)",
                                    color: "white",
                                    cursor: diffQuery.isFetchingNextPage
                                      ? "default"
                                      : "pointer",
                                    opacity: diffQuery.isFetchingNextPage
                                      ? 0.6
                                      : 1,
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {diffQuery.isFetchingNextPage
                                    ? "Loading..."
                                    : "Load more changes"}
                                </button>
                              )}
                              {includeUnchanged && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    onClick={() =>
                                      setUnchangedOffset((prev) =>
                                        Math.max(0, prev - unchangedLimit),
                                      )
                                    }
                                    disabled={!canPrevUnchanged}
                                    style={{
                                      padding: "10px 18px",
                                      borderRadius: "999px",
                                      border: "1px solid var(--border)",
                                      background: "var(--panel)",
                                      color: "var(--text)",
                                      cursor: canPrevUnchanged
                                        ? "pointer"
                                        : "not-allowed",
                                      opacity: canPrevUnchanged ? 1 : 0.6,
                                      fontSize: "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Prev outstanding
                                  </button>
                                  <button
                                    onClick={() =>
                                      setUnchangedOffset(
                                        (prev) => prev + unchangedLimit,
                                      )
                                    }
                                    disabled={!canNextUnchanged}
                                    style={{
                                      padding: "10px 18px",
                                      borderRadius: "999px",
                                      border: "1px solid var(--border)",
                                      background: "var(--panel)",
                                      color: "var(--text)",
                                      cursor: canNextUnchanged
                                        ? "pointer"
                                        : "not-allowed",
                                      opacity: canNextUnchanged ? 1 : 0.6,
                                      fontSize: "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    Next outstanding
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        {!isSelectedRunInProgress &&
                          resultsView === "fix_queue" && (
                            <div
                              style={{
                                marginTop: "12px",
                                display: "flex",
                                gap: "12px",
                                flexWrap: "wrap",
                                justifyContent: "center",
                              }}
                            >
                              <button
                                onClick={() =>
                                  setFixQueueOffset((prev) =>
                                    Math.max(0, prev - fixQueueLimit),
                                  )
                                }
                                disabled={!fixQueueHasPrev}
                                style={{
                                  padding: "10px 18px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                  cursor: fixQueueHasPrev
                                    ? "pointer"
                                    : "not-allowed",
                                  opacity: fixQueueHasPrev ? 1 : 0.6,
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Prev page
                              </button>
                              <button
                                onClick={() =>
                                  setFixQueueOffset(
                                    (prev) => prev + fixQueueLimit,
                                  )
                                }
                                disabled={!fixQueueHasNext}
                                style={{
                                  padding: "10px 18px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                  cursor: fixQueueHasNext
                                    ? "pointer"
                                    : "not-allowed",
                                  opacity: fixQueueHasNext ? 1 : 0.6,
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                Next page
                              </button>
                            </div>
                          )}
                        <div className="results-footer-space" aria-hidden />
                      </div>

                      {detailsOpen && selectedLink && (
                        <aside
                          className={`details-drawer ${isNarrow ? "overlay" : ""}`}
                          ref={detailsDrawerRef}
                          aria-label="Link details drawer"
                        >
                          <div className="drawer-header">
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "12px",
                              }}
                            >
                              <div
                                className="drawer-title"
                                title={selectedLink.link_url}
                              >
                                {selectedLink.link_url}
                              </div>
                              <button
                                ref={detailsCloseRef}
                                onClick={() => {
                                  setDetailsOpen(false);
                                  setDetailsLinkId(null);
                                }}
                                className="icon-button"
                                style={{
                                  borderColor: "var(--border)",
                                  color: "var(--text)",
                                }}
                                aria-label="Close details"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="drawer-actions">
                              <button
                                onClick={() =>
                                  window.open(
                                    selectedLink.link_url,
                                    "_blank",
                                    "noopener,noreferrer",
                                  )
                                }
                                className="report-button"
                              >
                                Open link
                              </button>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    selectedLink.link_url,
                                    `drawer:${selectedLink.id}`,
                                  )
                                }
                                className="report-button"
                              >
                                Copy URL
                              </button>
                              <button
                                onClick={() => handleRecheckLink(selectedLink)}
                                className="report-button"
                                disabled={
                                  selectedLink.ignored ||
                                  recheckLoadingId === selectedLink.id
                                }
                              >
                                {recheckLoadingId === selectedLink.id
                                  ? "Rechecking..."
                                  : "Recheck now"}
                              </button>
                              <button
                                onClick={() =>
                                  handleIgnoreLinkWithUndo(selectedLink)
                                }
                                className="report-button"
                                disabled={selectedLink.ignored}
                              >
                                Ignore link
                              </button>
                            </div>
                            <div className="drawer-chip-row">
                              <span
                                className="status-chip"
                                style={{
                                  background:
                                    selectedLink.status_code == null
                                      ? "var(--border)"
                                      : selectedLink.status_code >= 500
                                        ? "var(--danger)"
                                        : selectedLink.status_code === 404 ||
                                            selectedLink.status_code === 410
                                          ? "var(--danger)"
                                          : selectedLink.status_code === 401 ||
                                              selectedLink.status_code ===
                                                403 ||
                                              selectedLink.status_code === 429
                                            ? "var(--warning)"
                                            : "var(--success)",
                                  color:
                                    selectedLink.status_code == null
                                      ? "var(--muted)"
                                      : "white",
                                }}
                              >
                                {selectedLink.status_code ?? "No response"}
                              </span>
                              <span className="status-chip subtle">
                                {formatClassification(
                                  selectedLink.classification,
                                )}
                              </span>
                              {selectedLink.ignored && (
                                <span className="status-chip subtle">
                                  Ignored
                                </span>
                              )}
                            </div>
                            {selectedLink.error_message && (
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--warning)",
                                }}
                              >
                                {selectedLink.error_message}
                              </div>
                            )}
                          </div>
                          <div className="drawer-body">
                            <div className="drawer-section">
                              <h4>Why this happened</h4>
                              {getWhyDetails(selectedLink).body.map((line) => (
                                <div
                                  key={line}
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--muted)",
                                  }}
                                >
                                  {line}
                                </div>
                              ))}
                            </div>
                            <div className="drawer-section">
                              <h4>Recommended actions</h4>
                              <div className="drawer-actions">
                                <button
                                  className="report-button"
                                  onClick={() =>
                                    handleIgnoreLinkWithUndo(selectedLink)
                                  }
                                  disabled={selectedLink.ignored}
                                >
                                  Ignore exact URL
                                </button>
                                <button
                                  className="report-button"
                                  onClick={() => {
                                    const host = safeHost(
                                      selectedLink.link_url,
                                    );
                                    if (host === "unknown") {
                                      pushToast(
                                        "Invalid URL for domain rule",
                                        "warning",
                                      );
                                      return;
                                    }
                                    void createQuickIgnoreRule("domain", host);
                                  }}
                                  disabled={selectedLink.ignored}
                                >
                                  Ignore domain
                                </button>
                                <button
                                  className="report-button"
                                  onClick={() => {
                                    try {
                                      const url = new URL(
                                        selectedLink.link_url,
                                      );
                                      const prefix = url.pathname || "/";
                                      void createQuickIgnoreRule(
                                        "path_prefix",
                                        prefix,
                                      );
                                    } catch {
                                      pushToast(
                                        "Invalid URL for path rule",
                                        "warning",
                                      );
                                    }
                                  }}
                                  disabled={selectedLink.ignored}
                                >
                                  Ignore path pattern
                                </button>
                              </div>
                            </div>
                            <div className="drawer-section">
                              <h4>Occurrences</h4>
                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "var(--muted)",
                                }}
                              >
                                {selectedOccurrencesTotal} total
                              </div>
                              {selectedOccurrencesError && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--warning)",
                                  }}
                                >
                                  {selectedOccurrencesError}
                                </div>
                              )}
                              {!selectedOccurrencesLoading &&
                                selectedOccurrences.length === 0 && (
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "var(--muted)",
                                    }}
                                  >
                                    No source pages recorded yet.
                                  </div>
                                )}
                              <div className="drawer-list">
                                {showOccurrencesSkeleton &&
                                  Array.from({ length: 3 }).map((_, idx) => (
                                    <div
                                      key={`occ-skeleton-${idx}`}
                                      className="skeleton skeleton--occ"
                                    />
                                  ))}
                                {selectedOccurrences.map((occ) => (
                                  <div key={occ.id} className="drawer-row">
                                    <a
                                      href={occ.source_page}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={occ.source_page}
                                    >
                                      {occ.source_page}
                                    </a>
                                    <button
                                      onClick={() =>
                                        copyToClipboard(
                                          occ.source_page,
                                          `occ:${occ.id}`,
                                        )
                                      }
                                      className="report-button"
                                    >
                                      Copy
                                    </button>
                                  </div>
                                ))}
                                {selectedOccurrencesHasMore && (
                                  <button
                                    onClick={() =>
                                      selectedLink &&
                                      handleLoadMoreOccurrences(selectedLink.id)
                                    }
                                    disabled={selectedOccurrencesLoading}
                                    className="report-button"
                                  >
                                    {selectedOccurrencesLoading
                                      ? "Loading..."
                                      : "Load more occurrences"}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </aside>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>

            {isDrawerOpen && (
              <div
                className="drawer-backdrop"
                onClick={() => setIsDrawerOpen(false)}
              />
            )}
            {detailsOpen && isNarrow && (
              <div
                className="details-overlay"
                onClick={() => {
                  setDetailsOpen(false);
                  setDetailsLinkId(null);
                }}
              />
            )}

            {onboardingOpen && (
              <div className="modal-backdrop">
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                  style={{ maxWidth: "560px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        First-run onboarding
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Step {onboardingStepIndex + 1} of{" "}
                        {onboardingSteps.length}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        completeOnboarding();
                        pushToast("Onboarding skipped", "info");
                      }}
                      className="report-button"
                    >
                      Skip
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      marginTop: "12px",
                    }}
                  >
                    {onboardingSteps.map((step, idx) => (
                      <div
                        key={step}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "999px",
                          border: "1px solid var(--border)",
                          background:
                            idx === onboardingStepIndex
                              ? "var(--panel-elev)"
                              : "transparent",
                          fontSize: "11px",
                          color:
                            idx === onboardingStepIndex
                              ? "var(--text)"
                              : "var(--muted)",
                        }}
                      >
                        {step}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    {onboardingStep === 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            Add your first site
                          </div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Paste a homepage URL to start monitoring.
                          </div>
                        </div>
                        <label
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Site URL
                          <input
                            value={onboardingSiteUrl}
                            onChange={(event) =>
                              setOnboardingSiteUrl(event.target.value)
                            }
                            placeholder="https://example.com"
                            autoFocus
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void handleOnboardingCreateSite();
                              }
                            }}
                            style={{
                              marginTop: "6px",
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              color: "var(--text)",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                        <label
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Site name (optional)
                          <input
                            value={onboardingSiteName}
                            onChange={(event) =>
                              setOnboardingSiteName(event.target.value)
                            }
                            placeholder="Marketing site"
                            style={{
                              marginTop: "6px",
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              color: "var(--text)",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                        {onboardingError && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--warning)",
                            }}
                          >
                            {onboardingError}
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => void handleOnboardingCreateSite()}
                            disabled={
                              onboardingWorking || !onboardingSiteUrl.trim()
                            }
                            style={{
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "none",
                              background: onboardingWorking
                                ? "var(--panel-elev)"
                                : "linear-gradient(135deg, var(--accent), var(--accent-2))",
                              color: "white",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor:
                                onboardingWorking || !onboardingSiteUrl.trim()
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {onboardingWorking ? "Adding..." : "Add site"}
                          </button>
                          <button
                            onClick={() => void handleOnboardingSampleSite()}
                            disabled={onboardingWorking}
                            style={{
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              fontSize: "12px",
                              fontWeight: 600,
                              cursor: onboardingWorking
                                ? "not-allowed"
                                : "pointer",
                            }}
                          >
                            Try sample site
                          </button>
                        </div>
                      </div>
                    )}

                    {onboardingStep === 1 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            Run your first scan
                          </div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Start a scan and watch progress in real time.
                          </div>
                        </div>
                        <button
                          onClick={() => void handleOnboardingRunScan()}
                          disabled={!selectedSiteId || triggeringScan}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "none",
                            background:
                              !selectedSiteId || triggeringScan
                                ? "var(--panel-elev)"
                                : "linear-gradient(135deg, var(--accent), var(--accent-2))",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor:
                              !selectedSiteId || triggeringScan
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          {triggeringScan ? "Starting..." : "Start scan"}
                        </button>
                        {selectedRun && (
                          <div
                            style={{
                              padding: "12px",
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                            }}
                          >
                            <ScanProgressBar
                              status={selectedRun.status}
                              totalLinks={selectedRun.total_links}
                              checkedLinks={selectedRun.checked_links}
                              brokenLinks={phase0BrokenCount}
                              blockedLinks={phase0BlockedCount}
                              noResponseLinks={phase0NoResponseCount}
                              lastUpdateAt={lastProgressAt ?? null}
                            />
                            <div
                              style={{
                                marginTop: "8px",
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Status: {selectedRun.status.replace("_", " ")}
                            </div>
                            {selectedRun.status === "failed" &&
                              selectedRun.error_message && (
                                <div
                                  style={{
                                    marginTop: "6px",
                                    fontSize: "12px",
                                    color: "var(--warning)",
                                  }}
                                >
                                  {selectedRun.error_message}
                                </div>
                              )}
                          </div>
                        )}
                        {selectedRun?.status === "completed" && (
                          <button
                            onClick={() => setOnboardingStep(2)}
                            className="report-button"
                          >
                            Continue
                          </button>
                        )}
                      </div>
                    )}

                    {onboardingStep === 2 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>Review results</div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            See a quick summary and jump into fixes or changes.
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <span className="summary-chip">
                            Broken {phase0BrokenCount}
                          </span>
                          <span className="summary-chip">
                            Blocked {phase0BlockedCount}
                          </span>
                          <span className="summary-chip">
                            No response {phase0NoResponseCount}
                          </span>
                          <span className="summary-chip">
                            OK{" "}
                            {currentPhase0Diagnostics?.ok ??
                              visibleResults.filter(
                                (row) => row.classification === "ok",
                              ).length}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => {
                              openFixQueue();
                            }}
                            className="report-button"
                          >
                            Open Fix Queue
                          </button>
                          <button
                            onClick={() => {
                              setScanWorkspaceOpen(true);
                              setResultsView("changes");
                            }}
                            className="report-button"
                          >
                            View Changes
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={() => setOnboardingStep(1)}
                            className="report-button"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setOnboardingStep(3)}
                            className="report-button"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {onboardingStep === 3 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>Set a schedule</div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Optional. Automate scans to keep checks consistent.
                          </div>
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <span>Auto-scan enabled</span>
                          <input
                            type="checkbox"
                            checked={
                              scheduleFrequency === "manual"
                                ? false
                                : scheduleEnabled
                            }
                            onChange={(event) =>
                              setScheduleEnabled(event.target.checked)
                            }
                            disabled={scheduleFrequency === "manual"}
                          />
                        </label>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: "8px",
                          }}
                        >
                          <label
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Frequency
                            <select
                              value={scheduleFrequency}
                              onChange={(event) => {
                                const nextFrequency = event.target.value as
                                  | "manual"
                                  | "daily"
                                  | "weekly"
                                  | "monthly";
                                setScheduleFrequency(nextFrequency);
                                if (nextFrequency === "manual") {
                                  setScheduleEnabled(false);
                                }
                              }}
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: "var(--panel)",
                                color: "var(--text)",
                              }}
                            >
                              <option value="manual">Manual</option>
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </label>
                          {scheduleFrequency === "weekly" && (
                            <label
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Day of week (UTC)
                              <select
                                value={scheduleDayOfWeek}
                                onChange={(event) =>
                                  setScheduleDayOfWeek(
                                    Number(event.target.value),
                                  )
                                }
                                style={{
                                  marginTop: "6px",
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "10px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                }}
                              >
                                <option value={0}>Sunday</option>
                                <option value={1}>Monday</option>
                                <option value={2}>Tuesday</option>
                                <option value={3}>Wednesday</option>
                                <option value={4}>Thursday</option>
                                <option value={5}>Friday</option>
                                <option value={6}>Saturday</option>
                              </select>
                            </label>
                          )}
                          {scheduleFrequency === "monthly" && (
                            <label
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                              }}
                            >
                              Day of month (UTC)
                              <input
                                type="number"
                                min={1}
                                max={31}
                                value={scheduleDayOfMonth}
                                onChange={(event) =>
                                  setScheduleDayOfMonth(
                                    Math.min(
                                      31,
                                      Math.max(
                                        1,
                                        Number(event.target.value) || 1,
                                      ),
                                    ),
                                  )
                                }
                                style={{
                                  marginTop: "6px",
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: "10px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                }}
                              />
                            </label>
                          )}
                          <label
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Time (UTC)
                            <input
                              type="time"
                              value={scheduleTimeUtc}
                              onChange={(event) =>
                                setScheduleTimeUtc(event.target.value)
                              }
                              style={{
                                marginTop: "6px",
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: "10px",
                                border: "1px solid var(--border)",
                                background: "var(--panel)",
                                color: "var(--text)",
                              }}
                            />
                          </label>
                        </div>
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Time (UTC):{" "}
                          {formatScheduleUtcLabel(
                            scheduleFrequency,
                            scheduleTimeUtc,
                            scheduleDayOfWeek,
                            scheduleDayOfMonth,
                          )}
                        </div>
                        {showLocalTimeZone && (
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Your time:{" "}
                            {formatScheduleLocalLabel(
                              scheduleFrequency,
                              scheduleTimeUtc,
                              scheduleDayOfWeek,
                              scheduleDayOfMonth,
                            )}{" "}
                            ({localTimeZone})
                          </div>
                        )}
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => void handleSaveSchedule()}
                            disabled={scheduleSaving}
                            className="report-button"
                          >
                            {scheduleSaving ? "Saving..." : "Save schedule"}
                          </button>
                          <button
                            onClick={() => setOnboardingStep(4)}
                            className="report-button"
                          >
                            Skip for now
                          </button>
                        </div>
                      </div>
                    )}

                    {onboardingStep === 4 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>Enable alerts</div>
                          <div
                            style={{ fontSize: "12px", color: "var(--muted)" }}
                          >
                            Optional. Get notified when new issues appear.
                          </div>
                        </div>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <span>Email alerts</span>
                          <input
                            type="checkbox"
                            checked={notifyEnabled}
                            onChange={(event) =>
                              setNotifyEnabled(event.target.checked)
                            }
                          />
                        </label>
                        <label
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Email (optional)
                          <input
                            value={notifyEmail}
                            onChange={(event) =>
                              setNotifyEmail(event.target.value)
                            }
                            placeholder="you@company.com"
                            style={{
                              marginTop: "6px",
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              color: "var(--text)",
                              boxSizing: "border-box",
                            }}
                          />
                        </label>
                        <label
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Notify me
                          <select
                            value={notifyOn}
                            onChange={(event) =>
                              setNotifyOn(event.target.value as NotifyOnOption)
                            }
                            style={{
                              marginTop: "6px",
                              width: "100%",
                              padding: "6px 8px",
                              borderRadius: "10px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              color: "var(--text)",
                            }}
                          >
                            <option value="new_issues_only">
                              Only when NEW issues
                            </option>
                            <option value="issues_exist">
                              When issues exist
                            </option>
                            <option value="always">Always</option>
                            <option value="never">Never</option>
                          </select>
                        </label>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            fontSize: "12px",
                          }}
                        >
                          <span>Weekly summary</span>
                          <input
                            type="checkbox"
                            checked={summaryEnabled}
                            onChange={(event) =>
                              setSummaryEnabled(event.target.checked)
                            }
                          />
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={() => void handleSaveNotifications()}
                            disabled={
                              notifySaving ||
                              notifyLoading ||
                              (notifyEnabled &&
                                notifyOn !== "never" &&
                                !notifyEmail.trim())
                            }
                            className="report-button"
                          >
                            {notifySaving ? "Saving..." : "Save alerts"}
                          </button>
                          <button
                            onClick={() => void handleSendTestEmail()}
                            disabled={
                              notifyTestSending ||
                              !notifyEmail.trim() ||
                              !notifyEnabled ||
                              notifyOn === "never" ||
                              notifyLoading
                            }
                            className="report-button"
                          >
                            {notifyTestSending
                              ? "Sending..."
                              : "Send test alert"}
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "8px",
                          }}
                        >
                          <button
                            onClick={() => setOnboardingStep(3)}
                            className="report-button"
                          >
                            Back
                          </button>
                          <button
                            onClick={() => setOnboardingStep(5)}
                            className="report-button"
                          >
                            Finish
                          </button>
                        </div>
                      </div>
                    )}

                    {onboardingStep >= onboardingSteps.length && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "12px",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "16px" }}>
                          You're set
                        </div>
                        <div
                          style={{ fontSize: "12px", color: "var(--muted)" }}
                        >
                          Your first scan is ready. Explore the dashboard or
                          keep tuning schedules and alerts anytime.
                        </div>
                        <button
                          onClick={() => {
                            completeOnboarding();
                          }}
                          style={{
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "none",
                            background:
                              "linear-gradient(135deg, var(--accent), var(--accent-2))",
                            color: "white",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Go to dashboard
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {ignoreRulesOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setIgnoreRulesOpen(false)}
              >
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>Ignore rules</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Rules apply to the selected site.
                      </div>
                    </div>
                    <button
                      onClick={() => setIgnoreRulesOpen(false)}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        borderRadius: "10px",
                        padding: "4px 6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <select
                      value={newRuleScope}
                      onChange={(e) =>
                        setNewRuleScope(e.target.value as "site" | "global")
                      }
                      style={{
                        padding: "6px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="site">This site</option>
                      <option value="global">Global</option>
                    </select>
                    <select
                      value={newRuleType}
                      onChange={(e) =>
                        setNewRuleType(
                          e.target.value as IgnoreRule["rule_type"],
                        )
                      }
                      style={{
                        padding: "6px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="domain">domain</option>
                      <option value="path_prefix">path_prefix</option>
                      <option value="regex">regex</option>
                      <option value="status_code">status_code</option>
                    </select>
                    <input
                      value={newRulePattern}
                      onChange={(e) => setNewRulePattern(e.target.value)}
                      placeholder="Pattern (e.g. walkers.co.uk, /login, 404)"
                      style={{
                        flex: 1,
                        minWidth: "220px",
                        padding: "6px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        fontSize: "12px",
                      }}
                    />
                    <button
                      onClick={handleCreateIgnoreRule}
                      disabled={!selectedSiteId || !newRulePattern.trim()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--accent)",
                        color: "white",
                        fontSize: "12px",
                        cursor:
                          !selectedSiteId || !newRulePattern.trim()
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          !selectedSiteId || !newRulePattern.trim() ? 0.6 : 1,
                      }}
                    >
                      Add rule
                    </button>
                  </div>

                  {ignoreRulesError && (
                    <div style={{ fontSize: "12px", color: "var(--warning)" }}>
                      {ignoreRulesError}
                    </div>
                  )}
                  {ignoreRulesLoading && (
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Loading rules…
                    </div>
                  )}
                  {!ignoreRulesLoading && ignoreRules.length === 0 && (
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      No ignore rules yet.
                    </div>
                  )}
                  {!ignoreRulesLoading && ignoreRules.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {ignoreRules.map((rule) => (
                        <div
                          key={rule.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 10px",
                            borderRadius: "10px",
                            border: "1px solid var(--border)",
                            background: "var(--panel-elev)",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "12px", fontWeight: 600 }}>
                              {rule.rule_type} {rule.site_id ? "" : "· global"}
                            </div>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--muted)",
                                overflowWrap: "anywhere",
                              }}
                            >
                              {rule.pattern}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleIgnoreRule(rule)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "8px",
                              border: "1px solid var(--border)",
                              background: rule.is_enabled
                                ? "var(--success)"
                                : "var(--panel)",
                              color: rule.is_enabled ? "white" : "var(--text)",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            {rule.is_enabled ? "Enabled" : "Disabled"}
                          </button>
                          <button
                            onClick={() => handleDeleteIgnoreRule(rule)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "8px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {noteModalOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setNoteModalOpen(false)}
              >
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>Link note</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Keep context that persists across scans.
                      </div>
                    </div>
                    <button
                      onClick={() => setNoteModalOpen(false)}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        borderRadius: "10px",
                        padding: "4px 6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {noteTargetUrl ?? "—"}
                  </div>
                  <label style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Note
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Add a note about this link"
                      rows={5}
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        boxSizing: "border-box",
                        resize: "vertical",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Status
                    <select
                      value={noteStatus}
                      onChange={(event) =>
                        setNoteStatus(event.target.value as LinkNoteStatus)
                      }
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        fontSize: "12px",
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="snoozed">Snoozed</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </label>
                  {noteError && (
                    <div style={{ fontSize: "12px", color: "var(--warning)" }}>
                      {noteError}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <button
                      onClick={handleDeleteNote}
                      disabled={!noteExisting || noteDeleting}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        cursor:
                          !noteExisting || noteDeleting
                            ? "not-allowed"
                            : "pointer",
                        fontSize: "12px",
                      }}
                    >
                      {noteDeleting ? "Deleting..." : "Delete note"}
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={noteSaving || !noteDraft.trim()}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: noteSaving
                          ? "var(--panel-elev)"
                          : "var(--accent)",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor:
                          noteSaving || !noteDraft.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {noteSaving ? "Saving..." : "Save note"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {addSiteOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setAddSiteOpen(false)}
              >
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600 }}>Add site</div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        Enter the root URL to start scanning.
                      </div>
                    </div>
                    <button
                      onClick={() => setAddSiteOpen(false)}
                      className="icon-button"
                      style={{ borderColor: "var(--border)" }}
                    >
                      ✕
                    </button>
                  </div>
                  <label style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Site URL
                    <input
                      value={newSiteUrl}
                      onChange={(e) => setNewSiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      autoFocus
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleCreateSite();
                        }
                      }}
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        color: "var(--text)",
                        boxSizing: "border-box",
                      }}
                    />
                  </label>
                  {createError && (
                    <div style={{ fontSize: "12px", color: "var(--warning)" }}>
                      {createError}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "8px",
                    }}
                  >
                    <button
                      onClick={() => setAddSiteOpen(false)}
                      className="report-button"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateSite}
                      disabled={creatingSite || !newSiteUrl.trim()}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: "none",
                        background: creatingSite
                          ? "var(--panel-elev)"
                          : "linear-gradient(135deg, var(--accent), var(--accent-2))",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor:
                          creatingSite || !newSiteUrl.trim()
                            ? "not-allowed"
                            : "pointer",
                      }}
                    >
                      {creatingSite ? "Adding..." : "Add site"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {shortcutsOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setShortcutsOpen(false)}
              >
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>Keyboard shortcuts</div>
                    <button
                      onClick={() => setShortcutsOpen(false)}
                      className="icon-button"
                      style={{ borderColor: "var(--border)" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "12px",
                    }}
                  >
                    <div>Esc — Close drawers/modals</div>
                    <div>/ — Focus link search</div>
                    <div>N — Start new scan</div>
                    <div>A — Add site</div>
                    <div>? — Toggle this help</div>
                  </div>
                </div>
              </div>
            )}

            {historyOpen && (
              <div
                className="modal-backdrop"
                onClick={() => setHistoryOpen(false)}
              >
                <div
                  className="modal"
                  role="dialog"
                  aria-modal="true"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>History</div>
                    <button
                      onClick={() => setHistoryOpen(false)}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        borderRadius: "10px",
                        padding: "4px 6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  {historyLoading && (
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Loading…
                    </div>
                  )}
                  {historyError && (
                    <div style={{ fontSize: "12px", color: "var(--warning)" }}>
                      {historyError}
                    </div>
                  )}
                  {!historyLoading && history.length === 0 && (
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      No scans yet.
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {history.map((run) => (
                      <div
                        key={run.id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          padding: "8px",
                          background: "var(--panel-elev)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{ fontSize: "11px", color: "var(--muted)" }}
                          >
                            {formatRelative(run.started_at)}
                          </span>
                          <span
                            style={{ fontSize: "11px", color: "var(--text)" }}
                          >
                            {run.status}
                          </span>
                        </div>
                        <div
                          style={{ fontSize: "11px", color: "var(--muted)" }}
                        >
                          Broken {run.broken_links} • Checked{" "}
                          {run.checked_links}/{run.total_links}
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => setSelectedRunId(run.id)}
                            style={{
                              padding: "4px 6px",
                              borderRadius: "6px",
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              fontSize: "11px",
                              cursor: "pointer",
                            }}
                          >
                            View
                          </button>
                          {run.status === "completed" && (
                            <button
                              onClick={() => {
                                openReport(run.id);
                                setHistoryOpen(false);
                              }}
                              style={{
                                padding: "4px 6px",
                                borderRadius: "6px",
                                border: "1px solid var(--border)",
                                background: "var(--panel)",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              View report
                            </button>
                          )}
                          {selectedRunId &&
                            run.id !== selectedRunId &&
                            run.status === "completed" && (
                              <button
                                onClick={() => {
                                  setCompareRunId(run.id);
                                  setScanWorkspaceOpen(true);
                                  setResultsView("changes");
                                }}
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: "6px",
                                  border: "1px solid var(--border)",
                                  background: "var(--panel)",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                Compare
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div className="toast-stack">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone ?? "info"}`}>
              <span>{toast.message}</span>
              {toast.action && (
                <button
                  className="toast-action"
                  onClick={() => {
                    toast.action?.onClick();
                    setToasts((prev) =>
                      prev.filter((item) => item.id !== toast.id),
                    );
                  }}
                >
                  {toast.action.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
