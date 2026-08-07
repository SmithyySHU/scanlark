import { recordAdminAuditLog, type AdminActor } from "./admin";
import { ensureConnected } from "./client";
import { computeNextScheduledAt, type ScheduleFrequency } from "./siteSchedule";
import { createOperationsReport } from "./operationsReports";

export const OPERATIONS_SERVICE_PLAN_TYPES = [
  "monitoring_only",
  "monitoring_and_support",
  "managed_care",
  "custom",
] as const;

export const OPERATIONS_SERVICE_BILLING_CADENCES = [
  "monthly",
  "quarterly",
  "annual",
  "one_off",
  "custom",
] as const;

export const OPERATIONS_SERVICE_SCAN_FREQUENCIES = [
  "daily",
  "weekly",
  "fortnightly",
  "monthly",
  "manual",
  "custom",
] as const;

export const OPERATIONS_SERVICE_REPORT_FREQUENCIES = [
  "weekly",
  "monthly",
  "quarterly",
  "manual",
  "custom",
] as const;

export const OPERATIONS_SERVICE_REVIEW_FREQUENCIES = [
  "monthly",
  "quarterly",
  "annual",
  "manual",
  "custom",
] as const;

export const OPERATIONS_CLIENT_SERVICE_STATUSES = [
  "draft",
  "proposed",
  "pending_start",
  "active",
  "paused",
  "review_due",
  "cancellation_pending",
  "cancelled",
  "expired",
  "completed",
] as const;

export const OPERATIONS_SERVICE_USAGE_TYPES = [
  "support",
  "small_fix",
  "review",
  "report",
  "incident_response",
  "consultation",
  "other",
] as const;

export const OPERATIONS_SERVICE_REVIEW_OUTCOMES = [
  "continue_unchanged",
  "change_plan",
  "change_price",
  "add_remove_site",
  "quote_additional_work",
  "pause",
  "end_service",
] as const;

export const OPERATIONS_SERVICE_INCIDENT_REVIEW_STATES = [
  "new",
  "reviewing",
  "confirmed",
  "client_notified",
  "work_created",
  "resolved",
  "dismissed",
] as const;

export type OperationsServicePlanType =
  (typeof OPERATIONS_SERVICE_PLAN_TYPES)[number];
export type OperationsServiceBillingCadence =
  (typeof OPERATIONS_SERVICE_BILLING_CADENCES)[number];
export type OperationsServiceScanFrequency =
  (typeof OPERATIONS_SERVICE_SCAN_FREQUENCIES)[number];
export type OperationsServiceReportFrequency =
  (typeof OPERATIONS_SERVICE_REPORT_FREQUENCIES)[number];
export type OperationsServiceReviewFrequency =
  (typeof OPERATIONS_SERVICE_REVIEW_FREQUENCIES)[number];
export type OperationsClientServiceStatus =
  (typeof OPERATIONS_CLIENT_SERVICE_STATUSES)[number];
export type OperationsServiceUsageType =
  (typeof OPERATIONS_SERVICE_USAGE_TYPES)[number];
export type OperationsServiceReviewOutcome =
  (typeof OPERATIONS_SERVICE_REVIEW_OUTCOMES)[number];
export type OperationsServiceIncidentReviewState =
  (typeof OPERATIONS_SERVICE_INCIDENT_REVIEW_STATES)[number];

export type OperationsServiceConfig = {
  servicePrefix: string;
  defaultCurrency: string;
  defaultReportDay: number;
  defaultReviewIntervalDays: number;
  renewalReminderDays: number;
  defaultAllowanceRollover: boolean;
};

export type OperationsServicePlanRow = {
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
  archived_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  active_service_count?: number;
};

export type OperationsClientServiceRow = {
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
  start_date: Date | null;
  minimum_term_end_date: Date | null;
  next_report_at: Date | null;
  next_review_at: Date | null;
  renewal_date: Date | null;
  renewal_reminder_at: Date | null;
  notice_period_text: string | null;
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
  proposed_at: Date | null;
  activated_at: Date | null;
  paused_at: Date | null;
  planned_resume_at: Date | null;
  cancellation_requested_at: Date | null;
  requested_end_date: Date | null;
  cancelled_at: Date | null;
  ended_at: Date | null;
  archived_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
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
  last_activity_at?: Date | null;
};

export type OperationsClientServiceSiteRow = {
  id: string;
  client_service_id: string;
  site_id: string;
  is_primary: boolean;
  monitoring_enabled: boolean;
  uptime_monitoring_enabled: boolean;
  scan_frequency_override: OperationsServiceScanFrequency | null;
  report_frequency_override: OperationsServiceReportFrequency | null;
  schedule_managed_by_service: boolean;
  previous_schedule_json: Record<string, unknown> | null;
  added_at: Date;
  removed_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  site_url?: string | null;
  site_display_name?: string | null;
  latest_scan_id?: string | null;
  latest_scan_status?: string | null;
  latest_scan_finished_at?: Date | null;
  latest_scan_score?: number | null;
  critical_issue_count?: number;
  high_issue_count?: number;
  active_incident_count?: number;
  next_scheduled_at?: Date | null;
  schedule_enabled?: boolean | null;
  schedule_frequency?: string | null;
};

