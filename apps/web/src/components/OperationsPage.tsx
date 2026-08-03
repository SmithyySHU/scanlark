import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { copyRichEmailToClipboard } from "../emailClipboard";
import { OperationsReportWorkspace } from "./operations/reports/OperationsReportWorkspace";
import type {
  OperationsReportReadinessIssue,
  OperationsReportRegroupPreview,
} from "./operations/reports/types";

type OperationsRouteKey =
  | "home"
  | "businesses"
  | "pipeline"
  | "tasks"
  | "communications"
  | "reports"
  | "quotes"
  | "work"
  | "services"
  | "servicePlans";

type PipelineStage =
  | "discovered"
  | "researched"
  | "ready_to_contact"
  | "email_sent"
  | "replied"
  | "report_requested"
  | "report_sent"
  | "quote_sent"
  | "won"
  | "ongoing_client"
  | "closed";

type RelationshipType =
  | "prospect"
  | "client"
  | "former_client"
  | "partner"
  | "other";

type CommunicationTemplateCategory =
  | "warm_introduction"
  | "cold_outreach"
  | "report_offer"
  | "report_delivery"
  | "no_reply_follow_up"
  | "interested_reply"
  | "pre_quote_questions"
  | "quote_delivery"
  | "access_request"
  | "work_started"
  | "work_completed"
  | "monitoring_offer"
  | "monthly_update"
  | "testimonial_request"
  | "referral_request"
  | "managed_service_proposal"
  | "service_activation"
  | "monitoring_started"
  | "monthly_report_delivery"
  | "website_issue_notification"
  | "client_action_required"
  | "allowance_nearing_limit"
  | "work_outside_plan"
  | "service_review"
  | "renewal_discussion"
  | "service_paused"
  | "cancellation_acknowledgement"
  | "service_ended"
  | "custom";

type CommunicationDirection = "outbound" | "inbound" | "internal_note";
type CommunicationChannel =
  | "email"
  | "phone"
  | "video_call"
  | "in_person"
  | "other";
type CommunicationStatus =
  | "draft"
  | "ready"
  | "sent"
  | "received"
  | "cancelled";
type CommunicationLayoutKey =
  | "personal_letter"
  | "report_delivery"
  | "commercial_document"
  | "status_alert";
type CommunicationAttachmentPolicy =
  | "none"
  | "client_report_pdf"
  | "quote_pdf"
  | "updated_report_pdf";
type CommunicationSignatureMode =
  | "include_scanlark_signature"
  | "use_mailbox_signature";
type TaskStatus = "open" | "completed" | "snoozed" | "cancelled";
type OperationsReportStatus =
  | "draft"
  | "needs_review"
  | "ready_to_send"
  | "sent"
  | "client_replied"
  | "fixes_quoted"
  | "work_in_progress"
  | "completed"
  | "archived";
type OperationsReportType =
  | "initial_health_check"
  | "follow_up"
  | "post_fix_retest"
  | "monthly_monitoring"
  | "incident"
  | "custom";
type OperationsReportPriority =
  | "critical"
  | "important"
  | "improvement"
  | "informational";
type OperationsComparisonStatus =
  | "resolved"
  | "still_present"
  | "improved"
  | "worsened"
  | "new"
  | "unable_to_compare";
type OperationsQuoteStatus =
  | "draft"
  | "needs_review"
  | "ready_to_send"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "cancelled"
  | "converted_to_work";
type OperationsQuoteItemType =
  | "website_fix"
  | "investigation"
  | "configuration"
  | "content_change"
  | "monitoring_setup"
  | "retest"
  | "consultation"
  | "other";
type OperationsAccessStatus =
  | "not_required"
  | "not_requested"
  | "requested"
  | "received"
  | "verified"
  | "no_longer_needed";
type OperationsWorkStatus =
  | "not_started"
  | "awaiting_access"
  | "ready_to_start"
  | "in_progress"
  | "waiting_for_client"
  | "blocked"
  | "ready_for_testing"
  | "testing"
  | "completed"
  | "cancelled";
type OperationsWorkPriority = "urgent" | "high" | "normal" | "low";
type OperationsWorkItemStatus =
  | "to_do"
  | "in_progress"
  | "waiting_for_client"
  | "blocked"
  | "ready_for_testing"
  | "completed"
  | "cancelled";
type OperationsRetestStatus =
  | "not_required"
  | "pending"
  | "passed"
  | "failed"
  | "unable_to_verify";

type OperationsServicePlanType =
  | "monitoring_only"
  | "monitoring_and_support"
  | "managed_care"
  | "custom";
type OperationsServiceBillingCadence =
  | "monthly"
  | "quarterly"
  | "annual"
  | "one_off"
  | "custom";
type OperationsServiceScanFrequency =
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "manual"
  | "custom";
type OperationsServiceReportFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "manual"
  | "custom";
type OperationsServiceReviewFrequency =
  | "monthly"
  | "quarterly"
  | "annual"
  | "manual"
  | "custom";
type OperationsClientServiceStatus =
  | "draft"
  | "proposed"
  | "pending_start"
  | "active"
  | "paused"
  | "review_due"
  | "cancellation_pending"
  | "cancelled"
  | "expired"
  | "completed";
type OperationsServiceUsageType =
  | "support"
  | "small_fix"
  | "review"
  | "report"
  | "incident_response"
  | "consultation"
  | "other";

type BusinessListFilter =
  | "active"
  | "follow_up"
  | "prospects"
  | "clients"
  | "ongoing"
  | "archived";

type OperationsSummary = {
  counts: {
    followUpsDue: number;
    prospectsAwaitingContact: number;
    reportsAwaitingReview: number;
    reportsReadyToSend: number;
    reportsAwaitingClientResponse: number;
    reportFollowUpsDue: number;
    criticalClientSites: number;
    quotesAwaitingResponse: number;
    quotesReadyToSend: number;
    quotesExpiringSoon: number;
    acceptedQuotesAwaitingConversion: number;
    openWorkItems: number;
    awaitingAccess: number;
    blockedWork: number;
    workReadyForTesting: number;
    activeServices: number;
    serviceReportsDue: number;
    serviceReviewsDue: number;
    managedSitesNeedingAttention: number;
    pausedServices: number;
    serviceRenewalsApproaching: number;
    cancellationsPending: number;
    activeServiceIncidents: number;
    monthlyReportsReadyToSend: number;
    clientActionsOutstanding: number;
  };
  monitoringAttention: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    detail: string;
    href: string;
    occurredAt: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    detail: string;
    href: string;
    occurredAt: string;
  }>;
  generatedAt: string;
};

type Business = {
  id: string;
  name: string;
  pipeline_stage: PipelineStage;
  relationship_type: RelationshipType;
  source: string | null;
  business_type: string | null;
  location: string | null;
  phone: string | null;
  general_email: string | null;
  website_url: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  next_action: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type BusinessListRow = Business & {
  primary_contact_id: string | null;
  primary_contact_first_name: string | null;
  primary_contact_last_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  linked_site_count: number;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: string | null;
  critical_issue_count: number;
  high_issue_count: number;
  active_incident_count: number;
};

type Contact = {
  id: string;
  business_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
  notes: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  preferred_channel: CommunicationChannel | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type LinkedSite = {
  site_id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  disabled_at: string | null;
  linked_at: string;
  uptime_enabled: boolean | null;
  active_incident_id: string | null;
  active_incident_started_at: string | null;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: string | null;
  latest_scan_started_at: string | null;
  latest_scan_score: number | null;
  critical_issue_count: number;
  high_issue_count: number;
};

type BusinessNote = {
  id: string;
  body: string;
  created_at: string;
  created_by_email: string | null;
};

type BusinessReport = {
  id: string;
  title: string;
  report_type: OperationsReportType;
  status: OperationsReportStatus;
  version_number: number;
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  included_findings: number;
  critical_findings: number;
  important_findings: number;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  finished_at: string | null;
  follow_up_at: string | null;
  archived_at: string | null;
};

type BusinessDetail = {
  business: Business;
  contacts: Contact[];
  primaryContact: Contact | null;
  linkedSites: LinkedSite[];
  notes: BusinessNote[];
  reports: BusinessReport[];
};

type AvailableSite = {
  id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  owner_email: string | null;
};

type CommunicationTemplate = {
  id: string;
  system_key: string | null;
  name: string;
  category: CommunicationTemplateCategory;
  subject_template: string;
  body_template: string;
  preheader_template: string | null;
  html_body_template: string | null;
  plain_text_template: string | null;
  layout_key: CommunicationLayoutKey;
  content_variants_json: CommunicationVariant[];
  subject_suggestions_json: string[];
  attachment_policy: CommunicationAttachmentPolicy;
  signature_mode: CommunicationSignatureMode;
  default_follow_up_business_days: number | null;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
};

type CommunicationVariant = {
  key: string;
  label: string;
  body?: string;
  html?: string;
  plainText?: string;
  preheader?: string;
};

type CommunicationAttachmentRequirement = {
  key: CommunicationAttachmentPolicy;
  label: string;
  required: boolean;
};

type OperationsSenderIdentity = {
  key: string;
  name: string;
  email: string;
};

type Communication = {
  id: string;
  business_id: string;
  contact_id: string | null;
  template_id: string | null;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  subject: string | null;
  body: string;
  preheader: string | null;
  html_fragment: string | null;
  html_document: string | null;
  plain_text_body: string | null;
  layout_key: CommunicationLayoutKey | null;
  wording_variant_key: string | null;
  signature_mode: CommunicationSignatureMode | null;
  sender_identity_key: string | null;
  sender_name: string | null;
  sender_email: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  public_asset_urls_json: string[];
  attachment_requirements_json: CommunicationAttachmentRequirement[];
  attachment_confirmed_at: string | null;
  attachment_confirmation_note: string | null;
  sent_at: string | null;
  received_at: string | null;
  occurred_at: string;
  follow_up_at: string | null;
  follow_up_completed_at: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  template_name?: string | null;
};

type OperationsTask = {
  id: string;
  business_id: string;
  contact_id: string | null;
  source_communication_id: string | null;
  title: string;
  notes: string | null;
  due_at: string;
  status: TaskStatus;
  completed_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
};

type OperationsReportRow = {
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
  display_settings_json: Record<string, unknown>;
  frozen_at: string | null;
  last_preview_generated_at: string | null;
  last_pdf_generated_at: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  site_url?: string | null;
  site_display_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  included_findings?: number;
  excluded_findings?: number;
  incomplete_findings?: number;
  critical_findings?: number;
  important_findings?: number;
  improvement_findings?: number;
  informational_findings?: number;
};

type OperationsReportFinding = {
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

type OperationsReportFindingExample = {
  affectedPageUrl: string | null;
  affectedResourceUrl: string | null;
  result: string | null;
  note: string | null;
};

type OperationsReportFindingSource = {
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

type OperationsReportPositiveObservation = {
  id: string;
  title: string;
  description: string | null;
  source_key: string | null;
  is_included: boolean;
  reviewed_at: string | null;
  display_order: number;
  updated_at: string;
};

type OperationsReportActionPlanGroup =
  | "address_now"
  | "address_soon"
  | "consider_later";

type OperationsReportActionPlanItem = {
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

type OperationsReportDisplaySettings = {
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

type OperationsReportComparisonItem = {
  id: string;
  comparison_status: OperationsComparisonStatus;
  summary: string | null;
  manual_note: string | null;
};

type OperationsReportActivity = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  created_at: string;
};

type OperationsReportDetail = {
  report: OperationsReportRow;
  findings: OperationsReportFinding[];
  findingSources: OperationsReportFindingSource[];
  positiveObservations: OperationsReportPositiveObservation[];
  actionPlanItems: OperationsReportActionPlanItem[];
  comparisonItems: OperationsReportComparisonItem[];
  activity: OperationsReportActivity[];
};

type ClientReportPayload = {
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
    healthScore: number | null;
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

type ReportFormState = {
  businessId: string;
  siteId: string;
  scanRunId: string;
  reportType: OperationsReportType;
  title: string;
  preparedContactId: string;
  preparedFor: string;
  allowDuplicate: boolean;
};

type OperationsQuoteItem = {
  id: string;
  quote_id: string;
  report_finding_id: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  item_type: OperationsQuoteItemType;
  is_optional: boolean;
  is_selected: boolean;
  display_order: number;
  estimated_effort: string | null;
  internal_notes: string | null;
  finding_title?: string | null;
  affected_url?: string | null;
};

type OperationsAccessRequirement = {
  id: string;
  quote_id?: string;
  work_order_id?: string;
  description: string;
  status: OperationsAccessStatus;
  requested_at: string | null;
  received_at: string | null;
  secure_storage_reference: string | null;
  notes: string | null;
  display_order: number;
};

type OperationsQuoteRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  operations_report_id: string | null;
  quote_number: string;
  title: string;
  status: OperationsQuoteStatus;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  valid_until: string | null;
  estimated_start_date: string | null;
  estimated_completion_date: string | null;
  estimated_duration_text: string | null;
  payment_terms: string | null;
  scope_summary: string | null;
  included_scope: string | null;
  excluded_scope: string | null;
  assumptions: string | null;
  client_responsibilities: string | null;
  access_requirements_summary: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  cancelled_at: string | null;
  frozen_at: string | null;
  converted_work_order_id: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  report_title?: string | null;
  report_site_url?: string | null;
  report_site_display_name?: string | null;
  item_count?: number;
};

type OperationsQuoteDetail = {
  quote: OperationsQuoteRow;
  items: OperationsQuoteItem[];
  accessRequirements: OperationsAccessRequirement[];
  statusHistory: Array<{
    id: string;
    previous_status: OperationsQuoteStatus | null;
    new_status: OperationsQuoteStatus;
    reason: string | null;
    created_at: string;
    admin_email?: string | null;
  }>;
  readinessIssues: string[];
  linkedWorkOrder: OperationsWorkOrderRow | null;
};

type OperationsQuotePreviewPayload = {
  quote: {
    quoteNumber: string;
    title: string;
    currency: string;
    validUntil: string | null;
    estimatedStartDate: string | null;
    estimatedCompletionDate: string | null;
    estimatedDurationText: string | null;
  };
  business: { name: string };
  contact: { name: string | null; email: string | null };
  report: { title: string | null; website: string | null } | null;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    itemType: OperationsQuoteItemType;
    isOptional: boolean;
    estimatedEffort: string | null;
  }>;
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    vatRegistered: boolean;
    vatRatePercent: number;
    vatNotice: string;
  };
  scope: {
    summary: string | null;
    included: string | null;
    excluded: string | null;
    assumptions: string | null;
    clientResponsibilities: string | null;
    accessRequirementsSummary: string | null;
    paymentTerms: string | null;
  };
  limitations: string[];
  generatedAt: string;
};

type OperationsWorkOrderRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  quote_id: string;
  operations_report_id: string | null;
  work_order_number: string;
  title: string;
  status: OperationsWorkStatus;
  priority: OperationsWorkPriority;
  scope_summary: string | null;
  accepted_total_minor: number;
  currency: string;
  started_at: string | null;
  target_completion_at: string | null;
  completed_at: string | null;
  blocked_reason: string | null;
  client_waiting_reason: string | null;
  completion_summary: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  quote_number?: string | null;
  quote_title?: string | null;
  report_title?: string | null;
  active_item_count?: number;
  completed_item_count?: number;
  outstanding_access_count?: number;
};

type OperationsWorkItem = {
  id: string;
  work_order_id: string;
  quote_item_id: string | null;
  report_finding_id: string | null;
  title: string;
  description: string | null;
  status: OperationsWorkItemStatus;
  display_order: number;
  completed_at: string | null;
  completion_notes: string | null;
  client_visible_completion_notes: string | null;
  requires_retest: boolean;
  retest_status: OperationsRetestStatus;
  internal_notes: string | null;
  finding_title?: string | null;
};

type OperationsWorkOrderDetail = {
  workOrder: OperationsWorkOrderRow;
  items: OperationsWorkItem[];
  accessRequirements: OperationsAccessRequirement[];
  completionIssues: string[];
};

type OperationsServicePlanRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  plan_type: OperationsServicePlanType;
  default_currency: string;
  default_price_minor: number;
  default_billing_cadence: OperationsServiceBillingCadence;
  default_scan_frequency: OperationsServiceScanFrequency;
  default_report_frequency: OperationsServiceReportFrequency;
  default_review_frequency: OperationsServiceReviewFrequency;
  includes_uptime_monitoring: boolean;
  includes_issue_alerts: boolean;
  includes_monthly_report: boolean;
  includes_advice: boolean;
  includes_small_fixes: boolean;
  included_support_minutes: number | null;
  included_fix_count: number | null;
  response_target_text: string | null;
  scope_summary: string | null;
  included_scope: string | null;
  excluded_scope: string | null;
  is_active: boolean;
  archived_at: string | null;
  active_service_count?: number;
};

type OperationsClientServiceRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  service_plan_id: string | null;
  source_quote_id: string | null;
  source_work_order_id: string | null;
  service_number: string;
  name: string;
  status: OperationsClientServiceStatus;
  currency: string;
  agreed_price_minor: number;
  zero_cost_confirmed: boolean;
  billing_cadence: OperationsServiceBillingCadence;
  start_date: string | null;
  next_report_at: string | null;
  next_review_at: string | null;
  renewal_date: string | null;
  renewal_reminder_at: string | null;
  scan_frequency: OperationsServiceScanFrequency;
  report_frequency: OperationsServiceReportFrequency;
  review_frequency: OperationsServiceReviewFrequency;
  includes_uptime_monitoring: boolean;
  includes_issue_alerts: boolean;
  includes_monthly_report: boolean;
  includes_advice: boolean;
  includes_small_fixes: boolean;
  included_support_minutes: number | null;
  included_fix_count: number | null;
  response_target_text: string | null;
  scope_summary: string | null;
  included_scope: string | null;
  excluded_scope: string | null;
  custom_terms: string | null;
  internal_notes: string | null;
  proposed_at: string | null;
  activated_at: string | null;
  paused_at: string | null;
  cancellation_requested_at: string | null;
  cancelled_at: string | null;
  ended_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  business_name?: string | null;
  business_website_url?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  plan_name?: string | null;
  plan_type?: OperationsServicePlanType | null;
  covered_site_count?: number;
  site_attention_count?: number;
  open_task_count?: number;
  last_activity_at?: string | null;
};

type OperationsClientServiceSite = {
  id: string;
  client_service_id: string;
  site_id: string;
  is_primary: boolean;
  monitoring_enabled: boolean;
  uptime_monitoring_enabled: boolean;
  scan_frequency_override: OperationsServiceScanFrequency | null;
  report_frequency_override: OperationsServiceReportFrequency | null;
  schedule_managed_by_service: boolean;
  added_at: string;
  removed_at: string | null;
  notes: string | null;
  site_url?: string | null;
  site_display_name?: string | null;
  latest_scan_id?: string | null;
  latest_scan_status?: string | null;
  latest_scan_finished_at?: string | null;
  latest_scan_score?: number | null;
  critical_issue_count?: number;
  high_issue_count?: number;
  active_incident_count?: number;
  next_scheduled_at?: string | null;
  schedule_enabled?: boolean | null;
  schedule_frequency?: string | null;
};

type OperationsClientServiceUsage = {
  id: string;
  usage_type: OperationsServiceUsageType;
  description: string;
  minutes_used: number | null;
  fixes_used: number | null;
  occurred_at: string;
  service_period_start: string;
  service_period_end: string;
  is_out_of_scope: boolean;
  outside_scope_reason: string | null;
  internal_notes: string | null;
};

type OperationsClientServiceDetail = {
  service: OperationsClientServiceRow;
  sites: OperationsClientServiceSite[];
  usage: OperationsClientServiceUsage[];
  activities: Array<{
    id: string;
    activity_type: string;
    title: string;
    detail: string | null;
    occurred_at: string;
  }>;
  reviews: Array<{
    id: string;
    outcome: string;
    review_completed_at: string | null;
    next_review_at: string | null;
    renewal_recommendation: string | null;
  }>;
  incidents: Array<{
    id: string;
    title: string;
    severity: "critical" | "warning" | "info";
    review_state: string;
    detected_at: string;
  }>;
  reports: Array<{
    id: string;
    title: string;
    status: OperationsReportStatus;
    report_type: OperationsReportType;
    site_url: string | null;
    updated_at: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    due_at: string;
    status: TaskStatus;
    source_key: string | null;
  }>;
  allowance: {
    periodStart: string;
    periodEnd: string;
    minutesIncluded: number | null;
    minutesUsed: number;
    minutesRemaining: number | null;
    fixesIncluded: number | null;
    fixesUsed: number;
    fixesRemaining: number | null;
    rolloverEnabled: boolean;
    warning: string | null;
  };
  activationIssues: string[];
};

type ServiceFormState = {
  businessId: string;
  contactId: string;
  servicePlanId: string;
  sourceQuoteId: string;
  sourceWorkOrderId: string;
  name: string;
  currency: string;
  agreedPrice: string;
  zeroCostConfirmed: boolean;
  billingCadence: OperationsServiceBillingCadence;
  startDate: string;
  renewalDate: string;
  scanFrequency: OperationsServiceScanFrequency;
  reportFrequency: OperationsServiceReportFrequency;
  reviewFrequency: OperationsServiceReviewFrequency;
  includedScope: string;
  excludedScope: string;
  scopeSummary: string;
  customTerms: string;
  siteIds: string[];
};

type ServiceUsageFormState = {
  usageType: OperationsServiceUsageType;
  description: string;
  minutesUsed: string;
  fixesUsed: string;
  isOutOfScope: boolean;
  outsideScopeReason: string;
};

type QuoteFormState = {
  businessId: string;
  contactId: string;
  operationsReportId: string;
  title: string;
  currency: string;
  scopeSummary: string;
  includedScope: string;
  excludedScope: string;
  paymentTerms: string;
  validUntil: string;
};

type QuoteItemFormState = {
  title: string;
  description: string;
  quantity: string;
  unitPrice: string;
  itemType: OperationsQuoteItemType;
  isOptional: boolean;
  isSelected: boolean;
  estimatedEffort: string;
};

type QuoteFormErrors = Partial<
  Record<
    "businessId" | "currency" | "title" | "scopeSummary" | "contactId",
    string
  >
>;

type BusinessFormState = {
  name: string;
  websiteUrl: string;
  generalEmail: string;
  phone: string;
  businessType: string;
  location: string;
  source: string;
  pipelineStage: PipelineStage;
  relationshipType: RelationshipType;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  initialNote: string;
  nextFollowUpAt: string;
  nextAction: string;
};

type ContactFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  notes: string;
  isPrimary: boolean;
  doNotContact: boolean;
  doNotContactReason: string;
  preferredChannel: "" | CommunicationChannel;
};

type CommunicationFormState = {
  businessId: string;
  contactId: string;
  templateId: string;
  direction: CommunicationDirection;
  channel: CommunicationChannel;
  status: CommunicationStatus;
  subject: string;
  preheader: string;
  body: string;
  htmlFragment: string;
  htmlDocument: string;
  plainTextBody: string;
  layoutKey: CommunicationLayoutKey;
  wordingVariantKey: string;
  signatureMode: CommunicationSignatureMode;
  senderIdentityKey: string;
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  publicAssetUrls: string[];
  attachmentRequirements: CommunicationAttachmentRequirement[];
  attachmentConfirmed: boolean;
  attachmentConfirmationNote: string;
  templateSnapshot: Record<string, unknown> | null;
  renderWarnings: string[];
  previewMode: "desktop" | "narrow" | "images_hidden" | "plain_text";
  copyStatus: string;
  hasUnsavedRenderEdits: boolean;
  renderStatus: "idle" | "rendering" | "current" | "stale" | "failed";
  renderVersion: number;
  lastRenderedAt: string;
  lastSavedAt: string;
  followUpAt: string;
  taskTitle: string;
  taskNotes: string;
  unresolvedPlaceholders: string[];
};

type CommunicationFilterStatus =
  | "all"
  | "draft"
  | "ready"
  | "sent"
  | "received"
  | "cancelled"
  | "follow_up_due";

type TemplateFormState = {
  name: string;
  category: CommunicationTemplateCategory;
  subjectTemplate: string;
  preheaderTemplate: string;
  bodyTemplate: string;
  htmlBodyTemplate: string;
  plainTextTemplate: string;
  layoutKey: CommunicationLayoutKey;
  contentVariantsJson: CommunicationVariant[];
  subjectSuggestionsJson: string[];
  attachmentPolicy: CommunicationAttachmentPolicy;
  signatureMode: CommunicationSignatureMode;
  defaultFollowUpBusinessDays: string;
  isActive: boolean;
};

type OperationsPageProps = {
  apiBase: string;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  currentPath: string;
  currentSearch: string;
  authEmail: string;
  onNavigate: (href: string) => void;
  onLogout: () => void;
  embedded?: boolean;
};

const pipelineStageOptions: Array<{ value: PipelineStage; label: string }> = [
  { value: "discovered", label: "Discovered" },
  { value: "researched", label: "Researched" },
  { value: "ready_to_contact", label: "Ready to contact" },
  { value: "email_sent", label: "Email sent" },
  { value: "replied", label: "Replied" },
  { value: "report_requested", label: "Report requested" },
  { value: "report_sent", label: "Report sent" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "won", label: "Won" },
  { value: "ongoing_client", label: "Ongoing client" },
  { value: "closed", label: "Closed" },
];

const relationshipTypeOptions: Array<{
  value: RelationshipType;
  label: string;
}> = [
  { value: "prospect", label: "Prospect" },
  { value: "client", label: "Client" },
  { value: "former_client", label: "Former client" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const communicationTemplateCategoryOptions: Array<{
  value: CommunicationTemplateCategory;
  label: string;
}> = [
  { value: "warm_introduction", label: "Warm introduction" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "report_offer", label: "Report offer" },
  { value: "report_delivery", label: "Report delivery" },
  { value: "no_reply_follow_up", label: "No-reply follow-up" },
  { value: "interested_reply", label: "Interested reply" },
  { value: "pre_quote_questions", label: "Pre-quote questions" },
  { value: "quote_delivery", label: "Quote delivery" },
  { value: "access_request", label: "Access request" },
  { value: "work_started", label: "Work started" },
  { value: "work_completed", label: "Work completed" },
  { value: "monitoring_offer", label: "Monitoring offer" },
  { value: "monthly_update", label: "Monthly update" },
  { value: "testimonial_request", label: "Testimonial request" },
  { value: "referral_request", label: "Referral request" },
  { value: "managed_service_proposal", label: "Managed service proposal" },
  { value: "service_activation", label: "Service activation" },
  { value: "monitoring_started", label: "Monitoring started" },
  { value: "monthly_report_delivery", label: "Monthly report delivery" },
  { value: "website_issue_notification", label: "Website issue notification" },
  { value: "client_action_required", label: "Client action required" },
  { value: "allowance_nearing_limit", label: "Allowance nearing limit" },
  { value: "work_outside_plan", label: "Work outside plan" },
  { value: "service_review", label: "Service review" },
  { value: "renewal_discussion", label: "Renewal discussion" },
  { value: "service_paused", label: "Service paused" },
  {
    value: "cancellation_acknowledgement",
    label: "Cancellation acknowledgement",
  },
  { value: "service_ended", label: "Service ended" },
  { value: "custom", label: "Custom" },
];

const communicationLayoutOptions: Array<{
  value: CommunicationLayoutKey;
  label: string;
}> = [
  { value: "personal_letter", label: "Personal letter" },
  { value: "report_delivery", label: "Report delivery" },
  { value: "commercial_document", label: "Commercial document" },
  { value: "status_alert", label: "Status alert" },
];

const communicationAttachmentOptions: Array<{
  value: CommunicationAttachmentPolicy;
  label: string;
}> = [
  { value: "none", label: "No attachment required" },
  { value: "client_report_pdf", label: "Attach client report PDF" },
  { value: "quote_pdf", label: "Attach quote PDF" },
  { value: "updated_report_pdf", label: "Attach updated/re-test report" },
];

const communicationChannelOptions: Array<{
  value: CommunicationChannel;
  label: string;
}> = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "video_call", label: "Video call" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Other" },
];

const operationsReportTypeOptions: Array<{
  value: OperationsReportType;
  label: string;
}> = [
  { value: "initial_health_check", label: "Initial health check" },
  { value: "follow_up", label: "Follow-up" },
  { value: "post_fix_retest", label: "Post-fix re-test" },
  { value: "monthly_monitoring", label: "Monthly monitoring" },
  { value: "incident", label: "Incident" },
  { value: "custom", label: "Custom" },
];

const operationsReportPriorityOptions: Array<{
  value: OperationsReportPriority;
  label: string;
}> = [
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "improvement", label: "Improvement" },
  { value: "informational", label: "Informational" },
];

const operationsReportStatusLabels: Record<OperationsReportStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  ready_to_send: "Ready to send",
  sent: "Sent",
  client_replied: "Client replied",
  fixes_quoted: "Fixes quoted",
  work_in_progress: "Work in progress",
  completed: "Completed",
  archived: "Archived",
};

const quoteStatusLabels: Record<OperationsQuoteStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  ready_to_send: "Ready to send",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
  converted_to_work: "Converted to work",
};

const quoteItemTypeOptions: Array<{
  value: OperationsQuoteItemType;
  label: string;
}> = [
  { value: "website_fix", label: "Website fix" },
  { value: "investigation", label: "Investigation" },
  { value: "configuration", label: "Configuration" },
  { value: "content_change", label: "Content change" },
  { value: "monitoring_setup", label: "Monitoring setup" },
  { value: "retest", label: "Re-test" },
  { value: "consultation", label: "Consultation" },
  { value: "other", label: "Other" },
];

const quoteCurrencyOptions = [
  { value: "GBP", label: "GBP — British pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — US dollar" },
] as const;

const workStatusLabels: Record<OperationsWorkStatus, string> = {
  not_started: "Not started",
  awaiting_access: "Awaiting access",
  ready_to_start: "Ready to start",
  in_progress: "In progress",
  waiting_for_client: "Waiting for client",
  blocked: "Blocked",
  ready_for_testing: "Ready for testing",
  testing: "Testing",
  completed: "Completed",
  cancelled: "Cancelled",
};

const workPriorityLabels: Record<OperationsWorkPriority, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

const serviceStatusLabels: Record<OperationsClientServiceStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  pending_start: "Pending start",
  active: "Active",
  paused: "Paused",
  review_due: "Review due",
  cancellation_pending: "Cancellation pending",
  cancelled: "Cancelled",
  expired: "Expired",
  completed: "Completed",
};

const servicePlanTypeLabels: Record<OperationsServicePlanType, string> = {
  monitoring_only: "Monitoring only",
  monitoring_and_support: "Monitoring and support",
  managed_care: "Managed care",
  custom: "Custom",
};

const serviceCadenceLabels: Record<OperationsServiceBillingCadence, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  one_off: "One-off",
  custom: "Custom",
};

const routeItems: Array<{
  key: OperationsRouteKey;
  label: string;
  href: string;
}> = [
  { key: "home", label: "Home", href: "/operations" },
  { key: "businesses", label: "Businesses", href: "/operations/businesses" },
  { key: "pipeline", label: "Pipeline", href: "/operations/pipeline" },
  { key: "tasks", label: "Tasks", href: "/operations/tasks" },
  {
    key: "communications",
    label: "Communications",
    href: "/operations/communications",
  },
  { key: "reports", label: "Reports", href: "/operations/reports" },
  { key: "quotes", label: "Quotes", href: "/operations/quotes" },
  { key: "work", label: "Work", href: "/operations/work" },
  { key: "services", label: "Services", href: "/operations/services" },
  {
    key: "servicePlans",
    label: "Service Plans",
    href: "/operations/service-plans",
  },
];

const placeholderContent: Record<
  Exclude<
    OperationsRouteKey,
    | "home"
    | "businesses"
    | "pipeline"
    | "reports"
    | "quotes"
    | "work"
    | "services"
    | "servicePlans"
  >,
  {
    eyebrow: string;
    title: string;
    body: string;
    action: string;
    bullets: string[];
  }
> = {
  tasks: {
    eyebrow: "Daily work",
    title: "Tasks",
    body: "Manage follow-ups, report reviews, re-scans, client work, and recurring monitoring tasks.",
    action: "View follow-ups",
    bullets: [
      "Follow-ups",
      "Report reviews",
      "Re-scans",
      "Client work",
      "Recurring monitoring tasks",
    ],
  },
  communications: {
    eyebrow: "Client messaging",
    title: "Communications",
    body: "Manage client outreach drafts, sent communication records, email templates, and follow-up reminders separately from automated transactional email templates.",
    action: "Open businesses",
    bullets: [
      "Client email templates",
      "Outreach drafts",
      "Sent communication records",
      "Follow-up reminders",
    ],
  },
};

const emptySummary: OperationsSummary = {
  counts: {
    followUpsDue: 0,
    prospectsAwaitingContact: 0,
    reportsAwaitingReview: 0,
    reportsReadyToSend: 0,
    reportsAwaitingClientResponse: 0,
    reportFollowUpsDue: 0,
    criticalClientSites: 0,
    quotesAwaitingResponse: 0,
    quotesReadyToSend: 0,
    quotesExpiringSoon: 0,
    acceptedQuotesAwaitingConversion: 0,
    openWorkItems: 0,
    awaitingAccess: 0,
    blockedWork: 0,
    workReadyForTesting: 0,
    activeServices: 0,
    serviceReportsDue: 0,
    serviceReviewsDue: 0,
    managedSitesNeedingAttention: 0,
    pausedServices: 0,
    serviceRenewalsApproaching: 0,
    cancellationsPending: 0,
    activeServiceIncidents: 0,
    monthlyReportsReadyToSend: 0,
    clientActionsOutstanding: 0,
  },
  monitoringAttention: [],
  recentActivity: [],
  generatedAt: new Date(0).toISOString(),
};

