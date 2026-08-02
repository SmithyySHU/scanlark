CREATE TABLE IF NOT EXISTS operations_document_counters (
  document_type text NOT NULL,
  prefix text NOT NULL,
  document_year integer NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_type, prefix, document_year),
  CONSTRAINT operations_document_counters_type_check
    CHECK (document_type IN ('quote', 'work_order')),
  CONSTRAINT operations_document_counters_year_check
    CHECK (document_year >= 2020),
  CONSTRAINT operations_document_counters_value_check
    CHECK (last_value >= 0)
);

CREATE TABLE IF NOT EXISTS operations_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  operations_report_id uuid REFERENCES operations_reports(id) ON DELETE SET NULL,
  quote_number text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GBP',
  subtotal_minor integer NOT NULL DEFAULT 0,
  discount_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL DEFAULT 0,
  valid_until date,
  estimated_start_date date,
  estimated_completion_date date,
  estimated_duration_text text,
  payment_terms text,
  scope_summary text,
  included_scope text,
  excluded_scope text,
  assumptions text,
  client_responsibilities text,
  access_requirements_summary text,
  internal_notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  cancelled_at timestamptz,
  frozen_render_json jsonb,
  frozen_at timestamptz,
  last_pdf_generated_at timestamptz,
  delivery_communication_id uuid REFERENCES operations_communications(id) ON DELETE SET NULL,
  follow_up_task_id uuid REFERENCES operations_tasks(id) ON DELETE SET NULL,
  converted_work_order_id uuid,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_quotes_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_quotes_status_check
    CHECK (status IN (
      'draft',
      'needs_review',
      'ready_to_send',
      'sent',
      'accepted',
      'declined',
      'expired',
      'cancelled',
      'converted_to_work'
    )),
  CONSTRAINT operations_quotes_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT operations_quotes_money_non_negative_check
    CHECK (
      subtotal_minor >= 0
      AND discount_minor >= 0
      AND tax_minor >= 0
      AND total_minor >= 0
    )
);

