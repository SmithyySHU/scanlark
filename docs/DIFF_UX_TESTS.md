# Diff UX Manual Checks

Use two completed scans for the same site unless the scenario says otherwise.

1. Issues-only empty state
   - Set Issues only on with no new, fixed, or changed issue rows and `outstandingIssues > 0`.
   - Verify the empty state offers "Show outstanding issues".

2. Outstanding issues flow
   - Click "Show outstanding issues".
   - Verify unchanged issue rows load, show both current and baseline context, and page with Prev/Next outstanding.

3. Change filters
   - Switch between All, New issues, Fixed, Changed, Added, and Removed.
   - Verify the list updates, pagination resets, and filters are disabled in outstanding-only mode.

4. Include unchanged
   - Toggle Include unchanged with Issues only on.
   - Verify unchanged issue rows appear below changed rows and count against the outstanding issue total.

5. CSV export
   - Export CSV with each change filter.
   - Confirm headers are present and the rows match the selected filter.

6. Baseline missing
   - Select a run with no previous completed baseline.
   - Verify the empty state explains that no baseline exists and CSV export produces headers only.
