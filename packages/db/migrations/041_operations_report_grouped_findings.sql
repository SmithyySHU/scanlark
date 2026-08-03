ALTER TABLE operations_report_findings
  ADD COLUMN IF NOT EXISTS group_key text,
  ADD COLUMN IF NOT EXISTS group_label text,
  ADD COLUMN IF NOT EXISTS source_issue_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS affected_page_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affected_resource_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS representative_examples_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS requires_merge_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regrouped_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'operations_report_findings_group_counts_check'
  ) THEN
    ALTER TABLE operations_report_findings
      ADD CONSTRAINT operations_report_findings_group_counts_check
        CHECK (
          source_issue_count >= 0
          AND occurrence_count >= 0
          AND affected_page_count >= 0
          AND affected_resource_count >= 0
        );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS operations_report_findings_group_key_idx
  ON operations_report_findings(operations_report_id, group_key)
  WHERE group_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS operations_report_finding_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_report_id uuid NOT NULL REFERENCES operations_reports(id) ON DELETE CASCADE,
  report_finding_id uuid NOT NULL REFERENCES operations_report_findings(id) ON DELETE CASCADE,
  source_issue_id uuid REFERENCES scan_issues(id) ON DELETE SET NULL,
  source_link_id uuid REFERENCES scan_links(id) ON DELETE SET NULL,
  source_kind text NOT NULL,
  affected_page_url text,
  affected_resource_url text,
  outcome_key text,
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  reviewed_for_client boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operations_report_finding_sources_kind_check
    CHECK (source_kind IN ('scan_issue', 'scan_link', 'manual'))
);

CREATE INDEX IF NOT EXISTS operations_report_finding_sources_report_idx
  ON operations_report_finding_sources(operations_report_id, report_finding_id, display_order ASC);

CREATE INDEX IF NOT EXISTS operations_report_finding_sources_issue_idx
  ON operations_report_finding_sources(source_issue_id)
  WHERE source_issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS operations_report_finding_sources_link_idx
  ON operations_report_finding_sources(source_link_id)
  WHERE source_link_id IS NOT NULL;

INSERT INTO operations_report_finding_sources (
  operations_report_id,
  report_finding_id,
  source_issue_id,
  source_link_id,
  source_kind,
  affected_page_url,
  affected_resource_url,
  outcome_key,
  evidence_json,
  display_order,
  reviewed_for_client
)
SELECT
  f.operations_report_id,
  f.id,
  f.source_issue_id,
  f.source_link_id,
  f.source_type,
  COALESCE(NULLIF(f.evidence_json->>'sourceUrl', ''), f.affected_url),
  f.affected_url,
  COALESCE(NULLIF(f.evidence_json->>'issueType', ''), f.category),
  f.evidence_json,
  0,
  f.reviewed_at IS NOT NULL
FROM operations_report_findings f
WHERE NOT EXISTS (
  SELECT 1
  FROM operations_report_finding_sources s
  WHERE s.report_finding_id = f.id
);
