import type {
  OperationsBusinessInput,
  OperationsCommunicationChannel,
  OperationsCommunicationDirection,
  OperationsCommunicationDraftContext,
  OperationsCommunicationInput,
  OperationsCommunicationStatus,
  OperationsCommunicationTemplateCategory,
  OperationsContactInput,
  OperationsAccessRequirementInput,
  OperationsAccessRequirementStatus,
  OperationsPipelineStage,
  OperationsClientServiceInput,
  OperationsClientServiceSiteInput,
  OperationsClientServiceStatus,
  OperationsClientServiceUpdateInput,
  OperationsClientServiceUsageInput,
  OperationsClientServiceReviewInput,
  OperationsQuoteInput,
  OperationsQuoteItemInput,
  OperationsQuoteItemType,
  OperationsQuoteStatus,
  OperationsQuoteUpdateInput,
  OperationsServiceBillingCadence,
  OperationsServicePlanInput,
  OperationsServicePlanType,
  OperationsServiceReportFrequency,
  OperationsServiceReviewFrequency,
  OperationsServiceScanFrequency,
  OperationsServiceUsageType,
  OperationsRetestStatus,
  OperationsReportClientPriority,
  OperationsReportComparisonStatus,
  OperationsReportCreateInput,
  OperationsReportFindingUpdateInput,
  OperationsReportStatus,
  OperationsReportType,
  OperationsReportUpdateInput,
  OperationsRelationshipType,
  OperationsSummary,
  OperationsTaskStatus,
  OperationsWorkItemInput,
  OperationsWorkItemStatus,
  OperationsWorkOrderPriority,
  OperationsWorkOrderStatus,
  OperationsWorkOrderUpdateInput,
} from "@scanlark/db";
import { normalizeSiteUrlInput } from "./siteUrl";

export const OPERATIONS_PIPELINE_STAGES = [
  "discovered",
  "researched",
  "ready_to_contact",
  "email_sent",
  "replied",
  "report_requested",
  "report_sent",
  "quote_sent",
  "won",
  "ongoing_client",
  "closed",
] as const;

export const OPERATIONS_RELATIONSHIP_TYPES = [
  "prospect",
  "client",
  "former_client",
  "partner",
  "other",
] as const;

export const OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES = [
  "warm_introduction",
  "cold_outreach",
  "report_offer",
  "report_delivery",
  "no_reply_follow_up",
  "interested_reply",
  "pre_quote_questions",
  "quote_delivery",
  "access_request",
  "work_started",
  "work_completed",
  "monitoring_offer",
  "monthly_update",
  "testimonial_request",
  "referral_request",
  "managed_service_proposal",
  "service_activation",
  "monitoring_started",
  "monthly_report_delivery",
  "website_issue_notification",
  "client_action_required",
  "allowance_nearing_limit",
  "work_outside_plan",
  "service_review",
  "renewal_discussion",
  "service_paused",
  "cancellation_acknowledgement",
  "service_ended",
  "custom",
] as const;

export const OPERATIONS_COMMUNICATION_DIRECTIONS = [
  "outbound",
  "inbound",
  "internal_note",
] as const;

export const OPERATIONS_COMMUNICATION_CHANNELS = [
  "email",
  "phone",
  "video_call",
  "in_person",
  "other",
] as const;

export const OPERATIONS_COMMUNICATION_STATUSES = [
  "draft",
  "ready",
  "sent",
  "received",
  "cancelled",
] as const;

export const OPERATIONS_TASK_STATUSES = [
  "open",
  "completed",
  "snoozed",
  "cancelled",
] as const;

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

export const OPERATIONS_QUOTE_STATUSES = [
  "draft",
  "needs_review",
  "ready_to_send",
  "sent",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "converted_to_work",
] as const;

export const OPERATIONS_QUOTE_ITEM_TYPES = [
  "website_fix",
  "investigation",
  "configuration",
  "content_change",
  "monitoring_setup",
  "retest",
  "consultation",
  "other",
] as const;

export const OPERATIONS_ACCESS_REQUIREMENT_STATUSES = [
  "not_required",
  "not_requested",
  "requested",
  "received",
  "verified",
  "no_longer_needed",
] as const;

export const OPERATIONS_WORK_ORDER_STATUSES = [
  "not_started",
  "awaiting_access",
  "ready_to_start",
  "in_progress",
  "waiting_for_client",
  "blocked",
  "ready_for_testing",
  "testing",
  "completed",
  "cancelled",
] as const;

export const OPERATIONS_WORK_ORDER_PRIORITIES = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;

export const OPERATIONS_WORK_ITEM_STATUSES = [
  "to_do",
  "in_progress",
  "waiting_for_client",
  "blocked",
  "ready_for_testing",
  "completed",
  "cancelled",
] as const;

export const OPERATIONS_RETEST_STATUSES = [
  "not_required",
  "pending",
  "passed",
  "failed",
  "unable_to_verify",
] as const;

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

export const SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS = [
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
] as const;

type ClientTemplatePlaceholder =
  (typeof SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS)[number];

