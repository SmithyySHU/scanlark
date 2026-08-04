import { ensureConnected } from "./client";
import type { OperationsCommunicationRow } from "./operationsCommunications";

export const OPERATIONS_EMAIL_MESSAGE_STATUSES = [
  "draft",
  "ready",
  "queued",
  "sending",
  "sent",
  "failed",
  "delivery_uncertain",
  "cancelled",
] as const;

export const OPERATIONS_EMAIL_DELIVERY_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
  "delivery_uncertain",
  "cancelled",
] as const;

export const OPERATIONS_EMAIL_SENT_COPY_STATUSES = [
  "not_required",
  "pending",
  "appending",
  "appended",
  "failed",
] as const;

export type OperationsEmailMessageStatus =
  (typeof OPERATIONS_EMAIL_MESSAGE_STATUSES)[number];
export type OperationsEmailDeliveryStatus =
  (typeof OPERATIONS_EMAIL_DELIVERY_STATUSES)[number];
export type OperationsEmailSentCopyStatus =
  (typeof OPERATIONS_EMAIL_SENT_COPY_STATUSES)[number];
export type OperationsEmailDeliveryKind = "test" | "real";
export type OperationsEmailAttachmentSourceType =
  | "report_pdf"
  | "quote_pdf"
  | "manual";
export type OperationsEmailSmtpPhase =
  | "not_started"
  | "connect"
  | "envelope"
  | "data"
  | "post_data"
  | "accepted"
  | "unknown";
export type OperationsEmailFailureClass =
  | "transient_pre_acceptance"
  | "permanent"
  | "configuration"
  | "content"
  | "uncertain";
export type OperationsEmailRetryPolicy = "automatic" | "manual" | "never";

export type OperationsEmailMessageRow = {
  id: string;
  workspace_id: string;
  source_communication_id: string | null;
  sent_communication_id: string | null;
  duplicated_from_message_id: string | null;
  business_id: string;
  contact_id: string | null;
  report_id: string | null;
  quote_id: string | null;
  from_name: string;
  from_address: string;
  reply_to_address: string | null;
  recipient_name: string | null;
  recipient_address: string;
  subject: string;
  preheader: string | null;
  editor_body: string;
  rendered_html: string | null;
  plain_text: string | null;
  source_snapshot_json: Record<string, unknown>;
  render_metadata_json: Record<string, unknown>;
  status: OperationsEmailMessageStatus;
  revision: number;
  created_by_user_id: string | null;
  last_edited_by_user_id: string | null;
  send_requested_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  ready_at: Date | null;
  queued_at: Date | null;
  sending_at: Date | null;
  sent_at: Date | null;
  failed_at: Date | null;
  uncertain_at: Date | null;
  cancelled_at: Date | null;
  cancellation_reason: string | null;
  safe_display_error: string | null;
  final_render_revision: number | null;
  final_render_attachment_set_sha256: string | null;
  final_render_html: string | null;
  final_render_plain_text: string | null;
  final_render_html_sha256: string | null;
  final_render_plain_text_sha256: string | null;
  final_render_generated_at: Date | null;
  final_renderer_version: string | null;
};

export type OperationsEmailAttachmentRow = {
  id: string;
  message_id: string;
  workspace_id: string;
  source_type: OperationsEmailAttachmentSourceType;
  source_report_id: string | null;
  source_quote_id: string | null;
  source_report_render_id: string | null;
  source_quote_render_id: string | null;
  source_version: string | null;
  source_generated_at: Date | null;
  display_filename: string;
  storage_filename: string;
  declared_mime_type: string;
  verified_mime_type: string | null;
  size_bytes: string;
  sha256: string | null;
  storage_key: string | null;
  storage_reference_json: Record<string, unknown>;
  content_bytes: Buffer | null;
  created_by_user_id: string | null;
  created_at: Date;
  removed_by_user_id: string | null;
  removed_at: Date | null;
};

