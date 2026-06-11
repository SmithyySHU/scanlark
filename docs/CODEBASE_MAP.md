# Scanlark Codebase Map

Use this as the first stop for "where do I change X?"

## Routing And App Shell

- Frontend entrypoint: `apps/web/src/main.tsx`.
- Main React app, custom route parsing, navigation, and most UI state:
  `apps/web/src/app.tsx`.
- Route helpers in `app.tsx`:
  - `getRouteFromLocation`
  - `getAppSectionFromLocation`
  - `parseSiteSettingsLocation`
  - `buildSiteSettingsPath`
  - `buildReportUrl`
  - `buildSharedReportUrl`
  - `navigateTo`
- Marketing page: `apps/web/src/components/MarketingPage.tsx`.
- Auth page: `apps/web/src/components/AuthPage.tsx`.
- Shared dashboard primitives: `apps/web/src/components/DashboardPrimitives.tsx`.

## Web Feature Map

- Dashboard UI: `apps/web/src/app.tsx`, around the `route === "app"` and
  `appSection === "dashboard"` render paths.
- Report UI: `apps/web/src/app.tsx`, report state/loaders near
  `loadReportOverview`, `loadInitialReportSections`, `openReport`, and
  `handlePrintReport`.
- Report history: `apps/web/src/app.tsx`, `appSection === "reports"` and
  history loaders such as `loadHistory`.
- Site settings: `apps/web/src/app.tsx`, `SITE_SETTINGS_SECTIONS`,
  `openSiteSettings`, schedule/notification/uptime/ignore-rule handlers, and
  the `appSection === "site_settings"` render path.
- Account settings: `apps/web/src/app.tsx`, account profile and notification
  preference handlers around `loadAccountProfile`,
  `loadAccountNotificationPreferences`, and `/dashboard/account`.
- Onboarding/new-site setup: `apps/web/src/app.tsx`, `route === "onboarding"`,
  `route === "new_site"`, `handleCreateSampleSite`, and
  `handleSaveSetupPreferences`.
- Scanlark Learn content: `apps/web/src/learnArticles.ts`; Learn rendering is
  in `apps/web/src/app.tsx`.
- In-app notifications: `apps/web/src/app.tsx`, notification query/mutation
  handlers around `loadNotifications`, `markNotificationRead`, and
  `markAllNotificationsRead`.
- Print/PDF report behavior: `apps/web/src/app.tsx`, `handlePrintReport`,
  `getReportAutoPrintFromLocation`, and `@media print` CSS blocks.

## API Map

Most REST routes are currently in `apps/api/src/index.ts`.

- Auth/session setup: `apps/api/src/auth.ts`,
  `apps/api/src/authMiddleware.ts`, `apps/api/src/routes/auth.ts`.
- Site CRUD and metadata: `GET/POST/PATCH/DELETE /sites...` in
  `apps/api/src/index.ts`, backed by `packages/db/src/sites.ts`.
- Dashboard summary: `GET /sites/:siteId/dashboard-summary` in
  `apps/api/src/index.ts`.
- Manual scan start/cancel/retry: `/sites/:siteId/scans`,
  `/scan-runs/:scanRunId/cancel`, `/scan-runs/:scanRunId/retry`.
- Report API: `/scan-runs/:scanRunId/report`, `/issues`,
  `/technical-diagnostics`, `/links`, `/ignored`.
- Share links: `/scan-runs/:scanRunId/share` and
  `/public/reports/:token/...`, backed by `packages/db/src/reportShares.ts`.
- Site settings APIs: `/schedule`, `/notification-settings`, `/uptime`,
  `/ignore-rules`, and site metadata routes.
- Account settings APIs: `/account/profile`,
  `/account/notification-preferences`.
- In-app notification APIs: `/notifications`,
  `/notifications/unread-count`, `/notifications/:id/read`,
  `/notifications/mark-all-read`.
- SSE event stream: `apps/api/src/events.ts`, mounted as `/events/stream`.
- Scan-run SSE: `apps/api/src/routes/scanRunEvents.ts`.
- Email notification assembly: `apps/api/src/notifyOnScanComplete.ts`.
- SMTP/outbox sending: `apps/api/src/email.ts`.

## Worker And Background Jobs

- Worker entrypoint and long-running loops: `apps/worker/src/index.ts`.
- Scan job loop:
  - claims scan jobs with `claimNextScanJob`
  - runs `runScanForSite`
  - completes/fails/requeues scan jobs
