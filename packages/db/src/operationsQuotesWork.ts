import { recordAdminAuditLog, type AdminActor } from "./admin";
import { ensureConnected } from "./client";
import { randomUUID } from "node:crypto";
import {
  immutableArtifactError,
  isHistoricalQuoteStatus,
  staleRevisionError,
} from "./operationsEvidence";

export const OPERATIONS_QUOTE_STATUSES = [
  "draft",
  "needs_review",
  "ready_to_send",
  "sent",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "converted_to_work",
] as const;

export const OPERATIONS_QUOTE_ITEM_TYPES = [
  "website_fix",
  "investigation",
  "configuration",
  "content_change",
  "monitoring_setup",
  "retest",
  "consultation",
  "other",
] as const;

export const OPERATIONS_ACCESS_REQUIREMENT_STATUSES = [
  "not_required",
  "not_requested",
  "requested",
  "received",
  "verified",
  "no_longer_needed",
] as const;

export const OPERATIONS_WORK_ORDER_STATUSES = [
  "not_started",
  "awaiting_access",
  "ready_to_start",
  "in_progress",
  "waiting_for_client",
  "blocked",
  "ready_for_testing",
  "testing",
  "completed",
  "cancelled",
] as const;

export const OPERATIONS_WORK_ORDER_PRIORITIES = [
  "urgent",
  "high",
  "normal",
  "low",
] as const;

export const OPERATIONS_WORK_ITEM_STATUSES = [
  "to_do",
  "in_progress",
  "waiting_for_client",
  "blocked",
  "ready_for_testing",
  "completed",
  "cancelled",
] as const;

export const OPERATIONS_RETEST_STATUSES = [
  "not_required",
  "pending",
  "passed",
  "failed",
  "unable_to_verify",
] as const;

// The DB adapter uses one PostgreSQL client for the application process. Keep
// quote revision transactions serialized on that client so concurrent requests
// cannot interleave BEGIN/COMMIT statements.
let quoteRevisionQueue = Promise.resolve();

export type OperationsQuoteStatus = (typeof OPERATIONS_QUOTE_STATUSES)[number];
export type OperationsQuoteItemType =
  (typeof OPERATIONS_QUOTE_ITEM_TYPES)[number];
export type OperationsAccessRequirementStatus =
  (typeof OPERATIONS_ACCESS_REQUIREMENT_STATUSES)[number];
export type OperationsWorkOrderStatus =
  (typeof OPERATIONS_WORK_ORDER_STATUSES)[number];
export type OperationsWorkOrderPriority =
  (typeof OPERATIONS_WORK_ORDER_PRIORITIES)[number];
export type OperationsWorkItemStatus =
  (typeof OPERATIONS_WORK_ITEM_STATUSES)[number];
export type OperationsRetestStatus =
  (typeof OPERATIONS_RETEST_STATUSES)[number];

export type OperationsCommercialConfig = {
  quotePrefix: string;
  workOrderPrefix: string;
  defaultCurrency: string;
  defaultQuoteValidDays: number;
  vatRegistered: boolean;
  vatRatePercent: number;
};

export type OperationsQuoteRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  operations_report_id: string | null;
  revision_series_id?: string;
  revision_number?: number;
  supersedes_quote_id?: string | null;
  quote_number: string;
  content_revision?: number;
  title: string;
  status: OperationsQuoteStatus;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  valid_until: Date | null;
  estimated_start_date: Date | null;
  estimated_completion_date: Date | null;
  estimated_duration_text: string | null;
  payment_terms: string | null;
  scope_summary: string | null;
  included_scope: string | null;
  excluded_scope: string | null;
  assumptions: string | null;
  client_responsibilities: string | null;
  access_requirements_summary: string | null;
  internal_notes: string | null;
  sent_at: Date | null;
  accepted_at: Date | null;
  declined_at: Date | null;
  expired_at: Date | null;
  cancelled_at: Date | null;
  frozen_render_json: OperationsQuotePreviewPayload | null;
  frozen_at: Date | null;
  last_pdf_generated_at: Date | null;
  delivery_communication_id: string | null;
  follow_up_task_id: string | null;
  converted_work_order_id: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  report_title?: string | null;
  report_site_url?: string | null;
  report_site_display_name?: string | null;
  item_count?: number;
};

export type OperationsQuoteItemRow = {
  id: string;
  quote_id: string;
  report_finding_id: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit_price_minor: number;
  line_total_minor: number;
  item_type: OperationsQuoteItemType;
  is_optional: boolean;
  is_selected: boolean;
  display_order: number;
  estimated_effort: string | null;
  internal_notes: string | null;
  created_at: Date;
  updated_at: Date;
  finding_title?: string | null;
  finding_priority?: string | null;
  affected_url?: string | null;
};

export type OperationsQuoteStatusHistoryRow = {
  id: string;
  quote_id: string;
  previous_status: OperationsQuoteStatus | null;
  new_status: OperationsQuoteStatus;
  reason: string | null;
  changed_by_user_id: string | null;
  created_at: Date;
  admin_email?: string | null;
};

export type OperationsQuoteServiceItemRow = {
  id: string;
  title: string;
  description: string | null;
  suggested_price_minor: number;
  suggested_effort: string | null;
  item_type: OperationsQuoteItemType;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsQuoteAccessRequirementRow = {
  id: string;
  quote_id: string;
  description: string;
  status: OperationsAccessRequirementStatus;
  requested_at: Date | null;
  received_at: Date | null;
  secure_storage_reference: string | null;
  notes: string | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type OperationsWorkOrderRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  quote_id: string;
  operations_report_id: string | null;
  work_order_number: string;
  title: string;
  status: OperationsWorkOrderStatus;
  priority: OperationsWorkOrderPriority;
  scope_summary: string | null;
  accepted_total_minor: number;
  currency: string;
  started_at: Date | null;
  target_completion_at: Date | null;
  completed_at: Date | null;
  blocked_reason: string | null;
  client_waiting_reason: string | null;
  completion_summary: string | null;
  internal_notes: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  quote_number?: string | null;
  quote_title?: string | null;
  report_title?: string | null;
  active_item_count?: number;
  completed_item_count?: number;
  outstanding_access_count?: number;
};

export type OperationsWorkItemRow = {
  id: string;
  work_order_id: string;
  quote_item_id: string | null;
  report_finding_id: string | null;
  title: string;
  description: string | null;
  status: OperationsWorkItemStatus;
  display_order: number;
  started_at: Date | null;
  completed_at: Date | null;
  completion_notes: string | null;
  client_visible_completion_notes: string | null;
  requires_retest: boolean;
  retest_status: OperationsRetestStatus;
  internal_notes: string | null;
  created_at: Date;
  updated_at: Date;
  finding_title?: string | null;
};

export type OperationsWorkOrderAccessRequirementRow = {
  id: string;
  work_order_id: string;
  quote_access_requirement_id: string | null;
  description: string;
  status: OperationsAccessRequirementStatus;
  requested_at: Date | null;
  received_at: Date | null;
  secure_storage_reference: string | null;
  notes: string | null;
  display_order: number;
  created_at: Date;
  updated_at: Date;
};

export type OperationsQuoteDetail = {
  quote: OperationsQuoteRow;
  items: OperationsQuoteItemRow[];
  accessRequirements: OperationsQuoteAccessRequirementRow[];
  statusHistory: OperationsQuoteStatusHistoryRow[];
  readinessIssues: string[];
  linkedWorkOrder: OperationsWorkOrderRow | null;
  revisionHistory?: OperationsQuoteRevisionHistoryRow[];
};

export type OperationsQuoteRevisionHistoryRow = {
  id: string;
  quote_number: string;
  revision_series_id: string;
  revision_number: number;
  supersedes_quote_id: string | null;
  status: OperationsQuoteStatus;
  title: string;
  sent_at: Date | null;
  created_at: Date;
};

export type OperationsWorkOrderDetail = {
  workOrder: OperationsWorkOrderRow;
  items: OperationsWorkItemRow[];
  accessRequirements: OperationsWorkOrderAccessRequirementRow[];
  completionIssues: string[];
};

export type OperationsQuoteItemInput = {
  expectedRevision?: number;
  reportFindingId?: string | null;
  title: string;
  description?: string | null;
  quantity?: number;
  unitPriceMinor?: number;
  itemType?: OperationsQuoteItemType;
  isOptional?: boolean;
  isSelected?: boolean;
  displayOrder?: number;
  estimatedEffort?: string | null;
  internalNotes?: string | null;
};

export type OperationsQuoteInput = {
  businessId: string;
  contactId?: string | null;
  operationsReportId?: string | null;
  title: string;
  currency?: string;
  discountMinor?: number;
  validUntil?: Date | null;
  estimatedStartDate?: Date | null;
  estimatedCompletionDate?: Date | null;
  estimatedDurationText?: string | null;
  paymentTerms?: string | null;
  scopeSummary?: string | null;
  includedScope?: string | null;
  excludedScope?: string | null;
  assumptions?: string | null;
  clientResponsibilities?: string | null;
  accessRequirementsSummary?: string | null;
  internalNotes?: string | null;
  items?: OperationsQuoteItemInput[];
  accessRequirements?: OperationsAccessRequirementInput[];
};

export type OperationsQuoteUpdateInput = Partial<
  Omit<OperationsQuoteInput, "businessId" | "items" | "accessRequirements">
> & { expectedRevision?: number };

export type OperationsAccessRequirementInput = {
  expectedRevision?: number;
  description: string;
  status?: OperationsAccessRequirementStatus;
  requestedAt?: Date | null;
  receivedAt?: Date | null;
  secureStorageReference?: string | null;
  notes?: string | null;
  displayOrder?: number;
};

export type OperationsWorkItemInput = {
  title: string;
  description?: string | null;
  status?: OperationsWorkItemStatus;
  displayOrder?: number;
  completionNotes?: string | null;
  clientVisibleCompletionNotes?: string | null;
  requiresRetest?: boolean;
  retestStatus?: OperationsRetestStatus;
  internalNotes?: string | null;
};

export type OperationsWorkOrderUpdateInput = {
  title?: string;
  status?: OperationsWorkOrderStatus;
  priority?: OperationsWorkOrderPriority;
  scopeSummary?: string | null;
  targetCompletionAt?: Date | null;
  blockedReason?: string | null;
  clientWaitingReason?: string | null;
  completionSummary?: string | null;
  internalNotes?: string | null;
};

export type OperationsQuotePreviewPayload = {
  quote: {
    id: string;
    quoteNumber: string;
    title: string;
    status: OperationsQuoteStatus;
    currency: string;
    validUntil: string | null;
    estimatedStartDate: string | null;
    estimatedCompletionDate: string | null;
    estimatedDurationText: string | null;
    sentAt: string | null;
    acceptedAt: string | null;
  };
  business: { id: string; name: string };
  contact: { name: string | null; email: string | null };
  report: { id: string; title: string | null; website: string | null } | null;
  items: Array<{
    id: string;
    title: string;
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
    itemType: OperationsQuoteItemType;
    isOptional: boolean;
    estimatedEffort: string | null;
  }>;
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    vatRegistered: boolean;
    vatRatePercent: number;
    vatNotice: string;
  };
  scope: {
    summary: string | null;
    included: string | null;
    excluded: string | null;
    assumptions: string | null;
    clientResponsibilities: string | null;
    accessRequirementsSummary: string | null;
    paymentTerms: string | null;
  };
  limitations: string[];
  generatedAt: string;
};

export type OperationsCommercialCounts = {
  quotesAwaitingResponse: number;
  quotesReadyToSend: number;
  quotesExpiringSoon: number;
  acceptedQuotesAwaitingConversion: number;
  openWorkItems: number;
  awaitingAccess: number;
  blockedWork: number;
  workReadyForTesting: number;
};

type CountRow = { count: string };

