# Dev Notes

Short guide for local development and common API calls.

## Prereqs

- Node 18+
- PostgreSQL with a `DATABASE_URL` env var set

## Install

```bash
npm install
```

## Run services

```bash
# API (http://localhost:3001)
npm run dev:api

# Web app (Vite dev server)
npm run dev:web
```

Optional helpers:

```bash
# DB connection smoke test
npm run dev:db

# One-off crawler run (persist results)
npm run scan:once -- <siteId> <startUrl>
```

Note: `npm --workspaces run build` may print a Vite CJS deprecation warning; the build still completes successfully.

## Migrations

The DB package ships SQL migrations in `packages/db/migrations/`.
Apply them in order with your preferred PostgreSQL tool, for example:

```bash
psql "$DATABASE_URL" -f packages/db/migrations/001_init.sql
psql "$DATABASE_URL" -f packages/db/migrations/002_add_scan_links.sql
# ...
```

## Key endpoints

Base URL: `http://localhost:3001`

- Start scan: `POST /sites/:siteId/scans` body `{ "startUrl": "https://example.com" }`
- Scan progress: `GET /scan-runs/:scanRunId` or SSE `GET /scan-runs/:scanRunId/events`
- Links list (deduped): `GET /scan-runs/:scanRunId/links?classification=broken&limit=50&offset=0`
- Links summary: `GET /scan-runs/:scanRunId/links/summary`
- Occurrences for link: `GET /scan-links/:scanLinkId/occurrences?limit=50&offset=0`
- Occurrences by URL: `GET /scan-runs/:scanRunId/links/:encodedLinkUrl/occurrences`
- Diff vs previous scan: `GET /sites/:siteId/scan-runs/:scanRunId/diff?baseline=prev&issuesOnly=true&limit=200&offset=0`
- Diff (include unchanged): `GET /sites/:siteId/scan-runs/:scanRunId/diff?includeUnchanged=true&unchangedLimit=50&unchangedOffset=0`
- Diff CSV export: `GET /sites/:siteId/scan-runs/:scanRunId/diff.csv?baseline=prev&issuesOnly=true`
- Ignore rules (site): `GET /sites/:siteId/ignore-rules`
- Ignore rules (global): `GET /ignore-rules`

## Scan diff notes

- Comparison key: `link_url` (normalized at crawl time) with source pages aggregated per run.
- Issue classifications: `broken`, `blocked`, `no_response`; `ok` is treated as non-issue.
- Change types:
  - `new_issue`: missing before or `ok` → issue now.
  - `fixed`: issue before → `ok` now, or issue before → missing now.
  - `changed`: link exists in both, classification or status_code changed.
  - `added`: missing before → `ok` now.
  - `removed`: `ok` before → missing now.
- Outstanding counts are included in the diff summary (unchanged since last scan).
- Ordering priority: new issues → changed → fixed → removed → added, with severity ranked broken → blocked → no_response → ok.

## Diff verification (manual)

1) Run scan A with 1 broken link and 1 ok link.
2) Run scan B where the ok link becomes broken and the broken link is fixed/removed.
3) Call the diff endpoint for scan B and check:
   - `newIssues = 1` (ok → broken)
   - `fixedIssues = 1` (broken → ok or missing)