export type OperationsClientServiceUsageRow = {
  id: string;
  client_service_id: string;
  business_id: string;
  work_order_id: string | null;
  communication_id: string | null;
  operations_report_id: string | null;
  usage_type: OperationsServiceUsageType;
  description: string;
  minutes_used: number | null;
  fixes_used: number | null;
  occurred_at: Date;
  service_period_start: Date;
  service_period_end: Date;
  is_out_of_scope: boolean;
  outside_scope_reason: string | null;
  internal_notes: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsClientServiceActivityRow = {
  id: string;
  client_service_id: string;
  business_id: string;
  activity_type: string;
  title: string;
  detail: string | null;
  related_site_id: string | null;
  related_report_id: string | null;
  related_quote_id: string | null;
  related_work_order_id: string | null;
  related_communication_id: string | null;
  occurred_at: Date;
  created_by_user_id: string | null;
  created_at: Date;
};

export type OperationsClientServiceReviewRow = {
  id: string;
  client_service_id: string;
  business_id: string;
  review_started_at: Date;
  review_completed_at: Date | null;
  outcome: OperationsServiceReviewOutcome;
  period_start: Date | null;
  period_end: Date | null;
  website_health_summary: string | null;
  incidents_summary: string | null;
  reports_summary: string | null;
  work_completed_summary: string | null;
  usage_summary: string | null;
  outstanding_client_actions: string | null;
  pricing_or_scope_notes: string | null;
  renewal_recommendation: string | null;
  next_review_at: Date | null;
  internal_notes: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsClientServiceIncidentRow = {
  id: string;
  client_service_id: string;
  business_id: string;
  site_id: string | null;
  source_uptime_incident_id: string | null;
  source_scan_run_id: string | null;
  title: string;
  severity: "critical" | "warning" | "info";
  review_state: OperationsServiceIncidentReviewState;
  detected_at: Date;
  reviewed_at: Date | null;
  resolved_at: Date | null;
  internal_notes: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsClientServiceDetail = {
  service: OperationsClientServiceRow;
  sites: OperationsClientServiceSiteRow[];
  usage: OperationsClientServiceUsageRow[];
  activities: OperationsClientServiceActivityRow[];
  reviews: OperationsClientServiceReviewRow[];
  incidents: OperationsClientServiceIncidentRow[];
  reports: Array<{
    id: string;
    title: string;
    status: string;
    report_type: string;
    site_id: string;
    site_url: string | null;
    sent_at: Date | null;
    updated_at: Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    due_at: Date;
    status: string;
    source_key: string | null;
  }>;
  allowance: OperationsServiceAllowanceSummary;
  activationIssues: string[];
};

export type OperationsServicePlanInput = {
  name: string;
  code?: string | null;
  description?: string | null;
  planType?: OperationsServicePlanType;
  defaultCurrency?: string;
  defaultPriceMinor?: number;
  defaultBillingCadence?: OperationsServiceBillingCadence;
  defaultScanFrequency?: OperationsServiceScanFrequency;
  defaultReportFrequency?: OperationsServiceReportFrequency;
  defaultReviewFrequency?: OperationsServiceReviewFrequency;
  includesUptimeMonitoring?: boolean;
  includesIssueAlerts?: boolean;
  includesMonthlyReport?: boolean;
  includesAdvice?: boolean;
  includesSmallFixes?: boolean;
  includedSupportMinutes?: number | null;
  includedFixCount?: number | null;
  responseTargetText?: string | null;
  scopeSummary?: string | null;
  includedScope?: string | null;
  excludedScope?: string | null;
  isActive?: boolean;
};

export type OperationsClientServiceInput = {
  businessId: string;
  contactId?: string | null;
  servicePlanId?: string | null;
  sourceQuoteId?: string | null;
  sourceWorkOrderId?: string | null;
  name: string;
  currency?: string;
  agreedPriceMinor?: number;
  zeroCostConfirmed?: boolean;
  billingCadence?: OperationsServiceBillingCadence;
  startDate?: Date | null;
  minimumTermEndDate?: Date | null;
  nextReviewAt?: Date | null;
  renewalDate?: Date | null;
  noticePeriodText?: string | null;
  scanFrequency?: OperationsServiceScanFrequency;
  reportFrequency?: OperationsServiceReportFrequency;
  reviewFrequency?: OperationsServiceReviewFrequency;
  includesUptimeMonitoring?: boolean;
  includesIssueAlerts?: boolean;
  includesMonthlyReport?: boolean;
  includesAdvice?: boolean;
  includesSmallFixes?: boolean;
  includedSupportMinutes?: number | null;
  includedFixCount?: number | null;
  responseTargetText?: string | null;
  scopeSummary?: string | null;
  includedScope?: string | null;
  excludedScope?: string | null;
  customTerms?: string | null;
  internalNotes?: string | null;
  siteIds?: string[];
};

export type OperationsClientServiceUpdateInput = Partial<
  Omit<OperationsClientServiceInput, "businessId" | "siteIds">
>;

export type OperationsClientServiceSiteInput = {
  siteId: string;
  isPrimary?: boolean;
  monitoringEnabled?: boolean;
  uptimeMonitoringEnabled?: boolean;
  scanFrequencyOverride?: OperationsServiceScanFrequency | null;
  reportFrequencyOverride?: OperationsServiceReportFrequency | null;
  notes?: string | null;
};

export type OperationsClientServiceUsageInput = {
  workOrderId?: string | null;
  communicationId?: string | null;
  operationsReportId?: string | null;
  usageType?: OperationsServiceUsageType;
  description: string;
  minutesUsed?: number | null;
  fixesUsed?: number | null;
  occurredAt?: Date | null;
  servicePeriodStart?: Date | null;
  servicePeriodEnd?: Date | null;
  isOutOfScope?: boolean;
  outsideScopeReason?: string | null;
  internalNotes?: string | null;
};

export type OperationsClientServiceReviewInput = {
  outcome?: OperationsServiceReviewOutcome;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  websiteHealthSummary?: string | null;
  incidentsSummary?: string | null;
  reportsSummary?: string | null;
  workCompletedSummary?: string | null;
  usageSummary?: string | null;
  outstandingClientActions?: string | null;
  pricingOrScopeNotes?: string | null;
  renewalRecommendation?: string | null;
  nextReviewAt?: Date | null;
  internalNotes?: string | null;
};

export type OperationsServiceAllowanceSummary = {
  periodStart: Date;
  periodEnd: Date;
  minutesIncluded: number | null;
  minutesUsed: number;
  minutesRemaining: number | null;
  fixesIncluded: number | null;
  fixesUsed: number;
  fixesRemaining: number | null;
  rolloverEnabled: boolean;
  warning: string | null;
};

export type OperationsManagedServiceCounts = {
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

type CountRow = { count: string };

export type OperationsClientServiceArchiveEligibility = {
  allowed: boolean;
  reasons: string[];
  dependencyCounts: Record<string, number>;
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

function textValue(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string | null | undefined, field: string) {
  const trimmed = textValue(value);
  if (!trimmed) throw new Error(`${field}_required`);
  return trimmed;
}

function money(value: number | null | undefined) {
  if (value == null) return 0;
  if (!Number.isInteger(value) || value < 0) throw new Error("invalid_money");
  return value;
}

function allowanceValue(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0)
    throw new Error("invalid_allowance");
  return value;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (value == null || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = value == null ? Number.NaN : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function currency(value: string | undefined, fallback = "GBP") {
  const candidate = (value ?? fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : fallback;
}

export function getOperationsServiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): OperationsServiceConfig {
  const rawPrefix = (env.OPERATIONS_SERVICE_PREFIX ?? "SL-S").trim();
  return {
    servicePrefix: rawPrefix || "SL-S",
    defaultCurrency: currency(env.OPERATIONS_DEFAULT_SERVICE_CURRENCY, "GBP"),
    defaultReportDay: clampInt(env.OPERATIONS_DEFAULT_REPORT_DAY, 1, 1, 28),
    defaultReviewIntervalDays: clampInt(
      env.OPERATIONS_DEFAULT_REVIEW_INTERVAL_DAYS,
      90,
      1,
      730,
    ),
    renewalReminderDays: clampInt(
      env.OPERATIONS_RENEWAL_REMINDER_DAYS,
      30,
      1,
      365,
    ),
    defaultAllowanceRollover: parseBool(
      env.OPERATIONS_DEFAULT_ALLOWANCE_ROLLOVER,
      false,
    ),
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonthsClamped(date: Date, months: number, dayOfMonth?: number) {
  const targetDay = Math.min(Math.max(dayOfMonth ?? date.getUTCDate(), 1), 28);
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth() + months,
      targetDay,
      9,
      0,
      0,
      0,
    ),
  );
}

function nextFromFrequency(
  frequency:
    | OperationsServiceReportFrequency
    | OperationsServiceReviewFrequency,
  from: Date,
  config = getOperationsServiceConfig(),
) {
  if (frequency === "weekly") return addDays(from, 7);
  if (frequency === "monthly")
    return addMonthsClamped(from, 1, config.defaultReportDay);
  if (frequency === "quarterly")
    return addMonthsClamped(from, 3, config.defaultReportDay);
  if (frequency === "annual")
    return addMonthsClamped(from, 12, config.defaultReportDay);
  return null;
}

function startOfDate(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function calculateServicePeriod(
  service: Pick<OperationsClientServiceRow, "billing_cadence" | "start_date">,
  occurredAt: Date = new Date(),
) {
  const startAnchor = service.start_date
    ? startOfDate(service.start_date)
    : startOfDate(occurredAt);
  const occurred = startOfDate(occurredAt);
  if (service.billing_cadence === "annual") {
    let start = new Date(
      Date.UTC(
        occurred.getUTCFullYear(),
        startAnchor.getUTCMonth(),
        startAnchor.getUTCDate(),
      ),
    );
    if (start > occurred)
      start = addMonthsClamped(start, -12, startAnchor.getUTCDate());
    return {
      start,
      end: addDays(addMonthsClamped(start, 12, startAnchor.getUTCDate()), -1),
    };
  }
  if (service.billing_cadence === "quarterly") {
    let start = new Date(
      Date.UTC(
        startAnchor.getUTCFullYear(),
        startAnchor.getUTCMonth(),
        startAnchor.getUTCDate(),
      ),
    );
    while (addMonthsClamped(start, 3, startAnchor.getUTCDate()) <= occurred) {
      start = addMonthsClamped(start, 3, startAnchor.getUTCDate());
    }
    return {
      start,
      end: addDays(addMonthsClamped(start, 3, startAnchor.getUTCDate()), -1),
    };
  }
  if (
    service.billing_cadence === "one_off" ||
    service.billing_cadence === "custom"
  ) {
    return {
      start: startAnchor,
      end: addDays(addMonthsClamped(startAnchor, 1), -1),
    };
  }
  let start = new Date(
    Date.UTC(
      occurred.getUTCFullYear(),
      occurred.getUTCMonth(),
      startAnchor.getUTCDate(),
    ),
  );
  if (start > occurred)
    start = addMonthsClamped(start, -1, startAnchor.getUTCDate());
  return {
    start,
    end: addDays(addMonthsClamped(start, 1, startAnchor.getUTCDate()), -1),
  };
}

async function nextDocumentNumber(documentType: string, prefix: string) {
  const client = await ensureConnected();
  const year = new Date().getUTCFullYear();
  const res = await client.query<{ last_value: number }>(
    `
      INSERT INTO operations_document_counters (
        document_type,
        prefix,
        document_year,
        last_value
      )
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (document_type, prefix, document_year)
      DO UPDATE
      SET last_value = operations_document_counters.last_value + 1,
          updated_at = now()
      RETURNING last_value
    `,
    [documentType, prefix, year],
  );
  const value = res.rows[0]?.last_value ?? 1;
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

async function addActivity(
  actor: AdminActor,
  input: {
    clientServiceId: string;
    businessId: string;
    activityType: string;
    title: string;
    detail?: string | null;
    relatedSiteId?: string | null;
    relatedReportId?: string | null;
    relatedQuoteId?: string | null;
    relatedWorkOrderId?: string | null;
    relatedCommunicationId?: string | null;
  },
) {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO operations_client_service_activity (
        client_service_id,
        business_id,
        activity_type,
        title,
        detail,
        related_site_id,
        related_report_id,
        related_quote_id,
        related_work_order_id,
        related_communication_id,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `,
    [
      input.clientServiceId,
      input.businessId,
      input.activityType,
      input.title,
      textValue(input.detail),
      input.relatedSiteId ?? null,
      input.relatedReportId ?? null,
      input.relatedQuoteId ?? null,
      input.relatedWorkOrderId ?? null,
      input.relatedCommunicationId ?? null,
      actor.id,
    ],
  );
}

async function recordStatusChange(
  actor: AdminActor,
  service: OperationsClientServiceRow,
  nextStatus: OperationsClientServiceStatus,
  reason?: string | null,
  notes?: string | null,
) {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO operations_client_service_status_history (
        client_service_id,
        previous_status,
        new_status,
        reason,
        notes,
        changed_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      service.id,
      service.status,
      nextStatus,
      textValue(reason),
      textValue(notes),
      actor.id,
    ],
  );
}

async function validateServiceRelationships(input: {
  workspaceId: string;
  businessId: string;
  contactId?: string | null;
  servicePlanId?: string | null;
  sourceQuoteId?: string | null;
  sourceWorkOrderId?: string | null;
}) {
  const client = await ensureConnected();
  const business = await client.query<{ id: string }>(
    `SELECT id FROM operations_businesses WHERE id = $1 AND internal_workspace_id = $2`,
    [input.businessId, input.workspaceId],
  );
  if (!business.rows[0]) return "business_not_found" as const;
  if (input.contactId) {
    const contact = await client.query<{ id: string }>(
      `SELECT c.id FROM operations_contacts c JOIN operations_businesses b ON b.id = c.business_id WHERE c.id = $1 AND c.business_id = $2 AND b.internal_workspace_id = $3 AND c.archived_at IS NULL`,
      [input.contactId, input.businessId, input.workspaceId],
    );
    if (!contact.rows[0]) return "contact_not_found" as const;
  }
  if (input.servicePlanId) {
    const plan = await client.query<{ id: string }>(
      `SELECT id FROM operations_service_plan_templates WHERE id = $1 AND internal_workspace_id = $2`,
      [input.servicePlanId, input.workspaceId],
    );
    if (!plan.rows[0]) return "service_plan_not_found" as const;
  }
  if (input.sourceQuoteId) {
    const quote = await client.query<{ id: string }>(
      `SELECT q.id FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = $1 AND q.business_id = $2 AND b.internal_workspace_id = $3`,
      [input.sourceQuoteId, input.businessId, input.workspaceId],
    );
    if (!quote.rows[0]) return "quote_not_found" as const;
  }
  if (input.sourceWorkOrderId) {
    const work = await client.query<{ id: string }>(
      `SELECT w.id FROM operations_work_orders w JOIN operations_businesses b ON b.id = w.business_id WHERE w.id = $1 AND w.business_id = $2 AND b.internal_workspace_id = $3`,
      [input.sourceWorkOrderId, input.businessId, input.workspaceId],
    );
    if (!work.rows[0]) return "work_order_not_found" as const;
  }
  return "ok" as const;
}

async function siteBelongsToBusiness(
  workspaceId: string,
  businessId: string,
  siteId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `
      SELECT s.id
      FROM sites s
     JOIN operations_business_sites obs ON obs.site_id = s.id
      JOIN operations_businesses b ON b.id = obs.business_id
      WHERE obs.business_id = $1
       AND s.id = $2
        AND b.internal_workspace_id = $3
      LIMIT 1
    `,
    [businessId, siteId, workspaceId],
  );
  return Boolean(res.rows[0]);
}

export async function listOperationsServicePlans(
  workspaceId: string,
  options: {
    activeOnly?: boolean;
    includeArchived?: boolean;
    search?: string | null;
    limit: number;
    offset: number;
  },
) {
  const client = await ensureConnected();
  const where: string[] = ["p.internal_workspace_id = $1"];
  const values: unknown[] = [workspaceId];
  if (options.activeOnly) where.push("p.is_active = true");
  if (!options.includeArchived) where.push("p.archived_at IS NULL");
  if (options.search) {
    values.push(`%${options.search.trim()}%`);
    where.push(
      `(p.name ILIKE $${values.length} OR p.code ILIKE $${values.length})`,
    );
  }
  values.push(options.limit, options.offset);
  const limitParam = values.length - 1;
  const offsetParam = values.length;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const res = await client.query<OperationsServicePlanRow>(
    `
      SELECT p.*,
             COALESCE(service_counts.count, 0)::int AS active_service_count
      FROM operations_service_plan_templates p
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS count
        FROM operations_client_services s
        WHERE s.service_plan_id = p.id
          AND s.status IN ('pending_start', 'active', 'review_due', 'paused')
      ) service_counts ON TRUE
      ${whereSql}
      ORDER BY p.is_active DESC, p.plan_type ASC, p.name ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `,
    values,
  );
  return {
    servicePlans: res.rows,
    countReturned: res.rows.length,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getOperationsServicePlan(
  workspaceId: string,
  planId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsServicePlanRow>(
    `SELECT * FROM operations_service_plan_templates WHERE id = $1 AND internal_workspace_id = $2`,
    [planId, workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function createOperationsServicePlan(
  workspaceId: string,
  actor: AdminActor,
  input: OperationsServicePlanInput,
) {
  const client = await ensureConnected();
  const name = requiredText(input.name, "service_plan_name");
  const code = normalizeCode(input.code ?? name);
  if (!code) throw new Error("service_plan_code_required");
  const res = await client.query<OperationsServicePlanRow>(
    `
      INSERT INTO operations_service_plan_templates (
        internal_workspace_id,
        name, code, description, plan_type, default_currency,
        default_price_minor, default_billing_cadence, default_scan_frequency,
        default_report_frequency, default_review_frequency,
        includes_uptime_monitoring, includes_issue_alerts,
        includes_monthly_report, includes_advice, includes_small_fixes,
        included_support_minutes, included_fix_count, response_target_text,
        scope_summary, included_scope, excluded_scope, is_active,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *
    `,
    [
      workspaceId,
      name,
      code,
      textValue(input.description),
      input.planType ?? "custom",
      currency(input.defaultCurrency),
      money(input.defaultPriceMinor),
      input.defaultBillingCadence ?? "monthly",
      input.defaultScanFrequency ?? "weekly",
      input.defaultReportFrequency ?? "monthly",
      input.defaultReviewFrequency ?? "quarterly",
      input.includesUptimeMonitoring === true,
      input.includesIssueAlerts !== false,
      input.includesMonthlyReport !== false,
      input.includesAdvice !== false,
      input.includesSmallFixes === true,
      allowanceValue(input.includedSupportMinutes),
      allowanceValue(input.includedFixCount),
      textValue(input.responseTargetText),
      textValue(input.scopeSummary),
      textValue(input.includedScope),
      textValue(input.excludedScope),
      input.isActive !== false,
      actor.id,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_service_plan_created",
    targetType: "operations_service_plan",
    targetId: res.rows[0]?.id ?? "unknown",
    metadata: { code, planType: input.planType ?? "custom" },
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsServicePlan(
  workspaceId: string,
  actor: AdminActor,
  planId: string,
  input: Partial<OperationsServicePlanInput>,
) {
  const current = await getOperationsServicePlan(workspaceId, planId);
  if (!current) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsServicePlanRow>(
    `
      UPDATE operations_service_plan_templates
      SET name = $2,
          code = $3,
          description = $4,
          plan_type = $5,
          default_currency = $6,
          default_price_minor = $7,
          default_billing_cadence = $8,
          default_scan_frequency = $9,
          default_report_frequency = $10,
          default_review_frequency = $11,
          includes_uptime_monitoring = $12,
          includes_issue_alerts = $13,
          includes_monthly_report = $14,
          includes_advice = $15,
          includes_small_fixes = $16,
          included_support_minutes = $17,
          included_fix_count = $18,
          response_target_text = $19,
          scope_summary = $20,
          included_scope = $21,
          excluded_scope = $22,
          is_active = $23,
          updated_at = now()
      WHERE id = $1 AND internal_workspace_id = $24
      RETURNING *
    `,
    [
      planId,
      input.name ? requiredText(input.name, "service_plan_name") : current.name,
      input.code ? normalizeCode(input.code) : current.code,
      "description" in input
        ? textValue(input.description)
        : current.description,
      input.planType ?? current.plan_type,
      input.defaultCurrency
        ? currency(input.defaultCurrency)
        : current.default_currency,
      "defaultPriceMinor" in input
        ? money(input.defaultPriceMinor)
        : current.default_price_minor,
      input.defaultBillingCadence ?? current.default_billing_cadence,
      input.defaultScanFrequency ?? current.default_scan_frequency,
      input.defaultReportFrequency ?? current.default_report_frequency,
      input.defaultReviewFrequency ?? current.default_review_frequency,
      "includesUptimeMonitoring" in input
        ? input.includesUptimeMonitoring === true
        : current.includes_uptime_monitoring,
      "includesIssueAlerts" in input
        ? input.includesIssueAlerts !== false
        : current.includes_issue_alerts,
      "includesMonthlyReport" in input
        ? input.includesMonthlyReport !== false
        : current.includes_monthly_report,
      "includesAdvice" in input
        ? input.includesAdvice !== false
        : current.includes_advice,
      "includesSmallFixes" in input
        ? input.includesSmallFixes === true
        : current.includes_small_fixes,
      "includedSupportMinutes" in input
        ? allowanceValue(input.includedSupportMinutes)
        : current.included_support_minutes,
      "includedFixCount" in input
        ? allowanceValue(input.includedFixCount)
        : current.included_fix_count,
      "responseTargetText" in input
        ? textValue(input.responseTargetText)
        : current.response_target_text,
      "scopeSummary" in input
        ? textValue(input.scopeSummary)
        : current.scope_summary,
      "includedScope" in input
        ? textValue(input.includedScope)
        : current.included_scope,
      "excludedScope" in input
        ? textValue(input.excludedScope)
        : current.excluded_scope,
      "isActive" in input ? input.isActive !== false : current.is_active,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_service_plan_updated",
    targetType: "operations_service_plan",
    targetId: planId,
    metadata: { fields: Object.keys(input) },
  });
  return res.rows[0] ?? null;
}

export async function duplicateOperationsServicePlan(
  workspaceId: string,
  actor: AdminActor,
  planId: string,
) {
  const current = await getOperationsServicePlan(workspaceId, planId);
  if (!current) return null;
  return createOperationsServicePlan(workspaceId, actor, {
    name: `${current.name} copy`,
    code: `${current.code}_copy_${Date.now()}`,
    description: current.description,
    planType: current.plan_type,
    defaultCurrency: current.default_currency,
    defaultPriceMinor: current.default_price_minor,
    defaultBillingCadence: current.default_billing_cadence,
    defaultScanFrequency: current.default_scan_frequency,
    defaultReportFrequency: current.default_report_frequency,
    defaultReviewFrequency: current.default_review_frequency,
    includesUptimeMonitoring: current.includes_uptime_monitoring,
    includesIssueAlerts: current.includes_issue_alerts,
    includesMonthlyReport: current.includes_monthly_report,
    includesAdvice: current.includes_advice,
    includesSmallFixes: current.includes_small_fixes,
    includedSupportMinutes: current.included_support_minutes,
    includedFixCount: current.included_fix_count,
    responseTargetText: current.response_target_text,
    scopeSummary: current.scope_summary,
    includedScope: current.included_scope,
    excludedScope: current.excluded_scope,
  });
}

export async function setOperationsServicePlanArchived(
  workspaceId: string,
  actor: AdminActor,
  planId: string,
  archived: boolean,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsServicePlanRow>(
    `
      UPDATE operations_service_plan_templates
      SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END,
          is_active = CASE WHEN $2 THEN false ELSE is_active END,
          updated_at = now()
      WHERE id = $1 AND internal_workspace_id = $3
      RETURNING *
    `,
    [planId, archived, workspaceId],
  );
  if (!res.rows[0]) return null;
  await recordAdminAuditLog(actor, {
    action: archived
      ? "operations_service_plan_archived"
      : "operations_service_plan_restored",
    targetType: "operations_service_plan",
    targetId: planId,
    metadata: {},
  });
  return res.rows[0];
}

async function copyPlanDefaults(
  workspaceId: string,
  planId: string | null | undefined,
) {
  if (!planId) return null;
  return getOperationsServicePlan(workspaceId, planId);
}

export async function createOperationsClientService(
  workspaceId: string,
  actor: AdminActor,
  input: OperationsClientServiceInput,
) {
  const validation = await validateServiceRelationships({
    workspaceId,
    ...input,
  });
  if (validation !== "ok") return validation;
  const plan = await copyPlanDefaults(workspaceId, input.servicePlanId);
  const config = getOperationsServiceConfig();
  const serviceNumber = await nextDocumentNumber(
    "client_service",
    config.servicePrefix,
  );
  const startDate = input.startDate ?? null;
  const nextReportAt = startDate
    ? nextFromFrequency(
        input.reportFrequency ?? plan?.default_report_frequency ?? "monthly",
        startDate,
        config,
      )
    : null;
  const nextReviewAt =
    input.nextReviewAt ??
    (startDate
      ? nextFromFrequency(
          input.reviewFrequency ??
            plan?.default_review_frequency ??
            "quarterly",
          startDate,
          config,
        )
      : null);
  const renewalReminderAt = input.renewalDate
    ? addDays(startOfDate(input.renewalDate), -config.renewalReminderDays)
    : null;
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const res = await client.query<OperationsClientServiceRow>(
      `
        INSERT INTO operations_client_services (
          business_id, contact_id, service_plan_id, source_quote_id,
          source_work_order_id, service_number, name, currency,
          agreed_price_minor, zero_cost_confirmed, billing_cadence,
          start_date, minimum_term_end_date, next_report_at, next_review_at,
          renewal_date, renewal_reminder_at, notice_period_text,
          scan_frequency, report_frequency, review_frequency,
          includes_uptime_monitoring, includes_issue_alerts,
          includes_monthly_report, includes_advice, includes_small_fixes,
          included_support_minutes, included_fix_count, response_target_text,
          scope_summary, included_scope, excluded_scope, custom_terms,
          internal_notes, created_by_user_id
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
        WHERE EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = $1 AND b.internal_workspace_id = $36)
        RETURNING *
      `,
      [
        input.businessId,
        input.contactId ?? null,
        input.servicePlanId ?? null,
        input.sourceQuoteId ?? null,
        input.sourceWorkOrderId ?? null,
        serviceNumber,
        requiredText(
          input.name || plan?.name || "Managed service",
          "service_name",
        ),
        currency(
          input.currency,
          plan?.default_currency ?? config.defaultCurrency,
        ),
        money(input.agreedPriceMinor ?? plan?.default_price_minor ?? 0),
        input.zeroCostConfirmed === true,
        input.billingCadence ?? plan?.default_billing_cadence ?? "monthly",
        startDate,
        input.minimumTermEndDate ?? null,
        nextReportAt,
        nextReviewAt,
        input.renewalDate ?? null,
        renewalReminderAt,
        textValue(input.noticePeriodText),
        input.scanFrequency ?? plan?.default_scan_frequency ?? "weekly",
        input.reportFrequency ?? plan?.default_report_frequency ?? "monthly",
        input.reviewFrequency ?? plan?.default_review_frequency ?? "quarterly",
        input.includesUptimeMonitoring ??
          plan?.includes_uptime_monitoring ??
          false,
        input.includesIssueAlerts ?? plan?.includes_issue_alerts ?? true,
        input.includesMonthlyReport ?? plan?.includes_monthly_report ?? true,
        input.includesAdvice ?? plan?.includes_advice ?? true,
        input.includesSmallFixes ?? plan?.includes_small_fixes ?? false,
        allowanceValue(
          input.includedSupportMinutes ??
            plan?.included_support_minutes ??
            null,
        ),
        allowanceValue(
          input.includedFixCount ?? plan?.included_fix_count ?? null,
        ),
        textValue(
          input.responseTargetText ?? plan?.response_target_text ?? null,
        ),
        textValue(input.scopeSummary ?? plan?.scope_summary ?? null),
        textValue(input.includedScope ?? plan?.included_scope ?? null),
        textValue(input.excludedScope ?? plan?.excluded_scope ?? null),
        textValue(input.customTerms),
        textValue(input.internalNotes),
        actor.id,
        workspaceId,
      ],
    );
    const service = res.rows[0];
    for (const siteId of input.siteIds ?? []) {
      if (
        !(await siteBelongsToBusiness(workspaceId, input.businessId, siteId))
      ) {
        await client.query("ROLLBACK");
        return "site_not_linked_to_business" as const;
      }
      await client.query(
        `
          INSERT INTO operations_client_service_sites (
            client_service_id,
            site_id,
            is_primary,
            monitoring_enabled,
            uptime_monitoring_enabled,
            scan_frequency_override,
            report_frequency_override
          )
          VALUES ($1, $2, NOT EXISTS (
            SELECT 1 FROM operations_client_service_sites
         WHERE client_service_id = $1 AND removed_at IS NULL
           AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_sites.client_service_id AND b.internal_workspace_id = $4)
          ), true, $3, NULL, NULL)
          ON CONFLICT (client_service_id, site_id)
          WHERE removed_at IS NULL
          DO NOTHING
        `,
        [service.id, siteId, service.includes_uptime_monitoring, workspaceId],
      );
    }
    await client.query("COMMIT");
    await addActivity(actor, {
      clientServiceId: service.id,
      businessId: service.business_id,
      activityType: "service_created",
      title: `Service ${service.service_number} created`,
    });
    await recordAdminAuditLog(actor, {
      action: "operations_client_service_created",
      targetType: "operations_client_service",
      targetId: service.id,
      metadata: {
        businessId: service.business_id,
        sourceQuoteId: input.sourceQuoteId ?? null,
      },
    });
    return getOperationsClientServiceDetail(workspaceId, service.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function listOperationsClientServices(
  workspaceId: string,
  options: {
    businessId?: string | null;
    status?: OperationsClientServiceStatus | null;
    planType?: OperationsServicePlanType | null;
    billingCadence?: OperationsServiceBillingCadence | null;
    search?: string | null;
    reportsDue?: boolean;
    reviewsDue?: boolean;
    renewalsApproaching?: boolean;
    siteAttention?: boolean;
    includeEnded?: boolean;
    limit: number;
    offset: number;
  },
) {
  const client = await ensureConnected();
  const where: string[] = ["b.internal_workspace_id = $1"];
  const values: unknown[] = [workspaceId];
  if (!options.includeEnded) {
    where.push(`s.archived_at IS NULL`);
  }
  if (options.businessId) {
    values.push(options.businessId);
    where.push(`s.business_id = $${values.length}`);
  }
  if (options.status) {
    values.push(options.status);
    where.push(`s.status = $${values.length}`);
  } else if (!options.includeEnded) {
    where.push(`s.status NOT IN ('cancelled', 'expired', 'completed')`);
  }
  if (options.planType) {
    values.push(options.planType);
    where.push(`p.plan_type = $${values.length}`);
  }
  if (options.billingCadence) {
    values.push(options.billingCadence);
    where.push(`s.billing_cadence = $${values.length}`);
  }
  if (options.search) {
    values.push(`%${options.search.trim()}%`);
    where.push(`(s.name ILIKE $${values.length} OR s.service_number ILIKE $${values.length} OR b.name ILIKE $${values.length} OR EXISTS (
      SELECT 1 FROM operations_client_service_sites css
      JOIN sites site ON site.id = css.site_id
      WHERE css.client_service_id = s.id AND css.removed_at IS NULL AND site.url ILIKE $${values.length}
    ))`);
  }
  if (options.reportsDue)
    where.push(`s.next_report_at IS NOT NULL AND s.next_report_at <= now()`);
  if (options.reviewsDue)
    where.push(`s.next_review_at IS NOT NULL AND s.next_review_at <= now()`);
  if (options.renewalsApproaching)
    where.push(
      `s.renewal_reminder_at IS NOT NULL AND s.renewal_reminder_at <= now()`,
    );
  if (options.siteAttention)
    where.push(`COALESCE(attention.site_attention_count, 0) > 0`);
  values.push(options.limit, options.offset);
  const limitParam = values.length - 1;
  const offsetParam = values.length;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const services = await client.query<OperationsClientServiceRow>(
    `
      SELECT s.*,
             b.name AS business_name,
             b.website_url AS business_website_url,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email,
             p.name AS plan_name,
             p.plan_type,
             COALESCE(site_counts.covered_site_count, 0)::int AS covered_site_count,
             COALESCE(attention.site_attention_count, 0)::int AS site_attention_count,
             COALESCE(task_counts.open_task_count, 0)::int AS open_task_count,
             activity.last_activity_at
      FROM operations_client_services s
      JOIN operations_businesses b ON b.id = s.business_id
      LEFT JOIN operations_contacts c ON c.id = s.contact_id
      LEFT JOIN operations_service_plan_templates p ON p.id = s.service_plan_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS covered_site_count
        FROM operations_client_service_sites css
        WHERE css.client_service_id = s.id AND css.removed_at IS NULL
      ) site_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS site_attention_count
        FROM operations_client_service_sites css
        LEFT JOIN LATERAL (
          SELECT status
          FROM scan_runs sr
          WHERE sr.site_id = css.site_id
          ORDER BY sr.started_at DESC
          LIMIT 1
        ) latest_scan ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS open_incidents
          FROM uptime_incidents ui
          WHERE ui.site_id = css.site_id AND ui.status = 'open'
        ) open_uptime ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS important_issues
          FROM scan_issues si
          JOIN scan_runs sr ON sr.id = si.scan_run_id
          WHERE sr.site_id = css.site_id
            AND sr.status = 'completed'
            AND si.severity IN ('critical', 'high')
            AND sr.started_at >= now() - interval '45 days'
        ) issues ON TRUE
        WHERE css.client_service_id = s.id
          AND css.removed_at IS NULL
          AND (
            COALESCE(open_uptime.open_incidents, 0) > 0
            OR latest_scan.status = 'failed'
            OR COALESCE(issues.important_issues, 0) > 0
          )
      ) attention ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS open_task_count
        FROM operations_tasks t
        WHERE t.source_client_service_id = s.id
          AND t.status IN ('open', 'snoozed')
      ) task_counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT MAX(a.occurred_at) AS last_activity_at
        FROM operations_client_service_activity a
        WHERE a.client_service_id = s.id
      ) activity ON TRUE
      ${whereSql}
      ORDER BY
        CASE WHEN s.status IN ('active', 'review_due', 'pending_start') THEN 0 ELSE 1 END,
        COALESCE(s.next_report_at, s.next_review_at, s.updated_at) ASC
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `,
    values,
  );
  const total = await client.query<CountRow>(
    `
      SELECT COUNT(*) AS count
      FROM operations_client_services s
      JOIN operations_businesses b ON b.id = s.business_id
      LEFT JOIN operations_service_plan_templates p ON p.id = s.service_plan_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS site_attention_count
        FROM operations_client_service_sites css
        WHERE css.client_service_id = s.id
          AND css.removed_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM uptime_incidents ui
            WHERE ui.site_id = css.site_id AND ui.status = 'open'
          )
      ) attention ON TRUE
      ${whereSql}
    `,
    values.slice(0, -2),
  );
  return {
    services: services.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: services.rows.length,
    limit: options.limit,
    offset: options.offset,
  };
}

export function getServiceActivationIssues(
  service: OperationsClientServiceRow,
  sites: OperationsClientServiceSiteRow[],
) {
  const issues: string[] = [];
  if (!service.business_id) issues.push("business_required");
  if (sites.filter((site) => !site.removed_at).length === 0) {
    issues.push("covered_site_required");
  }
  if (!service.start_date) issues.push("start_date_required");
  if (service.agreed_price_minor <= 0 && !service.zero_cost_confirmed) {
    issues.push("price_or_zero_cost_confirmation_required");
  }
  if (!service.billing_cadence) issues.push("billing_cadence_required");
  if (!service.scan_frequency) issues.push("scan_frequency_required");
  if (!service.report_frequency) issues.push("report_frequency_required");
  if (!textValue(service.included_scope))
    issues.push("included_scope_required");
  if (!textValue(service.excluded_scope))
    issues.push("excluded_scope_required");
  if (!service.contact_id && !textValue(service.custom_terms)) {
    issues.push("primary_contact_or_reason_required");
  }
  return issues;
}

export async function getOperationsClientServiceDetail(
  workspaceId: string,
  serviceId: string,
) {
  const client = await ensureConnected();
  const serviceRes = await client.query<OperationsClientServiceRow>(
    `
      SELECT s.*,
             b.name AS business_name,
             b.website_url AS business_website_url,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email,
             p.name AS plan_name,
             p.plan_type
      FROM operations_client_services s
      JOIN operations_businesses b ON b.id = s.business_id
      LEFT JOIN operations_contacts c ON c.id = s.contact_id
      LEFT JOIN operations_service_plan_templates p ON p.id = s.service_plan_id
      WHERE s.id = $2
        AND b.internal_workspace_id = $1
    `,
    [workspaceId, serviceId],
  );
  const service = serviceRes.rows[0];
  if (!service) return null;
  const [sites, usage, activities, reviews, incidents, reports, tasks] =
    await Promise.all([
      client.query<OperationsClientServiceSiteRow>(
        `
        SELECT css.*,
               s.url AS site_url,
               s.display_name AS site_display_name,
               s.schedule_enabled,
               s.schedule_frequency,
               s.next_scheduled_at,
               latest.id AS latest_scan_id,
               latest.status AS latest_scan_status,
               latest.finished_at AS latest_scan_finished_at,
               latest.health_score AS latest_scan_score,
               COALESCE(issue_counts.critical_count, 0)::int AS critical_issue_count,
               COALESCE(issue_counts.high_count, 0)::int AS high_issue_count,
               COALESCE(incident_counts.active_incident_count, 0)::int AS active_incident_count
        FROM operations_client_service_sites css
        JOIN sites s ON s.id = css.site_id
        LEFT JOIN LATERAL (
          SELECT sr.*
          FROM scan_runs sr
          WHERE sr.site_id = s.id
          ORDER BY sr.started_at DESC
          LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE si.severity = 'critical') AS critical_count,
            COUNT(*) FILTER (WHERE si.severity = 'high') AS high_count
          FROM scan_issues si
          WHERE latest.id IS NOT NULL AND si.scan_run_id = latest.id
        ) issue_counts ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS active_incident_count
          FROM uptime_incidents ui
          WHERE ui.site_id = s.id AND ui.status = 'open'
        ) incident_counts ON TRUE
        WHERE css.client_service_id = $1
          AND EXISTS (
            SELECT 1 FROM operations_client_services scoped_s
            JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id
            WHERE scoped_s.id = css.client_service_id
              AND scoped_b.internal_workspace_id = $2
          )
        ORDER BY css.removed_at NULLS FIRST, css.is_primary DESC, s.url ASC
      `,
        [serviceId, workspaceId],
      ),
      client.query<OperationsClientServiceUsageRow>(
        `
        SELECT *
        FROM operations_client_service_usage
        WHERE client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_service_usage.client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY occurred_at DESC
        LIMIT 100
      `,
        [serviceId, workspaceId],
      ),
      client.query<OperationsClientServiceActivityRow>(
        `
        SELECT *
        FROM operations_client_service_activity
        WHERE client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_service_activity.client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY occurred_at DESC
        LIMIT 100
      `,
        [serviceId, workspaceId],
      ),
      client.query<OperationsClientServiceReviewRow>(
        `
        SELECT *
        FROM operations_client_service_reviews
        WHERE client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_service_reviews.client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY review_started_at DESC
        LIMIT 20
      `,
        [serviceId, workspaceId],
      ),
      client.query<OperationsClientServiceIncidentRow>(
        `
        SELECT *
        FROM operations_client_service_incidents
        WHERE client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_service_incidents.client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY detected_at DESC
        LIMIT 50
      `,
        [serviceId, workspaceId],
      ),
      client.query<{
        id: string;
        title: string;
        status: string;
        report_type: string;
        site_id: string;
        site_url: string | null;
        sent_at: Date | null;
        updated_at: Date;
      }>(
        `
        SELECT r.id, r.title, r.status, r.report_type, r.site_id, s.url AS site_url, r.sent_at, r.updated_at
        FROM operations_reports r
        JOIN sites s ON s.id = r.site_id
        WHERE r.client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = r.client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY r.updated_at DESC
        LIMIT 50
      `,
        [serviceId, workspaceId],
      ),
      client.query<{
        id: string;
        title: string;
        due_at: Date;
        status: string;
        source_key: string | null;
      }>(
        `
        SELECT id, title, due_at, status, source_key
        FROM operations_tasks
        WHERE source_client_service_id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_tasks.source_client_service_id AND scoped_b.internal_workspace_id = $2)
        ORDER BY status ASC, due_at ASC
        LIMIT 50
      `,
        [serviceId, workspaceId],
      ),
    ]);
  const allowance = await getOperationsServiceAllowanceSummary(
    workspaceId,
    serviceId,
  );
  return {
    service,
    sites: sites.rows,
    usage: usage.rows,
    activities: activities.rows,
    reviews: reviews.rows,
    incidents: incidents.rows,
    reports: reports.rows,
    tasks: tasks.rows,
    allowance,
    activationIssues: getServiceActivationIssues(service, sites.rows),
  };
}

export async function updateOperationsClientService(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: OperationsClientServiceUpdateInput,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const valid = await validateServiceRelationships({
    workspaceId,
    businessId: detail.service.business_id,
    contactId:
      "contactId" in input ? input.contactId : detail.service.contact_id,
    servicePlanId:
      "servicePlanId" in input
        ? input.servicePlanId
        : detail.service.service_plan_id,
    sourceQuoteId:
      "sourceQuoteId" in input
        ? input.sourceQuoteId
        : detail.service.source_quote_id,
    sourceWorkOrderId:
      "sourceWorkOrderId" in input
        ? input.sourceWorkOrderId
        : detail.service.source_work_order_id,
  });
  if (valid !== "ok") return valid;
  const current = detail.service;
  const config = getOperationsServiceConfig();
  const renewalDate =
    "renewalDate" in input ? (input.renewalDate ?? null) : current.renewal_date;
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceRow>(
    `
       UPDATE operations_client_services
      SET contact_id = $2,
          service_plan_id = $3,
          source_quote_id = $4,
          source_work_order_id = $5,
          name = $6,
          currency = $7,
          agreed_price_minor = $8,
          zero_cost_confirmed = $9,
          billing_cadence = $10,
          start_date = $11,
          minimum_term_end_date = $12,
          next_review_at = $13,
          renewal_date = $14,
          renewal_reminder_at = $15,
          notice_period_text = $16,
          scan_frequency = $17,
          report_frequency = $18,
          review_frequency = $19,
          includes_uptime_monitoring = $20,
          includes_issue_alerts = $21,
          includes_monthly_report = $22,
          includes_advice = $23,
          includes_small_fixes = $24,
          included_support_minutes = $25,
          included_fix_count = $26,
          response_target_text = $27,
          scope_summary = $28,
          included_scope = $29,
          excluded_scope = $30,
          custom_terms = $31,
          internal_notes = $32,
          updated_at = now()
       WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_services.id AND scoped_b.internal_workspace_id = $33)
      RETURNING *
    `,
    [
      serviceId,
      "contactId" in input ? (input.contactId ?? null) : current.contact_id,
      "servicePlanId" in input
        ? (input.servicePlanId ?? null)
        : current.service_plan_id,
      "sourceQuoteId" in input
        ? (input.sourceQuoteId ?? null)
        : current.source_quote_id,
      "sourceWorkOrderId" in input
        ? (input.sourceWorkOrderId ?? null)
        : current.source_work_order_id,
      "name" in input ? requiredText(input.name, "service_name") : current.name,
      "currency" in input ? currency(input.currency) : current.currency,
      "agreedPriceMinor" in input
        ? money(input.agreedPriceMinor)
        : current.agreed_price_minor,
      "zeroCostConfirmed" in input
        ? input.zeroCostConfirmed === true
        : current.zero_cost_confirmed,
      input.billingCadence ?? current.billing_cadence,
      "startDate" in input ? (input.startDate ?? null) : current.start_date,
      "minimumTermEndDate" in input
        ? (input.minimumTermEndDate ?? null)
        : current.minimum_term_end_date,
      "nextReviewAt" in input
        ? (input.nextReviewAt ?? null)
        : current.next_review_at,
      renewalDate,
      renewalDate
        ? addDays(startOfDate(renewalDate), -config.renewalReminderDays)
        : null,
      "noticePeriodText" in input
        ? textValue(input.noticePeriodText)
        : current.notice_period_text,
      input.scanFrequency ?? current.scan_frequency,
      input.reportFrequency ?? current.report_frequency,
      input.reviewFrequency ?? current.review_frequency,
      "includesUptimeMonitoring" in input
        ? input.includesUptimeMonitoring === true
        : current.includes_uptime_monitoring,
      "includesIssueAlerts" in input
        ? input.includesIssueAlerts !== false
        : current.includes_issue_alerts,
      "includesMonthlyReport" in input
        ? input.includesMonthlyReport !== false
        : current.includes_monthly_report,
      "includesAdvice" in input
        ? input.includesAdvice !== false
        : current.includes_advice,
      "includesSmallFixes" in input
        ? input.includesSmallFixes === true
        : current.includes_small_fixes,
      "includedSupportMinutes" in input
        ? allowanceValue(input.includedSupportMinutes)
        : current.included_support_minutes,
      "includedFixCount" in input
        ? allowanceValue(input.includedFixCount)
        : current.included_fix_count,
      "responseTargetText" in input
        ? textValue(input.responseTargetText)
        : current.response_target_text,
      "scopeSummary" in input
        ? textValue(input.scopeSummary)
        : current.scope_summary,
      "includedScope" in input
        ? textValue(input.includedScope)
        : current.included_scope,
      "excludedScope" in input
        ? textValue(input.excludedScope)
        : current.excluded_scope,
      "customTerms" in input
        ? textValue(input.customTerms)
        : current.custom_terms,
      "internalNotes" in input
        ? textValue(input.internalNotes)
        : current.internal_notes,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_client_service_updated",
    targetType: "operations_client_service",
    targetId: serviceId,
    metadata: { fields: Object.keys(input) },
  });
  return getOperationsClientServiceDetail(workspaceId, res.rows[0].id);
}

export async function getOperationsClientServiceArchiveEligibility(
  workspaceId: string,
  serviceId: string,
): Promise<OperationsClientServiceArchiveEligibility | null> {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const client = await ensureConnected();
  const [usage, activities, reports, tasks] = await Promise.all([
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_client_service_usage u WHERE u.client_service_id = $1 AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = u.client_service_id AND b.internal_workspace_id = $2)`,
      [serviceId, workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_client_service_activity a WHERE a.client_service_id = $1 AND a.activity_type <> 'service_created' AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = a.client_service_id AND b.internal_workspace_id = $2)`,
      [serviceId, workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_reports r WHERE r.client_service_id = $1 AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = r.business_id AND b.internal_workspace_id = $2)`,
      [serviceId, workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_tasks t WHERE t.source_client_service_id = $1 AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = t.business_id AND b.internal_workspace_id = $2)`,
      [serviceId, workspaceId],
    ),
  ]);
  const reasons: string[] = [];
  const dependencyCounts: Record<string, number> = {};
  if (detail.service.status !== "draft") {
    reasons.push(`status is ${detail.service.status}`);
  }
  addDependencyReason(
    reasons,
    dependencyCounts,
    "usage",
    countValue(usage.rows[0]),
    "usage records",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "activity",
    countValue(activities.rows[0]),
    "activity records",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "reports",
    countValue(reports.rows[0]),
    "reports",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "tasks",
    countValue(tasks.rows[0]),
    "tasks",
  );
  return { allowed: reasons.length === 0, reasons, dependencyCounts };
}

export async function setOperationsClientServiceArchived(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  archived: boolean,
): Promise<
  | OperationsClientServiceDetail
  | OperationsClientServiceArchiveEligibility
  | null
> {
  if (archived) {
    const eligibility = await getOperationsClientServiceArchiveEligibility(
      workspaceId,
      serviceId,
    );
    if (!eligibility) return null;
    if (!eligibility.allowed) return eligibility;
  }
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceRow>(
    `
      UPDATE operations_client_services
      SET archived_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
      WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_services.id AND scoped_b.internal_workspace_id = $3)
        AND status = 'draft'
      RETURNING *
    `,
    [serviceId, archived, workspaceId],
  );
  const service = res.rows[0] ?? null;
  if (!service) return null;
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: service.business_id,
    activityType: archived ? "service_archived" : "service_restored",
    title: archived ? "Draft service archived" : "Draft service restored",
  });
  await recordAdminAuditLog(actor, {
    action: archived
      ? "operations_client_service_archived"
      : "operations_client_service_restored",
    targetType: "operations_client_service",
    targetId: serviceId,
    metadata: { businessId: service.business_id },
  });
  return getOperationsClientServiceDetail(workspaceId, serviceId);
}

async function configureServiceSchedules(
  workspaceId: string,
  actor: AdminActor,
  detail: OperationsClientServiceDetail,
) {
  const client = await ensureConnected();
  for (const site of detail.sites.filter(
    (item) => !item.removed_at && item.monitoring_enabled,
  )) {
    const frequency =
      site.scan_frequency_override ?? detail.service.scan_frequency;
    if (!["daily", "weekly", "monthly"].includes(frequency)) continue;
    const current = await client.query<{
      schedule_enabled: boolean;
      schedule_frequency: ScheduleFrequency;
      schedule_time_utc: string;
      schedule_day_of_week: number | null;
      schedule_day_of_month: number | null;
      next_scheduled_at: Date | null;
      last_scheduled_at: Date | null;
    }>(
      `
        SELECT schedule_enabled, schedule_frequency, schedule_time_utc,
               schedule_day_of_week, schedule_day_of_month, next_scheduled_at,
               last_scheduled_at
        FROM sites
        WHERE id = $1 AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_client_services.business_id AND b.internal_workspace_id = $6)
          AND EXISTS (SELECT 1 FROM operations_client_service_sites css JOIN operations_client_services scoped_s ON scoped_s.id = css.client_service_id JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE css.site_id = sites.id AND scoped_s.id = $2 AND scoped_b.internal_workspace_id = $3)
      `,
      [site.site_id, detail.service.id, workspaceId],
    );
    const row = current.rows[0];
    if (!row) continue;
    const existingServiceOwned = site.schedule_managed_by_service === true;
    const safeToManage =
      existingServiceOwned ||
      !row.schedule_enabled ||
      row.schedule_frequency === "manual";
    if (!safeToManage) {
      await addActivity(actor, {
        clientServiceId: detail.service.id,
        businessId: detail.service.business_id,
        activityType: "scan_schedule_left_unchanged",
        title: "Existing site schedule left unchanged",
        detail: "A non-service scan schedule already exists for this site.",
        relatedSiteId: site.site_id,
      });
      continue;
    }
    const scheduleFrequency = frequency as ScheduleFrequency;
    const nextScheduledAt = computeNextScheduledAt({
      frequency: scheduleFrequency,
      timeUtc: row.schedule_time_utc || "02:00",
      dayOfWeek: row.schedule_day_of_week ?? 1,
      dayOfMonth:
        row.schedule_day_of_month ??
        getOperationsServiceConfig().defaultReportDay,
    });
    await client.query(
      `
        UPDATE sites
        SET schedule_enabled = true,
            schedule_frequency = $2,
            next_scheduled_at = $3
     WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_client_service_sites css JOIN operations_client_services s ON s.id = css.client_service_id JOIN operations_businesses b ON b.id = s.business_id WHERE css.site_id = sites.id AND css.client_service_id = $4 AND b.internal_workspace_id = $5)
     `,
      [
        site.site_id,
        scheduleFrequency,
        nextScheduledAt,
        detail.service.id,
        workspaceId,
      ],
    );
    await client.query(
      `
       UPDATE operations_client_service_sites
       SET schedule_managed_by_service = true,
           previous_schedule_json = COALESCE(previous_schedule_json, $2::jsonb),
           updated_at = now()
       WHERE id = $1
          AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = operations_client_service_sites.client_service_id AND scoped_s.id = $3 AND scoped_b.internal_workspace_id = $4)
      `,
      [
        site.id,
        JSON.stringify({
          scheduleEnabled: row.schedule_enabled,
          scheduleFrequency: row.schedule_frequency,
          scheduleTimeUtc: row.schedule_time_utc,
          scheduleDayOfWeek: row.schedule_day_of_week,
          scheduleDayOfMonth: row.schedule_day_of_month,
          nextScheduledAt: row.next_scheduled_at?.toISOString() ?? null,
          lastScheduledAt: row.last_scheduled_at?.toISOString() ?? null,
        }),
        detail.service.id,
        workspaceId,
      ],
    );
  }
}

async function pauseServiceOwnedSchedules(
  workspaceId: string,
  serviceId: string,
) {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE sites s
      SET schedule_enabled = false,
          next_scheduled_at = NULL
      FROM operations_client_service_sites css
      WHERE css.site_id = s.id
        AND css.client_service_id = $1
        AND css.removed_at IS NULL
       AND css.schedule_managed_by_service = true
        AND EXISTS (SELECT 1 FROM operations_client_services scoped_s JOIN operations_businesses scoped_b ON scoped_b.id = scoped_s.business_id WHERE scoped_s.id = css.client_service_id AND scoped_s.id = $2 AND scoped_b.internal_workspace_id = $3)
   `,
    [serviceId, serviceId, workspaceId],
  );
}

