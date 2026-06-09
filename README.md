# Scanlark

Passive website monitoring with reports, issue tracking, uptime checks, and shareable report links.

Scanlark is a SaaS-style monorepo for monitoring a website's health without acting like a browser, logging in, executing JavaScript, or running active security exploitation. It started as broken-link monitoring and now includes broader report-oriented checks around crawl health, search access, HTTPS, security headers, homepage performance signals, issue change detection, and lightweight uptime monitoring.

## What Scanlark does

Scanlark currently supports:

- manual and scheduled scans
- deduplicated link monitoring with occurrence drill-down
- passive SEO basics checks
- `robots.txt` and sitemap checks
- SSL/HTTPS checks
- security header checks
- basic homepage performance signals
- issue generation with severity and change tracking
- reports with category scores and client-friendly wording
- Scanlark Learn content that explains findings
- lightweight homepage uptime monitoring
- email notifications and notification event tracking
- public shareable links for completed reports

## Product boundaries

Scanlark is intentionally passive.

It does not:

- execute JavaScript
- submit forms
- log in to sites
- crawl private networks
- scan arbitrary ports
- exploit vulnerabilities
- act as a full performance lab
- replace a full SEO crawler or DAST tool

Homepage uptime monitoring is also intentionally narrow in MVP:

- root/homepage URL only
- fixed interval
- no full scan runs
- no issue creation from uptime incidents

## Monorepo structure

```txt
apps/
  api/        # Express API, auth/session handling, notifications, public share routes
  web/        # React dashboard, reports, Learn, public shared-report view
  worker/     # scheduled scan loop, issue generation callbacks, uptime loop
packages/
  crawler/    # passive crawl, validation, site checks, uptime checker
  db/         # migrations and database access layer
docs/
  DEV.md      # deeper local dev notes
```

## Key capabilities

### Scanning and validation

- starts from a site URL
- crawls pages and extracts links
- validates links with a custom user agent and timeouts
- classifies results into:
  - `ok`
  - `broken`
  - `blocked`
  - `no_response`
- stores deduplicated links plus per-page occurrences

### Site-level checks

Scanlark also records passive site checks for:

- SEO basics from stored page metadata
- `robots.txt`
- sitemap discovery and validation
- HTTPS reachability and HTTP-to-HTTPS behavior
- TLS certificate validity and hostname matching
- common browser security headers
- basic homepage performance signals such as response time, HTML size, asset count, image count, and script count
- passive mixed-content findings

### Reporting and issue tracking

- completed scans generate reports for a single run
- issues are grouped by category and severity
- issue presentation includes user-facing guidance and stored evidence
- issue change tracking marks findings as `new`, `existing`, or `resolved`
- category scores roll findings into report-level summaries

### Uptime monitoring

- lightweight homepage uptime checks run separately from scans
- tracks current status, last checked time, response time, consecutive failures, and 30-day uptime
- supports downtime and recovery notifications

### Report sharing

- completed reports can be shared publicly by link
- shared reports are read-only
- share links can be revoked
- the raw share URL is only returned when the share is created

## Current database shape

The schema has grown beyond the original MVP. Important tables now include:

- `sites`
- `scan_runs`
- `scan_results`
- `scan_links`
- `scan_link_occurrences`
- `scan_page_checks`
- `scan_site_checks`
- `scan_issues`
- `site_issue_states`
- `ignore_rules`
- `scan_ignored_links`
- `scan_ignored_occurrences`
- `link_notes`
- `notification_events`
- `email_outbox`
- `site_uptime_settings`
- `uptime_checks`
- `uptime_incidents`
- `report_shares`

## Local development

### Requirements

- Node.js
- PostgreSQL
- a root `.env` with `DATABASE_URL`

Common environment variables:

- `DATABASE_URL`
- `WEB_ORIGIN`
- `API_ORIGIN`
- `AUTH_COOKIE_NAME`
- `SESSION_SECRET`
- `DEV_BYPASS_AUTH=true` for local auto-auth
- `API_INTERNAL_TOKEN` shared between API and worker
- `WORKER_API_BASE` for worker-to-API callbacks outside local defaults
- `REPORT_SHARE_TOKEN_SECRET` for public share token signing in production-like deployments

