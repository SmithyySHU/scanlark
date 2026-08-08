import assert from "node:assert/strict";
import test from "node:test";
import {
  HISTORICAL_COMMUNICATION_STATUSES,
  HISTORICAL_QUOTE_STATUSES,
  HISTORICAL_REPORT_STATUSES,
  isHistoricalCommunicationStatus,
  isHistoricalQuoteStatus,
  isHistoricalReportStatus,
} from "./operationsEvidence";
import {
  getOperationsReportReadinessIssues,
  isOperationsReportApprovalCurrent,
  type OperationsReportActionPlanItemRow,
  type OperationsReportFindingRow,
  type OperationsReportRow,
} from "./operationsReports";

function readyReport() {
  return {
    id: "report",
    business_id: "business",
    site_id: "site",
    scan_run_id: "scan",
    title: "Website health review",
    status: "draft",
    content_revision: 4,
    executive_summary: "Overall condition is clear.",
    overall_summary: "This is a reviewed website health report.",
    main_strengths: "HTTPS is configured.",
    main_concerns: "One broken link needs attention.",
    recommended_first_steps: "Repair the broken link.",
    scope_limitations: "Public pages only.",
    display_settings_json: {},
    last_preview_generated_at: new Date(),
  } as OperationsReportRow;
}

function readyFinding() {
  return {
    id: "finding",
    is_included: true,
    is_false_positive: false,
    client_priority: "important",
    title: "Broken client link",
    client_explanation: "A page links to a destination that is unavailable.",
    why_it_matters: "Visitors can lose trust and abandon the journey.",
    recommended_action: "Replace or repair the link.",
    affected_url: "https://example.test/contact",
    affected_url_note: null,
    reviewed_at: new Date(),
    requires_merge_review: false,
  } as OperationsReportFindingRow;
}

test("historical report states are final and complete", () => {
  assert.deepEqual(
    [...HISTORICAL_REPORT_STATUSES],
    [
      "sent",
      "client_replied",
      "fixes_quoted",
      "work_in_progress",
      "completed",
      "archived",
    ],
  );
  assert.equal(isHistoricalReportStatus("sent"), true);
  assert.equal(isHistoricalReportStatus("draft"), false);
});

test("historical quote states include sent and every post-send state", () => {
  assert.deepEqual(
    [...HISTORICAL_QUOTE_STATUSES],
    [
      "sent",
      "accepted",
      "declined",
      "expired",
      "cancelled",
      "converted_to_work",
    ],
  );
  assert.equal(isHistoricalQuoteStatus("sent"), true);
  assert.equal(isHistoricalQuoteStatus("ready_to_send"), false);
});

test("only sent and received Communications are historical evidence", () => {
  assert.deepEqual(
    [...HISTORICAL_COMMUNICATION_STATUSES],
    ["sent", "received"],
  );
  assert.equal(isHistoricalCommunicationStatus("sent"), true);
  assert.equal(isHistoricalCommunicationStatus("received"), true);
  assert.equal(isHistoricalCommunicationStatus("cancelled"), false);
});

test("linked action-plan items inherit readiness from their reviewed finding", () => {
  const report = readyReport();
  const finding = readyFinding();
  const linkedAction = {
    id: "linked-action",
    report_finding_id: finding.id,
    title: "Repair the broken link",
    summary: "Replace the missing destination.",
    is_included: true,
    reviewed_at: null,
  } as OperationsReportActionPlanItemRow;
  const standaloneAction = {
    ...linkedAction,
    id: "standalone-action",
    report_finding_id: null,
  } as OperationsReportActionPlanItemRow;

  assert.equal(
    getOperationsReportReadinessIssues(report, [finding], [], [linkedAction], {
      requirePreview: true,
    }).some((issue) => issue.code === "action_plan_item_unreviewed"),
    false,
  );
  assert.equal(
    getOperationsReportReadinessIssues(
      report,
      [finding],
      [],
      [standaloneAction],
      { requirePreview: true },
    ).some((issue) => issue.code === "action_plan_item_unreviewed"),
    true,
  );
});

test("report approval is current only for the approved content revision", () => {
  const report = {
    ...readyReport(),
    approved_at: new Date(),
    approved_by_user_id: "reviewer",
    approved_content_revision: 4,
  } as OperationsReportRow;
  assert.equal(isOperationsReportApprovalCurrent(report), true);
  report.content_revision = 5;
  assert.equal(isOperationsReportApprovalCurrent(report), false);
});