async function updateServiceStatus(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  status: OperationsClientServiceStatus,
  options: {
    reason?: string | null;
    notes?: string | null;
    plannedResumeAt?: Date | null;
    requestedEndDate?: Date | null;
    agreedAt?: Date | null;
    acceptanceMethod?: string | null;
    updateBusinessRelationship?: boolean;
    updatePipelineStage?: boolean;
  } = {},
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  if (status === "active" || status === "pending_start") {
    const issues = getServiceActivationIssues(detail.service, detail.sites);
    if (issues.length > 0) return { activationIssues: issues };
    if (!options.agreedAt || !options.acceptanceMethod) {
      return { activationIssues: ["explicit_agreement_required"] };
    }
  }
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    await recordStatusChange(
      actor,
      detail.service,
      status,
      options.reason,
      options.notes,
    );
    const res = await client.query<OperationsClientServiceRow>(
      `
        UPDATE operations_client_services
        SET status = $2,
            proposed_at = CASE WHEN $2 = 'proposed' THEN COALESCE(proposed_at, now()) ELSE proposed_at END,
            activated_at = CASE WHEN $2 IN ('active', 'pending_start') THEN COALESCE(activated_at, $3, now()) ELSE activated_at END,
            paused_at = CASE WHEN $2 = 'paused' THEN now() ELSE CASE WHEN $2 = 'active' THEN NULL ELSE paused_at END END,
            planned_resume_at = CASE WHEN $2 = 'paused' THEN $4 ELSE NULL END,
            cancellation_requested_at = CASE WHEN $2 = 'cancellation_pending' THEN now() ELSE cancellation_requested_at END,
            requested_end_date = CASE WHEN $2 = 'cancellation_pending' THEN $5 ELSE requested_end_date END,
            cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
            ended_at = CASE WHEN $2 IN ('cancelled', 'completed', 'expired') THEN COALESCE(ended_at, now()) ELSE ended_at END,
            updated_at = now()
       WHERE id = $1
          AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_client_services.business_id AND b.internal_workspace_id = $6)
       RETURNING *
      `,
      [
        serviceId,
        status,
        options.agreedAt ?? null,
        options.plannedResumeAt ?? null,
        options.requestedEndDate ?? null,
        workspaceId,
      ],
    );
    if (options.updateBusinessRelationship) {
      await client.query(
        `
          UPDATE operations_businesses
          SET relationship_type = 'client',
              pipeline_stage = CASE WHEN $2 THEN 'ongoing_client' ELSE pipeline_stage END,
              updated_at = now()
          WHERE id = $1
            AND internal_workspace_id = $3
        `,
        [
          detail.service.business_id,
          options.updatePipelineStage === true,
          workspaceId,
        ],
      );
    }
    await client.query("COMMIT");
    if (["active", "pending_start"].includes(status)) {
      const updated = await getOperationsClientServiceDetail(
        workspaceId,
        serviceId,
      );
      if (updated) {
        await configureServiceSchedules(workspaceId, actor, updated);
        await generateOperationsServiceTasks(workspaceId, actor, serviceId);
      }
    }
    if (["paused", "cancelled", "completed", "expired"].includes(status)) {
      await pauseServiceOwnedSchedules(workspaceId, serviceId);
    }
    await addActivity(actor, {
      clientServiceId: serviceId,
      businessId: detail.service.business_id,
      activityType: `service_${status}`,
      title: `Service marked ${status.replace(/_/g, " ")}`,
      detail: options.reason,
    });
    await recordAdminAuditLog(actor, {
      action: `operations_client_service_${status}`,
      targetType: "operations_client_service",
      targetId: serviceId,
      metadata: { previousStatus: detail.service.status },
    });
    return getOperationsClientServiceDetail(workspaceId, res.rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export const proposeOperationsClientService = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: { reason?: string | null } = {},
) => updateServiceStatus(workspaceId, actor, serviceId, "proposed", input);

export const activateOperationsClientService = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: {
    agreedAt: Date;
    acceptanceMethod: string;
    updateBusinessRelationship?: boolean;
    updatePipelineStage?: boolean;
  },
) => updateServiceStatus(workspaceId, actor, serviceId, "active", input);

