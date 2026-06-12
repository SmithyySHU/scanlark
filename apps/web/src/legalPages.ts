export type LegalPageSlug =
  | "terms"
  | "privacy"
  | "cookies"
  | "acceptable-use"
  | "contact"
  | "report-abuse";

export type LegalPageSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalPageContent = {
  slug: LegalPageSlug;
  path: string;
  label: string;
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalPageSection[];
};

export type LegalPageLink = Pick<LegalPageContent, "slug" | "path" | "label">;

export const SUPPORT_EMAIL = "support@scanlark.com";

export const CRAWLER_SAFETY_RULE =
  "Scanlark only checks publicly visible website pages, HTML, response headers, sitemap/robots files, SSL certificates, response codes, and public links/assets. It does not log in, submit forms, exploit vulnerabilities, brute force, scan ports, access private systems, or perform aggressive vulnerability scanning.";

const LAST_UPDATED = "June 2026";

export const LEGAL_PAGES: LegalPageContent[] = [
  {
    slug: "terms",
    path: "/terms",
    label: "Terms",
    title: "Terms",
    intro:
      "These alpha terms explain the basic expectations for using Scanlark during hosted testing.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "What Scanlark Does",
        paragraphs: [
          "Scanlark is a passive website monitoring and reporting tool. It helps users review public website health signals, scan history, issue changes, availability, and report outputs.",
          CRAWLER_SAFETY_RULE,
        ],
      },
      {
        title: "Websites You May Add",
        paragraphs: [
          "You may only add websites that you own, control, or are authorised by the website owner to scan and monitor with Scanlark.",
          "You are responsible for making sure you have permission before adding a website, enabling scheduled monitoring, sharing reports, or sending notifications.",
        ],
      },
      {
        title: "Reports And Alpha Status",
        paragraphs: [
          "Scanlark reports are informational. They may contain incomplete, outdated, or incorrect findings and should be reviewed before making operational, legal, or security decisions.",
          "Scanlark is currently an alpha product. Features, limits, wording, reports, and availability may change while the service is being tested.",
        ],
      },
      {
        title: "Abuse And Suspension",
        paragraphs: [
          "Accounts, sites, scans, or share links may be paused, limited, or suspended if unauthorised scanning, abuse, disruption, or unsafe use is suspected.",
          "Payments and subscriptions are not live yet. Billing terms, paid plans, refunds, and subscription controls will be added later before paid use begins.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    path: "/privacy",
    label: "Privacy",
    title: "Privacy",
    intro:
      "This page explains the basic personal data Scanlark may process during alpha.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Data We May Collect",
        bullets: [
          "Account email address and display name.",
          "Website and site metadata added by you.",
          "Scan, report, link, issue, uptime, and notification data created by the service.",
          "Notification settings and email outbox records.",
          "Support, contact, or abuse-report messages you send us.",
          "Technical logs such as IP address, session, device, browser, request, and security event information where applicable.",
        ],
      },
      {
        title: "Why We Use It",
        bullets: [
          "To provide account access and keep sessions secure.",
          "To run scans, produce reports, and show monitoring history.",
          "To send configured notifications and service messages.",
          "To prevent abuse, investigate unauthorised use, and protect the service.",
          "To answer support requests and improve the product during alpha.",
        ],
      },
      {
        title: "Sharing And Providers",
        paragraphs: [
          "We do not sell personal data.",
          "Scanlark may use service providers for hosting, SMTP/email delivery, database and infrastructure services, logging, and later payment processing. Providers should only receive data needed to provide those services.",
        ],
      },
      {
        title: "Your Requests",
        paragraphs: [
          "You can contact support@scanlark.com to request correction, deletion, or export of your account data. Some data may need to be retained for security, abuse prevention, operational records, or legal reasons.",
          "Retention rules are still being refined for alpha and will be made clearer before public beta.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    path: "/cookies",
    label: "Cookies",
    title: "Cookies",
    intro:
      "This page explains how Scanlark uses cookies and local storage for essential app behavior.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Essential Storage",
        paragraphs: [
          "Scanlark uses essential cookies and browser storage for login sessions, security, preferences, and core app functionality.",
          "Local storage or session storage may be used for theme preference, selected site preference, dashboard state, and similar product settings.",
        ],
      },
      {
        title: "Marketing And Analytics",
        paragraphs: [
          "Scanlark does not currently use marketing cookies.",
          "If analytics or other non-essential cookies are added later, the cookie notice and consent approach will be updated before those tools are used.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    path: "/acceptable-use",
    label: "Acceptable Use",
    title: "Acceptable Use",
    intro:
      "These rules keep Scanlark focused on authorised, passive public website monitoring.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Permission Required",
        paragraphs: [
          "You must only monitor websites you own, control, or are authorised by the owner to monitor.",
          "Do not add, scan, monitor, or share reports for third-party websites without permission.",
        ],
      },
      {
        title: "Not Allowed",
        bullets: [
          "Using Scanlark for abuse, disruption, harassment, or unauthorised competitive scraping.",
          "Trying to use Scanlark to exploit vulnerabilities or bypass restrictions.",
          "Targeting private IPs, internal hostnames, localhost, or systems that are not public websites.",
          "Attempting to turn Scanlark into a vulnerability scanner, brute-force tool, port scanner, or aggressive crawler.",
        ],
      },
      {
        title: "Crawler Safety Rule",
        paragraphs: [CRAWLER_SAFETY_RULE],
      },
      {
        title: "Review And Suspension",
        paragraphs: [
          "Scanlark may pause scans, disable sites, suspend accounts, or revoke share links if abuse or unauthorised monitoring is suspected.",
          "If you believe your website is being monitored without permission, report it at support@scanlark.com.",
        ],
      },
    ],
  },
  {
    slug: "contact",
    path: "/contact",
    label: "Contact",
    title: "Contact",
    intro: "Contact Scanlark for alpha support, account help, and questions.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Support",
        paragraphs: [
          "Email support@scanlark.com for general support, account help, product questions, and alpha feedback.",
          "Scanlark is an alpha product, so response times may vary while the service and support process are being tested.",
        ],
      },
    ],
  },
  {
    slug: "report-abuse",
    path: "/report-abuse",
    label: "Report Abuse",
    title: "Report Abuse",
    intro:
      "Use this page to report suspected unauthorised monitoring or unsafe use of Scanlark.",
    lastUpdated: LAST_UPDATED,
    sections: [
      {
        title: "Where To Report",
        paragraphs: [
          "Email support@scanlark.com to report suspected unauthorised monitoring, abuse, or unsafe use. This address is used for abuse reports during alpha.",
        ],
      },
      {
        title: "What To Include",
        bullets: [
          "The domain or website affected.",
          "Why you believe monitoring is unauthorised.",
          "Your contact details so we can follow up.",
          "Any relevant context, screenshots, or report links.",
        ],
      },
      {
        title: "Review Process",
        paragraphs: [
          "Scanlark may pause scans, disable monitoring, or suspend related sites or accounts while reviewing an abuse report.",
        ],
      },
    ],
  },
];

export const LEGAL_PAGE_BY_SLUG = Object.fromEntries(
  LEGAL_PAGES.map((page) => [page.slug, page]),
) as Record<LegalPageSlug, LegalPageContent>;

export const LEGAL_PAGE_LINKS: LegalPageLink[] = LEGAL_PAGES.map(
  ({ slug, path, label }) => ({ slug, path, label }),
);

export function getLegalPageSlugFromPath(path: string): LegalPageSlug | null {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/abuse") return "report-abuse";
  const match = LEGAL_PAGES.find((page) => page.path === normalized);
  return match?.slug ?? null;
}
