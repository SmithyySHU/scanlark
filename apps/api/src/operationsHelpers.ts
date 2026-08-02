import type {
  OperationsBusinessInput,
  OperationsCommunicationChannel,
  OperationsCommunicationDirection,
  OperationsCommunicationDraftContext,
  OperationsCommunicationInput,
  OperationsCommunicationStatus,
  OperationsCommunicationTemplateCategory,
  OperationsContactInput,
  OperationsPipelineStage,
  OperationsRelationshipType,
  OperationsSummary,
  OperationsTaskStatus,
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
  };
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
