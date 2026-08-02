CREATE TABLE IF NOT EXISTS operations_service_plan_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  plan_type text NOT NULL DEFAULT 'custom',
  default_currency text NOT NULL DEFAULT 'GBP',
  default_price_minor integer NOT NULL DEFAULT 0,
  default_billing_cadence text NOT NULL DEFAULT 'monthly',
  default_scan_frequency text NOT NULL DEFAULT 'weekly',
  default_report_frequency text NOT NULL DEFAULT 'monthly',
  default_review_frequency text NOT NULL DEFAULT 'quarterly',
  includes_uptime_monitoring boolean NOT NULL DEFAULT false,
  includes_issue_alerts boolean NOT NULL DEFAULT true,
  includes_monthly_report boolean NOT NULL DEFAULT true,
  includes_advice boolean NOT NULL DEFAULT true,
  includes_small_fixes boolean NOT NULL DEFAULT false,
  included_support_minutes integer,
  included_fix_count integer,
  response_target_text text,
  scope_summary text,
  included_scope text,
  excluded_scope text,
  is_active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_service_plan_templates_name_present_check
    CHECK (length(trim(name)) > 0),
  CONSTRAINT operations_service_plan_templates_code_present_check
    CHECK (length(trim(code)) > 0),
  CONSTRAINT operations_service_plan_templates_type_check
    CHECK (plan_type IN (
      'monitoring_only',
      'monitoring_and_support',
      'managed_care',
      'custom'
    )),
  CONSTRAINT operations_service_plan_templates_billing_check
    CHECK (default_billing_cadence IN (
      'monthly',
      'quarterly',
      'annual',
      'one_off',
      'custom'
    )),
  CONSTRAINT operations_service_plan_templates_scan_check
    CHECK (default_scan_frequency IN (
      'daily',
      'weekly',
      'fortnightly',
      'monthly',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_service_plan_templates_report_check
    CHECK (default_report_frequency IN (
      'weekly',
      'monthly',
      'quarterly',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_service_plan_templates_review_check
    CHECK (default_review_frequency IN (
      'monthly',
      'quarterly',
      'annual',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_service_plan_templates_currency_check
    CHECK (default_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT operations_service_plan_templates_money_check
    CHECK (default_price_minor >= 0),
  CONSTRAINT operations_service_plan_templates_allowance_check
    CHECK (
      (included_support_minutes IS NULL OR included_support_minutes >= 0)
      AND (included_fix_count IS NULL OR included_fix_count >= 0)
    )
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_document_counters_type_check'
  ) THEN
    ALTER TABLE operations_document_counters
      DROP CONSTRAINT operations_document_counters_type_check;
  END IF;
  ALTER TABLE operations_document_counters
    ADD CONSTRAINT operations_document_counters_type_check
    CHECK (document_type IN ('quote', 'work_order', 'client_service'));
END $$;

CREATE INDEX IF NOT EXISTS operations_service_plan_templates_active_idx
  ON operations_service_plan_templates(is_active, plan_type, name)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS operations_client_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  service_plan_id uuid REFERENCES operations_service_plan_templates(id) ON DELETE SET NULL,
  source_quote_id uuid REFERENCES operations_quotes(id) ON DELETE SET NULL,
  source_work_order_id uuid REFERENCES operations_work_orders(id) ON DELETE SET NULL,
  service_number text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'GBP',
  agreed_price_minor integer NOT NULL DEFAULT 0,
  zero_cost_confirmed boolean NOT NULL DEFAULT false,
  billing_cadence text NOT NULL DEFAULT 'monthly',
  start_date date,
  minimum_term_end_date date,
  next_report_at timestamptz,
  next_review_at timestamptz,
  renewal_date date,
  renewal_reminder_at timestamptz,
  notice_period_text text,
  scan_frequency text NOT NULL DEFAULT 'weekly',
  report_frequency text NOT NULL DEFAULT 'monthly',
  review_frequency text NOT NULL DEFAULT 'quarterly',
  includes_uptime_monitoring boolean NOT NULL DEFAULT false,
  includes_issue_alerts boolean NOT NULL DEFAULT true,
  includes_monthly_report boolean NOT NULL DEFAULT true,
  includes_advice boolean NOT NULL DEFAULT true,
  includes_small_fixes boolean NOT NULL DEFAULT false,
  included_support_minutes integer,
  included_fix_count integer,
  response_target_text text,
  scope_summary text,
  included_scope text,
  excluded_scope text,
  custom_terms text,
  internal_notes text,
  proposed_at timestamptz,
  activated_at timestamptz,
  paused_at timestamptz,
  planned_resume_at timestamptz,
  cancellation_requested_at timestamptz,
  requested_end_date date,
  cancelled_at timestamptz,
  ended_at timestamptz,
  archived_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_services_name_present_check
    CHECK (length(trim(name)) > 0),
  CONSTRAINT operations_client_services_status_check
    CHECK (status IN (
      'draft',
      'proposed',
      'pending_start',
      'active',
      'paused',
      'review_due',
      'cancellation_pending',
      'cancelled',
      'expired',
      'completed'
    )),
  CONSTRAINT operations_client_services_billing_check
    CHECK (billing_cadence IN (
      'monthly',
      'quarterly',
      'annual',
      'one_off',
      'custom'
    )),
  CONSTRAINT operations_client_services_scan_check
    CHECK (scan_frequency IN (
      'daily',
      'weekly',
      'fortnightly',
      'monthly',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_client_services_report_check
    CHECK (report_frequency IN (
      'weekly',
      'monthly',
      'quarterly',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_client_services_review_check
    CHECK (review_frequency IN (
      'monthly',
      'quarterly',
      'annual',
      'manual',
      'custom'
    )),
  CONSTRAINT operations_client_services_currency_check
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT operations_client_services_money_check
    CHECK (agreed_price_minor >= 0),
  CONSTRAINT operations_client_services_allowance_check
    CHECK (
      (included_support_minutes IS NULL OR included_support_minutes >= 0)
      AND (included_fix_count IS NULL OR included_fix_count >= 0)
    )
);

CREATE INDEX IF NOT EXISTS operations_client_services_business_status_idx
  ON operations_client_services(business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_client_services_plan_idx
  ON operations_client_services(service_plan_id, status)
  WHERE service_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_client_services_next_report_idx
  ON operations_client_services(next_report_at, status)
  WHERE next_report_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_client_services_next_review_idx
  ON operations_client_services(next_review_at, status)
  WHERE next_review_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_client_services_renewal_idx
  ON operations_client_services(renewal_date, status)
  WHERE renewal_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_client_service_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  monitoring_enabled boolean NOT NULL DEFAULT true,
  uptime_monitoring_enabled boolean NOT NULL DEFAULT false,
  scan_frequency_override text,
  report_frequency_override text,
  schedule_managed_by_service boolean NOT NULL DEFAULT false,
  previous_schedule_json jsonb,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_service_sites_scan_check
    CHECK (
      scan_frequency_override IS NULL
      OR scan_frequency_override IN (
        'daily',
        'weekly',
        'fortnightly',
        'monthly',
        'manual',
        'custom'
      )
    ),
  CONSTRAINT operations_client_service_sites_report_check
    CHECK (
      report_frequency_override IS NULL
      OR report_frequency_override IN (
        'weekly',
        'monthly',
        'quarterly',
        'manual',
        'custom'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS operations_client_service_sites_active_unique_idx
  ON operations_client_service_sites(client_service_id, site_id)
  WHERE removed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS operations_client_service_sites_primary_unique_idx
  ON operations_client_service_sites(client_service_id)
  WHERE removed_at IS NULL AND is_primary = true;

CREATE INDEX IF NOT EXISTS operations_client_service_sites_site_idx
  ON operations_client_service_sites(site_id, removed_at);

CREATE TABLE IF NOT EXISTS operations_client_service_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  notes text,
  changed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operations_client_service_status_history_service_idx
  ON operations_client_service_status_history(client_service_id, created_at DESC);

CREATE TABLE IF NOT EXISTS operations_client_service_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  activity_type text NOT NULL,
  title text NOT NULL,
  detail text,
  related_site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  related_report_id uuid REFERENCES operations_reports(id) ON DELETE SET NULL,
  related_quote_id uuid REFERENCES operations_quotes(id) ON DELETE SET NULL,
  related_work_order_id uuid REFERENCES operations_work_orders(id) ON DELETE SET NULL,
  related_communication_id uuid REFERENCES operations_communications(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS operations_client_service_activity_service_idx
  ON operations_client_service_activity(client_service_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS operations_client_service_activity_business_idx
  ON operations_client_service_activity(business_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS operations_client_service_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  work_order_id uuid REFERENCES operations_work_orders(id) ON DELETE SET NULL,
  communication_id uuid REFERENCES operations_communications(id) ON DELETE SET NULL,
  operations_report_id uuid REFERENCES operations_reports(id) ON DELETE SET NULL,
  usage_type text NOT NULL DEFAULT 'other',
  description text NOT NULL,
  minutes_used integer,
  fixes_used integer,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  service_period_start date NOT NULL,
  service_period_end date NOT NULL,
  is_out_of_scope boolean NOT NULL DEFAULT false,
  outside_scope_reason text,
  internal_notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_service_usage_type_check
    CHECK (usage_type IN (
      'support',
      'small_fix',
      'review',
      'report',
      'incident_response',
      'consultation',
      'other'
    )),
  CONSTRAINT operations_client_service_usage_description_check
    CHECK (length(trim(description)) > 0),
  CONSTRAINT operations_client_service_usage_allowance_check
    CHECK (
      (minutes_used IS NULL OR minutes_used >= 0)
      AND (fixes_used IS NULL OR fixes_used >= 0)
    )
);

CREATE INDEX IF NOT EXISTS operations_client_service_usage_service_period_idx
  ON operations_client_service_usage(client_service_id, service_period_start, occurred_at DESC);

CREATE INDEX IF NOT EXISTS operations_client_service_usage_business_idx
  ON operations_client_service_usage(business_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS operations_client_service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  review_started_at timestamptz NOT NULL DEFAULT now(),
  review_completed_at timestamptz,
  outcome text NOT NULL DEFAULT 'continue_unchanged',
  period_start date,
  period_end date,
  website_health_summary text,
  incidents_summary text,
  reports_summary text,
  work_completed_summary text,
  usage_summary text,
  outstanding_client_actions text,
  pricing_or_scope_notes text,
  renewal_recommendation text,
  next_review_at timestamptz,
  internal_notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_service_reviews_outcome_check
    CHECK (outcome IN (
      'continue_unchanged',
      'change_plan',
      'change_price',
      'add_remove_site',
      'quote_additional_work',
      'pause',
      'end_service'
    ))
);

CREATE INDEX IF NOT EXISTS operations_client_service_reviews_service_idx
  ON operations_client_service_reviews(client_service_id, review_started_at DESC);

CREATE TABLE IF NOT EXISTS operations_client_service_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  previous_plan_id uuid REFERENCES operations_service_plan_templates(id) ON DELETE SET NULL,
  new_plan_id uuid REFERENCES operations_service_plan_templates(id) ON DELETE SET NULL,
  effective_date date NOT NULL,
  change_summary text NOT NULL,
  reason text,
  client_agreed boolean NOT NULL DEFAULT false,
  previous_terms_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_terms_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_service_amendments_summary_check
    CHECK (length(trim(change_summary)) > 0)
);

CREATE INDEX IF NOT EXISTS operations_client_service_amendments_service_idx
  ON operations_client_service_amendments(client_service_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS operations_client_service_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_service_id uuid NOT NULL REFERENCES operations_client_services(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  source_uptime_incident_id uuid REFERENCES uptime_incidents(id) ON DELETE SET NULL,
  source_scan_run_id uuid REFERENCES scan_runs(id) ON DELETE SET NULL,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  review_state text NOT NULL DEFAULT 'new',
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  internal_notes text,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_client_service_incidents_title_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_client_service_incidents_severity_check
    CHECK (severity IN ('critical', 'warning', 'info')),
  CONSTRAINT operations_client_service_incidents_review_state_check
    CHECK (review_state IN (
      'new',
      'reviewing',
      'confirmed',
      'client_notified',
      'work_created',
      'resolved',
      'dismissed'
    ))
);

CREATE INDEX IF NOT EXISTS operations_client_service_incidents_service_state_idx
  ON operations_client_service_incidents(client_service_id, review_state, detected_at DESC);

CREATE INDEX IF NOT EXISTS operations_client_service_incidents_site_idx
  ON operations_client_service_incidents(site_id, review_state, detected_at DESC)
  WHERE site_id IS NOT NULL;

ALTER TABLE operations_communications
  ADD COLUMN IF NOT EXISTS client_service_id uuid REFERENCES operations_client_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_communications_client_service_idx
  ON operations_communications(client_service_id, occurred_at DESC)
  WHERE client_service_id IS NOT NULL;

ALTER TABLE operations_tasks
  ADD COLUMN IF NOT EXISTS source_client_service_id uuid REFERENCES operations_client_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_service_site_id uuid REFERENCES operations_client_service_sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_tasks_client_service_idx
  ON operations_tasks(source_client_service_id, status, due_at)
  WHERE source_client_service_id IS NOT NULL;

ALTER TABLE operations_reports
  ADD COLUMN IF NOT EXISTS client_service_id uuid REFERENCES operations_client_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_reports_client_service_idx
  ON operations_reports(client_service_id, status, updated_at DESC)
  WHERE client_service_id IS NOT NULL;

ALTER TABLE operations_quotes
  ADD COLUMN IF NOT EXISTS client_service_id uuid REFERENCES operations_client_services(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS operations_quotes_client_service_idx
  ON operations_quotes(client_service_id, status, updated_at DESC)
  WHERE client_service_id IS NOT NULL;

ALTER TABLE operations_work_orders
  ADD COLUMN IF NOT EXISTS client_service_id uuid REFERENCES operations_client_services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_coverage_classification text NOT NULL DEFAULT 'awaiting_assessment';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_work_orders_service_coverage_check'
  ) THEN
    ALTER TABLE operations_work_orders
      ADD CONSTRAINT operations_work_orders_service_coverage_check
      CHECK (service_coverage_classification IN (
        'included',
        'partially_included',
        'outside_scope',
        'goodwill',
        'awaiting_assessment'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS operations_work_orders_client_service_idx
  ON operations_work_orders(client_service_id, status, updated_at DESC)
  WHERE client_service_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_client_communication_templates_category_check'
  ) THEN
    ALTER TABLE operations_client_communication_templates
      DROP CONSTRAINT operations_client_communication_templates_category_check;
  END IF;
  ALTER TABLE operations_client_communication_templates
    ADD CONSTRAINT operations_client_communication_templates_category_check
    CHECK (category IN (
      'warm_introduction',
      'cold_outreach',
      'report_offer',
      'report_delivery',
      'no_reply_follow_up',
      'interested_reply',
      'pre_quote_questions',
      'quote_delivery',
      'access_request',
      'work_started',
      'work_completed',
      'monitoring_offer',
      'monthly_update',
      'testimonial_request',
      'referral_request',
      'managed_service_proposal',
      'service_activation',
      'monitoring_started',
      'monthly_report_delivery',
      'website_issue_notification',
      'client_action_required',
      'allowance_nearing_limit',
      'work_outside_plan',
      'service_review',
      'renewal_discussion',
      'service_paused',
      'cancellation_acknowledgement',
      'service_ended',
      'custom'
    ));
END $$;

INSERT INTO operations_service_plan_templates (
  name,
  code,
  description,
  plan_type,
  default_currency,
  default_price_minor,
  default_billing_cadence,
  default_scan_frequency,
  default_report_frequency,
  default_review_frequency,
  includes_uptime_monitoring,
  includes_issue_alerts,
  includes_monthly_report,
  includes_advice,
  includes_small_fixes,
  included_support_minutes,
  included_fix_count,
  response_target_text,
  scope_summary,
  included_scope,
  excluded_scope,
  is_active
)
SELECT *
FROM (
  VALUES
    (
      'Website Monitoring',
      'website_monitoring',
      'Scheduled monitoring, reviewed alerts and monthly website-health reporting.',
      'monitoring_only',
      'GBP',
      0,
      'monthly',
      'weekly',
      'monthly',
      'quarterly',
      true,
      true,
      true,
      true,
      false,
      NULL::integer,
      NULL::integer,
      'Reviewed during normal working days.',
      'Scheduled website health monitoring with monthly reviewed reports.',
      'Scheduled scans, uptime monitoring where available, issue review, monthly report and advice on detected issues.',
      'Fixes, redesign, hosting, paid third-party tools and development work are quoted separately.',
      true
    ),
    (
      'Monitoring and Support',
      'monitoring_support',
      'Monitoring plus a defined support allowance and limited small-fix help.',
      'monitoring_and_support',
      'GBP',
      0,
      'monthly',
      'weekly',
      'monthly',
      'quarterly',
      true,
      true,
      true,
      true,
      true,
      60,
      2,
      'Priority email support during normal working days.',
      'Monitoring, reporting and a defined support allowance.',
      'Everything in Website Monitoring plus priority email support, agreed advice time and limited small fixes.',
      'Larger changes, new functionality, redesign, hosting and paid third-party costs are quoted separately.',
      true
    ),
    (
      'Managed Website Care',
      'managed_website_care',
      'Proactive website care, monthly reports and a defined maintenance allowance.',
      'managed_care',
      'GBP',
      0,
      'monthly',
      'weekly',
      'monthly',
      'quarterly',
      true,
      true,
      true,
      true,
      true,
      120,
      4,
      'Priority response for agreed website-care work.',
      'Ongoing proactive website care with monitoring, review, reporting and agreed maintenance allowance.',
      'Scheduled monitoring, monthly reports, proactive review, defined small maintenance allowance and post-change re-testing.',
      'Redesign, new functionality, hosting, legal compliance, security testing and paid third-party costs are excluded unless separately agreed.',
      true
    ),
    (
      'Custom Managed Service',
      'custom_managed_service',
      'Editable managed-service plan requiring manual scope review.',
      'custom',
      'GBP',
      0,
      'custom',
      'custom',
      'custom',
      'custom',
      false,
      false,
      false,
      false,
      false,
      NULL::integer,
      NULL::integer,
      NULL::text,
      'Custom managed service requiring manual agreement.',
      'To be defined in the client-specific service agreement.',
      'No assumptions. Anything not explicitly included is excluded.',
      true
    )
) AS seed(
  name,
  code,
  description,
  plan_type,
  default_currency,
  default_price_minor,
  default_billing_cadence,
  default_scan_frequency,
  default_report_frequency,
  default_review_frequency,
  includes_uptime_monitoring,
  includes_issue_alerts,
  includes_monthly_report,
  includes_advice,
  includes_small_fixes,
  included_support_minutes,
  included_fix_count,
  response_target_text,
  scope_summary,
  included_scope,
  excluded_scope,
  is_active
)
WHERE NOT EXISTS (
  SELECT 1
  FROM operations_service_plan_templates existing
  WHERE existing.code = seed.code
);

INSERT INTO operations_client_communication_templates (
  system_key,
  name,
  category,
  subject_template,
  body_template,
  is_system_default
)
SELECT *
FROM (
  VALUES
    (
      'managed_service_proposal',
      'Managed-service proposal',
      'managed_service_proposal',
      'Managed website monitoring for {{businessName}}',
      'Hi {{firstName}},

I have prepared an ongoing managed website health service proposal for {{businessName}}.

The aim is to keep monitoring practical and reviewed, so important website problems can be spotted and acted on without treating every scanner finding as a confirmed client-facing issue.

Best,
{{senderName}}',
      true
    ),
    (
      'service_activation',
      'Service activation',
      'service_activation',
      'Website monitoring is active for {{businessName}}',
      'Hi {{firstName}},

Your agreed Scanlark managed website health service is now active.

I will review monitoring results, prepare agreed reports and contact you when something needs a practical decision or action.

Best,
{{senderName}}',
      true
    ),
    (
      'monthly_report_delivery',
      'Monthly monitoring report delivery',
      'monthly_report_delivery',
      'Monthly website health report for {{businessName}}',
      'Hi {{firstName}},

I have attached the latest reviewed website health report for {{businessName}}.

It summarises the important findings, work completed and recommended next actions for the monitoring period.

Best,
{{senderName}}',
      true
    ),
    (
      'website_issue_notification',
      'Reviewed website issue notification',
      'website_issue_notification',
      'Website issue to review for {{businessName}}',
      'Hi {{firstName}},

I have reviewed a website health item that may need attention for {{businessName}}.

Current observation:
{{topFinding}}

I recommend reviewing the next action before making any broad changes.

Best,
{{senderName}}',
      true
    ),
    (
      'client_action_required',
      'Client action required',
      'client_action_required',
      'Action needed for {{businessName}}',
      'Hi {{firstName}},

I need your input before I can move the current website work forward.

Please reply with the requested information when convenient.

Best,
{{senderName}}',
      true
    ),
    (
      'allowance_nearing_limit',
      'Allowance nearing limit',
      'allowance_nearing_limit',
      'Service allowance update for {{businessName}}',
      'Hi {{firstName}},

A current request may be close to the agreed service allowance for {{businessName}}.

I will confirm what is included before proceeding with anything that should be quoted separately.

Best,
{{senderName}}',
      true
    ),
    (
      'work_outside_plan',
      'Work outside plan',
      'work_outside_plan',
      'Additional website work for {{businessName}}',
      'Hi {{firstName}},

The requested work appears to sit outside the currently agreed managed-service scope.

I can prepare a separate quote before any extra work is started.

Best,
{{senderName}}',
      true
    ),
    (
      'service_review',
      'Service review',
      'service_review',
      'Service review for {{businessName}}',
      'Hi {{firstName}},

It is time to review the managed website service for {{businessName}}.

I will look at recent monitoring, reports, support usage and any changes needed for the next period.

Best,
{{senderName}}',
      true
    ),
    (
      'renewal_discussion',
      'Renewal discussion',
      'renewal_discussion',
      'Upcoming service renewal for {{businessName}}',
      'Hi {{firstName}},

Your managed website service renewal is approaching.

I will review the current arrangement and confirm whether any scope or pricing changes should be discussed.

Best,
{{senderName}}',
      true
    ),
    (
      'service_paused',
      'Service paused',
      'service_paused',
      'Managed service paused for {{businessName}}',
      'Hi {{firstName}},

The managed website service for {{businessName}} has been paused as agreed.

Historical reports and scan records remain available internally.

Best,
{{senderName}}',
      true
    ),
    (
      'cancellation_acknowledgement',
      'Cancellation acknowledgement',
      'cancellation_acknowledgement',
      'Managed service cancellation for {{businessName}}',
      'Hi {{firstName}},

I am confirming the cancellation request for the managed website service for {{businessName}}.

I will preserve historical reports and records internally according to the agreed operational process.

Best,
{{senderName}}',
      true
    ),
    (
      'service_ended',
      'Service ended',
      'service_ended',
      'Managed service ended for {{businessName}}',
      'Hi {{firstName}},

The managed website service for {{businessName}} has now ended.

No new routine managed-service monitoring obligations will be created after the end date.

Best,
{{senderName}}',
      true
    )
) AS seed(
  system_key,
  name,
  category,
  subject_template,
  body_template,
  is_system_default
)
WHERE NOT EXISTS (
  SELECT 1
  FROM operations_client_communication_templates existing
  WHERE existing.system_key = seed.system_key
);
