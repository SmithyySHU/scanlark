BEGIN;

-- Preserve intentional non-client classifications when an existing finding is
-- brought into line with its source dispositions. Explicit operator actions
-- still replace these states through the application repository immediately
-- after changing the finding inclusion flag.
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
        WHEN NEW.is_included = false
          AND disposition.disposition IN ('manual_verification_required', 'internal_system_only')
          THEN disposition.disposition
        WHEN NEW.is_included = false THEN 'excluded_by_operator'
        WHEN source_count > 1 THEN 'grouped_into_client_finding'
        ELSE 'included_client_finding'
      END,
      reason = CASE
        WHEN NEW.is_false_positive THEN
          COALESCE(NULLIF(trim(NEW.false_positive_reason), ''), 'Operator marked the report finding as a false positive.')
        WHEN NEW.is_included = false
          AND disposition.disposition IN ('manual_verification_required', 'internal_system_only')
          THEN disposition.reason
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

CREATE TEMP TABLE scanlark_058_repaired_reports (
  report_id uuid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO scanlark_058_repaired_reports (report_id)
SELECT DISTINCT finding.operations_report_id
FROM operations_report_findings finding
JOIN operations_reports report ON report.id = finding.operations_report_id
WHERE report.status IN ('draft', 'needs_review', 'ready_to_send')
  AND finding.is_included = true
  AND finding.is_false_positive = false
  AND EXISTS (
    SELECT 1
    FROM operations_report_finding_sources source
    JOIN operations_report_source_dispositions disposition
      ON disposition.report_finding_source_id = source.id
    WHERE source.report_finding_id = finding.id
      AND disposition.disposition IN ('manual_verification_required', 'internal_system_only')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM operations_report_finding_sources source
    LEFT JOIN operations_report_source_dispositions disposition
      ON disposition.report_finding_source_id = source.id
    WHERE source.report_finding_id = finding.id
      AND (
        disposition.report_finding_source_id IS NULL
        OR disposition.disposition NOT IN ('manual_verification_required', 'internal_system_only')
      )
  );

UPDATE operations_report_findings finding
SET is_included = false,
    updated_at = now()
WHERE finding.operations_report_id IN (
    SELECT report_id FROM scanlark_058_repaired_reports
  )
  AND finding.is_included = true
  AND finding.is_false_positive = false
  AND EXISTS (
    SELECT 1
    FROM operations_report_finding_sources source
    JOIN operations_report_source_dispositions disposition
      ON disposition.report_finding_source_id = source.id
    WHERE source.report_finding_id = finding.id
      AND disposition.disposition IN ('manual_verification_required', 'internal_system_only')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM operations_report_finding_sources source
    LEFT JOIN operations_report_source_dispositions disposition
      ON disposition.report_finding_source_id = source.id
    WHERE source.report_finding_id = finding.id
      AND (
        disposition.report_finding_source_id IS NULL
        OR disposition.disposition NOT IN ('manual_verification_required', 'internal_system_only')
      )
  );

DELETE FROM operations_report_pdf_renders render
WHERE render.operations_report_id IN (
  SELECT report_id FROM scanlark_058_repaired_reports
);

UPDATE operations_reports report
SET status = CASE
      WHEN report.status = 'ready_to_send' THEN 'needs_review'
      ELSE report.status
    END,
    content_revision = report.content_revision + 1,
    frozen_render_json = NULL,
    frozen_at = NULL,
    last_preview_generated_at = NULL,
    last_pdf_generated_at = NULL,
    approved_at = NULL,
    approved_by_user_id = NULL,
    approved_content_revision = NULL,
    updated_at = now()
WHERE report.id IN (
  SELECT report_id FROM scanlark_058_repaired_reports
);

COMMIT;
