import { ensureConnected } from "./client";
import type {
  OperationsEmailAttachmentRow,
  OperationsEmailAttachmentSourceType,
  OperationsEmailMessageRow,
  OperationsEmailMessageStatus,
} from "./operationsEmail";

export type OperationsEmailAttachmentSafeRow = Omit<
  OperationsEmailAttachmentRow,
  "content_bytes"
>;

export type OperationsEmailAttachmentOption = {
  sourceType: "report_pdf" | "quote_pdf";
  renderId: string;
  documentId: string;
  documentTitle: string;
  documentReference: string;
  sourceVersion: string;
  filename: string;
  contentType: "application/pdf";
  sizeBytes: number;
  sha256: string;
  generatedAt: Date;
};

export type OperationsEmailAttachmentMutationResult =
  | {
      outcome: "updated";
      attachment: OperationsEmailAttachmentSafeRow;
      messageRevision: number;
      messageStatus: OperationsEmailMessageStatus;
      readyInvalidated: boolean;
    }
  | {
      outcome:
        | "not_found"
        | "stale_revision"
        | "invalid_state"
        | "source_not_found"
        | "total_size_exceeded"
        | "duplicate_filename";
      message: OperationsEmailMessageRow | null;
    };

const ATTACHMENT_SAFE_COLUMNS = `
  attachment.id,
  attachment.message_id,
  attachment.workspace_id,
  attachment.source_type,
  attachment.source_report_id,
  attachment.source_quote_id,
  attachment.source_report_render_id,
  attachment.source_quote_render_id,
  attachment.source_version,
  attachment.source_generated_at,
  attachment.display_filename,
  attachment.storage_filename,
  attachment.declared_mime_type,
  attachment.verified_mime_type,
  attachment.size_bytes,
  attachment.sha256,
  attachment.storage_key,
  attachment.storage_reference_json,
  attachment.created_by_user_id,
  attachment.created_at,
  attachment.removed_by_user_id,
  attachment.removed_at
`;

export async function listOperationsEmailAttachmentOptions(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<{
    source_type: "report_pdf" | "quote_pdf";
    render_id: string;
    document_id: string;
    document_title: string;
    document_reference: string;
    source_version: string;
    filename: string;
    content_type: "application/pdf";
    size_bytes: string;
    sha256: string;
    generated_at: Date;
  }>(
    `
      WITH scoped_message AS (
        SELECT business_id
        FROM operations_email_messages
        WHERE id = $2 AND workspace_id = $1
      )
      SELECT
        'report_pdf'::text AS source_type,
        render.id AS render_id,
        report.id AS document_id,
        report.title AS document_title,
        concat('Report v', report.version_number) AS document_reference,
        render.source_version,
        render.filename,
        render.content_type,
        render.size_bytes,
        render.sha256,
        render.generated_at
      FROM scoped_message
      JOIN operations_reports report ON report.business_id = scoped_message.business_id
      JOIN operations_report_pdf_renders render
        ON render.operations_report_id = report.id
      UNION ALL
      SELECT
        'quote_pdf'::text AS source_type,
        render.id AS render_id,
        quote.id AS document_id,
        quote.title AS document_title,
        concat(quote.quote_number, ' · render ', render.quote_revision) AS document_reference,
        concat('quote-render-', render.quote_revision) AS source_version,
        render.filename,
        render.content_type,
        render.size_bytes,
        render.sha256,
        render.generated_at
      FROM scoped_message
      JOIN operations_quotes quote ON quote.business_id = scoped_message.business_id
      JOIN operations_quote_pdf_renders render
        ON render.operations_quote_id = quote.id
      ORDER BY generated_at DESC, render_id DESC
    `,
    [workspaceId, messageId],
  );
  return result.rows.map(
    (row): OperationsEmailAttachmentOption => ({
      sourceType: row.source_type,
      renderId: row.render_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      documentReference: row.document_reference,
      sourceVersion: row.source_version,
      filename: row.filename,
      contentType: row.content_type,
      sizeBytes: Number(row.size_bytes),
      sha256: row.sha256,
      generatedAt: row.generated_at,
    }),
  );
}

export async function listOperationsEmailAttachmentsSafe(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailAttachmentSafeRow>(
    `
      SELECT ${ATTACHMENT_SAFE_COLUMNS}
      FROM operations_email_attachments attachment
      WHERE attachment.workspace_id = $1
        AND attachment.message_id = $2
        AND attachment.removed_at IS NULL
      ORDER BY attachment.created_at ASC, attachment.id ASC
    `,
    [workspaceId, messageId],
  );
  return result.rows;
}

