# Internal Admin Console

Scanlark has an internal admin console at `/admin`. It is for owner/operator
use during alpha and beta only.

## Enable Access

Admin access is controlled only by `ADMIN_EMAILS`.

```bash
ADMIN_EMAILS=admin@example.com,ops@example.com
```

The value is a comma-separated allowlist. Matching is case-insensitive after
trimming whitespace. If `ADMIN_EMAILS` is missing or empty, admin access is
disabled by default.

For production, set the intended admin email in `.env.production`:

```bash
ADMIN_EMAILS=support@scanlark.com
```

Do not hardcode admin email addresses in TypeScript, React, API code, or
checked-in environment files. The admin user must log in normally using an
email address listed in `ADMIN_EMAILS`.

## Security Model

- Backend admin API routes are mounted under `/admin/*`.
- In production, Caddy exposes them as `/api/admin/*`.
- Admin API routes require a logged-in session and a backend allowlist match.
- The frontend only shows admin navigation when the backend session response
  includes `isAdmin: true`.
- Frontend checks are convenience only. Backend checks are authoritative.
- Admin responses must not expose password hashes, session token hashes, SMTP
  passwords, API tokens, report share token hashes, raw share tokens, or email
  bodies.

## Available Actions

The MVP intentionally keeps writes narrow:

- Disable or enable a user.
- Disable or enable a site.
- Pause or resume scheduled scans for a site.
- Pause or resume an uptime monitor.
- Cancel queued or running scans.
- Retry failed or cancelled scans using the existing scan queue flow.
- Retry failed email outbox entries using the existing email send flow.
- Revoke public report share links.

Disabled users cannot log in or continue using existing sessions. Disabled
sites do not run manual scans, scheduled scans, or uptime checks. Data is not
deleted. These actions require the `users.disabled_at` and `sites.disabled_at`
columns from `packages/db/migrations/028_add_admin_disabled_flags.sql`.

## Safety Limits

The MVP does not include:

- Stripe, charging, refunds, or billing controls.
- User impersonation.
- Arbitrary SQL/database editing.
- Marketing or bulk email.
- Public admin access.
- Global uptime frequency changes.
- Aggressive scan controls.
- Raw report share token display.

Subscription and plan management remain a future admin sprint.

## Audit Log

Every successful admin write action creates an `admin_audit_log` row with:

- `admin_user_id`
- `admin_email`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

The audit log is visible from the Admin Audit Log tab.

## Deployment

Run migrations before restarting app services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
```

The admin MVP adds `packages/db/migrations/027_admin_console_mvp.sql` and
`packages/db/migrations/028_add_admin_disabled_flags.sql`. Apply `028` before
deploying code paths that read `users.disabled_at` or `sites.disabled_at`.
Take a normal production database backup before deploying migrations.