export const pauseOperationsClientService = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: { reason?: string | null; plannedResumeAt?: Date | null },
) => updateServiceStatus(workspaceId, actor, serviceId, "paused", input);

export const resumeOperationsClientService = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
) =>
  updateServiceStatus(workspaceId, actor, serviceId, "active", {
    agreedAt: new Date(),
    acceptanceMethod: "resume",
  });

export const requestOperationsClientServiceCancellation = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: { reason?: string | null; requestedEndDate?: Date | null },
) =>
  updateServiceStatus(
    workspaceId,
    actor,
    serviceId,
    "cancellation_pending",
    input,
  );

export const cancelOperationsClientService = (
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: { reason?: string | null },
) => updateServiceStatus(workspaceId, actor, serviceId, "cancelled", input);

export async function renewOperationsClientService(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: {
    renewalDate?: Date | null;
    nextReviewAt?: Date | null;
    reason?: string | null;
  },
) {
  const updated = await updateOperationsClientService(
    workspaceId,
    actor,
    serviceId,
    {
      renewalDate: input.renewalDate ?? null,
      nextReviewAt: input.nextReviewAt ?? null,
    },
  );
  if (updated && typeof updated !== "string") {
    await addActivity(actor, {
      clientServiceId: serviceId,
      businessId: updated.service.business_id,
      activityType: "service_renewed",
      title: "Service renewal recorded",
      detail: input.reason,
    });
  }
  return updated;
}

