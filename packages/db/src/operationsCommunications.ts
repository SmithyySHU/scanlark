import { recordAdminAuditLog, type AdminActor } from "./admin";
import { ensureConnected } from "./client";

export const OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES = [
  "warm_introduction",
  "cold_outreach",
  "report_offer",
  "report_delivery",
  "no_reply_follow_up",
  "interested_reply",
  "pre_quote_questions",
  "quote_delivery",
  "access_request",
  "work_started",
  "work_completed",
  "monitoring_offer",
  "monthly_update",
  "testimonial_request",
  "referral_request",
  "managed_service_proposal",
  "service_activation",
  "monitoring_started",
  "monthly_report_delivery",
  "website_issue_notification",
  "client_action_required",
  "allowance_nearing_limit",
  "work_outside_plan",
  "service_review",
  "renewal_discussion",
  "service_paused",
  "cancellation_acknowledgement",
  "service_ended",
  "custom",
] as const;

export const OPERATIONS_COMMUNICATION_DIRECTIONS = [
  "outbound",
  "inbound",
  "internal_note",
] as const;

export const OPERATIONS_COMMUNICATION_CHANNELS = [
  "email",
  "phone",
  "video_call",
  "in_person",
  "other",
] as const;

export const OPERATIONS_COMMUNICATION_STATUSES = [
  "draft",
  "ready",
  "sent",
  "received",
  "cancelled",
] as const;

export const OPERATIONS_TASK_STATUSES = [
  "open",
  "completed",
  "snoozed",
  "cancelled",
] as const;

export type OperationsCommunicationTemplateCategory =
  (typeof OPERATIONS_COMMUNICATION_TEMPLATE_CATEGORIES)[number];
export type OperationsCommunicationDirection =
  (typeof OPERATIONS_COMMUNICATION_DIRECTIONS)[number];
export type OperationsCommunicationChannel =
  (typeof OPERATIONS_COMMUNICATION_CHANNELS)[number];
export type OperationsCommunicationStatus =
  (typeof OPERATIONS_COMMUNICATION_STATUSES)[number];
export type OperationsTaskStatus = (typeof OPERATIONS_TASK_STATUSES)[number];

export type OperationsCommunicationTemplateRow = {
  id: string;
  system_key: string | null;
  name: string;
  category: OperationsCommunicationTemplateCategory;
  subject_template: string;
  body_template: string;
  default_follow_up_business_days: number | null;
  is_active: boolean;
  is_system_default: boolean;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsCommunicationRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  template_id: string | null;
  direction: OperationsCommunicationDirection;
  channel: OperationsCommunicationChannel;
  status: OperationsCommunicationStatus;
  subject: string | null;
  body: string;
  sent_at: Date | null;
  received_at: Date | null;
  occurred_at: Date;
  follow_up_at: Date | null;
  follow_up_completed_at: Date | null;
  external_message_id: string | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  template_name?: string | null;
  business_name?: string | null;
};

export type OperationsTaskRow = {
  id: string;
  business_id: string;
  contact_id: string | null;
  source_communication_id: string | null;
  source_client_service_id?: string | null;
  source_service_site_id?: string | null;
  source_key?: string | null;
  title: string;
  notes: string | null;
  due_at: Date;
  status: OperationsTaskStatus;
  completed_at: Date | null;
  snoozed_until: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  business_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
};

export type OperationsCommunicationInput = {
  contactId?: string | null;
  templateId?: string | null;
  direction?: OperationsCommunicationDirection;
  channel?: OperationsCommunicationChannel;
  status?: OperationsCommunicationStatus;
  subject?: string | null;
  body: string;
  occurredAt?: Date | null;
  sentAt?: Date | null;
  receivedAt?: Date | null;
  followUpAt?: Date | null;
  externalMessageId?: string | null;
  taskTitle?: string | null;
  taskNotes?: string | null;
};

export type OperationsTaskInput = {
  businessId: string;
  contactId?: string | null;
  sourceCommunicationId?: string | null;
  title: string;
  notes?: string | null;
  dueAt: Date;
};

export type OperationsCommunicationDraftContext = {
  business: {
    id: string;
    name: string;
    website_url: string | null;
    general_email: string | null;
  };
  contact: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    do_not_contact: boolean;
    do_not_contact_reason: string | null;
    preferred_channel: string | null;
  } | null;
  site: {
    site_id: string;
    url: string;
    site_display_name: string | null;
    latest_scan_id: string | null;
    critical_issue_count: number;
    high_issue_count: number;
    top_finding: string | null;
  } | null;
};

export type OperationsCommunicationListOptions = {
  businessId?: string | null;
  contactId?: string | null;
  direction?: OperationsCommunicationDirection | null;
  channel?: OperationsCommunicationChannel | null;
  status?: OperationsCommunicationStatus | null;
  templateCategory?: OperationsCommunicationTemplateCategory | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  followUpDue?: boolean;
  search?: string | null;
  limit: number;
  offset: number;
};

