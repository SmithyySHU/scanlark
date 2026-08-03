import React, { useState } from "react";
import type { LegalPageLink } from "../legalPages";
import { SUPPORT_EMAIL } from "../legalPages";
import { PublicSiteShell } from "./PublicSiteShell";

type MarketingPageProps = {
  isAuthenticated: boolean;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHref?: string;
  secondaryHref?: string;
  onOpenPrimary: () => void;
  onOpenSecondary: () => void;
  onOpenLearn: () => void;
  legalLinks: LegalPageLink[];
  onOpenLegal: (path: string) => void;
  onNavigate: (path: string) => void;
  onOpenAccount?: () => void;
  managedMode?: boolean;
  themeControl?: React.ReactNode;
};

const impactItems = [
  {
    title: "Broken customer journeys",
    body: "Broken links, missing pages and stale redirects are grouped into practical findings so you can see which journeys need attention first.",
    meta: "Links, redirects and missing destinations",
  },
  {
    title: "Resources that fail quietly",
    body: "Images, scripts, stylesheets, documents and embeds are checked from public pages, then reviewed before they become client-facing recommendations.",
    meta: "Public assets and page evidence",
  },
  {
    title: "Availability and trust signals",
    body: "Scanlark checks public availability, HTTPS and selected configuration signals without treating a health check as a security audit.",
    meta: "Uptime, HTTPS and headers",
  },
  {
    title: "Search-presentation basics",
    body: "Page titles, descriptions, sitemap and robots signals are surfaced as basic presentation issues, not as ranking promises.",
    meta: "Metadata, sitemap and robots",
  },
  {
    title: "Problems after website changes",
    body: "Repeat checks can highlight issues introduced by content edits, plugin updates, redesigns, migrations or third-party changes.",
    meta: "Change detection and re-tests",
  },
];

const processSteps = [
  {
    title: "Request a check",
    body: "Send the website URL and a short note. Scope is confirmed before review work starts.",
  },
  {
    title: "Public pages are scanned",
    body: "Scanlark collects public evidence without logging in, submitting forms, scanning ports or testing private systems.",
  },
  {
    title: "Findings are reviewed",
    body: "Automated evidence is checked and grouped so repeated technical occurrences become clearer client findings.",
  },
  {
    title: "You receive next actions",
    body: "The report explains priorities, evidence, positive observations and options for fixes, re-test or monitoring.",
  },
];

const serviceOutcomes = [
  {
    title: "Health check",
    bullets: [
      "Reviewed report",
      "Prioritised grouped findings",
      "Evidence and representative examples",
      "Positive observations",
      "Recommended next steps",
    ],
  },
  {
    title: "Optional fixes and re-test",
    bullets: [
      "Separately quoted",
      "Agreed scope",
      "Clear access requirements",
      "Re-test after work",
      "Updated report where applicable",
    ],
  },
  {
    title: "Ongoing monitoring",
    bullets: [
      "Repeat checks",
      "Change detection",
      "Availability monitoring",
      "Periodic reviewed reports",
      "Managed support where agreed",
    ],
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
    title: "Can Scanlark fix the issues?",
    body: "Where suitable, Scanlark can quote separately for fixes, coordination and re-testing. No fix work starts until scope, price and responsibilities are agreed.",
  },
  {
    title: "Who is the service for?",
    body: "Launch services are B2B-only for businesses, sole traders, charities and organisations purchasing for work or business purposes.",
  },
  {
    title: "What pages are checked?",
    body: "Checks focus on publicly accessible pages and public website responses. Private, logged-in or restricted areas require separate agreement.",
  },
  {
    title: "Is ongoing monitoring available?",
    body: "Yes, where agreed. Repeat checks can watch for new broken links, availability concerns and configuration changes after website updates.",
  },
];

