import { createHash } from "node:crypto";
import { recordAdminAuditLog, type AdminActor } from "./admin";
import { ensureConnected } from "./client";
import { formatIssuePresentation } from "./issuePresentation";
import type { ScanIssue, ScanIssueSeverity } from "./scanIssues";

export const OPERATIONS_REPORT_STATUSES = [
  "draft",
  "needs_review",
  "ready_to_send",
  "sent",
  "client_replied",
  "fixes_quoted",
  "work_in_progress",
  "completed",
  "archived",
] as const;

export const OPERATIONS_REPORT_TYPES = [
  "initial_health_check",
  "follow_up",
  "post_fix_retest",
  "monthly_monitoring",
  "incident",
  "custom",
] as const;

export const OPERATIONS_REPORT_CLIENT_PRIORITIES = [
  "critical",
  "important",
  "improvement",
  "informational",
] as const;

export const OPERATIONS_REPORT_COMPARISON_STATUSES = [
  "resolved",
  "still_present",
  "improved",
  "worsened",
  "new",
  "unable_to_compare",
] as const;

export type OperationsReportStatus =
  (typeof OPERATIONS_REPORT_STATUSES)[number];
export type OperationsReportType = (typeof OPERATIONS_REPORT_TYPES)[number];
export type OperationsReportClientPriority =
  (typeof OPERATIONS_REPORT_CLIENT_PRIORITIES)[number];
export type OperationsReportComparisonStatus =
  (typeof OPERATIONS_REPORT_COMPARISON_STATUSES)[number];

export type OperationsReportDisplaySettings = {
  displayLogo: boolean;
  displayScanlarkContact: boolean;
  displayWebsiteHealthScore: boolean;
  displayPositiveObservations: boolean;
  displayTechnicalAppendix: boolean;
  displayMethodologyLimitations: boolean;
  displayNextSteps: boolean;
  displayContactDetails: boolean;
  confidentialNotice: string | null;
  footerText: string | null;
};

export type OperationsReportRow = {
  id: string;
  business_id: string;
  site_id: string;
  scan_run_id: string;
  prepared_contact_id: string | null;
  supersedes_report_id: string | null;
  comparison_report_id: string | null;
  delivery_communication_id: string | null;
  follow_up_task_id: string | null;
  title: string;
  status: OperationsReportStatus;
  report_type: OperationsReportType;
  version_number: number;
  executive_summary: string | null;
  overall_summary: string | null;
  main_strengths: string | null;
  main_concerns: string | null;
  recommended_first_steps: string | null;
  scope_limitations: string | null;
  prepared_for: string | null;
  prepared_by: string | null;
  cover_date: Date;
  valid_until: Date | null;
  sent_at: Date | null;
  completed_at: Date | null;
  archived_at: Date | null;
  follow_up_at: Date | null;
  no_major_findings_waived: boolean;
  display_settings_json: Partial<OperationsReportDisplaySettings>;
  frozen_render_json: OperationsClientReportPayload | null;
  frozen_at: Date | null;
  last_preview_generated_at: Date | null;
  last_pdf_generated_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  business_name?: string | null;
  site_url?: string | null;
  site_display_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  scan_finished_at?: Date | null;
  scan_checked_links?: number;
  scan_total_links?: number;
  included_findings?: number;
  excluded_findings?: number;
  incomplete_findings?: number;
  critical_findings?: number;
  important_findings?: number;
  improvement_findings?: number;
  informational_findings?: number;
};