type CountRow = { count: string };

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function textValue(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureBusinessExists(businessId: string) {
  const client = await ensureConnected();
  const res = await client.query<{ id: string }>(
    `SELECT id FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  return Boolean(res.rows[0]);
}

async function validateBusinessChildIds(input: {
  businessId: string;
  contactId?: string | null;
  templateId?: string | null;
}) {
  const client = await ensureConnected();
  const business = await client.query<{ id: string }>(
    `SELECT id FROM operations_businesses WHERE id = $1`,
    [input.businessId],
  );
  if (!business.rows[0]) return "business_not_found" as const;

  if (input.contactId) {
    const contact = await client.query<{ id: string }>(
      `SELECT id FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
      [input.contactId, input.businessId],
    );
    if (!contact.rows[0]) return "contact_not_found" as const;
  }

  if (input.templateId) {
    const template = await client.query<{ id: string }>(
      `SELECT id FROM operations_client_communication_templates WHERE id = $1`,
      [input.templateId],
    );
    if (!template.rows[0]) return "template_not_found" as const;
  }

  return "ok" as const;
}

async function syncBusinessFollowUpFields(businessId: string) {
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE operations_businesses b
      SET next_follow_up_at = task.next_due_at,
          next_action = task.next_title,
          updated_at = now()
      FROM (
        SELECT t.business_id,
               COALESCE(t.snoozed_until, t.due_at) AS next_due_at,
               t.title AS next_title
        FROM operations_tasks t
        WHERE t.business_id = $1
          AND t.status IN ('open', 'snoozed')
        ORDER BY COALESCE(t.snoozed_until, t.due_at) ASC, t.created_at ASC
        LIMIT 1
      ) task
      WHERE b.id = task.business_id
    `,
    [businessId],
  );
  await client.query(
    `
      UPDATE operations_businesses b
      SET next_follow_up_at = NULL,
          next_action = NULL,
          updated_at = now()
      WHERE b.id = $1
        AND NOT EXISTS (
          SELECT 1
          FROM operations_tasks t
          WHERE t.business_id = b.id
            AND t.status IN ('open', 'snoozed')
        )
    `,
    [businessId],
  );
}

async function upsertFollowUpTask(
  actor: AdminActor,
  input: OperationsTaskInput,
) {
  const client = await ensureConnected();
  const title = textValue(input.title);
  if (!title) throw new Error("task_title_required");
  const notes = textValue(input.notes);

  let task: OperationsTaskRow | null = null;
  if (input.sourceCommunicationId) {
    const res = await client.query<OperationsTaskRow>(
      `
        INSERT INTO operations_tasks (
          business_id,
          contact_id,
          source_communication_id,
          title,
          notes,
          due_at,
          status,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'open', $7)
        ON CONFLICT (source_communication_id)
        WHERE source_communication_id IS NOT NULL
        DO UPDATE SET
          business_id = EXCLUDED.business_id,
          contact_id = EXCLUDED.contact_id,
          title = EXCLUDED.title,
          notes = EXCLUDED.notes,
          due_at = EXCLUDED.due_at,
          status = 'open',
          completed_at = NULL,
          snoozed_until = NULL,
          updated_at = now()
        RETURNING *
      `,
      [
        input.businessId,
        input.contactId ?? null,
        input.sourceCommunicationId,
        title,
        notes,
        input.dueAt,
        actor.id,
      ],
    );
    task = res.rows[0] ?? null;
  } else {
    const res = await client.query<OperationsTaskRow>(
      `
        INSERT INTO operations_tasks (
          business_id,
          contact_id,
          title,
          notes,
          due_at,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        input.businessId,
        input.contactId ?? null,
        title,
        notes,
        input.dueAt,
        actor.id,
      ],
    );
    task = res.rows[0] ?? null;
  }

  if (task) {
    await syncBusinessFollowUpFields(input.businessId);
    await recordAdminAuditLog(actor, {
      action: "operations.task.schedule",
      targetType: "operations_task",
      targetId: task.id,
      metadata: {
        businessId: input.businessId,
        contactId: input.contactId ?? null,
        sourceCommunicationId: input.sourceCommunicationId ?? null,
        dueAt: input.dueAt.toISOString(),
      },
    });
  }
  return task;
}

export async function listOperationsCommunicationTemplates(
  options: {
    activeOnly?: boolean;
  } = {},
) {
  const client = await ensureConnected();
  const filters = options.activeOnly ? "WHERE is_active = true" : "";
  const res = await client.query<OperationsCommunicationTemplateRow>(
    `
      SELECT *
      FROM operations_client_communication_templates
      ${filters}
      ORDER BY is_system_default DESC, category ASC, name ASC
    `,
  );
  return res.rows;
}

