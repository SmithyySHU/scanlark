# Favicon Setup

You do not need to upload the full horizontal or stacked logos to a favicon
website.

The favicon should use the icon-only Scanlark mark, which is already included
in this pack.

## Files to copy

Place these in:

`apps/web/public/brand/icons/`

- `favicon.svg`
- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon-48x48.png`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `safari-pinned-tab.svg`

## Add to apps/web/index.html

```html
<link rel="icon" href="/brand/icons/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/brand/icons/favicon.svg" />
<link
  rel="icon"
  type="image/png"
  sizes="32x32"
  href="/brand/icons/favicon-32x32.png"
/>
<link
  rel="icon"
  type="image/png"
  sizes="16x16"
  href="/brand/icons/favicon-16x16.png"
/>
<link
  rel="apple-touch-icon"
  sizes="180x180"
  href="/brand/icons/apple-touch-icon.png"
/>
<link
  rel="mask-icon"
  href="/brand/icons/safari-pinned-tab.svg"
  color="#061E4F"
/>
<link rel="manifest" href="/site.webmanifest" />
<meta name="theme-color" content="#061E4F" />
```

Vite automatically serves files placed inside `apps/web/public`, so there is no
separate upload step during local development. Deployment publishes them with
the rest of the web app.

You would only manually upload a favicon in a hosting panel or CMS if that
platform specifically asks for one.
