import React from "react";
import type { LegalPageLink } from "../legalPages";
import { ScanlarkLogo } from "./brand/ScanlarkLogo";

type MarketingPageProps = {
  isAuthenticated: boolean;
  primaryLabel: string;
  secondaryLabel: string;
  onOpenPrimary: () => void;
  onOpenSecondary: () => void;
  onOpenLearn: () => void;
  legalLinks: LegalPageLink[];
  onOpenLegal: (path: string) => void;
  onOpenAccount?: () => void;
  managedMode?: boolean;
};

const issueCards = [
  {
    title: "Broken links and missing pages",
    body: "Find visitor journeys that lead to errors, redirects that no longer help, and links that should be fixed or removed.",
  },
  {
    title: "Missing resources",
    body: "Highlight public images, scripts, stylesheets, documents and embedded resources that fail to load correctly.",
  },
  {
    title: "Availability problems",
    body: "Check whether important public pages are reachable and whether ongoing monitoring should watch them more closely.",
  },
  {
    title: "HTTPS and configuration concerns",
    body: "Review common public HTTPS, redirect and header signals that can affect trust and basic website hygiene.",
  },
  {
    title: "Search-presentation basics",
    body: "Surface missing titles, weak descriptions, sitemap and robots issues that can affect how pages are understood.",
  },
  {
    title: "New problems after changes",
    body: "Use repeat checks to spot issues introduced by edits, plugin updates, migrations or content changes.",
  },
];

const serviceSteps = [
  {
    title: "Request a health check",
    body: "Send the site URL and a short note about the business. Scanlark confirms scope before any review starts.",
  },
  {
    title: "Public checks are run",
    body: "Scanlark checks public website signals from the outside without logging in, submitting forms or testing private systems.",
  },
  {
    title: "Findings are reviewed",
    body: "Automated evidence is reviewed before it is turned into a practical report, reducing noise and unsupported claims.",
  },
  {
    title: "You receive next steps",
    body: "The report explains what was found, what matters most, and what can be fixed, re-tested or monitored.",
  },
];

const faqItems = [
  {
    title: "Is this a security test?",
    body: "No. Scanlark provides passive public website health checks. It is not a penetration test, vulnerability assessment or complete security review.",
  },
  {
    title: "Do you guarantee rankings or revenue?",
    body: "No. The service identifies practical website issues and public signals. It does not guarantee search rankings, traffic, conversions or revenue.",
  },
  {
    title: "Can you fix the issues?",
    body: "Where suitable, Scanlark can quote for website fixes, coordination and re-testing. Work is agreed separately before it starts.",
  },
  {
    title: "Who is this for?",
    body: "Launch services are B2B-only for businesses, sole traders, charities and organisations purchasing for work or business purposes.",
  },
];