export type OperationsEmailDeliveryRow = {
  id: string;
  workspace_id: string;
  message_id: string;
  delivery_kind: OperationsEmailDeliveryKind;
  initiated_by_user_id: string | null;
  idempotency_key: string;
  status: OperationsEmailDeliveryStatus;
  fixed_message_id: string | null;
  date_header: Date | null;
  envelope_sender: string | null;
  envelope_recipient: string | null;
  raw_mime_bytes: Buffer | null;
  raw_mime_storage_key: string | null;
  mime_sha256: string | null;
  frozen_metadata_json: Record<string, unknown>;
  smtp_phase: OperationsEmailSmtpPhase | null;
  failure_class: OperationsEmailFailureClass | null;
  retry_policy: OperationsEmailRetryPolicy | null;
  transmission_may_have_begun: boolean;
  automatic_attempt_count: number;
  manual_retry_count: number;
  sanitized_provider_code: string | null;
  sanitized_command: string | null;
  response_code: number | null;
  response_class: number | null;
  safe_display_error: string | null;
  redacted_internal_error: string | null;
  accepted_recipients_json: string[] | null;
  rejected_recipients_json: string[] | null;
  smtp_accepted_at: Date | null;
  provider_response_id: string | null;
  sent_copy_status: OperationsEmailSentCopyStatus;
  resolved_sent_mailbox: string | null;
  appended_uid: string | null;
  sent_copy_appended_at: Date | null;
  sent_copy_last_attempt_at: Date | null;
  sent_copy_safe_error: string | null;
  smtp_lock_owner: string | null;
  smtp_locked_at: Date | null;
  smtp_lock_expires_at: Date | null;
  next_attempt_at: Date;
  sent_copy_lock_owner: string | null;
  sent_copy_locked_at: Date | null;
  sent_copy_lock_expires_at: Date | null;
  sent_copy_next_attempt_at: Date | null;
  sent_copy_attempt_count: number;
  queued_at: Date;
  sending_at: Date | null;
  sent_at: Date | null;
  failed_at: Date | null;
  uncertain_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsEmailDeliveryAttemptRow = {
  id: string;
  workspace_id: string;
  delivery_id: string;
  transport_kind: "smtp" | "imap_append";
  attempt_number: number;
  request_kind: "automatic" | "actor_requested";
  initiated_by_user_id: string | null;
  worker_id: string | null;
  started_at: Date;
  completed_at: Date | null;
  outcome:
    | "started"
    | "succeeded"
    | "failed"
    | "delivery_uncertain"
    | "cancelled";
  smtp_phase: OperationsEmailSmtpPhase | null;
  failure_class: OperationsEmailFailureClass | null;
  retry_policy: OperationsEmailRetryPolicy | null;
  transmission_may_have_begun: boolean;
  sanitized_provider_code: string | null;
  sanitized_command: string | null;
  response_code: number | null;
  response_class: number | null;
  safe_display_error: string | null;
  redacted_internal_diagnostic: string | null;
};

export type OperationsEmailSourceLink = {
  sourceCommunicationId: string;
  messageId: string;
  messageStatus: OperationsEmailMessageStatus;
  sentAt: Date | null;
  sendRequestedByUserId: string | null;
  sentActorLabel: string | null;
  sentCommunicationId: string | null;
};

export type OperationsEmailTransferSource = OperationsCommunicationRow & {
  workspace_id: string;
  report_id: string | null;
  quote_id: string | null;
};

export type OperationsEmailMessageSummary = Pick<
  OperationsEmailMessageRow,
  | "id"
  | "source_communication_id"
  | "sent_communication_id"
  | "business_id"
  | "contact_id"
  | "recipient_name"
  | "recipient_address"
  | "subject"
  | "status"
  | "revision"
  | "created_at"
  | "updated_at"
  | "ready_at"
  | "sent_at"
  | "failed_at"
  | "uncertain_at"
  | "safe_display_error"
> & {
  business_name: string;
  contact_name: string | null;
  last_editor_label: string | null;
  sent_actor_label: string | null;
};

export type OperationsEmailMessageDetail = OperationsEmailMessageRow & {
  business_name: string;
  contact_name: string | null;
  contact_email: string | null;
  created_actor_label: string | null;
  last_editor_label: string | null;
  sent_actor_label: string | null;
};

export type OperationsEmailOptimisticResult =
  | { outcome: "updated"; message: OperationsEmailMessageRow }
  | { outcome: "stale_revision"; message: OperationsEmailMessageRow }
  | { outcome: "invalid_state"; message: OperationsEmailMessageRow }
  | { outcome: "not_found"; message: null };

type MessageEditorInput = {
  fromName: string;
  fromAddress: string;
  replyToAddress?: string | null;
  recipientName?: string | null;
  recipientAddress: string;
  subject: string;
  preheader?: string | null;
  editorBody: string;
  renderedHtml?: string | null;
  plainText?: string | null;
  sourceSnapshotJson?: Record<string, unknown>;
  renderMetadataJson?: Record<string, unknown>;
  contactId?: string | null;
  reportId?: string | null;
  quoteId?: string | null;
};

function requiredText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field}_required`);
  return trimmed;
}

function optionalText(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function boundedText(value: string | null | undefined, maxLength: number) {
  return optionalText(value)?.slice(0, maxLength) ?? null;
}

export async function createOrGetOperationsEmailMessageFromCommunication(
  input: MessageEditorInput & {
    workspaceId: string;
    sourceCommunicationId: string;
    actorUserId: string;
  },
) {
  const client = await ensureConnected();
  const res = await client.query<
    OperationsEmailMessageRow & { created: boolean }
  >(
    `
      WITH eligible_source AS (
        SELECT c.id, c.business_id
        FROM operations_communications c
        JOIN operations_businesses b ON b.id = c.business_id
        WHERE c.id = $2
          AND c.status = 'ready'
          AND c.direction = 'outbound'
          AND c.channel = 'email'
          AND b.internal_workspace_id = $1
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM operations_contacts contact
            WHERE contact.id = $3 AND contact.business_id = c.business_id
          ))
          AND ($4::uuid IS NULL OR EXISTS (
            SELECT 1 FROM operations_reports report
            WHERE report.id = $4 AND report.business_id = c.business_id
          ))
          AND ($5::uuid IS NULL OR EXISTS (
            SELECT 1 FROM operations_quotes quote
            WHERE quote.id = $5 AND quote.business_id = c.business_id
          ))
      ), inserted AS (
        INSERT INTO operations_email_messages (
          workspace_id,
          source_communication_id,
          business_id,
          contact_id,
          report_id,
          quote_id,
          from_name,
          from_address,
          reply_to_address,
          recipient_name,
          recipient_address,
          subject,
          preheader,
          editor_body,
          rendered_html,
          plain_text,
          source_snapshot_json,
          render_metadata_json,
          created_by_user_id,
          last_edited_by_user_id
        )
        SELECT
          $1,
          eligible_source.id,
          eligible_source.business_id,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16::jsonb,
          $17::jsonb,
          $18,
          $18
        FROM eligible_source
        ON CONFLICT (source_communication_id)
          WHERE source_communication_id IS NOT NULL
        DO NOTHING
        RETURNING *, true AS created
      )
      SELECT * FROM inserted
      UNION ALL
      SELECT existing.*, false AS created
      FROM operations_email_messages existing
      WHERE existing.workspace_id = $1
        AND existing.source_communication_id = $2
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1
    `,
    [
      input.workspaceId,
      input.sourceCommunicationId,
      input.contactId ?? null,
      input.reportId ?? null,
      input.quoteId ?? null,
      requiredText(input.fromName, "from_name"),
      requiredText(input.fromAddress, "from_address"),
      optionalText(input.replyToAddress),
      optionalText(input.recipientName),
      requiredText(input.recipientAddress, "recipient_address"),
      requiredText(input.subject, "subject"),
      optionalText(input.preheader),
      requiredText(input.editorBody, "editor_body"),
      optionalText(input.renderedHtml),
      optionalText(input.plainText),
      JSON.stringify(input.sourceSnapshotJson ?? {}),
      JSON.stringify(input.renderMetadataJson ?? {}),
      input.actorUserId,
    ],
  );
  let row = res.rows[0];
  if (!row) {
    const concurrent = await client.query<
      OperationsEmailMessageRow & { created: boolean }
    >(
      `
        SELECT existing.*, false AS created
        FROM operations_email_messages existing
        WHERE existing.workspace_id = $1
          AND existing.source_communication_id = $2
      `,
      [input.workspaceId, input.sourceCommunicationId],
    );
    row = concurrent.rows[0];
  }
  if (!row) return null;
  const { created, ...message } = row;
  return {
    created,
    disposition: created
      ? ("created" as const)
      : message.status === "sent"
        ? ("existing_sent" as const)
        : ("existing_active" as const),
    message,
  };
}

export async function createOperationsEmailMessageWithoutSource(
  input: MessageEditorInput & {
    workspaceId: string;
    businessId: string;
    actorUserId: string;
    duplicatedFromMessageId?: string | null;
  },
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      INSERT INTO operations_email_messages (
        workspace_id,
        business_id,
        contact_id,
        report_id,
        quote_id,
        duplicated_from_message_id,
        from_name,
        from_address,
        reply_to_address,
        recipient_name,
        recipient_address,
        subject,
        preheader,
        editor_body,
        rendered_html,
        plain_text,
        source_snapshot_json,
        render_metadata_json,
        created_by_user_id,
        last_edited_by_user_id
      )
      SELECT
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, $19
      WHERE EXISTS (
        SELECT 1 FROM operations_businesses b
        WHERE b.id = $2 AND b.internal_workspace_id = $1
      )
        AND ($3::uuid IS NULL OR EXISTS (
          SELECT 1 FROM operations_contacts c WHERE c.id = $3 AND c.business_id = $2
        ))
        AND ($4::uuid IS NULL OR EXISTS (
          SELECT 1 FROM operations_reports r WHERE r.id = $4 AND r.business_id = $2
        ))
        AND ($5::uuid IS NULL OR EXISTS (
          SELECT 1 FROM operations_quotes q WHERE q.id = $5 AND q.business_id = $2
        ))
        AND ($6::uuid IS NULL OR EXISTS (
          SELECT 1 FROM operations_email_messages parent
          WHERE parent.id = $6 AND parent.workspace_id = $1
        ))
      RETURNING *
    `,
    [
      input.workspaceId,
      input.businessId,
      input.contactId ?? null,
      input.reportId ?? null,
      input.quoteId ?? null,
      input.duplicatedFromMessageId ?? null,
      requiredText(input.fromName, "from_name"),
      requiredText(input.fromAddress, "from_address"),
      optionalText(input.replyToAddress),
      optionalText(input.recipientName),
      requiredText(input.recipientAddress, "recipient_address"),
      requiredText(input.subject, "subject"),
      optionalText(input.preheader),
      requiredText(input.editorBody, "editor_body"),
      optionalText(input.renderedHtml),
      optionalText(input.plainText),
      JSON.stringify(input.sourceSnapshotJson ?? {}),
      JSON.stringify(input.renderMetadataJson ?? {}),
      input.actorUserId,
    ],
  );
  return res.rows[0] ?? null;
}

