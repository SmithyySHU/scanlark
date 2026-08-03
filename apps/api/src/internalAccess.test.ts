import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  addBusinessDays,
  findUnresolvedClientCommunicationPlaceholders,
  getConfiguredDefaultFollowUpBusinessDays,
  parseOperationsBusinessInput,
  parseOperationsCommunicationInput,
  parseOperationsCommunicationTemplateInput,
  parseOperationsContactInput,
  parseOperationsAccessRequirementInput,
  parseOperationsReportCreateInput,
  parseOperationsReportActionPlanItemUpdateInput,
  parseOperationsReportFindingBulkInput,
  parseOperationsReportFindingUpdateInput,
  parseOperationsReportPositiveObservationUpdateInput,
  parseOperationsReportRegroupInput,
  parseOperationsReportSentInput,
  parseOperationsReportUpdateInput,
  parseOperationsClientServiceActivationInput,
  parseOperationsClientServiceInput,
  parseOperationsClientServiceSiteInput,
  parseOperationsClientServiceUsageInput,
  parseOperationsServicePlanInput,
  parseOperationsQuoteAcceptedInput,
  parseOperationsQuoteCreateInput,
  parseOperationsQuoteItemInput,
  parseOperationsTaskInput,
  renderClientCommunicationTemplate,
  serializeOperationsSummary,
} from "./operationsHelpers";
import {
  buildOperationsReportGroupingPreviewForIssues,
  buildOperationsClientReportPayload,
  getOperationsReportReadinessIssues,
  type OperationsReportComparisonItemRow,
  type OperationsReportFindingRow,
  type OperationsReportPositiveObservationRow,
  type OperationsReportActionPlanItemRow,
  type OperationsReportRow,
} from "../../../packages/db/src/operationsReports";
import {
  SCANLARK_OPERATIONS_WORKSPACE_CODE,
  siteAccessPredicate,
  siteManagePredicate,
} from "../../../packages/db/src/internalWorkspaces";
import {
  operationsReportPdfFilename,
  renderOperationsReportHtml,
} from "./operationsReportPdf";
import {
  buildOperationsQuotePreviewPayload,
  calculateQuoteTotals,
  getOperationsCommercialConfig,
  getQuoteReadinessIssues,
  type OperationsQuoteAccessRequirementRow,
  type OperationsQuoteDetail,
  type OperationsQuoteItemRow,
  type OperationsQuoteRow,
} from "../../../packages/db/src/operationsQuotesWork";
import {
  buildServiceTaskKeys,
  calculateServicePeriod,
  getOperationsServiceConfig,
} from "../../../packages/db/src/operationsServices";

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

test("shared Operations site access keeps owner fallback and active workspace membership checks", () => {
  assert.equal(SCANLARK_OPERATIONS_WORKSPACE_CODE, "scanlark-operations");

  const accessSql = siteAccessPredicate("s", "$1");
  assert.match(accessSql, /s\.user_id = \$1/);
  assert.match(accessSql, /operations_business_sites access_obs/);
  assert.match(accessSql, /internal_workspace_memberships access_membership/);
  assert.match(accessSql, /access_membership\.is_active = true/);
  assert.doesNotMatch(accessSql, /operations_admin/);

  const manageSql = siteManagePredicate("site", "$2");
  assert.match(manageSql, /site\.user_id = \$2/);
  assert.match(
    manageSql,
    /access_membership\.role IN \('owner', 'operations_admin', 'operations_member'\)/,
  );
  assert.match(manageSql, /access_membership\.is_active = true/);
});

test("operations summary serialization returns a compact safe shape", () => {
  const serialized = serializeOperationsSummary({
    counts: {
      followUpsDue: 0,
      prospectsAwaitingContact: 0,
      reportsAwaitingReview: 1,
      reportsReadyToSend: 0,
      reportsAwaitingClientResponse: 0,
      reportFollowUpsDue: 0,
      criticalClientSites: 2,
      quotesAwaitingResponse: 0,
      quotesReadyToSend: 0,
      quotesExpiringSoon: 0,
      acceptedQuotesAwaitingConversion: 0,
      openWorkItems: 0,
      awaitingAccess: 0,
      blockedWork: 0,
      workReadyForTesting: 0,
      activeServices: 0,
      serviceReportsDue: 0,
      serviceReviewsDue: 0,
      managedSitesNeedingAttention: 0,
      pausedServices: 0,
      serviceRenewalsApproaching: 0,
      cancellationsPending: 0,
      activeServiceIncidents: 0,
      monthlyReportsReadyToSend: 0,
      clientActionsOutstanding: 0,
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
    doNotContact: true,
    doNotContactReason: "Asked not to receive prospecting email.",
    preferredChannel: "phone",
  });
  assert.equal(contact.firstName, "Ada");
  assert.equal(contact.email, "ada@example.com");
  assert.equal(contact.isPrimary, true);
  assert.equal(contact.doNotContact, true);
  assert.equal(
    contact.doNotContactReason,
    "Asked not to receive prospecting email.",
  );
  assert.equal(contact.preferredChannel, "phone");

  assert.throws(
    () => parseOperationsContactInput({ email: "not-an-email" }),
    /invalid_contact_email/,
  );
  assert.throws(
    () =>
      parseOperationsContactInput({
        firstName: "Ada",
        preferredChannel: "fax",
      }),
    /invalid_preferred_channel/,
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
    defaultFollowUpBusinessDays: 6,
  });
  assert.equal(input.category, "warm_introduction");
  assert.equal(input.defaultFollowUpBusinessDays, 6);
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
  assert.throws(
    () =>
      parseOperationsCommunicationTemplateInput({
        name: "Bad follow-up",
        category: "custom",
        subjectTemplate: "Hello",
        bodyTemplate: "Body",
        defaultFollowUpBusinessDays: 90,
      }),
    /invalid_default_follow_up_business_days/,
  );
});

