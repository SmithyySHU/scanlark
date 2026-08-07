import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canShowOperationsEmailNavigation } from "./operationsCapabilities";

test("Email navigation is hidden when the server flag is disabled", () => {
  assert.equal(
    canShowOperationsEmailNavigation({
      canAccessOperations: true,
      canMutateOperations: true,
      canUseOperationsEmail: true,
      operationsEmailEnabled: false,
      workspaceSelectionRequired: false,
    }),
    false,
  );
});

test("Email navigation is hidden from a viewer", () => {
  assert.equal(
    canShowOperationsEmailNavigation({
      canAccessOperations: true,
      canMutateOperations: false,
      canUseOperationsEmail: false,
      operationsEmailEnabled: true,
      workspaceSelectionRequired: false,
    }),
    false,
  );
});

test("Email navigation is visible to an authorised member when enabled", () => {
  assert.equal(
    canShowOperationsEmailNavigation({
      canAccessOperations: true,
      canMutateOperations: true,
      canUseOperationsEmail: true,
      operationsEmailEnabled: true,
      workspaceSelectionRequired: false,
    }),
    true,
  );
});

test("Communications and its manual controls remain present", () => {
  const source = readFileSync(
    new URL("./components/OperationsPage.tsx", import.meta.url),
    "utf8",
  );
  for (const expected of [
    'key: "communications"',
    "Copy plain text",
    "Copy formatted email",
    "Download HTML",
    "Open email client",
    "Open IONOS Webmail",
    '"Mark sent"',
  ]) {
    assert.equal(source.includes(expected), true, `missing ${expected}`);
  }
});
