import { ensureConnected } from "./client";
import { recordAdminAuditLog, type AdminActor } from "./admin";
import { getOperationsTaskCounts } from "./operationsCommunications";

export const OPERATIONS_PIPELINE_STAGES = [
  "discovered",
  "researched",
  "ready_to_contact",
  "email_sent",
  "replied",
  "report_requested",
  "report_sent",
  "quote_sent",
  "won",
  "ongoing_client",
  "closed",
] as const;

export const OPERATIONS_RELATIONSHIP_TYPES = [
  "prospect",
  "client",
  "former_client",
  "partner",
  "other",
] as const;

export type OperationsPipelineStage =
  (typeof OPERATIONS_PIPELINE_STAGES)[number];
export type OperationsRelationshipType =
  (typeof OPERATIONS_RELATIONSHIP_TYPES)[number];

export type OperationsBusinessRow = {
  id: string;
  name: string;
  pipeline_stage: OperationsPipelineStage;
  relationship_type: OperationsRelationshipType;
  source: string | null;
  business_type: string | null;
  location: string | null;
  phone: string | null;
  general_email: string | null;
  website_url: string | null;
  last_contacted_at: Date | null;
  next_follow_up_at: Date | null;
  next_action: string | null;
  is_archived: boolean;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsContactRow = {
  id: string;
  business_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  is_primary: boolean;
  notes: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  preferred_channel: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsBusinessListRow = OperationsBusinessRow & {
  primary_contact_id: string | null;
  primary_contact_first_name: string | null;
  primary_contact_last_name: string | null;
  primary_contact_email: string | null;
  primary_contact_phone: string | null;
  linked_site_count: number;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: Date | null;
  critical_issue_count: number;
  high_issue_count: number;
  active_incident_count: number;
};

export type OperationsLinkedSiteRow = {
  site_id: string;
  url: string;
  site_display_name: string | null;
  client_name: string | null;
  report_display_name: string | null;
  disabled_at: Date | null;
  linked_at: Date;
  uptime_enabled: boolean | null;
  active_incident_id: string | null;
  active_incident_started_at: Date | null;
  latest_scan_id: string | null;
  latest_scan_status: string | null;
  latest_scan_finished_at: Date | null;
  latest_scan_started_at: Date | null;
  latest_scan_score: number | null;
  critical_issue_count: number;
  high_issue_count: number;
};

export type OperationsBusinessNoteRow = {
  id: string;
  business_id: string;
  body: string;
  created_at: Date;
  created_by_user_id: string | null;
  created_by_email: string | null;
};

export type OperationsBusinessReportRow = {
  id: string;
  title: string;
  report_type: string;
  status: string;
  version_number: number;
  scan_run_id: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  included_findings: number;
  critical_findings: number;
  important_findings: number;
  created_at: Date;
  updated_at: Date;
  sent_at: Date | null;
  finished_at: Date | null;
  follow_up_at: Date | null;
  archived_at: Date | null;
};

export type OperationsBusinessDetail = {
  business: OperationsBusinessRow;
  contacts: OperationsContactRow[];
  primaryContact: OperationsContactRow | null;
  linkedSites: OperationsLinkedSiteRow[];
  notes: OperationsBusinessNoteRow[];
  reports: OperationsBusinessReportRow[];
};

export type OperationsBusinessInput = {
  name: string;
  pipelineStage?: OperationsPipelineStage;
  relationshipType?: OperationsRelationshipType;
  source?: string | null;
  businessType?: string | null;
  location?: string | null;
  phone?: string | null;
  generalEmail?: string | null;
  websiteUrl?: string | null;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  nextAction?: string | null;
};

export type OperationsContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
  doNotContact?: boolean;
  doNotContactReason?: string | null;
  preferredChannel?: string | null;
};

export type OperationsDeleteEligibility = {
  allowed: boolean;
  reasons: string[];
  dependencyCounts: Record<string, number>;
};

export type OperationsBusinessListParams = {
  search?: string | null;
  pipelineStage?: OperationsPipelineStage | null;
  relationshipType?: OperationsRelationshipType | null;
  archived?: boolean | null;
  followUpDue?: boolean;
  sort?: "name" | "updated_desc" | "next_follow_up";
  limit: number;
  offset: number;
};

type CountRow = { count: string };

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function addDependencyReason(
  reasons: string[],
  dependencyCounts: Record<string, number>,
  key: string,
  count: number,
  label: string,
) {
  dependencyCounts[key] = count;
  if (count > 0) reasons.push(`${label}: ${count}`);
}

function textValue(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapBusinessInput(input: Partial<OperationsBusinessInput>) {
  return {
    name: input.name == null ? undefined : textValue(input.name),
    pipelineStage: input.pipelineStage,
    relationshipType: input.relationshipType,
    source: input.source === undefined ? undefined : textValue(input.source),
    businessType:
      input.businessType === undefined
        ? undefined
        : textValue(input.businessType),
    location:
      input.location === undefined ? undefined : textValue(input.location),
    phone: input.phone === undefined ? undefined : textValue(input.phone),
    generalEmail:
      input.generalEmail === undefined
        ? undefined
        : textValue(input.generalEmail),
    websiteUrl:
      input.websiteUrl === undefined ? undefined : textValue(input.websiteUrl),
    lastContactedAt: input.lastContactedAt,
    nextFollowUpAt: input.nextFollowUpAt,
    nextAction:
      input.nextAction === undefined ? undefined : textValue(input.nextAction),
  };
}

function contactValues(input: OperationsContactInput) {
  return {
    firstName: textValue(input.firstName),
    lastName: textValue(input.lastName),
    email: textValue(input.email),
    phone: textValue(input.phone),
    jobTitle: textValue(input.jobTitle),
    notes: textValue(input.notes),
    isPrimary: input.isPrimary === true,
    doNotContact: input.doNotContact === true,
    doNotContactReason: textValue(input.doNotContactReason),
    preferredChannel: textValue(input.preferredChannel),
  };
}

function searchPattern(value: string) {
  return `%${value.trim().toLowerCase()}%`;
}

function buildBusinessFilters(params: OperationsBusinessListParams) {
  const filters: string[] = [];
  const values: unknown[] = [];

  if (params.archived === true) {
    filters.push("b.is_archived = true");
  } else if (params.archived === false || params.archived == null) {
    filters.push("b.is_archived = false");
  }
  if (params.pipelineStage) {
    values.push(params.pipelineStage);
    filters.push(`b.pipeline_stage = $${values.length}`);
  }
  if (params.relationshipType) {
    values.push(params.relationshipType);
    filters.push(`b.relationship_type = $${values.length}`);
  }
  if (params.followUpDue) {
    filters.push("b.next_follow_up_at IS NOT NULL");
    filters.push("b.next_follow_up_at <= NOW()");
    filters.push("b.is_archived = false");
  }
  if (params.search?.trim()) {
    values.push(searchPattern(params.search));
    const searchPlaceholder = `$${values.length}`;
    filters.push(`(
      lower(b.name) LIKE ${searchPlaceholder}
      OR lower(COALESCE(b.website_url, '')) LIKE ${searchPlaceholder}
      OR lower(COALESCE(b.general_email, '')) LIKE ${searchPlaceholder}
      OR EXISTS (
        SELECT 1
        FROM operations_contacts c
        WHERE c.business_id = b.id
          AND c.archived_at IS NULL
          AND (
            lower(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) LIKE ${searchPlaceholder}
            OR lower(COALESCE(c.email, '')) LIKE ${searchPlaceholder}
          )
      )
    )`);
  }

  return {
    where: filters.length ? `WHERE ${filters.join(" AND ")}` : "",
    values,
  };
}

function businessListSelect() {
  return `
    b.*,
    pc.id AS primary_contact_id,
    pc.first_name AS primary_contact_first_name,
    pc.last_name AS primary_contact_last_name,
    pc.email AS primary_contact_email,
    pc.phone AS primary_contact_phone,
    COALESCE(site_summary.linked_site_count, 0)::int AS linked_site_count,
    latest_scan.id AS latest_scan_id,
    latest_scan.status AS latest_scan_status,
    latest_scan.finished_at AS latest_scan_finished_at,
    COALESCE(issue_summary.critical_issue_count, 0)::int AS critical_issue_count,
    COALESCE(issue_summary.high_issue_count, 0)::int AS high_issue_count,
    COALESCE(uptime_summary.active_incident_count, 0)::int AS active_incident_count
  `;
}

function businessListJoins() {
  return `
    LEFT JOIN operations_contacts pc
      ON pc.business_id = b.id AND pc.is_primary = true AND pc.archived_at IS NULL
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS linked_site_count
      FROM operations_business_sites obs
      WHERE obs.business_id = b.id
    ) site_summary ON TRUE
    LEFT JOIN LATERAL (
      SELECT r.id, r.status, r.finished_at
      FROM operations_business_sites obs
      JOIN scan_runs r ON r.site_id = obs.site_id
      WHERE obs.business_id = b.id
      ORDER BY r.started_at DESC
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
      SELECT COUNT(*)::int AS active_incident_count
      FROM operations_business_sites obs
      JOIN uptime_incidents ui ON ui.site_id = obs.site_id
      WHERE obs.business_id = b.id
        AND ui.status = 'open'
    ) uptime_summary ON TRUE
  `;
}

function sortClause(sort: OperationsBusinessListParams["sort"]) {
  if (sort === "name") return "ORDER BY lower(b.name) ASC, b.updated_at DESC";
  if (sort === "next_follow_up") {
    return "ORDER BY b.next_follow_up_at ASC NULLS LAST, b.updated_at DESC";
  }
  return "ORDER BY b.updated_at DESC";
}

export async function listOperationsBusinesses(
  params: OperationsBusinessListParams,
) {
  const client = await ensureConnected();
  const filters = buildBusinessFilters(params);
  const pageValues = [...filters.values, params.limit, params.offset];
  const limitPlaceholder = `$${pageValues.length - 1}`;
  const offsetPlaceholder = `$${pageValues.length}`;

  const [rows, total] = await Promise.all([
    client.query<OperationsBusinessListRow>(
      `
        SELECT ${businessListSelect()}
        FROM operations_businesses b
        ${businessListJoins()}
        ${filters.where}
        ${sortClause(params.sort)}
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      pageValues,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_businesses b
        ${filters.where}
      `,
      filters.values,
    ),
  ]);

  return {
    businesses: rows.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: rows.rows.length,
    limit: params.limit,
    offset: params.offset,
  };
}

export async function getOperationsBusinessDetail(
  businessId: string,
): Promise<OperationsBusinessDetail | null> {
  const client = await ensureConnected();
  const businessRes = await client.query<OperationsBusinessRow>(
    `SELECT * FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  const business = businessRes.rows[0];
  if (!business) return null;

  const [contacts, linkedSites, notes, reports] = await Promise.all([
    client.query<OperationsContactRow>(
      `
        SELECT *
        FROM operations_contacts
        WHERE business_id = $1
        ORDER BY archived_at ASC NULLS FIRST, is_primary DESC, created_at ASC
      `,
      [businessId],
    ),
    client.query<OperationsLinkedSiteRow>(
      `
        SELECT
          s.id AS site_id,
          s.url,
          s.site_display_name,
          s.client_name,
          s.report_display_name,
          s.disabled_at,
          obs.created_at AS linked_at,
          us.enabled AS uptime_enabled,
          ui.id AS active_incident_id,
          ui.started_at AS active_incident_started_at,
          latest_scan.id AS latest_scan_id,
          latest_scan.status AS latest_scan_status,
          latest_scan.finished_at AS latest_scan_finished_at,
          latest_scan.started_at AS latest_scan_started_at,
          latest_scan.score AS latest_scan_score,
          COALESCE(issue_summary.critical_issue_count, 0)::int AS critical_issue_count,
          COALESCE(issue_summary.high_issue_count, 0)::int AS high_issue_count
        FROM operations_business_sites obs
        JOIN sites s ON s.id = obs.site_id
        LEFT JOIN site_uptime_settings us ON us.site_id = s.id
        LEFT JOIN uptime_incidents ui ON ui.site_id = s.id AND ui.status = 'open'
        LEFT JOIN LATERAL (
          SELECT r.id,
                 r.status,
                 r.started_at,
                 r.finished_at,
                 CASE
                   WHEN r.status = 'completed' THEN
                     GREATEST(
                       0,
                       100
                       - COALESCE(score_counts.critical_count, 0) * 25
                       - COALESCE(score_counts.high_count, 0) * 12
                       - COALESCE(score_counts.medium_count, 0) * 6
                       - COALESCE(score_counts.low_count, 0) * 2
                     )
                   ELSE NULL
                 END::int AS score
          FROM scan_runs r
          LEFT JOIN LATERAL (
            SELECT
              COUNT(*) FILTER (WHERE si.severity = 'critical' AND si.status = 'open')::int AS critical_count,
              COUNT(*) FILTER (WHERE si.severity = 'high' AND si.status = 'open')::int AS high_count,
              COUNT(*) FILTER (WHERE si.severity = 'medium' AND si.status = 'open')::int AS medium_count,
              COUNT(*) FILTER (WHERE si.severity = 'low' AND si.status = 'open')::int AS low_count
            FROM scan_issues si
            WHERE si.scan_run_id = r.id
          ) score_counts ON TRUE
          WHERE r.site_id = s.id
          ORDER BY r.started_at DESC
          LIMIT 1
        ) latest_scan ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE si.severity = 'critical' AND si.status = 'open')::int AS critical_issue_count,
            COUNT(*) FILTER (WHERE si.severity = 'high' AND si.status = 'open')::int AS high_issue_count
          FROM scan_issues si
          WHERE si.scan_run_id = latest_scan.id
        ) issue_summary ON TRUE
        WHERE obs.business_id = $1
        ORDER BY obs.created_at DESC
      `,
      [businessId],
    ),
    client.query<OperationsBusinessNoteRow>(
      `
        SELECT n.*,
               u.email AS created_by_email
        FROM operations_business_notes n
        LEFT JOIN users u ON u.id = n.created_by_user_id
        WHERE n.business_id = $1
        ORDER BY n.created_at DESC
        LIMIT 50
      `,
      [businessId],
    ),
    client.query<OperationsBusinessReportRow>(
      `
        SELECT r.id,
               r.title,
               r.report_type,
               r.status,
               r.version_number,
               r.scan_run_id,
               r.site_id,
               s.url AS site_url,
               s.site_display_name,
               COALESCE(finding_counts.included_findings, 0)::int AS included_findings,
               COALESCE(finding_counts.critical_findings, 0)::int AS critical_findings,
               COALESCE(finding_counts.important_findings, 0)::int AS important_findings,
               r.created_at,
               r.updated_at,
               r.sent_at,
               sr.finished_at,
               r.follow_up_at,
               r.archived_at
        FROM operations_reports r
        JOIN sites s ON s.id = r.site_id
        JOIN scan_runs sr ON sr.id = r.scan_run_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false)::int AS included_findings,
            COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'critical')::int AS critical_findings,
            COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'important')::int AS important_findings
          FROM operations_report_findings f
          WHERE f.operations_report_id = r.id
        ) finding_counts ON TRUE
        WHERE r.business_id = $1
        ORDER BY r.updated_at DESC
        LIMIT 20
      `,
      [businessId],
    ),
  ]);

  const primaryContact =
    contacts.rows.find(
      (contact) => contact.is_primary && !contact.archived_at,
    ) ?? null;

  return {
    business,
    contacts: contacts.rows,
    primaryContact,
    linkedSites: linkedSites.rows,
    notes: notes.rows,
    reports: reports.rows,
  };
}

export async function createOperationsBusiness(
  actor: AdminActor,
  input: OperationsBusinessInput & {
    primaryContact?: OperationsContactInput | null;
    initialNote?: string | null;
  },
): Promise<OperationsBusinessDetail> {
  const client = await ensureConnected();
  const values = mapBusinessInput(input);
  if (!values.name) throw new Error("business_name_required");

  try {
    await client.query("BEGIN");
    const res = await client.query<OperationsBusinessRow>(
      `
        INSERT INTO operations_businesses (
          name,
          pipeline_stage,
          relationship_type,
          source,
          business_type,
          location,
          phone,
          general_email,
          website_url,
          last_contacted_at,
          next_follow_up_at,
          next_action,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `,
      [
        values.name,
        values.pipelineStage ?? "discovered",
        values.relationshipType ?? "prospect",
        values.source ?? null,
        values.businessType ?? null,
        values.location ?? null,
        values.phone ?? null,
        values.generalEmail ?? null,
        values.websiteUrl ?? null,
        values.lastContactedAt ?? null,
        values.nextFollowUpAt ?? null,
        values.nextAction ?? null,
        actor.id,
      ],
    );
    const business = res.rows[0];

    if (input.primaryContact) {
      const contact = contactValues({
        ...input.primaryContact,
        isPrimary: true,
      });
      if (
        contact.firstName ||
        contact.lastName ||
        contact.email ||
        contact.phone ||
        contact.jobTitle ||
        contact.notes
      ) {
        await client.query(
          `
            INSERT INTO operations_contacts (
              business_id,
              first_name,
              last_name,
              email,
              phone,
              job_title,
              is_primary,
              notes,
              do_not_contact,
              do_not_contact_reason,
              preferred_channel
            )
            VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10)
          `,
          [
            business.id,
            contact.firstName,
            contact.lastName,
            contact.email,
            contact.phone,
            contact.jobTitle,
            contact.notes,
            contact.doNotContact,
            contact.doNotContactReason,
            contact.preferredChannel,
          ],
        );
      }
    }

    const note = textValue(input.initialNote);
    if (note) {
      await client.query(
        `
          INSERT INTO operations_business_notes (
            business_id,
            body,
            created_by_user_id
          )
          VALUES ($1, $2, $3)
        `,
        [business.id, note, actor.id],
      );
    }

    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations.business.create",
      targetType: "operations_business",
      targetId: business.id,
      metadata: {
        pipelineStage: business.pipeline_stage,
        relationshipType: business.relationship_type,
      },
    });

    const detail = await getOperationsBusinessDetail(business.id);
    if (!detail) throw new Error("business_not_found");
    return detail;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function updateOperationsBusiness(
  actor: AdminActor,
  businessId: string,
  input: Partial<OperationsBusinessInput> & {
    markContactedNow?: boolean;
    clearNextFollowUp?: boolean;
  },
): Promise<OperationsBusinessDetail | null> {
  const existing = await getOperationsBusinessDetail(businessId);
  if (!existing) return null;

  const values = mapBusinessInput(input);
  const sets: string[] = [];
  const params: unknown[] = [];
  function setColumn(column: string, value: unknown) {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }

  if (values.name !== undefined) {
    if (!values.name) throw new Error("business_name_required");
    setColumn("name", values.name);
  }
  if (values.pipelineStage !== undefined) {
    setColumn("pipeline_stage", values.pipelineStage);
  }
  if (values.relationshipType !== undefined) {
    setColumn("relationship_type", values.relationshipType);
  }
  if (values.source !== undefined) setColumn("source", values.source);
  if (values.businessType !== undefined) {
    setColumn("business_type", values.businessType);
  }
  if (values.location !== undefined) setColumn("location", values.location);
  if (values.phone !== undefined) setColumn("phone", values.phone);
  if (values.generalEmail !== undefined) {
    setColumn("general_email", values.generalEmail);
  }
  if (values.websiteUrl !== undefined) {
    setColumn("website_url", values.websiteUrl);
  }
  if (values.lastContactedAt !== undefined) {
    setColumn("last_contacted_at", values.lastContactedAt);
  }
  if (values.nextFollowUpAt !== undefined) {
    setColumn("next_follow_up_at", values.nextFollowUpAt);
  }
  if (values.nextAction !== undefined) {
    setColumn("next_action", values.nextAction);
  }
  if (input.markContactedNow === true) {
    setColumn("last_contacted_at", new Date());
    if (input.clearNextFollowUp === true) {
      setColumn("next_follow_up_at", null);
    }
  }

  if (sets.length === 0) return existing;

  params.push(businessId);
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE operations_businesses
      SET ${sets.join(", ")},
          updated_at = now()
      WHERE id = $${params.length}
    `,
    params,
  );

  if (
    values.pipelineStage !== undefined &&
    values.pipelineStage !== existing.business.pipeline_stage
  ) {
    await recordAdminAuditLog(actor, {
      action: "operations.business.pipeline_stage_change",
      targetType: "operations_business",
      targetId: businessId,
      metadata: {
        from: existing.business.pipeline_stage,
        to: values.pipelineStage,
      },
    });
  }
  if (values.nextFollowUpAt !== undefined || values.nextAction !== undefined) {
    await recordAdminAuditLog(actor, {
      action: "operations.business.follow_up_schedule",
      targetType: "operations_business",
      targetId: businessId,
      metadata: { hasNextFollowUp: values.nextFollowUpAt != null },
    });
  }
  if (input.markContactedNow === true) {
    await recordAdminAuditLog(actor, {
      action: "operations.business.mark_contacted",
      targetType: "operations_business",
      targetId: businessId,
      metadata: { clearNextFollowUp: input.clearNextFollowUp === true },
    });
  }

  return getOperationsBusinessDetail(businessId);
}

