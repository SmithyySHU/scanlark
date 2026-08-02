import express from "express";
import type { Request, Response } from "express";
import {
  addOperationsBusinessNote,
  addOperationsContact,
  addOperationsQuoteAccessRequirement,
  addOperationsQuoteItem,
  addOperationsClientServiceSite,
  addOperationsWorkItem,
  addOperationsWorkOrderAccessRequirement,
  activateOperationsClientService,
  cancelOperationsCommunication,
  cancelOperationsClientService,
  cancelOperationsQuote,
  cancelOperationsTask,
  completeOperationsWorkOrder,
  completeOperationsTask,
  completeOperationsCommunicationFollowUp,
  convertOperationsQuoteToWorkOrder,
  createOperationsCommunication,
  createOperationsCommunicationTemplate,
  createOperationsClientService,
  createOperationsClientServiceUsage,
  createOperationsServiceMonthlyReport,
  createOperationsServicePlan,
  createOperationsTask,
  createOperationsBusiness,
  createOperationsQuote,
  createOperationsQuoteServiceItem,
  createOperationsReport,
  createOperationsReportRetest,
  deleteOperationsBusiness,
  deleteOperationsQuoteAccessRequirement,
  deleteOperationsQuoteItem,
  deleteOperationsClientServiceUsage,
  deleteOperationsReport,
  deleteOperationsWorkOrderAccessRequirement,
  deleteOperationsContact,
  duplicateOperationsServicePlan,
  duplicateOperationsQuote,
  duplicateOperationsReport,
  bulkUpdateOperationsReportFindings,
  freezeOperationsReportRender,
  freezeOperationsQuoteRender,
  getOperationsCommunication,
  getOperationsCommunicationDraftContext,
  getOperationsCommunicationTemplate,
  getOperationsBusinessDetail,
  getOperationsQuoteDetail,
  getOperationsQuotePreview,
  getOperationsReportDetail,
  getOperationsReportPdfRender,
  getOperationsReportPreview,
  getOperationsClientServiceDetail,
  getOperationsServicePlan,
  getOperationsServiceSchedule,
  getOperationsSummary,
  getOperationsWorkOrderDetail,
  generateOperationsServiceTasks,
  linkOperationsBusinessSite,
  listOperationsClientServices,
  listOperationsClientServiceUsage,
  listOperationsCommunicationTemplates,
  listOperationsCommunications,
  listOperationsAvailableSites,
  listOperationsBusinesses,
  listOperationsPipeline,
  listOperationsQuotes,
  listOperationsQuoteServiceItems,
  listOperationsReportableScanRuns,
  listOperationsReports,
  listOperationsServicePlans,
  listOperationsTasks,
  listOperationsWorkOrders,
  markOperationsCommunicationReceived,
  markOperationsCommunicationSent,
  markOperationsQuoteExpired,
  markOperationsQuoteReady,
  markOperationsServiceReviewComplete,
  markOperationsReportStatus,
  recordOperationsQuoteAccepted,
  recordOperationsQuoteDeclined,
  recordOperationsQuoteSent,
  recordOperationsReportSent,
  reorderOperationsQuoteItems,
  reorderOperationsReportFindings,
  reorderOperationsWorkItems,
  renewOperationsClientService,
  removeOperationsClientServiceSite,
  requestOperationsClientServiceCancellation,
  resumeOperationsClientService,
  setOperationsClientServiceArchived,
  setOperationsCommunicationTemplateActive,
  setOperationsBusinessArchived,
  setOperationsContactArchived,
  setOperationsReportArchived,
  saveOperationsReportPdfRender,
  setOperationsServicePlanArchived,
  setPrimaryOperationsContact,
  snoozeOperationsTask,
  unlinkOperationsBusinessSite,
  updateOperationsBusiness,
  updateOperationsCommunication,
  updateOperationsCommunicationTemplate,
  updateOperationsClientService,
  updateOperationsClientServiceSite,
  updateOperationsClientServiceUsage,
  updateOperationsQuote,
  updateOperationsQuoteAccessRequirement,
  updateOperationsQuoteItem,
  updateOperationsQuoteServiceItem,
  updateOperationsReport,
  updateOperationsReportActionPlanItem,
  updateOperationsReportComparisonItem,
  updateOperationsReportFinding,
  updateOperationsReportPositiveObservation,
  updateOperationsWorkItem,
  updateOperationsWorkOrder,
  updateOperationsWorkOrderAccessRequirement,
  updateOperationsServicePlan,
  changeOperationsClientServicePlan,
  pauseOperationsClientService,
  proposeOperationsClientService,
  updateOperationsTask,
  updateOperationsContact,
  type AdminActor,
  type OperationsBusinessInput,
  type OperationsClientServiceStatus,
  type OperationsCommunicationInput,
  type OperationsCommunicationListOptions,
  type OperationsCommunicationTemplateCategory,
  type OperationsCommunicationTemplateRow,
  type OperationsContactInput,
  type OperationsReportListParams,
  type OperationsServiceBillingCadence,
  type OperationsServicePlanType,
  type OperationsTaskStatus,
} from "@scanlark/db";
import { adminGuard } from "../adminAccess";
import {
  operationsReportPdfFilename,
  renderOperationsReportPdf,
} from "../operationsReportPdf";
import {
  OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES,
  addBusinessDays,
  getConfiguredDefaultFollowUpBusinessDays,
  OPERATIONS_TASK_STATUSES,
  SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS,
  findUnresolvedClientCommunicationPlaceholders,
  parseOperationsBusinessInput,
  parseOperationsCommunicationInput,
  parseOperationsCommunicationTemplateInput,
  parseOperationsContactInput,
  parseOperationsClientServiceActivationInput,
  parseOperationsClientServiceInput,
  parseOperationsClientServiceReviewInput,
  parseOperationsClientServiceSiteInput,
  parseOperationsClientServiceStatus,
  parseOperationsClientServiceTransitionInput,
  parseOperationsClientServiceUsageInput,
  parseOperationsAccessRequirementInput,
  parseOperationsQuoteAcceptedInput,
  parseOperationsQuoteCreateInput,
  parseOperationsQuoteDeclinedInput,
  parseOperationsQuoteItemInput,
  parseOperationsQuoteSentInput,
  parseOperationsQuoteStatus,
  parseOperationsQuoteUpdateInput,
  parseOperationsReportClientPriority,
  parseOperationsReportActionPlanItemUpdateInput,
  parseOperationsReportComparisonStatus,
  parseOperationsReportComparisonUpdateInput,
  parseOperationsReportCreateInput,
  parseOperationsReportFindingBulkInput,
  parseOperationsReportFindingUpdateInput,
  parseOperationsReportPositiveObservationUpdateInput,
  parseOperationsReportRetestInput,
  parseOperationsReportSentInput,
  parseOperationsReportStatus,
  parseOperationsReportType,
  parseOperationsReportUpdateInput,
  parseOperationsServiceItemInput,
  parseOperationsServiceBillingCadence,
  parseOperationsServicePlanInput,
  parseOperationsServicePlanType,
  parseOperationsTaskInput,
  parseOperationsWorkItemInput,
  parseOperationsWorkItemStatus,
  parseOperationsWorkOrderPriority,
  parseOperationsWorkOrderStatus,
  parseOperationsWorkOrderUpdateInput,
  optionalTextField,
  optionalUuidField,
  parseDateField,
  parsePipelineStage,
  parseRelationshipType,
  parseRequiredDateField,
  renderClientCommunicationTemplate,
  serializeDate,
  serializeOperationsSummary,
  textField,
} from "../operationsHelpers";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TASK_STATUS_SET = new Set<string>(OPERATIONS_TASK_STATUSES);
const SORT_SET = new Set(["name", "updated_desc", "next_follow_up"]);

function serializeObject(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        serializeObject(inner),
      ]),
    );
  }
  return value;
}

function sendApiError(
  res: Response,
  status: number,
  error: string,
  message: string,
  details?: Record<string, unknown>,
) {
  return res.status(status).json({ error, message, ...(details ?? {}) });
}

function getActor(req: Request): AdminActor {
  if (!req.user) throw new Error("admin_actor_missing");
  return { id: req.user.id, email: req.user.email };
}

function getUuidParam(req: Request, res: Response, key: string) {
  const value = req.params[key];
  if (!value || !UUID_RE.test(value)) {
    sendApiError(res, 404, "not_found", "Record not found");
    return null;
  }
  return value;
}

function getSenderDefaults() {
  return {
    senderName: process.env.OPERATIONS_SENDER_NAME ?? "",
    senderEmail: process.env.OPERATIONS_SENDER_EMAIL ?? "",
  };
}

function parsePagination(req: Request) {
  const rawLimit = typeof req.query.limit === "string" ? req.query.limit : "";
  const rawOffset =
    typeof req.query.offset === "string" ? req.query.offset : "";
  const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : DEFAULT_LIMIT;
  const parsedOffset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;
  return { limit, offset };
}

function parseQueryDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_date");
  return date;
}

function parseCommunicationListOptions(
  req: Request,
): OperationsCommunicationListOptions {
  const status =
    typeof req.query.status === "string" &&
    ["draft", "ready", "sent", "received", "cancelled"].includes(
      req.query.status,
    )
      ? (req.query.status as OperationsCommunicationListOptions["status"])
      : null;
  const direction =
    typeof req.query.direction === "string" &&
    ["outbound", "inbound", "internal_note"].includes(req.query.direction)
      ? (req.query.direction as OperationsCommunicationListOptions["direction"])
      : null;
  const channel =
    typeof req.query.channel === "string" &&
    ["email", "phone", "video_call", "in_person", "other"].includes(
      req.query.channel,
    )
      ? (req.query.channel as OperationsCommunicationListOptions["channel"])
      : null;
  const templateCategory =
    typeof req.query.templateCategory === "string" &&
    OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES.includes(
      req.query.templateCategory as OperationsCommunicationTemplateCategory,
    )
      ? (req.query.templateCategory as OperationsCommunicationTemplateCategory)
      : null;
  return {
    ...parsePagination(req),
    businessId:
      typeof req.query.businessId === "string" ? req.query.businessId : null,
    contactId:
      typeof req.query.contactId === "string" ? req.query.contactId : null,
    direction,
    channel,
    status,
    templateCategory,
    dateFrom: parseQueryDate(req.query.dateFrom),
    dateTo: parseQueryDate(req.query.dateTo),
    followUpDue: req.query.followUpDue === "true",
    search: typeof req.query.search === "string" ? req.query.search : null,
  };
}

function parseReportListOptions(req: Request): OperationsReportListParams {
  const status =
    typeof req.query.status === "string"
      ? parseOperationsReportStatus(req.query.status)
      : null;
  const reportType =
    typeof req.query.reportType === "string"
      ? parseOperationsReportType(req.query.reportType)
      : null;
  if (typeof req.query.status === "string" && !status) {
    throw new Error("invalid_report_status");
  }
  if (typeof req.query.reportType === "string" && !reportType) {
    throw new Error("invalid_report_type");
  }
  const archived =
    req.query.archived === "true"
      ? true
      : req.query.archived === "false"
        ? false
        : null;
  return {
    ...parsePagination(req),
    search: typeof req.query.search === "string" ? req.query.search : null,
    status,
    reportType,
    businessId:
      typeof req.query.businessId === "string" ? req.query.businessId : null,
    siteId: typeof req.query.siteId === "string" ? req.query.siteId : null,
    dateFrom: parseQueryDate(req.query.dateFrom),
    dateTo: parseQueryDate(req.query.dateTo),
    awaitingFollowUp: req.query.awaitingFollowUp === "true",
    archived,
  };
}

function parseQuoteListOptions(req: Request) {
  const status =
    typeof req.query.status === "string"
      ? parseOperationsQuoteStatus(req.query.status)
      : null;
  if (typeof req.query.status === "string" && !status) {
    throw new Error("invalid_quote_status");
  }
  return {
    ...parsePagination(req),
    businessId:
      typeof req.query.businessId === "string" ? req.query.businessId : null,
    operationsReportId:
      typeof req.query.operationsReportId === "string"
        ? req.query.operationsReportId
        : null,
    status,
    search: typeof req.query.search === "string" ? req.query.search : null,
    archived:
      req.query.archived === "true"
        ? true
        : req.query.archived === "false"
          ? false
          : null,
  };
}

function parseWorkOrderListOptions(req: Request) {
  const status =
    typeof req.query.status === "string"
      ? parseOperationsWorkOrderStatus(req.query.status)
      : null;
  const priority =
    typeof req.query.priority === "string"
      ? parseOperationsWorkOrderPriority(req.query.priority)
      : null;
  if (typeof req.query.status === "string" && !status) {
    throw new Error("invalid_work_order_status");
  }
  if (typeof req.query.priority === "string" && !priority) {
    throw new Error("invalid_work_order_priority");
  }
  return {
    ...parsePagination(req),
    businessId:
      typeof req.query.businessId === "string" ? req.query.businessId : null,
    operationsReportId:
      typeof req.query.operationsReportId === "string"
        ? req.query.operationsReportId
        : null,
    quoteId: typeof req.query.quoteId === "string" ? req.query.quoteId : null,
    status,
    priority,
    search: typeof req.query.search === "string" ? req.query.search : null,
    overdue: req.query.overdue === "true",
  };
}

