import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function collectTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

const root = process.argv[2] ?? "src";
if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Test root not found: ${root}`);
  process.exit(1);
}

const files = collectTestFiles(root).sort();
if (files.length === 0) {
  console.log(`No test files found under ${root}`);
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...files],
  {
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