async function classifyAttachmentMutation(
  workspaceId: string,
  messageId: string,
  expectedRevision: number,
): Promise<OperationsEmailAttachmentMutationResult> {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailMessageRow>(
    `SELECT * FROM operations_email_messages WHERE id = $1 AND workspace_id = $2`,
    [messageId, workspaceId],
  );
  const message = result.rows[0] ?? null;
  if (!message) return { outcome: "not_found", message };
  if (
    !(["draft", "ready"] as OperationsEmailMessageStatus[]).includes(
      message.status,
    )
  ) {
    return { outcome: "invalid_state", message };
  }
  if (message.revision !== expectedRevision) {
    return { outcome: "stale_revision", message };
  }
  return { outcome: "source_not_found", message };
}

export async function addOperationsEmailGeneratedAttachment(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  sourceType: "report_pdf" | "quote_pdf";
  renderId: string;
  maxTotalBytes: number;
}): Promise<OperationsEmailAttachmentMutationResult> {
  const client = await ensureConnected();
  try {
    const result = await client.query<
      OperationsEmailAttachmentSafeRow & {
        message_revision: number;
        message_status: OperationsEmailMessageStatus;
        ready_invalidated: boolean;
      }
    >(
      `
        WITH locked_message AS MATERIALIZED (
          SELECT *
          FROM operations_email_messages
          WHERE id = $1
            AND workspace_id = $2
            AND revision = $3
            AND status IN ('draft', 'ready')
          FOR UPDATE
        ), selected_source AS MATERIALIZED (
          SELECT
            'report_pdf'::text AS source_type,
            report.id AS source_report_id,
            NULL::uuid AS source_quote_id,
            render.id AS source_report_render_id,
            NULL::uuid AS source_quote_render_id,
            render.source_version,
            render.generated_at AS source_generated_at,
            render.filename,
            render.content_type,
            render.size_bytes,
            render.sha256,
            jsonb_build_object(
              'renderId', render.id,
              'sourceSnapshotSha256', render.source_snapshot_sha256
            ) AS storage_reference_json
          FROM locked_message message
          JOIN operations_reports report ON report.business_id = message.business_id
          JOIN operations_report_pdf_renders render
            ON render.operations_report_id = report.id
          WHERE $5 = 'report_pdf' AND render.id = $6
          UNION ALL
          SELECT
            'quote_pdf'::text,
            NULL::uuid,
            quote.id,
            NULL::uuid,
            render.id,
            concat('quote-render-', render.quote_revision),
            render.generated_at,
            render.filename,
            render.content_type,
            render.size_bytes,
            render.sha256,
            jsonb_build_object(
              'renderId', render.id,
              'sourceSnapshotSha256', render.source_snapshot_sha256,
              'quoteRevision', render.quote_revision
            )
          FROM locked_message message
          JOIN operations_quotes quote ON quote.business_id = message.business_id
          JOIN operations_quote_pdf_renders render
            ON render.operations_quote_id = quote.id
          WHERE $5 = 'quote_pdf' AND render.id = $6
        ), active_total AS (
          SELECT COALESCE(sum(size_bytes), 0)::bigint AS bytes
          FROM operations_email_attachments
          WHERE message_id = $1 AND workspace_id = $2 AND removed_at IS NULL
        ), inserted AS (
          INSERT INTO operations_email_attachments (
            message_id, workspace_id, source_type,
            source_report_id, source_quote_id,
            source_report_render_id, source_quote_render_id,
            source_version, source_generated_at,
            display_filename, storage_filename,
            declared_mime_type, verified_mime_type,
            size_bytes, sha256, storage_reference_json,
            created_by_user_id
          )
          SELECT
            message.id, message.workspace_id, source.source_type,
            source.source_report_id, source.source_quote_id,
            source.source_report_render_id, source.source_quote_render_id,
            source.source_version, source.source_generated_at,
            source.filename, concat('generated-', coalesce(source.source_report_render_id, source.source_quote_render_id)),
            source.content_type, source.content_type,
            source.size_bytes, source.sha256, source.storage_reference_json,
            $4
          FROM locked_message message
          CROSS JOIN selected_source source
          CROSS JOIN active_total total
          WHERE total.bytes + source.size_bytes <= $7
          RETURNING *
        ), updated_message AS (
          UPDATE operations_email_messages message
          SET revision = message.revision + 1,
              status = 'draft',
              ready_at = NULL,
              final_render_revision = NULL,
              final_render_attachment_set_sha256 = NULL,
              final_render_html = NULL,
              final_render_plain_text = NULL,
              final_render_html_sha256 = NULL,
              final_render_plain_text_sha256 = NULL,
              final_render_generated_at = NULL,
              final_renderer_version = NULL,
              last_edited_by_user_id = $4,
              updated_at = now()
          FROM inserted, locked_message original
          WHERE message.id = original.id
          RETURNING message.revision, message.status, original.status = 'ready' AS ready_invalidated
        )
        SELECT ${ATTACHMENT_SAFE_COLUMNS},
               updated_message.revision AS message_revision,
               updated_message.status AS message_status,
               updated_message.ready_invalidated
        FROM inserted attachment
        CROSS JOIN updated_message
      `,
      [
        input.messageId,
        input.workspaceId,
        input.expectedRevision,
        input.actorUserId,
        input.sourceType,
        input.renderId,
        input.maxTotalBytes,
      ],
    );
    const row = result.rows[0];
    if (row) {
      const {
        message_revision: messageRevision,
        message_status: messageStatus,
        ready_invalidated: readyInvalidated,
        ...attachment
      } = row;
      return {
        outcome: "updated",
        attachment,
        messageRevision,
        messageStatus,
        readyInvalidated,
      };
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        outcome: "duplicate_filename",
        message: await getMessage(input.workspaceId, input.messageId),
      };
    }
    throw error;
  }
  const classified = await classifyAttachmentMutation(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
  );
  if (classified.outcome !== "source_not_found") return classified;
  const option = await listOperationsEmailAttachmentOptions(
    input.workspaceId,
    input.messageId,
  );
  const source = option.find(
    (item) =>
      item.sourceType === input.sourceType && item.renderId === input.renderId,
  );
  if (!source) return classified;
  const attachments = await listOperationsEmailAttachmentsSafe(
    input.workspaceId,
    input.messageId,
  );
  if (
    attachments.reduce(
      (sum, attachment) => sum + Number(attachment.size_bytes),
      0,
    ) +
      source.sizeBytes >
    input.maxTotalBytes
  ) {
    return { outcome: "total_size_exceeded", message: classified.message };
  }
  return classified;
}

