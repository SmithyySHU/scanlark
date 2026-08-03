# Codex prompt: integrate the final Scanlark vector pack

Integrate the supplied final Concept 1 Scanlark vector asset pack into the
current Scanlark monorepo.

Do not commit, push or deploy.

Important:

- Use only the supplied lark-and-magnifying-glass identity.
- Do not redraw or regenerate the logo.
- Do not add a shield logo.
- Do not use header/footer/signature reference screenshots in production.
- Use the SVG assets supplied under apps/web/public/brand/logo.

Tasks:

1. Inspect the repository and all applicable AGENTS.md files.
2. Copy/merge the supplied public brand directory into apps/web/public/brand.
3. Copy site.webmanifest into apps/web/public.
4. Adapt the supplied ScanlarkLogo.tsx component to current conventions.
5. Replace the plain Scanlark text in MarketingPage navigation with the
   horizontal SVG logo.
6. Replace the plain Scanlark footer title with the same reusable component.
7. Add favicon, Apple touch icon, manifest, mask icon and social metadata to
   apps/web/index.html.
8. Use the mark variant for compact/mobile contexts.
9. Use scanlark-email-logo-600.png in email from an absolute HTTPS URL.
10. Use scanlark-report-logo.svg in browser reports and the supplied PNG
    fallback where the PDF renderer requires raster.
11. Preserve current routes, authorisation, content and application behaviour.
12. Do not invent social profiles, pricing routes or newsletter forms.
13. Run web typecheck, production build and relevant tests.
14. Return files changed, render descriptions, test results and remaining
    concerns.

Do not commit, push or deploy.
