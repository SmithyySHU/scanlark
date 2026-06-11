# Developer Guide

This is the practical local development guide. For feature ownership, see
[CODEBASE_MAP.md](CODEBASE_MAP.md). For deployment, worker, SMTP, uptime,
notifications, share links, and known limitations, see
[OPERATIONS.md](OPERATIONS.md). For release validation, see
[ALPHA_READINESS.md](ALPHA_READINESS.md).

## Prerequisites

- Node.js 18+.
- PostgreSQL.
- Root `.env` based on `.env.example`.
- `DATABASE_URL` set.
- `API_INTERNAL_TOKEN` set for API/worker notification callbacks.

For local auth, either set `DEV_BYPASS_AUTH=true` and `DEMO_USER_EMAIL`, or set
a 32+ character `SESSION_SECRET` and use the normal auth flow.

## Install

```bash
npm ci
```

## Migrations

Apply all SQL files in sorted filename order:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Do not assume the numeric prefix is unique. The repo currently has duplicate
`015_*` and `023_*` prefixes, and every file matters.

## Run Services

Use separate terminals:

```bash
# API, default http://localhost:3001
npm run dev:api

# Web, default Vite dev URL http://localhost:5173
npm run dev:web

# Worker: scan jobs, scheduler, reaper, uptime checks
npm run dev:worker
```

Optional helpers:

```bash
# DB connection smoke test
npm run dev:db

# One-off crawler run, persisted to an existing site
npm run scan:once -- <siteId> <startUrl>

# Print latest scan data
npm run demo:latest-scan

# Print site history
npm run demo:site-history -- <siteId>

# Schedule demo helper
npm run -w @scanlark/db demo:schedule
```

## Current Behavior

- The web app is a React/Vite SPA with custom route parsing in
  `apps/web/src/app.tsx`.
- The API is an Express app; most routes currently live in
  `apps/api/src/index.ts`.
- The worker runs scan-job, reaper, scheduler, and uptime loops.
- Manual scans are created through the API and queued as scan jobs.
- Scheduled scans are enqueued by the worker when `next_scheduled_at` is due.
- Uptime checks are claimed by the worker from `site_uptime_settings` and
  recorded in `uptime_checks`.
- Email attempts always write to `email_outbox`; SMTP sends only happen when
  `EMAIL_ENABLED=true`.
- Shared reports are public token routes backed by `report_shares`.
- Browser print is the PDF/save-as-PDF flow.

## Key Local Endpoints

Base API URL defaults to `http://localhost:3001`.

- `GET /health`
- `GET /me`
- `GET /sites`
- `POST /sites`
- `GET /sites/:siteId/dashboard-summary`
- `POST /sites/:siteId/scans`
- `GET /sites/:siteId/scans`
- `GET/PUT /sites/:siteId/schedule`
- `GET/PATCH /sites/:siteId/notification-settings`
- `GET/PUT /sites/:siteId/uptime`
- `GET/POST /sites/:siteId/ignore-rules`
- `GET /scan-runs/:scanRunId`
- `GET /scan-runs/:scanRunId/report`
- `GET /scan-runs/:scanRunId/issues`
- `GET /scan-runs/:scanRunId/links`
- `GET /scan-runs/:scanRunId/ignored`
- `GET/POST/DELETE /scan-runs/:scanRunId/share`
- `GET /public/reports/:token/report`
- `GET /events/stream`

## Checks

Run the full alpha gate before handing off work:

```bash
npm run typecheck
npm run -w @scanlark/db typecheck
npm run -w @scanlark/crawler typecheck
npm run -w @scanlark/api typecheck
npm run -w @scanlark/worker typecheck
npm run -w @scanlark/web typecheck
npm run -w @scanlark/web build
npm run format:check
git diff --check
```

The web build currently emits a chunk-size warning because most UI is in one
large SPA bundle; this is not a build failure.

## Troubleshooting

- Missing tables/columns: migrations are incomplete or out of order.
- Auth fails locally: check `DEV_BYPASS_AUTH`, `DEMO_USER_EMAIL`, and
  `SESSION_SECRET`.
- API logs wrong origin in email links: set `APP_URL` or `APP_BASE_URL`.
- Scheduled scans do not run: start the worker and check `API_INTERNAL_TOKEN`.
- Uptime does not update: start the worker and inspect `site_uptime_settings`.
- In-app notifications do not live-update: check API event relay logs and
  `/events/stream`.
- Email does not send: check `EMAIL_ENABLED`, SMTP settings, and
  `email_outbox`.
- Share links fail outside development/test: set `REPORT_SHARE_TOKEN_SECRET`.
