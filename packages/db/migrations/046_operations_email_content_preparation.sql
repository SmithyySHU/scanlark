DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'operations_report_pdf_renders'::regclass
      AND conname = 'operations_report_pdf_renders_pkey'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (operations_report_id)'
  ) THEN
    ALTER TABLE operations_report_pdf_renders
      DROP CONSTRAINT operations_report_pdf_renders_pkey;
  END IF;
END $$;

ALTER TABLE operations_report_pdf_renders
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'application/pdf',
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS sha256 text,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS source_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS generated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_source text DEFAULT 'actor';

UPDATE operations_report_pdf_renders render
SET size_bytes = octet_length(render.pdf_bytes),
    sha256 = encode(digest(render.pdf_bytes, 'sha256'), 'hex'),
    source_version = COALESCE(
      render.source_version,
      concat('report-v', report.version_number, '-', extract(epoch FROM report.updated_at)::bigint)
    ),
    source_snapshot_sha256 = COALESCE(
      render.source_snapshot_sha256,
      encode(digest(COALESCE(report.frozen_render_json, '{}'::jsonb)::text, 'sha256'), 'hex')
    )
FROM operations_reports report
WHERE report.id = render.operations_report_id;

UPDATE operations_report_pdf_renders
SET source_version = COALESCE(source_version, 'legacy'),
    source_snapshot_sha256 = COALESCE(source_snapshot_sha256, sha256)
WHERE source_version IS NULL OR source_snapshot_sha256 IS NULL;

ALTER TABLE operations_report_pdf_renders
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN content_type SET NOT NULL,
  ALTER COLUMN size_bytes SET NOT NULL,
  ALTER COLUMN sha256 SET NOT NULL,
  ALTER COLUMN source_version SET NOT NULL,
  ALTER COLUMN source_snapshot_sha256 SET NOT NULL,
  ALTER COLUMN generation_source SET NOT NULL;