function countValue(row: CountRow | undefined) {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function textValue(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function dateOnly(value: Date | null | undefined) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function getOperationsCommercialConfig(
  env: NodeJS.ProcessEnv = process.env,
): OperationsCommercialConfig {
  const quotePrefix = (env.OPERATIONS_QUOTE_PREFIX ?? "SL-Q")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
  const workOrderPrefix = (env.OPERATIONS_WORK_ORDER_PREFIX ?? "SL-W")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 16);
  const currency = (env.OPERATIONS_DEFAULT_CURRENCY ?? "GBP")
    .trim()
    .toUpperCase();
  const validDays = Number.parseInt(
    env.OPERATIONS_DEFAULT_QUOTE_VALID_DAYS ?? "14",
    10,
  );
  const vatRate = Number.parseFloat(env.OPERATIONS_VAT_RATE_PERCENT ?? "20");
  return {
    quotePrefix: quotePrefix || "SL-Q",
    workOrderPrefix: workOrderPrefix || "SL-W",
    defaultCurrency: /^[A-Z]{3}$/.test(currency) ? currency : "GBP",
    defaultQuoteValidDays:
      Number.isFinite(validDays) && validDays >= 0 && validDays <= 365
        ? validDays
        : 14,
    vatRegistered:
      String(env.OPERATIONS_BUSINESS_VAT_REGISTERED ?? "false")
        .trim()
        .toLowerCase() === "true",
    vatRatePercent:
      Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 100 ? vatRate : 20,
  };
}

export function calculateQuoteTotals(
  items: Array<{
    quantity: number;
    unitPriceMinor: number;
    isOptional?: boolean;
    isSelected?: boolean;
  }>,
  discountMinor = 0,
  config: OperationsCommercialConfig = getOperationsCommercialConfig(),
) {
  const subtotalMinor = items.reduce((sum, item) => {
    if (item.isOptional && item.isSelected === false) return sum;
    return sum + Math.max(0, item.quantity) * Math.max(0, item.unitPriceMinor);
  }, 0);
  const safeDiscount = Math.min(Math.max(0, discountMinor), subtotalMinor);
  const taxable = subtotalMinor - safeDiscount;
  const taxMinor = config.vatRegistered
    ? Math.round(taxable * (config.vatRatePercent / 100))
    : 0;
  return {
    subtotalMinor,
    discountMinor: safeDiscount,
    taxMinor,
    totalMinor: taxable + taxMinor,
  };
}

async function nextDocumentNumber(
  documentType: "quote" | "work_order",
  prefix: string,
) {
  const client = await ensureConnected();
  const year = new Date().getUTCFullYear();
  const res = await client.query<{ last_value: number }>(
    `
      INSERT INTO operations_document_counters (
        document_type,
        prefix,
        document_year,
        last_value
      )
      VALUES ($1, $2, $3, 1)
      ON CONFLICT (document_type, prefix, document_year)
      DO UPDATE
      SET last_value = operations_document_counters.last_value + 1,
          updated_at = now()
      RETURNING last_value
    `,
    [documentType, prefix, year],
  );
  const value = res.rows[0]?.last_value ?? 1;
  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

async function insertQuoteStatusHistory(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  previousStatus: OperationsQuoteStatus | null,
  newStatus: OperationsQuoteStatus,
  reason?: string | null,
) {
  const client = await ensureConnected();
  await client.query(
    `
      INSERT INTO operations_quote_status_history (
        quote_id,
        previous_status,
        new_status,
        reason,
        changed_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [quoteId, previousStatus, newStatus, textValue(reason), actor.id],
  );
}

async function validateQuoteRelationships(input: {
  workspaceId: string;
  businessId: string;
  contactId?: string | null;
  operationsReportId?: string | null;
  reportFindingIds?: string[];
}) {
  const client = await ensureConnected();
  const business = await client.query<{ id: string }>(
    `SELECT id FROM operations_businesses WHERE id = $1 AND internal_workspace_id = $2`,
    [input.businessId, input.workspaceId],
  );
  if (!business.rows[0]) return "business_not_found" as const;

  if (input.contactId) {
    const contact = await client.query<{ id: string }>(
      `SELECT c.id FROM operations_contacts c JOIN operations_businesses b ON b.id = c.business_id WHERE c.id = $1 AND c.business_id = $2 AND b.internal_workspace_id = $3`,
      [input.contactId, input.businessId, input.workspaceId],
    );
    if (!contact.rows[0]) return "contact_not_found" as const;
  }

  if (input.operationsReportId) {
    const report = await client.query<{ id: string }>(
      `SELECT r.id FROM operations_reports r JOIN operations_businesses b ON b.id = r.business_id WHERE r.id = $1 AND r.business_id = $2 AND b.internal_workspace_id = $3`,
      [input.operationsReportId, input.businessId, input.workspaceId],
    );
    if (!report.rows[0]) return "report_not_found" as const;
  }

  if (input.reportFindingIds?.length) {
    const findings = await client.query<{ id: string }>(
      `
        SELECT f.id
        FROM operations_report_findings f
        JOIN operations_reports r ON r.id = f.operations_report_id
        WHERE f.id = ANY($1::uuid[])
          AND r.business_id = $2
          AND r.internal_workspace_id = $4
          AND ($3::uuid IS NULL OR r.id = $3::uuid)
      `,
      [
        input.reportFindingIds,
        input.businessId,
        input.operationsReportId ?? null,
        input.workspaceId,
      ],
    );
    if (findings.rows.length !== new Set(input.reportFindingIds).size) {
      return "finding_not_found" as const;
    }
  }

  return "ok" as const;
}

async function refreshQuoteTotals(workspaceId: string, quoteId: string) {
  const client = await ensureConnected();
  const quote = await client.query<Pick<OperationsQuoteRow, "discount_minor">>(
    `SELECT q.discount_minor FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = $2 AND b.internal_workspace_id = $1`,
    [workspaceId, quoteId],
  );
  if (!quote.rows[0]) return null;
  const items = await client.query<OperationsQuoteItemRow>(
    `SELECT qi.* FROM operations_quote_items qi JOIN operations_quotes q ON q.id = qi.quote_id JOIN operations_businesses b ON b.id = q.business_id WHERE qi.quote_id = $2 AND b.internal_workspace_id = $1`,
    [workspaceId, quoteId],
  );
  const config = getOperationsCommercialConfig();
  const totals = calculateQuoteTotals(
    items.rows.map((item) => ({
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      isOptional: item.is_optional,
      isSelected: item.is_selected,
    })),
    quote.rows[0].discount_minor,
    config,
  );
  await client.query(
    `
      UPDATE operations_quotes
      SET subtotal_minor = $2,
          discount_minor = $3,
          tax_minor = $4,
          total_minor = $5,
          updated_at = now()
       WHERE id = $1
          AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_quotes.business_id AND b.internal_workspace_id = $6)
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quotes.id AND b.internal_workspace_id = $6)
    `,
    [
      quoteId,
      totals.subtotalMinor,
      totals.discountMinor,
      totals.taxMinor,
      totals.totalMinor,
      workspaceId,
    ],
  );
  return totals;
}

function immutableQuoteStatus(status: OperationsQuoteStatus) {
  return isHistoricalQuoteStatus(status);
}

function assertQuoteContentMutable(
  quote: OperationsQuoteRow,
  expectedRevision?: number,
) {
  if (immutableQuoteStatus(quote.status) || quote.sent_at) {
    throw immutableArtifactError("quote");
  }
  if (
    expectedRevision !== undefined &&
    expectedRevision !== (quote.content_revision ?? 1)
  ) {
    throw staleRevisionError("quote");
  }
}

async function bumpQuoteContentRevision(workspaceId: string, quoteId: string) {
  const client = await ensureConnected();
  await client.query(
    `UPDATE operations_quotes
     SET content_revision = content_revision + 1, updated_at = now()
     WHERE id = $1
       AND status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
       AND EXISTS (
         SELECT 1 FROM operations_businesses b
         WHERE b.id = operations_quotes.business_id
           AND b.internal_workspace_id = $2
       )`,
    [quoteId, workspaceId],
  );
}

async function throwIfQuoteMutationRejected(
  workspaceId: string,
  quoteId: string,
  expectedRevision?: number,
) {
  const latest = await getQuoteForUpdate(workspaceId, quoteId);
  if (!latest) return;
  if (immutableQuoteStatus(latest.status) || latest.sent_at) {
    throw immutableArtifactError("quote");
  }
  if (
    expectedRevision !== undefined &&
    (latest.content_revision ?? 1) !== expectedRevision
  ) {
    throw staleRevisionError("quote");
  }
}

async function getQuoteForUpdate(workspaceId: string, quoteId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteRow>(
    `SELECT q.* FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = $2 AND b.internal_workspace_id = $1 FOR UPDATE OF q`,
    [workspaceId, quoteId],
  );
  return res.rows[0] ?? null;
}

async function listQuoteItems(workspaceId: string, quoteId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteItemRow>(
    `
      SELECT qi.*,
             f.title AS finding_title,
             f.client_priority AS finding_priority,
             f.affected_url
      FROM operations_quote_items qi
      LEFT JOIN operations_report_findings f ON f.id = qi.report_finding_id
      WHERE qi.quote_id = $2
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = qi.quote_id AND b.internal_workspace_id = $1)
      ORDER BY qi.display_order ASC, qi.created_at ASC
    `,
    [workspaceId, quoteId],
  );
  return res.rows;
}

async function listQuoteAccessRequirements(
  workspaceId: string,
  quoteId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteAccessRequirementRow>(
    `
      SELECT *
      FROM operations_quote_access_requirements
      WHERE quote_id = $2
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_access_requirements.quote_id AND b.internal_workspace_id = $1)
      ORDER BY display_order ASC, created_at ASC
    `,
    [workspaceId, quoteId],
  );
  return res.rows;
}

function mapQuoteItemInput(input: OperationsQuoteItemInput) {
  const quantity = Math.max(0, input.quantity ?? 1);
  const unitPriceMinor = Math.max(0, input.unitPriceMinor ?? 0);
  return {
    reportFindingId: input.reportFindingId ?? null,
    title: input.title.trim(),
    description: textValue(input.description),
    quantity,
    unitPriceMinor,
    lineTotalMinor: quantity * unitPriceMinor,
    itemType: input.itemType ?? "website_fix",
    isOptional: input.isOptional === true,
    isSelected: input.isSelected !== false,
    displayOrder: input.displayOrder ?? 0,
    estimatedEffort: textValue(input.estimatedEffort),
    internalNotes: textValue(input.internalNotes),
  };
}

export async function createOperationsQuote(
  workspaceId: string,
  actor: AdminActor,
  input: OperationsQuoteInput,
) {
  const client = await ensureConnected();
  const itemInputs = input.items ?? [];
  const findingIds = itemInputs
    .map((item) => item.reportFindingId)
    .filter((id): id is string => Boolean(id));
  const relationships = await validateQuoteRelationships({
    workspaceId,
    businessId: input.businessId,
    contactId: input.contactId,
    operationsReportId: input.operationsReportId,
    reportFindingIds: findingIds,
  });
  if (relationships !== "ok") return relationships;
  if (!input.title.trim()) throw new Error("quote_title_required");

  const config = getOperationsCommercialConfig();
  const quoteNumber = await nextDocumentNumber("quote", config.quotePrefix);
  const validUntil =
    input.validUntil ??
    (config.defaultQuoteValidDays > 0
      ? new Date(Date.now() + config.defaultQuoteValidDays * 86400000)
      : null);
  const totals = calculateQuoteTotals(
    itemInputs.map((item) => {
      const mapped = mapQuoteItemInput(item);
      return {
        quantity: mapped.quantity,
        unitPriceMinor: mapped.unitPriceMinor,
        isOptional: mapped.isOptional,
        isSelected: mapped.isSelected,
      };
    }),
    input.discountMinor ?? 0,
    config,
  );
  const revisionSeriesId = randomUUID();

  try {
    await client.query("BEGIN");
    const quoteRes = await client.query<OperationsQuoteRow>(
      `
        INSERT INTO operations_quotes (
          business_id,
          contact_id,
          operations_report_id,
          revision_series_id,
          revision_number,
          quote_number,
          title,
          currency,
          subtotal_minor,
          discount_minor,
          tax_minor,
          total_minor,
          valid_until,
          estimated_start_date,
          estimated_completion_date,
          estimated_duration_text,
          payment_terms,
          scope_summary,
          included_scope,
          excluded_scope,
          assumptions,
          client_responsibilities,
          access_requirements_summary,
          internal_notes,
          created_by_user_id
        )
        SELECT
          $1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24
        WHERE EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = $1 AND b.internal_workspace_id = $25)
        RETURNING *
      `,
      [
        input.businessId,
        input.contactId ?? null,
        input.operationsReportId ?? null,
        revisionSeriesId,
        quoteNumber,
        input.title.trim(),
        (input.currency ?? config.defaultCurrency).toUpperCase(),
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        validUntil,
        input.estimatedStartDate ?? null,
        input.estimatedCompletionDate ?? null,
        textValue(input.estimatedDurationText),
        textValue(input.paymentTerms),
        textValue(input.scopeSummary),
        textValue(input.includedScope),
        textValue(input.excludedScope),
        textValue(input.assumptions),
        textValue(input.clientResponsibilities),
        textValue(input.accessRequirementsSummary),
        textValue(input.internalNotes),
        actor.id,
        workspaceId,
      ],
    );
    const quote = quoteRes.rows[0];
    if (!quote) throw new Error("quote_insert_failed");

    for (let index = 0; index < itemInputs.length; index += 1) {
      const item = mapQuoteItemInput({
        ...itemInputs[index],
        displayOrder: itemInputs[index]?.displayOrder ?? index,
      });
      await client.query(
        `
          INSERT INTO operations_quote_items (
            quote_id,
            report_finding_id,
            title,
            description,
            quantity,
            unit_price_minor,
            line_total_minor,
            item_type,
            is_optional,
            is_selected,
            display_order,
            estimated_effort,
            internal_notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          quote.id,
          item.reportFindingId,
          item.title,
          item.description,
          item.quantity,
          item.unitPriceMinor,
          item.lineTotalMinor,
          item.itemType,
          item.isOptional,
          item.isSelected,
          item.displayOrder,
          item.estimatedEffort,
          item.internalNotes,
        ],
      );
    }

    for (
      let index = 0;
      index < (input.accessRequirements ?? []).length;
      index += 1
    ) {
      const req = input.accessRequirements?.[index];
      if (!req) continue;
      await client.query(
        `
          INSERT INTO operations_quote_access_requirements (
            quote_id,
            description,
            status,
            requested_at,
            received_at,
            secure_storage_reference,
            notes,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          quote.id,
          req.description.trim(),
          req.status ?? "not_requested",
          req.requestedAt ?? null,
          req.receivedAt ?? null,
          textValue(req.secureStorageReference),
          textValue(req.notes),
          req.displayOrder ?? index,
        ],
      );
    }

    await insertQuoteStatusHistory(
      workspaceId,
      actor,
      quote.id,
      null,
      "draft",
      "created",
    );
    await recordAdminAuditLog(actor, {
      action: "operations_quote_created",
      targetType: "operations_quote",
      targetId: quote.id,
      metadata: {
        businessId: quote.business_id,
        reportId: quote.operations_report_id,
        itemCount: itemInputs.length,
      },
    });
    await client.query("COMMIT");
    await refreshQuoteTotals(workspaceId, quote.id);
    return getOperationsQuoteDetail(workspaceId, quote.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function createRevisedOperationsQuoteUnlocked(
  workspaceId: string,
  actor: AdminActor,
  sourceQuoteId: string,
  options: { expectedRevision?: number; reason?: string | null } = {},
): Promise<
  | OperationsQuoteDetail
  | "quote_not_found"
  | "quote_not_eligible"
  | "quote_revision_not_latest"
  | "stale_revision"
> {
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const sourceResult = await client.query<OperationsQuoteRow>(
      `
        SELECT q.*
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE q.id = $2 AND b.internal_workspace_id = $1
        FOR UPDATE OF q
      `,
      [workspaceId, sourceQuoteId],
    );
    const source = sourceResult.rows[0];
    if (!source) {
      await client.query("ROLLBACK");
      return "quote_not_found";
    }
    if (!immutableQuoteStatus(source.status)) {
      await client.query("ROLLBACK");
      return "quote_not_eligible";
    }
    if (
      options.expectedRevision !== undefined &&
      (source.content_revision ?? 1) !== options.expectedRevision
    ) {
      await client.query("ROLLBACK");
      return "stale_revision";
    }
    const seriesResult = await client.query<OperationsQuoteRow>(
      `
        SELECT q.*
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE q.revision_series_id = $1
          AND b.internal_workspace_id = $2
        ORDER BY q.revision_number DESC
        FOR UPDATE OF q
      `,
      [source.revision_series_id ?? source.id, workspaceId],
    );
    const latest = seriesResult.rows[0];
    if (!latest || latest.id !== source.id) {
      await client.query("ROLLBACK");
      return "quote_revision_not_latest";
    }
    const items = await client.query<OperationsQuoteItemRow>(
      `SELECT * FROM operations_quote_items WHERE quote_id = $1 ORDER BY display_order ASC, created_at ASC`,
      [source.id],
    );
    const accessRequirements =
      await client.query<OperationsQuoteAccessRequirementRow>(
        `SELECT * FROM operations_quote_access_requirements WHERE quote_id = $1 ORDER BY display_order ASC, created_at ASC`,
        [source.id],
      );
    const config = getOperationsCommercialConfig();
    const totals = calculateQuoteTotals(
      items.rows.map((item) => ({
        quantity: item.quantity,
        unitPriceMinor: item.unit_price_minor,
        isOptional: item.is_optional,
        isSelected: item.is_selected,
      })),
      source.discount_minor,
      config,
    );
    const quoteNumber = await nextDocumentNumber("quote", config.quotePrefix);
    const revisionNumber = (latest.revision_number ?? 1) + 1;
    const quoteResult = await client.query<OperationsQuoteRow>(
      `
        INSERT INTO operations_quotes (
          business_id, contact_id, operations_report_id, revision_series_id,
          revision_number, supersedes_quote_id, quote_number, title, status,
          currency, subtotal_minor, discount_minor, tax_minor, total_minor,
          valid_until, estimated_start_date, estimated_completion_date,
          estimated_duration_text, payment_terms, scope_summary, included_scope,
          excluded_scope, assumptions, client_responsibilities,
          access_requirements_summary, internal_notes, created_by_user_id
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11,
          $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, $26
        WHERE EXISTS (
          SELECT 1 FROM operations_businesses b
          WHERE b.id = $1 AND b.internal_workspace_id = $27
        )
        RETURNING *
      `,
      [
        source.business_id,
        source.contact_id,
        source.operations_report_id,
        source.revision_series_id ?? source.id,
        revisionNumber,
        source.id,
        quoteNumber,
        source.title,
        source.currency,
        totals.subtotalMinor,
        totals.discountMinor,
        totals.taxMinor,
        totals.totalMinor,
        source.valid_until,
        source.estimated_start_date,
        source.estimated_completion_date,
        source.estimated_duration_text,
        source.payment_terms,
        source.scope_summary,
        source.included_scope,
        source.excluded_scope,
        source.assumptions,
        source.client_responsibilities,
        source.access_requirements_summary,
        source.internal_notes,
        actor.id,
        workspaceId,
      ],
    );
    const revision = quoteResult.rows[0];
    if (!revision) throw new Error("quote_revision_insert_failed");
    for (const item of items.rows) {
      await client.query(
        `
          INSERT INTO operations_quote_items (
            quote_id, report_finding_id, title, description, quantity,
            unit_price_minor, line_total_minor, item_type, is_optional,
            is_selected, display_order, estimated_effort, internal_notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          revision.id,
          item.report_finding_id,
          item.title,
          item.description,
          item.quantity,
          item.unit_price_minor,
          item.quantity * item.unit_price_minor,
          item.item_type,
          item.is_optional,
          item.is_selected,
          item.display_order,
          item.estimated_effort,
          item.internal_notes,
        ],
      );
    }
    for (const requirement of accessRequirements.rows) {
      await client.query(
        `
          INSERT INTO operations_quote_access_requirements (
            quote_id, description, status, requested_at, received_at,
            secure_storage_reference, notes, display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          revision.id,
          requirement.description,
          requirement.status,
          requirement.requested_at,
          requirement.received_at,
          requirement.secure_storage_reference,
          requirement.notes,
          requirement.display_order,
        ],
      );
    }
    await insertQuoteStatusHistory(
      workspaceId,
      actor,
      revision.id,
      null,
      "draft",
      "revision_created",
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "quote_revision_created",
      targetType: "operations_quote",
      targetId: revision.id,
      metadata: {
        sourceQuoteId: source.id,
        sourceQuoteNumber: source.quote_number,
        newQuoteNumber: revision.quote_number,
        revisionSeriesId: revision.revision_series_id,
        sourceRevisionNumber: source.revision_number ?? 1,
        newRevisionNumber: revision.revision_number,
        reason: textValue(options.reason),
      },
    });
    return getOperationsQuoteDetail(
      workspaceId,
      revision.id,
    ) as Promise<OperationsQuoteDetail>;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (
      error instanceof Error &&
      error.message.includes("operations_quotes_revision_series_number_idx")
    ) {
      return "quote_revision_not_latest";
    }
    throw error;
  }
}

export async function createRevisedOperationsQuote(
  workspaceId: string,
  actor: AdminActor,
  sourceQuoteId: string,
  options: { expectedRevision?: number; reason?: string | null } = {},
) {
  const previous = quoteRevisionQueue;
  let release!: () => void;
  quoteRevisionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await createRevisedOperationsQuoteUnlocked(
      workspaceId,
      actor,
      sourceQuoteId,
      options,
    );
  } finally {
    release();
  }
}

export async function listOperationsQuotes(
  workspaceId: string,
  options: {
    businessId?: string | null;
    operationsReportId?: string | null;
    status?: OperationsQuoteStatus | null;
    search?: string | null;
    archived?: boolean | null;
    limit: number;
    offset: number;
  },
) {
  const client = await ensureConnected();
  const where: string[] = ["b.internal_workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  if (options.businessId) add("q.business_id = ?", options.businessId);
  if (options.operationsReportId)
    add("q.operations_report_id = ?", options.operationsReportId);
  if (options.status) add("q.status = ?", options.status);
  if (options.archived === false) {
    where.push("q.status <> 'cancelled'");
  }
  if (options.search?.trim()) {
    params.push(`%${options.search.trim()}%`);
    where.push(
      `(q.title ILIKE $${params.length} OR q.quote_number ILIKE $${params.length} OR b.name ILIKE $${params.length})`,
    );
  }
  params.push(options.limit, options.offset);
  const limitIndex = params.length - 1;
  const offsetIndex = params.length;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows, count, summary] = await Promise.all([
    client.query<OperationsQuoteRow>(
      `
        SELECT q.*,
               b.name AS business_name,
               c.first_name AS contact_first_name,
               c.last_name AS contact_last_name,
               c.email AS contact_email,
               r.title AS report_title,
               s.url AS report_site_url,
               s.site_display_name AS report_site_display_name,
               COALESCE(item_counts.item_count, 0)::int AS item_count
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        LEFT JOIN operations_contacts c ON c.id = q.contact_id
        LEFT JOIN operations_reports r ON r.id = q.operations_report_id
        LEFT JOIN sites s ON s.id = r.site_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS item_count
          FROM operations_quote_items qi
          WHERE qi.quote_id = q.id
        ) item_counts ON TRUE
        ${whereSql}
        ORDER BY q.updated_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      params,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        ${whereSql}
      `,
      params.slice(0, -2),
    ),
    client.query<{
      draft: string;
      needs_review: string;
      ready_to_send: string;
      sent: string;
      accepted: string;
      converted_to_work: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft')::text AS draft,
          COUNT(*) FILTER (WHERE status = 'needs_review')::text AS needs_review,
          COUNT(*) FILTER (WHERE status = 'ready_to_send')::text AS ready_to_send,
          COUNT(*) FILTER (WHERE status = 'sent')::text AS sent,
          COUNT(*) FILTER (WHERE status = 'accepted')::text AS accepted,
          COUNT(*) FILTER (WHERE status = 'converted_to_work')::text AS converted_to_work
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE b.internal_workspace_id = $1
      `,
      [workspaceId],
    ),
  ]);
  const summaryRow = summary.rows[0];
  return {
    quotes: rows.rows,
    totalMatching: countValue(count.rows[0]),
    countReturned: rows.rows.length,
    limit: options.limit,
    offset: options.offset,
    summary: {
      draft: Number.parseInt(summaryRow?.draft ?? "0", 10) || 0,
      needsReview: Number.parseInt(summaryRow?.needs_review ?? "0", 10) || 0,
      readyToSend: Number.parseInt(summaryRow?.ready_to_send ?? "0", 10) || 0,
      sent: Number.parseInt(summaryRow?.sent ?? "0", 10) || 0,
      accepted: Number.parseInt(summaryRow?.accepted ?? "0", 10) || 0,
      convertedToWork:
        Number.parseInt(summaryRow?.converted_to_work ?? "0", 10) || 0,
    },
  };
}