export async function changeOperationsClientServicePlan(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: {
    servicePlanId?: string | null;
    effectiveDate: Date;
    changeSummary: string;
    reason?: string | null;
    clientAgreed?: boolean;
  },
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  if (input.servicePlanId) {
    const plan = await getOperationsServicePlan(
      workspaceId,
      input.servicePlanId,
    );
    if (!plan) return "service_plan_not_found" as const;
  }
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO operations_client_service_amendments (
        client_service_id,
        previous_plan_id,
        new_plan_id,
        effective_date,
        change_summary,
        reason,
        client_agreed,
        previous_terms_json,
        new_terms_json,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, to_jsonb($8::jsonb), to_jsonb($9::jsonb), $10)
    `,
    [
      serviceId,
      detail.service.service_plan_id,
      input.servicePlanId ?? detail.service.service_plan_id,
      input.effectiveDate,
      requiredText(input.changeSummary, "change_summary"),
      textValue(input.reason),
      input.clientAgreed === true,
      JSON.stringify({
        servicePlanId: detail.service.service_plan_id,
        price: detail.service.agreed_price_minor,
        includedScope: detail.service.included_scope,
        excludedScope: detail.service.excluded_scope,
      }),
      JSON.stringify({
        servicePlanId: input.servicePlanId ?? detail.service.service_plan_id,
      }),
      actor.id,
    ],
  );
  const updated = await updateOperationsClientService(
    workspaceId,
    actor,
    serviceId,
    {
      servicePlanId: input.servicePlanId ?? detail.service.service_plan_id,
    },
  );
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "plan_changed",
    title: "Service plan change recorded",
    detail: input.changeSummary,
  });
  return updated;
}

export async function markOperationsServiceReviewComplete(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: OperationsClientServiceReviewInput,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const client = await ensureConnected();
  const review = await client.query<OperationsClientServiceReviewRow>(
    `
      INSERT INTO operations_client_service_reviews (
        client_service_id, business_id, review_completed_at, outcome,
        period_start, period_end, website_health_summary, incidents_summary,
        reports_summary, work_completed_summary, usage_summary,
        outstanding_client_actions, pricing_or_scope_notes,
        renewal_recommendation, next_review_at, internal_notes,
        created_by_user_id
      )
      SELECT $1, $2, now(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      WHERE EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = $1 AND s.business_id = $2 AND b.internal_workspace_id = $17)
      RETURNING *
    `,
    [
      serviceId,
      detail.service.business_id,
      input.outcome ?? "continue_unchanged",
      input.periodStart ?? null,
      input.periodEnd ?? null,
      textValue(input.websiteHealthSummary),
      textValue(input.incidentsSummary),
      textValue(input.reportsSummary),
      textValue(input.workCompletedSummary),
      textValue(input.usageSummary),
      textValue(input.outstandingClientActions),
      textValue(input.pricingOrScopeNotes),
      textValue(input.renewalRecommendation),
      input.nextReviewAt ?? null,
      textValue(input.internalNotes),
      actor.id,
      workspaceId,
    ],
  );
  if (input.nextReviewAt) {
    await client.query(
      `
        UPDATE operations_client_services
        SET next_review_at = $2,
            status = CASE WHEN status = 'review_due' THEN 'active' ELSE status END,
            updated_at = now()
       WHERE id = $1
          AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_client_services.business_id AND b.internal_workspace_id = $3)
     `,
      [serviceId, input.nextReviewAt, workspaceId],
    );
  }
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "review_completed",
    title: "Service review completed",
    detail: input.renewalRecommendation,
  });
  return review.rows[0] ?? null;
}

export async function addOperationsClientServiceSite(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: OperationsClientServiceSiteInput,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  if (
    !(await siteBelongsToBusiness(
      workspaceId,
      detail.service.business_id,
      input.siteId,
    ))
  ) {
    return "site_not_linked_to_business" as const;
  }
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    if (input.isPrimary) {
      await client.query(
        `
          UPDATE operations_client_service_sites
          SET is_primary = false
         WHERE client_service_id = $1 AND removed_at IS NULL
            AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_sites.client_service_id AND b.internal_workspace_id = $2)
        `,
        [serviceId, workspaceId],
      );
    }
    const res = await client.query<OperationsClientServiceSiteRow>(
      `
        INSERT INTO operations_client_service_sites (
          client_service_id, site_id, is_primary, monitoring_enabled,
          uptime_monitoring_enabled, scan_frequency_override,
          report_frequency_override, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
      [
        serviceId,
        input.siteId,
        input.isPrimary === true ||
          detail.sites.filter((site) => !site.removed_at).length === 0,
        input.monitoringEnabled !== false,
        input.uptimeMonitoringEnabled === true,
        input.scanFrequencyOverride ?? null,
        input.reportFrequencyOverride ?? null,
        textValue(input.notes),
      ],
    );
    await client.query("COMMIT");
    await addActivity(actor, {
      clientServiceId: serviceId,
      businessId: detail.service.business_id,
      activityType: "website_added",
      title: "Website added to managed service",
      relatedSiteId: input.siteId,
    });
    return res.rows[0] ?? null;
  } catch (err) {
    await client.query("ROLLBACK");
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") return "duplicate_service_site" as const;
    throw err;
  }
}

