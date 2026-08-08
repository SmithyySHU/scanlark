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