const emptyBusinessForm: BusinessFormState = {
  name: "",
  websiteUrl: "",
  generalEmail: "",
  phone: "",
  businessType: "",
  location: "",
  source: "",
  pipelineStage: "discovered",
  relationshipType: "prospect",
  primaryContactName: "",
  primaryContactEmail: "",
  primaryContactPhone: "",
  initialNote: "",
  nextFollowUpAt: "",
  nextAction: "",
};

const emptyContactForm: ContactFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  notes: "",
  isPrimary: false,
  doNotContact: false,
  doNotContactReason: "",
  preferredChannel: "",
};

const emptyCommunicationForm: CommunicationFormState = {
  businessId: "",
  contactId: "",
  templateId: "",
  direction: "outbound",
  channel: "email",
  status: "draft",
  subject: "",
  preheader: "",
  body: "",
  htmlFragment: "",
  htmlDocument: "",
  plainTextBody: "",
  layoutKey: "personal_letter",
  wordingVariantKey: "",
  signatureMode: "include_scanlark_signature",
  senderIdentityKey: "",
  senderName: "",
  senderEmail: "",
  recipientName: "",
  recipientEmail: "",
  publicAssetUrls: [],
  attachmentRequirements: [],
  attachmentConfirmed: false,
  attachmentConfirmationNote: "",
  templateSnapshot: null,
  renderWarnings: [],
  previewMode: "desktop",
  copyStatus: "",
  hasUnsavedRenderEdits: false,
  renderStatus: "idle",
  renderVersion: 0,
  lastRenderedAt: "",
  lastSavedAt: "",
  followUpAt: "",
  taskTitle: "",
  taskNotes: "",
  unresolvedPlaceholders: [],
};

const emptyTemplateForm: TemplateFormState = {
  name: "",
  category: "custom",
  subjectTemplate: "",
  preheaderTemplate: "",
  bodyTemplate: "",
  htmlBodyTemplate: "",
  plainTextTemplate: "",
  layoutKey: "personal_letter",
  contentVariantsJson: [],
  subjectSuggestionsJson: [],
  attachmentPolicy: "none",
  signatureMode: "include_scanlark_signature",
  defaultFollowUpBusinessDays: "",
  isActive: true,
};

const operationsWebmailUrl =
  import.meta.env.VITE_OPERATIONS_WEBMAIL_URL ?? "https://mail.ionos.co.uk/";
const communicationPlaceholderTokenRe = /{{[^{}]*}}/g;
const supportedCommunicationPlaceholders = [
  "firstName",
  "lastName",
  "contactName",
  "businessName",
  "websiteUrl",
  "websiteDomain",
  "senderName",
  "senderEmail",
  "reportName",
  "criticalIssueCount",
  "highIssueCount",
  "topFinding",
  "followUpDate",
];

const emptyReportForm: ReportFormState = {
  businessId: "",
  siteId: "",
  scanRunId: "",
  reportType: "initial_health_check",
  title: "",
  preparedContactId: "",
  preparedFor: "",
  allowDuplicate: false,
};

const emptyQuoteForm: QuoteFormState = {
  businessId: "",
  contactId: "",
  operationsReportId: "",
  title: "",
  currency: "GBP",
  scopeSummary: "",
  includedScope: "",
  excludedScope: "",
  paymentTerms: "Payment due on completion unless otherwise agreed.",
  validUntil: "",
};

const emptyQuoteItemForm: QuoteItemFormState = {
  title: "",
  description: "",
  quantity: "1",
  unitPrice: "0.00",
  itemType: "website_fix",
  isOptional: false,
  isSelected: true,
  estimatedEffort: "",
};

const emptyServiceForm: ServiceFormState = {
  businessId: "",
  contactId: "",
  servicePlanId: "",
  sourceQuoteId: "",
  sourceWorkOrderId: "",
  name: "",
  currency: "GBP",
  agreedPrice: "0.00",
  zeroCostConfirmed: false,
  billingCadence: "monthly",
  startDate: "",
  renewalDate: "",
  scanFrequency: "weekly",
  reportFrequency: "monthly",
  reviewFrequency: "quarterly",
  includedScope: "",
  excludedScope: "",
  scopeSummary: "",
  customTerms: "",
  siteIds: [],
};

const emptyServiceUsageForm: ServiceUsageFormState = {
  usageType: "support",
  description: "",
  minutesUsed: "",
  fixesUsed: "",
  isOutOfScope: false,
  outsideScopeReason: "",
};

function getRouteKey(path: string): OperationsRouteKey {
  const normalized = path.replace(/\/+$/, "") || "/operations";
  if (normalized === "/operations") return "home";
  if (normalized === "/operations/pipeline") return "pipeline";
  if (
    normalized === "/operations/reports" ||
    normalized.startsWith("/operations/reports/")
  ) {
    return "reports";
  }
  if (
    normalized === "/operations/quotes" ||
    normalized.startsWith("/operations/quotes/")
  ) {
    return "quotes";
  }
  if (
    normalized === "/operations/work" ||
    normalized.startsWith("/operations/work/")
  ) {
    return "work";
  }
  if (
    normalized === "/operations/services" ||
    normalized.startsWith("/operations/services/")
  ) {
    return "services";
  }
  if (normalized === "/operations/service-plans") {
    return "servicePlans";
  }
  if (
    normalized === "/operations/businesses" ||
    normalized.startsWith("/operations/businesses/")
  ) {
    return "businesses";
  }
  const found = routeItems.find((item) => item.href === normalized);
  return found?.key ?? "home";
}

function getOperationsReportIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/reports/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  return id || null;
}

function getOperationsQuoteIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/quotes/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  if (!id || id === "service-items") return null;
  return id;
}

function isQuoteServiceItemsPath(path: string) {
  return path.replace(/\/+$/, "") === "/operations/quotes/service-items";
}

function getOperationsWorkOrderIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/work/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  return id || null;
}

function getOperationsClientServiceIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/services/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  return id || null;
}

