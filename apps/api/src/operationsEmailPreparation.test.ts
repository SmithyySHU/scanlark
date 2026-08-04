import assert from "node:assert/strict";
import test from "node:test";
import { buildOperationsEmailTestVariant } from "./operationsEmailPreparation";

test("test variant prefixes subject and visibly identifies the intended client recipient", () => {
  const result = buildOperationsEmailTestVariant({
    subject: "Quote update",
    html: "<p>Hello</p>",
    plainText: "Hello",
    intendedRecipient: "client+tag@example.com<script>",
  });
  assert.equal(result.subject, "[TEST] Quote update");
  assert.ok(result.html.includes("TEST MESSAGE"));
  assert.ok(result.html.includes("client+tag@example.com&lt;script&gt;"));
  assert.equal(result.html.includes("<script>"), false);
  assert.ok(result.plainText.startsWith("[TEST MESSAGE"));
  assert.ok(result.plainText.includes("client+tag@example.com<script>"));
});
