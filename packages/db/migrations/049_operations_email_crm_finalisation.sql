CREATE TABLE IF NOT EXISTS operations_email_crm_finalisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES internal_workspaces(id) ON DELETE RESTRICT,
  message_id uuid NOT NULL,
  delivery_id uuid NOT NULL,
  status text NOT NULL,
  business_id uuid REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE RESTRICT,
  sent_communication_id uuid REFERENCES operations_communications(id) ON DELETE RESTRICT,
  linked_after_send_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  linked_after_send_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  safe_error text,
  lock_owner text,
  locked_at timestamptz,
  lock_expires_at timestamptz,
  finalised_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_email_crm_finalisations_message_workspace_fkey
    FOREIGN KEY (message_id, workspace_id)
    REFERENCES operations_email_messages(id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT operations_email_crm_finalisations_delivery_workspace_fkey
    FOREIGN KEY (delivery_id, workspace_id)
    REFERENCES operations_email_deliveries(id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT operations_email_crm_finalisations_status_check
    CHECK (status IN ('not_required', 'pending', 'finalising', 'finalised', 'failed')),
  CONSTRAINT operations_email_crm_finalisations_attempt_check
    CHECK (attempt_count >= 0),
  CONSTRAINT operations_email_crm_finalisations_safe_error_check
    CHECK (safe_error IS NULL OR length(safe_error) <= 1000),
  CONSTRAINT operations_email_crm_finalisations_lock_owner_check
    CHECK (lock_owner IS NULL OR length(lock_owner) <= 300),
  CONSTRAINT operations_email_crm_finalisations_business_contact_check
    CHECK (business_id IS NOT NULL OR contact_id IS NULL),
  CONSTRAINT operations_email_crm_finalisations_link_actor_check
    CHECK (
      linked_after_send_at IS NULL
      OR linked_after_send_by_user_id IS NOT NULL
    ),
  CONSTRAINT operations_email_crm_finalisations_finalised_check
    CHECK (
      status <> 'finalised'
      OR (sent_communication_id IS NOT NULL AND finalised_at IS NOT NULL)
    ),
  CONSTRAINT operations_email_crm_finalisations_message_unique UNIQUE (message_id),
  CONSTRAINT operations_email_crm_finalisations_delivery_unique UNIQUE (delivery_id),
  CONSTRAINT operations_email_crm_finalisations_sent_communication_unique
    UNIQUE (sent_communication_id)
);

CREATE INDEX IF NOT EXISTS operations_email_crm_finalisations_due_idx
  ON operations_email_crm_finalisations(next_attempt_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS operations_email_crm_finalisations_expired_lease_idx
  ON operations_email_crm_finalisations(lock_expires_at)
  WHERE status = 'finalising';

CREATE TABLE IF NOT EXISTS operations_email_imap_readiness (
  workspace_id uuid PRIMARY KEY REFERENCES internal_workspaces(id) ON DELETE CASCADE,
  status text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz,
  safe_error_code text,
  worker_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_email_imap_readiness_status_check
    CHECK (status IN ('unavailable', 'configured', 'available')),
  CONSTRAINT operations_email_imap_readiness_error_length_check
    CHECK (safe_error_code IS NULL OR length(safe_error_code) <= 100),
  CONSTRAINT operations_email_imap_readiness_worker_length_check
    CHECK (worker_id IS NULL OR length(worker_id) <= 300)
);

INSERT INTO operations_email_crm_finalisations (
  workspace_id,
  message_id,
  delivery_id,
  status,
  business_id,
  contact_id,
  sent_communication_id,
  next_attempt_at,
  finalised_at
)
SELECT
  delivery.workspace_id,
  delivery.message_id,
  delivery.id,
  CASE
    WHEN message.sent_communication_id IS NOT NULL THEN 'finalised'
    WHEN message.business_id IS NULL THEN 'not_required'
    ELSE 'pending'
  END,
  message.business_id,
  message.contact_id,
  message.sent_communication_id,
  CASE
    WHEN message.sent_communication_id IS NULL AND message.business_id IS NOT NULL
    THEN now()
    ELSE NULL
  END,
  CASE
    WHEN message.sent_communication_id IS NOT NULL THEN message.updated_at
    ELSE NULL
  END
FROM operations_email_deliveries delivery
JOIN operations_email_messages message
  ON message.id = delivery.message_id
 AND message.workspace_id = delivery.workspace_id
WHERE delivery.delivery_kind = 'real'
  AND delivery.status = 'sent'
  AND delivery.smtp_accepted_at IS NOT NULL
ON CONFLICT (message_id) DO NOTHING;

COMMENT ON TABLE operations_email_crm_finalisations IS
  'Idempotent post-SMTP CRM reconciliation. It never authorises or queues SMTP delivery.';

COMMENT ON TABLE operations_email_imap_readiness IS
  'Safe, secret-free IONOS Sent-folder readiness written by the isolated worker.';
