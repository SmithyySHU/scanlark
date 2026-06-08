# Diff Notes

Diffs compare a current scan run with a completed baseline run, usually `baseline=prev`.

## Matching

- The comparison key is normalized `link_url`.
- Source pages are aggregated per run and shown on both sides of changed rows.
- Ignored links are excluded by default because ignore rules are applied before diff queries.

## Change Types

- `new_issue`: missing before, or previously healthy, and now `broken`, `blocked`, or `no_response`.
- `fixed`: previously an issue and now healthy or missing.
- `changed`: link exists in both runs and classification or status code changed.
- `added`: missing before and now healthy.
- `removed`: previously healthy and now missing.
- `unchanged`: link exists in both runs with the same classification, status code, and error message.

Outstanding counts are unchanged rows split into issue and healthy totals. JSON responses omit unchanged rows unless `includeUnchanged=true` or `unchangedOnly=true`.

## Exports

- CSV export uses `/sites/:siteId/scan-runs/:scanRunId/diff.csv`.
- CSV exports all matching changed rows for the selected filters.
- If there is no baseline, CSV returns headers and no rows.
