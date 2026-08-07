\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION READ ONLY;

SELECT 'report_status' AS summary, status, COUNT(*)::bigint AS record_count
FROM operations_reports
WHERE status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed', 'archived')
GROUP BY status
ORDER BY status;

SELECT 'quote_status' AS summary, status, COUNT(*)::bigint AS record_count
FROM operations_quotes
WHERE status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
GROUP BY status
ORDER BY status;

SELECT 'communication_status' AS summary, status, COUNT(*)::bigint AS record_count
FROM operations_communications
WHERE status IN ('sent', 'received')
GROUP BY status
ORDER BY status;

WITH issues AS (
  SELECT 'report'::text AS artifact, 'missing_sent_or_frozen_evidence'::text AS issue,
         'MANUAL_REVIEW_REQUIRED'::text AS classification, r.id
  FROM operations_reports r
  WHERE r.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed')
    AND (r.sent_at IS NULL OR r.frozen_at IS NULL OR r.frozen_render_json IS NULL)
  UNION ALL
  SELECT 'report_pdf', 'pdf_bytes_or_hash_mismatch', 'BLOCKING_CORRUPTION', p.operations_report_id
  FROM operations_report_pdf_renders p
  JOIN operations_reports r ON r.id = p.operations_report_id
  WHERE r.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed', 'archived')
    AND (octet_length(p.pdf_bytes) <> p.size_bytes
      OR encode(digest(p.pdf_bytes, 'sha256'), 'hex') <> p.sha256)
  UNION ALL
  SELECT 'report', 'historical_report_reopened', 'BLOCKING_CORRUPTION', r.id
  FROM operations_reports r
  WHERE r.status IN ('draft', 'needs_review', 'ready_to_send')
    AND EXISTS (
      SELECT 1 FROM admin_audit_log a
      WHERE a.target_type = 'operations_report' AND a.target_id = r.id::text
        AND a.action IN ('operations_report_sent', 'operations_report_status_sent')
    )
  UNION ALL
  SELECT 'report', 'invalid_revision_lineage', 'BLOCKING_CORRUPTION', r.id
  FROM operations_reports r
  LEFT JOIN operations_reports source ON source.id = r.supersedes_report_id
  WHERE r.supersedes_report_id IS NOT NULL
    AND (source.id IS NULL OR source.id = r.id OR source.business_id <> r.business_id
      OR source.site_id <> r.site_id OR source.scan_run_id <> r.scan_run_id
      OR r.version_number <> source.version_number + 1)
  UNION ALL
  SELECT 'report', 'branched_revision_lineage', 'BLOCKING_CORRUPTION', child.supersedes_report_id
  FROM operations_reports child
  WHERE child.supersedes_report_id IS NOT NULL
  GROUP BY child.supersedes_report_id
  HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'quote', 'missing_sent_evidence', 'MANUAL_REVIEW_REQUIRED', q.id
  FROM operations_quotes q
  WHERE q.status = 'sent'
    AND (q.sent_at IS NULL OR q.frozen_at IS NULL OR q.frozen_render_json IS NULL)
  UNION ALL
  SELECT 'quote', 'missing_accepted_evidence', 'MANUAL_REVIEW_REQUIRED', q.id
  FROM operations_quotes q
  WHERE q.status IN ('accepted', 'converted_to_work')
    AND (q.accepted_at IS NULL OR q.frozen_at IS NULL OR q.frozen_render_json IS NULL)
  UNION ALL
  SELECT 'quote', 'missing_lifecycle_timestamp', 'MANUAL_REVIEW_REQUIRED', q.id
  FROM operations_quotes q
  WHERE (q.status = 'declined' AND q.declined_at IS NULL)
     OR (q.status = 'expired' AND q.expired_at IS NULL)
     OR (q.status = 'cancelled' AND q.cancelled_at IS NULL)
  UNION ALL
  SELECT 'quote', 'inconsistent_line_or_quote_totals', 'BLOCKING_CORRUPTION', q.id
  FROM operations_quotes q
  WHERE q.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
    AND (
      EXISTS (SELECT 1 FROM operations_quote_items i WHERE i.quote_id = q.id AND i.line_total_minor <> i.quantity * i.unit_price_minor)
      OR q.total_minor <> GREATEST(0, q.subtotal_minor - q.discount_minor) + q.tax_minor
    )
  UNION ALL
  SELECT 'quote_pdf', 'pdf_bytes_or_hash_mismatch', 'BLOCKING_CORRUPTION', p.operations_quote_id
  FROM operations_quote_pdf_renders p
  JOIN operations_quotes q ON q.id = p.operations_quote_id
  WHERE q.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
    AND (octet_length(p.pdf_bytes) <> p.size_bytes
      OR encode(digest(p.pdf_bytes, 'sha256'), 'hex') <> p.sha256)
  UNION ALL
  SELECT 'quote', 'historical_quote_reopened', 'BLOCKING_CORRUPTION', q.id
  FROM operations_quotes q
  WHERE q.status IN ('draft', 'needs_review', 'ready_to_send')
    AND EXISTS (
      SELECT 1 FROM operations_quote_status_history h
      WHERE h.quote_id = q.id AND h.new_status IN ('sent', 'accepted', 'converted_to_work')
    )
  UNION ALL
  SELECT 'quote', 'invalid_revision_lineage', 'BLOCKING_CORRUPTION', q.id
  FROM operations_quotes q
  LEFT JOIN operations_quotes source ON source.id = q.supersedes_quote_id
  WHERE q.supersedes_quote_id IS NOT NULL
    AND (source.id IS NULL OR source.id = q.id OR source.business_id <> q.business_id
      OR source.revision_series_id <> q.revision_series_id
      OR q.revision_number <> source.revision_number + 1)
  UNION ALL
  SELECT 'quote', 'branched_revision_lineage', 'BLOCKING_CORRUPTION', child.supersedes_quote_id
  FROM operations_quotes child
  WHERE child.supersedes_quote_id IS NOT NULL
  GROUP BY child.supersedes_quote_id
  HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'communication', 'missing_final_timestamp', 'BLOCKING_CORRUPTION', c.id
  FROM operations_communications c
  WHERE (c.status = 'sent' AND c.sent_at IS NULL)
     OR (c.status = 'received' AND c.received_at IS NULL)
  UNION ALL
  SELECT 'communication', 'email_final_evidence_incomplete', 'MANUAL_REVIEW_REQUIRED', c.id
  FROM operations_communications c
  WHERE c.status = 'sent' AND c.channel = 'email'
    AND c.template_snapshot_json ? 'operationsEmail'
    AND (c.html_document IS NULL OR c.plain_text_body IS NULL
      OR c.external_message_id IS NULL OR c.sender_email IS NULL OR c.recipient_email IS NULL)
  UNION ALL
  SELECT 'communication', 'operations_email_relationship_missing', 'BLOCKING_CORRUPTION', c.id
  FROM operations_communications c
  WHERE c.status = 'sent' AND c.template_snapshot_json ? 'operationsEmail'
    AND NOT EXISTS (
      SELECT 1
      FROM operations_email_crm_finalisations f
      WHERE f.sent_communication_id = c.id AND f.status = 'finalised'
    )
  UNION ALL
  SELECT 'communication', 'historical_communication_reopened', 'BLOCKING_CORRUPTION', c.id
  FROM operations_communications c
  WHERE c.status IN ('draft', 'ready', 'cancelled')
    AND EXISTS (
      SELECT 1 FROM admin_audit_log a
      WHERE a.target_type = 'operations_communication' AND a.target_id = c.id::text
        AND a.action IN ('operations.communication.mark_sent', 'operations.communication.mark_received')
    )
)
SELECT artifact, issue, classification, COUNT(*)::bigint AS issue_count,
       array_agg(id ORDER BY id) AS affected_ids
