import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  classifyOperationsRepositoryExport,
  documentedGlobalOperationsRepositoryExports,
} from "./operationsRepositoryInventory";

const modules = [
  "operationsCrm.ts",
  "operationsReports.ts",
  "operationsQuotesWork.ts",
  "operationsCommunications.ts",
  "operationsServices.ts",
  "operationsEmail.ts",
  "operationsEmailPreparation.ts",
  "operationsEmailFinalisation.ts",
];
const workspaceInputExports = new Set([
  "saveOperationsQuotePdfRenderAtNextRevision",
]);

test("every exported Operations data function is classified and workspace-bound", () => {
  const root = dirname(new URL(import.meta.url).pathname);
  const seen = new Set<string>();
  const unsafe: string[] = [];
  for (const module of modules) {
    const source = readFileSync(join(root, module), "utf8");
    const re = /export\s+async\s+function\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/g;
    for (const match of source.matchAll(re)) {
      const name = match[1]!;
      const params = match[2] ?? "";
      seen.add(name);
      const classification = classifyOperationsRepositoryExport(name);
      if (
        classification === "workspace-scoped" &&
        !workspaceInputExports.has(name) &&
        !/\bworkspaceId\s*:\s*string\b/.test(params)
      ) {
        unsafe.push(`${module}:${name}`);
      }
    }
    const constRe = /export\s+const\s+(\w+)\s*=\s*\(([\s\S]*?)\)\s*=>/g;
    for (const match of source.matchAll(constRe)) {
      const name = match[1]!;
      const params = match[2] ?? "";
      seen.add(name);
      if (!/^\s*workspaceId\s*:\s*string\b/.test(params))
        unsafe.push(`${module}:${name}`);
    }
    const syncRe = /export\s+function\s+(\w+)/g;
    for (const match of source.matchAll(syncRe)) seen.add(match[1]!);
  }
  assert.deepEqual(
    unsafe,
    [],
    `unscoped exported repository functions: ${unsafe.join(", ")}`,
  );
  for (const name of documentedGlobalOperationsRepositoryExports) {
    assert.ok(
      seen.has(name),
      `documented global export ${name} is missing from source`,
    );
  }
});