export type OperationsReportFindingRow = {
  id: string;
  operations_report_id: string;
  source_issue_id: string | null;
  source_link_id: string | null;
  source_type: "scan_issue" | "scan_link" | "manual";
  source_fingerprint: string | null;
  category: string;
  original_severity: ScanIssueSeverity;
  client_priority: OperationsReportClientPriority;
  title: string;
  technical_summary: string | null;
  client_explanation: string | null;
  why_it_matters: string | null;
  recommended_action: string | null;
  affected_url: string | null;
  client_evidence: string | null;
  affected_url_note: string | null;
  evidence_json: Record<string, unknown>;
  is_included: boolean;
  is_false_positive: boolean;
  false_positive_reason: string | null;
  review_note: string | null;
  reviewed_at: Date | null;
  internal_note: string | null;
  display_order: number;
  estimated_effort: string | null;
  comparison_status: OperationsReportComparisonStatus | null;
  group_key: string | null;
  group_label: string | null;
  source_issue_count: number;
  occurrence_count: number;
  affected_page_count: number;
  affected_resource_count: number;
  representative_examples_json: OperationsReportFindingExample[];
  requires_merge_review: boolean;
  regrouped_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportFindingExample = {
  affectedPageUrl: string | null;
  affectedResourceUrl: string | null;
  result: string | null;
  note: string | null;
};

export type OperationsReportFindingSourceRow = {
  id: string;
  operations_report_id: string;
  report_finding_id: string;
  source_issue_id: string | null;
  source_link_id: string | null;
  source_kind: "scan_issue" | "scan_link" | "manual";
  affected_page_url: string | null;
  affected_resource_url: string | null;
  outcome_key: string | null;
  evidence_json: Record<string, unknown>;
  display_order: number;
  reviewed_for_client: boolean;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportPositiveObservationRow = {
  id: string;
  operations_report_id: string;
  title: string;
  description: string | null;
  source_key: string | null;
  is_included: boolean;
  reviewed_at: Date | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportActionPlanGroup =
  | "address_now"
  | "address_soon"
  | "consider_later";

export type OperationsReportActionPlanItemRow = {
  id: string;
  operations_report_id: string;
  report_finding_id: string | null;
  group_key: OperationsReportActionPlanGroup;
  title: string;
  summary: string | null;
  is_included: boolean;
  reviewed_at: Date | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportComparisonItemRow = {
  id: string;
  operations_report_id: string;
  original_finding_id: string | null;
  current_finding_id: string | null;
  source_fingerprint: string | null;
  comparison_status: OperationsReportComparisonStatus;
  summary: string | null;
  manual_note: string | null;
  is_manually_overridden: boolean;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportActivityRow = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown>;
  created_at: Date;
};

export type OperationsReportPdfRenderRow = {
  operations_report_id: string;
  filename: string;
  pdf_bytes: Buffer;
  generated_at: Date;
};

export type OperationsReportDetail = {
  report: OperationsReportRow;
  findings: OperationsReportFindingRow[];
  findingSources: OperationsReportFindingSourceRow[];
  positiveObservations: OperationsReportPositiveObservationRow[];
  actionPlanItems: OperationsReportActionPlanItemRow[];
  comparisonItems: OperationsReportComparisonItemRow[];
  activity: OperationsReportActivityRow[];
};

export type OperationsReportCreateInput = {
  businessId: string;
  siteId: string;
  scanRunId: string;
  reportType: OperationsReportType;
  title: string;
  preparedContactId?: string | null;
  preparedFor?: string | null;
  preparedBy?: string | null;
  coverDate?: Date | null;
  allowDuplicate?: boolean;
  supersedesReportId?: string | null;
  comparisonReportId?: string | null;
};

export type OperationsReportUpdateInput = {
  title?: string;
  status?: OperationsReportStatus;
  reportType?: OperationsReportType;
  executiveSummary?: string | null;
  overallSummary?: string | null;
  mainStrengths?: string | null;
  mainConcerns?: string | null;
  recommendedFirstSteps?: string | null;
  scopeLimitations?: string | null;
  preparedFor?: string | null;
  preparedBy?: string | null;
  preparedContactId?: string | null;
  coverDate?: Date | null;
  validUntil?: Date | null;
  noMajorFindingsWaived?: boolean;
  displaySettings?: Partial<OperationsReportDisplaySettings>;
};

export type OperationsReportFindingUpdateInput = {
  clientPriority?: OperationsReportClientPriority;
  title?: string;
  clientExplanation?: string | null;
  whyItMatters?: string | null;
  recommendedAction?: string | null;
  affectedUrl?: string | null;
  clientEvidence?: string | null;
  affectedUrlNote?: string | null;
  internalNote?: string | null;
  falsePositiveReason?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
  estimatedEffort?: string | null;
  isIncluded?: boolean;
  isFalsePositive?: boolean;
  displayOrder?: number;
  comparisonStatus?: OperationsReportComparisonStatus | null;
};

export type OperationsReportPositiveObservationUpdateInput = {
  title?: string;
  description?: string | null;
  isIncluded?: boolean;
  reviewedAt?: Date | null;
  displayOrder?: number;
};

export type OperationsReportActionPlanItemUpdateInput = {
  groupKey?: OperationsReportActionPlanGroup;
  title?: string;
  summary?: string | null;
  isIncluded?: boolean;
  reviewedAt?: Date | null;
  displayOrder?: number;
};

export type OperationsReportReadinessSection =
  | "settings"
  | "summary"
  | "findings"
  | "action_plan"
  | "preview";

export type OperationsReportReadinessIssue = {
  code: string;
  message: string;
  section: OperationsReportReadinessSection;
  findingId?: string;
};

export type OperationsReportFindingBulkInput = {
  findingIds: string[];
  action:
    | "include"
    | "exclude"
    | "change_priority"
    | "mark_reviewed"
    | "restore";
  clientPriority?: OperationsReportClientPriority;
};

export type OperationsReportListParams = {
  search?: string | null;
  status?: OperationsReportStatus | null;
  reportType?: OperationsReportType | null;
  businessId?: string | null;
  siteId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  awaitingFollowUp?: boolean;
  archived?: boolean | null;
  limit: number;
  offset: number;
};

export type OperationsClientReportPayload = {
  report: {
    title: string;
    status: OperationsReportStatus;
    reportType: OperationsReportType;
    versionNumber: number;
    preparedFor: string | null;
    preparedBy: string | null;
    coverDate: string;
    validUntil: string | null;
    sentAt: string | null;
  };
  business: {
    name: string;
  };
  site: {
    url: string;
    displayName: string | null;
    domain: string;
  };
  scan: {
    finishedAt: string | null;
    checkedLinks: number;
    totalLinks: number;
  };
  summaries: {
    executiveSummary: string | null;
    overallSummary: string | null;
    mainStrengths: string | null;
    mainConcerns: string | null;
    recommendedFirstSteps: string | null;
    scopeLimitations: string | null;
  };
  settings: OperationsReportDisplaySettings;
  priorityCounts: Record<OperationsReportClientPriority, number>;
  findings: Array<{
    priority: OperationsReportClientPriority;
    title: string;
    affectedUrl: string | null;
    affectedUrlNote: string | null;
    whatWasFound: string | null;
    whyItMatters: string | null;
    recommendedAction: string | null;
    clientEvidence: string | null;
    estimatedEffort: string | null;
    displayOrder: number;
    comparisonStatus: OperationsReportComparisonStatus | null;
    groupKey: string | null;
    groupLabel: string | null;
    occurrenceCount: number;
    affectedPageCount: number;
    affectedResourceCount: number;
    representativeExamples: OperationsReportFindingExample[];
  }>;
  actionPlan: Record<
    OperationsReportActionPlanGroup,
    Array<{
      title: string;
      summary: string | null;
    }>
  >;
  positiveObservations: Array<{
    title: string;
    description: string | null;
  }>;
  methodology: string[];
  nextSteps: string[];
  comparison: Array<{
    status: OperationsReportComparisonStatus;
    summary: string | null;
  }>;
  generatedAt: string;
};

type CountRow = { count: string };

type OperationsReportGroupingCandidate = {
  groupKey: string;
  groupLabel: string;
  category: string;
  priority: OperationsReportClientPriority;
  title: string;
  technicalSummary: string;
  clientExplanation: string;
  whyItMatters: string;
  recommendedAction: string;
  affectedUrl: string | null;
  affectedUrlNote: string | null;
  isIncluded: boolean;
  internalNote: string | null;
  issues: ScanIssue[];
  representativeExamples: OperationsReportFindingExample[];
  occurrenceCount: number;
  affectedPageCount: number;
  affectedResourceCount: number;
};

export type OperationsReportRegroupPreviewGroup = {
  groupKey: string;
  groupLabel: string;
  title: string;
  sourceIssueCount: number;
  occurrenceCount: number;
  affectedPageCount: number;
  affectedResourceCount: number;
  preservedFindingIds: string[];
  mergeReviewFindingIds: string[];
  representativeExamples: OperationsReportFindingExample[];
};

export type OperationsReportRegroupPreview = {
  reportId: string;
  currentFindingCount: number;
  proposedGroupedCount: number;
  currentIncludedCount: number;
  proposedIncludedCount: number;
  rawSourceIssueCount: number;
  rawOccurrenceCount: number;
  previewHash: string;
  groups: OperationsReportRegroupPreviewGroup[];
  blockedReason: string | null;
};

export type OperationsReportDeleteEligibility = {
  allowed: boolean;
  reasons: string[];
  dependencyCounts: Record<string, number>;
};

type ReportRelationshipRow = {
  business_id: string;
  business_name: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  scan_run_id: string;
  scan_status: string;
  finished_at: Date | null;
  checked_links: number;
  total_links: number;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
};

const DEFAULT_DISPLAY_SETTINGS: OperationsReportDisplaySettings = {
  displayLogo: true,
  displayScanlarkContact: true,
  displayWebsiteHealthScore: false,
  displayPositiveObservations: true,
  displayTechnicalAppendix: false,
  displayMethodologyLimitations: true,
  displayNextSteps: true,
  displayContactDetails: true,
  confidentialNotice: "Confidential: prepared for client use.",
  footerText: "Prepared by Scanlark for client use.",
};

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function addDependencyReason(
  reasons: string[],
  dependencyCounts: Record<string, number>,
  key: string,
  count: number,
  label: string,
) {
  dependencyCounts[key] = count;
  if (count > 0) reasons.push(`${label}: ${count}`);
}

function textValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string | null | undefined, key: string): string {
  const text = textValue(value);
  if (!text) throw new Error(`${key}_required`);
  return text;
}

function normalizeUrlForFingerprint(value: string | null | undefined) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function siteDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value;
  }
}

function sourceFingerprint(
  issue: Pick<
    ScanIssue,
    "category" | "issue_type" | "affected_url" | "source_url"
  >,
) {
  return [
    issue.category,
    issue.issue_type,
    normalizeUrlForFingerprint(issue.affected_url),
    normalizeUrlForFingerprint(issue.source_url),
  ].join("|");
}

function priorityFromSeverity(
  severity: ScanIssueSeverity,
): OperationsReportClientPriority {
  if (severity === "critical") return "critical";
  if (severity === "high") return "important";
  if (severity === "medium" || severity === "low") return "improvement";
  return "informational";
}

function severityRank(severity: ScanIssueSeverity) {
  if (severity === "critical") return 1;
  if (severity === "high") return 2;
  if (severity === "medium") return 3;
  if (severity === "low") return 4;
  return 5;
}

function actionPlanGroupForPriority(
  priority: OperationsReportClientPriority,
): OperationsReportActionPlanGroup {
  if (priority === "critical") return "address_now";
  if (priority === "important") return "address_soon";
  return "consider_later";
}

function numberValue(value: unknown, fallback = 1): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizedTextKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function urlHost(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLikelyInternalUrl(
  siteUrl: string,
  value: string | null | undefined,
) {
  const siteHost = urlHost(siteUrl);
  const targetHost = urlHost(value);
  return Boolean(siteHost && targetHost && siteHost === targetHost);
}

function issueOccurrenceCount(issue: ScanIssue) {
  return Math.max(1, numberValue(issue.evidence_json?.occurrence_count, 1));
}

function issueOutcomeKey(issue: ScanIssue) {
  const statusCode = numberValue(issue.evidence_json?.status_code, 0);
  if (issue.issue_type === "broken_link" && statusCode > 0) {
    return `broken:${statusCode}`;
  }
  return issue.issue_type;
}

function representativeExampleForIssue(
  issue: ScanIssue,
): OperationsReportFindingExample {
  return {
    affectedPageUrl: issue.source_url || issue.affected_url || null,
    affectedResourceUrl: issue.source_url ? issue.affected_url : null,
    result: issueOutcomeKey(issue),
    note: issue.title,
  };
}

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(
    values.map((value) => normalizeUrlForFingerprint(value)).filter(Boolean),
  ).size;
}

function issueGroupKey(issue: ScanIssue, siteUrl: string) {
  if (
    issue.category === "seo_basic" &&
    (issue.issue_type === "missing_meta_description" ||
      issue.issue_type === "empty_meta_description")
  ) {
    return "seo_basic:meta_description";
  }
  if (issue.issue_type === "duplicate_title") {
    const duplicateTitle =
      typeof issue.evidence_json?.title === "string"
        ? issue.evidence_json.title
        : issue.title;
    return `seo_basic:duplicate_title:${normalizedTextKey(duplicateTitle) || "unknown"}`;
  }
  if (issue.category === "link_integrity") {
    if (issue.issue_type === "ignored_safety_skip") {
      return "link_integrity:ignored_safety_skip";
    }
    const internal = isLikelyInternalUrl(siteUrl, issue.affected_url);
    const targetKey = internal
      ? normalizeUrlForFingerprint(issue.affected_url)
      : "external_destinations";
    return `link_integrity:${internal ? "internal" : "external"}:${issueOutcomeKey(issue)}:${targetKey}`;
  }
  if (issue.category === "security_header") {
    return "security_header:browser_security_controls";
  }
  if (
    issue.category === "performance_basic" &&
    issue.issue_type.startsWith("homepage_")
  ) {
    return "performance_basic:homepage_weight";
  }
  return `${issue.category}:${issue.issue_type}`;
}

function issueGroupLabel(issue: ScanIssue, siteUrl: string) {
  if (
    issue.category === "seo_basic" &&
    (issue.issue_type === "missing_meta_description" ||
      issue.issue_type === "empty_meta_description")
  ) {
    return "Missing meta descriptions";
  }
  if (issue.issue_type === "duplicate_title") return "Duplicate page titles";
  if (issue.category === "link_integrity") {
    if (issue.issue_type === "ignored_safety_skip")
      return "Internal crawl limits";
    const internal = isLikelyInternalUrl(siteUrl, issue.affected_url);
    if (internal) return "Broken internal links";
    if (issue.issue_type === "blocked_link") return "Blocked external links";
    if (issue.issue_type === "no_response")
      return "External links with no response";
    return "Unavailable external links";
  }
  if (issue.category === "security_header") {
    return "Browser security headers";
  }
  if (
    issue.category === "performance_basic" &&
    issue.issue_type.startsWith("homepage_")
  ) {
    return "Homepage performance weight";
  }
  return issue.title;
}

function defaultGroupedFindingContent(
  group: Pick<
    OperationsReportGroupingCandidate,
    | "groupKey"
    | "groupLabel"
    | "issues"
    | "occurrenceCount"
    | "affectedPageCount"
    | "affectedResourceCount"
  >,
): Pick<
  OperationsReportGroupingCandidate,
  | "title"
  | "technicalSummary"
  | "clientExplanation"
  | "whyItMatters"
  | "recommendedAction"
  | "affectedUrl"
  | "affectedUrlNote"
  | "internalNote"
> {
  const first = group.issues[0];
  const pages = group.affectedPageCount;
  const resources = group.affectedResourceCount;
  if (group.groupKey === "seo_basic:meta_description") {
    return {
      title: "Meta descriptions are missing on multiple pages",
      technicalSummary: `${pages} page${pages === 1 ? "" : "s"} do not have a usable meta description.`,
      clientExplanation:
        "Several pages are missing the short description that search engines and sharing tools can use to summarise page content.",
      whyItMatters:
        "Clear page descriptions help visitors understand what a page is about before they click and make the site easier to manage in search results.",
      recommendedAction:
        "Write unique, page-specific meta descriptions for the highest-value pages first, then complete the remaining reviewed pages.",
      affectedUrl: null,
      affectedUrlNote: `${pages} pages affected; representative examples are shown.`,
      internalNote: null,
    };
  }
  if (first.issue_type === "duplicate_title") {
    return {
      title: "Some pages share the same title",
      technicalSummary: `${pages} page${pages === 1 ? "" : "s"} share title wording.`,
      clientExplanation:
        "Multiple pages use the same or very similar page title, which can make pages harder to distinguish.",
      whyItMatters:
        "Distinct titles help visitors, browser tabs and search results make the purpose of each page clearer.",
      recommendedAction:
        "Give each important page a specific title that describes its individual content or service.",
      affectedUrl: null,
      affectedUrlNote: `${pages} pages affected; representative examples are shown.`,
      internalNote: null,
    };
  }
  if (group.groupKey === "security_header:browser_security_controls") {
    return {
      title: "Website security headers could be strengthened",
      technicalSummary: `${group.issues.length} preventative browser security control${group.issues.length === 1 ? "" : "s"} could be improved.`,
      clientExplanation:
        "The website can add or strengthen browser instructions that reduce avoidable exposure to framing, content-type and referrer-related risks.",
      whyItMatters:
        "These controls are preventative hardening measures. They do not mean the website is compromised, but they help browsers handle pages more safely.",
      recommendedAction:
        "Review the recommended response headers with the website host or developer and apply the appropriate browser security controls.",
      affectedUrl: first.affected_url,
      affectedUrlNote: null,
      internalNote:
        "This is a website-health finding, not a penetration-test result.",
    };
  }
  if (group.groupKey === "performance_basic:homepage_weight") {
    return {
      title: "Homepage assets could be lighter",
      technicalSummary: `${group.issues.length} homepage performance signal${group.issues.length === 1 ? "" : "s"} exceeded the configured guideline.`,
      clientExplanation:
        "The homepage includes more page resources than expected for a lightweight public page.",
      whyItMatters:
        "Reducing unnecessary scripts, images and assets can make the first visitor experience faster and easier to maintain.",
      recommendedAction:
        "Review homepage scripts, images and assets, then remove, defer or optimise anything that is not needed for the initial page experience.",
      affectedUrl: first.affected_url,
      affectedUrlNote: null,
      internalNote: null,
    };
  }
  if (first.category === "link_integrity") {
    const internal = group.groupKey.includes(":internal:");
    const outcome =
      first.issue_type === "blocked_link"
        ? "blocked by the destination or checker"
        : first.issue_type === "no_response"
          ? "not responding"
          : "unavailable";
    return {
      title: internal
        ? "Internal links point to unavailable pages"
        : "Several external links lead to unavailable pages",
      technicalSummary: `${resources || group.issues.length} destination${(resources || group.issues.length) === 1 ? "" : "s"} were ${outcome}.`,
      clientExplanation: internal
        ? "One or more links on the website point visitors to pages that are not available."
        : "Some links from the website point to external destinations that did not return a healthy response during the check.",
      whyItMatters: internal
        ? "Broken internal links interrupt visitor journeys and can make important content harder to reach."
        : "Unavailable external references can frustrate visitors and make supporting evidence, press links or resources look outdated.",
      recommendedAction: internal
        ? "Update the affected internal links to the correct page or remove links that are no longer needed."
        : "Review the unavailable external destinations and replace, update or remove links that are no longer useful.",
      affectedUrl: internal && resources === 1 ? first.affected_url : null,
      affectedUrlNote:
        resources > 1 || !internal
          ? `${resources || group.issues.length} destination${(resources || group.issues.length) === 1 ? "" : "s"} affected; representative examples are shown.`
          : null,
      internalNote:
        first.issue_type === "blocked_link"
          ? "Blocked external links may require manual confirmation because some third-party hosts reject automated checks."
          : null,
    };
  }
  return {
    title: clientFriendlyStarterText(first.title),
    technicalSummary: clientFriendlyStarterText(first.description),
    clientExplanation: clientFriendlyStarterText(first.description),
    whyItMatters:
      "This item may affect how visitors, browsers or automated services understand the website.",
    recommendedAction: clientFriendlyStarterText(
      formatIssuePresentation(first).suggestedFix,
    ),
    affectedUrl: first.affected_url,
    affectedUrlNote: null,
    internalNote: null,
  };
}

function buildGroupedFindingCandidates(
  issues: ScanIssue[],
  siteUrl: string,
): OperationsReportGroupingCandidate[] {
  const grouped = new Map<string, ScanIssue[]>();
  for (const issue of issues) {
    const key = issueGroupKey(issue, siteUrl);
    grouped.set(key, [...(grouped.get(key) ?? []), issue]);
  }
  return [...grouped.entries()]
    .map(([groupKey, groupIssues]) => {
      const first = groupIssues[0];
      const affectedPages = groupIssues.map((issue) =>
        issue.source_url ? issue.source_url : issue.affected_url,
      );
      const affectedResources = groupIssues.map((issue) =>
        issue.source_url ? issue.affected_url : null,
      );
      const occurrenceCount = groupIssues.reduce(
        (count, issue) => count + issueOccurrenceCount(issue),
        0,
      );
      const candidateBase = {
        groupKey,
        groupLabel: issueGroupLabel(first, siteUrl),
        issues: groupIssues,
        occurrenceCount,
        affectedPageCount: uniqueCount(affectedPages),
        affectedResourceCount: uniqueCount(affectedResources),
      };
      const content = defaultGroupedFindingContent(candidateBase);
      const priority = groupIssues.reduce<OperationsReportClientPriority>(
        (highest, issue) => {
          const next = priorityFromSeverity(issue.severity);
          const rank = OPERATIONS_REPORT_CLIENT_PRIORITIES.indexOf(next);
          const current = OPERATIONS_REPORT_CLIENT_PRIORITIES.indexOf(highest);
          return rank < current ? next : highest;
        },
        priorityFromSeverity(first.severity),
      );
      const isInternalSafety =
        groupKey === "link_integrity:ignored_safety_skip";
      return {
        ...candidateBase,
        category: first.category,
        priority,
        isIncluded: !isInternalSafety,
        representativeExamples: groupIssues
          .map(representativeExampleForIssue)
          .slice(0, 5),
        ...content,
      };
    })
    .sort((a, b) => {
      const priorityDelta =
        OPERATIONS_REPORT_CLIENT_PRIORITIES.indexOf(a.priority) -
        OPERATIONS_REPORT_CLIENT_PRIORITIES.indexOf(b.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return a.groupLabel.localeCompare(b.groupLabel);
    });
}

export function buildOperationsReportGroupingPreviewForIssues(
  issues: ScanIssue[],
  siteUrl: string,
) {
  return buildGroupedFindingCandidates(issues, siteUrl).map((candidate) => ({
    groupKey: candidate.groupKey,
    groupLabel: candidate.groupLabel,
    title: candidate.title,
    isIncluded: candidate.isIncluded,
    sourceIssueCount: candidate.issues.length,
    occurrenceCount: candidate.occurrenceCount,
    affectedPageCount: candidate.affectedPageCount,
    affectedResourceCount: candidate.affectedResourceCount,
    representativeExamples: candidate.representativeExamples,
    recommendedAction: candidate.recommendedAction,
  }));
}

function clientFriendlyStarterText(value: string) {
  return value
    .replace(/\bcrawler safety\b/gi, "automated-check safety")
    .replace(/\bcrawlers\b/gi, "automated services")
    .replace(/\bcrawler\b/gi, "automated check")
    .replace(/\bcrawled\b/gi, "reviewed")
    .replace(/\bcrawling\b/gi, "reviewing");
}

function mergeDisplaySettings(
  settings: Partial<OperationsReportDisplaySettings> | null | undefined,
): OperationsReportDisplaySettings {
  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...(settings ?? {}),
    confidentialNotice:
      textValue(settings?.confidentialNotice) ??
      DEFAULT_DISPLAY_SETTINGS.confidentialNotice,
    footerText:
      textValue(settings?.footerText) ?? DEFAULT_DISPLAY_SETTINGS.footerText,
  };
}

function dateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | null): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function reportSelect() {
  return `
    r.*,
    b.name AS business_name,
    s.url AS site_url,
    s.site_display_name,
    sr.finished_at AS scan_finished_at,
    sr.checked_links AS scan_checked_links,
    sr.total_links AS scan_total_links,
    c.first_name AS contact_first_name,
    c.last_name AS contact_last_name,
    c.email AS contact_email,
    COALESCE(finding_counts.included_findings, 0)::int AS included_findings,
    COALESCE(finding_counts.excluded_findings, 0)::int AS excluded_findings,
    COALESCE(finding_counts.incomplete_findings, 0)::int AS incomplete_findings,
    COALESCE(finding_counts.critical_findings, 0)::int AS critical_findings,
    COALESCE(finding_counts.important_findings, 0)::int AS important_findings,
    COALESCE(finding_counts.improvement_findings, 0)::int AS improvement_findings,
    COALESCE(finding_counts.informational_findings, 0)::int AS informational_findings
  `;
}

