import { spawnSync } from "node:child_process";
import { URL } from "node:url";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error(
    "Workspace isolation verification requires loopback PostgreSQL",
  );
}
if (!/test|audit|verify/i.test(parsed.pathname.slice(1))) {
  throw new Error(
    "Workspace isolation verification requires a disposable database name",
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Workspace isolation verification cannot run in production");
}

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "packages/db/src/operationsWorkspaceScope.test.ts",
  ],
  { stdio: "inherit", env: process.env },
);

if (result.status !== 0) process.exit(result.status ?? 1);
console.log("Workspace isolation contract passed");