test("operations default follow-up days support env override and business-day dates", () => {
  assert.equal(
    getConfiguredDefaultFollowUpBusinessDays("cold_outreach", {}),
    4,
  );
  assert.equal(
    getConfiguredDefaultFollowUpBusinessDays("custom", {
      OPERATIONS_DEFAULT_FOLLOW_UP_BUSINESS_DAYS: "2",
    }),
    2,
  );
  assert.equal(
    getConfiguredDefaultFollowUpBusinessDays("custom", {
      OPERATIONS_DEFAULT_FOLLOW_UP_BUSINESS_DAYS: "not-a-number",
    }),
    null,
  );
  assert.equal(
    addBusinessDays(new Date("2026-01-02T09:00:00.000Z"), 1).toISOString(),
    "2026-01-05T09:00:00.000Z",
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
        do_not_contact: false,
        do_not_contact_reason: null,
        preferred_channel: null,
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

test("operations communication placeholder safety blocks ready and sent lifecycle states", () => {
  assert.deepEqual(
    findUnresolvedClientCommunicationPlaceholders({
      subject: "Hello {{ businessName }}",
      body: "Hi {{firstName}}, {{unknownThing}}",
    }),
    ["businessName", "firstName", "unknownThing"],
  );

  assert.throws(
    () =>
      parseOperationsCommunicationInput({
        status: "ready",
        body: "Hi {{firstName}},",
      }),
    /unresolved_communication_placeholders/,
  );
  assert.throws(
    () =>
      parseOperationsCommunicationInput({
        status: "sent",
        body: "Hi {{firstName}},",
      }),
    /unresolved_communication_placeholders/,
  );

  const exceptionalSent = parseOperationsCommunicationInput({
    status: "sent",
    body: "Hi {{firstName}},",
    unresolvedPlaceholderOverride: true,
    unresolvedPlaceholderOverrideReason: "Historical import of stored source.",
  });
  assert.equal(exceptionalSent.status, "sent");
});

test("operations communication missing first name stays visible until resolved", () => {
  const rendered = renderClientCommunicationTemplate(
    {
      subject_template: "Hello {{businessName}}",
      body_template: "Hi {{firstName}},",
    },
    {
      business: {
        id: "business_1",
        name: "Example Co",
        website_url: "https://example.com",
        general_email: "hello@example.com",
      },
      contact: {
        id: "contact_1",
        first_name: null,
        last_name: "Smith",
        email: "client@example.com",
        do_not_contact: false,
        do_not_contact_reason: null,
        preferred_channel: null,
      },
      site: null,
    },
  );

  assert.equal(rendered.body, "Hi {{firstName}},");
  assert.deepEqual(rendered.unresolvedPlaceholders, ["firstName"]);
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

test("operations report creation validation requires safe report relationships and fields", () => {
  const input = parseOperationsReportCreateInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    siteId: "22222222-2222-4222-8222-222222222222",
    scanRunId: "33333333-3333-4333-8333-333333333333",
    reportType: "initial_health_check",
    title: "Example Co website health review",
    preparedFor: "Ada Lovelace",
    allowDuplicate: true,
  });
  assert.equal(input.reportType, "initial_health_check");
  assert.equal(input.title, "Example Co website health review");
  assert.equal(input.allowDuplicate, true);

  assert.throws(
    () =>
      parseOperationsReportCreateInput({
        businessId: "not-a-uuid",
        siteId: "22222222-2222-4222-8222-222222222222",
        scanRunId: "33333333-3333-4333-8333-333333333333",
        reportType: "initial_health_check",
        title: "Example Co website health review",
      }),
    /invalid_businessId/,
  );
  assert.throws(
    () =>
      parseOperationsReportCreateInput({
        businessId: "11111111-1111-4111-8111-111111111111",
        siteId: "22222222-2222-4222-8222-222222222222",
        scanRunId: "33333333-3333-4333-8333-333333333333",
        reportType: "sales_deck",
        title: "Example Co website health review",
      }),
    /invalid_report_type/,
  );
  assert.throws(
    () =>
      parseOperationsReportCreateInput({
        businessId: "11111111-1111-4111-8111-111111111111",
        siteId: "22222222-2222-4222-8222-222222222222",
        scanRunId: "33333333-3333-4333-8333-333333333333",
        reportType: "initial_health_check",
        title: "<strong>Unsafe</strong>",
      }),
    /unsafe_html/,
  );
});

test("operations report editing validation rejects unsafe client copy and invalid priorities", () => {
  const reportPatch = parseOperationsReportUpdateInput({
    status: "needs_review",
    executiveSummary: "Reviewed summary for the client.",
    noMajorFindingsWaived: true,
  });
  assert.equal(reportPatch.status, "needs_review");
  assert.equal(reportPatch.noMajorFindingsWaived, true);

  const findingPatch = parseOperationsReportFindingUpdateInput({
    clientPriority: "important",
    clientExplanation: "A broken resource can reduce visitor trust.",
    recommendedAction: "Replace the missing resource or update the page.",
    clientEvidence: "The reviewed page links to a missing destination.",
    affectedUrlNote: "No single URL applies to this site-wide finding.",
    internalNote: "Check manually before sending.",
    falsePositiveReason: "Manual review confirmed this is real.",
    reviewNote: "Ready for Connor to approve.",
    reviewedAt: "2026-01-22T09:00:00.000Z",
    isIncluded: true,
  });
  assert.equal(findingPatch.clientPriority, "important");
  assert.equal(findingPatch.isIncluded, true);
  assert(findingPatch.reviewedAt instanceof Date);

  const observationPatch = parseOperationsReportPositiveObservationUpdateInput({
    title: "HTTPS is active",
    description: "The site uses HTTPS for the reviewed address.",
    isIncluded: true,
  });
  assert.equal(observationPatch.title, "HTTPS is active");

  const actionPlanPatch = parseOperationsReportActionPlanItemUpdateInput({
    title: "Repair the broken link",
    groupKey: "address_now",
    reviewedAt: "2026-01-22T09:00:00.000Z",
    displayOrder: 2,
  });
  assert.equal(actionPlanPatch.groupKey, "address_now");
  assert(actionPlanPatch.reviewedAt instanceof Date);

  const bulkPatch = parseOperationsReportFindingBulkInput({
    action: "change_priority",
    clientPriority: "critical",
    findingIds: ["11111111-1111-4111-8111-111111111111"],
  });
  assert.equal(bulkPatch.action, "change_priority");
  assert.equal(bulkPatch.clientPriority, "critical");

  assert.throws(
    () =>
      parseOperationsReportUpdateInput({
        executiveSummary: "This includes <script>alert(1)</script>",
      }),
    /unsafe_html/,
  );
  assert.throws(
    () =>
      parseOperationsReportFindingUpdateInput({
        clientPriority: "blocker",
      }),
    /invalid_client_priority/,
  );
  assert.throws(
    () =>
      parseOperationsReportFindingBulkInput({
        action: "mark_false_positive",
        findingIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    /invalid_bulk_action/,
  );
});

test("operations report sent validation requires explicit delivery metadata", () => {
  const input = parseOperationsReportSentInput({
    deliveryMethod: "email_attachment",
    contactId: "11111111-1111-4111-8111-111111111111",
    followUpAt: "2026-02-03T10:00:00.000Z",
    updatePipelineStage: true,
  });
  assert.equal(input.deliveryMethod, "email_attachment");
  assert.equal(input.updatePipelineStage, true);
  assert(input.followUpAt instanceof Date);

  assert.throws(
    () => parseOperationsReportSentInput({ deliveryMethod: "carrier_pigeon" }),
    /invalid_delivery_method/,
  );
});

test("operations report regroup validation requires confirmation and preview hash", () => {
  assert.deepEqual(
    parseOperationsReportRegroupInput({
      confirm: true,
      previewHash: "abc123",
    }),
    { confirm: true, previewHash: "abc123" },
  );
  assert.throws(
    () => parseOperationsReportRegroupInput({ confirm: false }),
    /regroup_confirmation_required/,
  );
  assert.throws(
    () => parseOperationsReportRegroupInput({ confirm: true }),
    /regroup_preview_hash_required/,
  );
});

function splitTopLevelSqlList(value: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    if (quote) {
      current += char;
      if (char === quote) {
        if (next === quote) {
          current += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

test("operations report finding insert SQL keeps target columns aligned with values", () => {
  const source = readFileSync(
    new URL("../../../packages/db/src/operationsReports.ts", import.meta.url),
    "utf8",
  );
  const insertMatches = [
    ...source.matchAll(
      /INSERT INTO operations_report_findings \(\s*([\s\S]*?)\s*\)\s*VALUES \(([\s\S]*?)\)\s*RETURNING id/g,
    ),
  ];
  assert.equal(insertMatches.length, 2);
  for (const match of insertMatches) {
    const columns = splitTopLevelSqlList(match[1]);
    const values = splitTopLevelSqlList(match[2]);
    assert.equal(values.length, columns.length);
  }
});

test("operations report grouping consolidates repeated source issues safely", () => {
  const now = new Date("2026-01-20T12:00:00.000Z");
  const issue = (
    id: string,
    issue_type: string,
    affected_url: string,
    source_url: string | null,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    scan_run_id: "scan_1",
    site_id: "site_1",
    category:
      issue_type === "frame_ancestors_missing"
        ? "security_header"
        : issue_type.startsWith("homepage_")
          ? "performance_basic"
          : issue_type.includes("link") ||
              issue_type === "no_response" ||
              issue_type === "ignored_safety_skip"
            ? "link_integrity"
            : "seo_basic",
    severity: issue_type === "broken_link" ? "medium" : "low",
    status: "open",
    issue_type,
    affected_url,
    source_url,
    title: issue_type,
    description: `${issue_type} description`,
    evidence_json: overrides,
    change_status: null,
    first_seen_at: now,
    last_seen_at: now,
    resolved_at: null,
  });
  const groups = buildOperationsReportGroupingPreviewForIssues(
    [
      issue(
        "meta_1",
        "missing_meta_description",
        "https://www.example.com/a",
        null,
      ),
      issue(
        "meta_2",
        "missing_meta_description",
        "https://www.example.com/b",
        null,
      ),
      issue(
        "broken_1",
        "broken_link",
        "https://external.example/missing",
        "https://www.example.com/a",
        { status_code: 404, occurrence_count: 2 },
      ),
      issue(
        "broken_2",
        "broken_link",
        "https://external.example/missing",
        "https://www.example.com/b",
        { status_code: 404, occurrence_count: 1 },
      ),
      issue(
        "blocked_1",
        "blocked_link",
        "https://external.example/photo.jpg",
        "https://www.example.com/a",
      ),
      issue(
        "internal_1",
        "broken_link",
        "https://www.example.com/missing",
        "https://www.example.com/a",
        { status_code: 404 },
      ),
      issue(
        "header_1",
        "frame_ancestors_missing",
        "https://www.example.com",
        null,
      ),
      issue(
        "perf_1",
        "homepage_asset_count_high",
        "https://www.example.com",
        null,
      ),
      issue(
        "perf_2",
        "homepage_script_count_high",
        "https://www.example.com",
        null,
      ),
      issue(
        "skip_1",
        "ignored_safety_skip",
        "https://blocked.example",
        "https://www.example.com",
      ),
    ] as never,
    "https://www.example.com",
  );
  const byKey = new Map(groups.map((group) => [group.groupKey, group]));
  assert.equal(byKey.get("seo_basic:meta_description")?.sourceIssueCount, 2);
  assert.equal(byKey.get("seo_basic:meta_description")?.affectedPageCount, 2);
  assert.equal(
    byKey.get("link_integrity:external:broken:404:external_destinations")
      ?.occurrenceCount,
    3,
  );
  assert(
    byKey.has("link_integrity:external:blocked_link:external_destinations"),
  );
  assert(
    byKey.has(
      "link_integrity:internal:broken:404:https://www.example.com/missing",
    ),
  );
  assert.equal(
    byKey.get("security_header:browser_security_controls")?.sourceIssueCount,
    1,
  );
  assert.equal(
    byKey.get("performance_basic:homepage_weight")?.sourceIssueCount,
    2,
  );
  assert.equal(
    byKey.get("link_integrity:ignored_safety_skip")?.isIncluded,
    false,
  );
  assert.equal(
    byKey.get("seo_basic:meta_description")?.representativeExamples.length,
    2,
  );
});

test("operations client report payload excludes internal-only finding data", () => {
  const now = new Date("2026-01-20T12:00:00.000Z");
  const report = {
    id: "report_1",
    business_id: "business_1",
    site_id: "site_1",
    scan_run_id: "scan_1",
    prepared_contact_id: null,
    supersedes_report_id: null,
    comparison_report_id: null,
    delivery_communication_id: null,
    follow_up_task_id: null,
    title: "Example Co website health review",
    status: "ready_to_send",
    report_type: "initial_health_check",
    version_number: 1,
    executive_summary: "The website needs a few fixes.",
    overall_summary: null,
    main_strengths: null,
    main_concerns: null,
    recommended_first_steps: null,
    scope_limitations: null,
    prepared_for: "Ada Lovelace",
    prepared_by: "Scanlark",
    cover_date: now,
    valid_until: null,
    sent_at: null,
    completed_at: null,
    archived_at: null,
    follow_up_at: null,
    no_major_findings_waived: false,
    display_settings_json: {},
    frozen_render_json: null,
    frozen_at: null,
    last_preview_generated_at: now,
    last_pdf_generated_at: null,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
    business_name: "Example Co",
    site_url: "https://www.example.com",
    site_display_name: "Example",
    scan_finished_at: now,
    scan_checked_links: 9,
    scan_total_links: 12,
  } satisfies OperationsReportRow;
  const findings = [
    {
      id: "finding_1",
      operations_report_id: "report_1",
      source_issue_id: "issue_1",
      source_link_id: null,
      source_type: "scan_issue",
      source_fingerprint: "fingerprint_1",
      category: "links",
      original_severity: "high",
      client_priority: "important",
      title: "Important broken link",
      technical_summary: "HTTP 404",
      client_explanation: "A visitor may hit a dead end.",
      why_it_matters: "Broken links reduce trust.",
      recommended_action: "Update or remove the link.",
      affected_url: "https://www.example.com/missing",
      client_evidence: "Status code 404 was returned during review.",
      affected_url_note: null,
      evidence_json: { statusCode: 404 },
      is_included: true,
      is_false_positive: false,
      false_positive_reason: null,
      review_note: "Private review note.",
      reviewed_at: now,
      internal_note: "Do not leak this note.",
      display_order: 1,
      estimated_effort: "Small",
      comparison_status: null,
      group_key: "link_integrity:external:broken:example.com",
      group_label: "Unavailable external links",
      source_issue_count: 1,
      occurrence_count: 3,
      affected_page_count: 1,
      affected_resource_count: 1,
      representative_examples_json: [
        {
          affectedPageUrl: "https://www.example.com",
          affectedResourceUrl: "https://www.example.com/missing",
          result: "broken:404",
          note: "Status code 404",
        },
      ],
      requires_merge_review: false,
      regrouped_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: "finding_2",
      operations_report_id: "report_1",
      source_issue_id: "issue_2",
      source_link_id: null,
      source_type: "scan_issue",
      source_fingerprint: "fingerprint_2",
      category: "resources",
      original_severity: "critical",
      client_priority: "critical",
      title: "Excluded issue",
      technical_summary: null,
      client_explanation: "Excluded copy",
      why_it_matters: null,
      recommended_action: null,
      affected_url: null,
      client_evidence: "Excluded evidence",
      affected_url_note: null,
      evidence_json: {},
      is_included: false,
      is_false_positive: false,
      false_positive_reason: "Private false-positive context.",
      review_note: "Excluded review note.",
      reviewed_at: null,
      internal_note: "Excluded note.",
      display_order: 2,
      estimated_effort: null,
      comparison_status: null,
      group_key: "resources:excluded",
      group_label: "Excluded resources",
      source_issue_count: 1,
      occurrence_count: 1,
      affected_page_count: 0,
      affected_resource_count: 0,
      representative_examples_json: [],
      requires_merge_review: false,
      regrouped_at: now,
      created_at: now,
      updated_at: now,
    },
  ] satisfies OperationsReportFindingRow[];
  const observations = [
    {
      id: "observation_1",
      operations_report_id: "report_1",
      title: "HTTPS is active",
      description: "The reviewed address uses HTTPS.",
      source_key: "https_active",
      is_included: true,
      reviewed_at: now,
      display_order: 0,
      created_at: now,
      updated_at: now,
    },
  ] satisfies OperationsReportPositiveObservationRow[];
  const actionPlanItems = [
    {
      id: "action_1",
      operations_report_id: "report_1",
      report_finding_id: "finding_1",
      group_key: "address_soon",
      title: "Repair important broken link",
      summary: "Update or remove the link.",
      is_included: true,
      reviewed_at: now,
      display_order: 0,
      created_at: now,
      updated_at: now,
    },
  ] satisfies OperationsReportActionPlanItemRow[];

  const payload = buildOperationsClientReportPayload(
    report,
    findings,
    observations,
    actionPlanItems,
    [] satisfies OperationsReportComparisonItemRow[],
  );
  assert.equal(payload.findings.length, 1);
  assert.equal(payload.findings[0]?.title, "Important broken link");
  assert.equal(
    payload.findings[0]?.clientEvidence,
    "Status code 404 was returned during review.",
  );
  assert.equal(payload.positiveObservations[0]?.title, "HTTPS is active");
  assert.equal(
    payload.actionPlan.address_soon[0]?.title,
    "Repair important broken link",
  );
  assert.equal(payload.scan.checkedLinks, 9);
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("Do not leak this note."));
  assert(!serialized.includes("Private review note."));
  assert(!serialized.includes("Private false-positive context."));
  assert(!serialized.includes("statusCode"));
  assert(!serialized.includes("Excluded issue"));
  assert(!serialized.includes("source_issue_id"));
  assert(!serialized.includes("contact_email"));
  assert(!serialized.includes("report_1"));
  assert(!serialized.includes("business_1"));

  const unreviewedPayload = buildOperationsClientReportPayload(
    report,
    findings,
    observations.map((item) => ({ ...item, reviewed_at: null })),
    actionPlanItems.map((item) => ({ ...item, reviewed_at: null })),
    [],
  );
  assert.equal(unreviewedPayload.positiveObservations.length, 0);
  assert.equal(unreviewedPayload.actionPlan.address_soon.length, 0);
  const legacyPayload = buildOperationsClientReportPayload(report, findings);
  assert.deepEqual(legacyPayload.positiveObservations, []);
  assert.deepEqual(legacyPayload.actionPlan, {
    address_now: [],
    address_soon: [],
    consider_later: [],
  });

  const completeReport: OperationsReportRow = {
    ...report,
    executive_summary: "The reviewed website needs a small number of fixes.",
    overall_summary: "This report summarises the selected public-page check.",
    main_strengths: "The website was reachable during the check.",
    main_concerns: "One broken visitor journey needs attention.",
    recommended_first_steps: "Repair the broken link and run a re-test.",
    scope_limitations: "Logged-in areas and forms were not tested.",
    last_pdf_generated_at: now,
  };
  assert.deepEqual(
    getOperationsReportReadinessIssues(
      completeReport,
      findings,
      observations,
      actionPlanItems,
      { requirePreview: true, requirePdf: true },
    ),
    [],
  );

  const incompleteIssues = getOperationsReportReadinessIssues(
    { ...completeReport, executive_summary: "TODO" },
    [
      {
        ...findings[0],
        client_explanation: null,
        reviewed_at: null,
      },
      findings[1],
    ],
    observations.map((item) => ({ ...item, reviewed_at: null })),
    actionPlanItems.map((item) => ({ ...item, reviewed_at: null })),
    { requirePreview: true, requirePdf: true },
  );
  assert(incompleteIssues.some((issue) => issue.code === "finding_incomplete"));
  assert(
    incompleteIssues.some(
      (issue) => issue.code === "positive_observation_unreviewed",
    ),
  );
  assert(
    incompleteIssues.some(
      (issue) => issue.code === "action_plan_item_unreviewed",
    ),
  );
  assert(
    incompleteIssues.some((issue) => issue.code === "unresolved_placeholder"),
  );
  assert(
    incompleteIssues.every(
      (issue) => typeof issue.section === "string" && issue.message.length > 0,
    ),
  );
  assert(
    getOperationsReportReadinessIssues(
      { ...completeReport, main_concerns: "<strong>Unsafe</strong>" },
      findings,
      observations,
      actionPlanItems,
    ).some((issue) => issue.code === "unsafe_html"),
  );

  const longUrl = `https://www.example.com/${"very-long-segment-".repeat(20)}?source=client&value=<reviewed>`;
  const html = renderOperationsReportHtml({
    ...payload,
    findings: [{ ...payload.findings[0]!, affectedUrl: longUrl }],
  });
  assert(html.includes("overflow-wrap: anywhere"));
  assert(html.includes("&amp;value=&lt;reviewed&gt;"));
  assert(!html.includes("value=<reviewed>"));
  assert(html.includes("Repair important broken link"));
  assert(html.includes("HTTPS is active"));
  assert(html.includes("The website needs a few fixes."));
  assert.equal(
    operationsReportPdfFilename(payload),
    "scanlark-website-health-report-example-co-www-example-com-2026-01-20.pdf",
  );

  const frozenSnapshot = JSON.stringify(payload);
  findings[0]!.title = "Later mutable title";
  actionPlanItems[0]!.title = "Later mutable action";
  assert.equal(JSON.stringify(payload), frozenSnapshot);
});

function makeQuoteDetail(
  overrides: Partial<OperationsQuoteDetail> = {},
): OperationsQuoteDetail {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const quote: OperationsQuoteRow = {
    id: "quote_1",
    business_id: "business_1",
    contact_id: "contact_1",
    operations_report_id: "report_1",
    quote_number: "SL-Q-2026-0001",
    title: "Website health fixes",
    status: "draft",
    currency: "GBP",
    subtotal_minor: 20000,
    discount_minor: 0,
    tax_minor: 0,
    total_minor: 20000,
    valid_until: new Date("2026-01-15T00:00:00.000Z"),
    estimated_start_date: null,
    estimated_completion_date: null,
    estimated_duration_text: "One week",
    payment_terms: "50% upfront, balance on completion.",
    scope_summary: "Fix the agreed website health issues.",
    included_scope: "Broken links and missing resources.",
    excluded_scope: "Content rewrites.",
    assumptions: null,
    client_responsibilities: null,
    access_requirements_summary: "CMS editor access reference.",
    internal_notes: "Do not expose pricing discussion.",
    sent_at: null,
    accepted_at: null,
    declined_at: null,
    expired_at: null,
    cancelled_at: null,
    frozen_render_json: null,
    frozen_at: null,
    last_pdf_generated_at: null,
    delivery_communication_id: null,
    follow_up_task_id: null,
    converted_work_order_id: null,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
    business_name: "Example Ltd",
    contact_first_name: "Ava",
    contact_last_name: "Smith",
    contact_email: "ava@example.com",
    report_title: "Example website health report",
    report_site_url: "https://example.com",
    report_site_display_name: "Example",
  };
  const items: OperationsQuoteItemRow[] = [
    {
      id: "item_1",
      quote_id: quote.id,
      report_finding_id: "finding_1",
      title: "Repair broken links",
      description: "Fix the highest-impact broken links.",
      quantity: 1,
      unit_price_minor: 20000,
      line_total_minor: 20000,
      item_type: "website_fix",
      is_optional: false,
      is_selected: true,
      display_order: 1,
      estimated_effort: "Small",
      internal_notes: "Margin target is private.",
      created_at: now,
      updated_at: now,
      finding_title: "Broken checkout link",
    },
    {
      id: "item_2",
      quote_id: quote.id,
      report_finding_id: null,
      title: "Optional monitoring setup",
      description: "Optional monthly monitoring setup.",
      quantity: 1,
      unit_price_minor: 10000,
      line_total_minor: 10000,
      item_type: "monitoring_setup",
      is_optional: true,
      is_selected: false,
      display_order: 2,
      estimated_effort: "Small",
      internal_notes: "Upsell only.",
      created_at: now,
      updated_at: now,
    },
  ];
  const accessRequirements: OperationsQuoteAccessRequirementRow[] = [
    {
      id: "access_1",
      quote_id: quote.id,
      description: "CMS editor access",
      status: "requested",
      requested_at: null,
      received_at: null,
      secure_storage_reference: "1Password item ref only",
      notes: "Do not include any credential values.",
      display_order: 1,
      created_at: now,
      updated_at: now,
    },
  ];
  return {
    quote,
    items,
    accessRequirements,
    statusHistory: [],
    readinessIssues: [],
    linkedWorkOrder: null,
    ...overrides,
  };
}

test("operations quote totals use selected items and omit VAT by default", () => {
  const totals = calculateQuoteTotals(
    [
      {
        quantity: 1,
        unitPriceMinor: 20000,
        isSelected: true,
        isOptional: false,
      },
      {
        quantity: 1,
        unitPriceMinor: 10000,
        isSelected: false,
        isOptional: true,
      },
    ],
    2500,
    getOperationsCommercialConfig({
      OPERATIONS_BUSINESS_VAT_REGISTERED: "false",
      OPERATIONS_VAT_RATE_PERCENT: "20",
    }),
  );

  assert.deepEqual(totals, {
    subtotalMinor: 20000,
    discountMinor: 2500,
    taxMinor: 0,
    totalMinor: 17500,
  });
});

test("operations quote preview excludes internal notes and unselected optional items", () => {
  const detail = makeQuoteDetail();
  const payload = buildOperationsQuotePreviewPayload(
    detail.quote,
    detail.items,
  );

  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0]?.title, "Repair broken links");
  assert.equal(payload.totals.vatRegistered, false);
  assert.equal(payload.totals.vatNotice, "No VAT charged.");
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("Margin target"));
  assert(!serialized.includes("Upsell only"));
  assert(!serialized.includes("Do not expose pricing discussion"));
  assert(!serialized.includes("Optional monthly monitoring setup"));
});

test("operations quote readiness requires complete client-facing quote content", () => {
  const complete = makeQuoteDetail();
  const incomplete = makeQuoteDetail({
    quote: {
      ...complete.quote,
      scope_summary: "",
      included_scope: "",
      excluded_scope: "",
      payment_terms: "",
    },
    items: [],
  });

  assert.deepEqual(getQuoteReadinessIssues(complete.quote, complete.items), []);
  assert(
    getQuoteReadinessIssues(incomplete.quote, incomplete.items).includes(
      "At least one selected item is required.",
    ),
  );
  assert(
    getQuoteReadinessIssues(incomplete.quote, incomplete.items).includes(
      "Scope summary is required.",
    ),
  );
});

test("operations quote validators reject invalid money, acceptance, and credentials", () => {
  const quoteInput = parseOperationsQuoteCreateInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    title: "Draft quote",
    currency: "GBP",
    scopeSummary: "Draft scope summary.",
    items: [],
  });
  assert.equal(quoteInput.currency, "GBP");
  assert.equal(quoteInput.items?.length, 0);

  const defaultCurrencyQuoteInput = parseOperationsQuoteCreateInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    title: "Default currency quote",
    scopeSummary: "Draft scope summary.",
  });
  assert.equal(defaultCurrencyQuoteInput.currency, "GBP");

  assert.throws(
    () =>
      parseOperationsQuoteCreateInput({
        businessId: "11111111-1111-4111-8111-111111111111",
        title: "Bad currency quote",
        currency: "GBP 20",
        scopeSummary: "Draft scope summary.",
      }),
    /invalid_currency/,
  );

  const decimalPriceItem = parseOperationsQuoteItemInput({
    title: "Fix",
    quantity: 1,
    unitPrice: "20.00",
  });
  assert.equal(decimalPriceItem.unitPriceMinor, 2000);

  assert.throws(
    () => parseOperationsQuoteItemInput({ title: "Fix", unitPriceMinor: -1 }),
    /invalid_unitPriceMinor/,
  );
  assert.throws(
    () =>
      parseOperationsQuoteAcceptedInput({
        acceptedAt: "2026-01-01T12:00:00.000Z",
        acceptanceMethod: "email",
        totalMinorConfirmed: 1000,
        selectedItemsConfirmed: true,
        freezeConfirmed: false,
      }),
    /freeze_not_confirmed/,
  );
  assert.throws(
    () =>
      parseOperationsAccessRequirementInput({
        description: "CMS access",
        secureStorageReference: "password=plain-text-value",
      }),
    /credential_values_not_allowed/,
  );
});