export async function updateOperationsClientServiceSite(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  siteId: string,
  input: Partial<OperationsClientServiceSiteInput>,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const existing = detail.sites.find(
    (site) => site.site_id === siteId && !site.removed_at,
  );
  if (!existing) return null;
  const client = await ensureConnected();
  if (input.isPrimary) {
    await client.query(
      `UPDATE operations_client_service_sites SET is_primary = false WHERE client_service_id = $1 AND removed_at IS NULL AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_sites.client_service_id AND b.internal_workspace_id = $2)`,
      [serviceId, workspaceId],
    );
  }
  const res = await client.query<OperationsClientServiceSiteRow>(
    `
      UPDATE operations_client_service_sites
      SET is_primary = $3,
          monitoring_enabled = $4,
          uptime_monitoring_enabled = $5,
          scan_frequency_override = $6,
          report_frequency_override = $7,
          notes = $8,
          updated_at = now()
     WHERE client_service_id = $1
       AND site_id = $2
       AND removed_at IS NULL
        AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_sites.client_service_id AND b.internal_workspace_id = $9)
      RETURNING *
    `,
    [
      serviceId,
      siteId,
      "isPrimary" in input ? input.isPrimary === true : existing.is_primary,
      "monitoringEnabled" in input
        ? input.monitoringEnabled !== false
        : existing.monitoring_enabled,
      "uptimeMonitoringEnabled" in input
        ? input.uptimeMonitoringEnabled === true
        : existing.uptime_monitoring_enabled,
      "scanFrequencyOverride" in input
        ? (input.scanFrequencyOverride ?? null)
        : existing.scan_frequency_override,
      "reportFrequencyOverride" in input
        ? (input.reportFrequencyOverride ?? null)
        : existing.report_frequency_override,
      "notes" in input ? textValue(input.notes) : existing.notes,
      workspaceId,
    ],
  );
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "website_coverage_updated",
    title: "Website coverage updated",
    relatedSiteId: siteId,
  });
  return res.rows[0] ?? null;
}

