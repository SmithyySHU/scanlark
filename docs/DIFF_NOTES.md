# Diff Notes

- Outstanding counts mean the same `link_url` appears in both runs with identical classification and status_code (and error_message).
- Diff CSV export uses `/sites/:siteId/scan-runs/:scanRunId/diff.csv` and exports all matching rows by default.
- Unchanged rows are opt-in for the JSON diff items via `includeUnchanged=true`; they are not returned by default.
