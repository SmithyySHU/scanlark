# Manual QA Guide

Automated tests cover supported regression behaviour. Use this guide for
targeted browser and workflow checks that need a running stack.

## Alerts and ignore rules

- Scheduled high-priority, weekly-summary, and failed-scan alerts create one
  deduplicated outbox event; SMTP-disabled mode still records the outbox row.
- Ignore rules apply by documented priority, reject unsafe regexes, exclude
  ignored rows from alerts and diffs, and remain workspace/user scoped.
- Reapplying a rule changes stored ignored state without rescanning the site.

## Results, diffs, and fix queue

- Verify issues-only, outstanding-issue, baseline-missing, filter, pagination,
  and CSV-export states with two completed scans.
- Verify notes, fix-queue resolution, row actions, and ignored-row visibility.

## Onboarding and Operations

- New users receive onboarding; existing users with history do not; resetting
  onboarding and using the sample-site route retain normal scan behaviour.
- For Operations historical evidence, verify sent reports, quotes, and
  Communications are read-only, revisions are editable successors, and browser
  errors are absent at desktop and narrow viewports.
