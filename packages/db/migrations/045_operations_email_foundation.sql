CREATE TABLE IF NOT EXISTS operations_email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES internal_workspaces(id) ON DELETE RESTRICT,
  source_communication_id uuid REFERENCES operations_communications(id) ON DELETE RESTRICT,
  sent_communication_id uuid REFERENCES operations_communications(id) ON DELETE RESTRICT,
  duplicated_from_message_id uuid REFERENCES operations_email_messages(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE RESTRICT,
  report_id uuid REFERENCES operations_reports(id) ON DELETE RESTRICT,
  quote_id uuid REFERENCES operations_quotes(id) ON DELETE RESTRICT,
  from_name text NOT NULL,
  from_address text NOT NULL,
  reply_to_address text,
  recipient_name text,
  recipient_address text NOT NULL,
  subject text NOT NULL,
  preheader text,
  editor_body text NOT NULL,
  rendered_html text,
  plain_text text,
  source_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  render_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  revision integer NOT NULL DEFAULT 1,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  last_edited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  send_requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  cancelled_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  queued_at timestamptz,
  sending_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  uncertain_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  safe_display_error text,
  CONSTRAINT operations_email_messages_id_workspace_unique
    UNIQUE (id, workspace_id),
  CONSTRAINT operations_email_messages_status_check
    CHECK (status IN (
      'draft',
      'ready',
      'queued',
      'sending',
      'sent',
      'failed',
      'delivery_uncertain',
      'cancelled'
    )),
  CONSTRAINT operations_email_messages_revision_check CHECK (revision >= 1),
  CONSTRAINT operations_email_messages_from_name_present_check
    CHECK (length(trim(from_name)) > 0),
  CONSTRAINT operations_email_messages_from_address_present_check
    CHECK (length(trim(from_address)) > 0),
  CONSTRAINT operations_email_messages_recipient_address_present_check
    CHECK (length(trim(recipient_address)) > 0),
  CONSTRAINT operations_email_messages_subject_present_check
    CHECK (length(trim(subject)) > 0),
  CONSTRAINT operations_email_messages_editor_body_present_check
    CHECK (length(trim(editor_body)) > 0),
  CONSTRAINT operations_email_messages_duplicate_self_check
    CHECK (duplicated_from_message_id IS NULL OR duplicated_from_message_id <> id),
  CONSTRAINT operations_email_messages_ready_timestamp_check
    CHECK (status <> 'ready' OR ready_at IS NOT NULL),
  CONSTRAINT operations_email_messages_queued_timestamp_check
    CHECK (status <> 'queued' OR queued_at IS NOT NULL),
  CONSTRAINT operations_email_messages_sending_timestamp_check
    CHECK (status <> 'sending' OR sending_at IS NOT NULL),
  CONSTRAINT operations_email_messages_sent_timestamp_check
    CHECK (status <> 'sent' OR sent_at IS NOT NULL),
  CONSTRAINT operations_email_messages_failed_timestamp_check
    CHECK (status <> 'failed' OR failed_at IS NOT NULL),
  CONSTRAINT operations_email_messages_uncertain_timestamp_check
    CHECK (status <> 'delivery_uncertain' OR uncertain_at IS NOT NULL),
  CONSTRAINT operations_email_messages_cancelled_fields_check
    CHECK (
      status <> 'cancelled'
      OR (cancelled_at IS NOT NULL AND length(trim(cancellation_reason)) > 0)
    ),
  CONSTRAINT operations_email_messages_error_length_check
    CHECK (safe_display_error IS NULL OR length(safe_display_error) <= 1000),
  CONSTRAINT operations_email_messages_cancellation_reason_length_check
    CHECK (cancellation_reason IS NULL OR length(cancellation_reason) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_messages_source_unique_idx
  ON operations_email_messages(source_communication_id)
  WHERE source_communication_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_messages_sent_communication_unique_idx
  ON operations_email_messages(sent_communication_id)
  WHERE sent_communication_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_email_messages_workspace_status_idx
  ON operations_email_messages(workspace_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_email_messages_workspace_updated_idx
  ON operations_email_messages(workspace_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_email_messages_business_history_idx
  ON operations_email_messages(workspace_id, business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS operations_email_messages_contact_history_idx
  ON operations_email_messages(workspace_id, contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_email_messages_sent_idx
  ON operations_email_messages(workspace_id, sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_email_messages_queue_state_idx
  ON operations_email_messages(workspace_id, status, queued_at)
  WHERE status IN ('queued', 'sending');

CREATE TABLE IF NOT EXISTS operations_email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  source_type text NOT NULL,
  source_report_id uuid REFERENCES operations_reports(id) ON DELETE RESTRICT,
  source_quote_id uuid REFERENCES operations_quotes(id) ON DELETE RESTRICT,
  display_filename text NOT NULL,
  storage_filename text NOT NULL,
  declared_mime_type text NOT NULL,
  verified_mime_type text,
  size_bytes bigint NOT NULL,
  sha256 text,
  storage_key text,
  storage_reference_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  removed_at timestamptz,
  CONSTRAINT operations_email_attachments_message_workspace_fkey
    FOREIGN KEY (message_id, workspace_id)
    REFERENCES operations_email_messages(id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT operations_email_attachments_source_type_check
    CHECK (source_type IN ('report_pdf', 'quote_pdf', 'manual')),
  CONSTRAINT operations_email_attachments_source_relationship_check
    CHECK (
      (source_type = 'report_pdf' AND source_report_id IS NOT NULL AND source_quote_id IS NULL)
      OR (source_type = 'quote_pdf' AND source_quote_id IS NOT NULL AND source_report_id IS NULL)
      OR (source_type = 'manual' AND source_report_id IS NULL AND source_quote_id IS NULL)
    ),
  CONSTRAINT operations_email_attachments_display_filename_present_check
    CHECK (length(trim(display_filename)) > 0),
  CONSTRAINT operations_email_attachments_storage_filename_present_check
    CHECK (length(trim(storage_filename)) > 0),
  CONSTRAINT operations_email_attachments_declared_mime_present_check
    CHECK (length(trim(declared_mime_type)) > 0),
  CONSTRAINT operations_email_attachments_size_check CHECK (size_bytes >= 0),
  CONSTRAINT operations_email_attachments_sha256_check
    CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS operations_email_attachments_active_message_idx
  ON operations_email_attachments(workspace_id, message_id, created_at ASC)
  WHERE removed_at IS NULL;

CREATE INDEX IF NOT EXISTS operations_email_attachments_source_report_idx
  ON operations_email_attachments(source_report_id)
  WHERE source_report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_email_attachments_source_quote_idx
  ON operations_email_attachments(source_quote_id)
  WHERE source_quote_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  message_id uuid NOT NULL,
  delivery_kind text NOT NULL,
  initiated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  fixed_message_id text,
  date_header timestamptz,
  envelope_sender text,
  envelope_recipient text,
  raw_mime_bytes bytea,
  raw_mime_storage_key text,
  mime_sha256 text,
  frozen_metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  smtp_phase text,
  failure_class text,
  retry_policy text,
  transmission_may_have_begun boolean NOT NULL DEFAULT false,
  automatic_attempt_count integer NOT NULL DEFAULT 0,
  manual_retry_count integer NOT NULL DEFAULT 0,
  sanitized_provider_code text,
  sanitized_command text,
  response_code integer,
  response_class integer,
  safe_display_error text,
  redacted_internal_error text,
  accepted_recipients_json jsonb,
  rejected_recipients_json jsonb,
  smtp_accepted_at timestamptz,
  provider_response_id text,
  sent_copy_status text NOT NULL DEFAULT 'not_required',
  resolved_sent_mailbox text,
  appended_uid bigint,
  sent_copy_appended_at timestamptz,
  sent_copy_last_attempt_at timestamptz,
  sent_copy_safe_error text,
  smtp_lock_owner text,
  smtp_locked_at timestamptz,
  smtp_lock_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_copy_lock_owner text,
  sent_copy_locked_at timestamptz,
  sent_copy_lock_expires_at timestamptz,
  sent_copy_next_attempt_at timestamptz,
  sent_copy_attempt_count integer NOT NULL DEFAULT 0,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sending_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  uncertain_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_email_deliveries_message_workspace_fkey
    FOREIGN KEY (message_id, workspace_id)
    REFERENCES operations_email_messages(id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT operations_email_deliveries_id_workspace_unique
    UNIQUE (id, workspace_id),
  CONSTRAINT operations_email_deliveries_kind_check
    CHECK (delivery_kind IN ('test', 'real')),
  CONSTRAINT operations_email_deliveries_status_check
    CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'delivery_uncertain', 'cancelled')),
  CONSTRAINT operations_email_deliveries_idempotency_key_present_check
    CHECK (length(trim(idempotency_key)) > 0 AND length(idempotency_key) <= 200),
  CONSTRAINT operations_email_deliveries_frozen_mime_check
    CHECK (raw_mime_bytes IS NULL OR raw_mime_storage_key IS NULL),
  CONSTRAINT operations_email_deliveries_mime_sha256_check
    CHECK (mime_sha256 IS NULL OR mime_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT operations_email_deliveries_smtp_phase_check
    CHECK (smtp_phase IS NULL OR smtp_phase IN (
      'not_started', 'connect', 'envelope', 'data', 'post_data', 'accepted', 'unknown'
    )),
  CONSTRAINT operations_email_deliveries_failure_class_check
    CHECK (failure_class IS NULL OR failure_class IN (
      'transient_pre_acceptance', 'permanent', 'configuration', 'content', 'uncertain'
    )),
  CONSTRAINT operations_email_deliveries_retry_policy_check
    CHECK (retry_policy IS NULL OR retry_policy IN ('automatic', 'manual', 'never')),
  CONSTRAINT operations_email_deliveries_attempt_counts_check
    CHECK (automatic_attempt_count >= 0 AND manual_retry_count >= 0 AND sent_copy_attempt_count >= 0),
  CONSTRAINT operations_email_deliveries_response_code_check
    CHECK (response_code IS NULL OR response_code BETWEEN 100 AND 599),
  CONSTRAINT operations_email_deliveries_response_class_check
    CHECK (response_class IS NULL OR response_class BETWEEN 1 AND 5),
  CONSTRAINT operations_email_deliveries_safe_error_length_check
    CHECK (safe_display_error IS NULL OR length(safe_display_error) <= 1000),
  CONSTRAINT operations_email_deliveries_internal_error_length_check
    CHECK (redacted_internal_error IS NULL OR length(redacted_internal_error) <= 2000),
  CONSTRAINT operations_email_deliveries_provider_fields_length_check
    CHECK (
      (sanitized_provider_code IS NULL OR length(sanitized_provider_code) <= 100)
      AND (sanitized_command IS NULL OR length(sanitized_command) <= 100)
      AND (provider_response_id IS NULL OR length(provider_response_id) <= 300)
    ),
  CONSTRAINT operations_email_deliveries_uncertain_safety_check
    CHECK (
      status <> 'delivery_uncertain'
      OR (transmission_may_have_begun = true AND retry_policy = 'never' AND uncertain_at IS NOT NULL)
    ),
  CONSTRAINT operations_email_deliveries_sent_copy_status_check
    CHECK (sent_copy_status IN ('not_required', 'pending', 'appending', 'appended', 'failed')),
  CONSTRAINT operations_email_deliveries_sent_copy_error_length_check
    CHECK (sent_copy_safe_error IS NULL OR length(sent_copy_safe_error) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_deliveries_idempotency_idx
  ON operations_email_deliveries(message_id, delivery_kind, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS operations_email_deliveries_one_real_idx
  ON operations_email_deliveries(message_id)
  WHERE delivery_kind = 'real';

CREATE INDEX IF NOT EXISTS operations_email_deliveries_due_smtp_idx
  ON operations_email_deliveries(next_attempt_at, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS operations_email_deliveries_expired_smtp_lease_idx
  ON operations_email_deliveries(smtp_lock_expires_at)
  WHERE status = 'sending' AND transmission_may_have_begun = false;

CREATE INDEX IF NOT EXISTS operations_email_deliveries_sent_copy_due_idx
  ON operations_email_deliveries(sent_copy_next_attempt_at, smtp_accepted_at)
  WHERE sent_copy_status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS operations_email_deliveries_sent_copy_expired_lease_idx
  ON operations_email_deliveries(sent_copy_lock_expires_at)
  WHERE sent_copy_status = 'appending';

CREATE INDEX IF NOT EXISTS operations_email_deliveries_message_history_idx
  ON operations_email_deliveries(workspace_id, message_id, created_at DESC);

COMMENT ON COLUMN operations_email_deliveries.smtp_phase IS
  'not_started/connect/envelope are pre-transmission; data begins when SMTP DATA is accepted or MIME streaming starts; post_data/unknown may have transmitted content; accepted means SMTP acceptance was confirmed';

COMMENT ON COLUMN operations_email_deliveries.transmission_may_have_begun IS
  'False is required for automatic SMTP retry. Set true before MIME bytes may be transmitted; an unconfirmed outcome after that boundary is delivery_uncertain and never auto-retried.';

CREATE TABLE IF NOT EXISTS operations_email_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  delivery_id uuid NOT NULL,
  transport_kind text NOT NULL,
  attempt_number integer NOT NULL,
  request_kind text NOT NULL,
  initiated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  worker_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  outcome text NOT NULL DEFAULT 'started',
  smtp_phase text,
  failure_class text,
  retry_policy text,
  transmission_may_have_begun boolean NOT NULL DEFAULT false,
  sanitized_provider_code text,
  sanitized_command text,
  response_code integer,
  response_class integer,
  safe_display_error text,
  redacted_internal_diagnostic text,
  CONSTRAINT operations_email_delivery_attempts_delivery_workspace_fkey
    FOREIGN KEY (delivery_id, workspace_id)
    REFERENCES operations_email_deliveries(id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT operations_email_delivery_attempts_transport_check
    CHECK (transport_kind IN ('smtp', 'imap_append')),
  CONSTRAINT operations_email_delivery_attempts_number_check CHECK (attempt_number > 0),
  CONSTRAINT operations_email_delivery_attempts_request_kind_check
    CHECK (request_kind IN ('automatic', 'actor_requested')),
  CONSTRAINT operations_email_delivery_attempts_outcome_check
    CHECK (outcome IN ('started', 'succeeded', 'failed', 'delivery_uncertain', 'cancelled')),
  CONSTRAINT operations_email_delivery_attempts_smtp_phase_check
    CHECK (smtp_phase IS NULL OR smtp_phase IN (
      'not_started', 'connect', 'envelope', 'data', 'post_data', 'accepted', 'unknown'
    )),
  CONSTRAINT operations_email_delivery_attempts_failure_class_check
    CHECK (failure_class IS NULL OR failure_class IN (
      'transient_pre_acceptance', 'permanent', 'configuration', 'content', 'uncertain'
    )),
  CONSTRAINT operations_email_delivery_attempts_retry_policy_check
    CHECK (retry_policy IS NULL OR retry_policy IN ('automatic', 'manual', 'never')),
  CONSTRAINT operations_email_delivery_attempts_response_code_check
    CHECK (response_code IS NULL OR response_code BETWEEN 100 AND 599),
  CONSTRAINT operations_email_delivery_attempts_response_class_check
    CHECK (response_class IS NULL OR response_class BETWEEN 1 AND 5),
  CONSTRAINT operations_email_delivery_attempts_safe_error_length_check
    CHECK (safe_display_error IS NULL OR length(safe_display_error) <= 1000),
  CONSTRAINT operations_email_delivery_attempts_diagnostic_length_check
    CHECK (redacted_internal_diagnostic IS NULL OR length(redacted_internal_diagnostic) <= 2000),
  CONSTRAINT operations_email_delivery_attempts_provider_fields_length_check
    CHECK (
      (sanitized_provider_code IS NULL OR length(sanitized_provider_code) <= 100)
      AND (sanitized_command IS NULL OR length(sanitized_command) <= 100)
    ),
  CONSTRAINT operations_email_delivery_attempts_unique_number
    UNIQUE (delivery_id, transport_kind, attempt_number)
);

CREATE INDEX IF NOT EXISTS operations_email_delivery_attempts_delivery_idx
  ON operations_email_delivery_attempts(workspace_id, delivery_id, started_at DESC);

COMMENT ON COLUMN operations_email_delivery_attempts.smtp_phase IS
  'Attempt-local copy of the SMTP boundary: data or later means message transmission may have begun unless acceptance was confirmed.';

CREATE TABLE IF NOT EXISTS operations_quote_pdf_renders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_quote_id uuid NOT NULL REFERENCES operations_quotes(id) ON DELETE RESTRICT,
  quote_revision integer NOT NULL,
  filename text NOT NULL,
  pdf_bytes bytea NOT NULL,
  content_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint NOT NULL,
  sha256 text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  generation_source text NOT NULL DEFAULT 'system',
  CONSTRAINT operations_quote_pdf_renders_revision_check CHECK (quote_revision > 0),
  CONSTRAINT operations_quote_pdf_renders_filename_present_check
    CHECK (length(trim(filename)) > 0),
  CONSTRAINT operations_quote_pdf_renders_bytes_present_check
    CHECK (octet_length(pdf_bytes) > 0 AND octet_length(pdf_bytes) = size_bytes),
  CONSTRAINT operations_quote_pdf_renders_content_type_check
    CHECK (content_type = 'application/pdf'),
  CONSTRAINT operations_quote_pdf_renders_sha256_check
    CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT operations_quote_pdf_renders_generation_source_check
    CHECK (generation_source IN ('system', 'actor')),
  CONSTRAINT operations_quote_pdf_renders_quote_revision_unique
    UNIQUE (operations_quote_id, quote_revision)
);

CREATE INDEX IF NOT EXISTS operations_quote_pdf_renders_quote_generated_idx
  ON operations_quote_pdf_renders(operations_quote_id, generated_at DESC);
