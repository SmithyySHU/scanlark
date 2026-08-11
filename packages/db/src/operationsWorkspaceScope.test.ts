import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { closeConnection } from "./client";
import { DATABASE_URL } from "./env";
import {
  approveOperationsReport,
  createOperationsReport,
  freezeOperationsReportRender,
  getOperationsReportPreview,
  isOperationsReportApprovalCurrent,
  markOperationsReportStatus,
  recordOperationsReportSent,
  saveOperationsReportPdfRender,
  updateOperationsReport,
  updateOperationsReportActionPlanBatch,
  updateOperationsReportActionPlanItem,
  updateOperationsReportFinding,
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
  await db.query(
    `INSERT INTO operations_business_sites (business_id, site_id, created_by_user_id)
     VALUES ($1, $2, $3)`,
    [businessA, siteA, actor.id],
  );
  const createdReport = await createOperationsReport(workspaceA, actor, {
    businessId: businessA,
    siteId: siteA,
    scanRunId: scan.rows[0].id,
    reportType: "initial_health_check",
    title: "Approval regression report",
  });
  if (typeof createdReport === "string") {
    assert.fail(`report creation failed: ${createdReport}`);
  }
  reportA = createdReport.report.id;
  assert.equal(createdReport.report.status, "needs_review");
  await db.query(
    `UPDATE operations_report_positive_observations
     SET reviewed_at = now()
     WHERE operations_report_id = $1`,
    [reportA],
  );
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

  const excluded = await updateOperationsReportFinding(
    workspaceA,
    actor,
    reportA,
    finding.rows[0].id,
    {
      clientEvidence: "Unsaved client evidence saved with the exclusion.",
      isIncluded: false,
      isFalsePositive: false,
      expectedRevision: 1,
    },
  );
  assert.equal(excluded?.is_included, false);
  assert.equal(excluded?.is_false_positive, false);
  assert.equal(
    excluded?.client_evidence,
    "Unsaved client evidence saved with the exclusion.",
  );

  const restored = await updateOperationsReportFinding(
    workspaceA,
    actor,
    reportA,
    finding.rows[0].id,
    { isIncluded: true, isFalsePositive: false, expectedRevision: 2 },
  );
  assert.equal(restored?.is_included, true);
  assert.equal(restored?.is_false_positive, false);

  const falsePositive = await updateOperationsReportFinding(
    workspaceA,
    actor,
    reportA,
    finding.rows[0].id,
    { isIncluded: false, isFalsePositive: true, expectedRevision: 3 },
  );
  assert.equal(falsePositive?.is_included, false);
  assert.equal(falsePositive?.is_false_positive, true);

  const reviewed = await updateOperationsReportFinding(
    workspaceA,
    actor,
    reportA,
    finding.rows[0].id,
    {
      isIncluded: true,
      isFalsePositive: false,
      reviewedAt: new Date(),
      expectedRevision: 4,
    },
  );
  assert.ok(reviewed?.reviewed_at);

  const saved = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportA,
    action.rows[0].id,
    { title: "Saved action title", expectedRevision: 5 },
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

  const approved = await approveOperationsReport(workspaceA, actor, reportA, 6);
  assert.ok(approved && !("readinessIssues" in approved));
  if (!approved || "readinessIssues" in approved) return;
  assert.equal(isOperationsReportApprovalCurrent(approved.report), true);
  assert.equal(
    approved.actionPlanItems.find((item) => item.id === action.rows[0].id)
      ?.title,
    "Saved action title",
  );

  const internalNote = await updateOperationsReportFinding(
    workspaceA,
    actor,
    reportA,
    finding.rows[0].id,
    {
      internalNote: "Internal follow-up context only.",
      expectedRevision: 6,
    },
  );
  assert.equal(internalNote?.internal_note, "Internal follow-up context only.");
  const afterInternalNote = await db.query<{
    content_revision: number;
    approved_content_revision: number | null;
  }>(
    `SELECT content_revision, approved_content_revision
     FROM operations_reports WHERE id = $1`,
    [reportA],
  );
  assert.equal(afterInternalNote.rows[0].content_revision, 6);
  assert.equal(afterInternalNote.rows[0].approved_content_revision, 6);

  await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportA,
    action.rows[0].id,
    { summary: "A client-visible amendment.", expectedRevision: 6 },
  );
  const current = await db.query<{
    content_revision: number;
    approved_content_revision: number | null;
  }>(
    `SELECT content_revision, approved_content_revision FROM operations_reports WHERE id = $1`,
    [reportA],
  );
  assert.equal(current.rows[0].content_revision, 7);
  assert.equal(current.rows[0].approved_content_revision, 6);
});

