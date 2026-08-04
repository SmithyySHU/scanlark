import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { isOperationsEmailModuleEnabled } from "../../../packages/db/src/operationsEmailConfig";
import {
  createRequireOperationsEmailAccess,
  deriveOperationsCapabilities,
  type OperationsCapabilities,
} from "./operationsAccess";

const enabledAuthorised: OperationsCapabilities = {
  canAccessOperations: true,
  canUseOperationsEmail: true,
  operationsEmailEnabled: true,
};

function capabilitiesFor(
  role: "owner" | "operations_admin" | "operations_member" | "viewer" | null,
  options: {
    active?: boolean;
    enabled?: boolean;
    internalAccessAllowed?: boolean;
    existingAdmin?: boolean;
  } = {},
) {
  return deriveOperationsCapabilities({
    memberships: role
      ? [
          {
            workspace_code: "scanlark-operations",
            role,
            is_active: options.active ?? true,
          },
        ]
      : [],
    hasExistingOperationsAdminAccess: options.existingAdmin ?? false,
    internalAccessAllowed: options.internalAccessAllowed ?? true,
    operationsEmailEnabled: options.enabled ?? true,
  });
}

async function invokeEmailGuard(options: {
  user?: { id: string; email: string };
  capabilities?: OperationsCapabilities;
}) {
  const req = { user: options.user } as Request;
  const result = {
    status: null as number | null,
    body: null as unknown,
    nextCalled: false,
    resolverCalled: false,
  };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;
  const guard = createRequireOperationsEmailAccess(async () => {
    result.resolverCalled = true;
    return options.capabilities ?? enabledAuthorised;
  });
  await Promise.resolve(
    guard(req, res, () => {
      result.nextCalled = true;
    }),
  );
  return result;
}

test("missing Operations Email feature flag defaults to disabled", () => {
  assert.equal(isOperationsEmailModuleEnabled({}), false);
});

test("disabled Operations Email API returns 404 to an authorised actor", async () => {
  const result = await invokeEmailGuard({
    user: { id: "owner", email: "owner@example.com" },
    capabilities: { ...enabledAuthorised, operationsEmailEnabled: false },
  });
  assert.equal(result.status, 404);
  assert.equal(result.nextCalled, false);
});

test("unauthenticated Operations Email API access returns 401", async () => {
  const result = await invokeEmailGuard({});
  assert.equal(result.status, 401);
  assert.equal(result.resolverCalled, false);
});

test("a non-member is denied Operations Email access", async () => {
  const capabilities = capabilitiesFor(null);
  const result = await invokeEmailGuard({
    user: { id: "user", email: "user@example.com" },
    capabilities,
  });
  assert.equal(capabilities.canAccessOperations, false);
  assert.equal(result.status, 403);
});

test("an inactive member is denied Operations Email access", async () => {
  const capabilities = capabilitiesFor("operations_member", { active: false });
  const result = await invokeEmailGuard({
    user: { id: "inactive", email: "inactive@example.com" },
    capabilities,
  });
  assert.equal(capabilities.canUseOperationsEmail, false);
  assert.equal(result.status, 403);
});

test("a viewer is denied Operations Email access", async () => {
  const capabilities = capabilitiesFor("viewer");
  const result = await invokeEmailGuard({
    user: { id: "viewer", email: "viewer@example.com" },
    capabilities,
  });
  assert.equal(capabilities.canAccessOperations, true);
  assert.equal(capabilities.canUseOperationsEmail, false);
  assert.equal(result.status, 403);
});

for (const role of [
  "owner",
  "operations_admin",
  "operations_member",
] as const) {
  test(`${role} may access Operations Email when enabled`, async () => {
    const capabilities = capabilitiesFor(role);
    const result = await invokeEmailGuard({
      user: { id: role, email: `${role}@example.com` },
      capabilities,
    });
    assert.equal(capabilities.canUseOperationsEmail, true);
    assert.equal(result.status, null);
    assert.equal(result.nextCalled, true);
  });
}

test("internal-only access remains an additional capability requirement", () => {
  const capabilities = capabilitiesFor("owner", {
    internalAccessAllowed: false,
  });
  assert.deepEqual(capabilities, {
    canAccessOperations: false,
    canUseOperationsEmail: false,
    operationsEmailEnabled: true,
  });
});

test("enabling Email does not grant an ordinary SaaS user Operations access", () => {
  const capabilities = capabilitiesFor(null, { enabled: true });
  assert.equal(capabilities.canAccessOperations, false);
  assert.equal(capabilities.canUseOperationsEmail, false);
});
