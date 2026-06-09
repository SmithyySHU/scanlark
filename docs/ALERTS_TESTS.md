# Alerts Manual Checks

Alerts are generated from scheduled scan completion. Every attempted send should create an `email_outbox` row; live SMTP delivery only happens when `EMAIL_ENABLED=true`.

## Setup

- Set a site's notification email.
- Enable notifications unless the scenario tests `never`.
- Run API and worker with matching `API_INTERNAL_TOKEN`.
- Use SMTP env vars only when verifying live delivery; otherwise inspect `email_outbox`.

## Scenarios

1. High-priority scheduled issue alert
   - Queue or run a scheduled scan that produces at least one high-priority non-ignored issue.
   - Verify one `high_priority_issues_found` notification event and one outbox row.
   - Re-run notification handling for the same scan and verify no duplicate event is created.

2. Weekly scheduled summary
   - Enable summaries on a weekly scheduled site.
   - Complete a scheduled scan.
   - Verify one `weekly_scan_summary` notification event and one outbox row.

3. Failed scheduled scan
   - Complete a scheduled scan with status `failed`.
   - Verify one `scan_failed` notification event and one outbox row when notifications are enabled.

4. Ignore rules excluded
   - Ignore a known broken link.
   - Complete a scheduled scan where ignored rows are the only issues.
   - Verify ignored rows do not drive high-priority issue alerts.

5. Send test alert
   - Use "Send test alert" in Notifications.
   - API route: `POST /sites/:siteId/notifications/test`
   - Verify an outbox entry is created for the site.

6. SMTP disabled
   - Leave `EMAIL_ENABLED` unset or not `true`.
   - Trigger any alert.
   - Verify the outbox row exists and logs show email was not sent over SMTP.

## Inspecting Outbox

- Query `email_outbox` after any alert or test send.
- Expected behavior:
  - an outbox row should exist for each attempted send
  - SMTP delivery only happens when `EMAIL_ENABLED=true`
  - duplicate-protected notifications should not create repeated notification
    events for the same guarded scenario

## Common SMTP Failures

- missing `EMAIL_FROM`
- missing `SMTP_HOST` or `SMTP_PORT`
- only one of `SMTP_USER` / `SMTP_PASS` set
- blocked outbound SMTP from the host
- provider-side sender/domain approval missing