export async function getOperationsEmailMessage(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `SELECT * FROM operations_email_messages WHERE id = $1 AND workspace_id = $2`,
    [messageId, workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function getOperationsEmailTransferSource(
  workspaceId: string,
  communicationId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailTransferSource>(
    `
      SELECT
        c.*,
        b.internal_workspace_id AS workspace_id,
        b.name AS business_name,
        contact.first_name AS contact_first_name,
        contact.last_name AS contact_last_name,
        contact.email AS contact_email,
        template.name AS template_name,
        related_report.id AS report_id,
        related_quote.id AS quote_id
      FROM operations_communications c
      JOIN operations_businesses b ON b.id = c.business_id
      LEFT JOIN operations_contacts contact ON contact.id = c.contact_id
      LEFT JOIN operations_client_communication_templates template
        ON template.id = c.template_id
      LEFT JOIN LATERAL (
        SELECT report.id
        FROM operations_reports report
        WHERE report.delivery_communication_id = c.id
        ORDER BY report.updated_at DESC
        LIMIT 1
      ) related_report ON true
      LEFT JOIN LATERAL (
        SELECT quote.id
        FROM operations_quotes quote
        WHERE quote.delivery_communication_id = c.id
        ORDER BY quote.updated_at DESC
        LIMIT 1
      ) related_quote ON true
      WHERE c.id = $2
        AND b.internal_workspace_id = $1
    `,
    [workspaceId, communicationId],
  );
  return res.rows[0] ?? null;
}

export async function getOperationsEmailMessageDetail(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageDetail>(
    `
      SELECT
        message.*,
        business.name AS business_name,
        NULLIF(trim(concat_ws(' ', contact.first_name, contact.last_name)), '')
          AS contact_name,
        contact.email AS contact_email,
        COALESCE(created_actor.display_name, created_actor.email)
          AS created_actor_label,
        COALESCE(last_editor.display_name, last_editor.email)
          AS last_editor_label,
        COALESCE(sent_actor.display_name, sent_actor.email)
          AS sent_actor_label
      FROM operations_email_messages message
      JOIN operations_businesses business ON business.id = message.business_id
      LEFT JOIN operations_contacts contact ON contact.id = message.contact_id
      LEFT JOIN users created_actor ON created_actor.id = message.created_by_user_id
      LEFT JOIN users last_editor ON last_editor.id = message.last_edited_by_user_id
      LEFT JOIN users sent_actor ON sent_actor.id = message.send_requested_by_user_id
      WHERE message.id = $2
        AND message.workspace_id = $1
    `,
    [workspaceId, messageId],
  );
  return res.rows[0] ?? null;
}

export async function listOperationsEmailMessageSummaries(input: {
  workspaceId: string;
  statuses?: OperationsEmailMessageStatus[];
  search?: string | null;
  limit: number;
  offset: number;
}) {
  const client = await ensureConnected();
  const values = [
    input.workspaceId,
    input.statuses?.length ? input.statuses : null,
    optionalText(input.search),
    Math.min(Math.max(input.limit, 1), 200),
    Math.max(input.offset, 0),
  ];
  const rows = await client.query<OperationsEmailMessageSummary>(
    `
      SELECT
        message.id,
        message.source_communication_id,
        message.sent_communication_id,
        message.business_id,
        message.contact_id,
        message.recipient_name,
        message.recipient_address,
        message.subject,
        message.status,
        message.revision,
        message.created_at,
        message.updated_at,
        message.ready_at,
        message.sent_at,
        message.failed_at,
        message.uncertain_at,
        message.safe_display_error,
        business.name AS business_name,
        NULLIF(trim(concat_ws(' ', contact.first_name, contact.last_name)), '')
          AS contact_name,
        COALESCE(last_editor.display_name, last_editor.email)
          AS last_editor_label,
        COALESCE(sent_actor.display_name, sent_actor.email)
          AS sent_actor_label
      FROM operations_email_messages message
      JOIN operations_businesses business ON business.id = message.business_id
      LEFT JOIN operations_contacts contact ON contact.id = message.contact_id
      LEFT JOIN users last_editor ON last_editor.id = message.last_edited_by_user_id
      LEFT JOIN users sent_actor ON sent_actor.id = message.send_requested_by_user_id
      WHERE message.workspace_id = $1
        AND ($2::text[] IS NULL OR message.status = ANY($2::text[]))
        AND (
          $3::text IS NULL
          OR message.subject ILIKE '%' || $3 || '%'
          OR message.recipient_address ILIKE '%' || $3 || '%'
          OR business.name ILIKE '%' || $3 || '%'
          OR concat_ws(' ', contact.first_name, contact.last_name)
            ILIKE '%' || $3 || '%'
        )
      ORDER BY message.updated_at DESC, message.id DESC
      LIMIT $4 OFFSET $5
    `,
    values,
  );
  const aggregate = await client.query<{
    total: string;
    draft_count: string;
    ready_count: string;
    sent_count: string;
    failed_count: string;
  }>(
    `
      SELECT
        count(*) FILTER (
          WHERE ($2::text[] IS NULL OR message.status = ANY($2::text[]))
        )::text AS total,
        count(*) FILTER (WHERE message.status = 'draft')::text AS draft_count,
        count(*) FILTER (WHERE message.status = 'ready')::text AS ready_count,
        count(*) FILTER (WHERE message.status = 'sent')::text AS sent_count,
        count(*) FILTER (
          WHERE message.status IN ('failed', 'delivery_uncertain', 'cancelled')
        )::text AS failed_count
      FROM operations_email_messages message
      JOIN operations_businesses business ON business.id = message.business_id
      LEFT JOIN operations_contacts contact ON contact.id = message.contact_id
      WHERE message.workspace_id = $1
        AND (
          $3::text IS NULL
          OR message.subject ILIKE '%' || $3 || '%'
          OR message.recipient_address ILIKE '%' || $3 || '%'
          OR business.name ILIKE '%' || $3 || '%'
          OR concat_ws(' ', contact.first_name, contact.last_name)
            ILIKE '%' || $3 || '%'
        )
    `,
    values.slice(0, 3),
  );
  const counts = aggregate.rows[0];
  return {
    messages: rows.rows,
    total: Number(counts?.total ?? 0),
    counts: {
      draft: Number(counts?.draft_count ?? 0),
      ready: Number(counts?.ready_count ?? 0),
      sent: Number(counts?.sent_count ?? 0),
      failed: Number(counts?.failed_count ?? 0),
    },
  };
}

export async function listOperationsEmailMessages(input: {
  workspaceId: string;
  statuses?: OperationsEmailMessageStatus[];
  businessId?: string | null;
  contactId?: string | null;
  limit: number;
  offset: number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      SELECT *
      FROM operations_email_messages
      WHERE workspace_id = $1
        AND ($2::text[] IS NULL OR status = ANY($2::text[]))
        AND ($3::uuid IS NULL OR business_id = $3)
        AND ($4::uuid IS NULL OR contact_id = $4)
      ORDER BY updated_at DESC, id DESC
      LIMIT $5 OFFSET $6
    `,
    [
      input.workspaceId,
      input.statuses?.length ? input.statuses : null,
      input.businessId ?? null,
      input.contactId ?? null,
      Math.min(Math.max(input.limit, 1), 200),
      Math.max(input.offset, 0),
    ],
  );
  return res.rows;
}

async function classifyOptimisticMessageResult(
  workspaceId: string,
  messageId: string,
  expectedRevision: number,
  editableStatuses: OperationsEmailMessageStatus[],
): Promise<OperationsEmailOptimisticResult> {
  const message = await getOperationsEmailMessage(workspaceId, messageId);
  if (!message) return { outcome: "not_found", message: null };
  if (!editableStatuses.includes(message.status)) {
    return { outcome: "invalid_state", message };
  }
  if (message.revision !== expectedRevision) {
    return { outcome: "stale_revision", message };
  }
  return { outcome: "stale_revision", message };
}

export async function updateOperationsEmailMessageEditor(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  patch: Partial<MessageEditorInput>;
}): Promise<OperationsEmailOptimisticResult> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown, cast = "") => {
    values.push(value);
    sets.push(`${column} = $${values.length}${cast}`);
  };
  const patch = input.patch;
  if (patch.fromName !== undefined)
    add("from_name", requiredText(patch.fromName, "from_name"));
  if (patch.fromAddress !== undefined)
    add("from_address", requiredText(patch.fromAddress, "from_address"));
  if (patch.replyToAddress !== undefined)
    add("reply_to_address", optionalText(patch.replyToAddress));
  if (patch.recipientName !== undefined)
    add("recipient_name", optionalText(patch.recipientName));
  if (patch.recipientAddress !== undefined)
    add(
      "recipient_address",
      requiredText(patch.recipientAddress, "recipient_address"),
    );
  if (patch.subject !== undefined)
    add("subject", requiredText(patch.subject, "subject"));
  if (patch.preheader !== undefined)
    add("preheader", optionalText(patch.preheader));
  if (patch.editorBody !== undefined)
    add("editor_body", requiredText(patch.editorBody, "editor_body"));
  if (patch.renderedHtml !== undefined)
    add("rendered_html", optionalText(patch.renderedHtml));
  if (patch.plainText !== undefined)
    add("plain_text", optionalText(patch.plainText));
  if (patch.sourceSnapshotJson !== undefined)
    add(
      "source_snapshot_json",
      JSON.stringify(patch.sourceSnapshotJson),
      "::jsonb",
    );
  if (patch.renderMetadataJson !== undefined)
    add(
      "render_metadata_json",
      JSON.stringify(patch.renderMetadataJson),
      "::jsonb",
    );
  if (sets.length === 0) {
    const message = await getOperationsEmailMessage(
      input.workspaceId,
      input.messageId,
    );
    if (!message) return { outcome: "not_found", message: null };
    if (
      !(["draft", "ready"] as OperationsEmailMessageStatus[]).includes(
        message.status,
      )
    ) {
      return { outcome: "invalid_state", message };
    }
    if (message.revision !== input.expectedRevision) {
      return { outcome: "stale_revision", message };
    }
    return { outcome: "updated", message };
  }
  values.push(
    input.actorUserId,
    input.messageId,
    input.workspaceId,
    input.expectedRevision,
  );
  const actorParam = values.length - 3;
  const messageParam = values.length - 2;
  const workspaceParam = values.length - 1;
  const revisionParam = values.length;
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages
      SET ${sets.join(", ")},
          last_edited_by_user_id = $${actorParam},
          status = CASE WHEN status = 'ready' THEN 'draft' ELSE status END,
          ready_at = CASE WHEN status = 'ready' THEN NULL ELSE ready_at END,
          final_render_revision = NULL,
          final_render_attachment_set_sha256 = NULL,
          final_render_html = NULL,
          final_render_plain_text = NULL,
          final_render_html_sha256 = NULL,
          final_render_plain_text_sha256 = NULL,
          final_render_generated_at = NULL,
          final_renderer_version = NULL,
          revision = revision + 1,
          updated_at = now()
      WHERE id = $${messageParam}
        AND workspace_id = $${workspaceParam}
        AND revision = $${revisionParam}
        AND status IN ('draft', 'ready')
      RETURNING *
    `,
    values,
  );
  if (res.rows[0]) return { outcome: "updated", message: res.rows[0] };
  return classifyOptimisticMessageResult(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
    ["draft", "ready"],
  );
}

const MESSAGE_TRANSITION_SOURCES: Record<
  "ready" | "draft",
  OperationsEmailMessageStatus[]
> = {
  ready: ["draft"],
  draft: ["ready"],
};

async function transitionEditableOperationsEmailMessage(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  targetStatus: "ready" | "draft";
}): Promise<OperationsEmailOptimisticResult> {
  const allowed = MESSAGE_TRANSITION_SOURCES[input.targetStatus];
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages
      SET status = $1,
          ready_at = CASE WHEN $1 = 'ready' THEN now() ELSE NULL END,
          final_render_revision = CASE
            WHEN $1 = 'ready' THEN revision + 1
            ELSE final_render_revision
          END,
          last_edited_by_user_id = $2,
          safe_display_error = NULL,
          revision = revision + 1,
          updated_at = now()
      WHERE id = $3
        AND workspace_id = $4
        AND revision = $5
        AND status = ANY($6::text[])
        AND (
          $1 <> 'ready'
          OR (
            final_render_revision = revision
            AND final_render_attachment_set_sha256 IS NOT NULL
            AND final_render_html_sha256 IS NOT NULL
            AND final_render_plain_text_sha256 IS NOT NULL
          )
        )
      RETURNING *
    `,
    [
      input.targetStatus,
      input.actorUserId,
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
      allowed,
    ],
  );
  if (res.rows[0]) return { outcome: "updated", message: res.rows[0] };
  return classifyOptimisticMessageResult(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
    allowed,
  );
}

export function markOperationsEmailMessageReady(
  input: Omit<
    Parameters<typeof transitionEditableOperationsEmailMessage>[0],
    "targetStatus"
  >,
) {
  return transitionEditableOperationsEmailMessage({
    ...input,
    targetStatus: "ready",
  });
}

export function returnOperationsEmailMessageToDraft(
  input: Omit<
    Parameters<typeof transitionEditableOperationsEmailMessage>[0],
    "targetStatus"
  >,
) {
  return transitionEditableOperationsEmailMessage({
    ...input,
    targetStatus: "draft",
  });
}

export async function cancelOperationsEmailMessage(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  reason: string;
}): Promise<OperationsEmailOptimisticResult> {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages
      SET status = 'cancelled',
          cancelled_at = now(),
          cancelled_by_user_id = $1,
          cancellation_reason = $2,
          revision = revision + 1,
          updated_at = now()
      WHERE id = $3
        AND workspace_id = $4
        AND revision = $5
        AND status IN ('draft', 'ready')
      RETURNING *
    `,
    [
      input.actorUserId,
      requiredText(input.reason, "cancellation_reason").slice(0, 500),
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
    ],
  );
  if (res.rows[0]) return { outcome: "updated", message: res.rows[0] };
  return classifyOptimisticMessageResult(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
    ["draft", "ready"],
  );
}