export async function getOperationsQuoteRevisionHistory(
  workspaceId: string,
  quoteId: string,
): Promise<OperationsQuoteRevisionHistoryRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteRevisionHistoryRow>(
    `
      SELECT q.id, q.quote_number, q.revision_series_id, q.revision_number,
             q.supersedes_quote_id, q.status, q.title, q.sent_at, q.created_at
      FROM operations_quotes q
      JOIN operations_businesses b ON b.id = q.business_id
      WHERE q.revision_series_id = (
        SELECT source.revision_series_id
        FROM operations_quotes source
        JOIN operations_businesses source_business
          ON source_business.id = source.business_id
        WHERE source.id = $2
          AND source_business.internal_workspace_id = $1
      )
        AND b.internal_workspace_id = $1
      ORDER BY q.revision_number ASC
    `,
    [workspaceId, quoteId],
  );
  return res.rows;
}

export async function getOperationsQuoteDetail(
  workspaceId: string,
  quoteId: string,
): Promise<OperationsQuoteDetail | null> {
  const client = await ensureConnected();
  const quote = await client.query<OperationsQuoteRow>(
    `
      SELECT q.*,
             b.name AS business_name,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email,
             r.title AS report_title,
             s.url AS report_site_url,
             s.site_display_name AS report_site_display_name
      FROM operations_quotes q
      JOIN operations_businesses b ON b.id = q.business_id
      LEFT JOIN operations_contacts c ON c.id = q.contact_id
      LEFT JOIN operations_reports r ON r.id = q.operations_report_id
      LEFT JOIN sites s ON s.id = r.site_id
      WHERE q.id = $2
        AND b.internal_workspace_id = $1
    `,
    [workspaceId, quoteId],
  );
  if (!quote.rows[0]) return null;
  const [items, accessRequirements, history, workOrder, revisionHistory] =
    await Promise.all([
      listQuoteItems(workspaceId, quoteId),
      listQuoteAccessRequirements(workspaceId, quoteId),
      client.query<OperationsQuoteStatusHistoryRow>(
        `
        SELECT h.*, u.email AS admin_email
        FROM operations_quote_status_history h
        LEFT JOIN users u ON u.id = h.changed_by_user_id
        WHERE h.quote_id = $2
          AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = h.quote_id AND b.internal_workspace_id = $1)
        ORDER BY h.created_at DESC
      `,
        [workspaceId, quoteId],
      ),
      client.query<OperationsWorkOrderRow>(
        `
        SELECT wo.*,
               b.name AS business_name,
               q.quote_number,
               q.title AS quote_title
        FROM operations_work_orders wo
        JOIN operations_businesses b ON b.id = wo.business_id
        JOIN operations_quotes q ON q.id = wo.quote_id
        WHERE wo.quote_id = $2
          AND b.internal_workspace_id = $1
        ORDER BY wo.created_at DESC
        LIMIT 1
      `,
        [workspaceId, quoteId],
      ),
      getOperationsQuoteRevisionHistory(workspaceId, quoteId),
    ]);
  const detail = {
    quote: quote.rows[0],
    items,
    accessRequirements,
    statusHistory: history.rows,
    readinessIssues: getQuoteReadinessIssues(
      quote.rows[0],
      items,
      accessRequirements,
    ),
    linkedWorkOrder: workOrder.rows[0] ?? null,
    revisionHistory,
  };
  return detail;
}

