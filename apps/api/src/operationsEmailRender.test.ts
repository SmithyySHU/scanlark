import assert from "node:assert/strict";
import test from "node:test";
import {
  OPERATIONS_EMAIL_RENDERER_VERSION,
  OPERATIONS_EMAIL_SIGNATURE_TEXT,
  renderOperationsEmailFinal,
} from "./operationsEmailRender";

function message(overrides: Record<string, unknown> = {}) {
  return {
    revision: 7,
    subject: "Your website report",
    editor_body: "Hello Alex,\n\nYour report is ready at https://scanlark.com.",
    preheader: "Report ready",
    recipient_address: "alex@example.com",
    source_snapshot_json: {
      signatureMode: "use_mailbox_signature",
      layoutKey: "personal_letter",
    },
    ...overrides,
  } as never;
}

test("final direct render includes one complete approved signature", () => {
  const result = renderOperationsEmailFinal(message());
  assert.equal(result.errors.length, 0);
  for (const line of [
    "Connor Smith",
    "Founder, Scanlark",
    "Website health checks and monitoring",
    "contact@scanlark.com",
    "scanlark.com",
  ]) {
    assert.ok(result.html.includes(line));
    assert.ok(result.plainText.includes(line));
  }
  assert.equal(result.rendererVersion, OPERATIONS_EMAIL_RENDERER_VERSION);
  assert.match(result.htmlSha256, /^[0-9a-f]{64}$/);
  assert.match(result.plainTextSha256, /^[0-9a-f]{64}$/);
});

test("mailbox-signature source policy cannot remove the direct signature", () => {
  const result = renderOperationsEmailFinal(message());
  assert.ok(result.plainText.includes(OPERATIONS_EMAIL_SIGNATURE_TEXT));
  assert.equal(result.plainText.split("Founder, Scanlark").length - 1, 1);
});

test("an exact signature pasted into the body is not duplicated", () => {
  const result = renderOperationsEmailFinal(
    message({ editor_body: `Hello\n\n${OPERATIONS_EMAIL_SIGNATURE_TEXT}` }),
  );
  assert.equal(result.plainText.split("Founder, Scanlark").length - 1, 1);
  assert.equal(result.html.split("Founder, Scanlark").length - 1, 1);
});

test("render is left aligned, resilient to blocked images and contains no tracking", () => {
  const result = renderOperationsEmailFinal(message());
  assert.match(result.html, /text-align: left/);
  assert.match(result.html, /alt="Scanlark"/);
  assert.match(result.html, /mailto:contact@scanlark\.com/);
  assert.match(result.html, /href="https:\/\/scanlark\.com"/);
  assert.equal(result.html.includes("tracking"), false);
  assert.equal(result.html.includes('width="1"'), false);
});

test("stored editor markup is escaped and unsafe constructs cannot execute", () => {
  const result = renderOperationsEmailFinal(
    message({
      editor_body:
        '<script>alert(1)</script><a href="javascript:x">bad</a><form>f</form>',
    }),
  );
  assert.equal(result.html.includes("<script"), false);
  assert.equal(result.html.includes("javascript:"), false);
  assert.equal(result.html.includes("<form"), false);
  assert.ok(result.plainText.includes("<script>"));
});

test("unresolved placeholders are final-render validation errors", () => {
  const result = renderOperationsEmailFinal(
    message({ editor_body: "Hello {{first_name}}" }),
  );
  assert.match(result.errors.join(" "), /Unresolved placeholders/);
  assert.equal(result.revision, 7);
});
