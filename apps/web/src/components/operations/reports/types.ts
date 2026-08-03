export type OperationsReportStatus =
  | "draft"
  | "needs_review"
  | "ready_to_send"
  | "sent"
  | "client_replied"
  | "fixes_quoted"
  | "work_in_progress"
  | "completed"
  | "archived";

export type OperationsReportType =
  | "initial_health_check"
  | "follow_up"
  | "post_fix_retest"
  | "monthly_monitoring"
  | "incident"
  | "custom";

export type OperationsReportPriority =
  | "critical"
  | "important"
  | "improvement"
  | "informational";

export type OperationsComparisonStatus =
  | "resolved"
  | "still_present"
  | "improved"
  | "worsened"
  | "new"
  | "unable_to_compare";

export type OperationsReportActionPlanGroup =
  | "address_now"
  | "address_soon"
  | "consider_later";

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
  cover_date: string;
  valid_until: string | null;
  sent_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  follow_up_at: string | null;
  no_major_findings_waived: boolean;
  display_settings_json: Partial<OperationsReportDisplaySettings>;
  frozen_at: string | null;
  last_preview_generated_at: string | null;
  last_pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  site_url?: string | null;
  site_display_name?: string | null;
  included_findings?: number;
  excluded_findings?: number;
  incomplete_findings?: number;
  critical_findings?: number;
  important_findings?: number;
  improvement_findings?: number;
  informational_findings?: number;
};

export type OperationsReportFinding = {
  id: string;
  operations_report_id: string;
  source_issue_id: string | null;
  source_link_id: string | null;
  source_type: string;
  source_fingerprint: string | null;
  category: string;
  original_severity: string;
  client_priority: OperationsReportPriority;
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
  reviewed_at: string | null;
  internal_note: string | null;
  display_order: number;
  estimated_effort: string | null;
  comparison_status: OperationsComparisonStatus | null;
  group_key: string | null;
  group_label: string | null;
  source_issue_count: number;
  occurrence_count: number;
  affected_page_count: number;
  affected_resource_count: number;
  representative_examples_json: OperationsReportFindingExample[];
  requires_merge_review: boolean;
  regrouped_at: string | null;
  updated_at: string;
};

export type OperationsReportFindingExample = {
  affectedPageUrl: string | null;
  affectedResourceUrl: string | null;
  result: string | null;
  note: string | null;
};

export type OperationsReportFindingSource = {
  id: string;
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
};

export type OperationsReportPositiveObservation = {
  id: string;
  title: string;
  description: string | null;
  source_key: string | null;
  is_included: boolean;
  reviewed_at: string | null;
  display_order: number;
  updated_at: string;
};

export type OperationsReportActionPlanItem = {
  id: string;
  report_finding_id: string | null;
  group_key: OperationsReportActionPlanGroup;
  title: string;
  summary: string | null;
  is_included: boolean;
  reviewed_at: string | null;
  display_order: number;
  updated_at: string;
};

export type OperationsReportComparisonItem = {
  id: string;
  comparison_status: OperationsComparisonStatus;
  summary: string | null;
  manual_note: string | null;
};

export type OperationsReportActivity = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  created_at: string;
};

export type OperationsReportDetail = {
  report: OperationsReportRow;
  findings: OperationsReportFinding[];
  findingSources: OperationsReportFindingSource[];
  positiveObservations: OperationsReportPositiveObservation[];
  actionPlanItems: OperationsReportActionPlanItem[];
  comparisonItems: OperationsReportComparisonItem[];
  activity: OperationsReportActivity[];
};

export type ClientReportPayload = {
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
  business: { name: string };
  site: { url: string; displayName: string | null; domain: string };
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
  priorityCounts: Record<OperationsReportPriority, number>;
  findings: Array<{
    priority: OperationsReportPriority;
    title: string;
    affectedUrl: string | null;
    affectedUrlNote: string | null;
    whatWasFound: string | null;
    whyItMatters: string | null;
    recommendedAction: string | null;
    clientEvidence: string | null;
    estimatedEffort: string | null;
    displayOrder: number;
    comparisonStatus: OperationsComparisonStatus | null;
    groupKey: string | null;
    groupLabel: string | null;
    occurrenceCount: number;
    affectedPageCount: number;
    affectedResourceCount: number;
    representativeExamples: OperationsReportFindingExample[];
  }>;
  actionPlan: Record<
    OperationsReportActionPlanGroup,
    Array<{ title: string; summary: string | null }>
  >;
  positiveObservations: Array<{ title: string; description: string | null }>;
  methodology: string[];
  nextSteps: string[];
  comparison: Array<{
    status: OperationsComparisonStatus;
    summary: string | null;
  }>;
  generatedAt: string;
};

export type OperationsReportReadinessIssue = {
  code: string;
  message: string;
  section: "settings" | "summary" | "findings" | "action_plan" | "preview";
  findingId?: string;
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
  blockedReason: string | null;
  groups: Array<{
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
  }>;
};