export async function setOperationsBusinessArchived(
  actor: AdminActor,
  businessId: string,
  archived: boolean,
): Promise<OperationsBusinessRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsBusinessRow>(
    `
      UPDATE operations_businesses
      SET is_archived = $2,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [businessId, archived],
  );
  const business = res.rows[0] ?? null;
  if (business) {
    await recordAdminAuditLog(actor, {
      action: archived
        ? "operations.business.archive"
        : "operations.business.restore",
      targetType: "operations_business",
      targetId: businessId,
      metadata: null,
    });
  }
  return business;
}

export async function getOperationsBusinessDeleteEligibility(
  businessId: string,
): Promise<OperationsDeleteEligibility | null> {
  const client = await ensureConnected();
  const exists = await client.query<{ id: string }>(
    `SELECT id FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  if (!exists.rows[0]) return null;

  const [
    contacts,
    sites,
    notes,
    reports,
    communications,
    quotes,
    workOrders,
    services,
  ] = await Promise.all([
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_contacts WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_business_sites WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_business_notes WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_reports WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_communications WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_quotes WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_work_orders WHERE business_id = $1`,
      [businessId],
    ),
    client.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM operations_client_services WHERE business_id = $1`,
      [businessId],
    ),
  ]);

  const reasons: string[] = [];
  const dependencyCounts: Record<string, number> = {};
  addDependencyReason(
    reasons,
    dependencyCounts,
    "contacts",
    countValue(contacts.rows[0]),
    "contacts",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "sites",
    countValue(sites.rows[0]),
    "linked sites",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "notes",
    countValue(notes.rows[0]),
    "notes",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "reports",
    countValue(reports.rows[0]),
    "reports",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "communications",
    countValue(communications.rows[0]),
    "communications",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "quotes",
    countValue(quotes.rows[0]),
    "quotes",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "workOrders",
    countValue(workOrders.rows[0]),
    "work orders",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "services",
    countValue(services.rows[0]),
    "managed services",
  );

  return { allowed: reasons.length === 0, reasons, dependencyCounts };
}