const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;
const EMAIL_ALLOWED_LOCAL = new Set([
  "!",
  "#",
  "$",
  "%",
  "&",
  "'",
  "*",
  "+",
  "-",
  "/",
  "=",
  "?",
  "^",
  "_",
  "`",
  "{",
  "|",
  "}",
  "~",
  ".",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIPELINE_STAGE_SET = new Set<string>(OPERATIONS_PIPELINE_STAGES);
const RELATIONSHIP_TYPE_SET = new Set<string>(OPERATIONS_RELATIONSHIP_TYPES);
const COMMUNICATION_TEMPLATE_CATEGORY_SET = new Set<string>(
  OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES,
);
const COMMUNICATION_DIRECTION_SET = new Set<string>(
  OPERATIONS_COMMUNICATION_DIRECTIONS,
);
const COMMUNICATION_CHANNEL_SET = new Set<string>(
  OPERATIONS_COMMUNICATION_CHANNELS,
);
const COMMUNICATION_STATUS_SET = new Set<string>(
  OPERATIONS_COMMUNICATION_STATUSES,
);
const TASK_STATUS_SET = new Set<string>(OPERATIONS_TASK_STATUSES);
const REPORT_STATUS_SET = new Set<string>(OPERATIONS_REPORT_STATUSES);
const REPORT_TYPE_SET = new Set<string>(OPERATIONS_REPORT_TYPES);
const REPORT_CLIENT_PRIORITY_SET = new Set<string>(
  OPERATIONS_REPORT_CLIENT_PRIORITIES,
);
const REPORT_COMPARISON_STATUS_SET = new Set<string>(
  OPERATIONS_REPORT_COMPARISON_STATUSES,
);
const QUOTE_STATUS_SET = new Set<string>(OPERATIONS_QUOTE_STATUSES);
const QUOTE_ITEM_TYPE_SET = new Set<string>(OPERATIONS_QUOTE_ITEM_TYPES);
const ACCESS_REQUIREMENT_STATUS_SET = new Set<string>(
  OPERATIONS_ACCESS_REQUIREMENT_STATUSES,
);
const WORK_ORDER_STATUS_SET = new Set<string>(OPERATIONS_WORK_ORDER_STATUSES);
const WORK_ORDER_PRIORITY_SET = new Set<string>(
  OPERATIONS_WORK_ORDER_PRIORITIES,
);
const WORK_ITEM_STATUS_SET = new Set<string>(OPERATIONS_WORK_ITEM_STATUSES);
const RETEST_STATUS_SET = new Set<string>(OPERATIONS_RETEST_STATUSES);
const SERVICE_PLAN_TYPE_SET = new Set<string>(OPERATIONS_SERVICE_PLAN_TYPES);
const SERVICE_BILLING_CADENCE_SET = new Set<string>(
  OPERATIONS_SERVICE_BILLING_CADENCES,
);
const SERVICE_SCAN_FREQUENCY_SET = new Set<string>(
  OPERATIONS_SERVICE_SCAN_FREQUENCIES,
);
const SERVICE_REPORT_FREQUENCY_SET = new Set<string>(
  OPERATIONS_SERVICE_REPORT_FREQUENCIES,
);
const SERVICE_REVIEW_FREQUENCY_SET = new Set<string>(
  OPERATIONS_SERVICE_REVIEW_FREQUENCIES,
);
const CLIENT_SERVICE_STATUS_SET = new Set<string>(
  OPERATIONS_CLIENT_SERVICE_STATUSES,
);
const SERVICE_USAGE_TYPE_SET = new Set<string>(OPERATIONS_SERVICE_USAGE_TYPES);
const SERVICE_REVIEW_OUTCOME_SET = new Set<string>(
  OPERATIONS_SERVICE_REVIEW_OUTCOMES,
);

const DEFAULT_FOLLOW_UP_BUSINESS_DAYS_BY_CATEGORY: Partial<
  Record<OperationsCommunicationTemplateCategory, number>
> = {
  warm_introduction: 4,
  cold_outreach: 4,
  report_offer: 4,
  report_delivery: 3,
  quote_delivery: 5,
  work_completed: 7,
  testimonial_request: 7,
};

export function serializeDate(value: Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

function isAsciiLetterOrDigit(char: string) {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function isAllowedLocalChar(char: string) {
  return isAsciiLetterOrDigit(char) || EMAIL_ALLOWED_LOCAL.has(char);
}

function isValidDomainLabel(label: string) {
  if (!label || label.length > 63) return false;
  if (!isAsciiLetterOrDigit(label[0])) return false;
  if (!isAsciiLetterOrDigit(label[label.length - 1])) return false;
  for (const char of label) {
    if (!isAsciiLetterOrDigit(char) && char !== "-") return false;
  }
  return true;
}

function isValidEmailAddress(value: string) {
  if (value.length === 0 || value.length > EMAIL_MAX_LENGTH) return false;
  if (/\s/.test(value)) return false;

  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (!local || !domain) return false;
  if (local.length > EMAIL_LOCAL_MAX_LENGTH) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  for (const char of local) {
    if (!isAllowedLocalChar(char)) return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every(isValidDomainLabel);
}

function boundedInteger(value: unknown, key: string) {
  if (value == null || value === "") return null;
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 60) {
    throw new Error(`invalid_${key}`);
  }
  return parsed;
}

export function getConfiguredDefaultFollowUpBusinessDays(
  category: OperationsCommunicationTemplateCategory,
  env: Record<string, string | undefined> = process.env,
) {
  const configured = env.OPERATIONS_DEFAULT_FOLLOW_UP_BUSINESS_DAYS;
  if (configured?.trim()) {
    const parsed = Number.parseInt(configured.trim(), 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 60) {
      return parsed;
    }
  }
  return DEFAULT_FOLLOW_UP_BUSINESS_DAYS_BY_CATEGORY[category] ?? null;
}

export function addBusinessDays(start: Date, businessDays: number) {
  const date = new Date(start);
  if (businessDays <= 0) return date;
  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

export function textField(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredTextField(input: Record<string, unknown>, key: string) {
  const value = textField(input, key);
  if (!value) throw new Error(`${key}_required`);
  return value;
}

function assertPlainClientText(value: string | null | undefined, key: string) {
  if (!value) return value;
  if (value.length > 8000) throw new Error(`${key}_too_long`);
  if (/[<>]/.test(value)) throw new Error("unsafe_html");
  return value;
}

function requiredClientTextField(input: Record<string, unknown>, key: string) {
  return assertPlainClientText(requiredTextField(input, key), key) as string;
}

function optionalClientTextField(input: Record<string, unknown>, key: string) {
  return assertPlainClientText(optionalTextField(input, key), key);
}

export function optionalTextField(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return undefined;
  return textField(input, key);
}

export function parseDateField(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return undefined;
  const value = input[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key}_invalid`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${key}_invalid`);
  return date;
}

export function parseRequiredDateField(
  input: Record<string, unknown>,
  key: string,
) {
  const value = parseDateField(input, key);
  if (!value) throw new Error(`${key}_required`);
  return value;
}

export function parsePipelineStage(
  value: unknown,
): OperationsPipelineStage | null {
  if (typeof value !== "string") return null;
  return PIPELINE_STAGE_SET.has(value)
    ? (value as OperationsPipelineStage)
    : null;
}

export function parseRelationshipType(
  value: unknown,
): OperationsRelationshipType | null {
  if (typeof value !== "string") return null;
  return RELATIONSHIP_TYPE_SET.has(value)
    ? (value as OperationsRelationshipType)
    : null;
}

function parseTemplateCategory(
  value: unknown,
): OperationsCommunicationTemplateCategory | null {
  if (typeof value !== "string") return null;
  return COMMUNICATION_TEMPLATE_CATEGORY_SET.has(value)
    ? (value as OperationsCommunicationTemplateCategory)
    : null;
}

function parseCommunicationDirection(
  value: unknown,
): OperationsCommunicationDirection | null {
  if (typeof value !== "string") return null;
  return COMMUNICATION_DIRECTION_SET.has(value)
    ? (value as OperationsCommunicationDirection)
    : null;
}

function parseCommunicationChannel(
  value: unknown,
): OperationsCommunicationChannel | null {
  if (typeof value !== "string") return null;
  return COMMUNICATION_CHANNEL_SET.has(value)
    ? (value as OperationsCommunicationChannel)
    : null;
}

function parseCommunicationStatus(
  value: unknown,
): OperationsCommunicationStatus | null {
  if (typeof value !== "string") return null;
  return COMMUNICATION_STATUS_SET.has(value)
    ? (value as OperationsCommunicationStatus)
    : null;
}

export function parseTaskStatus(value: unknown): OperationsTaskStatus | null {
  if (typeof value !== "string") return null;
  return TASK_STATUS_SET.has(value) ? (value as OperationsTaskStatus) : null;
}

export function parseOperationsReportStatus(
  value: unknown,
): OperationsReportStatus | null {
  if (typeof value !== "string") return null;
  return REPORT_STATUS_SET.has(value)
    ? (value as OperationsReportStatus)
    : null;
}

export function parseOperationsReportType(
  value: unknown,
): OperationsReportType | null {
  if (typeof value !== "string") return null;
  return REPORT_TYPE_SET.has(value) ? (value as OperationsReportType) : null;
}

export function parseOperationsReportClientPriority(
  value: unknown,
): OperationsReportClientPriority | null {
  if (typeof value !== "string") return null;
  return REPORT_CLIENT_PRIORITY_SET.has(value)
    ? (value as OperationsReportClientPriority)
    : null;
}

export function parseOperationsReportComparisonStatus(
  value: unknown,
): OperationsReportComparisonStatus | null {
  if (typeof value !== "string") return null;
  return REPORT_COMPARISON_STATUS_SET.has(value)
    ? (value as OperationsReportComparisonStatus)
    : null;
}

export function parseOperationsQuoteStatus(
  value: unknown,
): OperationsQuoteStatus | null {
  if (typeof value !== "string") return null;
  return QUOTE_STATUS_SET.has(value) ? (value as OperationsQuoteStatus) : null;
}

export function parseOperationsQuoteItemType(
  value: unknown,
): OperationsQuoteItemType | null {
  if (typeof value !== "string") return null;
  return QUOTE_ITEM_TYPE_SET.has(value)
    ? (value as OperationsQuoteItemType)
    : null;
}

export function parseOperationsAccessRequirementStatus(
  value: unknown,
): OperationsAccessRequirementStatus | null {
  if (typeof value !== "string") return null;
  return ACCESS_REQUIREMENT_STATUS_SET.has(value)
    ? (value as OperationsAccessRequirementStatus)
    : null;
}

export function parseOperationsWorkOrderStatus(
  value: unknown,
): OperationsWorkOrderStatus | null {
  if (typeof value !== "string") return null;
  return WORK_ORDER_STATUS_SET.has(value)
    ? (value as OperationsWorkOrderStatus)
    : null;
}

export function parseOperationsWorkOrderPriority(
  value: unknown,
): OperationsWorkOrderPriority | null {
  if (typeof value !== "string") return null;
  return WORK_ORDER_PRIORITY_SET.has(value)
    ? (value as OperationsWorkOrderPriority)
    : null;
}

export function parseOperationsWorkItemStatus(
  value: unknown,
): OperationsWorkItemStatus | null {
  if (typeof value !== "string") return null;
  return WORK_ITEM_STATUS_SET.has(value)
    ? (value as OperationsWorkItemStatus)
    : null;
}

export function parseOperationsRetestStatus(
  value: unknown,
): OperationsRetestStatus | null {
  if (typeof value !== "string") return null;
  return RETEST_STATUS_SET.has(value)
    ? (value as OperationsRetestStatus)
    : null;
}

export function parseOperationsServicePlanType(
  value: unknown,
): OperationsServicePlanType | null {
  if (typeof value !== "string") return null;
  return SERVICE_PLAN_TYPE_SET.has(value)
    ? (value as OperationsServicePlanType)
    : null;
}

export function parseOperationsServiceBillingCadence(
  value: unknown,
): OperationsServiceBillingCadence | null {
  if (typeof value !== "string") return null;
  return SERVICE_BILLING_CADENCE_SET.has(value)
    ? (value as OperationsServiceBillingCadence)
    : null;
}

export function parseOperationsServiceScanFrequency(
  value: unknown,
): OperationsServiceScanFrequency | null {
  if (typeof value !== "string") return null;
  return SERVICE_SCAN_FREQUENCY_SET.has(value)
    ? (value as OperationsServiceScanFrequency)
    : null;
}

export function parseOperationsServiceReportFrequency(
  value: unknown,
): OperationsServiceReportFrequency | null {
  if (typeof value !== "string") return null;
  return SERVICE_REPORT_FREQUENCY_SET.has(value)
    ? (value as OperationsServiceReportFrequency)
    : null;
}

export function parseOperationsServiceReviewFrequency(
  value: unknown,
): OperationsServiceReviewFrequency | null {
  if (typeof value !== "string") return null;
  return SERVICE_REVIEW_FREQUENCY_SET.has(value)
    ? (value as OperationsServiceReviewFrequency)
    : null;
}

export function parseOperationsClientServiceStatus(
  value: unknown,
): OperationsClientServiceStatus | null {
  if (typeof value !== "string") return null;
  return CLIENT_SERVICE_STATUS_SET.has(value)
    ? (value as OperationsClientServiceStatus)
    : null;
}

export function parseOperationsServiceUsageType(
  value: unknown,
): OperationsServiceUsageType | null {
  if (typeof value !== "string") return null;
  return SERVICE_USAGE_TYPE_SET.has(value)
    ? (value as OperationsServiceUsageType)
    : null;
}

export function parseOperationsServiceReviewOutcome(
  value: unknown,
): OperationsClientServiceReviewInput["outcome"] | null {
  if (typeof value !== "string") return null;
  return SERVICE_REVIEW_OUTCOME_SET.has(value)
    ? (value as OperationsClientServiceReviewInput["outcome"])
    : null;
}

export function optionalUuidField(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return undefined;
  const value = input[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`invalid_${key}`);
  }
  return value;
}

function getWebsiteDomain(websiteUrl: string | null | undefined) {
  if (!websiteUrl) return "";
  try {
    return new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function formatTemplateDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function contactParts(context: OperationsCommunicationDraftContext | null) {
  const firstName = context?.contact?.first_name?.trim() ?? "";
  const lastName = context?.contact?.last_name?.trim() ?? "";
  const contactName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    firstName,
    lastName,
    contactName:
      contactName || context?.contact?.email || context?.business.name || "",
  };
}

export function renderClientCommunicationTemplate(
  template: { subject_template: string; body_template: string },
  context: OperationsCommunicationDraftContext | null,
  options: {
    senderName?: string | null;
    senderEmail?: string | null;
    followUpDate?: Date | null;
    reportName?: string | null;
  } = {},
) {
  const contacts = contactParts(context);
  const websiteUrl = context?.site?.url ?? context?.business.website_url ?? "";
  const values: Record<ClientTemplatePlaceholder, string> = {
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    contactName: contacts.contactName,
    businessName: context?.business.name ?? "",
    websiteUrl,
    websiteDomain: getWebsiteDomain(websiteUrl),
    senderName: options.senderName?.trim() ?? "",
    senderEmail: options.senderEmail?.trim() ?? "",
    reportName: options.reportName?.trim() ?? "",
    criticalIssueCount:
      context?.site?.critical_issue_count == null
        ? ""
        : String(context.site.critical_issue_count),
    highIssueCount:
      context?.site?.high_issue_count == null
        ? ""
        : String(context.site.high_issue_count),
    topFinding: context?.site?.top_finding?.trim() ?? "",
    followUpDate: formatTemplateDate(options.followUpDate),
  };
  const unresolved = new Set<string>();
  const supported = new Set<string>(SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS);
  const render = (value: string) =>
    value.replace(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g, (match, key) => {
      if (!supported.has(key)) {
        unresolved.add(key);
        return match;
      }
      const rendered = values[key as ClientTemplatePlaceholder];
      if (!rendered) {
        unresolved.add(key);
        return match;
      }
      return rendered;
    });
  return {
    subject: render(template.subject_template),
    body: render(template.body_template),
    unresolvedPlaceholders: Array.from(unresolved).sort(),
  };
}

export function parseOperationsBusinessInput(
  body: unknown,
  options: { partial?: boolean } = {},
): Partial<OperationsBusinessInput> & {
  primaryContact?: OperationsContactInput | null;
  initialNote?: string | null;
  markContactedNow?: boolean;
  clearNextFollowUp?: boolean;
} {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const name = optionalTextField(record, "name");
  if (!options.partial && !name) throw new Error("business_name_required");
  if (options.partial && "name" in record && !name) {
    throw new Error("business_name_required");
  }

  let pipelineStage: OperationsPipelineStage | undefined;
  if ("pipelineStage" in record) {
    const parsed = parsePipelineStage(record.pipelineStage);
    if (!parsed) throw new Error("invalid_pipeline_stage");
    pipelineStage = parsed;
  }

  let relationshipType: OperationsRelationshipType | undefined;
  if ("relationshipType" in record) {
    const parsed = parseRelationshipType(record.relationshipType);
    if (!parsed) throw new Error("invalid_relationship_type");
    relationshipType = parsed;
  }

  const generalEmail = optionalTextField(record, "generalEmail");
  if (generalEmail && !isValidEmailAddress(generalEmail)) {
    throw new Error("invalid_email");
  }

  let websiteUrl = optionalTextField(record, "websiteUrl");
  if (websiteUrl) {
    websiteUrl = normalizeSiteUrlInput(websiteUrl);
  }

  const primaryContactRecord =
    record.primaryContact && typeof record.primaryContact === "object"
      ? (record.primaryContact as Record<string, unknown>)
      : null;
  const primaryContact = primaryContactRecord
    ? parseOperationsContactInput(primaryContactRecord, { allowEmpty: true })
    : null;

  return {
    ...(name ? { name } : {}),
    ...(pipelineStage !== undefined ? { pipelineStage } : {}),
    ...(relationshipType !== undefined ? { relationshipType } : {}),
    source: optionalTextField(record, "source"),
    businessType: optionalTextField(record, "businessType"),
    location: optionalTextField(record, "location"),
    phone: optionalTextField(record, "phone"),
    generalEmail,
    websiteUrl,
    lastContactedAt: parseDateField(record, "lastContactedAt"),
    nextFollowUpAt: parseDateField(record, "nextFollowUpAt"),
    nextAction: optionalTextField(record, "nextAction"),
    primaryContact,
    initialNote: optionalTextField(record, "initialNote"),
    markContactedNow: record.markContactedNow === true,
    clearNextFollowUp: record.clearNextFollowUp === true,
  };
}

export function parseOperationsContactInput(
  body: unknown,
  options: { allowEmpty?: boolean } = {},
): OperationsContactInput {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const email = optionalTextField(record, "email");
  if (email && !isValidEmailAddress(email)) {
    throw new Error("invalid_contact_email");
  }
  const contact = {
    firstName: optionalTextField(record, "firstName"),
    lastName: optionalTextField(record, "lastName"),
    email,
    phone: optionalTextField(record, "phone"),
    jobTitle: optionalTextField(record, "jobTitle"),
    notes: optionalTextField(record, "notes"),
    isPrimary: record.isPrimary === true,
    doNotContact: record.doNotContact === true,
    doNotContactReason: optionalTextField(record, "doNotContactReason"),
    preferredChannel: optionalTextField(record, "preferredChannel"),
  };
  if (
    contact.preferredChannel &&
    !OPERATIONS_COMMUNICATION_CHANNELS.includes(
      contact.preferredChannel as OperationsCommunicationChannel,
    )
  ) {
    throw new Error("invalid_preferred_channel");
  }
  if (
    !options.allowEmpty &&
    !contact.firstName &&
    !contact.lastName &&
    !contact.email &&
    !contact.phone
  ) {
    throw new Error("contact_details_required");
  }
  return contact;
}

export function parseOperationsCommunicationTemplateInput(
  body: unknown,
  options: { partial?: boolean } = {},
) {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: Partial<{
    name: string;
    category: OperationsCommunicationTemplateCategory;
    subjectTemplate: string;
    bodyTemplate: string;
    defaultFollowUpBusinessDays: number | null;
    isActive: boolean;
  }> = {};

  if (!options.partial || "name" in record) {
    parsed.name = requiredTextField(record, "name");
  }
  if (!options.partial || "category" in record) {
    const category = parseTemplateCategory(record.category);
    if (!category) throw new Error("invalid_template_category");
    parsed.category = category;
  }
  if (!options.partial || "subjectTemplate" in record) {
    parsed.subjectTemplate = requiredTextField(record, "subjectTemplate");
  }
  if (!options.partial || "bodyTemplate" in record) {
    parsed.bodyTemplate = requiredTextField(record, "bodyTemplate");
  }
  if ("isActive" in record) {
    parsed.isActive = record.isActive !== false;
  }
  if ("defaultFollowUpBusinessDays" in record) {
    parsed.defaultFollowUpBusinessDays = boundedInteger(
      record.defaultFollowUpBusinessDays,
      "default_follow_up_business_days",
    );
  }
  return parsed;
}

export function parseOperationsCommunicationInput(
  body: unknown,
  options: { partial?: boolean } = {},
): Partial<OperationsCommunicationInput> {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: Partial<OperationsCommunicationInput> = {};

  parsed.contactId = optionalUuidField(record, "contactId");
  parsed.templateId = optionalUuidField(record, "templateId");
  if ("direction" in record) {
    const direction = parseCommunicationDirection(record.direction);
    if (!direction) throw new Error("invalid_communication_direction");
    parsed.direction = direction;
  }
  if ("channel" in record) {
    const channel = parseCommunicationChannel(record.channel);
    if (!channel) throw new Error("invalid_communication_channel");
    parsed.channel = channel;
  }
  if ("status" in record) {
    const status = parseCommunicationStatus(record.status);
    if (!status) throw new Error("invalid_communication_status");
    parsed.status = status;
  }
  if (!options.partial || "body" in record) {
    parsed.body = requiredTextField(record, "body");
  }
  if ("subject" in record)
    parsed.subject = optionalTextField(record, "subject");
  parsed.occurredAt = parseDateField(record, "occurredAt");
  parsed.sentAt = parseDateField(record, "sentAt");
  parsed.receivedAt = parseDateField(record, "receivedAt");
  parsed.followUpAt = parseDateField(record, "followUpAt");
  if ("externalMessageId" in record) {
    parsed.externalMessageId = optionalTextField(record, "externalMessageId");
  }
  if ("taskTitle" in record) {
    parsed.taskTitle = optionalTextField(record, "taskTitle");
  }
  if ("taskNotes" in record) {
    parsed.taskNotes = optionalTextField(record, "taskNotes");
  }
  return parsed;
}

export function parseOperationsTaskInput(
  body: unknown,
  options: { partial?: boolean } = {},
) {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: Partial<{
    businessId: string;
    contactId: string | null;
    title: string;
    notes: string | null;
    dueAt: Date;
    status: OperationsTaskStatus;
  }> = {};
  parsed.contactId = optionalUuidField(record, "contactId");
  if (!options.partial || "businessId" in record) {
    const businessId = optionalUuidField(record, "businessId");
    if (!businessId) throw new Error("invalid_businessId");
    parsed.businessId = businessId;
  }
  if (!options.partial || "title" in record) {
    parsed.title = requiredTextField(record, "title");
  }
  if ("notes" in record) parsed.notes = optionalTextField(record, "notes");
  if (!options.partial || "dueAt" in record) {
    parsed.dueAt = parseRequiredDateField(record, "dueAt");
  }
  if ("status" in record) {
    const status = parseTaskStatus(record.status);
    if (!status) throw new Error("invalid_task_status");
    parsed.status = status;
  }
  return parsed;
}

export function parseOperationsReportCreateInput(
  body: unknown,
): OperationsReportCreateInput {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const businessId = optionalUuidField(record, "businessId");
  const siteId = optionalUuidField(record, "siteId");
  const scanRunId = optionalUuidField(record, "scanRunId");
  if (!businessId) throw new Error("invalid_businessId");
  if (!siteId) throw new Error("invalid_siteId");
  if (!scanRunId) throw new Error("invalid_scanRunId");
  const reportType = parseOperationsReportType(
    record.reportType ?? "initial_health_check",
  );
  if (!reportType) throw new Error("invalid_report_type");
  return {
    businessId,
    siteId,
    scanRunId,
    reportType,
    title: requiredClientTextField(record, "title"),
    preparedContactId: optionalUuidField(record, "preparedContactId"),
    preparedFor: optionalClientTextField(record, "preparedFor"),
    preparedBy: optionalClientTextField(record, "preparedBy"),
    coverDate: parseDateField(record, "coverDate"),
    allowDuplicate: record.allowDuplicate === true,
    supersedesReportId: optionalUuidField(record, "supersedesReportId"),
    comparisonReportId: optionalUuidField(record, "comparisonReportId"),
  };
}

export function parseOperationsReportUpdateInput(
  body: unknown,
): OperationsReportUpdateInput {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: OperationsReportUpdateInput = {};
  if ("title" in record) {
    parsed.title = requiredClientTextField(record, "title");
  }
  if ("status" in record) {
    const status = parseOperationsReportStatus(record.status);
    if (!status) throw new Error("invalid_report_status");
    parsed.status = status;
  }
  if ("reportType" in record) {
    const reportType = parseOperationsReportType(record.reportType);
    if (!reportType) throw new Error("invalid_report_type");
    parsed.reportType = reportType;
  }
  if ("executiveSummary" in record) {
    parsed.executiveSummary = optionalClientTextField(
      record,
      "executiveSummary",
    );
  }
  if ("overallSummary" in record) {
    parsed.overallSummary = optionalClientTextField(record, "overallSummary");
  }
  if ("mainStrengths" in record) {
    parsed.mainStrengths = optionalClientTextField(record, "mainStrengths");
  }
  if ("mainConcerns" in record) {
    parsed.mainConcerns = optionalClientTextField(record, "mainConcerns");
  }
  if ("recommendedFirstSteps" in record) {
    parsed.recommendedFirstSteps = optionalClientTextField(
      record,
      "recommendedFirstSteps",
    );
  }
  if ("scopeLimitations" in record) {
    parsed.scopeLimitations = optionalClientTextField(
      record,
      "scopeLimitations",
    );
  }
  if ("preparedFor" in record) {
    parsed.preparedFor = optionalClientTextField(record, "preparedFor");
  }
  if ("preparedBy" in record) {
    parsed.preparedBy = optionalClientTextField(record, "preparedBy");
  }
  if ("preparedContactId" in record) {
    parsed.preparedContactId = optionalUuidField(record, "preparedContactId");
  }
  parsed.coverDate = parseDateField(record, "coverDate");
  if ("validUntil" in record) {
    parsed.validUntil = parseDateField(record, "validUntil");
  }
  if ("noMajorFindingsWaived" in record) {
    parsed.noMajorFindingsWaived = record.noMajorFindingsWaived === true;
  }
  if ("displaySettings" in record) {
    const settings =
      record.displaySettings && typeof record.displaySettings === "object"
        ? (record.displaySettings as Record<string, unknown>)
        : {};
    parsed.displaySettings = {
      displayLogo:
        typeof settings.displayLogo === "boolean"
          ? settings.displayLogo
          : undefined,
      displayScanlarkContact:
        typeof settings.displayScanlarkContact === "boolean"
          ? settings.displayScanlarkContact
          : undefined,
      displayWebsiteHealthScore:
        typeof settings.displayWebsiteHealthScore === "boolean"
          ? settings.displayWebsiteHealthScore
          : undefined,
      displayTechnicalAppendix:
        typeof settings.displayTechnicalAppendix === "boolean"
          ? settings.displayTechnicalAppendix
          : undefined,
      displayMethodologyLimitations:
        typeof settings.displayMethodologyLimitations === "boolean"
          ? settings.displayMethodologyLimitations
          : undefined,
      displayPricingOffer:
        typeof settings.displayPricingOffer === "boolean"
          ? settings.displayPricingOffer
          : undefined,
      footerText: optionalClientTextField(settings, "footerText"),
    };
  }
  return parsed;
}

export function parseOperationsReportFindingUpdateInput(
  body: unknown,
): OperationsReportFindingUpdateInput {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: OperationsReportFindingUpdateInput = {};
  if ("clientPriority" in record) {
    const priority = parseOperationsReportClientPriority(record.clientPriority);
    if (!priority) throw new Error("invalid_client_priority");
    parsed.clientPriority = priority;
  }
  if ("title" in record)
    parsed.title = requiredClientTextField(record, "title");
  if ("clientExplanation" in record) {
    parsed.clientExplanation = optionalClientTextField(
      record,
      "clientExplanation",
    );
  }
  if ("whyItMatters" in record) {
    parsed.whyItMatters = optionalClientTextField(record, "whyItMatters");
  }
  if ("recommendedAction" in record) {
    parsed.recommendedAction = optionalClientTextField(
      record,
      "recommendedAction",
    );
  }
  if ("internalNote" in record) {
    parsed.internalNote = optionalClientTextField(record, "internalNote");
  }
  if ("estimatedEffort" in record) {
    parsed.estimatedEffort = optionalClientTextField(record, "estimatedEffort");
  }
  if ("isIncluded" in record) parsed.isIncluded = record.isIncluded === true;
  if ("isFalsePositive" in record) {
    parsed.isFalsePositive = record.isFalsePositive === true;
  }
  if ("displayOrder" in record) {
    const order =
      typeof record.displayOrder === "number"
        ? record.displayOrder
        : Number.parseInt(String(record.displayOrder), 10);
    if (!Number.isInteger(order) || order < 0) {
      throw new Error("invalid_display_order");
    }
    parsed.displayOrder = order;
  }
  if ("comparisonStatus" in record) {
    if (record.comparisonStatus == null || record.comparisonStatus === "") {
      parsed.comparisonStatus = null;
    } else {
      const status = parseOperationsReportComparisonStatus(
        record.comparisonStatus,
      );
      if (!status) throw new Error("invalid_comparison_status");
      parsed.comparisonStatus = status;
    }
  }
  return parsed;
}

export function parseOperationsReportSentInput(body: unknown) {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const deliveryMethod =
    typeof record.deliveryMethod === "string" ? record.deliveryMethod : "";
  if (
    !["email_attachment", "secure_link", "in_person", "other"].includes(
      deliveryMethod,
    )
  ) {
    throw new Error("invalid_delivery_method");
  }
  return {
    contactId: optionalUuidField(record, "contactId"),
    deliveryMethod: deliveryMethod as
      | "email_attachment"
      | "secure_link"
      | "in_person"
      | "other",
    followUpAt: parseDateField(record, "followUpAt"),
    updatePipelineStage: record.updatePipelineStage === true,
  };
}

export function parseOperationsReportRetestInput(body: unknown) {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const scanRunId = optionalUuidField(record, "scanRunId");
  if (!scanRunId) throw new Error("invalid_scanRunId");
  const reportType = parseOperationsReportType(
    record.reportType ?? "post_fix_retest",
  );
  if (!reportType) throw new Error("invalid_report_type");
  return { scanRunId, reportType };
}

export function parseOperationsReportComparisonUpdateInput(body: unknown) {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const parsed: {
    comparisonStatus?: OperationsReportComparisonStatus;
    summary?: string | null;
    manualNote?: string | null;
  } = {};
  if ("comparisonStatus" in record) {
    const status = parseOperationsReportComparisonStatus(
      record.comparisonStatus,
    );
    if (!status) throw new Error("invalid_comparison_status");
    parsed.comparisonStatus = status;
  }
  if ("summary" in record) {
    parsed.summary = optionalClientTextField(record, "summary");
  }
  if ("manualNote" in record) {
    parsed.manualNote = optionalClientTextField(record, "manualNote");
  }
  return parsed;
}

function parseCurrency(value: unknown, fallback = "GBP") {
  const currency =
    typeof value === "string" && value.trim()
      ? value.trim().toUpperCase()
      : fallback;
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("invalid_currency");
  return currency;
}

function parseMinorMoney(
  input: Record<string, unknown>,
  key: string,
  fallback = 0,
) {
  if (!(key in input)) return fallback;
  const value = input[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : fallback;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100_000_000) {
    throw new Error(`invalid_${key}`);
  }
  return parsed;
}

function parseQuantity(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return 1;
  const value = input[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value.trim(), 10)
        : 1;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999) {
    throw new Error(`invalid_${key}`);
  }
  return parsed;
}

function parsePlainArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => {
        return Boolean(
          item && typeof item === "object" && !Array.isArray(item),
        );
      })
    : [];
}

export function parseOperationsQuoteItemInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsQuoteItemInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsQuoteItemInput> = {};
  if ("title" in record || !options.partial) {
    parsed.title = options.partial
      ? (optionalClientTextField(record, "title") ?? undefined)
      : requiredClientTextField(record, "title");
  }
  if ("reportFindingId" in record) {
    parsed.reportFindingId = optionalUuidField(record, "reportFindingId");
  }
  if ("description" in record) {
    parsed.description = optionalClientTextField(record, "description");
  }
  if ("quantity" in record || !options.partial) {
    parsed.quantity = parseQuantity(record, "quantity");
  }
  if ("unitPriceMinor" in record || !options.partial) {
    parsed.unitPriceMinor = parseMinorMoney(record, "unitPriceMinor", 0);
  }
  if ("itemType" in record || !options.partial) {
    const itemType = parseOperationsQuoteItemType(
      record.itemType ?? "website_fix",
    );
    if (!itemType) throw new Error("invalid_item_type");
    parsed.itemType = itemType;
  }
  if ("isOptional" in record) parsed.isOptional = record.isOptional === true;
  if ("isSelected" in record) parsed.isSelected = record.isSelected !== false;
  if ("displayOrder" in record) {
    const order = parseMinorMoney(record, "displayOrder", 0);
    parsed.displayOrder = order;
  }
  if ("estimatedEffort" in record) {
    parsed.estimatedEffort = optionalClientTextField(record, "estimatedEffort");
  }
  if ("internalNotes" in record) {
    parsed.internalNotes = optionalClientTextField(record, "internalNotes");
  }
  return parsed as OperationsQuoteItemInput;
}

export function parseOperationsAccessRequirementInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsAccessRequirementInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsAccessRequirementInput> = {};
  if ("description" in record || !options.partial) {
    parsed.description = options.partial
      ? (optionalClientTextField(record, "description") ?? undefined)
      : requiredClientTextField(record, "description");
  }
  if ("status" in record || !options.partial) {
    const status = parseOperationsAccessRequirementStatus(
      record.status ?? "not_requested",
    );
    if (!status) throw new Error("invalid_access_status");
    parsed.status = status;
  }
  if ("requestedAt" in record) {
    parsed.requestedAt = parseDateField(record, "requestedAt");
  }
  if ("receivedAt" in record) {
    parsed.receivedAt = parseDateField(record, "receivedAt");
  }
  if ("secureStorageReference" in record) {
    const ref = optionalClientTextField(record, "secureStorageReference");
    if (ref && /password|secret|token\s*[:=]/i.test(ref)) {
      throw new Error("credential_values_not_allowed");
    }
    parsed.secureStorageReference = ref;
  }
  if ("notes" in record)
    parsed.notes = optionalClientTextField(record, "notes");
  if ("displayOrder" in record) {
    parsed.displayOrder = parseMinorMoney(record, "displayOrder", 0);
  }
  return parsed as OperationsAccessRequirementInput;
}

