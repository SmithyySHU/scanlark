import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("./routes/operations.ts", import.meta.url),
  "utf8",
);
const scopeSource = readFileSync(
  new URL("../../../packages/db/src/operationsScope.ts", import.meta.url),
  "utf8",
);

test("Action plan PATCH uses dedicated scoped param and kind", () => {
  assert.equal(
    routeSource.includes('actionPlanItemId: "action_plan_item"'),
    true,
  );
  assert.equal(
    routeSource.includes(
      "/reports/:reportId/action-plan-items/:actionPlanItemId",
    ),
    true,
  );
  assert.equal(
    routeSource.includes('getUuidParam(req, res, "actionPlanItemId")'),
    true,
  );
  assert.equal(routeSource.includes('itemId: "quote_or_work_item"'), true);
});

test("Action plan scope remains workspace-owned through dedicated resource kind", () => {
  assert.match(
    scopeSource,
    /action_plan_item:\s*`[\s\S]*operations_report_action_plan_items/i,
  );
  assert.equal(scopeSource.includes('"action_plan_item"'), true);
});

test("Action Plan workspace batch uses one report-scoped repository mutation", () => {
  assert.match(routeSource, /"\/reports\/:reportId\/action-plan"/);
  assert.match(
    routeSource,
    /await updateOperationsReportActionPlanBatch\(\s*getWorkspaceId\(req\),\s*getActor\(req\),\s*reportId,\s*parseOperationsReportActionPlanBatchUpdateInput\(req\.body\),/,
  );
  assert.match(
    routeSource,
    /return res\.json\(\{ report: serializeObject\(report\) \}\)/,
  );
});

test("final PDF generation advances the scoped report to ready-to-send", () => {
  const route = routeSource.slice(
    routeSource.indexOf('router.post("/reports/:reportId/generate-pdf"'),
    routeSource.indexOf('router.get("/reports/:reportId/download"'),
  );
  assert.match(route, /await saveOperationsReportPdfRender\(/);
  assert.match(
    route,
    /await markOperationsReportStatus\(\s*getWorkspaceId\(req\),\s*getActor\(req\),\s*reportId,\s*"ready_to_send",/,
  );
  assert.match(route, /"report_not_ready_after_pdf"/);
});

test("record-sent exposes repository finalisation readiness failures", () => {
  const route = routeSource.slice(
    routeSource.indexOf('router.post("/reports/:reportId/record-sent"'),
    routeSource.indexOf('router.post("/reports/:reportId/record-client-reply"'),
  );
  assert.match(route, /"readinessIssues" in result/);
  assert.match(route, /"report_not_ready_to_send"/);
});
