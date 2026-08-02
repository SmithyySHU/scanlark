import express from "express";
import type { Request, Response } from "express";
import {
  addOperationsBusinessNote,
  addOperationsContact,
  cancelOperationsCommunication,
  cancelOperationsTask,
  completeOperationsTask,
  completeOperationsCommunicationFollowUp,
  createOperationsCommunication,
  createOperationsCommunicationTemplate,
  createOperationsTask,
  createOperationsBusiness,
  deleteOperationsContact,
  getOperationsCommunication,
  getOperationsCommunicationDraftContext,
  getOperationsCommunicationTemplate,
  getOperationsBusinessDetail,
  getOperationsSummary,
  linkOperationsBusinessSite,
  listOperationsCommunicationTemplates,
  listOperationsCommunications,
  listOperationsAvailableSites,
  listOperationsBusinesses,
  listOperationsPipeline,
  listOperationsTasks,
  markOperationsCommunicationReceived,
  markOperationsCommunicationSent,
  setOperationsCommunicationTemplateActive,
  setOperationsBusinessArchived,
  setPrimaryOperationsContact,
  snoozeOperationsTask,
  unlinkOperationsBusinessSite,
  updateOperationsBusiness,
  updateOperationsCommunication,
  updateOperationsCommunicationTemplate,
  updateOperationsTask,
  updateOperationsContact,
  type AdminActor,
  type OperationsBusinessInput,
  type OperationsCommunicationInput,
  type OperationsCommunicationListOptions,
  type OperationsCommunicationTemplateCategory,
  type OperationsCommunicationTemplateRow,
  type OperationsContactInput,
  type OperationsTaskStatus,
} from "@scanlark/db";
import { adminGuard } from "../adminAccess";
import {
  OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES,
  addBusinessDays,
  getConfiguredDefaultFollowUpBusinessDays,
  OPERATIONS_TASK_STATUSES,
  SUPPORTED_CLIENT_TEMPLATE_PLACEHOLDERS,
  parseOperationsBusinessInput,
  parseOperationsCommunicationInput,
  parseOperationsCommunicationTemplateInput,
  parseOperationsContactInput,
  parseOperationsTaskInput,
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
) {
  return res.status(status).json({ error, message });
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

async function getCommunicationOr404(res: Response, communicationId: string) {
  const communication = await getOperationsCommunication(communicationId);
  if (!communication) {
    sendApiError(res, 404, "not_found", "Communication not found");
    return null;
  }
  return communication;
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
    message === "invalid_task_status" ||
    message === "invalid_preferred_channel" ||
    message === "invalid_default_follow_up_business_days"
  ) {
    return sendApiError(res, 400, message, "Request value is invalid");
  }
  if (message === "invalid_date") {
    return sendApiError(res, 400, message, "Date value is invalid");
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
      const communication = await updateOperationsCommunication(
        getActor(req),
        existing.business_id,
        communicationId,
        parseOperationsCommunicationInput(req.body, { partial: true }),
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
        const communication = await updateOperationsCommunication(
          getActor(req),
          businessId,
          communicationId,
          parseOperationsCommunicationInput(req.body, { partial: true }),
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
        const input = parseOperationsCommunicationInput(req.body, {
          partial: true,
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
