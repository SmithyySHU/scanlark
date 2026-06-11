# Alpha Readiness Checklist

Use this checklist for local clean setup and pre-alpha release validation.

## Local Setup

- [ ] Fresh database created.
- [ ] `.env` created from `.env.example`.
- [ ] `DATABASE_URL` points at the fresh database.
- [ ] `SESSION_SECRET` is 32+ characters, or `DEV_BYPASS_AUTH=true` is set for
      local-only testing.
- [ ] `API_INTERNAL_TOKEN` is set and shared by API/worker.
- [ ] All migrations apply cleanly in sorted filename order.
- [ ] `npm ci` completes.

## Services

- [ ] API starts with `npm run dev:api`.
- [ ] Web starts with `npm run dev:web`.
- [ ] Worker starts with `npm run dev:worker`.
- [ ] API `/health` returns healthy.
- [ ] Web can authenticate or dev-bypass as expected.
- [ ] No major browser console errors on first load.
- [ ] No broken topbar/sidebar routes.

## Product Flows

- [ ] Landing page loads.
- [ ] Login/register flow works.
- [ ] Onboarding creates first site.
- [ ] `/sites/new` creates an additional site.
- [ ] Dashboard loads for selected site.
- [ ] Manual scan starts and progresses.
- [ ] Worker completes scan.
- [ ] Report loads after scan completion.
- [ ] Report history lists scans.
- [ ] Shared report link can be created, opened, and revoked.
- [ ] Print/save-PDF flow opens a printable report.
- [ ] CSV/JSON export links work.
- [ ] Site settings save general details.
- [ ] Site settings save schedule details.
- [ ] Site settings save alerts/report delivery details.
- [ ] Site settings save uptime monitoring details.
- [ ] Ignore rules can be created, edited, disabled, and deleted.
- [ ] Account profile saves.
- [ ] Account notification preferences save.
- [ ] Scanlark Learn index and article pages load.

## Background Features

- [ ] Scheduled scans enqueue when due.
- [ ] Scheduled scans trigger completion notifications when configured.
- [ ] Uptime monitoring records new `uptime_checks`.
- [ ] Uptime `next_check_at` advances after checks.
- [ ] Disabled uptime monitors are not claimed.
- [ ] In-app notifications appear and can be marked read.
- [ ] SSE updates refresh scan/notification state.
- [ ] Test email writes an `email_outbox` row.
- [ ] Test email sends over SMTP when `EMAIL_ENABLED=true`.

## Data And Safety

- [ ] Migrations match the fields used by API/frontend.
- [ ] Public share links do not require auth and only expose completed reports.
- [ ] Private/internal URLs are rejected by crawler safety checks.
- [ ] Raw stack traces are not shown in user-facing UI.
- [ ] Production-like mode has no insecure secret fallbacks.

## Current Audit Triage

### P0 Alpha Blockers

- None found in this pass.

### P1 Should Fix Before Alpha

- Add an automated fresh-database migration smoke test.
- Add at least one API/web integration smoke test for add-site -> scan -> report.
- Decide on production auth provider or explicitly gate alpha behind trusted
  users while `DEV_BYPASS_AUTH` remains disabled.

### P2 Can Wait

- Split `apps/web/src/app.tsx` into feature modules after alpha.
- Reduce the Vite bundle-size warning through route/component code splitting.
- Add a server-side PDF renderer only if browser print is not enough for users.

### Documentation Only

- Keep README, `docs/CODEBASE_MAP.md`, and `docs/OPERATIONS.md` updated as
  routes and flows move.
