import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./components/OperationsPage.tsx", import.meta.url),
  "utf8",
);

test("action-plan save refreshes from stale patch and computes deterministic recovery", () => {
  assert.match(source, /const actionPlanPatchRecoveryResult = useCallback\(/);
  assert.match(source, /item\.report_finding_id != null/);
  assert.match(
    source,
    /item\.id !== staleItemId &&\s*item\.report_finding_id != null &&\s*item\.report_finding_id === staleFindingId/,
  );
  assert.match(source, /patchInput\?\.group_key === "address_now"/);
  assert.match(source, /patchInput\?\.groupKey === "address_now"/);
  assert.match(source, /if \(candidates\.length === 1\)/);
  assert.match(
    source,
    /const groupKey\s*=\s*patchInput\?\.groupKey\s*===\s*"address_now"/,
  );
  assert.match(source, /const refreshActionPlanState = async \(\) => /);
  assert.match(source, /actionPlanPatchRecoveryResult\(/);
  assert.match(source, /setActionPlanPatchRecovery\(recovery\)/);
});

test("action-plan stale 404 branch keeps user in refreshed list view", () => {
  assert.match(source, /if \(res\.status === 404\) \{/);
  assert.match(source, /const refreshed = await refreshActionPlanState\(\);/);
  assert.match(
    source,
    /Action plan item no longer matches this report\. The report has been refreshed; please choose the current item and try again\./,
  );
});

test("action-plan successful mutation updates and uses resolved ID", () => {
  assert.match(
    source,
    /const requestItemId = resolveActionPlanPatchItemId\(itemId,\s*input\);/,
  );
  assert.match(
    source,
    /action-plan-items\/\$\{encodeURIComponent\(requestItemId\)\}/,
  );
  assert.match(
    source,
    /const staleItemHint = reportDetail\?\.actionPlanItems\.find/,
  );
  assert.match(source, /const refreshed = await refreshActionPlanState\(\);/);
  assert.match(
    source,
    /actionPlanPatchRecoveryResult\(\s*itemId,\s*refreshedReport,\s*input,/,
  );
  assert.match(source, /refreshed\.restored && refreshed\.recovery\s*\)/);
  assert.doesNotMatch(
    source,
    /Action plan item was regenerated and remapped to the current persisted item/,
  );
});

test("action-plan stale-state recovery is threaded into report workspace rendering", () => {
  assert.match(source, /actionPlanPatchRecovery={actionPlanPatchRecovery}/);
  assert.match(
    source,
    /resolveActionPlanPatchItemId={resolveActionPlanPatchItemId}/,
  );
});
