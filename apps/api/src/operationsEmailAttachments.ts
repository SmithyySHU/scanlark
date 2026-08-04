import { createHash } from "node:crypto";
import path from "node:path";
import { fileTypeFromBuffer } from "file-type";

const MIB = 1024 * 1024;

export function getOperationsEmailAttachmentLimits(
  env: NodeJS.ProcessEnv = process.env,
) {
  const positive = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    maxFileBytes: positive(env.OPERATIONS_EMAIL_MAX_ATTACHMENT_BYTES, 10 * MIB),
    maxTotalBytes: positive(
      env.OPERATIONS_EMAIL_MAX_ATTACHMENTS_TOTAL_BYTES,
      20 * MIB,
    ),
    maxEstimatedMimeBytes: positive(
      env.OPERATIONS_EMAIL_MAX_ESTIMATED_MIME_BYTES,
      28 * MIB,
    ),
  };
}

const SAFE_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".csv",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

export function sanitizeOperationsEmailAttachmentFilename(input: string) {
  const basename = path.basename(input.replace(/\\/g, "/"));
  const extension = path.extname(basename).toLowerCase();
  const rawStem = basename.slice(
    0,
    Math.max(0, basename.length - extension.length),
  );
  const stem = rawStem
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+|[. ]+$/g, "")
    .slice(0, 120)
    .trim();
  return `${stem || "attachment"}${extension}`;
}

function validateUtf8Text(bytes: Buffer) {
  if (bytes.includes(0)) throw new Error("attachment_binary_text_rejected");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const text = decoder.decode(bytes);
  const controls = [...text].filter((character) => {
    const code = character.charCodeAt(0);
    return (
      code < 32 &&
      character !== "\n" &&
      character !== "\r" &&
      character !== "\t"
    );
  }).length;
  if (controls > Math.max(2, Math.floor(text.length / 1000))) {
    throw new Error("attachment_binary_text_rejected");
  }
}

export type ValidatedOperationsEmailUpload = {
  filename: string;
  contentType: string;
  bytes: Buffer;
  sizeBytes: number;
  sha256: string;
};

export async function validateOperationsEmailUpload(input: {
  originalFilename: string;
  declaredMimeType?: string | null;
  bytes: Buffer;
  maxFileBytes?: number;
}): Promise<ValidatedOperationsEmailUpload> {
  const filename = sanitizeOperationsEmailAttachmentFilename(
    input.originalFilename,
  );
  const extension = path.extname(filename).toLowerCase();
  if (!SAFE_EXTENSIONS.has(extension))
    throw new Error("attachment_type_not_allowed");
  if (input.bytes.length === 0) throw new Error("attachment_empty");
  const limit =
    input.maxFileBytes ?? getOperationsEmailAttachmentLimits().maxFileBytes;
  if (input.bytes.length > limit) throw new Error("attachment_file_too_large");

  const detected = await fileTypeFromBuffer(input.bytes);
  const expected = MIME_BY_EXTENSION[extension];
  if (extension === ".txt" || extension === ".csv") {
    if (detected) throw new Error("attachment_content_mismatch");
    validateUtf8Text(input.bytes);
  } else if ([".docx", ".xlsx", ".pptx"].includes(extension)) {
    if (!detected || !["zip", extension.slice(1)].includes(detected.ext)) {
      throw new Error("attachment_content_mismatch");
    }
    const ascii = input.bytes.toString("latin1");
    if (/vbaProject\.bin|macros\//i.test(ascii)) {
      throw new Error("attachment_macro_enabled_rejected");
    }
    const marker =
      extension === ".docx" ? "word/" : extension === ".xlsx" ? "xl/" : "ppt/";
    if (!ascii.includes("[Content_Types].xml") || !ascii.includes(marker)) {
      throw new Error("attachment_content_mismatch");
    }
  } else {
    const expectedDetected = extension === ".jpeg" ? "jpg" : extension.slice(1);
    if (detected?.ext !== expectedDetected)
      throw new Error("attachment_content_mismatch");
  }

  const declared = input.declaredMimeType?.split(";")[0]?.trim().toLowerCase();
  if (declared && declared !== "application/octet-stream") {
    const tolerated =
      extension === ".csv" &&
      ["text/csv", "text/plain", "application/vnd.ms-excel"].includes(declared);
    if (!tolerated && declared !== expected)
      throw new Error("attachment_mime_mismatch");
  }
  return {
    filename,
    contentType: expected,
    bytes: input.bytes,
    sizeBytes: input.bytes.length,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}

export function estimateOperationsEmailMimeBytes(
  textBytes: number,
  attachmentBytes: number,
) {
  return textBytes + Math.ceil(attachmentBytes / 3) * 4 + 8192;
}