export async function cancelOperationsEmailForManualWorkflow(input: {
  workspaceId: string;
  sourceCommunicationId: string;
  actorUserId: string;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages
      SET status = 'cancelled',
          cancelled_at = now(),
          cancelled_by_user_id = $1,
          cancellation_reason = 'manual_workflow_completed',
          revision = revision + 1,
          updated_at = now()
      WHERE workspace_id = $2
        AND source_communication_id = $3
        AND status IN ('draft', 'ready')
      RETURNING *
    `,
    [input.actorUserId, input.workspaceId, input.sourceCommunicationId],
  );
  if (res.rows[0])
    return { outcome: "cancelled" as const, message: res.rows[0] };
  const existing = await client.query<OperationsEmailMessageRow>(
    `
      SELECT * FROM operations_email_messages
      WHERE workspace_id = $1 AND source_communication_id = $2
    `,
    [input.workspaceId, input.sourceCommunicationId],
  );
  return existing.rows[0]
    ? { outcome: "protected_state" as const, message: existing.rows[0] }
    : { outcome: "not_found" as const, message: null };
}

export async function getOperationsEmailSourceLinks(
  workspaceId: string,
  communicationIds: string[],
) {
  if (communicationIds.length === 0)
    return new Map<string, OperationsEmailSourceLink>();
  const client = await ensureConnected();
  const res = await client.query<{
    source_communication_id: string;
    id: string;
    status: OperationsEmailMessageStatus;
    sent_at: Date | null;
    send_requested_by_user_id: string | null;
    sent_actor_label: string | null;
    sent_communication_id: string | null;
  }>(
    `
      SELECT
        message.source_communication_id,
        message.id,
        message.status,
        message.sent_at,
        message.send_requested_by_user_id,
        COALESCE(actor.display_name, actor.email) AS sent_actor_label,
        message.sent_communication_id
      FROM operations_email_messages message
      LEFT JOIN users actor ON actor.id = message.send_requested_by_user_id
      WHERE message.workspace_id = $1
        AND message.source_communication_id = ANY($2::uuid[])
    `,
    [workspaceId, communicationIds],
  );
  return new Map(
    res.rows.map((row) => [
      row.source_communication_id,
      {
        sourceCommunicationId: row.source_communication_id,
        messageId: row.id,
        messageStatus: row.status,
        sentAt: row.sent_at,
        sendRequestedByUserId: row.send_requested_by_user_id,
        sentActorLabel: row.sent_actor_label,
        sentCommunicationId: row.sent_communication_id,
      },
    ]),
  );
}

export async function addOperationsEmailAttachmentMetadata(input: {
  workspaceId: string;
  messageId: string;
  actorUserId: string;
  sourceType: OperationsEmailAttachmentSourceType;
  sourceReportId?: string | null;
  sourceQuoteId?: string | null;
  displayFilename: string;
  storageFilename: string;
  declaredMimeType: string;
  verifiedMimeType?: string | null;
  sizeBytes: number;
  sha256?: string | null;
  storageKey?: string | null;
  storageReferenceJson?: Record<string, unknown>;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailAttachmentRow>(
    `
      INSERT INTO operations_email_attachments (
        message_id,
        workspace_id,
        source_type,
        source_report_id,
        source_quote_id,
        display_filename,
        storage_filename,
        declared_mime_type,
        verified_mime_type,
        size_bytes,
        sha256,
        storage_key,
        storage_reference_json,
        created_by_user_id
      )
      SELECT
        message.id, message.workspace_id, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13::jsonb, $14
      FROM operations_email_messages message
      WHERE message.id = $1
        AND message.workspace_id = $2
        AND message.status IN ('draft', 'ready')
        AND ($4::uuid IS NULL OR (
          message.report_id = $4
          AND EXISTS (
            SELECT 1 FROM operations_reports report
            WHERE report.id = $4 AND report.business_id = message.business_id
          )
        ))
        AND ($5::uuid IS NULL OR (
          message.quote_id = $5
          AND EXISTS (
            SELECT 1 FROM operations_quotes quote
            WHERE quote.id = $5 AND quote.business_id = message.business_id
          )
        ))
      RETURNING *
    `,
    [
      input.messageId,
      input.workspaceId,
      input.sourceType,
      input.sourceReportId ?? null,
      input.sourceQuoteId ?? null,
      requiredText(input.displayFilename, "display_filename"),
      requiredText(input.storageFilename, "storage_filename"),
      requiredText(input.declaredMimeType, "declared_mime_type"),
      optionalText(input.verifiedMimeType),
      input.sizeBytes,
      optionalText(input.sha256)?.toLowerCase() ?? null,
      optionalText(input.storageKey),
      JSON.stringify(input.storageReferenceJson ?? {}),
      input.actorUserId,
    ],
  );
  return res.rows[0] ?? null;
}

export async function getOperationsEmailAttachment(
  workspaceId: string,
  messageId: string,
  attachmentId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailAttachmentRow>(
    `
      SELECT * FROM operations_email_attachments
      WHERE id = $1 AND message_id = $2 AND workspace_id = $3
    `,
    [attachmentId, messageId, workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function listActiveOperationsEmailAttachments(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailAttachmentRow>(
    `
      SELECT * FROM operations_email_attachments
      WHERE workspace_id = $1 AND message_id = $2 AND removed_at IS NULL
      ORDER BY created_at ASC, id ASC
    `,
    [workspaceId, messageId],
  );
  return res.rows;
}

export async function softRemoveOperationsEmailAttachment(input: {
  workspaceId: string;
  messageId: string;
  attachmentId: string;
  actorUserId: string;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailAttachmentRow>(
    `
      UPDATE operations_email_attachments attachment
      SET removed_at = now(), removed_by_user_id = $1
      FROM operations_email_messages message
      WHERE attachment.id = $2
        AND attachment.message_id = $3
        AND attachment.workspace_id = $4
        AND message.id = attachment.message_id
        AND message.workspace_id = attachment.workspace_id
        AND message.status IN ('draft', 'ready')
        AND attachment.removed_at IS NULL
      RETURNING attachment.*
    `,
    [input.actorUserId, input.attachmentId, input.messageId, input.workspaceId],
  );
  return res.rows[0] ?? null;
}

export type OperationsEmailFrozenMimeInput = {
  fixedMessageId: string;
  dateHeader: Date;
  envelopeSender: string;
  envelopeRecipient: string;
  rawMimeBytes?: Buffer | null;
  rawMimeStorageKey?: string | null;
  mimeSha256: string;
  frozenMetadataJson?: Record<string, unknown>;
};

function validateFrozenMime(input: OperationsEmailFrozenMimeInput) {
  const hasBytes = input.rawMimeBytes != null && input.rawMimeBytes.length > 0;
  const hasStorage = optionalText(input.rawMimeStorageKey) != null;
  if (hasBytes === hasStorage) throw new Error("frozen_mime_source_invalid");
  const sha256 = input.mimeSha256.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error("mime_sha256_invalid");
  }
  return {
    fixedMessageId: requiredText(input.fixedMessageId, "fixed_message_id"),
    dateHeader: input.dateHeader,
    envelopeSender: requiredText(input.envelopeSender, "envelope_sender"),
    envelopeRecipient: requiredText(
      input.envelopeRecipient,
      "envelope_recipient",
    ),
    rawMimeBytes: hasBytes ? input.rawMimeBytes : null,
    rawMimeStorageKey: hasStorage
      ? optionalText(input.rawMimeStorageKey)
      : null,
    mimeSha256: sha256,
    frozenMetadataJson: input.frozenMetadataJson ?? {},
  };
}

export type OperationsEmailQueueResult =
  | {
      outcome: "created" | "existing";
      delivery: OperationsEmailDeliveryRow;
      message: OperationsEmailMessageRow;
    }
  | {
      outcome: "stale_revision" | "invalid_state" | "source_not_ready";
      delivery: null;
      message: OperationsEmailMessageRow;
    }
  | { outcome: "not_found"; delivery: null; message: null };

async function classifyQueueFailure(
  workspaceId: string,
  messageId: string,
  expectedRevision: number,
): Promise<OperationsEmailQueueResult> {
  const message = await getOperationsEmailMessage(workspaceId, messageId);
  if (!message) return { outcome: "not_found", delivery: null, message: null };
  if (message.revision !== expectedRevision) {
    return { outcome: "stale_revision", delivery: null, message };
  }
  if (message.status !== "ready") {
    return { outcome: "invalid_state", delivery: null, message };
  }
  if (message.source_communication_id) {
    const client = await ensureConnected();
    const source = await client.query<{ status: string }>(
      `SELECT status FROM operations_communications WHERE id = $1`,
      [message.source_communication_id],
    );
    if (source.rows[0]?.status !== "ready") {
      return { outcome: "source_not_ready", delivery: null, message };
    }
  }
  return { outcome: "invalid_state", delivery: null, message };
}

export async function createOrGetOperationsEmailTestDelivery(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  idempotencyKey: string;
  frozenMime: OperationsEmailFrozenMimeInput;
}): Promise<OperationsEmailQueueResult> {
  const frozen = validateFrozenMime(input.frozenMime);
  const client = await ensureConnected();
  const res = await client.query<{ created: boolean; delivery_id: string }>(
    `
      WITH eligible_message AS (
        SELECT *
        FROM operations_email_messages
        WHERE id = $1
          AND workspace_id = $2
          AND revision = $3
          AND status IN ('draft', 'ready')
      ), inserted AS (
        INSERT INTO operations_email_deliveries (
          workspace_id,
          message_id,
          delivery_kind,
          initiated_by_user_id,
          idempotency_key,
          fixed_message_id,
          date_header,
          envelope_sender,
          envelope_recipient,
          raw_mime_bytes,
          raw_mime_storage_key,
          mime_sha256,
          frozen_metadata_json,
          smtp_phase,
          retry_policy,
          sent_copy_status
        )
        SELECT
          $2, eligible_message.id, 'test', $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13::jsonb, 'not_started', 'automatic', 'not_required'
        FROM eligible_message
        ON CONFLICT (message_id, delivery_kind, idempotency_key) DO NOTHING
        RETURNING *
      ), selected_delivery AS (
        SELECT inserted.*, true AS created FROM inserted
        UNION ALL
        SELECT existing.*, false AS created
        FROM operations_email_deliveries existing
        WHERE existing.workspace_id = $2
          AND existing.message_id = $1
          AND existing.delivery_kind = 'test'
          AND existing.idempotency_key = $5
          AND NOT EXISTS (SELECT 1 FROM inserted)
        LIMIT 1
      )
      SELECT selected_delivery.created, selected_delivery.id AS delivery_id
      FROM selected_delivery
    `,
    [
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
      input.actorUserId,
      requiredText(input.idempotencyKey, "idempotency_key").slice(0, 200),
      frozen.fixedMessageId,
      frozen.dateHeader,
      frozen.envelopeSender,
      frozen.envelopeRecipient,
      frozen.rawMimeBytes,
      frozen.rawMimeStorageKey,
      frozen.mimeSha256,
      JSON.stringify(frozen.frozenMetadataJson),
    ],
  );
  const row = res.rows[0];
  if (row) {
    const [delivery, message] = await Promise.all([
      getOperationsEmailDelivery(input.workspaceId, row.delivery_id),
      getOperationsEmailMessage(input.workspaceId, input.messageId),
    ]);
    if (!delivery || !message) throw new Error("queued_delivery_not_found");
    return {
      outcome: row.created ? "created" : "existing",
      delivery,
      message,
    };
  }
  const existing = await client.query<OperationsEmailDeliveryRow>(
    `
      SELECT * FROM operations_email_deliveries
      WHERE workspace_id = $1
        AND message_id = $2
        AND delivery_kind = 'test'
        AND idempotency_key = $3
    `,
    [input.workspaceId, input.messageId, input.idempotencyKey],
  );
  if (existing.rows[0]) {
    const message = await getOperationsEmailMessage(
      input.workspaceId,
      input.messageId,
    );
    if (!message) throw new Error("queued_message_not_found");
    return { outcome: "existing", delivery: existing.rows[0], message };
  }
  return classifyQueueFailure(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
  );
}

export async function createOrGetAndQueueOperationsEmailRealDelivery(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  idempotencyKey: string;
  frozenMime: OperationsEmailFrozenMimeInput;
}): Promise<OperationsEmailQueueResult> {
  const frozen = validateFrozenMime(input.frozenMime);
  const client = await ensureConnected();
  const res = await client.query<{ created: boolean; delivery_id: string }>(
    `
      WITH existing_delivery AS (
        SELECT delivery.*
        FROM operations_email_deliveries delivery
        WHERE delivery.workspace_id = $2
          AND delivery.message_id = $1
          AND delivery.delivery_kind = 'real'
        LIMIT 1
      ), eligible_message AS (
        SELECT message.*
        FROM operations_email_messages message
        WHERE message.id = $1
          AND message.workspace_id = $2
          AND message.revision = $3
          AND message.status = 'ready'
          AND NOT EXISTS (SELECT 1 FROM existing_delivery)
          AND (
            message.source_communication_id IS NULL
            OR EXISTS (
              SELECT 1
              FROM operations_communications communication
              WHERE communication.id = message.source_communication_id
                AND communication.status = 'ready'
            )
          )
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = 'queued',
            queued_at = now(),
            send_requested_by_user_id = $4,
            safe_display_error = NULL,
            revision = message.revision + 1,
            updated_at = now()
        FROM eligible_message
        WHERE message.id = eligible_message.id
          AND message.workspace_id = eligible_message.workspace_id
          AND message.status = 'ready'
          AND message.revision = $3
        RETURNING message.*
      ), inserted AS (
        INSERT INTO operations_email_deliveries (
          workspace_id,
          message_id,
          delivery_kind,
          initiated_by_user_id,
          idempotency_key,
          fixed_message_id,
          date_header,
          envelope_sender,
          envelope_recipient,
          raw_mime_bytes,
          raw_mime_storage_key,
          mime_sha256,
          frozen_metadata_json,
          smtp_phase,
          retry_policy,
          sent_copy_status
        )
        SELECT
          $2, updated_message.id, 'real', $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13::jsonb, 'not_started', 'automatic', 'not_required'
        FROM updated_message
        ON CONFLICT DO NOTHING
        RETURNING *
      ), selected_delivery AS (
        SELECT inserted.*, true AS created FROM inserted
        UNION ALL
        SELECT existing_delivery.*, false AS created
        FROM existing_delivery
        WHERE NOT EXISTS (SELECT 1 FROM inserted)
        UNION ALL
        SELECT concurrent.*, false AS created
        FROM operations_email_deliveries concurrent
        WHERE concurrent.workspace_id = $2
          AND concurrent.message_id = $1
          AND concurrent.delivery_kind = 'real'
          AND NOT EXISTS (SELECT 1 FROM inserted)
          AND NOT EXISTS (SELECT 1 FROM existing_delivery)
        LIMIT 1
      )
      SELECT selected_delivery.created, selected_delivery.id AS delivery_id
      FROM selected_delivery
    `,
    [
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
      input.actorUserId,
      requiredText(input.idempotencyKey, "idempotency_key").slice(0, 200),
      frozen.fixedMessageId,
      frozen.dateHeader,
      frozen.envelopeSender,
      frozen.envelopeRecipient,
      frozen.rawMimeBytes,
      frozen.rawMimeStorageKey,
      frozen.mimeSha256,
      JSON.stringify(frozen.frozenMetadataJson),
    ],
  );
  const row = res.rows[0];
  if (row) {
    const [delivery, message] = await Promise.all([
      getOperationsEmailDelivery(input.workspaceId, row.delivery_id),
      getOperationsEmailMessage(input.workspaceId, input.messageId),
    ]);
    if (!delivery || !message) throw new Error("queued_delivery_not_found");
    return {
      outcome: row.created ? "created" : "existing",
      delivery,
      message,
    };
  }
  const existing = await client.query<OperationsEmailDeliveryRow>(
    `
      SELECT * FROM operations_email_deliveries
      WHERE workspace_id = $1
        AND message_id = $2
        AND delivery_kind = 'real'
      LIMIT 1
    `,
    [input.workspaceId, input.messageId],
  );
  if (existing.rows[0]) {
    const message = await getOperationsEmailMessage(
      input.workspaceId,
      input.messageId,
    );
    if (!message) throw new Error("queued_message_not_found");
    return { outcome: "existing", delivery: existing.rows[0], message };
  }
  return classifyQueueFailure(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
  );
}

export async function getOperationsEmailDelivery(
  workspaceId: string,
  deliveryId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `SELECT * FROM operations_email_deliveries WHERE id = $1 AND workspace_id = $2`,
    [deliveryId, workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function listOperationsEmailDeliveryHistory(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      SELECT * FROM operations_email_deliveries
      WHERE workspace_id = $1 AND message_id = $2
      ORDER BY created_at DESC, id DESC
    `,
    [workspaceId, messageId],
  );
  return res.rows;
}