export async function deleteOperationsBusiness(
  actor: AdminActor,
  businessId: string,
): Promise<OperationsBusinessRow | null | OperationsDeleteEligibility> {
  const eligibility = await getOperationsBusinessDeleteEligibility(businessId);
  if (!eligibility) return null;
  if (!eligibility.allowed) return eligibility;

  const client = await ensureConnected();
  const res = await client.query<OperationsBusinessRow>(
    `DELETE FROM operations_businesses WHERE id = $1 RETURNING *`,
    [businessId],
  );
  const business = res.rows[0] ?? null;
  if (business) {
    await recordAdminAuditLog(actor, {
      action: "operations.business.delete",
      targetType: "operations_business",
      targetId: businessId,
      metadata: { name: business.name },
    });
  }
  return business;
}

export async function addOperationsContact(
  actor: AdminActor,
  businessId: string,
  input: OperationsContactInput,
): Promise<OperationsContactRow | null> {
  const client = await ensureConnected();
  const business = await getOperationsBusinessDetail(businessId);
  if (!business) return null;
  const contact = contactValues(input);
  try {
    await client.query("BEGIN");
    if (contact.isPrimary) {
      await client.query(
        `UPDATE operations_contacts SET is_primary = false, updated_at = now() WHERE business_id = $1 AND archived_at IS NULL`,
        [businessId],
      );
    }
    const res = await client.query<OperationsContactRow>(
      `
        INSERT INTO operations_contacts (
          business_id,
          first_name,
          last_name,
          email,
          phone,
          job_title,
          is_primary,
          notes,
          do_not_contact,
          do_not_contact_reason,
          preferred_channel
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `,
      [
        businessId,
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone,
        contact.jobTitle,
        contact.isPrimary,
        contact.notes,
        contact.doNotContact,
        contact.doNotContactReason,
        contact.preferredChannel,
      ],
    );
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations.contact.add",
      targetType: "operations_contact",
      targetId: res.rows[0].id,
      metadata: { businessId, isPrimary: contact.isPrimary },
    });
    return res.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function updateOperationsContact(
  actor: AdminActor,
  businessId: string,
  contactId: string,
  input: OperationsContactInput,
): Promise<OperationsContactRow | null> {
  const client = await ensureConnected();
  const existing = await client.query<OperationsContactRow>(
    `SELECT * FROM operations_contacts WHERE id = $1 AND business_id = $2`,
    [contactId, businessId],
  );
  if (!existing.rows[0]) return null;
  if (input.isPrimary === true && existing.rows[0].archived_at) return null;
  const contact = contactValues(input);
  try {
    await client.query("BEGIN");
    if (input.isPrimary === true) {
      await client.query(
        `UPDATE operations_contacts SET is_primary = false, updated_at = now() WHERE business_id = $1 AND id <> $2 AND archived_at IS NULL`,
        [businessId, contactId],
      );
    }
    const res = await client.query<OperationsContactRow>(
      `
        UPDATE operations_contacts
        SET first_name = $3,
            last_name = $4,
            email = $5,
            phone = $6,
            job_title = $7,
            is_primary = $8,
            notes = $9,
            do_not_contact = $10,
            do_not_contact_reason = $11,
            preferred_channel = $12,
            updated_at = now()
        WHERE id = $1 AND business_id = $2
        RETURNING *
      `,
      [
        contactId,
        businessId,
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone,
        contact.jobTitle,
        input.isPrimary === undefined
          ? existing.rows[0].is_primary
          : contact.isPrimary,
        contact.notes,
        input.doNotContact === undefined
          ? existing.rows[0].do_not_contact
          : contact.doNotContact,
        input.doNotContactReason === undefined
          ? existing.rows[0].do_not_contact_reason
          : contact.doNotContactReason,
        input.preferredChannel === undefined
          ? existing.rows[0].preferred_channel
          : contact.preferredChannel,
      ],
    );
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations.contact.update",
      targetType: "operations_contact",
      targetId: contactId,
      metadata: { businessId, isPrimary: res.rows[0].is_primary },
    });
    return res.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function setOperationsContactArchived(
  actor: AdminActor,
  businessId: string,
  contactId: string,
  archived: boolean,
  options: { allowNoPrimary?: boolean } = {},
): Promise<
  OperationsContactRow | null | "primary_contact_requires_confirmation"
