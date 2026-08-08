#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-packages/db/migrations}"
LC_ALL=C
export LC_ALL

# This script runs in postgres:16-alpine in production, so keep the guard
# POSIX-shell-only. PostgreSQL connection URIs require a database path.
migration_url="${DATABASE_URL#\'}"
migration_url="${migration_url%\'}"
migration_url="${migration_url#\"}"
migration_url="${migration_url%\"}"
case "${migration_url}" in
  *://*/*) ;;
  *) echo "migration target must be a PostgreSQL connection URI" >&2; exit 1 ;;
esac
authority_and_path="${migration_url#*://}"
authority="${authority_and_path%%/*}"
database_path="${authority_and_path#*/}"
database_name="${database_path%%\?*}"
host_port="${authority##*@}"
case "${host_port}" in
  \[*\]*) migration_host="${host_port#\[}"; migration_host="${migration_host%%\]*}" ;;
  *) migration_host="${host_port%%:*}" ;;
esac

production_compose_approval=false
if [ "${NODE_ENV:-}" = "production" ] &&
  [ "${ALLOW_NON_DISPOSABLE_MIGRATIONS:-}" = "1" ] &&
  [ "${ALLOW_PRODUCTION_MIGRATIONS:-}" = "1" ]; then
  production_compose_approval=true
fi
case "${migration_host}" in
  localhost|127.0.0.1|::1) loopback=true ;;
  *) loopback=false ;;
esac
case "${database_name}" in
  *test*|*TEST*|*audit*|*AUDIT*|*verify*|*VERIFY*) disposable=true ;;
  *) disposable=false ;;
esac
if [ "${loopback}" != true ] && [ "${production_compose_approval}" != true ]; then
  echo "migration target must be loopback unless explicitly approved for production Compose" >&2
  exit 1
fi
if [ "${disposable}" != true ] && [ "${production_compose_approval}" != true ]; then
  echo "migration target must be disposable unless explicitly approved for production Compose" >&2
  exit 1
fi
if [ "${NODE_ENV:-}" = "production" ] && [ "${production_compose_approval}" != true ]; then
  echo "production migrations require explicit Compose approval" >&2
  exit 1
fi

psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -c 'CREATE TABLE IF NOT EXISTS scanlark_schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
for migration in "${MIGRATIONS_DIR}"/*.sql; do
  [ -f "${migration}" ] || continue
  filename="$(basename "${migration}")"
  applied="$(printf '%s\n' "SELECT 1 FROM scanlark_schema_migrations WHERE filename = :'filename';" | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -v filename="${filename}" -At)"
  if [ "${applied}" = "1" ]; then
    echo "Skipping ${migration} (already applied)"
    continue
  fi
  echo "Applying ${migration}"
  psql "${DATABASE_URL}" --single-transaction -v ON_ERROR_STOP=1 -f "${migration}"
  printf '%s\n' "INSERT INTO scanlark_schema_migrations(filename) VALUES (:'filename') ON CONFLICT (filename) DO NOTHING;" | psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -v filename="${filename}"
done