test("operations managed service config parses defaults and placeholders", () => {
  const config = getOperationsServiceConfig({
    OPERATIONS_SERVICE_PREFIX: " SL-M ",
    OPERATIONS_DEFAULT_SERVICE_CURRENCY: "usd",
    OPERATIONS_DEFAULT_REPORT_DAY: "31",
    OPERATIONS_DEFAULT_REVIEW_INTERVAL_DAYS: "120",
    OPERATIONS_RENEWAL_REMINDER_DAYS: "45",
    OPERATIONS_DEFAULT_ALLOWANCE_ROLLOVER: "true",
  });

  assert.equal(config.servicePrefix, "SL-M");
  assert.equal(config.defaultCurrency, "USD");
  assert.equal(config.defaultReportDay, 28);
  assert.equal(config.defaultReviewIntervalDays, 120);
  assert.equal(config.renewalReminderDays, 45);
  assert.equal(config.defaultAllowanceRollover, true);

  const fallback = getOperationsServiceConfig({
    OPERATIONS_SERVICE_PREFIX: "",
    OPERATIONS_DEFAULT_SERVICE_CURRENCY: "not-currency",
    OPERATIONS_DEFAULT_REPORT_DAY: "99",
    OPERATIONS_DEFAULT_REVIEW_INTERVAL_DAYS: "-1",
    OPERATIONS_RENEWAL_REMINDER_DAYS: "bad",
    OPERATIONS_DEFAULT_ALLOWANCE_ROLLOVER: "false",
  });

  assert.equal(fallback.servicePrefix, "SL-S");
  assert.equal(fallback.defaultCurrency, "GBP");
  assert.equal(fallback.defaultReportDay, 28);
  assert.equal(fallback.defaultReviewIntervalDays, 1);
  assert.equal(fallback.renewalReminderDays, 30);
  assert.equal(fallback.defaultAllowanceRollover, false);
});