> {
  const client = await ensureConnected();
  const existing = await client.query<OperationsContactRow>(
    `SELECT * FROM operations_contacts WHERE id = $1 AND business_id = $2`,
    [contactId, businessId],
  );
  const contact = existing.rows[0];
  if (!contact) return null;
  if (archived && contact.is_primary && options.allowNoPrimary !== true) {
    return "primary_contact_requires_confirmation";
  }

  const res = await client.query<OperationsContactRow>(
    `
      UPDATE operations_contacts
      SET archived_at = CASE WHEN $3 THEN now() ELSE NULL END,
          is_primary = CASE WHEN $3 THEN false ELSE is_primary END,
          updated_at = now()
      WHERE id = $1
        AND business_id = $2
      RETURNING *
    `,
    [contactId, businessId, archived],
  );
  const updated = res.rows[0] ?? null;
  if (updated) {
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await recordAdminAuditLog(actor, {
      action: archived
        ? "operations.contact.archive"
        : "operations.contact.restore",
      targetType: "operations_contact",
      targetId: contactId,
      metadata: { businessId, wasPrimary: contact.is_primary },
    });
  }
  return updated;
}

export async function deleteOperationsContact(
  actor: AdminActor,
  businessId: string,
  contactId: string,
): Promise<boolean | OperationsDeleteEligibility | null> {
  const client = await ensureConnected();
  const existing = await client.query<OperationsContactRow>(
    `SELECT * FROM operations_contacts WHERE id = $1 AND business_id = $2`,
    [contactId, businessId],
  );
  const contact = existing.rows[0];
  if (!contact) return null;

  const [reports, communications, quotes, workOrders, services] =
    await Promise.all([
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_reports WHERE prepared_contact_id = $1`,
        [contactId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_communications WHERE contact_id = $1`,
        [contactId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_quotes WHERE contact_id = $1`,
        [contactId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_work_orders WHERE contact_id = $1`,
        [contactId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_client_services WHERE contact_id = $1`,
        [contactId],
      ),
    ]);
  const reasons = contact.is_primary
    ? ["primary contact must be replaced before removal"]
    : [];
  const dependencyCounts: Record<string, number> = {};
  addDependencyReason(
    reasons,
    dependencyCounts,
    "reports",
    countValue(reports.rows[0]),
    "reports",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "communications",
    countValue(communications.rows[0]),
    "communications",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "quotes",
    countValue(quotes.rows[0]),
    "quotes",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "workOrders",
    countValue(workOrders.rows[0]),
    "work orders",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "services",
    countValue(services.rows[0]),
    "managed services",
  );
  if (reasons.length > 0) {
    return { allowed: false, reasons, dependencyCounts };
  }

  const res = await client.query(
    `
      DELETE FROM operations_contacts
      WHERE id = $1 AND business_id = $2
    `,
    [contactId, businessId],
  );
  if ((res.rowCount ?? 0) > 0) {
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await recordAdminAuditLog(actor, {
      action: "operations.contact.delete",
      targetType: "operations_contact",
      targetId: contactId,
      metadata: { businessId },
    });
    return true;
  }
  return false;
}

export async function setPrimaryOperationsContact(
  actor: AdminActor,
  businessId: string,
  contactId: string,
): Promise<OperationsContactRow | null> {
  const client = await ensureConnected();
  const existing = await client.query<OperationsContactRow>(
    `SELECT * FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
    [contactId, businessId],
  );
  if (!existing.rows[0]) return null;
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE operations_contacts SET is_primary = false, updated_at = now() WHERE business_id = $1 AND archived_at IS NULL`,
      [businessId],
    );
    const res = await client.query<OperationsContactRow>(
      `
        UPDATE operations_contacts
        SET is_primary = true,
            updated_at = now()
        WHERE id = $1 AND business_id = $2
        RETURNING *
      `,
      [contactId, businessId],
    );
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations.contact.set_primary",
      targetType: "operations_contact",
      targetId: contactId,
      metadata: { businessId },
    });
    return res.rows[0];
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

export async function linkOperationsBusinessSite(
  actor: AdminActor,
  businessId: string,
  siteId: string,
): Promise<"linked" | "business_not_found" | "site_not_found" | "duplicate"> {
  const client = await ensureConnected();
  const business = await client.query(
    `SELECT id FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  if (!business.rows[0]) return "business_not_found";
  const site = await client.query(`SELECT id FROM sites WHERE id = $1`, [
    siteId,
  ]);
  if (!site.rows[0]) return "site_not_found";
  try {
    await client.query(
      `
        INSERT INTO operations_business_sites (
          business_id,
          site_id,
          created_by_user_id
        )
        VALUES ($1, $2, $3)
      `,
      [businessId, siteId, actor.id],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return "duplicate";
    throw err;
  }
  await client.query(
    `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
    [businessId],
  );
  await recordAdminAuditLog(actor, {
    action: "operations.business_site.link",
    targetType: "operations_business",
    targetId: businessId,
    metadata: { siteId },
  });
  return "linked";
}

export async function unlinkOperationsBusinessSite(
  actor: AdminActor,
  businessId: string,
  siteId: string,
): Promise<boolean> {
  const client = await ensureConnected();
  const res = await client.query(
    `
      DELETE FROM operations_business_sites
      WHERE business_id = $1 AND site_id = $2
    `,
    [businessId, siteId],
  );
  if ((res.rowCount ?? 0) > 0) {
    await client.query(
      `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
      [businessId],
    );
    await recordAdminAuditLog(actor, {
      action: "operations.business_site.unlink",
      targetType: "operations_business",
      targetId: businessId,
      metadata: { siteId },
    });
    return true;
  }
  return false;
}

export async function addOperationsBusinessNote(
  actor: AdminActor,
  businessId: string,
  body: string,
): Promise<OperationsBusinessNoteRow | null> {
  const note = textValue(body);
  if (!note) throw new Error("note_body_required");
  const client = await ensureConnected();
  const business = await client.query(
    `SELECT id FROM operations_businesses WHERE id = $1`,
    [businessId],
  );
  if (!business.rows[0]) return null;
  const res = await client.query<OperationsBusinessNoteRow>(
    `
      INSERT INTO operations_business_notes (
        business_id,
        body,
        created_by_user_id
      )
      VALUES ($1, $2, $3)
      RETURNING *,
                NULL::text AS created_by_email
    `,
    [businessId, note, actor.id],
  );
  await client.query(
    `UPDATE operations_businesses SET updated_at = now() WHERE id = $1`,
    [businessId],
  );
  await recordAdminAuditLog(actor, {
    action: "operations.business_note.add",
    targetType: "operations_business",
    targetId: businessId,
    metadata: { noteId: res.rows[0].id },
  });
  return res.rows[0];
}

export async function listOperationsPipeline() {
  const list = await listOperationsBusinesses({
    archived: false,
    sort: "next_follow_up",
    limit: 500,
    offset: 0,
  });
  const groups = OPERATIONS_PIPELINE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<OperationsPipelineStage, OperationsBusinessListRow[]>,
  );
  for (const business of list.businesses) {
    groups[business.pipeline_stage].push(business);
  }
  return {
    stages: OPERATIONS_PIPELINE_STAGES.map((stage) => ({
      stage,
      businesses: groups[stage],
    })),
  };
}

export async function listOperationsAvailableSites(options: {
  search?: string | null;
  limit: number;
}) {
  const client = await ensureConnected();
  const values: unknown[] = [];
  const filters = ["s.disabled_at IS NULL"];
  if (options.search?.trim()) {
    values.push(searchPattern(options.search));
    filters.push(`(
      lower(s.url) LIKE $${values.length}
      OR lower(COALESCE(s.site_display_name, '')) LIKE $${values.length}
      OR lower(COALESCE(s.client_name, '')) LIKE $${values.length}
    )`);
  }
  values.push(options.limit);
  const res = await client.query<{
    id: string;
    url: string;
    site_display_name: string | null;
    client_name: string | null;
    owner_email: string | null;
  }>(
    `
      SELECT s.id,
             s.url,
             s.site_display_name,
             s.client_name,
             u.email AS owner_email
      FROM sites s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE ${filters.join(" AND ")}
      ORDER BY s.created_at DESC
      LIMIT $${values.length}
    `,
    values,
  );
  return res.rows;
}

export async function getOperationsBusinessCounts() {
  const client = await ensureConnected();
  const [taskCounts, prospectsAwaitingContact] = await Promise.all([
    getOperationsTaskCounts(),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_businesses
        WHERE is_archived = false
          AND relationship_type = 'prospect'
          AND pipeline_stage IN ('discovered', 'researched', 'ready_to_contact')
      `,
    ),
  ]);
  return {
    followUpsDue: taskCounts.followUpsDue,
    prospectsAwaitingContact: countValue(prospectsAwaitingContact.rows[0]),
    openWorkItems: taskCounts.openWorkItems,
  };
}
