# Diff UX Manual Checks

1) Issues-only empty state
   - Set Issues only ON with no issue changes and outstandingIssues > 0.
   - Verify callout shows “No new issue changes…” + “Show outstanding issues”.

2) Outstanding issues flow
   - Click “Show outstanding issues”.
   - Verify unchanged issues list loads and pagination works.

3) Change filters
   - Switch between All / New issues / Fixed / Changed.
   - Verify list updates and pagination resets to first page.

4) CSV export
   - Export CSV with each filter.
   - Confirm download includes all matching rows and correct headers.

5) Baseline missing
   - Select a run with no previous completed baseline.
   - Verify empty state message and optional “Run a scan” CTA.