CREATE INDEX IF NOT EXISTS operations_quotes_business_status_idx
  ON operations_quotes(business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_quotes_report_idx
  ON operations_quotes(operations_report_id, status, updated_at DESC)
  WHERE operations_report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_quotes_valid_until_idx
  ON operations_quotes(valid_until, status)
  WHERE valid_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_quotes_sent_idx
  ON operations_quotes(sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES operations_quotes(id) ON DELETE CASCADE,
  report_finding_id uuid REFERENCES operations_report_findings(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_minor integer NOT NULL DEFAULT 0,
  line_total_minor integer NOT NULL DEFAULT 0,
  item_type text NOT NULL DEFAULT 'website_fix',
  is_optional boolean NOT NULL DEFAULT false,
  is_selected boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  estimated_effort text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_quote_items_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_quote_items_type_check
    CHECK (item_type IN (
      'website_fix',
      'investigation',
      'configuration',
      'content_change',
      'monitoring_setup',
      'retest',
      'consultation',
      'other'
    )),
  CONSTRAINT operations_quote_items_money_check
    CHECK (quantity >= 0 AND unit_price_minor >= 0 AND line_total_minor >= 0)
);

CREATE INDEX IF NOT EXISTS operations_quote_items_quote_order_idx
  ON operations_quote_items(quote_id, display_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_quote_items_finding_idx
  ON operations_quote_items(report_finding_id)
  WHERE report_finding_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_quote_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES operations_quotes(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_quote_status_history_status_check
    CHECK (
      (previous_status IS NULL OR previous_status IN (
        'draft',
        'needs_review',
        'ready_to_send',
        'sent',
        'accepted',
        'declined',
        'expired',
        'cancelled',
        'converted_to_work'
      ))
      AND new_status IN (
        'draft',
        'needs_review',
        'ready_to_send',
        'sent',
        'accepted',
        'declined',
        'expired',
        'cancelled',
        'converted_to_work'
      )
    )
);

CREATE INDEX IF NOT EXISTS operations_quote_status_history_quote_idx
  ON operations_quote_status_history(quote_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operations_quote_service_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  suggested_price_minor integer NOT NULL DEFAULT 0,
  suggested_effort text,
  item_type text NOT NULL DEFAULT 'website_fix',
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_quote_service_items_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_quote_service_items_price_check
    CHECK (suggested_price_minor >= 0),
  CONSTRAINT operations_quote_service_items_type_check
    CHECK (item_type IN (
      'website_fix',
      'investigation',
      'configuration',
      'content_change',
      'monitoring_setup',
      'retest',
      'consultation',
      'other'
    ))
);

CREATE INDEX IF NOT EXISTS operations_quote_service_items_active_idx
  ON operations_quote_service_items(is_active, item_type, title);

INSERT INTO operations_quote_service_items (
  title,
  description,
  suggested_price_minor,
  suggested_effort,
  item_type,
  is_active
)
SELECT
  seed.title,
  seed.description,
  seed.suggested_price_minor,
  seed.suggested_effort,
  seed.item_type,
  seed.is_active
FROM (
  VALUES
  ('Broken-link corrections', 'Fix or remove agreed broken links and confirm the affected pages no longer lead visitors to dead ends.', 9500, 'Small', 'website_fix', true),
  ('Missing-resource investigation', 'Investigate missing images, scripts or assets and make agreed practical repairs where access allows.', 12500, 'Small to medium', 'investigation', true),
  ('Redirect repair', 'Add or adjust redirects for agreed moved or missing pages.', 12500, 'Small', 'configuration', true),
  ('Basic metadata update', 'Update agreed titles, descriptions or visible metadata where access and content are provided.', 7500, 'Small', 'content_change', true),
  ('Website health re-test', 'Run a post-fix Scanlark re-test and prepare a concise comparison summary.', 9500, 'Small', 'retest', true),
  ('Monthly monitoring setup', 'Configure ongoing website health monitoring and first-month review workflow.', 15000, 'Small', 'monitoring_setup', true)
) AS seed(
  title,
  description,
  suggested_price_minor,
  suggested_effort,
  item_type,
  is_active
)
WHERE NOT EXISTS (
  SELECT 1
  FROM operations_quote_service_items existing
  WHERE lower(existing.title) = lower(seed.title)
);

CREATE TABLE IF NOT EXISTS operations_quote_access_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES operations_quotes(id) ON DELETE CASCADE,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'not_requested',
  requested_at timestamptz,
  received_at timestamptz,
  secure_storage_reference text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_quote_access_requirements_description_check
    CHECK (length(trim(description)) > 0),
  CONSTRAINT operations_quote_access_requirements_status_check
    CHECK (status IN (
      'not_required',
      'not_requested',
      'requested',
      'received',
      'verified',
      'no_longer_needed'
    ))
);

CREATE INDEX IF NOT EXISTS operations_quote_access_requirements_quote_idx
  ON operations_quote_access_requirements(quote_id, display_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS operations_work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  quote_id uuid NOT NULL REFERENCES operations_quotes(id) ON DELETE RESTRICT,
  operations_report_id uuid REFERENCES operations_reports(id) ON DELETE SET NULL,
  work_order_number text NOT NULL UNIQUE,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  priority text NOT NULL DEFAULT 'normal',
  scope_summary text,
  accepted_total_minor integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  started_at timestamptz,
  target_completion_at timestamptz,
  completed_at timestamptz,
  blocked_reason text,
  client_waiting_reason text,
  completion_summary text,
  internal_notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_work_orders_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_work_orders_status_check
    CHECK (status IN (
      'not_started',
      'awaiting_access',
      'ready_to_start',
      'in_progress',
      'waiting_for_client',
      'blocked',
      'ready_for_testing',
      'testing',
      'completed',
      'cancelled'
    )),
  CONSTRAINT operations_work_orders_priority_check
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  CONSTRAINT operations_work_orders_money_check
    CHECK (accepted_total_minor >= 0),
  CONSTRAINT operations_work_orders_currency_check
    CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_work_orders_quote_active_unique_idx
  ON operations_work_orders(quote_id)
  WHERE status <> 'cancelled';

CREATE INDEX IF NOT EXISTS operations_work_orders_business_status_idx
  ON operations_work_orders(business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_work_orders_report_idx
  ON operations_work_orders(operations_report_id, status, updated_at DESC)
  WHERE operations_report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_work_orders_status_target_idx
  ON operations_work_orders(status, target_completion_at)
  WHERE status <> 'completed' AND status <> 'cancelled';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_quotes_converted_work_order_fk'
  ) THEN
    ALTER TABLE operations_quotes
      ADD CONSTRAINT operations_quotes_converted_work_order_fk
      FOREIGN KEY (converted_work_order_id)
      REFERENCES operations_work_orders(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS operations_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES operations_work_orders(id) ON DELETE CASCADE,
  quote_item_id uuid REFERENCES operations_quote_items(id) ON DELETE SET NULL,
  report_finding_id uuid REFERENCES operations_report_findings(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'to_do',
  display_order integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  client_visible_completion_notes text,
  requires_retest boolean NOT NULL DEFAULT false,
  retest_status text NOT NULL DEFAULT 'not_required',
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_work_items_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_work_items_status_check
    CHECK (status IN (
      'to_do',
      'in_progress',
      'waiting_for_client',
      'blocked',
      'ready_for_testing',
      'completed',
      'cancelled'
    )),
  CONSTRAINT operations_work_items_retest_status_check
    CHECK (retest_status IN (
      'not_required',
      'pending',
      'passed',
      'failed',
      'unable_to_verify'
    )),
  CONSTRAINT operations_work_items_completed_status_check
    CHECK (status <> 'completed' OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS operations_work_items_order_idx
  ON operations_work_items(work_order_id, display_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_work_items_status_idx
  ON operations_work_items(work_order_id, status);

CREATE INDEX IF NOT EXISTS operations_work_items_finding_idx
  ON operations_work_items(report_finding_id)
  WHERE report_finding_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_work_order_access_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES operations_work_orders(id) ON DELETE CASCADE,
  quote_access_requirement_id uuid REFERENCES operations_quote_access_requirements(id) ON DELETE SET NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'not_requested',
  requested_at timestamptz,
  received_at timestamptz,
  secure_storage_reference text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_work_order_access_requirements_description_check
    CHECK (length(trim(description)) > 0),
  CONSTRAINT operations_work_order_access_requirements_status_check
    CHECK (status IN (
      'not_required',
      'not_requested',
      'requested',
      'received',
      'verified',
      'no_longer_needed'
    ))
);

CREATE INDEX IF NOT EXISTS operations_work_order_access_requirements_order_idx
  ON operations_work_order_access_requirements(work_order_id, display_order ASC, created_at ASC);

ALTER TABLE operations_communications
  ADD COLUMN IF NOT EXISTS operations_report_id uuid REFERENCES operations_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES operations_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES operations_work_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_communications_quote_idx
  ON operations_communications(quote_id, occurred_at DESC)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_communications_work_order_idx
  ON operations_communications(work_order_id, occurred_at DESC)
  WHERE work_order_id IS NOT NULL;

ALTER TABLE operations_tasks
  ADD COLUMN IF NOT EXISTS source_quote_id uuid REFERENCES operations_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_work_order_id uuid REFERENCES operations_work_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_work_item_id uuid REFERENCES operations_work_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS operations_tasks_source_key_unique_idx
  ON operations_tasks(source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_tasks_quote_idx
  ON operations_tasks(source_quote_id, status, due_at)
  WHERE source_quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_tasks_work_order_idx
  ON operations_tasks(source_work_order_id, status, due_at)
  WHERE source_work_order_id IS NOT NULL;
