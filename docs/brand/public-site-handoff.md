# Public Website And Brand Sprint Handoff

Date: 2026-08-03

## Positioning

Scanlark has temporarily pivoted from open self-service SaaS to a
founder-operated website-health and monitoring service.

Primary public concept:

`Know when your website has problems before your customers do.`

Do not advertise public registration, free scanning, SaaS pricing, guaranteed
rankings, guaranteed revenue, complete security, legal compliance, penetration
testing, or complete accessibility compliance.

## Identity And Contact

- Public wording: `Scanlark is operated by Connor Smith in the United Kingdom.`
- Formal wording for quotes, terms and service agreements:
  `Connor Smith, operating under the trading name Scanlark.`
- Do not describe Scanlark as incorporated, registered at Companies House or a
  registered company.
- Launch market: B2B-only for businesses, sole traders, charities and
  organisations purchasing for work or business purposes.
- Public contact: `contact@scanlark.com`.
- Public CTA:
  `mailto:contact@scanlark.com?subject=Website%20health%20check%20enquiry`.
- No public contact form for launch.
- No third-party analytics, advertising pixels or session-recording tools for
  launch.

## Required Owner Inputs

- Public postal or correspondence address for legal pages.
- Hosting, email, database, backup, accounting and future payment provider list.
- Data-retention choices for enquiries, client records, scan evidence, reports,
  quotes, work orders, logs and accounting records.
- Payment, cancellation and service-agreement terms.
- Confirmation before DNS changes or deployment.

## Domain Direction

- `scanlark.com`: public website and legal pages.
- `www.scanlark.com`: redirect to root.
- `app.scanlark.com`: private login, Operations and future SaaS application.

Do not move private application sessions to the public root domain. Prefer a
host-only auth cookie on `app.scanlark.com`.