export function parseOperationsQuoteCreateInput(
  body: unknown,
): OperationsQuoteInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const businessId = optionalUuidField(record, "businessId");
  if (!businessId) throw new Error("invalid_businessId");
  return {
    businessId,
    contactId: optionalUuidField(record, "contactId"),
    operationsReportId: optionalUuidField(record, "operationsReportId"),
    title: requiredClientTextField(record, "title"),
    currency: parseCurrency(record.currency),
    discountMinor: parseMinorMoney(record, "discountMinor", 0),
    validUntil: parseDateField(record, "validUntil"),
    estimatedStartDate: parseDateField(record, "estimatedStartDate"),
    estimatedCompletionDate: parseDateField(record, "estimatedCompletionDate"),
    estimatedDurationText: optionalClientTextField(
      record,
      "estimatedDurationText",
    ),
    paymentTerms: optionalClientTextField(record, "paymentTerms"),
    scopeSummary: optionalClientTextField(record, "scopeSummary"),
    includedScope: optionalClientTextField(record, "includedScope"),
    excludedScope: optionalClientTextField(record, "excludedScope"),
    assumptions: optionalClientTextField(record, "assumptions"),
    clientResponsibilities: optionalClientTextField(
      record,
      "clientResponsibilities",
    ),
    accessRequirementsSummary: optionalClientTextField(
      record,
      "accessRequirementsSummary",
    ),
    internalNotes: optionalClientTextField(record, "internalNotes"),
    items: parsePlainArray(record.items).map((item) =>
      parseOperationsQuoteItemInput(item),
    ),
    accessRequirements: parsePlainArray(record.accessRequirements).map((item) =>
      parseOperationsAccessRequirementInput(item),
    ),
  };
}

