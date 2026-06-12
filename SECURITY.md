# Security Policy

This document describes the current security posture of **Scanlark**.

> **Status:** This project is in hosted alpha. It has baseline authentication,
> admin gating, crawler safety checks, rate limits, and production startup
> guards, but it is **not yet hardened for broad public-beta or large
> multi-tenant production use**. The notes below explain current controls,
> known limitations, and the remaining hardening work.

---

## Supported Versions

At the moment there is no formally “supported” production version.

- `main` and active release or hardening branches are considered development
  branches until a public release line is defined.
- Security issues may be addressed on a best-effort basis while the product is still evolving.

Before any production release we plan to:

- Define a supported release line.
- Tag versions that have passed security hardening checks.

---

## Architecture Overview (relevant to security)

High-level components:

- **Crawler service** (`packages/crawler`):  
  Crawls user-supplied URLs and records link status.
- **API layer** (`apps/api`):  
  Exposes authenticated app, admin, scan, report, notification, and public share
  endpoints.
- **Worker** (`apps/worker`):
  Claims queued scan and uptime work and executes background jobs.
- **Web UI** (`apps/web`):  
  Public landing pages plus the authenticated dashboard, reports, settings, and
  internal admin console.
- **Database layer** (`packages/db`):  
  Persistence for users, sessions, sites, jobs, scan runs, reports, email
  outbox, admin audit logs, and related operational state.
- **Reverse proxy** (`Caddyfile`):
  Terminates HTTPS in production deployments and applies baseline security
  headers.

The crawler **intentionally makes outbound HTTP(S) requests** to user-supplied URLs in order to check links.  
Most of the interesting security considerations are around **SSRF and URL handling**.

---

## URL Handling and SSRF Mitigations

The crawler entry point for fetching HTML is `packages/crawler/src/fetchUrl.ts`.

### What we do today

When a URL is created or passed into the crawler:

1. **URL parsing and protocol allow-list**
   - Site creation normalises common user input such as `site.com`,
     `HTTPS://site.com`, and `www.site.com` before validation.
   - Crawl targets are parsed with `new URL(rawUrl)`.
   - Only `http:` and `https:` protocols are allowed.
   - Any other protocol (for example `file:`, `ftp:`, `gopher:`,
     `javascript:`, or `data:`) is rejected.

2. **Port restrictions**
   - Crawl targets are restricted to normal web ports only: 80 for HTTP and 443
     for HTTPS.

3. **Hostname resolution and IP allow-list**
   - The hostname is resolved via DNS (`dns/promises.lookup`).
   - Every resolved address is checked:
     - Private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
     - Link-local ranges (169.254.0.0/16, `fe80::/10`)
     - Loopback (127.0.0.0/8, `::1`)
     - IPv6 unique local ranges (`fc00::/7`)
   - If any resolved address is private or loopback, the crawl is rejected with an error.

4. **Redirect handling**
   - Fetch is performed with `redirect: "manual"`.
   - Up to a fixed number of redirects are followed.
   - Each redirect target is:
     - Resolved relative to the previous URL.
     - Re-validated using the exact same rules as the original URL
       (protocol check + DNS + private/loopback address blocking).
   - If the redirect chain is too long, the crawl is aborted.

5. **Timeout and content-type checks**
   - Requests are bounded by a timeout (`HTML_FETCH_TIMEOUT_MS`) using `AbortController`.
   - Only responses with `content-type` including `text/html` are processed.  
     Others are ignored for link crawling purposes.

Scanlark only checks publicly visible website pages, HTML, response headers,
sitemap/robots files, SSL certificates, response codes, and public links/assets.
It does not log in, submit forms, exploit vulnerabilities, brute force, scan
ports, access private systems, or perform aggressive vulnerability scanning.

### CodeQL “Server-side request forgery” alert

CodeQL flags the fetch call in `fetchUrl.ts` as a potential **Server-Side Request Forgery (SSRF)** issue because the URL originates from user input.

In our case:

- SSRF-like behaviour is **part of the core feature** (we have to fetch user-supplied URLs to check links).
- We mitigate risk by:
  - Restricting to `http` / `https` only.
  - Resolving DNS and blocking private/loopback address ranges.
  - Re-validating every redirect hop.
  - Applying per-request timeouts and content-type filtering.

Despite those mitigations, the CodeQL rule is not aware of our validation logic and still reports the sink.

