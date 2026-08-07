# Email Operations

Scanlark sends transactional email only. Do not use transactional templates or
Operations Email for campaigns, newsletters, bulk mail, tracking pixels, or
mailing lists.

## Transactional SMTP

Configure `EMAIL_ENABLED`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, and optional `EMAIL_TEST_TO` through environment variables only.
Before production volume, configure one SPF record, provider DKIM, and DMARC
monitoring. Enable live SMTP only in environments intended to send email.

## Operations Email safety model

The Operations Email module is separately feature-gated. Local testing keeps
real sends disabled; test sends derive their recipient from the authenticated
actor and require the server-side allowlist. A user needs an active Operations
membership with an eligible role before the module appears.

Queueing freezes the complete MIME message, sender, recipient, subject, bodies,
and attachments. Retries reuse the same bytes and verify their digest. SMTP
acceptance is not recipient delivery; uncertain post-DATA outcomes are never
automatically requeued. Linked accepted deliveries are finalised atomically as
immutable Communications, while standalone deliveries remain unlinked until an
operator explicitly attributes them.

The Sent-folder worker only appends accepted real deliveries after verifying the
fixed Message-ID and MIME digest. It never creates, moves, renames, or deletes
mailboxes, and test deliveries never enter this path.

## Rollout checklist

- Keep credentials outside source, docs, templates, and admin notes.
- Confirm SMTP readiness before queueing real mail.
- Start real sending disabled, then use an explicit allowlist before live mode.
- Verify Gmail and Outlook placement after SPF, DKIM, and DMARC are active.
- Expose only bounded safe errors; never return credentials, raw MIME, or
  provider response text to the browser.
