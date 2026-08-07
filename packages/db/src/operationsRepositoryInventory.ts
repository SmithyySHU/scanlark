/** Machine-readable Batch A repository boundary inventory. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
export type OperationsRepositoryExportClass =
  | "workspace-scoped"
  | "global-infrastructure"
  | "system-admin-membership-only";

export type OperationsRepositoryInventoryEntry = {
  module: string;
  exportName: string;
  classification: OperationsRepositoryExportClass;
  justification?: string;
};

const globalExports = new Set([
  "getOperationsCommercialConfig",
  "calculateQuoteTotals",
  "getQuoteReadinessIssues",
  "buildOperationsQuotePreviewPayload",
  "getServiceActivationIssues",
  "buildServiceTaskKeys",
  "getWorkCompletionIssues",
  // Queue claimers intentionally operate across all tenant queues; each
  // claimed row still carries and is checked by its persisted workspace.
  "claimDueOperationsEmailSmtpDelivery",
  "markExpiredOperationsEmailRiskLeasesUncertain",
  "claimPendingOperationsEmailSentCopy",
  "claimDueOperationsEmailCrmFinalisation",
]);

const operationModules = [
  "operationsCrm.ts",
  "operationsReports.ts",
  "operationsQuotesWork.ts",
  "operationsCommunications.ts",
  "operationsServices.ts",
  "operationsEmail.ts",
  "operationsEmailPreparation.ts",
  "operationsEmailFinalisation.ts",
];

export const operationsRepositoryInventory: OperationsRepositoryInventoryEntry[] =
  operationModules
    .flatMap((module) => {
      const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), module),
        "utf8",
      );
      const entries: OperationsRepositoryInventoryEntry[] = [];
      const re = /export\s+async\s+function\s+(\w+)/g;
      for (const match of source.matchAll(re)) {
        const exportName = match[1]!;
        entries.push({
          module,
          exportName,
          classification: classifyOperationsRepositoryExport(exportName),
          ...(globalExports.has(exportName)
            ? {
                justification:
                  "documented global infrastructure or cross-workspace worker queue",
              }
            : {}),
        });
      }
      const syncFunctionRe = /export\s+function\s+(\w+)/g;
      for (const match of source.matchAll(syncFunctionRe)) {
        const exportName = match[1]!;
        entries.push({
          module,
          exportName,
          classification: classifyOperationsRepositoryExport(exportName),
          ...(globalExports.has(exportName)
            ? { justification: "documented global infrastructure" }
            : {}),
        });
      }
      const constFunctionRe =
        /export\s+const\s+(\w+)\s*=\s*\(([\s\S]*?)\)\s*=>/g;
      for (const match of source.matchAll(constFunctionRe)) {
        const exportName = match[1]!;
        entries.push({
          module,
          exportName,
          classification: classifyOperationsRepositoryExport(exportName),
          ...(globalExports.has(exportName)
            ? { justification: "documented global infrastructure" }
            : {}),
        });
      }
      return entries;
    })
    .concat([
      {
        module: "internalWorkspaces.ts",
        exportName: "membership-administration",
        classification: "system-admin-membership-only",
        justification:
          "adminGuard-only recovery and membership APIs; no client Operations data",
      },
      {
        module: "operations.ts",
        exportName: "document-number-counters",
        classification: "global-infrastructure",
        justification: "shared uniqueness counter exposes no client records",
      },
    ]);

export function classifyOperationsRepositoryExport(
  exportName: string,
): OperationsRepositoryExportClass {
  return globalExports.has(exportName)
    ? "global-infrastructure"
    : "workspace-scoped";
}

export const documentedGlobalOperationsRepositoryExports = [...globalExports];
