import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATIONS_EMAIL_FOLDER_STATUSES,
  parseEmailFolder,
  parseExpectedRevision,
  parseOperationsEmailEditorPatch,
  renderOperationsEmailEditorPreview,
  validateOperationsEmailReady,
} from "./operationsEmailHelpers";

test("Email folders expose no Inbox or reply folder", () => {
  assert.deepEqual(Object.keys(OPERATIONS_EMAIL_FOLDER_STATUSES), [
    "drafts",
    "ready",
    "sent",
    "failed",
  ]);
});

test("failed folder includes uncertain and cancelled records", () => {
  assert.deepEqual(OPERATIONS_EMAIL_FOLDER_STATUSES.failed, [
    "failed",
    "delivery_uncertain",
    "cancelled",
  ]);
});

test("missing folder selects drafts", () => {
  assert.equal(parseEmailFolder(undefined), "drafts");
});

test("unsupported folder is rejected", () => {
  assert.throws(() => parseEmailFolder("inbox"), /invalid_email_folder/);
});

test("editor patch requires a positive integer revision", () => {
  assert.throws(
    () => parseOperationsEmailEditorPatch({ expectedRevision: 0 }),
    /invalid_expected_revision/,
  );
});

test("editor patch rejects browser-owned rendered HTML", () => {
  assert.throws(
    () =>
      parseOperationsEmailEditorPatch({
        expectedRevision: 1,
        renderedHtml: "<script>alert(1)</script>",
      }),
    /unsupported_email_editor_field:renderedHtml/,
  );
});

test("editor patch rejects browser-owned From identity", () => {
  assert.throws(
    () =>
      parseOperationsEmailEditorPatch({
        expectedRevision: 1,
        fromAddress: "attacker@example.com",
      }),
    /unsupported_email_editor_field:fromAddress/,
  );
});

test("editor patch trims and accepts supported editable fields", () => {
  assert.deepEqual(
    parseOperationsEmailEditorPatch({
      expectedRevision: 4,
      recipientName: "  Alex Client ",
      recipientAddress: "alex@example.com",
      subject: "  Report ready ",
      preheader: "  A short preview ",
      editorBody: "  Hello Alex  ",
    }),
    {
      expectedRevision: 4,
      patch: {
        recipientName: "Alex Client",
        recipientAddress: "alex@example.com",
        subject: "Report ready",
        preheader: "A short preview",
        editorBody: "Hello Alex",
      },
    },
  );
});

test("invalid recipient is rejected on edit", () => {
  assert.throws(
    () =>
      parseOperationsEmailEditorPatch({
        expectedRevision: 1,
        recipientAddress: "not-an-email",
      }),
    /invalid_recipient_address/,
  );
});

test("ready validation accepts resolved content", () => {
  assert.doesNotThrow(() =>
    validateOperationsEmailReady({
      recipientAddress: "client@example.com",
      subject: "Your report",
      editorBody: "Hello Alex, your report is ready.",
    }),
  );
});

test("ready validation rejects an invalid recipient", () => {
  assert.throws(
    () =>
      validateOperationsEmailReady({
        recipientAddress: "invalid",
        subject: "Subject",
        editorBody: "Body",
      }),
    /invalid_recipient_address/,
  );
});

test("ready validation rejects unresolved placeholders", () => {
  assert.throws(
    () =>
      validateOperationsEmailReady({
        recipientAddress: "client@example.com",
        subject: "Hello {{first_name}}",
        editorBody: "Body",
      }),
    /unresolved_email_placeholders:first_name/,
  );
});

test("preview escapes active markup from the editor body", () => {
  const preview = renderOperationsEmailEditorPreview(
    "Hello\n\n<script>alert('x')</script>",
  );
  assert.equal(preview.includes("<script"), false);
  assert.equal(preview.includes("&lt;script&gt;"), true);
});

test("preview preserves paragraphs and line breaks", () => {
  const preview = renderOperationsEmailEditorPreview("One\nline\n\nTwo");
  assert.match(preview, /<p>One<br>line<\/p><p>Two<\/p>/);
});

test("lifecycle revision parser rejects strings", () => {
  assert.throws(
    () => parseExpectedRevision({ expectedRevision: "3" }),
    /invalid_expected_revision/,
  );
});