export function parseOperationsQuoteUpdateInput(
  body: unknown,
): OperationsQuoteUpdateInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: OperationsQuoteUpdateInput = {};
  if ("contactId" in record)
    parsed.contactId = optionalUuidField(record, "contactId");
  if ("operationsReportId" in record) {
    parsed.operationsReportId = optionalUuidField(record, "operationsReportId");
  }
  if ("title" in record)
    parsed.title = requiredClientTextField(record, "title");
  if ("currency" in record) parsed.currency = parseCurrency(record.currency);
  if ("discountMinor" in record) {
    parsed.discountMinor = parseMinorMoney(record, "discountMinor", 0);
  }
  if ("validUntil" in record)
    parsed.validUntil = parseDateField(record, "validUntil");
  if ("estimatedStartDate" in record) {
    parsed.estimatedStartDate = parseDateField(record, "estimatedStartDate");
  }
  if ("estimatedCompletionDate" in record) {
    parsed.estimatedCompletionDate = parseDateField(
      record,
      "estimatedCompletionDate",
    );
  }
  if ("estimatedDurationText" in record) {
    parsed.estimatedDurationText = optionalClientTextField(
      record,
      "estimatedDurationText",
    );
  }
  if ("paymentTerms" in record) {
    parsed.paymentTerms = optionalClientTextField(record, "paymentTerms");
  }
  if ("scopeSummary" in record) {
    parsed.scopeSummary = optionalClientTextField(record, "scopeSummary");
  }
  if ("includedScope" in record) {
    parsed.includedScope = optionalClientTextField(record, "includedScope");
  }
  if ("excludedScope" in record) {
    parsed.excludedScope = optionalClientTextField(record, "excludedScope");
  }
  if ("assumptions" in record) {
    parsed.assumptions = optionalClientTextField(record, "assumptions");
  }
  if ("clientResponsibilities" in record) {
    parsed.clientResponsibilities = optionalClientTextField(
      record,
      "clientResponsibilities",
    );
  }
  if ("accessRequirementsSummary" in record) {
    parsed.accessRequirementsSummary = optionalClientTextField(
      record,
      "accessRequirementsSummary",
    );
  }
  if ("internalNotes" in record) {
    parsed.internalNotes = optionalClientTextField(record, "internalNotes");
  }
  return parsed;
}

