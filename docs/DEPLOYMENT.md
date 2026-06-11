# Dockerised Alpha Deployment

This guide describes a simple Docker Compose deployment for a controlled
Scanlark alpha on an Ubuntu 24.04 IONOS VPS.

The target VPS profile is modest: 2 vCore, 4 GB RAM, and 160 GB NVMe. Keep the
deployment simple and avoid exposing internal services.

## Architecture

Services in `docker-compose.prod.yml`:

- `caddy`: public HTTPS reverse proxy on ports 80 and 443.
- `web`: private static SPA server for the Vite build.
- `api`: private Express API on port 3001.
- `worker`: private background service for scan jobs, schedules, reaper, and
  uptime checks.
- `postgres`: private PostgreSQL database.
- `migrate`: one-off SQL migration runner.
- `backup`: one-off `pg_dump` runner.

Public traffic reaches only Caddy. Postgres, API, worker, and web have no public
host ports.

## VPS Prerequisites

On the Ubuntu 24.04 VPS:

- Install Docker Engine and the Docker Compose plugin.
- Configure DNS before first HTTPS start.
- Enable firewall rules for SSH, HTTP, and HTTPS only.

Example firewall baseline:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

If SSH uses a custom port, allow that port instead of the `OpenSSH` profile.

## DNS

Create an A record:

```txt
scanlark.example.com  A  <VPS IPv4>
```

Add an AAAA record only if IPv6 is configured correctly on the VPS.

For email deliverability, configure the SMTP provider's required SPF, DKIM,
DMARC, and verification records.

## First Deploy

Clone the repository:

```bash
sudo mkdir -p /opt/scanlark
sudo chown "$USER":"$USER" /opt/scanlark
git clone <repo-url> /opt/scanlark
cd /opt/scanlark
```

Create production env:

```bash
cp .env.production.example .env.production
nano .env.production
```

Replace every `CHANGE_ME` value. At minimum set:

- `SCANLARK_DOMAIN`
- `CADDY_ACME_EMAIL`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SESSION_SECRET`
- `REPORT_SHARE_TOKEN_SECRET`
- `API_INTERNAL_TOKEN`
- `APP_URL`
- `WEB_ORIGIN`
- SMTP credentials

Start and migrate:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api worker web caddy
```

Health check:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
curl -fsS https://scanlark.example.com/api/health
```

## Routing

Caddy serves HTTPS for `SCANLARK_DOMAIN`.

- `/api/*` proxies to `api:3001` with `/api` stripped.
- `/api/health` reaches API `/health`.
- `/api/events/stream` reaches API `/events/stream` and is configured for SSE.
- `/api/public/reports/:token/...` reaches public report API routes.
- Everything else goes to the web service so SPA routes refresh correctly:
  `/dashboard`, `/dashboard/reports`, `/report`, `/shared-reports/:token`,
  `/learn`, `/learn/:slug`, `/onboarding`, and `/sites/new`.

## Migrations

Run migrations after pulling new code and before restarting app services:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
```

The migrate service uses `postgres:16-alpine`, mounts
`packages/db/migrations` read-only, and runs every `*.sql` file in sorted
filename order. This accounts for duplicate numeric prefixes such as `015_*`
and `023_*`.

The command uses `ON_ERROR_STOP=1`, so deployment fails if any migration fails.

## Updates

Use the deploy script:

```bash
./scripts/deploy.sh
```

What it does:

1. `git pull --ff-only`
2. pulls base images
3. builds app images
4. starts Postgres
5. runs migrations
6. starts API, worker, web, and Caddy
7. checks API health
8. shows service status and recent logs

Manual equivalent:

```bash
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api worker web caddy
curl -fsS https://scanlark.example.com/api/health
```

## Backups

Run a one-off backup:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm backup
```

Backups are written to the named Docker volume `backups` as compressed custom
format dumps.

Copy backups off the VPS regularly. Options:

- `docker run --rm -v scanlark_backups:/backups -v "$PWD":/out alpine cp -a /backups /out/backups-copy`
- `rsync` the copied directory to another machine.
- Use IONOS snapshots as an additional layer.
- Use S3-compatible object storage if available.

Suggested alpha retention: 7 daily backups and 4 weekly backups.

## Restore

Stop writers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml stop api worker
```

Restore a dump:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL"' < scanlark-backup.dump
```

Then run migrations for the current code and restart:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml --profile tools run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api worker web caddy
```

## Rollback

Before updates:

- note the current git commit
- run a database backup

Rollback app code:

```bash
git checkout <previous-commit>
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d api worker web caddy
```

Only restore the database if the failed update applied incompatible migrations
or data changes.

## SMTP On Port 587

Set in `.env.production`:

```bash
EMAIL_ENABLED=true
EMAIL_FROM="Scanlark <alerts@scanlark.example.com>"
SMTP_HOST=smtp.provider.example
SMTP_PORT=587
SMTP_USER=<provider-user>
SMTP_PASS=<provider-password>
```

Scanlark uses authenticated SMTP. Port 587 uses STARTTLS through Nodemailer.

Every attempted email is written to `email_outbox`; if SMTP fails, inspect API
logs and the outbox table.

## Health And Smoke Checklist

Container health:

- `postgres`: `pg_isready`
- `api`: internal `GET /health`
- `web`: internal `/healthz`
- `worker`: logs show `[scheduler ...]` and `[uptime ...]` ticks

Alpha smoke checks:

- `https://scanlark.example.com` loads the landing page.
- `https://scanlark.example.com/api/health` returns healthy.
- `/dashboard`, `/dashboard/reports`, `/report`, `/shared-reports/:token`,
  `/learn`, `/onboarding`, and `/sites/new` refresh without 404.
- Register/login works with `DEV_BYPASS_AUTH=false`.
- Add site works.
- Manual scan queues and worker completes it.
- Report loads after completion.
- Shared report opens in an unauthenticated browser.
- Browser print/PDF flow opens.
- Uptime monitoring writes new `uptime_checks`.
- In-app notifications load and can be marked read.
- `/api/events/stream` does not 404 for an authenticated session.
- Test email sends through SMTP or at least writes `email_outbox`.

## Security Notes

- Do not commit `.env.production`.
- Keep `DEV_BYPASS_AUTH=false` in production.
- Use strong unique values for `SESSION_SECRET`, `REPORT_SHARE_TOKEN_SECRET`,
  `API_INTERNAL_TOKEN`, and `POSTGRES_PASSWORD`.
- Do not expose Postgres or API ports directly.
- Keep Ubuntu and Docker patched.
- Use IONOS firewall rules in addition to `ufw` if available.