function getBusinessIdFromPath(path: string) {
  const normalized = path.replace(/\/+$/, "");
  const prefix = "/operations/businesses/";
  if (!normalized.startsWith(prefix)) return null;
  const id = normalized.slice(prefix.length);
  return id || null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function stageLabel(value: PipelineStage) {
  return (
    pipelineStageOptions.find((item) => item.value === value)?.label ?? value
  );
}

function relationshipLabel(value: RelationshipType) {
  return (
    relationshipTypeOptions.find((item) => item.value === value)?.label ?? value
  );
}

function contactName(contact: Contact | BusinessListRow | null | undefined) {
  if (!contact) return "No contact";
  const first =
    "first_name" in contact
      ? contact.first_name
      : contact.primary_contact_first_name;
  const last =
    "last_name" in contact
      ? contact.last_name
      : contact.primary_contact_last_name;
  const email =
    "email" in contact ? contact.email : contact.primary_contact_email;
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email || "No contact";
}

function splitContactName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function isOverdue(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

function taskDueDate(task: OperationsTask) {
  return task.snoozed_until ?? task.due_at;
}

function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function groupTasksForDisplay(tasks: OperationsTask[]) {
  const now = new Date();
  return {
    overdue: tasks.filter((task) => {
      if (task.status !== "open" && task.status !== "snoozed") return false;
      const due = new Date(taskDueDate(task));
      return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
    }),
    today: tasks.filter((task) => {
      if (task.status !== "open" && task.status !== "snoozed") return false;
      const due = new Date(taskDueDate(task));
      return (
        !Number.isNaN(due.getTime()) &&
        due.getTime() >= now.getTime() &&
        isSameLocalDay(due, now)
      );
    }),
    upcoming: tasks.filter((task) => {
      if (task.status !== "open" && task.status !== "snoozed") return false;
      const due = new Date(taskDueDate(task));
      return !Number.isNaN(due.getTime()) && due.getTime() > now.getTime();
    }),
    completed: tasks.filter(
      (task) => task.status === "completed" || task.status === "cancelled",
    ),
  };
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function localDateToIso(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function reportFilename(payload: ClientReportPayload | null) {
  if (!payload) return "scanlark-website-health-report.pdf";
  const business = sanitizeFilenamePart(payload.business.name) || "business";
  const domain = sanitizeFilenamePart(payload.site.domain) || "website";
  return `scanlark-website-health-report-${business}-${domain}-${payload.report.coverDate}.pdf`;
}

function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format((minor || 0) / 100);
}

function formatMajorMoneyInput(minor: number | null | undefined) {
  return ((minor ?? 0) / 100).toFixed(2);
}

async function apiErrorMessage(res: Response, fallback: string) {
  const data = (await res.json().catch(() => null)) as {
    message?: string;
    reasons?: string[];
  } | null;
  const reasons = data?.reasons?.length ? `: ${data.reasons.join(", ")}` : "";
  return `${data?.message ?? fallback}${reasons}`;
}

function quoteStatusLabel(value: OperationsQuoteStatus) {
  return quoteStatusLabels[value] ?? value;
}

function quoteItemTypeLabel(value: OperationsQuoteItemType) {
  return (
    quoteItemTypeOptions.find((item) => item.value === value)?.label ?? value
  );
}

function workStatusLabel(value: OperationsWorkStatus) {
  return workStatusLabels[value] ?? value;
}

function workPriorityLabel(value: OperationsWorkPriority) {
  return workPriorityLabels[value] ?? value;
}

function quoteFilename(payload: OperationsQuotePreviewPayload) {
  const business = sanitizeFilenamePart(payload.business.name) || "client";
  return `scanlark-quote-${payload.quote.quoteNumber.toLowerCase()}-${business}.pdf`;
}

function templateCategoryLabel(value: CommunicationTemplateCategory) {
  return (
    communicationTemplateCategoryOptions.find((item) => item.value === value)
      ?.label ?? value
  );
}

function communicationChannelLabel(value: CommunicationChannel) {
  return (
    communicationChannelOptions.find((item) => item.value === value)?.label ??
    value
  );
}

function reportTypeLabel(value: OperationsReportType) {
  return (
    operationsReportTypeOptions.find((item) => item.value === value)?.label ??
    value
  );
}

function reportStatusLabel(value: OperationsReportStatus) {
  return operationsReportStatusLabels[value] ?? value;
}

function reportPriorityLabel(value: OperationsReportPriority) {
  return (
    operationsReportPriorityOptions.find((item) => item.value === value)
      ?.label ?? value
  );
}

function communicationContactName(
  item: Communication | OperationsTask | null | undefined,
) {
  if (!item) return "";
  const name = [item.contact_first_name, item.contact_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || item.contact_email || "";
}

function communicationLabel(item: Communication) {
  if (item.status === "sent") return "Sent";
  if (item.status === "received") return "Received";
  if (item.status === "ready") return "Ready";
  if (item.status === "cancelled") return "Cancelled";
  return "Draft";
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export const OperationsPage: React.FC<OperationsPageProps> = ({
  apiBase,
  apiFetch,
  currentPath,
  currentSearch,
  authEmail,
  onNavigate,
  onLogout,
  embedded = false,
}) => {
  const activeRoute = getRouteKey(currentPath);
  const businessId = getBusinessIdFromPath(currentPath);
  const operationsReportId = getOperationsReportIdFromPath(currentPath);
  const operationsQuoteId = getOperationsQuoteIdFromPath(currentPath);
  const quoteServiceItemsPath = isQuoteServiceItemsPath(currentPath);
  const operationsWorkOrderId = getOperationsWorkOrderIdFromPath(currentPath);
  const operationsClientServiceId =
    getOperationsClientServiceIdFromPath(currentPath);
  const searchParams = useMemo(
    () => new URLSearchParams(currentSearch),
    [currentSearch],
  );
  const [summary, setSummary] = useState<OperationsSummary>(emptySummary);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<BusinessListRow[]>([]);
  const [businessesTotal, setBusinessesTotal] = useState(0);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [businessesError, setBusinessesError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<
    Array<{ stage: PipelineStage; businesses: BusinessListRow[] }>
  >([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [availableSites, setAvailableSites] = useState<AvailableSite[]>([]);
  const [communicationTemplates, setCommunicationTemplates] = useState<
    CommunicationTemplate[]
  >([]);
  const [senderIdentities, setSenderIdentities] = useState<
    OperationsSenderIdentity[]
  >([]);
  const [defaultSignatureMode, setDefaultSignatureMode] =
    useState<CommunicationSignatureMode>("include_scanlark_signature");
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
  const [communicationSearch, setCommunicationSearch] = useState("");
  const [communicationStatusFilter, setCommunicationStatusFilter] =
    useState<CommunicationFilterStatus>("all");
  const [communicationDirectionFilter, setCommunicationDirectionFilter] =
    useState<CommunicationDirection | "all">("all");
  const [communicationChannelFilter, setCommunicationChannelFilter] = useState<
    CommunicationChannel | "all"
  >("all");
  const [communicationBusinessFilter, setCommunicationBusinessFilter] =
    useState("");
  const [communicationsTab, setCommunicationsTab] = useState<
    "activity" | "templates"
  >("activity");
  const [selectedCommunicationId, setSelectedCommunicationId] = useState<
    string | null
  >(null);
  const [communicationCopyStatus, setCommunicationCopyStatus] = useState("");
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [pendingSendPrompt, setPendingSendPrompt] = useState<{
    recipient: string;
    channel: "mailto" | "webmail";
    communicationId?: string;
  } | null>(null);
  const [tasks, setTasks] = useState<OperationsTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [reports, setReports] = useState<OperationsReportRow[]>([]);
  const [reportsSummary, setReportsSummary] = useState({
    draft: 0,
    needsReview: 0,
    readyToSend: 0,
    sentThisMonth: 0,
    awaitingClientResponse: 0,
    completed: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportDetail, setReportDetail] =
    useState<OperationsReportDetail | null>(null);
  const [reportCreateDetail, setReportCreateDetail] =
    useState<BusinessDetail | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportPreview, setReportPreview] =
    useState<ClientReportPayload | null>(null);
  const [reportReadinessIssues, setReportReadinessIssues] = useState<
    OperationsReportReadinessIssue[]
  >([]);
  const [reportRegroupPreview, setReportRegroupPreview] =
    useState<OperationsReportRegroupPreview | null>(null);
  const [reportFormOpen, setReportFormOpen] = useState(false);
  const [reportForm, setReportForm] =
    useState<ReportFormState>(emptyReportForm);
  const [reportableScans, setReportableScans] = useState<
    Array<{
      id: string;
      finished_at: string | null;
      checked_links: number;
      total_links: number;
      open_issues: number;
      high_priority: number;
    }>
  >([]);
  const [quotes, setQuotes] = useState<OperationsQuoteRow[]>([]);
  const [quotesSummary, setQuotesSummary] = useState({
    draft: 0,
    needsReview: 0,
    readyToSend: 0,
    sent: 0,
    accepted: 0,
    convertedToWork: 0,
  });
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteDetail, setQuoteDetail] = useState<OperationsQuoteDetail | null>(
    null,
  );
  const [quoteDetailLoading, setQuoteDetailLoading] = useState(false);
  const [quotePreview, setQuotePreview] =
    useState<OperationsQuotePreviewPayload | null>(null);
  const [quoteFormOpen, setQuoteFormOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState<QuoteFormState>(emptyQuoteForm);
  const [quoteFormErrors, setQuoteFormErrors] = useState<QuoteFormErrors>({});
  const [quoteItemForm, setQuoteItemForm] =
    useState<QuoteItemFormState>(emptyQuoteItemForm);
  const [quoteServiceItems, setQuoteServiceItems] = useState<
    Array<{
      id: string;
      title: string;
      description: string | null;
      suggested_price_minor: number;
      suggested_effort: string | null;
      item_type: OperationsQuoteItemType;
      is_active: boolean;
    }>
  >([]);
  const [workOrders, setWorkOrders] = useState<OperationsWorkOrderRow[]>([]);
  const [workSummary, setWorkSummary] = useState({
    awaitingAccess: 0,
    readyToStart: 0,
    inProgress: 0,
    waitingForClient: 0,
    blocked: 0,
    readyForTesting: 0,
    completedThisMonth: 0,
  });
  const [workLoading, setWorkLoading] = useState(false);
  const [workDetail, setWorkDetail] =
    useState<OperationsWorkOrderDetail | null>(null);
  const [workDetailLoading, setWorkDetailLoading] = useState(false);
  const [servicePlans, setServicePlans] = useState<OperationsServicePlanRow[]>(
    [],
  );
  const [servicePlansLoading, setServicePlansLoading] = useState(false);
  const [services, setServices] = useState<OperationsClientServiceRow[]>([]);
  const [servicesSummary, setServicesSummary] = useState({
    active: 0,
    reportsDue: 0,
    reviewsDue: 0,
    attention: 0,
    paused: 0,
    renewals: 0,
    cancellations: 0,
  });
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceDetail, setServiceDetail] =
    useState<OperationsClientServiceDetail | null>(null);
  const [serviceDetailLoading, setServiceDetailLoading] = useState(false);
  const [serviceCreateDetail, setServiceCreateDetail] =
    useState<BusinessDetail | null>(null);
  const [serviceFormOpen, setServiceFormOpen] = useState(false);
  const [serviceForm, setServiceForm] =
    useState<ServiceFormState>(emptyServiceForm);
  const [serviceUsageForm, setServiceUsageForm] =
    useState<ServiceUsageFormState>(emptyServiceUsageForm);
  const [addBusinessOpen, setAddBusinessOpen] = useState(false);
  const [businessForm, setBusinessForm] =
    useState<BusinessFormState>(emptyBusinessForm);
  const [businessSaving, setBusinessSaving] = useState(false);
  const [businessFormError, setBusinessFormError] = useState<string | null>(
    null,
  );
  const [editBusinessOpen, setEditBusinessOpen] = useState(false);
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] =
    useState<ContactFormState>(emptyContactForm);
  const [noteBody, setNoteBody] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [clearFollowUpOnContact, setClearFollowUpOnContact] = useState(false);
  const [communicationFormOpen, setCommunicationFormOpen] = useState(false);
  const [communicationForm, setCommunicationForm] =
    useState<CommunicationFormState>(emptyCommunicationForm);
  const communicationRenderSequenceRef = useRef(0);
  const [templateForm, setTemplateForm] =
    useState<TemplateFormState>(emptyTemplateForm);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeFilter =
    (searchParams.get("filter") as BusinessListFilter | null) ?? "active";
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "updated_desc";

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await apiFetch(`${apiBase}/operations/summary`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setSummary((await res.json()) as OperationsSummary);
    } catch (err) {
      console.warn("Failed to load operations summary", err);
      setSummaryError("Operations summary is unavailable.");
      setSummary(emptySummary);
    } finally {
      setSummaryLoading(false);
    }
  }, [apiBase, apiFetch]);

  const loadBusinesses = useCallback(async () => {
    setBusinessesLoading(true);
    setBusinessesError(null);
    const params: Record<string, string | null | undefined> = {
      search,
      sort,
      archived: activeFilter === "archived" ? "true" : "false",
      followUpDue: activeFilter === "follow_up" ? "true" : undefined,
      relationshipType:
        activeFilter === "prospects"
          ? "prospect"
          : activeFilter === "clients"
            ? "client"
            : undefined,
      pipelineStage: activeFilter === "ongoing" ? "ongoing_client" : undefined,
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses${buildQuery(params)}`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        businesses: BusinessListRow[];
        totalMatching: number;
      };
      setBusinesses(data.businesses);
      setBusinessesTotal(data.totalMatching);
    } catch (err) {
      console.warn("Failed to load businesses", err);
      setBusinessesError("Businesses could not be loaded.");
      setBusinesses([]);
      setBusinessesTotal(0);
    } finally {
      setBusinessesLoading(false);
    }
  }, [activeFilter, apiBase, apiFetch, search, sort]);

  const loadDetail = useCallback(async () => {
    if (!businessId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(businessId)}`,
        {
          cache: "no-store",
        },
      );
      if (res.status === 404) {
        setDetail(null);
        setDetailError("Business not found.");
        return;
      }
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { business: BusinessDetail };
      setDetail(data.business);
    } catch (err) {
      console.warn("Failed to load business", err);
      setDetailError("Business could not be loaded.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [apiBase, apiFetch, businessId]);

  const loadPipeline = useCallback(async () => {
    setPipelineLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/operations/pipeline`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        stages: Array<{ stage: PipelineStage; businesses: BusinessListRow[] }>;
      };
      setPipelineStages(data.stages);
    } catch (err) {
      console.warn("Failed to load pipeline", err);
      setPipelineStages([]);
    } finally {
      setPipelineLoading(false);
    }
  }, [apiBase, apiFetch]);

  const loadAvailableSites = useCallback(async () => {
    try {
      const res = await apiFetch(`${apiBase}/operations/sites`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { sites: AvailableSite[] };
      setAvailableSites(data.sites);
    } catch (err) {
      console.warn("Failed to load available sites", err);
      setAvailableSites([]);
    }
  }, [apiBase, apiFetch]);

  const loadCommunicationTemplates = useCallback(async () => {
    try {
      const res = await apiFetch(
        `${apiBase}/operations/communication-templates?activeOnly=false`,
        {
          cache: "no-store",
        },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        templates: CommunicationTemplate[];
        senderIdentities?: OperationsSenderIdentity[];
        defaultSignatureMode?: CommunicationSignatureMode;
      };
      setCommunicationTemplates(data.templates);
      setSenderIdentities(data.senderIdentities ?? []);
      setDefaultSignatureMode(
        data.defaultSignatureMode ?? "include_scanlark_signature",
      );
    } catch (err) {
      console.warn("Failed to load communication templates", err);
      setCommunicationTemplates([]);
    }
  }, [apiBase, apiFetch]);

  const loadCommunications = useCallback(async () => {
    setCommunicationsLoading(true);
    try {
      const params = buildQuery({
        limit: "50",
        search: communicationSearch || undefined,
        businessId: communicationBusinessFilter || undefined,
        direction:
          communicationDirectionFilter === "all"
            ? undefined
            : communicationDirectionFilter,
        channel:
          communicationChannelFilter === "all"
            ? undefined
            : communicationChannelFilter,
        status:
          communicationStatusFilter !== "all" &&
          communicationStatusFilter !== "follow_up_due"
            ? communicationStatusFilter
            : undefined,
        followUpDue:
          communicationStatusFilter === "follow_up_due" ? "true" : undefined,
      });
      const url = businessId
        ? `${apiBase}/operations/businesses/${encodeURIComponent(businessId)}/communications${params}`
        : `${apiBase}/operations/communications${params}`;
      const res = await apiFetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        communications: Communication[];
      };
      setCommunications(data.communications);
    } catch (err) {
      console.warn("Failed to load communications", err);
      setCommunications([]);
    } finally {
      setCommunicationsLoading(false);
    }
  }, [
    apiBase,
    apiFetch,
    businessId,
    communicationSearch,
    communicationBusinessFilter,
    communicationChannelFilter,
    communicationDirectionFilter,
    communicationStatusFilter,
  ]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    const status = searchParams.get("status") ?? "active";
    try {
      const res = await apiFetch(
        `${apiBase}/operations/tasks${buildQuery({ status, limit: "100" })}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { tasks: OperationsTask[] };
      setTasks(data.tasks);
    } catch (err) {
      console.warn("Failed to load tasks", err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [apiBase, apiFetch, searchParams]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    const params: Record<string, string | null | undefined> = {
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      reportType: searchParams.get("reportType"),
      awaitingFollowUp: searchParams.get("awaitingFollowUp"),
      archived: searchParams.get("archived") ?? "false",
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports${buildQuery(params)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        reports: OperationsReportRow[];
        summary: typeof reportsSummary;
      };
      setReports(data.reports);
      setReportsSummary(data.summary);
    } catch (err) {
      console.warn("Failed to load reports", err);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, [apiBase, apiFetch, searchParams]);

  const loadReportDetail = useCallback(async () => {
    if (!operationsReportId) return;
    setReportDetailLoading(true);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { report: OperationsReportDetail };
      setReportDetail(data.report);
      setReportRegroupPreview(null);
    } catch (err) {
      console.warn("Failed to load operations report", err);
      setReportDetail(null);
    } finally {
      setReportDetailLoading(false);
    }
  }, [apiBase, apiFetch, operationsReportId]);

  const loadReportPreview = useCallback(async () => {
    if (!operationsReportId) return;
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/preview`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        payload: ClientReportPayload;
        readinessIssues: OperationsReportReadinessIssue[];
      };
      setReportPreview(data.payload);
      setReportReadinessIssues(data.readinessIssues ?? []);
    } catch (err) {
      console.warn("Failed to load report preview", err);
      setReportPreview(null);
      setReportReadinessIssues([]);
    }
  }, [apiBase, apiFetch, operationsReportId]);

  const loadReportableScans = useCallback(
    async (businessIdValue: string, siteIdValue: string) => {
      if (!businessIdValue || !siteIdValue) {
        setReportableScans([]);
        return;
      }
      try {
        const res = await apiFetch(
          `${apiBase}/operations/reports/reportable-scan-runs${buildQuery({
            businessId: businessIdValue,
            siteId: siteIdValue,
          })}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as {
          scanRuns: typeof reportableScans;
        };
        setReportableScans(data.scanRuns);
      } catch (err) {
        console.warn("Failed to load reportable scans", err);
        setReportableScans([]);
      }
    },
    [apiBase, apiFetch],
  );

  const loadReportCreateBusiness = useCallback(
    async (businessIdValue: string) => {
      if (!businessIdValue) {
        setReportCreateDetail(null);
        return;
      }
      if (detail?.business.id === businessIdValue) {
        setReportCreateDetail(detail);
        return;
      }
      try {
        const res = await apiFetch(
          `${apiBase}/operations/businesses/${encodeURIComponent(businessIdValue)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { business: BusinessDetail };
        setReportCreateDetail(data.business);
      } catch (err) {
        console.warn("Failed to load report business context", err);
        setReportCreateDetail(null);
      }
    },
    [apiBase, apiFetch, detail],
  );

  const loadServiceCreateBusiness = useCallback(
    async (businessIdValue: string) => {
      if (!businessIdValue) {
        setServiceCreateDetail(null);
        return;
      }
      if (detail?.business.id === businessIdValue) {
        setServiceCreateDetail(detail);
        return;
      }
      try {
        const res = await apiFetch(
          `${apiBase}/operations/businesses/${encodeURIComponent(businessIdValue)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { business: BusinessDetail };
        setServiceCreateDetail(data.business);
      } catch (err) {
        console.warn("Failed to load service business context", err);
        setServiceCreateDetail(null);
      }
    },
    [apiBase, apiFetch, detail],
  );

  const loadQuotes = useCallback(async () => {
    setQuotesLoading(true);
    const params: Record<string, string | null | undefined> = {
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      businessId:
        businessId && activeRoute === "businesses" ? businessId : null,
      operationsReportId:
        operationsReportId && activeRoute === "reports"
          ? operationsReportId
          : null,
      archived: searchParams.get("archived") ?? "false",
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes${buildQuery(params)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        quotes: OperationsQuoteRow[];
        summary: typeof quotesSummary;
      };
      setQuotes(data.quotes);
      setQuotesSummary(data.summary);
    } catch (err) {
      console.warn("Failed to load quotes", err);
      setQuotes([]);
    } finally {
      setQuotesLoading(false);
    }
  }, [
    activeRoute,
    apiBase,
    apiFetch,
    businessId,
    operationsReportId,
    searchParams,
  ]);

  const loadQuoteDetail = useCallback(async () => {
    if (!operationsQuoteId) return;
    setQuoteDetailLoading(true);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes/${encodeURIComponent(operationsQuoteId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as { quote: OperationsQuoteDetail };
      setQuoteDetail(data.quote);
    } catch (err) {
      console.warn("Failed to load quote detail", err);
      setQuoteDetail(null);
    } finally {
      setQuoteDetailLoading(false);
    }
  }, [apiBase, apiFetch, operationsQuoteId]);

  const loadQuotePreview = useCallback(async () => {
    if (!operationsQuoteId) return;
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes/${encodeURIComponent(operationsQuoteId)}/preview`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        payload: OperationsQuotePreviewPayload;
      };
      setQuotePreview(data.payload);
    } catch (err) {
      console.warn("Failed to load quote preview", err);
      setQuotePreview(null);
    }
  }, [apiBase, apiFetch, operationsQuoteId]);

  const loadQuoteServiceItems = useCallback(async () => {
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes/service-items?activeOnly=false`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        serviceItems: typeof quoteServiceItems;
      };
      setQuoteServiceItems(data.serviceItems);
    } catch (err) {
      console.warn("Failed to load service items", err);
      setQuoteServiceItems([]);
    }
  }, [apiBase, apiFetch]);

  const loadWorkOrders = useCallback(async () => {
    setWorkLoading(true);
    const params: Record<string, string | null | undefined> = {
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      priority: searchParams.get("priority"),
      businessId:
        businessId && activeRoute === "businesses" ? businessId : null,
      operationsReportId:
        operationsReportId && activeRoute === "reports"
          ? operationsReportId
          : null,
      overdue: searchParams.get("overdue"),
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/work-orders${buildQuery(params)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        workOrders: OperationsWorkOrderRow[];
        summary: typeof workSummary;
      };
      setWorkOrders(data.workOrders);
      setWorkSummary(data.summary);
    } catch (err) {
      console.warn("Failed to load work orders", err);
      setWorkOrders([]);
    } finally {
      setWorkLoading(false);
    }
  }, [
    activeRoute,
    apiBase,
    apiFetch,
    businessId,
    operationsReportId,
    searchParams,
  ]);

  const loadWorkDetail = useCallback(async () => {
    if (!operationsWorkOrderId) return;
    setWorkDetailLoading(true);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/work-orders/${encodeURIComponent(operationsWorkOrderId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        workOrder: OperationsWorkOrderDetail;
      };
      setWorkDetail(data.workOrder);
    } catch (err) {
      console.warn("Failed to load work order", err);
      setWorkDetail(null);
    } finally {
      setWorkDetailLoading(false);
    }
  }, [apiBase, apiFetch, operationsWorkOrderId]);

  const loadServicePlans = useCallback(async () => {
    setServicePlansLoading(true);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/service-plans?includeArchived=true&limit=100`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        servicePlans: OperationsServicePlanRow[];
      };
      setServicePlans(data.servicePlans);
    } catch (err) {
      console.warn("Failed to load service plans", err);
      setServicePlans([]);
    } finally {
      setServicePlansLoading(false);
    }
  }, [apiBase, apiFetch]);

  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    const params: Record<string, string | null | undefined> = {
      search: searchParams.get("search"),
      status: searchParams.get("status"),
      planType: searchParams.get("planType"),
      billingCadence: searchParams.get("billingCadence"),
      businessId:
        businessId && activeRoute === "businesses" ? businessId : null,
      reportsDue: searchParams.get("reportsDue"),
      reviewsDue: searchParams.get("reviewsDue"),
      renewalsApproaching: searchParams.get("renewalsApproaching"),
      siteAttention: searchParams.get("siteAttention"),
      includeEnded: searchParams.get("includeEnded"),
      limit: "50",
      offset: "0",
    };
    try {
      const res = await apiFetch(
        `${apiBase}/operations/services${buildQuery(params)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        services: OperationsClientServiceRow[];
      };
      setServices(data.services);
      setServicesSummary({
        active: data.services.filter((item) =>
          ["active", "pending_start", "review_due"].includes(item.status),
        ).length,
        reportsDue: data.services.filter(
          (item) =>
            item.next_report_at && new Date(item.next_report_at) <= new Date(),
        ).length,
        reviewsDue: data.services.filter(
          (item) =>
            item.next_review_at && new Date(item.next_review_at) <= new Date(),
        ).length,
        attention: data.services.filter(
          (item) => (item.site_attention_count ?? 0) > 0,
        ).length,
        paused: data.services.filter((item) => item.status === "paused").length,
        renewals: data.services.filter(
          (item) =>
            item.renewal_reminder_at &&
            new Date(item.renewal_reminder_at) <= new Date(),
        ).length,
        cancellations: data.services.filter(
          (item) => item.status === "cancellation_pending",
        ).length,
      });
    } catch (err) {
      console.warn("Failed to load services", err);
      setServices([]);
    } finally {
      setServicesLoading(false);
    }
  }, [activeRoute, apiBase, apiFetch, businessId, searchParams]);

  const loadServiceDetail = useCallback(async () => {
    if (!operationsClientServiceId) return;
    setServiceDetailLoading(true);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/services/${encodeURIComponent(operationsClientServiceId)}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as {
        service: OperationsClientServiceDetail;
      };
      setServiceDetail(data.service);
    } catch (err) {
      console.warn("Failed to load service", err);
      setServiceDetail(null);
    } finally {
      setServiceDetailLoading(false);
    }
  }, [apiBase, apiFetch, operationsClientServiceId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (
      (activeRoute === "businesses" && !businessId) ||
      activeRoute === "communications" ||
      (activeRoute === "reports" && !operationsReportId) ||
      (activeRoute === "quotes" && !operationsQuoteId) ||
      activeRoute === "work" ||
      activeRoute === "services"
    ) {
      void loadBusinesses();
    }
  }, [
    activeRoute,
    businessId,
    loadBusinesses,
    operationsQuoteId,
    operationsReportId,
  ]);

  useEffect(() => {
    if (businessId) {
      void loadDetail();
      void loadAvailableSites();
      void loadCommunicationTemplates();
      void loadCommunications();
      void loadQuotes();
      void loadWorkOrders();
      void loadServices();
    }
  }, [
    businessId,
    loadAvailableSites,
    loadCommunicationTemplates,
    loadCommunications,
    loadDetail,
    loadQuotes,
    loadServices,
    loadWorkOrders,
  ]);

  useEffect(() => {
    if (activeRoute === "pipeline") void loadPipeline();
  }, [activeRoute, loadPipeline]);

  useEffect(() => {
    if (activeRoute === "communications") {
      void loadCommunicationTemplates();
      void loadCommunications();
    }
  }, [activeRoute, loadCommunicationTemplates, loadCommunications]);

  useEffect(() => {
    if (activeRoute === "tasks") void loadTasks();
  }, [activeRoute, loadTasks]);

  useEffect(() => {
    if (
      !communicationFormOpen ||
      !communicationForm.businessId ||
      !communicationForm.templateId ||
      !communicationForm.hasUnsavedRenderEdits
    ) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void renderCommunicationDraft({
        useCurrentContent: true,
        source: "auto",
      });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [
    communicationFormOpen,
    communicationForm.businessId,
    communicationForm.contactId,
    communicationForm.templateId,
    communicationForm.subject,
    communicationForm.preheader,
    communicationForm.body,
    communicationForm.senderIdentityKey,
    communicationForm.wordingVariantKey,
    communicationForm.signatureMode,
    communicationForm.followUpAt,
    communicationForm.hasUnsavedRenderEdits,
  ]);

  useEffect(() => {
    if (activeRoute === "reports" && !operationsReportId) {
      void loadReports();
    }
  }, [activeRoute, loadReports, operationsReportId]);

  useEffect(() => {
    if (operationsReportId) {
      void loadReportDetail();
      void loadReportPreview();
      void loadQuotes();
      void loadWorkOrders();
      void loadServices();
    }
  }, [
    loadQuotes,
    loadReportDetail,
    loadReportPreview,
    loadServices,
    loadWorkOrders,
    operationsReportId,
  ]);

  useEffect(() => {
    if (activeRoute === "quotes" && !operationsQuoteId) {
      void loadQuotes();
      void loadQuoteServiceItems();
    }
  }, [activeRoute, loadQuoteServiceItems, loadQuotes, operationsQuoteId]);

  useEffect(() => {
    if (operationsQuoteId) {
      void loadQuoteDetail();
      void loadQuotePreview();
      void loadQuoteServiceItems();
    }
  }, [
    loadQuoteDetail,
    loadQuotePreview,
    loadQuoteServiceItems,
    operationsQuoteId,
  ]);

  useEffect(() => {
    if (activeRoute === "work" && !operationsWorkOrderId) {
      void loadWorkOrders();
    }
  }, [activeRoute, loadWorkOrders, operationsWorkOrderId]);

  useEffect(() => {
    if (operationsWorkOrderId) {
      void loadWorkDetail();
    }
  }, [loadWorkDetail, operationsWorkOrderId]);

  useEffect(() => {
    if (activeRoute === "servicePlans") void loadServicePlans();
  }, [activeRoute, loadServicePlans]);

  useEffect(() => {
    if (activeRoute === "services" && !operationsClientServiceId) {
      void loadServices();
      void loadServicePlans();
    }
  }, [activeRoute, loadServicePlans, loadServices, operationsClientServiceId]);

  useEffect(() => {
    if (operationsClientServiceId) {
      void loadServiceDetail();
      void loadServicePlans();
    }
  }, [loadServiceDetail, loadServicePlans, operationsClientServiceId]);

  const attentionCards = useMemo(
    () => [
      {
        label: "Follow-ups due",
        value: summary.counts.followUpsDue,
        detail: "Client and prospect follow-ups that need action.",
        href: "/operations/businesses?filter=follow_up&sort=next_follow_up",
      },
      {
        label: "Prospects awaiting contact",
        value: summary.counts.prospectsAwaitingContact,
        detail: "Prospects still in the early outreach stages.",
        href: "/operations/businesses?filter=prospects&sort=next_follow_up",
      },
      {
        label: "Reports awaiting review",
        value: summary.counts.reportsAwaitingReview,
        detail: "Client reports that need finding review.",
        href: "/operations/reports",
      },
      {
        label: "Reports ready to send",
        value: summary.counts.reportsReadyToSend,
        detail: "Reviewed client reports waiting for delivery.",
        href: "/operations/reports?status=ready_to_send",
      },
      {
        label: "Client websites with critical issues",
        value: summary.counts.criticalClientSites,
        detail: "Latest reports with open critical or high-priority issues.",
        href: "/dashboard?selectSite=1",
      },
      {
        label: "Active managed services",
        value: summary.counts.activeServices,
        detail: "Recurring monitoring clients currently under management.",
        href: "/operations/services",
      },
      {
        label: "Service reports due",
        value: summary.counts.serviceReportsDue,
        detail: "Managed-service reports that need preparation or delivery.",
        href: "/operations/services?reportsDue=true",
      },
      {
        label: "Service reviews due",
        value: summary.counts.serviceReviewsDue,
        detail: "Recurring client reviews that need attention.",
        href: "/operations/services?reviewsDue=true",
      },
      {
        label: "Managed sites needing attention",
        value: summary.counts.managedSitesNeedingAttention,
        detail:
          "Active client sites with outages, failed scans or high-priority findings.",
        href: "/operations/services?siteAttention=true",
      },
      {
        label: "Quotes awaiting response",
        value: summary.counts.quotesAwaitingResponse,
        detail: "Sent quotes waiting on a client decision.",
        href: "/operations/quotes",
      },
      {
        label: "Quotes ready to send",
        value: summary.counts.quotesReadyToSend,
        detail: "Reviewed quotes waiting for delivery.",
        href: "/operations/quotes?status=ready_to_send",
      },
      {
        label: "Accepted quotes to convert",
        value: summary.counts.acceptedQuotesAwaitingConversion,
        detail: "Accepted quotes not yet converted into work.",
        href: "/operations/quotes?status=accepted",
      },
      {
        label: "Open work items",
        value: summary.counts.openWorkItems,
        detail: "Active work items that have not been closed.",
        href: "/operations/work",
      },
      {
        label: "Awaiting access",
        value: summary.counts.awaitingAccess,
        detail: "Accepted work blocked by missing client access.",
        href: "/operations/work?status=awaiting_access",
      },
      {
        label: "Blocked work",
        value: summary.counts.blockedWork,
        detail: "Work orders with a documented blocker.",
        href: "/operations/work?status=blocked",
      },
    ],
    [summary.counts],
  );

  const renderLink = (
    href: string,
    label: React.ReactNode,
    className = "ops-link",
  ) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(href);
      }}
    >
      {label}
    </a>
  );

  function updateListUrl(
    next: Partial<{ filter: BusinessListFilter; search: string; sort: string }>,
  ) {
    onNavigate(
      `/operations/businesses${buildQuery({
        filter: next.filter ?? activeFilter,
        search: next.search ?? search,
        sort: next.sort ?? sort,
      })}`,
    );
  }

  async function submitBusiness(event: React.FormEvent) {
    event.preventDefault();
    setBusinessSaving(true);
    setBusinessFormError(null);
    const primaryName = splitContactName(businessForm.primaryContactName);
    try {
      const res = await apiFetch(`${apiBase}/operations/businesses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: businessForm.name,
          websiteUrl: businessForm.websiteUrl,
          generalEmail: businessForm.generalEmail,
          phone: businessForm.phone,
          businessType: businessForm.businessType,
          location: businessForm.location,
          source: businessForm.source,
          pipelineStage: businessForm.pipelineStage,
          relationshipType: businessForm.relationshipType,
          nextFollowUpAt: businessForm.nextFollowUpAt || null,
          nextAction: businessForm.nextAction,
          initialNote: businessForm.initialNote,
          primaryContact:
            businessForm.primaryContactName ||
            businessForm.primaryContactEmail ||
            businessForm.primaryContactPhone
              ? {
                  ...primaryName,
                  email: businessForm.primaryContactEmail,
                  phone: businessForm.primaryContactPhone,
                  isPrimary: true,
                }
              : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to add business");
      }
      const data = (await res.json()) as { business: BusinessDetail };
      setAddBusinessOpen(false);
      setBusinessForm(emptyBusinessForm);
      await loadSummary();
      onNavigate(`/operations/businesses/${data.business.business.id}`);
    } catch (err) {
      setBusinessFormError(
        err instanceof Error ? err.message : "Failed to add business",
      );
    } finally {
      setBusinessSaving(false);
    }
  }

  async function patchBusiness(input: Record<string, unknown>) {
    if (!detail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? "Failed to update business");
    }
    await loadDetail();
    await loadSummary();
  }

  async function submitEditBusiness(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusinessSaving(true);
    setBusinessFormError(null);
    try {
      await patchBusiness({
        name: businessForm.name,
        websiteUrl: businessForm.websiteUrl,
        generalEmail: businessForm.generalEmail,
        phone: businessForm.phone,
        businessType: businessForm.businessType,
        location: businessForm.location,
        source: businessForm.source,
        pipelineStage: businessForm.pipelineStage,
        relationshipType: businessForm.relationshipType,
        nextFollowUpAt: businessForm.nextFollowUpAt || null,
        nextAction: businessForm.nextAction,
      });
      setEditBusinessOpen(false);
    } catch (err) {
      setBusinessFormError(
        err instanceof Error ? err.message : "Failed to update business",
      );
    } finally {
      setBusinessSaving(false);
    }
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setActionError(null);
    try {
      const url = editingContactId
        ? `${apiBase}/operations/businesses/${encodeURIComponent(
            detail.business.id,
          )}/contacts/${encodeURIComponent(editingContactId)}`
        : `${apiBase}/operations/businesses/${encodeURIComponent(
            detail.business.id,
          )}/contacts`;
      const res = await apiFetch(url, {
        method: editingContactId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to add contact");
      }
      setContactForm(emptyContactForm);
      setEditingContactId(null);
      setContactFormOpen(false);
      await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to add contact",
      );
    }
  }

  async function submitNote(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !noteBody.trim()) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}/notes`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: noteBody }),
        },
      );
      if (!res.ok) throw new Error("Failed to add note");
      setNoteBody("");
      await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add note");
    }
  }

  async function linkSite(event: React.FormEvent) {
    event.preventDefault();
    if (!detail || !selectedSiteId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}/sites`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ siteId: selectedSiteId }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to link site");
      }
      setSelectedSiteId("");
      await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to link site",
      );
    }
  }

  function openCommunicationForm(
    overrides: Partial<CommunicationFormState> = {},
  ) {
    setActionError(null);
    const selectedBusinessId =
      overrides.businessId ?? detail?.business.id ?? "";
    const sender = senderIdentities[0] ?? {
      key: "default",
      name: "Connor Smith",
      email: "connor@scanlark.com",
    };
    const template =
      communicationTemplates.find((item) => item.id === overrides.templateId) ??
      communicationTemplates.find((item) => item.is_active);
    setCommunicationForm({
      ...emptyCommunicationForm,
      businessId: selectedBusinessId,
      contactId: overrides.contactId ?? detail?.primaryContact?.id ?? "",
      templateId: template?.id ?? "",
      direction: overrides.direction ?? "outbound",
      channel: overrides.channel ?? "email",
      status: overrides.status ?? "draft",
      subject: overrides.subject ?? "",
      preheader: overrides.preheader ?? template?.preheader_template ?? "",
      body: overrides.body ?? "",
      plainTextBody: overrides.plainTextBody ?? "",
      layoutKey:
        overrides.layoutKey ?? template?.layout_key ?? "personal_letter",
      wordingVariantKey:
        overrides.wordingVariantKey ??
        template?.content_variants_json?.[0]?.key ??
        "",
      signatureMode:
        overrides.signatureMode ??
        template?.signature_mode ??
        defaultSignatureMode,
      senderIdentityKey: overrides.senderIdentityKey ?? sender.key,
      senderName: overrides.senderName ?? sender.name,
      senderEmail: overrides.senderEmail ?? sender.email,
      recipientName: overrides.recipientName ?? "",
      recipientEmail: overrides.recipientEmail ?? "",
      followUpAt: overrides.followUpAt ?? "",
      taskTitle: overrides.taskTitle ?? "",
      taskNotes: overrides.taskNotes ?? "",
      unresolvedPlaceholders: [],
    });
    setCommunicationFormOpen(true);
    if (selectedBusinessId && detail?.business.id !== selectedBusinessId) {
      void loadReportCreateBusiness(selectedBusinessId);
    }
  }

  function communicationBusinessContext() {
    return detail?.business.id === communicationForm.businessId
      ? detail
      : reportCreateDetail?.business.id === communicationForm.businessId
        ? reportCreateDetail
        : null;
  }

  function invalidateCommunicationRender() {
    communicationRenderSequenceRef.current += 1;
  }

  function markCommunicationRenderStale(
    next: CommunicationFormState,
  ): CommunicationFormState {
    return {
      ...next,
      hasUnsavedRenderEdits: true,
      renderStatus: "stale",
      copyStatus: "Save your latest changes before copying formatted email.",
    };
  }

  function findEditorPlaceholders(subject: string, body: string) {
    const placeholders = new Set<string>();
    for (const value of [subject, body]) {
      for (const match of value.matchAll(communicationPlaceholderTokenRe)) {
        const parsed = match[0].match(/^{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}$/);
        placeholders.add(parsed?.[1] ?? match[0]);
      }
    }
    return Array.from(placeholders).sort();
  }

  function setCommunicationSubject(subject: string) {
    invalidateCommunicationRender();
    setCommunicationForm((prev) => ({
      ...markCommunicationRenderStale(prev),
      subject,
      unresolvedPlaceholders: findEditorPlaceholders(subject, prev.body),
    }));
  }

  function setCommunicationBody(body: string) {
    invalidateCommunicationRender();
    setCommunicationForm((prev) => ({
      ...markCommunicationRenderStale(prev),
      body,
      plainTextBody: body,
      unresolvedPlaceholders: findEditorPlaceholders(prev.subject, body),
    }));
  }

  function communicationBodyPreview(body: string) {
    const firstLine = body.replace(/\s+/g, " ").trim();
    if (!firstLine) return "No body yet.";
    return firstLine.length > 180 ? `${firstLine.slice(0, 180)}...` : firstLine;
  }

  function communicationFollowUpState(item: Communication) {
    if (!item.follow_up_at) return "No follow-up";
    if (item.follow_up_completed_at) return "Follow-up completed";
    const due = new Date(item.follow_up_at);
    if (Number.isNaN(due.getTime())) return "Follow-up scheduled";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (due < today) return "Follow-up overdue";
    if (due < tomorrow) return "Follow-up due today";
    return `Follow-up ${formatDateTime(item.follow_up_at)}`;
  }

  function communicationRecipientEmail() {
    const context = communicationBusinessContext();
    if (context) {
      const contact = context.contacts.find(
        (item) => item.id === communicationForm.contactId,
      );
      return (
        contact?.email ??
        context.primaryContact?.email ??
        context.business.general_email ??
        ""
      );
    }
    const business = businesses.find(
      (item) => item.id === communicationForm.businessId,
    );
    return business?.primary_contact_email ?? business?.general_email ?? "";
  }

  function selectedCommunicationContact() {
    const context = communicationBusinessContext();
    if (!context) return null;
    return (
      context.contacts.find(
        (item) => item.id === communicationForm.contactId,
      ) ?? null
    );
  }

  function confirmDoNotContactOverride(action: string) {
    const contact = selectedCommunicationContact();
    if (
      !contact?.do_not_contact ||
      communicationForm.direction !== "outbound"
    ) {
      return true;
    }
    return window.confirm(
      `${contactName(contact)} is marked do-not-contact${
        contact.do_not_contact_reason
          ? `: ${contact.do_not_contact_reason}`
          : "."
      }\n\nContinue and ${action}?`,
    );
  }

  function openCreateReport(overrides: Partial<ReportFormState> = {}) {
    const selectedBusinessId =
      overrides.businessId ?? detail?.business.id ?? "";
    const selectedSiteIdValue =
      overrides.siteId ?? detail?.linkedSites[0]?.site_id ?? "";
    setReportForm({
      ...emptyReportForm,
      businessId: selectedBusinessId,
      siteId: selectedSiteIdValue,
      title:
        overrides.title ??
        (detail
          ? `${detail.business.name} website health report`
          : "Website health report"),
      preparedContactId:
        overrides.preparedContactId ?? detail?.primaryContact?.id ?? "",
      preparedFor:
        overrides.preparedFor ??
        (detail?.primaryContact ? contactName(detail.primaryContact) : ""),
      reportType: overrides.reportType ?? "initial_health_check",
      scanRunId: overrides.scanRunId ?? "",
      allowDuplicate: overrides.allowDuplicate ?? false,
    });
    setReportCreateDetail(
      detail?.business.id === selectedBusinessId ? detail : null,
    );
    setReportFormOpen(true);
    if (selectedBusinessId && detail?.business.id !== selectedBusinessId) {
      void loadReportCreateBusiness(selectedBusinessId);
    }
    if (selectedBusinessId && selectedSiteIdValue) {
      void loadReportableScans(selectedBusinessId, selectedSiteIdValue);
    }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch(`${apiBase}/operations/reports`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...reportForm,
          preparedContactId: reportForm.preparedContactId || null,
          preparedFor: reportForm.preparedFor || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to create report");
      }
      const data = (await res.json()) as { report: OperationsReportDetail };
      setReportFormOpen(false);
      setReportForm(emptyReportForm);
      await Promise.all([loadReports(), loadSummary()]);
      onNavigate(`/operations/reports/${data.report.report.id}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create report",
      );
    }
  }

  async function patchReport(input: Record<string, unknown>) {
    if (!operationsReportId) return;
    const res = await apiFetch(
      `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? "Failed to update report");
    }
    await Promise.all([loadReportDetail(), loadReportPreview(), loadSummary()]);
  }

  async function patchFinding(
    findingId: string,
    input: Record<string, unknown>,
  ) {
    if (!operationsReportId) return;
    const res = await apiFetch(
      `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/findings/${encodeURIComponent(findingId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(await apiErrorMessage(res, "Failed to update finding"));
    }
    const data = (await res.json()) as { finding: OperationsReportFinding };
    setReportDetail((prev) =>
      prev
        ? {
            ...prev,
            findings: prev.findings.map((finding) =>
              finding.id === data.finding.id ? data.finding : finding,
            ),
            report: {
              ...prev.report,
              last_preview_generated_at: null,
              last_pdf_generated_at: null,
              updated_at: data.finding.updated_at,
            },
          }
        : prev,
    );
    await Promise.all([loadReportDetail(), loadReportPreview()]);
  }

  async function bulkPatchReportFindings(input: Record<string, unknown>) {
    if (!operationsReportId) return;
    const res = await apiFetch(
      `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/findings/bulk`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(await apiErrorMessage(res, "Failed to update findings"));
    }
    await Promise.all([loadReportDetail(), loadReportPreview()]);
  }

  async function previewReportRegroup() {
    if (!operationsReportId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/regroup-preview`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => null)) as {
        preview?: OperationsReportRegroupPreview;
        message?: string;
      } | null;
      if (!res.ok) {
        if (data?.preview) setReportRegroupPreview(data.preview);
        throw new Error(data?.message ?? "Failed to preview regrouping");
      }
      setReportRegroupPreview(data?.preview ?? null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to preview regrouping",
      );
    }
  }

  async function applyReportRegroup(previewHash: string) {
    if (!operationsReportId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/regroup`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirm: true, previewHash }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        report?: OperationsReportDetail;
        preview?: OperationsReportRegroupPreview;
        message?: string;
      } | null;
      if (!res.ok) {
        if (data?.preview) setReportRegroupPreview(data.preview);
        throw new Error(data?.message ?? "Failed to regroup findings");
      }
      setReportRegroupPreview(null);
      await Promise.all([
        loadReportDetail(),
        loadReportPreview(),
        loadReports(),
        loadSummary(),
      ]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to regroup findings",
      );
    }
  }

  async function patchPositiveObservation(
    observationId: string,
    input: Record<string, unknown>,
  ) {
    if (!operationsReportId) return;
    const res = await apiFetch(
      `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/positive-observations/${encodeURIComponent(observationId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(
        await apiErrorMessage(res, "Failed to update positive observation"),
      );
    }
    await Promise.all([loadReportDetail(), loadReportPreview()]);
  }

  async function patchActionPlanItem(
    itemId: string,
    input: Record<string, unknown>,
  ) {
    if (!operationsReportId) return;
    const res = await apiFetch(
      `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/action-plan-items/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      throw new Error(
        await apiErrorMessage(res, "Failed to update action plan item"),
      );
    }
    await Promise.all([loadReportDetail(), loadReportPreview()]);
  }

  async function runReportAction(endpoint: string, body?: unknown) {
    if (!operationsReportId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/${endpoint}`,
        {
          method: "POST",
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          readinessIssues?: OperationsReportReadinessIssue[];
        } | null;
        if (data?.readinessIssues)
          setReportReadinessIssues(data.readinessIssues);
        throw new Error(data?.message ?? "Report action failed");
      }
      await Promise.all([
        loadReportDetail(),
        loadReportPreview(),
        loadReports(),
        loadSummary(),
      ]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Report action failed",
      );
    }
  }

  async function recordReportSent() {
    const followUpAt = window.prompt(
      "Optional follow-up date/time (YYYY-MM-DDTHH:mm), or leave blank",
      "",
    );
    await runReportAction("record-sent", {
      deliveryMethod: "email_attachment",
      contactId: reportDetail?.report.prepared_contact_id ?? null,
      followUpAt: followUpAt ? localDateTimeToIso(followUpAt) : null,
      updatePipelineStage: true,
    });
  }

  async function createRetestReport() {
    if (!reportDetail) return;
    const scanRunId = window.prompt("Completed scan run id for the re-test");
    if (!scanRunId) return;
    await runReportAction("create-retest", {
      scanRunId,
      reportType: "post_fix_retest",
    });
  }

  async function generateReportPdf(mode: "draft" | "final" = "final") {
    if (!operationsReportId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(operationsReportId)}/generate-pdf`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          readinessIssues?: OperationsReportReadinessIssue[];
        } | null;
        if (data?.readinessIssues) {
          setReportReadinessIssues(data.readinessIssues);
        }
        throw new Error(data?.message ?? "Failed to generate PDF");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? reportFilename(reportPreview);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await Promise.all([
        loadReportDetail(),
        loadReportPreview(),
        loadReports(),
      ]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to generate PDF",
      );
    }
  }

  async function downloadSavedReportPdf(reportId: string) {
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/reports/${encodeURIComponent(reportId)}/download`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(await apiErrorMessage(res, "Failed to download PDF"));
      }
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        "scanlark-website-health-report.pdf";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to download PDF",
      );
    }
  }

  function openCreateQuote(overrides: Partial<QuoteFormState> = {}) {
    const report = reportDetail?.report;
    const selectedBusinessId =
      overrides.businessId ?? detail?.business.id ?? report?.business_id ?? "";
    setQuoteForm({
      ...emptyQuoteForm,
      businessId: selectedBusinessId,
      contactId:
        overrides.contactId ??
        detail?.primaryContact?.id ??
        report?.prepared_contact_id ??
        "",
      operationsReportId:
        overrides.operationsReportId ?? report?.id ?? operationsReportId ?? "",
      title:
        overrides.title ??
        (report ? `Fixes from ${report.title}` : "Website improvement quote"),
      scopeSummary:
        overrides.scopeSummary ??
        "Fixed-price website health work based on the agreed scope below.",
      includedScope:
        overrides.includedScope ??
        "Selected website fixes and checks listed in this quote.",
      excludedScope:
        overrides.excludedScope ??
        "New design work, third-party charges, hosting costs, and issues outside the agreed scope.",
      paymentTerms:
        overrides.paymentTerms ??
        "Payment due on completion unless otherwise agreed.",
      validUntil: overrides.validUntil ?? "",
      currency: overrides.currency ?? "GBP",
    });
    setQuoteFormErrors({});
    setQuoteFormOpen(true);
  }

  async function submitQuote(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    const errors: QuoteFormErrors = {};
    if (!quoteForm.businessId) errors.businessId = "Select a business.";
    if (
      !quoteCurrencyOptions.some((item) => item.value === quoteForm.currency)
    ) {
      errors.currency = "Select a valid currency.";
    }
    if (!quoteForm.title.trim()) errors.title = "Enter a quote title.";
    if (!quoteForm.scopeSummary.trim()) {
      errors.scopeSummary = "Enter a scope summary.";
    }
    if (Object.keys(errors).length > 0) {
      setQuoteFormErrors(errors);
      setActionError("Fix the highlighted quote fields.");
      return;
    }
    setQuoteFormErrors({});
    try {
      const res = await apiFetch(`${apiBase}/operations/quotes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: quoteForm.businessId,
          contactId: quoteForm.contactId || null,
          operationsReportId: quoteForm.operationsReportId || null,
          title: quoteForm.title,
          currency: quoteForm.currency,
          validUntil: quoteForm.validUntil || null,
          scopeSummary: quoteForm.scopeSummary,
          includedScope: quoteForm.includedScope,
          excludedScope: quoteForm.excludedScope,
          paymentTerms: quoteForm.paymentTerms,
          items: [],
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        if (data?.error === "invalid_currency") {
          setQuoteFormErrors({ currency: "Select a valid currency." });
        } else if (data?.error === "contact_not_found") {
          setQuoteFormErrors({
            contactId: "This contact does not belong to the selected business.",
          });
        } else if (data?.error === "title_required") {
          setQuoteFormErrors({ title: "Enter a quote title." });
        } else if (data?.error === "scopeSummary_required") {
          setQuoteFormErrors({ scopeSummary: "Enter a scope summary." });
        }
        throw new Error(data?.message ?? "Failed to create quote");
      }
      const data = (await res.json()) as { quote: OperationsQuoteDetail };
      setQuoteFormOpen(false);
      setQuoteForm(emptyQuoteForm);
      await Promise.all([loadQuotes(), loadSummary()]);
      onNavigate(`/operations/quotes/${data.quote.quote.id}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create quote",
      );
    }
  }

  async function patchQuote(input: Record<string, unknown>) {
    if (!quoteDetail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/quotes/${encodeURIComponent(quoteDetail.quote.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? "Failed to update quote");
    }
    await Promise.all([loadQuoteDetail(), loadQuotePreview(), loadQuotes()]);
  }

  async function runQuoteAction(
    action: string,
    body: Record<string, unknown> = {},
  ) {
    if (!quoteDetail) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes/${encodeURIComponent(quoteDetail.quote.id)}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          readinessIssues?: string[];
          completionIssues?: string[];
        } | null;
        throw new Error(
          data?.readinessIssues?.join(" ") ??
            data?.message ??
            "Quote action failed",
        );
      }
      await Promise.all([
        loadQuoteDetail(),
        loadQuotePreview(),
        loadQuotes(),
        loadWorkOrders(),
        loadSummary(),
      ]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Quote action failed",
      );
    }
  }

  async function addQuoteItem(event: React.FormEvent) {
    event.preventDefault();
    if (!quoteDetail || !quoteItemForm.title.trim()) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/quotes/${encodeURIComponent(quoteDetail.quote.id)}/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: quoteItemForm.title,
            description: quoteItemForm.description,
            quantity: Number.parseInt(quoteItemForm.quantity, 10) || 1,
            unitPrice: quoteItemForm.unitPrice,
            itemType: quoteItemForm.itemType,
            isOptional: quoteItemForm.isOptional,
            isSelected: quoteItemForm.isSelected,
            estimatedEffort: quoteItemForm.estimatedEffort,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to add quote item");
      setQuoteItemForm(emptyQuoteItemForm);
      await Promise.all([loadQuoteDetail(), loadQuotePreview()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add item");
    }
  }

  async function updateQuoteItem(
    item: OperationsQuoteItem,
    input: Record<string, unknown>,
  ) {
    if (!quoteDetail) return;
    const res = await apiFetch(
      `${apiBase}/operations/quotes/${encodeURIComponent(quoteDetail.quote.id)}/items/${encodeURIComponent(item.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error("Failed to update quote item");
    await Promise.all([loadQuoteDetail(), loadQuotePreview()]);
  }

  async function generateQuotePdf() {
    await runQuoteAction("generate-pdf");
    window.setTimeout(() => window.print(), 50);
  }

  async function recordQuoteAccepted() {
    if (!quoteDetail) return;
    if (
      !window.confirm("Record this quote as explicitly accepted by the client?")
    ) {
      return;
    }
    await runQuoteAction("record-accepted", {
      acceptedAt: new Date().toISOString(),
      acceptanceMethod: "email",
      totalMinorConfirmed: quoteDetail.quote.total_minor,
      selectedItemsConfirmed: true,
      freezeConfirmed: true,
    });
  }

  async function convertQuoteToWork() {
    if (!quoteDetail) return;
    if (!window.confirm("Convert this accepted quote into a work order?"))
      return;
    await runQuoteAction("convert-to-work");
    await loadWorkOrders();
  }

  async function patchWorkOrder(input: Record<string, unknown>) {
    if (!workDetail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/work-orders/${encodeURIComponent(workDetail.workOrder.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error("Failed to update work order");
    await Promise.all([loadWorkDetail(), loadWorkOrders(), loadSummary()]);
  }

  async function completeWorkOrder() {
    if (!workDetail) return;
    setActionError(null);
    const completionSummary =
      workDetail.workOrder.completion_summary ?? "Agreed work completed.";
    const res = await apiFetch(
      `${apiBase}/operations/work-orders/${encodeURIComponent(
        workDetail.workOrder.id,
      )}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completionSummary }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      const issues = Array.isArray(data?.details?.completionIssues)
        ? data.details.completionIssues.join(" ")
        : "";
      throw new Error(issues || "Failed to complete work order");
    }
    await Promise.all([loadWorkDetail(), loadWorkOrders(), loadSummary()]);
  }

  async function updateWorkItem(
    item: OperationsWorkItem,
    input: Record<string, unknown>,
  ) {
    if (!workDetail) return;
    const res = await apiFetch(
      `${apiBase}/operations/work-orders/${encodeURIComponent(
        workDetail.workOrder.id,
      )}/items/${encodeURIComponent(item.id)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw new Error("Failed to update work item");
    await Promise.all([loadWorkDetail(), loadWorkOrders(), loadSummary()]);
  }

  function openCreateService(overrides: Partial<ServiceFormState> = {}) {
    const selectedBusinessId =
      overrides.businessId ??
      detail?.business.id ??
      quoteDetail?.quote.business_id ??
      "";
    const selectedBusinessDetail =
      detail?.business.id === selectedBusinessId ? detail : null;
    const plan = servicePlans.find(
      (item) => item.id === overrides.servicePlanId,
    );
    setServiceForm({
      ...emptyServiceForm,
      businessId: selectedBusinessId,
      contactId:
        overrides.contactId ?? selectedBusinessDetail?.primaryContact?.id ?? "",
      servicePlanId: overrides.servicePlanId ?? "",
      sourceQuoteId: overrides.sourceQuoteId ?? "",
      sourceWorkOrderId: overrides.sourceWorkOrderId ?? "",
      name:
        overrides.name ??
        plan?.name ??
        (selectedBusinessDetail
          ? `${selectedBusinessDetail.business.name} managed service`
          : "Managed service"),
      currency: overrides.currency ?? plan?.default_currency ?? "GBP",
      agreedPrice:
        overrides.agreedPrice ??
        formatMajorMoneyInput(plan?.default_price_minor),
      billingCadence:
        overrides.billingCadence ?? plan?.default_billing_cadence ?? "monthly",
      scanFrequency:
        overrides.scanFrequency ?? plan?.default_scan_frequency ?? "weekly",
      reportFrequency:
        overrides.reportFrequency ??
        plan?.default_report_frequency ??
        "monthly",
      reviewFrequency:
        overrides.reviewFrequency ??
        plan?.default_review_frequency ??
        "quarterly",
      includedScope: overrides.includedScope ?? plan?.included_scope ?? "",
      excludedScope: overrides.excludedScope ?? plan?.excluded_scope ?? "",
      scopeSummary: overrides.scopeSummary ?? plan?.scope_summary ?? "",
      customTerms: overrides.customTerms ?? "",
      startDate: overrides.startDate ?? "",
      renewalDate: overrides.renewalDate ?? "",
      zeroCostConfirmed: overrides.zeroCostConfirmed ?? false,
      siteIds:
        overrides.siteIds ??
        (selectedBusinessDetail?.linkedSites[0]?.site_id
          ? [selectedBusinessDetail.linkedSites[0].site_id]
          : []),
    });
    setServiceCreateDetail(selectedBusinessDetail);
    setServiceFormOpen(true);
    if (selectedBusinessId && !selectedBusinessDetail) {
      void loadServiceCreateBusiness(selectedBusinessId);
    }
  }

  async function submitService(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch(`${apiBase}/operations/services`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...serviceForm,
          contactId: serviceForm.contactId || null,
          servicePlanId: serviceForm.servicePlanId || null,
          sourceQuoteId: serviceForm.sourceQuoteId || null,
          sourceWorkOrderId: serviceForm.sourceWorkOrderId || null,
          agreedPrice: serviceForm.agreedPrice,
          startDate: localDateToIso(serviceForm.startDate),
          renewalDate: localDateToIso(serviceForm.renewalDate),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to create service");
      }
      const data = (await res.json()) as {
        service: OperationsClientServiceDetail;
      };
      setServiceFormOpen(false);
      setServiceForm(emptyServiceForm);
      await Promise.all([loadServices(), loadSummary(), loadDetail()]);
      onNavigate(`/operations/services/${data.service.service.id}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create service",
      );
    }
  }

  async function runServiceAction(endpoint: string, body?: unknown) {
    if (!serviceDetail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/services/${encodeURIComponent(
        serviceDetail.service.id,
      )}/${endpoint}`,
      {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        activationIssues?: string[];
      } | null;
      throw new Error(
        data?.activationIssues?.join(", ") ??
          data?.message ??
          "Service action failed",
      );
    }
    await Promise.all([loadServiceDetail(), loadServices(), loadSummary()]);
  }

  async function activateService() {
    if (!serviceDetail) return;
    if (
      !window.confirm("Activate this managed service as explicitly agreed?")
    ) {
      return;
    }
    await runServiceAction("activate", {
      agreedAt: new Date().toISOString(),
      acceptanceMethod: "manual_confirmation",
      agreementConfirmed: true,
      updateBusinessRelationship: true,
      updatePipelineStage: true,
    });
  }

  async function addServiceUsage(event: React.FormEvent) {
    event.preventDefault();
    if (!serviceDetail) return;
    setActionError(null);
    const res = await apiFetch(
      `${apiBase}/operations/services/${encodeURIComponent(
        serviceDetail.service.id,
      )}/usage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...serviceUsageForm,
          minutesUsed: serviceUsageForm.minutesUsed
            ? Number(serviceUsageForm.minutesUsed)
            : null,
          fixesUsed: serviceUsageForm.fixesUsed
            ? Number(serviceUsageForm.fixesUsed)
            : null,
        }),
      },
    );
    if (!res.ok) throw new Error("Failed to record usage");
    setServiceUsageForm(emptyServiceUsageForm);
    await Promise.all([loadServiceDetail(), loadServices(), loadSummary()]);
  }

  async function renderCommunicationDraft(options: {
    useCurrentContent: boolean;
    source: "manual" | "auto" | "save";
  }) {
    if (!communicationForm.businessId || !communicationForm.templateId) {
      return null;
    }
    const renderInput = communicationForm;
    const renderSequence = communicationRenderSequenceRef.current + 1;
    communicationRenderSequenceRef.current = renderSequence;
    if (options.source !== "auto") setActionError(null);
    setCommunicationForm((prev) => ({
      ...prev,
      renderStatus: "rendering",
      copyStatus:
        options.source === "save"
          ? "Rendering the latest draft before saving..."
          : prev.copyStatus,
    }));
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(
          renderInput.businessId,
        )}/communications/draft`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            templateId: renderInput.templateId,
            contactId: renderInput.contactId || null,
            followUpAt: localDateTimeToIso(renderInput.followUpAt),
            senderIdentityKey: renderInput.senderIdentityKey,
            wordingVariantKey: renderInput.wordingVariantKey || null,
            signatureMode: renderInput.signatureMode,
            ...(options.useCurrentContent
              ? {
                  manualSubject: renderInput.subject,
                  manualPreheader: renderInput.preheader,
                  manualBody: renderInput.body,
                  manualPlainText:
                    renderInput.plainTextBody || renderInput.body,
                }
              : {}),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to render draft");
      const data = (await res.json()) as {
        draft: {
          subject: string;
          preheader: string;
          body: string;
          htmlFragment: string;
          htmlDocument: string;
          plainText: string;
          unresolvedPlaceholders: string[];
          warnings: string[];
          publicAssetUrls: string[];
          attachmentRequirements: CommunicationAttachmentRequirement[];
          layoutKey: CommunicationLayoutKey;
          signatureMode: CommunicationSignatureMode;
          senderIdentityKey: string | null;
          templateSnapshot: Record<string, unknown>;
          suggestedFollowUpAt?: string | null;
          contactWarning?: {
            doNotContact: boolean;
            reason: string | null;
            preferredChannel: CommunicationChannel | null;
          } | null;
        };
      };
      if (communicationRenderSequenceRef.current !== renderSequence) {
        return null;
      }
      const selectedContact = selectedCommunicationContact();
      const context = communicationBusinessContext();
      const renderedAt = new Date().toISOString();
      const renderedDraft = {
        subject: data.draft.subject,
        preheader: data.draft.preheader,
        body: data.draft.body,
        htmlFragment: data.draft.htmlFragment,
        htmlDocument: data.draft.htmlDocument,
        plainTextBody: data.draft.plainText,
        layoutKey: data.draft.layoutKey,
        signatureMode: data.draft.signatureMode,
        senderIdentityKey:
          data.draft.senderIdentityKey ?? renderInput.senderIdentityKey,
        recipientName:
          selectedContact != null
            ? contactName(selectedContact)
            : (context?.business.name ?? ""),
        recipientEmail: communicationRecipientEmail(),
        publicAssetUrls: data.draft.publicAssetUrls,
        attachmentRequirements: data.draft.attachmentRequirements,
        attachmentConfirmed: data.draft.attachmentRequirements.length === 0,
        templateSnapshot: data.draft.templateSnapshot,
        renderWarnings: data.draft.warnings,
        hasUnsavedRenderEdits: false,
        renderStatus: "current" as const,
        copyStatus: "",
        followUpAt:
          renderInput.followUpAt ||
          toDateTimeLocalValue(data.draft.suggestedFollowUpAt ?? null),
        unresolvedPlaceholders: data.draft.unresolvedPlaceholders,
      };
      setCommunicationForm((prev) => ({
        ...prev,
        ...renderedDraft,
        renderVersion: prev.renderVersion + 1,
        lastRenderedAt: renderedAt,
      }));
      return {
        ...renderedDraft,
        renderVersion: renderInput.renderVersion + 1,
        lastRenderedAt: renderedAt,
      };
    } catch (err) {
      if (communicationRenderSequenceRef.current === renderSequence) {
        setCommunicationForm((prev) => ({
          ...prev,
          renderStatus: "failed",
          hasUnsavedRenderEdits: true,
          copyStatus:
            "Render failed. Save/copy is blocked until preview renders.",
        }));
      }
      if (options.source !== "auto") {
        setActionError(
          err instanceof Error ? err.message : "Failed to render draft",
        );
      }
      return null;
    }
  }

  async function generateDraft() {
    await renderCommunicationDraft({
      useCurrentContent: false,
      source: "manual",
    });
  }

  async function saveCommunication(status: CommunicationStatus) {
    if (!communicationForm.businessId || !communicationForm.body.trim()) return;
    const unresolved = findEditorPlaceholders(
      communicationForm.subject,
      communicationForm.body,
    );
    if (status === "ready" && unresolved.length > 0) {
      setActionError(
        `Resolve unresolved placeholders before marking ready: ${unresolved.join(
          ", ",
        )}`,
      );
      return;
    }
    if (
      status === "sent" &&
      communicationForm.attachmentRequirements.some((item) => item.required) &&
      !communicationForm.attachmentConfirmed
    ) {
      setActionError(
        "Confirm the required attachment was added in IONOS before marking sent.",
      );
      return;
    }
    let unresolvedPlaceholderOverride = false;
    let unresolvedPlaceholderOverrideReason = "";
    if (status === "sent") {
      const recipient = communicationRecipientEmail();
      if (
        communicationForm.channel === "email" &&
        !window.confirm(
          `Confirm this email was sent to ${recipient || "the reviewed recipient"}?`,
        )
      ) {
        return;
      }
      if (unresolved.length > 0) {
        const reason = window.prompt(
          `This communication still contains unresolved placeholders: ${unresolved.join(
            ", ",
          )}\n\nEnter an exceptional override reason to mark it sent, or cancel.`,
        );
        if (!reason?.trim()) return;
        unresolvedPlaceholderOverride = true;
        unresolvedPlaceholderOverrideReason = reason.trim();
      }
    }
    if (status === "sent" && !confirmDoNotContactOverride("mark this sent")) {
      return;
    }
    setActionError(null);
    try {
      let formForSave = communicationForm;
      if (
        communicationForm.hasUnsavedRenderEdits ||
        communicationForm.renderStatus !== "current"
      ) {
        const rendered = await renderCommunicationDraft({
          useCurrentContent: true,
          source: "save",
        });
        if (!rendered) {
          throw new Error("Render the latest draft before saving.");
        }
        formForSave = {
          ...communicationForm,
          ...rendered,
          hasUnsavedRenderEdits: false,
          lastSavedAt: new Date().toISOString(),
        };
      }
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(
          formForSave.businessId,
        )}/communications`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contactId: formForSave.contactId || null,
            templateId: formForSave.templateId || null,
            direction: formForSave.direction,
            channel: formForSave.channel,
            status,
            subject: formForSave.subject,
            body: formForSave.body,
            preheader: formForSave.preheader || null,
            htmlFragment: formForSave.htmlFragment || null,
            htmlDocument: formForSave.htmlDocument || null,
            plainTextBody: formForSave.plainTextBody || formForSave.body,
            layoutKey: formForSave.layoutKey,
            wordingVariantKey: formForSave.wordingVariantKey || null,
            signatureMode: formForSave.signatureMode,
            senderIdentityKey: formForSave.senderIdentityKey || null,
            senderName: formForSave.senderName || null,
            senderEmail: formForSave.senderEmail || null,
            recipientName: formForSave.recipientName || null,
            recipientEmail:
              formForSave.recipientEmail ||
              communicationRecipientEmail() ||
              null,
            templateSnapshotJson: formForSave.templateSnapshot,
            publicAssetUrlsJson: formForSave.publicAssetUrls,
            attachmentRequirementsJson: formForSave.attachmentRequirements,
            attachmentConfirmedAt:
              formForSave.attachmentRequirements.length > 0 &&
              formForSave.attachmentConfirmed
                ? new Date().toISOString()
                : null,
            attachmentConfirmationNote:
              formForSave.attachmentConfirmationNote || null,
            followUpAt: localDateTimeToIso(formForSave.followUpAt),
            taskTitle: formForSave.taskTitle,
            taskNotes: formForSave.taskNotes,
            unresolvedPlaceholderOverride,
            unresolvedPlaceholderOverrideReason,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Failed to save communication");
      }
      setCommunicationFormOpen(false);
      setCommunicationForm(emptyCommunicationForm);
      setPendingSendPrompt(null);
      await Promise.all([loadCommunications(), loadSummary(), loadTasks()]);
      if (businessId) await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save communication",
      );
    }
  }

  async function copyCommunication() {
    setCommunicationForm((prev) => ({
      ...prev,
      copyStatus:
        "Save your latest changes before copying formatted email. Copy from the saved communication record.",
    }));
  }

  async function copyCommunicationPart(kind: "recipient" | "subject" | "body") {
    const value =
      kind === "recipient"
        ? communicationRecipientEmail()
        : kind === "subject"
          ? communicationForm.subject
          : communicationForm.plainTextBody || communicationForm.body;
    await navigator.clipboard.writeText(value);
  }

  function downloadSavedCommunicationHtml(communication: Communication) {
    const html =
      communication.html_document ||
      (communication.html_fragment
        ? `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlText(
            communication.subject ?? "Scanlark email",
          )}</title></head><body>${communication.html_fragment}</body></html>`
        : "");
    if (!html.trim()) {
      setCommunicationCopyStatus("Saved HTML email output is not available.");
      return;
    }
    const slug = (communication.subject || "scanlark-email")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug || "scanlark-email"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setCommunicationCopyStatus("Saved HTML email downloaded.");
  }

  function openEmailClient() {
    if (!confirmDoNotContactOverride("open the email client")) return;
    const to = communicationRecipientEmail();
    if (communicationForm.channel === "email" && !to) {
      setActionError(
        "Select a contact with an email or use the business email.",
      );
      return;
    }
    const params = new URLSearchParams({
      subject: communicationForm.subject,
      body: communicationForm.body,
    });
    window.location.href = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
    setPendingSendPrompt({ recipient: to, channel: "mailto" });
  }

  function openWebmail() {
    if (!confirmDoNotContactOverride("open webmail")) return;
    window.open(operationsWebmailUrl, "_blank", "noopener,noreferrer");
    setPendingSendPrompt({
      recipient: communicationRecipientEmail(),
      channel: "webmail",
    });
  }

  async function markExistingCommunicationSent(item: Communication) {
    setActionError(null);
    const sender = senderIdentities[0] ?? {
      key: "default",
      name: item.sender_name ?? "Connor Smith",
      email: item.sender_email ?? "connor@scanlark.com",
    };
    const requiresAttachment = item.attachment_requirements_json?.some(
      (requirement) => requirement.required,
    );
    if (
      requiresAttachment &&
      !window.confirm(
        "Confirm the required attachment was added in IONOS before marking sent.",
      )
    ) {
      return;
    }
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(
        item.business_id,
      )}/communications/${encodeURIComponent(item.id)}/mark-sent`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject: item.subject,
          body: item.body,
          preheader: item.preheader,
          htmlFragment: item.html_fragment,
          htmlDocument: item.html_document,
          plainTextBody: item.plain_text_body ?? item.body,
          layoutKey: item.layout_key,
          signatureMode: item.signature_mode ?? "include_scanlark_signature",
          senderIdentityKey: item.sender_identity_key ?? sender.key,
          senderName: item.sender_name ?? sender.name,
          senderEmail: item.sender_email ?? sender.email,
          recipientName: item.recipient_name,
          recipientEmail: item.recipient_email ?? item.contact_email,
          publicAssetUrlsJson: item.public_asset_urls_json ?? [],
          attachmentRequirementsJson: item.attachment_requirements_json ?? [],
          attachmentConfirmedAt: requiresAttachment
            ? new Date().toISOString()
            : item.attachment_confirmed_at,
        }),
      },
    );
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(data?.message ?? "Failed to mark communication sent");
    }
    setPendingSendPrompt(null);
    await Promise.all([loadCommunications(), loadSummary(), loadTasks()]);
  }

  async function submitTemplate(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch(
        editingTemplateId
          ? `${apiBase}/operations/communication-templates/${encodeURIComponent(
              editingTemplateId,
            )}`
          : `${apiBase}/operations/communication-templates`,
        {
          method: editingTemplateId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...templateForm,
            contentVariantsJson: templateForm.contentVariantsJson,
            subjectSuggestionsJson: templateForm.subjectSuggestionsJson,
            defaultFollowUpBusinessDays:
              templateForm.defaultFollowUpBusinessDays.trim() === ""
                ? null
                : Number.parseInt(templateForm.defaultFollowUpBusinessDays, 10),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to create template");
      setTemplateForm(emptyTemplateForm);
      setEditingTemplateId(null);
      await loadCommunicationTemplates();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create template",
      );
    }
  }

  async function toggleTemplate(template: CommunicationTemplate) {
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/communication-templates/${encodeURIComponent(
          template.id,
        )}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isActive: !template.is_active }),
        },
      );
      if (!res.ok) throw new Error("Failed to update template");
      await loadCommunicationTemplates();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update template",
      );
    }
  }

  async function duplicateTemplate(template: CommunicationTemplate) {
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/communication-templates/${encodeURIComponent(
          template.id,
        )}/duplicate`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("Failed to duplicate template");
      await loadCommunicationTemplates();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to duplicate template",
      );
    }
  }

  function openTemplateEditor(template?: CommunicationTemplate) {
    if (!template) {
      setEditingTemplateId(null);
      setTemplateForm(emptyTemplateForm);
      setTemplateEditorOpen(true);
      return;
    }
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      category: template.category,
      subjectTemplate: template.subject_template,
      preheaderTemplate: template.preheader_template ?? "",
      bodyTemplate: template.body_template,
      htmlBodyTemplate: template.html_body_template ?? "",
      plainTextTemplate: template.plain_text_template ?? "",
      layoutKey: template.layout_key,
      contentVariantsJson: template.content_variants_json ?? [],
      subjectSuggestionsJson: template.subject_suggestions_json ?? [],
      attachmentPolicy: template.attachment_policy,
      signatureMode: template.signature_mode,
      defaultFollowUpBusinessDays:
        template.default_follow_up_business_days == null
          ? ""
          : String(template.default_follow_up_business_days),
      isActive: template.is_active,
    });
    setTemplateEditorOpen(true);
  }

  function communicationPreviewDocument() {
    const document =
      communicationForm.htmlDocument ||
      `<!doctype html><html><body><pre>${communicationForm.body}</pre></body></html>`;
    if (communicationForm.previewMode !== "images_hidden") return document;
    return document.replace(
      "</head>",
      "<style>img{visibility:hidden!important;} img::after{content:attr(alt);visibility:visible;}</style></head>",
    );
  }

  function communicationRenderStatusLabel() {
    if (communicationForm.renderStatus === "rendering") return "Rendering...";
    if (communicationForm.renderStatus === "current") return "Preview current";
    if (communicationForm.renderStatus === "stale") return "Preview stale";
    if (communicationForm.renderStatus === "failed") return "Render failed";
    return "Generate draft";
  }

  async function runTaskAction(
    task: OperationsTask,
    action: "complete" | "snooze" | "cancel" | "reschedule",
  ) {
    setActionError(null);
    try {
      let endpoint = `${apiBase}/operations/tasks/${encodeURIComponent(task.id)}/${action}`;
      let init: RequestInit = { method: "POST" };
      if (action === "snooze") {
        const snoozedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        init = {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snoozedUntil: snoozedUntil.toISOString() }),
        };
      }
      if (action === "reschedule") {
        const raw = window.prompt(
          "New follow-up date/time",
          toDateTimeLocalValue(task.due_at),
        );
        if (!raw) return;
        endpoint = `${apiBase}/operations/tasks/${encodeURIComponent(task.id)}`;
        init = {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            dueAt: localDateTimeToIso(raw),
            status: "open",
          }),
        };
      }
      const res = await apiFetch(endpoint, init);
      if (!res.ok) throw new Error("Failed to update task");
      await Promise.all([loadTasks(), loadSummary()]);
      if (businessId) await loadDetail();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Task update failed");
    }
  }

  async function runDetailAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function runBusinessListAction(action: () => Promise<void>) {
    setBusinessesError(null);
    setActionError(null);
    try {
      await action();
      await Promise.all([loadBusinesses(), loadSummary()]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Business action failed";
      setBusinessesError(message);
      setActionError(message);
    }
  }

  async function archiveBusinessListItem(business: BusinessListRow) {
    const endpoint = business.is_archived ? "restore" : "archive";
    if (
      !business.is_archived &&
      !window.confirm(
        "Archive this business? Operational history is preserved.",
      )
    ) {
      return;
    }
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(business.id)}/${endpoint}`,
      { method: "POST" },
    );
    if (!res.ok) {
      throw new Error(
        await apiErrorMessage(res, "Failed to update business lifecycle"),
      );
    }
  }

  async function deleteBusinessListItem(business: BusinessListRow) {
    if (
      !window.confirm(
        "Delete this unused test business? Contacts, sites, reports, quotes, work orders and services will block deletion.",
      )
    ) {
      return;
    }
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(business.id)}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      throw new Error(await apiErrorMessage(res, "Failed to delete business"));
    }
  }

  async function runReportListAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
      await Promise.all([loadReports(), loadSummary()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Report action failed",
      );
    }
  }

  async function runServiceListAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
      await Promise.all([loadServices(), loadSummary()]);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Managed service action failed",
      );
    }
  }

  async function runContactLifecycle(
    contact: Contact,
    endpoint: "archive" | "restore" | "delete",
    body?: Record<string, unknown>,
  ) {
    if (!detail) return;
    const method = endpoint === "delete" ? "DELETE" : "POST";
    const res = await apiFetch(
      `${apiBase}/operations/businesses/${encodeURIComponent(detail.business.id)}/contacts/${encodeURIComponent(
        contact.id,
      )}${endpoint === "delete" ? "" : `/${endpoint}`}`,
      {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      },
    );
    if (!res.ok) {
      throw new Error(await apiErrorMessage(res, "Contact action failed"));
    }
    await loadDetail();
  }

  function openEditBusiness() {
    if (!detail) return;
    const b = detail.business;
    setBusinessForm({
      ...emptyBusinessForm,
      name: b.name,
      websiteUrl: b.website_url ?? "",
      generalEmail: b.general_email ?? "",
      phone: b.phone ?? "",
      businessType: b.business_type ?? "",
      location: b.location ?? "",
      source: b.source ?? "",
      pipelineStage: b.pipeline_stage,
      relationshipType: b.relationship_type,
      nextFollowUpAt: b.next_follow_up_at
        ? b.next_follow_up_at.slice(0, 10)
        : "",
      nextAction: b.next_action ?? "",
    });
    setEditBusinessOpen(true);
  }

  function openEditContact(contact: Contact) {
    setEditingContactId(contact.id);
    setContactForm({
      firstName: contact.first_name ?? "",
      lastName: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      jobTitle: contact.job_title ?? "",
      notes: contact.notes ?? "",
      isPrimary: contact.is_primary,
      doNotContact: contact.do_not_contact,
      doNotContactReason: contact.do_not_contact_reason ?? "",
      preferredChannel: contact.preferred_channel ?? "",
    });
    setContactFormOpen(true);
  }

  function renderBusinessForm(mode: "create" | "edit") {
    return (
      <form
        className="ops-form"
        onSubmit={mode === "create" ? submitBusiness : submitEditBusiness}
      >
        <div className="ops-form-grid">
          <label>
            Business name
            <input
              value={businessForm.name}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Website URL
            <input
              value={businessForm.websiteUrl}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  websiteUrl: event.target.value,
                }))
              }
              placeholder="https://example.com"
            />
          </label>
          <label>
            Pipeline stage
            <select
              value={businessForm.pipelineStage}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  pipelineStage: event.target.value as PipelineStage,
                }))
              }
            >
              {pipelineStageOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Relationship type
            <select
              value={businessForm.relationshipType}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  relationshipType: event.target.value as RelationshipType,
                }))
              }
            >
              {relationshipTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            General email
            <input
              value={businessForm.generalEmail}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  generalEmail: event.target.value,
                }))
              }
              type="email"
            />
          </label>
          <label>
            Phone
            <input
              value={businessForm.phone}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Business type
            <input
              value={businessForm.businessType}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  businessType: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Location
            <input
              value={businessForm.location}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  location: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Source
            <input
              value={businessForm.source}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  source: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Next follow-up
            <input
              value={businessForm.nextFollowUpAt}
              onChange={(event) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  nextFollowUpAt: event.target.value,
                }))
              }
              type="date"
            />
          </label>
        </div>
        <label>
          Next action
          <input
            value={businessForm.nextAction}
            onChange={(event) =>
              setBusinessForm((prev) => ({
                ...prev,
                nextAction: event.target.value,
              }))
            }
          />
        </label>
        {mode === "create" && (
          <>
            <div className="ops-section-label">Primary contact</div>
            <div className="ops-form-grid">
              <label>
                Name
                <input
                  value={businessForm.primaryContactName}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactName: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  value={businessForm.primaryContactEmail}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactEmail: event.target.value,
                    }))
                  }
                  type="email"
                />
              </label>
              <label>
                Phone
                <input
                  value={businessForm.primaryContactPhone}
                  onChange={(event) =>
                    setBusinessForm((prev) => ({
                      ...prev,
                      primaryContactPhone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Initial note
              <textarea
                value={businessForm.initialNote}
                onChange={(event) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    initialNote: event.target.value,
                  }))
                }
              />
            </label>
          </>
        )}
        {businessFormError && (
          <div className="ops-error">{businessFormError}</div>
        )}
        <div className="ops-form-actions">
          <button
            type="submit"
            className="ops-button ops-button--primary"
            disabled={businessSaving}
          >
            {businessSaving
              ? "Saving..."
              : mode === "create"
                ? "Add business"
                : "Save changes"}
          </button>
          <button
            type="button"
            className="ops-button"
            onClick={() => {
              setAddBusinessOpen(false);
              setEditBusinessOpen(false);
              setBusinessFormError(null);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderCommunicationModal() {
    if (!communicationFormOpen) return null;
    const businessContext = communicationBusinessContext();
    const contactOptions =
      businessContext?.contacts.filter((contact) => !contact.archived_at) ?? [];
    const selectedContact = selectedCommunicationContact();
    const recipientEmail = communicationRecipientEmail();
    const selectedTemplate = communicationTemplates.find(
      (template) => template.id === communicationForm.templateId,
    );
    return (
      <div className="ops-modal">
        <div className="ops-modal__panel ops-modal__panel--wide">
          <div className="ops-panel__header">
            <div>
              <div className="ops-eyebrow">Manual communication</div>
              <h2>
                {communicationForm.direction === "outbound"
                  ? "Draft client email"
                  : communicationForm.direction === "inbound"
                    ? "Record client reply"
                    : "Record communication note"}
              </h2>
            </div>
            <button
              className="ops-button"
              onClick={() => setCommunicationFormOpen(false)}
            >
              Close
            </button>
          </div>
          <div className="ops-composer">
            <div className="ops-form">
              <div className="ops-form-grid">
                <label>
                  Business
                  <select
                    value={communicationForm.businessId}
                    onChange={(event) => {
                      const nextBusinessId = event.target.value;
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        businessId: nextBusinessId,
                        contactId: "",
                        unresolvedPlaceholders: findEditorPlaceholders(
                          prev.subject,
                          prev.body,
                        ),
                      }));
                      void loadReportCreateBusiness(nextBusinessId);
                    }}
                    disabled={Boolean(detail)}
                  >
                    <option value="">Select business</option>
                    {[
                      ...(detail ? [detail.business] : []),
                      ...businesses.filter(
                        (business) => business.id !== detail?.business.id,
                      ),
                    ].map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Contact
                  <select
                    value={communicationForm.contactId}
                    onChange={(event) => {
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        contactId: event.target.value,
                      }));
                    }}
                  >
                    <option value="">No contact selected</option>
                    {businessContext?.business.general_email && (
                      <option value="">Use business email</option>
                    )}
                    {contactOptions.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contactName(contact)}
                        {contact.email ? ` · ${contact.email}` : " · no email"}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Template
                  <select
                    value={communicationForm.templateId}
                    onChange={(event) => {
                      const template = communicationTemplates.find(
                        (item) => item.id === event.target.value,
                      );
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        templateId: event.target.value,
                        layoutKey: template?.layout_key ?? prev.layoutKey,
                        wordingVariantKey:
                          template?.content_variants_json?.[0]?.key ?? "",
                        signatureMode:
                          template?.signature_mode ?? prev.signatureMode,
                        preheader: template?.preheader_template ?? "",
                        htmlFragment: "",
                        htmlDocument: "",
                        plainTextBody: "",
                        attachmentRequirements: [],
                        attachmentConfirmed: false,
                      }));
                    }}
                  >
                    <option value="">No template</option>
                    {communicationTemplates
                      .filter((template) => template.is_active)
                      .map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    value={communicationForm.direction}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        direction: event.target.value as CommunicationDirection,
                        status:
                          event.target.value === "inbound"
                            ? "received"
                            : prev.status,
                      }))
                    }
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="internal_note">Internal note</option>
                  </select>
                </label>
                <label>
                  Channel
                  <select
                    value={communicationForm.channel}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        channel: event.target.value as CommunicationChannel,
                      }))
                    }
                  >
                    {communicationChannelOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Follow-up
                  <input
                    type="datetime-local"
                    value={communicationForm.followUpAt}
                    onChange={(event) => {
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        followUpAt: event.target.value,
                      }));
                    }}
                  />
                </label>
              </div>
              <div className="ops-form-grid">
                <label>
                  Sender
                  <select
                    value={communicationForm.senderIdentityKey}
                    onChange={(event) => {
                      const sender = senderIdentities.find(
                        (item) => item.key === event.target.value,
                      );
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        senderIdentityKey: event.target.value,
                        senderName: sender?.name ?? prev.senderName,
                        senderEmail: sender?.email ?? prev.senderEmail,
                      }));
                    }}
                  >
                    {senderIdentities.length === 0 && (
                      <option value={communicationForm.senderIdentityKey}>
                        {communicationForm.senderName || "Default sender"}
                      </option>
                    )}
                    {senderIdentities.map((identity) => (
                      <option key={identity.key} value={identity.key}>
                        {identity.name} · {identity.email}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Wording variant
                  <select
                    value={communicationForm.wordingVariantKey}
                    onChange={(event) => {
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        wordingVariantKey: event.target.value,
                      }));
                    }}
                  >
                    <option value="">Default wording</option>
                    {selectedTemplate?.content_variants_json?.map((variant) => (
                      <option key={variant.key} value={variant.key}>
                        {variant.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Signature
                  <select
                    value={communicationForm.signatureMode}
                    onChange={(event) => {
                      invalidateCommunicationRender();
                      setCommunicationForm((prev) => ({
                        ...markCommunicationRenderStale(prev),
                        signatureMode: event.target
                          .value as CommunicationSignatureMode,
                      }));
                    }}
                  >
                    <option value="include_scanlark_signature">
                      Include Scanlark signature
                    </option>
                    <option value="use_mailbox_signature">
                      Use mailbox signature instead
                    </option>
                  </select>
                </label>
              </div>
              <label>
                Subject
                <input
                  value={communicationForm.subject}
                  onChange={(event) =>
                    setCommunicationSubject(event.target.value)
                  }
                />
              </label>
              <label>
                Preheader
                <input
                  value={communicationForm.preheader}
                  onChange={(event) => {
                    invalidateCommunicationRender();
                    setCommunicationForm((prev) => ({
                      ...markCommunicationRenderStale(prev),
                      preheader: event.target.value,
                    }));
                  }}
                />
              </label>
              <label>
                Body
                <textarea
                  className="ops-communication-body"
                  value={communicationForm.body}
                  onChange={(event) => setCommunicationBody(event.target.value)}
                />
              </label>
              <div className="ops-form-grid">
                <label>
                  Follow-up task title
                  <input
                    value={communicationForm.taskTitle}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        taskTitle: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Follow-up task notes
                  <input
                    value={communicationForm.taskNotes}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        taskNotes: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {communicationForm.unresolvedPlaceholders.length > 0 && (
                <div className="ops-warning">
                  <strong>Resolve placeholders before marking ready:</strong>{" "}
                  {communicationForm.unresolvedPlaceholders.join(", ")}
                </div>
              )}
              <div className="ops-empty-card">
                <strong>Recipient review</strong>
                <span>
                  {recipientEmail
                    ? `Email to ${recipientEmail}`
                    : communicationForm.channel === "email"
                      ? "No recipient email selected. Choose a contact with email or use the business email."
                      : "Non-email communication."}
                </span>
                {businessContext?.business.general_email &&
                  !communicationForm.contactId && (
                    <small>
                      Using business email:{" "}
                      {businessContext.business.general_email}
                    </small>
                  )}
              </div>
              {selectedContact?.do_not_contact &&
                communicationForm.direction === "outbound" && (
                  <div className="ops-warning">
                    {contactName(selectedContact)} is marked do-not-contact
                    {selectedContact.do_not_contact_reason
                      ? `: ${selectedContact.do_not_contact_reason}`
                      : "."}
                  </div>
                )}
              {selectedContact?.preferred_channel && (
                <div className="ops-muted">
                  Preferred channel:{" "}
                  {communicationChannelLabel(selectedContact.preferred_channel)}
                </div>
              )}
              {communicationForm.renderWarnings.length > 0 && (
                <div className="ops-warning">
                  <strong>Draft warnings:</strong>{" "}
                  {communicationForm.renderWarnings.join(" ")}
                </div>
              )}
              {communicationForm.hasUnsavedRenderEdits && (
                <div className="ops-warning">
                  Save your latest changes before copying or downloading.
                  Preview can render unsaved edits, but handoff actions use
                  saved content.
                </div>
              )}
              {communicationForm.attachmentRequirements.length > 0 && (
                <div className="ops-empty-card">
                  <strong>Attachment checklist</strong>
                  {communicationForm.attachmentRequirements.map((item) => (
                    <label key={item.key} className="ops-checkbox-row">
                      <input
                        type="checkbox"
                        checked={communicationForm.attachmentConfirmed}
                        onChange={(event) =>
                          setCommunicationForm((prev) => ({
                            ...prev,
                            attachmentConfirmed: event.target.checked,
                          }))
                        }
                      />
                      {item.label}
                    </label>
                  ))}
                  <input
                    value={communicationForm.attachmentConfirmationNote}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        attachmentConfirmationNote: event.target.value,
                      }))
                    }
                    placeholder="Optional attachment note"
                  />
                </div>
              )}
              {communicationForm.copyStatus && (
                <div className="ops-muted">{communicationForm.copyStatus}</div>
              )}
              <div className="ops-form-actions">
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void generateDraft()}
                  disabled={
                    !communicationForm.businessId ||
                    !communicationForm.templateId
                  }
                >
                  Generate draft
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void copyCommunicationPart("recipient")}
                  disabled={!recipientEmail}
                >
                  Copy recipient
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void copyCommunicationPart("subject")}
                  disabled={!communicationForm.subject.trim()}
                >
                  Copy subject
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void copyCommunicationPart("body")}
                  disabled={!communicationForm.body.trim()}
                >
                  Copy plain text
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void copyCommunication()}
                  disabled={!communicationForm.body.trim()}
                >
                  Copy formatted email
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={openEmailClient}
                  disabled={!communicationForm.body.trim()}
                >
                  Open email client
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={openWebmail}
                  disabled={!communicationForm.body.trim()}
                >
                  Open IONOS Webmail
                </button>
                {pendingSendPrompt && (
                  <div className="ops-send-confirmation">
                    <strong>Did you send this email?</strong>
                    <span>
                      {pendingSendPrompt.channel === "mailto"
                        ? "Default mail client opened"
                        : "IONOS Webmail opened"}
                      {pendingSendPrompt.recipient
                        ? ` for ${pendingSendPrompt.recipient}`
                        : ""}
                      . Opening mail tools does not update the record.
                    </span>
                    <div className="ops-inline-actions">
                      <button
                        type="button"
                        className="ops-button ops-button--primary"
                        onClick={() => void saveCommunication("sent")}
                      >
                        Yes, mark as sent
                      </button>
                      <button
                        type="button"
                        className="ops-button"
                        onClick={() => {
                          setPendingSendPrompt(null);
                          void saveCommunication("draft");
                        }}
                      >
                        No, keep as draft
                      </button>
                      <button
                        type="button"
                        className="ops-button"
                        onClick={() => setPendingSendPrompt(null)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void saveCommunication("draft")}
                  disabled={!communicationForm.body.trim()}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => void saveCommunication("ready")}
                  disabled={!communicationForm.body.trim()}
                >
                  Mark ready
                </button>
                <button
                  type="button"
                  className="ops-button ops-button--primary"
                  onClick={() =>
                    void saveCommunication(
                      communicationForm.direction === "inbound"
                        ? "received"
                        : "sent",
                    )
                  }
                  disabled={!communicationForm.body.trim()}
                >
                  {communicationForm.direction === "inbound"
                    ? "Record received"
                    : "Mark sent"}
                </button>
              </div>
            </div>
            <div className="ops-preview">
              <div className="ops-panel__header">
                <div>
                  <div className="ops-section-label">Preview</div>
                  <strong>{communicationForm.subject || "No subject"}</strong>
                  <small>
                    {communicationRenderStatusLabel()} · render #
                    {communicationForm.renderVersion}
                    {communicationForm.lastRenderedAt
                      ? ` · ${formatDateTime(communicationForm.lastRenderedAt)}`
                      : ""}
                  </small>
                </div>
              </div>
              <div className="ops-segmented" aria-label="Email preview modes">
                {[
                  ["desktop", "Desktop HTML"],
                  ["narrow", "Narrow HTML"],
                  ["images_hidden", "Images hidden"],
                  ["plain_text", "Plain text"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      communicationForm.previewMode === value ? "active" : ""
                    }
                    onClick={() =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        previewMode:
                          value as CommunicationFormState["previewMode"],
                      }))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {communicationForm.previewMode === "plain_text" ? (
                <pre>
                  {communicationForm.plainTextBody ||
                    communicationForm.body ||
                    "Generate or write a draft."}
                </pre>
              ) : (
                <iframe
                  className={
                    communicationForm.previewMode === "narrow"
                      ? "ops-email-preview ops-email-preview--narrow"
                      : "ops-email-preview"
                  }
                  sandbox=""
                  srcDoc={communicationPreviewDocument()}
                  title="Email HTML preview"
                />
              )}
              {communicationForm.publicAssetUrls.length > 0 && (
                <small>
                  Assets: {communicationForm.publicAssetUrls.join(", ")}
                </small>
              )}
              <small>
                Opening mailto or webmail does not mark this communication sent.
                Attach PDFs manually where required.
              </small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCommunicationsPage() {
    const selectedCommunication =
      communications.find((item) => item.id === selectedCommunicationId) ??
      communications[0] ??
      null;
    const communicationPlaceholders = selectedCommunication
      ? findEditorPlaceholders(
          selectedCommunication.subject ?? "",
          selectedCommunication.body,
        )
      : [];

    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Client messaging</div>
            <h1>Communications</h1>
            <p>
              Draft manual outreach, manage client communication templates, and
              keep follow-up records separate from transactional email.
            </p>
          </div>
          <div className="ops-inline-actions">
            <div className="ops-segmented" aria-label="Communications views">
              <button
                type="button"
                className={communicationsTab === "activity" ? "active" : ""}
                onClick={() => setCommunicationsTab("activity")}
              >
                Activity
              </button>
              <button
                type="button"
                className={communicationsTab === "templates" ? "active" : ""}
                onClick={() => setCommunicationsTab("templates")}
              >
                Templates
              </button>
            </div>
            <button
              className="ops-button ops-button--primary"
              onClick={() => openCommunicationForm()}
            >
              Create draft
            </button>
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {communicationsTab === "activity" ? (
          <section className="ops-communications-workspace">
            <div className="ops-panel ops-communications-list-pane">
              <div className="ops-panel__header">
                <h2>Activity</h2>
                <button
                  className="ops-button"
                  onClick={() => void loadCommunications()}
                >
                  Refresh
                </button>
              </div>
              <div className="ops-communications-toolbar">
                <label>
                  Search
                  <input
                    value={communicationSearch}
                    onChange={(event) =>
                      setCommunicationSearch(event.target.value)
                    }
                    placeholder="Business, contact, email, subject"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={communicationStatusFilter}
                    onChange={(event) =>
                      setCommunicationStatusFilter(
                        event.target.value as CommunicationFilterStatus,
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="draft">Drafts</option>
                    <option value="ready">Ready</option>
                    <option value="sent">Sent</option>
                    <option value="received">Replies</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="follow_up_due">Follow-up due</option>
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    value={communicationDirectionFilter}
                    onChange={(event) =>
                      setCommunicationDirectionFilter(
                        event.target.value as CommunicationDirection | "all",
                      )
                    }
                  >
                    <option value="all">Any direction</option>
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="internal_note">Internal note</option>
                  </select>
                </label>
                <label>
                  Channel
                  <select
                    value={communicationChannelFilter}
                    onChange={(event) =>
                      setCommunicationChannelFilter(
                        event.target.value as CommunicationChannel | "all",
                      )
                    }
                  >
                    <option value="all">Any channel</option>
                    {communicationChannelOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Business
                  <select
                    value={communicationBusinessFilter}
                    onChange={(event) =>
                      setCommunicationBusinessFilter(event.target.value)
                    }
                  >
                    <option value="">Any business</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="ops-button"
                  onClick={() => {
                    setCommunicationSearch("");
                    setCommunicationStatusFilter("all");
                    setCommunicationDirectionFilter("all");
                    setCommunicationChannelFilter("all");
                    setCommunicationBusinessFilter("");
                  }}
                >
                  Clear filters
                </button>
              </div>
              {communicationsLoading ? (
                <div className="ops-empty-card">Loading communications...</div>
              ) : communications.length === 0 ? (
                <div className="ops-empty-card">
                  No communications match this view.
                </div>
              ) : (
                <div className="ops-communications-list">
                  {communications.map((item) => {
                    const placeholders = findEditorPlaceholders(
                      item.subject ?? "",
                      item.body,
                    );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`ops-activity ${
                          selectedCommunication?.id === item.id ? "active" : ""
                        }`}
                        onClick={() => {
                          setSelectedCommunicationId(item.id);
                          setCommunicationCopyStatus("");
                        }}
                      >
                        <strong>
                          {item.business_name ?? "Business"} ·{" "}
                          {item.subject || "No subject"}
                        </strong>
                        <span>
                          {communicationContactName(item) || "No contact"} ·{" "}
                          {communicationLabel(item)}
                        </span>
                        <small>
                          {communicationChannelLabel(item.channel)} ·{" "}
                          {formatDateTime(item.occurred_at)}
                        </small>
                        <small>{communicationFollowUpState(item)}</small>
                        <small>
                          {placeholders.length > 0
                            ? `Unresolved placeholders: ${placeholders.join(
                                ", ",
                              )}`
                            : communicationBodyPreview(item.body)}
                        </small>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="ops-panel ops-communication-detail-pane">
              {selectedCommunication ? (
                <>
                  <div className="ops-panel__header">
                    <div>
                      <div className="ops-section-label">
                        Selected communication
                      </div>
                      <h2>{selectedCommunication.subject || "No subject"}</h2>
                    </div>
                    <button
                      className="ops-button"
                      onClick={() =>
                        onNavigate(
                          `/operations/businesses/${selectedCommunication.business_id}`,
                        )
                      }
                    >
                      Open business
                    </button>
                  </div>
                  <dl className="ops-definition-grid">
                    <dt>Business</dt>
                    <dd>{selectedCommunication.business_name ?? "Business"}</dd>
                    <dt>Contact</dt>
                    <dd>
                      {communicationContactName(selectedCommunication) ||
                        "No contact"}
                    </dd>
                    <dt>Recipient</dt>
                    <dd>{selectedCommunication.contact_email ?? "Not set"}</dd>
                    <dt>Status</dt>
                    <dd>{communicationLabel(selectedCommunication)}</dd>
                    <dt>Channel</dt>
                    <dd>
                      {communicationChannelLabel(selectedCommunication.channel)}
                    </dd>
                    <dt>Follow-up</dt>
                    <dd>{communicationFollowUpState(selectedCommunication)}</dd>
                  </dl>
                  {communicationPlaceholders.length > 0 && (
                    <div className="ops-warning">
                      Stored content contains unresolved placeholders:{" "}
                      {communicationPlaceholders.join(", ")}
                    </div>
                  )}
                  <div className="ops-communication-reader">
                    <strong>
                      {selectedCommunication.subject || "No subject"}
                    </strong>
                    <pre>{selectedCommunication.body}</pre>
                  </div>
                  {selectedCommunication.html_document && (
                    <iframe
                      className="ops-email-preview"
                      sandbox=""
                      srcDoc={selectedCommunication.html_document}
                      title="Saved email HTML preview"
                    />
                  )}
                  {communicationCopyStatus && (
                    <div className="ops-muted">{communicationCopyStatus}</div>
                  )}
                  <div className="ops-form-actions">
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          selectedCommunication.contact_email ?? "",
                        )
                      }
                      disabled={!selectedCommunication.contact_email}
                    >
                      Copy recipient
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          selectedCommunication.subject ?? "",
                        )
                      }
                    >
                      Copy subject
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          selectedCommunication.plain_text_body ??
                            selectedCommunication.body,
                        )
                      }
                    >
                      Copy plain text
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() => {
                        void copyRichEmailToClipboard({
                          html: selectedCommunication.html_fragment ?? "",
                          plainText:
                            selectedCommunication.plain_text_body ??
                            selectedCommunication.body,
                          expectedText: selectedCommunication.body,
                          requireLayout: true,
                          requireLogoUrl:
                            selectedCommunication.signature_mode !==
                            "use_mailbox_signature",
                        }).then((result) =>
                          setCommunicationCopyStatus(
                            result.ok
                              ? `${result.message} (${result.mimeTypes.join(
                                  ", ",
                                )})`
                              : result.message,
                          ),
                        );
                      }}
                      disabled={!selectedCommunication.html_fragment}
                    >
                      Copy formatted email
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() =>
                        downloadSavedCommunicationHtml(selectedCommunication)
                      }
                      disabled={
                        !selectedCommunication.html_document &&
                        !selectedCommunication.html_fragment
                      }
                    >
                      Download HTML
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() => {
                        const params = new URLSearchParams({
                          subject: selectedCommunication.subject ?? "",
                          body: selectedCommunication.body,
                        });
                        window.location.href = `mailto:${encodeURIComponent(
                          selectedCommunication.contact_email ?? "",
                        )}?${params.toString()}`;
                        setPendingSendPrompt({
                          recipient: selectedCommunication.contact_email ?? "",
                          channel: "mailto",
                          communicationId: selectedCommunication.id,
                        });
                      }}
                      disabled={!selectedCommunication.contact_email}
                    >
                      Open email client
                    </button>
                    <button
                      type="button"
                      className="ops-button"
                      onClick={() => {
                        window.open(
                          operationsWebmailUrl,
                          "_blank",
                          "noopener,noreferrer",
                        );
                        setPendingSendPrompt({
                          recipient: selectedCommunication.contact_email ?? "",
                          channel: "webmail",
                          communicationId: selectedCommunication.id,
                        });
                      }}
                    >
                      Open IONOS Webmail
                    </button>
                  </div>
                  {pendingSendPrompt?.communicationId ===
                    selectedCommunication.id && (
                    <div className="ops-send-confirmation">
                      <strong>Did you send this email?</strong>
                      <span>
                        {pendingSendPrompt.channel === "mailto"
                          ? "Default mail client opened"
                          : "IONOS Webmail opened"}
                        {pendingSendPrompt.recipient
                          ? ` for ${pendingSendPrompt.recipient}`
                          : ""}
                        . Opening mail tools does not mark this communication
                        sent.
                      </span>
                      <div className="ops-inline-actions">
                        <button
                          type="button"
                          className="ops-button ops-button--primary"
                          onClick={() =>
                            void markExistingCommunicationSent(
                              selectedCommunication,
                            )
                          }
                        >
                          Yes, mark as sent
                        </button>
                        <button
                          type="button"
                          className="ops-button"
                          onClick={() => setPendingSendPrompt(null)}
                        >
                          No, keep as draft
                        </button>
                        <button
                          type="button"
                          className="ops-button"
                          onClick={() => setPendingSendPrompt(null)}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="ops-empty-panel">
                  <h2>Select a communication or create a new draft.</h2>
                  <p>
                    The selected communication details, recipient, follow-up and
                    copy actions appear here.
                  </p>
                  <button
                    className="ops-button ops-button--primary"
                    onClick={() => openCommunicationForm()}
                  >
                    Create draft
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <h2>Client communication templates</h2>
                <span className="ops-muted">
                  {communicationTemplates.length} templates
                </span>
              </div>
              <button
                className="ops-button ops-button--primary"
                onClick={() => openTemplateEditor()}
              >
                Create template
              </button>
            </div>
            <div className="ops-templates-toolbar">
              <label>
                Search
                <input placeholder="Template search" />
              </label>
              <label>
                Category
                <select defaultValue="">
                  <option value="">All categories</option>
                  {communicationTemplateCategoryOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                State
                <select defaultValue="all">
                  <option value="all">Active and archived</option>
                  <option value="active">Active only</option>
                  <option value="archived">Archived only</option>
                </select>
              </label>
            </div>
            <div className="ops-template-grid">
              {communicationTemplates.map((template) => (
                <div key={template.id} className="ops-list-card">
                  <strong>
                    {template.name}{" "}
                    {template.is_system_default ? "· Default" : ""}
                  </strong>
                  <span>{templateCategoryLabel(template.category)}</span>
                  <small>
                    {template.is_active ? "Active" : "Archived"} · Updated{" "}
                    {formatDateTime(template.updated_at)}
                  </small>
                  <small>
                    Default follow-up:{" "}
                    {template.default_follow_up_business_days ?? "none"}
                  </small>
                  <small>
                    {communicationLayoutOptions.find(
                      (item) => item.value === template.layout_key,
                    )?.label ?? template.layout_key}{" "}
                    ·{" "}
                    {communicationAttachmentOptions.find(
                      (item) => item.value === template.attachment_policy,
                    )?.label ?? template.attachment_policy}
                  </small>
                  <div className="ops-inline-actions">
                    <button
                      className="ops-button"
                      onClick={() => openTemplateEditor(template)}
                    >
                      Edit
                    </button>
                    <button
                      className="ops-button"
                      onClick={() => void toggleTemplate(template)}
                    >
                      {template.is_active ? "Archive" : "Restore"}
                    </button>
                    <button
                      className="ops-button"
                      onClick={() => void duplicateTemplate(template)}
                    >
                      Duplicate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {templateEditorOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel ops-modal__panel--wide">
              <div className="ops-panel__header">
                <h2>
                  {editingTemplateId
                    ? "Edit communication template"
                    : "Create communication template"}
                </h2>
                <button
                  className="ops-button"
                  onClick={() => {
                    setTemplateEditorOpen(false);
                    setEditingTemplateId(null);
                  }}
                >
                  Close
                </button>
              </div>
              <form
                className="ops-form ops-template-editor"
                onSubmit={(event) => {
                  void submitTemplate(event);
                  setTemplateEditorOpen(false);
                }}
              >
                <div className="ops-empty-card">
                  <strong>Supported placeholders</strong>
                  <span>
                    {supportedCommunicationPlaceholders
                      .map((item) => `{{${item}}}`)
                      .join(", ")}
                  </span>
                </div>
                <div className="ops-form-grid">
                  <label>
                    Name
                    <input
                      value={templateForm.name}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={templateForm.category}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          category: event.target
                            .value as CommunicationTemplateCategory,
                        }))
                      }
                    >
                      {communicationTemplateCategoryOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Default follow-up days
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={templateForm.defaultFollowUpBusinessDays}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          defaultFollowUpBusinessDays: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Layout
                    <select
                      value={templateForm.layoutKey}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          layoutKey: event.target
                            .value as CommunicationLayoutKey,
                        }))
                      }
                    >
                      {communicationLayoutOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Attachment
                    <select
                      value={templateForm.attachmentPolicy}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          attachmentPolicy: event.target
                            .value as CommunicationAttachmentPolicy,
                        }))
                      }
                    >
                      {communicationAttachmentOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Signature
                    <select
                      value={templateForm.signatureMode}
                      onChange={(event) =>
                        setTemplateForm((prev) => ({
                          ...prev,
                          signatureMode: event.target
                            .value as CommunicationSignatureMode,
                        }))
                      }
                    >
                      <option value="include_scanlark_signature">
                        Include Scanlark signature
                      </option>
                      <option value="use_mailbox_signature">
                        Use mailbox signature
                      </option>
                    </select>
                  </label>
                </div>
                <label>
                  Subject template
                  <input
                    value={templateForm.subjectTemplate}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        subjectTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Preheader template
                  <input
                    value={templateForm.preheaderTemplate}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        preheaderTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Body template
                  <textarea
                    className="ops-communication-body"
                    value={templateForm.bodyTemplate}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        bodyTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  HTML body template
                  <textarea
                    className="ops-communication-body"
                    value={templateForm.htmlBodyTemplate}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        htmlBodyTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Plain-text fallback
                  <textarea
                    className="ops-communication-body"
                    value={templateForm.plainTextTemplate}
                    onChange={(event) =>
                      setTemplateForm((prev) => ({
                        ...prev,
                        plainTextTemplate: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="ops-preview">
                  <div className="ops-section-label">Preview</div>
                  <strong>
                    {templateForm.subjectTemplate || "No subject"}
                  </strong>
                  <pre>{templateForm.bodyTemplate || "No body yet."}</pre>
                </div>
                <div className="ops-form-actions">
                  <button
                    className="ops-button ops-button--primary"
                    disabled={
                      !templateForm.name.trim() ||
                      !templateForm.subjectTemplate.trim() ||
                      !templateForm.bodyTemplate.trim()
                    }
                  >
                    Save template
                  </button>
                  <button
                    type="button"
                    className="ops-button"
                    onClick={() => {
                      setTemplateEditorOpen(false);
                      setEditingTemplateId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderCommunicationModal()}
      </>
    );
  }

  function renderTasksPage() {
    const activeStatus = searchParams.get("status") ?? "active";
    const filters = [
      ["active", "Active"],
      ["due", "Due"],
      ["open", "Open"],
      ["snoozed", "Snoozed"],
      ["completed", "Completed"],
      ["cancelled", "Cancelled"],
    ];
    const groupedTasks = groupTasksForDisplay(tasks);
    const taskSections =
      activeStatus === "completed" || activeStatus === "cancelled"
        ? [{ title: "Closed", items: tasks }]
        : [
            { title: "Overdue", items: groupedTasks.overdue },
            { title: "Today", items: groupedTasks.today },
            { title: "Upcoming", items: groupedTasks.upcoming },
            { title: "Completed or cancelled", items: groupedTasks.completed },
          ];
    const renderTaskCard = (task: OperationsTask) => (
      <div key={task.id} className="ops-list-card">
        <strong className={isOverdue(taskDueDate(task)) ? "ops-overdue" : ""}>
          {task.title}
        </strong>
        <span>
          {task.business_name ?? "Business"}{" "}
          {communicationContactName(task)
            ? `· ${communicationContactName(task)}`
            : ""}
        </span>
        <small>
          Due {formatDateTime(taskDueDate(task))} · {task.status}
        </small>
        {task.notes && <p>{task.notes}</p>}
        <div className="ops-inline-actions">
          {renderLink(
            `/operations/businesses/${task.business_id}`,
            "Open business",
            "ops-button",
          )}
          {task.status !== "completed" && (
            <button
              className="ops-button"
              onClick={() => void runTaskAction(task, "complete")}
            >
              Complete
            </button>
          )}
          {task.status !== "completed" && task.status !== "cancelled" && (
            <>
              <button
                className="ops-button"
                onClick={() => void runTaskAction(task, "snooze")}
              >
                Snooze 3 days
              </button>
              <button
                className="ops-button"
                onClick={() => void runTaskAction(task, "reschedule")}
              >
                Reschedule
              </button>
              <button
                className="ops-button"
                onClick={() => void runTaskAction(task, "cancel")}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    );
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Daily work</div>
            <h1>Tasks</h1>
            <p>
              Review due follow-ups, snooze or reschedule outreach, and close
              completed client work.
            </p>
          </div>
          <button
            className="ops-button"
            onClick={() => void loadTasks()}
            disabled={tasksLoading}
          >
            {tasksLoading ? "Refreshing..." : "Refresh"}
          </button>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-panel">
          <div className="ops-segmented">
            {filters.map(([key, label]) => (
              <button
                key={key}
                className={activeStatus === key ? "active" : ""}
                onClick={() =>
                  onNavigate(`/operations/tasks${buildQuery({ status: key })}`)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>{tasks.length} tasks</h2>
          </div>
          {tasks.length === 0 && !tasksLoading ? (
            <div className="ops-empty-card">
              No follow-up tasks match this view.
            </div>
          ) : (
            <div className="ops-task-sections">
              {taskSections.map((section) => (
                <div key={section.title} className="ops-task-section">
                  <div className="ops-section-label">
                    {section.title} · {section.items.length}
                  </div>
                  {section.items.length === 0 ? (
                    <div className="ops-empty-card">
                      No tasks in this group.
                    </div>
                  ) : (
                    <div className="ops-list">
                      {section.items.map((task) => renderTaskCard(task))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  function renderReportCreateModal() {
    if (!reportFormOpen) return null;
    const selectedBusiness =
      detail?.business.id === reportForm.businessId
        ? detail
        : reportCreateDetail?.business.id === reportForm.businessId
          ? reportCreateDetail
          : null;
    const linkedSites = selectedBusiness?.linkedSites ?? [];
    const contacts =
      selectedBusiness?.contacts.filter((contact) => !contact.archived_at) ??
      [];
    return (
      <div className="ops-modal">
        <div className="ops-modal__panel ops-modal__panel--wide">
          <div className="ops-panel__header">
            <h2>Create client report</h2>
            <button
              className="ops-button"
              onClick={() => setReportFormOpen(false)}
            >
              Close
            </button>
          </div>
          <form className="ops-form" onSubmit={submitReport}>
            <div className="ops-form-grid">
              <label>
                Business
                <select
                  value={reportForm.businessId}
                  disabled={Boolean(detail)}
                  onChange={(event) => {
                    const nextBusinessId = event.target.value;
                    setReportForm((prev) => ({
                      ...prev,
                      businessId: nextBusinessId,
                      siteId: "",
                      scanRunId: "",
                      preparedContactId: "",
                      preparedFor: "",
                    }));
                    setReportableScans([]);
                    void loadReportCreateBusiness(nextBusinessId);
                  }}
                >
                  <option value="">Select business</option>
                  {(detail ? [detail.business] : businesses).map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Linked website
                <select
                  value={reportForm.siteId}
                  onChange={(event) => {
                    const siteIdValue = event.target.value;
                    setReportForm((prev) => ({
                      ...prev,
                      siteId: siteIdValue,
                      scanRunId: "",
                    }));
                    setReportableScans([]);
                    void loadReportableScans(
                      reportForm.businessId,
                      siteIdValue,
                    );
                  }}
                  disabled={!selectedBusiness}
                >
                  <option value="">Select website</option>
                  {linkedSites.map((site) => (
                    <option key={site.site_id} value={site.site_id}>
                      {site.site_display_name ?? site.url}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Completed scan
                <select
                  value={reportForm.scanRunId}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      scanRunId: event.target.value,
                    }))
                  }
                  disabled={!reportForm.siteId}
                >
                  <option value="">Select scan</option>
                  {reportableScans.map((scan) => (
                    <option key={scan.id} value={scan.id}>
                      {formatDateTime(scan.finished_at)} · {scan.open_issues}{" "}
                      issues
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Report type
                <select
                  value={reportForm.reportType}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      reportType: event.target.value as OperationsReportType,
                    }))
                  }
                >
                  {operationsReportTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prepared contact
                <select
                  value={reportForm.preparedContactId}
                  onChange={(event) => {
                    const contact = contacts.find(
                      (item) => item.id === event.target.value,
                    );
                    setReportForm((prev) => ({
                      ...prev,
                      preparedContactId: event.target.value,
                      preparedFor: contact
                        ? contactName(contact)
                        : prev.preparedFor,
                    }));
                  }}
                >
                  <option value="">No contact selected</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contactName(contact)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  checked={reportForm.allowDuplicate}
                  onChange={(event) =>
                    setReportForm((prev) => ({
                      ...prev,
                      allowDuplicate: event.target.checked,
                    }))
                  }
                />
                Allow another version for this scan
              </label>
            </div>
            <label>
              Report title
              <input
                value={reportForm.title}
                onChange={(event) =>
                  setReportForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Prepared for
              <input
                value={reportForm.preparedFor}
                onChange={(event) =>
                  setReportForm((prev) => ({
                    ...prev,
                    preparedFor: event.target.value,
                  }))
                }
              />
            </label>
            {actionError && <div className="ops-error">{actionError}</div>}
            <div className="ops-form-actions">
              <button
                className="ops-button ops-button--primary"
                disabled={
                  !reportForm.businessId ||
                  !reportForm.siteId ||
                  !reportForm.scanRunId ||
                  !reportForm.title.trim()
                }
              >
                Create report
              </button>
              <button
                type="button"
                className="ops-button"
                onClick={() => setReportFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderQuoteCreateModal() {
    if (!quoteFormOpen) return null;
    const selectedBusiness =
      detail?.business.id === quoteForm.businessId
        ? detail
        : reportCreateDetail?.business.id === quoteForm.businessId
          ? reportCreateDetail
          : null;
    return (
      <div className="ops-modal">
        <div className="ops-modal__panel ops-modal__panel--wide">
          <div className="ops-panel__header">
            <h2>Create quote</h2>
            <button
              className="ops-button"
              onClick={() => setQuoteFormOpen(false)}
            >
              Close
            </button>
          </div>
          <form className="ops-form" onSubmit={submitQuote}>
            <div className="ops-form-grid">
              <label>
                Business
                <select
                  value={quoteForm.businessId}
                  onChange={(event) => {
                    const nextBusinessId = event.target.value;
                    setQuoteForm((prev) => ({
                      ...prev,
                      businessId: nextBusinessId,
                      contactId: "",
                      operationsReportId: "",
                    }));
                    void loadReportCreateBusiness(nextBusinessId);
                  }}
                >
                  <option value="">Select business</option>
                  {(detail ? [detail.business] : businesses).map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
                {quoteFormErrors.businessId && (
                  <small className="ops-overdue">
                    {quoteFormErrors.businessId}
                  </small>
                )}
              </label>
              <label>
                Contact
                <select
                  value={quoteForm.contactId}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      contactId: event.target.value,
                    }))
                  }
                >
                  <option value="">No contact selected</option>
                  {(selectedBusiness?.contacts ?? [])
                    .filter((contact) => !contact.archived_at)
                    .map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contactName(contact)}
                      </option>
                    ))}
                </select>
                {quoteFormErrors.contactId && (
                  <small className="ops-overdue">
                    {quoteFormErrors.contactId}
                  </small>
                )}
              </label>
              <label>
                Currency
                <select
                  value={quoteForm.currency}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      currency: event.target.value,
                    }))
                  }
                >
                  {quoteCurrencyOptions.map((currency) => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
                {quoteFormErrors.currency && (
                  <small className="ops-overdue">
                    {quoteFormErrors.currency}
                  </small>
                )}
              </label>
              <label>
                Valid until
                <input
                  type="date"
                  value={quoteForm.validUntil}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      validUntil: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Quote title
              <input
                value={quoteForm.title}
                onChange={(event) =>
                  setQuoteForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                required
              />
              {quoteFormErrors.title && (
                <small className="ops-overdue">{quoteFormErrors.title}</small>
              )}
            </label>
            <label>
              Scope summary
              <textarea
                value={quoteForm.scopeSummary}
                onChange={(event) =>
                  setQuoteForm((prev) => ({
                    ...prev,
                    scopeSummary: event.target.value,
                  }))
                }
                required
              />
              {quoteFormErrors.scopeSummary && (
                <small className="ops-overdue">
                  {quoteFormErrors.scopeSummary}
                </small>
              )}
            </label>
            <div className="ops-form-grid">
              <label>
                Included scope
                <textarea
                  value={quoteForm.includedScope}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      includedScope: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Excluded scope
                <textarea
                  value={quoteForm.excludedScope}
                  onChange={(event) =>
                    setQuoteForm((prev) => ({
                      ...prev,
                      excludedScope: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Payment terms
              <textarea
                value={quoteForm.paymentTerms}
                onChange={(event) =>
                  setQuoteForm((prev) => ({
                    ...prev,
                    paymentTerms: event.target.value,
                  }))
                }
              />
            </label>
            {quoteForm.operationsReportId && reportDetail && (
              <div className="ops-empty-card">
                {
                  reportDetail.findings.filter(
                    (finding) =>
                      finding.is_included && !finding.is_false_positive,
                  ).length
                }{" "}
                included report finding(s) are available for scope reference.
                Add priced quote items after creating the draft.
              </div>
            )}
            {actionError && <div className="ops-error">{actionError}</div>}
            <div className="ops-form-actions">
              <button
                className="ops-button ops-button--primary"
                disabled={!quoteForm.businessId || !quoteForm.title.trim()}
              >
                Create quote
              </button>
              <button
                type="button"
                className="ops-button"
                onClick={() => setQuoteFormOpen(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderQuotesPage() {
    if (operationsQuoteId) return renderQuoteDetail();
    if (quoteServiceItemsPath) return renderServiceItemsPage();
    const cards = [
      ["Draft", quotesSummary.draft],
      ["Needs review", quotesSummary.needsReview],
      ["Ready", quotesSummary.readyToSend],
      ["Sent", quotesSummary.sent],
      ["Accepted", quotesSummary.accepted],
      ["Converted", quotesSummary.convertedToWork],
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Commercial proposals</div>
            <h1>Quotes</h1>
            <p>Create fixed-price scopes from reviewed report findings.</p>
          </div>
          <div className="ops-inline-actions">
            <button
              className="ops-button ops-button--primary"
              onClick={() => openCreateQuote()}
            >
              Create quote
            </button>
            {renderLink(
              "/operations/quotes/service-items",
              "Service items",
              "ops-button",
            )}
          </div>
        </section>
        <section className="ops-card-grid">
          {cards.map(([label, value]) => (
            <div key={label} className="ops-summary-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Quotes</small>
            </div>
          ))}
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>{quotes.length} quotes</h2>
            <button className="ops-button" onClick={() => void loadQuotes()}>
              Refresh
            </button>
          </div>
          {quotesLoading ? (
            <div className="ops-empty-card">Loading quotes...</div>
          ) : quotes.length === 0 ? (
            <div className="ops-empty-card">
              No quotes have been created yet.
            </div>
          ) : (
            <div className="ops-list">
              {quotes.map((quote) => (
                <div key={quote.id} className="ops-list-card">
                  <strong>
                    {quote.quote_number} · {quote.title}
                  </strong>
                  <span>
                    {quote.business_name ?? "Business"} ·{" "}
                    {formatMoney(quote.total_minor, quote.currency)}
                  </span>
                  <small>
                    {quoteStatusLabel(quote.status)} · valid until{" "}
                    {formatDate(quote.valid_until)} · updated{" "}
                    {formatDateTime(quote.updated_at)}
                  </small>
                  <div className="ops-inline-actions">
                    {renderLink(
                      `/operations/quotes/${quote.id}`,
                      "Open quote",
                      "ops-button ops-button--primary",
                    )}
                    {quote.operations_report_id &&
                      renderLink(
                        `/operations/reports/${quote.operations_report_id}`,
                        "Report",
                        "ops-button",
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {renderQuoteCreateModal()}
      </>
    );
  }

  function renderServiceItemsPage() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Pricing suggestions</div>
            <h1>Service items</h1>
            <p>
              Reusable internal quote item suggestions. Prices are never applied
              automatically.
            </p>
          </div>
          {renderLink("/operations/quotes", "Back to quotes", "ops-button")}
        </section>
        <section className="ops-panel">
          <div className="ops-list">
            {quoteServiceItems.map((item) => (
              <div key={item.id} className="ops-list-card">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small>
                  {quoteItemTypeLabel(item.item_type)} ·{" "}
                  {formatMoney(item.suggested_price_minor, "GBP")} ·{" "}
                  {item.is_active ? "Active" : "Inactive"}
                </small>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderQuotePreview() {
    if (!quotePreview) {
      return (
        <div className="ops-empty-card">Quote preview is not available.</div>
      );
    }
    return (
      <div className="ops-client-report">
        <section className="ops-client-cover">
          <div className="ops-client-brand">Scanlark</div>
          <h1>Quote</h1>
          <p>{quotePreview.quote.quoteNumber}</p>
          <p>{quotePreview.business.name}</p>
          <small>
            Valid until {quotePreview.quote.validUntil ?? "to be agreed"}
          </small>
        </section>
        <section>
          <h2>Introduction</h2>
          <p>
            {quotePreview.scope.summary ?? "Fixed-price website health work."}
          </p>
          {quotePreview.report && (
            <p>
              This quote follows{" "}
              {quotePreview.report.title ?? "a Scanlark report"}
              {quotePreview.report.website
                ? ` for ${quotePreview.report.website}`
                : ""}
              .
            </p>
          )}
        </section>
        <section>
          <h2>Scope of work</h2>
          <div className="ops-list">
            {quotePreview.items.map((item) => (
              <article key={item.id} className="ops-list-card">
                <strong>{item.title}</strong>
                {item.description && <p>{item.description}</p>}
                <small>
                  Quantity {item.quantity} ·{" "}
                  {formatMoney(
                    item.lineTotalMinor,
                    quotePreview.quote.currency,
                  )}
                </small>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2>Pricing</h2>
          <dl className="ops-definition-grid">
            <dt>Subtotal</dt>
            <dd>
              {formatMoney(
                quotePreview.totals.subtotalMinor,
                quotePreview.quote.currency,
              )}
            </dd>
            <dt>Discount</dt>
            <dd>
              {formatMoney(
                quotePreview.totals.discountMinor,
                quotePreview.quote.currency,
              )}
            </dd>
            <dt>VAT</dt>
            <dd>
              {quotePreview.totals.vatNotice}{" "}
              {formatMoney(
                quotePreview.totals.taxMinor,
                quotePreview.quote.currency,
              )}
            </dd>
            <dt>Total</dt>
            <dd>
              <strong>
                {formatMoney(
                  quotePreview.totals.totalMinor,
                  quotePreview.quote.currency,
                )}
              </strong>
            </dd>
          </dl>
        </section>
        <section>
          <h2>Included scope</h2>
          <p>
            {quotePreview.scope.included ?? "Included scope to be confirmed."}
          </p>
        </section>
        <section>
          <h2>Excluded scope</h2>
          <p>
            {quotePreview.scope.excluded ?? "Excluded scope to be confirmed."}
          </p>
        </section>
        <section>
          <h2>Payment terms</h2>
          <p>
            {quotePreview.scope.paymentTerms ?? "Payment terms to be agreed."}
          </p>
        </section>
        <section>
          <h2>Limitations</h2>
          <ul>
            {quotePreview.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  function renderQuoteDetail() {
    if (quoteDetailLoading)
      return <section className="ops-panel">Loading quote...</section>;
    if (!quoteDetail)
      return <section className="ops-panel">Quote not found.</section>;
    const quote = quoteDetail.quote;
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Quote</div>
            <h1>{quote.quote_number}</h1>
            <p>{quote.title}</p>
            <span className="ops-muted">
              {quote.business_name} · {quoteStatusLabel(quote.status)} ·{" "}
              {formatMoney(quote.total_minor, quote.currency)}
            </span>
          </div>
          <div className="ops-inline-actions">
            <button
              className="ops-button"
              onClick={() => void runQuoteAction("mark-ready")}
            >
              Mark ready
            </button>
            <button
              className="ops-button"
              onClick={() =>
                void runQuoteAction("record-sent", {
                  deliveryMethod: "email_attachment",
                  sentAt: new Date().toISOString(),
                  updatePipelineStage: true,
                })
              }
            >
              Record sent
            </button>
            <button
              className="ops-button"
              onClick={() => void recordQuoteAccepted()}
            >
              Record accepted
            </button>
            <button
              className="ops-button"
              onClick={() => void convertQuoteToWork()}
            >
              Convert to work
            </button>
            {quote.status === "accepted" && (
              <button
                className="ops-button"
                onClick={() =>
                  openCreateService({
                    businessId: quote.business_id,
                    contactId: quote.contact_id ?? "",
                    sourceQuoteId: quote.id,
                    name: `${quote.business_name ?? "Client"} managed service`,
                    currency: quote.currency,
                    includedScope: quote.scope_summary ?? "",
                  })
                }
              >
                Create service
              </button>
            )}
            <button
              className="ops-button"
              onClick={() => void generateQuotePdf()}
            >
              Print / PDF
            </button>
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {quoteDetail.readinessIssues.length > 0 && (
          <section className="ops-warning">
            {quoteDetail.readinessIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </section>
        )}
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Overview</h2>
            <dl className="ops-definition-grid">
              <dt>Status</dt>
              <dd>{quoteStatusLabel(quote.status)}</dd>
              <dt>Total</dt>
              <dd>{formatMoney(quote.total_minor, quote.currency)}</dd>
              <dt>Valid until</dt>
              <dd>{formatDate(quote.valid_until)}</dd>
              <dt>Sent</dt>
              <dd>{formatDateTime(quote.sent_at)}</dd>
              <dt>Accepted</dt>
              <dd>{formatDateTime(quote.accepted_at)}</dd>
              <dt>Frozen</dt>
              <dd>{formatDateTime(quote.frozen_at)}</dd>
            </dl>
          </div>
          <div className="ops-panel">
            <h2>Terms</h2>
            <label>
              Scope summary
              <textarea
                defaultValue={quote.scope_summary ?? ""}
                onBlur={(event) =>
                  void patchQuote({ scopeSummary: event.target.value })
                }
              />
            </label>
            <label>
              Payment terms
              <textarea
                defaultValue={quote.payment_terms ?? ""}
                onBlur={(event) =>
                  void patchQuote({ paymentTerms: event.target.value })
                }
              />
            </label>
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Scope and items</h2>
            <span className="ops-muted">
              Optional unselected items are excluded from totals.
            </span>
          </div>
          <div className="ops-list">
            {quoteDetail.items.map((item) => (
              <div key={item.id} className="ops-list-card">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small>
                  {quoteItemTypeLabel(item.item_type)} · quantity{" "}
                  {item.quantity} · unit{" "}
                  {formatMoney(item.unit_price_minor, quote.currency)} · total{" "}
                  {formatMoney(item.line_total_minor, quote.currency)}
                  {item.is_optional ? " · optional" : ""}
                  {!item.is_selected ? " · not selected" : ""}
                </small>
                {item.finding_title && (
                  <small>Finding: {item.finding_title}</small>
                )}
                <div className="ops-inline-actions">
                  <button
                    className="ops-button"
                    onClick={() =>
                      void updateQuoteItem(item, {
                        isSelected: !item.is_selected,
                      })
                    }
                  >
                    {item.is_selected ? "Exclude from total" : "Select"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form className="ops-form" onSubmit={addQuoteItem}>
            <div className="ops-form-grid">
              <label>
                Item title
                <input
                  value={quoteItemForm.title}
                  onChange={(event) =>
                    setQuoteItemForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Type
                <select
                  value={quoteItemForm.itemType}
                  onChange={(event) =>
                    setQuoteItemForm((prev) => ({
                      ...prev,
                      itemType: event.target.value as OperationsQuoteItemType,
                    }))
                  }
                >
                  {quoteItemTypeOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unit price ({quote.currency === "GBP" ? "£" : quote.currency})
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={quoteItemForm.unitPrice}
                  onChange={(event) =>
                    setQuoteItemForm((prev) => ({
                      ...prev,
                      unitPrice: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Estimated effort
                <input
                  value={quoteItemForm.estimatedEffort}
                  onChange={(event) =>
                    setQuoteItemForm((prev) => ({
                      ...prev,
                      estimatedEffort: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                value={quoteItemForm.description}
                onChange={(event) =>
                  setQuoteItemForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <button className="ops-button ops-button--primary">Add item</button>
          </form>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Client preview</h2>
            {quotePreview && (
              <span className="ops-muted">{quoteFilename(quotePreview)}</span>
            )}
          </div>
          {renderQuotePreview()}
        </section>
        <section className="ops-panel">
          <h2>Activity</h2>
          <div className="ops-timeline">
            {quoteDetail.statusHistory.map((item) => (
              <div key={item.id} className="ops-note">
                <small>
                  {formatDateTime(item.created_at)} ·{" "}
                  {item.admin_email ?? "Internal operator"}
                </small>
                <p>
                  {item.previous_status
                    ? `${quoteStatusLabel(item.previous_status)} to `
                    : ""}
                  {quoteStatusLabel(item.new_status)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
        {renderServiceCreateModal()}
      </>
    );
  }

  function renderWorkPage() {
    if (operationsWorkOrderId) return renderWorkDetail();
    const cards = [
      ["Awaiting access", workSummary.awaitingAccess],
      ["Ready to start", workSummary.readyToStart],
      ["In progress", workSummary.inProgress],
      ["Waiting for client", workSummary.waitingForClient],
      ["Blocked", workSummary.blocked],
      ["Ready for testing", workSummary.readyForTesting],
      ["Completed this month", workSummary.completedThisMonth],
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Delivery</div>
            <h1>Work</h1>
            <p>
              Track accepted client work from access request through completion.
            </p>
          </div>
          <button className="ops-button" onClick={() => void loadWorkOrders()}>
            Refresh
          </button>
        </section>
        <section className="ops-card-grid">
          {cards.map(([label, value]) => (
            <div key={label} className="ops-summary-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Work orders</small>
            </div>
          ))}
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-panel">
          <h2>{workOrders.length} work orders</h2>
          {workLoading ? (
            <div className="ops-empty-card">Loading work...</div>
          ) : workOrders.length === 0 ? (
            <div className="ops-empty-card">
              No accepted quotes have been converted into work yet.
            </div>
          ) : (
            <div className="ops-list">
              {workOrders.map((work) => (
                <div key={work.id} className="ops-list-card">
                  <strong>
                    {work.work_order_number} · {work.title}
                  </strong>
                  <span>
                    {work.business_name ?? "Business"} ·{" "}
                    {formatMoney(work.accepted_total_minor, work.currency)}
                  </span>
                  <small>
                    {workStatusLabel(work.status)} ·{" "}
                    {work.completed_item_count ?? 0}/
                    {work.active_item_count ?? 0} items complete · access{" "}
                    {work.outstanding_access_count ?? 0}
                  </small>
                  <div className="ops-inline-actions">
                    {renderLink(
                      `/operations/work/${work.id}`,
                      "Open work",
                      "ops-button ops-button--primary",
                    )}
                    {renderLink(
                      `/operations/quotes/${work.quote_id}`,
                      "Quote",
                      "ops-button",
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  function renderWorkDetail() {
    if (workDetailLoading)
      return <section className="ops-panel">Loading work...</section>;
    if (!workDetail)
      return <section className="ops-panel">Work order not found.</section>;
    const work = workDetail.workOrder;
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Work order</div>
            <h1>{work.work_order_number}</h1>
            <p>{work.title}</p>
            <span className="ops-muted">
              {work.business_name} · {workStatusLabel(work.status)} ·{" "}
              {workPriorityLabel(work.priority)}
            </span>
          </div>
          <div className="ops-inline-actions">
            <button
              className="ops-button"
              onClick={() => void patchWorkOrder({ status: "in_progress" })}
            >
              Start work
            </button>
            <button
              className="ops-button"
              onClick={() =>
                void patchWorkOrder({ status: "ready_for_testing" })
              }
            >
              Begin testing
            </button>
            <button
              className="ops-button"
              onClick={() =>
                void completeWorkOrder().catch((err) =>
                  setActionError(String(err.message ?? err)),
                )
              }
            >
              Mark completed
            </button>
            {work.status === "completed" && (
              <button
                className="ops-button"
                onClick={() =>
                  openCreateService({
                    businessId: work.business_id,
                    contactId: work.contact_id ?? "",
                    sourceWorkOrderId: work.id,
                    name: `${work.business_name ?? "Client"} managed service`,
                    currency: work.currency,
                    includedScope: work.scope_summary ?? "",
                  })
                }
              >
                Offer service
              </button>
            )}
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {workDetail.completionIssues.length > 0 && (
          <section className="ops-warning">
            {workDetail.completionIssues.map((issue) => (
              <div key={issue}>{issue}</div>
            ))}
          </section>
        )}
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Overview</h2>
            <dl className="ops-definition-grid">
              <dt>Status</dt>
              <dd>{workStatusLabel(work.status)}</dd>
              <dt>Priority</dt>
              <dd>{workPriorityLabel(work.priority)}</dd>
              <dt>Total</dt>
              <dd>{formatMoney(work.accepted_total_minor, work.currency)}</dd>
              <dt>Target</dt>
              <dd>{formatDateTime(work.target_completion_at)}</dd>
              <dt>Quote</dt>
              <dd>{work.quote_number}</dd>
            </dl>
          </div>
          <div className="ops-panel">
            <h2>Access</h2>
            {workDetail.accessRequirements.length === 0 ? (
              <div className="ops-empty-card">
                No access requirements recorded.
              </div>
            ) : (
              <div className="ops-list">
                {workDetail.accessRequirements.map((item) => (
                  <div key={item.id} className="ops-list-card">
                    <strong>{item.description}</strong>
                    <small>{item.status.replaceAll("_", " ")}</small>
                    {item.secure_storage_reference && (
                      <small>{item.secure_storage_reference}</small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-panel">
          <h2>Work items</h2>
          <div className="ops-list">
            {workDetail.items.map((item) => (
              <div key={item.id} className="ops-list-card">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
                <small>
                  {item.status.replaceAll("_", " ")} · re-test{" "}
                  {item.retest_status.replaceAll("_", " ")}
                </small>
                {item.finding_title && (
                  <small>Finding: {item.finding_title}</small>
                )}
                <div className="ops-inline-actions">
                  <button
                    className="ops-button"
                    onClick={() =>
                      void updateWorkItem(item, { status: "in_progress" })
                    }
                  >
                    Start
                  </button>
                  <button
                    className="ops-button"
                    onClick={() =>
                      void updateWorkItem(item, {
                        status: "ready_for_testing",
                        retestStatus: item.requires_retest
                          ? "pending"
                          : "not_required",
                      })
                    }
                  >
                    Ready for testing
                  </button>
                  <button
                    className="ops-button"
                    onClick={() =>
                      void updateWorkItem(item, {
                        status: "completed",
                        retestStatus: item.requires_retest
                          ? "passed"
                          : "not_required",
                      })
                    }
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        {renderServiceCreateModal()}
      </>
    );
  }

  function renderServiceCreateModal() {
    if (!serviceFormOpen) return null;
    const selectedPlan = servicePlans.find(
      (plan) => plan.id === serviceForm.servicePlanId,
    );
    const businessOptions = businesses;
    const selectedBusinessDetail =
      serviceCreateDetail?.business.id === serviceForm.businessId
        ? serviceCreateDetail
        : null;
    const contactOptions =
      selectedBusinessDetail?.contacts.filter(
        (contact) => !contact.archived_at,
      ) ?? [];
    const siteOptions = selectedBusinessDetail?.linkedSites ?? [];
    return (
      <div className="ops-modal">
        <div className="ops-modal__panel ops-modal__panel--wide">
          <div className="ops-panel__header">
            <h2>Create managed service</h2>
            <button
              className="ops-button"
              onClick={() => setServiceFormOpen(false)}
            >
              Close
            </button>
          </div>
          <form className="ops-form" onSubmit={submitService}>
            <div className="ops-form-grid">
              <label>
                Business
                <select
                  value={serviceForm.businessId}
                  onChange={(event) => {
                    const nextBusinessId = event.target.value;
                    setServiceForm((prev) => ({
                      ...prev,
                      businessId: nextBusinessId,
                      contactId: "",
                      sourceQuoteId: "",
                      sourceWorkOrderId: "",
                      siteIds: [],
                    }));
                    setServiceCreateDetail(null);
                    void loadServiceCreateBusiness(nextBusinessId);
                  }}
                  required
                >
                  <option value="">Select business</option>
                  {businessOptions.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact
                <select
                  value={serviceForm.contactId}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      contactId: event.target.value,
                    }))
                  }
                  disabled={!serviceForm.businessId || !selectedBusinessDetail}
                >
                  <option value="">
                    {selectedBusinessDetail
                      ? "No contact selected"
                      : "Select business first"}
                  </option>
                  {contactOptions.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contactName(contact) ||
                        contact.email ||
                        "Unnamed contact"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Plan template
                <select
                  value={serviceForm.servicePlanId}
                  onChange={(event) => {
                    const plan = servicePlans.find(
                      (item) => item.id === event.target.value,
                    );
                    setServiceForm((prev) => ({
                      ...prev,
                      servicePlanId: event.target.value,
                      name: plan?.name ?? prev.name,
                      currency: plan?.default_currency ?? prev.currency,
                      agreedPrice: formatMajorMoneyInput(
                        plan?.default_price_minor ??
                          Math.round(Number(prev.agreedPrice || 0) * 100),
                      ),
                      billingCadence:
                        plan?.default_billing_cadence ?? prev.billingCadence,
                      scanFrequency:
                        plan?.default_scan_frequency ?? prev.scanFrequency,
                      reportFrequency:
                        plan?.default_report_frequency ?? prev.reportFrequency,
                      reviewFrequency:
                        plan?.default_review_frequency ?? prev.reviewFrequency,
                      scopeSummary: plan?.scope_summary ?? prev.scopeSummary,
                      includedScope: plan?.included_scope ?? prev.includedScope,
                      excludedScope: plan?.excluded_scope ?? prev.excludedScope,
                    }));
                  }}
                >
                  <option value="">No template</option>
                  {servicePlans
                    .filter((plan) => plan.is_active && !plan.archived_at)
                    .map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Service name
                <input
                  value={serviceForm.name}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Agreed price ({serviceForm.currency})
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={serviceForm.agreedPrice}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      agreedPrice: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Billing cadence
                <select
                  value={serviceForm.billingCadence}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      billingCadence: event.target
                        .value as OperationsServiceBillingCadence,
                    }))
                  }
                >
                  {Object.entries(serviceCadenceLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Start date
                <input
                  type="date"
                  value={serviceForm.startDate}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Scan frequency
                <select
                  value={serviceForm.scanFrequency}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      scanFrequency: event.target
                        .value as OperationsServiceScanFrequency,
                    }))
                  }
                >
                  {[
                    "daily",
                    "weekly",
                    "fortnightly",
                    "monthly",
                    "manual",
                    "custom",
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Report frequency
                <select
                  value={serviceForm.reportFrequency}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      reportFrequency: event.target
                        .value as OperationsServiceReportFrequency,
                    }))
                  }
                >
                  {["weekly", "monthly", "quarterly", "manual", "custom"].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value.replace(/_/g, " ")}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Renewal date
                <input
                  type="date"
                  value={serviceForm.renewalDate}
                  onChange={(event) =>
                    setServiceForm((prev) => ({
                      ...prev,
                      renewalDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            {siteOptions.length > 0 && (
              <fieldset className="ops-fieldset">
                <legend>Covered websites</legend>
                {siteOptions.map((site) => (
                  <label key={site.site_id} className="ops-checkbox">
                    <input
                      type="checkbox"
                      checked={serviceForm.siteIds.includes(site.site_id)}
                      onChange={(event) =>
                        setServiceForm((prev) => ({
                          ...prev,
                          siteIds: event.target.checked
                            ? Array.from(
                                new Set([...prev.siteIds, site.site_id]),
                              )
                            : prev.siteIds.filter((id) => id !== site.site_id),
                        }))
                      }
                    />
                    {site.site_display_name ?? site.url}
                  </label>
                ))}
              </fieldset>
            )}
            <label>
              Included scope
              <textarea
                value={serviceForm.includedScope}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    includedScope: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Excluded scope
              <textarea
                value={serviceForm.excludedScope}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    excludedScope: event.target.value,
                  }))
                }
                required
              />
            </label>
            {selectedPlan && (
              <div className="ops-empty-card">
                Defaults copied from {selectedPlan.name}. Review price, scope
                and covered sites before activation.
              </div>
            )}
            <label className="ops-checkbox">
              <input
                type="checkbox"
                checked={serviceForm.zeroCostConfirmed}
                onChange={(event) =>
                  setServiceForm((prev) => ({
                    ...prev,
                    zeroCostConfirmed: event.target.checked,
                  }))
                }
              />
              Explicit zero-cost or internal arrangement
            </label>
            <div className="ops-form-actions">
              <button className="ops-button ops-button--primary">
                Save draft service
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderServicePlansPage() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Reusable templates</div>
            <h1>Service Plan Templates</h1>
            <p>
              Define editable managed-service defaults before client agreement.
            </p>
          </div>
          <button
            className="ops-button"
            onClick={() => void loadServicePlans()}
          >
            Refresh
          </button>
        </section>
        <section className="ops-panel">
          {servicePlansLoading ? (
            <div className="ops-empty-card">Loading service plans...</div>
          ) : servicePlans.length === 0 ? (
            <div className="ops-empty-card">
              No service plan templates are available yet.
            </div>
          ) : (
            <div className="ops-list">
              {servicePlans.map((plan) => (
                <div key={plan.id} className="ops-list-card">
                  <strong>{plan.name}</strong>
                  <span>
                    {servicePlanTypeLabels[plan.plan_type]} ·{" "}
                    {formatMoney(
                      plan.default_price_minor,
                      plan.default_currency,
                    )}{" "}
                    {serviceCadenceLabels[plan.default_billing_cadence]}
                  </span>
                  <small>
                    {plan.default_scan_frequency} scans ·{" "}
                    {plan.default_report_frequency} reports ·{" "}
                    {plan.active_service_count ?? 0} active services
                  </small>
                  <p>{plan.scope_summary}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    );
  }

  function renderServicesPage() {
    if (operationsClientServiceId) return renderServiceDetail();
    const cards = [
      ["Active", servicesSummary.active],
      ["Reports due", servicesSummary.reportsDue],
      ["Reviews due", servicesSummary.reviewsDue],
      ["Site attention", servicesSummary.attention],
      ["Paused", servicesSummary.paused],
      ["Renewals", servicesSummary.renewals],
      ["Cancellations", servicesSummary.cancellations],
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Recurring clients</div>
            <h1>Managed Services</h1>
            <p>
              Manage recurring monitoring, reports, support and client reviews.
            </p>
          </div>
          <div className="ops-inline-actions">
            <button
              className="ops-button ops-button--primary"
              onClick={() => openCreateService()}
            >
              Create service
            </button>
            {renderLink(
              "/operations/service-plans",
              "Service Plan Templates",
              "ops-button",
            )}
          </div>
        </section>
        <section className="ops-card-grid">
          {cards.map(([label, value]) => (
            <div key={label} className="ops-summary-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Managed service workflow</small>
            </div>
          ))}
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>{services.length} services</h2>
            <button className="ops-button" onClick={() => void loadServices()}>
              Refresh
            </button>
          </div>
          {servicesLoading ? (
            <div className="ops-empty-card">Loading services...</div>
          ) : services.length === 0 ? (
            <div className="ops-empty-card">
              No managed services match the current filters.
            </div>
          ) : (
            <div className="ops-list">
              {services.map((service) => (
                <div key={service.id} className="ops-list-card">
                  <strong>
                    {service.service_number} · {service.name}
                  </strong>
                  <span>
                    {service.business_name ?? "Business"} ·{" "}
                    {serviceStatusLabels[service.status]} ·{" "}
                    {service.plan_name ?? "Custom plan"}
                  </span>
                  <small>
                    {formatMoney(service.agreed_price_minor, service.currency)}{" "}
                    · {serviceCadenceLabels[service.billing_cadence]} ·{" "}
                    {service.covered_site_count ?? 0} sites ·{" "}
                    {service.site_attention_count ?? 0} attention items
                  </small>
                  <small>
                    Next report {formatDateTime(service.next_report_at)} · next
                    review {formatDateTime(service.next_review_at)} · renewal{" "}
                    {formatDateTime(service.renewal_date)}
                  </small>
                  <div className="ops-inline-actions">
                    {renderLink(
                      `/operations/services/${service.id}`,
                      "Open service",
                      "ops-button ops-button--primary",
                    )}
                    {service.status === "draft" &&
                      renderLink(
                        `/operations/services/${service.id}`,
                        "Edit draft",
                        "ops-button",
                      )}
                    {service.status === "draft" && (
                      <button
                        className="ops-button"
                        onClick={() =>
                          openCreateService({
                            businessId: service.business_id,
                            contactId: service.contact_id ?? "",
                            servicePlanId: service.service_plan_id ?? "",
                            sourceQuoteId: service.source_quote_id ?? "",
                            sourceWorkOrderId:
                              service.source_work_order_id ?? "",
                            name: `${service.name} copy`,
                            currency: service.currency,
                            agreedPrice: formatMajorMoneyInput(
                              service.agreed_price_minor,
                            ),
                            billingCadence: service.billing_cadence,
                            scanFrequency: service.scan_frequency,
                            reportFrequency: service.report_frequency,
                            reviewFrequency: service.review_frequency,
                            includedScope: service.included_scope ?? "",
                            excludedScope: service.excluded_scope ?? "",
                            scopeSummary: service.scope_summary ?? "",
                            customTerms: service.custom_terms ?? "",
                            zeroCostConfirmed: service.zero_cost_confirmed,
                          })
                        }
                      >
                        Duplicate draft
                      </button>
                    )}
                    {service.status === "draft" && (
                      <button
                        className="ops-button"
                        onClick={() =>
                          void runServiceListAction(async () => {
                            const endpoint = service.archived_at
                              ? "restore"
                              : "archive";
                            if (
                              !service.archived_at &&
                              !window.confirm(
                                "Archive this unused draft service?",
                              )
                            ) {
                              return;
                            }
                            const res = await apiFetch(
                              `${apiBase}/operations/services/${encodeURIComponent(service.id)}/${endpoint}`,
                              { method: "POST" },
                            );
                            if (!res.ok) {
                              throw new Error(
                                await apiErrorMessage(
                                  res,
                                  "Failed to update service lifecycle",
                                ),
                              );
                            }
                          })
                        }
                      >
                        {service.archived_at ? "Restore" : "Archive"}
                      </button>
                    )}
                    {["proposed", "pending_start", "active", "paused"].includes(
                      service.status,
                    ) && (
                      <button
                        className="ops-button"
                        onClick={() =>
                          void runServiceListAction(async () => {
                            if (
                              !window.confirm(
                                "Cancel this managed service using the existing lifecycle rules?",
                              )
                            ) {
                              return;
                            }
                            const res = await apiFetch(
                              `${apiBase}/operations/services/${encodeURIComponent(service.id)}/cancel`,
                              {
                                method: "POST",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  reason:
                                    "Cancelled from managed services list.",
                                }),
                              },
                            );
                            if (!res.ok) {
                              throw new Error(
                                await apiErrorMessage(
                                  res,
                                  "Failed to cancel service",
                                ),
                              );
                            }
                          })
                        }
                      >
                        Cancel
                      </button>
                    )}
                    {renderLink(
                      `/operations/businesses/${service.business_id}`,
                      "Business",
                      "ops-button",
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {renderServiceCreateModal()}
      </>
    );
  }

  function renderServiceDetail() {
    if (serviceDetailLoading) {
      return <section className="ops-panel">Loading service...</section>;
    }
    if (!serviceDetail) {
      return <section className="ops-panel">Service not found.</section>;
    }
    const service = serviceDetail.service;
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Managed service</div>
            <h1>{service.service_number}</h1>
            <p>{service.name}</p>
            <span className="ops-muted">
              {service.business_name} · {serviceStatusLabels[service.status]} ·{" "}
              {service.plan_name ?? "Custom plan"}
            </span>
          </div>
          <div className="ops-inline-actions">
            {service.status === "draft" && (
              <button
                className="ops-button"
                onClick={() => void runServiceAction("propose")}
              >
                Mark proposed
              </button>
            )}
            {["draft", "proposed", "pending_start"].includes(
              service.status,
            ) && (
              <button
                className="ops-button ops-button--primary"
                onClick={() =>
                  void activateService().catch((err) =>
                    setActionError(String(err.message ?? err)),
                  )
                }
              >
                Activate
              </button>
            )}
            {service.status === "active" && (
              <button
                className="ops-button"
                onClick={() =>
                  void runServiceAction("pause", {
                    reason: "Paused from Operations workspace.",
                  })
                }
              >
                Pause
              </button>
            )}
            {service.status === "paused" && (
              <button
                className="ops-button"
                onClick={() => void runServiceAction("resume")}
              >
                Resume
              </button>
            )}
            <button
              className="ops-button"
              onClick={() => void runServiceAction("generate-tasks")}
            >
              Generate tasks
            </button>
            <button
              className="ops-button"
              onClick={() => void runServiceAction("create-report")}
            >
              Create monthly report
            </button>
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {serviceDetail.activationIssues.length > 0 && (
          <section className="ops-warning">
            {serviceDetail.activationIssues.map((issue) => (
              <div key={issue}>{issue.replace(/_/g, " ")}</div>
            ))}
          </section>
        )}
        <section className="ops-card-grid">
          {[
            [
              "Covered sites",
              serviceDetail.sites.filter((site) => !site.removed_at).length,
            ],
            [
              "Open obligations",
              serviceDetail.tasks.filter((task) => task.status !== "completed")
                .length,
            ],
            [
              "Incidents",
              serviceDetail.incidents.filter(
                (incident) =>
                  !["resolved", "dismissed"].includes(incident.review_state),
              ).length,
            ],
            ["Usage minutes", serviceDetail.allowance.minutesUsed],
          ].map(([label, value]) => (
            <div key={label} className="ops-summary-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Current service state</small>
            </div>
          ))}
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Plan and scope</h2>
            <dl className="ops-definition-grid">
              <dt>Price</dt>
              <dd>
                {formatMoney(service.agreed_price_minor, service.currency)} ·{" "}
                {serviceCadenceLabels[service.billing_cadence]}
              </dd>
              <dt>Scan frequency</dt>
              <dd>{service.scan_frequency}</dd>
              <dt>Report frequency</dt>
              <dd>{service.report_frequency}</dd>
              <dt>Next report</dt>
              <dd>{formatDateTime(service.next_report_at)}</dd>
              <dt>Next review</dt>
              <dd>{formatDateTime(service.next_review_at)}</dd>
              <dt>Renewal</dt>
              <dd>{formatDateTime(service.renewal_date)}</dd>
            </dl>
            <h3>Included</h3>
            <p>{service.included_scope ?? "No included scope recorded."}</p>
            <h3>Excluded</h3>
            <p>{service.excluded_scope ?? "No excluded scope recorded."}</p>
          </div>
          <div className="ops-panel">
            <h2>Usage allowance</h2>
            {serviceDetail.allowance.warning && (
              <div className="ops-warning">
                {serviceDetail.allowance.warning}
              </div>
            )}
            <dl className="ops-definition-grid">
              <dt>Period</dt>
              <dd>
                {formatDateTime(serviceDetail.allowance.periodStart)} to{" "}
                {formatDateTime(serviceDetail.allowance.periodEnd)}
              </dd>
              <dt>Minutes</dt>
              <dd>
                {serviceDetail.allowance.minutesUsed}/
                {serviceDetail.allowance.minutesIncluded ?? "unlimited"}
              </dd>
              <dt>Fixes</dt>
              <dd>
                {serviceDetail.allowance.fixesUsed}/
                {serviceDetail.allowance.fixesIncluded ?? "unlimited"}
              </dd>
              <dt>Rollover</dt>
              <dd>
                {serviceDetail.allowance.rolloverEnabled
                  ? "Enabled"
                  : "No rollover"}
              </dd>
            </dl>
            <form className="ops-form" onSubmit={addServiceUsage}>
              <label>
                Usage description
                <input
                  value={serviceUsageForm.description}
                  onChange={(event) =>
                    setServiceUsageForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <div className="ops-form-grid">
                <label>
                  Minutes
                  <input
                    type="number"
                    min="0"
                    value={serviceUsageForm.minutesUsed}
                    onChange={(event) =>
                      setServiceUsageForm((prev) => ({
                        ...prev,
                        minutesUsed: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Fixes
                  <input
                    type="number"
                    min="0"
                    value={serviceUsageForm.fixesUsed}
                    onChange={(event) =>
                      setServiceUsageForm((prev) => ({
                        ...prev,
                        fixesUsed: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label className="ops-checkbox">
                <input
                  type="checkbox"
                  checked={serviceUsageForm.isOutOfScope}
                  onChange={(event) =>
                    setServiceUsageForm((prev) => ({
                      ...prev,
                      isOutOfScope: event.target.checked,
                    }))
                  }
                />
                This may be outside the agreed allowance
              </label>
              <button className="ops-button">Record usage</button>
            </form>
          </div>
        </section>
        <section className="ops-panel">
          <h2>Coverage</h2>
          {serviceDetail.sites.length === 0 ? (
            <div className="ops-empty-card">No websites covered yet.</div>
          ) : (
            <div className="ops-list">
              {serviceDetail.sites.map((site) => (
                <div key={site.id} className="ops-list-card">
                  <strong>{site.site_display_name ?? site.site_url}</strong>
                  <small>
                    {site.removed_at ? "Removed" : "Covered"} · schedule{" "}
                    {site.schedule_managed_by_service
                      ? "managed by service"
                      : "unchanged"}{" "}
                    · next scan {formatDateTime(site.next_scheduled_at ?? null)}
                  </small>
                  <small>
                    {site.critical_issue_count ?? 0} critical ·{" "}
                    {site.high_issue_count ?? 0} high ·{" "}
                    {site.active_incident_count ?? 0} active incidents
                  </small>
                  <div className="ops-inline-actions">
                    {renderLink(
                      "/dashboard?selectSite=1",
                      "Open monitoring",
                      "ops-button",
                    )}
                    {site.latest_scan_id &&
                      renderLink(
                        `/report?scanRunId=${site.latest_scan_id}`,
                        "Technical report",
                        "ops-button",
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Reports</h2>
            {serviceDetail.reports.length === 0 ? (
              <div className="ops-empty-card">No service reports yet.</div>
            ) : (
              <div className="ops-list">
                {serviceDetail.reports.map((report) => (
                  <div key={report.id} className="ops-list-card">
                    <strong>{report.title}</strong>
                    <small>
                      {reportStatusLabel(report.status)} ·{" "}
                      {report.site_url ?? "site"}
                    </small>
                    {renderLink(
                      `/operations/reports/${report.id}`,
                      "Open report",
                      "ops-button",
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <h2>Activity</h2>
            {serviceDetail.activities.length === 0 ? (
              <div className="ops-empty-card">No service activity yet.</div>
            ) : (
              <div className="ops-timeline">
                {serviceDetail.activities.map((item) => (
                  <div key={item.id} className="ops-note">
                    <small>{formatDateTime(item.occurred_at)}</small>
                    <strong>{item.title}</strong>
                    {item.detail && <p>{item.detail}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  function renderReportsPage() {
    if (operationsReportId) return renderReportDetail();
    const cards = [
      ["Draft", reportsSummary.draft],
      ["Needs review", reportsSummary.needsReview],
      ["Ready to send", reportsSummary.readyToSend],
      ["Sent this month", reportsSummary.sentThisMonth],
      ["Awaiting response", reportsSummary.awaitingClientResponse],
      ["Completed", reportsSummary.completed],
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Client deliverables</div>
            <h1>Reports</h1>
            <p>Review findings, prepare client reports and track delivery.</p>
          </div>
          <button
            className="ops-button ops-button--primary"
            onClick={() => openCreateReport()}
          >
            Create report
          </button>
        </section>
        <section className="ops-card-grid">
          {cards.map(([label, value]) => (
            <div key={label} className="ops-summary-card">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>Operations client reports</small>
            </div>
          ))}
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>{reports.length} reports</h2>
            <button className="ops-button" onClick={() => void loadReports()}>
              Refresh
            </button>
          </div>
          {reportsLoading ? (
            <div className="ops-empty-card">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="ops-empty-card">
              No Operations client reports have been created yet.
            </div>
          ) : (
            <div className="ops-list">
              {reports.map((report) => (
                <div key={report.id} className="ops-list-card">
                  <strong>{report.title}</strong>
                  <span>
                    {report.business_name ?? "Business"} ·{" "}
                    {report.site_display_name ?? report.site_url}
                  </span>
                  <small>
                    {reportTypeLabel(report.report_type)} ·{" "}
                    {reportStatusLabel(report.status)} · v
                    {report.version_number}
                  </small>
                  <small>
                    {report.included_findings ?? 0} included ·{" "}
                    {report.incomplete_findings ?? 0} incomplete ·{" "}
                    {report.critical_findings ?? 0} critical ·{" "}
                    {report.important_findings ?? 0} important ·{" "}
                    {report.improvement_findings ?? 0} improvement
                  </small>
                  <small>
                    Updated {formatDateTime(report.updated_at)}
                    {report.sent_at
                      ? ` · sent ${formatDateTime(report.sent_at)}`
                      : ""}
                  </small>
                  <div className="ops-inline-actions">
                    {report.status === "sent" ? (
                      <button
                        className="ops-button ops-button--primary"
                        onClick={() => void downloadSavedReportPdf(report.id)}
                      >
                        Download PDF
                      </button>
                    ) : (
                      renderLink(
                        `/operations/reports/${report.id}`,
                        report.status === "needs_review"
                          ? (report.incomplete_findings ?? 0) > 0
                            ? `Resolve ${report.incomplete_findings} incomplete`
                            : "Continue review"
                          : report.status === "ready_to_send"
                            ? "Preview"
                            : "Open report",
                        "ops-button ops-button--primary",
                      )
                    )}
                    {renderLink(
                      `/operations/reports/${report.id}`,
                      "Client preview",
                      "ops-button",
                    )}
                    {renderLink(
                      `/report?scanRunId=${report.scan_run_id}`,
                      "Technical report",
                      "ops-button",
                    )}
                    <button
                      className="ops-button"
                      onClick={() =>
                        void runReportListAction(async () => {
                          const res = await apiFetch(
                            `${apiBase}/operations/reports/${encodeURIComponent(report.id)}/duplicate`,
                            { method: "POST" },
                          );
                          if (!res.ok) {
                            throw new Error(
                              await apiErrorMessage(
                                res,
                                "Failed to duplicate report",
                              ),
                            );
                          }
                        })
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      className="ops-button"
                      onClick={() =>
                        void runReportListAction(async () => {
                          const endpoint = report.archived_at
                            ? "restore"
                            : "archive";
                          if (
                            !report.archived_at &&
                            !window.confirm(
                              "Archive this Operations report? The technical scan and scan findings are preserved.",
                            )
                          ) {
                            return;
                          }
                          const res = await apiFetch(
                            `${apiBase}/operations/reports/${encodeURIComponent(report.id)}/${endpoint}`,
                            { method: "POST" },
                          );
                          if (!res.ok) {
                            throw new Error(
                              await apiErrorMessage(
                                res,
                                "Failed to update report lifecycle",
                              ),
                            );
                          }
                        })
                      }
                    >
                      {report.archived_at ? "Restore" : "Archive"}
                    </button>
                    <button
                      className="ops-button"
                      onClick={() =>
                        void runReportListAction(async () => {
                          if (
                            !window.confirm(
                              "Delete this unused draft Operations report? This removes only the Operations report wrapper; the technical scan and source scan findings remain intact.",
                            )
                          ) {
                            return;
                          }
                          const res = await apiFetch(
                            `${apiBase}/operations/reports/${encodeURIComponent(report.id)}`,
                            { method: "DELETE" },
                          );
                          if (!res.ok) {
                            throw new Error(
                              await apiErrorMessage(
                                res,
                                "Failed to delete report",
                              ),
                            );
                          }
                        })
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {renderReportCreateModal()}
      </>
    );
  }

  function renderClientReportPreview() {
    if (!reportPreview) {
      return <div className="ops-empty-card">Preview is not available.</div>;
    }
    return (
      <div className="ops-client-report">
        <section className="ops-client-cover">
          <div className="ops-client-brand">Scanlark</div>
          <h1>{reportPreview.report.title}</h1>
          <p>{reportPreview.business.name}</p>
          <p>{reportPreview.site.displayName ?? reportPreview.site.url}</p>
          <small>
            Prepared for {reportPreview.report.preparedFor ?? "Client"} ·{" "}
            {reportPreview.report.coverDate}
          </small>
        </section>
        <section>
          <h2>Executive summary</h2>
          <p>
            {reportPreview.summaries.executiveSummary ??
              "Executive summary has not been completed yet."}
          </p>
          {reportPreview.summaries.overallSummary && (
            <p>{reportPreview.summaries.overallSummary}</p>
          )}
        </section>
        <section className="ops-card-grid">
          {operationsReportPriorityOptions.map((item) => (
            <div key={item.value} className="ops-empty-card">
              <strong>{item.label}</strong>
              <p>{reportPreview.priorityCounts[item.value]} finding(s)</p>
            </div>
          ))}
        </section>
        <section>
          <h2>Key findings</h2>
          {reportPreview.findings.length === 0 ? (
            <div className="ops-empty-card">
              No client-facing findings are included.
            </div>
          ) : (
            <div className="ops-list">
              {reportPreview.findings.map((finding) => (
                <article
                  key={`${finding.priority}-${finding.title}-${finding.affectedUrl ?? ""}`}
                  className="ops-list-card"
                >
                  <small>{reportPriorityLabel(finding.priority)}</small>
                  <strong>{finding.title}</strong>
                  {finding.affectedUrl && <span>{finding.affectedUrl}</span>}
                  {finding.whatWasFound && <p>{finding.whatWasFound}</p>}
                  {finding.whyItMatters && <p>{finding.whyItMatters}</p>}
                  {finding.recommendedAction && (
                    <p>{finding.recommendedAction}</p>
                  )}
                  {finding.estimatedEffort && (
                    <small>Estimated effort: {finding.estimatedEffort}</small>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2>Positive observations</h2>
          <ul>
            {reportPreview.positiveObservations.map((item) => (
              <li key={item.title}>
                {item.title}
                {item.description ? `: ${item.description}` : ""}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Methodology and limitations</h2>
          <ul>
            {reportPreview.methodology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Next steps</h2>
          <ul>
            {reportPreview.nextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  function renderReportDetail() {
    if (reportDetailLoading && !reportDetail) {
      return <section className="ops-panel">Loading report...</section>;
    }
    if (!reportDetail) {
      return <section className="ops-panel">Report not found.</section>;
    }
    const report = reportDetail.report;
    return (
      <>
        <OperationsReportWorkspace
          detail={reportDetail}
          preview={reportPreview}
          readinessIssues={reportReadinessIssues}
          regroupPreview={reportRegroupPreview}
          actionError={actionError}
          onPatchReport={patchReport}
          onPatchFinding={patchFinding}
          onBulkFindings={bulkPatchReportFindings}
          onPreviewRegroup={previewReportRegroup}
          onApplyRegroup={applyReportRegroup}
          onPatchObservation={patchPositiveObservation}
          onPatchActionPlanItem={patchActionPlanItem}
          onMarkReady={() => runReportAction("mark-ready")}
          onRecordSent={recordReportSent}
          onGeneratePdf={generateReportPdf}
          onArchive={() => runReportAction("archive")}
          onCreateRetest={createRetestReport}
          onCreateQuote={() =>
            openCreateQuote({
              businessId: report.business_id,
              operationsReportId: report.id,
              title: `Fixes from ${report.title}`,
            })
          }
        />
        {renderQuoteCreateModal()}
      </>
    );
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Report review</div>
            <h1>{report.title}</h1>
            <p>
              {report.business_name} ·{" "}
              {report.site_display_name ?? report.site_url}
            </p>
            <span className="ops-muted">
              {reportTypeLabel(report.report_type)} ·{" "}
              {reportStatusLabel(report.status)} · version{" "}
              {report.version_number}
            </span>
          </div>
          <div className="ops-inline-actions">
            <button
              className="ops-button"
              onClick={() => void runReportAction("mark-ready")}
            >
              Mark ready
            </button>
            <button
              className="ops-button"
              onClick={() => void recordReportSent()}
            >
              Record sent
            </button>
            <button
              className="ops-button"
              onClick={() => void generateReportPdf()}
            >
              Print / PDF
            </button>
            <button
              className="ops-button ops-button--primary"
              onClick={() =>
                openCreateQuote({
                  businessId: report.business_id,
                  operationsReportId: report.id,
                  title: `Fixes from ${report.title}`,
                })
              }
            >
              Create quote
            </button>
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {reportReadinessIssues.length > 0 && (
          <section className="ops-warning">
            {reportReadinessIssues.map((issue) => (
              <div key={`${issue.code}-${issue.findingId ?? "report"}`}>
                {issue.message}
              </div>
            ))}
          </section>
        )}
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Overview</h2>
            <dl className="ops-definition-grid">
              <dt>Prepared for</dt>
              <dd>{report.prepared_for ?? "-"}</dd>
              <dt>Cover date</dt>
              <dd>{formatDate(report.cover_date)}</dd>
              <dt>Included</dt>
              <dd>{report.included_findings ?? 0}</dd>
              <dt>Excluded</dt>
              <dd>{report.excluded_findings ?? 0}</dd>
              <dt>Sent</dt>
              <dd>{formatDateTime(report.sent_at)}</dd>
              <dt>Frozen</dt>
              <dd>{formatDateTime(report.frozen_at)}</dd>
            </dl>
            <div className="ops-inline-actions">
              {renderLink(
                `/report?scanRunId=${report.scan_run_id}`,
                "Technical report",
                "ops-button",
              )}
              <button
                className="ops-button"
                onClick={() => void createRetestReport()}
              >
                Create re-test
              </button>
              <button
                className="ops-button"
                onClick={() => void runReportAction("archive")}
              >
                Archive
              </button>
            </div>
          </div>
          <div className="ops-panel">
            <h2>Executive summary</h2>
            <label>
              Personal executive summary
              <textarea
                value={report.executive_summary ?? ""}
                onChange={(event) =>
                  setReportDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          report: {
                            ...prev.report,
                            executive_summary: event.target.value,
                          },
                        }
                      : prev,
                  )
                }
              />
            </label>
            <label>
              Overall summary
              <textarea
                value={report.overall_summary ?? ""}
                onChange={(event) =>
                  setReportDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          report: {
                            ...prev.report,
                            overall_summary: event.target.value,
                          },
                        }
                      : prev,
                  )
                }
              />
            </label>
            <label className="ops-checkbox">
              <input
                type="checkbox"
                checked={report.no_major_findings_waived}
                onChange={(event) =>
                  setReportDetail((prev) =>
                    prev
                      ? {
                          ...prev,
                          report: {
                            ...prev.report,
                            no_major_findings_waived: event.target.checked,
                          },
                        }
                      : prev,
                  )
                }
              />
              Explicitly allow a no-major-findings report
            </label>
            <button
              className="ops-button ops-button--primary"
              onClick={() =>
                void patchReport({
                  executiveSummary: report.executive_summary,
                  overallSummary: report.overall_summary,
                  noMajorFindingsWaived: report.no_major_findings_waived,
                })
              }
            >
              Save summary
            </button>
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Findings review</h2>
            <span className="ops-muted">
              {reportDetail!.findings.length} candidate findings
            </span>
          </div>
          <div className="ops-list">
            {reportDetail!.findings.map((finding) => (
              <div key={finding.id} className="ops-list-card">
                <div className="ops-panel__header">
                  <strong>{finding.title}</strong>
                  <label className="ops-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        finding.is_included && !finding.is_false_positive
                      }
                      onChange={(event) =>
                        void patchFinding(finding.id, {
                          isIncluded: event.target.checked,
                          isFalsePositive: false,
                        })
                      }
                    />
                    Include
                  </label>
                </div>
                <small>
                  {finding.category} · source {finding.original_severity} ·{" "}
                  {finding.affected_url}
                </small>
                <div className="ops-form-grid">
                  <label>
                    Client priority
                    <select
                      value={finding.client_priority}
                      onChange={(event) =>
                        void patchFinding(finding.id, {
                          clientPriority: event.target
                            .value as OperationsReportPriority,
                        })
                      }
                    >
                      {operationsReportPriorityOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estimated effort
                    <input
                      defaultValue={finding.estimated_effort ?? ""}
                      onBlur={(event) =>
                        void patchFinding(finding.id, {
                          estimatedEffort: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Explanation
                  <textarea
                    defaultValue={finding.client_explanation ?? ""}
                    onBlur={(event) =>
                      void patchFinding(finding.id, {
                        clientExplanation: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Recommended action
                  <textarea
                    defaultValue={finding.recommended_action ?? ""}
                    onBlur={(event) =>
                      void patchFinding(finding.id, {
                        recommendedAction: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Internal note
                  <textarea
                    defaultValue={finding.internal_note ?? ""}
                    onBlur={(event) =>
                      void patchFinding(finding.id, {
                        internalNote: event.target.value,
                      })
                    }
                  />
                </label>
                <div className="ops-inline-actions">
                  <button
                    className="ops-button"
                    onClick={() =>
                      void patchFinding(finding.id, {
                        isIncluded: false,
                      })
                    }
                  >
                    Exclude
                  </button>
                  <button
                    className="ops-button"
                    onClick={() =>
                      void patchFinding(finding.id, {
                        isIncluded: false,
                        isFalsePositive: true,
                      })
                    }
                  >
                    Mark false positive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Linked quotes</h2>
              <button
                className="ops-button"
                onClick={() =>
                  openCreateQuote({
                    businessId: report.business_id,
                    operationsReportId: report.id,
                    title: `Fixes from ${report.title}`,
                  })
                }
              >
                Create quote
              </button>
            </div>
            {quotes.length === 0 ? (
              <div className="ops-empty-card">
                No quotes have been created from this report yet.
              </div>
            ) : (
              <div className="ops-list">
                {quotes.map((quote) => (
                  <div key={quote.id} className="ops-list-card">
                    <strong>{quote.quote_number}</strong>
                    <span>{quote.title}</span>
                    <small>
                      {quoteStatusLabel(quote.status)} ·{" "}
                      {formatMoney(quote.total_minor, quote.currency)}
                    </small>
                    {renderLink(
                      `/operations/quotes/${quote.id}`,
                      "Open quote",
                      "ops-button",
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <h2>Related work</h2>
            {workOrders.length === 0 ? (
              <div className="ops-empty-card">
                No work orders are linked to this report yet.
              </div>
            ) : (
              <div className="ops-list">
                {workOrders.map((work) => (
                  <div key={work.id} className="ops-list-card">
                    <strong>{work.work_order_number}</strong>
                    <span>{work.title}</span>
                    <small>{workStatusLabel(work.status)}</small>
                    {renderLink(
                      `/operations/work/${work.id}`,
                      "Open work",
                      "ops-button",
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Client preview</h2>
            {reportPreview && (
              <span className="ops-muted">{reportFilename(reportPreview)}</span>
            )}
          </div>
          {renderClientReportPreview()}
        </section>
        {reportDetail!.comparisonItems.length > 0 && (
          <section className="ops-panel">
            <h2>Re-test comparison</h2>
            <div className="ops-list">
              {reportDetail!.comparisonItems.map((item) => (
                <div key={item.id} className="ops-list-card">
                  <strong>{item.comparison_status}</strong>
                  <span>{item.summary ?? "No comparison summary."}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="ops-panel">
          <h2>Activity</h2>
          <div className="ops-timeline">
            {reportDetail!.activity.map((item) => (
              <div key={item.id} className="ops-note">
                <small>
                  {formatDateTime(item.created_at)} · {item.admin_email}
                </small>
                <p>{item.action}</p>
              </div>
            ))}
          </div>
        </section>
        {renderQuoteCreateModal()}
      </>
    );
  }

  function renderHome() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-badge">Internal Operations</div>
            <h1>Operations</h1>
            <p>
              Manage prospects, client reports, follow-ups and website work.
            </p>
            <span className="ops-muted">
              {summary.generatedAt === emptySummary.generatedAt
                ? "No summary loaded yet"
                : `Updated ${formatDateTime(summary.generatedAt)}`}
            </span>
          </div>
          <button
            type="button"
            className="ops-button ops-button--primary"
            onClick={() => void loadSummary()}
            disabled={summaryLoading}
          >
            {summaryLoading ? "Refreshing..." : "Refresh"}
          </button>
        </section>
        {summaryError && <div className="ops-error">{summaryError}</div>}
        <section className="ops-card-grid" aria-label="Attention summary">
          {attentionCards.map((card) => (
            <button
              key={card.label}
              type="button"
              className="ops-summary-card"
              onClick={() => onNavigate(card.href)}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </button>
          ))}
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Today</div>
                <h2>Today's work</h2>
              </div>
              {renderLink(
                "/operations/businesses?filter=follow_up&sort=next_follow_up",
                "View follow-ups",
              )}
            </div>
            <div className="ops-work-grid">
              {[
                ["Follow-ups due", summary.counts.followUpsDue],
                [
                  "Prospects awaiting contact",
                  summary.counts.prospectsAwaitingContact,
                ],
                [
                  "Reports awaiting review",
                  summary.counts.reportsAwaitingReview,
                ],
                ["Report follow-ups due", summary.counts.reportFollowUpsDue],
              ].map(([label, value]) => (
                <div key={label} className="ops-empty-card">
                  <strong>{label}</strong>
                  <p>
                    {value} item{value === 1 ? "" : "s"} currently need review.
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Actions</div>
                <h2>Quick actions</h2>
              </div>
            </div>
            <div className="ops-action-grid">
              <button
                className="ops-button"
                onClick={() => setAddBusinessOpen(true)}
              >
                Add prospect
              </button>
              {renderLink("/sites/new", "Add or monitor website", "ops-button")}
              {renderLink(
                "/dashboard?selectSite=1",
                "Start scan",
                "ops-button",
              )}
              {renderLink(
                "/operations/reports",
                "Review reports",
                "ops-button",
              )}
              {renderLink(
                "/operations/businesses?filter=follow_up",
                "View follow-ups",
                "ops-button",
              )}
              {renderLink("/operations/quotes", "Create quote", "ops-button")}
            </div>
          </div>
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Monitoring</div>
                <h2>Needs attention</h2>
              </div>
              {renderLink("/dashboard?selectSite=1", "Open monitoring")}
            </div>
            {summary.monitoringAttention.length > 0 ? (
              <div className="ops-list">
                {summary.monitoringAttention.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`ops-list-item ${item.severity}`}
                    onClick={() => onNavigate(item.href)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <small>{formatDateTime(item.occurredAt)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ops-empty-card">
                <strong>No monitoring warnings</strong>
                <p>
                  No down sites, recent failed scans, or critical client website
                  issues need attention right now.
                </p>
              </div>
            )}
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <div>
                <div className="ops-eyebrow">Activity</div>
                <h2>Recent activity</h2>
              </div>
            </div>
            {summary.recentActivity.length > 0 ? (
              <div className="ops-timeline">
                {summary.recentActivity.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="ops-activity"
                    onClick={() => onNavigate(item.href)}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                    <small>{formatDateTime(item.occurredAt)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ops-empty-card">
                <strong>No activity yet</strong>
                <p>
                  Site additions, scan completions, shared reports and uptime
                  alerts will appear here.
                </p>
              </div>
            )}
          </div>
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderBusinessesList() {
    const filters: Array<{ key: BusinessListFilter; label: string }> = [
      { key: "active", label: "All active" },
      { key: "follow_up", label: "Follow-up due" },
      { key: "prospects", label: "Prospects" },
      { key: "clients", label: "Clients" },
      { key: "ongoing", label: "Ongoing clients" },
      { key: "archived", label: "Archived" },
    ];
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Relationships</div>
            <h1>Businesses</h1>
            <p>Manage prospects, clients, contacts and monitored websites.</p>
          </div>
          <button
            type="button"
            className="ops-button ops-button--primary"
            onClick={() => {
              setBusinessForm(emptyBusinessForm);
              setAddBusinessOpen(true);
            }}
          >
            Add business
          </button>
        </section>
        <section className="ops-panel">
          <div className="ops-filterbar">
            <input
              aria-label="Search businesses"
              placeholder="Search businesses, contacts, email or website"
              value={search}
              onChange={(event) =>
                updateListUrl({ search: event.target.value })
              }
            />
            <select
              value={sort}
              onChange={(event) => updateListUrl({ sort: event.target.value })}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="name">Name</option>
              <option value="next_follow_up">Next follow-up</option>
            </select>
          </div>
          <div className="ops-segmented">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={activeFilter === filter.key ? "active" : ""}
                onClick={() => updateListUrl({ filter: filter.key })}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>
        {businessesError && <div className="ops-error">{businessesError}</div>}
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>
              {businessesLoading
                ? "Loading businesses"
                : `${businessesTotal} businesses`}
            </h2>
          </div>
          {businesses.length === 0 && !businessesLoading ? (
            <div className="ops-empty-panel">
              <h2>No businesses yet</h2>
              <p>
                No businesses yet. Add prospects you want to research and track
                them from first contact through to ongoing client.
              </p>
              <button
                className="ops-button ops-button--primary"
                onClick={() => setAddBusinessOpen(true)}
              >
                Add your first business
              </button>
            </div>
          ) : (
            <div className="ops-table">
              <div className="ops-table__head">
                <span>Business</span>
                <span>Contact</span>
                <span>Stage</span>
                <span>Follow-up</span>
                <span>Website attention</span>
                <span>Updated</span>
              </div>
              {businesses.map((business) => (
                <div
                  role="button"
                  tabIndex={0}
                  className="ops-table__row"
                  key={business.id}
                  onClick={() =>
                    onNavigate(`/operations/businesses/${business.id}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      onNavigate(`/operations/businesses/${business.id}`);
                    }
                  }}
                >
                  <span>
                    <strong>{business.name}</strong>
                    <small>
                      {business.is_archived ? "Archived · " : ""}
                      {business.website_url ??
                        `${business.linked_site_count} linked site${business.linked_site_count === 1 ? "" : "s"}`}
                    </small>
                  </span>
                  <span>
                    {contactName(business)}
                    <small>
                      {business.primary_contact_email ??
                        business.primary_contact_phone ??
                        ""}
                    </small>
                  </span>
                  <span>
                    {stageLabel(business.pipeline_stage)}
                    <small>
                      {relationshipLabel(business.relationship_type)}
                    </small>
                  </span>
                  <span>
                    {business.next_follow_up_at ? (
                      <strong
                        className={
                          isOverdue(business.next_follow_up_at)
                            ? "ops-overdue"
                            : ""
                        }
                      >
                        {isOverdue(business.next_follow_up_at)
                          ? "Overdue: "
                          : ""}
                        {formatDate(business.next_follow_up_at)}
                      </strong>
                    ) : (
                      "-"
                    )}
                    <small>{business.next_action ?? ""}</small>
                  </span>
                  <span>
                    {business.active_incident_count > 0
                      ? "Site down"
                      : business.critical_issue_count +
                            business.high_issue_count >
                          0
                        ? `${business.critical_issue_count} critical, ${business.high_issue_count} high`
                        : "No warnings"}
                    <small>{business.latest_scan_status ?? "No scans"}</small>
                  </span>
                  <span>
                    {formatDateTime(business.updated_at)}
                    <small className="ops-inline-actions">
                      <button
                        type="button"
                        className="ops-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigate(`/operations/businesses/${business.id}`);
                        }}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="ops-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigate(`/operations/businesses/${business.id}`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ops-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void runBusinessListAction(() =>
                            archiveBusinessListItem(business),
                          );
                        }}
                      >
                        {business.is_archived ? "Restore" : "Archive"}
                      </button>
                      <button
                        type="button"
                        className="ops-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void runBusinessListAction(() =>
                            deleteBusinessListItem(business),
                          );
                        }}
                      >
                        Delete
                      </button>
                    </small>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderBusinessDetail() {
    if (detailLoading)
      return <div className="ops-panel">Loading business...</div>;
    if (detailError || !detail) {
      return (
        <section className="ops-empty-panel">
          <h1>{detailError ?? "Business not found"}</h1>
          {renderLink(
            "/operations/businesses",
            "Back to businesses",
            "ops-button",
          )}
        </section>
      );
    }
    const b = detail.business;
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">
              {relationshipLabel(b.relationship_type)}
            </div>
            <h1>{b.name}</h1>
            <p>
              {stageLabel(b.pipeline_stage)} · Primary contact:{" "}
              {contactName(detail.primaryContact)}
            </p>
            <div className="ops-meta-row">
              <span>Next follow-up: {formatDate(b.next_follow_up_at)}</span>
              <span>Next action: {b.next_action ?? "-"}</span>
              <span>
                Website status:{" "}
                {detail.linkedSites.some((site) => site.active_incident_id)
                  ? "Attention needed"
                  : "No active incidents"}
              </span>
            </div>
          </div>
          <div className="ops-action-grid">
            <button className="ops-button" onClick={openEditBusiness}>
              Edit business
            </button>
            <button
              className="ops-button"
              onClick={() => {
                setEditingContactId(null);
                setContactForm(emptyContactForm);
                setContactFormOpen(true);
              }}
            >
              Add contact
            </button>
            <button
              className="ops-button"
              onClick={() =>
                void runDetailAction(async () => {
                  await patchBusiness({
                    markContactedNow: true,
                    clearNextFollowUp: clearFollowUpOnContact,
                  });
                })
              }
            >
              Mark contacted now
            </button>
            <button
              className="ops-button"
              onClick={() => openCommunicationForm({ status: "draft" })}
            >
              Draft email
            </button>
            <button
              className="ops-button"
              onClick={() =>
                openCommunicationForm({
                  direction: "inbound",
                  channel: "email",
                  status: "received",
                })
              }
            >
              Record reply
            </button>
            <button
              className="ops-button"
              onClick={() =>
                openCommunicationForm({
                  direction: "internal_note",
                  channel: "phone",
                  status: "ready",
                })
              }
            >
              Record call/note
            </button>
            <button
              className="ops-button"
              onClick={() =>
                window.confirm(
                  b.is_archived
                    ? "Restore this business?"
                    : "Archive this business?",
                ) &&
                void runDetailAction(async () => {
                  const endpoint = b.is_archived ? "restore" : "archive";
                  const res = await apiFetch(
                    `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/${endpoint}`,
                    { method: "POST" },
                  );
                  if (!res.ok)
                    throw new Error("Failed to update archive state");
                  await loadDetail();
                  await loadSummary();
                })
              }
            >
              {b.is_archived ? "Restore" : "Archive"}
            </button>
          </div>
        </section>
        <label className="ops-checkbox">
          <input
            type="checkbox"
            checked={clearFollowUpOnContact}
            onChange={(event) =>
              setClearFollowUpOnContact(event.target.checked)
            }
          />
          Clear next follow-up when marking contacted
        </label>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Overview</h2>
              <select
                value={b.pipeline_stage}
                onChange={(event) =>
                  void runDetailAction(async () => {
                    await patchBusiness({ pipelineStage: event.target.value });
                  })
                }
              >
                {pipelineStageOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <dl className="ops-definition-grid">
              <dt>Website</dt>
              <dd>
                {b.website_url ? (
                  <a href={b.website_url}>{b.website_url}</a>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Email</dt>
              <dd>
                {b.general_email ? (
                  <a href={`mailto:${b.general_email}`}>{b.general_email}</a>
                ) : (
                  "-"
                )}
              </dd>
              <dt>Phone</dt>
              <dd>{b.phone ?? "-"}</dd>
              <dt>Source</dt>
              <dd>{b.source ?? "-"}</dd>
              <dt>Business type</dt>
              <dd>{b.business_type ?? "-"}</dd>
              <dt>Location</dt>
              <dd>{b.location ?? "-"}</dd>
              <dt>Last contacted</dt>
              <dd>{formatDate(b.last_contacted_at)}</dd>
              <dt>Created</dt>
              <dd>{formatDateTime(b.created_at)}</dd>
              <dt>Updated</dt>
              <dd>{formatDateTime(b.updated_at)}</dd>
            </dl>
          </div>
          <div className="ops-panel">
            <h2>Contacts</h2>
            {detail.contacts.length === 0 ? (
              <div className="ops-empty-card">
                <strong>No contacts yet.</strong>
                <button
                  className="ops-button"
                  onClick={() => {
                    setEditingContactId(null);
                    setContactForm(emptyContactForm);
                    setContactFormOpen(true);
                  }}
                >
                  Add contact
                </button>
              </div>
            ) : (
              <div className="ops-list">
                {detail.contacts.map((contact) => (
                  <div key={contact.id} className="ops-list-card">
                    <strong>
                      {contactName(contact)}{" "}
                      {contact.is_primary ? "· Primary" : ""}
                      {contact.archived_at ? " · Archived" : ""}
                    </strong>
                    <span>{contact.job_title ?? ""}</span>
                    <span>
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      ) : (
                        ""
                      )}
                      {contact.email && contact.phone ? " · " : ""}
                      {contact.phone ?? ""}
                    </span>
                    {contact.preferred_channel && (
                      <small>
                        Preferred:{" "}
                        {communicationChannelLabel(contact.preferred_channel)}
                      </small>
                    )}
                    {contact.do_not_contact && (
                      <small className="ops-overdue">
                        Do not contact
                        {contact.do_not_contact_reason
                          ? `: ${contact.do_not_contact_reason}`
                          : ""}
                      </small>
                    )}
                    {contact.notes && <small>{contact.notes}</small>}
                    <div className="ops-inline-actions">
                      <button
                        className="ops-button"
                        onClick={() => openEditContact(contact)}
                      >
                        Edit
                      </button>
                      {!contact.is_primary && !contact.archived_at && (
                        <button
                          className="ops-button"
                          onClick={() =>
                            void runDetailAction(async () => {
                              const res = await apiFetch(
                                `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/contacts/${encodeURIComponent(
                                  contact.id,
                                )}/set-primary`,
                                { method: "POST" },
                              );
                              if (!res.ok)
                                throw new Error(
                                  "Failed to set primary contact",
                                );
                              await loadDetail();
                            })
                          }
                        >
                          Set primary
                        </button>
                      )}
                      <button
                        className="ops-button"
                        onClick={() =>
                          void runDetailAction(async () => {
                            const reason = contact.do_not_contact
                              ? ""
                              : window.prompt(
                                  "Reason for do-not-contact",
                                  contact.do_not_contact_reason ?? "",
                                );
                            if (reason === null) return;
                            const res = await apiFetch(
                              `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/contacts/${encodeURIComponent(
                                contact.id,
                              )}`,
                              {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  firstName: contact.first_name,
                                  lastName: contact.last_name,
                                  email: contact.email,
                                  phone: contact.phone,
                                  jobTitle: contact.job_title,
                                  notes: contact.notes,
                                  isPrimary: contact.is_primary,
                                  doNotContact: !contact.do_not_contact,
                                  doNotContactReason: contact.do_not_contact
                                    ? null
                                    : reason,
                                  preferredChannel: contact.preferred_channel,
                                }),
                              },
                            );
                            if (!res.ok) {
                              throw new Error(
                                await apiErrorMessage(
                                  res,
                                  "Failed to update contact preference",
                                ),
                              );
                            }
                            await loadDetail();
                          })
                        }
                      >
                        {contact.do_not_contact
                          ? "Allow contact"
                          : "Do not contact"}
                      </button>
                      <button
                        className="ops-button"
                        onClick={() =>
                          void runDetailAction(async () => {
                            if (contact.archived_at) {
                              await runContactLifecycle(contact, "restore");
                              return;
                            }
                            const allowNoPrimary =
                              contact.is_primary &&
                              window.confirm(
                                "Archive the primary contact and leave this business without a primary contact?",
                              );
                            if (contact.is_primary && !allowNoPrimary) return;
                            await runContactLifecycle(contact, "archive", {
                              allowNoPrimary,
                            });
                          })
                        }
                      >
                        {contact.archived_at ? "Restore" : "Archive"}
                      </button>
                      <button
                        className="ops-button"
                        onClick={() =>
                          window.confirm(
                            "Delete this unused contact? Referenced contacts must be archived instead.",
                          ) &&
                          void runDetailAction(async () => {
                            await runContactLifecycle(contact, "delete");
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Managed Services</h2>
            <button
              className="ops-button"
              onClick={() => openCreateService({ businessId: b.id })}
            >
              Create service
            </button>
          </div>
          {services.filter((service) => service.business_id === b.id).length ===
          0 ? (
            <div className="ops-empty-card">
              No managed services have been set up for this business yet.
            </div>
          ) : (
            <div className="ops-list">
              {services
                .filter((service) => service.business_id === b.id)
                .map((service) => (
                  <div key={service.id} className="ops-list-card">
                    <strong>
                      {service.service_number} · {service.name}
                    </strong>
                    <small>
                      {serviceStatusLabels[service.status]} ·{" "}
                      {formatMoney(
                        service.agreed_price_minor,
                        service.currency,
                      )}{" "}
                      · {service.covered_site_count ?? 0} sites
                    </small>
                    <small>
                      Next report {formatDateTime(service.next_report_at)} ·
                      review {formatDateTime(service.next_review_at)}
                    </small>
                    {renderLink(
                      `/operations/services/${service.id}`,
                      "Open service",
                      "ops-button ops-button--primary",
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Websites</h2>
              {renderLink(
                `/sites/new?operationsBusinessId=${encodeURIComponent(b.id)}`,
                "Add and monitor new site",
              )}
            </div>
            <form className="ops-inline-form" onSubmit={linkSite}>
              <select
                value={selectedSiteId}
                onChange={(event) => setSelectedSiteId(event.target.value)}
              >
                <option value="">Link existing site</option>
                {availableSites
                  .filter(
                    (site) =>
                      !detail.linkedSites.some(
                        (linked) => linked.site_id === site.id,
                      ),
                  )
                  .map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.site_display_name ?? site.url}
                    </option>
                  ))}
              </select>
              <button className="ops-button" disabled={!selectedSiteId}>
                Link site
              </button>
            </form>
            {detail.linkedSites.length === 0 ? (
              <div className="ops-empty-card">
                No monitored sites are linked yet.
              </div>
            ) : (
              <div className="ops-list">
                {detail.linkedSites.map((site) => (
                  <div key={site.site_id} className="ops-list-card">
                    <strong>{site.site_display_name ?? site.url}</strong>
                    <span>
                      {site.active_incident_id
                        ? "Currently down"
                        : "No active uptime incident"}{" "}
                      · Latest scan: {site.latest_scan_status ?? "none"}
                    </span>
                    <small>
                      {site.latest_scan_score == null
                        ? "No score"
                        : `Score ${site.latest_scan_score}`}{" "}
                      · {site.critical_issue_count} critical ·{" "}
                      {site.high_issue_count} high
                    </small>
                    <div className="ops-inline-actions">
                      {renderLink(
                        "/dashboard?selectSite=1",
                        "Monitoring",
                        "ops-button",
                      )}
                      {site.latest_scan_id &&
                        renderLink(
                          `/report?scanRunId=${site.latest_scan_id}`,
                          "Report",
                          "ops-button",
                        )}
                      <button
                        className="ops-button"
                        onClick={() =>
                          window.confirm(
                            "Unlink this site from the business? The site and scans will stay intact.",
                          ) &&
                          void runDetailAction(async () => {
                            const res = await apiFetch(
                              `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/sites/${encodeURIComponent(
                                site.site_id,
                              )}`,
                              { method: "DELETE" },
                            );
                            if (!res.ok)
                              throw new Error("Failed to unlink site");
                            await loadDetail();
                          })
                        }
                      >
                        Unlink
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Client reports</h2>
              <button
                className="ops-button"
                onClick={() => openCreateReport({ businessId: b.id })}
              >
                Create report
              </button>
            </div>
            {detail.reports.length === 0 ? (
              <div className="ops-empty-card">
                No Operations client reports for this business yet.
              </div>
            ) : (
              <div className="ops-list">
                {detail.reports.map((report) => (
                  <div key={report.id} className="ops-list-card">
                    <strong>{report.title}</strong>
                    <span>
                      {report.site_display_name ?? report.site_url} ·{" "}
                      {reportTypeLabel(report.report_type)}
                    </span>
                    <small>
                      {reportStatusLabel(report.status)} ·{" "}
                      {report.included_findings} included · sent{" "}
                      {formatDateTime(report.sent_at)}
                    </small>
                    <div className="ops-inline-actions">
                      {renderLink(
                        `/operations/reports/${report.id}`,
                        "Open report",
                        "ops-button ops-button--primary",
                      )}
                      {renderLink(
                        `/report?scanRunId=${report.scan_run_id}`,
                        "Technical report",
                        "ops-button",
                      )}
                      <button
                        className="ops-button"
                        onClick={() =>
                          openCommunicationForm({
                            businessId: b.id,
                            templateId:
                              communicationTemplates.find(
                                (template) =>
                                  template.category === "report_delivery" &&
                                  template.is_active,
                              )?.id ?? "",
                            subject: `Website health report - ${b.name}`,
                          })
                        }
                      >
                        Create delivery email
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Quotes</h2>
              <button
                className="ops-button"
                onClick={() => openCreateQuote({ businessId: b.id })}
              >
                Create quote
              </button>
            </div>
            {quotes.length === 0 ? (
              <div className="ops-empty-card">
                No quotes have been created for this business yet.
              </div>
            ) : (
              <div className="ops-list">
                {quotes.map((quote) => (
                  <div key={quote.id} className="ops-list-card">
                    <strong>
                      {quote.quote_number} · {quote.title}
                    </strong>
                    <small>
                      {quoteStatusLabel(quote.status)} ·{" "}
                      {formatMoney(quote.total_minor, quote.currency)}
                    </small>
                    <div className="ops-inline-actions">
                      {renderLink(
                        `/operations/quotes/${quote.id}`,
                        "Open quote",
                        "ops-button ops-button--primary",
                      )}
                      {quote.status === "accepted" && (
                        <button
                          className="ops-button"
                          onClick={() =>
                            onNavigate(`/operations/quotes/${quote.id}`)
                          }
                        >
                          Convert accepted quote
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <h2>Work</h2>
            {workOrders.length === 0 ? (
              <div className="ops-empty-card">
                No active work orders for this business yet.
              </div>
            ) : (
              <div className="ops-list">
                {workOrders.map((work) => (
                  <div key={work.id} className="ops-list-card">
                    <strong>
                      {work.work_order_number} · {work.title}
                    </strong>
                    <small>
                      {workStatusLabel(work.status)} ·{" "}
                      {work.completed_item_count ?? 0}/
                      {work.active_item_count ?? 0} items complete
                    </small>
                    {renderLink(
                      `/operations/work/${work.id}`,
                      "Open work",
                      "ops-button ops-button--primary",
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Communication timeline</h2>
            <button
              className="ops-button"
              onClick={() => void loadCommunications()}
            >
              Refresh
            </button>
          </div>
          {communicationsLoading ? (
            <div className="ops-empty-card">Loading communications...</div>
          ) : communications.length === 0 ? (
            <div className="ops-empty-card">
              No communications have been recorded for this business yet.
            </div>
          ) : (
            <div className="ops-timeline">
              {communications.map((item) => (
                <div key={item.id} className="ops-note">
                  <small>
                    {communicationLabel(item)} · {item.channel} ·{" "}
                    {formatDateTime(item.occurred_at)}
                    {communicationContactName(item)
                      ? ` · ${communicationContactName(item)}`
                      : ""}
                  </small>
                  <strong>{item.subject || "No subject"}</strong>
                  {findEditorPlaceholders(item.subject ?? "", item.body)
                    .length > 0 && (
                    <div className="ops-warning">
                      Stored content contains unresolved placeholders:{" "}
                      {findEditorPlaceholders(
                        item.subject ?? "",
                        item.body,
                      ).join(", ")}
                    </div>
                  )}
                  <details>
                    <summary>{communicationBodyPreview(item.body)}</summary>
                    <pre>{item.body}</pre>
                  </details>
                  {item.follow_up_at && (
                    <small>
                      Follow-up: {formatDateTime(item.follow_up_at)}
                      {item.follow_up_completed_at
                        ? ` · completed ${formatDateTime(
                            item.follow_up_completed_at,
                          )}`
                        : ""}
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="ops-panel">
          <h2>Internal notes</h2>
          <form className="ops-note-form" onSubmit={submitNote}>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              placeholder="Add an internal note"
            />
            <button
              className="ops-button ops-button--primary"
              disabled={!noteBody.trim()}
            >
              Add note
            </button>
          </form>
          {detail.notes.length === 0 ? (
            <div className="ops-empty-card">No notes yet.</div>
          ) : (
            <div className="ops-timeline">
              {detail.notes.map((note) => (
                <div key={note.id} className="ops-note">
                  <small>
                    {formatDateTime(note.created_at)} ·{" "}
                    {note.created_by_email ?? "Internal operator"}
                  </small>
                  <p>{note.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        {editBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Edit business</h2>
                <button
                  className="ops-button"
                  onClick={() => setEditBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("edit")}
            </div>
          </div>
        )}
        {contactFormOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>{editingContactId ? "Edit contact" : "Add contact"}</h2>
                <button
                  className="ops-button"
                  onClick={() => {
                    setContactFormOpen(false);
                    setEditingContactId(null);
                  }}
                >
                  Close
                </button>
              </div>
              <form className="ops-form" onSubmit={submitContact}>
                <div className="ops-form-grid">
                  {(
                    [
                      "firstName",
                      "lastName",
                      "email",
                      "phone",
                      "jobTitle",
                    ] as const
                  ).map((field) => (
                    <label key={field}>
                      {field === "firstName"
                        ? "First name"
                        : field === "lastName"
                          ? "Last name"
                          : field === "jobTitle"
                            ? "Job title"
                            : field[0].toUpperCase() + field.slice(1)}
                      <input
                        value={contactForm[field]}
                        type={field === "email" ? "email" : "text"}
                        onChange={(event) =>
                          setContactForm((prev) => ({
                            ...prev,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="ops-checkbox">
                  <input
                    type="checkbox"
                    checked={contactForm.isPrimary}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        isPrimary: event.target.checked,
                      }))
                    }
                  />
                  Primary contact
                </label>
                <label>
                  Preferred channel
                  <select
                    value={contactForm.preferredChannel}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        preferredChannel: event.target
                          .value as ContactFormState["preferredChannel"],
                      }))
                    }
                  >
                    <option value="">No preference</option>
                    {communicationChannelOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ops-checkbox">
                  <input
                    type="checkbox"
                    checked={contactForm.doNotContact}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        doNotContact: event.target.checked,
                      }))
                    }
                  />
                  Do not contact
                </label>
                {contactForm.doNotContact && (
                  <label>
                    Do-not-contact reason
                    <textarea
                      value={contactForm.doNotContactReason}
                      onChange={(event) =>
                        setContactForm((prev) => ({
                          ...prev,
                          doNotContactReason: event.target.value,
                        }))
                      }
                    />
                  </label>
                )}
                <label>
                  Notes
                  <textarea
                    value={contactForm.notes}
                    onChange={(event) =>
                      setContactForm((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="ops-form-actions">
                  <button className="ops-button ops-button--primary">
                    {editingContactId ? "Save contact" : "Add contact"}
                  </button>
                  <button
                    type="button"
                    className="ops-button"
                    onClick={() => {
                      setContactFormOpen(false);
                      setEditingContactId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {renderCommunicationModal()}
        {renderReportCreateModal()}
        {renderQuoteCreateModal()}
        {renderServiceCreateModal()}
      </>
    );
  }

  function renderPipeline() {
    return (
      <>
        <section className="ops-hero">
          <div>
            <div className="ops-eyebrow">Commercial flow</div>
            <h1>Pipeline</h1>
            <p>
              Businesses grouped by consultancy stage. Drag-and-drop is
              intentionally not included yet.
            </p>
          </div>
          <button
            className="ops-button ops-button--primary"
            onClick={() => setAddBusinessOpen(true)}
          >
            Add business
          </button>
        </section>
        <section className="ops-pipeline">
          {pipelineLoading && (
            <div className="ops-panel">Loading pipeline...</div>
          )}
          {pipelineStages.map((stage) => (
            <div className="ops-stage-column" key={stage.stage}>
              <div className="ops-stage-column__title">
                <strong>{stageLabel(stage.stage)}</strong>
                <span>{stage.businesses.length}</span>
              </div>
              {stage.businesses.length === 0 ? (
                <div className="ops-empty-card">No businesses</div>
              ) : (
                stage.businesses.map((business) => (
                  <div key={business.id} className="ops-pipeline-card">
                    <button
                      onClick={() =>
                        onNavigate(`/operations/businesses/${business.id}`)
                      }
                    >
                      <strong>{business.name}</strong>
                      <span>{contactName(business)}</span>
                      <small>{business.next_action ?? "No next action"}</small>
                      <small>
                        Follow-up: {formatDate(business.next_follow_up_at)}
                      </small>
                    </button>
                    <select
                      value={business.pipeline_stage}
                      onChange={(event) =>
                        void runDetailAction(async () => {
                          const res = await apiFetch(
                            `${apiBase}/operations/businesses/${encodeURIComponent(business.id)}`,
                            {
                              method: "PATCH",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({
                                pipelineStage: event.target.value,
                              }),
                            },
                          );
                          if (!res.ok)
                            throw new Error("Failed to change stage");
                          await loadPipeline();
                          await loadSummary();
                        })
                      }
                    >
                      {pipelineStageOptions.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          ))}
        </section>
        {addBusinessOpen && (
          <div className="ops-modal">
            <div className="ops-modal__panel">
              <div className="ops-panel__header">
                <h2>Add business</h2>
                <button
                  className="ops-button"
                  onClick={() => setAddBusinessOpen(false)}
                >
                  Close
                </button>
              </div>
              {renderBusinessForm("create")}
            </div>
          </div>
        )}
      </>
    );
  }

  function renderPlaceholder(
    route: Exclude<
      OperationsRouteKey,
      | "home"
      | "businesses"
      | "pipeline"
      | "reports"
      | "quotes"
      | "work"
      | "services"
      | "servicePlans"
    >,
  ) {
    const content = placeholderContent[route];
    return (
      <section className="ops-placeholder">
        <div>
          <div className="ops-eyebrow">{content.eyebrow}</div>
          <h1>{content.title}</h1>
          <p>{content.body}</p>
        </div>
        <div className="ops-empty-panel">
          <h2>No records yet</h2>
          <p>
            This page is ready for the future Operations workflow. It is empty
            because Scanlark does not have records for this area yet.
          </p>
          {renderLink(
            "/operations/businesses",
            content.action,
            "ops-button ops-button--primary",
          )}
        </div>
        <div className="ops-stage-grid">
          {content.bullets.map((item) => (
            <div key={item} className="ops-stage-card">
              {item}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className={`ops-page ${embedded ? "ops-page--embedded" : ""}`}>
      <style>{operationsStyles}</style>
      {!embedded && (
        <header className="ops-topbar">
          <div>
            <strong>Scanlark</strong>
            <span>Founder operations workspace</span>
          </div>
          <nav className="ops-global-nav" aria-label="Internal workspaces">
            {renderLink("/operations", "Operations")}
            {renderLink("/dashboard?selectSite=1", "Monitoring")}
            {renderLink("/admin", "System Admin")}
          </nav>
          <div className="ops-account">
            <span>{authEmail}</span>
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </header>
      )}
      <div className="ops-shell">
        <aside className="ops-sidebar">
          <div className="ops-sidebar__title">Operations</div>
          <nav aria-label="Operations sections">
            {routeItems.map((item) => (
              <React.Fragment key={item.key}>
                {renderLink(
                  item.href,
                  item.label,
                  activeRoute === item.key
                    ? "ops-side-link active"
                    : "ops-side-link",
                )}
              </React.Fragment>
            ))}
          </nav>
        </aside>
        <main className="ops-main">
          {activeRoute === "home"
            ? renderHome()
            : activeRoute === "businesses"
              ? businessId
                ? renderBusinessDetail()
                : renderBusinessesList()
              : activeRoute === "pipeline"
                ? renderPipeline()
                : activeRoute === "communications"
                  ? renderCommunicationsPage()
                  : activeRoute === "tasks"
                    ? renderTasksPage()
                    : activeRoute === "reports"
                      ? renderReportsPage()
                      : activeRoute === "quotes"
                        ? renderQuotesPage()
                        : activeRoute === "work"
                          ? renderWorkPage()
                          : activeRoute === "services"
                            ? renderServicesPage()
                            : activeRoute === "servicePlans"
                              ? renderServicePlansPage()
                              : renderPlaceholder(activeRoute)}
        </main>
      </div>
    </div>
  );
};

const operationsStyles = `
  .ops-page {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 16px;
  }
  .ops-page--embedded {
    min-height: auto;
    padding: 0;
  }
  .ops-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: grid;
    grid-template-columns: minmax(180px, 0.8fr) minmax(260px, 1.2fr) auto;
    gap: 16px;
    align-items: center;
    max-width: 1440px;
    margin: 0 auto 16px;
    padding: 12px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    box-shadow: var(--shadow);
  }
  .ops-topbar strong {
    display: block;
    font-family: var(--font-display);
    font-size: 18px;
  }
  .ops-topbar span,
  .ops-muted,
  .ops-meta-row,
  .ops-list-card span,
  .ops-list-card small,
  .ops-pipeline-card span,
  .ops-pipeline-card small {
    color: var(--text-muted);
    font-size: 12px;
  }
  .ops-global-nav,
  .ops-account,
  .ops-action-grid,
  .ops-form-actions,
  .ops-inline-actions,
  .ops-meta-row,
  .ops-segmented,
  .ops-inline-form {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .ops-account {
    justify-content: flex-end;
  }
  .ops-account button,
  .ops-link,
  .ops-button,
  .ops-segmented button {
    border: 1px solid var(--border);
    background: color-mix(in srgb, var(--panel-elev) 88%, transparent);
    color: var(--text);
    border-radius: 8px;
    min-height: 36px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }
  .ops-button--primary,
  .ops-segmented button.active {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-contrast);
  }
  .ops-button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }
  .ops-shell {
    max-width: 1440px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  .ops-page--embedded .ops-shell {
    max-width: none;
  }
  .ops-sidebar,
  .ops-panel,
  .ops-hero,
  .ops-placeholder,
  .ops-empty-panel,
  .ops-modal__panel {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    box-shadow: var(--shadow);
  }
  .ops-sidebar {
    position: sticky;
    top: 86px;
    display: grid;
    gap: 10px;
    padding: 12px;
  }
  .ops-sidebar__title,
  .ops-section-label {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ops-sidebar nav {
    display: grid;
    gap: 6px;
  }
  .ops-side-link {
    display: block;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 9px 10px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 700;
  }
  .ops-side-link.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    color: var(--text);
  }
  .ops-main,
  .ops-panel,
  .ops-placeholder,
  .ops-empty-panel,
  .ops-form,
  .ops-list,
  .ops-task-sections,
  .ops-task-section,
  .ops-timeline,
  .ops-work-grid,
  .ops-stage-grid {
    display: grid;
    gap: 14px;
    min-width: 0;
  }
  .ops-hero {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    padding: 22px;
  }
  .ops-hero h1,
  .ops-placeholder h1,
  .ops-panel h2,
  .ops-empty-panel h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .ops-hero h1 {
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1.05;
  }
  .ops-hero p,
  .ops-placeholder p,
  .ops-empty-panel p,
  .ops-empty-card p,
  .ops-note p {
    color: var(--text-muted);
    line-height: 1.6;
    margin: 8px 0 0;
  }
  .ops-badge,
  .ops-eyebrow {
    display: inline-flex;
    width: max-content;
    margin-bottom: 8px;
    color: var(--warning);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .ops-card-grid,
  .ops-two-column,
  .ops-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .ops-card-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ops-summary-card,
  .ops-empty-card,
  .ops-stage-card,
  .ops-list-item,
  .ops-activity,
  .ops-list-card,
  .ops-pipeline-card,
  .ops-note {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    color: var(--text);
    padding: 13px;
  }
  .ops-summary-card,
  .ops-list-item,
  .ops-activity {
    display: grid;
    gap: 8px;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  .ops-summary-card:hover,
  .ops-list-item:hover,
  .ops-activity:hover,
  .ops-table__row:hover {
    border-color: var(--accent);
  }
  .ops-summary-card span {
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .ops-summary-card strong {
    font-family: var(--font-display);
    font-size: 34px;
    line-height: 1;
  }
  .ops-panel {
    padding: 18px;
  }
  .ops-panel__header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }
  .ops-list-card,
  .ops-pipeline-card,
  .ops-note {
    display: grid;
    gap: 7px;
  }
  .ops-list-item.critical {
    border-color: color-mix(in srgb, var(--danger) 48%, var(--border));
  }
  .ops-list-item.warning {
    border-color: color-mix(in srgb, var(--warning) 48%, var(--border));
  }
  .ops-placeholder {
    padding: 22px;
  }
  .ops-empty-panel {
    padding: 18px;
    background: color-mix(in srgb, var(--panel-elev) 70%, transparent);
  }
  .ops-stage-grid {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }
  .ops-error {
    border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--danger) 12%, transparent);
    color: var(--danger);
    padding: 12px;
    font-size: 13px;
  }
  .ops-warning {
    border: 1px solid color-mix(in srgb, var(--warning) 48%, var(--border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    color: var(--warning);
    padding: 12px;
    font-size: 13px;
  }
  .ops-filterbar {
    display: grid;
    grid-template-columns: minmax(220px, 1fr) 180px;
    gap: 10px;
  }
  .ops-communications-workspace {
    display: grid;
    grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }
  .ops-communications-list-pane,
  .ops-communication-detail-pane {
    align-self: start;
  }
  .ops-communications-toolbar,
  .ops-templates-toolbar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    align-items: end;
  }
  .ops-communications-toolbar label,
  .ops-templates-toolbar label {
    display: grid;
    gap: 6px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }
  .ops-communications-list {
    display: grid;
    gap: 10px;
  }
  .ops-activity.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--panel-elev));
  }
  .ops-communication-reader,
  .ops-template-editor,
  .ops-send-confirmation {
    display: grid;
    gap: 10px;
  }
  .ops-communication-reader {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    padding: 14px;
  }
  .ops-communication-reader pre,
  .ops-preview pre,
  .ops-note pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.6;
    color: var(--text);
    margin: 0;
    font-family: inherit;
  }
  .ops-communication-body {
    min-height: 240px;
    line-height: 1.6;
  }
  .ops-email-preview {
    width: 100%;
    height: 520px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #f4f7fb;
  }
  .ops-email-preview--narrow {
    max-width: 390px;
    justify-self: center;
  }
  .ops-checkbox-row {
    display: flex;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    min-height: 32px;
  }
  .ops-checkbox-row input {
    min-height: auto;
  }
  .ops-template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 12px;
  }
  .ops-send-confirmation {
    flex-basis: 100%;
    border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border));
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    padding: 12px;
  }
  .ops-form label,
  .ops-filterbar,
  .ops-note-form {
    display: grid;
    gap: 6px;
  }
  .ops-form input,
  .ops-form select,
  .ops-form textarea,
  .ops-filterbar input,
  .ops-filterbar select,
  .ops-inline-form select,
  .ops-panel input,
  .ops-panel select,
  .ops-panel textarea,
  .ops-note-form textarea {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-elev);
    color: var(--text);
    min-height: 38px;
    padding: 8px 10px;
  }
  .ops-form textarea,
  .ops-panel textarea,
  .ops-note-form textarea {
    min-height: 92px;
    resize: vertical;
  }
  .ops-panel input[type="checkbox"],
  .ops-form input[type="checkbox"] {
    min-height: auto;
    width: auto;
    padding: 0;
  }
  .ops-table {
    display: grid;
    gap: 8px;
    overflow-x: auto;
  }
  .ops-table__head,
  .ops-table__row {
    display: grid;
    grid-template-columns: 1.3fr 1fr 0.9fr 1fr 1fr 0.8fr;
    gap: 10px;
    min-width: 920px;
    align-items: start;
  }
  .ops-table__head {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .ops-table__row {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    color: var(--text);
    padding: 12px;
    text-align: left;
    cursor: pointer;
  }
  .ops-table__row span {
    display: grid;
    gap: 4px;
  }
  .ops-table__row small {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .ops-overdue {
    color: var(--warning);
  }
  .ops-definition-grid {
    display: grid;
    grid-template-columns: 140px minmax(0, 1fr);
    gap: 10px;
    margin: 0;
  }
  .ops-definition-grid dt {
    color: var(--text-muted);
    font-weight: 700;
  }
  .ops-definition-grid dd {
    margin: 0;
    overflow-wrap: anywhere;
  }
  .ops-checkbox {
    display: flex;
    gap: 8px;
    align-items: center;
    color: var(--text-muted);
    font-size: 13px;
  }
  .ops-modal {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(0, 0, 0, 0.58);
    overflow: hidden;
  }
  .ops-modal__panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(760px, 100%);
    max-height: calc(100vh - 36px);
    overflow: hidden;
    padding: 18px;
  }
  .ops-modal__panel > .ops-form {
    min-height: 0;
    overflow: auto;
    padding-right: 4px;
  }
  .ops-modal__panel > .ops-panel__header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--panel);
    padding-bottom: 10px;
  }
  .ops-modal__panel .ops-form-actions {
    position: sticky;
    bottom: 0;
    background: var(--panel);
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .ops-modal__panel--wide {
    width: min(1120px, 100%);
  }
  .ops-composer {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
    gap: 16px;
    align-items: start;
  }
  .ops-preview {
    display: grid;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel-elev) 72%, transparent);
    padding: 14px;
    position: sticky;
    top: 0;
  }
  .ops-preview p {
    white-space: pre-wrap;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 0;
  }
  .ops-pipeline {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
  }
  .ops-stage-column {
    display: grid;
    gap: 10px;
    align-content: start;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--panel);
    padding: 12px;
  }
  .ops-stage-column__title {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--text);
  }
  .ops-pipeline-card button {
    display: grid;
    gap: 5px;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--text);
    padding: 0;
    text-align: left;
    cursor: pointer;
  }
  .ops-note p {
    white-space: pre-wrap;
  }
  .ops-client-report {
    display: grid;
    gap: 24px;
    max-width: 820px;
    margin: 0 auto;
    border: 1px solid #d5dbe6;
    border-radius: 8px;
    background: #ffffff;
    color: #162033;
    padding: 44px;
    box-shadow: 0 22px 60px rgba(0, 0, 0, 0.22);
  }
  .ops-client-report h1,
  .ops-client-report h2,
  .ops-client-report p,
  .ops-client-report small,
  .ops-client-report li,
  .ops-client-report span,
  .ops-client-report strong {
    color: inherit;
  }
  .ops-client-report h1,
  .ops-client-report h2 {
    margin: 0;
    font-family: var(--font-display);
  }
  .ops-client-report p,
  .ops-client-report li {
    line-height: 1.65;
    overflow-wrap: anywhere;
  }
  .ops-client-report .ops-empty-card,
  .ops-client-report .ops-list-card {
    border-color: #d5dbe6;
    background: #f7f9fc;
    color: #162033;
    box-shadow: none;
  }
  .ops-client-cover {
    display: grid;
    gap: 10px;
    border-bottom: 2px solid #162033;
    padding-bottom: 28px;
  }
  .ops-client-brand {
    color: #53627a;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0;
  }
  .ops-client-cover h2 {
    border: 0;
    color: #53627a;
    font-size: 18px;
    font-weight: 650;
  }
  .ops-client-cover small {
    display: block;
    overflow-wrap: anywhere;
  }
  .ops-report-workspace {
    display: grid;
    gap: 14px;
    min-width: 0;
  }
  .ops-report-header {
    position: sticky;
    top: 82px;
    z-index: 15;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: color-mix(in srgb, var(--panel) 96%, transparent);
    box-shadow: var(--shadow);
    padding: 14px;
  }
  .ops-report-header h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1.12;
  }
  .ops-report-header p {
    margin: 5px 0;
    color: var(--text-muted);
  }
  .ops-report-tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .ops-report-tabs button {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--text-muted);
    min-height: 36px;
    padding: 8px 11px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .ops-report-tabs button.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    color: var(--text);
  }
  .ops-readiness-list {
    display: grid;
    gap: 6px;
  }
  .ops-readiness-list details {
    border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
    border-radius: 8px;
    padding: 8px 10px;
    background: color-mix(in srgb, var(--panel) 65%, transparent);
  }
  .ops-readiness-list summary {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    font-weight: 800;
  }
  .ops-readiness-list button {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 3px 0;
    text-align: left;
    cursor: pointer;
  }
  .ops-readiness-list strong {
    color: var(--text);
    white-space: nowrap;
  }
  .ops-readiness-summary {
    display: grid;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    padding: 10px;
  }
  .ops-readiness-summary__header,
  .ops-readiness-summary summary,
  .ops-readiness-summary__body,
  .ops-readiness-summary__examples button {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }
  .ops-readiness-summary__header span,
  .ops-readiness-summary summary span {
    color: var(--text-muted);
    font-size: 12px;
  }
  .ops-readiness-summary details {
    border-top: 1px solid var(--border);
    padding-top: 8px;
  }
  .ops-readiness-summary summary {
    cursor: pointer;
    font-weight: 800;
  }
  .ops-readiness-summary__body {
    padding: 8px 0;
  }
  .ops-readiness-summary__body p {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
  }
  .ops-readiness-summary__examples {
    display: grid;
    gap: 4px;
  }
  .ops-readiness-summary__examples button {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    padding: 4px 0;
    text-align: left;
    cursor: pointer;
  }
  .ops-regroup-preview {
    display: grid;
    gap: 12px;
    margin-top: 12px;
  }
  .ops-table-wrap {
    overflow-x: auto;
  }
  .ops-evidence-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 12px;
  }
  .ops-evidence-table th,
  .ops-evidence-table td {
    border: 1px solid var(--border);
    padding: 8px;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .ops-evidence-table th {
    color: var(--text-muted);
    background: color-mix(in srgb, var(--panel-strong) 70%, transparent);
  }
  .ops-report-findings-layout {
    display: grid;
    grid-template-columns: minmax(300px, 0.38fr) minmax(0, 0.62fr);
    gap: 14px;
    align-items: start;
    min-width: 0;
  }
  .ops-report-filterbar {
    grid-template-columns: minmax(180px, 1fr) minmax(150px, 0.45fr) minmax(150px, 0.45fr);
  }
  .ops-report-review-queue {
    align-self: start;
    min-width: 0;
  }
  .ops-report-progress {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin: 8px 0 12px;
  }
  .ops-report-progress div {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel-elev) 72%, transparent);
    padding: 8px;
    display: grid;
    gap: 2px;
  }
  .ops-report-progress strong {
    font-size: 18px;
  }
  .ops-report-progress small,
  .ops-report-bulkbar span {
    color: var(--text-muted);
    font-size: 11px;
  }
  .ops-report-bulkbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 10px 0;
  }
  .ops-report-findings-list {
    display: grid;
    gap: 8px;
    max-height: 720px;
    overflow: auto;
    padding-right: 4px;
  }
  .ops-report-finding-row {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) repeat(4, minmax(62px, 0.35fr)) minmax(110px, 0.55fr);
    gap: 10px;
    align-items: start;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel-elev) 76%, transparent);
    color: var(--text);
    padding: 10px;
    text-align: left;
    cursor: pointer;
    min-width: 0;
  }
  .ops-report-finding-row:focus-visible,
  .ops-report-editor-toolbar button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .ops-report-finding-row.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, var(--panel-elev));
  }
  .ops-report-finding-row span {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .ops-report-finding-row small {
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .ops-status-pill,
  .ops-save-state {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 2px 7px;
    width: fit-content;
    font-weight: 800;
  }
  .ops-report-finding-row.state-needs-review .ops-status-pill,
  .ops-save-state.state-unsaved {
    border-color: color-mix(in srgb, var(--warning) 70%, var(--border));
    color: var(--warning);
  }
  .ops-report-finding-row.state-ready .ops-status-pill,
  .ops-save-state.state-saved {
    border-color: color-mix(in srgb, var(--success) 70%, var(--border));
    color: var(--success);
  }
  .ops-report-finding-row.state-excluded .ops-status-pill,
  .ops-report-finding-row.state-false-positive .ops-status-pill {
    color: var(--text-muted);
  }
  .ops-report-finding-editor {
    position: sticky;
    top: 178px;
    max-height: calc(100vh - 196px);
    overflow-y: auto;
    overflow-x: hidden;
    min-width: 0;
    width: 100%;
  }
  .ops-report-editor-toolbar {
    position: sticky;
    top: 0;
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    backdrop-filter: blur(8px);
    padding: 8px;
    margin-bottom: 12px;
    max-width: 100%;
  }
  .ops-report-editor-toolbar .ops-button {
    white-space: normal;
  }
  .ops-report-back {
    display: none;
  }
  .ops-report-finding-editor section {
    display: grid;
    gap: 10px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
    min-width: 0;
  }
  .ops-report-collapsible {
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .ops-report-collapsible summary {
    cursor: pointer;
    font-weight: 800;
    margin-bottom: 10px;
  }
  .ops-report-example-list {
    display: grid;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px;
    background: color-mix(in srgb, var(--panel-elev) 62%, transparent);
  }
  .ops-report-example-list div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }
  .ops-report-example-list span {
    overflow-wrap: anywhere;
    color: var(--text-muted);
    font-size: 12px;
  }
  .ops-report-finding-editor input,
  .ops-report-finding-editor textarea,
  .ops-report-finding-editor select {
    min-width: 0;
    max-width: 100%;
  }
  .ops-report-preview {
    display: grid;
    justify-items: center;
    gap: 12px;
    overflow-x: auto;
  }
  .ops-report-preview--a4 .ops-client-report {
    width: min(794px, 100%);
    min-height: 1123px;
  }
  .ops-report-preview--desktop .ops-client-report {
    width: 100%;
    max-width: none;
  }
  @media (max-width: 980px) {
    .ops-topbar,
	    .ops-shell,
	    .ops-two-column,
	    .ops-filterbar,
	    .ops-composer,
	    .ops-communications-workspace,
	    .ops-report-header,
	    .ops-report-findings-layout {
	      grid-template-columns: 1fr;
	    }
    .ops-report-header {
      position: static;
      max-height: none;
    }
    .ops-report-findings-layout .ops-report-finding-editor {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 100;
      max-height: none;
      overflow: auto;
      border-radius: 0;
      padding: 14px;
    }
    .ops-report-findings-layout.detail-open .ops-report-review-queue {
      display: none;
    }
    .ops-report-findings-layout.detail-open .ops-report-finding-editor {
      display: block;
    }
    .ops-report-back {
      display: inline-flex;
    }
    .ops-report-finding-row {
      grid-template-columns: 24px minmax(0, 1fr);
    }
    .ops-report-finding-row > small {
      grid-column: 2;
    }
    .ops-sidebar {
      position: static;
    }
    .ops-sidebar nav {
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    }
    .ops-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 640px) {
    .ops-page {
      padding: 10px;
    }
	    .ops-card-grid,
	    .ops-form-grid,
	    .ops-communications-toolbar,
	    .ops-templates-toolbar,
	    .ops-template-grid {
	      grid-template-columns: 1fr;
	    }
    .ops-hero,
    .ops-panel__header {
      display: grid;
    }
    .ops-account {
      justify-content: flex-start;
    }
  }
  @media print {
    .ops-topbar,
    .ops-sidebar,
    .ops-hero,
    .ops-panel__header,
    .ops-button,
    .ops-error,
    .ops-warning {
      display: none !important;
    }
    .ops-page,
    .ops-shell,
    .ops-main,
    .ops-panel {
      display: block;
      max-width: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: #ffffff;
      box-shadow: none;
    }
    .ops-panel:not(:has(.ops-client-report)) {
      display: none !important;
    }
    .ops-client-report {
      max-width: none;
      min-height: auto;
      margin: 0;
      border: 0;
      border-radius: 0;
      padding: 0;
      box-shadow: none;
    }
    .ops-client-report section,
    .ops-client-report article {
      break-inside: avoid;
    }
  }
`;
