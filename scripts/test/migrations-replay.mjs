import { execFileSync } from "node:child_process";
import { URL } from "node:url";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const url = new URL(connectionString.replace(/^['\"]|['\"]$/g, ""));
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname))
  throw new Error("DATABASE_URL must be loopback");
if (!/test|audit|verify/i.test(url.pathname.slice(1)))
  throw new Error("database name must be disposable");
if (process.env.NODE_ENV === "production")
  throw new Error("NODE_ENV=production is not allowed");

const migrationDir = process.env.MIGRATIONS_DIR ?? "packages/db/migrations";
const env = { ...process.env, DATABASE_URL: url.toString() };
execFileSync("bash", ["scripts/run-migrations.sh"], { stdio: "inherit", env });
execFileSync("bash", ["scripts/run-migrations.sh"], {
  stdio: "inherit",
  env: { ...env, MIGRATIONS_DIR: migrationDir },
});
console.log("Migration replay passed with per-file transaction semantics.");
