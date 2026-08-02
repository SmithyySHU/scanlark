import express from "express";
import type { Request, Response } from "express";
import {
  addOperationsBusinessNote,
  addOperationsContact,
  createOperationsBusiness,
  deleteOperationsContact,
  getOperationsBusinessDetail,
  getOperationsSummary,
  isValidEmailAddress,
  linkOperationsBusinessSite,
  listOperationsAvailableSites,
  listOperationsBusinesses,
  listOperationsPipeline,
  OPERATIONS_PIPELINE_STAGES,
  OPERATIONS_RELATIONSHIP_TYPES,
  setOperationsBusinessArchived,
  setPrimaryOperationsContact,
  unlinkOperationsBusinessSite,
  updateOperationsBusiness,
  updateOperationsContact,
  type AdminActor,
  type OperationsBusinessInput,
  type OperationsContactInput,
  type OperationsPipelineStage,
  type OperationsRelationshipType,
} from "@scanlark/db";
import { adminGuard } from "../adminAccess";
import { normalizeSiteUrlInput } from "../siteUrl";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PIPELINE_STAGE_SET = new Set<string>(OPERATIONS_PIPELINE_STAGES);
const RELATIONSHIP_TYPE_SET = new Set<string>(OPERATIONS_RELATIONSHIP_TYPES);
const SORT_SET = new Set(["name", "updated_desc", "next_follow_up"]);

function serializeDate(value: Date | null) {
  return value instanceof Date ? value.toISOString() : value;
}

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

function textField(input: Record<string, unknown>, key: string) {
  const value = input[key];
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalTextField(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return undefined;
  return textField(input, key);
}

function parseDateField(input: Record<string, unknown>, key: string) {
  if (!(key in input)) return undefined;
  const value = input[key];
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${key}_invalid`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${key}_invalid`);
  return date;
}

function parsePipelineStage(value: unknown): OperationsPipelineStage | null {
  if (typeof value !== "string") return null;
  return PIPELINE_STAGE_SET.has(value)
    ? (value as OperationsPipelineStage)
    : null;
}

function parseRelationshipType(
  value: unknown,
): OperationsRelationshipType | null {
  if (typeof value !== "string") return null;
  return RELATIONSHIP_TYPE_SET.has(value)
    ? (value as OperationsRelationshipType)
    : null;
}

export function parseOperationsBusinessInput(
  body: unknown,
  options: { partial?: boolean } = {},
): Partial<OperationsBusinessInput> & {
  primaryContact?: OperationsContactInput | null;
  initialNote?: string | null;
  markContactedNow?: boolean;
  clearNextFollowUp?: boolean;
} {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const name = optionalTextField(record, "name");
  if (!options.partial && !name) throw new Error("business_name_required");
  if (options.partial && "name" in record && !name) {
    throw new Error("business_name_required");
  }

  let pipelineStage: OperationsPipelineStage | undefined;
  if ("pipelineStage" in record) {
    const parsed = parsePipelineStage(record.pipelineStage);
    if (!parsed) throw new Error("invalid_pipeline_stage");
    pipelineStage = parsed;
  }

  let relationshipType: OperationsRelationshipType | undefined;
  if ("relationshipType" in record) {
    const parsed = parseRelationshipType(record.relationshipType);
    if (!parsed) throw new Error("invalid_relationship_type");
    relationshipType = parsed;
  }

  const generalEmail = optionalTextField(record, "generalEmail");
  if (generalEmail && !isValidEmailAddress(generalEmail)) {
    throw new Error("invalid_email");
  }

  let websiteUrl = optionalTextField(record, "websiteUrl");
  if (websiteUrl) {
    websiteUrl = normalizeSiteUrlInput(websiteUrl);
  }

  const primaryContactRecord =
    record.primaryContact && typeof record.primaryContact === "object"
      ? (record.primaryContact as Record<string, unknown>)
      : null;
  const primaryContact = primaryContactRecord
    ? parseOperationsContactInput(primaryContactRecord, { allowEmpty: true })
    : null;

  return {
    ...(name ? { name } : {}),
    ...(pipelineStage !== undefined ? { pipelineStage } : {}),
    ...(relationshipType !== undefined ? { relationshipType } : {}),
    source: optionalTextField(record, "source"),
    businessType: optionalTextField(record, "businessType"),
    location: optionalTextField(record, "location"),
    phone: optionalTextField(record, "phone"),
    generalEmail,
    websiteUrl,
    lastContactedAt: parseDateField(record, "lastContactedAt"),
    nextFollowUpAt: parseDateField(record, "nextFollowUpAt"),
    nextAction: optionalTextField(record, "nextAction"),
    primaryContact,
    initialNote: optionalTextField(record, "initialNote"),
    markContactedNow: record.markContactedNow === true,
    clearNextFollowUp: record.clearNextFollowUp === true,
  };
}

export function parseOperationsContactInput(
  body: unknown,
  options: { allowEmpty?: boolean } = {},
): OperationsContactInput {
  const input = body && typeof body === "object" ? body : {};
  const record = input as Record<string, unknown>;
  const email = optionalTextField(record, "email");
  if (email && !isValidEmailAddress(email)) {
    throw new Error("invalid_contact_email");
  }
  const contact = {
    firstName: optionalTextField(record, "firstName"),
    lastName: optionalTextField(record, "lastName"),
    email,
    phone: optionalTextField(record, "phone"),
    jobTitle: optionalTextField(record, "jobTitle"),
    notes: optionalTextField(record, "notes"),
    isPrimary: record.isPrimary === true,
  };
  if (
    !options.allowEmpty &&
    !contact.firstName &&
    !contact.lastName &&
    !contact.email &&
    !contact.phone
  ) {
    throw new Error("contact_details_required");
  }
  return contact;
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

function serializeOperationsBusinessDetail(
  detail: Awaited<ReturnType<typeof getOperationsBusinessDetail>>,
) {
  return serializeObject(detail);
}

export function serializeOperationsSummary(
  summary: Awaited<ReturnType<typeof getOperationsSummary>>,
) {
  return {
    counts: summary.counts,
    monitoringAttention: summary.monitoringAttention.map((item) => ({
      ...item,
      occurredAt: serializeDate(item.occurredAt),
    })),
    recentActivity: summary.recentActivity.map((item) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),
    })),
    generatedAt: summary.generatedAt.toISOString(),
  };
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
