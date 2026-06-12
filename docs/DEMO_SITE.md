# Scanlark Demo Site

Scanlark can create an internal demo site for product walkthroughs. Demo sites
are marked with `sites.is_sample_site = true` and shown in the UI as
`Scanlark demo`.

Demo sites are not real customer websites. They may bypass the permission
confirmation checkbox only because they are Scanlark-controlled demo records.
Real user-added sites must always confirm ownership or permission before they
can be created.

Demo-site safety rules:

- Demo sites cannot enable scheduled scans.
- Demo sites cannot enable uptime monitoring.
- Demo sites cannot send test monitoring emails.
- Demo sites cannot enqueue manual scans.
- Workers exclude demo sites from scheduled scan and uptime claim queries.

The current demo URL is an internal placeholder and must not be used for real
external monitoring. Full ownership verification methods such as DNS TXT, HTML
file, meta tag, Search Console, or manual admin approval are future work before
public beta or recurring scans.
