export type LearnArticleCategory =
  | "broken_links"
  | "seo_basics"
  | "search_engine_access"
  | "ssl_https"
  | "security_setup"
  | "speed_basics"
  | "website_changes"
  | "monitoring_reports";

export type LearnArticleAudience = "non_technical" | "mixed";

export type LearnRelatedIssueType =
  | "broken_link"
  | "blocked_link"
  | "no_response"
  | "ignored_safety_skip"
  | "missing_title"
  | "empty_title"
  | "duplicate_title"
  | "missing_meta_description"
  | "empty_meta_description"
  | "missing_h1"
  | "multiple_h1"
  | "noindex_detected"
  | "canonical_multiple"
  | "robots_missing"
  | "robots_unreachable"
  | "robots_blocks_all"
  | "robots_no_sitemap_reference"
  | "sitemap_missing"
  | "sitemap_unreachable"
  | "sitemap_invalid"
  | "sitemap_empty"
  | "sitemap_url_broken"
  | "https_unavailable"
  | "http_not_redirecting_to_https"
  | "ssl_certificate_expired"
  | "ssl_certificate_expiring_soon"
  | "ssl_certificate_hostname_mismatch"
  | "ssl_certificate_invalid"
  | "hsts_missing"
  | "csp_missing"
  | "frame_ancestors_missing"
  | "x_frame_options_missing"
  | "x_content_type_options_missing"
  | "referrer_policy_missing"
  | "permissions_policy_missing"
  | "set_cookie_missing_secure"
  | "set_cookie_missing_httponly"
  | "set_cookie_missing_samesite"
  | "homepage_response_slow"
  | "homepage_html_too_large"
  | "homepage_asset_count_high"
  | "homepage_image_count_high"
  | "homepage_script_count_high";

export interface LearnArticle {
  slug: string;
  title: string;
  category: LearnArticleCategory;
  summary: string;
  whatItMeans: string;
  whyItMatters: string;
  howToFix: string;
  technicalDetail: string;
  relatedIssueTypes: LearnRelatedIssueType[];
  relatedArticleSlugs: string[];
  keywords: string[];
  audience: LearnArticleAudience;
}

export const LEARN_CATEGORY_ORDER: LearnArticleCategory[] = [
  "broken_links",
  "seo_basics",
  "search_engine_access",
  "ssl_https",
  "security_setup",
  "speed_basics",
  "website_changes",
  "monitoring_reports",
];

export const FEATURED_LEARN_ARTICLE_SLUGS = [
  "how-to-read-a-scan-report",
  "broken-links",
  "robots-txt",
  "security-headers",
] as const;

const categoryLabels: Record<LearnArticleCategory, string> = {
  broken_links: "Broken Links",
  seo_basics: "SEO Basics",
  search_engine_access: "Search Engine Access",
  ssl_https: "SSL & HTTPS",
  security_setup: "Security Setup",
  speed_basics: "Speed Basics",
  website_changes: "Website Changes",
  monitoring_reports: "Monitoring Reports",
};

export function getLearnCategoryLabel(category: LearnArticleCategory) {
  return categoryLabels[category];
}