async function getMessage(workspaceId: string, messageId: string) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailMessageRow>(
    `SELECT * FROM operations_email_messages WHERE id = $1 AND workspace_id = $2`,
    [messageId, workspaceId],
  );
  return result.rows[0] ?? null;
}

export async function addOperationsEmailManualAttachment(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  displayFilename: string;
  verifiedMimeType: string;
  contentBytes: Buffer;
  sha256: string;
  maxTotalBytes: number;
}): Promise<OperationsEmailAttachmentMutationResult> {
  const client = await ensureConnected();
  try {
    const result = await client.query<
      OperationsEmailAttachmentSafeRow & {
        message_revision: number;
        message_status: OperationsEmailMessageStatus;
        ready_invalidated: boolean;
      }
    >(
      `
        WITH locked_message AS MATERIALIZED (
          SELECT *
          FROM operations_email_messages
          WHERE id = $1
            AND workspace_id = $2
            AND revision = $3
            AND status IN ('draft', 'ready')
          FOR UPDATE
        ), active_total AS (
          SELECT COALESCE(sum(size_bytes), 0)::bigint AS bytes
          FROM operations_email_attachments
          WHERE message_id = $1 AND workspace_id = $2 AND removed_at IS NULL
        ), inserted AS (
          INSERT INTO operations_email_attachments (
            message_id, workspace_id, source_type,
            display_filename, storage_filename,
            declared_mime_type, verified_mime_type,
            size_bytes, sha256, storage_reference_json,
            content_bytes, created_by_user_id
          )
          SELECT
            message.id, message.workspace_id, 'manual',
            $5, concat('manual-', gen_random_uuid()),
            $6, $6, $7, $8,
            jsonb_build_object('storage', 'database'),
            $9, $4
          FROM locked_message message
          CROSS JOIN active_total total
          WHERE total.bytes + $7 <= $10
          RETURNING *
        ), updated_message AS (
          UPDATE operations_email_messages message
          SET revision = message.revision + 1,
              status = 'draft',
              ready_at = NULL,
              final_render_revision = NULL,
              final_render_attachment_set_sha256 = NULL,
              final_render_html = NULL,
              final_render_plain_text = NULL,
              final_render_html_sha256 = NULL,
              final_render_plain_text_sha256 = NULL,
              final_render_generated_at = NULL,
              final_renderer_version = NULL,
              last_edited_by_user_id = $4,
              updated_at = now()
          FROM inserted, locked_message original
          WHERE message.id = original.id
          RETURNING message.revision, message.status, original.status = 'ready' AS ready_invalidated
        )
        SELECT ${ATTACHMENT_SAFE_COLUMNS},
               updated_message.revision AS message_revision,
               updated_message.status AS message_status,
               updated_message.ready_invalidated
        FROM inserted attachment
        CROSS JOIN updated_message
      `,
      [
        input.messageId,
        input.workspaceId,
        input.expectedRevision,
        input.actorUserId,
        input.displayFilename,
        input.verifiedMimeType,
        input.contentBytes.length,
        input.sha256,
        input.contentBytes,
        input.maxTotalBytes,
      ],
    );
    const row = result.rows[0];
    if (row) {
      const {
        message_revision: messageRevision,
        message_status: messageStatus,
        ready_invalidated: readyInvalidated,
        ...attachment
      } = row;
      return {
        outcome: "updated",
        attachment,
        messageRevision,
        messageStatus,
        readyInvalidated,
      };
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        outcome: "duplicate_filename",
        message: await getMessage(input.workspaceId, input.messageId),
      };
    }
    throw error;
  }
  const classified = await classifyAttachmentMutation(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
  );
  if (classified.outcome !== "source_not_found") return classified;
  return { outcome: "total_size_exceeded", message: classified.message };
}