function parseServicePlanListOptions(req: Request) {
  return {
    ...parsePagination(req),
    activeOnly: req.query.activeOnly === "true",
    includeArchived: req.query.includeArchived === "true",
    search: typeof req.query.search === "string" ? req.query.search : null,
  };
}

function parseClientServiceListOptions(req: Request) {
  const status =
    typeof req.query.status === "string"
      ? parseOperationsClientServiceStatus(req.query.status)
      : null;
  const planType =
    typeof req.query.planType === "string"
      ? parseOperationsServicePlanType(req.query.planType)
      : null;
  const billingCadence =
    typeof req.query.billingCadence === "string"
      ? parseOperationsServiceBillingCadence(req.query.billingCadence)
      : null;
  if (typeof req.query.status === "string" && !status) {
    throw new Error("invalid_service_status");
  }
  if (typeof req.query.planType === "string" && !planType) {
    throw new Error("invalid_plan_type");
  }
  if (typeof req.query.billingCadence === "string" && !billingCadence) {
    throw new Error("invalid_billing_cadence");
  }
  return {
    ...parsePagination(req),
    businessId:
      typeof req.query.businessId === "string" ? req.query.businessId : null,
    status: status as OperationsClientServiceStatus | null,
    planType: planType as OperationsServicePlanType | null,
    billingCadence: billingCadence as OperationsServiceBillingCadence | null,
    search: typeof req.query.search === "string" ? req.query.search : null,
    reportsDue: req.query.reportsDue === "true",
    reviewsDue: req.query.reviewsDue === "true",
    renewalsApproaching: req.query.renewalsApproaching === "true",
    siteAttention: req.query.siteAttention === "true",
    includeEnded: req.query.includeEnded === "true",
  };
}

async function getCommunicationOr404(res: Response, communicationId: string) {
  const communication = await getOperationsCommunication(communicationId);
  if (!communication) {
    sendApiError(res, 404, "not_found", "Communication not found");
    return null;
  }
  return communication;
}

function assertCommunicationCanTransition(input: {
  status?: string | null;
  subject?: string | null;
  body?: string | null;
  allowUnresolvedOverride?: boolean;
  overrideReason?: string | null;
}) {
  if (input.status !== "ready" && input.status !== "sent") return;
  const unresolved = findUnresolvedClientCommunicationPlaceholders({
    subject: input.subject,
    body: input.body,
  });
  if (
    unresolved.length > 0 &&
    !(
      input.status === "sent" &&
      input.allowUnresolvedOverride === true &&
      input.overrideReason?.trim()
    )
  ) {
    throw new Error("unresolved_communication_placeholders");
  }
}

function suggestedFollowUpDateForTemplate(
  template: OperationsCommunicationTemplateRow,
) {
  const days =
    template.default_follow_up_business_days ??
    getConfiguredDefaultFollowUpBusinessDays(template.category);
  if (days == null) return null;
  return addBusinessDays(new Date(), days);
}

function groupTasks(tasks: Array<{ due_at: Date; completed_at: Date | null }>) {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  return {
    overdue: tasks.filter(
      (task) => !task.completed_at && task.due_at < startOfToday,
    ),
    today: tasks.filter(
      (task) =>
        !task.completed_at &&
        task.due_at >= startOfToday &&
        task.due_at < startOfTomorrow,
    ),
    upcoming: tasks.filter(
      (task) => !task.completed_at && task.due_at >= startOfTomorrow,
    ),
    completedRecently: tasks.filter((task) => task.completed_at),
  };
}

function serializeOperationsBusinessDetail(
  detail: Awaited<ReturnType<typeof getOperationsBusinessDetail>>,
) {
  return serializeObject(detail);
}

function handleValidationError(res: Response, err: unknown) {
  const message = err instanceof Error ? err.message : "invalid_request";
  if (message === "business_name_required") {
    return sendApiError(
      res,
      400,
      "business_name_required",
      "Business name is required",
    );
  }
  if (message === "invalid_pipeline_stage") {
    return sendApiError(
      res,
      400,
      "invalid_pipeline_stage",
      "Pipeline stage is invalid",
    );
  }
  if (message === "invalid_relationship_type") {
    return sendApiError(
      res,
      400,
      "invalid_relationship_type",
      "Relationship type is invalid",
    );
  }
  if (message === "invalid_email" || message === "invalid_contact_email") {
    return sendApiError(res, 400, message, "Email address is invalid");
  }
  if (
    message === "empty_url" ||
    message === "invalid_url" ||
    message === "unsupported_protocol" ||
    message === "invalid_hostname"
  ) {
    return sendApiError(
      res,
      400,
      "invalid_website_url",
      "Website URL is invalid",
    );
  }
  if (message.endsWith("_invalid")) {
    return sendApiError(res, 400, message, "Date value is invalid");
  }
  if (message === "contact_details_required") {
    return sendApiError(
      res,
      400,
      "contact_details_required",
      "Add a contact name, email, or phone number",
    );
  }
  if (message === "note_body_required") {
    return sendApiError(
      res,
      400,
      "note_body_required",
      "Note body is required",
    );
  }
  if (
    message === "invalid_template_category" ||
    message === "invalid_communication_direction" ||
    message === "invalid_communication_channel" ||
    message === "invalid_communication_status" ||
    message === "invalid_communication_placeholder_syntax" ||
    message === "invalid_task_status" ||
    message === "invalid_preferred_channel" ||
    message === "invalid_default_follow_up_business_days"
  ) {
    return sendApiError(res, 400, message, "Request value is invalid");
  }
  if (message === "unresolved_communication_placeholders") {
    return sendApiError(
      res,
      400,
      "unresolved_communication_placeholders",
      "Resolve unresolved placeholders before this communication can be marked ready or sent.",
    );
  }
  if (message === "communication_sent_locked") {
    return sendApiError(
      res,
      409,
      "communication_sent_locked",
      "Sent or received communications cannot be silently rewritten.",
    );
  }
  if (message === "invalid_date") {
    return sendApiError(res, 400, message, "Date value is invalid");
  }
  if (message === "invalid_currency") {
    return sendApiError(
      res,
      400,
      "invalid_currency",
      "Select a valid currency.",
    );
  }
  if (message === "title_required") {
    return sendApiError(res, 400, "title_required", "Enter a quote title.");
  }
  if (message === "scopeSummary_required") {
    return sendApiError(
      res,
      400,
      "scopeSummary_required",
      "Enter a scope summary.",
    );
  }
  if (message === "invalid_unitPrice" || message === "invalid_unitPriceMinor") {
    return sendApiError(res, 400, message, "Enter a valid unit price.");
  }
  if (message === "unsafe_html") {
    return sendApiError(
      res,
      400,
      "unsafe_html",
      "Report text must be plain text",
    );
  }
  if (message.endsWith("_too_long")) {
    return sendApiError(res, 400, message, "Report text is too long");
  }
  if (
    message.startsWith("invalid_") ||
    message === "template_name_required" ||
    message === "template_subject_required" ||
    message === "template_body_required" ||
    message === "communication_body_required" ||
    message === "task_title_required" ||
    message.endsWith("_required")
  ) {
    return sendApiError(res, 400, message, "Required request value is invalid");
  }
  return null;
}