function reportJoins() {
  return `
    JOIN operations_businesses b ON b.id = r.business_id
    JOIN sites s ON s.id = r.site_id
    JOIN scan_runs sr ON sr.id = r.scan_run_id
    LEFT JOIN operations_contacts c ON c.id = r.prepared_contact_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false)::int AS included_findings,
        COUNT(*) FILTER (WHERE f.is_included = false OR f.is_false_positive = true)::int AS excluded_findings,
        COUNT(*) FILTER (
          WHERE f.is_included = true
            AND f.is_false_positive = false
            AND (
              f.reviewed_at IS NULL
              OR length(trim(f.title)) = 0
              OR f.client_explanation IS NULL OR length(trim(f.client_explanation)) = 0
              OR f.why_it_matters IS NULL OR length(trim(f.why_it_matters)) = 0
              OR f.recommended_action IS NULL OR length(trim(f.recommended_action)) = 0
              OR (
                (f.affected_url IS NULL OR length(trim(f.affected_url)) = 0)
                AND (f.affected_url_note IS NULL OR length(trim(f.affected_url_note)) = 0)
              )
            )
        )::int AS incomplete_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'critical')::int AS critical_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'important')::int AS important_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'improvement')::int AS improvement_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'informational')::int AS informational_findings
      FROM operations_report_findings f
      WHERE f.operations_report_id = r.id
    ) finding_counts ON TRUE
  `;
}

async function getReportRelationship(input: {
  businessId: string;
  siteId: string;
  scanRunId: string;
  contactId?: string | null;
}): Promise<ReportRelationshipRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ReportRelationshipRow>(
    `
      SELECT b.id AS business_id,
             b.name AS business_name,
             s.id AS site_id,
             s.url AS site_url,
             s.site_display_name,
             r.id AS scan_run_id,
             r.status AS scan_status,
             r.finished_at,
             r.checked_links,
             r.total_links,
             c.id AS contact_id,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email
      FROM operations_businesses b
      JOIN operations_business_sites obs ON obs.business_id = b.id
      JOIN sites s ON s.id = obs.site_id
      JOIN scan_runs r ON r.site_id = s.id
      LEFT JOIN operations_contacts c
        ON c.business_id = b.id
       AND c.id = $4
       AND c.archived_at IS NULL
      WHERE b.id = $1
        AND s.id = $2
        AND r.id = $3
      LIMIT 1
    `,
    [input.businessId, input.siteId, input.scanRunId, input.contactId ?? null],
  );
  return res.rows[0] ?? null;
}

async function getReportById(
  reportId: string,
): Promise<OperationsReportRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportRow>(
    `
      SELECT ${reportSelect()}
      FROM operations_reports r
      ${reportJoins()}
      WHERE r.id = $1
      LIMIT 1
    `,
    [reportId],
  );
  return res.rows[0] ?? null;
}

async function listFindings(
  reportId: string,
): Promise<OperationsReportFindingRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportFindingRow>(
    `
      SELECT *
      FROM operations_report_findings
      WHERE operations_report_id = $1
      ORDER BY display_order ASC, created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listFindingSources(
  reportId: string,
): Promise<OperationsReportFindingSourceRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportFindingSourceRow>(
    `
      SELECT *
      FROM operations_report_finding_sources
      WHERE operations_report_id = $1
      ORDER BY report_finding_id ASC, display_order ASC, created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listComparisonItems(
  reportId: string,
): Promise<OperationsReportComparisonItemRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportComparisonItemRow>(
    `
      SELECT *
      FROM operations_report_comparison_items
      WHERE operations_report_id = $1
      ORDER BY created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listPositiveObservations(
  reportId: string,
): Promise<OperationsReportPositiveObservationRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportPositiveObservationRow>(
    `
      SELECT *
      FROM operations_report_positive_observations
      WHERE operations_report_id = $1
      ORDER BY display_order ASC, created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listActionPlanItems(
  reportId: string,
): Promise<OperationsReportActionPlanItemRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportActionPlanItemRow>(
    `
      SELECT *
      FROM operations_report_action_plan_items
      WHERE operations_report_id = $1
      ORDER BY
        CASE group_key
          WHEN 'address_now' THEN 1
          WHEN 'address_soon' THEN 2
          ELSE 3
        END,
        display_order ASC,
        created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listReportActivity(
  reportId: string,
): Promise<OperationsReportActivityRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportActivityRow>(
    `
      SELECT *
      FROM admin_audit_log
      WHERE (target_type = 'operations_report' AND target_id = $1)
         OR (
           target_type IN ('operations_report_finding', 'operations_report_comparison')
           AND metadata_json->>'reportId' = $1
         )
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [reportId],
  );
  return res.rows;
}

async function invalidateEditableReportRender(reportId: string) {
  const client = await ensureConnected();
  const invalidated = await client.query<{ id: string }>(
    `
      UPDATE operations_reports
      SET frozen_render_json = NULL,
          frozen_at = NULL,
          last_preview_generated_at = NULL,
          last_pdf_generated_at = NULL,
          updated_at = now()
      WHERE id = $1
        AND status IN ('draft', 'needs_review')
      RETURNING id
    `,
    [reportId],
  );
  if (invalidated.rows[0]) {
    await client.query(
      `DELETE FROM operations_report_pdf_renders WHERE operations_report_id = $1`,
      [reportId],
    );
  }
}

async function insertFindingsForScan(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  reportId: string,
  scanRunId: string,
  siteUrl: string,
) {
  const issuesRes = await client.query<ScanIssue>(
    `
      SELECT *
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        category ASC,
        affected_url ASC
    `,
    [scanRunId],
  );

  const groupedFindings = buildGroupedFindingCandidates(
    issuesRes.rows,
    siteUrl,
  );
  let order = 0;
  for (const group of groupedFindings) {
    const strongestIssue = [...group.issues].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity),
    )[0];
    const findingRes = await client.query<{ id: string }>(
      `
        INSERT INTO operations_report_findings (
          operations_report_id,
          source_issue_id,
          source_type,
          source_fingerprint,
          category,
          original_severity,
          client_priority,
          title,
          technical_summary,
          client_explanation,
          why_it_matters,
          recommended_action,
          affected_url,
          evidence_json,
          is_included,
          group_key,
          group_label,
          source_issue_count,
          occurrence_count,
          affected_page_count,
          affected_resource_count,
          representative_examples_json,
          affected_url_note,
          internal_note,
          regrouped_at,
          display_order
        )
        VALUES ($1, $2, 'scan_issue', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, now(), $21)
        RETURNING id
      `,
      [
        reportId,
        strongestIssue.id,
        group.groupKey,
        group.category,
        strongestIssue.severity,
        group.priority,
        group.title,
        group.technicalSummary,
        group.clientExplanation,
        group.whyItMatters,
        group.recommendedAction,
        group.affectedUrl,
        {
          grouped: true,
          issueTypes: [
            ...new Set(group.issues.map((issue) => issue.issue_type)),
          ],
          sourceIssueCount: group.issues.length,
          occurrenceCount: group.occurrenceCount,
        },
        group.isIncluded,
        group.groupKey,
        group.groupLabel,
        group.issues.length,
        group.occurrenceCount,
        group.affectedPageCount,
        group.affectedResourceCount,
        JSON.stringify(group.representativeExamples),
        group.affectedUrlNote,
        group.internalNote,
        order++,
      ],
    );
    const findingId = findingRes.rows[0].id;
    for (const [sourceIndex, issue] of group.issues.entries()) {
      await client.query(
        `
          INSERT INTO operations_report_finding_sources (
            operations_report_id,
            report_finding_id,
            source_issue_id,
            source_kind,
            affected_page_url,
            affected_resource_url,
            outcome_key,
            evidence_json,
            display_order
          )
          VALUES ($1, $2, $3, 'scan_issue', $4, $5, $6, $7, $8)
        `,
        [
          reportId,
          findingId,
          issue.id,
          issue.source_url || issue.affected_url,
          issue.source_url ? issue.affected_url : null,
          issueOutcomeKey(issue),
          {
            issueType: issue.issue_type,
            sourceUrl: issue.source_url,
            sourceTitle: issue.title,
            sourceDescription: issue.description,
            changeStatus: issue.change_status,
            evidence: issue.evidence_json,
            detectedAt: issue.last_seen_at.toISOString(),
          },
          sourceIndex,
        ],
      );
    }
  }
}