export function getQuoteReadinessIssues(
  quote: OperationsQuoteRow,
  items: OperationsQuoteItemRow[],
  _accessRequirements: OperationsQuoteAccessRequirementRow[] = [],
) {
  const issues: string[] = [];
  if (!quote.business_id) issues.push("Business is required.");
  if (!quote.title.trim()) issues.push("Quote title is required.");
  if (!/^[A-Z]{3}$/.test(quote.currency)) issues.push("Currency is invalid.");
  const selectedItems = items.filter(
    (item) => item.is_selected || !item.is_optional,
  );
  if (selectedItems.length === 0)
    issues.push("At least one selected item is required.");
  if (
    selectedItems.some((item) => item.quantity < 0 || item.unit_price_minor < 0)
  ) {
    issues.push("Quote item amounts must be valid.");
  }
  const totals = calculateQuoteTotals(
    items.map((item) => ({
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      isOptional: item.is_optional,
      isSelected: item.is_selected,
    })),
    quote.discount_minor,
  );
  if (
    totals.subtotalMinor !== quote.subtotal_minor ||
    totals.discountMinor !== quote.discount_minor ||
    totals.taxMinor !== quote.tax_minor ||
    totals.totalMinor !== quote.total_minor
  ) {
    issues.push("Quote totals need recalculating.");
  }
  if (!textValue(quote.scope_summary))
    issues.push("Scope summary is required.");
  if (!textValue(quote.payment_terms))
    issues.push("Payment terms are required.");
  if (!textValue(quote.included_scope))
    issues.push("Included scope is required.");
  if (!textValue(quote.excluded_scope))
    issues.push("Excluded scope is required.");
  if (immutableQuoteStatus(quote.status))
    issues.push("This quote is already closed.");
  return issues;
}

export function buildOperationsQuotePreviewPayload(
  quote: OperationsQuoteRow,
  items: OperationsQuoteItemRow[],
): OperationsQuotePreviewPayload {
  if (
    quote.frozen_render_json &&
    ["sent", "accepted", "converted_to_work"].includes(quote.status)
  ) {
    return quote.frozen_render_json;
  }
  const config = getOperationsCommercialConfig();
  const selectedItems = items.filter(
    (item) => item.is_selected || !item.is_optional,
  );
  return {
    quote: {
      id: quote.id,
      quoteNumber: quote.quote_number,
      title: quote.title,
      status: quote.status,
      currency: quote.currency,
      validUntil: dateOnly(quote.valid_until),
      estimatedStartDate: dateOnly(quote.estimated_start_date),
      estimatedCompletionDate: dateOnly(quote.estimated_completion_date),
      estimatedDurationText: quote.estimated_duration_text,
      sentAt: iso(quote.sent_at),
      acceptedAt: iso(quote.accepted_at),
    },
    business: {
      id: quote.business_id,
      name: quote.business_name ?? "Client",
    },
    contact: {
      name:
        [quote.contact_first_name, quote.contact_last_name]
          .filter(Boolean)
          .join(" ")
          .trim() || null,
      email: quote.contact_email ?? null,
    },
    report: quote.operations_report_id
      ? {
          id: quote.operations_report_id,
          title: quote.report_title ?? null,
          website:
            quote.report_site_display_name ?? quote.report_site_url ?? null,
        }
      : null,
    items: selectedItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
      itemType: item.item_type,
      isOptional: item.is_optional,
      estimatedEffort: item.estimated_effort,
    })),
    totals: {
      subtotalMinor: quote.subtotal_minor,
      discountMinor: quote.discount_minor,
      taxMinor: quote.tax_minor,
      totalMinor: quote.total_minor,
      vatRegistered: config.vatRegistered,
      vatRatePercent: config.vatRatePercent,
      vatNotice: config.vatRegistered
        ? `VAT calculated at ${config.vatRatePercent}%.`
        : "No VAT charged.",
    },
    scope: {
      summary: quote.scope_summary,
      included: quote.included_scope,
      excluded: quote.excluded_scope,
      assumptions: quote.assumptions,
      clientResponsibilities: quote.client_responsibilities,
      accessRequirementsSummary: quote.access_requirements_summary,
      paymentTerms: quote.payment_terms,
    },
    limitations: [
      "Work is limited to the agreed scope in this quote.",
      "New issues or third-party limitations may require a revised quote.",
      "Backups and required access should be confirmed before changes begin.",
      "Scanlark monitoring is not a penetration test or legal compliance audit.",
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function getOperationsQuotePreview(
  workspaceId: string,
  quoteId: string,
) {
  const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  return {
    payload: buildOperationsQuotePreviewPayload(detail.quote, detail.items),
    readinessIssues: detail.readinessIssues,
  };
}

export async function freezeOperationsQuoteRender(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  action = "operations_quote_render_frozen",
) {
  const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  if (isHistoricalQuoteStatus(detail.quote.status)) {
    if (detail.quote.frozen_render_json) return detail.quote.frozen_render_json;
    throw immutableArtifactError("quote");
  }
  const payload = buildOperationsQuotePreviewPayload(
    detail.quote,
    detail.items,
  );
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE operations_quotes
      SET frozen_render_json = $2::jsonb,
          frozen_at = now(),
          last_pdf_generated_at = CASE WHEN $3 = 'operations_quote_pdf_generated' THEN now() ELSE last_pdf_generated_at END,
          updated_at = now()
      WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quotes.id AND b.internal_workspace_id = $4)
    `,
    [quoteId, JSON.stringify(payload), action, workspaceId],
  );
  await recordAdminAuditLog(actor, {
    action,
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: { itemCount: payload.items.length },
  });
  return payload;
}

export async function updateOperationsQuote(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: OperationsQuoteUpdateInput,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current, input.expectedRevision);
  if (input.contactId) {
    const validation = await validateQuoteRelationships({
      workspaceId,
      businessId: current.business_id,
      contactId: input.contactId,
      operationsReportId:
        input.operationsReportId ?? current.operations_report_id,
    });
    if (validation !== "ok") return validation;
  }
  const client = await ensureConnected();
  const fields: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };
  if (input.contactId !== undefined) set("contact_id", input.contactId);
  if (input.operationsReportId !== undefined)
    set("operations_report_id", input.operationsReportId);
  if (input.title !== undefined) set("title", input.title.trim());
  if (input.currency !== undefined)
    set("currency", input.currency.toUpperCase());
  if (input.discountMinor !== undefined)
    set("discount_minor", input.discountMinor);
  if (input.validUntil !== undefined) set("valid_until", input.validUntil);
  if (input.estimatedStartDate !== undefined)
    set("estimated_start_date", input.estimatedStartDate);
  if (input.estimatedCompletionDate !== undefined)
    set("estimated_completion_date", input.estimatedCompletionDate);
  if (input.estimatedDurationText !== undefined)
    set("estimated_duration_text", textValue(input.estimatedDurationText));
  if (input.paymentTerms !== undefined)
    set("payment_terms", textValue(input.paymentTerms));
  if (input.scopeSummary !== undefined)
    set("scope_summary", textValue(input.scopeSummary));
  if (input.includedScope !== undefined)
    set("included_scope", textValue(input.includedScope));
  if (input.excludedScope !== undefined)
    set("excluded_scope", textValue(input.excludedScope));
  if (input.assumptions !== undefined)
    set("assumptions", textValue(input.assumptions));
  if (input.clientResponsibilities !== undefined)
    set("client_responsibilities", textValue(input.clientResponsibilities));
  if (input.accessRequirementsSummary !== undefined)
    set(
      "access_requirements_summary",
      textValue(input.accessRequirementsSummary),
    );
  if (input.internalNotes !== undefined)
    set("internal_notes", textValue(input.internalNotes));
  if (fields.length === 0)
    return getOperationsQuoteDetail(workspaceId, quoteId);
  values.push(quoteId);
  const res = await client.query<OperationsQuoteRow>(
    `
      UPDATE operations_quotes
      SET ${fields.join(", ")},
          content_revision = content_revision + 1,
          frozen_render_json = NULL,
          frozen_at = NULL,
          updated_at = now()
      WHERE id = $${values.length}
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quotes.id AND b.internal_workspace_id = $${values.length + 1} AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work'))
        AND ($${values.length + 2}::integer IS NULL OR content_revision = $${values.length + 2})
      RETURNING *
    `,
    [...values, workspaceId, input.expectedRevision ?? null],
  );
  if (!res.rowCount) {
    const latest = await getQuoteForUpdate(workspaceId, quoteId);
    if (
      latest &&
      input.expectedRevision !== undefined &&
      (latest.content_revision ?? 1) !== input.expectedRevision
    ) {
      throw staleRevisionError("quote");
    }
    if (latest && immutableQuoteStatus(latest.status)) {
      throw immutableArtifactError("quote");
    }
    return null;
  }
  await refreshQuoteTotals(workspaceId, quoteId);
  await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_updated",
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: { fields: Object.keys(input) },
  });
  return res.rows[0] ? getOperationsQuoteDetail(workspaceId, quoteId) : null;
}

export async function addOperationsQuoteItem(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: OperationsQuoteItemInput,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current);
  const validation = await validateQuoteRelationships({
    workspaceId,
    businessId: current.business_id,
    operationsReportId: current.operations_report_id,
    reportFindingIds: input.reportFindingId ? [input.reportFindingId] : [],
  });
  if (validation !== "ok") return validation;
  const client = await ensureConnected();
  const item = mapQuoteItemInput(input);
  const res = await client.query<OperationsQuoteItemRow>(
    `
      INSERT INTO operations_quote_items (
        quote_id,
        report_finding_id,
        title,
        description,
        quantity,
        unit_price_minor,
        line_total_minor,
        item_type,
        is_optional,
        is_selected,
        display_order,
        estimated_effort,
        internal_notes
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      WHERE EXISTS (
        SELECT 1 FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE q.id = $1
          AND b.internal_workspace_id = $14
          AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
      )
      RETURNING *
    `,
    [
      quoteId,
      item.reportFindingId,
      item.title,
      item.description,
      item.quantity,
      item.unitPriceMinor,
      item.lineTotalMinor,
      item.itemType,
      item.isOptional,
      item.isSelected,
      item.displayOrder,
      item.estimatedEffort,
      item.internalNotes,
      workspaceId,
    ],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(workspaceId, quoteId);
  }
  await refreshQuoteTotals(workspaceId, quoteId);
  await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_item_added",
    targetType: "operations_quote_item",
    targetId: res.rows[0]?.id ?? quoteId,
    metadata: { quoteId, itemType: item.itemType },
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsQuoteItem(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  itemId: string,
  input: Partial<OperationsQuoteItemInput>,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current, input.expectedRevision);
  const client = await ensureConnected();
  const existing = await client.query<OperationsQuoteItemRow>(
    `SELECT qi.* FROM operations_quote_items qi JOIN operations_quotes q ON q.id = qi.quote_id JOIN operations_businesses b ON b.id = q.business_id WHERE qi.id = $2 AND qi.quote_id = $3 AND b.internal_workspace_id = $1`,
    [workspaceId, itemId, quoteId],
  );
  if (!existing.rows[0]) return null;
  const merged = mapQuoteItemInput({
    reportFindingId:
      input.reportFindingId !== undefined
        ? input.reportFindingId
        : existing.rows[0].report_finding_id,
    title: input.title ?? existing.rows[0].title,
    description:
      input.description !== undefined
        ? input.description
        : existing.rows[0].description,
    quantity: input.quantity ?? existing.rows[0].quantity,
    unitPriceMinor: input.unitPriceMinor ?? existing.rows[0].unit_price_minor,
    itemType: input.itemType ?? existing.rows[0].item_type,
    isOptional: input.isOptional ?? existing.rows[0].is_optional,
    isSelected: input.isSelected ?? existing.rows[0].is_selected,
    displayOrder: input.displayOrder ?? existing.rows[0].display_order,
    estimatedEffort:
      input.estimatedEffort !== undefined
        ? input.estimatedEffort
        : existing.rows[0].estimated_effort,
    internalNotes:
      input.internalNotes !== undefined
        ? input.internalNotes
        : existing.rows[0].internal_notes,
  });
  const res = await client.query<OperationsQuoteItemRow>(
    `
      UPDATE operations_quote_items
      SET report_finding_id = $3,
          title = $4,
          description = $5,
          quantity = $6,
          unit_price_minor = $7,
          line_total_minor = $8,
          item_type = $9,
          is_optional = $10,
          is_selected = $11,
          display_order = $12,
          estimated_effort = $13,
          internal_notes = $14,
          updated_at = now()
      WHERE id = $1 AND quote_id = $2
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_items.quote_id AND b.internal_workspace_id = $15 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work'))
      RETURNING *
    `,
    [
      itemId,
      quoteId,
      merged.reportFindingId,
      merged.title,
      merged.description,
      merged.quantity,
      merged.unitPriceMinor,
      merged.lineTotalMinor,
      merged.itemType,
      merged.isOptional,
      merged.isSelected,
      merged.displayOrder,
      merged.estimatedEffort,
      merged.internalNotes,
      workspaceId,
    ],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(
      workspaceId,
      quoteId,
      input.expectedRevision,
    );
  }
  await refreshQuoteTotals(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_item_updated",
    targetType: "operations_quote_item",
    targetId: itemId,
    metadata: { quoteId, fields: Object.keys(input) },
  });
  return res.rows[0] ?? null;
}

export async function deleteOperationsQuoteItem(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  itemId: string,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current);
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteItemRow>(
    `DELETE FROM operations_quote_items WHERE id = $1 AND quote_id = $2 AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_items.quote_id AND b.internal_workspace_id = $3 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')) RETURNING *`,
    [itemId, quoteId, workspaceId],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(workspaceId, quoteId);
    return null;
  }
  await refreshQuoteTotals(workspaceId, quoteId);
  await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_item_deleted",
    targetType: "operations_quote_item",
    targetId: itemId,
    metadata: { quoteId },
  });
  return res.rows[0];
}

