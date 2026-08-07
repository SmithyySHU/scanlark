#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/db/migrations}"

node --input-type=module <<'NODE'
import { URL } from "node:url";
const url = new URL(process.env.DATABASE_URL.replace(/^['\"]|['\"]$/g, ""));
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("migration target must be loopback");
if (!/test|audit|verify/i.test(url.pathname.slice(1)) && process.env.ALLOW_NON_DISPOSABLE_MIGRATIONS !== "1") throw new Error("migration target must be disposable");
if (process.env.NODE_ENV === "production") throw new Error("migrations cannot run in production from this script");
NODE

mapfile -t migrations < <(find "${MIGRATIONS_DIR}" -maxdepth 1 -type f -name '*.sql' -print | sort)
psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS scanlark_schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
for migration in "${migrations[@]}"; do
  filename="$(basename "${migration}")"
  if psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -Atc "SELECT 1 FROM scanlark_schema_migrations WHERE filename = '$filename'" | grep -q 1; then
    echo "Skipping ${migration} (already applied)"
    continue
  fi
  echo "Applying ${migration}"
  psql "${DATABASE_URL}" --single-transaction -v ON_ERROR_STOP=1 -f "${migration}"
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c "INSERT INTO scanlark_schema_migrations(filename) VALUES ('$filename') ON CONFLICT (filename) DO NOTHING"
done