test("operations managed service validators reject invalid and credential-like values", () => {
  const plan = parseOperationsServicePlanInput({
    name: "Monitoring and care",
    planType: "monitoring_and_support",
    defaultBillingCadence: "monthly",
    defaultPriceMinor: 9900,
    defaultCurrency: "gbp",
    defaultReportFrequency: "monthly",
    defaultScanFrequency: "weekly",
    defaultReviewFrequency: "quarterly",
    includedSupportMinutes: 60,
    includedFixCount: 2,
    includesIssueAlerts: true,
  });
  assert.equal(plan.name, "Monitoring and care");
  assert.equal(plan.defaultCurrency, "GBP");
  assert.equal(plan.includedSupportMinutes, 60);

  assert.throws(
    () =>
      parseOperationsServicePlanInput({
        name: "Bad plan",
        planType: "public_subscription",
      }),
    /invalid_plan_type/,
  );

  const service = parseOperationsClientServiceInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Monthly website care",
    billingCadence: "monthly",
    agreedPriceMinor: 15000,
    currency: "GBP",
    scanFrequency: "weekly",
    reportFrequency: "monthly",
    reviewFrequency: "quarterly",
    includedSupportMinutes: 90,
    includedFixCount: 3,
    allowanceRollover: false,
    includedScope: "Small website fixes and reporting.",
  }) as ReturnType<typeof parseOperationsClientServiceInput> & {
    businessId: string;
    agreedPriceMinor: number;
  };
  assert.equal(service.businessId, "11111111-1111-4111-8111-111111111111");
  assert.equal(service.agreedPriceMinor, 15000);

  const decimalPriceService = parseOperationsClientServiceInput({
    businessId: "11111111-1111-4111-8111-111111111111",
    name: "Starter care",
    billingCadence: "monthly",
    agreedPrice: "25.00",
    currency: "GBP",
    scanFrequency: "weekly",
    reportFrequency: "monthly",
    reviewFrequency: "quarterly",
    includedScope: "Monthly monitoring.",
  }) as ReturnType<typeof parseOperationsClientServiceInput> & {
    agreedPriceMinor: number;
  };
  assert.equal(decimalPriceService.agreedPriceMinor, 2500);

  assert.throws(
    () =>
      parseOperationsClientServiceInput({
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Unsafe service",
        agreedPriceMinor: -1,
      }),
    /invalid_agreedPriceMinor/,
  );
  assert.throws(
    () =>
      parseOperationsClientServiceInput({
        businessId: "11111111-1111-4111-8111-111111111111",
        name: "Unsafe service",
        internalNotes: "password=do-not-store",
      }),
    /credential_values_not_allowed/,
  );
});

