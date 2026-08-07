import { ensureConnected } from "./client";

export type OperationsResourceKind =
  | "business"
  | "contact"
  | "site"
  | "scan_run"
  | "report"
  | "finding"
  | "positive_observation"
  | "comparison_item"
  | "quote"
  | "quote_or_work_item"
  | "quote_or_work_requirement"
  | "work_order"
  | "communication"
  | "task"
  | "communication_template"
  | "service"
  | "service_plan"
  | "service_item"
  | "service_usage";

const RESOURCE_SCOPE_SQL: Record<OperationsResourceKind, string> = {
  business: `SELECT 1 FROM operations_businesses b WHERE b.id = $2 AND b.internal_workspace_id = $1`,
  contact: `SELECT 1 FROM operations_contacts c JOIN operations_businesses b ON b.id = c.business_id WHERE c.id = $2 AND b.internal_workspace_id = $1`,
  site: `
    SELECT 1 FROM operations_business_sites obs
    JOIN operations_businesses b ON b.id = obs.business_id
    WHERE obs.site_id = $2 AND b.internal_workspace_id = $1
    UNION ALL
    SELECT 1 FROM operations_client_service_sites css
    JOIN operations_client_services cs ON cs.id = css.client_service_id
    JOIN operations_businesses b ON b.id = cs.business_id
    WHERE css.id = $2 AND b.internal_workspace_id = $1
  `,
  scan_run: `SELECT 1 FROM scan_runs r JOIN operations_business_sites obs ON obs.site_id = r.site_id JOIN operations_businesses b ON b.id = obs.business_id WHERE r.id = $2 AND b.internal_workspace_id = $1`,
  report: `SELECT 1 FROM operations_reports r JOIN operations_businesses b ON b.id = r.business_id WHERE r.id = $2 AND b.internal_workspace_id = $1`,
  finding: `SELECT 1 FROM operations_report_findings f JOIN operations_reports r ON r.id = f.operations_report_id JOIN operations_businesses b ON b.id = r.business_id WHERE f.id = $2 AND b.internal_workspace_id = $1`,
  positive_observation: `SELECT 1 FROM operations_report_positive_observations o JOIN operations_reports r ON r.id = o.operations_report_id JOIN operations_businesses b ON b.id = r.business_id WHERE o.id = $2 AND b.internal_workspace_id = $1`,
  comparison_item: `SELECT 1 FROM operations_report_comparison_items i JOIN operations_reports r ON r.id = i.operations_report_id JOIN operations_businesses b ON b.id = r.business_id WHERE i.id = $2 AND b.internal_workspace_id = $1`,
  quote: `SELECT 1 FROM operations_quotes q JOIN operations_businesses b ON b.id = q.business_id WHERE q.id = $2 AND b.internal_workspace_id = $1`,
  quote_or_work_item: `
    SELECT 1 FROM operations_quote_items i JOIN operations_quotes q ON q.id = i.quote_id JOIN operations_businesses b ON b.id = q.business_id WHERE i.id = $2 AND b.internal_workspace_id = $1
    UNION ALL
    SELECT 1 FROM operations_work_items i JOIN operations_work_orders w ON w.id = i.work_order_id JOIN operations_businesses b ON b.id = w.business_id WHERE i.id = $2 AND b.internal_workspace_id = $1
  `,
  quote_or_work_requirement: `
    SELECT 1 FROM operations_quote_access_requirements r JOIN operations_quotes q ON q.id = r.quote_id JOIN operations_businesses b ON b.id = q.business_id WHERE r.id = $2 AND b.internal_workspace_id = $1
    UNION ALL
    SELECT 1 FROM operations_work_order_access_requirements r JOIN operations_work_orders w ON w.id = r.work_order_id JOIN operations_businesses b ON b.id = w.business_id WHERE r.id = $2 AND b.internal_workspace_id = $1
  `,
  work_order: `SELECT 1 FROM operations_work_orders w JOIN operations_businesses b ON b.id = w.business_id WHERE w.id = $2 AND b.internal_workspace_id = $1`,
  communication: `SELECT 1 FROM operations_communications c JOIN operations_businesses b ON b.id = c.business_id WHERE c.id = $2 AND b.internal_workspace_id = $1`,
  task: `SELECT 1 FROM operations_tasks t JOIN operations_businesses b ON b.id = t.business_id WHERE t.id = $2 AND b.internal_workspace_id = $1`,
  communication_template: `SELECT 1 FROM operations_client_communication_templates t WHERE t.id = $2 AND t.internal_workspace_id = $1`,
  service: `SELECT 1 FROM operations_client_services s JOIN operations_businesses b ON b.id = s.business_id WHERE s.id = $2 AND b.internal_workspace_id = $1`,
  service_plan: `SELECT 1 FROM operations_service_plan_templates p WHERE p.id = $2 AND p.internal_workspace_id = $1`,
  service_item: `SELECT 1 FROM operations_quote_service_items i WHERE i.id = $2 AND i.internal_workspace_id = $1`,
  service_usage: `SELECT 1 FROM operations_client_service_usage u JOIN operations_businesses b ON b.id = u.business_id WHERE u.id = $2 AND b.internal_workspace_id = $1`,
};

export async function canAccessOperationsResource(
  workspaceId: string,
  kind: OperationsResourceKind,
  resourceId: string,
) {
  const client = await ensureConnected();
  const result = await client.query(
    `SELECT 1 FROM (${RESOURCE_SCOPE_SQL[kind]}) scoped LIMIT 1`,
    [workspaceId, resourceId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function canLinkOperationsSite(
  workspaceId: string,
  actorUserId: string,
  siteId: string,
) {
  const client = await ensureConnected();
  const result = await client.query(
    `
      SELECT 1
      FROM sites s
      WHERE s.id = $3
        AND (
          s.user_id = $2
          OR EXISTS (
            SELECT 1
            FROM operations_business_sites obs
            JOIN operations_businesses b ON b.id = obs.business_id
            WHERE obs.site_id = s.id AND b.internal_workspace_id = $1
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM operations_business_sites obs
          JOIN operations_businesses b ON b.id = obs.business_id
          WHERE obs.site_id = s.id AND b.internal_workspace_id <> $1
        )
      LIMIT 1
    `,
    [workspaceId, actorUserId, siteId],
  );
  return (result.rowCount ?? 0) > 0;
}
