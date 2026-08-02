ALTER TABLE operations_report_findings
  ADD COLUMN IF NOT EXISTS client_evidence text,
  ADD COLUMN IF NOT EXISTS affected_url_note text,
  ADD COLUMN IF NOT EXISTS false_positive_reason text,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS operations_report_positive_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_report_id uuid NOT NULL REFERENCES operations_reports(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  source_key text,
  is_included boolean NOT NULL DEFAULT true,
  reviewed_at timestamptz,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_positive_observations_title_present_check
    CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS operations_report_positive_observations_report_idx
  ON operations_report_positive_observations(operations_report_id, display_order ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS operations_report_action_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_report_id uuid NOT NULL REFERENCES operations_reports(id) ON DELETE CASCADE,
  report_finding_id uuid REFERENCES operations_report_findings(id) ON DELETE SET NULL,
  group_key text NOT NULL,
  title text NOT NULL,
  summary text,
  is_included boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_action_plan_items_group_check
    CHECK (group_key IN ('address_now', 'address_soon', 'consider_later')),
  CONSTRAINT operations_report_action_plan_items_title_present_check
    CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS operations_report_action_plan_items_report_idx
  ON operations_report_action_plan_items(operations_report_id, group_key, display_order ASC, created_at ASC);

CREATE INDEX IF NOT EXISTS operations_report_action_plan_items_finding_idx
  ON operations_report_action_plan_items(report_finding_id)
  WHERE report_finding_id IS NOT NULL;
