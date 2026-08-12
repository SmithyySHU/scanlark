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
const appSource = readFileSync(new URL("./app.tsx", import.meta.url), "utf8");

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
  assert.match(reportWorkspaceSource, /onChange\(item\.id, patch\)/);
});

test("batch Action Plan save updates detail in place without loading remount", () => {
  assert.match(
    source,
    /async function saveReportActionPlan\([\s\S]*?\/action-plan`/,
  );
  assert.match(
    source,
    /const data = \(await res\.json\(\)\) as \{ report: OperationsReportDetail \};\s*setReportDetail\(data\.report\)/,
  );
  assert.doesNotMatch(
    source,
    /async function saveReportActionPlan\([\s\S]*?loadReportDetail\(\)[\s\S]*?return data\.report/,
  );
});

test("Action Plan batch save is wired into the report workspace", () => {
  assert.match(source, /onSaveActionPlan=\{saveReportActionPlan\}/);
});

test("app navigation honours the report workspace unsaved-change blocker", () => {
  assert.match(
    appSource,
    /new Event\("scanlark:before-navigation", \{\s*cancelable: true,/,
  );
  assert.match(
    appSource,
    /if \(!window\.dispatchEvent\(navigationEvent\)\) return/,
  );
});

test("report finalisation refreshes in place and exposes explicit reopening", () => {
  assert.match(source, /loadReportDetail\(false\)/);
  assert.match(
    source,
    /onReopenForReview=\{\(\) => runReportAction\("mark-needs-review"\)\}/,
  );
  assert.doesNotMatch(reportWorkspaceSource, /onMarkReady/);
});

test("managed-service creation blocks repeated submissions until completion", () => {
  assert.match(
    source,
    /if \(!beginServiceCreate\(serviceCreateInFlightRef\)\) return/,
  );
  assert.match(
    source,
    /finally \{\s*finishServiceCreate\(serviceCreateInFlightRef\)/,
  );
  assert.match(source, /disabled=\{serviceCreating\}/);
  assert.match(source, /Creating service…/);
});

test("central and business managed-service views load canonical scoped lists", () => {
  assert.match(
    source,
    /const \[businessServices, setBusinessServices\] = useState/,
  );
  assert.match(
    source,
    /const loadBusinessServices = useCallback[\s\S]*businessId,[\s\S]*limit: "100"/,
  );
  assert.match(source, /businessServices\.map\(\(service\)/);
  assert.doesNotMatch(
    source,
    /services\.filter\(\(service\) => service\.business_id === b\.id\)/,
  );
  assert.match(source, /No managed services for this business\./);
  assert.match(
    source,
    /includeArchived: searchParams\.get\("includeArchived"\)/,
  );
  assert.match(
    source,
    /servicesPage\.offset \+ servicesPage\.countReturned <\s*servicesPage\.totalMatching/,
  );
});

test("managed-service detail does not present server failures as not found", () => {
  assert.match(source, /if \(res\.status === 404\)/);
  assert.match(source, /setServiceDetailError\("not_found"\)/);
  assert.match(source, /Service details are temporarily unavailable\./);
  assert.match(source, /serviceDetailError === "not_found"/);
  assert.match(source, /Relationship integrity review required\./);
});