export function parseOperationsQuoteSentInput(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const deliveryMethod =
    typeof record.deliveryMethod === "string" ? record.deliveryMethod : "";
  if (!["email_attachment", "in_person", "other"].includes(deliveryMethod)) {
    throw new Error("invalid_delivery_method");
  }
  return {
    contactId: optionalUuidField(record, "contactId"),
    deliveryMethod: deliveryMethod as
      | "email_attachment"
      | "in_person"
      | "other",
    sentAt: parseDateField(record, "sentAt"),
    followUpAt: parseDateField(record, "followUpAt"),
    updatePipelineStage: record.updatePipelineStage === true,
  };
}

export function parseOperationsQuoteAcceptedInput(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const method =
    typeof record.acceptanceMethod === "string" ? record.acceptanceMethod : "";
  if (!["email", "phone", "in_person", "other"].includes(method)) {
    throw new Error("invalid_acceptance_method");
  }
  if (record.selectedItemsConfirmed !== true) {
    throw new Error("selected_items_not_confirmed");
  }
  if (record.freezeConfirmed !== true) {
    throw new Error("freeze_not_confirmed");
  }
  return {
    acceptedAt: parseRequiredDateField(record, "acceptedAt"),
    acceptanceMethod: method as "email" | "phone" | "in_person" | "other",
    contactId: optionalUuidField(record, "contactId"),
    totalMinorConfirmed: parseMinorMoney(record, "totalMinorConfirmed", -1),
    selectedItemsConfirmed: record.selectedItemsConfirmed === true,
    freezeConfirmed: record.freezeConfirmed === true,
    summary: optionalClientTextField(record, "summary"),
  };
}

