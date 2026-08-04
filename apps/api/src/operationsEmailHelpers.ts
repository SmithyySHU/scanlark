import { isValidEmailAddress } from "@scanlark/db";
import {
  findUnresolvedClientCommunicationPlaceholders,
  sanitizeClientEmailHtml,
} from "./operationsHelpers";

export const OPERATIONS_EMAIL_FOLDER_STATUSES = {
  drafts: ["draft"],
  ready: ["ready", "queued", "sending"],
  sent: ["sent"],
  failed: ["failed", "delivery_uncertain", "cancelled"],
} as const;

export type OperationsEmailEditableFields = {
  recipientName: string | null;
  recipientAddress: string;
  subject: string;
  preheader: string | null;
  editorBody: string;
};

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field}_too_long`);
  return trimmed || null;
}

function draftString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field}_too_long`);
  return trimmed;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOperationsEmailStandaloneDraft(value: unknown) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_email_draft");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "businessId",
    "contactId",
    "reportId",
    "quoteId",
    "recipientName",
    "recipientAddress",
    "subject",
  ]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key))
      throw new Error(`unsupported_email_draft_field:${key}`);
  }
  const parsed: {
    businessId?: string | null;
    contactId?: string | null;
    reportId?: string | null;
    quoteId?: string | null;
    recipientName?: string | null;
    recipientAddress?: string;
    subject?: string;
  } = {};
  for (const [inputKey, outputKey] of [
    ["businessId", "businessId"],
    ["contactId", "contactId"],
    ["reportId", "reportId"],
    ["quoteId", "quoteId"],
  ] as const) {
    if (!(inputKey in record)) continue;
    const candidate = record[inputKey];
    if (candidate == null || candidate === "") parsed[outputKey] = null;
    else if (typeof candidate !== "string" || !UUID_RE.test(candidate))
      throw new Error(`invalid_${inputKey}`);
    else parsed[outputKey] = candidate;
  }
  if ("recipientName" in record)
    parsed.recipientName = optionalString(
      record.recipientName,
      "recipient_name",
      200,
    );
  if ("recipientAddress" in record) {
    parsed.recipientAddress = draftString(
      record.recipientAddress,
      "recipient_address",
      254,
    );
    if (
      parsed.recipientAddress &&
      !isValidEmailAddress(parsed.recipientAddress)
    )
      throw new Error("invalid_recipient_address");
  }
  if ("subject" in record)
    parsed.subject = draftString(record.subject, "subject", 998);
  return parsed;
}

export function parseOperationsEmailEditorPatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_email_editor_patch");
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "expectedRevision",
    "recipientName",
    "recipientAddress",
    "subject",
    "preheader",
    "editorBody",
  ]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key))
      throw new Error(`unsupported_email_editor_field:${key}`);
  }
  if (
    !Number.isInteger(record.expectedRevision) ||
    Number(record.expectedRevision) < 1
  ) {
    throw new Error("invalid_expected_revision");
  }
  const patch: Partial<OperationsEmailEditableFields> = {};
  if ("recipientName" in record) {
    patch.recipientName = optionalString(
      record.recipientName,
      "recipient_name",
      200,
    );
  }
  if ("recipientAddress" in record) {
    patch.recipientAddress = draftString(
      record.recipientAddress,
      "recipient_address",
      254,
    );
    if (
      patch.recipientAddress &&
      !isValidEmailAddress(patch.recipientAddress)
    ) {
      throw new Error("invalid_recipient_address");
    }
  }
  if ("subject" in record) {
    patch.subject = draftString(record.subject, "subject", 998);
  }
  if ("preheader" in record) {
    patch.preheader = optionalString(record.preheader, "preheader", 500);
  }
  if ("editorBody" in record) {
    patch.editorBody = draftString(record.editorBody, "editor_body", 200_000);
  }
  return { expectedRevision: Number(record.expectedRevision), patch };
}

export function parseExpectedRevision(value: unknown) {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  if (
    !Number.isInteger(record.expectedRevision) ||
    Number(record.expectedRevision) < 1
  ) {
    throw new Error("invalid_expected_revision");
  }
  return Number(record.expectedRevision);
}

export function validateOperationsEmailReady(input: {
  recipientAddress: string;
  subject: string;
  editorBody: string;
}) {
  if (!isValidEmailAddress(input.recipientAddress.trim())) {
    throw new Error("invalid_recipient_address");
  }
  if (!input.subject.trim()) throw new Error("subject_required");
  if (!input.editorBody.trim()) throw new Error("editor_body_required");
  const unresolved = findUnresolvedClientCommunicationPlaceholders({
    subject: input.subject,
    body: input.editorBody,
  });
  if (unresolved.length > 0) {
    throw new Error(`unresolved_email_placeholders:${unresolved.join(",")}`);
  }
}

function escapeHtml(value: string) {
  return value
    .split("&")
    .join("&amp;")
    .split("<")
    .join("&lt;")
    .split(">")
    .join("&gt;")
    .split('"')
    .join("&quot;")
    .split("'")
    .join("&#39;");
}

export function renderOperationsEmailEditorPreview(body: string) {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).split("\n").join("<br>")}</p>`,
    )
    .join("");
  return sanitizeClientEmailHtml(`<div>${paragraphs}</div>`);
}

export function parseEmailFolder(value: unknown) {
  const folder = typeof value === "string" ? value : "drafts";
  if (!(folder in OPERATIONS_EMAIL_FOLDER_STATUSES)) {
    throw new Error("invalid_email_folder");
  }
  return folder as keyof typeof OPERATIONS_EMAIL_FOLDER_STATUSES;
}
