# Scanlark Onboarding

## Overview

- The first-run wizard appears when a signed-in user has no sites or no scan
  history.
- Completion is stored client-side in localStorage using the key
  `onboarding_completed:<userId>`.
- A user can reopen or reset onboarding from the Help menu (Options button).

## Flow

1. Add a site (or try the sample site).
2. Run the first scan and watch progress.
3. Review results, report scoring, issues, and technical checks.
4. Open Changes or Fix Queue after a second scan to review new and outstanding issues.
5. Optional: set a manual, daily, weekly, or monthly schedule.
6. Optional: enable alerts and weekly summaries.

## Reset Or Disable

- Reset and relaunch: open the Help menu -> Reset onboarding.
- Disable: set `localStorage['onboarding_completed:<userId>']` to any value.

## QA Notes

- New users should see onboarding before they have scan history.
- Existing users with sites and scan history should not be forced through onboarding.
- The sample site path should create a site without bypassing normal scan behaviour.