export async function createOperationsCommunicationTemplate(
  actor: AdminActor,
  input: {
    name: string;
    category: OperationsCommunicationTemplateCategory;
    subjectTemplate: string;
    bodyTemplate: string;
    defaultFollowUpBusinessDays?: number | null;
    isActive?: boolean;
  },
) {
  const name = textValue(input.name);
  const subject = textValue(input.subjectTemplate);
  const body = textValue(input.bodyTemplate);
  if (!name) throw new Error("template_name_required");
  if (!subject) throw new Error("template_subject_required");
  if (!body) throw new Error("template_body_required");

  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationTemplateRow>(
    `
      INSERT INTO operations_client_communication_templates (
        name,
        category,
        subject_template,
        body_template,
        default_follow_up_business_days,
        is_active,
        created_by_user_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      name,
      input.category,
      subject,
      body,
      input.defaultFollowUpBusinessDays ?? null,
      input.isActive !== false,
      actor.id,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations.communication_template.create",
    targetType: "operations_communication_template",
    targetId: res.rows[0].id,
    metadata: { category: input.category, isActive: input.isActive !== false },
  });
  return res.rows[0];
}

export async function updateOperationsCommunicationTemplate(
  actor: AdminActor,
  templateId: string,
  input: Partial<{
    name: string;
    category: OperationsCommunicationTemplateCategory;
    subjectTemplate: string;
    bodyTemplate: string;
    defaultFollowUpBusinessDays: number | null;
    isActive: boolean;
  }>,
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  function setColumn(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (input.name !== undefined) {
    const name = textValue(input.name);
    if (!name) throw new Error("template_name_required");
    setColumn("name", name);
  }
  if (input.category !== undefined) setColumn("category", input.category);
  if (input.subjectTemplate !== undefined) {
    const subject = textValue(input.subjectTemplate);
    if (!subject) throw new Error("template_subject_required");
    setColumn("subject_template", subject);
  }
  if (input.bodyTemplate !== undefined) {
    const body = textValue(input.bodyTemplate);
    if (!body) throw new Error("template_body_required");
    setColumn("body_template", body);
  }
  if (input.defaultFollowUpBusinessDays !== undefined) {
    setColumn(
      "default_follow_up_business_days",
      input.defaultFollowUpBusinessDays,
    );
  }
  if (input.isActive !== undefined) setColumn("is_active", input.isActive);
  if (sets.length === 0) {
    const client = await ensureConnected();
    const current = await client.query<OperationsCommunicationTemplateRow>(
      `SELECT * FROM operations_client_communication_templates WHERE id = $1`,
      [templateId],
    );
    return current.rows[0] ?? null;
  }
  values.push(templateId);
  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationTemplateRow>(
    `
      UPDATE operations_client_communication_templates
      SET ${sets.join(", ")},
          updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );
  const template = res.rows[0] ?? null;
  if (template) {
    await recordAdminAuditLog(actor, {
      action: "operations.communication_template.update",
      targetType: "operations_communication_template",
      targetId: templateId,
      metadata: {
        category: template.category,
        isActive: template.is_active,
        changedFields: Object.keys(input),
      },
    });
  }
  return template;
}

export async function getOperationsCommunicationTemplate(templateId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationTemplateRow>(
    `SELECT * FROM operations_client_communication_templates WHERE id = $1`,
    [templateId],
  );
  return res.rows[0] ?? null;
}

export async function setOperationsCommunicationTemplateActive(
  actor: AdminActor,
  templateId: string,
  isActive: boolean,
) {
  const template = await updateOperationsCommunicationTemplate(
    actor,
    templateId,
    { isActive },
  );
  if (template) {
    await recordAdminAuditLog(actor, {
      action: isActive
        ? "operations.communication_template.restore"
        : "operations.communication_template.archive",
      targetType: "operations_communication_template",
      targetId: templateId,
      metadata: { category: template.category },
    });
  }
  return template;
}