ALTER TABLE operations_report_pdf_renders
  DROP CONSTRAINT IF EXISTS operations_report_pdf_renders_content_type_check,
  DROP CONSTRAINT IF EXISTS operations_report_pdf_renders_size_check,
  DROP CONSTRAINT IF EXISTS operations_report_pdf_renders_sha256_check,
  DROP CONSTRAINT IF EXISTS operations_report_pdf_renders_snapshot_sha256_check,
  DROP CONSTRAINT IF EXISTS operations_report_pdf_renders_generation_source_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'operations_report_pdf_renders'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE operations_report_pdf_renders
      ADD CONSTRAINT operations_report_pdf_renders_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE operations_report_pdf_renders
  ADD CONSTRAINT operations_report_pdf_renders_content_type_check
    CHECK (content_type = 'application/pdf'),
  ADD CONSTRAINT operations_report_pdf_renders_size_check
    CHECK (size_bytes > 0 AND size_bytes = octet_length(pdf_bytes)),
  ADD CONSTRAINT operations_report_pdf_renders_sha256_check
    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT operations_report_pdf_renders_snapshot_sha256_check
    CHECK (source_snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT operations_report_pdf_renders_generation_source_check
    CHECK (generation_source IN ('system', 'actor'));

CREATE UNIQUE INDEX IF NOT EXISTS operations_report_pdf_renders_source_unique_idx
  ON operations_report_pdf_renders(operations_report_id, source_snapshot_sha256);

CREATE INDEX IF NOT EXISTS operations_report_pdf_renders_report_generated_idx
  ON operations_report_pdf_renders(operations_report_id, generated_at DESC);

ALTER TABLE operations_quote_pdf_renders
  ADD COLUMN IF NOT EXISTS source_snapshot_sha256 text,
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_snapshot_json jsonb DEFAULT '{}'::jsonb;

UPDATE operations_quote_pdf_renders
SET source_snapshot_sha256 = COALESCE(source_snapshot_sha256, sha256),
    source_updated_at = COALESCE(source_updated_at, generated_at);

ALTER TABLE operations_quote_pdf_renders
  ALTER COLUMN source_snapshot_sha256 SET NOT NULL,
  ALTER COLUMN source_updated_at SET NOT NULL,
  ALTER COLUMN source_snapshot_json SET NOT NULL;

ALTER TABLE operations_quote_pdf_renders
  DROP CONSTRAINT IF EXISTS operations_quote_pdf_renders_snapshot_sha256_check;

ALTER TABLE operations_quote_pdf_renders
  ADD CONSTRAINT operations_quote_pdf_renders_snapshot_sha256_check
    CHECK (source_snapshot_sha256 ~ '^[0-9a-f]{64}$');

DROP INDEX IF EXISTS operations_quote_pdf_renders_snapshot_idx;
CREATE UNIQUE INDEX IF NOT EXISTS operations_quote_pdf_renders_snapshot_unique_idx
  ON operations_quote_pdf_renders(operations_quote_id, source_snapshot_sha256);

ALTER TABLE operations_email_attachments
  ADD COLUMN IF NOT EXISTS source_report_render_id uuid
    REFERENCES operations_report_pdf_renders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_quote_render_id uuid
    REFERENCES operations_quote_pdf_renders(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_version text,
  ADD COLUMN IF NOT EXISTS source_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_bytes bytea;

ALTER TABLE operations_email_attachments
  DROP CONSTRAINT IF EXISTS operations_email_attachments_render_relationship_check,
  DROP CONSTRAINT IF EXISTS operations_email_attachments_content_size_check;

ALTER TABLE operations_email_attachments
  ADD CONSTRAINT operations_email_attachments_render_relationship_check
    CHECK (
      (source_type = 'report_pdf'
        AND source_report_render_id IS NOT NULL
        AND source_quote_render_id IS NULL
        AND content_bytes IS NULL)
      OR (source_type = 'quote_pdf'
        AND source_quote_render_id IS NOT NULL
        AND source_report_render_id IS NULL
        AND content_bytes IS NULL)
      OR (source_type = 'manual'
        AND source_report_render_id IS NULL
        AND source_quote_render_id IS NULL)
    ),
  ADD CONSTRAINT operations_email_attachments_content_size_check
    CHECK (content_bytes IS NULL OR octet_length(content_bytes) = size_bytes);

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_attachments_active_report_render_idx
  ON operations_email_attachments(message_id, source_report_render_id)
  WHERE removed_at IS NULL AND source_report_render_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_attachments_active_quote_render_idx
  ON operations_email_attachments(message_id, source_quote_render_id)
  WHERE removed_at IS NULL AND source_quote_render_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_attachments_active_filename_idx
  ON operations_email_attachments(message_id, lower(display_filename))
  WHERE removed_at IS NULL;

ALTER TABLE operations_email_messages
  ADD COLUMN IF NOT EXISTS final_render_revision integer,
  ADD COLUMN IF NOT EXISTS final_render_attachment_set_sha256 text,
  ADD COLUMN IF NOT EXISTS final_render_html text,
  ADD COLUMN IF NOT EXISTS final_render_plain_text text,
  ADD COLUMN IF NOT EXISTS final_render_html_sha256 text,
  ADD COLUMN IF NOT EXISTS final_render_plain_text_sha256 text,
  ADD COLUMN IF NOT EXISTS final_render_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_renderer_version text;

ALTER TABLE operations_email_messages
  DROP CONSTRAINT IF EXISTS operations_email_messages_final_render_revision_check,
  DROP CONSTRAINT IF EXISTS operations_email_messages_final_render_hashes_check,
  DROP CONSTRAINT IF EXISTS operations_email_messages_final_render_complete_check;

ALTER TABLE operations_email_messages
  ADD CONSTRAINT operations_email_messages_final_render_revision_check
    CHECK (final_render_revision IS NULL OR final_render_revision > 0),
  ADD CONSTRAINT operations_email_messages_final_render_hashes_check
    CHECK (
      (final_render_attachment_set_sha256 IS NULL
        AND final_render_html_sha256 IS NULL
        AND final_render_plain_text_sha256 IS NULL)
      OR (final_render_attachment_set_sha256 ~ '^[0-9a-f]{64}$'
        AND final_render_html_sha256 ~ '^[0-9a-f]{64}$'
        AND final_render_plain_text_sha256 ~ '^[0-9a-f]{64}$')
    ),
  ADD CONSTRAINT operations_email_messages_final_render_complete_check
    CHECK (
      final_render_revision IS NULL
      OR (
        final_render_html IS NOT NULL
        AND final_render_plain_text IS NOT NULL
        AND final_render_generated_at IS NOT NULL
        AND length(trim(final_renderer_version)) > 0
      )
    );