function reportRegroupBlockedReason(report: OperationsReportRow) {
  if (report.archived_at) return "archived_report";
  if (report.frozen_at || report.frozen_render_json) return "frozen_report";
  if (report.sent_at) return "sent_report";
  if (!(report.status === "draft" || report.status === "needs_review")) {
    return "report_not_editable";
  }
  return null;
}

function findingHasAdminEdits(finding: OperationsReportFindingRow) {
  return Boolean(
    finding.reviewed_at ||
    textValue(finding.review_note) ||
    textValue(finding.internal_note) ||
    textValue(finding.client_evidence) ||
    textValue(finding.estimated_effort),
  );
}

function regroupPreviewHash(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
  groups: OperationsReportRegroupPreviewGroup[],
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        reportId: report.id,
        updatedAt: report.updated_at.toISOString(),
        findings: findings.map((finding) => [
          finding.id,
          finding.updated_at.toISOString(),
          finding.source_issue_id,
          finding.group_key,
        ]),
        groups: groups.map((group) => [
          group.groupKey,
          group.sourceIssueCount,
          group.occurrenceCount,
        ]),
      }),
    )
    .digest("hex");
}

function matchingExistingFindings(
  candidate: OperationsReportGroupingCandidate,
  currentFindings: OperationsReportFindingRow[],
) {
  const sourceIssueIds = new Set(candidate.issues.map((issue) => issue.id));
  return currentFindings.filter(
    (finding) =>
      (finding.group_key && finding.group_key === candidate.groupKey) ||
      (finding.source_issue_id && sourceIssueIds.has(finding.source_issue_id)),
  );
}

function buildRegroupPreviewFromCandidates(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
  candidates: OperationsReportGroupingCandidate[],
) {
  const groups = candidates.map<OperationsReportRegroupPreviewGroup>(
    (candidate) => {
      const matches = matchingExistingFindings(candidate, findings).filter(
        findingHasAdminEdits,
      );
      return {
        groupKey: candidate.groupKey,
        groupLabel: candidate.groupLabel,
        title: candidate.title,
        sourceIssueCount: candidate.issues.length,
        occurrenceCount: candidate.occurrenceCount,
        affectedPageCount: candidate.affectedPageCount,
        affectedResourceCount: candidate.affectedResourceCount,
        preservedFindingIds: matches.length === 1 ? [matches[0].id] : [],
        mergeReviewFindingIds:
          matches.length > 1 ? matches.map((finding) => finding.id) : [],
        representativeExamples: candidate.representativeExamples,
      };
    },
  );
  return {
    reportId: report.id,
    currentFindingCount: findings.length,
    proposedGroupedCount: candidates.length,
    currentIncludedCount: findings.filter(
      (finding) => finding.is_included && !finding.is_false_positive,
    ).length,
    proposedIncludedCount: candidates.filter(
      (candidate) => candidate.isIncluded,
    ).length,
    rawSourceIssueCount: candidates.reduce(
      (count, candidate) => count + candidate.issues.length,
      0,
    ),
    rawOccurrenceCount: candidates.reduce(
      (count, candidate) => count + candidate.occurrenceCount,
      0,
    ),
    previewHash: regroupPreviewHash(report, findings, groups),
    groups,
    blockedReason: reportRegroupBlockedReason(report),
  } satisfies OperationsReportRegroupPreview;
}

async function buildRegroupCandidatesForReport(report: OperationsReportRow) {
  const client = await ensureConnected();
  const issuesRes = await client.query<ScanIssue>(
    `
      SELECT *
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        category ASC,
        affected_url ASC
    `,
    [report.scan_run_id],
  );
  return buildGroupedFindingCandidates(issuesRes.rows, report.site_url ?? "");
}

export async function previewOperationsReportRegroup(
  reportId: string,
): Promise<OperationsReportRegroupPreview | null> {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const candidates = await buildRegroupCandidatesForReport(detail.report);
  return buildRegroupPreviewFromCandidates(
    detail.report,
    detail.findings,
    candidates,
  );
}

async function insertGroupedCandidateFinding(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  reportId: string,
  candidate: OperationsReportGroupingCandidate,
  existingFindings: OperationsReportFindingRow[],
  displayOrder: number,
) {
  const matches = matchingExistingFindings(candidate, existingFindings).filter(
    findingHasAdminEdits,
  );
  const preserved = matches.length === 1 ? matches[0] : null;
  const strongestIssue = [...candidate.issues].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  )[0];
  const mergeNotes =
    matches.length > 1
      ? matches
          .map((finding) =>
            [
              `Merged finding: ${finding.title}`,
              finding.client_explanation,
              finding.why_it_matters,
              finding.recommended_action,
              finding.review_note,
              finding.internal_note,
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .join("\n\n")
      : null;
  const findingRes = await client.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id,
        source_issue_id,
        source_type,
        source_fingerprint,
        category,
        original_severity,
        client_priority,
        title,
        technical_summary,
        client_explanation,
        why_it_matters,
        recommended_action,
        affected_url,
        client_evidence,
        affected_url_note,
        evidence_json,
        is_included,
        is_false_positive,
        internal_note,
        review_note,
        reviewed_at,
        display_order,
        estimated_effort,
        group_key,
        group_label,
        source_issue_count,
        occurrence_count,
        affected_page_count,
        affected_resource_count,
        representative_examples_json,
        requires_merge_review,
        regrouped_at
      )
      VALUES ($1, $2, 'scan_issue', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, false, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, now())
      RETURNING id
    `,
    [
      reportId,
      strongestIssue.id,
      candidate.groupKey,
      candidate.category,
      strongestIssue.severity,
      preserved?.client_priority ?? candidate.priority,
      preserved?.title ?? candidate.title,
      candidate.technicalSummary,
      preserved?.client_explanation ?? candidate.clientExplanation,
      preserved?.why_it_matters ?? candidate.whyItMatters,
      preserved?.recommended_action ?? candidate.recommendedAction,
      preserved?.affected_url ?? candidate.affectedUrl,
      preserved?.client_evidence ?? null,
      preserved?.affected_url_note ?? candidate.affectedUrlNote,
      {
        grouped: true,
        issueTypes: [
          ...new Set(candidate.issues.map((issue) => issue.issue_type)),
        ],
        sourceIssueCount: candidate.issues.length,
        occurrenceCount: candidate.occurrenceCount,
      },
      preserved?.is_included ?? candidate.isIncluded,
      [candidate.internalNote, mergeNotes].filter(Boolean).join("\n\n") || null,
      preserved?.review_note ?? null,
      preserved?.reviewed_at ?? null,
      displayOrder,
      preserved?.estimated_effort ?? null,
      candidate.groupKey,
      candidate.groupLabel,
      candidate.issues.length,
      candidate.occurrenceCount,
      candidate.affectedPageCount,
      candidate.affectedResourceCount,
      JSON.stringify(candidate.representativeExamples),
      matches.length > 1,
    ],
  );
  const findingId = findingRes.rows[0].id;
  for (const [index, issue] of candidate.issues.entries()) {
    await client.query(
      `
        INSERT INTO operations_report_finding_sources (
          operations_report_id,
          report_finding_id,
          source_issue_id,
          source_kind,
          affected_page_url,
          affected_resource_url,
          outcome_key,
          evidence_json,
          display_order,
          reviewed_for_client
        )
        VALUES ($1, $2, $3, 'scan_issue', $4, $5, $6, $7, $8, $9)
      `,
      [
        reportId,
        findingId,
        issue.id,
        issue.source_url || issue.affected_url,
        issue.source_url ? issue.affected_url : null,
        issueOutcomeKey(issue),
        {
          issueType: issue.issue_type,
          sourceUrl: issue.source_url,
          sourceTitle: issue.title,
          sourceDescription: issue.description,
          changeStatus: issue.change_status,
          evidence: issue.evidence_json,
          detectedAt: issue.last_seen_at.toISOString(),
        },
        index,
        Boolean(preserved?.reviewed_at),
      ],
    );
  }
}

async function rebuildActionPlanForGroupedFindings(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  reportId: string,
) {
  await client.query(
    `DELETE FROM operations_report_action_plan_items WHERE operations_report_id = $1`,
    [reportId],
  );
  const findings = await client.query<
    Pick<
      OperationsReportFindingRow,
      | "id"
      | "client_priority"
      | "title"
      | "recommended_action"
      | "display_order"
    >
  >(
    `
      SELECT id, client_priority, title, recommended_action, display_order
      FROM operations_report_findings
      WHERE operations_report_id = $1
        AND is_included = true
        AND is_false_positive = false
      ORDER BY display_order ASC, created_at ASC
    `,
    [reportId],
  );
  const groupCounts: Record<OperationsReportActionPlanGroup, number> = {
    address_now: 0,
    address_soon: 0,
    consider_later: 0,
  };
  for (const finding of findings.rows) {
    const group = actionPlanGroupForPriority(finding.client_priority);
    await client.query(
      `
        INSERT INTO operations_report_action_plan_items (
          operations_report_id,
          report_finding_id,
          group_key,
          title,
          summary,
          display_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        reportId,
        finding.id,
        group,
        finding.title,
        finding.recommended_action,
        groupCounts[group]++,
      ],
    );
  }
}

export async function regroupOperationsReportFindings(
  actor: AdminActor,
  reportId: string,
  input: { confirm: boolean; previewHash: string },
): Promise<
  | OperationsReportDetail
  | null
  | { blockedReason: string }
  | { stalePreview: true; preview: OperationsReportRegroupPreview }