export async function getOperationsCommunicationDraftContext(
  businessId: string,
  options: { contactId?: string | null } = {},
): Promise<OperationsCommunicationDraftContext | null> {
  const client = await ensureConnected();
  const businessRes = await client.query<{
    id: string;
    name: string;
    website_url: string | null;
    general_email: string | null;
  }>(
    `
      SELECT id, name, website_url, general_email
      FROM operations_businesses
      WHERE id = $1
    `,
    [businessId],
  );
  const business = businessRes.rows[0];
  if (!business) return null;

  const contactRes = await client.query<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    do_not_contact: boolean;
    do_not_contact_reason: string | null;
    preferred_channel: string | null;
  }>(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        do_not_contact,
        do_not_contact_reason,
        preferred_channel
      FROM operations_contacts
      WHERE business_id = $1
        AND archived_at IS NULL
        AND ($2::uuid IS NULL OR id = $2::uuid)
      ORDER BY
        CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN 0 ELSE 1 END,
        is_primary DESC,
        created_at ASC
      LIMIT 1
    `,
    [businessId, options.contactId ?? null],
  );

  const siteRes = await client.query<{
    site_id: string;
    url: string;
    site_display_name: string | null;
    latest_scan_id: string | null;
    critical_issue_count: number;
    high_issue_count: number;
    top_finding: string | null;
  }>(
    `
      SELECT
        s.id AS site_id,
        s.url,
        s.site_display_name,
        latest_scan.id AS latest_scan_id,
        COALESCE(issue_summary.critical_issue_count, 0)::int AS critical_issue_count,
        COALESCE(issue_summary.high_issue_count, 0)::int AS high_issue_count,
        top_issue.issue_text AS top_finding
      FROM operations_business_sites obs
      JOIN sites s ON s.id = obs.site_id
      LEFT JOIN LATERAL (
        SELECT r.id
        FROM scan_runs r
        WHERE r.site_id = s.id
          AND r.status = 'completed'
        ORDER BY r.finished_at DESC NULLS LAST, r.started_at DESC
        LIMIT 1
      ) latest_scan ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE si.severity = 'critical' AND si.status = 'open')::int AS critical_issue_count,
          COUNT(*) FILTER (WHERE si.severity = 'high' AND si.status = 'open')::int AS high_issue_count
        FROM scan_issues si
        WHERE si.scan_run_id = latest_scan.id
      ) issue_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT CONCAT(si.severity, ' issue on ', si.affected_url) AS issue_text
        FROM scan_issues si
        WHERE si.scan_run_id = latest_scan.id
          AND si.status = 'open'
        ORDER BY
          CASE si.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          si.first_seen_at ASC
        LIMIT 1
      ) top_issue ON TRUE
      WHERE obs.business_id = $1
      ORDER BY latest_scan.id IS NULL ASC, obs.created_at ASC
      LIMIT 1
    `,
    [businessId],
  );

  return {
    business,
    contact: contactRes.rows[0] ?? null,
    site: siteRes.rows[0] ?? null,
  };
}

export async function listOperationsCommunications(
  options: OperationsCommunicationListOptions,
) {
  const client = await ensureConnected();
  const values: unknown[] = [];
  const filters: string[] = [];
  if (options.businessId) {
    values.push(options.businessId);
    filters.push(`c.business_id = $${values.length}`);
  }
  if (options.contactId) {
    values.push(options.contactId);
    filters.push(`c.contact_id = $${values.length}`);
  }
  if (options.direction) {
    values.push(options.direction);
    filters.push(`c.direction = $${values.length}`);
  }
  if (options.channel) {
    values.push(options.channel);
    filters.push(`c.channel = $${values.length}`);
  }
  if (options.status) {
    values.push(options.status);
    filters.push(`c.status = $${values.length}`);
  }
  if (options.templateCategory) {
    values.push(options.templateCategory);
    filters.push(`template.category = $${values.length}`);
  }
  if (options.dateFrom) {
    values.push(options.dateFrom);
    filters.push(`c.occurred_at >= $${values.length}`);
  }
  if (options.dateTo) {
    values.push(options.dateTo);
    filters.push(`c.occurred_at <= $${values.length}`);
  }
  if (options.followUpDue) {
    filters.push(`c.follow_up_at IS NOT NULL`);
    filters.push(`c.follow_up_completed_at IS NULL`);
    filters.push(`c.follow_up_at <= NOW()`);
    filters.push(`c.status <> 'cancelled'`);
  }
  const search = textValue(options.search);
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    filters.push(
      `(
        lower(COALESCE(c.subject, '')) LIKE $${values.length}
        OR lower(b.name) LIKE $${values.length}
        OR lower(COALESCE(contact.first_name, '') || ' ' || COALESCE(contact.last_name, '')) LIKE $${values.length}
        OR lower(COALESCE(contact.email, '')) LIKE $${values.length}
      )`,
    );
  }
  values.push(options.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(options.offset);
  const offsetPlaceholder = `$${values.length}`;
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const [rows, total] = await Promise.all([
    client.query<OperationsCommunicationRow>(
      `
        SELECT c.*,
               b.name AS business_name,
               contact.first_name AS contact_first_name,
               contact.last_name AS contact_last_name,
               contact.email AS contact_email,
               template.name AS template_name
        FROM operations_communications c
        JOIN operations_businesses b ON b.id = c.business_id
        LEFT JOIN operations_contacts contact ON contact.id = c.contact_id
        LEFT JOIN operations_client_communication_templates template
          ON template.id = c.template_id
        ${where}
        ORDER BY c.occurred_at DESC, c.created_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      values,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_communications c
        JOIN operations_businesses b ON b.id = c.business_id
        LEFT JOIN operations_contacts contact ON contact.id = c.contact_id
        LEFT JOIN operations_client_communication_templates template
          ON template.id = c.template_id
        ${where}
      `,
      values.slice(0, values.length - 2),
    ),
  ]);
  return {
    communications: rows.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: rows.rows.length,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function getOperationsCommunication(communicationId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationRow>(
    `
      SELECT c.*,
             b.name AS business_name,
             contact.first_name AS contact_first_name,
             contact.last_name AS contact_last_name,
             contact.email AS contact_email,
             template.name AS template_name
      FROM operations_communications c
      JOIN operations_businesses b ON b.id = c.business_id
      LEFT JOIN operations_contacts contact ON contact.id = c.contact_id
      LEFT JOIN operations_client_communication_templates template
        ON template.id = c.template_id
      WHERE c.id = $1
    `,
    [communicationId],
  );
  return res.rows[0] ?? null;
}

export async function createOperationsCommunication(
  actor: AdminActor,
  businessId: string,
  input: OperationsCommunicationInput,
) {
  const valid = await validateBusinessChildIds({
    businessId,
    contactId: input.contactId,
    templateId: input.templateId,
  });
  if (valid !== "ok") return valid;
  const body = textValue(input.body);
  if (!body) throw new Error("communication_body_required");
  const status = input.status ?? "draft";
  const direction = input.direction ?? "outbound";
  const channel = input.channel ?? "email";
  const now = new Date();
  const sentAt = status === "sent" ? (input.sentAt ?? now) : input.sentAt;
  const receivedAt =
    status === "received" ? (input.receivedAt ?? now) : input.receivedAt;
  const occurredAt = input.occurredAt ?? sentAt ?? receivedAt ?? now;

  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const res = await client.query<OperationsCommunicationRow>(
      `
        INSERT INTO operations_communications (
          business_id,
          contact_id,
          template_id,
          direction,
          channel,
          status,
          subject,
          body,
          sent_at,
          received_at,
          occurred_at,
          follow_up_at,
          external_message_id,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        businessId,
        input.contactId ?? null,
        input.templateId ?? null,
        direction,
        channel,
        status,
        textValue(input.subject),
        body,
        sentAt ?? null,
        receivedAt ?? null,
        occurredAt,
        input.followUpAt ?? null,
        textValue(input.externalMessageId),
        actor.id,
      ],
    );
    const communication = res.rows[0];
    if (status === "sent" || status === "received") {
      await client.query(
        `
          UPDATE operations_businesses
          SET last_contacted_at = $2,
              updated_at = now()
          WHERE id = $1
        `,
        [businessId, occurredAt],
      );
    } else {
      await client.query(
        `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
        [businessId],
      );
    }
    await client.query("COMMIT");

    if (input.followUpAt) {
      await upsertFollowUpTask(actor, {
        businessId,
        contactId: input.contactId ?? null,
        sourceCommunicationId: communication.id,
        title:
          textValue(input.taskTitle) ??
          `Follow up on ${textValue(input.subject) ?? "communication"}`,
        notes: input.taskNotes,
        dueAt: input.followUpAt,
      });
    } else {
      await syncBusinessFollowUpFields(businessId);
    }

    await recordAdminAuditLog(actor, {
      action:
        status === "draft"
          ? "operations.communication.draft_create"
          : "operations.communication.create",
      targetType: "operations_communication",
      targetId: communication.id,
      metadata: {
        businessId,
        contactId: input.contactId ?? null,
        templateId: input.templateId ?? null,
        direction,
        channel,
        status,
        hasFollowUp: input.followUpAt != null,
      },
    });
    return communication;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function updateOperationsCommunication(
  actor: AdminActor,
  businessId: string,
  communicationId: string,
  input: Partial<OperationsCommunicationInput>,
) {
  const existing = await getOperationsCommunication(communicationId);
  if (!existing || existing.business_id !== businessId) return null;
  if (
    (existing.status === "sent" || existing.status === "received") &&
    (input.subject !== undefined ||
      input.body !== undefined ||
      input.status !== undefined ||
      input.direction !== undefined ||
      input.channel !== undefined ||
      input.sentAt !== undefined ||
      input.receivedAt !== undefined ||
      input.occurredAt !== undefined)
  ) {
    throw new Error("communication_sent_locked");
  }
  const valid = await validateBusinessChildIds({
    businessId,
    contactId: input.contactId,
    templateId: input.templateId,
  });
  if (valid !== "ok") return valid;
  const sets: string[] = [];
  const values: unknown[] = [];
  function setColumn(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (input.contactId !== undefined) setColumn("contact_id", input.contactId);
  if (input.templateId !== undefined) {
    setColumn("template_id", input.templateId);
  }
  if (input.direction !== undefined) setColumn("direction", input.direction);
  if (input.channel !== undefined) setColumn("channel", input.channel);
  if (input.status !== undefined) setColumn("status", input.status);
  if (input.subject !== undefined) {
    setColumn("subject", textValue(input.subject));
  }
  if (input.body !== undefined) {
    const body = textValue(input.body);
    if (!body) throw new Error("communication_body_required");
    setColumn("body", body);
  }
  if (input.occurredAt !== undefined) {
    setColumn("occurred_at", input.occurredAt);
  }
  if (input.sentAt !== undefined) setColumn("sent_at", input.sentAt);
  if (input.receivedAt !== undefined) {
    setColumn("received_at", input.receivedAt);
  }
  if (input.followUpAt !== undefined) {
    setColumn("follow_up_at", input.followUpAt);
  }
  if (input.externalMessageId !== undefined) {
    setColumn("external_message_id", textValue(input.externalMessageId));
  }
  if (sets.length === 0) {
    const existing = await listOperationsCommunications({
      businessId,
      limit: 100,
      offset: 0,
    });
    return (
      existing.communications.find((item) => item.id === communicationId) ??
      null
    );
  }
  values.push(communicationId, businessId);
  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationRow>(
    `
      UPDATE operations_communications
      SET ${sets.join(", ")},
          updated_at = now()
      WHERE id = $${values.length - 1}
        AND business_id = $${values.length}
      RETURNING *
    `,
    values,
  );
  const communication = res.rows[0] ?? null;
  if (!communication) return null;
  if (input.followUpAt) {
    await upsertFollowUpTask(actor, {
      businessId,
      contactId: communication.contact_id,
      sourceCommunicationId: communication.id,
      title:
        textValue(input.taskTitle) ??
        `Follow up on ${textValue(communication.subject) ?? "communication"}`,
      notes: input.taskNotes,
      dueAt: input.followUpAt,
    });
  } else if (input.followUpAt === null) {
    await syncBusinessFollowUpFields(businessId);
  }
  await recordAdminAuditLog(actor, {
    action: "operations.communication.update",
    targetType: "operations_communication",
    targetId: communicationId,
    metadata: {
      businessId,
      changedFields: Object.keys(input).filter(
        (key) => key !== "body" && key !== "subject",
      ),
      hasSubjectChange: input.subject !== undefined,
      hasBodyChange: input.body !== undefined,
    },
  });
  return communication;
}

export async function markOperationsCommunicationSent(
  actor: AdminActor,
  businessId: string,
  communicationId: string,
  input: {
    subject?: string | null;
    body?: string | null;
    followUpAt?: Date | null;
    taskTitle?: string | null;
    taskNotes?: string | null;
  } = {},
) {
  const client = await ensureConnected();
  const now = new Date();
  const sets = [
    "status = 'sent'",
    "sent_at = COALESCE(sent_at, $3)",
    "occurred_at = $3",
    "updated_at = now()",
  ];
  const values: unknown[] = [communicationId, businessId, now];
  if (input.subject !== undefined) {
    values.push(textValue(input.subject));
    sets.push(`subject = $${values.length}`);
  }
  if (input.body !== undefined) {
    const body = textValue(input.body);
    if (!body) throw new Error("communication_body_required");
    values.push(body);
    sets.push(`body = $${values.length}`);
  }
  if (input.followUpAt !== undefined) {
    values.push(input.followUpAt);
    sets.push(`follow_up_at = $${values.length}`);
  }
  const res = await client.query<OperationsCommunicationRow>(
    `
      UPDATE operations_communications
      SET ${sets.join(", ")}
      WHERE id = $1
        AND business_id = $2
      RETURNING *
    `,
    values,
  );
  const communication = res.rows[0] ?? null;
  if (!communication) return null;
  await client.query(
    `
      UPDATE operations_businesses
      SET last_contacted_at = $2,
          updated_at = now()
      WHERE id = $1
    `,
    [businessId, now],
  );
  if (communication.follow_up_at) {
    await upsertFollowUpTask(actor, {
      businessId,
      contactId: communication.contact_id,
      sourceCommunicationId: communication.id,
      title:
        textValue(input.taskTitle) ??
        `Follow up on ${textValue(communication.subject) ?? "communication"}`,
      notes: input.taskNotes,
      dueAt: communication.follow_up_at,
    });
  } else {
    await syncBusinessFollowUpFields(businessId);
  }
  await recordAdminAuditLog(actor, {
    action: "operations.communication.mark_sent",
    targetType: "operations_communication",
    targetId: communicationId,
    metadata: {
      businessId,
      contactId: communication.contact_id,
      hasFollowUp: communication.follow_up_at != null,
      hasSubjectChange: input.subject !== undefined,
      hasBodyChange: input.body !== undefined,
    },
  });
  return communication;
}

export async function markOperationsCommunicationReceived(
  actor: AdminActor,
  businessId: string,
  communicationId: string,
  input: {
    subject?: string | null;
    body?: string | null;
    followUpAt?: Date | null;
    taskTitle?: string | null;
    taskNotes?: string | null;
  } = {},
) {
  const client = await ensureConnected();
  const now = new Date();
  const sets = [
    "direction = 'inbound'",
    "status = 'received'",
    "received_at = COALESCE(received_at, $3)",
    "occurred_at = $3",
    "updated_at = now()",
  ];
  const values: unknown[] = [communicationId, businessId, now];
  if (input.subject !== undefined) {
    values.push(textValue(input.subject));
    sets.push(`subject = $${values.length}`);
  }
  if (input.body !== undefined) {
    const body = textValue(input.body);
    if (!body) throw new Error("communication_body_required");
    values.push(body);
    sets.push(`body = $${values.length}`);
  }
  if (input.followUpAt !== undefined) {
    values.push(input.followUpAt);
    sets.push(`follow_up_at = $${values.length}`);
  }
  const res = await client.query<OperationsCommunicationRow>(
    `
      UPDATE operations_communications
      SET ${sets.join(", ")}
      WHERE id = $1
        AND business_id = $2
      RETURNING *
    `,
    values,
  );
  const communication = res.rows[0] ?? null;
  if (!communication) return null;
  await client.query(
    `
      UPDATE operations_businesses
      SET last_contacted_at = $2,
          updated_at = now()
      WHERE id = $1
    `,
    [businessId, now],
  );
  if (communication.follow_up_at) {
    await upsertFollowUpTask(actor, {
      businessId,
      contactId: communication.contact_id,
      sourceCommunicationId: communication.id,
      title:
        textValue(input.taskTitle) ??
        `Follow up on ${textValue(communication.subject) ?? "reply"}`,
      notes: input.taskNotes,
      dueAt: communication.follow_up_at,
    });
  } else {
    await syncBusinessFollowUpFields(businessId);
  }
  await recordAdminAuditLog(actor, {
    action: "operations.communication.mark_received",
    targetType: "operations_communication",
    targetId: communicationId,
    metadata: {
      businessId,
      contactId: communication.contact_id,
      hasFollowUp: communication.follow_up_at != null,
      hasSubjectChange: input.subject !== undefined,
      hasBodyChange: input.body !== undefined,
    },
  });
  return communication;
}

export async function completeOperationsCommunicationFollowUp(
  actor: AdminActor,
  communicationId: string,
) {
  const client = await ensureConnected();
  const taskRes = await client.query<OperationsTaskRow>(
    `
      SELECT *
      FROM operations_tasks
      WHERE source_communication_id = $1
        AND status IN ('open', 'snoozed')
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [communicationId],
  );
  const task = taskRes.rows[0] ?? null;
  if (task) return completeOperationsTask(actor, task.id);

  const now = new Date();
  const communicationRes = await client.query<OperationsCommunicationRow>(
    `
      UPDATE operations_communications
      SET follow_up_completed_at = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [communicationId, now],
  );
  const communication = communicationRes.rows[0] ?? null;
  if (!communication) return null;
  await syncBusinessFollowUpFields(communication.business_id);
  await recordAdminAuditLog(actor, {
    action: "operations.communication.follow_up_complete",
    targetType: "operations_communication",
    targetId: communicationId,
    metadata: { businessId: communication.business_id },
  });
  return null;
}

export async function cancelOperationsCommunication(
  actor: AdminActor,
  businessId: string,
  communicationId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsCommunicationRow>(
    `
      UPDATE operations_communications
      SET status = 'cancelled',
          updated_at = now()
      WHERE id = $1
        AND business_id = $2
      RETURNING *
    `,
    [communicationId, businessId],
  );
  const communication = res.rows[0] ?? null;
  if (!communication) return null;
  await client.query(
    `
      UPDATE operations_tasks
      SET status = 'cancelled',
          updated_at = now()
      WHERE source_communication_id = $1
        AND status IN ('open', 'snoozed')
    `,
    [communicationId],
  );
  await syncBusinessFollowUpFields(businessId);
  await recordAdminAuditLog(actor, {
    action: "operations.communication.cancel",
    targetType: "operations_communication",
    targetId: communicationId,
    metadata: { businessId },
  });
  return communication;
}

export async function listOperationsTasks(options: {
  status?: OperationsTaskStatus | "active" | "due" | null;
  limit: number;
  offset: number;
}) {
  const client = await ensureConnected();
  const values: unknown[] = [];
  const filters: string[] = ["b.is_archived = false"];
  if (options.status === "active") {
    filters.push("t.status IN ('open', 'snoozed')");
  } else if (options.status === "due") {
    filters.push("t.status IN ('open', 'snoozed')");
    filters.push("COALESCE(t.snoozed_until, t.due_at) <= NOW()");
  } else if (options.status) {
    values.push(options.status);
    filters.push(`t.status = $${values.length}`);
  } else {
    filters.push("t.status IN ('open', 'snoozed')");
  }
  values.push(options.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(options.offset);
  const offsetPlaceholder = `$${values.length}`;
  const where = `WHERE ${filters.join(" AND ")}`;
  const [rows, total] = await Promise.all([
    client.query<OperationsTaskRow>(
      `
        SELECT t.*,
               b.name AS business_name,
               c.first_name AS contact_first_name,
               c.last_name AS contact_last_name,
               c.email AS contact_email
        FROM operations_tasks t
        JOIN operations_businesses b ON b.id = t.business_id
        LEFT JOIN operations_contacts c ON c.id = t.contact_id
        ${where}
        ORDER BY COALESCE(t.snoozed_until, t.due_at) ASC, t.created_at ASC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      values,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_tasks t
        JOIN operations_businesses b ON b.id = t.business_id
        ${where}
      `,
      values.slice(0, values.length - 2),
    ),
  ]);
  return {
    tasks: rows.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: rows.rows.length,
    limit: options.limit,
    offset: options.offset,
  };
}

export async function updateOperationsTask(
  actor: AdminActor,
  taskId: string,
  input: Partial<{
    title: string;
    notes: string | null;
    dueAt: Date;
    contactId: string | null;
    status: OperationsTaskStatus;
  }>,
) {
  const sets: string[] = [];
  const values: unknown[] = [];
  function setColumn(column: string, value: unknown) {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  if (input.title !== undefined) {
    const title = textValue(input.title);
    if (!title) throw new Error("task_title_required");
    setColumn("title", title);
  }
  if (input.notes !== undefined) setColumn("notes", textValue(input.notes));
  if (input.dueAt !== undefined) setColumn("due_at", input.dueAt);
  if (input.contactId !== undefined) setColumn("contact_id", input.contactId);
  if (input.status !== undefined) setColumn("status", input.status);
  if (sets.length === 0) return null;
  values.push(taskId);
  const client = await ensureConnected();
  const res = await client.query<OperationsTaskRow>(
    `
      UPDATE operations_tasks
      SET ${sets.join(", ")},
          updated_at = now()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  );
  const task = res.rows[0] ?? null;
  if (!task) return null;
  await syncBusinessFollowUpFields(task.business_id);
  await recordAdminAuditLog(actor, {
    action: "operations.task.update",
    targetType: "operations_task",
    targetId: taskId,
    metadata: {
      businessId: task.business_id,
      changedFields: Object.keys(input).filter((key) => key !== "notes"),
      hasNotesChange: input.notes !== undefined,
    },
  });
  return task;
}

