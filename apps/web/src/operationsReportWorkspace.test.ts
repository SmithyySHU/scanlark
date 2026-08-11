import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "./components/operations/reports/OperationsReportWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("mobile finding focus trap does not rerun for controlled draft edits", () => {
  assert.match(source, /const closeFindingDetail = useCallback\(/);
  assert.match(source, /onBack=\{closeFindingDetail\}/);
  assert.match(source, /\}, \[finding\.id, onBack, trapFocus\]\);/);
  assert.doesNotMatch(
    source,
    /onBack=\{\(\) => setFindingDetailOpen\(false\)\}/,
  );
});

test("finding lifecycle actions save draft content in the same revision-bound request", () => {
  assert.match(
    source,
    /const saveWithFindingPatch = async \(input: Record<string, unknown>\) => \{\s*await onSave\(\{ findingPatch: input \}\);/,
  );
  assert.match(source, /\.\.\.options\?\.findingPatch,/);
  assert.doesNotMatch(
    source,
    /await onSave\(\);\s*await onPatchFinding\(finding\.id,/,
  );
});

test("action-plan stale recovery hides stale row and clears stale dirty key", () => {
  assert.match(
    source,
    /actionPlanPatchRecovery: \{\s*staleItemId: string;\s*replacementItemId: string \| null;\s*\} \| null/,
  );
  assert.match(
    source,
    /const visibleActionPlanItemsWithRecovery = visibleActionPlanItems\.filter\(/,
  );
  assert.match(source, /item.id !== actionPlanPatchRecovery\.staleItemId/);
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(!actionPlanPatchRecovery\) return;\s*setChildDirty\(/,
  );
  assert.match(
    source,
    /`action-\$\{actionPlanPatchRecovery\.staleItemId\}`, false\);/,
  );
});

test("action plan row list uses recovery-filtered items", () => {
  assert.match(source, /items={visibleActionPlanItemsWithRecovery}/);
});

test("action-plan save resolves mutable IDs through a resolver callback", () => {
  assert.match(
    source,
    /resolveActionPlanPatchItemId: \(itemId: string\) => string;/,
  );
  assert.match(source, /resolvePatchItemId={resolveActionPlanPatchItemId}/);
  assert.match(source, /const patchItemId = resolvePatchItemId\(item.id\);/);
  assert.match(
    source,
    /await onPatch\(patchItemId, \{\s*title: draft\.draft\.title,/s,
  );
});
