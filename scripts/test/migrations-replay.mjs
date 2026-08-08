import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import pg from "pg";

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

const expected = readdirSync(migrationDir)
  .filter((filename) => filename.endsWith(".sql"))
  .sort();
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  const result = await client.query(
    "SELECT filename FROM scanlark_schema_migrations ORDER BY filename",
  );
  assert.deepEqual(
    result.rows.map((row) => row.filename),
    expected,
    "migration ledger must store every filename as an exact value",
  );

  // Exercise the runner's psql variable binding independently of the normal
  // migration names. This catches shell-quoting regressions in production's
  // dedicated migration runner without changing application schema history.
  const fixtureDir = mkdtempSync(join(tmpdir(), "scanlark-migration-runner-"));
  const fixtureKey = randomUUID().replaceAll("-", "");
  const appliedTable = `migration_runner_${fixtureKey}_applied`;
  const failedTable = `migration_runner_${fixtureKey}_failed`;
  const laterTable = `migration_runner_${fixtureKey}_later`;
  const appliedFilename = `900_${fixtureKey}_quoted_'_filename.sql`;
  const failedFilename = `901_${fixtureKey}_intentional_failure.sql`;
  const laterFilename = `902_${fixtureKey}_must_not_run.sql`;
  writeFileSync(
    join(fixtureDir, appliedFilename),
    `CREATE TABLE ${appliedTable} (id integer PRIMARY KEY);\n`,
  );
  writeFileSync(
    join(fixtureDir, failedFilename),
    `CREATE TABLE ${failedTable} (id integer PRIMARY KEY);\nSELECT 1 / 0;\n`,
  );
  writeFileSync(
    join(fixtureDir, laterFilename),
    `CREATE TABLE ${laterTable} (id integer PRIMARY KEY);\n`,
  );
  const fixtureEnv = { ...env, MIGRATIONS_DIR: fixtureDir };
  try {
    assert.throws(
      () =>
        execFileSync("sh", ["scripts/run-migrations.sh"], { env: fixtureEnv }),
      /Command failed/,
      "a failed migration must stop the runner",
    );
    const fixtureLedger = await client.query(
      `SELECT filename FROM scanlark_schema_migrations WHERE filename = ANY($1::text[])`,
      [[appliedFilename, failedFilename, laterFilename]],
    );
    assert.deepEqual(
      fixtureLedger.rows.map((row) => row.filename),
      [appliedFilename],
    );
    const fixtureTables = await client.query(
      `SELECT to_regclass($1) AS applied, to_regclass($2) AS failed, to_regclass($3) AS later`,
      [appliedTable, failedTable, laterTable],
    );
    assert.equal(fixtureTables.rows[0].applied, appliedTable);
    assert.equal(fixtureTables.rows[0].failed, null);
    assert.equal(fixtureTables.rows[0].later, null);
  } finally {
    await client.query(
      `DELETE FROM scanlark_schema_migrations WHERE filename = $1`,
      [appliedFilename],
    );
    await client.query(`DROP TABLE IF EXISTS ${appliedTable}`);
    rmSync(fixtureDir, { recursive: true, force: true });
  }
} finally {
  await client.end();
}
console.log(
  "Migration replay passed with transaction semantics and exact ledger filenames.",
);