export async function completeOperationsTask(
  actor: AdminActor,
  taskId: string,
) {
  const client = await ensureConnected();
  const now = new Date();
  const res = await client.query<OperationsTaskRow>(
    `
      UPDATE operations_tasks
      SET status = 'completed',
          completed_at = $2,
          snoozed_until = NULL,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [taskId, now],
  );
  const task = res.rows[0] ?? null;
  if (!task) return null;
  if (task.source_communication_id) {
    await client.query(
      `
        UPDATE operations_communications
        SET follow_up_completed_at = $2,
            updated_at = now()
        WHERE id = $1
      `,
      [task.source_communication_id, now],
    );
  }
  await syncBusinessFollowUpFields(task.business_id);
  await recordAdminAuditLog(actor, {
    action: "operations.task.complete",
    targetType: "operations_task",
    targetId: taskId,
    metadata: {
      businessId: task.business_id,
      sourceCommunicationId: task.source_communication_id,
    },
  });
  return task;
}

export async function snoozeOperationsTask(
  actor: AdminActor,
  taskId: string,
  snoozedUntil: Date,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsTaskRow>(
    `
      UPDATE operations_tasks
      SET status = 'snoozed',
          snoozed_until = $2,
          completed_at = NULL,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [taskId, snoozedUntil],
  );
  const task = res.rows[0] ?? null;
  if (!task) return null;
  await syncBusinessFollowUpFields(task.business_id);
  await recordAdminAuditLog(actor, {
    action: "operations.task.snooze",
    targetType: "operations_task",
    targetId: taskId,
    metadata: { businessId: task.business_id, snoozedUntil },
  });
  return task;
}