test("report finalisation requires approval and PDF and reopens safely", async () => {
  if (!statefulAuditEnabled) return;

  await getOperationsReportPreview(workspaceA, reportA);
  const approved = await approveOperationsReport(workspaceA, actor, reportA, 7);
  assert.ok(approved && !("readinessIssues" in approved));

  const prematureSend = await recordOperationsReportSent(
    workspaceA,
    actor,
    reportA,
    { deliveryMethod: "email_attachment" },
  );
  if (!prematureSend || typeof prematureSend === "string") {
    assert.fail("premature report delivery should return readiness issues");
  }
  assert.ok(
    "readinessIssues" in prematureSend &&
      prematureSend.readinessIssues.some(
        (issue) => issue.code === "report_ready_to_send_required",
      ),
  );

  await freezeOperationsReportRender(
    workspaceA,
    actor,
    reportA,
    "operations_report_pdf_generated",
  );
  await saveOperationsReportPdfRender(
    workspaceA,
    reportA,
    "final-report.pdf",
    Buffer.from("first approved final PDF"),
    { generatedByUserId: actor.id },
  );
  const ready = await markOperationsReportStatus(
    workspaceA,
    actor,
    reportA,
    "ready_to_send",
  );
  assert.ok(ready && !("readinessIssues" in ready));
  if (!ready || "readinessIssues" in ready) return;
  assert.equal(ready.report.status, "ready_to_send");

  await assert.rejects(
    updateOperationsReport(workspaceA, actor, reportA, {
      mainConcerns: "A silent ready-to-send edit must not persist.",
      expectedRevision: 7,
    }),
    /report_ready_requires_reopen/,
  );
  assert.equal(
    await markOperationsReportStatus(
      workspaceB,
      actor,
      reportA,
      "needs_review",
    ),
    null,
  );

  const reopened = await markOperationsReportStatus(
    workspaceA,
    actor,
    reportA,
    "needs_review",
  );
  assert.ok(reopened && !("readinessIssues" in reopened));
  if (!reopened || "readinessIssues" in reopened) return;
  assert.equal(reopened.report.status, "needs_review");
  assert.equal(reopened.report.content_revision, 8);
  assert.equal(isOperationsReportApprovalCurrent(reopened.report), false);
  assert.equal(reopened.report.last_pdf_generated_at, null);
  assert.equal(reopened.report.frozen_render_json, null);

  const edited = await updateOperationsReport(workspaceA, actor, reportA, {
    mainConcerns: "Updated reviewed concern after explicit reopening.",
    expectedRevision: 8,
  });
  if (!edited || edited === "contact_not_found") {
    assert.fail("reopened report edit should succeed");
  }
  assert.equal(edited.report.content_revision, 9);
  assert.equal(edited.report.approved_content_revision, 7);

  await getOperationsReportPreview(workspaceA, reportA);
  const reapproved = await approveOperationsReport(
    workspaceA,
    actor,
    reportA,
    9,
  );
  assert.ok(reapproved && !("readinessIssues" in reapproved));
  await freezeOperationsReportRender(
    workspaceA,
    actor,
    reportA,
    "operations_report_pdf_generated",
  );
  await saveOperationsReportPdfRender(
    workspaceA,
    reportA,
    "reapproved-final-report.pdf",
    Buffer.from("second approved final PDF"),
    { generatedByUserId: actor.id },
  );
  const readyAgain = await markOperationsReportStatus(
    workspaceA,
    actor,
    reportA,
    "ready_to_send",
  );
  assert.ok(readyAgain && !("readinessIssues" in readyAgain));
  assert.equal(
    readyAgain && !("readinessIssues" in readyAgain)
      ? readyAgain.report.status
      : null,
    "ready_to_send",
  );
});