- Reaper loop:
  - `requeueExpiredScanJobs`
  - `recoverStaleQueuedScanJobs`
- Scheduler loop:
  - `getDueSites`
  - `enqueueScheduledScanIfDue`
- Uptime loop:
  - `claimDueUptimeMonitors`
  - `checkUptime`
  - `recordUptimeCheck`
- Dev job enqueuer: `apps/worker/src/dev/enqueueJobs.ts`.

## Crawler And Issue Generation

- Crawl orchestration: `packages/crawler/src/scanService.ts`.
- URL fetch safety for pages: `packages/crawler/src/fetchUrl.ts`.
- Shared resource fetching for passive checks: `packages/crawler/src/fetchSiteResource.ts`.
- Link validation: `packages/crawler/src/validateLink.ts`.
- Status classification: `packages/crawler/src/classifyStatus.ts`.
- Link extraction and page metadata: `packages/crawler/src/extractPageData.ts`,
  `extractLinks.ts`, `extract.ts`.
- Robots and sitemap parsing: `parseRobotsTxt.ts`, `parseSitemapXml.ts`.
- HTTPS/TLS/security/performance checks: `packages/crawler/src/runSiteChecks.ts`,
  `inspectTlsCertificate.ts`.
- Uptime HTTP checks: `packages/crawler/src/checkUptime.ts`.
- Crawler limits and concurrency: `packages/crawler/src/limits.ts`.
- Issue generation/change detection: `packages/db/src/scanIssues.ts`.
- Client-friendly issue wording: `packages/db/src/issuePresentation.ts`.
- Category scoring: `packages/db/src/scanCategoryScores.ts`.

## Database Layer

- DB connection/env validation: `packages/db/src/env.ts`,
  `packages/db/src/client.ts`.
- Migrations: `packages/db/migrations/*.sql`.
- Scan runs/jobs: `scanRuns.ts`, `scans.ts`, `scanJobs.ts`,
  `scanRunsHistory.ts`.
- Link results and occurrences: `scanLinksDedup.ts`, `scanResults.ts`.
- Ignore rules and ignored links: `ignoreRules.ts`, `ignoredLinks.ts`,
  `scanLinksIgnoreApply.ts`.
- Page/site checks: `scanPageChecks.ts`, `scanSiteChecks.ts`,
  `scanTechnicalDiagnostics.ts`.
- Scheduling: `siteSchedule.ts`.
- Email notification settings/events/outbox: `notifications.ts`,
  `emailOutbox.ts`.
- In-app notifications/preferences: `appNotifications.ts`.
- Uptime settings/checks/incidents: `uptimeMonitors.ts`.
- Report shares: `reportShares.ts`.
- SSE event emission: `events.ts`.
- Auth users: `auth.ts`.

## Config And Scripts

- Root scripts: `package.json`.
- Workspace scripts: `apps/*/package.json`, `packages/*/package.json`.
- Local env template: `.env.example`.
- TypeScript path aliases: `tsconfig.base.json`.
- Web build config: `apps/web/vite.config.ts`.

## Common Change Targets

- Change dashboard card copy/layout: `apps/web/src/app.tsx` and possibly
  `DashboardPrimitives.tsx`.
- Change report copy/sections: `apps/web/src/app.tsx`, API report routes, and
  `packages/db/src/issuePresentation.ts`.
- Add/change an issue type: `packages/db/src/scanIssues.ts`, migrations if DB
  shape changes, and report/dashboard display in `apps/web/src/app.tsx`.
- Change crawler safety or limits: `packages/crawler/src/fetchUrl.ts`,
  `validateLink.ts`, `fetchSiteResource.ts`, `limits.ts`.
- Change scheduled scan behavior: `packages/db/src/siteSchedule.ts` and
  `apps/worker/src/index.ts`.
- Change uptime behavior: `packages/db/src/uptimeMonitors.ts`,
  `packages/crawler/src/checkUptime.ts`, `apps/worker/src/index.ts`,
  `apps/web/src/app.tsx`.
- Change notification behavior: `packages/db/src/appNotifications.ts`,
  `apps/api/src/notifyOnScanComplete.ts`, `apps/api/src/email.ts`,
  `apps/web/src/app.tsx`.
- Change share-link behavior: `packages/db/src/reportShares.ts`,
  `apps/api/src/index.ts`, `apps/web/src/app.tsx`.