test("operations managed service activation and site validation are explicit", () => {
  const activation = parseOperationsClientServiceActivationInput({
    agreementConfirmed: true,
    agreedAt: "2026-03-01T00:00:00.000Z",
    acceptanceMethod: "email",
    updateBusinessRelationship: true,
    updatePipelineStage: true,
  });
  assert.equal(activation.acceptanceMethod, "email");
  assert.equal(activation.updateBusinessRelationship, true);
  assert(activation.agreedAt instanceof Date);

  assert.throws(
    () => parseOperationsClientServiceActivationInput({}),
    /acceptance_method_required/,
  );

  const site = parseOperationsClientServiceSiteInput({
    siteId: "22222222-2222-4222-8222-222222222222",
    isPrimary: true,
    monitoringEnabled: true,
    uptimeMonitoringEnabled: true,
    scanFrequencyOverride: "daily",
    reportFrequencyOverride: "monthly",
    notes: "Client approved monitoring.",
  });
  assert.equal(site.siteId, "22222222-2222-4222-8222-222222222222");
  assert.equal(site.scanFrequencyOverride, "daily");

  assert.throws(
    () =>
      parseOperationsClientServiceSiteInput({
        siteId: "22222222-2222-4222-8222-222222222222",
        scanFrequencyOverride: "hourly",
      }),
    /invalid_scan_frequency/,
  );
  assert.throws(
    () =>
      parseOperationsClientServiceSiteInput({
        siteId: "22222222-2222-4222-8222-222222222222",
        notes: "api key=plain-text",
      }),
    /credential_values_not_allowed/,
  );
});

