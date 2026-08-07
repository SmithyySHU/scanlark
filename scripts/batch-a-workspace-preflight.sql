-- Batch A read-only workspace ownership preflight. Run with psql -X -v ON_ERROR_STOP=1.
SELECT
  (SELECT count(*) FROM internal_workspaces) AS workspaces,
  (SELECT count(*) FROM operations_businesses) AS businesses,
  (SELECT count(*) FROM operations_businesses WHERE internal_workspace_id IS NULL) AS businesses_without_workspace,
  (SELECT count(*) FROM internal_workspace_memberships WHERE is_active) AS active_memberships;

SELECT user_id, count(*) AS active_workspace_count
FROM internal_workspace_memberships
WHERE is_active
GROUP BY user_id
HAVING count(*) > 1
ORDER BY user_id;

SELECT b.id AS business_id,
       array_agg(DISTINCT em.workspace_id) FILTER (WHERE em.workspace_id IS NOT NULL) AS email_workspace_candidates,
       b.created_by_user_id,
       array_agg(DISTINCT m.workspace_id) FILTER (WHERE m.is_active) AS creator_workspace_candidates
FROM operations_businesses b
LEFT JOIN operations_email_messages em ON em.business_id = b.id
LEFT JOIN internal_workspace_memberships m ON m.user_id = b.created_by_user_id
WHERE b.internal_workspace_id IS NULL
GROUP BY b.id, b.created_by_user_id
ORDER BY b.id;

SELECT em.id AS message_id, em.workspace_id AS email_workspace_id,
       b.internal_workspace_id AS business_workspace_id
FROM operations_email_messages em
JOIN operations_businesses b ON b.id = em.business_id
WHERE b.internal_workspace_id IS DISTINCT FROM em.workspace_id
ORDER BY em.id;

SELECT obs.site_id, array_agg(DISTINCT b.internal_workspace_id) AS workspace_ids
FROM operations_business_sites obs
JOIN operations_businesses b ON b.id = obs.business_id
GROUP BY obs.site_id
HAVING count(DISTINCT b.internal_workspace_id) > 1
ORDER BY obs.site_id;

SELECT r.id AS report_id, r.business_id, r.site_id, r.scan_run_id
FROM operations_reports r
JOIN scan_runs sr ON sr.id = r.scan_run_id
LEFT JOIN operations_business_sites obs
  ON obs.business_id = r.business_id AND obs.site_id = r.site_id
WHERE sr.site_id <> r.site_id OR obs.business_id IS NULL
ORDER BY r.id;

SELECT 'communication_templates' AS catalog, count(*) AS row_count,
       count(*) FILTER (WHERE created_by_user_id IS NULL) AS without_creator
FROM operations_client_communication_templates
UNION ALL
SELECT 'quote_service_items', count(*), count(*) FILTER (WHERE created_by_user_id IS NULL)
FROM operations_quote_service_items
UNION ALL
SELECT 'service_plans', count(*), count(*) FILTER (WHERE created_by_user_id IS NULL)
FROM operations_service_plan_templates;
