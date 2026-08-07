import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";

// These are the high-risk child boundaries identified by A6.  Keeping this
// list explicit makes a future removal of the workspace predicate fail at the
// repository boundary, before a route can accidentally hide it.
const requiredScopedExports: Record<string, string[]> = {
  "operationsReports.ts": [
    "updateOperationsReportFinding",
    "updateOperationsReportPositiveObservation",
    "updateOperationsReportActionPlanItem",
    "bulkUpdateOperationsReportFindings",
    "reorderOperationsReportFindings",
    "updateOperationsReportComparisonItem",
    "getOperationsReportPdfRender",
    "saveOperationsReportPdfRender",
    "deleteOperationsReport",
  ],
  "operationsQuotesWork.ts": [
    "updateOperationsQuoteItem",
    "deleteOperationsQuoteItem",
    "reorderOperationsQuoteItems",
    "updateOperationsQuoteAccessRequirement",
    "deleteOperationsQuoteAccessRequirement",
    "updateOperationsWorkItem",
    "reorderOperationsWorkItems",
    "updateOperationsWorkOrderAccessRequirement",
    "deleteOperationsWorkOrderAccessRequirement",
  ],
  "operationsCommunications.ts": [
    "updateOperationsCommunication",
    "markOperationsCommunicationSent",
    "markOperationsCommunicationReceived",
    "completeOperationsCommunicationFollowUp",
    "cancelOperationsCommunication",
    "updateOperationsTask",
    "completeOperationsTask",
    "snoozeOperationsTask",
    "cancelOperationsTask",
  ],
  "operationsServices.ts": [
    "updateOperationsClientServiceSite",
    "removeOperationsClientServiceSite",
    "listOperationsClientServiceUsage",
    "updateOperationsClientServiceUsage",
    "deleteOperationsClientServiceUsage",
    "markOperationsServiceReviewComplete",
    "createOperationsServiceMonthlyReport",
  ],
};

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `missing exported function ${name}`);
  const nextExport = source.indexOf("\nexport ", start + 8);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

test("high-risk child repository exports retain SQL workspace predicates", () => {
  const root = dirname(new URL(import.meta.url).pathname);
  const failures: string[] = [];
  for (const [module, names] of Object.entries(requiredScopedExports)) {
    const source = readFileSync(join(root, module), "utf8");
    for (const name of names) {
      const body = functionBody(source, name);
      if (!/internal_workspace_id/.test(body))
        failures.push(`${module}:${name}`);
    }
  }
  assert.deepEqual(
    failures,
    [],
    `child exports without SQL workspace scope: ${failures.join(", ")}`,
  );
});
