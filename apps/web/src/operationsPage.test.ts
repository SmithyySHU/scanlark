import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./components/OperationsPage.tsx", import.meta.url),
  "utf8",
);

test("action-plan save refreshes from stale patch and computes deterministic recovery", () => {
  assert.match(source, /const actionPlanPatchRecoveryResult = useCallback\(/);
  assert.match(
    source,
    /item\.report_finding_id != null &&\s*staleItem\.report_finding_id != null/,
  );
  assert.match(
    source,
    /item\.report_finding_id === staleItem\.report_finding_id &&\s*item\.group_key === staleItem\.group_key/,
  );
  assert.match(source, /if \(candidates\.length === 1\)/);
  assert.match(
    source,
    /const recovery = refreshedReport\s*\?\s*actionPlanPatchRecoveryResult\(itemId, refreshedReport\)\s*:\s*{\s*staleItemId:\s*itemId,\s*replacementItemId:\s*null\s*}/s,
  );
  assert.match(source, /setActionPlanPatchRecovery\(recovery\)/);
});

test("action-plan stale 404 branch keeps user in refreshed list view", () => {
  assert.match(source, /if \(res\.status === 404\) \{/);
  assert.match(
    source,
    /const refreshedReport = await loadReportDetailData\(\);/,
  );
  assert.match(source, /await loadReportPreview\(\);/);
  assert.match(
    source,
    /Action plan item no longer matches this report|Action plan item was regenerated and remapped to the current persisted item/,
  );
});

test("action-plan stale-state recovery is threaded into report workspace rendering", () => {
  assert.match(source, /actionPlanPatchRecovery={actionPlanPatchRecovery}/);
});