export async function removeOperationsEmailAttachment(input: {
  workspaceId: string;
  messageId: string;
  attachmentId: string;
  expectedRevision: number;
  actorUserId: string;
}): Promise<OperationsEmailAttachmentMutationResult> {
  const client = await ensureConnected();
  const result = await client.query<
    OperationsEmailAttachmentSafeRow & {
      message_revision: number;
      message_status: OperationsEmailMessageStatus;
      ready_invalidated: boolean;
    }
  >(
    `
      WITH locked_message AS MATERIALIZED (
        SELECT *
        FROM operations_email_messages
        WHERE id = $1
          AND workspace_id = $2
          AND revision = $3
          AND status IN ('draft', 'ready')
        FOR UPDATE
      ), removed AS (
        UPDATE operations_email_attachments attachment
        SET removed_at = now(), removed_by_user_id = $4
        FROM locked_message message
        WHERE attachment.id = $5
          AND attachment.message_id = message.id
          AND attachment.workspace_id = message.workspace_id
          AND attachment.removed_at IS NULL
        RETURNING attachment.*
      ), updated_message AS (
        UPDATE operations_email_messages message
        SET revision = message.revision + 1,
            status = 'draft',
            ready_at = NULL,
            final_render_revision = NULL,
            final_render_attachment_set_sha256 = NULL,
            final_render_html = NULL,
            final_render_plain_text = NULL,
            final_render_html_sha256 = NULL,
            final_render_plain_text_sha256 = NULL,
            final_render_generated_at = NULL,
            final_renderer_version = NULL,
            last_edited_by_user_id = $4,
            updated_at = now()
        FROM removed, locked_message original
        WHERE message.id = original.id
        RETURNING message.revision, message.status, original.status = 'ready' AS ready_invalidated
      )
      SELECT ${ATTACHMENT_SAFE_COLUMNS},
             updated_message.revision AS message_revision,
             updated_message.status AS message_status,
             updated_message.ready_invalidated
      FROM removed attachment
      CROSS JOIN updated_message
    `,
    [
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
      input.actorUserId,
      input.attachmentId,
    ],
  );
  const row = result.rows[0];
  if (row) {
    const {
      message_revision: messageRevision,
      message_status: messageStatus,
      ready_invalidated: readyInvalidated,
      ...attachment
    } = row;
    return {
      outcome: "updated",
      attachment,
      messageRevision,
      messageStatus,
      readyInvalidated,
    };
  }
  return classifyAttachmentMutation(
    input.workspaceId,
    input.messageId,
    input.expectedRevision,
  );
}