export const MarketingPage: React.FC<MarketingPageProps> = ({
  isAuthenticated,
  primaryLabel,
  secondaryLabel,
  primaryHref,
  secondaryHref,
  onOpenPrimary,
  onOpenSecondary,
  legalLinks,
  onOpenLegal,
  onNavigate,
  themeControl,
}) => {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <PublicSiteShell
      isAuthenticated={isAuthenticated}
      primaryLabel={primaryLabel}
      secondaryLabel={isAuthenticated ? "Open Operations" : secondaryLabel}
      primaryHref={primaryHref}
      secondaryHref={secondaryHref}
      onOpenPrimary={onOpenPrimary}
      onOpenSecondary={onOpenSecondary}
      legalLinks={legalLinks}
      onOpenLegal={onOpenLegal}
      onNavigate={onNavigate}
      themeControl={themeControl}
    >
      <section className="scanlark-public-hero">
        <div className="scanlark-public-container scanlark-public-hero__inner">
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
              <span>Public pages only</span>
              <span>Reviewed before delivery</span>
              <span>No bulk automated report</span>
              <span>B2B service</span>
            </div>
          </div>

          <div
            className="scanlark-report-visual"
            aria-label="Illustrative Scanlark report preview"
          >
            <div className="scanlark-report-visual__chrome">
              <span />
              <span />
              <span />
            </div>
            <div className="scanlark-report-visual__header">
              <div>
                <div className="scanlark-public-eyebrow">
                  Illustrative reviewed report
                </div>
                <h2>Website health summary</h2>
              </div>
              <div className="scanlark-report-visual__status">Reviewed</div>
            </div>
            <div className="scanlark-report-visual__grid">
              <div className="scanlark-report-visual__score">
                <span>Priority</span>
                <strong>Important</strong>
                <small>Grouped client finding</small>
              </div>
              <div className="scanlark-report-visual__finding">
                <span>Finding</span>
                <strong>Missing pages affecting customer journeys</strong>
                <p>
                  Multiple public links lead visitors to unavailable pages.
                  Representative examples are included for review.
                </p>
              </div>
            </div>
            <div className="scanlark-report-visual__timeline">
              {["Scan evidence", "Human review", "Action plan"].map((item) => (
                <div key={item}>
                  <span aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
            <div className="scanlark-report-visual__rows">
              {[
                ["Evidence", "Affected page and destination examples"],
                ["Positive note", "HTTPS and sitemap reachable"],
                ["Next action", "Fix links, re-test, monitor changes"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="scanlark-public-section" id="problems">
        <div className="scanlark-public-container">
          <div className="scanlark-public-section__heading">
            <div className="scanlark-public-eyebrow">Problems</div>
            <h2>
              Issues that quietly weaken trust before anyone reports them.
            </h2>
            <p>
              Scanlark focuses on practical public website problems and turns
              the evidence into clear next actions.
            </p>
          </div>
          <div className="scanlark-impact-layout">
            <article className="scanlark-impact-feature">
              <span>High-impact example</span>
              <h3>{impactItems[0].title}</h3>
              <p>{impactItems[0].body}</p>
              <div>{impactItems[0].meta}</div>
            </article>
            <div className="scanlark-impact-grid">
              {impactItems.slice(1).map((item) => (
                <article className="scanlark-impact-card" key={item.title}>
                  <span>{item.meta}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="scanlark-public-section scanlark-public-section--navy"
        id="process"
      >
        <div className="scanlark-public-container">
          <div className="scanlark-public-section__heading">
            <div className="scanlark-public-eyebrow">How it works</div>
            <h2>Automated evidence collection, then human review.</h2>
            <p>
              The workflow is intentionally managed so clients receive
              priorities and context, not a raw scan dump.
            </p>
          </div>
          <div className="scanlark-process-timeline">
            {processSteps.map((step, index) => (
              <article key={step.title}>
                <div>{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="scanlark-public-section" id="report">
        <div className="scanlark-public-container scanlark-report-showcase">
          <div>
            <div className="scanlark-public-eyebrow">Report</div>
            <h2>A client-ready report that groups evidence into decisions.</h2>
            <p>
              Repeated technical occurrences can be condensed into one finding
              with affected counts, representative evidence and one recommended
              action.
            </p>
            <button
              type="button"
              className="scanlark-public-button scanlark-public-button--secondary"
              onClick={() =>
                document
                  .getElementById("outcomes")
                  ?.scrollIntoView({ block: "start", behavior: "smooth" })
              }
            >
              See what the report includes
            </button>
          </div>
          <div
            className="scanlark-report-breakdown"
            aria-label="Report contents"
          >
            {[
              "Executive summary",
              "Grouped client findings",
              "Priority overview",
              "Representative evidence",
              "Action plan",
              "Positive observations",
              "Methodology and limitations",
            ].map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <section className="scanlark-public-section" id="outcomes">
        <div className="scanlark-public-container">
          <div className="scanlark-public-section__heading">
            <div className="scanlark-public-eyebrow">Service outcomes</div>
            <h2>Clear options without publishing unapproved pricing.</h2>
          </div>
          <div className="scanlark-outcome-grid">
            {serviceOutcomes.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <ul>
                  {item.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="scanlark-public-section scanlark-public-founder"
        id="monitoring"
      >
        <div className="scanlark-public-container scanlark-founder-grid">
          <div>
            <div className="scanlark-public-eyebrow">Founder-operated</div>
            <h2>A practical service, not a faceless automated score.</h2>
          </div>
          <div>
            <p>
              Reports are reviewed before delivery, communication is direct and
              scope is agreed clearly. Scanlark is currently limited to a
              manageable number of B2B clients.
            </p>
            <p>
              Ongoing monitoring can be agreed where repeat checks, change
              detection, availability monitoring and periodic reviewed reports
              make sense for the website.
            </p>
          </div>
        </div>
      </section>

      <section className="scanlark-public-section">
        <div className="scanlark-public-container scanlark-methodology-strip">
          <div>
            <div className="scanlark-public-eyebrow">Methodology</div>
            <h2>Clear limits make the report more useful.</h2>
          </div>
          <ul>
            <li>Public pages only.</li>
            <li>Point-in-time review.</li>
            <li>Automated evidence may require context.</li>
            <li>Not a penetration test.</li>
            <li>No ranking or revenue guarantees.</li>
            <li>Private systems require separate agreement.</li>
          </ul>
          <button
            type="button"
            className="scanlark-public-button scanlark-public-button--secondary"
            onClick={() => onOpenLegal("/methodology")}
          >
            Read the full methodology
          </button>
        </div>
      </section>

      <section className="scanlark-public-section" id="faq">
        <div className="scanlark-public-container scanlark-faq-layout">
          <div className="scanlark-public-section__heading">
            <div className="scanlark-public-eyebrow">FAQ</div>
            <h2>Straight answers before you enquire.</h2>
          </div>
          <div className="scanlark-faq-list">
            {faqItems.map((item, index) => {
              const panelId = `scanlark-faq-panel-${index}`;
              const buttonId = `scanlark-faq-button-${index}`;
              const isOpen = openFaq === index;
              return (
                <article className="scanlark-faq-item" key={item.title}>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                  >
                    <span>{item.title}</span>
                    <span aria-hidden="true">{isOpen ? "-" : "+"}</span>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    hidden={!isOpen}
                  >
                    <p>{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="scanlark-public-section">
        <div className="scanlark-public-container">
          <div className="scanlark-public-final">
            <div>
              <div className="scanlark-public-eyebrow">Next step</div>
              <h2>Request a website health check.</h2>
            </div>
            <p>
              Send your website URL and a short note about what you want
              checked. Scanlark will confirm scope before any managed review
              starts.
            </p>
            <div className="scanlark-final-actions">
              <button
                type="button"
                className="scanlark-public-button scanlark-public-button--primary"
                onClick={onOpenPrimary}
              >
                Request a website health check
              </button>
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              <span>B2B-only launch service</span>
            </div>
          </div>
        </div>
      </section>
    </PublicSiteShell>
  );
};