export async function claimDueOperationsEmailSmtpDelivery(input: {
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH due AS (
        SELECT delivery.id
        FROM operations_email_deliveries delivery
        WHERE (
            (delivery.status = 'queued' AND delivery.next_attempt_at <= now())
            OR (
              delivery.status = 'sending'
              AND delivery.smtp_lock_expires_at < now()
              AND delivery.transmission_may_have_begun = false
              AND delivery.retry_policy = 'automatic'
            )
          )
          AND delivery.status <> 'delivery_uncertain'
          AND delivery.transmission_may_have_begun = false
          AND delivery.fixed_message_id IS NOT NULL
          AND delivery.date_header IS NOT NULL
          AND delivery.envelope_sender IS NOT NULL
          AND delivery.envelope_recipient IS NOT NULL
          AND delivery.mime_sha256 IS NOT NULL
          AND (delivery.raw_mime_bytes IS NOT NULL OR delivery.raw_mime_storage_key IS NOT NULL)
        ORDER BY delivery.next_attempt_at ASC, delivery.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      ), claimed AS (
        UPDATE operations_email_deliveries delivery
        SET status = 'sending',
            smtp_phase = COALESCE(delivery.smtp_phase, 'not_started'),
            smtp_lock_owner = $1,
            smtp_locked_at = now(),
            smtp_lock_expires_at = now() + ($2 * interval '1 second'),
            sending_at = COALESCE(delivery.sending_at, now()),
            automatic_attempt_count = delivery.automatic_attempt_count + 1,
            updated_at = now()
        WHERE delivery.id = (SELECT id FROM due)
        RETURNING delivery.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = 'sending',
            sending_at = COALESCE(message.sending_at, now()),
            revision = revision + 1,
            updated_at = now()
        FROM claimed
        WHERE claimed.delivery_kind = 'real'
          AND message.id = claimed.message_id
          AND message.workspace_id = claimed.workspace_id
          AND message.status IN ('queued', 'sending')
        RETURNING message.id
      )
      SELECT * FROM claimed
    `,
    [requiredText(input.workerId, "worker_id"), input.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function renewOperationsEmailSmtpLease(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET smtp_lock_expires_at = now() + ($4 * interval '1 second'),
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND smtp_lock_owner = $3
        AND status = 'sending'
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.workerId, input.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function recordOperationsEmailPreTransmissionSmtpPhase(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  smtpPhase: "not_started" | "connect" | "envelope";
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET smtp_phase = $4,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND smtp_lock_owner = $3
        AND status = 'sending'
        AND transmission_may_have_begun = false
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.workerId, input.smtpPhase],
  );
  return res.rows[0] ?? null;
}

export async function markOperationsEmailTransmissionBegun(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET smtp_phase = 'data',
          transmission_may_have_begun = true,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND smtp_lock_owner = $3
        AND status = 'sending'
        AND transmission_may_have_begun = false
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.workerId],
  );
  return res.rows[0] ?? null;
}

export async function releaseOperationsEmailSmtpLeaseSafely(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  nextAttemptAt: Date;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET status = 'queued',
          smtp_lock_owner = NULL,
          smtp_locked_at = NULL,
          smtp_lock_expires_at = NULL,
          next_attempt_at = $4,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND smtp_lock_owner = $3
        AND status = 'sending'
        AND transmission_may_have_begun = false
        AND retry_policy = 'automatic'
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.workerId, input.nextAttemptAt],
  );
  return res.rows[0] ?? null;
}

export async function requeueFailedOperationsEmailDeliveryManually(input: {
  workspaceId: string;
  deliveryId: string;
  actorUserId: string;
  frozenMime: OperationsEmailFrozenMimeInput;
}) {
  const frozen = validateFrozenMime(input.frozenMime);
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH requeued AS (
        UPDATE operations_email_deliveries delivery
        SET status = 'queued',
            initiated_by_user_id = $3,
            fixed_message_id = $4,
            date_header = $5,
            envelope_sender = $6,
            envelope_recipient = $7,
            raw_mime_bytes = $8,
            raw_mime_storage_key = $9,
            mime_sha256 = $10,
            frozen_metadata_json = $11::jsonb,
            smtp_phase = 'not_started',
            failure_class = NULL,
            retry_policy = 'automatic',
            transmission_may_have_begun = false,
            sanitized_provider_code = NULL,
            sanitized_command = NULL,
            response_code = NULL,
            response_class = NULL,
            safe_display_error = NULL,
            redacted_internal_error = NULL,
            manual_retry_count = manual_retry_count + 1,
            next_attempt_at = now(),
            queued_at = now(),
            sending_at = NULL,
            failed_at = NULL,
            smtp_lock_owner = NULL,
            smtp_locked_at = NULL,
            smtp_lock_expires_at = NULL,
            updated_at = now()
        FROM operations_email_messages message
        WHERE delivery.id = $1
          AND delivery.workspace_id = $2
          AND delivery.status = 'failed'
          AND delivery.transmission_may_have_begun = false
          AND delivery.failure_class <> 'uncertain'
          AND message.id = delivery.message_id
          AND message.workspace_id = delivery.workspace_id
          AND (
            delivery.delivery_kind = 'test'
            OR (
              message.status = 'failed'
              AND (
                message.source_communication_id IS NULL
                OR EXISTS (
                  SELECT 1 FROM operations_communications source
                  WHERE source.id = message.source_communication_id
                    AND source.status = 'ready'
                )
              )
            )
          )
        RETURNING delivery.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = 'queued',
            queued_at = now(),
            failed_at = NULL,
            safe_display_error = NULL,
            send_requested_by_user_id = $3,
            revision = revision + 1,
            updated_at = now()
        FROM requeued delivery
        WHERE delivery.delivery_kind = 'real'
          AND message.id = delivery.message_id
          AND message.workspace_id = delivery.workspace_id
          AND message.status = 'failed'
        RETURNING message.id
      )
      SELECT * FROM requeued
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.actorUserId,
      frozen.fixedMessageId,
      frozen.dateHeader,
      frozen.envelopeSender,
      frozen.envelopeRecipient,
      frozen.rawMimeBytes,
      frozen.rawMimeStorageKey,
      frozen.mimeSha256,
      JSON.stringify(frozen.frozenMetadataJson),
    ],
  );
  return res.rows[0] ?? null;
}

export type OperationsEmailFailureInput = {
  smtpPhase: OperationsEmailSmtpPhase;
  failureClass: Exclude<OperationsEmailFailureClass, "uncertain">;
  retryPolicy: OperationsEmailRetryPolicy;
  sanitizedProviderCode?: string | null;
  sanitizedCommand?: string | null;
  responseCode?: number | null;
  responseClass?: number | null;
  safeDisplayError: string;
  redactedInternalError?: string | null;
  nextAttemptAt?: Date | null;
};

export async function recordOperationsEmailSafePreSendFailure(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  failure: OperationsEmailFailureInput;
}) {
  if (
    !["not_started", "connect", "envelope"].includes(input.failure.smtpPhase)
  ) {
    throw new Error("safe_failure_requires_pre_transmission_phase");
  }
  if (
    input.failure.retryPolicy === "automatic" &&
    input.failure.failureClass !== "transient_pre_acceptance"
  ) {
    throw new Error("automatic_retry_requires_transient_failure");
  }
  if (
    input.failure.retryPolicy === "automatic" &&
    !input.failure.nextAttemptAt
  ) {
    throw new Error("automatic_retry_time_required");
  }
  const willRetry = input.failure.retryPolicy === "automatic";
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH updated_delivery AS (
        UPDATE operations_email_deliveries delivery
        SET status = CASE WHEN $4 THEN 'queued' ELSE 'failed' END,
            smtp_phase = $5,
            failure_class = $6,
            retry_policy = $7,
            transmission_may_have_begun = false,
            sanitized_provider_code = $8,
            sanitized_command = $9,
            response_code = $10,
            response_class = $11,
            safe_display_error = $12,
            redacted_internal_error = $13,
            failed_at = CASE WHEN $4 THEN delivery.failed_at ELSE now() END,
            next_attempt_at = COALESCE($14, delivery.next_attempt_at),
            smtp_lock_owner = NULL,
            smtp_locked_at = NULL,
            smtp_lock_expires_at = NULL,
            updated_at = now()
        WHERE delivery.id = $1
          AND delivery.workspace_id = $2
          AND delivery.smtp_lock_owner = $3
          AND delivery.status = 'sending'
          AND delivery.transmission_may_have_begun = false
        RETURNING delivery.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = CASE WHEN $4 THEN 'queued' ELSE 'failed' END,
            failed_at = CASE WHEN $4 THEN message.failed_at ELSE now() END,
            safe_display_error = $12,
            revision = revision + 1,
            updated_at = now()
        FROM updated_delivery delivery
        WHERE delivery.delivery_kind = 'real'
          AND message.id = delivery.message_id
          AND message.workspace_id = delivery.workspace_id
          AND message.status IN ('queued', 'sending')
        RETURNING message.id
      )
      SELECT * FROM updated_delivery
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.workerId,
      willRetry,
      input.failure.smtpPhase,
      input.failure.failureClass,
      input.failure.retryPolicy,
      boundedText(input.failure.sanitizedProviderCode, 100),
      boundedText(input.failure.sanitizedCommand, 100),
      input.failure.responseCode ?? null,
      input.failure.responseClass ?? null,
      boundedText(input.failure.safeDisplayError, 1000),
      boundedText(input.failure.redactedInternalError, 2000),
      input.failure.nextAttemptAt ?? null,
    ],
  );
  return res.rows[0] ?? null;
}

export async function recordOperationsEmailDeliveryUncertain(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  smtpPhase: OperationsEmailSmtpPhase;
  safeDisplayError: string;
  redactedInternalError?: string | null;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH updated_delivery AS (
        UPDATE operations_email_deliveries delivery
        SET status = 'delivery_uncertain',
            smtp_phase = $4,
            failure_class = 'uncertain',
            retry_policy = 'never',
            transmission_may_have_begun = true,
            safe_display_error = $5,
            redacted_internal_error = $6,
            uncertain_at = now(),
            smtp_lock_owner = NULL,
            smtp_locked_at = NULL,
            smtp_lock_expires_at = NULL,
            updated_at = now()
        WHERE delivery.id = $1
          AND delivery.workspace_id = $2
          AND delivery.smtp_lock_owner = $3
          AND delivery.status = 'sending'
        RETURNING delivery.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = 'delivery_uncertain',
            uncertain_at = now(),
            safe_display_error = $5,
            revision = revision + 1,
            updated_at = now()
        FROM updated_delivery delivery
        WHERE delivery.delivery_kind = 'real'
          AND message.id = delivery.message_id
          AND message.workspace_id = delivery.workspace_id
          AND message.status IN ('queued', 'sending')
        RETURNING message.id
      )
      SELECT * FROM updated_delivery
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.workerId,
      input.smtpPhase,
      boundedText(input.safeDisplayError, 1000),
      boundedText(input.redactedInternalError, 2000),
    ],
  );
  return res.rows[0] ?? null;
}

export async function recordOperationsEmailSmtpAcceptance(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  acceptedRecipients: string[];
  rejectedRecipients?: string[];
  providerResponseId?: string | null;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH updated_delivery AS (
        UPDATE operations_email_deliveries delivery
        SET status = 'sent',
            smtp_phase = 'accepted',
            failure_class = NULL,
            retry_policy = 'never',
            transmission_may_have_begun = true,
            accepted_recipients_json = $4::jsonb,
            rejected_recipients_json = $5::jsonb,
            smtp_accepted_at = now(),
            sent_at = now(),
            provider_response_id = $6,
            safe_display_error = NULL,
            redacted_internal_error = NULL,
            sent_copy_status = CASE
              WHEN delivery.delivery_kind = 'real' THEN 'pending'
              ELSE 'not_required'
            END,
            sent_copy_next_attempt_at = CASE
              WHEN delivery.delivery_kind = 'real' THEN now()
              ELSE NULL
            END,
            smtp_lock_owner = NULL,
            smtp_locked_at = NULL,
            smtp_lock_expires_at = NULL,
            updated_at = now()
        WHERE delivery.id = $1
          AND delivery.workspace_id = $2
          AND delivery.smtp_lock_owner = $3
          AND delivery.status = 'sending'
        RETURNING delivery.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET status = 'sent',
            sent_at = now(),
            safe_display_error = NULL,
            revision = revision + 1,
            updated_at = now()
        FROM updated_delivery delivery
        WHERE delivery.delivery_kind = 'real'
          AND message.id = delivery.message_id
          AND message.workspace_id = delivery.workspace_id
          AND message.status IN ('queued', 'sending')
        RETURNING message.id
      )
      SELECT * FROM updated_delivery
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.workerId,
      JSON.stringify(input.acceptedRecipients),
      JSON.stringify(input.rejectedRecipients ?? []),
      boundedText(input.providerResponseId, 300),
    ],
  );
  return res.rows[0] ?? null;
}

export async function claimPendingOperationsEmailSentCopy(input: {
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      WITH due AS (
        SELECT delivery.id
        FROM operations_email_deliveries delivery
        WHERE delivery.delivery_kind = 'real'
          AND delivery.status = 'sent'
          AND (
            (
              delivery.sent_copy_status IN ('pending', 'failed')
              AND COALESCE(delivery.sent_copy_next_attempt_at, now()) <= now()
            )
            OR (
              delivery.sent_copy_status = 'appending'
              AND delivery.sent_copy_lock_expires_at < now()
            )
          )
        ORDER BY delivery.sent_copy_next_attempt_at ASC NULLS FIRST,
                 delivery.smtp_accepted_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE operations_email_deliveries delivery
      SET sent_copy_status = 'appending',
          sent_copy_lock_owner = $1,
          sent_copy_locked_at = now(),
          sent_copy_lock_expires_at = now() + ($2 * interval '1 second'),
          sent_copy_last_attempt_at = now(),
          sent_copy_attempt_count = sent_copy_attempt_count + 1,
          updated_at = now()
      WHERE delivery.id = (SELECT id FROM due)
      RETURNING delivery.*
    `,
    [requiredText(input.workerId, "worker_id"), input.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function renewOperationsEmailSentCopyLease(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET sent_copy_lock_expires_at = now() + ($4 * interval '1 second'),
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND sent_copy_lock_owner = $3
        AND sent_copy_status = 'appending'
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.workerId, input.leaseSeconds],
  );
  return res.rows[0] ?? null;
}

export async function markOperationsEmailSentCopyAppended(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  mailbox: string;
  appendedUid: string | number;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET sent_copy_status = 'appended',
          resolved_sent_mailbox = $4,
          appended_uid = $5,
          sent_copy_appended_at = now(),
          sent_copy_safe_error = NULL,
          sent_copy_lock_owner = NULL,
          sent_copy_locked_at = NULL,
          sent_copy_lock_expires_at = NULL,
          sent_copy_next_attempt_at = NULL,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND sent_copy_lock_owner = $3
        AND sent_copy_status = 'appending'
        AND status = 'sent'
      RETURNING *
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.workerId,
      requiredText(input.mailbox, "sent_mailbox"),
      input.appendedUid,
    ],
  );
  return res.rows[0] ?? null;
}

