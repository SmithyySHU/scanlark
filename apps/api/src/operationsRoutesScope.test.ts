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
