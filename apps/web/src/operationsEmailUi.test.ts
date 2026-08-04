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

test("Email UI does not expose send, test-send, or SMTP retry controls", () => {
  for (const forbidden of [">Send Email<", ">Send Test<", ">Retry SMTP<"]) {
    assert.equal(workspaceSource.includes(forbidden), false);
  }
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

test("Checkpoint 4 attachment controls are present without delivery actions", () => {
  for (const label of [
    "Attachments",
    "Generate persisted quote PDF",
    "Upload manual file",
    "Remove",
  ]) {
    assert.equal(workspaceSource.includes(label), true, `missing ${label}`);
  }
  assert.match(workspaceSource, /10 MiB per file;\s+20 MiB total/);
  assert.equal(workspaceSource.includes(">Send Email<"), false);
  assert.equal(workspaceSource.includes(">Send Test<"), false);
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
  assert.equal(
    communicationsSource.includes("View sent Communication event"),
    true,
  );
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
