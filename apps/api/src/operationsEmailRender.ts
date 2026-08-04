import { createHash } from "node:crypto";
import {
  isValidEmailAddress,
  type OperationsEmailMessageRow,
} from "@scanlark/db";
import {
  findUnresolvedClientCommunicationPlaceholders,
  getEmailAssetBaseUrl,
  sanitizeClientEmailHtml,
} from "./operationsHelpers";

export const OPERATIONS_EMAIL_RENDERER_VERSION = "operations-email-direct-v1";
export const OPERATIONS_EMAIL_SIGNATURE_TEXT = [
  "Connor Smith",
  "Founder, Scanlark",
  "Website health checks and monitoring",
  "contact@scanlark.com",
  "https://scanlark.com",
].join("\n");

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyHtml(body: string) {
  return body
    .trim()
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.65;text-align:left;overflow-wrap:anywhere">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

export type OperationsEmailFinalRender = {
  revision: number;
  html: string;
  plainText: string;
  htmlSha256: string;
  plainTextSha256: string;
  rendererVersion: string;
  warnings: string[];
  errors: string[];
};

export function renderOperationsEmailFinal(
  message: Pick<
    OperationsEmailMessageRow,
    | "revision"
    | "subject"
    | "editor_body"
    | "preheader"
    | "recipient_address"
    | "source_snapshot_json"
  >,
  env: NodeJS.ProcessEnv = process.env,
): OperationsEmailFinalRender {
  const errors: string[] = [];
  const unresolved = findUnresolvedClientCommunicationPlaceholders({
    subject: message.subject,
    body: message.editor_body,
  });
  if (unresolved.length)
    errors.push(`Unresolved placeholders: ${unresolved.join(", ")}`);
  if (!message.editor_body.trim()) errors.push("Message body is required.");
  if (!message.subject.trim()) errors.push("Subject is required.");
  if (!isValidEmailAddress(message.recipient_address.trim()))
    errors.push("A valid recipient email address is required.");
  const assetBase = getEmailAssetBaseUrl(env);
  const layoutKey =
    typeof message.source_snapshot_json.layoutKey === "string"
      ? message.source_snapshot_json.layoutKey
      : "personal_letter";
  const authoritativeBody = (
    message.editor_body.includes(OPERATIONS_EMAIL_SIGNATURE_TEXT)
      ? message.editor_body
          .replace(OPERATIONS_EMAIL_SIGNATURE_TEXT, "")
          .trimEnd()
      : message.editor_body.trimEnd()
  ).replace(/javascript\s*:/gi, "");
  const signature = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid #d9e0e7;width:100%;max-width:620px"><tr><td style="padding-top:18px;vertical-align:top;width:54px"><img src="${escapeHtml(assetBase)}/scanlark-email-mark.png" width="38" height="38" alt="Scanlark" style="display:block;width:38px;height:38px"></td><td style="padding-top:16px;color:#334155;font-size:13px;line-height:1.5"><strong style="color:#14233b">Connor Smith</strong><br>Founder, Scanlark<br>Website health checks and monitoring<br><a href="mailto:contact@scanlark.com" style="color:#185c73">contact@scanlark.com</a><br><a href="https://scanlark.com" style="color:#185c73">scanlark.com</a></td></tr></table>`;
  const preheader = message.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(message.preheader)}</div>`
    : "";
  const documentHeader = ["report_delivery", "commercial_document"].includes(
    layoutKey,
  )
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;width:100%;max-width:620px;border-bottom:1px solid #d9e0e7"><tr><td style="padding:0 0 14px"><img src="${escapeHtml(assetBase)}/scanlark-email-logo-navy.png" width="148" alt="Scanlark" style="display:block;width:148px;max-width:100%;height:auto"><strong style="display:block;color:#14233b;margin-top:5px">Scanlark</strong></td></tr></table>`
    : "";
  const html = sanitizeClientEmailHtml(
    `<!doctype html><html><body style="margin:0;background:#ffffff;color:#17212b;font-family:Arial,Helvetica,sans-serif;text-align:left"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:24px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0"><tr><td style="font-size:15px;line-height:1.65;text-align:left">${preheader}${documentHeader}${bodyHtml(authoritativeBody)}${signature}<p style="margin:22px 0 0;color:#64748b;font-size:11px;line-height:1.5">You are receiving this operational email in relation to your work with Scanlark. Reply to this email if it has reached the wrong person.</p></td></tr></table></td></tr></table></body></html>`,
  );
  const plainText = `${authoritativeBody}\n\n${OPERATIONS_EMAIL_SIGNATURE_TEXT}\n\nYou are receiving this operational email in relation to your work with Scanlark. Reply if it has reached the wrong person.`;
  return {
    revision: message.revision,
    html,
    plainText,
    htmlSha256: createHash("sha256").update(html).digest("hex"),
    plainTextSha256: createHash("sha256").update(plainText).digest("hex"),
    rendererVersion: OPERATIONS_EMAIL_RENDERER_VERSION,
    warnings: [],
    errors,
  };
}
