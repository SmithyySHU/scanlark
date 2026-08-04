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

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field}_required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field}_too_long`);
  return trimmed;
}

function optionalString(value: unknown, field: string, maxLength: number) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${field}_too_long`);
  return trimmed || null;
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
    patch.recipientAddress = requiredString(
      record.recipientAddress,
      "recipient_address",
      254,
    );
    if (!isValidEmailAddress(patch.recipientAddress)) {
      throw new Error("invalid_recipient_address");
    }
  }
  if ("subject" in record) {
    patch.subject = requiredString(record.subject, "subject", 998);
  }
  if ("preheader" in record) {
    patch.preheader = optionalString(record.preheader, "preheader", 500);
  }
  if ("editorBody" in record) {
    patch.editorBody = requiredString(
      record.editorBody,
      "editor_body",
      200_000,
    );
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
