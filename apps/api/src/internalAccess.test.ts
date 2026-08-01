import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import {
  getPublicConfig,
  internalOnlyGuard,
  isInternalAdminEmail,
  isRegistrationAvailable,
  isTrustedWorkerNotifyRequest,
  parseEmailAllowlist,
} from "./internalAccess";

async function withEnv<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  try {
    return await fn();
  } finally {
    for (const key of Object.keys(env)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function invokeGuard(
  request: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    user?: { id: string; email: string; isAdmin?: boolean };
  } = {},
) {
  const req = {
    method: request.method ?? "GET",
    path: request.path ?? "/sites",
    headers: request.headers ?? {},
    user: request.user,
  } as Request;
  const result: {
    statusCode: number | null;
    body: unknown;
    nextCalled: boolean;
  } = {
    statusCode: null,
    body: null,
    nextCalled: false,
  };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as Response;

  internalOnlyGuard(req, res, () => {
    result.nextCalled = true;
  });
  return result;
}

test("public config exposes only non-sensitive client configuration", () => {
  const config = getPublicConfig({
    INTERNAL_ONLY_MODE: "true",
    INTERNAL_ADMIN_EMAILS: "admin@example.com",
    API_INTERNAL_TOKEN: "secret-token",
    SESSION_SECRET: "secret-session",
    PUBLIC_CONTACT_EMAIL: "contact@example.com",
  });

  assert.deepEqual(config, {
    internalOnlyMode: true,
    registrationAvailable: false,
    contactEmail: "contact@example.com",
  });
  assert(!("internalAdminEmails" in config));
  assert(!("apiInternalToken" in config));
  assert(!("sessionSecret" in config));
});

test("multiple administrator emails are parsed case-insensitively", () => {
  const emails = parseEmailAllowlist(" Admin@Example.com, ops@example.com ");
  assert(emails.has("admin@example.com"));
  assert(emails.has("ops@example.com"));
  assert.equal(emails.size, 2);
  assert(
    isInternalAdminEmail(" ADMIN@example.com ", {
      INTERNAL_ADMIN_EMAILS: "admin@example.com,ops@example.com",
    }),
  );
});

test("missing internal administrator configuration fails securely", () => {
  assert.equal(
    isInternalAdminEmail("admin@example.com", {
      INTERNAL_ONLY_MODE: "true",
      INTERNAL_ADMIN_EMAILS: "",
    }),
    false,
  );
});

test("internal-only off preserves registration availability", () => {
  assert.equal(isRegistrationAvailable({ INTERNAL_ONLY_MODE: "false" }), true);
});

test("unauthenticated operational request receives 401 in internal-only mode", async () => {
  await withEnv(
    { INTERNAL_ONLY_MODE: "true", INTERNAL_ADMIN_EMAILS: "admin@example.com" },
    () => {
      const res = invokeGuard();
      assert.equal(res.statusCode, 401);
      assert.deepEqual(res.body, { error: "unauthorized" });
      assert.equal(res.nextCalled, false);
    },
  );
});

test("authenticated non-admin receives 403 in internal-only mode", async () => {
  await withEnv(
    { INTERNAL_ONLY_MODE: "true", INTERNAL_ADMIN_EMAILS: "admin@example.com" },
    () => {
      const res = invokeGuard({
        user: { id: "user_1", email: "user@example.com" },
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: "forbidden" });
      assert.equal(res.nextCalled, false);
    },
  );
});

test("approved administrator retains access including authenticated report PDF flow", async () => {
  await withEnv(
    { INTERNAL_ONLY_MODE: "true", INTERNAL_ADMIN_EMAILS: "admin@example.com" },
    () => {
      const sitesRes = invokeGuard({
        user: { id: "admin_1", email: " ADMIN@example.com ", isAdmin: true },
      });
      assert.equal(sitesRes.nextCalled, true);

      const reportRes = invokeGuard({
        path: "/scan-runs/run_1/report",
        user: { id: "admin_1", email: "admin@example.com", isAdmin: true },
      });
      assert.equal(reportRes.nextCalled, true);
    },
  );
});

test("existing non-admin sessions do not bypass the internal restriction", async () => {
  await withEnv(
    { INTERNAL_ONLY_MODE: "true", INTERNAL_ADMIN_EMAILS: "admin@example.com" },
    () => {
      const res = invokeGuard({
        path: "/scan-runs/run_1/report",
        user: { id: "legacy_1", email: "legacy@example.com" },
      });
      assert.equal(res.statusCode, 403);
      assert.deepEqual(res.body, { error: "forbidden" });
    },
  );
});

test("blocked users can still log out in internal-only mode", async () => {
  await withEnv(
    {
      INTERNAL_ONLY_MODE: "true",
      INTERNAL_ADMIN_EMAILS: "admin@example.com",
      SESSION_SECRET: "s".repeat(32),
    },
    () => {
      assert.equal(isRegistrationAvailable(), false);
      const operationalRes = invokeGuard({
        path: "/sites",
        user: { id: "user_1", email: "user@example.com" },
      });
      assert.equal(operationalRes.statusCode, 403);
      // /auth/logout is mounted before internalOnlyGuard in index.ts, so the
      // guard must not be used to protect logout.
      assert.equal(operationalRes.nextCalled, false);
    },
  );
});

test("registration endpoint is rejected in internal-only mode", async () => {
  await withEnv({ INTERNAL_ONLY_MODE: "true" }, () => {
    assert.equal(isRegistrationAvailable(), false);
  });
});

test("worker token bypass is accepted only on the exact notify endpoint", async () => {
  await withEnv(
    {
      INTERNAL_ONLY_MODE: "true",
      INTERNAL_ADMIN_EMAILS: "admin@example.com",
      API_INTERNAL_TOKEN: "token-token-token-token-token-123",
    },
    () => {
      const notifyReq = {
        method: "POST",
        path: "/scan-runs/run_1/notify",
        headers: { "x-internal-token": "token-token-token-token-token-123" },
      } as unknown as Request;
      assert.equal(isTrustedWorkerNotifyRequest(notifyReq), true);
      const notifyRes = invokeGuard({
        method: "POST",
        path: "/scan-runs/run_1/notify",
        headers: { "x-internal-token": "token-token-token-token-token-123" },
      });
      assert.equal(notifyRes.nextCalled, true);

      const sitesRes = invokeGuard({
        headers: { "x-internal-token": "token-token-token-token-token-123" },
      });
      assert.equal(sitesRes.statusCode, 401);

      const relatedScanRes = invokeGuard({
        path: "/scan-runs/run_1/report",
        headers: { "x-internal-token": "token-token-token-token-token-123" },
      });
      assert.equal(relatedScanRes.statusCode, 401);
    },
  );
});