export async function markOperationsEmailSentCopyFailed(input: {
  workspaceId: string;
  deliveryId: string;
  workerId: string;
  safeDisplayError: string;
  nextAttemptAt: Date;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET sent_copy_status = 'failed',
          sent_copy_safe_error = $4,
          sent_copy_next_attempt_at = $5,
          sent_copy_lock_owner = NULL,
          sent_copy_locked_at = NULL,
          sent_copy_lock_expires_at = NULL,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND sent_copy_lock_owner = $3
        AND sent_copy_status = 'appending'
        AND status = 'sent'
      RETURNING *
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.workerId,
      boundedText(input.safeDisplayError, 1000),
      input.nextAttemptAt,
    ],
  );
  return res.rows[0] ?? null;
}

export async function markOperationsEmailSentCopyPending(input: {
  workspaceId: string;
  deliveryId: string;
  nextAttemptAt: Date;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryRow>(
    `
      UPDATE operations_email_deliveries
      SET sent_copy_status = 'pending',
          sent_copy_next_attempt_at = $3,
          sent_copy_lock_owner = NULL,
          sent_copy_locked_at = NULL,
          sent_copy_lock_expires_at = NULL,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND status = 'sent'
        AND sent_copy_status IN ('pending', 'failed')
      RETURNING *
    `,
    [input.deliveryId, input.workspaceId, input.nextAttemptAt],
  );
  return res.rows[0] ?? null;
}

export async function createOperationsEmailDeliveryAttempt(input: {
  workspaceId: string;
  deliveryId: string;
  transportKind: "smtp" | "imap_append";
  requestKind: "automatic" | "actor_requested";
  initiatedByUserId?: string | null;
  workerId?: string | null;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryAttemptRow>(
    `
      WITH locked_delivery AS (
        SELECT id, workspace_id
        FROM operations_email_deliveries
        WHERE id = $1 AND workspace_id = $2
        FOR UPDATE
      )
      INSERT INTO operations_email_delivery_attempts (
        workspace_id,
        delivery_id,
        transport_kind,
        attempt_number,
        request_kind,
        initiated_by_user_id,
        worker_id
      )
      SELECT
        locked_delivery.workspace_id,
        locked_delivery.id,
        $3,
        COALESCE((
          SELECT MAX(attempt_number)
          FROM operations_email_delivery_attempts prior
          WHERE prior.delivery_id = locked_delivery.id
            AND prior.transport_kind = $3
        ), 0) + 1,
        $4,
        $5,
        $6
      FROM locked_delivery
      RETURNING *
    `,
    [
      input.deliveryId,
      input.workspaceId,
      input.transportKind,
      input.requestKind,
      input.initiatedByUserId ?? null,
      optionalText(input.workerId),
    ],
  );
  return res.rows[0] ?? null;
}

export async function completeOperationsEmailDeliveryAttempt(input: {
  workspaceId: string;
  attemptId: string;
  outcome: Exclude<OperationsEmailDeliveryAttemptRow["outcome"], "started">;
  smtpPhase?: OperationsEmailSmtpPhase | null;
  failureClass?: OperationsEmailFailureClass | null;
  retryPolicy?: OperationsEmailRetryPolicy | null;
  transmissionMayHaveBegun?: boolean;
  sanitizedProviderCode?: string | null;
  sanitizedCommand?: string | null;
  responseCode?: number | null;
  responseClass?: number | null;
  safeDisplayError?: string | null;
  redactedInternalDiagnostic?: string | null;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryAttemptRow>(
    `
      UPDATE operations_email_delivery_attempts
      SET completed_at = now(),
          outcome = $3,
          smtp_phase = $4,
          failure_class = $5,
          retry_policy = $6,
          transmission_may_have_begun = $7,
          sanitized_provider_code = $8,
          sanitized_command = $9,
          response_code = $10,
          response_class = $11,
          safe_display_error = $12,
          redacted_internal_diagnostic = $13
      WHERE id = $1
        AND workspace_id = $2
        AND outcome = 'started'
      RETURNING *
    `,
    [
      input.attemptId,
      input.workspaceId,
      input.outcome,
      input.smtpPhase ?? null,
      input.failureClass ?? null,
      input.retryPolicy ?? null,
      input.transmissionMayHaveBegun ?? false,
      boundedText(input.sanitizedProviderCode, 100),
      boundedText(input.sanitizedCommand, 100),
      input.responseCode ?? null,
      input.responseClass ?? null,
      boundedText(input.safeDisplayError, 1000),
      boundedText(input.redactedInternalDiagnostic, 2000),
    ],
  );
  return res.rows[0] ?? null;
}

export async function listOperationsEmailDeliveryAttempts(
  workspaceId: string,
  deliveryId: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailDeliveryAttemptRow>(
    `
      SELECT * FROM operations_email_delivery_attempts
      WHERE workspace_id = $1 AND delivery_id = $2
      ORDER BY transport_kind, attempt_number
    `,
    [workspaceId, deliveryId],
  );
  return res.rows;
}

export async function linkOperationsEmailSentCommunication(input: {
  workspaceId: string;
  messageId: string;
  sentCommunicationId: string;
}) {
  const client = await ensureConnected();
  const res = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages message
      SET sent_communication_id = communication.id,
          revision = revision + 1,
          updated_at = now()
      FROM operations_communications communication
      JOIN operations_businesses business
        ON business.id = communication.business_id
      WHERE message.id = $1
        AND message.workspace_id = $2
        AND message.status = 'sent'
        AND message.sent_communication_id IS NULL
        AND communication.id = $3
        AND communication.status = 'sent'
        AND communication.business_id = message.business_id
        AND business.internal_workspace_id = message.workspace_id
      RETURNING message.*
    `,
    [input.messageId, input.workspaceId, input.sentCommunicationId],
  );
  return res.rows[0] ?? null;
}

export type OperationsQuotePdfRenderRow = {
  id: string;
  operations_quote_id: string;
  quote_revision: number;
  filename: string;
  pdf_bytes: Buffer;
  content_type: "application/pdf";
  size_bytes: string;
  sha256: string;
  generated_at: Date;
  generated_by_user_id: string | null;
  generation_source: "system" | "actor";
  source_snapshot_sha256: string;
  source_updated_at: Date;
  source_snapshot_json: Record<string, unknown>;
};

export async function saveOperationsQuotePdfRender(input: {
  quoteId: string;
  quoteRevision: number;
  filename: string;
  pdfBytes: Buffer;
  sha256: string;
  generatedByUserId?: string | null;
  generationSource: "system" | "actor";
  sourceSnapshotSha256?: string;
  sourceUpdatedAt?: Date;
  sourceSnapshotJson?: Record<string, unknown>;
}) {
  const sha256 = input.sha256.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("pdf_sha256_invalid");
  if (input.pdfBytes.length === 0) throw new Error("pdf_bytes_required");
  const sourceSnapshotSha256 =
    input.sourceSnapshotSha256?.trim().toLowerCase() ?? sha256;
  if (!/^[0-9a-f]{64}$/.test(sourceSnapshotSha256)) {
    throw new Error("pdf_source_snapshot_sha256_invalid");
  }
  const client = await ensureConnected();
  const res = await client.query<OperationsQuotePdfRenderRow>(
    `
      WITH inserted AS (
        INSERT INTO operations_quote_pdf_renders (
          operations_quote_id,
          quote_revision,
          filename,
          pdf_bytes,
          size_bytes,
          sha256,
          generated_by_user_id,
          generation_source,
          source_snapshot_sha256,
          source_updated_at,
          source_snapshot_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        ON CONFLICT (operations_quote_id, quote_revision) DO NOTHING
        RETURNING *
      )
      SELECT * FROM inserted
      UNION ALL
      SELECT existing.*
      FROM operations_quote_pdf_renders existing
      WHERE existing.operations_quote_id = $1
        AND existing.quote_revision = $2
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1
    `,
    [
      input.quoteId,
      input.quoteRevision,
      requiredText(input.filename, "pdf_filename"),
      input.pdfBytes,
      input.pdfBytes.length,
      sha256,
      input.generatedByUserId ?? null,
      input.generationSource,
      sourceSnapshotSha256,
      input.sourceUpdatedAt ?? new Date(),
      JSON.stringify(input.sourceSnapshotJson ?? {}),
    ],
  );
  return res.rows[0];
}

export async function getOperationsEmailQuotePdfRender(
  quoteId: string,
  sourceSnapshotSha256: string,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuotePdfRenderRow>(
    `
      SELECT *
      FROM operations_quote_pdf_renders
      WHERE operations_quote_id = $1
        AND source_snapshot_sha256 = $2
      ORDER BY generated_at DESC, id DESC
      LIMIT 1
    `,
    [quoteId, sourceSnapshotSha256],
  );
  return res.rows[0] ?? null;
}

export async function saveOperationsQuotePdfRenderAtNextRevision(
  input: Omit<
    Parameters<typeof saveOperationsQuotePdfRender>[0],
    "quoteRevision"
  >,
) {
  const sha256 = input.sha256.trim().toLowerCase();
  const sourceSnapshotSha256 = input.sourceSnapshotSha256?.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("pdf_sha256_invalid");
  if (!sourceSnapshotSha256 || !/^[0-9a-f]{64}$/.test(sourceSnapshotSha256)) {
    throw new Error("pdf_source_snapshot_sha256_invalid");
  }
  if (input.pdfBytes.length === 0) throw new Error("pdf_bytes_required");
  const client = await ensureConnected();
  const res = await client.query<OperationsQuotePdfRenderRow>(
    `
      WITH lock AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))
      ), existing AS MATERIALIZED (
        SELECT render.*
        FROM operations_quote_pdf_renders render, lock
        WHERE render.operations_quote_id = $1::uuid
          AND render.source_snapshot_sha256 = $8
        LIMIT 1
      ), inserted AS (
        INSERT INTO operations_quote_pdf_renders (
          operations_quote_id, quote_revision, filename, pdf_bytes,
          size_bytes, sha256, generated_by_user_id, generation_source,
          source_snapshot_sha256, source_updated_at, source_snapshot_json
        )
        SELECT $1::uuid,
               COALESCE((SELECT max(quote_revision) + 1 FROM operations_quote_pdf_renders WHERE operations_quote_id = $1::uuid), 1),
               $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb
        FROM lock
        WHERE NOT EXISTS (SELECT 1 FROM existing)
        RETURNING *
      )
      SELECT * FROM inserted
      UNION ALL
      SELECT * FROM existing
      LIMIT 1
    `,
    [
      input.quoteId,
      requiredText(input.filename, "pdf_filename"),
      input.pdfBytes,
      input.pdfBytes.length,
      sha256,
      input.generatedByUserId ?? null,
      input.generationSource,
      sourceSnapshotSha256,
      input.sourceUpdatedAt ?? new Date(),
      JSON.stringify(input.sourceSnapshotJson ?? {}),
    ],
  );
  return res.rows[0];
}

export async function getOperationsQuotePdfRender(
  quoteId: string,
  quoteRevision: number,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsQuotePdfRenderRow>(
    `
      SELECT * FROM operations_quote_pdf_renders
      WHERE operations_quote_id = $1 AND quote_revision = $2
    `,
    [quoteId, quoteRevision],
  );
  return res.rows[0] ?? null;
}