export async function cancelOperationsTask(actor: AdminActor, taskId: string) {
  const client = await ensureConnected();
  const res = await client.query<OperationsTaskRow>(
    `
      UPDATE operations_tasks
      SET status = 'cancelled',
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [taskId],
  );
  const task = res.rows[0] ?? null;
  if (!task) return null;
  await syncBusinessFollowUpFields(task.business_id);
  await recordAdminAuditLog(actor, {
    action: "operations.task.cancel",
    targetType: "operations_task",
    targetId: taskId,
    metadata: {
      businessId: task.business_id,
      sourceCommunicationId: task.source_communication_id,
    },
  });
  return task;
}

export async function getOperationsTaskCounts() {
  const client = await ensureConnected();
  const [followUpsDue, openWorkItems] = await Promise.all([
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_tasks t
        JOIN operations_businesses b ON b.id = t.business_id
        WHERE b.is_archived = false
          AND t.status IN ('open', 'snoozed')
          AND COALESCE(t.snoozed_until, t.due_at) <= NOW()
      `,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_tasks t
        JOIN operations_businesses b ON b.id = t.business_id
        WHERE b.is_archived = false
          AND t.status IN ('open', 'snoozed')
      `,
    ),
  ]);
  return {
    followUpsDue: countValue(followUpsDue.rows[0]),
    openWorkItems: countValue(openWorkItems.rows[0]),
  };
}

export async function createOperationsTask(
  actor: AdminActor,
  input: OperationsTaskInput,
) {
  if (!(await ensureBusinessExists(input.businessId))) {
    return "business_not_found" as const;
  }
  if (input.contactId) {
    const valid = await validateBusinessChildIds({
      businessId: input.businessId,
      contactId: input.contactId,
    });
    if (valid !== "ok") return valid;
  }
  return upsertFollowUpTask(actor, input);
}