export async function removeOperationsClientServiceSite(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  siteId: string,
  reason?: string | null,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceSiteRow>(
    `
      UPDATE operations_client_service_sites
      SET removed_at = now(),
          monitoring_enabled = false,
          uptime_monitoring_enabled = false,
          updated_at = now()
     WHERE client_service_id = $1
       AND site_id = $2
       AND removed_at IS NULL
        AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_sites.client_service_id AND b.internal_workspace_id = $3)
     RETURNING *
    `,
    [serviceId, siteId, workspaceId],
  );
  if (!res.rows[0]) return null;
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "website_removed",
    title: "Website removed from active service coverage",
    detail: reason,
    relatedSiteId: siteId,
  });
  return res.rows[0];
}

export async function listOperationsClientServiceUsage(
  workspaceId: string,
  serviceId: string,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return [];
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceUsageRow>(
    `
      SELECT *
      FROM operations_client_service_usage
      WHERE client_service_id = $1
        AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_usage.client_service_id AND b.internal_workspace_id = $2)
      ORDER BY occurred_at DESC
      LIMIT 200
    `,
    [serviceId, workspaceId],
  );
  return res.rows;
}

export async function createOperationsClientServiceUsage(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: OperationsClientServiceUsageInput,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const occurredAt = input.occurredAt ?? new Date();
  const period =
    input.servicePeriodStart && input.servicePeriodEnd
      ? { start: input.servicePeriodStart, end: input.servicePeriodEnd }
      : calculateServicePeriod(detail.service, occurredAt);
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceUsageRow>(
    `
      INSERT INTO operations_client_service_usage (
        client_service_id, business_id, work_order_id, communication_id,
        operations_report_id, usage_type, description, minutes_used,
        fixes_used, occurred_at, service_period_start, service_period_end,
        is_out_of_scope, outside_scope_reason, internal_notes,
        created_by_user_id
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      WHERE EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = $1 AND s.business_id = $2 AND b.internal_workspace_id = $17)
      RETURNING *
    `,
    [
      serviceId,
      detail.service.business_id,
      input.workOrderId ?? null,
      input.communicationId ?? null,
      input.operationsReportId ?? null,
      input.usageType ?? "other",
      requiredText(input.description, "usage_description"),
      allowanceValue(input.minutesUsed),
      allowanceValue(input.fixesUsed),
      occurredAt,
      period.start,
      period.end,
      input.isOutOfScope === true,
      textValue(input.outsideScopeReason),
      textValue(input.internalNotes),
      actor.id,
      workspaceId,
    ],
  );
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: input.isOutOfScope
      ? "out_of_scope_work_identified"
      : "included_usage_recorded",
    title: input.isOutOfScope
      ? "Out-of-scope work recorded"
      : "Service usage recorded",
    detail: input.description,
    relatedReportId: input.operationsReportId ?? null,
    relatedWorkOrderId: input.workOrderId ?? null,
    relatedCommunicationId: input.communicationId ?? null,
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsClientServiceUsage(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  usageId: string,
  input: Partial<OperationsClientServiceUsageInput>,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const current = detail.usage.find((item) => item.id === usageId);
  if (!current) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceUsageRow>(
    `
      UPDATE operations_client_service_usage
      SET usage_type = $3,
          description = $4,
          minutes_used = $5,
          fixes_used = $6,
          occurred_at = $7,
          service_period_start = $8,
          service_period_end = $9,
          is_out_of_scope = $10,
          outside_scope_reason = $11,
          internal_notes = $12,
          updated_at = now()
      WHERE client_service_id = $1 AND id = $2
        AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_usage.client_service_id AND b.internal_workspace_id = $13)
      RETURNING *
    `,
    [
      serviceId,
      usageId,
      input.usageType ?? current.usage_type,
      "description" in input
        ? requiredText(input.description, "usage_description")
        : current.description,
      "minutesUsed" in input
        ? allowanceValue(input.minutesUsed)
        : current.minutes_used,
      "fixesUsed" in input
        ? allowanceValue(input.fixesUsed)
        : current.fixes_used,
      input.occurredAt ?? current.occurred_at,
      input.servicePeriodStart ?? current.service_period_start,
      input.servicePeriodEnd ?? current.service_period_end,
      "isOutOfScope" in input
        ? input.isOutOfScope === true
        : current.is_out_of_scope,
      "outsideScopeReason" in input
        ? textValue(input.outsideScopeReason)
        : current.outside_scope_reason,
      "internalNotes" in input
        ? textValue(input.internalNotes)
        : current.internal_notes,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_client_service_usage_updated",
    targetType: "operations_client_service_usage",
    targetId: usageId,
    metadata: { serviceId },
  });
  return res.rows[0] ?? null;
}

export async function deleteOperationsClientServiceUsage(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  usageId: string,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsClientServiceUsageRow>(
    `
      DELETE FROM operations_client_service_usage
      WHERE client_service_id = $1 AND id = $2
        AND EXISTS (SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = operations_client_service_usage.client_service_id AND b.internal_workspace_id = $3)
      RETURNING *
    `,
    [serviceId, usageId, workspaceId],
  );
  if (!res.rows[0]) return null;
  await recordAdminAuditLog(actor, {
    action: "operations_client_service_usage_deleted",
    targetType: "operations_client_service_usage",
    targetId: usageId,
    metadata: { serviceId },
  });
  return res.rows[0];
}

export async function getOperationsServiceAllowanceSummary(
  workspaceId: string,
  serviceId: string,
  occurredAt: Date = new Date(),
) {
  const client = await ensureConnected();
  const serviceRes = await client.query<OperationsClientServiceRow>(
    `SELECT s.* FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = $2 AND b.internal_workspace_id = $1`,
    [workspaceId, serviceId],
  );
  const service = serviceRes.rows[0];
  if (!service) throw new Error("service_not_found");
  const period = calculateServicePeriod(service, occurredAt);
  const usage = await client.query<{
    minutes_used: string | null;
    fixes_used: string | null;
  }>(
    `
      SELECT
        COALESCE(SUM(minutes_used), 0)::text AS minutes_used,
        COALESCE(SUM(fixes_used), 0)::text AS fixes_used
      FROM operations_client_service_usage
      WHERE client_service_id = $1
        AND service_period_start = $2
        AND service_period_end = $3
    `,
    [serviceId, period.start, period.end],
  );
  const minutesUsed =
    Number.parseInt(usage.rows[0]?.minutes_used ?? "0", 10) || 0;
  const fixesUsed = Number.parseInt(usage.rows[0]?.fixes_used ?? "0", 10) || 0;
  const rolloverEnabled = getOperationsServiceConfig().defaultAllowanceRollover;
  return {
    periodStart: period.start,
    periodEnd: period.end,
    minutesIncluded: service.included_support_minutes,
    minutesUsed,
    minutesRemaining:
      service.included_support_minutes == null
        ? null
        : service.included_support_minutes - minutesUsed,
    fixesIncluded: service.included_fix_count,
    fixesUsed,
    fixesRemaining:
      service.included_fix_count == null
        ? null
        : service.included_fix_count - fixesUsed,
    rolloverEnabled,
    warning:
      (service.included_support_minutes != null &&
        minutesUsed > service.included_support_minutes) ||
      (service.included_fix_count != null &&
        fixesUsed > service.included_fix_count)
        ? "This request may be outside the agreed service allowance."
        : null,
  } satisfies OperationsServiceAllowanceSummary;
}

export function buildServiceTaskKeys(
  serviceId: string,
  now: Date = new Date(),
) {
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    reviewAlerts: `service:${serviceId}:review-alerts:${monthKey}`,
    prepareReport: `service:${serviceId}:prepare-report:${monthKey}`,
    sendReport: `service:${serviceId}:send-report:${monthKey}`,
    serviceReview: `service:${serviceId}:service-review:${monthKey}`,
    renewal: `service:${serviceId}:renewal:${monthKey}`,
  };
}

