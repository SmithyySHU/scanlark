CREATE TABLE IF NOT EXISTS operations_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES operations_businesses(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE RESTRICT,
  scan_run_id uuid NOT NULL REFERENCES scan_runs(id) ON DELETE RESTRICT,
  prepared_contact_id uuid REFERENCES operations_contacts(id) ON DELETE SET NULL,
  supersedes_report_id uuid REFERENCES operations_reports(id) ON DELETE RESTRICT,
  comparison_report_id uuid REFERENCES operations_reports(id) ON DELETE RESTRICT,
  delivery_communication_id uuid REFERENCES operations_communications(id) ON DELETE SET NULL,
  follow_up_task_id uuid REFERENCES operations_tasks(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  report_type text NOT NULL DEFAULT 'initial_health_check',
  version_number integer NOT NULL DEFAULT 1,
  executive_summary text,
  overall_summary text,
  main_strengths text,
  main_concerns text,
  recommended_first_steps text,
  scope_limitations text,
  prepared_for text,
  prepared_by text,
  cover_date date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  sent_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  follow_up_at timestamptz,
  no_major_findings_waived boolean NOT NULL DEFAULT false,
  display_settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  frozen_render_json jsonb,
  frozen_at timestamptz,
  last_pdf_generated_at timestamptz,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_reports_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_reports_status_check
    CHECK (status IN (
      'draft',
      'needs_review',
      'ready_to_send',
      'sent',
      'client_replied',
      'fixes_quoted',
      'work_in_progress',
      'completed',
      'archived'
    )),
  CONSTRAINT operations_reports_type_check
    CHECK (report_type IN (
      'initial_health_check',
      'follow_up',
      'post_fix_retest',
      'monthly_monitoring',
      'incident',
      'custom'
    )),
  CONSTRAINT operations_reports_version_positive_check
    CHECK (version_number > 0)
);

CREATE INDEX IF NOT EXISTS operations_reports_business_status_idx
  ON operations_reports(business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_reports_site_idx
  ON operations_reports(site_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_reports_scan_run_idx
  ON operations_reports(scan_run_id);

CREATE INDEX IF NOT EXISTS operations_reports_type_status_idx
  ON operations_reports(report_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS operations_reports_sent_idx
  ON operations_reports(sent_at DESC)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_reports_follow_up_idx
  ON operations_reports(follow_up_at)
  WHERE follow_up_at IS NOT NULL
    AND status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress');

CREATE INDEX IF NOT EXISTS operations_reports_archived_idx
  ON operations_reports(archived_at, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS operations_reports_scan_version_idx
  ON operations_reports(business_id, site_id, scan_run_id, version_number);

CREATE TABLE IF NOT EXISTS operations_report_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_report_id uuid NOT NULL REFERENCES operations_reports(id) ON DELETE CASCADE,
  source_issue_id uuid REFERENCES scan_issues(id) ON DELETE SET NULL,
  source_link_id uuid REFERENCES scan_links(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_fingerprint text,
  category text NOT NULL,
  original_severity text NOT NULL,
  client_priority text NOT NULL,
  title text NOT NULL,
  technical_summary text,
  client_explanation text,
  why_it_matters text,
  recommended_action text,
  affected_url text,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_included boolean NOT NULL DEFAULT true,
  is_false_positive boolean NOT NULL DEFAULT false,
  internal_note text,
  display_order integer NOT NULL DEFAULT 0,
  estimated_effort text,
  comparison_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_findings_source_type_check
    CHECK (source_type IN ('scan_issue', 'scan_link', 'manual')),
  CONSTRAINT operations_report_findings_original_severity_check
    CHECK (original_severity IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT operations_report_findings_client_priority_check
    CHECK (client_priority IN ('critical', 'important', 'improvement', 'informational')),
  CONSTRAINT operations_report_findings_title_present_check
    CHECK (length(trim(title)) > 0),
  CONSTRAINT operations_report_findings_comparison_status_check
    CHECK (
      comparison_status IS NULL
      OR comparison_status IN (
        'resolved',
        'still_present',
        'improved',
        'worsened',
        'new',
        'unable_to_compare'
      )
    )
);

CREATE INDEX IF NOT EXISTS operations_report_findings_report_order_idx
  ON operations_report_findings(operations_report_id, display_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_report_findings_report_included_idx
  ON operations_report_findings(operations_report_id, is_included, is_false_positive);

CREATE INDEX IF NOT EXISTS operations_report_findings_priority_idx
  ON operations_report_findings(operations_report_id, client_priority);

CREATE INDEX IF NOT EXISTS operations_report_findings_source_issue_idx
  ON operations_report_findings(source_issue_id)
  WHERE source_issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_report_findings_fingerprint_idx
  ON operations_report_findings(operations_report_id, source_fingerprint)
  WHERE source_fingerprint IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_report_comparison_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_report_id uuid NOT NULL REFERENCES operations_reports(id) ON DELETE CASCADE,
  original_finding_id uuid REFERENCES operations_report_findings(id) ON DELETE SET NULL,
  current_finding_id uuid REFERENCES operations_report_findings(id) ON DELETE SET NULL,
  source_fingerprint text,
  comparison_status text NOT NULL,
  summary text,
  manual_note text,
  is_manually_overridden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_comparison_items_status_check
    CHECK (comparison_status IN (
      'resolved',
      'still_present',
      'improved',
      'worsened',
      'new',
      'unable_to_compare'
    ))
);

CREATE INDEX IF NOT EXISTS operations_report_comparison_items_report_idx
  ON operations_report_comparison_items(operations_report_id, comparison_status, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_report_comparison_items_fingerprint_idx
  ON operations_report_comparison_items(operations_report_id, source_fingerprint)
  WHERE source_fingerprint IS NOT NULL;
