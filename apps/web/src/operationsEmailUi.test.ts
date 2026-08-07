import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL(
    "./components/operations/email/OperationsEmailWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const communicationsSource = readFileSync(
  new URL("./components/OperationsPage.tsx", import.meta.url),
  "utf8",
);

test("Email UI renders only the approved outgoing folders", () => {
  for (const label of ["Drafts", "Ready to send", "Sent", "Failed"]) {
    assert.equal(workspaceSource.includes(`label: "${label}"`), true);
  }
  assert.equal(workspaceSource.includes('label: "Inbox"'), false);
});

test("Checkpoint 5 UI distinguishes test and real-send controls", () => {
  for (const required of [
    "Send test",
    "Send email…",
    "Final real-send confirmation",
    "Confirm and queue real email",
    "Retry same frozen message",
  ])
    assert.equal(
      workspaceSource.includes(required),
      true,
      `missing ${required}`,
    );
  assert.equal(workspaceSource.includes("ops-email-test-send"), true);
  assert.equal(workspaceSource.includes('realSend.mode === "disabled"'), true);
});

test("Email workspace exposes standalone creation and opens the new editor", () => {
  assert.equal(workspaceSource.includes("+ New email"), true);
  assert.equal(
    workspaceSource.includes("apiFetch(`${apiBase}/operations/email/messages`"),
    true,
  );
  assert.equal(
    workspaceSource.includes("setSelectedId(data.message.id)"),
    true,
  );
  assert.equal(
    workspaceSource.includes(
      "folder=drafts&message=${encodeURIComponent(data.message.id)}",
    ),
    true,
  );
});

test("empty folders explain both standalone and Communications workflows", () => {
  for (const text of [
    "No email drafts yet",
    "Create an email here, or prepare an approved draft from",
    "New email",
    "Go to Communications",
  ])
    assert.equal(workspaceSource.includes(text), true, `missing ${text}`);
});

test("safe configuration status keeps drafting available without SMTP", () => {
  for (const text of [
    "Email module enabled",
    "SMTP readiness",
    "Test sending",
    "Real sending",
    "Sender:",
    "Test recipient:",
    "Email drafting is available, but SMTP must be configured before",
  ])
    assert.equal(workspaceSource.includes(text), true, `missing ${text}`);
  assert.equal(workspaceSource.includes("runtimeConfig.smtp.host"), false);
  assert.equal(workspaceSource.includes("runtimeConfig.smtp.password"), false);
  assert.equal(workspaceSource.includes("runtimeConfig.smtp.username"), false);
});

test("standalone CRM linkage is not presented as a delivery requirement", () => {
  assert.match(
    workspaceSource,
    /A business or contact link is optional for standalone[\s\S]*Email/,
  );
  assert.match(
    workspaceSource,
    /recipient restrictions are enforced[\s\S]*server-side send policy/,
  );
});

test("Checkpoint 6 shows independent CRM and IONOS reconciliation actions", () => {
  for (const text of [
    "Post-send records",
    "Link to business/contact",
    "Frozen recipient",
    "Confirm mismatch and link",
    "IONOS Sent copy",
    "Retry saving to IONOS Sent",
    "It will not send the email to the recipient again.",
  ])
    assert.equal(workspaceSource.includes(text), true, `missing ${text}`);
  assert.equal(workspaceSource.includes("resolved_sent_mailbox"), false);
  assert.equal(workspaceSource.includes("raw_mime_bytes"), false);
});

test("Email UI displays all required save states", () => {
  for (const state of [
    "Saving…",
    "Saved",
    "Unsaved changes",
    "Save conflict",
    "Save failed",
  ]) {
    assert.equal(workspaceSource.includes(state), true, `missing ${state}`);
  }
});

test("revision conflict preserves local edits and offers Reload latest", () => {
  assert.equal(workspaceSource.includes('setSaveState("conflict")'), true);
  assert.equal(workspaceSource.includes("Reload latest"), true);
  assert.equal(
    workspaceSource.includes("setForm(detailToForm(data.latest))"),
    false,
  );
});

test("narrow screens switch from list to a full editor with Back", () => {
  assert.equal(
    workspaceSource.includes(".ops-email-shell.has-selection"),
    true,
  );
  assert.equal(workspaceSource.includes("Retry the same frozen email?"), true);
  assert.equal(workspaceSource.includes("Back to messages"), true);
  assert.equal(workspaceSource.includes("@media (max-width: 760px)"), true);
});

test("editor and final server previews are distinct and sandboxed", () => {
  assert.equal(workspaceSource.includes('sandbox=""'), true);
  assert.equal(workspaceSource.includes("Editor preview"), true);
  assert.equal(workspaceSource.includes("Final email preview"), true);
  assert.match(
    workspaceSource,
    /includes the Scanlark\s+signature used for direct sending/,
  );
  assert.equal(workspaceSource.includes("Plain text"), true);
});

test("Checkpoint 4 attachment controls remain present", () => {
  for (const label of [
    "Attachments",
    "Generate persisted quote PDF",
    "Upload manual file",
    "Remove",
  ]) {
    assert.equal(workspaceSource.includes(label), true, `missing ${label}`);
  }
  assert.match(workspaceSource, /10 MiB per file;\s+20 MiB total/);
});

test("delivery language does not overclaim SMTP acceptance", () => {
  assert.equal(
    workspaceSource.includes("Accepted by outgoing mail server"),
    true,
  );
  assert.match(
    workspaceSource,
    /recipient delivery or reading\s+is not claimed/,
  );
  assert.match(workspaceSource, /will never be\s+resent automatically/);
});

test("From and Reply-To fields are read-only", () => {
  assert.match(workspaceSource, /<label>\s*From\s*<input[\s\S]*?readOnly/);
  assert.match(workspaceSource, /<label>\s*Reply-To\s*<input[\s\S]*?readOnly/);
  assert.ok(workspaceSource.split("readOnly").length - 1 >= 2);
});

test("Communications uses one bounded batch source-link request", () => {
  assert.equal(
    communicationsSource.includes("/operations/email/source-links"),
    true,
  );
  assert.equal(
    communicationsSource.includes(
      "communicationIds: communications.map((item) => item.id)",
    ),
    true,
  );
});

test("Communications exposes the approved linked Email actions", () => {
  for (const label of [
    "Open in Email Editor",
    "Continue in Email Editor",
    "View sent email",
    "View final Communication",
    "Open failed Email",
  ]) {
    assert.equal(
      communicationsSource.includes(label),
      true,
      `missing ${label}`,
    );
  }
});

test("Communications exposes the approved linked status language", () => {
  for (const label of [
    "Editing in Email",
    "Ready in Email",
    "Queued for Email delivery",
    "Sending through Email",
    "Sent through Email",
    "Delivery outcome uncertain",
  ]) {
    assert.equal(
      communicationsSource.includes(label),
      true,
      `missing ${label}`,
    );
  }
});

test("final Communication link is conditional on its linked ID", () => {
  assert.equal(
    communicationsSource.includes("selectedEmailLink.sentCommunicationId &&"),
    true,
  );
  assert.equal(communicationsSource.includes("View final Communication"), true);
});

test("manual Communications tools remain alongside Email actions", () => {
  for (const label of [
    "Copy formatted email",
    "Copy plain text",
    "Download HTML",
    "Open email client",
    "Open IONOS Webmail",
    "Yes, mark as sent",
  ]) {
    assert.equal(
      communicationsSource.includes(label),
      true,
      `missing ${label}`,
    );
  }
});