Optional email settings:

- `EMAIL_ENABLED=true`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_TEST_TO`

Optional app URL settings used in links:

- `APP_URL`
- `APP_BASE_URL`

Production-like validation currently expects:

- API: `DATABASE_URL`, `SESSION_SECRET`, `WEB_ORIGIN`, `APP_BASE_URL` or
  `APP_URL`, `API_INTERNAL_TOKEN`, `REPORT_SHARE_TOKEN_SECRET`
- Worker: `DATABASE_URL`, `WORKER_API_BASE`, `API_INTERNAL_TOKEN`
- Email only when enabled: `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, and matching
  SMTP auth fields when used

### Install

```bash
npm ci
```

### Run migrations

Apply all SQL migrations in filename order:

```bash
for f in packages/db/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

That includes recent migrations such as:

- `017_issue_change_detection.sql`
- `018_scan_run_issue_generation_status.sql`
- `019_add_mixed_content_to_scan_page_checks.sql`
- `020_add_uptime_monitoring.sql`
- `021_add_report_shares.sql`

If a feature appears to exist in code but fails at runtime, missing migrations are the first thing to check.

Migration discipline:

- migrations run in filename order
- production rollout should stop if migrations fail
- take a backup before production migrations
- future migrations should be idempotent where practical
- historical migrations may not be perfectly rerunnable on every existing
  database shape

### Start services

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
```

### Useful local URLs

- API: `http://localhost:3001`
- Web app: Vite default, usually `http://localhost:5173`

## Important runtime behaviour

- scheduled scans require the worker to be running
- scan progress and some dashboard updates use SSE
- email delivery only happens when `EMAIL_ENABLED=true`
- uptime monitoring is processed by the worker loop
- public shared reports depend on the `report_shares` table and corresponding migration
- API liveness is `GET /health`
- API readiness is `GET /ready`

## Core routes and surfaces

Examples of current API/report surfaces:

- `POST /sites/:siteId/scans`
- `GET /scan-runs/:scanRunId`
- `GET /scan-runs/:scanRunId/issues`
- `GET /scan-runs/:scanRunId/links`
- `GET /scan-runs/:scanRunId/technical-diagnostics`
- `GET /sites/:siteId/dashboard-summary`
- `GET /sites/:siteId/uptime`
- `POST /scan-runs/:scanRunId/share`
- `GET /scan-runs/:scanRunId/share`
- `DELETE /scan-runs/:scanRunId/share`
- `GET /public/reports/:token`
- `GET /health`
- `GET /ready`

## Scripts

Workspace-level scripts from the repo root:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
npm run dev:db
npm run scan:once -- <siteId> <startUrl>
npm run typecheck
npm run format
npm run format:check
```

Per-workspace typechecks:

```bash
npm run -w @scanlark/api typecheck
npm run -w @scanlark/web typecheck
npm run -w @scanlark/worker typecheck
npm run -w @scanlark/db typecheck
npm run -w @scanlark/crawler typecheck
```

## Troubleshooting

- Missing tables or columns usually means migrations were not applied.
- If scheduled scans do not advance, confirm the worker is running and `API_INTERNAL_TOKEN` matches.
- If report sharing fails, confirm `021_add_report_shares.sql` was applied.
- If email appears in `email_outbox` but is not sent, check `EMAIL_ENABLED` and SMTP settings.
- If a report is stuck with pending issue generation, inspect API and worker logs for that scan run.
- If PDF export fails in deployment, verify Playwright browser binaries and OS
  dependencies.

## Notes

- This repository is under active development.
- Some compiled `.js` files may exist alongside TypeScript sources in `packages/db`; treat the TypeScript sources as the primary code for changes.
- For deeper setup and troubleshooting details, see [docs/DEV.md](/home/smithyy/Projects/scanlark/docs/DEV.md).
- For private beta rollout guidance, see
  [docs/BETA_DEPLOYMENT.md](/home/smithyy/Projects/scanlark/docs/BETA_DEPLOYMENT.md).
