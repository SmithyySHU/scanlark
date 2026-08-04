import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("./routes/operationsEmail.ts", import.meta.url),
  "utf8",
);
const repositorySource = readFileSync(
  new URL("../../../packages/db/src/operationsEmail.ts", import.meta.url),
  "utf8",
);

test("Operations Email API is mounted behind its isolated guard", () => {
  assert.equal(
    routeSource.includes("router.use(requireOperationsEmailAccess)"),
    true,
  );
  assert.equal(
    routeSource.includes('app.use("/operations/email", router)'),
    true,
  );
});

test("Checkpoint 3 exposes transfer, detail, edit and lifecycle routes", () => {
  for (const route of [
    '"/messages/from-communication/:communicationId"',
    '"/messages/:messageId"',
    '"/messages/:messageId/ready"',
    '"/messages/:messageId/return-to-draft"',
    '"/source-links"',
  ]) {
    assert.equal(routeSource.includes(route), true, `missing ${route}`);
  }
});

test("Checkpoint 4 exposes only isolated attachment and render preparation routes", () => {
  for (const route of [
    '"/messages/:messageId/attachment-options"',
    '"/messages/:messageId/attachments/generated"',
    '"/messages/:messageId/attachments/manual"',
    '"/messages/:messageId/attachments/:attachmentId"',
    '"/messages/:messageId/attachments/:attachmentId/download"',
    '"/messages/:messageId/quote-renders/:quoteId"',
    '"/messages/:messageId/final-preview"',
  ]) assert.equal(routeSource.includes(route), true, `missing ${route}`);
  assert.equal(routeSource.includes("multer.memoryStorage()"), true);
  assert.equal(routeSource.includes("prepareOperationsEmailFinal"), true);
});

test("Checkpoint 3 router contains no queue, send or retry endpoint", () => {
  for (const forbidden of [
    'router.post("/send',
    'router.post("/test',
    'router.post("/retry',
    'router.post("/queue',
  ]) {
    assert.equal(routeSource.includes(forbidden), false);
  }
});

test("transfer loads source content server-side", () => {
  assert.equal(routeSource.includes("getOperationsEmailTransferSource"), true);
  assert.equal(routeSource.includes("sourceSnapshotJson"), true);
  assert.equal(routeSource.includes("req.body.body"), false);
  assert.equal(routeSource.includes("req.body.business"), false);
});

test("transfer uses the atomic create-or-get repository operation", () => {
  assert.equal(
    routeSource.includes("createOrGetOperationsEmailMessageFromCommunication"),
    true,
  );
  assert.equal(
    repositorySource.includes("ON CONFLICT (source_communication_id)"),
    true,
  );
});

test("message edits permit only the approved editor fields", () => {
  const helperSource = readFileSync(
    new URL("./operationsEmailHelpers.ts", import.meta.url),
    "utf8",
  );
  for (const allowed of [
    '"recipientName"',
    '"recipientAddress"',
    '"subject"',
    '"preheader"',
    '"editorBody"',
  ]) {
    assert.equal(helperSource.includes(allowed), true);
  }
  assert.equal(helperSource.includes('"fromAddress",'), false);
  assert.equal(helperSource.includes('"workspaceId",'), false);
});

test("list repository selects a compact projection without editor content", () => {
  const listBody = repositorySource.slice(
    repositorySource.indexOf(
      "export async function listOperationsEmailMessageSummaries",
    ),
    repositorySource.indexOf(
      "export async function listOperationsEmailMessages",
    ),
  );
  assert.equal(listBody.includes("message.editor_body"), false);
  assert.equal(listBody.includes("message.rendered_html"), false);
  assert.equal(listBody.includes("message.plain_text"), false);
});

test("ready route revalidates the current source relationship", () => {
  assert.equal(routeSource.includes('source.status !== "ready"'), true);
  assert.equal(
    routeSource.includes("source.business_id !== current.business_id"),
    true,
  );
});

test("audit metadata records field names without body content", () => {
  assert.equal(routeSource.includes("changedFields: Object.keys(patch)"), true);
  assert.equal(routeSource.includes("bodyContent:"), false);
  assert.equal(routeSource.includes("renderedHtmlContent:"), false);
});

test("source-link lookup is bounded", () => {
  assert.equal(routeSource.includes("ids.length > 200"), true);
  assert.equal(routeSource.includes("getOperationsEmailSourceLinks"), true);
});