export async function reorderOperationsQuoteItems(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  itemIds: string[],
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current);
  const client = await ensureConnected();
  await client.query("BEGIN");
  try {
    const locked = await client.query<OperationsQuoteRow>(
      `SELECT q.*
       FROM operations_quotes q
       JOIN operations_businesses b ON b.id = q.business_id
       WHERE q.id = $2 AND b.internal_workspace_id = $1
       FOR UPDATE OF q`,
      [workspaceId, quoteId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    if (immutableQuoteStatus(locked.rows[0].status)) {
      await client.query("ROLLBACK");
      throw immutableArtifactError("quote");
    }
    const valid = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM operations_quote_items qi
       JOIN operations_quotes q ON q.id = qi.quote_id
       JOIN operations_businesses b ON b.id = q.business_id
       WHERE qi.quote_id = $1 AND qi.id = ANY($2::uuid[]) AND b.internal_workspace_id = $3 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')`,
      [quoteId, itemIds, workspaceId],
    );
    if (Number(valid.rows[0]?.count ?? 0) !== new Set(itemIds).size) {
      await client.query("ROLLBACK");
      return null;
    }
    for (let index = 0; index < itemIds.length; index += 1) {
      await client.query(
        `UPDATE operations_quote_items SET display_order = $3, updated_at = now() WHERE id = $1 AND quote_id = $2 AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_items.quote_id AND b.internal_workspace_id = $4 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work'))`,
        [itemIds[index], quoteId, index, workspaceId],
      );
    }
    await recordAdminAuditLog(actor, {
      action: "operations_quote_items_reordered",
      targetType: "operations_quote",
      targetId: quoteId,
      metadata: { count: itemIds.length },
    });
    await client.query("COMMIT");
    await bumpQuoteContentRevision(workspaceId, quoteId);
    return listQuoteItems(workspaceId, quoteId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function addOperationsQuoteAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: OperationsAccessRequirementInput,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current);
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteAccessRequirementRow>(
    `
      INSERT INTO operations_quote_access_requirements (
        quote_id,
        description,
        status,
        requested_at,
        received_at,
        secure_storage_reference,
        notes,
        display_order
      )
      SELECT $1, $2, $3, $4, $5, $6, $7, $8
      WHERE EXISTS (
        SELECT 1 FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE q.id = $1
          AND b.internal_workspace_id = $9
          AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
      )
      RETURNING *
    `,
    [
      quoteId,
      input.description.trim(),
      input.status ?? "not_requested",
      input.requestedAt ?? null,
      input.receivedAt ?? null,
      textValue(input.secureStorageReference),
      textValue(input.notes),
      input.displayOrder ?? 0,
      workspaceId,
    ],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(
      workspaceId,
      quoteId,
      input.expectedRevision,
    );
  }
  await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_access_requirement_added",
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: {},
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsQuoteAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  requirementId: string,
  input: Partial<OperationsAccessRequirementInput>,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current, input.expectedRevision);
  const client = await ensureConnected();
  const existing = await client.query<OperationsQuoteAccessRequirementRow>(
    `SELECT r.* FROM operations_quote_access_requirements r
     JOIN operations_quotes q ON q.id = r.quote_id
     JOIN operations_businesses b ON b.id = q.business_id
     WHERE r.id = $1 AND r.quote_id = $2 AND b.internal_workspace_id = $3`,
    [requirementId, quoteId, workspaceId],
  );
  if (!existing.rows[0]) return null;
  const row = existing.rows[0];
  const res = await client.query<OperationsQuoteAccessRequirementRow>(
    `
      UPDATE operations_quote_access_requirements
      SET description = $3,
          status = $4,
          requested_at = $5,
          received_at = $6,
          secure_storage_reference = $7,
          notes = $8,
          display_order = $9,
          updated_at = now()
      WHERE id = $1 AND quote_id = $2
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_access_requirements.quote_id AND b.internal_workspace_id = $10 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work'))
      RETURNING *
    `,
    [
      requirementId,
      quoteId,
      input.description?.trim() ?? row.description,
      input.status ?? row.status,
      input.requestedAt !== undefined ? input.requestedAt : row.requested_at,
      input.receivedAt !== undefined ? input.receivedAt : row.received_at,
      input.secureStorageReference !== undefined
        ? textValue(input.secureStorageReference)
        : row.secure_storage_reference,
      input.notes !== undefined ? textValue(input.notes) : row.notes,
      input.displayOrder ?? row.display_order,
      workspaceId,
    ],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(
      workspaceId,
      quoteId,
      input.expectedRevision,
    );
  }
  if (res.rows[0]) await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_access_requirement_updated",
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: { requirementId },
  });
  return res.rows[0] ?? null;
}

export async function deleteOperationsQuoteAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  requirementId: string,
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  assertQuoteContentMutable(current);
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteAccessRequirementRow>(
    `DELETE FROM operations_quote_access_requirements
     WHERE id = $1 AND quote_id = $2
       AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quote_access_requirements.quote_id AND b.internal_workspace_id = $3 AND q.status NOT IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work'))
     RETURNING *`,
    [requirementId, quoteId, workspaceId],
  );
  if (!res.rows[0]) {
    await throwIfQuoteMutationRejected(workspaceId, quoteId);
    return null;
  }
  await bumpQuoteContentRevision(workspaceId, quoteId);
  await recordAdminAuditLog(actor, {
    action: "operations_quote_access_requirement_deleted",
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: { requirementId },
  });
  return res.rows[0];
}

async function setQuoteStatus(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  status: OperationsQuoteStatus,
  options: {
    reason?: string | null;
    sentAt?: Date | null;
    acceptedAt?: Date | null;
    declinedAt?: Date | null;
    expiredAt?: Date | null;
    cancelledAt?: Date | null;
    freeze?: boolean;
  } = {},
) {
  const current = await getQuoteForUpdate(workspaceId, quoteId);
  if (!current) return null;
  if (isHistoricalQuoteStatus(current.status)) {
    const allowed =
      current.status === "sent"
        ? new Set<OperationsQuoteStatus>([
            "sent",
            "accepted",
            "declined",
            "expired",
            "cancelled",
          ])
        : current.status === "accepted"
          ? new Set<OperationsQuoteStatus>(["accepted", "converted_to_work"])
          : new Set<OperationsQuoteStatus>([current.status]);
    if (!allowed.has(status)) throw immutableArtifactError("quote");
  }
  if (
    current.status === "converted_to_work" &&
    status !== "converted_to_work"
  ) {
    throw immutableArtifactError("quote");
  }
  if (status === "ready_to_send") {
    const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
    if (!detail) return null;
    if (detail.readinessIssues.length > 0) {
      return { readinessIssues: detail.readinessIssues };
    }
  }
  if (
    options.freeze ||
    ["ready_to_send", "sent", "accepted"].includes(status)
  ) {
    await freezeOperationsQuoteRender(
      workspaceId,
      actor,
      quoteId,
      "operations_quote_render_frozen",
    );
  }
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteRow>(
    `
      UPDATE operations_quotes
      SET status = $2,
          content_revision = content_revision + CASE WHEN $2 = 'sent' AND status <> 'sent' THEN 1 ELSE 0 END,
          sent_at = COALESCE($3, sent_at),
          accepted_at = COALESCE($4, accepted_at),
          declined_at = COALESCE($5, declined_at),
          expired_at = COALESCE($6, expired_at),
          cancelled_at = COALESCE($7, cancelled_at),
          updated_at = now()
      WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = operations_quotes.id AND b.internal_workspace_id = $8)
      RETURNING *
    `,
    [
      quoteId,
      status,
      options.sentAt ?? null,
      options.acceptedAt ?? null,
      options.declinedAt ?? null,
      options.expiredAt ?? null,
      options.cancelledAt ?? null,
      workspaceId,
    ],
  );
  await insertQuoteStatusHistory(
    workspaceId,
    actor,
    quoteId,
    current.status,
    status,
    options.reason,
  );
  await recordAdminAuditLog(actor, {
    action: `operations_quote_status_${status}`,
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: {},
  });
  return res.rows[0] ? getOperationsQuoteDetail(workspaceId, quoteId) : null;
}

export async function markOperationsQuoteReady(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
) {
  return setQuoteStatus(workspaceId, actor, quoteId, "ready_to_send", {
    freeze: true,
  });
}

