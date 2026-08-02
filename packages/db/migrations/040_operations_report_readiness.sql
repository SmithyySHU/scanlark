ALTER TABLE operations_reports
  ADD COLUMN IF NOT EXISTS last_preview_generated_at timestamptz;

ALTER TABLE operations_report_positive_observations
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE operations_report_action_plan_items
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS operations_report_pdf_renders (
  operations_report_id uuid PRIMARY KEY REFERENCES operations_reports(id) ON DELETE CASCADE,
  filename text NOT NULL,
  pdf_bytes bytea NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_pdf_renders_filename_present_check
    CHECK (length(trim(filename)) > 0),
  CONSTRAINT operations_report_pdf_renders_bytes_present_check
    CHECK (octet_length(pdf_bytes) > 0)
);

INSERT INTO operations_report_positive_observations (
  operations_report_id,
  title,
  description,
  source_key,
  is_included,
  display_order
)
SELECT
  r.id,
  'Website was reachable during the scan',
  'Scanlark completed a review of publicly accessible pages for this website.',
  'scan_completed',
  true,
  0
FROM operations_reports r
JOIN scan_runs sr ON sr.id = r.scan_run_id
WHERE sr.status = 'completed'
  AND sr.finished_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM operations_report_positive_observations o
    WHERE o.operations_report_id = r.id
      AND o.source_key = 'scan_completed'
  );

INSERT INTO operations_report_positive_observations (
  operations_report_id,
  title,
  description,
  source_key,
  is_included,
  display_order
)
SELECT
  r.id,
  'HTTPS is active',
  'The reviewed website address uses HTTPS, which helps protect normal visitor browsing sessions.',
  'https_active',
  true,
  1
FROM operations_reports r
WHERE EXISTS (
    SELECT 1
    FROM scan_site_checks sc
    WHERE sc.scan_run_id = r.scan_run_id
      AND sc.check_type = 'https_root'
      AND sc.ok = true
  )
  AND NOT EXISTS (
    SELECT 1
    FROM operations_report_positive_observations o
    WHERE o.operations_report_id = r.id
      AND o.source_key = 'https_active'
  );

INSERT INTO operations_report_action_plan_items (
  operations_report_id,
  report_finding_id,
  group_key,
  title,
  summary,
  is_included,
  display_order
)
SELECT
  f.operations_report_id,
  f.id,
  CASE
    WHEN f.client_priority = 'critical' THEN 'address_now'
    WHEN f.client_priority = 'important' THEN 'address_soon'
    ELSE 'consider_later'
  END,
  f.title,
  f.recommended_action,
  true,
  f.display_order
FROM operations_report_findings f
WHERE NOT EXISTS (
  SELECT 1
  FROM operations_report_action_plan_items item
  WHERE item.operations_report_id = f.operations_report_id
    AND item.report_finding_id = f.id
);
