import { ensureConnected } from "./client";
import type { OperationsEmailMessageRow } from "./operationsEmail";

export type OperationsEmailCrmFinalisationStatus =
  | "not_required"
  | "pending"
  | "finalising"
  | "finalised"
  | "failed";

export type OperationsEmailCrmFinalisationRow = {
  id: string;
  workspace_id: string;
  message_id: string;
  delivery_id: string;
  status: OperationsEmailCrmFinalisationStatus;
  business_id: string | null;
  contact_id: string | null;
  sent_communication_id: string | null;
  linked_after_send_by_user_id: string | null;
  linked_after_send_at: Date | null;
  attempt_count: number;
  last_attempt_at: Date | null;
  next_attempt_at: Date | null;
  safe_error: string | null;
  lock_owner: string | null;
  locked_at: Date | null;
  lock_expires_at: Date | null;
  finalised_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsEmailImapReadinessRow = {
  workspace_id: string;
  status: "unavailable" | "configured" | "available";
  checked_at: Date;
  available_at: Date | null;
  safe_error_code: string | null;
  worker_id: string | null;
  updated_at: Date;
};

function requiredText(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field}_required`);
  return trimmed;
}

function boundedText(value: string | null | undefined, length: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, length) : null;
}

export async function claimDueOperationsEmailCrmFinalisation(input: {
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailCrmFinalisationRow>(
    `
      WITH due AS (
        SELECT finalisation.id
        FROM operations_email_crm_finalisations finalisation
        JOIN operations_email_deliveries delivery
          ON delivery.id = finalisation.delivery_id
         AND delivery.workspace_id = finalisation.workspace_id
        JOIN operations_email_messages message
          ON message.id = finalisation.message_id
         AND message.workspace_id = finalisation.workspace_id
        WHERE delivery.delivery_kind = 'real'
          AND delivery.status = 'sent'
          AND delivery.smtp_accepted_at IS NOT NULL
          AND message.status = 'sent'
          AND finalisation.business_id IS NOT NULL
          AND finalisation.sent_communication_id IS NULL
          AND (
            (
              finalisation.status IN ('pending', 'failed')
              AND finalisation.next_attempt_at IS NOT NULL
              AND finalisation.next_attempt_at <= now()
            )
            OR (
              finalisation.status = 'finalising'
              AND finalisation.lock_expires_at < now()
            )
          )
        ORDER BY finalisation.next_attempt_at ASC NULLS FIRST,
                 delivery.smtp_accepted_at ASC
        FOR UPDATE OF finalisation SKIP LOCKED
        LIMIT 1
      )
      UPDATE operations_email_crm_finalisations finalisation
      SET status = 'finalising',
          lock_owner = $1,
          locked_at = now(),
          lock_expires_at = now() + ($2 * interval '1 second'),
          last_attempt_at = now(),
          attempt_count = attempt_count + 1,
          safe_error = NULL,
          updated_at = now()
      WHERE finalisation.id = (SELECT id FROM due)
      RETURNING finalisation.*
    `,
    [requiredText(input.workerId, "worker_id"), input.leaseSeconds],
  );
  return result.rows[0] ?? null;
}

export async function claimOperationsEmailCrmFinalisationForMessage(input: {
  workspaceId: string;
  messageId: string;
  workerId: string;
  leaseSeconds: number;
}) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailCrmFinalisationRow>(
    `
      UPDATE operations_email_crm_finalisations finalisation
      SET status = 'finalising',
          lock_owner = $3,
          locked_at = now(),
          lock_expires_at = now() + ($4 * interval '1 second'),
          last_attempt_at = now(),
          attempt_count = attempt_count + 1,
          safe_error = NULL,
          updated_at = now()
      FROM operations_email_deliveries delivery
      WHERE finalisation.workspace_id = $1
        AND finalisation.message_id = $2
        AND finalisation.delivery_id = delivery.id
        AND delivery.workspace_id = finalisation.workspace_id
        AND delivery.delivery_kind = 'real'
        AND delivery.status = 'sent'
        AND delivery.smtp_accepted_at IS NOT NULL
        AND finalisation.business_id IS NOT NULL
        AND finalisation.sent_communication_id IS NULL
        AND finalisation.status IN ('not_required', 'pending', 'failed')
      RETURNING finalisation.*
    `,
    [
      input.workspaceId,
      input.messageId,
      requiredText(input.workerId, "worker_id"),
      input.leaseSeconds,
    ],
  );
  return result.rows[0] ?? null;
}

export async function finaliseClaimedOperationsEmailCrm(input: {
  workspaceId: string;
  finalisationId: string;
  workerId: string;
}) {
  const client = await ensureConnected();
  type FinalisationResult = OperationsEmailCrmFinalisationRow & {
    communication_created: boolean;
    business_last_contacted_at: Date;
  };
  const result = await client.query<FinalisationResult>(
    `
      WITH eligible AS MATERIALIZED (
        SELECT
          finalisation.*,
          message.source_communication_id,
          message.report_id,
          message.quote_id,
          message.from_name,
          message.from_address,
          message.reply_to_address,
          message.recipient_name,
          message.preheader,
          message.final_render_html,
          message.final_render_plain_text,
          message.source_snapshot_json,
          message.render_metadata_json,
          message.sent_communication_id AS message_sent_communication_id,
          delivery.initiated_by_user_id,
          delivery.envelope_recipient,
          delivery.fixed_message_id,
          delivery.frozen_metadata_json,
          delivery.smtp_accepted_at
        FROM operations_email_crm_finalisations finalisation
        JOIN operations_email_messages message
          ON message.id = finalisation.message_id
         AND message.workspace_id = finalisation.workspace_id
        JOIN operations_email_deliveries delivery
          ON delivery.id = finalisation.delivery_id
         AND delivery.workspace_id = finalisation.workspace_id
        JOIN operations_businesses business
          ON business.id = finalisation.business_id
         AND business.internal_workspace_id = finalisation.workspace_id
        LEFT JOIN operations_contacts contact
          ON contact.id = finalisation.contact_id
         AND contact.business_id = finalisation.business_id
        WHERE finalisation.id = $1
          AND finalisation.workspace_id = $2
          AND finalisation.status = 'finalising'
          AND finalisation.lock_owner = $3
          AND finalisation.sent_communication_id IS NULL
          AND delivery.delivery_kind = 'real'
          AND delivery.status = 'sent'
          AND delivery.smtp_accepted_at IS NOT NULL
          AND message.status = 'sent'
          AND message.final_render_html IS NOT NULL
          AND message.final_render_plain_text IS NOT NULL
          AND (finalisation.contact_id IS NULL OR contact.id IS NOT NULL)
      ), inserted_communication AS (
        INSERT INTO operations_communications (
          business_id,
          contact_id,
          direction,
          channel,
          status,
          subject,
          body,
          preheader,
          html_document,
          plain_text_body,
          layout_key,
          signature_mode,
          sender_identity_key,
          sender_name,
          sender_email,
          recipient_name,
          recipient_email,
          template_snapshot_json,
          attachment_requirements_json,
          attachment_confirmed_at,
          sent_at,
          occurred_at,
          external_message_id,
          created_by_user_id
        )
        SELECT
          eligible.business_id,
          eligible.contact_id,
          'outbound',
          'email',
          'sent',
          COALESCE(eligible.frozen_metadata_json->>'subject', '(No subject)'),
          eligible.final_render_plain_text,
          eligible.preheader,
          eligible.final_render_html,
          eligible.final_render_plain_text,
          CASE
            WHEN eligible.source_snapshot_json->>'layoutKey' IN (
              'personal_letter', 'report_delivery', 'commercial_document', 'status_alert'
            ) THEN eligible.source_snapshot_json->>'layoutKey'
            ELSE NULL
          END,
          'include_scanlark_signature',
          'operations_email_fixed_sender',
          eligible.from_name,
          eligible.from_address,
          eligible.recipient_name,
          eligible.envelope_recipient,
          jsonb_build_object(
            'operationsEmail', jsonb_build_object(
              'messageId', eligible.message_id,
              'deliveryId', eligible.delivery_id,
              'sourceCommunicationId', eligible.source_communication_id,
              'reportId', eligible.report_id,
              'quoteId', eligible.quote_id,
              'fixedMessageId', eligible.fixed_message_id,
              'replyTo', eligible.reply_to_address,
              'frozenMetadata', eligible.frozen_metadata_json,
              'renderMetadata', eligible.render_metadata_json
            )
          ),
          CASE
            WHEN jsonb_typeof(eligible.source_snapshot_json->'attachmentRequirements') = 'array'
            THEN eligible.source_snapshot_json->'attachmentRequirements'
            ELSE '[]'::jsonb
          END,
          CASE
            WHEN COALESCE(
              CASE
                WHEN eligible.frozen_metadata_json->>'attachmentCount' ~ '^[0-9]+$'
                THEN (eligible.frozen_metadata_json->>'attachmentCount')::integer
              END,
              0
            ) > 0
            THEN eligible.smtp_accepted_at
            ELSE NULL
          END,
          eligible.smtp_accepted_at,
          eligible.smtp_accepted_at,
          eligible.fixed_message_id,
          eligible.initiated_by_user_id
        FROM eligible
        WHERE eligible.message_sent_communication_id IS NULL
        RETURNING id
      ), communication_choice AS (
        SELECT id, true AS created FROM inserted_communication
        UNION ALL
        SELECT eligible.message_sent_communication_id, false
        FROM eligible
        WHERE eligible.message_sent_communication_id IS NOT NULL
        LIMIT 1
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET sent_communication_id = choice.id,
            revision = CASE
              WHEN message.sent_communication_id IS NULL THEN revision + 1
              ELSE revision
            END,
            updated_at = now()
        FROM eligible, communication_choice choice
        WHERE message.id = eligible.message_id
          AND message.workspace_id = eligible.workspace_id
          AND (
            message.sent_communication_id IS NULL
            OR message.sent_communication_id = choice.id
          )
        RETURNING message.id
      ), updated_business AS (
        UPDATE operations_businesses business
        SET last_contacted_at = CASE
              WHEN business.last_contacted_at IS NULL
                OR business.last_contacted_at < eligible.smtp_accepted_at
              THEN eligible.smtp_accepted_at
              ELSE business.last_contacted_at
            END,
            updated_at = CASE
              WHEN business.last_contacted_at IS NULL
                OR business.last_contacted_at < eligible.smtp_accepted_at
              THEN now()
              ELSE business.updated_at
            END
        FROM eligible, updated_message
        WHERE business.id = eligible.business_id
        RETURNING business.last_contacted_at
      )
      UPDATE operations_email_crm_finalisations finalisation
      SET status = 'finalised',
          sent_communication_id = choice.id,
          finalised_at = COALESCE(finalisation.finalised_at, now()),
          next_attempt_at = NULL,
          safe_error = NULL,
          lock_owner = NULL,
          locked_at = NULL,
          lock_expires_at = NULL,
          updated_at = now()
      FROM communication_choice choice, updated_business business
      WHERE finalisation.id = $1
        AND finalisation.workspace_id = $2
      RETURNING finalisation.*, choice.created AS communication_created,
                business.last_contacted_at AS business_last_contacted_at
    `,
    [input.finalisationId, input.workspaceId, input.workerId],
  );
  if (result.rows[0]) return result.rows[0];
  const existing = await client.query<FinalisationResult>(
    `
      SELECT finalisation.*, false AS communication_created,
             business.last_contacted_at AS business_last_contacted_at
      FROM operations_email_crm_finalisations finalisation
      JOIN operations_businesses business ON business.id = finalisation.business_id
      WHERE finalisation.id = $1
        AND finalisation.workspace_id = $2
        AND finalisation.status = 'finalised'
        AND finalisation.sent_communication_id IS NOT NULL
    `,
    [input.finalisationId, input.workspaceId],
  );
  return existing.rows[0] ?? null;
}

export async function markOperationsEmailCrmFinalisationFailed(input: {
  workspaceId: string;
  finalisationId: string;
  workerId: string;
  safeError: string;
  nextAttemptAt: Date | null;
}) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailCrmFinalisationRow>(
    `
      UPDATE operations_email_crm_finalisations
      SET status = 'failed',
          safe_error = $4,
          next_attempt_at = $5,
          lock_owner = NULL,
          locked_at = NULL,
          lock_expires_at = NULL,
          updated_at = now()
      WHERE id = $1
        AND workspace_id = $2
        AND lock_owner = $3
        AND status = 'finalising'
      RETURNING *
    `,
    [
      input.finalisationId,
      input.workspaceId,
      input.workerId,
      boundedText(input.safeError, 1000),
      input.nextAttemptAt,
    ],
  );
  return result.rows[0] ?? null;
}

export async function requestOperationsEmailPostSendLink(input: {
  workspaceId: string;
  messageId: string;
  businessId: string;
  contactId?: string | null;
  expectedRevision: number;
  actorUserId: string;
}) {
  const client = await ensureConnected();
  const result = await client.query<
    OperationsEmailMessageRow & {
      contact_email: string | null;
      recipient_contact_mismatch: boolean;
    }
  >(
    `
      WITH eligible AS MATERIALIZED (
        SELECT message.id, delivery.id AS delivery_id, contact.email AS contact_email
        FROM operations_email_messages message
        JOIN operations_email_deliveries delivery
          ON delivery.message_id = message.id
         AND delivery.workspace_id = message.workspace_id
        JOIN operations_businesses business
          ON business.id = $3
         AND business.internal_workspace_id = message.workspace_id
        LEFT JOIN operations_contacts contact
          ON contact.id = $4
         AND contact.business_id = business.id
        WHERE message.id = $1
          AND message.workspace_id = $2
          AND message.revision = $5
          AND message.status = 'sent'
          AND message.sent_communication_id IS NULL
          AND message.business_id IS NULL
          AND message.contact_id IS NULL
          AND delivery.delivery_kind = 'real'
          AND delivery.status = 'sent'
          AND delivery.smtp_accepted_at IS NOT NULL
          AND ($4::uuid IS NULL OR contact.id IS NOT NULL)
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET business_id = $3,
            contact_id = $4,
            revision = revision + 1,
            updated_at = now()
        FROM eligible
        WHERE message.id = eligible.id
        RETURNING message.*
      ), updated_finalisation AS (
        UPDATE operations_email_crm_finalisations finalisation
        SET status = 'pending',
            business_id = $3,
            contact_id = $4,
            linked_after_send_by_user_id = $6,
            linked_after_send_at = COALESCE(linked_after_send_at, now()),
            next_attempt_at = now(),
            safe_error = NULL,
            updated_at = now()
        FROM eligible
        WHERE finalisation.message_id = eligible.id
          AND finalisation.delivery_id = eligible.delivery_id
          AND finalisation.sent_communication_id IS NULL
          AND finalisation.status IN ('not_required', 'pending', 'failed')
        RETURNING finalisation.id
      )
      SELECT updated_message.*,
             eligible.contact_email,
             (
               eligible.contact_email IS NOT NULL
               AND lower(eligible.contact_email) <> lower(updated_message.recipient_address)
             ) AS recipient_contact_mismatch
      FROM updated_message
      JOIN eligible ON eligible.id = updated_message.id
      JOIN updated_finalisation ON true
    `,
    [
      input.messageId,
      input.workspaceId,
      input.businessId,
      input.contactId ?? null,
      input.expectedRevision,
      input.actorUserId,
    ],
  );
  if (result.rows[0]) return result.rows[0];
  const existing = await client.query<
    OperationsEmailMessageRow & {
      contact_email: string | null;
      recipient_contact_mismatch: boolean;
    }
  >(
    `
      SELECT message.*, contact.email AS contact_email,
             (
               contact.email IS NOT NULL
               AND lower(contact.email) <> lower(message.recipient_address)
             ) AS recipient_contact_mismatch
      FROM operations_email_messages message
      LEFT JOIN operations_contacts contact
        ON contact.id = message.contact_id
       AND contact.business_id = message.business_id
      WHERE message.id = $1
        AND message.workspace_id = $2
        AND message.status = 'sent'
        AND message.business_id = $3
        AND message.contact_id IS NOT DISTINCT FROM $4::uuid
        AND message.sent_communication_id IS NOT NULL
    `,
    [
      input.messageId,
      input.workspaceId,
      input.businessId,
      input.contactId ?? null,
    ],
  );
  return existing.rows[0] ?? null;
}

export async function listOperationsEmailClientLinkOptions(
  workspaceId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<{
    business_id: string;
    business_name: string;
    contact_id: string | null;
    contact_name: string | null;
    contact_email: string | null;
  }>(
    `
      SELECT business.id AS business_id,
             business.name AS business_name,
             contact.id AS contact_id,
             NULLIF(trim(concat_ws(' ', contact.first_name, contact.last_name)), '') AS contact_name,
             contact.email AS contact_email
      FROM operations_businesses business
      LEFT JOIN operations_contacts contact ON contact.business_id = business.id
      WHERE business.internal_workspace_id = $1
      ORDER BY business.name, contact.first_name, contact.last_name, contact.id
      LIMIT 1000
    `,
    [workspaceId],
  );
  return result.rows;
}

export async function getOperationsEmailImapReadiness(workspaceId: string) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailImapReadinessRow>(
    `SELECT * FROM operations_email_imap_readiness WHERE workspace_id = $1`,
    [workspaceId],
  );
  return result.rows[0] ?? null;
}

export async function setOperationsEmailImapReadiness(input: {
  workspaceId: string;
  status: OperationsEmailImapReadinessRow["status"];
  workerId: string;
  safeErrorCode?: string | null;
}) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailImapReadinessRow>(
    `
      INSERT INTO operations_email_imap_readiness (
        workspace_id, status, available_at, safe_error_code, worker_id
      )
      VALUES (
        $1, $2,
        CASE WHEN $2 = 'available' THEN now() ELSE NULL END,
        $3, $4
      )
      ON CONFLICT (workspace_id) DO UPDATE
      SET status = EXCLUDED.status,
          checked_at = now(),
          available_at = CASE
            WHEN EXCLUDED.status = 'available' THEN now()
            ELSE operations_email_imap_readiness.available_at
          END,
          safe_error_code = EXCLUDED.safe_error_code,
          worker_id = EXCLUDED.worker_id,
          updated_at = now()
      RETURNING *
    `,
    [
      input.workspaceId,
      input.status,
      boundedText(input.safeErrorCode, 100),
      boundedText(input.workerId, 300),
    ],
  );
  return result.rows[0];
}
