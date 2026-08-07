BEGIN;

-- Fail closed before installing any contract object. No historical content is
-- reconstructed or changed by this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM operations_reports
    WHERE status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed')
      AND (sent_at IS NULL OR frozen_at IS NULL OR frozen_render_json IS NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'report';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_quotes
    WHERE (status = 'sent' AND (sent_at IS NULL OR frozen_at IS NULL OR frozen_render_json IS NULL))
       OR (status IN ('accepted', 'converted_to_work') AND (accepted_at IS NULL OR frozen_at IS NULL OR frozen_render_json IS NULL))
       OR (status = 'declined' AND declined_at IS NULL)
       OR (status = 'expired' AND expired_at IS NULL)
       OR (status = 'cancelled' AND cancelled_at IS NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'quote';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_communications
    WHERE (status = 'sent' AND sent_at IS NULL)
       OR (status = 'received' AND received_at IS NULL)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'communication';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_communications c
    WHERE c.status = 'sent' AND c.channel = 'email'
      AND c.template_snapshot_json ? 'operationsEmail'
      AND (c.html_document IS NULL OR c.plain_text_body IS NULL
        OR c.external_message_id IS NULL OR c.sender_email IS NULL OR c.recipient_email IS NULL)
  ) OR EXISTS (
    SELECT 1 FROM operations_communications c
    WHERE c.status = 'sent' AND c.template_snapshot_json ? 'operationsEmail'
      AND NOT EXISTS (
        SELECT 1 FROM operations_email_crm_finalisations f
        WHERE f.sent_communication_id = c.id AND f.status = 'finalised'
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'operations_email_communication';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_quotes q
    WHERE q.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
      AND (EXISTS (
        SELECT 1 FROM operations_quote_items i
        WHERE i.quote_id = q.id AND i.line_total_minor <> i.quantity * i.unit_price_minor
      ) OR q.total_minor <> GREATEST(0, q.subtotal_minor - q.discount_minor) + q.tax_minor)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'quote_totals';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_reports r
    WHERE r.status IN ('draft', 'needs_review', 'ready_to_send')
      AND EXISTS (
        SELECT 1 FROM admin_audit_log a
        WHERE a.target_type = 'operations_report' AND a.target_id = r.id::text
          AND a.action IN ('operations_report_sent', 'operations_report_status_sent')
      )
  ) OR EXISTS (
    SELECT 1 FROM operations_quotes q
    WHERE q.status IN ('draft', 'needs_review', 'ready_to_send')
      AND EXISTS (
        SELECT 1 FROM operations_quote_status_history h
        WHERE h.quote_id = q.id AND h.new_status IN ('sent', 'accepted', 'converted_to_work')
      )
  ) OR EXISTS (
    SELECT 1 FROM operations_communications c
    WHERE c.status IN ('draft', 'ready', 'cancelled')
      AND EXISTS (
        SELECT 1 FROM admin_audit_log a
        WHERE a.target_type = 'operations_communication' AND a.target_id = c.id::text
          AND a.action IN ('operations.communication.mark_sent', 'operations.communication.mark_received')
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'lifecycle_regression';
  END IF;

  IF EXISTS (
    SELECT 1 FROM operations_report_pdf_renders
    WHERE size_bytes <> octet_length(pdf_bytes)
       OR sha256 <> encode(digest(pdf_bytes, 'sha256'), 'hex')
  ) OR EXISTS (
    SELECT 1 FROM operations_quote_pdf_renders
    WHERE size_bytes <> octet_length(pdf_bytes)
       OR sha256 <> encode(digest(pdf_bytes, 'sha256'), 'hex')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_historical_evidence_required', DETAIL = 'pdf_hash';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM operations_reports child
    LEFT JOIN operations_reports source ON source.id = child.supersedes_report_id
    WHERE child.supersedes_report_id IS NOT NULL
      AND (source.id IS NULL OR source.id = child.id OR source.business_id <> child.business_id
        OR source.site_id <> child.site_id OR source.scan_run_id <> child.scan_run_id
        OR child.version_number <> source.version_number + 1)
  ) OR EXISTS (
    SELECT 1 FROM operations_reports
    WHERE supersedes_report_id IS NOT NULL
    GROUP BY supersedes_report_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_revision_lineage_conflict', DETAIL = 'report';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM operations_quotes child
    LEFT JOIN operations_quotes source ON source.id = child.supersedes_quote_id
    WHERE child.supersedes_quote_id IS NOT NULL
      AND (source.id IS NULL OR source.id = child.id OR source.business_id <> child.business_id
        OR source.revision_series_id <> child.revision_series_id
        OR child.revision_number <> source.revision_number + 1)
  ) OR EXISTS (
    SELECT 1 FROM operations_quotes
    WHERE supersedes_quote_id IS NOT NULL
    GROUP BY supersedes_quote_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_revision_lineage_conflict', DETAIL = 'quote';
  END IF;
END $$;

ALTER TABLE operations_reports
  ADD CONSTRAINT operations_reports_historical_evidence_check
  CHECK (
    status NOT IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed')
    OR (sent_at IS NOT NULL AND frozen_at IS NOT NULL AND frozen_render_json IS NOT NULL)
  );

ALTER TABLE operations_quotes
  ADD CONSTRAINT operations_quotes_historical_evidence_check
  CHECK (
    (status <> 'sent' OR (sent_at IS NOT NULL AND frozen_at IS NOT NULL AND frozen_render_json IS NOT NULL))
    AND (status NOT IN ('accepted', 'converted_to_work') OR (accepted_at IS NOT NULL AND frozen_at IS NOT NULL AND frozen_render_json IS NOT NULL))
    AND (status <> 'declined' OR declined_at IS NOT NULL)
    AND (status <> 'expired' OR expired_at IS NOT NULL)
    AND (status <> 'cancelled' OR cancelled_at IS NOT NULL)
  );

ALTER TABLE operations_report_pdf_renders
  ADD CONSTRAINT operations_report_pdf_renders_bytes_sha256_check
  CHECK (sha256 = encode(digest(pdf_bytes, 'sha256'), 'hex'));

ALTER TABLE operations_quote_pdf_renders
  ADD CONSTRAINT operations_quote_pdf_renders_bytes_sha256_check
  CHECK (sha256 = encode(digest(pdf_bytes, 'sha256'), 'hex'));

CREATE OR REPLACE FUNCTION scanlark_b4_report_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_rank integer;
  new_rank integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed', 'archived') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed', 'archived') THEN
    IF (to_jsonb(NEW) - ARRAY['status','completed_at','archived_at','follow_up_at','follow_up_task_id','last_preview_generated_at','updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','completed_at','archived_at','follow_up_at','follow_up_task_id','last_preview_generated_at','updated_at']) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report';
    END IF;
    old_rank := array_position(ARRAY['sent','client_replied','fixes_quoted','work_in_progress','completed','archived'], OLD.status);
    new_rank := array_position(ARRAY['sent','client_replied','fixes_quoted','work_in_progress','completed','archived'], NEW.status);
    IF new_rank IS NULL OR new_rank < old_rank THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_invalid_lifecycle_transition', DETAIL = 'report';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_quote_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'quote';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work') THEN
    IF (to_jsonb(NEW) - ARRAY['status','accepted_at','declined_at','expired_at','cancelled_at','converted_work_order_id','updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['status','accepted_at','declined_at','expired_at','cancelled_at','converted_work_order_id','updated_at']) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'quote';
    END IF;
    IF NEW.status <> OLD.status AND NOT (
      (OLD.status = 'sent' AND NEW.status IN ('accepted', 'declined', 'expired', 'cancelled'))
      OR (OLD.status = 'accepted' AND NEW.status = 'converted_to_work')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_invalid_lifecycle_transition', DETAIL = 'quote';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_communication_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('sent', 'received') THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'communication';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.status IN ('sent', 'received') THEN
    IF (to_jsonb(NEW) - ARRAY['follow_up_at','follow_up_completed_at','updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['follow_up_at','follow_up_completed_at','updated_at']) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'communication';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_report_child_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.operations_report_id ELSE NEW.operations_report_id END;
  IF EXISTS (SELECT 1 FROM operations_reports WHERE id = parent_id AND status IN ('sent','client_replied','fixes_quoted','work_in_progress','completed','archived')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report_child';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.operations_report_id <> NEW.operations_report_id
     AND EXISTS (SELECT 1 FROM operations_reports WHERE id = OLD.operations_report_id AND status IN ('sent','client_replied','fixes_quoted','work_in_progress','completed','archived')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report_child';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_quote_child_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END;
  IF EXISTS (SELECT 1 FROM operations_quotes WHERE id = parent_id AND status IN ('sent','accepted','declined','expired','cancelled','converted_to_work')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'quote_child';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.quote_id <> NEW.quote_id
     AND EXISTS (SELECT 1 FROM operations_quotes WHERE id = OLD.quote_id AND status IN ('sent','accepted','declined','expired','cancelled','converted_to_work')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'quote_child';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_report_render_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.operations_report_id ELSE NEW.operations_report_id END;
  IF EXISTS (SELECT 1 FROM operations_reports WHERE id = parent_id AND status IN ('sent','client_replied','fixes_quoted','work_in_progress','completed','archived')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'report_render';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_quote_render_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.operations_quote_id ELSE NEW.operations_quote_id END;
  IF EXISTS (SELECT 1 FROM operations_quotes WHERE id = parent_id AND status IN ('sent','accepted','declined','expired','cancelled','converted_to_work')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_artifact_immutable', DETAIL = 'quote_render';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_report_lineage_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source operations_reports%ROWTYPE;
BEGIN
  IF NEW.supersedes_report_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO source FROM operations_reports WHERE id = NEW.supersedes_report_id;
  IF NOT FOUND OR source.id = NEW.id OR source.business_id <> NEW.business_id
     OR source.site_id <> NEW.site_id OR source.scan_run_id <> NEW.scan_run_id
     OR NEW.version_number <> source.version_number + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_revision_lineage_conflict', DETAIL = 'report';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION scanlark_b4_quote_lineage_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source operations_quotes%ROWTYPE;
BEGIN
  IF NEW.supersedes_quote_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO source FROM operations_quotes WHERE id = NEW.supersedes_quote_id;
  IF NOT FOUND OR source.id = NEW.id OR source.business_id <> NEW.business_id
     OR source.revision_series_id <> NEW.revision_series_id
     OR NEW.revision_number <> source.revision_number + 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scanlark_revision_lineage_conflict', DETAIL = 'quote';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER operations_reports_historical_guard
BEFORE UPDATE OR DELETE ON operations_reports
FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_guard();

CREATE TRIGGER operations_quotes_historical_guard
BEFORE UPDATE OR DELETE ON operations_quotes
FOR EACH ROW EXECUTE FUNCTION scanlark_b4_quote_guard();

CREATE TRIGGER operations_communications_historical_guard
BEFORE UPDATE OR DELETE ON operations_communications
FOR EACH ROW EXECUTE FUNCTION scanlark_b4_communication_guard();

CREATE TRIGGER operations_report_findings_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_findings FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_child_guard();
CREATE TRIGGER operations_report_finding_sources_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_finding_sources FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_child_guard();
CREATE TRIGGER operations_report_positive_observations_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_positive_observations FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_child_guard();
CREATE TRIGGER operations_report_action_plan_items_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_action_plan_items FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_child_guard();
CREATE TRIGGER operations_report_comparison_items_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_comparison_items FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_child_guard();

CREATE TRIGGER operations_quote_items_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_quote_items FOR EACH ROW EXECUTE FUNCTION scanlark_b4_quote_child_guard();
CREATE TRIGGER operations_quote_access_requirements_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_quote_access_requirements FOR EACH ROW EXECUTE FUNCTION scanlark_b4_quote_child_guard();

CREATE TRIGGER operations_report_pdf_renders_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_report_pdf_renders FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_render_guard();
CREATE TRIGGER operations_quote_pdf_renders_historical_guard BEFORE INSERT OR UPDATE OR DELETE ON operations_quote_pdf_renders FOR EACH ROW EXECUTE FUNCTION scanlark_b4_quote_render_guard();

CREATE TRIGGER operations_reports_lineage_guard
BEFORE INSERT OR UPDATE OF supersedes_report_id, business_id, site_id, scan_run_id, version_number
ON operations_reports FOR EACH ROW EXECUTE FUNCTION scanlark_b4_report_lineage_guard();

CREATE TRIGGER operations_quotes_lineage_guard
BEFORE INSERT OR UPDATE OF supersedes_quote_id, business_id, revision_series_id, revision_number
ON operations_quotes FOR EACH ROW EXECUTE FUNCTION scanlark_b4_quote_lineage_guard();

CREATE UNIQUE INDEX operations_reports_one_successor_idx
  ON operations_reports(supersedes_report_id) WHERE supersedes_report_id IS NOT NULL;

CREATE UNIQUE INDEX operations_quotes_one_successor_idx
  ON operations_quotes(supersedes_quote_id) WHERE supersedes_quote_id IS NOT NULL;

COMMIT;