export async function getOperationsEmailAttachmentDownload(
  workspaceId: string,
  messageId: string,
  attachmentId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<
    OperationsEmailAttachmentSafeRow & { bytes: Buffer | null }
  >(
    `
      SELECT ${ATTACHMENT_SAFE_COLUMNS},
             CASE
               WHEN attachment.source_type = 'manual' THEN attachment.content_bytes
               WHEN attachment.source_type = 'report_pdf' THEN report_render.pdf_bytes
               WHEN attachment.source_type = 'quote_pdf' THEN quote_render.pdf_bytes
               ELSE NULL
             END AS bytes
      FROM operations_email_attachments attachment
      LEFT JOIN operations_report_pdf_renders report_render
        ON report_render.id = attachment.source_report_render_id
      LEFT JOIN operations_quote_pdf_renders quote_render
        ON quote_render.id = attachment.source_quote_render_id
      WHERE attachment.id = $3
        AND attachment.message_id = $2
        AND attachment.workspace_id = $1
        AND attachment.removed_at IS NULL
    `,
    [workspaceId, messageId, attachmentId],
  );
  return result.rows[0] ?? null;
}

export async function loadOperationsEmailAttachmentBytes(
  workspaceId: string,
  messageId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<
    OperationsEmailAttachmentSafeRow & { bytes: Buffer | null }
  >(
    `
      SELECT ${ATTACHMENT_SAFE_COLUMNS},
             CASE
               WHEN attachment.source_type = 'manual' THEN attachment.content_bytes
               WHEN attachment.source_type = 'report_pdf' THEN report_render.pdf_bytes
               WHEN attachment.source_type = 'quote_pdf' THEN quote_render.pdf_bytes
               ELSE NULL
             END AS bytes
      FROM operations_email_attachments attachment
      LEFT JOIN operations_report_pdf_renders report_render
        ON report_render.id = attachment.source_report_render_id
      LEFT JOIN operations_quote_pdf_renders quote_render
        ON quote_render.id = attachment.source_quote_render_id
      WHERE attachment.workspace_id = $1
        AND attachment.message_id = $2
        AND attachment.removed_at IS NULL
      ORDER BY attachment.display_filename ASC, attachment.id ASC
    `,
    [workspaceId, messageId],
  );
  return result.rows;
}

export async function saveOperationsEmailFinalRender(input: {
  workspaceId: string;
  messageId: string;
  expectedRevision: number;
  actorUserId: string;
  attachmentSetSha256: string;
  html: string;
  plainText: string;
  htmlSha256: string;
  plainTextSha256: string;
  rendererVersion: string;
  renderMetadataJson: Record<string, unknown>;
}) {
  const client = await ensureConnected();
  const result = await client.query<OperationsEmailMessageRow>(
    `
      UPDATE operations_email_messages message
      SET final_render_revision = revision,
          final_render_attachment_set_sha256 = $5,
          final_render_html = $6,
          final_render_plain_text = $7,
          final_render_html_sha256 = $8,
          final_render_plain_text_sha256 = $9,
          final_render_generated_at = now(),
          final_renderer_version = $10,
          render_metadata_json = $11::jsonb,
          last_edited_by_user_id = $4,
          updated_at = now()
      WHERE message.id = $1
        AND message.workspace_id = $2
        AND message.revision = $3
        AND message.status IN ('draft', 'ready')
      RETURNING *
    `,
    [
      input.messageId,
      input.workspaceId,
      input.expectedRevision,
      input.actorUserId,
      input.attachmentSetSha256,
      input.html,
      input.plainText,
      input.htmlSha256,
      input.plainTextSha256,
      input.rendererVersion,
      JSON.stringify(input.renderMetadataJson),
    ],
  );
  return result.rows[0] ?? null;
}

export async function getOperationsEmailScopedQuoteForRender(
  workspaceId: string,
  messageId: string,
  quoteId: string,
) {
  const client = await ensureConnected();
  const result = await client.query<{
    id: string;
    updated_at: Date;
    next_render_revision: number;
  }>(
    `
      SELECT quote.id,
             quote.updated_at,
             COALESCE((
               SELECT max(render.quote_revision) + 1
               FROM operations_quote_pdf_renders render
               WHERE render.operations_quote_id = quote.id
             ), 1)::integer AS next_render_revision
      FROM operations_email_messages message
      JOIN operations_quotes quote ON quote.business_id = message.business_id
      WHERE message.workspace_id = $1
        AND message.id = $2
        AND quote.id = $3
        AND message.status IN ('draft', 'ready')
    `,
    [workspaceId, messageId, quoteId],
  );
  return result.rows[0] ?? null;
}