export async function cancelOperationsQuote(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  reason?: string | null,
) {
  return setQuoteStatus(workspaceId, actor, quoteId, "cancelled", {
    reason,
    cancelledAt: new Date(),
  });
}

export async function markOperationsQuoteExpired(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  reason?: string | null,
) {
  return setQuoteStatus(workspaceId, actor, quoteId, "expired", {
    reason,
    expiredAt: new Date(),
  });
}

export async function recordOperationsQuoteSent(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: {
    contactId?: string | null;
    deliveryMethod: "email_attachment" | "in_person" | "other";
    sentAt?: Date | null;
    followUpAt?: Date | null;
    updatePipelineStage?: boolean;
  },
) {
  let detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  if (isHistoricalQuoteStatus(detail.quote.status)) {
    throw immutableArtifactError("quote");
  }
  const contactId = input.contactId ?? detail.quote.contact_id;
  if (contactId) {
    const validation = await validateQuoteRelationships({
      workspaceId,
      businessId: detail.quote.business_id,
      contactId,
    });
    if (validation !== "ok") return validation;
  }
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const locked = await client.query<OperationsQuoteRow>(
      `
        SELECT q.*
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE q.id = $2 AND b.internal_workspace_id = $1
        FOR UPDATE OF q
      `,
      [workspaceId, quoteId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return null;
    }
    if (isHistoricalQuoteStatus(locked.rows[0].status)) {
      await client.query("ROLLBACK");
      throw immutableArtifactError("quote");
    }
    detail = await getOperationsQuoteDetail(workspaceId, quoteId);
    if (!detail) {
      await client.query("ROLLBACK");
      return null;
    }
    const comm = await client.query<{ id: string }>(
      `
        INSERT INTO operations_communications (
          business_id,
          contact_id,
          operations_report_id,
          quote_id,
          direction,
          channel,
          status,
          subject,
          body,
          sent_at,
          occurred_at,
          follow_up_at,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, 'outbound', $5, 'sent', $6, $7, $8, $8, $9, $10)
        RETURNING id
      `,
      [
        detail.quote.business_id,
        contactId ?? null,
        detail.quote.operations_report_id,
        quoteId,
        input.deliveryMethod === "in_person" ? "in_person" : "email",
        `Quote ${detail.quote.quote_number} - ${detail.quote.title}`,
        `Quote ${detail.quote.quote_number} was recorded as sent by ${input.deliveryMethod}.`,
        input.sentAt ?? new Date(),
        input.followUpAt ?? null,
        actor.id,
      ],
    );
    let taskId: string | null = null;
    if (input.followUpAt) {
      const task = await client.query<{ id: string }>(
        `
          INSERT INTO operations_tasks (
            business_id,
            contact_id,
            source_quote_id,
            source_key,
            title,
            notes,
            due_at,
            status,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8)
          ON CONFLICT (source_key)
          WHERE source_key IS NOT NULL
          DO UPDATE
          SET due_at = EXCLUDED.due_at,
              status = 'open',
              updated_at = now()
          RETURNING id
        `,
        [
          detail.quote.business_id,
          contactId ?? null,
          quoteId,
          `quote:${quoteId}:follow-up`,
          `Follow up on quote ${detail.quote.quote_number}`,
          "Manual follow-up after quote delivery.",
          input.followUpAt,
          actor.id,
        ],
      );
      taskId = task.rows[0]?.id ?? null;
    }
    await client.query(
      `
        UPDATE operations_quotes
        SET delivery_communication_id = $2,
            follow_up_task_id = COALESCE($3, follow_up_task_id)
        WHERE id = $1
          AND status IN ('draft', 'needs_review', 'ready_to_send')
          AND EXISTS (
            SELECT 1 FROM operations_businesses b
            WHERE b.id = operations_quotes.business_id
              AND b.internal_workspace_id = $4
          )
      `,
      [quoteId, comm.rows[0]?.id ?? null, taskId, workspaceId],
    );
    await client.query(
      `
        UPDATE operations_businesses
        SET last_contacted_at = $2,
            pipeline_stage = CASE WHEN $3 THEN 'quote_sent' ELSE pipeline_stage END,
            updated_at = now()
        WHERE id = $1
          AND internal_workspace_id = $4
      `,
      [
        detail.quote.business_id,
        input.sentAt ?? new Date(),
        input.updatePipelineStage === true,
        workspaceId,
      ],
    );
    await freezeOperationsQuoteRender(
      workspaceId,
      actor,
      quoteId,
      "operations_quote_render_frozen",
    );
    await client.query(
      `
        UPDATE operations_quotes
        SET status = 'sent',
            content_revision = content_revision + 1,
            sent_at = COALESCE(sent_at, $2),
            updated_at = now()
        WHERE id = $1
          AND status IN ('draft', 'needs_review', 'ready_to_send')
          AND EXISTS (
            SELECT 1 FROM operations_businesses b
            WHERE b.id = operations_quotes.business_id
              AND b.internal_workspace_id = $3
          )
      `,
      [quoteId, input.sentAt ?? new Date(), workspaceId],
    );
    await insertQuoteStatusHistory(
      workspaceId,
      actor,
      quoteId,
      locked.rows[0].status,
      "sent",
      `Recorded sent by ${input.deliveryMethod}`,
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  await recordAdminAuditLog(actor, {
    action: "operations_quote_status_sent",
    targetType: "operations_quote",
    targetId: quoteId,
    metadata: { deliveryMethod: input.deliveryMethod },
  });
  return getOperationsQuoteDetail(workspaceId, quoteId);
}

export async function recordOperationsQuoteAccepted(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: {
    acceptedAt: Date;
    acceptanceMethod: "email" | "phone" | "in_person" | "other";
    contactId?: string | null;
    totalMinorConfirmed: number;
    selectedItemsConfirmed: boolean;
    freezeConfirmed: boolean;
    summary?: string | null;
  },
) {
  const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  if (
    input.totalMinorConfirmed !== detail.quote.total_minor ||
    !input.selectedItemsConfirmed ||
    !input.freezeConfirmed
  ) {
    return "acceptance_confirmation_required" as const;
  }
  return setQuoteStatus(workspaceId, actor, quoteId, "accepted", {
    acceptedAt: input.acceptedAt,
    reason: input.summary ?? input.acceptanceMethod,
    freeze: true,
  });
}

export async function recordOperationsQuoteDeclined(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
  input: { declinedAt?: Date | null; reason?: string | null },
) {
  return setQuoteStatus(workspaceId, actor, quoteId, "declined", {
    declinedAt: input.declinedAt ?? new Date(),
    reason: input.reason,
  });
}

export async function duplicateOperationsQuote(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
) {
  const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  return createOperationsQuote(workspaceId, actor, {
    businessId: detail.quote.business_id,
    contactId: detail.quote.contact_id,
    operationsReportId: detail.quote.operations_report_id,
    title: `${detail.quote.title} copy`,
    currency: detail.quote.currency,
    discountMinor: detail.quote.discount_minor,
    validUntil: detail.quote.valid_until,
    estimatedStartDate: detail.quote.estimated_start_date,
    estimatedCompletionDate: detail.quote.estimated_completion_date,
    estimatedDurationText: detail.quote.estimated_duration_text,
    paymentTerms: detail.quote.payment_terms,
    scopeSummary: detail.quote.scope_summary,
    includedScope: detail.quote.included_scope,
    excludedScope: detail.quote.excluded_scope,
    assumptions: detail.quote.assumptions,
    clientResponsibilities: detail.quote.client_responsibilities,
    accessRequirementsSummary: detail.quote.access_requirements_summary,
    internalNotes: detail.quote.internal_notes,
    items: detail.items.map((item) => ({
      reportFindingId: item.report_finding_id,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unit_price_minor,
      itemType: item.item_type,
      isOptional: item.is_optional,
      isSelected: item.is_selected,
      displayOrder: item.display_order,
      estimatedEffort: item.estimated_effort,
      internalNotes: item.internal_notes,
    })),
    accessRequirements: detail.accessRequirements.map((item) => ({
      description: item.description,
      status: item.status,
      requestedAt: item.requested_at,
      receivedAt: item.received_at,
      secureStorageReference: item.secure_storage_reference,
      notes: item.notes,
      displayOrder: item.display_order,
    })),
  });
}

export async function listOperationsQuoteServiceItems(
  workspaceId: string,
  activeOnly = false,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteServiceItemRow>(
    `
      SELECT *
      FROM operations_quote_service_items
      WHERE internal_workspace_id = $1
      ${activeOnly ? "AND is_active = true" : ""}
      ORDER BY is_active DESC, item_type ASC, title ASC
    `,
    [workspaceId],
  );
  return res.rows;
}

export async function createOperationsQuoteServiceItem(
  workspaceId: string,
  actor: AdminActor,
  input: {
    title: string;
    description?: string | null;
    suggestedPriceMinor?: number;
    suggestedEffort?: string | null;
    itemType?: OperationsQuoteItemType;
    isActive?: boolean;
  },
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuoteServiceItemRow>(
    `
      INSERT INTO operations_quote_service_items (
        internal_workspace_id,
        title,
        description,
        suggested_price_minor,
        suggested_effort,
        item_type,
        is_active,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      workspaceId,
      input.title.trim(),
      textValue(input.description),
      input.suggestedPriceMinor ?? 0,
      textValue(input.suggestedEffort),
      input.itemType ?? "website_fix",
      input.isActive !== false,
      actor.id,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_quote_service_item_created",
    targetType: "operations_quote_service_item",
    targetId: res.rows[0]?.id ?? "unknown",
    metadata: { itemType: input.itemType ?? "website_fix" },
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsQuoteServiceItem(
  workspaceId: string,
  actor: AdminActor,
  serviceItemId: string,
  input: Partial<{
    title: string;
    description: string | null;
    suggestedPriceMinor: number;
    suggestedEffort: string | null;
    itemType: OperationsQuoteItemType;
    isActive: boolean;
  }>,
) {
  const client = await ensureConnected();
  const existing = await client.query<OperationsQuoteServiceItemRow>(
    `SELECT * FROM operations_quote_service_items WHERE id = $1 AND internal_workspace_id = $2`,
    [serviceItemId, workspaceId],
  );
  if (!existing.rows[0]) return null;
  const row = existing.rows[0];
  const res = await client.query<OperationsQuoteServiceItemRow>(
    `
      UPDATE operations_quote_service_items
      SET title = $2,
          description = $3,
          suggested_price_minor = $4,
          suggested_effort = $5,
          item_type = $6,
          is_active = $7,
          updated_at = now()
      WHERE id = $1 AND internal_workspace_id = $8
      RETURNING *
    `,
    [
      serviceItemId,
      input.title?.trim() ?? row.title,
      input.description !== undefined
        ? textValue(input.description)
        : row.description,
      input.suggestedPriceMinor ?? row.suggested_price_minor,
      input.suggestedEffort !== undefined
        ? textValue(input.suggestedEffort)
        : row.suggested_effort,
      input.itemType ?? row.item_type,
      input.isActive ?? row.is_active,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_quote_service_item_updated",
    targetType: "operations_quote_service_item",
    targetId: serviceItemId,
    metadata: { fields: Object.keys(input) },
  });
  return res.rows[0] ?? null;
}

export async function convertOperationsQuoteToWorkOrder(
  workspaceId: string,
  actor: AdminActor,
  quoteId: string,
) {
  const detail = await getOperationsQuoteDetail(workspaceId, quoteId);
  if (!detail) return null;
  if (detail.linkedWorkOrder) {
    return getOperationsWorkOrderDetail(workspaceId, detail.linkedWorkOrder.id);
  }
  if (detail.quote.status !== "accepted") return "quote_not_accepted" as const;
  const selectedItems = detail.items.filter(
    (item) => item.is_selected || !item.is_optional,
  );
  if (selectedItems.length === 0) return "quote_has_no_selected_items" as const;
  const outstandingAccess = detail.accessRequirements.some((item) =>
    ["not_requested", "requested"].includes(item.status),
  );
  const config = getOperationsCommercialConfig();
  const workOrderNumber = await nextDocumentNumber(
    "work_order",
    config.workOrderPrefix,
  );
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const work = await client.query<OperationsWorkOrderRow>(
      `
        INSERT INTO operations_work_orders (
          business_id,
          contact_id,
          quote_id,
          operations_report_id,
          work_order_number,
          title,
          status,
          priority,
          scope_summary,
          accepted_total_minor,
          currency,
          target_completion_at,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'normal', $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        detail.quote.business_id,
        detail.quote.contact_id,
        quoteId,
        detail.quote.operations_report_id,
        workOrderNumber,
        detail.quote.title,
        outstandingAccess ? "awaiting_access" : "ready_to_start",
        detail.quote.scope_summary,
        detail.quote.total_minor,
        detail.quote.currency,
        detail.quote.estimated_completion_date,
        actor.id,
      ],
    );
    const workOrder = work.rows[0];
    if (!workOrder) throw new Error("work_order_insert_failed");
    for (const item of selectedItems) {
      await client.query(
        `
          INSERT INTO operations_work_items (
            work_order_id,
            quote_item_id,
            report_finding_id,
            title,
            description,
            status,
            display_order,
            requires_retest,
            retest_status,
            internal_notes
          )
          VALUES ($1, $2, $3, $4, $5, 'to_do', $6, $7, $8, $9)
        `,
        [
          workOrder.id,
          item.id,
          item.report_finding_id,
          item.title,
          item.description,
          item.display_order,
          item.report_finding_id != null || item.item_type === "retest",
          item.report_finding_id != null || item.item_type === "retest"
            ? "pending"
            : "not_required",
          item.internal_notes,
        ],
      );
    }
    for (const req of detail.accessRequirements) {
      await client.query(
        `
          INSERT INTO operations_work_order_access_requirements (
            work_order_id,
            quote_access_requirement_id,
            description,
            status,
            requested_at,
            received_at,
            secure_storage_reference,
            notes,
            display_order
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          workOrder.id,
          req.id,
          req.description,
          req.status,
          req.requested_at,
          req.received_at,
          req.secure_storage_reference,
          req.notes,
          req.display_order,
        ],
      );
    }
    await client.query(
      `
        UPDATE operations_quotes
        SET status = 'converted_to_work',
       converted_work_order_id = $2,
           updated_at = now()
       WHERE id = $1
          AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_quotes.business_id AND b.internal_workspace_id = $3)
      `,
      [quoteId, workOrder.id, workspaceId],
    );
    await client.query(
      `
        UPDATE operations_reports
        SET status = 'work_in_progress',
            updated_at = now()
       WHERE id = $1
         AND status IN ('sent', 'client_replied', 'fixes_quoted')
          AND EXISTS (SELECT 1 FROM operations_businesses b WHERE b.id = operations_reports.business_id AND b.internal_workspace_id = $2)
      `,
      [detail.quote.operations_report_id, workspaceId],
    );
    await insertQuoteStatusHistory(
      workspaceId,
      actor,
      quoteId,
      "accepted",
      "converted_to_work",
      "converted to work order",
    );
    await recordAdminAuditLog(actor, {
      action: "operations_quote_converted_to_work",
      targetType: "operations_quote",
      targetId: quoteId,
      metadata: { workOrderId: workOrder.id },
    });
    await client.query("COMMIT");
    return getOperationsWorkOrderDetail(workspaceId, workOrder.id);
  } catch (err) {
    await client.query("ROLLBACK");
    if ((err as { code?: string }).code === "23505") {
      const existing = await client.query<OperationsWorkOrderRow>(
        `SELECT * FROM operations_work_orders WHERE quote_id = $1 AND status <> 'cancelled' LIMIT 1`,
        [quoteId],
      );
      return existing.rows[0] ?? "quote_already_converted";
    }
    throw err;
  }
}

export async function listOperationsWorkOrders(
  workspaceId: string,
  options: {
    businessId?: string | null;
    operationsReportId?: string | null;
    quoteId?: string | null;
    status?: OperationsWorkOrderStatus | null;
    priority?: OperationsWorkOrderPriority | null;
    search?: string | null;
    overdue?: boolean;
    limit: number;
    offset: number;
  },
) {
  const client = await ensureConnected();
  const where: string[] = ["b.internal_workspace_id = $1"];
  const params: unknown[] = [workspaceId];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  if (options.businessId) add("wo.business_id = ?", options.businessId);
  if (options.operationsReportId)
    add("wo.operations_report_id = ?", options.operationsReportId);
  if (options.quoteId) add("wo.quote_id = ?", options.quoteId);
  if (options.status) add("wo.status = ?", options.status);
  if (options.priority) add("wo.priority = ?", options.priority);
  if (options.overdue) {
    where.push(
      "wo.target_completion_at IS NOT NULL AND wo.target_completion_at < now() AND wo.status NOT IN ('completed', 'cancelled')",
    );
  }
  if (options.search?.trim()) {
    params.push(`%${options.search.trim()}%`);
    where.push(
      `(wo.title ILIKE $${params.length} OR wo.work_order_number ILIKE $${params.length} OR b.name ILIKE $${params.length})`,
    );
  }
  params.push(options.limit, options.offset);
  const limitIndex = params.length - 1;
  const offsetIndex = params.length;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [rows, count, summary] = await Promise.all([
    client.query<OperationsWorkOrderRow>(
      `
        SELECT wo.*,
               b.name AS business_name,
               c.first_name AS contact_first_name,
               c.last_name AS contact_last_name,
               c.email AS contact_email,
               q.quote_number,
               q.title AS quote_title,
               r.title AS report_title,
               COALESCE(item_counts.active_item_count, 0)::int AS active_item_count,
               COALESCE(item_counts.completed_item_count, 0)::int AS completed_item_count,
               COALESCE(access_counts.outstanding_access_count, 0)::int AS outstanding_access_count
        FROM operations_work_orders wo
        JOIN operations_businesses b ON b.id = wo.business_id
        JOIN operations_quotes q ON q.id = wo.quote_id
        LEFT JOIN operations_contacts c ON c.id = wo.contact_id
        LEFT JOIN operations_reports r ON r.id = wo.operations_report_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE wi.status <> 'cancelled')::int AS active_item_count,
            COUNT(*) FILTER (WHERE wi.status = 'completed')::int AS completed_item_count
          FROM operations_work_items wi
          WHERE wi.work_order_id = wo.id
        ) item_counts ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE ar.status IN ('not_requested', 'requested'))::int AS outstanding_access_count
          FROM operations_work_order_access_requirements ar
          WHERE ar.work_order_id = wo.id
        ) access_counts ON TRUE
        ${whereSql}
        ORDER BY wo.updated_at DESC
        LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `,
      params,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_work_orders wo
        JOIN operations_businesses b ON b.id = wo.business_id
        ${whereSql}
      `,
      params.slice(0, -2),
    ),
    client.query<{
      awaiting_access: string;
      ready_to_start: string;
      in_progress: string;
      waiting_for_client: string;
      blocked: string;
      ready_for_testing: string;
      completed_this_month: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'awaiting_access')::text AS awaiting_access,
          COUNT(*) FILTER (WHERE status = 'ready_to_start')::text AS ready_to_start,
          COUNT(*) FILTER (WHERE status = 'in_progress')::text AS in_progress,
          COUNT(*) FILTER (WHERE status = 'waiting_for_client')::text AS waiting_for_client,
          COUNT(*) FILTER (WHERE status = 'blocked')::text AS blocked,
          COUNT(*) FILTER (WHERE status = 'ready_for_testing')::text AS ready_for_testing,
          COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= date_trunc('month', now()))::text AS completed_this_month
        FROM operations_work_orders wo
        JOIN operations_businesses b ON b.id = wo.business_id
        WHERE b.internal_workspace_id = $1
      `,
      [workspaceId],
    ),
  ]);
  const summaryRow = summary.rows[0];
  return {
    workOrders: rows.rows,
    totalMatching: countValue(count.rows[0]),
    countReturned: rows.rows.length,
    limit: options.limit,
    offset: options.offset,
    summary: {
      awaitingAccess:
        Number.parseInt(summaryRow?.awaiting_access ?? "0", 10) || 0,
      readyToStart: Number.parseInt(summaryRow?.ready_to_start ?? "0", 10) || 0,
      inProgress: Number.parseInt(summaryRow?.in_progress ?? "0", 10) || 0,
      waitingForClient:
        Number.parseInt(summaryRow?.waiting_for_client ?? "0", 10) || 0,
      blocked: Number.parseInt(summaryRow?.blocked ?? "0", 10) || 0,
      readyForTesting:
        Number.parseInt(summaryRow?.ready_for_testing ?? "0", 10) || 0,
      completedThisMonth:
        Number.parseInt(summaryRow?.completed_this_month ?? "0", 10) || 0,
    },
  };
}

async function listWorkItems(workspaceId: string, workOrderId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsWorkItemRow>(
    `
      SELECT wi.*, f.title AS finding_title
      FROM operations_work_items wi
      LEFT JOIN operations_report_findings f ON f.id = wi.report_finding_id
      WHERE wi.work_order_id = $2
        AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = wi.work_order_id AND b.internal_workspace_id = $1)
      ORDER BY wi.display_order ASC, wi.created_at ASC
    `,
    [workspaceId, workOrderId],
  );
  return res.rows;
}

async function listWorkAccessRequirements(
  workspaceId: string,
  workOrderId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsWorkOrderAccessRequirementRow>(
    `
      SELECT *
      FROM operations_work_order_access_requirements
      WHERE work_order_id = $2
        AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_order_access_requirements.work_order_id AND b.internal_workspace_id = $1)
      ORDER BY display_order ASC, created_at ASC
    `,
    [workspaceId, workOrderId],
  );
  return res.rows;
}

export function getWorkCompletionIssues(
  workOrder: OperationsWorkOrderRow,
  items: OperationsWorkItemRow[],
  accessRequirements: OperationsWorkOrderAccessRequirementRow[],
) {
  const issues: string[] = [];
  const activeItems = items.filter((item) => item.status !== "cancelled");
  if (activeItems.some((item) => item.status !== "completed")) {
    issues.push("All active work items must be complete or cancelled.");
  }
  if (
    activeItems.some(
      (item) =>
        item.requires_retest &&
        !["passed", "unable_to_verify", "not_required"].includes(
          item.retest_status,
        ),
    )
  ) {
    issues.push("Required re-tests must be passed or documented.");
  }
  if (
    accessRequirements.some((item) =>
      ["not_requested", "requested"].includes(item.status),
    )
  ) {
    issues.push(
      "Outstanding access requirements must be resolved or no longer needed.",
    );
  }
  if (!textValue(workOrder.completion_summary)) {
    issues.push("Completion summary is required.");
  }
  if (workOrder.status === "blocked" && !textValue(workOrder.blocked_reason)) {
    issues.push("Current blocker must be documented.");
  }
  return issues;
}

export async function getOperationsWorkOrderDetail(
  workspaceId: string,
  workOrderId: string,
): Promise<OperationsWorkOrderDetail | null> {
  const client = await ensureConnected();
  const work = await client.query<OperationsWorkOrderRow>(
    `
      SELECT wo.*,
             b.name AS business_name,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email,
             q.quote_number,
             q.title AS quote_title,
             r.title AS report_title
      FROM operations_work_orders wo
      JOIN operations_businesses b ON b.id = wo.business_id
      JOIN operations_quotes q ON q.id = wo.quote_id
      LEFT JOIN operations_contacts c ON c.id = wo.contact_id
      LEFT JOIN operations_reports r ON r.id = wo.operations_report_id
      WHERE wo.id = $2
        AND b.internal_workspace_id = $1
    `,
    [workspaceId, workOrderId],
  );
  if (!work.rows[0]) return null;
  const [items, accessRequirements] = await Promise.all([
    listWorkItems(workspaceId, workOrderId),
    listWorkAccessRequirements(workspaceId, workOrderId),
  ]);
  return {
    workOrder: work.rows[0],
    items,
    accessRequirements,
    completionIssues: getWorkCompletionIssues(
      work.rows[0],
      items,
      accessRequirements,
    ),
  };
}

export async function updateOperationsWorkOrder(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  input: OperationsWorkOrderUpdateInput,
) {
  const client = await ensureConnected();
  const existing = await client.query<OperationsWorkOrderRow>(
    `SELECT wo.* FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = $2 AND b.internal_workspace_id = $1`,
    [workspaceId, workOrderId],
  );
  if (!existing.rows[0]) return null;
  const row = existing.rows[0];
  const res = await client.query<OperationsWorkOrderRow>(
    `
      UPDATE operations_work_orders
      SET title = $2,
          status = $3,
          priority = $4,
          scope_summary = $5,
          target_completion_at = $6,
          blocked_reason = $7,
          client_waiting_reason = $8,
          completion_summary = $9,
          internal_notes = $10,
          started_at = CASE WHEN $3 = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
          completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
          updated_at = now()
      WHERE id = $1
        AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_orders.id AND b.internal_workspace_id = $11)
      RETURNING *
    `,
    [
      workOrderId,
      input.title?.trim() ?? row.title,
      input.status ?? row.status,
      input.priority ?? row.priority,
      input.scopeSummary !== undefined
        ? textValue(input.scopeSummary)
        : row.scope_summary,
      input.targetCompletionAt !== undefined
        ? input.targetCompletionAt
        : row.target_completion_at,
      input.blockedReason !== undefined
        ? textValue(input.blockedReason)
        : row.blocked_reason,
      input.clientWaitingReason !== undefined
        ? textValue(input.clientWaitingReason)
        : row.client_waiting_reason,
      input.completionSummary !== undefined
        ? textValue(input.completionSummary)
        : row.completion_summary,
      input.internalNotes !== undefined
        ? textValue(input.internalNotes)
        : row.internal_notes,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_work_order_updated",
    targetType: "operations_work_order",
    targetId: workOrderId,
    metadata: { fields: Object.keys(input) },
  });
  return res.rows[0]
    ? getOperationsWorkOrderDetail(workspaceId, workOrderId)
    : null;
}

export async function completeOperationsWorkOrder(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  completionSummary: string,
) {
  const detail = await getOperationsWorkOrderDetail(workspaceId, workOrderId);
  if (!detail) return null;
  const merged = {
    ...detail.workOrder,
    completion_summary: completionSummary,
  };
  const issues = getWorkCompletionIssues(
    merged,
    detail.items,
    detail.accessRequirements,
  );
  if (issues.length > 0) return { completionIssues: issues };
  return updateOperationsWorkOrder(workspaceId, actor, workOrderId, {
    status: "completed",
    completionSummary,
  });
}

export async function addOperationsWorkItem(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  input: OperationsWorkItemInput,
) {
  const detail = await getOperationsWorkOrderDetail(workspaceId, workOrderId);
  if (!detail) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsWorkItemRow>(
    `
      INSERT INTO operations_work_items (
        work_order_id,
        title,
        description,
        status,
        display_order,
        completion_notes,
        client_visible_completion_notes,
        requires_retest,
        retest_status,
        internal_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `,
    [
      workOrderId,
      input.title.trim(),
      textValue(input.description),
      input.status ?? "to_do",
      input.displayOrder ?? detail.items.length,
      textValue(input.completionNotes),
      textValue(input.clientVisibleCompletionNotes),
      input.requiresRetest === true,
      input.retestStatus ?? (input.requiresRetest ? "pending" : "not_required"),
      textValue(input.internalNotes),
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_work_item_added",
    targetType: "operations_work_item",
    targetId: res.rows[0]?.id ?? workOrderId,
    metadata: { workOrderId },
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsWorkItem(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  itemId: string,
  input: Partial<OperationsWorkItemInput>,
) {
  const client = await ensureConnected();
  const existing = await client.query<OperationsWorkItemRow>(
    `SELECT wi.* FROM operations_work_items wi JOIN operations_work_orders wo ON wo.id = wi.work_order_id JOIN operations_businesses b ON b.id = wo.business_id WHERE wi.id = $2 AND wi.work_order_id = $3 AND b.internal_workspace_id = $1`,
    [workspaceId, itemId, workOrderId],
  );
  if (!existing.rows[0]) return null;
  const row = existing.rows[0];
  const status = input.status ?? row.status;
  const res = await client.query<OperationsWorkItemRow>(
    `
      UPDATE operations_work_items
      SET title = $3,
          description = $4,
          status = $5,
          display_order = $6,
          started_at = CASE WHEN $5 = 'in_progress' THEN COALESCE(started_at, now()) ELSE started_at END,
          completed_at = CASE WHEN $5 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
          completion_notes = $7,
          client_visible_completion_notes = $8,
          requires_retest = $9,
          retest_status = $10,
          internal_notes = $11,
          updated_at = now()
      WHERE id = $1 AND work_order_id = $2
        AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_items.work_order_id AND b.internal_workspace_id = $12)
      RETURNING *
    `,
    [
      itemId,
      workOrderId,
      input.title?.trim() ?? row.title,
      input.description !== undefined
        ? textValue(input.description)
        : row.description,
      status,
      input.displayOrder ?? row.display_order,
      input.completionNotes !== undefined
        ? textValue(input.completionNotes)
        : row.completion_notes,
      input.clientVisibleCompletionNotes !== undefined
        ? textValue(input.clientVisibleCompletionNotes)
        : row.client_visible_completion_notes,
      input.requiresRetest ?? row.requires_retest,
      input.retestStatus ?? row.retest_status,
      input.internalNotes !== undefined
        ? textValue(input.internalNotes)
        : row.internal_notes,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_work_item_updated",
    targetType: "operations_work_item",
    targetId: itemId,
    metadata: { workOrderId, fields: Object.keys(input) },
  });
  return res.rows[0] ?? null;
}

export async function reorderOperationsWorkItems(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  itemIds: string[],
) {
  const client = await ensureConnected();
  await client.query("BEGIN");
  try {
    const valid = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM operations_work_items wi
       JOIN operations_work_orders wo ON wo.id = wi.work_order_id
       JOIN operations_businesses b ON b.id = wo.business_id
       WHERE wi.work_order_id = $1 AND wi.id = ANY($2::uuid[]) AND b.internal_workspace_id = $3`,
      [workOrderId, itemIds, workspaceId],
    );
    if (Number(valid.rows[0]?.count ?? 0) !== new Set(itemIds).size) {
      await client.query("ROLLBACK");
      return null;
    }
    for (let index = 0; index < itemIds.length; index += 1) {
      await client.query(
        `UPDATE operations_work_items SET display_order = $3, updated_at = now() WHERE id = $1 AND work_order_id = $2 AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_items.work_order_id AND b.internal_workspace_id = $4)`,
        [itemIds[index], workOrderId, index, workspaceId],
      );
    }
    await recordAdminAuditLog(actor, {
      action: "operations_work_items_reordered",
      targetType: "operations_work_order",
      targetId: workOrderId,
      metadata: { count: itemIds.length },
    });
    await client.query("COMMIT");
    return listWorkItems(workspaceId, workOrderId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function addOperationsWorkOrderAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  input: OperationsAccessRequirementInput,
) {
  const detail = await getOperationsWorkOrderDetail(workspaceId, workOrderId);
  if (!detail) return null;
  const client = await ensureConnected();
  const res = await client.query<OperationsWorkOrderAccessRequirementRow>(
    `
      INSERT INTO operations_work_order_access_requirements (
        work_order_id,
        description,
        status,
        requested_at,
        received_at,
        secure_storage_reference,
        notes,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    [
      workOrderId,
      input.description.trim(),
      input.status ?? "not_requested",
      input.requestedAt ?? null,
      input.receivedAt ?? null,
      textValue(input.secureStorageReference),
      textValue(input.notes),
      input.displayOrder ?? detail.accessRequirements.length,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_work_access_requirement_added",
    targetType: "operations_work_order",
    targetId: workOrderId,
    metadata: {},
  });
  return res.rows[0] ?? null;
}

export async function updateOperationsWorkOrderAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  requirementId: string,
  input: Partial<OperationsAccessRequirementInput>,
) {
  const client = await ensureConnected();
  const existing = await client.query<OperationsWorkOrderAccessRequirementRow>(
    `SELECT ar.* FROM operations_work_order_access_requirements ar
     JOIN operations_work_orders wo ON wo.id = ar.work_order_id
     JOIN operations_businesses b ON b.id = wo.business_id
     WHERE ar.id = $1 AND ar.work_order_id = $2 AND b.internal_workspace_id = $3`,
    [requirementId, workOrderId, workspaceId],
  );
  if (!existing.rows[0]) return null;
  const row = existing.rows[0];
  const res = await client.query<OperationsWorkOrderAccessRequirementRow>(
    `
      UPDATE operations_work_order_access_requirements
      SET description = $3,
          status = $4,
          requested_at = $5,
          received_at = $6,
          secure_storage_reference = $7,
          notes = $8,
          display_order = $9,
          updated_at = now()
      WHERE id = $1 AND work_order_id = $2
        AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_order_access_requirements.work_order_id AND b.internal_workspace_id = $10)
      RETURNING *
    `,
    [
      requirementId,
      workOrderId,
      input.description?.trim() ?? row.description,
      input.status ?? row.status,
      input.requestedAt !== undefined ? input.requestedAt : row.requested_at,
      input.receivedAt !== undefined ? input.receivedAt : row.received_at,
      input.secureStorageReference !== undefined
        ? textValue(input.secureStorageReference)
        : row.secure_storage_reference,
      input.notes !== undefined ? textValue(input.notes) : row.notes,
      input.displayOrder ?? row.display_order,
      workspaceId,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_work_access_requirement_updated",
    targetType: "operations_work_order",
    targetId: workOrderId,
    metadata: { requirementId },
  });
  return res.rows[0] ?? null;
}

export async function deleteOperationsWorkOrderAccessRequirement(
  workspaceId: string,
  actor: AdminActor,
  workOrderId: string,
  requirementId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsWorkOrderAccessRequirementRow>(
    `DELETE FROM operations_work_order_access_requirements
     WHERE id = $1 AND work_order_id = $2
       AND EXISTS (SELECT 1 FROM operations_work_orders wo JOIN operations_businesses b ON b.id = wo.business_id WHERE wo.id = operations_work_order_access_requirements.work_order_id AND b.internal_workspace_id = $3)
     RETURNING *`,
    [requirementId, workOrderId, workspaceId],
  );
  if (!res.rows[0]) return null;
  await recordAdminAuditLog(actor, {
    action: "operations_work_access_requirement_deleted",
    targetType: "operations_work_order",
    targetId: workOrderId,
    metadata: { requirementId },
  });
  return res.rows[0];
}

export async function getOperationsCommercialCounts(
  workspaceId: string,
): Promise<OperationsCommercialCounts> {
  const client = await ensureConnected();
  const [quotes, workItems, workOrders] = await Promise.all([
    client.query<{
      awaiting_response: string;
      ready_to_send: string;
      expiring_soon: string;
      accepted_awaiting_conversion: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'sent')::text AS awaiting_response,
          COUNT(*) FILTER (WHERE status = 'ready_to_send')::text AS ready_to_send,
          COUNT(*) FILTER (
            WHERE status IN ('draft', 'needs_review', 'ready_to_send', 'sent')
              AND valid_until IS NOT NULL
              AND valid_until <= CURRENT_DATE + INTERVAL '7 days'
          )::text AS expiring_soon,
          COUNT(*) FILTER (WHERE status = 'accepted' AND converted_work_order_id IS NULL)::text AS accepted_awaiting_conversion
        FROM operations_quotes q
        JOIN operations_businesses b ON b.id = q.business_id
        WHERE b.internal_workspace_id = $1
      `,
      [workspaceId],
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_work_items i
        JOIN operations_work_orders w ON w.id = i.work_order_id
        JOIN operations_businesses b ON b.id = w.business_id
        WHERE b.internal_workspace_id = $1
          AND i.status NOT IN ('completed', 'cancelled')
      `,
      [workspaceId],
    ),
    client.query<{
      awaiting_access: string;
      blocked: string;
      ready_for_testing: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'awaiting_access')::text AS awaiting_access,
          COUNT(*) FILTER (WHERE status = 'blocked')::text AS blocked,
          COUNT(*) FILTER (WHERE status = 'ready_for_testing')::text AS ready_for_testing
        FROM operations_work_orders w
        JOIN operations_businesses b ON b.id = w.business_id
        WHERE b.internal_workspace_id = $1
      `,
      [workspaceId],
    ),
  ]);
  const quoteRow = quotes.rows[0];
  const workRow = workOrders.rows[0];
  return {
    quotesAwaitingResponse:
      Number.parseInt(quoteRow?.awaiting_response ?? "0", 10) || 0,
    quotesReadyToSend: Number.parseInt(quoteRow?.ready_to_send ?? "0", 10) || 0,
    quotesExpiringSoon:
      Number.parseInt(quoteRow?.expiring_soon ?? "0", 10) || 0,
    acceptedQuotesAwaitingConversion:
      Number.parseInt(quoteRow?.accepted_awaiting_conversion ?? "0", 10) || 0,
    openWorkItems: countValue(workItems.rows[0]),
    awaitingAccess: Number.parseInt(workRow?.awaiting_access ?? "0", 10) || 0,
    blockedWork: Number.parseInt(workRow?.blocked ?? "0", 10) || 0,
    workReadyForTesting:
      Number.parseInt(workRow?.ready_for_testing ?? "0", 10) || 0,
  };
}
