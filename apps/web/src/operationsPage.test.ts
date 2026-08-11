import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./components/OperationsPage.tsx", import.meta.url),
  "utf8",
);
const reportWorkspaceSource = readFileSync(
  new URL(
    "./components/operations/reports/OperationsReportWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("action-plan patch function accepts source item context", () => {
  assert.match(
    source,
    /async function patchActionPlanItem\(\s*itemId: string,\s*input: Record<string, unknown>,\s*sourceItem\?: OperationsReportActionPlanItem,?\s*\)/,
  );
});

test("patch path sends direct selected action-plan item id", () => {
  assert.match(
    source,
    /let res = await sendActionPlanPatch\(\s*itemId,\s*\(input\.expectedRevision as number \| undefined\)\s*\?\?\s*reportDetail\?\.report\.content_revision,\s*\)/,
  );
});

test("action-plan 404 response uses report refresh recovery", () => {
  assert.match(
    source,
    /if \(res\.status === 404\) \{\s*const refreshed = await refreshActionPlanState\(\);/,
  );
  assert.match(
    source,
    /const recovery =[\s\S]*\brefreshed\.recovery\s*\?\?\s*\(/,
  );
  assert.match(
    source,
    /if \(!recovery\.replacementItemId\) \{\s*setActionError\(\s*"Action plan item no longer matches this report/,
  );
});

test("workaround route-level remap has been removed", () => {
  assert.doesNotMatch(source, /resolvePatchTargetFromReport/);
  assert.doesNotMatch(source, /hydrateReportForActionPlanSave/);
  assert.match(
    source,
    /const refreshed = await refreshActionPlanState\(\);\s*const recovery =/,
  );
});

test("source item is passed from action-plan editor into patch handler", () => {
  assert.match(
    reportWorkspaceSource,
    /await onPatch\(\s*item\.id,[\s\S]*item,\s*\)/,
  );
  assert.match(
    reportWorkspaceSource,
    /sourceItem\?: OperationsReportActionPlanItem,\s*\)\s*=> Promise<void>/,
  );
});