export function parseOperationsQuoteDeclinedInput(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  return {
    declinedAt: parseDateField(record, "declinedAt"),
    reason: optionalClientTextField(record, "reason"),
  };
}

export function parseOperationsServiceItemInput(
  body: unknown,
  options: { partial?: boolean } = {},
): {
  title: string;
  description?: string | null;
  suggestedPriceMinor?: number;
  suggestedEffort?: string | null;
  itemType?: OperationsQuoteItemType;
  isActive?: boolean;
} {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Record<string, unknown> = {};
  if ("title" in record || !options.partial) {
    parsed.title = options.partial
      ? (optionalClientTextField(record, "title") ?? undefined)
      : requiredClientTextField(record, "title");
  }
  if ("description" in record) {
    parsed.description = optionalClientTextField(record, "description");
  }
  if ("suggestedPriceMinor" in record || !options.partial) {
    parsed.suggestedPriceMinor = parseMinorMoney(
      record,
      "suggestedPriceMinor",
      0,
    );
  }
  if ("suggestedEffort" in record) {
    parsed.suggestedEffort = optionalClientTextField(record, "suggestedEffort");
  }
  if ("itemType" in record || !options.partial) {
    const itemType = parseOperationsQuoteItemType(
      record.itemType ?? "website_fix",
    );
    if (!itemType) throw new Error("invalid_item_type");
    parsed.itemType = itemType;
  }
  if ("isActive" in record) parsed.isActive = record.isActive !== false;
  return parsed as {
    title: string;
    description?: string | null;
    suggestedPriceMinor?: number;
    suggestedEffort?: string | null;
    itemType?: OperationsQuoteItemType;
    isActive?: boolean;
  };
}

