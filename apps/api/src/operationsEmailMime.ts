import { createHash } from "node:crypto";
import MailComposer from "nodemailer/lib/mail-composer/index.js";

export type OperationsEmailMimeAttachment = {
  filename: string;
  contentType: string;
  bytes: Buffer;
  sha256: string;
};

export type OperationsEmailMimeInput = {
  from: { name: string; address: string };
  replyTo: string;
  to: { name?: string | null; address: string };
  subject: string;
  date: Date;
  messageId: string;
  html: string;
  plainText: string;
  attachments: OperationsEmailMimeAttachment[];
  maxBytes: number;
};

export async function buildOperationsEmailMime(
  input: OperationsEmailMimeInput,
) {
  const addresses = [input.from.address, input.replyTo, input.to.address];
  if (
    addresses.some((value) => !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))
  ) {
    throw new Error("mime_address_invalid");
  }
  if (
    [input.from.name, input.to.name ?? "", input.subject].some((value) =>
      /[\r\n]/.test(value),
    )
  ) {
    throw new Error("mime_header_injection_rejected");
  }
  if (!input.subject.trim() || !input.html.trim() || !input.plainText.trim())
    throw new Error("mime_content_required");
  if (!input.date || Number.isNaN(input.date.getTime()))
    throw new Error("mime_date_invalid");
  if (!/^<[^<>\s]+@[^<>\s]+>$/.test(input.messageId))
    throw new Error("mime_message_id_invalid");
  const attachments = [...input.attachments].sort((a, b) =>
    a.filename.localeCompare(b.filename),
  );
  for (const attachment of attachments) {
    if (
      /[/\\\r\n\u0000-\u001f]/.test(attachment.filename) ||
      !attachment.filename.trim()
    ) {
      throw new Error("mime_attachment_filename_invalid");
    }
    if (!attachment.bytes.length) throw new Error("mime_attachment_missing");
    if (
      createHash("sha256").update(attachment.bytes).digest("hex") !==
      attachment.sha256
    ) {
      throw new Error("mime_attachment_hash_mismatch");
    }
  }
  const composer = new MailComposer({
    from: input.from,
    replyTo: input.replyTo,
    to: { name: input.to.name ?? undefined, address: input.to.address },
    subject: input.subject,
    date: input.date,
    messageId: input.messageId,
    text: input.plainText,
    html: input.html,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      contentDisposition: "attachment",
      content: attachment.bytes,
    })),
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const raw = await composer.compile().build();
  if (raw.length > input.maxBytes) throw new Error("mime_message_too_large");
  const header = raw
    .subarray(0, Math.max(0, raw.indexOf("\r\n\r\n")))
    .toString("utf8");
  if (/^bcc:/im.test(header)) throw new Error("mime_bcc_forbidden");
  return {
    raw,
    byteSize: raw.length,
    sha256: createHash("sha256").update(raw).digest("hex"),
    attachmentCount: attachments.length,
    messageId: input.messageId,
    date: input.date,
  };
}
