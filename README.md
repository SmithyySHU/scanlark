# Scanlark

Scanlark is a pre-alpha website monitoring app for client-friendly link, issue,
report, schedule, notification, and availability workflows.

It is intentionally focused on passive checks: crawl public website pages,
identify broken or blocked links, generate practical issue summaries, monitor
scheduled scans and uptime checks, and present the results in a dashboard and
shareable reports.

## Current MVP Features

- Landing page, login/register flow, onboarding, and new-site setup.
- Authenticated dashboard with site picker, scan history, reports, settings, and
  account pages.
- Manual scans and scheduled scan queueing.
- Passive crawler for public website pages, links, robots/sitemaps, HTTPS/TLS,
  security headers, mixed content, basic SEO metadata, and basic homepage
  performance signals.
- Issue generation, issue change detection, category scores, and client-friendly
  wording.
- Report history, full report view, print/save-PDF styling, CSV/JSON exports,
  and shareable public report links.
- Site settings for names/client labels, schedules, uptime monitoring, alerts,
  ignore rules, advanced diagnostics, and deletion.
- Account profile and notification preferences.
- In-app notifications, SSE updates, email outbox, and optional SMTP delivery.
- Scanlark Learn article content.

## App Routes

Frontend routes are parsed in `apps/web/src/app.tsx`; there is no separate
router package.

- `/` and `/landing`: marketing landing page.
- `/login`: login and registration.
- `/onboarding`: first-site onboarding flow.
- `/sites/new`: add another site.
- `/dashboard`: main dashboard for the selected site.
- `/dashboard/select-site`: site picker.
- `/dashboard/reports`: report history and report workspace.
- `/sites/:siteId/settings?tab=...`: canonical site settings route.
- `/dashboard/settings?tab=...`: legacy/site-selection-compatible settings route.
- `/dashboard/account`: account profile and notification preferences.
- `/report?scanRunId=...`: authenticated report view.
- `/report?scanRunId=...&print=1`: report view prepared for browser print/PDF.
- `/shared-reports/:token`: public shared report view.
- `/learn` and `/learn/:slug`: Scanlark Learn index and article pages.

Compatibility redirects/normalization exist for `/app...` and
`/shared-results/:token`.

## Monorepo Structure

```txt
apps/
  api/        Express API, auth/session middleware, notifications, SSE, shares
  web/        React/Vite single page app
  worker/     scan job worker, scheduler/reaper loops, uptime loop
packages/
  crawler/    crawling, link validation, site checks, uptime HTTP checks
  db/         SQL migrations, query helpers, event emission
docs/         developer docs, checklists, feature notes
```

See [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) for a feature-by-feature map.

## Local Setup

Requirements:

- Node.js 18+.
- PostgreSQL.
- A root `.env` file based on `.env.example`.

Install dependencies:

```bash
npm ci
```

Create a database, then set `DATABASE_URL` in `.env`.

Apply migrations in filename order:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

There are duplicate numeric prefixes (`015_*`, `023_*`), so apply by sorted
filename, not by assuming numeric uniqueness.

## Environment Variables

Required for normal local development:

- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: 32+ characters when `DEV_BYPASS_AUTH` is not `true`.
- `WEB_ORIGIN`: web app origin, usually `http://localhost:5173`.
- `API_ORIGIN`: API origin, usually `http://localhost:3001`.
- `API_INTERNAL_TOKEN`: shared API/worker token for scheduled scan notifications.

Common development variables:

- `DEV_BYPASS_AUTH=true`: auto-authenticate as `DEMO_USER_EMAIL`.
- `DEMO_USER_EMAIL`: demo user identity used by auth bypass.
- `APP_URL` or `APP_BASE_URL`: public web base URL used in email links.
- `REPORT_SHARE_TOKEN_SECRET`: required in production-like mode for stable share
  link signing.
- `WORKER_API_BASE`: API base used by the worker, default
  `http://localhost:3001`.
- `UPTIME_TICK_MS` and `UPTIME_BATCH_SIZE`: uptime worker loop tuning.

Email/SMTP:

- `EMAIL_ENABLED=true` sends SMTP email; otherwise sends are only written to
  `email_outbox` and logged.
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- `EMAIL_TEST_TO`: optional override for test alert delivery.

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for more detail.

## Running Locally

Use separate terminals:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

Optional helpers:

```bash
npm run dev:db
npm run scan:once -- <siteId> <startUrl>
npm run demo:latest-scan
npm run demo:site-history -- <siteId>
npm run -w @scanlark/db demo:schedule
```

The API listens on `PORT` or `3001`. The web dev server is Vite, normally
`http://localhost:5173`.

## Checks

Run before merging alpha changes:

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

The web build currently emits a Vite chunk-size warning for the large single
page app bundle; the build still succeeds.

## Common Troubleshooting

- Missing table/column errors: run every migration in sorted filename order.
- API starts but auth fails: check `SESSION_SECRET`, `DEV_BYPASS_AUTH`, and
  `DEMO_USER_EMAIL`.
- Scheduled scans do not run: start `npm run dev:worker` and confirm
  `API_INTERNAL_TOKEN` matches between API and worker.
- Dashboard does not live-update: confirm the API event relay started and
  `/events/stream` is reachable for the authenticated user.
- Emails are logged but not delivered: set `EMAIL_ENABLED=true` and valid SMTP
  variables; inspect `email_outbox`.
- Uptime is stale: confirm the worker uptime loop is running and that
  `site_uptime_settings.enabled=true` with `next_check_at <= now()` or null.
- Shared links fail in production-like mode: set `REPORT_SHARE_TOKEN_SECRET`.

## Alpha Readiness Notes

Scanlark is functionally broad enough for a controlled alpha, but should be
treated as pre-alpha until the checklist in
[docs/ALPHA_READINESS.md](docs/ALPHA_READINESS.md) is run against a fresh
database and a deployed environment.

Known limits:

- No managed production auth provider yet; local bypass is dev-only.
- No automated test suite beyond TypeScript/build/format checks.
- The frontend is a large single file, so feature discovery depends on the
  codebase map.
- Public crawling intentionally rejects localhost/private IPs and performs
  passive checks only.
