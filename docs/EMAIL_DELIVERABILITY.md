# Email Deliverability

Scanlark sends transactional email only. The current templates cover scan
failures, high-priority scan findings, weekly summaries, test alerts, and
reserved future uptime/share-report notifications. Do not use these templates
for marketing campaigns, newsletters, bulk sends, tracking pixels, or mailing
lists.

## SMTP Configuration

Configure SMTP with environment variables. Do not store SMTP credentials in
email templates, docs, admin notes, or source code.

- `EMAIL_ENABLED=true`: enables live SMTP delivery.
- `EMAIL_FROM`: sender identity, for example `Scanlark <alerts@scanlark.com>`.
- `SMTP_HOST`: SMTP server hostname.
- `SMTP_PORT`: SMTP server port, usually `587` or `465`.
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password or app password.
- `EMAIL_TEST_TO`: optional local/testing override for site test alerts.

Recommended sender roles:

- `alerts@scanlark.com`: scan and uptime transactional alerts.
- `support@scanlark.com`: support and admin account contact.
- `contact@scanlark.com`: general inbound contact.

## DNS Records

Set up sender authentication before production email volume increases.

SPF:

- Add or update the domain TXT SPF record to include the SMTP provider.
- Keep one SPF record per domain.
- For IONOS-hosted mail, use the SPF include recommended by IONOS for the
  exact mail product.

DKIM:

- Enable DKIM signing in the mail provider control panel.
- Publish the provider's DKIM TXT record at the selector hostname they provide.
- Confirm the selector is active after DNS propagation.

DMARC:

- Start with a monitoring policy:

```txt
v=DMARC1; p=none; rua=mailto:dmarc@scanlark.com; adkim=s; aspf=s
```

- Review reports before moving to `quarantine` or `reject`.
- Use a reporting mailbox or DMARC analysis service that can process aggregate
  reports.

## IONOS Notes

IONOS setup varies by product, but the usual checklist is:

1. Confirm the sending mailbox exists, for example `alerts@scanlark.com`.
2. Enable authenticated SMTP for that mailbox.
3. Configure Scanlark with the IONOS SMTP host, port, username, and password.
4. Add the IONOS SPF include to the domain TXT record.
5. Enable DKIM if available for the domain and publish the provided selector.
6. Add DMARC with `p=none` first.
7. Wait for DNS propagation, then test Gmail and Outlook delivery.

## Launch Checklist

- SMTP credentials configured through environment variables only.
- `EMAIL_ENABLED=true` only in environments that should send real email.
- SPF record includes the SMTP provider.
- DKIM is enabled and the selector validates.
- DMARC exists with `p=none`.
- Gmail and Outlook test messages land outside spam.
- DMARC reports are reviewed.
- Move DMARC toward `quarantine` or `reject` only after normal traffic is clean.