> **Decision:**  
> We treat this as a core product risk that must stay actively controlled, not
> as a generic false positive. The current hosted-alpha controls are URL
> normalisation, protocol and port allow-lists, DNS resolution, private address
> blocking, redirect re-validation, timeouts, and regression tests. Before
> broader public beta we will:
>
> - Re-review SSRF controls against our final architecture (network boundaries, deployment topology).
> - Consider additional hardening (explicit allow-lists, per-tenant rules, regional routing, etc.).
> - Re-tune or suppress the CodeQL rule with a clear justification if it remains a false-positive for our use case.

---

## Site Permission and Demo Data

Real user-created sites require a permission attestation before creation:

> “I confirm I own this website or have permission from the website owner to
> scan and monitor it with Scanlark.”

The backend enforces this; the frontend checkbox is only a usability layer.
Existing alpha sites are backfilled as legacy alpha records so they continue to
load, but future full technical ownership verification is still planned before
public beta or recurring scans at larger scale.

Demo/sample sites are marked with `sites.is_sample_site = true` and
`verification_status = 'sample_site'`. They may bypass permission attestation
only because they are Scanlark-controlled demo records. Demo sites are excluded
from manual scan enqueueing, scheduled scan claims, uptime claims, and test
monitoring emails so they cannot accidentally monitor an unrelated third-party
website as customer data.

---

## Authentication, Authorization, and Admin Access

Scanlark currently uses email/password authentication backed by Argon2id
password hashing and `iron-session` cookies:

- Session cookies are HTTP-only and `sameSite=lax`.
- Secure cookies are enabled when `NODE_ENV=production`.
- `SESSION_SECRET` is required unless local `DEV_BYPASS_AUTH=true` is enabled.
- Disabled users cannot log in, and existing sessions are rejected/cleared when
  `users.disabled_at` is set.
- API routes use backend user/site ownership checks. Frontend route checks are
  convenience only.

Admin access is internal-only and backend-enforced:

- Admin routes are mounted under `/admin/*` on the API and exposed as
  `/api/admin/*` through production routing.
- A user is an admin only when their email appears in the comma-separated
  `ADMIN_EMAILS` environment variable.
- Matching is case-insensitive after trimming whitespace.
- Missing or empty `ADMIN_EMAILS` disables admin access by default.
- Every successful admin write action records an `admin_audit_log` row.
- Admin responses must not expose password hashes, session secrets, SMTP
  passwords, API tokens, report share token hashes, raw share tokens, or email
  bodies.

`DEV_BYPASS_AUTH=true` is for local development only. Production-like API
startup rejects this setting through `apps/api/src/securityConfig.ts`.

---

## Production Startup and API Hardening

In production-like environments, API startup validates security-sensitive
configuration:

- `DEV_BYPASS_AUTH` must be disabled.
- `SESSION_SECRET`, `API_INTERNAL_TOKEN`, and `REPORT_SHARE_TOKEN_SECRET` must
  be at least 32 characters.
- A public web origin must be configured through `WEB_ORIGIN`, `APP_URL`, or
  `APP_BASE_URL`.
- Configured production origins must use HTTPS and must not be localhost.

The API also applies baseline hardening:

- Express `x-powered-by` is disabled.
- JSON request bodies have a configurable size limit (`API_JSON_LIMIT`, default
  `256kb`).
- CORS origins are environment-controlled; localhost origins are only added in
  non-production environments.
