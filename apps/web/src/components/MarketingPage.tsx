import React, { useEffect, useState } from "react";

type MarketingPageProps = {
  isAuthenticated: boolean;
  onOpenApp: () => void;
  onOpenLogin: () => void;
  onOpenLearn: () => void;
};

const featureCards = [
  {
    title: "Health dashboard",
    body: "See overall health, key categories, issue movement, and the next action without opening raw tables first.",
  },
  {
    title: "Reports and evidence",
    body: "Keep detailed evidence, issue tracking, diagnostics, and raw link findings in structured scan reports.",
  },
  {
    title: "Change detection",
    body: "Track what is new, what persists, and what got fixed between completed scans.",
  },
  {
    title: "Alerts and summaries",
    body: "Use SMTP delivery, summaries, and notification events to keep stakeholders informed.",
  },
];

const faqItems = [
  {
    q: "What does Scanlark check?",
    a: "Scanlark monitors external site health, trust signals, issue changes, and report evidence using passive website scans.",
  },
  {
    q: "How often can scans run?",
    a: "Users can run manual scans and configure scheduled daily, weekly, or monthly scans.",
  },
  {
    q: "What happens when issues change?",
    a: "Completed scans compare against the previous baseline so new, existing, and resolved issues stay visible.",
  },
  {
    q: "What does passive external monitoring mean?",
    a: "Scanlark checks what a public visitor or crawler can observe. It does not install agents or scan internal systems.",
  },
];

export const MarketingPage: React.FC<MarketingPageProps> = ({
  isAuthenticated,
  onOpenApp,
  onOpenLogin,
  onOpenLearn,
}) => {
  const primaryLabel = isAuthenticated ? "Open dashboard" : "Start monitoring";
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
            <button className="ghost-button">Pricing</button>
            {!isAuthenticated && (
              <button className="ghost-button" onClick={onOpenLogin}>
                Login
              </button>
            )}
            <button className="primary-button" onClick={onOpenApp}>
              {primaryLabel}
            </button>
          </div>
        </nav>

        <section className="marketing-hero">
          <div className="marketing-hero__content">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                width: "fit-content",
                padding: "8px 12px",
                borderRadius: "999px",
                background: "rgba(15, 23, 42, 0.36)",
                border: "1px solid var(--border)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              External-only monitoring
            </div>
            <div className="marketing-hero__headline">
              Monitor site health with clear reports, alerts, and change
              tracking.
            </div>
            <div className="marketing-hero__body">
              Scanlark checks your public website like a careful external
              visitor. Track trust signals, scan issues, and report history
              without mixing marketing pages with operational monitoring
              workflows.
            </div>
            <div className="marketing-hero__actions">
              <button
                className="primary-button primary-button--large"
                onClick={onOpenApp}
              >
                {primaryLabel}
              </button>
              <button
                className="secondary-button primary-button--large"
                onClick={onOpenLogin}
              >
                View product
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
                "SMTP alerts and summaries",
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
                  ["Security setup", "1 issue"],
                  ["Speed basics", "1 warning"],
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
              "Receive alerts and summaries through your configured SMTP flow.",
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
              <li>External-only monitoring of public website signals</li>
              <li>No uptime agent or synthetic browser stack in this phase</li>
              <li>No internal vulnerability scanning</li>
              <li>Detailed evidence stays in report artifacts</li>
            </ul>
          </div>
          <div className="marketing-pricing-card">
            <div className="marketing-kicker">Pricing preview</div>
            <h2>Commercial structure later, product clarity now.</h2>
            <div className="marketing-pricing-grid">
              <div>
                <strong>Starter</strong>
                <span>Single-site monitoring, reports, alerts</span>
              </div>
              <div>
                <strong>Growth</strong>
                <span>More sites, more history, more team workflows</span>
              </div>
              <div>
                <strong>Enterprise</strong>
                <span>Expanded reporting, governance, and support</span>
              </div>
            </div>
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
              Premium external monitoring for site health and trust signals.
            </div>
          </div>
          <div className="marketing-footer__actions">
            <button className="ghost-button" onClick={onOpenLearn}>
              Learn
            </button>
            <button className="ghost-button" onClick={onOpenLogin}>
              Login
            </button>
            <button className="primary-button" onClick={onOpenApp}>
              {primaryLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
