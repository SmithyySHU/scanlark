import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { closeConnection } from "./client";
import { DATABASE_URL } from "./env";
import {
  approveOperationsReport,
  getOperationsReportPreview,
  isOperationsReportApprovalCurrent,
  updateOperationsReportActionPlanItem,
} from "./operationsReports";
import {
  createOperationsBusiness,
  getOperationsBusinessDetail,
  listOperationsBusinesses,
  updateOperationsBusiness,
} from "./operationsCrm";
import { getOperationsCommunicationDraftContext } from "./operationsCommunications";
import { canAccessOperationsResource } from "./operationsScope";

const db = new Client({ connectionString: DATABASE_URL });
function disposableDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      /test|audit|verify/i.test(url.pathname.slice(1)) &&
      process.env.NODE_ENV !== "production"
    );
  } catch {
    return false;
  }
}
const statefulAuditEnabled = disposableDatabaseUrl(DATABASE_URL);
const key = randomUUID();
const actor = { id: "", email: `batch-a-${key}@scanlark.test` };
let workspaceA = "";
let workspaceB = "";
let businessA = "";
let businessB = "";
let reportA = "";
let siteA = "";

before(async () => {
  if (!statefulAuditEnabled) return;
  await db.connect();
  const user = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'batch-a-test') RETURNING id`,
    [actor.email],
  );
  actor.id = user.rows[0].id;
  const workspaces = await db.query<{ id: string }>(
    `
      INSERT INTO internal_workspaces (name, code)
      VALUES ($1, $2), ($3, $4)
      RETURNING id
    `,
    [
      `Batch A workspace A ${key}`,
      `batch-a-a-${key}`,
      `Batch A workspace B ${key}`,
      `batch-a-b-${key}`,
    ],
  );
  workspaceA = workspaces.rows[0].id;
  workspaceB = workspaces.rows[1].id;
  await db.query(
    `
      INSERT INTO internal_workspace_memberships (workspace_id, user_id, role)
      VALUES ($1, $3, 'owner'), ($2, $3, 'owner')
    `,
    [workspaceA, workspaceB, actor.id],
  );
  const other = await db.query<{ id: string }>(
    `
      INSERT INTO operations_businesses (internal_workspace_id, name, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [workspaceB, `Workspace B business ${key}`, actor.id],
  );
  businessB = other.rows[0].id;
});

after(async () => {
  if (!statefulAuditEnabled) return;
  if (businessA || businessB) {
    await db.query(
      `DELETE FROM admin_audit_log WHERE target_id = ANY($1::text[])`,
      [[businessA, businessB].filter(Boolean)],
    );
  }
  if (reportA) {
    await db.query(`DELETE FROM admin_audit_log WHERE target_id = $1`, [
      reportA,
    ]);
    await db.query(`DELETE FROM operations_reports WHERE id = $1`, [reportA]);
  }
  if (siteA) await db.query(`DELETE FROM sites WHERE id = $1`, [siteA]);
  await db.query(
    `DELETE FROM operations_businesses WHERE id = ANY($1::uuid[])`,
    [[businessA, businessB].filter(Boolean)],
  );
  await db.query(`DELETE FROM internal_workspaces WHERE id = ANY($1::uuid[])`, [
    [workspaceA, workspaceB].filter(Boolean),
  ]);
  await db.query(`DELETE FROM users WHERE id = $1`, [actor.id]);
  await db.end();
  await closeConnection();
});

test("business creation persists the authoritative workspace", async () => {
  if (!statefulAuditEnabled) return;
  const detail = await createOperationsBusiness(workspaceA, actor, {
    name: `Workspace A business ${key}`,
  });
  businessA = detail.business.id;
  assert.equal(detail.business.internal_workspace_id, workspaceA);
});

test("communication draft context binds its optional contact placeholder and workspace", async () => {
  if (!statefulAuditEnabled) return;

  const context = await getOperationsCommunicationDraftContext(
    workspaceA,
    businessA,
  );
  assert.equal(context?.business.id, businessA);
  assert.equal(context?.contact, null);

  // A known business ID in another workspace must be indistinguishable from
  // a missing business, and must never reach the contact/site lookups.
  assert.equal(
    await getOperationsCommunicationDraftContext(workspaceA, businessB),
    null,
  );
});

