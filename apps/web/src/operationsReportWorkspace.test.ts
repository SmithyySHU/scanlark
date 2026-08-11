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

test("action-plan stale recovery still hides an obsolete persisted row", () => {
  assert.match(
    source,
    /actionPlanPatchRecovery: \{\s*staleItemId: string;\s*replacementItemId: string \| null;\s*\} \| null/,
  );
  assert.match(
    source,
    /const visibleActionPlanItemsWithRecovery = visibleActionPlanItems\.filter\(/,
  );
  assert.match(source, /item.id !== actionPlanPatchRecovery\.staleItemId/);
});

test("action plan row list uses recovery-filtered items", () => {
  assert.match(source, /items={visibleActionPlanItemsWithRecovery}/);
});

test("Action Plan and positive observation edits use one dirty batch save", () => {
  assert.match(source, /const \[dirtyActionPlanItemIds,/);
  assert.match(source, /const \[dirtyPositiveObservationIds,/);
  assert.match(source, /async function saveActionPlanChanges\(\)/);
  assert.match(
    source,
    /actionPlanItems: \[\.\.\.dirtyActionPlanItemIds\]\.map/,
  );
  assert.match(
    source,
    /positiveObservations: \[\.\.\.dirtyPositiveObservationIds\]\.map/,
  );
  assert.match(source, /Save changes/);
  assert.doesNotMatch(source, /Save action/);
  assert.doesNotMatch(source, /Save observation/);
});

test("batch save preserves the Action Plan tab and retains drafts on failure", () => {
  assert.match(
    source,
    /const \[tab, setTab\] = useState<ReportTab>\("overview"\)/,
  );
  assert.match(source, /const savedDetail = await onSaveActionPlan\(/);
  assert.doesNotMatch(
    source,
    /const savedDetail = await onSaveActionPlan\([\s\S]*?setTab\("overview"\)/,
  );
  assert.match(
    source,
    /catch \(error\) \{\s*setActionPlanSaveState\("error"\);\s*setActionPlanSaveError\(/,
  );
  assert.match(
    source,
    /disabled=\{\s*artifactReadOnly \|\|\s*actionPlanDirtyCount === 0/,
  );
});

test("leaving with dirty Action Plan drafts requires confirmation", () => {
  assert.match(
    source,
    /"You have unsaved Action Plan changes\. Leave without saving\?"/,
  );
  assert.match(source, /if \(!proceed\) return false/);
  assert.match(
    source,
    /window\.addEventListener\("scanlark:before-navigation", handleAppNavigation\)/,
  );
  assert.match(source, /event\.preventDefault\(\)/);
});

test("browser unload guard follows all report dirty state and report identity", () => {
  assert.match(
    source,
    /const actionPlanDirtyCount =\s*dirtyActionPlanItemIds\.size \+ dirtyPositiveObservationIds\.size/,
  );
  assert.match(
    source,
    /const previewStale =\s*reportDraft\.dirty \|\| findingDraft\.dirty \|\| actionPlanDirtyCount > 0/,
  );
  assert.match(
    source,
    /return registerReportBeforeUnloadGuard\(window, previewStale\)/,
  );
  assert.match(source, /\[detail\.report\.id, previewStale\]/);
  assert.match(
    source,
    /setDirtyActionPlanItemIds\(new Set\(\)\);\s*setDirtyPositiveObservationIds\(new Set\(\)\);\s*setActionPlanSaveState\("saved"\)/,
  );
  assert.doesNotMatch(source, /event\.returnValue = ""/);
});

test("report finalisation clearly separates review, approval, PDF, and delivery", () => {
  assert.match(source, /<span>Review<\/span>/);
  assert.match(source, /<span>Approval<\/span>/);
  assert.match(source, /<span>Final PDF<\/span>/);
  assert.match(source, /<span>Ready to send<\/span>/);
  assert.match(source, /"Review complete — ready for approval\."/);
  assert.match(source, /"Approved — final PDF required\."/);
  assert.match(source, /Generate final PDF and mark ready/);
  assert.match(source, /Report review: \{readinessIssues\.length\} item/);
  assert.match(
    source,
    /const reviewComplete = preview !== null && readinessIssues\.length === 0/,
  );
  assert.doesNotMatch(source, /Report readiness: \{counts\.needs_editing\}/);
});

test("ready and historical reports do not present normal editable content", () => {
  assert.match(
    source,
    /const artifactReadOnly = readOnly \|\| historicalReport \|\| readyToSendReport/,
  );
  assert.match(source, /This report is historical and cannot be edited\./);
  assert.match(source, /Reopen for editing/);
  assert.match(source, /onReopenForReview/);
  assert.match(
    source,
    /approved_content_revision[^]*?` · revision \$\{detail\.report\.approved_content_revision\}`/,
  );
});