export function mountOperationsRoutes(app: express.Application) {
  const router = express.Router();
  router.use(adminGuard);

  router.get("/summary", async (_req, res) => {
    try {
      const summary = await getOperationsSummary();
      return res.json(serializeOperationsSummary(summary));
    } catch (err) {
      console.error("Operations summary failed", err);
      return res.status(500).json({ error: "operations_summary_failed" });
    }
  });

  router.get("/pipeline", async (_req, res) => {
    try {
      return res.json(serializeObject(await listOperationsPipeline()));
    } catch (err) {
      console.error("Operations pipeline failed", err);
      return sendApiError(
        res,
        500,
        "operations_pipeline_failed",
        "Failed to load pipeline",
      );
    }
  });

  router.get("/sites", async (req, res) => {
    try {
      const search =
        typeof req.query.search === "string" ? req.query.search : null;
      return res.json({
        sites: await listOperationsAvailableSites({
          search,
          limit: 100,
        }),
      });
    } catch (err) {
      console.error("Operations sites failed", err);
      return sendApiError(
        res,
        500,
        "operations_sites_failed",
        "Failed to load available sites",
      );
    }
  });

  router.get("/service-plans", async (req, res) => {
    try {
      return res.json(
        serializeObject(
          await listOperationsServicePlans(parseServicePlanListOptions(req)),
        ),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service plans failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_plans_failed",
        "Failed to load service plans",
      );
    }
  });

  router.post("/service-plans", async (req, res) => {
    try {
      const servicePlan = await createOperationsServicePlan(
        getActor(req),
        parseOperationsServicePlanInput(req.body),
      );
      return res
        .status(201)
        .json({ servicePlan: serializeObject(servicePlan) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service plan create failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_plan_create_failed",
        "Failed to create service plan",
      );
    }
  });

  router.get("/service-plans/:planId", async (req, res) => {
    const planId = getUuidParam(req, res, "planId");
    if (!planId) return;
    const servicePlan = await getOperationsServicePlan(planId);
    if (!servicePlan) {
      return sendApiError(res, 404, "not_found", "Service plan not found");
    }
    return res.json({ servicePlan: serializeObject(servicePlan) });
  });

  router.patch("/service-plans/:planId", async (req, res) => {
    const planId = getUuidParam(req, res, "planId");
    if (!planId) return;
    try {
      const servicePlan = await updateOperationsServicePlan(
        getActor(req),
        planId,
        parseOperationsServicePlanInput(req.body, { partial: true }),
      );
      if (!servicePlan) {
        return sendApiError(res, 404, "not_found", "Service plan not found");
      }
      return res.json({ servicePlan: serializeObject(servicePlan) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service plan update failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_plan_update_failed",
        "Failed to update service plan",
      );
    }
  });

  router.post("/service-plans/:planId/duplicate", async (req, res) => {
    const planId = getUuidParam(req, res, "planId");
    if (!planId) return;
    const servicePlan = await duplicateOperationsServicePlan(
      getActor(req),
      planId,
    );
    if (!servicePlan) {
      return sendApiError(res, 404, "not_found", "Service plan not found");
    }
    return res.status(201).json({ servicePlan: serializeObject(servicePlan) });
  });

  router.post("/service-plans/:planId/archive", async (req, res) => {
    const planId = getUuidParam(req, res, "planId");
    if (!planId) return;
    const servicePlan = await setOperationsServicePlanArchived(
      getActor(req),
      planId,
      true,
    );
    if (!servicePlan) {
      return sendApiError(res, 404, "not_found", "Service plan not found");
    }
    return res.json({ servicePlan: serializeObject(servicePlan) });
  });

  router.post("/service-plans/:planId/restore", async (req, res) => {
    const planId = getUuidParam(req, res, "planId");
    if (!planId) return;
    const servicePlan = await setOperationsServicePlanArchived(
      getActor(req),
      planId,
      false,
    );
    if (!servicePlan) {
      return sendApiError(res, 404, "not_found", "Service plan not found");
    }
    return res.json({ servicePlan: serializeObject(servicePlan) });
  });

  router.get("/services", async (req, res) => {
    try {
      return res.json(
        serializeObject(
          await listOperationsClientServices(
            parseClientServiceListOptions(req),
          ),
        ),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations services failed", err);
      return sendApiError(
        res,
        500,
        "operations_services_failed",
        "Failed to load services",
      );
    }
  });

  router.post("/services", async (req, res) => {
    try {
      const service = await createOperationsClientService(
        getActor(req),
        parseOperationsClientServiceInput(req.body) as Parameters<
          typeof createOperationsClientService
        >[1],
      );
      if (typeof service === "string") {
        return sendApiError(
          res,
          400,
          service,
          "Related service record is invalid",
        );
      }
      return res.status(201).json({ service: serializeObject(service) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service create failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_create_failed",
        "Failed to create service",
      );
    }
  });

  router.get("/services/:serviceId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    const service = await getOperationsClientServiceDetail(serviceId);
    if (!service) {
      return sendApiError(res, 404, "not_found", "Service not found");
    }
    return res.json({ service: serializeObject(service) });
  });

  router.patch("/services/:serviceId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const service = await updateOperationsClientService(
        getActor(req),
        serviceId,
        parseOperationsClientServiceInput(req.body, {
          partial: true,
        }) as Parameters<typeof updateOperationsClientService>[2],
      );
      if (!service) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      if (typeof service === "string") {
        return sendApiError(
          res,
          400,
          service,
          "Related service record is invalid",
        );
      }
      return res.json({ service: serializeObject(service) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service update failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_update_failed",
        "Failed to update service",
      );
    }
  });

  router.post("/services/:serviceId/archive", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const result = await setOperationsClientServiceArchived(
        getActor(req),
        serviceId,
        true,
      );
      if (!result) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      if ("allowed" in result && result.allowed === false) {
        return sendApiError(
          res,
          409,
          "service_archive_blocked",
          "Managed service has operational history and cannot be archived as an unused draft",
          {
            reasons: result.reasons,
            dependencyCounts: result.dependencyCounts,
          },
        );
      }
      return res.json({ service: serializeObject(result) });
    } catch (err) {
      console.error("Operations service archive failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_archive_failed",
        "Failed to archive service",
      );
    }
  });

  router.post("/services/:serviceId/restore", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const service = await setOperationsClientServiceArchived(
        getActor(req),
        serviceId,
        false,
      );
      if (!service) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      return res.json({ service: serializeObject(service) });
    } catch (err) {
      console.error("Operations service restore failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_restore_failed",
        "Failed to restore service",
      );
    }
  });

  const serviceAction = (
    path: string,
    handler: (
      actor: ReturnType<typeof getActor>,
      serviceId: string,
      body: unknown,
    ) => Promise<unknown>,
  ) => {
    router.post(path, async (req, res) => {
      const serviceId = getUuidParam(req, res, "serviceId");
      if (!serviceId) return;
      try {
        const result = await handler(getActor(req), serviceId, req.body);
        if (!result) {
          return sendApiError(res, 404, "not_found", "Service not found");
        }
        if (
          typeof result === "object" &&
          result &&
          "activationIssues" in result
        ) {
          return sendApiError(
            res,
            400,
            "service_activation_blocked",
            "Service is not ready for this action",
            { activationIssues: result.activationIssues },
          );
        }
        if (typeof result === "string") {
          return sendApiError(res, 400, result, "Service action is invalid");
        }
        return res.json({ service: serializeObject(result) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error(`Operations service action failed: ${path}`, err);
        return sendApiError(
          res,
          500,
          "operations_service_action_failed",
          "Failed to update service",
        );
      }
    });
  };

  serviceAction("/services/:serviceId/propose", (actor, serviceId, body) =>
    proposeOperationsClientService(
      actor,
      serviceId,
      parseOperationsClientServiceTransitionInput(body),
    ),
  );
  serviceAction("/services/:serviceId/activate", (actor, serviceId, body) =>
    activateOperationsClientService(
      actor,
      serviceId,
      parseOperationsClientServiceActivationInput(body),
    ),
  );
  serviceAction("/services/:serviceId/pause", (actor, serviceId, body) =>
    pauseOperationsClientService(
      actor,
      serviceId,
      parseOperationsClientServiceTransitionInput(body),
    ),
  );
  serviceAction("/services/:serviceId/resume", (actor, serviceId) =>
    resumeOperationsClientService(actor, serviceId),
  );
  serviceAction(
    "/services/:serviceId/request-cancellation",
    (actor, serviceId, body) =>
      requestOperationsClientServiceCancellation(
        actor,
        serviceId,
        parseOperationsClientServiceTransitionInput(body),
      ),
  );
  serviceAction("/services/:serviceId/cancel", (actor, serviceId, body) =>
    cancelOperationsClientService(
      actor,
      serviceId,
      parseOperationsClientServiceTransitionInput(body),
    ),
  );
  serviceAction("/services/:serviceId/renew", (actor, serviceId, body) => {
    const record = body && typeof body === "object" ? body : {};
    return renewOperationsClientService(actor, serviceId, {
      renewalDate: parseDateField(
        record as Record<string, unknown>,
        "renewalDate",
      ),
      nextReviewAt: parseDateField(
        record as Record<string, unknown>,
        "nextReviewAt",
      ),
      reason: optionalTextField(record as Record<string, unknown>, "reason"),
    });
  });
  serviceAction(
    "/services/:serviceId/change-plan",
    (actor, serviceId, body) => {
      const record = body && typeof body === "object" ? body : {};
      return changeOperationsClientServicePlan(actor, serviceId, {
        servicePlanId: optionalUuidField(
          record as Record<string, unknown>,
          "servicePlanId",
        ),
        effectiveDate: parseRequiredDateField(
          record as Record<string, unknown>,
          "effectiveDate",
        ),
        changeSummary:
          textField(record as Record<string, unknown>, "changeSummary") ?? "",
        reason: optionalTextField(record as Record<string, unknown>, "reason"),
        clientAgreed: (record as Record<string, unknown>).clientAgreed === true,
      });
    },
  );
  serviceAction(
    "/services/:serviceId/mark-review-complete",
    (actor, serviceId, body) =>
      markOperationsServiceReviewComplete(
        actor,
        serviceId,
        parseOperationsClientServiceReviewInput(body),
      ),
  );

  router.post("/services/:serviceId/run-review", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const review = await markOperationsServiceReviewComplete(
        getActor(req),
        serviceId,
        parseOperationsClientServiceReviewInput(req.body),
      );
      if (!review) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      return res.status(201).json({ serviceReview: serializeObject(review) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service review failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_review_failed",
        "Failed to record service review",
      );
    }
  });

  router.post("/services/:serviceId/sites", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const serviceSite = await addOperationsClientServiceSite(
        getActor(req),
        serviceId,
        parseOperationsClientServiceSiteInput(req.body),
      );
      if (!serviceSite) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      if (serviceSite === "site_not_linked_to_business") {
        return sendApiError(
          res,
          400,
          "site_not_linked_to_business",
          "Site is not linked to this business",
        );
      }
      if (serviceSite === "duplicate_service_site") {
        return sendApiError(
          res,
          409,
          "duplicate_service_site",
          "Site is already covered by this service",
        );
      }
      return res
        .status(201)
        .json({ serviceSite: serializeObject(serviceSite) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service site add failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_site_add_failed",
        "Failed to add service site",
      );
    }
  });

  router.patch("/services/:serviceId/sites/:siteId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    const siteId = getUuidParam(req, res, "siteId");
    if (!serviceId || !siteId) return;
    try {
      const serviceSite = await updateOperationsClientServiceSite(
        getActor(req),
        serviceId,
        siteId,
        parseOperationsClientServiceSiteInput(req.body, { partial: true }),
      );
      if (!serviceSite) {
        return sendApiError(res, 404, "not_found", "Service site not found");
      }
      return res.json({ serviceSite: serializeObject(serviceSite) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service site update failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_site_update_failed",
        "Failed to update service site",
      );
    }
  });

  router.delete("/services/:serviceId/sites/:siteId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    const siteId = getUuidParam(req, res, "siteId");
    if (!serviceId || !siteId) return;
    const serviceSite = await removeOperationsClientServiceSite(
      getActor(req),
      serviceId,
      siteId,
      typeof req.query.reason === "string" ? req.query.reason : null,
    );
    if (!serviceSite) {
      return sendApiError(res, 404, "not_found", "Service site not found");
    }
    return res.json({ serviceSite: serializeObject(serviceSite) });
  });

  router.get("/services/:serviceId/usage", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    return res.json({
      usage: serializeObject(await listOperationsClientServiceUsage(serviceId)),
    });
  });

  router.post("/services/:serviceId/usage", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const usage = await createOperationsClientServiceUsage(
        getActor(req),
        serviceId,
        parseOperationsClientServiceUsageInput(req.body),
      );
      if (!usage) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      return res.status(201).json({ usage: serializeObject(usage) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service usage create failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_usage_create_failed",
        "Failed to record service usage",
      );
    }
  });

  router.patch("/services/:serviceId/usage/:usageId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    const usageId = getUuidParam(req, res, "usageId");
    if (!serviceId || !usageId) return;
    try {
      const usage = await updateOperationsClientServiceUsage(
        getActor(req),
        serviceId,
        usageId,
        parseOperationsClientServiceUsageInput(req.body, { partial: true }),
      );
      if (!usage) {
        return sendApiError(res, 404, "not_found", "Usage record not found");
      }
      return res.json({ usage: serializeObject(usage) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service usage update failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_usage_update_failed",
        "Failed to update service usage",
      );
    }
  });

  router.delete("/services/:serviceId/usage/:usageId", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    const usageId = getUuidParam(req, res, "usageId");
    if (!serviceId || !usageId) return;
    const usage = await deleteOperationsClientServiceUsage(
      getActor(req),
      serviceId,
      usageId,
    );
    if (!usage) {
      return sendApiError(res, 404, "not_found", "Usage record not found");
    }
    return res.json({ usage: serializeObject(usage) });
  });

  router.get("/services/:serviceId/schedule", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    const schedule = await getOperationsServiceSchedule(serviceId);
    if (!schedule) {
      return sendApiError(res, 404, "not_found", "Service not found");
    }
    return res.json({ schedule: serializeObject(schedule) });
  });

  router.post("/services/:serviceId/generate-tasks", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    const result = await generateOperationsServiceTasks(
      getActor(req),
      serviceId,
    );
    if (!result) {
      return sendApiError(res, 404, "not_found", "Service not found");
    }
    return res.json(result);
  });

  router.post("/services/:serviceId/create-report", async (req, res) => {
    const serviceId = getUuidParam(req, res, "serviceId");
    if (!serviceId) return;
    try {
      const record = req.body && typeof req.body === "object" ? req.body : {};
      const report = await createOperationsServiceMonthlyReport(
        getActor(req),
        serviceId,
        {
          siteId: optionalUuidField(
            record as Record<string, unknown>,
            "siteId",
          ),
          title: optionalTextField(record as Record<string, unknown>, "title"),
          periodStart: parseDateField(
            record as Record<string, unknown>,
            "periodStart",
          ),
          periodEnd: parseDateField(
            record as Record<string, unknown>,
            "periodEnd",
          ),
        },
      );
      if (!report) {
        return sendApiError(res, 404, "not_found", "Service not found");
      }
      if (typeof report === "string") {
        return sendApiError(
          res,
          400,
          report,
          "Unable to create service report",
        );
      }
      return res.status(201).json({ report: serializeObject(report) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations service report create failed", err);
      return sendApiError(
        res,
        500,
        "operations_service_report_create_failed",
        "Failed to create service report",
      );
    }
  });

  router.get("/quotes/service-items", async (req, res) => {
    try {
      return res.json({
        serviceItems: serializeObject(
          await listOperationsQuoteServiceItems(
            req.query.activeOnly === "true",
          ),
        ),
      });
    } catch (err) {
      console.error("Operations quote service items failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_service_items_failed",
        "Failed to load service items",
      );
    }
  });

  router.post("/quotes/service-items", async (req, res) => {
    try {
      const item = await createOperationsQuoteServiceItem(
        getActor(req),
        parseOperationsServiceItemInput(req.body),
      );
      return res.status(201).json({ serviceItem: serializeObject(item) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote service item create failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_service_item_create_failed",
        "Failed to create service item",
      );
    }
  });

  router.patch("/quotes/service-items/:serviceItemId", async (req, res) => {
    const serviceItemId = getUuidParam(req, res, "serviceItemId");
    if (!serviceItemId) return;
    try {
      const item = await updateOperationsQuoteServiceItem(
        getActor(req),
        serviceItemId,
        parseOperationsServiceItemInput(req.body, { partial: true }),
      );
      if (!item)
        return sendApiError(res, 404, "not_found", "Service item not found");
      return res.json({ serviceItem: serializeObject(item) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote service item update failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_service_item_update_failed",
        "Failed to update service item",
      );
    }
  });

  router.get("/quotes", async (req, res) => {
    try {
      return res.json(
        serializeObject(await listOperationsQuotes(parseQuoteListOptions(req))),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quotes failed", err);
      return sendApiError(
        res,
        500,
        "operations_quotes_failed",
        "Failed to load quotes",
      );
    }
  });

  router.post("/quotes", async (req, res) => {
    try {
      const result = await createOperationsQuote(
        getActor(req),
        parseOperationsQuoteCreateInput(req.body),
      );
      if (result === "business_not_found") {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if (result === "contact_not_found") {
        return sendApiError(
          res,
          400,
          "contact_not_found",
          "This contact does not belong to the selected business.",
        );
      }
      if (result === "report_not_found") {
        return sendApiError(res, 404, "not_found", "Report not found");
      }
      if (result === "finding_not_found") {
        return sendApiError(res, 404, "not_found", "Finding not found");
      }
      return res.status(201).json({ quote: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote create failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_create_failed",
        "Failed to create quote",
      );
    }
  });

  router.get("/quotes/:quoteId", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const quote = await getOperationsQuoteDetail(quoteId);
      if (!quote) return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(quote) });
    } catch (err) {
      console.error("Operations quote detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_failed",
        "Failed to load quote",
      );
    }
  });

  router.patch("/quotes/:quoteId", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await updateOperationsQuote(
        getActor(req),
        quoteId,
        parseOperationsQuoteUpdateInput(req.body),
      );
      if (result === "quote_locked") {
        return sendApiError(
          res,
          409,
          "quote_locked",
          "Accepted or closed quotes cannot be edited",
        );
      }
      if (
        result === "contact_not_found" ||
        result === "report_not_found" ||
        result === "business_not_found"
      ) {
        return sendApiError(res, 404, "not_found", "Related record not found");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote update failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_update_failed",
        "Failed to update quote",
      );
    }
  });

  router.post("/quotes/:quoteId/duplicate", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const quote = await duplicateOperationsQuote(getActor(req), quoteId);
      if (!quote) return sendApiError(res, 404, "not_found", "Quote not found");
      return res.status(201).json({ quote: serializeObject(quote) });
    } catch (err) {
      console.error("Operations quote duplicate failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_duplicate_failed",
        "Failed to duplicate quote",
      );
    }
  });

  router.post("/quotes/:quoteId/cancel", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    try {
      const quote = await cancelOperationsQuote(
        getActor(req),
        quoteId,
        optionalTextField(body as Record<string, unknown>, "reason"),
      );
      if (!quote) return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(quote) });
    } catch (err) {
      console.error("Operations quote cancel failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_cancel_failed",
        "Failed to cancel quote",
      );
    }
  });

  router.post("/quotes/:quoteId/mark-ready", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await markOperationsQuoteReady(getActor(req), quoteId);
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      if (typeof result === "object" && "readinessIssues" in result) {
        return sendApiError(
          res,
          400,
          "quote_not_ready",
          "Quote is not ready to send",
          { readinessIssues: result.readinessIssues },
        );
      }
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      console.error("Operations quote mark ready failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_ready_failed",
        "Failed to mark quote ready",
      );
    }
  });

  router.post("/quotes/:quoteId/record-sent", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await recordOperationsQuoteSent(
        getActor(req),
        quoteId,
        parseOperationsQuoteSentInput(req.body),
      );
      if (result === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote sent failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_sent_failed",
        "Failed to record quote as sent",
      );
    }
  });

  router.post("/quotes/:quoteId/record-accepted", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await recordOperationsQuoteAccepted(
        getActor(req),
        quoteId,
        parseOperationsQuoteAcceptedInput(req.body),
      );
      if (result === "acceptance_confirmation_required") {
        return sendApiError(
          res,
          400,
          "acceptance_confirmation_required",
          "Quote acceptance requires explicit confirmation",
        );
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote accepted failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_accept_failed",
        "Failed to record quote acceptance",
      );
    }
  });

  router.post("/quotes/:quoteId/record-declined", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await recordOperationsQuoteDeclined(
        getActor(req),
        quoteId,
        parseOperationsQuoteDeclinedInput(req.body),
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote declined failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_decline_failed",
        "Failed to record quote decline",
      );
    }
  });

  router.post("/quotes/:quoteId/mark-expired", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    try {
      const result = await markOperationsQuoteExpired(
        getActor(req),
        quoteId,
        optionalTextField(body as Record<string, unknown>, "reason"),
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ quote: serializeObject(result) });
    } catch (err) {
      console.error("Operations quote expire failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_expire_failed",
        "Failed to expire quote",
      );
    }
  });

  router.post("/quotes/:quoteId/convert-to-work", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await convertOperationsQuoteToWorkOrder(
        getActor(req),
        quoteId,
      );
      if (result === "quote_not_accepted") {
        return sendApiError(
          res,
          400,
          "quote_not_accepted",
          "Only accepted quotes can be converted",
        );
      }
      if (result === "quote_has_no_selected_items") {
        return sendApiError(
          res,
          400,
          "quote_has_no_selected_items",
          "Quote has no selected items",
        );
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.status(201).json({ workOrder: serializeObject(result) });
    } catch (err) {
      console.error("Operations quote convert failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_convert_failed",
        "Failed to convert quote to work",
      );
    }
  });

  router.get("/quotes/:quoteId/preview", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const preview = await getOperationsQuotePreview(quoteId);
      if (!preview)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json(serializeObject(preview));
    } catch (err) {
      console.error("Operations quote preview failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_preview_failed",
        "Failed to build quote preview",
      );
    }
  });

  router.post("/quotes/:quoteId/generate-pdf", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const payload = await freezeOperationsQuoteRender(
        getActor(req),
        quoteId,
        "operations_quote_pdf_generated",
      );
      if (!payload)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({
        payload: serializeObject(payload),
        pdfMode: "browser_print",
      });
    } catch (err) {
      console.error("Operations quote PDF failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_pdf_failed",
        "Failed to prepare quote PDF",
      );
    }
  });

  router.get("/quotes/:quoteId/download", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const preview = await getOperationsQuotePreview(quoteId);
      if (!preview)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({
        ...((serializeObject(preview) as Record<string, unknown>) ?? {}),
        pdfMode: "browser_print",
      });
    } catch (err) {
      console.error("Operations quote download failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_download_failed",
        "Failed to build quote download",
      );
    }
  });

  router.post("/quotes/:quoteId/items", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await addOperationsQuoteItem(
        getActor(req),
        quoteId,
        parseOperationsQuoteItemInput(req.body),
      );
      if (result === "quote_locked") {
        return sendApiError(res, 409, "quote_locked", "Quote cannot be edited");
      }
      if (
        result === "business_not_found" ||
        result === "report_not_found" ||
        result === "finding_not_found"
      ) {
        return sendApiError(res, 404, "not_found", "Related record not found");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.status(201).json({ item: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote item add failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_item_add_failed",
        "Failed to add quote item",
      );
    }
  });

  router.patch("/quotes/:quoteId/items/:itemId", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    const itemId = getUuidParam(req, res, "itemId");
    if (!quoteId || !itemId) return;
    try {
      const result = await updateOperationsQuoteItem(
        getActor(req),
        quoteId,
        itemId,
        parseOperationsQuoteItemInput(req.body, { partial: true }),
      );
      if (result === "quote_locked") {
        return sendApiError(res, 409, "quote_locked", "Quote cannot be edited");
      }
      if (!result) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote item update failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_item_update_failed",
        "Failed to update quote item",
      );
    }
  });

  router.delete("/quotes/:quoteId/items/:itemId", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    const itemId = getUuidParam(req, res, "itemId");
    if (!quoteId || !itemId) return;
    try {
      const result = await deleteOperationsQuoteItem(
        getActor(req),
        quoteId,
        itemId,
      );
      if (result === "quote_locked") {
        return sendApiError(res, 409, "quote_locked", "Quote cannot be edited");
      }
      if (!result) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(result) });
    } catch (err) {
      console.error("Operations quote item delete failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_item_delete_failed",
        "Failed to delete quote item",
      );
    }
  });

  router.post("/quotes/:quoteId/items/reorder", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const itemIds = Array.isArray((body as Record<string, unknown>).itemIds)
        ? ((body as Record<string, unknown>).itemIds as unknown[])
        : [];
      if (
        itemIds.length === 0 ||
        !itemIds.every((id) => typeof id === "string" && UUID_RE.test(id))
      ) {
        return sendApiError(
          res,
          400,
          "invalid_item_order",
          "Item order is invalid",
        );
      }
      const result = await reorderOperationsQuoteItems(
        getActor(req),
        quoteId,
        itemIds as string[],
      );
      if (result === "quote_locked") {
        return sendApiError(res, 409, "quote_locked", "Quote cannot be edited");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res.json({ items: serializeObject(result) });
    } catch (err) {
      console.error("Operations quote item reorder failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_item_reorder_failed",
        "Failed to reorder quote items",
      );
    }
  });

  router.post("/quotes/:quoteId/access-requirements", async (req, res) => {
    const quoteId = getUuidParam(req, res, "quoteId");
    if (!quoteId) return;
    try {
      const result = await addOperationsQuoteAccessRequirement(
        getActor(req),
        quoteId,
        parseOperationsAccessRequirementInput(req.body),
      );
      if (result === "quote_locked") {
        return sendApiError(res, 409, "quote_locked", "Quote cannot be edited");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Quote not found");
      return res
        .status(201)
        .json({ accessRequirement: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations quote access add failed", err);
      return sendApiError(
        res,
        500,
        "operations_quote_access_add_failed",
        "Failed to add access requirement",
      );
    }
  });

  router.patch(
    "/quotes/:quoteId/access-requirements/:requirementId",
    async (req, res) => {
      const quoteId = getUuidParam(req, res, "quoteId");
      const requirementId = getUuidParam(req, res, "requirementId");
      if (!quoteId || !requirementId) return;
      try {
        const result = await updateOperationsQuoteAccessRequirement(
          getActor(req),
          quoteId,
          requirementId,
          parseOperationsAccessRequirementInput(req.body, { partial: true }),
        );
        if (result === "quote_locked") {
          return sendApiError(
            res,
            409,
            "quote_locked",
            "Quote cannot be edited",
          );
        }
        if (!result)
          return sendApiError(
            res,
            404,
            "not_found",
            "Access requirement not found",
          );
        return res.json({ accessRequirement: serializeObject(result) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations quote access update failed", err);
        return sendApiError(
          res,
          500,
          "operations_quote_access_update_failed",
          "Failed to update access requirement",
        );
      }
    },
  );

  router.delete(
    "/quotes/:quoteId/access-requirements/:requirementId",
    async (req, res) => {
      const quoteId = getUuidParam(req, res, "quoteId");
      const requirementId = getUuidParam(req, res, "requirementId");
      if (!quoteId || !requirementId) return;
      try {
        const result = await deleteOperationsQuoteAccessRequirement(
          getActor(req),
          quoteId,
          requirementId,
        );
        if (result === "quote_locked") {
          return sendApiError(
            res,
            409,
            "quote_locked",
            "Quote cannot be edited",
          );
        }
        if (!result)
          return sendApiError(
            res,
            404,
            "not_found",
            "Access requirement not found",
          );
        return res.json({ accessRequirement: serializeObject(result) });
      } catch (err) {
        console.error("Operations quote access delete failed", err);
        return sendApiError(
          res,
          500,
          "operations_quote_access_delete_failed",
          "Failed to delete access requirement",
        );
      }
    },
  );

  router.get("/work-orders", async (req, res) => {
    try {
      return res.json(
        serializeObject(
          await listOperationsWorkOrders(parseWorkOrderListOptions(req)),
        ),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work orders failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_orders_failed",
        "Failed to load work orders",
      );
    }
  });

  router.get("/work-orders/:workOrderId", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const detail = await getOperationsWorkOrderDetail(workOrderId);
      if (!detail)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({ workOrder: serializeObject(detail) });
    } catch (err) {
      console.error("Operations work order detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_failed",
        "Failed to load work order",
      );
    }
  });

  router.patch("/work-orders/:workOrderId", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const input = parseOperationsWorkOrderUpdateInput(req.body);
      if (input.status === "completed") {
        return sendApiError(
          res,
          400,
          "use_complete_endpoint",
          "Use the completion workflow for completed work orders",
        );
      }
      const result = await updateOperationsWorkOrder(
        getActor(req),
        workOrderId,
        input,
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({ workOrder: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work order update failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_update_failed",
        "Failed to update work order",
      );
    }
  });

  router.post("/work-orders/:workOrderId/start", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const result = await updateOperationsWorkOrder(
        getActor(req),
        workOrderId,
        {
          status: "in_progress",
        },
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({ workOrder: serializeObject(result) });
    } catch (err) {
      console.error("Operations work order start failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_start_failed",
        "Failed to start work order",
      );
    }
  });

  router.post("/work-orders/:workOrderId/set-status", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const record = req.body && typeof req.body === "object" ? req.body : {};
      const status = parseOperationsWorkOrderStatus(
        (record as Record<string, unknown>).status,
      );
      if (!status) throw new Error("invalid_work_order_status");
      if (status === "completed") {
        return sendApiError(
          res,
          400,
          "use_complete_endpoint",
          "Use the completion workflow for completed work orders",
        );
      }
      const result = await updateOperationsWorkOrder(
        getActor(req),
        workOrderId,
        {
          status,
        },
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({ workOrder: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work order status failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_status_failed",
        "Failed to update work order status",
      );
    }
  });

  router.post("/work-orders/:workOrderId/complete", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const record = req.body && typeof req.body === "object" ? req.body : {};
      const result = await completeOperationsWorkOrder(
        getActor(req),
        workOrderId,
        textField(record as Record<string, unknown>, "completionSummary") ?? "",
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Work order not found");
      if ("completionIssues" in result) {
        return sendApiError(
          res,
          400,
          "work_order_not_complete",
          "Work order is not ready to complete",
          { completionIssues: result.completionIssues },
        );
      }
      return res.json({ workOrder: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work order complete failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_complete_failed",
        "Failed to complete work order",
      );
    }
  });

  router.post("/work-orders/:workOrderId/cancel", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const result = await updateOperationsWorkOrder(
        getActor(req),
        workOrderId,
        {
          status: "cancelled",
        },
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({ workOrder: serializeObject(result) });
    } catch (err) {
      console.error("Operations work order cancel failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_order_cancel_failed",
        "Failed to cancel work order",
      );
    }
  });

  router.post("/work-orders/:workOrderId/items", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    try {
      const item = await addOperationsWorkItem(
        getActor(req),
        workOrderId,
        parseOperationsWorkItemInput(req.body),
      );
      if (!item)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.status(201).json({ item: serializeObject(item) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work item add failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_item_add_failed",
        "Failed to add work item",
      );
    }
  });

  router.patch("/work-orders/:workOrderId/items/:itemId", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    const itemId = getUuidParam(req, res, "itemId");
    if (!workOrderId || !itemId) return;
    try {
      const item = await updateOperationsWorkItem(
        getActor(req),
        workOrderId,
        itemId,
        parseOperationsWorkItemInput(req.body, { partial: true }),
      );
      if (!item) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(item) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations work item update failed", err);
      return sendApiError(
        res,
        500,
        "operations_work_item_update_failed",
        "Failed to update work item",
      );
    }
  });

  router.post(
    "/work-orders/:workOrderId/items/:itemId/start",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const itemId = getUuidParam(req, res, "itemId");
      if (!workOrderId || !itemId) return;
      const item = await updateOperationsWorkItem(
        getActor(req),
        workOrderId,
        itemId,
        {
          status: "in_progress",
        },
      );
      if (!item) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(item) });
    },
  );

  router.post(
    "/work-orders/:workOrderId/items/:itemId/complete",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const itemId = getUuidParam(req, res, "itemId");
      if (!workOrderId || !itemId) return;
      const record = req.body && typeof req.body === "object" ? req.body : {};
      const item = await updateOperationsWorkItem(
        getActor(req),
        workOrderId,
        itemId,
        {
          status: "completed",
          completionNotes: optionalTextField(
            record as Record<string, unknown>,
            "completionNotes",
          ),
          clientVisibleCompletionNotes: optionalTextField(
            record as Record<string, unknown>,
            "clientVisibleCompletionNotes",
          ),
        },
      );
      if (!item) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(item) });
    },
  );

  router.post(
    "/work-orders/:workOrderId/items/:itemId/block",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const itemId = getUuidParam(req, res, "itemId");
      if (!workOrderId || !itemId) return;
      const item = await updateOperationsWorkItem(
        getActor(req),
        workOrderId,
        itemId,
        {
          status: "blocked",
        },
      );
      if (!item) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(item) });
    },
  );

  router.post(
    "/work-orders/:workOrderId/items/:itemId/request-client-action",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const itemId = getUuidParam(req, res, "itemId");
      if (!workOrderId || !itemId) return;
      const item = await updateOperationsWorkItem(
        getActor(req),
        workOrderId,
        itemId,
        { status: "waiting_for_client" },
      );
      if (!item) return sendApiError(res, 404, "not_found", "Item not found");
      return res.json({ item: serializeObject(item) });
    },
  );

  router.post("/work-orders/:workOrderId/items/reorder", async (req, res) => {
    const workOrderId = getUuidParam(req, res, "workOrderId");
    if (!workOrderId) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const itemIds = Array.isArray((body as Record<string, unknown>).itemIds)
      ? ((body as Record<string, unknown>).itemIds as unknown[])
      : [];
    if (
      itemIds.length === 0 ||
      !itemIds.every((id) => typeof id === "string" && UUID_RE.test(id))
    ) {
      return sendApiError(
        res,
        400,
        "invalid_item_order",
        "Item order is invalid",
      );
    }
    const items = await reorderOperationsWorkItems(
      getActor(req),
      workOrderId,
      itemIds as string[],
    );
    return res.json({ items: serializeObject(items) });
  });

  router.get(
    "/work-orders/:workOrderId/access-requirements",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      if (!workOrderId) return;
      const detail = await getOperationsWorkOrderDetail(workOrderId);
      if (!detail)
        return sendApiError(res, 404, "not_found", "Work order not found");
      return res.json({
        accessRequirements: serializeObject(detail.accessRequirements),
      });
    },
  );

  router.post(
    "/work-orders/:workOrderId/access-requirements",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      if (!workOrderId) return;
      try {
        const result = await addOperationsWorkOrderAccessRequirement(
          getActor(req),
          workOrderId,
          parseOperationsAccessRequirementInput(req.body),
        );
        if (!result)
          return sendApiError(res, 404, "not_found", "Work order not found");
        return res
          .status(201)
          .json({ accessRequirement: serializeObject(result) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations work access add failed", err);
        return sendApiError(
          res,
          500,
          "operations_work_access_add_failed",
          "Failed to add access requirement",
        );
      }
    },
  );

  router.patch(
    "/work-orders/:workOrderId/access-requirements/:requirementId",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const requirementId = getUuidParam(req, res, "requirementId");
      if (!workOrderId || !requirementId) return;
      try {
        const result = await updateOperationsWorkOrderAccessRequirement(
          getActor(req),
          workOrderId,
          requirementId,
          parseOperationsAccessRequirementInput(req.body, { partial: true }),
        );
        if (!result)
          return sendApiError(
            res,
            404,
            "not_found",
            "Access requirement not found",
          );
        return res.json({ accessRequirement: serializeObject(result) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations work access update failed", err);
        return sendApiError(
          res,
          500,
          "operations_work_access_update_failed",
          "Failed to update access requirement",
        );
      }
    },
  );

  router.delete(
    "/work-orders/:workOrderId/access-requirements/:requirementId",
    async (req, res) => {
      const workOrderId = getUuidParam(req, res, "workOrderId");
      const requirementId = getUuidParam(req, res, "requirementId");
      if (!workOrderId || !requirementId) return;
      const result = await deleteOperationsWorkOrderAccessRequirement(
        getActor(req),
        workOrderId,
        requirementId,
      );
      if (!result)
        return sendApiError(
          res,
          404,
          "not_found",
          "Access requirement not found",
        );
      return res.json({ accessRequirement: serializeObject(result) });
    },
  );

  router.get("/reports/reportable-scan-runs", async (req, res) => {
    try {
      const businessId =
        typeof req.query.businessId === "string" ? req.query.businessId : "";
      const siteId =
        typeof req.query.siteId === "string" ? req.query.siteId : "";
      if (!UUID_RE.test(businessId)) {
        return sendApiError(
          res,
          400,
          "invalid_businessId",
          "Business is invalid",
        );
      }
      if (!UUID_RE.test(siteId)) {
        return sendApiError(res, 400, "invalid_siteId", "Site is invalid");
      }
      const result = await listOperationsReportableScanRuns({
        businessId,
        siteId,
        limit: 50,
      });
      if (!result) {
        return sendApiError(res, 404, "not_found", "Linked site not found");
      }
      return res.json(serializeObject(result));
    } catch (err) {
      console.error("Operations reportable scan runs failed", err);
      return sendApiError(
        res,
        500,
        "operations_reportable_scans_failed",
        "Failed to load reportable scan runs",
      );
    }
  });

  router.get("/reports", async (req, res) => {
    try {
      return res.json(
        serializeObject(
          await listOperationsReports(parseReportListOptions(req)),
        ),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations reports list failed", err);
      return sendApiError(
        res,
        500,
        "operations_reports_failed",
        "Failed to load reports",
      );
    }
  });

  router.post("/reports", async (req, res) => {
    try {
      const result = await createOperationsReport(
        getActor(req),
        parseOperationsReportCreateInput(req.body),
      );
      if (result === "business_site_scan_invalid") {
        return sendApiError(
          res,
          400,
          "business_site_scan_invalid",
          "Business, site and scan relationship is invalid",
        );
      }
      if (result === "scan_not_reportable") {
        return sendApiError(
          res,
          400,
          "scan_not_reportable",
          "Only completed scan runs can be used for Operations reports",
        );
      }
      if (result === "duplicate_report") {
        return sendApiError(
          res,
          409,
          "duplicate_report",
          "A report already exists for this scan",
        );
      }
      if (result === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      return res.status(201).json({ report: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report create failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_create_failed",
        "Failed to create report",
      );
    }
  });

  router.get("/reports/:reportId", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const detail = await getOperationsReportDetail(reportId);
      if (!detail) {
        return sendApiError(res, 404, "not_found", "Report not found");
      }
      return res.json({ report: serializeObject(detail) });
    } catch (err) {
      console.error("Operations report detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_failed",
        "Failed to load report",
      );
    }
  });

  router.patch("/reports/:reportId", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await updateOperationsReport(
        getActor(req),
        reportId,
        parseOperationsReportUpdateInput(req.body),
      );
      if (result === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (!result) {
        return sendApiError(res, 404, "not_found", "Report not found");
      }
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report update failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_update_failed",
        "Failed to update report",
      );
    }
  });

  router.post("/reports/:reportId/archive", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const report = await setOperationsReportArchived(
        getActor(req),
        reportId,
        true,
      );
      if (!report)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(report) });
    } catch (err) {
      console.error("Operations report archive failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_archive_failed",
        "Failed to archive report",
      );
    }
  });

  router.post("/reports/:reportId/restore", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const report = await setOperationsReportArchived(
        getActor(req),
        reportId,
        false,
      );
      if (!report)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(report) });
    } catch (err) {
      console.error("Operations report restore failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_restore_failed",
        "Failed to restore report",
      );
    }
  });

  router.delete("/reports/:reportId", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await deleteOperationsReport(getActor(req), reportId);
      if (!result) {
        return sendApiError(res, 404, "not_found", "Report not found");
      }
      if ("allowed" in result && result.allowed === false) {
        return sendApiError(
          res,
          409,
          "report_delete_blocked",
          "Report has delivery or commercial history and cannot be hard deleted",
          {
            reasons: result.reasons,
            dependencyCounts: result.dependencyCounts,
          },
        );
      }
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      console.error("Operations report delete failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_delete_failed",
        "Failed to delete report",
      );
    }
  });

  router.post("/reports/:reportId/duplicate", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const report = await duplicateOperationsReport(getActor(req), reportId);
      if (!report)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.status(201).json({ report: serializeObject(report) });
    } catch (err) {
      console.error("Operations report duplicate failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_duplicate_failed",
        "Failed to duplicate report",
      );
    }
  });

  router.get("/reports/:reportId/findings", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const detail = await getOperationsReportDetail(reportId);
      if (!detail)
        return sendApiError(res, 404, "not_found", "Report not found");
      let findings = detail.findings;
      const included = req.query.included;
      if (included === "true")
        findings = findings.filter((item) => item.is_included);
      if (included === "false")
        findings = findings.filter((item) => !item.is_included);
      if (req.query.falsePositive === "true") {
        findings = findings.filter((item) => item.is_false_positive);
      }
      const priority =
        typeof req.query.clientPriority === "string"
          ? parseOperationsReportClientPriority(req.query.clientPriority)
          : null;
      if (typeof req.query.clientPriority === "string" && !priority) {
        return sendApiError(
          res,
          400,
          "invalid_client_priority",
          "Client priority is invalid",
        );
      }
      if (priority) {
        findings = findings.filter((item) => item.client_priority === priority);
      }
      if (typeof req.query.category === "string") {
        findings = findings.filter(
          (item) => item.category === req.query.category,
        );
      }
      if (typeof req.query.search === "string" && req.query.search.trim()) {
        const search = req.query.search.trim().toLowerCase();
        findings = findings.filter(
          (item) =>
            item.title.toLowerCase().includes(search) ||
            (item.affected_url ?? "").toLowerCase().includes(search) ||
            (item.client_explanation ?? "").toLowerCase().includes(search),
        );
      }
      return res.json({
        findings: serializeObject(findings),
        totalMatching: findings.length,
      });
    } catch (err) {
      console.error("Operations report findings failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_findings_failed",
        "Failed to load findings",
      );
    }
  });

  router.patch("/reports/:reportId/findings/:findingId", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    const findingId = getUuidParam(req, res, "findingId");
    if (!reportId || !findingId) return;
    try {
      const finding = await updateOperationsReportFinding(
        getActor(req),
        reportId,
        findingId,
        parseOperationsReportFindingUpdateInput(req.body),
      );
      if (!finding)
        return sendApiError(res, 404, "not_found", "Finding not found");
      return res.json({ finding: serializeObject(finding) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report finding update failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_finding_update_failed",
        "Failed to update finding",
      );
    }
  });

  router.post("/reports/:reportId/findings/bulk", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const findings = await bulkUpdateOperationsReportFindings(
        getActor(req),
        reportId,
        parseOperationsReportFindingBulkInput(req.body),
      );
      return res.json({ findings: serializeObject(findings) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report findings bulk update failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_findings_bulk_update_failed",
        "Failed to update selected findings",
      );
    }
  });

  router.post(
    "/reports/:reportId/findings/:findingId/include",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const findingId = getUuidParam(req, res, "findingId");
      if (!reportId || !findingId) return;
      try {
        const finding = await updateOperationsReportFinding(
          getActor(req),
          reportId,
          findingId,
          {
            isIncluded: true,
            isFalsePositive: false,
          },
        );
        if (!finding)
          return sendApiError(res, 404, "not_found", "Finding not found");
        return res.json({ finding: serializeObject(finding) });
      } catch (err) {
        console.error("Operations report finding include failed", err);
        return sendApiError(
          res,
          500,
          "operations_report_finding_include_failed",
          "Failed to include finding",
        );
      }
    },
  );

  router.post(
    "/reports/:reportId/findings/:findingId/exclude",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const findingId = getUuidParam(req, res, "findingId");
      if (!reportId || !findingId) return;
      try {
        const finding = await updateOperationsReportFinding(
          getActor(req),
          reportId,
          findingId,
          {
            isIncluded: false,
          },
        );
        if (!finding)
          return sendApiError(res, 404, "not_found", "Finding not found");
        return res.json({ finding: serializeObject(finding) });
      } catch (err) {
        console.error("Operations report finding exclude failed", err);
        return sendApiError(
          res,
          500,
          "operations_report_finding_exclude_failed",
          "Failed to exclude finding",
        );
      }
    },
  );

  router.post(
    "/reports/:reportId/findings/:findingId/mark-false-positive",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const findingId = getUuidParam(req, res, "findingId");
      if (!reportId || !findingId) return;
      try {
        const finding = await updateOperationsReportFinding(
          getActor(req),
          reportId,
          findingId,
          { isIncluded: false, isFalsePositive: true },
        );
        if (!finding)
          return sendApiError(res, 404, "not_found", "Finding not found");
        return res.json({ finding: serializeObject(finding) });
      } catch (err) {
        console.error("Operations report finding false positive failed", err);
        return sendApiError(
          res,
          500,
          "operations_report_finding_false_positive_failed",
          "Failed to mark finding false positive",
        );
      }
    },
  );

  router.post("/reports/:reportId/findings/reorder", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const findingIds = Array.isArray(
        (body as Record<string, unknown>).findingIds,
      )
        ? ((body as Record<string, unknown>).findingIds as unknown[])
        : [];
      if (
        findingIds.length === 0 ||
        !findingIds.every((id) => typeof id === "string" && UUID_RE.test(id))
      ) {
        return sendApiError(
          res,
          400,
          "invalid_finding_order",
          "Finding order is invalid",
        );
      }
      const findings = await reorderOperationsReportFindings(
        getActor(req),
        reportId,
        findingIds as string[],
      );
      return res.json({ findings: serializeObject(findings) });
    } catch (err) {
      console.error("Operations report reorder failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_reorder_failed",
        "Failed to reorder findings",
      );
    }
  });

  router.patch(
    "/reports/:reportId/positive-observations/:observationId",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const observationId = getUuidParam(req, res, "observationId");
      if (!reportId || !observationId) return;
      try {
        const observation = await updateOperationsReportPositiveObservation(
          getActor(req),
          reportId,
          observationId,
          parseOperationsReportPositiveObservationUpdateInput(req.body),
        );
        if (!observation) {
          return sendApiError(
            res,
            404,
            "not_found",
            "Positive observation not found",
          );
        }
        return res.json({ observation: serializeObject(observation) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error(
          "Operations report positive observation update failed",
          err,
        );
        return sendApiError(
          res,
          500,
          "operations_report_positive_observation_update_failed",
          "Failed to update positive observation",
        );
      }
    },
  );

  router.patch(
    "/reports/:reportId/action-plan-items/:itemId",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const itemId = getUuidParam(req, res, "itemId");
      if (!reportId || !itemId) return;
      try {
        const item = await updateOperationsReportActionPlanItem(
          getActor(req),
          reportId,
          itemId,
          parseOperationsReportActionPlanItemUpdateInput(req.body),
        );
        if (!item) {
          return sendApiError(
            res,
            404,
            "not_found",
            "Action plan item not found",
          );
        }
        return res.json({ item: serializeObject(item) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations report action plan update failed", err);
        return sendApiError(
          res,
          500,
          "operations_report_action_plan_update_failed",
          "Failed to update action plan item",
        );
      }
    },
  );

  router.post("/reports/:reportId/mark-needs-review", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await markOperationsReportStatus(
        getActor(req),
        reportId,
        "needs_review",
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      console.error("Operations report mark needs review failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_status_failed",
        "Failed to update report status",
      );
    }
  });

  router.post("/reports/:reportId/mark-ready", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await markOperationsReportStatus(
        getActor(req),
        reportId,
        "ready_to_send",
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      if ("readinessIssues" in result) {
        return sendApiError(
          res,
          400,
          "report_not_ready",
          "Report is not ready to send",
          { readinessIssues: result.readinessIssues },
        );
      }
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      console.error("Operations report mark ready failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_status_failed",
        "Failed to update report status",
      );
    }
  });

  router.post("/reports/:reportId/record-sent", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await recordOperationsReportSent(
        getActor(req),
        reportId,
        parseOperationsReportSentInput(req.body),
      );
      if (result === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report sent failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_sent_failed",
        "Failed to record report as sent",
      );
    }
  });

  router.post("/reports/:reportId/record-client-reply", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await markOperationsReportStatus(
        getActor(req),
        reportId,
        "client_replied",
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      console.error("Operations report client reply failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_status_failed",
        "Failed to update report status",
      );
    }
  });

  router.post("/reports/:reportId/mark-completed", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const result = await markOperationsReportStatus(
        getActor(req),
        reportId,
        "completed",
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({ report: serializeObject(result) });
    } catch (err) {
      console.error("Operations report completed failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_status_failed",
        "Failed to update report status",
      );
    }
  });

  router.get("/reports/:reportId/preview", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const preview = await getOperationsReportPreview(reportId);
      if (!preview)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json(serializeObject(preview));
    } catch (err) {
      console.error("Operations report preview failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_preview_failed",
        "Failed to build report preview",
      );
    }
  });

  router.post("/reports/:reportId/generate-pdf", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const preview = await getOperationsReportPreview(reportId);
      if (!preview)
        return sendApiError(res, 404, "not_found", "Report not found");
      if (preview.frozen) {
        const storedPdf = await getOperationsReportPdfRender(reportId);
        if (storedPdf) {
          res.setHeader("content-type", "application/pdf");
          res.setHeader(
            "content-disposition",
            `attachment; filename="${storedPdf.filename}"`,
          );
          return res.send(storedPdf.pdf_bytes);
        }
      }
      const blockingIssues = preview.readinessIssues.filter(
        (issue) => issue.code !== "pdf_not_generated",
      );
      if (blockingIssues.length > 0) {
        return sendApiError(
          res,
          400,
          "report_not_ready_for_pdf",
          "Complete the report review before generating the final PDF",
          { readinessIssues: blockingIssues },
        );
      }
      const pdf = await renderOperationsReportPdf(preview.payload);
      const filename = operationsReportPdfFilename(preview.payload);
      await freezeOperationsReportRender(
        getActor(req),
        reportId,
        "operations_report_pdf_generated",
        preview.payload,
      );
      await saveOperationsReportPdfRender(reportId, filename, pdf);
      res.setHeader("content-type", "application/pdf");
      res.setHeader(
        "content-disposition",
        `attachment; filename="${filename}"`,
      );
      return res.send(pdf);
    } catch (err) {
      console.error("Operations report PDF generation failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_pdf_failed",
        "Failed to prepare report PDF",
      );
    }
  });

  router.get("/reports/:reportId/download", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const storedPdf = await getOperationsReportPdfRender(reportId);
      if (storedPdf) {
        res.setHeader("content-type", "application/pdf");
        res.setHeader(
          "content-disposition",
          `attachment; filename="${storedPdf.filename}"`,
        );
        return res.send(storedPdf.pdf_bytes);
      }
      const preview = await getOperationsReportPreview(reportId);
      if (!preview)
        return sendApiError(res, 404, "not_found", "Report not found");
      const pdf = await renderOperationsReportPdf(preview.payload);
      res.setHeader("content-type", "application/pdf");
      res.setHeader(
        "content-disposition",
        `attachment; filename="${operationsReportPdfFilename(preview.payload)}"`,
      );
      return res.send(pdf);
    } catch (err) {
      console.error("Operations report download failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_download_failed",
        "Failed to build report download",
      );
    }
  });

  router.post("/reports/:reportId/create-retest", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const input = parseOperationsReportRetestInput(req.body);
      const result = await createOperationsReportRetest(
        getActor(req),
        reportId,
        input.scanRunId,
        input.reportType,
      );
      if (!result)
        return sendApiError(res, 404, "not_found", "Report not found");
      if (typeof result === "string") {
        return sendApiError(
          res,
          400,
          result,
          "Re-test report could not be created",
        );
      }
      return res.status(201).json({ report: serializeObject(result) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations report retest failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_retest_failed",
        "Failed to create re-test report",
      );
    }
  });

  router.get("/reports/:reportId/comparison", async (req, res) => {
    const reportId = getUuidParam(req, res, "reportId");
    if (!reportId) return;
    try {
      const detail = await getOperationsReportDetail(reportId);
      if (!detail)
        return sendApiError(res, 404, "not_found", "Report not found");
      return res.json({
        comparisonItems: serializeObject(detail.comparisonItems),
      });
    } catch (err) {
      console.error("Operations report comparison failed", err);
      return sendApiError(
        res,
        500,
        "operations_report_comparison_failed",
        "Failed to load report comparison",
      );
    }
  });

  router.patch(
    "/reports/:reportId/comparison/:comparisonItemId",
    async (req, res) => {
      const reportId = getUuidParam(req, res, "reportId");
      const comparisonItemId = getUuidParam(req, res, "comparisonItemId");
      if (!reportId || !comparisonItemId) return;
      try {
        const item = await updateOperationsReportComparisonItem(
          getActor(req),
          reportId,
          comparisonItemId,
          parseOperationsReportComparisonUpdateInput(req.body),
        );
        if (!item)
          return sendApiError(
            res,
            404,
            "not_found",
            "Comparison item not found",
          );
        return res.json({ comparisonItem: serializeObject(item) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations report comparison update failed", err);
        return sendApiError(
          res,
          500,
          "operations_report_comparison_update_failed",
          "Failed to update comparison item",
        );
      }
    },
  );

  router.get("/communication-templates", async (req, res) => {
    try {
      return res.json({
        templates: serializeObject(
          await listOperationsCommunicationTemplates({
            activeOnly: req.query.activeOnly === "true",
          }),
        ),
        categories: OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES,
        placeholders: SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS,
      });
    } catch (err) {
      console.error("Operations communication templates failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_templates_failed",
        "Failed to load communication templates",
      );
    }
  });

  router.post("/communication-templates", async (req, res) => {
    try {
      const input = parseOperationsCommunicationTemplateInput(req.body);
      const template = await createOperationsCommunicationTemplate(
        getActor(req),
        input as {
          name: string;
          category: OperationsCommunicationTemplateCategory;
          subjectTemplate: string;
          bodyTemplate: string;
          defaultFollowUpBusinessDays?: number | null;
          isActive?: boolean;
        },
      );
      return res.status(201).json({ template: serializeObject(template) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations create communication template failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_template_create_failed",
        "Failed to create communication template",
      );
    }
  });

  router.get("/communication-templates/:templateId", async (req, res) => {
    const templateId = getUuidParam(req, res, "templateId");
    if (!templateId) return;
    try {
      const template = await getOperationsCommunicationTemplate(templateId);
      if (!template)
        return sendApiError(res, 404, "not_found", "Template not found");
      return res.json({
        template: serializeObject(template),
        placeholders: SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS,
        suggestedFollowUpAt: serializeDate(
          suggestedFollowUpDateForTemplate(template),
        ),
      });
    } catch (err) {
      console.error("Operations communication template detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_template_failed",
        "Failed to load communication template",
      );
    }
  });

  router.post(
    "/communication-templates/:templateId/preview",
    async (req, res) => {
      const templateId = getUuidParam(req, res, "templateId");
      if (!templateId) return;
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const record = body as Record<string, unknown>;
        const businessId = optionalUuidField(record, "businessId");
        const contactId = optionalUuidField(record, "contactId");
        const followUpAt = parseDateField(record, "followUpAt");
        const reportName = optionalTextField(record, "reportName");
        const template = await getOperationsCommunicationTemplate(templateId);
        if (!template)
          return sendApiError(res, 404, "not_found", "Template not found");
        const context = businessId
          ? await getOperationsCommunicationDraftContext(businessId, {
              contactId,
            })
          : null;
        if (businessId && !context) {
          return sendApiError(res, 404, "not_found", "Business not found");
        }
        const suggestedFollowUpAt =
          followUpAt ?? suggestedFollowUpDateForTemplate(template);
        const rendered = renderClientCommunicationTemplate(template, context, {
          ...getSenderDefaults(),
          followUpDate: suggestedFollowUpAt,
          reportName,
        });
        return res.json({
          preview: {
            subject: rendered.subject,
            body: rendered.body,
            unresolvedPlaceholders: rendered.unresolvedPlaceholders,
            suggestedFollowUpAt: serializeDate(suggestedFollowUpAt),
          },
        });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations communication template preview failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_template_preview_failed",
          "Failed to preview communication template",
        );
      }
    },
  );

  router.post(
    "/communication-templates/:templateId/archive",
    async (req, res) => {
      const templateId = getUuidParam(req, res, "templateId");
      if (!templateId) return;
      try {
        const template = await setOperationsCommunicationTemplateActive(
          getActor(req),
          templateId,
          false,
        );
        if (!template)
          return sendApiError(res, 404, "not_found", "Template not found");
        return res.json({ template: serializeObject(template) });
      } catch (err) {
        console.error("Operations archive communication template failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_template_archive_failed",
          "Failed to archive communication template",
        );
      }
    },
  );

  router.post(
    "/communication-templates/:templateId/restore",
    async (req, res) => {
      const templateId = getUuidParam(req, res, "templateId");
      if (!templateId) return;
      try {
        const template = await setOperationsCommunicationTemplateActive(
          getActor(req),
          templateId,
          true,
        );
        if (!template)
          return sendApiError(res, 404, "not_found", "Template not found");
        return res.json({ template: serializeObject(template) });
      } catch (err) {
        console.error("Operations restore communication template failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_template_restore_failed",
          "Failed to restore communication template",
        );
      }
    },
  );

  router.post(
    "/communication-templates/:templateId/duplicate",
    async (req, res) => {
      const templateId = getUuidParam(req, res, "templateId");
      if (!templateId) return;
      try {
        const template = await getOperationsCommunicationTemplate(templateId);
        if (!template)
          return sendApiError(res, 404, "not_found", "Template not found");
        const duplicate = await createOperationsCommunicationTemplate(
          getActor(req),
          {
            name: `${template.name} copy`,
            category: template.category,
            subjectTemplate: template.subject_template,
            bodyTemplate: template.body_template,
            defaultFollowUpBusinessDays:
              template.default_follow_up_business_days,
            isActive: false,
          },
        );
        return res.status(201).json({ template: serializeObject(duplicate) });
      } catch (err) {
        console.error(
          "Operations duplicate communication template failed",
          err,
        );
        return sendApiError(
          res,
          500,
          "operations_communication_template_duplicate_failed",
          "Failed to duplicate communication template",
        );
      }
    },
  );

  router.patch("/communication-templates/:templateId", async (req, res) => {
    const templateId = getUuidParam(req, res, "templateId");
    if (!templateId) return;
    try {
      const template = await updateOperationsCommunicationTemplate(
        getActor(req),
        templateId,
        parseOperationsCommunicationTemplateInput(req.body, { partial: true }),
      );
      if (!template)
        return sendApiError(res, 404, "not_found", "Template not found");
      return res.json({ template: serializeObject(template) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations update communication template failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_template_update_failed",
        "Failed to update communication template",
      );
    }
  });

  router.get("/communications", async (req, res) => {
    try {
      return res.json(
        serializeObject(
          await listOperationsCommunications(
            parseCommunicationListOptions(req),
          ),
        ),
      );
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations communications list failed", err);
      return sendApiError(
        res,
        500,
        "operations_communications_failed",
        "Failed to load communications",
      );
    }
  });

  router.post("/communications", async (req, res) => {
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const businessId = optionalUuidField(
        body as Record<string, unknown>,
        "businessId",
      );
      if (!businessId) throw new Error("invalid_businessId");
      const input = parseOperationsCommunicationInput(req.body);
      const communication = await createOperationsCommunication(
        getActor(req),
        businessId,
        input as OperationsCommunicationInput,
      );
      if (communication === "business_not_found") {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if (communication === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (communication === "template_not_found") {
        return sendApiError(res, 404, "not_found", "Template not found");
      }
      return res
        .status(201)
        .json({ communication: serializeObject(communication) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations create communication failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_create_failed",
        "Failed to create communication",
      );
    }
  });

  router.get("/communications/:communicationId", async (req, res) => {
    const communicationId = getUuidParam(req, res, "communicationId");
    if (!communicationId) return;
    try {
      const communication = await getCommunicationOr404(res, communicationId);
      if (!communication) return;
      return res.json({ communication: serializeObject(communication) });
    } catch (err) {
      console.error("Operations communication detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_failed",
        "Failed to load communication",
      );
    }
  });

  router.patch("/communications/:communicationId", async (req, res) => {
    const communicationId = getUuidParam(req, res, "communicationId");
    if (!communicationId) return;
    try {
      const existing = await getCommunicationOr404(res, communicationId);
      if (!existing) return;
      const input = parseOperationsCommunicationInput(req.body, {
        partial: true,
      });
      assertCommunicationCanTransition({
        status: input.status ?? existing.status,
        subject: input.subject ?? existing.subject,
        body: input.body ?? existing.body,
      });
      const communication = await updateOperationsCommunication(
        getActor(req),
        existing.business_id,
        communicationId,
        input,
      );
      if (communication === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (communication === "template_not_found") {
        return sendApiError(res, 404, "not_found", "Template not found");
      }
      if (!communication) {
        return sendApiError(res, 404, "not_found", "Communication not found");
      }
      return res.json({ communication: serializeObject(communication) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations update communication failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_update_failed",
        "Failed to update communication",
      );
    }
  });

  router.post(
    "/communications/:communicationId/mark-sent",
    async (req, res) => {
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const input = parseOperationsCommunicationInput(req.body, {
          partial: true,
        });
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const record = body as Record<string, unknown>;
        assertCommunicationCanTransition({
          status: "sent",
          subject: input.subject ?? existing.subject,
          body: input.body ?? existing.body,
          allowUnresolvedOverride:
            record.unresolvedPlaceholderOverride === true,
          overrideReason:
            typeof record.unresolvedPlaceholderOverrideReason === "string"
              ? record.unresolvedPlaceholderOverrideReason
              : null,
        });
        const communication = await markOperationsCommunicationSent(
          getActor(req),
          existing.business_id,
          communicationId,
          {
            subject: input.subject,
            body: input.body,
            followUpAt: input.followUpAt,
            taskTitle: input.taskTitle,
            taskNotes: input.taskNotes,
          },
        );
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations mark communication sent failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_mark_sent_failed",
          "Failed to mark communication sent",
        );
      }
    },
  );

  router.post(
    "/communications/:communicationId/mark-received",
    async (req, res) => {
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const input = parseOperationsCommunicationInput(req.body, {
          partial: true,
        });
        const communication = await markOperationsCommunicationReceived(
          getActor(req),
          existing.business_id,
          communicationId,
          {
            subject: input.subject,
            body: input.body,
            followUpAt: input.followUpAt,
            taskTitle: input.taskTitle,
            taskNotes: input.taskNotes,
          },
        );
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations mark communication received failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_mark_received_failed",
          "Failed to mark communication received",
        );
      }
    },
  );

  router.post("/communications/:communicationId/cancel", async (req, res) => {
    const communicationId = getUuidParam(req, res, "communicationId");
    if (!communicationId) return;
    try {
      const existing = await getCommunicationOr404(res, communicationId);
      if (!existing) return;
      const communication = await cancelOperationsCommunication(
        getActor(req),
        existing.business_id,
        communicationId,
      );
      if (!communication) {
        return sendApiError(res, 404, "not_found", "Communication not found");
      }
      return res.json({ communication: serializeObject(communication) });
    } catch (err) {
      console.error("Operations cancel communication failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_cancel_failed",
        "Failed to cancel communication",
      );
    }
  });

  router.post(
    "/communications/:communicationId/schedule-follow-up",
    async (req, res) => {
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const followUpAt = parseRequiredDateField(
          body as Record<string, unknown>,
          "followUpAt",
        );
        const communication = await updateOperationsCommunication(
          getActor(req),
          existing.business_id,
          communicationId,
          {
            followUpAt,
            taskTitle: optionalTextField(
              body as Record<string, unknown>,
              "taskTitle",
            ),
            taskNotes: optionalTextField(
              body as Record<string, unknown>,
              "taskNotes",
            ),
          },
        );
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations schedule follow-up failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_follow_up_failed",
          "Failed to schedule follow-up",
        );
      }
    },
  );

  router.post(
    "/communications/:communicationId/complete-follow-up",
    async (req, res) => {
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const result = await completeOperationsCommunicationFollowUp(
          getActor(req),
          communicationId,
        );
        return res.json({ ok: true, task: serializeObject(result) });
      } catch (err) {
        console.error(
          "Operations complete communication follow-up failed",
          err,
        );
        return sendApiError(
          res,
          500,
          "operations_communication_follow_up_complete_failed",
          "Failed to complete follow-up",
        );
      }
    },
  );

  router.get("/tasks", async (req, res) => {
    try {
      const status =
        typeof req.query.status === "string" &&
        (req.query.status === "active" ||
          req.query.status === "due" ||
          TASK_STATUS_SET.has(req.query.status))
          ? (req.query.status as OperationsTaskStatus | "active" | "due")
          : undefined;
      const result = await listOperationsTasks({
        status,
        ...parsePagination(req),
      });
      return res.json(
        serializeObject({
          ...result,
          groups: groupTasks(result.tasks),
        }),
      );
    } catch (err) {
      console.error("Operations tasks list failed", err);
      return sendApiError(
        res,
        500,
        "operations_tasks_failed",
        "Failed to load tasks",
      );
    }
  });

  router.post("/tasks", async (req, res) => {
    try {
      const input = parseOperationsTaskInput(req.body);
      const task = await createOperationsTask(getActor(req), {
        businessId: input.businessId as string,
        contactId: input.contactId,
        title: input.title as string,
        notes: input.notes,
        dueAt: input.dueAt as Date,
      });
      if (task === "business_not_found") {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if (task === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      return res.status(201).json({ task: serializeObject(task) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations create task failed", err);
      return sendApiError(
        res,
        500,
        "operations_task_create_failed",
        "Failed to create task",
      );
    }
  });

  router.patch("/tasks/:taskId", async (req, res) => {
    const taskId = getUuidParam(req, res, "taskId");
    if (!taskId) return;
    try {
      const task = await updateOperationsTask(
        getActor(req),
        taskId,
        parseOperationsTaskInput(req.body, { partial: true }),
      );
      if (!task) return sendApiError(res, 404, "not_found", "Task not found");
      return res.json({ task: serializeObject(task) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations update task failed", err);
      return sendApiError(
        res,
        500,
        "operations_task_update_failed",
        "Failed to update task",
      );
    }
  });

  router.post("/tasks/:taskId/complete", async (req, res) => {
    const taskId = getUuidParam(req, res, "taskId");
    if (!taskId) return;
    try {
      const task = await completeOperationsTask(getActor(req), taskId);
      if (!task) return sendApiError(res, 404, "not_found", "Task not found");
      return res.json({ task: serializeObject(task) });
    } catch (err) {
      console.error("Operations complete task failed", err);
      return sendApiError(
        res,
        500,
        "operations_task_complete_failed",
        "Failed to complete task",
      );
    }
  });

  router.post("/tasks/:taskId/snooze", async (req, res) => {
    const taskId = getUuidParam(req, res, "taskId");
    if (!taskId) return;
    try {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const snoozedUntil = parseRequiredDateField(
        body as Record<string, unknown>,
        "snoozedUntil",
      );
      const task = await snoozeOperationsTask(
        getActor(req),
        taskId,
        snoozedUntil,
      );
      if (!task) return sendApiError(res, 404, "not_found", "Task not found");
      return res.json({ task: serializeObject(task) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations snooze task failed", err);
      return sendApiError(
        res,
        500,
        "operations_task_snooze_failed",
        "Failed to snooze task",
      );
    }
  });

  router.post("/tasks/:taskId/cancel", async (req, res) => {
    const taskId = getUuidParam(req, res, "taskId");
    if (!taskId) return;
    try {
      const task = await cancelOperationsTask(getActor(req), taskId);
      if (!task) return sendApiError(res, 404, "not_found", "Task not found");
      return res.json({ task: serializeObject(task) });
    } catch (err) {
      console.error("Operations cancel task failed", err);
      return sendApiError(
        res,
        500,
        "operations_task_cancel_failed",
        "Failed to cancel task",
      );
    }
  });

  router.get("/businesses", async (req, res) => {
    const pipelineStage =
      typeof req.query.pipelineStage === "string"
        ? parsePipelineStage(req.query.pipelineStage)
        : null;
    if (typeof req.query.pipelineStage === "string" && !pipelineStage) {
      return sendApiError(
        res,
        400,
        "invalid_pipeline_stage",
        "Pipeline stage is invalid",
      );
    }
    const relationshipType =
      typeof req.query.relationshipType === "string"
        ? parseRelationshipType(req.query.relationshipType)
        : null;
    if (typeof req.query.relationshipType === "string" && !relationshipType) {
      return sendApiError(
        res,
        400,
        "invalid_relationship_type",
        "Relationship type is invalid",
      );
    }
    const sort =
      typeof req.query.sort === "string" && SORT_SET.has(req.query.sort)
        ? (req.query.sort as "name" | "updated_desc" | "next_follow_up")
        : "updated_desc";
    const archived =
      req.query.archived === "true"
        ? true
        : req.query.archived === "false"
          ? false
          : null;
    try {
      return res.json(
        serializeObject(
          await listOperationsBusinesses({
            ...parsePagination(req),
            search:
              typeof req.query.search === "string" ? req.query.search : null,
            pipelineStage,
            relationshipType,
            archived,
            followUpDue: req.query.followUpDue === "true",
            sort,
          }),
        ),
      );
    } catch (err) {
      console.error("Operations businesses list failed", err);
      return sendApiError(
        res,
        500,
        "operations_businesses_failed",
        "Failed to load businesses",
      );
    }
  });

  router.post("/businesses", async (req, res) => {
    try {
      const input = parseOperationsBusinessInput(req.body);
      const business = await createOperationsBusiness(
        getActor(req),
        input as OperationsBusinessInput & {
          primaryContact?: OperationsContactInput | null;
          initialNote?: string | null;
        },
      );
      return res
        .status(201)
        .json({ business: serializeOperationsBusinessDetail(business) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations create business failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_create_failed",
        "Failed to create business",
      );
    }
  });

  router.get("/businesses/:businessId", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const detail = await getOperationsBusinessDetail(businessId);
      if (!detail)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.json({ business: serializeOperationsBusinessDetail(detail) });
    } catch (err) {
      console.error("Operations business detail failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_failed",
        "Failed to load business",
      );
    }
  });

  router.patch("/businesses/:businessId", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const detail = await updateOperationsBusiness(
        getActor(req),
        businessId,
        parseOperationsBusinessInput(req.body, { partial: true }),
      );
      if (!detail)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.json({ business: serializeOperationsBusinessDetail(detail) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations update business failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_update_failed",
        "Failed to update business",
      );
    }
  });

  router.get("/businesses/:businessId/communications", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      return res.json(
        serializeObject(
          await listOperationsCommunications({
            ...parseCommunicationListOptions(req),
            businessId,
          }),
        ),
      );
    } catch (err) {
      console.error("Operations business communications failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_communications_failed",
        "Failed to load business communications",
      );
    }
  });

  router.post(
    [
      "/businesses/:businessId/communications/draft",
      "/businesses/:businessId/communication-drafts",
    ],
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      if (!businessId) return;
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const record = body as Record<string, unknown>;
        const templateId = optionalUuidField(record, "templateId");
        if (!templateId) throw new Error("invalid_templateId");
        const contactId = optionalUuidField(record, "contactId");
        const followUpAt = parseDateField(record, "followUpAt");
        const reportName = optionalTextField(record, "reportName");
        const [template, context] = await Promise.all([
          getOperationsCommunicationTemplate(templateId),
          getOperationsCommunicationDraftContext(businessId, { contactId }),
        ]);
        if (!template)
          return sendApiError(res, 404, "not_found", "Template not found");
        if (!context)
          return sendApiError(res, 404, "not_found", "Business not found");
        const suggestedFollowUpAt =
          followUpAt ?? suggestedFollowUpDateForTemplate(template);
        const rendered = renderClientCommunicationTemplate(template, context, {
          ...getSenderDefaults(),
          followUpDate: suggestedFollowUpAt,
          reportName,
        });
        return res.json({
          draft: {
            templateId,
            contactId,
            followUpAt: serializeDate(followUpAt ?? null),
            suggestedFollowUpAt: serializeDate(suggestedFollowUpAt),
            contactWarning: context.contact?.do_not_contact
              ? {
                  doNotContact: true,
                  reason: context.contact.do_not_contact_reason,
                  preferredChannel: context.contact.preferred_channel,
                }
              : null,
            subject: rendered.subject,
            body: rendered.body,
            unresolvedPlaceholders: rendered.unresolvedPlaceholders,
          },
        });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations communication draft failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_draft_failed",
          "Failed to render communication draft",
        );
      }
    },
  );

  router.post("/businesses/:businessId/communications", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const input = parseOperationsCommunicationInput(req.body);
      const communication = await createOperationsCommunication(
        getActor(req),
        businessId,
        input as OperationsCommunicationInput,
      );
      if (communication === "business_not_found") {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if (communication === "contact_not_found") {
        return sendApiError(res, 404, "not_found", "Contact not found");
      }
      if (communication === "template_not_found") {
        return sendApiError(res, 404, "not_found", "Template not found");
      }
      return res
        .status(201)
        .json({ communication: serializeObject(communication) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations create communication failed", err);
      return sendApiError(
        res,
        500,
        "operations_communication_create_failed",
        "Failed to create communication",
      );
    }
  });

  router.patch(
    "/businesses/:businessId/communications/:communicationId",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!businessId || !communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const communication = await updateOperationsCommunication(
          getActor(req),
          businessId,
          communicationId,
          (() => {
            const input = parseOperationsCommunicationInput(req.body, {
              partial: true,
            });
            assertCommunicationCanTransition({
              status: input.status ?? existing.status,
              subject: input.subject ?? existing.subject,
              body: input.body ?? existing.body,
            });
            return input;
          })(),
        );
        if (communication === "business_not_found") {
          return sendApiError(res, 404, "not_found", "Business not found");
        }
        if (communication === "contact_not_found") {
          return sendApiError(res, 404, "not_found", "Contact not found");
        }
        if (communication === "template_not_found") {
          return sendApiError(res, 404, "not_found", "Template not found");
        }
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations update communication failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_update_failed",
          "Failed to update communication",
        );
      }
    },
  );

  router.post(
    "/businesses/:businessId/communications/:communicationId/mark-sent",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!businessId || !communicationId) return;
      try {
        const existing = await getCommunicationOr404(res, communicationId);
        if (!existing) return;
        const input = parseOperationsCommunicationInput(req.body, {
          partial: true,
        });
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const record = body as Record<string, unknown>;
        assertCommunicationCanTransition({
          status: "sent",
          subject: input.subject ?? existing.subject,
          body: input.body ?? existing.body,
          allowUnresolvedOverride:
            record.unresolvedPlaceholderOverride === true,
          overrideReason:
            typeof record.unresolvedPlaceholderOverrideReason === "string"
              ? record.unresolvedPlaceholderOverrideReason
              : null,
        });
        const communication = await markOperationsCommunicationSent(
          getActor(req),
          businessId,
          communicationId,
          {
            subject: input.subject,
            body: input.body,
            followUpAt: input.followUpAt,
            taskTitle: input.taskTitle,
            taskNotes: input.taskNotes,
          },
        );
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations mark communication sent failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_mark_sent_failed",
          "Failed to mark communication sent",
        );
      }
    },
  );

  router.post(
    "/businesses/:businessId/communications/:communicationId/cancel",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const communicationId = getUuidParam(req, res, "communicationId");
      if (!businessId || !communicationId) return;
      try {
        const communication = await cancelOperationsCommunication(
          getActor(req),
          businessId,
          communicationId,
        );
        if (!communication) {
          return sendApiError(res, 404, "not_found", "Communication not found");
        }
        return res.json({ communication: serializeObject(communication) });
      } catch (err) {
        console.error("Operations cancel communication failed", err);
        return sendApiError(
          res,
          500,
          "operations_communication_cancel_failed",
          "Failed to cancel communication",
        );
      }
    },
  );

  router.post("/businesses/:businessId/archive", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const business = await setOperationsBusinessArchived(
        getActor(req),
        businessId,
        true,
      );
      if (!business)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.json({ business: serializeObject(business) });
    } catch (err) {
      console.error("Operations archive business failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_archive_failed",
        "Failed to archive business",
      );
    }
  });

  router.post("/businesses/:businessId/restore", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const business = await setOperationsBusinessArchived(
        getActor(req),
        businessId,
        false,
      );
      if (!business)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.json({ business: serializeObject(business) });
    } catch (err) {
      console.error("Operations restore business failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_restore_failed",
        "Failed to restore business",
      );
    }
  });

  router.delete("/businesses/:businessId", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const result = await deleteOperationsBusiness(getActor(req), businessId);
      if (!result) {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if ("allowed" in result && result.allowed === false) {
        return sendApiError(
          res,
          409,
          "business_delete_blocked",
          "Business has operational history and cannot be hard deleted",
          {
            reasons: result.reasons,
            dependencyCounts: result.dependencyCounts,
          },
        );
      }
      return res.json({ business: serializeObject(result) });
    } catch (err) {
      console.error("Operations delete business failed", err);
      return sendApiError(
        res,
        500,
        "operations_business_delete_failed",
        "Failed to delete business",
      );
    }
  });

  router.post("/businesses/:businessId/contacts", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    try {
      const contact = await addOperationsContact(
        getActor(req),
        businessId,
        parseOperationsContactInput(req.body),
      );
      if (!contact)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.status(201).json({ contact: serializeObject(contact) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations add contact failed", err);
      return sendApiError(
        res,
        500,
        "operations_contact_add_failed",
        "Failed to add contact",
      );
    }
  });

  router.patch(
    "/businesses/:businessId/contacts/:contactId",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const contactId = getUuidParam(req, res, "contactId");
      if (!businessId || !contactId) return;
      try {
        const contact = await updateOperationsContact(
          getActor(req),
          businessId,
          contactId,
          parseOperationsContactInput(req.body, { allowEmpty: true }),
        );
        if (!contact)
          return sendApiError(res, 404, "not_found", "Contact not found");
        return res.json({ contact: serializeObject(contact) });
      } catch (err) {
        const handled = handleValidationError(res, err);
        if (handled) return handled;
        console.error("Operations update contact failed", err);
        return sendApiError(
          res,
          500,
          "operations_contact_update_failed",
          "Failed to update contact",
        );
      }
    },
  );

  router.delete(
    "/businesses/:businessId/contacts/:contactId",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const contactId = getUuidParam(req, res, "contactId");
      if (!businessId || !contactId) return;
      try {
        const deleted = await deleteOperationsContact(
          getActor(req),
          businessId,
          contactId,
        );
        if (!deleted)
          return sendApiError(res, 404, "not_found", "Contact not found");
        if (typeof deleted === "object" && deleted.allowed === false) {
          return sendApiError(
            res,
            409,
            "contact_delete_blocked",
            "Contact has operational history and cannot be hard deleted",
            {
              reasons: deleted.reasons,
              dependencyCounts: deleted.dependencyCounts,
            },
          );
        }
        return res.json({ ok: true });
      } catch (err) {
        console.error("Operations delete contact failed", err);
        return sendApiError(
          res,
          500,
          "operations_contact_delete_failed",
          "Failed to remove contact",
        );
      }
    },
  );

  router.post(
    "/businesses/:businessId/contacts/:contactId/archive",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const contactId = getUuidParam(req, res, "contactId");
      if (!businessId || !contactId) return;
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const contact = await setOperationsContactArchived(
          getActor(req),
          businessId,
          contactId,
          true,
          {
            allowNoPrimary:
              (body as Record<string, unknown>).allowNoPrimary === true,
          },
        );
        if (contact === "primary_contact_requires_confirmation") {
          return sendApiError(
            res,
            409,
            "primary_contact_requires_confirmation",
            "Choose another primary contact or confirm this business will have no primary contact",
          );
        }
        if (!contact) {
          return sendApiError(res, 404, "not_found", "Contact not found");
        }
        return res.json({ contact: serializeObject(contact) });
      } catch (err) {
        console.error("Operations archive contact failed", err);
        return sendApiError(
          res,
          500,
          "operations_contact_archive_failed",
          "Failed to archive contact",
        );
      }
    },
  );

  router.post(
    "/businesses/:businessId/contacts/:contactId/restore",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const contactId = getUuidParam(req, res, "contactId");
      if (!businessId || !contactId) return;
      try {
        const contact = await setOperationsContactArchived(
          getActor(req),
          businessId,
          contactId,
          false,
        );
        if (!contact || contact === "primary_contact_requires_confirmation") {
          return sendApiError(res, 404, "not_found", "Contact not found");
        }
        return res.json({ contact: serializeObject(contact) });
      } catch (err) {
        console.error("Operations restore contact failed", err);
        return sendApiError(
          res,
          500,
          "operations_contact_restore_failed",
          "Failed to restore contact",
        );
      }
    },
  );

  router.post(
    "/businesses/:businessId/contacts/:contactId/set-primary",
    async (req, res) => {
      const businessId = getUuidParam(req, res, "businessId");
      const contactId = getUuidParam(req, res, "contactId");
      if (!businessId || !contactId) return;
      try {
        const contact = await setPrimaryOperationsContact(
          getActor(req),
          businessId,
          contactId,
        );
        if (!contact)
          return sendApiError(res, 404, "not_found", "Contact not found");
        return res.json({ contact: serializeObject(contact) });
      } catch (err) {
        console.error("Operations set primary contact failed", err);
        return sendApiError(
          res,
          500,
          "operations_contact_primary_failed",
          "Failed to set primary contact",
        );
      }
    },
  );

  router.post("/businesses/:businessId/sites", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const siteId = (body as Record<string, unknown>).siteId;
    if (typeof siteId !== "string" || !UUID_RE.test(siteId)) {
      return sendApiError(res, 400, "invalid_site_id", "Site id is invalid");
    }
    try {
      const result = await linkOperationsBusinessSite(
        getActor(req),
        businessId,
        siteId,
      );
      if (result === "business_not_found") {
        return sendApiError(res, 404, "not_found", "Business not found");
      }
      if (result === "site_not_found") {
        return sendApiError(res, 404, "not_found", "Site not found");
      }
      if (result === "duplicate") {
        return sendApiError(
          res,
          409,
          "business_site_link_exists",
          "This site is already linked to the business",
        );
      }
      return res.status(201).json({ ok: true });
    } catch (err) {
      console.error("Operations link site failed", err);
      return sendApiError(
        res,
        500,
        "operations_site_link_failed",
        "Failed to link site",
      );
    }
  });

  router.delete("/businesses/:businessId/sites/:siteId", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    const siteId = getUuidParam(req, res, "siteId");
    if (!businessId || !siteId) return;
    try {
      const deleted = await unlinkOperationsBusinessSite(
        getActor(req),
        businessId,
        siteId,
      );
      if (!deleted)
        return sendApiError(res, 404, "not_found", "Link not found");
      return res.json({ ok: true });
    } catch (err) {
      console.error("Operations unlink site failed", err);
      return sendApiError(
        res,
        500,
        "operations_site_unlink_failed",
        "Failed to unlink site",
      );
    }
  });

  router.post("/businesses/:businessId/notes", async (req, res) => {
    const businessId = getUuidParam(req, res, "businessId");
    if (!businessId) return;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const noteBody = textField(body as Record<string, unknown>, "body");
    try {
      const note = await addOperationsBusinessNote(
        getActor(req),
        businessId,
        noteBody ?? "",
      );
      if (!note)
        return sendApiError(res, 404, "not_found", "Business not found");
      return res.status(201).json({ note: serializeObject(note) });
    } catch (err) {
      const handled = handleValidationError(res, err);
      if (handled) return handled;
      console.error("Operations add note failed", err);
      return sendApiError(
        res,
        500,
        "operations_note_add_failed",
        "Failed to add note",
      );
    }
  });

  app.use("/operations", router);
}