export async function generateOperationsServiceTasks(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  now: Date = new Date(),
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  if (
    !["active", "pending_start", "review_due"].includes(detail.service.status)
  ) {
    return { createdOrUpdated: 0, skipped: true };
  }
  const keys = buildServiceTaskKeys(serviceId, now);
  const candidates: Array<{
    key: string;
    title: string;
    notes: string;
    dueAt: Date;
  }> = [
    {
      key: keys.reviewAlerts,
      title: `Review monitoring alerts for ${detail.service.service_number}`,
      notes:
        "Check covered websites for outages, failed scans and critical/high findings.",
      dueAt: addDays(now, 1),
    },
  ];
  if (detail.service.includes_monthly_report && detail.service.next_report_at) {
    candidates.push({
      key: keys.prepareReport,
      title: `Prepare managed-service report for ${detail.service.service_number}`,
      notes:
        "Use the Operations report workflow and review findings before delivery.",
      dueAt: detail.service.next_report_at,
    });
    candidates.push({
      key: keys.sendReport,
      title: `Send managed-service report for ${detail.service.service_number}`,
      notes: "Prepare a manual client communication and record delivery.",
      dueAt: addDays(detail.service.next_report_at, 2),
    });
  }
  if (detail.service.next_review_at) {
    candidates.push({
      key: keys.serviceReview,
      title: `Conduct service review for ${detail.service.service_number}`,
      notes:
        "Review website health, incidents, delivered reports, usage and renewal recommendation.",
      dueAt: detail.service.next_review_at,
    });
  }
  if (detail.service.renewal_reminder_at) {
    candidates.push({
      key: keys.renewal,
      title: `Review renewal for ${detail.service.service_number}`,
      notes: "Confirm renewal, amendments or cancellation discussion.",
      dueAt: detail.service.renewal_reminder_at,
    });
  }
  const client = await ensureConnected();
  let count = 0;
  for (const task of candidates) {
    await client.query(
      `
        INSERT INTO operations_tasks (
          business_id, contact_id, source_client_service_id, source_key,
          title, notes, due_at, status, created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
        ON CONFLICT (source_key)
        WHERE source_key IS NOT NULL
        DO UPDATE
        SET title = EXCLUDED.title,
            notes = EXCLUDED.notes,
            due_at = EXCLUDED.due_at,
            status = CASE WHEN operations_tasks.status = 'cancelled' THEN 'open' ELSE operations_tasks.status END,
            updated_at = now()
      `,
      [
        detail.service.business_id,
        detail.service.contact_id,
        serviceId,
        task.key,
        task.title,
        task.notes,
        task.dueAt,
        actor.id,
      ],
    );
    count += 1;
  }
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "recurring_tasks_generated",
    title: "Recurring service obligations generated",
    detail: `${count} obligations created or updated idempotently.`,
  });
  return { createdOrUpdated: count, skipped: false };
}

export async function getOperationsServiceSchedule(
  workspaceId: string,
  serviceId: string,
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  return {
    serviceId,
    nextReportAt: detail.service.next_report_at,
    nextReviewAt: detail.service.next_review_at,
    renewalReminderAt: detail.service.renewal_reminder_at,
    sites: detail.sites.map((site) => ({
      siteId: site.site_id,
      url: site.site_url,
      monitoringEnabled: site.monitoring_enabled,
      scheduleManagedByService: site.schedule_managed_by_service,
      scheduleEnabled: site.schedule_enabled,
      scheduleFrequency: site.schedule_frequency,
      nextScheduledAt: site.next_scheduled_at,
    })),
    tasks: detail.tasks,
  };
}

export async function createOperationsServiceMonthlyReport(
  workspaceId: string,
  actor: AdminActor,
  serviceId: string,
  input: {
    siteId?: string | null;
    title?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
  },
) {
  const detail = await getOperationsClientServiceDetail(workspaceId, serviceId);
  if (!detail) return null;
  const activeSites = detail.sites.filter((site) => !site.removed_at);
  const selectedSite = input.siteId
    ? activeSites.find((site) => site.site_id === input.siteId)
    : (activeSites.find((site) => site.is_primary) ?? activeSites[0]);
  if (!selectedSite) return "covered_site_required" as const;
  const client = await ensureConnected();
  const latestScan = await client.query<{ id: string }>(
    `
      SELECT id
      FROM scan_runs
     WHERE site_id = $1
        AND EXISTS (SELECT 1 FROM operations_client_service_sites css JOIN operations_client_services s ON s.id = css.client_service_id JOIN operations_businesses b ON b.id = s.business_id WHERE css.site_id = scan_runs.site_id AND css.client_service_id = $2 AND b.internal_workspace_id = $3)
        AND status = 'completed'
        AND finished_at IS NOT NULL
      ORDER BY finished_at DESC
      LIMIT 1
    `,
    [selectedSite.site_id, serviceId, workspaceId],
  );
  const scanRunId = latestScan.rows[0]?.id;
  if (!scanRunId) return "completed_scan_required" as const;
  const report = await createOperationsReport(workspaceId, actor, {
    businessId: detail.service.business_id,
    siteId: selectedSite.site_id,
    scanRunId,
    preparedContactId: detail.service.contact_id,
    reportType: "monthly_monitoring",
    title:
      textValue(input.title) ??
      `${detail.service.business_name ?? "Client"} monthly monitoring report`,
    coverDate: input.periodEnd ?? new Date(),
    allowDuplicate: true,
  });
  if (typeof report === "string") return report;
  await client.query(
    `
     UPDATE operations_reports
     SET client_service_id = $2,
         overall_summary = COALESCE(overall_summary, $3),
         scope_limitations = COALESCE(scope_limitations, $4),
         updated_at = now()
     WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_reports.business_id AND b.internal_workspace_id = $5)
    `,
    [
      report.report.id,
      serviceId,
      "Monthly monitoring report draft created from the managed-service workspace. Review before sending.",
      "This report covers reviewed website monitoring information for the selected service period. It is not a security audit, legal compliance report or automated notice of every scanner finding.",
      workspaceId,
    ],
  );
  await createOperationsClientServiceUsage(workspaceId, actor, serviceId, {
    operationsReportId: report.report.id,
    usageType: "report",
    description: "Monthly monitoring report created.",
    occurredAt: new Date(),
    servicePeriodStart: input.periodStart ?? null,
    servicePeriodEnd: input.periodEnd ?? null,
  });
  await addActivity(actor, {
    clientServiceId: serviceId,
    businessId: detail.service.business_id,
    activityType: "report_created",
    title: "Monthly monitoring report created",
    relatedReportId: report.report.id,
    relatedSiteId: selectedSite.site_id,
  });
  return report;
}

export async function getOperationsManagedServiceCounts(
  workspaceId: string,
): Promise<OperationsManagedServiceCounts> {
  const client = await ensureConnected();
  const [
    active,
    reportsDue,
    reviewsDue,
    attention,
    paused,
    renewals,
    cancellations,
    incidents,
    readyReports,
    clientActions,
  ] = await Promise.all([
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status IN ('active', 'review_due', 'pending_start')`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status IN ('active', 'review_due') AND s.next_report_at IS NOT NULL AND s.next_report_at <= now()`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status IN ('active', 'review_due') AND s.next_review_at IS NOT NULL AND s.next_review_at <= now()`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(DISTINCT css.site_id) AS count
        FROM operations_client_service_sites css
        JOIN operations_client_services s ON s.id = css.client_service_id
        JOIN operations_businesses b ON b.id = s.business_id
        WHERE b.internal_workspace_id = $1
          AND css.removed_at IS NULL
          AND s.status IN ('active', 'review_due')
          AND (
            EXISTS (
              SELECT 1 FROM uptime_incidents ui
              WHERE ui.site_id = css.site_id AND ui.status = 'open'
            )
            OR EXISTS (
              SELECT 1
              FROM scan_runs sr
              WHERE sr.site_id = css.site_id
                AND sr.status = 'failed'
                AND sr.started_at >= now() - interval '14 days'
            )
            OR EXISTS (
              SELECT 1
              FROM scan_issues si
              JOIN scan_runs sr ON sr.id = si.scan_run_id
              WHERE sr.site_id = css.site_id
                AND sr.status = 'completed'
                AND sr.started_at >= now() - interval '45 days'
                AND si.severity IN ('critical', 'high')
            )
          )
      `,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status = 'paused'`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status IN ('active', 'review_due', 'paused') AND s.renewal_reminder_at IS NOT NULL AND s.renewal_reminder_at <= now()`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND s.status = 'cancellation_pending'`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_client_service_incidents i JOIN operations_client_services s ON s.id = i.client_service_id JOIN operations_businesses b ON b.id = s.business_id WHERE b.internal_workspace_id = $1 AND i.review_state IN ('new', 'reviewing', 'confirmed')`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_reports r JOIN operations_businesses b ON b.id = r.business_id WHERE b.internal_workspace_id = $1 AND r.client_service_id IS NOT NULL AND r.report_type = 'monthly_monitoring' AND r.status = 'ready_to_send'`,
      [workspaceId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*) AS count FROM operations_tasks t JOIN operations_businesses b ON b.id = t.business_id WHERE b.internal_workspace_id = $1 AND t.source_client_service_id IS NOT NULL AND t.status IN ('open', 'snoozed') AND t.title ILIKE '%client%'`,
      [workspaceId],
    ),
  ]);
  return {
    activeServices: countValue(active.rows[0]),
    serviceReportsDue: countValue(reportsDue.rows[0]),
    serviceReviewsDue: countValue(reviewsDue.rows[0]),
    managedSitesNeedingAttention: countValue(attention.rows[0]),
    pausedServices: countValue(paused.rows[0]),
    serviceRenewalsApproaching: countValue(renewals.rows[0]),
    cancellationsPending: countValue(cancellations.rows[0]),
    activeServiceIncidents: countValue(incidents.rows[0]),
    monthlyReportsReadyToSend: countValue(readyReports.rows[0]),
    clientActionsOutstanding: countValue(clientActions.rows[0]),
  };
}
