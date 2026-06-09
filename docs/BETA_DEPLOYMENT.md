# Beta Deployment Runbook

Scanlark private beta is a multi-process deployment:

1. PostgreSQL
2. API
3. Web
4. Worker

The product surface stays the same in beta. This runbook is for safer startup,
runtime configuration, and rollout discipline.

## Required Environment Variables

### Shared

- `DATABASE_URL`

### API

Required in production-like mode:

- `SESSION_SECRET`
- `WEB_ORIGIN`
- `APP_BASE_URL` or `APP_URL`
- `API_INTERNAL_TOKEN`
- `REPORT_SHARE_TOKEN_SECRET`

Optional / local-only:

- `DEV_BYPASS_AUTH=true`
- `AUTH_COOKIE_NAME`
- `AUTH_TOKEN_TTL_DAYS`
- `EMAIL_TEST_TO`
- `DEMO_USER_EMAIL`

Email only when enabled:

- `EMAIL_ENABLED=true`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER` and `SMTP_PASS` together when authenticated SMTP is required

### Worker

Required in production-like mode:

- `WORKER_API_BASE`
- `API_INTERNAL_TOKEN`

Worker also requires:

- `DATABASE_URL`

## Migrations

Apply migrations in filename order:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

Production guidance:

- take a backup before running migrations
- block rollout until migrations complete successfully
- verify the expected tables/columns after migration
- historical migrations may not be perfectly rerunnable on every existing
  database shape; treat them as schema history
- future migrations should be idempotent where practical

## Startup Order

1. Start PostgreSQL.
2. Apply DB migrations.
3. Start the API and wait for `GET /health` and `GET /ready` to succeed.
4. Start the web app after API base URLs are correct.
5. Start the worker after the API is reachable and `API_INTERNAL_TOKEN`
   matches on both services.

## Restart Guidance

### API restart

- safe for dashboard/report/share/PDF reads once the process comes back up
- confirm `GET /ready` before shifting traffic back
- if auth or public share routes fail on startup, check runtime config first

### Worker restart

- scheduled scans and uptime checks resume when the worker returns
- worker and API must share the same `API_INTERNAL_TOKEN`
- if scheduled jobs do not advance after restart, inspect worker logs and DB
  `scan_jobs` / `scan_runs` state
- send `SIGTERM` or `SIGINT` for normal shutdown; the worker stops claiming new
  scan jobs, scheduled scans, and uptime checks before exiting
- the worker allows in-flight work to finish where practical, but forces exit
  after its graceful shutdown timeout if a task does not return
- after restart, expired running jobs are recovered by the reaper loop and their
  associated `scan_runs` are reset from `in_progress` to `queued` or `failed`
  based on remaining attempts

## Playwright / PDF Notes

PDF export depends on Playwright in the API runtime.

Deployment requirements:

- Playwright package installed in the API environment
- browser binary available for runtime PDF generation
- host OS packages required by Playwright/Chromium installed

If PDF export fails in a deployment but works locally, verify browser binaries
and Chromium runtime dependencies first.

Recommended validation commands:

```bash
npx playwright install chromium
```

On Linux hosts that do not already include Chromium dependencies:

```bash
npx playwright install --with-deps chromium
```

Beta API guardrails:

- public tokenized report routes send `X-Robots-Tag: noindex, nofollow`
- public tokenized report routes send `Cache-Control: private, no-store`
- public PDF export is rate limited more strictly than public JSON views
- PDF generation failures return client-safe errors; production responses do not
  expose Playwright internals or stack traces
- PDF generation is bounded by explicit API and renderer timeouts; requests
  should fail rather than hang indefinitely
- after deploy, verify one authenticated PDF export and one shared PDF export
  end-to-end before treating the environment as ready

## SMTP / Email Notes

- Scanlark always attempts to write email intent to `email_outbox`
- live SMTP delivery only happens when `EMAIL_ENABLED=true`
- when authenticated SMTP is used, `SMTP_USER` and `SMTP_PASS` must both be set
- failed delivery should be investigated in API logs and `email_outbox`
- `POST /sites/:siteId/notifications/test` is the existing test-email path
- leave `EMAIL_ENABLED` unset or `false` in local/dev when only validating outbox
  writes and notification flow
- common SMTP failures in beta are missing credentials, blocked outbound SMTP,
  missing TLS support on the chosen port, or absent sender/domain approval

## Worker Logging and Recovery

- worker logs are structured JSON and include `event`, `message`, and relevant
  IDs such as `jobId`, `siteId`, `scanRunId`, or `monitorId`
- scan loop, scheduler loop, reaper loop, and uptime loop are supervised
  independently; a failure in one loop is logged and does not stop the others
- scan job lease expiry recovery is handled by the reaper loop
- expired running jobs are requeued only while attempts remain; exhausted jobs
  are marked failed instead of being retried forever
- uptime check failures are logged per monitor and do not stop the uptime loop
- notification request failures are logged with scan run or incident IDs; tokens
  and secrets are not logged

## API Rate Limits and Errors

- auth endpoints are rate limited per IP
- site create/update, manual scan trigger, scan retry, and share create/revoke
  are rate limited per user-scoped key
- public shared report JSON is rate limited per token and IP
- public shared report PDF is rate limited more strictly per token and IP
- SSE scan progress connections are limited concurrently per user and scan run
- rate limit responses use HTTP `429`, error code `rate_limited`, and
  `Retry-After` where practical
- internal errors keep full detail in server logs; production API responses omit
  raw exception details
- look for `event: "api.rate_limited"` in API logs when diagnosing request
  throttling

## Failure Runbook

### PDF export failing

- verify the API is healthy on `/health` and `/ready`
- verify Playwright browser binaries are installed
- verify host OS Chromium dependencies are present
- retry an authenticated PDF and a shared PDF
- inspect API logs for PDF export failures with `scanRunId` and route context

### SMTP failing

- verify `EMAIL_ENABLED=true`
- verify `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, and paired SMTP auth vars
- use `POST /sites/:siteId/notifications/test`
- check API logs for SMTP send failures
- check `email_outbox` for attempted send records