test("operations managed service usage validation keeps allowance records internal", () => {
  const usage = parseOperationsClientServiceUsageInput({
    usageType: "small_fix",
    description: "Updated a broken link after monthly review.",
    minutesUsed: 25,
    fixesUsed: 1,
    isOutOfScope: false,
  });
  assert.equal(usage.usageType, "small_fix");
  assert.equal(usage.minutesUsed, 25);

  assert.throws(
    () =>
      parseOperationsClientServiceUsageInput({
        usageType: "invoice",
        description: "Not a service usage type",
      }),
    /invalid_usage_type/,
  );
  assert.throws(
    () =>
      parseOperationsClientServiceUsageInput({
        usageType: "small_fix",
        description: "secret: should not be here",
      }),
    /credential_values_not_allowed/,
  );
});

test("operations managed service task keys and periods are stable", () => {
  const period = calculateServicePeriod(
    {
      billing_cadence: "monthly",
      start_date: new Date("2026-02-01T00:00:00.000Z"),
    },
    new Date("2026-02-20T12:00:00.000Z"),
  );
  assert.equal(period.start.toISOString(), "2026-02-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2026-02-28T09:00:00.000Z");

  const annual = calculateServicePeriod(
    {
      billing_cadence: "annual",
      start_date: new Date("2026-01-01T00:00:00.000Z"),
    },
    new Date("2026-08-02T12:00:00.000Z"),
  );
  assert.equal(annual.start.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(annual.end.toISOString(), "2026-12-31T09:00:00.000Z");

  const keys = buildServiceTaskKeys(
    "11111111-1111-4111-8111-111111111111",
    new Date("2026-02-20T12:00:00.000Z"),
  );
  assert.equal(
    keys.prepareReport,
    "service:11111111-1111-4111-8111-111111111111:prepare-report:2026-02",
  );
  assert.equal(
    buildServiceTaskKeys(
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-02-01T00:00:00.000Z"),
    ).prepareReport,
    keys.prepareReport,
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
