import React from "react";
import {
  LEGAL_PAGE_LINKS,
  SUPPORT_EMAIL,
  type LegalPageContent,
} from "../legalPages";

type LegalPageProps = {
  page: LegalPageContent;
  isAuthenticated: boolean;
  onNavigate: (path: string) => void;
};

function renderTextWithEmailLinks(text: string) {
  const parts = text.split(SUPPORT_EMAIL);
  if (parts.length === 1) return text;
  return parts.flatMap((part, index) =>
    index === parts.length - 1
      ? [part]
      : [
          part,
          <a key={`${part}-${index}`} href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>,
        ],
  );
}

export function LegalPage({
  page,
  isAuthenticated,
  onNavigate,
}: LegalPageProps) {
  const handleNavigate =
    (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      onNavigate(path);
    };

  return (
    <div className="legal-page">
      <style>{legalStyles}</style>
      <nav className="legal-nav" aria-label="Legal page navigation">
        <a
          href="/landing"
          className="legal-brand"
          onClick={handleNavigate("/landing")}
        >
          <strong>Scanlark</strong>
          <span>Alpha trust and product notes</span>
        </a>
        <div className="legal-nav__actions">
          <a href="/learn" onClick={handleNavigate("/learn")}>
            Learn
          </a>
          <a
            href={isAuthenticated ? "/dashboard" : "/login"}
            onClick={handleNavigate(isAuthenticated ? "/dashboard" : "/login")}
          >
            {isAuthenticated ? "Dashboard" : "Login"}
          </a>
        </div>
      </nav>

      <main className="legal-document">
        <header className="legal-hero">
          <span>Hosted alpha</span>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
          <div>Last updated: {page.lastUpdated}</div>
        </header>

        <div className="legal-section-stack">
          {page.sections.map((section) => (
            <section className="legal-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{renderTextWithEmailLinks(paragraph)}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((item) => (
                    <li key={item}>{renderTextWithEmailLinks(item)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </main>

      <footer className="legal-footer">
        <div>
          These pages are plain-English alpha trust pages and are not presented
          as solicitor-reviewed final legal documents.
        </div>
        <div className="legal-footer__links">
          {LEGAL_PAGE_LINKS.map((link) => (
            <a
              key={link.slug}
              href={link.path}
              onClick={handleNavigate(link.path)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

const legalStyles = `
  .legal-page {
    min-height: calc(100vh - 48px);
    display: grid;
    gap: 24px;
    color: var(--text);
  }
  .legal-nav,
  .legal-document,
  .legal-footer {
    width: min(980px, 100%);
    margin: 0 auto;
  }
  .legal-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .legal-brand {
    display: grid;
    gap: 2px;
    color: var(--text);
    text-decoration: none;
  }
  .legal-brand strong {
    font-family: var(--font-display);
    font-size: 22px;
  }
  .legal-brand span,
  .legal-hero div,
  .legal-footer {
    color: var(--text-muted);
    font-size: 13px;
  }
  .legal-nav__actions,
  .legal-footer__links {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .legal-nav a,
  .legal-footer a,
  .legal-section a {
    color: var(--accent);
  }
  .legal-nav__actions a,
  .legal-footer__links a {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0 12px;
    text-decoration: none;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    font-size: 13px;
    font-weight: 600;
  }
  .legal-document {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 94%, transparent);
    box-shadow: var(--soft-shadow);
    overflow: hidden;
  }
  .legal-hero {
    display: grid;
    gap: 10px;
    padding: 28px;
    border-bottom: 1px solid var(--border);
    background:
      radial-gradient(640px 220px at 12% 0%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 62%),
      var(--panel);
  }
  .legal-hero span {
    width: fit-content;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 4px 9px;
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .legal-hero h1 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(34px, 6vw, 56px);
    line-height: 1;
  }
  .legal-hero p {
    max-width: 720px;
    margin: 0;
    color: var(--text-muted);
    line-height: 1.7;
    font-size: 16px;
  }
  .legal-section-stack {
    display: grid;
  }
  .legal-section {
    display: grid;
    gap: 12px;
    padding: 24px 28px;
    border-bottom: 1px solid var(--border);
  }
  .legal-section:last-child {
    border-bottom: 0;
  }
  .legal-section h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
  }
  .legal-section p,
  .legal-section li {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.75;
  }
  .legal-section ul {
    margin: 0;
    padding-left: 20px;
    display: grid;
    gap: 8px;
  }
  .legal-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    padding-bottom: 12px;
  }
  @media (max-width: 720px) {
    .legal-page {
      gap: 16px;
    }
    .legal-nav,
    .legal-footer {
      align-items: flex-start;
    }
    .legal-document {
      border-radius: 8px;
    }
    .legal-hero,
    .legal-section {
      padding: 20px;
    }
  }
`;
