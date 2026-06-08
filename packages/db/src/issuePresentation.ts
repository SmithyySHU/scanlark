import type { ScanIssue, ScanIssueType } from "./scanIssues";

export interface IssuePresentation {
  userTitle: string;
  shortSummary: string;
  whatItMeans: string;
  whyItMatters: string;
  suggestedFix: string;
  technicalDetail: string;
  learnSlug: null;
}

type IssuePresentationSource = Pick<
  ScanIssue,
  | "issue_type"
  | "title"
  | "description"
  | "affected_url"
  | "source_url"
  | "evidence_json"
> & {
  resolved_at?: string | Date | null;
};

type Template = {
  userTitle: string | ((issue: IssuePresentationSource) => string);
  shortSummary: string | ((issue: IssuePresentationSource) => string);
  whatItMeans: string | ((issue: IssuePresentationSource) => string);
  whyItMatters: string | ((issue: IssuePresentationSource) => string);
  suggestedFix: string | ((issue: IssuePresentationSource) => string);
  technicalDetail: string | ((issue: IssuePresentationSource) => string);
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function getHttpStatusText(issue: IssuePresentationSource) {
  const status = asNumber(issue.evidence_json?.status_code);
  if (status == null) return "No HTTP status was recorded.";
  return `HTTP status ${status} was recorded.`;
}

function getLinkScope(issue: IssuePresentationSource) {
  const isInternal = asBoolean(issue.evidence_json?.is_internal);
  if (isInternal === true) return "internal";
  if (isInternal === false) return "external";
  return "linked";
}

function getOccurrenceText(issue: IssuePresentationSource) {
  const count = asNumber(issue.evidence_json?.occurrence_count);
  if (count == null) return "Occurrence count was not recorded.";
  return `The issue was seen ${count} time${count === 1 ? "" : "s"} in this scan.`;
}

function formatBytes(value: number | null) {
  if (value == null) return null;
  return `${Math.round(value / 1024)} KB`;
}

function formatList(values: string[]) {
  if (values.length === 0) return "none";
  return values.join(", ");
}

function buildTechnicalDetail(
  issue: IssuePresentationSource,
  extras: Array<string | null>,
) {
  const parts = [
    getHttpStatusText(issue),
    ...extras.filter((part): part is string => Boolean(part)),
  ];
  return parts.join(" ");
}

const templates: Partial<Record<ScanIssueType, Template>> = {
  broken_link: {
    userTitle: (issue) =>
      getLinkScope(issue) === "internal"
        ? "Broken page link on your site"
        : "Broken external link",
    shortSummary:
      "Someone clicking this link may hit a dead end instead of the page they expected.",
    whatItMeans:
      "Scanlark tried the link during the scan and did not get a healthy response back.",
    whyItMatters:
      "Broken links can interrupt journeys, make pages look outdated, and affect trust or search quality over time.",
    suggestedFix:
      "Update the link destination, restore the missing page, or add a redirect if the content has moved.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [getOccurrenceText(issue)]),
  },
  blocked_link: {
    userTitle: "Link appears blocked",
    shortSummary:
      "This link responded, but access controls or bot protection prevented a normal check.",
    whatItMeans:
      "The destination may require authentication, rate-limit requests, or block automated traffic.",
    whyItMatters:
      "People and crawlers may not be able to reach the content consistently, especially from some environments.",
    suggestedFix:
      "Confirm the destination should be publicly reachable. If it should, review access rules or replace the link.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [getOccurrenceText(issue)]),
  },
  no_response: {
    userTitle: "Link did not respond",
    shortSummary:
      "This link could not be checked successfully because the destination did not return a usable response.",
    whatItMeans:
      "The destination may have timed out, failed a connection step, or had a temporary network or server problem.",
    whyItMatters:
      "Visitors may experience unreliable behavior, and repeated failures can hide real outages or content problems.",
    suggestedFix:
      "Retry the destination manually, check hosting or DNS health, and replace or remove the link if it stays unreliable.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.error_message),
        getOccurrenceText(issue),
      ]),
  },
  ignored_safety_skip: {
    userTitle: "Safety-sensitive URL was skipped",
    shortSummary:
      "Scanlark intentionally skipped this URL to avoid logging in, triggering an action, or entering a sensitive flow.",
    whatItMeans:
      "The URL matched a crawler safety rule, so it was not treated as a normal broken-link check.",
    whyItMatters:
      "This protects the scan from causing side effects, but it also means the destination still needs manual review if it matters.",
    suggestedFix:
      "Decide whether this URL should stay excluded. If it should be checked later, review ignore and crawl-safety rules first.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.skip_reason),
        asString(issue.evidence_json?.rule_type),
        asString(issue.evidence_json?.rule_pattern),
      ]),
  },
  missing_title: {
    userTitle: "Page is missing a title",
    shortSummary:
      "This page does not provide the browser and search-friendly title text users usually see first.",
    whatItMeans: "The page was crawled without a usable HTML title tag.",
    whyItMatters:
      "Title tags help people understand the page in search results, browser tabs, and shared links.",
    suggestedFix:
      "Add a clear, specific page title that reflects the page content and intent.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [asString(issue.evidence_json?.title)]),
  },
  empty_title: {
    userTitle: "Page title is empty",
    shortSummary:
      "The page includes a title tag, but it does not contain usable text.",
    whatItMeans:
      "A title element exists in the page markup, but it was empty when scanned.",
    whyItMatters:
      "An empty title can look broken in tabs and search results and gives little context to visitors or search engines.",
    suggestedFix:
      "Populate the title tag with concise, descriptive text unique to this page.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, ["The stored title value was empty."]),
  },
  duplicate_title: {
    userTitle: "Page title is duplicated",
    shortSummary:
      "This page shares the same title with other pages found in the scan.",
    whatItMeans:
      "Multiple pages appear to present the same title text, which can blur the difference between them.",
    whyItMatters:
      "Duplicate titles make pages harder to distinguish in search results and can weaken relevance signals.",
    suggestedFix:
      "Rewrite the title so it reflects the page's specific topic, product, or intent.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.duplicate_count);
          return count == null ? null : `Duplicate title count: ${count}.`;
        })(),
      ]),
  },
  missing_meta_description: {
    userTitle: "Meta description is missing",
    shortSummary:
      "This page does not include a meta description to summarise its content for search users.",
    whatItMeans: "The page was scanned without a description meta tag.",
    whyItMatters:
      "Search engines may generate their own snippet, which can reduce message control and click quality.",
    suggestedFix:
      "Add a short description that explains what the page offers and encourages the right click.",
    technicalDetail: () =>
      "No meta description value was recorded in the page check.",
  },
  empty_meta_description: {
    userTitle: "Meta description is empty",
    shortSummary:
      "A description tag exists on this page, but it does not contain usable text.",
    whatItMeans:
      "The markup includes a meta description field with no meaningful content.",
    whyItMatters:
      "An empty description gives search engines less helpful summary text and reduces control over search snippets.",
    suggestedFix:
      "Fill the description with concise text that matches the page content and search intent.",
    technicalDetail: () => "The meta description field was present but empty.",
  },
  missing_h1: {
    userTitle: "Main page heading is missing",
    shortSummary: "This page does not appear to have a primary H1 heading.",
    whatItMeans:
      "The scan did not find a clear top-level heading in the page content.",
    whyItMatters:
      "A strong main heading helps visitors quickly understand the page and supports content structure.",
    suggestedFix:
      "Add one clear H1 heading that matches the page topic and visible intent.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.h1_count);
          return count == null ? null : `Detected H1 count: ${count}.`;
        })(),
      ]),
  },
  multiple_h1: {
    userTitle: "Page has multiple main headings",
    shortSummary:
      "This page includes more than one H1, which can weaken the main page signal.",
    whatItMeans:
      "The scan found multiple top-level headings instead of one primary page heading.",
    whyItMatters:
      "Multiple H1s can make page structure harder to interpret for teams, templates, and search systems.",
    suggestedFix:
      "Keep one primary H1 and move other headings down to lower levels where appropriate.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.h1_count);
          return count == null ? null : `Detected H1 count: ${count}.`;
        })(),
      ]),
  },
  noindex_detected: {
    userTitle: "Page is marked noindex",
    shortSummary:
      "This page carries a noindex directive, which tells search engines not to keep it in search results.",
    whatItMeans:
      "The page exposed a robots meta instruction that discourages indexing.",
    whyItMatters:
      "Important pages may stop appearing in search results if noindex is applied unintentionally.",
    suggestedFix:
      "Confirm whether this page should stay out of search. Remove the directive if the page should be discoverable.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [asString(issue.evidence_json?.robots_meta)]),
  },
  canonical_multiple: {
    userTitle: "Page has multiple canonical tags",
    shortSummary: "This page exposes more than one canonical URL signal.",
    whatItMeans:
      "The scan found multiple canonical tags, which can create mixed signals about the preferred URL.",
    whyItMatters:
      "Conflicting canonical signals can dilute indexing and page consolidation decisions.",
    suggestedFix: "Keep one canonical tag pointing to the preferred page URL.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.canonical_count);
          return count == null
            ? null
            : `Detected canonical tag count: ${count}.`;
        })(),
        asString(issue.evidence_json?.canonical_href),
      ]),
  },
  robots_missing: {
    userTitle: "robots.txt is missing",
    shortSummary:
      "Search engines could not find a public robots.txt file at the expected location.",
    whatItMeans:
      "The site returned a missing response for the standard robots.txt URL.",
    whyItMatters:
      "Robots.txt helps communicate crawl guidance and sitemap location to search engines.",
    suggestedFix:
      "Publish a basic robots.txt file and include the sitemap URL if one exists.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [issue.affected_url]),
  },
  robots_unreachable: {
    userTitle: "robots.txt could not be reached",
    shortSummary:
      "Search engines may not be able to fetch crawl guidance because robots.txt did not return cleanly.",
    whatItMeans:
      "The expected robots.txt URL responded with an error or failed to load during the scan.",
    whyItMatters:
      "If robots.txt is unreliable, search engines may miss important crawl instructions or sitemap references.",
    suggestedFix:
      "Check the robots.txt URL directly, fix any hosting or routing issue, and confirm it returns reliably.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.error_message),
      ]),
  },
  robots_blocks_all: {
    userTitle: "robots.txt blocks the whole site",
    shortSummary:
      "Your robots.txt appears to tell crawlers not to access any pages on the site.",
    whatItMeans: "A wildcard disallow rule was detected that blocks all paths.",
    whyItMatters:
      "If intentional, this limits search crawling. If accidental, it may reduce visibility more than expected.",
    suggestedFix:
      "Review robots.txt and remove the site-wide block unless the entire site is meant to stay out of search.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const refs = asStringArray(issue.evidence_json?.sitemap_references);
          return `Sitemap references in robots.txt: ${formatList(refs)}.`;
        })(),
      ]),
  },
  robots_no_sitemap_reference: {
    userTitle: "robots.txt does not advertise a sitemap",
    shortSummary:
      "Search engines can crawl the site, but robots.txt does not point them to a sitemap location.",
    whatItMeans:
      "No sitemap reference was found in the robots.txt file scanned.",
    whyItMatters:
      "A sitemap reference helps search engines discover and refresh important URLs more efficiently.",
    suggestedFix:
      "Add a `Sitemap:` line in robots.txt that points to the preferred sitemap URL.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const refs = asStringArray(issue.evidence_json?.sitemap_references);
          return `Current sitemap references: ${formatList(refs)}.`;
        })(),
      ]),
  },
  sitemap_missing: {
    userTitle: "No usable sitemap was found",
    shortSummary:
      "Scanlark could not find a working sitemap from the default locations or robots.txt references.",
    whatItMeans:
      "Search engines may not have a clear machine-readable list of important pages to discover.",
    whyItMatters:
      "A sitemap supports page discovery, change monitoring, and indexing for larger or less-linked sections of a site.",
    suggestedFix: "Publish a valid sitemap and reference it from robots.txt.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const checked = asStringArray(
            issue.evidence_json?.checked_sitemap_urls,
          );
          return `Checked sitemap URLs: ${formatList(checked)}.`;
        })(),
      ]),
  },
  sitemap_unreachable: {
    userTitle: "Sitemap could not be reached",
    shortSummary:
      "A sitemap URL was found, but it did not return cleanly during the scan.",
    whatItMeans:
      "The sitemap endpoint may be unavailable, misconfigured, or intermittently failing.",
    whyItMatters:
      "An unreachable sitemap slows page discovery and can reduce confidence in your search-access setup.",
    suggestedFix:
      "Open the sitemap URL directly, fix any server or routing issue, and confirm it returns reliably.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.error_message),
        asString(issue.evidence_json?.content_type),
      ]),
  },
  sitemap_invalid: {
    userTitle: "Sitemap format is invalid",
    shortSummary:
      "The sitemap URL responded, but the content did not parse as valid sitemap XML.",
    whatItMeans:
      "Search engines may not be able to use the file even though the URL exists.",
    whyItMatters:
      "Invalid sitemap files can block discovery workflows and hide indexing problems.",
    suggestedFix:
      "Fix the XML structure, validate the sitemap output, and retest the URL.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.error_message),
        asString(issue.evidence_json?.content_type),
      ]),
  },
  sitemap_empty: {
    userTitle: "Sitemap is empty",
    shortSummary:
      "The sitemap responded successfully but did not list any page URLs.",
    whatItMeans:
      "A sitemap file exists, but it does not currently help search engines discover content.",
    whyItMatters:
      "An empty sitemap weakens crawl guidance and can hide pages that should be indexed.",
    suggestedFix:
      "Populate the sitemap with live canonical URLs that should be discoverable.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const parsed = asNumber(issue.evidence_json?.parsed_url_count);
          return parsed == null ? null : `Parsed URL count: ${parsed}.`;
        })(),
      ]),
  },
  sitemap_url_broken: {
    userTitle: "Sitemap contains a broken page URL",
    shortSummary:
      "At least one sampled page listed in the sitemap did not return a healthy response.",
    whatItMeans:
      "The sitemap may be pointing to outdated, moved, or failing URLs.",
    whyItMatters:
      "Broken sitemap entries send low-quality signals to search engines and can waste crawl effort.",
    suggestedFix:
      "Remove or fix the broken URL in the sitemap and confirm it now returns a healthy response.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const sitemapUrl = asString(issue.evidence_json?.sitemap_url);
          return sitemapUrl ? `Listed in sitemap: ${sitemapUrl}.` : null;
        })(),
        asString(issue.evidence_json?.final_url),
      ]),
  },
  https_unavailable: {
    userTitle: "HTTPS is not working cleanly",
    shortSummary:
      "The site did not produce a healthy HTTPS response at the expected host during the scan.",
    whatItMeans:
      "Visitors or crawlers may be unable to load the secure version of the site reliably.",
    whyItMatters:
      "HTTPS problems can reduce trust, create browser friction, and affect search visibility.",
    suggestedFix:
      "Fix the HTTPS endpoint, certificate, or redirect chain so the secure version loads successfully.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.error_message),
        (() => {
          const finalScheme = asString(issue.evidence_json?.final_scheme);
          return finalScheme ? `Final scheme observed: ${finalScheme}.` : null;
        })(),
      ]),
  },
  http_not_redirecting_to_https: {
    userTitle: "HTTP does not redirect to HTTPS",
    shortSummary:
      "The non-secure version of the site did not end on HTTPS during the scan.",
    whatItMeans:
      "Visitors may still land on an insecure version or see inconsistent URL behavior.",
    whyItMatters:
      "A clean HTTP-to-HTTPS redirect helps consolidate traffic, trust, and canonical behavior.",
    suggestedFix:
      "Add or fix a site-wide redirect from HTTP to the secure HTTPS destination.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const finalUrl = asString(issue.evidence_json?.final_url);
          return finalUrl ? `Final URL observed: ${finalUrl}.` : null;
        })(),
      ]),
  },
  mixed_content_script: {
    userTitle: "HTTPS page loads a script over HTTP",
    shortSummary:
      "This secure page references a script over HTTP, which browsers may block or treat inconsistently.",
    whatItMeans:
      "The page itself loaded on HTTPS, but at least one script reference still points to an insecure HTTP URL.",
    whyItMatters:
      "Script-level mixed content can break page behavior, create browser warnings, and weaken trust in the secure page experience.",
    suggestedFix:
      "Update the script reference to HTTPS, replace it with a secure equivalent, or remove it if the resource is no longer needed.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const pageUrl = asString(issue.evidence_json?.page_url);
          return pageUrl ? `Source page: ${pageUrl}.` : null;
        })(),
        (() => {
          const resourceUrl = asString(issue.evidence_json?.resource_url);
          return resourceUrl ? `HTTP resource: ${resourceUrl}.` : null;
        })(),
      ]),
  },
  mixed_content_stylesheet: {
    userTitle: "HTTPS page loads a stylesheet over HTTP",
    shortSummary:
      "This secure page references a stylesheet over HTTP, which may be blocked or leave the page looking incomplete.",
    whatItMeans:
      "The page loaded on HTTPS, but a stylesheet reference still points to an insecure HTTP URL.",
    whyItMatters:
      "Mixed-content stylesheets can make the page render inconsistently and can reduce confidence in the page's secure setup.",
    suggestedFix:
      "Update the stylesheet reference to HTTPS, replace it with a secure source, or remove it if the file is no longer required.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const pageUrl = asString(issue.evidence_json?.page_url);
          return pageUrl ? `Source page: ${pageUrl}.` : null;
        })(),
        (() => {
          const resourceUrl = asString(issue.evidence_json?.resource_url);
          return resourceUrl ? `HTTP resource: ${resourceUrl}.` : null;
        })(),
      ]),
  },
  mixed_content_image: {
    userTitle: "HTTPS page loads an image over HTTP",
    shortSummary:
      "This secure page references an image over HTTP, which may be blocked or leave the page looking outdated or incomplete.",
    whatItMeans:
      "The page loaded on HTTPS, but an image reference still points to an insecure HTTP URL.",
    whyItMatters:
      "Mixed-content images are usually lower impact than scripts, but they can still create browser friction and make the secure page look inconsistent.",
    suggestedFix:
      "Update the image URL to HTTPS, replace it with a secure asset, or remove the reference if it is no longer needed.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const pageUrl = asString(issue.evidence_json?.page_url);
          return pageUrl ? `Source page: ${pageUrl}.` : null;
        })(),
        (() => {
          const resourceUrl = asString(issue.evidence_json?.resource_url);
          return resourceUrl ? `HTTP resource: ${resourceUrl}.` : null;
        })(),
      ]),
  },
  mixed_content_iframe: {
    userTitle: "HTTPS page loads an iframe over HTTP",
    shortSummary:
      "This secure page references an iframe over HTTP, which browsers may block or render inconsistently.",
    whatItMeans:
      "The page loaded on HTTPS, but an embedded iframe still points to an insecure HTTP URL.",
    whyItMatters:
      "Mixed-content iframes can fail to load cleanly and can make embedded content look broken or unreliable on a secure page.",
    suggestedFix:
      "Update the iframe URL to HTTPS, replace the embedded source, or remove it if it should no longer appear on the page.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const pageUrl = asString(issue.evidence_json?.page_url);
          return pageUrl ? `Source page: ${pageUrl}.` : null;
        })(),
        (() => {
          const resourceUrl = asString(issue.evidence_json?.resource_url);
          return resourceUrl ? `HTTP resource: ${resourceUrl}.` : null;
        })(),
      ]),
  },
  ssl_certificate_expired: {
    userTitle: "SSL certificate has expired",
    shortSummary:
      "The secure certificate presented by the site is no longer valid.",
    whatItMeans:
      "Browsers and crawlers may warn, block access, or distrust the connection.",
    whyItMatters:
      "Expired certificates can interrupt access and make the site look untrustworthy to visitors and browsers.",
    suggestedFix:
      "Renew and deploy a valid certificate immediately, then confirm the secure host serves the new certificate.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const validTo = asString(issue.evidence_json?.valid_to);
          return validTo ? `Certificate valid-to date: ${validTo}.` : null;
        })(),
      ]),
  },
  ssl_certificate_expiring_soon: {
    userTitle: "SSL certificate expires soon",
    shortSummary: "The current certificate is close to its expiry date.",
    whatItMeans:
      "HTTPS is working now, but it may fail soon if the certificate is not renewed in time.",
    whyItMatters:
      "Certificate expiry can create avoidable warnings, interrupted access, and last-minute maintenance work.",
    suggestedFix:
      "Schedule renewal now and verify the updated certificate is deployed before the expiry date.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const days = asNumber(issue.evidence_json?.days_until_expiry);
          return days == null ? null : `Days until expiry: ${days}.`;
        })(),
      ]),
  },
  ssl_certificate_hostname_mismatch: {
    userTitle: "SSL certificate does not match the hostname",
    shortSummary:
      "The certificate presented by the site does not appear to belong to the scanned host.",
    whatItMeans:
      "The secure connection may be using the wrong certificate or an incomplete hostname setup.",
    whyItMatters:
      "Hostname mismatches can create browser warnings and may stop some visitors from continuing securely.",
    suggestedFix:
      "Install a certificate that includes the scanned hostname and verify the correct site is bound to it.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const host = asString(issue.evidence_json?.hostname);
          return host ? `Scanned hostname: ${host}.` : null;
        })(),
      ]),
  },
  ssl_certificate_invalid: {
    userTitle: "SSL certificate is not validating cleanly",
    shortSummary:
      "The certificate chain or trust checks for the secure site did not pass cleanly.",
    whatItMeans:
      "The secure connection may have trust, chain, or issuer problems even if HTTPS appears to load.",
    whyItMatters:
      "Certificate validation problems can trigger browser warnings and reduce trust in the site.",
    suggestedFix:
      "Review the certificate chain, issuer, and deployment to make sure the host serves a fully trusted certificate.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        asString(issue.evidence_json?.authorization_error),
        (() => {
          const issuer = asString(issue.evidence_json?.issuer);
          return issuer ? `Issuer: ${issuer}.` : null;
        })(),
      ]),
  },
  hsts_missing: {
    userTitle: "HSTS header is missing",
    shortSummary:
      "The secure site is not instructing browsers to prefer HTTPS automatically on future visits.",
    whatItMeans:
      "The response did not include a Strict-Transport-Security header.",
    whyItMatters:
      "Without HSTS, browsers may be more exposed to downgrade and insecure first-request patterns.",
    suggestedFix:
      "Add an HSTS header after confirming the whole site is ready to stay on HTTPS.",
    technicalDetail: () =>
      "Strict-Transport-Security was not present on the final HTTPS root response.",
  },
  csp_missing: {
    userTitle: "Content Security Policy is missing",
    shortSummary:
      "The site is not declaring a CSP to restrict where scripts and other assets can load from.",
    whatItMeans:
      "The final HTTPS response did not include a Content-Security-Policy header.",
    whyItMatters:
      "A CSP helps reduce the impact of injected content and some classes of front-end security issues.",
    suggestedFix:
      "Add a baseline CSP and tighten it gradually against the resources the site legitimately uses.",
    technicalDetail: () =>
      "Content-Security-Policy was not present on the final HTTPS root response.",
  },
  frame_ancestors_missing: {
    userTitle: "Frame embedding protection is missing",
    shortSummary:
      "The site is not declaring modern frame embedding restrictions in CSP.",
    whatItMeans:
      "No `frame-ancestors` rule was detected in the CSP response headers.",
    whyItMatters:
      "Embedding restrictions help reduce clickjacking exposure and clarify where the site can be framed.",
    suggestedFix:
      "Add a `frame-ancestors` directive in CSP that matches the allowed embedding policy.",
    technicalDetail: () =>
      "No CSP `frame-ancestors` protection was found on the final HTTPS root response.",
  },
  x_frame_options_missing: {
    userTitle: "Legacy frame protection is missing",
    shortSummary:
      "The site does not expose the older X-Frame-Options header fallback.",
    whatItMeans:
      "Legacy frame protection was not present when the scan checked the secure root response.",
    whyItMatters:
      "Some older user agents still rely on the legacy header even when modern CSP is preferred.",
    suggestedFix:
      "Add X-Frame-Options if you need legacy support, or confirm your CSP policy fully covers framing needs.",
    technicalDetail: () =>
      "X-Frame-Options was not present while `frame-ancestors` protection was also unavailable.",
  },
  x_content_type_options_missing: {
    userTitle: "MIME sniffing protection is missing",
    shortSummary: "The site does not expose the X-Content-Type-Options header.",
    whatItMeans:
      "Browsers were not told to avoid guessing content types beyond the server's declared type.",
    whyItMatters:
      "This header is a low-effort hardening measure that helps reduce some content handling risks.",
    suggestedFix:
      "Add `X-Content-Type-Options: nosniff` to the secure response.",
    technicalDetail: () =>
      "X-Content-Type-Options was not present on the final HTTPS root response.",
  },
  referrer_policy_missing: {
    userTitle: "Referrer policy is missing",
    shortSummary:
      "The site does not declare how much referral information browsers should send onward.",
    whatItMeans:
      "The secure response did not include a Referrer-Policy header.",
    whyItMatters:
      "A referrer policy helps control data leakage and makes privacy behavior more intentional.",
    suggestedFix:
      "Add a Referrer-Policy header that matches your privacy and analytics requirements.",
    technicalDetail: () =>
      "Referrer-Policy was not present on the final HTTPS root response.",
  },
  permissions_policy_missing: {
    userTitle: "Permissions policy is missing",
    shortSummary:
      "The site is not declaring which browser features should be allowed or denied by default.",
    whatItMeans:
      "No Permissions-Policy header was detected on the secure root response.",
    whyItMatters:
      "This header helps lock down powerful browser capabilities that most pages do not need.",
    suggestedFix:
      "Add a Permissions-Policy header and explicitly allow only the browser features your site uses.",
    technicalDetail: () =>
      "Permissions-Policy was not present on the final HTTPS root response.",
  },
  set_cookie_missing_secure: {
    userTitle: "Cookie is missing the Secure flag",
    shortSummary:
      "At least one cookie can be sent without being restricted to secure HTTPS transport.",
    whatItMeans:
      "The scan found cookies on the secure response that were missing the Secure attribute.",
    whyItMatters:
      "Sensitive cookies without Secure protection are easier to expose on insecure transport paths.",
    suggestedFix:
      "Set the Secure attribute on cookies that should only travel over HTTPS.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(
            issue.evidence_json?.cookies_missing_secure_count,
          );
          return count == null ? null : `Cookies missing Secure: ${count}.`;
        })(),
      ]),
  },
  set_cookie_missing_httponly: {
    userTitle: "Cookie is missing the HttpOnly flag",
    shortSummary:
      "At least one cookie can likely be read by client-side JavaScript when it may not need to be.",
    whatItMeans: "The scan found cookies without the HttpOnly attribute.",
    whyItMatters:
      "HttpOnly helps reduce exposure of sensitive cookies to script-based attacks.",
    suggestedFix:
      "Set HttpOnly on cookies that do not need to be accessed by front-end JavaScript.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(
            issue.evidence_json?.cookies_missing_httponly_count,
          );
          return count == null ? null : `Cookies missing HttpOnly: ${count}.`;
        })(),
      ]),
  },
  set_cookie_missing_samesite: {
    userTitle: "Cookie is missing a SameSite setting",
    shortSummary:
      "At least one cookie does not declare how it should behave in cross-site requests.",
    whatItMeans:
      "The scan found cookies without an explicit SameSite attribute.",
    whyItMatters:
      "SameSite helps reduce unintended cross-site cookie use and strengthens baseline request protections.",
    suggestedFix:
      "Set an explicit SameSite policy that matches the cookie's intended behavior.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(
            issue.evidence_json?.cookies_missing_samesite_count,
          );
          return count == null ? null : `Cookies missing SameSite: ${count}.`;
        })(),
      ]),
  },
  homepage_response_slow: {
    userTitle: "Homepage response looks slow",
    shortSummary:
      "The homepage took longer than the basic threshold used by Scanlark's lightweight check.",
    whatItMeans:
      "The root HTML response crossed the passive response-time threshold during the scan.",
    whyItMatters:
      "Slow initial responses can reduce user confidence and make key journeys feel sluggish before the page even renders.",
    suggestedFix:
      "Review server response time, caching, and heavy page work. Treat this as a signal to investigate, not a full performance audit.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const ms = asNumber(issue.evidence_json?.response_time_ms);
          return ms == null ? null : `Recorded response time: ${ms} ms.`;
        })(),
      ]),
  },
  homepage_html_too_large: {
    userTitle: "Homepage HTML looks heavy",
    shortSummary:
      "The homepage HTML payload was larger than the basic size threshold used by the scan.",
    whatItMeans:
      "The raw HTML alone may be doing too much before other assets are even considered.",
    whyItMatters:
      "Large HTML responses can slow delivery, parsing, and rendering, especially on weaker connections or devices.",
    suggestedFix:
      "Trim unnecessary markup, inline data, or template output on the homepage.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const size = formatBytes(
            asNumber(issue.evidence_json?.html_size_bytes),
          );
          return size ? `Recorded HTML size: ${size}.` : null;
        })(),
      ]),
  },
  homepage_asset_count_high: {
    userTitle: "Homepage references many assets",
    shortSummary:
      "The homepage appears to include a high number of linked images, scripts, and styles.",
    whatItMeans:
      "The scan counted a large number of asset references in the homepage HTML.",
    whyItMatters:
      "More assets can increase request overhead, complexity, and the chance of slow or inconsistent page loads.",
    suggestedFix:
      "Review whether all homepage assets are necessary and consolidate or defer non-critical ones where possible.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.asset_count);
          return count == null ? null : `Recorded asset count: ${count}.`;
        })(),
      ]),
  },
  homepage_image_count_high: {
    userTitle: "Homepage references many images",
    shortSummary:
      "The homepage HTML includes a large number of image references.",
    whatItMeans:
      "Image-heavy pages may load more slowly or compete for attention above the fold.",
    whyItMatters:
      "Too many images can increase weight and reduce performance, especially on mobile connections.",
    suggestedFix:
      "Reduce non-essential homepage images, lazy-load lower-priority media, and optimize the assets that stay.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.image_count);
          return count == null ? null : `Recorded image count: ${count}.`;
        })(),
      ]),
  },
  homepage_script_count_high: {
    userTitle: "Homepage references many scripts",
    shortSummary:
      "The homepage HTML includes a high number of external script references.",
    whatItMeans:
      "The page may rely on a large amount of client-side JavaScript for its initial experience.",
    whyItMatters:
      "Heavy script usage can slow page startup, delay rendering, and make the page experience less consistent.",
    suggestedFix:
      "Audit homepage scripts and remove, defer, or consolidate anything non-essential.",
    technicalDetail: (issue) =>
      buildTechnicalDetail(issue, [
        (() => {
          const count = asNumber(issue.evidence_json?.script_count);
          return count == null ? null : `Recorded script count: ${count}.`;
        })(),
      ]),
  },
};

function resolveTemplateValue(
  value: string | ((issue: IssuePresentationSource) => string),
  issue: IssuePresentationSource,
) {
  return typeof value === "function" ? value(issue) : value;
}

export function formatIssuePresentation(
  issue: IssuePresentationSource,
): IssuePresentation {
  const template = templates[issue.issue_type];
  if (!template) {
    return {
      userTitle: issue.title,
      shortSummary: issue.description,
      whatItMeans: issue.description,
      whyItMatters:
        "This finding may affect how the page, site, or destination works for visitors or search systems.",
      suggestedFix:
        "Review the affected URL, confirm the intended behavior, and update the page or configuration if needed.",
      technicalDetail: buildTechnicalDetail(issue, []),
      learnSlug: null,
    };
  }
  return {
    userTitle: resolveTemplateValue(template.userTitle, issue),
    shortSummary: resolveTemplateValue(template.shortSummary, issue),
    whatItMeans: resolveTemplateValue(template.whatItMeans, issue),
    whyItMatters: resolveTemplateValue(template.whyItMatters, issue),
    suggestedFix: resolveTemplateValue(template.suggestedFix, issue),
    technicalDetail: resolveTemplateValue(template.technicalDetail, issue),
    learnSlug: null,
  };
}
