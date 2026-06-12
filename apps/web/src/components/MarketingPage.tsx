import React, { useEffect, useState } from "react";
import type { LegalPageLink } from "../legalPages";

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
};

const featureCards = [
  {
    title: "Reports and scan history",
    body: "Keep a timeline of runs with trend details, score movement, and customer-friendly history context.",
  },
  {
    title: "Website issue detection",
    body: "Catch broken links, SEO gaps, robots/sitemap problems, SSL and security-header findings, and speed/weight checks.",
  },
  {
    title: "Change detection",
    body: "See what is new, what is still present, and what changed between completed scans.",
  },
  {
    title: "Uptime and availability",
    body: "Monitor whether key pages remain reachable and keep an eye on status trends for planned checks.",
  },
  {
    title: "Shareable reports and PDF export",
    body: "Share clean report links and export PDF outputs for stakeholders when that option is enabled.",
  },
  {
    title: "Scanlark Learn",
    body: "Use practical guides for interpreting issue categories, prioritizing fixes, and publishing client-facing summaries.",
  },
];

const faqItems = [
  {
    q: "What does Scanlark check?",
    a: "Scanlark performs passive external checks of public website signals: broken links, SEO basics, robots/sitemap, SSL/HTTPS, security headers, speed basics, issue changes, and scheduled uptime checks.",
  },
  {
    q: "How often can scans run?",
    a: "You can run scans manually or on a daily, weekly, or monthly schedule for each site.",
  },
  {
    q: "What happens when issues change?",
    a: "Completed scans compare against the previous baseline so new, existing, and resolved issues stay visible.",
  },
  {
    q: "What does passive monitoring mean?",
    a: "Scanlark checks public website signals from outside. It does not log in, submit forms, scan ports, attack, or exploit websites.",
  },
  {
    q: "What is not in the current MVP?",
    a: "We do not advertise billing/subscription tiers, teams, client portals, white-label, or private authenticated/internal security testing on this landing page.",
  },
];

