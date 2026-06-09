# Dev Notes

Practical setup and API notes for local Scanlark development.

## Prereqs

- Node 18+
- PostgreSQL with `DATABASE_URL` set
- SMTP env vars only when testing live email delivery: `EMAIL_ENABLED=true`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `API_INTERNAL_TOKEN` shared by API and worker when testing scheduled scan completion callbacks
- `REPORT_SHARE_TOKEN_SECRET` when testing production-like public share behavior

## Install

```bash
npm install
```

## Run Services

```bash
# API (http://localhost:3001)
npm run dev:api

# Web app (Vite dev server)
npm run dev:web

# Scheduled scan worker
npm run dev:worker
```

Optional helpers:

```bash
# DB connection smoke test
npm run dev:db

# One-off manual crawler run, persisted to an existing site
npm run scan:once -- <siteId> <startUrl>
```

Note: `npm --workspaces run build` may print a Vite CJS deprecation warning; the build still completes successfully.

## Migrations

The SQL migrations in `packages/db/migrations/` are required project schema history and should be tracked. Apply them in filename order for a new database:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Important recent migrations:

- `015_schedule_reliability_improvements.sql`: manual/daily/weekly/monthly scheduling fields.
- `016_email_alerts_scheduled_summaries.sql`: scheduled trigger type, summaries, and notification event uniqueness.
- `017_issue_change_detection.sql`: issue state tracking and `change_status`.
- `018_scan_run_issue_generation_status.sql`: issue generation status for reports.

Migration discipline:

- apply migrations in filename order
- take a backup before production migrations
- production rollout should stop if migrations fail
- future migrations should be idempotent where practical
- historical migrations are schema history and may not be perfectly rerunnable on
  every existing database state

## Current Behaviour

- Scans can be manual or scheduled. Scheduled scans are queued by the worker and use `trigger_type = scheduled`.
- The crawler performs passive checks only: link fetches, sitemap/robots discovery, HTTPS/TLS/security-header checks, and basic static homepage performance signals.
- Crawl fetches reject localhost, loopback/private addresses, unsupported protocols, and disallowed ports.
- Reports include link results, technical diagnostics, issue summaries, issue generation status, and report scoring.
- Issue change detection marks current issues as `new` or `existing` and keeps resolved issue state for report history.
- Email writes every attempted send to `email_outbox`; live SMTP delivery only happens when `EMAIL_ENABLED=true`.
- API liveness is `GET /health`; readiness is `GET /ready`.

## Key Endpoints

Base URL: `http://localhost:3001`

- Start manual scan: `POST /sites/:siteId/scans` body `{ "startUrl": "https://example.com" }`
- Scan progress: `GET /scan-runs/:scanRunId` or SSE `GET /scan-runs/:scanRunId/events`
- Links list: `GET /scan-runs/:scanRunId/links?classification=broken&limit=50&offset=0`
- Links summary: `GET /scan-runs/:scanRunId/links/summary`
- Link occurrences: `GET /scan-links/:scanLinkId/occurrences?limit=50&offset=0`
- Diff: `GET /sites/:siteId/scan-runs/:scanRunId/diff?baseline=prev&issuesOnly=true&limit=200&offset=0`
- Diff CSV: `GET /sites/:siteId/scan-runs/:scanRunId/diff.csv?baseline=prev&issuesOnly=true`
- Ignore rules: `GET /sites/:siteId/ignore-rules`
- Notification settings: `GET /sites/:siteId/notification-settings`

## Troubleshooting

- Missing tables or columns usually means migrations were not applied in order.
- No live email with outbox rows usually means `EMAIL_ENABLED` is not `true` or SMTP env vars are incomplete.
- Scheduled scans require the worker, API, database, and matching `API_INTERNAL_TOKEN`.
- If a report shows pending or failed issue generation, check `issue_generation_status` and API/worker logs for that scan run.
- If public share routes fail in production-like mode, confirm `REPORT_SHARE_TOKEN_SECRET` is set.
- If PDF export fails in deployment, verify Playwright browser binaries and host OS dependencies.
- For local PDF setup, run `npx playwright install chromium`.
- For Linux boxes missing Chromium dependencies, run `npx playwright install --with-deps chromium`.
- To send a test email for a site, use the existing Notifications test path:
  `POST /sites/:siteId/notifications/test`
- When `EMAIL_ENABLED=false`, alert paths should still write attempted sends to
  `email_outbox` without opening SMTP connections.

For startup order, restart guidance, Playwright deployment notes, and beta smoke
checks, see
[docs/BETA_DEPLOYMENT.md](/home/smithyy/Projects/scanlark/docs/BETA_DEPLOYMENT.md).
