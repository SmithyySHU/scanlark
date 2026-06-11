# Operations And Developer Notes

This document covers setup areas that are easy to misconfigure during alpha.

## Environment Variables

Core:

- `DATABASE_URL`: required by API, worker, DB helpers, and event relay.
- `PORT`: API listen port, default `3001`.
- `WEB_ORIGIN`: allowed browser origin for CORS/SSE, default local web origin.
- `API_ORIGIN`: API origin used by frontend defaults.
- `APP_URL` or `APP_BASE_URL`: web base URL used in email links.

Auth:

- `DEV_BYPASS_AUTH=true`: local-only auth bypass.
- `DEMO_USER_EMAIL`: user created/loaded when bypass is enabled.
- `AUTH_COOKIE_NAME`: session cookie name.
- `SESSION_SECRET`: 32+ character secret required when bypass is off.
- `NODE_ENV`: affects secure cookies and production-like secret enforcement.

Worker:

- `API_INTERNAL_TOKEN`: shared API/worker token for scheduled scan notify calls.
- `WORKER_API_BASE`: API base used by the worker, default
  `http://localhost:3001`.
- `UPTIME_TICK_MS`: uptime loop delay, default `60000`.
- `UPTIME_BATCH_SIZE`: number of due uptime monitors claimed per tick, default
  `25`.

Email:

- `EMAIL_ENABLED=true`: enables live SMTP delivery.
- `EMAIL_FROM`: sender identity.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: SMTP transport settings.
- `EMAIL_TEST_TO`: optional override for test-alert endpoint.

Report shares:

- `REPORT_SHARE_TOKEN_SECRET`: required outside development/test. Use a stable
  secret so existing share links continue to verify across restarts/deploys.

## Migrations

Migration files live in `packages/db/migrations/`.

Apply every file in sorted filename order:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Current caveat: there are duplicate numeric prefixes (`015_*`, `023_*`), so do
not build tooling that assumes one file per number.

Migrations are idempotent where practical, but a fresh alpha database should be
created and migrated from scratch before release.

## Worker Operations

Run locally:

```bash
npm run dev:worker
```

The worker starts four loops:

- scan job loop: claims and processes queued scan jobs.
- reaper loop: recovers expired or stale scan jobs.
- scheduler loop: creates scan jobs for due site schedules.
- uptime loop: claims due uptime monitors and records availability checks.

Useful log markers:

- `[worker ...] claimed|started|completed|failed|requeued`
- `[reaper ...] started`
- `[scheduler ...] due=... enqueued=... skipped=...`
- `[uptime ...] due=... checking ... recorded ...`

Scheduled scan notifications require `API_INTERNAL_TOKEN` to match between API
and worker.

## Email And SMTP

Every attempted email is written to `email_outbox`.

If `EMAIL_ENABLED` is not exactly `true`, Scanlark logs the send and stops
before SMTP delivery. This is useful for development.

For local live email testing, run a tool such as Mailpit on `127.0.0.1:1025`
and set:

```bash
EMAIL_ENABLED=true
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
```

The site-level "send test alert" route uses `EMAIL_TEST_TO` when set; otherwise
it sends to the site's notification email.

## Uptime Monitoring

Tables:

- `site_uptime_settings`
- `uptime_checks`
- `uptime_incidents`

Flow:

1. Site settings enable uptime and set `check_url`.
2. Worker `claimDueUptimeMonitors` claims enabled rows where `next_check_at` is
   due or null.
3. Worker calls `checkUptime`.
4. Worker calls `recordUptimeCheck`.
5. Dashboard reads latest check state from `GET /sites/:siteId/uptime`.

Checks are passive HTTP(S) requests through the same public-destination safety
model used by crawler resource fetching.

## Notifications

In-app notifications:

- created in `packages/db/src/appNotifications.ts`.
- exposed by `/notifications` API routes.
- read by web notification drawer in `apps/web/src/app.tsx`.
- updated live over `/events/stream`.

Email notifications:

- assembled in `apps/api/src/notifyOnScanComplete.ts`.
- sent/logged in `apps/api/src/email.ts`.
- de-duplicated through DB notification events.

Uptime down/recovered notifications are created from
`packages/db/src/uptimeMonitors.ts` when incidents cross thresholds or recover.

## Reports, Shares, And PDF

Authenticated report route:

- frontend: `/report?scanRunId=...`
- API: `/scan-runs/:scanRunId/report` plus related issues/links endpoints.

Shared report route:

- frontend: `/shared-reports/:token`
- API: `/public/reports/:token/...`

Share tokens are generated and verified by `packages/db/src/reportShares.ts`.

PDF export is browser print based. The report view exposes print styling through
`@media print` blocks in `apps/web/src/app.tsx`; `print=1` opens the report in a
print-ready state and `handlePrintReport` calls `window.print()`.

## Deployment/Beta Checklist

- Use a real `SESSION_SECRET` and disable `DEV_BYPASS_AUTH`.
- Set `REPORT_SHARE_TOKEN_SECRET`.
- Set production `WEB_ORIGIN`, `API_ORIGIN`, and `APP_URL`.
- Run migrations against the target DB.
- Start API and worker as separate long-running services.
- Confirm worker logs scan scheduler and uptime ticks.
- Configure SMTP or intentionally leave email disabled and monitor outbox.
- Confirm CORS/SSE works from the deployed web origin.
- Run the alpha checklist in `docs/ALPHA_READINESS.md`.

## Known Limitations

- No managed production auth provider yet.
- No automated integration/e2e test suite.
- Frontend is concentrated in one large app file.
- Browser print is the PDF flow; there is no server-side PDF renderer.
- Crawl checks are passive and intentionally avoid private/internal targets.
- Existing root `npm run typecheck` only covers crawler and DB; use the full
  command set from README for API/worker/web.
