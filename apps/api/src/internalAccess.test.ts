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
  addBusinessDays,
  getConfiguredDefaultFollowUpBusinessDays,
  parseOperationsBusinessInput,
  parseOperationsCommunicationInput,
  parseOperationsCommunicationTemplateInput,
  parseOperationsContactInput,
  parseOperationsAccessRequirementInput,
  parseOperationsReportCreateInput,
  parseOperationsReportFindingUpdateInput,
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
  buildOperationsClientReportPayload,
  type OperationsReportComparisonItemRow,
  type OperationsReportFindingRow,
  type OperationsReportRow,
} from "../../../packages/db/src/operationsReports";
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
    internalNote: "Check manually before sending.",
    isIncluded: true,
  });
  assert.equal(findingPatch.clientPriority, "important");
  assert.equal(findingPatch.isIncluded, true);

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
    last_pdf_generated_at: null,
    created_by_user_id: null,
    created_at: now,
    updated_at: now,
    business_name: "Example Co",
    site_url: "https://www.example.com",
    site_display_name: "Example",
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
      evidence_json: { statusCode: 404 },
      is_included: true,
      is_false_positive: false,
      internal_note: "Do not leak this note.",
      display_order: 1,
      estimated_effort: "Small",
      comparison_status: null,
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
      evidence_json: {},
      is_included: false,
      is_false_positive: false,
      internal_note: "Excluded note.",
      display_order: 2,
      estimated_effort: null,
      comparison_status: null,
      created_at: now,
      updated_at: now,
    },
  ] satisfies OperationsReportFindingRow[];

  const payload = buildOperationsClientReportPayload(
    report,
    findings,
    [] satisfies OperationsReportComparisonItemRow[],
  );
  assert.equal(payload.findings.length, 1);
  assert.equal(payload.findings[0]?.title, "Important broken link");
  const serialized = JSON.stringify(payload);
  assert(!serialized.includes("Do not leak this note."));
  assert(!serialized.includes("Excluded issue"));
  assert(!serialized.includes("source_issue_id"));
  assert(!serialized.includes("contact_email"));
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
