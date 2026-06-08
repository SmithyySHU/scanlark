# Ignore Rules Manual Checks

1. Create a site rule
   - Add a rule for a known noisy link.
   - Reapply or refresh the latest run.
   - Confirm the link moves out of normal results and appears under ignored results.

2. Disable a rule
   - Disable the rule and refresh the latest run.
   - Confirm the link moves back into normal results.

3. Rule priority
   - Create overlapping domain and contains rules.
   - Confirm the domain rule is recorded as the matching rule.

4. Regex validation
   - Try creating an unsafe or invalid regex.
   - Confirm the API rejects it and existing scans are unaffected.

5. Multi-tenant access
   - Attempt to access another user's rules or ignored links.
   - Expect a not found or unauthorized response.

6. Alerts exclude ignored rows
   - Complete a scheduled scan where only ignored issues remain.
   - Confirm ignored rows do not trigger high-priority issue alerts.

7. Diff excludes ignored rows
   - Confirm ignored links do not appear in diff results or CSV export by default.
