#!/usr/bin/env bash
set -Eeuo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
export SCANLARK_ENV_FILE="$ENV_FILE"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy .env.production.example and fill real values." >&2
  exit 1
fi

echo "==> Updating repository"
git pull --ff-only

echo "==> Pulling base images"
"${COMPOSE[@]}" pull postgres caddy migrate backup || true

echo "==> Building application images"
"${COMPOSE[@]}" build

echo "==> Starting postgres"
"${COMPOSE[@]}" up -d postgres

echo "==> Running migrations"
"${COMPOSE[@]}" --profile tools run --rm migrate

echo "==> Starting application services"
"${COMPOSE[@]}" up -d api worker web caddy

echo "==> Checking API health"
"${COMPOSE[@]}" exec -T api node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

echo "==> Service status"
"${COMPOSE[@]}" ps

echo "==> Recent logs"
"${COMPOSE[@]}" logs --tail=80 api worker caddy
