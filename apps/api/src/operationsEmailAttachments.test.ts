import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateOperationsEmailMimeBytes,
  getOperationsEmailAttachmentLimits,
  sanitizeOperationsEmailAttachmentFilename,
  validateOperationsEmailUpload,
} from "./operationsEmailAttachments";

const tinyPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");

test("attachment limits default to 10 MiB per file and 20 MiB total", () => {
  const limits = getOperationsEmailAttachmentLimits({} as NodeJS.ProcessEnv);
  assert.equal(limits.maxFileBytes, 10 * 1024 * 1024);
  assert.equal(limits.maxTotalBytes, 20 * 1024 * 1024);
  assert.equal(limits.maxEstimatedMimeBytes, 28 * 1024 * 1024);
});

test("unsafe path components and controls are removed from filenames", () => {
  assert.equal(
    sanitizeOperationsEmailAttachmentFilename(
      "../client\\quarter\u0000 report.pdf",
    ),
    "quarter report.pdf",
  );
});

test("a signature-verified PDF succeeds and receives a server hash", async () => {
  const result = await validateOperationsEmailUpload({
    originalFilename: "report.pdf",
    declaredMimeType: "application/pdf",
    bytes: tinyPdf,
  });
  assert.equal(result.contentType, "application/pdf");
  assert.equal(result.sizeBytes, tinyPdf.length);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test("HTML, SVG, executables and archives are rejected by extension", async () => {
  for (const filename of [
    "page.html",
    "logo.svg",
    "run.exe",
    "bundle.zip",
    "macro.docm",
  ]) {
    await assert.rejects(
      validateOperationsEmailUpload({
        originalFilename: filename,
        bytes: Buffer.from("content"),
      }),
      /attachment_type_not_allowed/,
    );
  }
});

test("content and declared MIME mismatches are rejected", async () => {
  await assert.rejects(
    validateOperationsEmailUpload({
      originalFilename: "photo.jpg",
      declaredMimeType: "image/jpeg",
      bytes: tinyPdf,
    }),
    /attachment_content_mismatch/,
  );
  await assert.rejects(
    validateOperationsEmailUpload({
      originalFilename: "report.pdf",
      declaredMimeType: "image/png",
      bytes: tinyPdf,
    }),
    /attachment_mime_mismatch/,
  );
});

test("text validation rejects null bytes and invalid UTF-8", async () => {
  await assert.rejects(
    validateOperationsEmailUpload({
      originalFilename: "notes.txt",
      bytes: Buffer.from([65, 0, 66]),
    }),
    /attachment_binary_text_rejected/,
  );
  await assert.rejects(
    validateOperationsEmailUpload({
      originalFilename: "notes.csv",
      bytes: Buffer.from([0xc3, 0x28]),
    }),
  );
});

test("per-file and estimated encoded limits are server-calculated", async () => {
  await assert.rejects(
    validateOperationsEmailUpload({
      originalFilename: "report.pdf",
      bytes: tinyPdf,
      maxFileBytes: 4,
    }),
    /attachment_file_too_large/,
  );
  assert.ok(estimateOperationsEmailMimeBytes(1000, 3000) > 4000);
});