FROM issues
GROUP BY artifact, issue, classification
ORDER BY classification, artifact, issue;

WITH classified AS (
  SELECT 'MANUAL_REVIEW_REQUIRED'::text AS classification, r.id
  FROM operations_reports r
  WHERE r.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress', 'completed')
    AND (r.sent_at IS NULL OR r.frozen_at IS NULL OR r.frozen_render_json IS NULL)
  UNION ALL
  SELECT 'MANUAL_REVIEW_REQUIRED', q.id FROM operations_quotes q
  WHERE (q.status = 'sent' AND (q.sent_at IS NULL OR q.frozen_at IS NULL OR q.frozen_render_json IS NULL))
     OR (q.status IN ('accepted', 'converted_to_work') AND (q.accepted_at IS NULL OR q.frozen_at IS NULL OR q.frozen_render_json IS NULL))
     OR (q.status = 'declined' AND q.declined_at IS NULL)
     OR (q.status = 'expired' AND q.expired_at IS NULL)
     OR (q.status = 'cancelled' AND q.cancelled_at IS NULL)
  UNION ALL
  SELECT 'MANUAL_REVIEW_REQUIRED', c.id FROM operations_communications c
  WHERE c.status = 'sent' AND c.channel = 'email'
    AND c.template_snapshot_json ? 'operationsEmail'
    AND (c.html_document IS NULL OR c.plain_text_body IS NULL
      OR c.external_message_id IS NULL OR c.sender_email IS NULL OR c.recipient_email IS NULL)
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', c.id FROM operations_communications c
  WHERE (c.status = 'sent' AND c.sent_at IS NULL) OR (c.status = 'received' AND c.received_at IS NULL)
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', r.id
  FROM operations_reports r
  LEFT JOIN operations_reports source ON source.id = r.supersedes_report_id
  WHERE r.supersedes_report_id IS NOT NULL
    AND (source.id IS NULL OR source.id = r.id OR source.business_id <> r.business_id
      OR source.site_id <> r.site_id OR source.scan_run_id <> r.scan_run_id
      OR r.version_number <> source.version_number + 1)
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', child.supersedes_report_id
  FROM operations_reports child
  WHERE child.supersedes_report_id IS NOT NULL
  GROUP BY child.supersedes_report_id HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', q.id
  FROM operations_quotes q
  LEFT JOIN operations_quotes source ON source.id = q.supersedes_quote_id
  WHERE q.supersedes_quote_id IS NOT NULL
    AND (source.id IS NULL OR source.id = q.id OR source.business_id <> q.business_id
      OR source.revision_series_id <> q.revision_series_id
      OR q.revision_number <> source.revision_number + 1)
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', child.supersedes_quote_id
  FROM operations_quotes child
  WHERE child.supersedes_quote_id IS NOT NULL
  GROUP BY child.supersedes_quote_id HAVING COUNT(*) > 1
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', p.operations_report_id
  FROM operations_report_pdf_renders p
  WHERE octet_length(p.pdf_bytes) <> p.size_bytes
     OR encode(digest(p.pdf_bytes, 'sha256'), 'hex') <> p.sha256
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', p.operations_quote_id
  FROM operations_quote_pdf_renders p
  WHERE octet_length(p.pdf_bytes) <> p.size_bytes
     OR encode(digest(p.pdf_bytes, 'sha256'), 'hex') <> p.sha256
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', q.id FROM operations_quotes q
  WHERE q.status IN ('sent', 'accepted', 'declined', 'expired', 'cancelled', 'converted_to_work')
    AND (EXISTS (SELECT 1 FROM operations_quote_items i WHERE i.quote_id = q.id AND i.line_total_minor <> i.quantity * i.unit_price_minor)
      OR q.total_minor <> GREATEST(0, q.subtotal_minor - q.discount_minor) + q.tax_minor)
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', c.id FROM operations_communications c
  WHERE c.status = 'sent' AND c.template_snapshot_json ? 'operationsEmail'
    AND NOT EXISTS (SELECT 1 FROM operations_email_crm_finalisations f WHERE f.sent_communication_id = c.id AND f.status = 'finalised')
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', r.id FROM operations_reports r
  WHERE r.status IN ('draft', 'needs_review', 'ready_to_send')
    AND EXISTS (SELECT 1 FROM admin_audit_log a WHERE a.target_type = 'operations_report'
      AND a.target_id = r.id::text AND a.action IN ('operations_report_sent', 'operations_report_status_sent'))
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', q.id FROM operations_quotes q
  WHERE q.status IN ('draft', 'needs_review', 'ready_to_send')
    AND EXISTS (SELECT 1 FROM operations_quote_status_history h WHERE h.quote_id = q.id
      AND h.new_status IN ('sent', 'accepted', 'converted_to_work'))
  UNION ALL
  SELECT 'BLOCKING_CORRUPTION', c.id FROM operations_communications c
  WHERE c.status IN ('draft', 'ready', 'cancelled')
    AND EXISTS (SELECT 1 FROM admin_audit_log a WHERE a.target_type = 'operations_communication'
      AND a.target_id = c.id::text AND a.action IN ('operations.communication.mark_sent', 'operations.communication.mark_received'))
)
SELECT category.classification, COUNT(DISTINCT classified.id)::bigint AS record_count
FROM (VALUES ('SAFE_AUTO_REPAIR'), ('MANUAL_REVIEW_REQUIRED'), ('GRANDFATHER_ALLOWED'), ('BLOCKING_CORRUPTION')) category(classification)
LEFT JOIN classified USING (classification)
GROUP BY category.classification
ORDER BY category.classification;

COMMIT;