export const MarketingPage: React.FC<MarketingPageProps> = ({
  isAuthenticated,
  primaryLabel,
  secondaryLabel,
  onOpenPrimary,
  onOpenSecondary,
  legalLinks,
  onOpenLegal,
  onOpenAccount,
}) => {
  const secondaryAction =
    isAuthenticated && onOpenAccount ? onOpenAccount : onOpenSecondary;

  return (
    <div className="scanlark-public-page">
      <header className="scanlark-public-header">
        <div className="scanlark-public-container scanlark-public-header__inner">
          <ScanlarkLogo
            linked
            href="/"
            width={210}
            priority
            theme="light"
            className="scanlark-logo-on-surface"
          />
          <nav className="scanlark-public-nav" aria-label="Public navigation">
            <a href="#problems">Problems</a>
            <a href="#process">Process</a>
            <a href="#report">Report</a>
            <a href="#monitoring">Monitoring</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="scanlark-public-actions">
            <button
              type="button"
              className="scanlark-public-login"
              onClick={secondaryAction}
            >
              {isAuthenticated ? "Account" : secondaryLabel}
            </button>
            <button
              type="button"
              className="scanlark-public-button scanlark-public-button--primary"
              onClick={onOpenPrimary}
            >
              {primaryLabel}
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="scanlark-public-container scanlark-public-hero">
          <div className="scanlark-public-hero__content">
            <div className="scanlark-public-eyebrow">
              Founder-operated website health checks
            </div>
            <h1>
              Know when your website has problems before your customers do.
            </h1>
            <p>
              Scanlark helps small-business owners identify broken links,
              missing resources, website errors and other public issues that can
              affect visitors, trust and day-to-day enquiries.
            </p>
            <div className="scanlark-public-hero__actions">
              <button
                type="button"
                className="scanlark-public-button scanlark-public-button--primary"
                onClick={onOpenPrimary}
              >
                Request a website health check
              </button>
              <a
                className="scanlark-public-button scanlark-public-button--secondary"
                href="#process"
              >
                See how it works
              </a>
            </div>
            <div className="scanlark-public-proof" aria-label="Service summary">
              <span>Reviewed findings, not raw scan dumps</span>
              <span>B2B-only launch service</span>
              <span>No public self-service registration</span>
              <span>No analytics or advertising pixels</span>
            </div>
          </div>

          <div className="scanlark-public-hero__visual" id="report">
            <div
              className="scanlark-public-report"
              aria-label="Example reviewed report preview"
            >
              <div className="scanlark-public-report__top">
                <div>
                  <div className="scanlark-public-eyebrow">Reviewed report</div>
                  <h2>Website health summary</h2>
                </div>
                <div className="scanlark-public-report__score">18</div>
              </div>
              <p>
                Example issue count shown for illustration. Real reports depend
                on the website reviewed and owner-approved scope.
              </p>
              <div className="scanlark-public-report__list">
                {[
                  ["High priority", "Missing pages affecting key journeys"],
                  ["Medium priority", "Images and resources failing to load"],
                  ["Watch list", "HTTPS, sitemap and robots signals"],
                  ["Next steps", "Fix, re-test and monitor changes"],
                ].map(([label, value]) => (
                  <div className="scanlark-public-report__row" key={label}>
                    <span>{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="scanlark-public-section" id="problems">
          <div className="scanlark-public-container">
            <div className="scanlark-public-section__heading">
              <div className="scanlark-public-eyebrow">
                What Scanlark checks
              </div>
              <h2>Issues that can quietly damage visitor confidence.</h2>
              <p>
                Scanlark focuses on practical public website problems, then
                reviews the evidence before turning it into a client-ready
                summary.
              </p>
            </div>
            <div className="scanlark-public-grid">
              {issueCards.map((item) => (
                <article className="scanlark-public-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scanlark-public-section" id="process">
          <div className="scanlark-public-container">
            <div className="scanlark-public-section__heading">
              <div className="scanlark-public-eyebrow">Managed service</div>
              <h2>A clear review process from first check to next action.</h2>
              <p>
                The launch service is founder-operated. The private Scanlark
                application remains internal for prospect management, scanning,
                reviewed reports, communications, quotes and work orders.
              </p>
            </div>
            <div className="scanlark-public-grid">
              {serviceSteps.map((item) => (
                <article className="scanlark-public-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scanlark-public-section">
          <div className="scanlark-public-container scanlark-public-grid scanlark-public-grid--two">
            <article className="scanlark-public-card scanlark-public-card--accent">
              <div className="scanlark-public-eyebrow">
                What clients receive
              </div>
              <h3>A reviewed website health report</h3>
              <ul>
                <li>Plain-English issue summaries and priorities.</li>
                <li>Evidence for important findings.</li>
                <li>
                  Positive observations where the site is already healthy.
                </li>
                <li>Methodology, limitations and recommended next steps.</li>
              </ul>
            </article>
            <article className="scanlark-public-card">
              <div className="scanlark-public-eyebrow">
                Fixes and re-testing
              </div>
              <h3>Optional follow-up work</h3>
              <p>
                Where useful, Scanlark can provide a separate quote for fixes,
                coordination or re-testing. No fix work starts until scope,
                price and responsibilities are agreed.
              </p>
            </article>
          </div>
        </section>

        <section className="scanlark-public-section" id="monitoring">
          <div className="scanlark-public-container scanlark-public-grid scanlark-public-grid--two">
            <article className="scanlark-public-card">
              <div className="scanlark-public-eyebrow">Ongoing monitoring</div>
              <h3>Catch new problems after website changes.</h3>
              <p>
                For managed clients, repeat checks can help spot new broken
                links, missing resources, availability concerns and public
                configuration changes after updates.
              </p>
            </article>
            <article className="scanlark-public-card">
              <div className="scanlark-public-eyebrow">
                Methodology and limits
              </div>
              <h3>Clear scope, no inflated claims.</h3>
              <p>
                Scanlark checks public signals only. Findings can be incomplete
                or require context, so reports should be reviewed before making
                operational, legal, accessibility or security decisions.
              </p>
            </article>
          </div>
        </section>

        <section className="scanlark-public-section" id="faq">
          <div className="scanlark-public-container">
            <div className="scanlark-public-section__heading">
              <div className="scanlark-public-eyebrow">FAQ</div>
              <h2>Straight answers before you enquire.</h2>
            </div>
            <div className="scanlark-public-grid">
              {faqItems.map((item) => (
                <article className="scanlark-public-card" key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scanlark-public-section">
          <div className="scanlark-public-container">
            <div className="scanlark-public-final">
              <h2>Request a website health check.</h2>
              <p>
                Send your website URL and a short note about what you want
                checked. Scanlark will confirm scope before any managed review
                starts.
              </p>
              <div>
                <button
                  type="button"
                  className="scanlark-public-button scanlark-public-button--primary"
                  onClick={onOpenPrimary}
                >
                  Request a website health check
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="scanlark-public-footer">
        <div className="scanlark-public-container scanlark-public-footer__inner">
          <div className="scanlark-public-footer__brand">
            <ScanlarkLogo
              width={180}
              theme="light"
              className="scanlark-logo-on-surface"
            />
            <p>
              Scanlark is operated by Connor Smith in the United Kingdom.
              Business services only. Contact: contact@scanlark.com
            </p>
            <p className="scanlark-public-small">
              B2B website health checks for businesses, sole traders, charities
              and organisations.
            </p>
          </div>
          <div className="scanlark-public-footer__links">
            {legalLinks.map((link) => (
              <a
                key={link.slug}
                href={link.path}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLegal(link.path);
                }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="/login"
              onClick={(event) => {
                event.preventDefault();
                onOpenSecondary();
              }}
            >
              Internal login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
