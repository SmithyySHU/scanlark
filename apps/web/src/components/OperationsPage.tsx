import React, { useCallback, useEffect, useMemo, useState } from "react";

type OperationsRouteKey =
  | "home"
  | "businesses"
  | "pipeline"
  | "tasks"
  | "communications"
  | "reports"
  | "quotes";

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
    openWorkItems: number;
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
  default_follow_up_business_days: number | null;
  is_active: boolean;
  is_system_default: boolean;
  created_at: string;
  updated_at: string;
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
  evidence_json: Record<string, unknown>;
  is_included: boolean;
  is_false_positive: boolean;
  internal_note: string | null;
  display_order: number;
  estimated_effort: string | null;
  comparison_status: OperationsComparisonStatus | null;
  updated_at: string;
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
  comparisonItems: OperationsReportComparisonItem[];
  activity: OperationsReportActivity[];
};

type ClientReportPayload = {
  report: {
    title: string;
    versionNumber: number;
    preparedFor: string | null;
    preparedBy: string | null;
    coverDate: string;
  };
  business: { name: string };
  site: { url: string; displayName: string | null; domain: string };
  summaries: {
    executiveSummary: string | null;
    overallSummary: string | null;
    mainStrengths: string | null;
    mainConcerns: string | null;
    recommendedFirstSteps: string | null;
    scopeLimitations: string | null;
  };
  priorityCounts: Record<OperationsReportPriority, number>;
  findings: Array<{
    id: string;
    priority: OperationsReportPriority;
    title: string;
    affectedUrl: string | null;
    whatWasFound: string | null;
    whyItMatters: string | null;
    recommendedAction: string | null;
    evidence: Record<string, unknown>;
    estimatedEffort: string | null;
    comparisonStatus: OperationsComparisonStatus | null;
  }>;
  positiveObservations: string[];
  methodology: string[];
  nextSteps: string[];
  comparison: Array<{
    id: string;
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
  body: string;
  followUpAt: string;
  taskTitle: string;
  taskNotes: string;
  unresolvedPlaceholders: string[];
};

type TemplateFormState = {
  name: string;
  category: CommunicationTemplateCategory;
  subjectTemplate: string;
  bodyTemplate: string;
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
  { value: "custom", label: "Custom" },
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
];

const placeholderContent: Record<
  Exclude<OperationsRouteKey, "home" | "businesses" | "pipeline">,
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
  reports: {
    eyebrow: "Report workflow",
    title: "Reports",
    body: "Track the commercial lifecycle around client reports without duplicating the existing report renderer.",
    action: "Review monitoring reports",
    bullets: [
      "Draft",
      "Needs review",
      "Ready to send",
      "Sent",
      "Client replied",
      "Fixes quoted",
      "Completed",
    ],
  },
  quotes: {
    eyebrow: "Commercial work",
    title: "Quotes",
    body: "Manage draft quotes, sent quotes, accepted work, and declined or expired opportunities.",
    action: "Open businesses",
    bullets: [
      "Draft quotes",
      "Sent quotes",
      "Accepted work",
      "Declined or expired quotes",
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
    openWorkItems: 0,
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
  body: "",
  followUpAt: "",
  taskTitle: "",
  taskNotes: "",
  unresolvedPlaceholders: [],
};

const emptyTemplateForm: TemplateFormState = {
  name: "",
  category: "custom",
  subjectTemplate: "",
  bodyTemplate: "",
  defaultFollowUpBusinessDays: "",
  isActive: true,
};

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

function sanitizeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function reportFilename(payload: ClientReportPayload) {
  const business = sanitizeFilenamePart(payload.business.name) || "business";
  const domain = sanitizeFilenamePart(payload.site.domain) || "website";
  return `scanlark-website-health-report-${business}-${domain}-${payload.report.coverDate}.pdf`;
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
}) => {
  const activeRoute = getRouteKey(currentPath);
  const businessId = getBusinessIdFromPath(currentPath);
  const operationsReportId = getOperationsReportIdFromPath(currentPath);
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
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [communicationsLoading, setCommunicationsLoading] = useState(false);
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
  const [reportReadinessIssues, setReportReadinessIssues] = useState<string[]>(
    [],
  );
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
      };
      setCommunicationTemplates(data.templates);
    } catch (err) {
      console.warn("Failed to load communication templates", err);
      setCommunicationTemplates([]);
    }
  }, [apiBase, apiFetch]);

  const loadCommunications = useCallback(async () => {
    setCommunicationsLoading(true);
    try {
      const url = businessId
        ? `${apiBase}/operations/businesses/${encodeURIComponent(businessId)}/communications?limit=50`
        : `${apiBase}/operations/communications?limit=50`;
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
  }, [apiBase, apiFetch, businessId]);

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
        readinessIssues: string[];
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

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (
      (activeRoute === "businesses" && !businessId) ||
      activeRoute === "communications" ||
      (activeRoute === "reports" && !operationsReportId)
    ) {
      void loadBusinesses();
    }
  }, [activeRoute, businessId, loadBusinesses, operationsReportId]);

  useEffect(() => {
    if (businessId) {
      void loadDetail();
      void loadAvailableSites();
      void loadCommunicationTemplates();
      void loadCommunications();
    }
  }, [
    businessId,
    loadAvailableSites,
    loadCommunicationTemplates,
    loadCommunications,
    loadDetail,
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
    if (activeRoute === "reports" && !operationsReportId) {
      void loadReports();
    }
  }, [activeRoute, loadReports, operationsReportId]);

  useEffect(() => {
    if (operationsReportId) {
      void loadReportDetail();
      void loadReportPreview();
    }
  }, [loadReportDetail, loadReportPreview, operationsReportId]);

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
        label: "Quotes awaiting response",
        value: summary.counts.quotesAwaitingResponse,
        detail: "Sent quotes waiting on a client decision.",
        href: "/operations/quotes",
      },
      {
        label: "Open work items",
        value: summary.counts.openWorkItems,
        detail: "Active work that has not been closed.",
        href: "/operations/tasks",
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
    setCommunicationForm({
      ...emptyCommunicationForm,
      businessId: selectedBusinessId,
      contactId: overrides.contactId ?? detail?.primaryContact?.id ?? "",
      templateId:
        overrides.templateId ??
        communicationTemplates.find((template) => template.is_active)?.id ??
        "",
      direction: overrides.direction ?? "outbound",
      channel: overrides.channel ?? "email",
      status: overrides.status ?? "draft",
      subject: overrides.subject ?? "",
      body: overrides.body ?? "",
      followUpAt: overrides.followUpAt ?? "",
      taskTitle: overrides.taskTitle ?? "",
      taskNotes: overrides.taskNotes ?? "",
      unresolvedPlaceholders: [],
    });
    setCommunicationFormOpen(true);
  }

  function communicationRecipientEmail() {
    if (detail?.business.id === communicationForm.businessId) {
      const contact = detail.contacts.find(
        (item) => item.id === communicationForm.contactId,
      );
      return (
        contact?.email ??
        detail.primaryContact?.email ??
        detail.business.general_email ??
        ""
      );
    }
    const business = businesses.find(
      (item) => item.id === communicationForm.businessId,
    );
    return business?.primary_contact_email ?? business?.general_email ?? "";
  }

  function selectedCommunicationContact() {
    if (detail?.business.id !== communicationForm.businessId) return null;
    return (
      detail.contacts.find((item) => item.id === communicationForm.contactId) ??
      detail.primaryContact
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
    if (!res.ok) throw new Error("Failed to update finding");
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
          readinessIssues?: string[];
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

  async function generateReportPdf() {
    await runReportAction("generate-pdf");
    window.setTimeout(() => window.print(), 50);
  }

  async function generateDraft() {
    if (!communicationForm.businessId || !communicationForm.templateId) return;
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(
          communicationForm.businessId,
        )}/communications/draft`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            templateId: communicationForm.templateId,
            contactId: communicationForm.contactId || null,
            followUpAt: localDateTimeToIso(communicationForm.followUpAt),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to render draft");
      const data = (await res.json()) as {
        draft: {
          subject: string;
          body: string;
          unresolvedPlaceholders: string[];
          suggestedFollowUpAt?: string | null;
          contactWarning?: {
            doNotContact: boolean;
            reason: string | null;
            preferredChannel: CommunicationChannel | null;
          } | null;
        };
      };
      setCommunicationForm((prev) => ({
        ...prev,
        subject: data.draft.subject,
        body: data.draft.body,
        followUpAt:
          prev.followUpAt ||
          toDateTimeLocalValue(data.draft.suggestedFollowUpAt ?? null),
        unresolvedPlaceholders: data.draft.unresolvedPlaceholders,
      }));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to render draft",
      );
    }
  }

  async function saveCommunication(status: CommunicationStatus) {
    if (!communicationForm.businessId || !communicationForm.body.trim()) return;
    if (status === "sent" && !confirmDoNotContactOverride("mark this sent")) {
      return;
    }
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/businesses/${encodeURIComponent(
          communicationForm.businessId,
        )}/communications`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contactId: communicationForm.contactId || null,
            templateId: communicationForm.templateId || null,
            direction: communicationForm.direction,
            channel: communicationForm.channel,
            status,
            subject: communicationForm.subject,
            body: communicationForm.body,
            followUpAt: localDateTimeToIso(communicationForm.followUpAt),
            taskTitle: communicationForm.taskTitle,
            taskNotes: communicationForm.taskNotes,
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
      await Promise.all([loadCommunications(), loadSummary(), loadTasks()]);
      if (businessId) await loadDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save communication",
      );
    }
  }

  async function copyCommunication() {
    const text = `Subject: ${communicationForm.subject}\n\n${communicationForm.body}`;
    await navigator.clipboard.writeText(text);
  }

  function openEmailClient() {
    if (!confirmDoNotContactOverride("open the email client")) return;
    const to = communicationRecipientEmail();
    const params = new URLSearchParams({
      subject: communicationForm.subject,
      body: communicationForm.body,
    });
    window.location.href = `mailto:${encodeURIComponent(to)}?${params.toString()}`;
  }

  async function submitTemplate(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      const res = await apiFetch(
        `${apiBase}/operations/communication-templates`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...templateForm,
            defaultFollowUpBusinessDays:
              templateForm.defaultFollowUpBusinessDays.trim() === ""
                ? null
                : Number.parseInt(templateForm.defaultFollowUpBusinessDays, 10),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to create template");
      setTemplateForm(emptyTemplateForm);
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
    const contactOptions =
      detail?.business.id === communicationForm.businessId
        ? detail.contacts
        : [];
    const selectedContact = selectedCommunicationContact();
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
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        businessId: event.target.value,
                        contactId: "",
                      }))
                    }
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
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        contactId: event.target.value,
                      }))
                    }
                  >
                    <option value="">No contact selected</option>
                    {contactOptions.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contactName(contact)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Template
                  <select
                    value={communicationForm.templateId}
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        templateId: event.target.value,
                      }))
                    }
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
                    onChange={(event) =>
                      setCommunicationForm((prev) => ({
                        ...prev,
                        followUpAt: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                Subject
                <input
                  value={communicationForm.subject}
                  onChange={(event) =>
                    setCommunicationForm((prev) => ({
                      ...prev,
                      subject: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Body
                <textarea
                  value={communicationForm.body}
                  onChange={(event) =>
                    setCommunicationForm((prev) => ({
                      ...prev,
                      body: event.target.value,
                    }))
                  }
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
                  Unresolved placeholders:{" "}
                  {communicationForm.unresolvedPlaceholders.join(", ")}
                </div>
              )}
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
                  onClick={() => void copyCommunication()}
                  disabled={!communicationForm.body.trim()}
                >
                  Copy email
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
                  onClick={() => void saveCommunication("draft")}
                  disabled={!communicationForm.body.trim()}
                >
                  Save draft
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
              <div className="ops-section-label">Preview</div>
              <strong>{communicationForm.subject || "No subject"}</strong>
              <p>{communicationForm.body || "Generate or write a draft."}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCommunicationsPage() {
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
          <button
            className="ops-button ops-button--primary"
            onClick={() => openCommunicationForm()}
          >
            Draft communication
          </button>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        <section className="ops-two-column">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Recent communications</h2>
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
                No client communications have been recorded yet.
              </div>
            ) : (
              <div className="ops-timeline">
                {communications.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="ops-activity"
                    onClick={() =>
                      onNavigate(`/operations/businesses/${item.business_id}`)
                    }
                  >
                    <strong>
                      {communicationLabel(item)} ·{" "}
                      {item.subject || item.business_name || "Communication"}
                    </strong>
                    <span>
                      {item.business_name ?? "Business"}{" "}
                      {communicationContactName(item)
                        ? `· ${communicationContactName(item)}`
                        : ""}
                    </span>
                    <small>{formatDateTime(item.occurred_at)}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Client communication templates</h2>
              <span className="ops-muted">
                {communicationTemplates.length} templates
              </span>
            </div>
            <div className="ops-list">
              {communicationTemplates.map((template) => (
                <div key={template.id} className="ops-list-card">
                  <strong>
                    {template.name}{" "}
                    {template.is_system_default ? "· Default" : ""}
                  </strong>
                  <span>{templateCategoryLabel(template.category)}</span>
                  <small>
                    {template.is_active ? "Active" : "Inactive"} · Updated{" "}
                    {formatDateTime(template.updated_at)}
                  </small>
                  {template.default_follow_up_business_days != null && (
                    <small>
                      Default follow-up:{" "}
                      {template.default_follow_up_business_days} business days
                    </small>
                  )}
                  <div className="ops-inline-actions">
                    <button
                      className="ops-button"
                      onClick={() => void toggleTemplate(template)}
                    >
                      {template.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <form className="ops-form" onSubmit={submitTemplate}>
              <div className="ops-section-label">Add custom template</div>
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
                Body template
                <textarea
                  value={templateForm.bodyTemplate}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      bodyTemplate: event.target.value,
                    }))
                  }
                />
              </label>
              <button
                className="ops-button ops-button--primary"
                disabled={
                  !templateForm.name.trim() ||
                  !templateForm.subjectTemplate.trim() ||
                  !templateForm.bodyTemplate.trim()
                }
              >
                Add template
              </button>
            </form>
          </div>
        </section>
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
    const contacts = selectedBusiness?.contacts ?? [];
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
                    {report.critical_findings ?? 0} critical ·{" "}
                    {report.important_findings ?? 0} important
                  </small>
                  <div className="ops-inline-actions">
                    {renderLink(
                      `/operations/reports/${report.id}`,
                      "Continue review",
                      "ops-button ops-button--primary",
                    )}
                    {renderLink(
                      `/report?scanRunId=${report.scan_run_id}`,
                      "Technical report",
                      "ops-button",
                    )}
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
                <article key={finding.id} className="ops-list-card">
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
              <li key={item}>{item}</li>
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
    if (reportDetailLoading) {
      return <section className="ops-panel">Loading report...</section>;
    }
    if (!reportDetail) {
      return <section className="ops-panel">Report not found.</section>;
    }
    const report = reportDetail.report;
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
          </div>
        </section>
        {actionError && <div className="ops-error">{actionError}</div>}
        {reportReadinessIssues.length > 0 && (
          <section className="ops-warning">
            {reportReadinessIssues.map((issue) => (
              <div key={issue}>{issue}</div>
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
              {reportDetail.findings.length} candidate findings
            </span>
          </div>
          <div className="ops-list">
            {reportDetail.findings.map((finding) => (
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
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Client preview</h2>
            {reportPreview && (
              <span className="ops-muted">{reportFilename(reportPreview)}</span>
            )}
          </div>
          {renderClientReportPreview()}
        </section>
        {reportDetail.comparisonItems.length > 0 && (
          <section className="ops-panel">
            <h2>Re-test comparison</h2>
            <div className="ops-list">
              {reportDetail.comparisonItems.map((item) => (
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
            {reportDetail.activity.map((item) => (
              <div key={item.id} className="ops-note">
                <small>
                  {formatDateTime(item.created_at)} · {item.admin_email}
                </small>
                <p>{item.action}</p>
              </div>
            ))}
          </div>
        </section>
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
                <button
                  type="button"
                  className="ops-table__row"
                  key={business.id}
                  onClick={() =>
                    onNavigate(`/operations/businesses/${business.id}`)
                  }
                >
                  <span>
                    <strong>{business.name}</strong>
                    <small>
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
                  <span>{formatDateTime(business.updated_at)}</span>
                </button>
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
              <div className="ops-empty-card">No contacts yet.</div>
            ) : (
              <div className="ops-list">
                {detail.contacts.map((contact) => (
                  <div key={contact.id} className="ops-list-card">
                    <strong>
                      {contactName(contact)}{" "}
                      {contact.is_primary ? "· Primary" : ""}
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
                      {!contact.is_primary && (
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
                          window.confirm("Remove this contact?") &&
                          void runDetailAction(async () => {
                            const res = await apiFetch(
                              `${apiBase}/operations/businesses/${encodeURIComponent(b.id)}/contacts/${encodeURIComponent(
                                contact.id,
                              )}`,
                              { method: "DELETE" },
                            );
                            if (!res.ok)
                              throw new Error("Failed to remove contact");
                            await loadDetail();
                          })
                        }
                      >
                        Remove
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
              <h2>Websites</h2>
              {renderLink("/sites/new", "Add and monitor new site")}
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
                  <p>{item.body}</p>
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
    route: Exclude<OperationsRouteKey, "home" | "businesses" | "pipeline">,
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
            route === "reports"
              ? "/dashboard/reports"
              : "/operations/businesses",
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
    <div className="ops-page">
      <style>{operationsStyles}</style>
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
      <div className="ops-shell">
        <aside className="ops-sidebar">
          <div className="ops-sidebar__title">Operations</div>
          <nav aria-label="Operations sections">
            {routeItems.map((item) =>
              renderLink(
                item.href,
                item.label,
                activeRoute === item.key
                  ? "ops-side-link active"
                  : "ops-side-link",
              ),
            )}
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
  .ops-panel select,
  .ops-note-form textarea {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel-elev);
    color: var(--text);
    min-height: 38px;
    padding: 8px 10px;
  }
  .ops-form textarea,
  .ops-note-form textarea {
    min-height: 92px;
    resize: vertical;
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
  }
  .ops-modal__panel {
    width: min(760px, 100%);
    max-height: min(760px, calc(100vh - 36px));
    overflow: auto;
    padding: 18px;
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
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  @media (max-width: 980px) {
    .ops-topbar,
    .ops-shell,
    .ops-two-column,
    .ops-filterbar,
    .ops-composer {
      grid-template-columns: 1fr;
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
    .ops-form-grid {
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