- API responses set `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and a restrictive `Permissions-Policy`.
- Caddy applies matching baseline headers and HSTS at the reverse-proxy layer.
- Auth attempts, authenticated write requests, scan actions, link rechecks,
  public shared reports, test emails, share actions, and ignore-rule writes have
  rate limits.

---

## Data and Secret Handling

- Passwords are stored as Argon2id hashes, never as plaintext.
- Report share tokens are stored as hashes; raw share tokens should not be shown
  in admin responses.
- SMTP credentials, session secrets, API tokens, and report-share signing
  secrets are environment variables and must not be committed.
- Admin APIs and UI must not expose password hashes, session token material,
  SMTP passwords, API tokens, report share token hashes, raw share tokens, or
  email bodies.
- Public shared reports are intentionally unauthenticated bearer-link views.
  They should expose only the report data needed for that share, and links can
  be revoked.

---

## TLS Certificate Diagnostics

Scanlark does **not** disable TLS certificate validation globally. There is no
`NODE_TLS_REJECT_UNAUTHORIZED=0` setting in the app, and normal page, resource,
link, uptime, SMTP, and API requests use the platform/default TLS validation
path.

The crawler has one isolated exception in
`packages/crawler/src/inspectTlsCertificate.ts` for SSL/TLS certificate
reporting:

1. It first opens a normal TLS connection with certificate validation enabled.
2. If that connection fails because of a certificate validation problem, such
   as expiry, hostname mismatch, self-signed certificate, or untrusted chain, it
   opens a second diagnostic-only TLS socket with certificate rejection disabled.
3. That diagnostic socket is used only to read peer certificate metadata so
   Scanlark can report the exact certificate issue. It does not send an HTTP
   request and does not read page, header, or body content over the bypassed
   connection.

This exception is intentionally local to certificate inspection. Do not reuse it
for crawler fetching, link validation, uptime checks, SMTP, API calls, or any
path that transfers application data.

---

## Build-tool Advisory: esbuild Binary Integrity

Dependabot reports a high-severity advisory in `esbuild` build tooling related
to binary integrity verification when an attacker can influence the npm registry
used during package installation.

This affects the local build/development dependency tree through packages such
as `vite`, `@vitejs/plugin-react`, `@vitejs/plugin-react-swc`, and `tsx`.

### How Scanlark uses esbuild

- `esbuild` is used **only as a build tool / bundler**, pulled in via:
  - `vite`
  - `@vitejs/plugin-react`
  - `@vitejs/plugin-react-swc`
  - `tsx`
- **We do not use `esbuild`’s own `serve()` API** in production.
- Production API and worker containers do not execute Vite dev server or tsx
  runtime code.

### Why this is not fully auto-fixed

The current advisory is tied to the frontend/test build toolchain. `npm audit`
suggests a Vite major-version upgrade as the automatic fix path, which is a
broader build-system change than this alpha hardening sprint should take without
separate regression testing.

The CI dependency audit therefore gates production/runtime dependencies with
`npm audit --omit=dev --audit-level=high`, while this dev-tooling advisory
remains tracked for the next build-tool upgrade sprint.

### Current stance

For now:

- This issue affects **local development and build environments only**, not the
  runtime API, worker, or built frontend served in production.
- We treat it as a **known limitation of the current dev toolchain**.

> **Decision:**
>
> - Keep production/runtime dependency auditing enabled in CI.
> - Revisit the Vite / esbuild / tsx toolchain before beta and upgrade it as a
>   dedicated build-tool change.
> - Developers should use trusted npm registries and avoid exposing local dev
>   servers to untrusted networks.

---

## Other Known Limitations

These are broader items that still need work before a wider public beta:

- **Authentication & authorization**
  - Email/password sessions exist for alpha, but there is no password reset,
    MFA, SSO, managed identity provider, or mature account recovery workflow
    yet.
  - `DEV_BYPASS_AUTH` remains in the codebase for local development, although
    production-like startup rejects it.

- **Rate limiting & abuse protection**
  - Current API rate limits are process-local via `express-rate-limit`.
  - A shared rate-limit store such as Redis is required before running multiple
    API replicas.
  - Account-level quotas and abuse alerting need further tuning before public
    beta.

- **Ownership verification**
  - Current site creation uses a user attestation, not full technical ownership
    verification.
  - DNS TXT, HTML file, meta tag, Search Console, or manual verification remain
    future work.

- **Input validation and content sanitisation**
  - URL validation is strict and covered by tests.
  - Any new metadata, template, notification, or admin-editable fields must keep
    adding explicit validation and safe rendering.

- **Security headers & hardening**
  - Baseline API and Caddy headers exist.
  - A full frontend Content-Security-Policy has not yet been designed or
    deployed.

- **Operational monitoring and incident response**
  - Admin audit logging exists for admin write actions.
  - Production abuse monitoring, alerting thresholds, incident runbooks, and
    retention rules need to be refined before public beta.

These are tracked as part of the production-hardening checklist and will be
addressed before any broad public SaaS-style deployment.

---

## Reporting a Vulnerability

If you believe you’ve found a security issue in Scanlark:

- Please open a **private security report** (for example via GitHub Security Advisory / private issue) rather than a public issue with exploit details.
- You can also contact `support@scanlark.com` for alpha security or abuse
  reports.
- Provide:
  - A clear description of the issue and potential impact.
  - Steps to reproduce.
  - Any relevant logs or payloads (with secrets removed).

We will review reports on a best-effort basis while the project is under active development.