test("stale action-plan IDs cannot mutate current report content", async () => {
  if (!statefulAuditEnabled) return;
  const site = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://action-plan-${key}.test`, actor.id],
  );
  const scan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [site.rows[0].id, `https://action-plan-${key}.test`],
  );
  const report = await db.query<{ id: string }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations, last_preview_generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, now())
      RETURNING id
    `,
    [
      businessA,
      site.rows[0].id,
      scan.rows[0].id,
      "Action-plan stale-ID regression",
      actor.id,
      "Regression summary text.",
    ],
  );
  const reportId = report.rows[0].id;
  const reportRevisionRows = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  const reportRevision = reportRevisionRows.rows[0]!.content_revision;
  const finding = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id, source_type, category, original_severity,
        client_priority, title, client_explanation, why_it_matters,
        recommended_action, affected_url, reviewed_at
      ) VALUES ($1, 'manual', 'manual', 'medium', 'important', $2, $3, $3, $3, $4, now())
      RETURNING id
    `,
    [
      reportId,
      "Regression finding",
      "Client-facing finding text.",
      `https://action-plan-${key}.test/page`,
    ],
  );
  const legacyAction = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title
      ) VALUES ($1, $2, 'address_soon', 'Legacy regression action') RETURNING id
    `,
    [reportId, finding.rows[0].id],
  );
  await db.query(
    `DELETE FROM operations_report_action_plan_items WHERE id = $1`,
    [legacyAction.rows[0].id],
  );
  const replacement = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title
      ) VALUES ($1, $2, 'address_soon', 'Replacement regression action') RETURNING id
    `,
    [reportId, finding.rows[0].id],
  );
  assert.equal(
    await canAccessOperationsResource(
      workspaceA,
      "action_plan_item",
      replacement.rows[0].id,
    ),
    true,
  );
  assert.equal(
    await canAccessOperationsResource(
      workspaceB,
      "action_plan_item",
      replacement.rows[0].id,
    ),
    false,
  );

  assert.equal(
    await updateOperationsReportActionPlanItem(
      workspaceA,
      actor,
      reportId,
      legacyAction.rows[0].id,
      { title: "Attempted stale update", expectedRevision: reportRevision },
    ),
    null,
  );

  const surviving = await db.query<{ id: string; title: string }>(
    `SELECT id, title FROM operations_report_action_plan_items WHERE operations_report_id = $1`,
    [reportId],
  );
  assert.equal(surviving.rows.length, 1);
  assert.equal(surviving.rows[0]!.id, replacement.rows[0]!.id);
  assert.equal(surviving.rows[0]!.title, "Replacement regression action");

  const repaired = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportId,
    replacement.rows[0]!.id,
    {
      title: "Replacement action after refresh",
      expectedRevision: reportRevision,
    },
  );
  assert.equal(repaired?.title, "Replacement action after refresh");

  const otherSite = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://action-plan-other-${key}.test`, actor.id],
  );
  const otherScan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [otherSite.rows[0].id, `https://action-plan-other-${key}.test`],
  );
  const otherReport = await db.query<{ id: string }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations, last_preview_generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, now())
      RETURNING id
    `,
    [
      businessA,
      otherSite.rows[0].id,
      otherScan.rows[0].id,
      "Action-plan wrong-report regression",
      actor.id,
      "Other report summary text.",
    ],
  );
  const otherFinding = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id, source_type, category, original_severity,
        client_priority, title, client_explanation, why_it_matters,
        recommended_action, affected_url, reviewed_at
      ) VALUES ($1, 'manual', 'manual', 'medium', 'important', $2, $3, $3, $3, $4, now())
      RETURNING id
    `,
    [
      otherReport.rows[0].id,
      "Wrong-report finding",
      "Separate finding text.",
      `https://action-plan-other-${key}.test/page`,
    ],
  );
  const otherAction = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title
      ) VALUES ($1, $2, 'address_soon', 'Wrong-report action') RETURNING id
    `,
    [otherReport.rows[0].id, otherFinding.rows[0].id],
  );
  const currentReportRevision = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );

  assert.equal(
    await updateOperationsReportActionPlanItem(
      workspaceA,
      actor,
      reportId,
      otherAction.rows[0].id,
      {
        title: "Wrong report mutation attempt",
        expectedRevision: currentReportRevision.rows[0]!.content_revision,
      },
    ),
    null,
  );

  await db.query(`DELETE FROM operations_reports WHERE id = $1`, [reportId]);
  await db.query(`DELETE FROM sites WHERE id = $1`, [site.rows[0].id]);
  await db.query(`DELETE FROM operations_reports WHERE id = $1`, [
    otherReport.rows[0].id,
  ]);
  await db.query(`DELETE FROM sites WHERE id = $1`, [otherSite.rows[0].id]);
});

test("fresh action-plan timing updates mutate the same persisted item", async () => {
  if (!statefulAuditEnabled) return;
  const site = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://action-plan-timing-${key}.test`, actor.id],
  );
  const scan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [site.rows[0].id, `https://action-plan-timing-${key}.test`],
  );
  const report = await db.query<{ id: string }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations, last_preview_generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, now())
      RETURNING id
    `,
    [
      businessA,
      site.rows[0].id,
      scan.rows[0].id,
      "Action-plan timing regression",
      actor.id,
      "Timing regression summary.",
    ],
  );
  const reportId = report.rows[0]!.id;
  const finding = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id, source_type, category, original_severity,
        client_priority, title, client_explanation, why_it_matters,
        recommended_action, affected_url, reviewed_at
      ) VALUES ($1, 'manual', 'manual', 'medium', 'important', $2, $3, $3, $3, $4, now())
      RETURNING id
    `,
    [
      reportId,
      "Timing finding",
      "Regression content.",
      `https://action-plan-timing-${key}.test/page`,
    ],
  );
  const action = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title
      ) VALUES ($1, $2, 'consider_later', 'Stale timing regression') RETURNING id
    `,
    [reportId, finding.rows[0]!.id],
  );

  const itemId = action.rows[0]!.id;
  const existsBefore = await db.query<{ id: string; group_key: string }>(
    `SELECT id, group_key FROM operations_report_action_plan_items WHERE id = $1`,
    [itemId],
  );
  assert.equal(existsBefore.rows.length, 1);
  assert.equal(existsBefore.rows[0]!.group_key, "consider_later");
  assert.equal(existsBefore.rows[0]!.id, itemId);

  const initialReport = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  const initialRevision = initialReport.rows[0]!.content_revision;

  const movedSoon = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportId,
    itemId,
    {
      groupKey: "address_soon",
      expectedRevision: initialRevision,
    },
  );
  assert.equal(movedSoon?.id, itemId);
  assert.equal(movedSoon?.group_key, "address_soon");
  const existsAfterSoon = await db.query<{ id: string; group_key: string }>(
    `SELECT id, group_key FROM operations_report_action_plan_items WHERE id = $1`,
    [itemId],
  );
  assert.equal(existsAfterSoon.rows.length, 1);
  assert.equal(existsAfterSoon.rows[0]!.group_key, "address_soon");

  const soonReport = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  const soonRevision = soonReport.rows[0]!.content_revision;
  assert.equal(soonRevision, initialRevision + 1);

  const movedNow = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportId,
    itemId,
    {
      groupKey: "address_now",
      expectedRevision: soonRevision,
    },
  );
  assert.equal(movedNow?.id, itemId);
  assert.equal(movedNow?.group_key, "address_now");
  const existsAfterNow = await db.query<{ id: string; group_key: string }>(
    `SELECT id, group_key FROM operations_report_action_plan_items WHERE id = $1`,
    [itemId],
  );
  assert.equal(existsAfterNow.rows.length, 1);
  assert.equal(existsAfterNow.rows[0]!.group_key, "address_now");

  const nowReport = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  const nowRevision = nowReport.rows[0]!.content_revision;
  assert.equal(nowRevision, soonRevision + 1);

  const movedLater = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportId,
    itemId,
    {
      groupKey: "consider_later",
      expectedRevision: nowRevision,
    },
  );
  assert.equal(movedLater?.id, itemId);
  assert.equal(movedLater?.group_key, "consider_later");
  const existsAfterLater = await db.query<{ id: string; group_key: string }>(
    `SELECT id, group_key FROM operations_report_action_plan_items WHERE id = $1`,
    [itemId],
  );
  assert.equal(existsAfterLater.rows.length, 1);
  assert.equal(existsAfterLater.rows[0]!.group_key, "consider_later");

  const laterReport = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  assert.equal(laterReport.rows[0]!.content_revision, nowRevision + 1);
  const updatedContent = await updateOperationsReportActionPlanItem(
    workspaceA,
    actor,
    reportId,
    itemId,
    {
      title: "Updated action title",
      summary: "Updated action summary.",
      expectedRevision: laterReport.rows[0]!.content_revision,
    },
  );
  assert.equal(updatedContent?.id, itemId);
  assert.equal(updatedContent?.title, "Updated action title");
  assert.equal(updatedContent?.summary, "Updated action summary.");

  const persisted = await db.query<{
    id: string;
    group_key: string;
    title: string;
    summary: string | null;
  }>(
    `SELECT id, group_key, title, summary FROM operations_report_action_plan_items WHERE operations_report_id = $1`,
    [reportId],
  );
  assert.equal(persisted.rows.length, 1);
  assert.equal(persisted.rows[0]!.id, itemId);
  assert.equal(persisted.rows[0]!.group_key, "consider_later");
  assert.equal(persisted.rows[0]!.title, "Updated action title");
  assert.equal(persisted.rows[0]!.summary, "Updated action summary.");
  const finalReport = await db.query<{ content_revision: number }>(
    `SELECT content_revision FROM operations_reports WHERE id = $1`,
    [reportId],
  );
  assert.equal(
    finalReport.rows[0]!.content_revision,
    laterReport.rows[0]!.content_revision + 1,
  );

  await db.query(`DELETE FROM operations_reports WHERE id = $1`, [reportId]);
  await db.query(`DELETE FROM sites WHERE id = $1`, [site.rows[0].id]);
  await db.query(`DELETE FROM scan_runs WHERE id = $1`, [scan.rows[0].id]);
});

test("Action Plan batch save is atomic, revision-bound, and workspace-scoped", async () => {
  if (!statefulAuditEnabled) return;
  const site = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://action-plan-batch-${key}.test`, actor.id],
  );
  const scan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [site.rows[0].id, `https://action-plan-batch-${key}.test`],
  );
  const report = await db.query<{ id: string; content_revision: number }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations, last_preview_generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $6, $6, $6, $6, now())
      RETURNING id, content_revision
    `,
    [
      businessA,
      site.rows[0].id,
      scan.rows[0].id,
      "Action Plan batch regression",
      actor.id,
      "Batch regression summary.",
    ],
  );
  const reportId = report.rows[0]!.id;
  const findings = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_findings (
        operations_report_id, source_type, category, original_severity,
        client_priority, title, client_explanation, why_it_matters,
        recommended_action, affected_url, reviewed_at
      ) VALUES
        ($1, 'manual', 'manual', 'medium', 'important', 'Batch action A', 'Explanation A', 'Why A', 'Action A', $2, now()),
        ($1, 'manual', 'manual', 'low', 'improvement', 'Batch action B', 'Explanation B', 'Why B', 'Action B', $3, now())
      RETURNING id
    `,
    [
      reportId,
      `https://action-plan-batch-${key}.test/a`,
      `https://action-plan-batch-${key}.test/b`,
    ],
  );
  const actions = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, report_finding_id, group_key, title, summary
      ) VALUES
        ($1, $2, 'consider_later', 'Original action A', 'Original summary A'),
        ($1, $3, 'address_soon', 'Original action B', 'Original summary B')
      RETURNING id
    `,
    [reportId, findings.rows[0]!.id, findings.rows[1]!.id],
  );
  const observation = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_positive_observations (
        operations_report_id, title, description, source_key
      ) VALUES ($1, 'Original positive', 'Original description', 'batch-test')
      RETURNING id
    `,
    [reportId],
  );

  const initialRevision = report.rows[0]!.content_revision;
  const saved = await updateOperationsReportActionPlanBatch(
    workspaceA,
    actor,
    reportId,
    {
      expectedRevision: initialRevision,
      actionPlanItems: [
        { id: actions.rows[0]!.id, groupKey: "address_soon" },
        { id: actions.rows[1]!.id, summary: "Updated summary B" },
      ],
      positiveObservations: [
        {
          id: observation.rows[0]!.id,
          title: "Updated positive",
          description: "Updated positive description",
        },
      ],
    },
  );
  assert.ok(saved);
  assert.equal(saved.report.content_revision, initialRevision + 1);
  assert.equal(
    saved.actionPlanItems.find((item) => item.id === actions.rows[0]!.id)
      ?.group_key,
    "address_soon",
  );
  assert.equal(
    saved.actionPlanItems.find((item) => item.id === actions.rows[1]!.id)
      ?.summary,
    "Updated summary B",
  );
  assert.equal(saved.positiveObservations[0]?.title, "Updated positive");

  await assert.rejects(
    updateOperationsReportActionPlanBatch(workspaceA, actor, reportId, {
      expectedRevision: initialRevision,
      actionPlanItems: [
        { id: actions.rows[0]!.id, title: "Stale title attempt" },
      ],
      positiveObservations: [],
    }),
    /stale_revision:report/,
  );

  const concurrentRevision =
    saved.report.content_revision ?? initialRevision + 1;
  const concurrent = await Promise.allSettled([
    updateOperationsReportActionPlanBatch(workspaceA, actor, reportId, {
      expectedRevision: concurrentRevision,
      actionPlanItems: [
        { id: actions.rows[0]!.id, title: "Concurrent action winner" },
      ],
      positiveObservations: [],
    }),
    updateOperationsReportActionPlanBatch(workspaceA, actor, reportId, {
      expectedRevision: concurrentRevision,
      actionPlanItems: [
        { id: actions.rows[1]!.id, summary: "Concurrent summary winner" },
      ],
      positiveObservations: [],
    }),
  ]);
  assert.equal(
    concurrent.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    concurrent.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof Error &&
        result.reason.message === "stale_revision:report",
    ).length,
    1,
  );
  const afterConcurrent = await db.query<{
    content_revision: number;
    action_title: string;
  }>(
    `
      SELECT r.content_revision, item.title AS action_title
      FROM operations_reports r
      JOIN operations_report_action_plan_items item ON item.operations_report_id = r.id
      WHERE r.id = $1 AND item.id = $2
    `,
    [reportId, actions.rows[0]!.id],
  );
  assert.equal(
    afterConcurrent.rows[0]!.content_revision,
    concurrentRevision + 1,
  );

  const otherSite = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://action-plan-batch-other-${key}.test`, actor.id],
  );
  const otherScan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at) VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [otherSite.rows[0].id, `https://action-plan-batch-other-${key}.test`],
  );
  const otherReport = await db.query<{ id: string }>(
    `
      INSERT INTO operations_reports (
        business_id, site_id, scan_run_id, title, created_by_user_id,
        executive_summary, overall_summary, main_strengths, main_concerns,
        recommended_first_steps, scope_limitations
      ) VALUES ($1, $2, $3, 'Other batch report', $4, 'Summary', 'Summary', 'Summary', 'Summary', 'Summary', 'Summary')
      RETURNING id
    `,
    [businessB, otherSite.rows[0].id, otherScan.rows[0].id, actor.id],
  );
  const foreignAction = await db.query<{ id: string }>(
    `
      INSERT INTO operations_report_action_plan_items (
        operations_report_id, group_key, title
      ) VALUES ($1, 'address_now', 'Foreign workspace action')
      RETURNING id
    `,
    [otherReport.rows[0]!.id],
  );
  const currentRevision = afterConcurrent.rows[0]!.content_revision;
  const titleBeforeInvalidBatch = afterConcurrent.rows[0]!.action_title;
  assert.equal(
    await updateOperationsReportActionPlanBatch(workspaceA, actor, reportId, {
      expectedRevision: currentRevision,
      actionPlanItems: [
        { id: actions.rows[0]!.id, title: "Must roll back" },
        { id: foreignAction.rows[0]!.id, title: "Must not update" },
      ],
      positiveObservations: [],
    }),
    null,
  );
  const unchanged = await db.query<{ title: string }>(
    `SELECT title FROM operations_report_action_plan_items WHERE id = $1`,
    [actions.rows[0]!.id],
  );
  assert.equal(unchanged.rows[0]!.title, titleBeforeInvalidBatch);

  await db.query(`DELETE FROM operations_reports WHERE id = $1`, [reportId]);
  await db.query(`DELETE FROM sites WHERE id = $1`, [site.rows[0]!.id]);
  await db.query(`DELETE FROM operations_reports WHERE id = $1`, [
    otherReport.rows[0]!.id,
  ]);
  await db.query(`DELETE FROM sites WHERE id = $1`, [otherSite.rows[0]!.id]);
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
