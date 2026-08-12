BEGIN;

CREATE TABLE IF NOT EXISTS operations_report_source_dispositions (
  report_finding_source_id uuid PRIMARY KEY
    REFERENCES operations_report_finding_sources(id) ON DELETE CASCADE,
  operations_report_id uuid NOT NULL
    REFERENCES operations_reports(id) ON DELETE CASCADE,
  source_issue_id uuid NOT NULL
    REFERENCES scan_issues(id) ON DELETE RESTRICT,
  disposition text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_source_dispositions_state_check
    CHECK (disposition IN (
      'included_client_finding',
      'grouped_into_client_finding',
      'manual_verification_required',
      'excluded_by_operator',
      'false_positive',
      'internal_system_only'
    )),
  CONSTRAINT operations_report_source_dispositions_reason_present_check
    CHECK (length(trim(reason)) > 0),
  CONSTRAINT operations_report_source_dispositions_report_issue_unique
    UNIQUE (operations_report_id, source_issue_id)
);

CREATE INDEX IF NOT EXISTS operations_report_source_dispositions_report_state_idx
  ON operations_report_source_dispositions(operations_report_id, disposition);

WITH source_counts AS (
  SELECT report_finding_id, COUNT(*)::int AS source_count
  FROM operations_report_finding_sources
  WHERE source_issue_id IS NOT NULL
  GROUP BY report_finding_id
)
INSERT INTO operations_report_source_dispositions (
  report_finding_source_id,
  operations_report_id,
  source_issue_id,
  disposition,
  reason
)
SELECT
  source.id,
  source.operations_report_id,
  source.source_issue_id,
  CASE
    WHEN finding.is_false_positive THEN 'false_positive'
    WHEN issue.issue_type IN ('blocked_link', 'no_response')
      THEN 'manual_verification_required'
    WHEN issue.issue_type = 'ignored_safety_skip'
      THEN 'internal_system_only'
    WHEN finding.is_included = false THEN 'excluded_by_operator'
    WHEN counts.source_count > 1 THEN 'grouped_into_client_finding'
    ELSE 'included_client_finding'
  END,
  CASE
    WHEN finding.is_false_positive THEN
      COALESCE(NULLIF(trim(finding.false_positive_reason), ''), 'Operator marked the report finding as a false positive.')
    WHEN issue.issue_type IN ('blocked_link', 'no_response')
      THEN 'The automated request could not confirm that the destination is broken; manual verification is required.'
    WHEN issue.issue_type = 'ignored_safety_skip'
      THEN 'The URL was intentionally skipped by passive crawler safety rules.'
    WHEN finding.is_included = false THEN 'Operator excluded the report finding from client output.'
    WHEN counts.source_count > 1 THEN 'Represented by a grouped client finding with complete source membership.'
    ELSE 'Represented directly by an included client finding.'
  END
FROM operations_report_finding_sources source
JOIN operations_report_findings finding ON finding.id = source.report_finding_id
JOIN scan_issues issue ON issue.id = source.source_issue_id
JOIN source_counts counts ON counts.report_finding_id = source.report_finding_id
ON CONFLICT (report_finding_source_id) DO NOTHING;

CREATE OR REPLACE FUNCTION scanlark_sync_report_source_dispositions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_count integer;
BEGIN
  SELECT COUNT(*)::int INTO source_count
  FROM operations_report_finding_sources
  WHERE report_finding_id = NEW.id
    AND source_issue_id IS NOT NULL;

  UPDATE operations_report_source_dispositions disposition
  SET disposition = CASE
        WHEN NEW.is_false_positive THEN 'false_positive'
        WHEN NEW.is_included = false THEN 'excluded_by_operator'
        WHEN source_count > 1 THEN 'grouped_into_client_finding'
        ELSE 'included_client_finding'
      END,
      reason = CASE
        WHEN NEW.is_false_positive THEN
          COALESCE(NULLIF(trim(NEW.false_positive_reason), ''), 'Operator marked the report finding as a false positive.')
        WHEN NEW.is_included = false THEN 'Operator excluded the report finding from client output.'
        WHEN source_count > 1 THEN 'Represented by a grouped client finding with complete source membership.'
        ELSE 'Represented directly by an included client finding.'
      END,
      updated_at = now()
  FROM operations_report_finding_sources source
  WHERE source.id = disposition.report_finding_source_id
    AND source.report_finding_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS operations_report_findings_source_disposition_sync
  ON operations_report_findings;
CREATE TRIGGER operations_report_findings_source_disposition_sync
  AFTER UPDATE OF is_included, is_false_positive, false_positive_reason
  ON operations_report_findings
  FOR EACH ROW
  WHEN (
    OLD.is_included IS DISTINCT FROM NEW.is_included
    OR OLD.is_false_positive IS DISTINCT FROM NEW.is_false_positive
    OR OLD.false_positive_reason IS DISTINCT FROM NEW.false_positive_reason
  )
  EXECUTE FUNCTION scanlark_sync_report_source_dispositions();

CREATE OR REPLACE FUNCTION scanlark_report_source_disposition_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.operations_report_id ELSE NEW.operations_report_id END;
  IF EXISTS (
    SELECT 1 FROM operations_reports
    WHERE id = parent_id
      AND status IN ('sent','client_replied','fixes_quoted','work_in_progress','completed','archived')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report_source_disposition';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

DROP TRIGGER IF EXISTS operations_report_source_dispositions_historical_guard
  ON operations_report_source_dispositions;
CREATE TRIGGER operations_report_source_dispositions_historical_guard
  BEFORE INSERT OR UPDATE OR DELETE ON operations_report_source_dispositions
  FOR EACH ROW EXECUTE FUNCTION scanlark_report_source_disposition_guard();

COMMIT;