export const MarketingPage: React.FC<MarketingPageProps> = ({
  isAuthenticated,
  primaryLabel,
  secondaryLabel,
  onOpenPrimary,
  onOpenSecondary,
  onOpenLearn,
  legalLinks,
  onOpenLegal,
  onOpenAccount,
}) => {
  const finalIssueCount = 18;
  const [animatedIssueCount, setAnimatedIssueCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setAnimatedIssueCount(finalIssueCount);
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      setAnimatedIssueCount(finalIssueCount);
      return;
    }

    setAnimatedIssueCount(0);
    const stepMs = 45;
    let currentValue = 0;
    const timer = window.setInterval(() => {
      currentValue += 1;
      if (currentValue >= finalIssueCount) {
        window.clearInterval(timer);
        setAnimatedIssueCount(finalIssueCount);
        return;
      }
      setAnimatedIssueCount(currentValue);
    }, stepMs);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 560px at 10% -10%, rgba(56, 189, 248, 0.24), transparent 55%), radial-gradient(880px 420px at 88% 0%, rgba(139, 92, 246, 0.18), transparent 55%), linear-gradient(180deg, color-mix(in srgb, var(--bg) 88%, black 12%) 0%, var(--bg) 100%)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "24px",
          display: "grid",
          gap: "32px",
        }}
      >
        <nav
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            padding: "12px 0",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              Scanlark
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              Passive website health and trust monitoring
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button className="ghost-button" onClick={onOpenLearn}>
              Learn
            </button>
            {isAuthenticated && onOpenAccount ? (
              <button className="ghost-button" onClick={onOpenAccount}>
                Account
              </button>
            ) : (
              <button className="ghost-button" onClick={onOpenSecondary}>
                {secondaryLabel}
              </button>
            )}
            <button className="primary-button" onClick={onOpenPrimary}>
              {primaryLabel}
            </button>
          </div>
        </nav>

        <section className="marketing-hero">
          <div className="marketing-hero__content">
            <h1 className="marketing-hero__headline">
              Monitor public website health with clean reports and change
              tracking.
            </h1>
            <div className="marketing-hero__body">
              Scanlark checks your public website signals from the outside and
              helps you track issues, score movement, and report outputs. It
              does not log in, submit forms, scan ports, attack, or exploit
              websites.
            </div>
            <div className="marketing-hero__actions">
              <button
                className="primary-button primary-button--large"
                onClick={onOpenPrimary}
              >
                {primaryLabel}
              </button>
              <button
                className="secondary-button primary-button--large"
                onClick={onOpenSecondary}
              >
                {secondaryLabel}
              </button>
              <button
                className="ghost-button primary-button--large"
                onClick={onOpenLearn}
              >
                Learn more
              </button>
            </div>
            <div className="marketing-hero__chips">
              {[
                "Manual and scheduled scans",
                "Issue change detection",
                "Email alerts and in-app notifications",
                "Client and site metadata context",
                "Shareable report links",
                "Raw evidence in reports",
              ].map((item) => (
                <div key={item} className="marketing-chip">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-hero__preview-shell">
            <div className="marketing-glow marketing-glow--primary" />
            <div className="marketing-glow marketing-glow--secondary" />
            <div className="marketing-mockup">
              <div className="marketing-mockup__toolbar">
                <span className="marketing-badge marketing-badge--warning">
                  18 active issues
                </span>
                <span className="marketing-badge marketing-badge--success">
                  Daily scan
                </span>
                <span className="marketing-badge marketing-badge--success">
                  Alerts on
                </span>
              </div>
              <div className="marketing-mockup__hero">
                <div>
                  <div className="marketing-kicker">Latest site health</div>
                  <div className="marketing-score-row">
                    <div className="marketing-score-card">
                      <div className="marketing-score-card__label">
                        Overall score
                      </div>
                      <div className="marketing-score-card__value">78%</div>
                    </div>
                    <div className="marketing-score-card">
                      <div className="marketing-score-card__label">
                        Link integrity
                      </div>
                      <div className="marketing-score-card__value">81%</div>
                    </div>
                  </div>
                </div>
                <div className="marketing-score-ring">
                  <div className="marketing-score-ring__inner">
                    <div className="marketing-score-ring__content">
                      <strong>{animatedIssueCount}</strong>
                      <span>new issues</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="marketing-category-grid">
                {[
                  ["Link integrity", "9 issues"],
                  ["SEO basics", "4 issues"],
                  ["Robots / sitemap", "2 issues"],
                  ["SSL / HTTPS", "1 warning"],
                  ["Security headers", "1 issue"],
                  ["Speed basics", "1 warning"],
                  ["Uptime", "Stable"],
                ].map(([title, status]) => (
                  <div key={title} className="marketing-category-card">
                    <div>{title}</div>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
              <div className="marketing-history-card">
                <div className="marketing-kicker">Recent report history</div>
                <div className="marketing-history-row">
                  <span>Today</span>
                  <span>78%</span>
                  <span>18 new</span>
                  <span>View report</span>
                </div>
                <div className="marketing-history-row">
                  <span>Yesterday</span>
                  <span>82%</span>
                  <span>6 fixed</span>
                  <span>View report</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-band">
          {[
            "Passive external scanning",
            "No install required",
            "Scheduled scans",
            "Email alerts and summaries",
            "Evidence-rich reports",
          ].map((item) => (
            <div key={item} className="marketing-trust-item">
              {item}
            </div>
          ))}
        </section>

        <section className="marketing-section">
          <div className="marketing-section__heading">
            <div className="marketing-kicker">Product overview</div>
            <h2>
              Built for customer-facing monitoring, not just raw scan tables.
            </h2>
            <p>
              Keep the dashboard focused on health, movement, and next actions.
              Keep detailed evidence in reports where it belongs.
            </p>
          </div>
          <div className="marketing-feature-grid">
            {featureCards.map((item) => (
              <div key={item.title} className="marketing-feature-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section__heading">
            <div className="marketing-kicker">How it works</div>
            <h2>Start quickly, then keep the monitoring loop tight.</h2>
          </div>
          <div className="marketing-step-grid">
            {[
              "Add a site and set the canonical URL.",
              "Run a scan now or configure the schedule.",
              "Review issues, diagnostics, and score movement.",
              "Receive email alerts and in-app notifications through your settings.",
            ].map((item, index) => (
              <div key={item} className="marketing-step-card">
                <div className="marketing-step-card__index">0{index + 1}</div>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section marketing-section--split">
          <div className="marketing-boundary-card">
            <div className="marketing-kicker">Boundaries</div>
            <h2>Clear passive scope, clear expectations.</h2>
            <ul>
              <li>Only passive checks of public URLs are in scope.</li>
              <li>
                Mixed-content checks are shown when present in scan results.
              </li>
              <li>
                No private authenticated scanning or exploit testing is
                presented.
              </li>
              <li>
                No billing, team management, client portal, or white-label
                claims.
              </li>
              <li>
                No desktop notifications are advertised on the landing page.
              </li>
            </ul>
          </div>
        </section>

        <section className="marketing-section">
          <div className="marketing-section__heading">
            <div className="marketing-kicker">FAQ</div>
            <h2>Answers for evaluation and onboarding.</h2>
          </div>
          <div className="marketing-faq-grid">
            {faqItems.map((item) => (
              <div key={item.q} className="marketing-faq-card">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="marketing-footer">
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "18px",
              }}
            >
              Scanlark
            </div>
            <div style={{ color: "var(--muted)", fontSize: "13px" }}>
              Public website monitoring for site health, reliability, and trust
              signals.
            </div>
            <div className="marketing-footer__legal">
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
            </div>
          </div>
          <div className="marketing-footer__actions">
            <button className="ghost-button" onClick={onOpenLearn}>
              Learn
            </button>
            <button className="ghost-button" onClick={onOpenSecondary}>
              {secondaryLabel}
            </button>
            <button className="primary-button" onClick={onOpenPrimary}>
              {primaryLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