export function parseOperationsWorkOrderUpdateInput(
  body: unknown,
): OperationsWorkOrderUpdateInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: OperationsWorkOrderUpdateInput = {};
  if ("title" in record)
    parsed.title = requiredClientTextField(record, "title");
  if ("status" in record) {
    const status = parseOperationsWorkOrderStatus(record.status);
    if (!status) throw new Error("invalid_work_order_status");
    parsed.status = status;
  }
  if ("priority" in record) {
    const priority = parseOperationsWorkOrderPriority(record.priority);
    if (!priority) throw new Error("invalid_work_order_priority");
    parsed.priority = priority;
  }
  if ("scopeSummary" in record) {
    parsed.scopeSummary = optionalClientTextField(record, "scopeSummary");
  }
  if ("targetCompletionAt" in record) {
    parsed.targetCompletionAt = parseDateField(record, "targetCompletionAt");
  }
  if ("blockedReason" in record) {
    parsed.blockedReason = optionalClientTextField(record, "blockedReason");
  }
  if ("clientWaitingReason" in record) {
    parsed.clientWaitingReason = optionalClientTextField(
      record,
      "clientWaitingReason",
    );
  }
  if ("completionSummary" in record) {
    parsed.completionSummary = optionalClientTextField(
      record,
      "completionSummary",
    );
  }
  if ("internalNotes" in record) {
    parsed.internalNotes = optionalClientTextField(record, "internalNotes");
  }
  return parsed;
}

export function parseOperationsWorkItemInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsWorkItemInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsWorkItemInput> = {};
  if ("title" in record || !options.partial) {
    parsed.title = options.partial
      ? (optionalClientTextField(record, "title") ?? undefined)
      : requiredClientTextField(record, "title");
  }
  if ("description" in record) {
    parsed.description = optionalClientTextField(record, "description");
  }
  if ("status" in record || !options.partial) {
    const status = parseOperationsWorkItemStatus(record.status ?? "to_do");
    if (!status) throw new Error("invalid_work_item_status");
    parsed.status = status;
  }
  if ("displayOrder" in record) {
    parsed.displayOrder = parseMinorMoney(record, "displayOrder", 0);
  }
  if ("completionNotes" in record) {
    parsed.completionNotes = optionalClientTextField(record, "completionNotes");
  }
  if ("clientVisibleCompletionNotes" in record) {
    parsed.clientVisibleCompletionNotes = optionalClientTextField(
      record,
      "clientVisibleCompletionNotes",
    );
  }
  if ("requiresRetest" in record) {
    parsed.requiresRetest = record.requiresRetest === true;
  }
  if ("retestStatus" in record) {
    const retestStatus = parseOperationsRetestStatus(record.retestStatus);
    if (!retestStatus) throw new Error("invalid_retest_status");
    parsed.retestStatus = retestStatus;
  }
  if ("internalNotes" in record) {
    parsed.internalNotes = optionalClientTextField(record, "internalNotes");
  }
  return parsed as OperationsWorkItemInput;
}

function parseAllowance(record: Record<string, unknown>, key: string) {
  if (!(key in record)) return undefined;
  const value = record[key];
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`invalid_${key}`);
  }
  return value;
}

function rejectCredentialText(value: string | null | undefined, field: string) {
  if (!value) return;
  if (/(password|secret|token|api[_ -]?key)\s*[:=]/i.test(value)) {
    throw new Error(`credential_values_not_allowed_in_${field}`);
  }
}

function parseOptionalUuidArray(value: unknown, key: string) {
  if (value == null) return undefined;
  if (!Array.isArray(value)) throw new Error(`invalid_${key}`);
  const ids = value.map((item) => {
    if (typeof item !== "string" || !UUID_RE.test(item)) {
      throw new Error(`invalid_${key}`);
    }
    return item;
  });
  return Array.from(new Set(ids));
}

export function parseOperationsServicePlanInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsServicePlanInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsServicePlanInput> = {};
  if ("name" in record || !options.partial) {
    parsed.name = options.partial
      ? (optionalClientTextField(record, "name") ?? undefined)
      : requiredClientTextField(record, "name");
  }
  if ("code" in record) parsed.code = optionalClientTextField(record, "code");
  if ("description" in record) {
    parsed.description = optionalClientTextField(record, "description");
  }
  if ("planType" in record || !options.partial) {
    const planType = parseOperationsServicePlanType(
      record.planType ?? "custom",
    );
    if (!planType) throw new Error("invalid_plan_type");
    parsed.planType = planType;
  }
  if ("defaultCurrency" in record) {
    parsed.defaultCurrency = parseCurrency(record.defaultCurrency);
  }
  if ("defaultPriceMinor" in record || !options.partial) {
    parsed.defaultPriceMinor = parseMinorMoney(record, "defaultPriceMinor", 0);
  }
  if ("defaultBillingCadence" in record || !options.partial) {
    const cadence = parseOperationsServiceBillingCadence(
      record.defaultBillingCadence ?? "monthly",
    );
    if (!cadence) throw new Error("invalid_billing_cadence");
    parsed.defaultBillingCadence = cadence;
  }
  if ("defaultScanFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceScanFrequency(
      record.defaultScanFrequency ?? "weekly",
    );
    if (!frequency) throw new Error("invalid_scan_frequency");
    parsed.defaultScanFrequency = frequency;
  }
  if ("defaultReportFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceReportFrequency(
      record.defaultReportFrequency ?? "monthly",
    );
    if (!frequency) throw new Error("invalid_report_frequency");
    parsed.defaultReportFrequency = frequency;
  }
  if ("defaultReviewFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceReviewFrequency(
      record.defaultReviewFrequency ?? "quarterly",
    );
    if (!frequency) throw new Error("invalid_review_frequency");
    parsed.defaultReviewFrequency = frequency;
  }
  for (const [key, target] of [
    ["includesUptimeMonitoring", "includesUptimeMonitoring"],
    ["includesIssueAlerts", "includesIssueAlerts"],
    ["includesMonthlyReport", "includesMonthlyReport"],
    ["includesAdvice", "includesAdvice"],
    ["includesSmallFixes", "includesSmallFixes"],
    ["isActive", "isActive"],
  ] as const) {
    if (key in record) parsed[target] = record[key] === true;
  }
  if ("includesIssueAlerts" in record) {
    parsed.includesIssueAlerts = record.includesIssueAlerts !== false;
  }
  if ("includesMonthlyReport" in record) {
    parsed.includesMonthlyReport = record.includesMonthlyReport !== false;
  }
  if ("includesAdvice" in record) {
    parsed.includesAdvice = record.includesAdvice !== false;
  }
  const support = parseAllowance(record, "includedSupportMinutes");
  if (support !== undefined) parsed.includedSupportMinutes = support;
  const fixes = parseAllowance(record, "includedFixCount");
  if (fixes !== undefined) parsed.includedFixCount = fixes;
  for (const key of [
    "responseTargetText",
    "scopeSummary",
    "includedScope",
    "excludedScope",
  ] as const) {
    if (key in record) parsed[key] = optionalClientTextField(record, key);
  }
  return parsed as OperationsServicePlanInput;
}