export const LEARN_ARTICLES: LearnArticle[] = [
  {
    slug: "broken-links",
    title: "Broken links",
    category: "broken_links",
    summary:
      "Understand why links fail, how that affects visitors, and what to check first.",
    whatItMeans:
      "A broken link points to a page or file that did not respond in a healthy way during the scan. Scanlark may also flag links that timed out, were blocked, or were skipped for safety reasons.",
    whyItMatters:
      "Broken links interrupt journeys, reduce trust, and can leave important pages or resources effectively unreachable. They also make reports harder to act on because people need to work around missing content.",
    howToFix:
      "Start with the affected URL and confirm whether the destination should still exist. Update outdated links, restore missing pages, or add redirects when content has moved. If the link is intentionally protected, decide whether it should remain public in that location.",
    technicalDetail:
      "These articles cover Scanlark link findings such as HTTP errors, no-response destinations, blocked checks, and safety-sensitive URLs that were intentionally skipped to avoid side effects.",
    relatedIssueTypes: [
      "broken_link",
      "blocked_link",
      "no_response",
      "ignored_safety_skip",
    ],
    relatedArticleSlugs: [
      "understanding-scan-changes",
      "how-to-read-a-scan-report",
    ],
    keywords: [
      "404",
      "dead link",
      "broken page",
      "redirect",
      "timeout",
      "blocked url",
    ],
    audience: "non_technical",
  },
  {
    slug: "page-titles-and-meta-descriptions",
    title: "Page titles and meta descriptions",
    category: "seo_basics",
    summary:
      "Learn how page titles and summaries help people and search engines understand a page.",
    whatItMeans:
      "Page titles and meta descriptions are short pieces of page metadata. Scanlark flags them when they are missing, empty, duplicated, or when related indexing signals suggest the page may not be presented clearly in search.",
    whyItMatters:
      "These fields shape how pages appear in browser tabs, search results, and shared links. Weak or duplicated metadata can make pages harder to distinguish and can reduce click quality.",
    howToFix:
      "Write a specific title and a concise description for each important page. Keep them aligned with the page content and make sure reused templates are not producing identical values across different pages.",
    technicalDetail:
      "This article supports title, meta description, duplicate-title, canonical, and noindex-related findings that come from page-level SEO checks already stored in Scanlark reports.",
    relatedIssueTypes: [
      "missing_title",
      "empty_title",
      "duplicate_title",
      "missing_meta_description",
      "empty_meta_description",
      "canonical_multiple",
      "noindex_detected",
    ],
    relatedArticleSlugs: [
      "headings-and-page-structure",
      "how-to-read-a-scan-report",
    ],
    keywords: [
      "title tag",
      "meta description",
      "duplicate title",
      "noindex",
      "canonical",
      "search snippet",
    ],
    audience: "non_technical",
  },
  {
    slug: "headings-and-page-structure",
    title: "Headings and page structure",
    category: "seo_basics",
    summary:
      "See why a clear main heading helps pages read better for people, teams, and search systems.",
    whatItMeans:
      "A page usually needs one clear top-level heading that matches what the page is about. Scanlark flags pages that are missing that main heading or use more than one H1.",
    whyItMatters:
      "Headings help visitors orient themselves quickly and make page templates easier to manage. A weak heading structure can make content harder to understand or maintain.",
    howToFix:
      "Keep one main H1 that reflects the page topic, then use lower heading levels for supporting sections. If a template generates several H1s, reduce the extras to H2 or H3 where appropriate.",
    technicalDetail:
      "These findings come from page checks that count H1 elements and compare that count against a simple expected structure.",
    relatedIssueTypes: ["missing_h1", "multiple_h1"],
    relatedArticleSlugs: [
      "page-titles-and-meta-descriptions",
      "how-to-read-a-scan-report",
    ],
    keywords: ["h1", "page heading", "content structure", "template issue"],
    audience: "non_technical",
  },
  {
    slug: "robots-txt",
    title: "robots.txt",
    category: "search_engine_access",
    summary:
      "Understand what robots.txt does, what it does not do, and why Scanlark checks it.",
    whatItMeans:
      "robots.txt is a public file that gives crawl instructions to search engines and other automated visitors. Scanlark flags it when the file is missing, unreachable, blocks the full site, or does not reference a sitemap.",
    whyItMatters:
      "A misconfigured robots.txt file can prevent important pages from being crawled or hide useful signals that help search engines discover content efficiently.",
    howToFix:
      "Check whether the file should exist, whether it is reachable, and whether its rules match the parts of the site you want search engines to crawl. Add sitemap references when you want discovery to be clearer.",
    technicalDetail:
      "This article covers direct robots.txt checks, including reachability, full-site wildcard blocking, and whether sitemap references were found in the file.",
    relatedIssueTypes: [
      "robots_missing",
      "robots_unreachable",
      "robots_blocks_all",
      "robots_no_sitemap_reference",
    ],
    relatedArticleSlugs: ["xml-sitemaps", "how-to-read-a-scan-report"],
    keywords: [
      "crawler access",
      "disallow",
      "allow",
      "search indexing",
      "sitemap reference",
    ],
    audience: "mixed",
  },
  {
    slug: "xml-sitemaps",
    title: "XML sitemaps",
    category: "search_engine_access",
    summary:
      "Learn what a sitemap tells search engines and what common sitemap problems look like.",
    whatItMeans:
      "A sitemap is a machine-readable list of URLs you want search engines to find and revisit. Scanlark checks whether sitemap files exist, can be fetched, contain usable XML, and reference healthy URLs.",
    whyItMatters:
      "Sitemaps make discovery easier, especially for large or frequently updated sites. Broken or empty sitemaps can slow down discovery or send search engines toward bad URLs.",
    howToFix:
      "Confirm the expected sitemap URL, repair invalid XML, remove broken destinations, and make sure at least one useful sitemap is publicly reachable. If the site publishes several sitemaps, make sure they stay current and linked from robots.txt.",
    technicalDetail:
      "This article covers missing, unreachable, invalid, empty, and broken-URL sitemap findings from Scanlark site checks and sampled sitemap URL validation.",
    relatedIssueTypes: [
      "sitemap_missing",
      "sitemap_unreachable",
      "sitemap_invalid",
      "sitemap_empty",
      "sitemap_url_broken",
    ],
    relatedArticleSlugs: ["robots-txt", "how-to-read-a-scan-report"],
    keywords: [
      "sitemap.xml",
      "sitemap index",
      "invalid xml",
      "empty sitemap",
      "search discovery",
    ],
    audience: "mixed",
  },
  {
    slug: "https-and-redirects",
    title: "HTTPS and redirects",
    category: "ssl_https",
    summary:
      "Understand why secure page delivery and clean redirects are foundational website checks.",
    whatItMeans:
      "Scanlark checks whether the site is reachable over HTTPS and whether HTTP requests are redirected to the secure version. These findings focus on transport behavior, not just certificate details.",
    whyItMatters:
      "Visitors expect secure connections by default. Missing HTTPS or inconsistent redirects can create trust issues, duplicate content paths, and avoidable exposure to insecure traffic.",
    howToFix:
      "Make sure the site serves the expected HTTPS hostname and redirect plain HTTP traffic to the secure version. If redirects are partial or inconsistent, fix them at the hosting, CDN, or edge layer.",
    technicalDetail:
      "This article supports HTTPS availability and HTTP-to-HTTPS redirect findings produced from root URL checks in the current scanner.",
    relatedIssueTypes: ["https_unavailable", "http_not_redirecting_to_https"],
    relatedArticleSlugs: ["ssl-certificates", "security-headers"],
    keywords: [
      "https",
      "http redirect",
      "secure transport",
      "canonical host",
      "tls",
    ],
    audience: "non_technical",
  },
  {
    slug: "ssl-certificates",
    title: "SSL certificates",
    category: "ssl_https",
    summary:
      "Learn what certificates do and why expiry or hostname problems trigger urgent warnings.",
    whatItMeans:
      "An SSL certificate proves that the secure site connection belongs to the expected hostname and is still valid. Scanlark flags expired, expiring, mismatched, or otherwise invalid certificates.",
    whyItMatters:
      "Certificate issues can cause browser warnings, block access entirely, or break user trust at the moment people try to reach the site.",
    howToFix:
      "Renew expiring certificates before they lapse, verify that every public hostname is covered, and fix any deployment mismatch between the certificate and the host being served.",
    technicalDetail:
      "These findings come from TLS certificate checks against the public site and focus on validity dates, hostname coverage, and general certificate integrity.",
    relatedIssueTypes: [
      "ssl_certificate_expired",
      "ssl_certificate_expiring_soon",
      "ssl_certificate_hostname_mismatch",
      "ssl_certificate_invalid",
    ],
    relatedArticleSlugs: ["https-and-redirects", "security-headers"],
    keywords: [
      "certificate expiry",
      "hostname mismatch",
      "tls certificate",
      "browser warning",
    ],
    audience: "mixed",
  },
  {
    slug: "security-headers",
    title: "Security headers",
    category: "security_setup",
    summary:
      "See what common browser security headers do and why Scanlark reports them separately.",
    whatItMeans:
      "Security headers tell browsers how to handle content, framing, cookies, and cross-site behavior. Scanlark surfaces missing or weak settings in this area because they are often easy to overlook.",
    whyItMatters:
      "These settings help reduce browser-side risks and make the site’s security posture more predictable. Missing headers do not always mean a breach, but they usually mean there is avoidable hardening work left to do.",
    howToFix:
      "Review the reported headers at the web server, CDN, application gateway, or framework level. Add the missing protections in a staged way, then test them against your actual content and login flows.",
    technicalDetail:
      "This article covers HSTS, CSP, frame protection, content-type sniffing, referrer policy, permissions policy, and secure cookie attribute findings from the HTTPS root header check.",
    relatedIssueTypes: [
      "hsts_missing",
      "csp_missing",
      "frame_ancestors_missing",
      "x_frame_options_missing",
      "x_content_type_options_missing",
      "referrer_policy_missing",
      "permissions_policy_missing",
      "set_cookie_missing_secure",
      "set_cookie_missing_httponly",
      "set_cookie_missing_samesite",
    ],
    relatedArticleSlugs: ["https-and-redirects", "ssl-certificates"],
    keywords: [
      "hsts",
      "csp",
      "x-frame-options",
      "secure cookies",
      "browser hardening",
    ],
    audience: "mixed",
  },
  {
    slug: "homepage-speed-basics",
    title: "Homepage speed basics",
    category: "speed_basics",
    summary:
      "Understand the first performance signals Scanlark checks and what they usually point to.",
    whatItMeans:
      "Scanlark looks at basic homepage performance indicators such as response time, HTML size, asset count, image count, and script count. These are directional signals rather than deep performance profiling.",
    whyItMatters:
      "A slow or heavy homepage can affect first impressions, conversion, crawl efficiency, and mobile usability. It can also signal broader template or content-management problems.",
    howToFix:
      "Start with the largest contributors: oversized HTML, too many images, too many scripts, or slow server responses. Reduce unnecessary page weight before chasing smaller optimizations.",
    technicalDetail:
      "These findings come from the existing performance-basic HTTPS root check and intentionally stay at a lightweight diagnostic level rather than full Core Web Vitals auditing.",
    relatedIssueTypes: [
      "homepage_response_slow",
      "homepage_html_too_large",
      "homepage_asset_count_high",
      "homepage_image_count_high",
      "homepage_script_count_high",
    ],
    relatedArticleSlugs: [
      "how-to-read-a-scan-report",
      "understanding-scan-changes",
    ],
    keywords: [
      "page speed",
      "html size",
      "asset count",
      "image count",
      "script count",
    ],
    audience: "non_technical",
  },
  {
    slug: "understanding-scan-changes",
    title: "Understanding scan changes",
    category: "website_changes",
    summary:
      "Learn how new, existing, and resolved findings help you track website health over time.",
    whatItMeans:
      "Scanlark compares completed scans so it can show what is new, what is still present, and what appears resolved. This gives teams a simple way to separate fresh regressions from longer-running work.",
    whyItMatters:
      "Without change tracking, every report reads like a full rediscovery exercise. Change labels help teams prioritize recent movement and avoid re-triaging the same issue from scratch.",
    howToFix:
      "Use the change labels to focus first on new issues, then review persistent issues that continue to affect important pages. Resolved items help confirm whether fixes actually held in a later scan.",
    technicalDetail:
      "This article explains Scanlark report states such as new, existing, and resolved findings, plus how baseline comparisons shape dashboard and report summaries.",
    relatedIssueTypes: [],
    relatedArticleSlugs: ["how-to-read-a-scan-report", "broken-links"],
    keywords: [
      "new issue",
      "existing issue",
      "resolved issue",
      "baseline",
      "change detection",
    ],
    audience: "non_technical",
  },
  {
    slug: "how-to-read-a-scan-report",
    title: "How to read a Scanlark report",
    category: "monitoring_reports",
    summary:
      "Use this guide to interpret health scores, issue lists, evidence, diagnostics, and category summaries.",
    whatItMeans:
      "A Scanlark report is a practical record of one completed scan. It combines scores, issue severity, plain-English summaries, raw evidence, and technical diagnostics so both non-technical and technical readers can work from the same source.",
    whyItMatters:
      "Teams move faster when everyone is looking at the same signals and understands where plain-language guidance ends and technical evidence begins.",
    howToFix:
      "Read the summary first, then top-priority issues, then the detailed table and diagnostics for anything that needs deeper investigation. Use affected URLs, source URLs, and change labels to hand off work clearly.",
    technicalDetail:
      "This article supports report interpretation rather than one specific issue type. It pairs well with the issue-specific guides when a finding needs more context.",
    relatedIssueTypes: [],
    relatedArticleSlugs: [
      "understanding-scan-changes",
      "broken-links",
      "page-titles-and-meta-descriptions",
      "security-headers",
    ],
    keywords: [
      "report",
      "dashboard",
      "health score",
      "severity",
      "technical diagnostics",
      "evidence",
    ],
    audience: "non_technical",
  },
];

export const LEARN_ARTICLES_BY_SLUG = Object.fromEntries(
  LEARN_ARTICLES.map((article) => [article.slug, article]),
) as Record<string, LearnArticle>;