test("linked action save and approval are workspace-scoped and revision-bound", async () => {
  if (!statefulAuditEnabled) return;
  const site = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://approval-${key}.test`, actor.id],
  );
  siteA = site.rows[0].id;
  const scan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [siteA, `https://approval-${key}.test`],
  );
  const report = await db.query<{ id: string }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations, last_preview_generated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, now())
      RETURNING id
    `,
    [
      businessA,
      siteA,
      scan.rows[0].id,
      "Approval regression report",
      actor.id,
      "Reviewed client wording.",
    ],
  );
  reportA = report.rows[0].id;
  const finding = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id, source_type, category, original_severity,
        client_priority, title, client_explanation, why_it_matters,
        recommended_action, affected_url, reviewed_at
      )
      VALUES ($1, 'manual', 'manual', 'medium', 'important', $2, $3, $3, $3, $4, now())
      RETURNING id
    `,
    [
      reportA,
      "Linked finding",
      "Reviewed client content.",
      `https://approval-${key}.test/page`,
    ],
  );
  const action = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title
      ) VALUES ($1, $2, 'address_soon', 'Original action') RETURNING id
    `,
    [reportA, finding.rows[0].id],
  );

  const saved = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportA,
    action.rows[0].id,
    { title: "Saved action title", expectedRevision: 1 },
  );
  assert.equal(saved?.title, "Saved action title");
  assert.equal(
    await updateOperationsReportActionPlanItem(
      workspaceB,
      actor,
      reportA,
      action.rows[0].id,
      { title: "must-not-cross-workspace" },
    ),
    null,
  );

  await getOperationsReportPreview(workspaceA, reportA);

  const approved = await approveOperationsReport(workspaceA, actor, reportA, 2);
  assert.ok(approved && !("readinessIssues" in approved));
  if (!approved || "readinessIssues" in approved) return;
  assert.equal(isOperationsReportApprovalCurrent(approved.report), true);
  assert.equal(
    approved.actionPlanItems.find((item) => item.id === action.rows[0].id)
      ?.title,
    "Saved action title",
  );

  await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportA,
    action.rows[0].id,
    { summary: "A client-visible amendment.", expectedRevision: 2 },
  );
  const current = await db.query<{
    content_revision: number;
    approved_content_revision: number | null;
  }>(
    `SELECT content_revision, approved_content_revision FROM operations_reports WHERE id = $1`,
    [reportA],
  );
  assert.equal(current.rows[0].content_revision, 3);
  assert.equal(current.rows[0].approved_content_revision, 2);
});

test("business lists and direct resource checks are workspace isolated", async () => {
  if (!statefulAuditEnabled) return;
  const listA = await listOperationsBusinesses(workspaceA, {
    archived: false,
    sort: "name",
    limit: 100,
    offset: 0,
  });
  assert.equal(
    listA.businesses.some((item) => item.id === businessA),
    true,
  );
  assert.equal(
    listA.businesses.some((item) => item.id === businessB),
    false,
  );
  assert.equal(
    await canAccessOperationsResource(workspaceA, "business", businessA),
    true,
  );
  assert.equal(
    await canAccessOperationsResource(workspaceA, "business", businessB),
    false,
  );
  const before = await db.query<{ name: string }>(
    `SELECT name FROM operations_businesses WHERE id = $1`,
    [businessB],
  );
  assert.equal(await getOperationsBusinessDetail(workspaceA, businessB), null);
  assert.equal(
    await updateOperationsBusiness(workspaceA, actor, businessB, {
      name: "must-not-cross-workspace",
    }),
    null,
  );
  const after = await db.query<{ name: string }>(
    `SELECT name FROM operations_businesses WHERE id = $1`,
    [businessB],
  );
  assert.deepEqual(after.rows, before.rows);
});