export function parseOperationsClientServiceInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsClientServiceInput | OperationsClientServiceUpdateInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsClientServiceInput> = {};
  if ("businessId" in record || !options.partial) {
    const businessId = optionalUuidField(record, "businessId");
    if (!businessId) throw new Error("invalid_businessId");
    parsed.businessId = businessId;
  }
  for (const key of [
    "contactId",
    "servicePlanId",
    "sourceQuoteId",
    "sourceWorkOrderId",
  ] as const) {
    if (key in record) parsed[key] = optionalUuidField(record, key);
  }
  if ("name" in record || !options.partial) {
    parsed.name = options.partial
      ? (optionalClientTextField(record, "name") ?? undefined)
      : requiredClientTextField(record, "name");
  }
  if ("currency" in record) parsed.currency = parseCurrency(record.currency);
  if ("agreedPriceMinor" in record || !options.partial) {
    parsed.agreedPriceMinor = parseMinorMoney(record, "agreedPriceMinor", 0);
  }
  if ("zeroCostConfirmed" in record) {
    parsed.zeroCostConfirmed = record.zeroCostConfirmed === true;
  }
  if ("billingCadence" in record || !options.partial) {
    const cadence = parseOperationsServiceBillingCadence(
      record.billingCadence ?? "monthly",
    );
    if (!cadence) throw new Error("invalid_billing_cadence");
    parsed.billingCadence = cadence;
  }
  if ("scanFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceScanFrequency(
      record.scanFrequency ?? "weekly",
    );
    if (!frequency) throw new Error("invalid_scan_frequency");
    parsed.scanFrequency = frequency;
  }
  if ("reportFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceReportFrequency(
      record.reportFrequency ?? "monthly",
    );
    if (!frequency) throw new Error("invalid_report_frequency");
    parsed.reportFrequency = frequency;
  }
  if ("reviewFrequency" in record || !options.partial) {
    const frequency = parseOperationsServiceReviewFrequency(
      record.reviewFrequency ?? "quarterly",
    );
    if (!frequency) throw new Error("invalid_review_frequency");
    parsed.reviewFrequency = frequency;
  }
  for (const key of [
    "startDate",
    "minimumTermEndDate",
    "nextReviewAt",
    "renewalDate",
  ] as const) {
    if (key in record) parsed[key] = parseDateField(record, key);
  }
  for (const [key, target] of [
    ["includesUptimeMonitoring", "includesUptimeMonitoring"],
    ["includesIssueAlerts", "includesIssueAlerts"],
    ["includesMonthlyReport", "includesMonthlyReport"],
    ["includesAdvice", "includesAdvice"],
    ["includesSmallFixes", "includesSmallFixes"],
  ] as const) {
    if (key in record) parsed[target] = record[key] === true;
  }
  if ("includesIssueAlerts" in record) {
    parsed.includesIssueAlerts = record.includesIssueAlerts !== false;
  }
  if ("includesMonthlyReport" in record) {
    parsed.includesMonthlyReport = record.includesMonthlyReport !== false;
  }
  if ("includesAdvice" in record) {
    parsed.includesAdvice = record.includesAdvice !== false;
  }
  const support = parseAllowance(record, "includedSupportMinutes");
  if (support !== undefined) parsed.includedSupportMinutes = support;
  const fixes = parseAllowance(record, "includedFixCount");
  if (fixes !== undefined) parsed.includedFixCount = fixes;
  for (const key of [
    "noticePeriodText",
    "responseTargetText",
    "scopeSummary",
    "includedScope",
    "excludedScope",
    "customTerms",
    "internalNotes",
  ] as const) {
    if (key in record) {
      const value = optionalClientTextField(record, key);
      rejectCredentialText(value, key);
      parsed[key] = value;
    }
  }
  const siteIds = parseOptionalUuidArray(record.siteIds, "siteIds");
  if (siteIds !== undefined) parsed.siteIds = siteIds;
  return parsed as
    | OperationsClientServiceInput
    | OperationsClientServiceUpdateInput;
}

export function parseOperationsClientServiceSiteInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsClientServiceSiteInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsClientServiceSiteInput> = {};
  if ("siteId" in record || !options.partial) {
    const siteId = optionalUuidField(record, "siteId");
    if (!siteId) throw new Error("invalid_siteId");
    parsed.siteId = siteId;
  }
  if ("isPrimary" in record) parsed.isPrimary = record.isPrimary === true;
  if ("monitoringEnabled" in record) {
    parsed.monitoringEnabled = record.monitoringEnabled !== false;
  }
  if ("uptimeMonitoringEnabled" in record) {
    parsed.uptimeMonitoringEnabled = record.uptimeMonitoringEnabled === true;
  }
  if ("scanFrequencyOverride" in record) {
    if (
      record.scanFrequencyOverride == null ||
      record.scanFrequencyOverride === ""
    ) {
      parsed.scanFrequencyOverride = null;
    } else {
      const value = parseOperationsServiceScanFrequency(
        record.scanFrequencyOverride,
      );
      if (!value) throw new Error("invalid_scan_frequency");
      parsed.scanFrequencyOverride = value;
    }
  }
  if ("reportFrequencyOverride" in record) {
    if (
      record.reportFrequencyOverride == null ||
      record.reportFrequencyOverride === ""
    ) {
      parsed.reportFrequencyOverride = null;
    } else {
      const value = parseOperationsServiceReportFrequency(
        record.reportFrequencyOverride,
      );
      if (!value) throw new Error("invalid_report_frequency");
      parsed.reportFrequencyOverride = value;
    }
  }
  if ("notes" in record) {
    const notes = optionalClientTextField(record, "notes");
    rejectCredentialText(notes, "notes");
    parsed.notes = notes;
  }
  return parsed as OperationsClientServiceSiteInput;
}

export function parseOperationsClientServiceUsageInput(
  body: unknown,
  options: { partial?: boolean } = {},
): OperationsClientServiceUsageInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: Partial<OperationsClientServiceUsageInput> = {};
  for (const key of [
    "workOrderId",
    "communicationId",
    "operationsReportId",
  ] as const) {
    if (key in record) parsed[key] = optionalUuidField(record, key);
  }
  if ("usageType" in record || !options.partial) {
    const usageType = parseOperationsServiceUsageType(
      record.usageType ?? "other",
    );
    if (!usageType) throw new Error("invalid_usage_type");
    parsed.usageType = usageType;
  }
  if ("description" in record || !options.partial) {
    const description = options.partial
      ? (optionalClientTextField(record, "description") ?? undefined)
      : requiredClientTextField(record, "description");
    rejectCredentialText(description, "description");
    parsed.description = description;
  }
  const minutes = parseAllowance(record, "minutesUsed");
  if (minutes !== undefined) parsed.minutesUsed = minutes;
  const fixes = parseAllowance(record, "fixesUsed");
  if (fixes !== undefined) parsed.fixesUsed = fixes;
  for (const key of [
    "occurredAt",
    "servicePeriodStart",
    "servicePeriodEnd",
  ] as const) {
    if (key in record) parsed[key] = parseDateField(record, key);
  }
  if ("isOutOfScope" in record) {
    parsed.isOutOfScope = record.isOutOfScope === true;
  }
  for (const key of ["outsideScopeReason", "internalNotes"] as const) {
    if (key in record) {
      const value = optionalClientTextField(record, key);
      rejectCredentialText(value, key);
      parsed[key] = value;
    }
  }
  return parsed as OperationsClientServiceUsageInput;
}

export function parseOperationsClientServiceReviewInput(
  body: unknown,
): OperationsClientServiceReviewInput {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed: OperationsClientServiceReviewInput = {};
  if ("outcome" in record) {
    const outcome = parseOperationsServiceReviewOutcome(record.outcome);
    if (!outcome) throw new Error("invalid_review_outcome");
    parsed.outcome = outcome;
  }
  for (const key of ["periodStart", "periodEnd", "nextReviewAt"] as const) {
    if (key in record) parsed[key] = parseDateField(record, key);
  }
  for (const key of [
    "websiteHealthSummary",
    "incidentsSummary",
    "reportsSummary",
    "workCompletedSummary",
    "usageSummary",
    "outstandingClientActions",
    "pricingOrScopeNotes",
    "renewalRecommendation",
    "internalNotes",
  ] as const) {
    if (key in record) {
      const value = optionalClientTextField(record, key);
      rejectCredentialText(value, key);
      parsed[key] = value;
    }
  }
  return parsed;
}

export function parseOperationsClientServiceActivationInput(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const acceptanceMethod = optionalClientTextField(record, "acceptanceMethod");
  if (!acceptanceMethod) throw new Error("acceptance_method_required");
  if (record.agreementConfirmed !== true) {
    throw new Error("agreement_confirmation_required");
  }
  return {
    agreedAt: parseRequiredDateField(record, "agreedAt"),
    acceptanceMethod,
    updateBusinessRelationship: record.updateBusinessRelationship === true,
    updatePipelineStage: record.updatePipelineStage === true,
  };
}

export function parseOperationsClientServiceTransitionInput(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  return {
    reason: optionalClientTextField(record, "reason"),
    notes: optionalClientTextField(record, "notes"),
    plannedResumeAt: parseDateField(record, "plannedResumeAt"),
    requestedEndDate: parseDateField(record, "requestedEndDate"),
  };
}

export function serializeOperationsSummary(summary: OperationsSummary) {
  return {
    counts: summary.counts,
    monitoringAttention: summary.monitoringAttention.map((item) => ({
      ...item,
      occurredAt: serializeDate(item.occurredAt),
    })),
    recentActivity: summary.recentActivity.map((item) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),
    })),
    generatedAt: summary.generatedAt.toISOString(),
  };
}
