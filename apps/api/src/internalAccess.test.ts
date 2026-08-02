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
import { adminGuard } from "./adminAccess";
import {
  parseOperationsBusinessInput,
  parseOperationsCommunicationInput,
  parseOperationsCommunicationTemplateInput,
  parseOperationsContactInput,
  parseOperationsTaskInput,
  renderClientCommunicationTemplate,
  serializeOperationsSummary,
} from "./operationsHelpers";

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

function invokeAdminOnlyGuard(
  request: {
    user?: { id: string; email: string; isAdmin?: boolean };
  } = {},
) {
  const req = {
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

  adminGuard(req, res, () => {
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

test("operations summary serialization returns a compact safe shape", () => {
  const serialized = serializeOperationsSummary({
    counts: {
      followUpsDue: 0,
      prospectsAwaitingContact: 0,
      reportsAwaitingReview: 1,
      criticalClientSites: 2,
      quotesAwaitingResponse: 0,
      openWorkItems: 0,
    },
    monitoringAttention: [
      {
        id: "issues:scan_1",
        kind: "high_priority_issues",
        severity: "critical",
        title: "example.com has 2 high-priority issues",
        detail: "1 critical and 1 high",
        href: "/report?scanRunId=scan_1",
        siteId: "site_1",
        scanRunId: "scan_1",
        occurredAt: new Date("2026-01-01T12:00:00.000Z"),
      },
    ],
    recentActivity: [
      {
        id: "scan-completed:scan_1",
        kind: "scan_completed",
        title: "Scan completed for example.com",
        detail: "A completed report is ready to review.",
        href: "/report?scanRunId=scan_1",
        occurredAt: new Date("2026-01-01T12:05:00.000Z"),
      },
    ],
    generatedAt: new Date("2026-01-01T12:10:00.000Z"),
  });

  assert.deepEqual(Object.keys(serialized).sort(), [
    "counts",
    "generatedAt",
    "monitoringAttention",
    "recentActivity",
  ]);
  assert.equal(
    serialized.monitoringAttention[0]?.occurredAt,
    "2026-01-01T12:00:00.000Z",
  );
  assert.equal(
    serialized.recentActivity[0]?.occurredAt,
    "2026-01-01T12:05:00.000Z",
  );
  const payload = JSON.stringify(serialized);
  assert(!payload.includes("INTERNAL_ADMIN_EMAILS"));
  assert(!payload.includes("API_INTERNAL_TOKEN"));
  assert(!payload.includes("SESSION_SECRET"));
});

test("operations business creation validation requires a business name", () => {
  assert.throws(
    () => parseOperationsBusinessInput({ name: " " }),
    /business_name_required/,
  );
  const input = parseOperationsBusinessInput({
    name: "Example Co",
    websiteUrl: "example.com",
    generalEmail: "hello@example.com",
  });
  assert.equal(input.name, "Example Co");
  assert.equal(input.websiteUrl, "https://example.com");
  assert.equal(input.generalEmail, "hello@example.com");
});

test("operations business validation rejects invalid pipeline stages", () => {
  assert.throws(
    () =>
      parseOperationsBusinessInput({
        name: "Example Co",
        pipelineStage: "made_up",
      }),
    /invalid_pipeline_stage/,
  );
});

test("operations business validation rejects invalid website URLs", () => {
  assert.throws(
    () =>
      parseOperationsBusinessInput({
        name: "Example Co",
        websiteUrl: "localhost",
      }),
    /invalid_hostname/,
  );
});

test("operations contact validation accepts useful contact details and rejects invalid email", () => {
  const contact = parseOperationsContactInput({
    firstName: "Ada",
    email: "ada@example.com",
    isPrimary: true,
  });
  assert.equal(contact.firstName, "Ada");
  assert.equal(contact.email, "ada@example.com");
  assert.equal(contact.isPrimary, true);

  assert.throws(
    () => parseOperationsContactInput({ email: "not-an-email" }),
    /invalid_contact_email/,
  );
  assert.throws(
    () => parseOperationsContactInput({}),
    /contact_details_required/,
  );
});

test("operations client communication template validation keeps templates separate from transactional email", () => {
  const input = parseOperationsCommunicationTemplateInput({
    name: "Warm intro",
    category: "warm_introduction",
    subjectTemplate: "Website health check for {{businessName}}",
    bodyTemplate: "Hi {{firstName}}",
    isActive: true,
  });
  assert.equal(input.category, "warm_introduction");
  assert.equal(
    input.subjectTemplate,
    "Website health check for {{businessName}}",
  );

  assert.throws(
    () =>
      parseOperationsCommunicationTemplateInput({
        name: "Bad",
        category: "scan_failed",
        subjectTemplate: "System alert",
        bodyTemplate: "This is a transactional key and should not validate.",
      }),
    /invalid_template_category/,
  );
});

test("operations client communication rendering reports unresolved placeholders", () => {
  const rendered = renderClientCommunicationTemplate(
    {
      subject_template: "A quick website observation for {{businessName}}",
      body_template:
        "Hi {{firstName}},\n\n{{topFinding}}\n\nFrom {{senderName}} at {{senderEmail}}. {{unknownThing}}",
    },
    {
      business: {
        id: "business_1",
        name: "Example Co",
        website_url: "https://www.example.com",
        general_email: null,
      },
      contact: {
        id: "contact_1",
        first_name: "Ada",
        last_name: "Lovelace",
        email: "ada@example.com",
      },
      site: {
        site_id: "site_1",
        url: "https://www.example.com",
        site_display_name: null,
        latest_scan_id: "scan_1",
        critical_issue_count: 1,
        high_issue_count: 2,
        top_finding: "critical issue on https://www.example.com/broken",
      },
    },
    { senderName: "Scanlark Ops" },
  );

  assert.equal(rendered.subject, "A quick website observation for Example Co");
  assert(rendered.body.includes("Hi Ada"));
  assert(
    rendered.body.includes("critical issue on https://www.example.com/broken"),
  );
  assert(rendered.body.includes("{{senderEmail}}"));
  assert(rendered.body.includes("{{unknownThing}}"));
  assert.deepEqual(rendered.unresolvedPlaceholders, [
    "senderEmail",
    "unknownThing",
  ]);
});

test("operations communication validation distinguishes drafts from sent records", () => {
  const draft = parseOperationsCommunicationInput({
    contactId: "11111111-1111-4111-8111-111111111111",
    templateId: "22222222-2222-4222-8222-222222222222",
    direction: "outbound",
    channel: "email",
    status: "draft",
    subject: "Draft subject",
    body: "Draft body",
    followUpAt: "2026-01-15T09:00:00.000Z",
  });
  assert.equal(draft.status, "draft");
  assert.equal(draft.sentAt, undefined);
  assert(draft.followUpAt instanceof Date);

  const sent = parseOperationsCommunicationInput({
    status: "sent",
    body: "Sent body",
  });
  assert.equal(sent.status, "sent");
  assert.equal(sent.sentAt, undefined);

  assert.throws(
    () =>
      parseOperationsCommunicationInput({
        status: "emailed",
        body: "Nope",
      }),
    /invalid_communication_status/,
  );
});

test("operations task validation supports follow-up scheduling and snoozing inputs", () => {
  const task = parseOperationsTaskInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    contactId: "22222222-2222-4222-8222-222222222222",
    title: "Follow up on report",
    dueAt: "2026-01-16T10:00:00.000Z",
    notes: "Ask whether they reviewed the report.",
  });
  assert.equal(task.title, "Follow up on report");
  assert(task.dueAt instanceof Date);

  const patch = parseOperationsTaskInput(
    { status: "snoozed", dueAt: "2026-01-17T10:00:00.000Z" },
    { partial: true },
  );
  assert.equal(patch.status, "snoozed");

  assert.throws(
    () =>
      parseOperationsTaskInput({
        businessId: "not-a-uuid",
        title: "Bad task",
        dueAt: "2026-01-16T10:00:00.000Z",
      }),
    /invalid_businessId/,
  );
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

test("operations summary authorization requires an authenticated administrator", async () => {
  await withEnv(
    {
      ADMIN_EMAILS: undefined,
      INTERNAL_ONLY_MODE: "true",
      INTERNAL_ADMIN_EMAILS: "admin@example.com",
    },
    () => {
      const unauthenticated = invokeAdminOnlyGuard();
      assert.equal(unauthenticated.statusCode, 401);
      assert.equal(unauthenticated.nextCalled, false);

      const nonAdmin = invokeAdminOnlyGuard({
        user: { id: "user_1", email: "user@example.com" },
      });
      assert.equal(nonAdmin.statusCode, 403);
      assert.equal(nonAdmin.nextCalled, false);

      const admin = invokeAdminOnlyGuard({
        user: { id: "admin_1", email: " ADMIN@example.com " },
      });
      assert.equal(admin.nextCalled, true);
      assert.equal(admin.statusCode, null);
    },
  );
});

test("operations summary authorization fails closed without admin configuration", async () => {
  await withEnv(
    {
      ADMIN_EMAILS: undefined,
      INTERNAL_ONLY_MODE: "true",
      INTERNAL_ADMIN_EMAILS: undefined,
    },
    () => {
      const res = invokeAdminOnlyGuard({
        user: { id: "admin_1", email: "admin@example.com" },
      });
      assert.equal(res.statusCode, 403);
      assert.equal(res.nextCalled, false);
    },
  );
});

test("operations summary authorization uses existing admin allowlist when internal-only is off", async () => {
  await withEnv(
    {
      ADMIN_EMAILS: "ops@example.com",
      INTERNAL_ONLY_MODE: "false",
      INTERNAL_ADMIN_EMAILS: "internal@example.com",
    },
    () => {
      const admin = invokeAdminOnlyGuard({
        user: { id: "admin_1", email: "OPS@example.com" },
      });
      assert.equal(admin.nextCalled, true);

      const internalOnlyAdmin = invokeAdminOnlyGuard({
        user: { id: "admin_2", email: "internal@example.com" },
      });
      assert.equal(internalOnlyAdmin.statusCode, 403);
      assert.equal(internalOnlyAdmin.nextCalled, false);
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