### Worker stopped

- restart the worker
- confirm API and worker share the same `API_INTERNAL_TOKEN`
- inspect worker logs for loop or shutdown events
- confirm scheduled scans and uptime checks resume

### Stuck scan run or scan job

- inspect `scan_jobs` and `scan_runs`
- expired running jobs should be recovered by the worker reaper loop
- if the worker was down, restart it and confirm recovery occurs
- if scans still do not advance, inspect worker and API logs for the affected
  `scanRunId`

### Uptime alerts not sending

- verify uptime monitoring is enabled for the site
- verify site notification settings allow email
- verify SMTP config and `EMAIL_ENABLED=true`
- inspect API logs and `email_outbox`
- inspect worker logs for uptime incident notify failures

### Public share link returns 404

- verify the share has not been revoked
- verify the scan run is still the intended shared run
- verify `REPORT_SHARE_TOKEN_SECRET` is correct for the environment
- avoid logging or copying raw tokens into shared diagnostics

### Migration failed

- stop rollout
- restore from backup if needed
- fix the migration issue before starting API/worker on the new code
- verify schema shape after rerun before resuming rollout

## Beta Smoke Checklist

- apply migrations
- verify required env vars for API and worker
- create a real account with dev bypass off
- log in through the normal auth flow
- add a real site
- run a manual scan
- wait for the report to complete
- verify dashboard, report, shared report, and PDF export
- enable a schedule and confirm the worker processes the run
- enable uptime monitoring and confirm checks appear
- send a test email
- create and revoke a share link
- request the shared report repeatedly and confirm the API eventually returns
  `429`
- request the shared PDF repeatedly and confirm the API eventually returns `429`
- restart API and confirm `/health` and `/ready`
- restart worker and confirm scheduled scans continue
- inspect API and worker logs for rate limit, PDF, SMTP, worker, and recovery
  events
- stop the worker with `SIGTERM` and confirm it logs shutdown start, drains
  current work, and exits cleanly or times out explicitly