> {
  if (!input.confirm) throw new Error("regroup_confirmation_required");
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const candidates = await buildRegroupCandidatesForReport(detail.report);
  const preview = buildRegroupPreviewFromCandidates(
    detail.report,
    detail.findings,
    candidates,
  );
  if (preview.blockedReason) return { blockedReason: preview.blockedReason };
  if (preview.previewHash !== input.previewHash) {
    return { stalePreview: true, preview };
  }
  const client = await ensureConnected();
  await client.query("BEGIN");
  try {
    await client.query(
      `DELETE FROM operations_report_action_plan_items WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_finding_sources WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_findings WHERE operations_report_id = $1`,
      [reportId],
    );
    for (const [index, candidate] of candidates.entries()) {
      await insertGroupedCandidateFinding(
        client,
        reportId,
        candidate,
        detail.findings,
        index,
      );
    }
    await rebuildActionPlanForGroupedFindings(client, reportId);
    await client.query(
      `
        UPDATE operations_reports
        SET frozen_render_json = NULL,
            frozen_at = NULL,
            last_preview_generated_at = NULL,
            last_pdf_generated_at = NULL,
            updated_at = now()
        WHERE id = $1
      `,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_pdf_renders WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  await recordAdminAuditLog(actor, {
    action: "operations_report_findings_regrouped",
    targetType: "operations_report",
    targetId: reportId,
    metadata: {
      currentFindingCount: preview.currentFindingCount,
      groupedFindingCount: preview.proposedGroupedCount,
      rawOccurrenceCount: preview.rawOccurrenceCount,
    },
  });
  return getOperationsReportDetail(reportId) as Promise<OperationsReportDetail>;
}

async function insertDefaultReportReviewSections(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  reportId: string,
  scanRunId: string,
  siteUrl: string,
) {
  const supportedChecks = await client.query<{
    check_type: string;
    ok: boolean;
  }>(
    `
      SELECT check_type, bool_or(ok) AS ok
      FROM scan_site_checks
      WHERE scan_run_id = $1
      GROUP BY check_type
    `,
    [scanRunId],
  );
  const checkPassed = (checkType: string) =>
    supportedChecks.rows.some(
      (check) => check.check_type === checkType && check.ok,
    );
  let observationOrder = 0;
  if (siteUrl.startsWith("https://") && checkPassed("https_root")) {
    await client.query(
      `
        INSERT INTO operations_report_positive_observations (
          operations_report_id, title, description, source_key, display_order
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        reportId,
        "HTTPS is active",
        "The reviewed website address uses HTTPS, which helps protect normal visitor browsing sessions.",
        "https_active",
        observationOrder++,
      ],
    );
  }
  if (checkPassed("sitemap_xml") || checkPassed("sitemap_index_xml")) {
    await client.query(
      `
        INSERT INTO operations_report_positive_observations (
          operations_report_id, title, description, source_key, display_order
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        reportId,
        "A sitemap was available",
        "A sitemap was detected during the selected check, helping automated services discover public pages.",
        "sitemap_detected",
        observationOrder++,
      ],
    );
  }
  await client.query(
    `
      INSERT INTO operations_report_positive_observations (
        operations_report_id, title, description, source_key, display_order
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      reportId,
      "Website was reachable during the scan",
      "Scanlark completed a review of publicly accessible pages for this website.",
      "scan_completed",
      observationOrder++,
    ],
  );

  const findings = await client.query<
    Pick<
      OperationsReportFindingRow,
      | "id"
      | "client_priority"
      | "title"
      | "recommended_action"
      | "display_order"
      | "occurrence_count"
    >
  >(
    `
      SELECT id, client_priority, title, recommended_action, display_order, occurrence_count
      FROM operations_report_findings
      WHERE operations_report_id = $1
        AND is_included = true
        AND is_false_positive = false
      ORDER BY display_order ASC, created_at ASC
    `,
    [reportId],
  );
  const groupCounts: Record<OperationsReportActionPlanGroup, number> = {
    address_now: 0,
    address_soon: 0,
    consider_later: 0,
  };
  for (const finding of findings.rows) {
    const group = actionPlanGroupForPriority(finding.client_priority);
    await client.query(
      `
        INSERT INTO operations_report_action_plan_items (
          operations_report_id,
          report_finding_id,
          group_key,
          title,
          summary,
          display_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        reportId,
        finding.id,
        group,
        finding.title,
        finding.recommended_action,
        groupCounts[group]++,
      ],
    );
  }

  const priorityCounts = findings.rows.reduce(
    (counts, finding) => {
      counts[finding.client_priority] += 1;
      return counts;
    },
    {
      critical: 0,
      important: 0,
      improvement: 0,
      informational: 0,
    } satisfies Record<OperationsReportClientPriority, number>,
  );
  const urgentCount = priorityCounts.critical + priorityCounts.important;
  const occurrenceTotal = findings.rows.reduce(
    (total, finding) =>
      total +
      Math.max(
        1,
        numberValue(
          (finding as Pick<OperationsReportFindingRow, "occurrence_count">)
            .occurrence_count,
          1,
        ),
      ),
    0,
  );
  await client.query(
    `
      UPDATE operations_reports
      SET executive_summary = $2,
          overall_summary = $3,
          main_strengths = $4,
          main_concerns = $5,
          recommended_first_steps = $6,
          scope_limitations = $7
      WHERE id = $1
    `,
    [
      reportId,
      `This website health review identified ${findings.rows.length} grouped area${findings.rows.length === 1 ? "" : "s"} for attention across ${occurrenceTotal} technical occurrence${occurrenceTotal === 1 ? "" : "s"}. Each item should be confirmed and edited before the report is shared.`,
      urgentCount > 0
        ? `The selected check found ${urgentCount} candidate item${urgentCount === 1 ? "" : "s"} that may deserve earlier attention, alongside lower-priority improvements.`
        : "The selected check did not identify any candidate critical or important items, but the remaining improvements should still be reviewed.",
      "The website was reachable during the selected check and public pages were available for review.",
      urgentCount > 0
        ? "The main concern is to confirm the higher-priority candidate findings and address the items that affect visitor journeys first."
        : "The main concerns are the included improvement items that could affect clarity, maintainability or visitor experience over time.",
      "Confirm the included findings, address the highest client priority first, and run a fresh check after changes are completed.",
      "This automated review covers publicly accessible pages reached during the selected check. Logged-in areas, forms and third-party systems may require separate manual testing.",
    ],
  );
}

export async function createOperationsReport(
  actor: AdminActor,
  input: OperationsReportCreateInput,
): Promise<
  | OperationsReportDetail
  | "business_site_scan_invalid"
  | "scan_not_reportable"
  | "duplicate_report"
  | "contact_not_found"
> {
  const client = await ensureConnected();
  const title = requiredText(input.title, "report_title");
  const relationship = await getReportRelationship({
    businessId: input.businessId,
    siteId: input.siteId,
    scanRunId: input.scanRunId,
    contactId: input.preparedContactId,
  });
  if (!relationship) return "business_site_scan_invalid";
  if (input.preparedContactId && !relationship.contact_id) {
    return "contact_not_found";
  }
  if (relationship.scan_status !== "completed" || !relationship.finished_at) {
    return "scan_not_reportable";
  }

  try {
    await client.query("BEGIN");
    if (!input.allowDuplicate) {
      const duplicate = await client.query<{ id: string }>(
        `
          SELECT id
          FROM operations_reports
          WHERE business_id = $1
            AND site_id = $2
            AND scan_run_id = $3
            AND report_type = $4
            AND archived_at IS NULL
          LIMIT 1
        `,
        [input.businessId, input.siteId, input.scanRunId, input.reportType],
      );
      if (duplicate.rows[0]) {
        await client.query("ROLLBACK");
        return "duplicate_report";
      }
    }

    const versionRes = await client.query<{ version: number }>(
      `
        SELECT COALESCE(MAX(version_number), 0)::int + 1 AS version
        FROM operations_reports
        WHERE business_id = $1
          AND site_id = $2
          AND scan_run_id = $3
      `,
      [input.businessId, input.siteId, input.scanRunId],
    );
    const version = versionRes.rows[0]?.version ?? 1;
    const reportRes = await client.query<OperationsReportRow>(
      `
        INSERT INTO operations_reports (
          business_id,
          site_id,
          scan_run_id,
          prepared_contact_id,
          supersedes_report_id,
          comparison_report_id,
          title,
          status,
          report_type,
          version_number,
          prepared_for,
          prepared_by,
          cover_date,
          display_settings_json,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'needs_review', $8, $9, $10, $11, COALESCE($12, CURRENT_DATE), $13, $14)
        RETURNING *
      `,
      [
        input.businessId,
        input.siteId,
        input.scanRunId,
        input.preparedContactId ?? null,
        input.supersedesReportId ?? null,
        input.comparisonReportId ?? null,
        title,
        input.reportType,
        version,
        textValue(input.preparedFor) ??
          ([relationship.contact_first_name, relationship.contact_last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
            relationship.business_name),
        textValue(input.preparedBy) ?? actor.email,
        input.coverDate ?? null,
        DEFAULT_DISPLAY_SETTINGS,
        actor.id,
      ],
    );
    const report = reportRes.rows[0];
    await insertFindingsForScan(
      client,
      report.id,
      input.scanRunId,
      relationship.site_url,
    );
    await insertDefaultReportReviewSections(
      client,
      report.id,
      input.scanRunId,
      relationship.site_url,
    );
    await client.query("COMMIT");

    await recordAdminAuditLog(actor, {
      action: "operations_report_created",
      targetType: "operations_report",
      targetId: report.id,
      metadata: {
        businessId: input.businessId,
        siteId: input.siteId,
        scanRunId: input.scanRunId,
        reportType: input.reportType,
      },
    });
    return (await getOperationsReportDetail(
      report.id,
    )) as OperationsReportDetail;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function listOperationsReportableScanRuns(input: {
  businessId: string;
  siteId: string;
  limit: number;
}) {
  const client = await ensureConnected();
  const linked = await client.query<{ id: string }>(
    `
      SELECT obs.site_id AS id
      FROM operations_business_sites obs
      WHERE obs.business_id = $1
        AND obs.site_id = $2
    `,
    [input.businessId, input.siteId],
  );
  if (!linked.rows[0]) return null;
  const res = await client.query(
    `
      SELECT r.id,
             r.site_id,
             r.status,
             r.started_at,
             r.finished_at,
             r.checked_links,
             r.total_links,
             COALESCE(issue_counts.open_issues, 0)::int AS open_issues,
             COALESCE(issue_counts.high_priority, 0)::int AS high_priority
      FROM scan_runs r
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE si.status = 'open')::int AS open_issues,
               COUNT(*) FILTER (WHERE si.status = 'open' AND si.severity IN ('critical', 'high'))::int AS high_priority
        FROM scan_issues si
        WHERE si.scan_run_id = r.id
      ) issue_counts ON TRUE
      WHERE r.site_id = $1
        AND r.status = 'completed'
        AND r.finished_at IS NOT NULL
      ORDER BY r.finished_at DESC
      LIMIT $2
    `,
    [input.siteId, input.limit],
  );
  return { scanRuns: res.rows };
}

export async function listOperationsReports(
  params: OperationsReportListParams,
) {
  const client = await ensureConnected();
  const filters: string[] = [];
  const values: unknown[] = [];

  if (params.archived === true) {
    filters.push(`r.archived_at IS NOT NULL`);
  } else if (params.archived === false || params.archived == null) {
    filters.push(`r.archived_at IS NULL`);
  }
  if (params.status) {
    values.push(params.status);
    filters.push(`r.status = $${values.length}`);
  }
  if (params.reportType) {
    values.push(params.reportType);
    filters.push(`r.report_type = $${values.length}`);
  }
  if (params.businessId) {
    values.push(params.businessId);
    filters.push(`r.business_id = $${values.length}`);
  }
  if (params.siteId) {
    values.push(params.siteId);
    filters.push(`r.site_id = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    filters.push(`r.created_at >= $${values.length}`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    filters.push(`r.created_at <= $${values.length}`);
  }
  if (params.awaitingFollowUp) {
    filters.push(
      `r.follow_up_at IS NOT NULL AND r.follow_up_at <= now() AND r.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress')`,
    );
  }
  if (params.search?.trim()) {
    values.push(`%${params.search.trim().toLowerCase()}%`);
    filters.push(
      `(lower(r.title) LIKE $${values.length} OR lower(b.name) LIKE $${values.length} OR lower(s.url) LIKE $${values.length})`,
    );
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const pageValues = [...values, params.limit, params.offset];
  const limitPlaceholder = `$${pageValues.length - 1}`;
  const offsetPlaceholder = `$${pageValues.length}`;
  const [rows, total, summary] = await Promise.all([
    client.query<OperationsReportRow>(
      `
        SELECT ${reportSelect()}
        FROM operations_reports r
        ${reportJoins()}
        ${where}
        ORDER BY r.updated_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      pageValues,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_reports r
        JOIN operations_businesses b ON b.id = r.business_id
        JOIN sites s ON s.id = r.site_id
        ${where}
      `,
      values,
    ),
    client.query<{
      draft: string;
      needs_review: string;
      ready_to_send: string;
      sent_this_month: string;
      awaiting_client_response: string;
      completed: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft' AND archived_at IS NULL)::text AS draft,
          COUNT(*) FILTER (WHERE status = 'needs_review' AND archived_at IS NULL)::text AS needs_review,
          COUNT(*) FILTER (WHERE status = 'ready_to_send' AND archived_at IS NULL)::text AS ready_to_send,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('month', now()) AND archived_at IS NULL)::text AS sent_this_month,
          COUNT(*) FILTER (WHERE status IN ('sent', 'client_replied') AND archived_at IS NULL)::text AS awaiting_client_response,
          COUNT(*) FILTER (WHERE status = 'completed' AND archived_at IS NULL)::text AS completed
        FROM operations_reports
      `,
    ),
  ]);

  const summaryRow = summary.rows[0];
  return {
    reports: rows.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: rows.rows.length,
    limit: params.limit,
    offset: params.offset,
    summary: {
      draft: countValue({ count: summaryRow?.draft ?? "0" }),
      needsReview: countValue({ count: summaryRow?.needs_review ?? "0" }),
      readyToSend: countValue({ count: summaryRow?.ready_to_send ?? "0" }),
      sentThisMonth: countValue({ count: summaryRow?.sent_this_month ?? "0" }),
      awaitingClientResponse: countValue({
        count: summaryRow?.awaiting_client_response ?? "0",
      }),
      completed: countValue({ count: summaryRow?.completed ?? "0" }),
    },
  };
}

export async function getOperationsReportDetail(
  reportId: string,
): Promise<OperationsReportDetail | null> {
  const report = await getReportById(reportId);
  if (!report) return null;
  const [
    findings,
    findingSources,
    positiveObservations,
    actionPlanItems,
    comparisonItems,
    activity,
  ] = await Promise.all([
    listFindings(reportId),
    listFindingSources(reportId),
    listPositiveObservations(reportId),
    listActionPlanItems(reportId),
    listComparisonItems(reportId),
    listReportActivity(reportId),
  ]);
  return {
    report,
    findings,
    findingSources,
    positiveObservations,
    actionPlanItems,
    comparisonItems,
    activity,
  };
}

export async function updateOperationsReport(
  actor: AdminActor,
  reportId: string,
  input: OperationsReportUpdateInput,
): Promise<OperationsReportDetail | null | "contact_not_found"> {
  const existing = await getReportById(reportId);
  if (!existing) return null;
  if (input.preparedContactId) {
    const client = await ensureConnected();
    const contact = await client.query<{ id: string }>(
      `SELECT id FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
      [input.preparedContactId, existing.business_id],
    );
    if (!contact.rows[0]) return "contact_not_found";
  }
  const client = await ensureConnected();
  const settings =
    input.displaySettings === undefined
      ? existing.display_settings_json
      : mergeDisplaySettings({
          ...existing.display_settings_json,
          ...input.displaySettings,
        });
  await client.query(
    `
      UPDATE operations_reports
      SET title = COALESCE($2, title),
          status = COALESCE($3, status),
          report_type = COALESCE($4, report_type),
          executive_summary = CASE WHEN $5::boolean THEN $6 ELSE executive_summary END,
          overall_summary = CASE WHEN $7::boolean THEN $8 ELSE overall_summary END,
          main_strengths = CASE WHEN $9::boolean THEN $10 ELSE main_strengths END,
          main_concerns = CASE WHEN $11::boolean THEN $12 ELSE main_concerns END,
          recommended_first_steps = CASE WHEN $13::boolean THEN $14 ELSE recommended_first_steps END,
          scope_limitations = CASE WHEN $15::boolean THEN $16 ELSE scope_limitations END,
          prepared_for = CASE WHEN $17::boolean THEN $18 ELSE prepared_for END,
          prepared_by = CASE WHEN $19::boolean THEN $20 ELSE prepared_by END,
          prepared_contact_id = CASE WHEN $21::boolean THEN $22 ELSE prepared_contact_id END,
          cover_date = COALESCE($23, cover_date),
          valid_until = CASE WHEN $24::boolean THEN $25 ELSE valid_until END,
          no_major_findings_waived = COALESCE($26, no_major_findings_waived),
          display_settings_json = $27,
          frozen_render_json = CASE WHEN status IN ('draft', 'needs_review') THEN NULL ELSE frozen_render_json END,
          frozen_at = CASE WHEN status IN ('draft', 'needs_review') THEN NULL ELSE frozen_at END,
          last_preview_generated_at = CASE WHEN status IN ('draft', 'needs_review') THEN NULL ELSE last_preview_generated_at END,
          last_pdf_generated_at = CASE WHEN status IN ('draft', 'needs_review') THEN NULL ELSE last_pdf_generated_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [
      reportId,
      input.title === undefined
        ? null
        : requiredText(input.title, "report_title"),
      input.status ?? null,
      input.reportType ?? null,
      input.executiveSummary !== undefined,
      textValue(input.executiveSummary),
      input.overallSummary !== undefined,
      textValue(input.overallSummary),
      input.mainStrengths !== undefined,
      textValue(input.mainStrengths),
      input.mainConcerns !== undefined,
      textValue(input.mainConcerns),
      input.recommendedFirstSteps !== undefined,
      textValue(input.recommendedFirstSteps),
      input.scopeLimitations !== undefined,
      textValue(input.scopeLimitations),
      input.preparedFor !== undefined,
      textValue(input.preparedFor),
      input.preparedBy !== undefined,
      textValue(input.preparedBy),
      input.preparedContactId !== undefined,
      input.preparedContactId ?? null,
      input.coverDate ?? null,
      input.validUntil !== undefined,
      input.validUntil ?? null,
      input.noMajorFindingsWaived,
      settings,
    ],
  );
  await invalidateEditableReportRender(reportId);
  await recordAdminAuditLog(actor, {
    action: "operations_report_updated",
    targetType: "operations_report",
    targetId: reportId,
    metadata: { fields: Object.keys(input) },
  });
  return getOperationsReportDetail(reportId);
}

export async function updateOperationsReportFinding(
  actor: AdminActor,
  reportId: string,
  findingId: string,
  input: OperationsReportFindingUpdateInput,
): Promise<OperationsReportFindingRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportFindingRow>(
    `
      UPDATE operations_report_findings
      SET client_priority = COALESCE($3, client_priority),
          title = COALESCE($4, title),
          client_explanation = CASE WHEN $5::boolean THEN $6 ELSE client_explanation END,
          why_it_matters = CASE WHEN $7::boolean THEN $8 ELSE why_it_matters END,
          recommended_action = CASE WHEN $9::boolean THEN $10 ELSE recommended_action END,
          client_evidence = CASE WHEN $11::boolean THEN $12 ELSE client_evidence END,
          affected_url_note = CASE WHEN $13::boolean THEN $14 ELSE affected_url_note END,
          internal_note = CASE WHEN $15::boolean THEN $16 ELSE internal_note END,
          false_positive_reason = CASE WHEN $17::boolean THEN $18 ELSE false_positive_reason END,
          review_note = CASE WHEN $19::boolean THEN $20 ELSE review_note END,
          reviewed_at = CASE WHEN $21::boolean THEN $22 ELSE reviewed_at END,
          estimated_effort = CASE WHEN $23::boolean THEN $24 ELSE estimated_effort END,
          is_included = COALESCE($25, is_included),
          is_false_positive = COALESCE($26, is_false_positive),
          display_order = COALESCE($27, display_order),
          comparison_status = CASE WHEN $28::boolean THEN $29 ELSE comparison_status END,
          affected_url = CASE WHEN $30::boolean THEN $31 ELSE affected_url END,
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      findingId,
      input.clientPriority ?? null,
      input.title === undefined
        ? null
        : requiredText(input.title, "finding_title"),
      input.clientExplanation !== undefined,
      textValue(input.clientExplanation),
      input.whyItMatters !== undefined,
      textValue(input.whyItMatters),
      input.recommendedAction !== undefined,
      textValue(input.recommendedAction),
      input.clientEvidence !== undefined,
      textValue(input.clientEvidence),
      input.affectedUrlNote !== undefined,
      textValue(input.affectedUrlNote),
      input.internalNote !== undefined,
      textValue(input.internalNote),
      input.falsePositiveReason !== undefined,
      textValue(input.falsePositiveReason),
      input.reviewNote !== undefined,
      textValue(input.reviewNote),
      input.reviewedAt !== undefined,
      input.reviewedAt ?? null,
      input.estimatedEffort !== undefined,
      textValue(input.estimatedEffort),
      input.isIncluded,
      input.isFalsePositive,
      input.displayOrder,
      input.comparisonStatus !== undefined,
      input.comparisonStatus ?? null,
      input.affectedUrl !== undefined,
      textValue(input.affectedUrl),
    ],
  );
  const finding = res.rows[0] ?? null;
  if (finding) {
    await invalidateEditableReportRender(reportId);
    await recordAdminAuditLog(actor, {
      action: "operations_report_finding_updated",
      targetType: "operations_report_finding",
      targetId: findingId,
      metadata: { reportId, fields: Object.keys(input) },
    });
  }
  return finding;
}

export async function updateOperationsReportPositiveObservation(
  actor: AdminActor,
  reportId: string,
  observationId: string,
  input: OperationsReportPositiveObservationUpdateInput,
): Promise<OperationsReportPositiveObservationRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportPositiveObservationRow>(
    `
      UPDATE operations_report_positive_observations
      SET title = COALESCE($3, title),
          description = CASE WHEN $4::boolean THEN $5 ELSE description END,
          is_included = COALESCE($6, is_included),
          reviewed_at = CASE WHEN $7::boolean THEN $8 ELSE reviewed_at END,
          display_order = COALESCE($9, display_order),
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      observationId,
      input.title === undefined
        ? null
        : requiredText(input.title, "positive_observation_title"),
      input.description !== undefined,
      textValue(input.description),
      input.isIncluded,
      input.reviewedAt !== undefined,
      input.reviewedAt ?? null,
      input.displayOrder,
    ],
  );
  const observation = res.rows[0] ?? null;
  if (observation) {
    await invalidateEditableReportRender(reportId);
    await recordAdminAuditLog(actor, {
      action: "operations_report_positive_observation_updated",
      targetType: "operations_report",
      targetId: reportId,
      metadata: { observationId, fields: Object.keys(input) },
    });
  }
  return observation;
}

export async function updateOperationsReportActionPlanItem(
  actor: AdminActor,
  reportId: string,
  itemId: string,
  input: OperationsReportActionPlanItemUpdateInput,
): Promise<OperationsReportActionPlanItemRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportActionPlanItemRow>(
    `
      UPDATE operations_report_action_plan_items
      SET group_key = COALESCE($3, group_key),
          title = COALESCE($4, title),
          summary = CASE WHEN $5::boolean THEN $6 ELSE summary END,
          is_included = COALESCE($7, is_included),
          reviewed_at = CASE WHEN $8::boolean THEN $9 ELSE reviewed_at END,
          display_order = COALESCE($10, display_order),
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      itemId,
      input.groupKey ?? null,
      input.title === undefined
        ? null
        : requiredText(input.title, "action_plan_item_title"),
      input.summary !== undefined,
      textValue(input.summary),
      input.isIncluded,
      input.reviewedAt !== undefined,
      input.reviewedAt ?? null,
      input.displayOrder,
    ],
  );
  const item = res.rows[0] ?? null;
  if (item) {
    await invalidateEditableReportRender(reportId);
    await recordAdminAuditLog(actor, {
      action: "operations_report_action_plan_item_updated",
      targetType: "operations_report",
      targetId: reportId,
      metadata: { itemId, fields: Object.keys(input) },
    });
  }
  return item;
}

export async function bulkUpdateOperationsReportFindings(
  actor: AdminActor,
  reportId: string,
  input: OperationsReportFindingBulkInput,
): Promise<OperationsReportFindingRow[]> {
  if (input.findingIds.length === 0) return [];
  const client = await ensureConnected();
  let setClause = "";
  const values: unknown[] = [reportId, input.findingIds];
  if (input.action === "include" || input.action === "restore") {
    setClause = "is_included = true, is_false_positive = false";
  } else if (input.action === "exclude") {
    setClause = "is_included = false";
  } else if (input.action === "change_priority") {
    values.push(input.clientPriority);
    setClause = `client_priority = $${values.length}`;
  } else {
    setClause = "reviewed_at = now()";
  }
  const res = await client.query<OperationsReportFindingRow>(
    `
      UPDATE operations_report_findings
      SET ${setClause},
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = ANY($2::uuid[])
      RETURNING *
    `,
    values,
  );
  if (res.rows.length > 0) await invalidateEditableReportRender(reportId);
  await recordAdminAuditLog(actor, {
    action: "operations_report_findings_bulk_updated",
    targetType: "operations_report",
    targetId: reportId,
    metadata: {
      action: input.action,
      count: res.rows.length,
      clientPriority: input.clientPriority ?? null,
    },
  });
  return res.rows;
}

export async function reorderOperationsReportFindings(
  actor: AdminActor,
  reportId: string,
  orderedFindingIds: string[],
) {
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    let index = 0;
    for (const id of orderedFindingIds) {
      await client.query(
        `
          UPDATE operations_report_findings
          SET display_order = $3,
              updated_at = now()
          WHERE operations_report_id = $1
            AND id = $2
        `,
        [reportId, id, index++],
      );
    }
    await client.query("COMMIT");
    await invalidateEditableReportRender(reportId);
    await recordAdminAuditLog(actor, {
      action: "operations_report_findings_reordered",
      targetType: "operations_report",
      targetId: reportId,
      metadata: { count: orderedFindingIds.length },
    });
    return listFindings(reportId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

const PLACEHOLDER_PATTERN = /(?:\{\{|\}\}|\[insert\]|\b(?:todo|tbc|tbd)\b)/i;

function clientTextProblem(
  value: string | null | undefined,
): "placeholder" | "unsafe_html" | null {
  if (!value) return null;
  if (/[<>]/.test(value)) return "unsafe_html";
  if (PLACEHOLDER_PATTERN.test(value)) return "placeholder";
  return null;
}

export function getOperationsReportReadinessIssues(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
  positiveObservations: OperationsReportPositiveObservationRow[] = [],
  actionPlanItems: OperationsReportActionPlanItemRow[] = [],
  options: { requirePreview?: boolean; requirePdf?: boolean } = {},
): OperationsReportReadinessIssue[] {
  const issues: OperationsReportReadinessIssue[] = [];
  const add = (
    code: string,
    message: string,
    section: OperationsReportReadinessSection,
    findingId?: string,
  ) => issues.push({ code, message, section, findingId });
  if (!textValue(report.title)) {
    add("report_title_missing", "Add a report title.", "settings");
  }
  if (!report.business_id || !report.site_id || !report.scan_run_id) {
    add(
      "report_relationship_invalid",
      "Confirm the business, website and source scan relationships.",
      "settings",
    );
  }
  const included = findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  if (included.length === 0 && !report.no_major_findings_waived) {
    add(
      "finding_required",
      "Include at least one finding or save an explicit no-major-findings summary.",
      "findings",
    );
  }
  const summaryFields: Array<[string, string | null]> = [
    ["introductory summary", report.overall_summary],
    ["overall website condition", report.executive_summary],
    ["main strengths", report.main_strengths],
    ["main concerns", report.main_concerns],
    ["recommended immediate actions", report.recommended_first_steps],
    ["scope and limitations", report.scope_limitations],
  ];
  for (const [label, value] of summaryFields) {
    if (!textValue(value)) {
      add(
        `summary_${label.replace(/\W+/g, "_")}_missing`,
        `Complete the ${label} field.`,
        "summary",
      );
    }
  }
  for (const finding of included) {
    const missing: string[] = [];
    if (!textValue(finding.client_priority)) missing.push("priority");
    if (!textValue(finding.title)) missing.push("title");
    if (!textValue(finding.client_explanation)) {
      missing.push("plain-English explanation");
    }
    if (!textValue(finding.why_it_matters)) missing.push("why it matters");
    if (!textValue(finding.recommended_action)) {
      missing.push("recommended action");
    }
    if (!hasClientUsableAffectedUrl(finding)) {
      missing.push("affected URL or no-URL reason");
    }
    if (!finding.reviewed_at) missing.push("administrator review");
    if (finding.requires_merge_review) missing.push("merged wording review");
    if (missing.length > 0) {
      add(
        "finding_incomplete",
        `Complete ${missing.join(", ")} for "${finding.title || "Untitled finding"}".`,
        "findings",
        finding.id,
      );
    }
  }
  for (const finding of findings.filter((item) => item.is_false_positive)) {
    if (!textValue(finding.false_positive_reason)) {
      add(
        "false_positive_reason_missing",
        `Record why "${finding.title || "Untitled finding"}" is a false positive.`,
        "findings",
        finding.id,
      );
    }
  }
  for (const observation of positiveObservations) {
    if (!observation.reviewed_at) {
      add(
        "positive_observation_unreviewed",
        `Review the positive observation "${observation.title}".`,
        "action_plan",
      );
    }
  }
  const includedFindingIds = new Set(included.map((finding) => finding.id));
  for (const item of actionPlanItems.filter(
    (action) =>
      action.report_finding_id == null ||
      includedFindingIds.has(action.report_finding_id),
  )) {
    if (!item.reviewed_at) {
      add(
        "action_plan_item_unreviewed",
        `Review the action-plan item "${item.title}".`,
        "action_plan",
      );
    }
  }
  const clientTextValues = [
    report.title,
    report.prepared_for,
    report.prepared_by,
    report.executive_summary,
    report.overall_summary,
    report.main_strengths,
    report.main_concerns,
    report.recommended_first_steps,
    report.scope_limitations,
    report.display_settings_json.confidentialNotice,
    report.display_settings_json.footerText,
    ...included.flatMap((finding) => [
      finding.title,
      finding.client_explanation,
      finding.why_it_matters,
      finding.recommended_action,
      finding.client_evidence,
      finding.affected_url_note,
      finding.estimated_effort,
    ]),
    ...positiveObservations.flatMap((item) => [item.title, item.description]),
    ...actionPlanItems.flatMap((item) => [item.title, item.summary]),
  ];
  if (
    clientTextValues.some((value) => clientTextProblem(value) === "placeholder")
  ) {
    add(
      "unresolved_placeholder",
      "Remove unresolved TODO, TBC, TBD, [insert] or template placeholders.",
      "preview",
    );
  }
  if (
    clientTextValues.some((value) => clientTextProblem(value) === "unsafe_html")
  ) {
    add(
      "unsafe_html",
      "Remove HTML-like markup from client-visible wording.",
      "preview",
    );
  }
  if (options.requirePreview && !report.last_preview_generated_at) {
    add(
      "preview_not_generated",
      "Open the saved client preview successfully.",
      "preview",
    );
  }
  if (options.requirePdf && !report.last_pdf_generated_at) {
    add("pdf_not_generated", "Generate and inspect the server PDF.", "preview");
  }
  return issues;
}

function hasClientUsableAffectedUrl(finding: OperationsReportFindingRow) {
  const affectedUrl = textValue(finding.affected_url);
  if (affectedUrl) {
    try {
      const parsed = new URL(affectedUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return true;
      }
    } catch {
      return false;
    }
  }
  return Boolean(textValue(finding.affected_url_note));
}

function emptyActionPlan(): OperationsClientReportPayload["actionPlan"] {
  return {
    address_now: [],
    address_soon: [],
    consider_later: [],
  };
}

function isCurrentClientReportPayload(
  payload: OperationsClientReportPayload | null,
): payload is OperationsClientReportPayload {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    "actionPlan" in payload &&
    Array.isArray(payload.positiveObservations) &&
    !payload.findings.some((finding) => "evidence" in finding),
  );
}

export function buildOperationsClientReportPayload(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
  positiveObservationRows: OperationsReportPositiveObservationRow[] = [],
  actionPlanItemRows: OperationsReportActionPlanItemRow[] = [],
  comparisonItems: OperationsReportComparisonItemRow[] = [],
): OperationsClientReportPayload {
  const included = findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  const priorityCounts = {
    critical: 0,
    important: 0,
    improvement: 0,
    informational: 0,
  } satisfies Record<OperationsReportClientPriority, number>;
  included.forEach((finding) => {
    priorityCounts[finding.client_priority] += 1;
  });
  const actionPlan = emptyActionPlan();
  const includedFindingIds = new Set(included.map((finding) => finding.id));
  for (const item of actionPlanItemRows.filter(
    (row) =>
      row.is_included &&
      row.reviewed_at &&
      (row.report_finding_id == null ||
        includedFindingIds.has(row.report_finding_id)),
  )) {
    actionPlan[item.group_key].push({
      title: item.title,
      summary: item.summary,
    });
  }
  return {
    report: {
      title: report.title,
      status: report.status,
      reportType: report.report_type,
      versionNumber: report.version_number,
      preparedFor: report.prepared_for,
      preparedBy: report.prepared_by,
      coverDate:
        dateOnly(report.cover_date) ?? new Date().toISOString().slice(0, 10),
      validUntil: dateOnly(report.valid_until),
      sentAt: iso(report.sent_at),
    },
    business: {
      name: report.business_name ?? "Client",
    },
    site: {
      url: report.site_url ?? "",
      displayName: report.site_display_name ?? null,
      domain: siteDomain(report.site_url ?? ""),
    },
    scan: {
      finishedAt: iso(report.scan_finished_at ?? null),
      checkedLinks: report.scan_checked_links ?? 0,
      totalLinks: report.scan_total_links ?? 0,
    },
    summaries: {
      executiveSummary: report.executive_summary,
      overallSummary: report.overall_summary,
      mainStrengths: report.main_strengths,
      mainConcerns: report.main_concerns,
      recommendedFirstSteps: report.recommended_first_steps,
      scopeLimitations: report.scope_limitations,
    },
    settings: mergeDisplaySettings(report.display_settings_json),
    priorityCounts,
    findings: included.map((finding) => ({
      priority: finding.client_priority,
      title: finding.title,
      affectedUrl: finding.affected_url,
      affectedUrlNote: finding.affected_url_note,
      whatWasFound: finding.client_explanation,
      whyItMatters: finding.why_it_matters,
      recommendedAction: finding.recommended_action,
      clientEvidence: finding.client_evidence,
      estimatedEffort: finding.estimated_effort,
      displayOrder: finding.display_order,
      comparisonStatus: finding.comparison_status,
      groupKey: finding.group_key,
      groupLabel: finding.group_label,
      occurrenceCount: finding.occurrence_count,
      affectedPageCount: finding.affected_page_count,
      affectedResourceCount: finding.affected_resource_count,
      representativeExamples: finding.representative_examples_json,
    })),
    actionPlan,
    positiveObservations: positiveObservationRows
      .filter((row) => row.is_included && row.reviewed_at)
      .map((row) => ({
        title: row.title,
        description: row.description,
      })),
    methodology: [
      "This report is based on publicly accessible pages checked by Scanlark.",
      "It reflects the selected scan date and website conditions can change afterwards.",
      "This is not a penetration test and does not guarantee search rankings, legal compliance or complete vulnerability coverage.",
      "Forms, authenticated areas and third-party services may require separate testing.",
    ],
    nextSteps: [
      "Review the priority findings first.",
      "Ask for clarification on any finding that is unclear.",
      "Confirm fixes with a fresh Scanlark re-test after changes are made.",
      "Discuss ongoing monitoring if recurring website checks would be useful.",
    ],
    comparison: comparisonItems.map((item) => ({
      status: item.comparison_status,
      summary: item.summary,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getOperationsReportPreview(reportId: string) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const client = await ensureConnected();
  const previewGeneratedAt = new Date();
  await client.query(
    `UPDATE operations_reports SET last_preview_generated_at = $2 WHERE id = $1`,
    [reportId, previewGeneratedAt],
  );
  detail.report.last_preview_generated_at = previewGeneratedAt;
  if (isCurrentClientReportPayload(detail.report.frozen_render_json)) {
    return {
      payload: detail.report.frozen_render_json,
      frozen: true,
      readinessIssues: getOperationsReportReadinessIssues(
        detail.report,
        detail.findings,
        detail.positiveObservations,
        detail.actionPlanItems,
        { requirePreview: true, requirePdf: true },
      ),
    };
  }
  return {
    payload: buildOperationsClientReportPayload(
      detail.report,
      detail.findings,
      detail.positiveObservations,
      detail.actionPlanItems,
      detail.comparisonItems,
    ),
    frozen: false,
    readinessIssues: getOperationsReportReadinessIssues(
      detail.report,
      detail.findings,
      detail.positiveObservations,
      detail.actionPlanItems,
      { requirePreview: true, requirePdf: true },
    ),
  };
}

export async function freezeOperationsReportRender(
  actor: AdminActor,
  reportId: string,
  action: string,
  renderedPayload?: OperationsClientReportPayload,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const payload =
    renderedPayload ??
    buildOperationsClientReportPayload(
      detail.report,
      detail.findings,
      detail.positiveObservations,
      detail.actionPlanItems,
      detail.comparisonItems,
    );
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE operations_reports
      SET frozen_render_json = $2,
          frozen_at = now(),
          last_pdf_generated_at = CASE WHEN $3 = 'operations_report_pdf_generated' THEN now() ELSE last_pdf_generated_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [reportId, payload, action],
  );
  await recordAdminAuditLog(actor, {
    action,
    targetType: "operations_report",
    targetId: reportId,
    metadata: { findingCount: payload.findings.length },
  });
  return payload;
}

export async function saveOperationsReportPdfRender(
  reportId: string,
  filename: string,
  pdfBytes: Buffer,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportPdfRenderRow>(
    `
      INSERT INTO operations_report_pdf_renders (
        operations_report_id,
        filename,
        pdf_bytes,
        generated_at
      )
      VALUES ($1, $2, $3, now())
      ON CONFLICT (operations_report_id)
      DO UPDATE SET
        filename = EXCLUDED.filename,
        pdf_bytes = EXCLUDED.pdf_bytes,
        generated_at = now()
      RETURNING *
    `,
    [reportId, requiredText(filename, "pdf_filename"), pdfBytes],
  );
  return res.rows[0];
}

export async function getOperationsReportPdfRender(reportId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportPdfRenderRow>(
    `
      SELECT operations_report_id, filename, pdf_bytes, generated_at
      FROM operations_report_pdf_renders
      WHERE operations_report_id = $1
    `,
    [reportId],
  );
  return res.rows[0] ?? null;
}

export async function markOperationsReportStatus(
  actor: AdminActor,
  reportId: string,
  status: OperationsReportStatus,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  if (status === "ready_to_send") {
    const issues = getOperationsReportReadinessIssues(
      detail.report,
      detail.findings,
      detail.positiveObservations,
      detail.actionPlanItems,
      { requirePreview: true, requirePdf: true },
    );
    if (issues.length > 0) return { readinessIssues: issues };
    if (!isCurrentClientReportPayload(detail.report.frozen_render_json)) {
      await freezeOperationsReportRender(
        actor,
        reportId,
        "operations_report_ready_render_frozen",
      );
    }
  }
  const client = await ensureConnected();
  const completedAt = status === "completed" ? new Date() : null;
  await client.query(
    `
      UPDATE operations_reports
      SET status = $2,
          completed_at = COALESCE($3, completed_at),
          archived_at = CASE WHEN $2 = 'archived' THEN now() ELSE archived_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [reportId, status, completedAt],
  );
  await recordAdminAuditLog(actor, {
    action: `operations_report_status_${status}`,
    targetType: "operations_report",
    targetId: reportId,
    metadata: {},
  });
  return getOperationsReportDetail(reportId);
}

export async function setOperationsReportArchived(
  actor: AdminActor,
  reportId: string,
  archived: boolean,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportRow>(
    `
      UPDATE operations_reports
      SET status = CASE WHEN $2 THEN 'archived' ELSE 'draft' END,
          archived_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [reportId, archived],
  );
  const report = res.rows[0];
  if (!report) return null;
  await recordAdminAuditLog(actor, {
    action: archived
      ? "operations_report_archived"
      : "operations_report_restored",
    targetType: "operations_report",
    targetId: reportId,
    metadata: {},
  });
  return getOperationsReportDetail(reportId);
}

export async function getOperationsReportDeleteEligibility(
  reportId: string,
): Promise<OperationsReportDeleteEligibility | null> {
  const report = await getReportById(reportId);
  if (!report) return null;
  const client = await ensureConnected();
  const [quotes, workOrders, serviceUsage, serviceActivity, communications] =
    await Promise.all([
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_quotes WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_work_orders WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_client_service_usage WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_client_service_activity WHERE related_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_communications WHERE operations_report_id = $1`,
        [reportId],
      ),
    ]);

  const reasons: string[] = [];
  const dependencyCounts: Record<string, number> = {};
  if (!["draft", "needs_review"].includes(report.status)) {
    reasons.push(`status is ${report.status}`);
  }
  if (report.sent_at || report.frozen_at || report.delivery_communication_id) {
    reasons.push("report has delivery or frozen history");
  }
  addDependencyReason(
    reasons,
    dependencyCounts,
    "quotes",
    countValue(quotes.rows[0]),
    "quotes",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "workOrders",
    countValue(workOrders.rows[0]),
    "work orders",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "serviceUsage",
    countValue(serviceUsage.rows[0]),
    "service usage",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "serviceActivity",
    countValue(serviceActivity.rows[0]),
    "service activity",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "communications",
    countValue(communications.rows[0]),
    "communications",
  );

  return { allowed: reasons.length === 0, reasons, dependencyCounts };
}

export async function deleteOperationsReport(
  actor: AdminActor,
  reportId: string,
): Promise<OperationsReportRow | null | OperationsReportDeleteEligibility> {
  const eligibility = await getOperationsReportDeleteEligibility(reportId);
  if (!eligibility) return null;
  if (!eligibility.allowed) return eligibility;

  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM operations_report_comparison_items WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_action_plan_items WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_positive_observations WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_findings WHERE operations_report_id = $1`,
      [reportId],
    );
    const res = await client.query<OperationsReportRow>(
      `DELETE FROM operations_reports WHERE id = $1 RETURNING *`,
      [reportId],
    );
    await client.query("COMMIT");
    const report = res.rows[0] ?? null;
    if (report) {
      await recordAdminAuditLog(actor, {
        action: "operations_report_deleted",
        targetType: "operations_report",
        targetId: reportId,
        metadata: {
          businessId: report.business_id,
          siteId: report.site_id,
          scanRunId: report.scan_run_id,
        },
      });
    }
    return report;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function duplicateOperationsReport(
  actor: AdminActor,
  reportId: string,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const created = await createOperationsReport(actor, {
    businessId: detail.report.business_id,
    siteId: detail.report.site_id,
    scanRunId: detail.report.scan_run_id,
    reportType: detail.report.report_type,
    title: `${detail.report.title} copy`,
    preparedContactId: detail.report.prepared_contact_id,
    preparedFor: detail.report.prepared_for,
    preparedBy: detail.report.prepared_by,
    allowDuplicate: true,
    supersedesReportId: detail.report.id,
  });
  return typeof created === "string" ? null : created;
}

export async function recordOperationsReportSent(
  actor: AdminActor,
  reportId: string,
  input: {
    contactId?: string | null;
    deliveryMethod: "email_attachment" | "secure_link" | "in_person" | "other";
    followUpAt?: Date | null;
    updatePipelineStage?: boolean;
  },
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  if (input.contactId) {
    const contact =
      detail.report.prepared_contact_id === input.contactId
        ? true
        : (await ensureConnected()).query<{ id: string }>(
            `SELECT id FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
            [input.contactId, detail.report.business_id],
          );
    if (contact !== true && !(await contact).rows[0])
      return "contact_not_found";
  }
  const payload = isCurrentClientReportPayload(detail.report.frozen_render_json)
    ? detail.report.frozen_render_json
    : buildOperationsClientReportPayload(
        detail.report,
        detail.findings,
        detail.positiveObservations,
        detail.actionPlanItems,
        detail.comparisonItems,
      );
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const communication = await client.query<{ id: string }>(
      `
        INSERT INTO operations_communications (
          business_id,
          contact_id,
          direction,
          channel,
          status,
          subject,
          body,
          sent_at,
          occurred_at,
          follow_up_at,
          created_by_user_id
        )
        VALUES ($1, $2, 'outbound', $3, 'sent', $4, $5, now(), now(), $6, $7)
        RETURNING id
      `,
      [
        detail.report.business_id,
        input.contactId ?? detail.report.prepared_contact_id,
        input.deliveryMethod === "in_person" ? "in_person" : "email",
        `Website health report sent: ${detail.report.title}`,
        `Recorded manual delivery of Operations report "${detail.report.title}" by ${input.deliveryMethod}.`,
        input.followUpAt ?? null,
        actor.id,
      ],
    );
    let taskId: string | null = null;
    if (input.followUpAt) {
      const task = await client.query<{ id: string }>(
        `
          INSERT INTO operations_tasks (
            business_id,
            contact_id,
            source_communication_id,
            title,
            notes,
            due_at,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          detail.report.business_id,
          input.contactId ?? detail.report.prepared_contact_id,
          communication.rows[0].id,
          `Follow up on report: ${detail.report.title}`,
          "Report delivery follow-up.",
          input.followUpAt,
          actor.id,
        ],
      );
      taskId = task.rows[0].id;
    }
    await client.query(
      `
        UPDATE operations_reports
        SET status = 'sent',
            sent_at = now(),
            follow_up_at = $2,
            delivery_communication_id = $3,
            follow_up_task_id = $4,
            frozen_render_json = $5,
            frozen_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [
        reportId,
        input.followUpAt ?? null,
        communication.rows[0].id,
        taskId,
        payload,
      ],
    );
    await client.query(
      `
        UPDATE operations_businesses
        SET last_contacted_at = now(),
            next_follow_up_at = COALESCE($2, next_follow_up_at),
            pipeline_stage = CASE WHEN $3 THEN 'report_sent' ELSE pipeline_stage END,
            updated_at = now()
        WHERE id = $1
      `,
      [
        detail.report.business_id,
        input.followUpAt ?? null,
        input.updatePipelineStage === true,
      ],
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations_report_sent",
      targetType: "operations_report",
      targetId: reportId,
      metadata: {
        deliveryMethod: input.deliveryMethod,
        communicationId: communication.rows[0].id,
        followUpScheduled: Boolean(input.followUpAt),
      },
    });
    return getOperationsReportDetail(reportId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function createOperationsReportRetest(
  actor: AdminActor,
  reportId: string,
  scanRunId: string,
  reportType: OperationsReportType = "post_fix_retest",
) {
  const original = await getOperationsReportDetail(reportId);
  if (!original) return null;
  const created = await createOperationsReport(actor, {
    businessId: original.report.business_id,
    siteId: original.report.site_id,
    scanRunId,
    reportType,
    title: `${original.report.title} re-test`,
    preparedContactId: original.report.prepared_contact_id,
    preparedFor: original.report.prepared_for,
    preparedBy: original.report.prepared_by,
    allowDuplicate: true,
    comparisonReportId: original.report.id,
  });
  if (typeof created === "string") return created;
  const client = await ensureConnected();
  const originalIncluded = original.findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  const currentByFingerprint = new Map(
    created.findings
      .filter((finding) => finding.source_fingerprint)
      .map((finding) => [finding.source_fingerprint as string, finding]),
  );
  try {
    await client.query("BEGIN");
    for (const finding of originalIncluded) {
      const current = finding.source_fingerprint
        ? currentByFingerprint.get(finding.source_fingerprint)
        : null;
      await client.query(
        `
          INSERT INTO operations_report_comparison_items (
            operations_report_id,
            original_finding_id,
            current_finding_id,
            source_fingerprint,
            comparison_status,
            summary
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          created.report.id,
          finding.id,
          current?.id ?? null,
          finding.source_fingerprint,
          current ? "still_present" : "resolved",
          current
            ? "A matching finding is still present in the re-test scan."
            : "No matching finding was imported from the re-test scan.",
        ],
      );
    }
    for (const current of created.findings) {
      if (
        current.source_fingerprint &&
        originalIncluded.some(
          (finding) =>
            finding.source_fingerprint === current.source_fingerprint,
        )
      ) {
        continue;
      }
      await client.query(
        `
          INSERT INTO operations_report_comparison_items (
            operations_report_id,
            current_finding_id,
            source_fingerprint,
            comparison_status,
            summary
          )
          VALUES ($1, $2, $3, 'new', 'This finding appears in the re-test scan but was not in the original reviewed report.')
        `,
        [created.report.id, current.id, current.source_fingerprint],
      );
    }
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations_report_retest_created",
      targetType: "operations_report",
      targetId: created.report.id,
      metadata: { originalReportId: reportId, scanRunId },
    });
    return getOperationsReportDetail(created.report.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function updateOperationsReportComparisonItem(
  actor: AdminActor,
  reportId: string,
  comparisonItemId: string,
  input: {
    comparisonStatus?: OperationsReportComparisonStatus;
    summary?: string | null;
    manualNote?: string | null;
  },
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportComparisonItemRow>(
    `
      UPDATE operations_report_comparison_items
      SET comparison_status = COALESCE($3, comparison_status),
          summary = CASE WHEN $4::boolean THEN $5 ELSE summary END,
          manual_note = CASE WHEN $6::boolean THEN $7 ELSE manual_note END,
          is_manually_overridden = true,
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      comparisonItemId,
      input.comparisonStatus ?? null,
      input.summary !== undefined,
      textValue(input.summary),
      input.manualNote !== undefined,
      textValue(input.manualNote),
    ],
  );
  const item = res.rows[0] ?? null;
  if (item) {
    await recordAdminAuditLog(actor, {
      action: "operations_report_comparison_updated",
      targetType: "operations_report_comparison",
      targetId: comparisonItemId,
      metadata: { reportId, status: item.comparison_status },
    });
  }
  return item;
}

export async function getOperationsReportCountsForSummary() {
  const client = await ensureConnected();
  const res = await client.query<{
    needs_review: string;
    ready_to_send: string;
    awaiting_response: string;
    follow_up_due: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'needs_review' AND archived_at IS NULL)::text AS needs_review,
        COUNT(*) FILTER (WHERE status = 'ready_to_send' AND archived_at IS NULL)::text AS ready_to_send,
        COUNT(*) FILTER (WHERE status IN ('sent', 'client_replied') AND archived_at IS NULL)::text AS awaiting_response,
        COUNT(*) FILTER (
          WHERE follow_up_at IS NOT NULL
            AND follow_up_at <= now()
            AND status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress')
            AND archived_at IS NULL
        )::text AS follow_up_due
      FROM operations_reports
    `,
  );
  const row = res.rows[0];
  return {
    reportsAwaitingReview: countValue({ count: row?.needs_review ?? "0" }),
    reportsReadyToSend: countValue({ count: row?.ready_to_send ?? "0" }),
    reportsAwaitingClientResponse: countValue({
      count: row?.awaiting_response ?? "0",
    }),
    reportFollowUpsDue: countValue({ count: row?.follow_up_due ?? "0" }),
  };
}
