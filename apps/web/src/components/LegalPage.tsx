import React from "react";
import {
  LEGAL_PAGE_LINKS,
  SUPPORT_EMAIL,
  type LegalPageContent,
} from "../legalPages";
import { PublicSiteShell } from "./PublicSiteShell";

type LegalPageProps = {
  page: LegalPageContent;
  isAuthenticated: boolean;
  onNavigate: (path: string) => void;
  onOpenPrimary: () => void;
  onOpenSecondary: () => void;
  secondaryHref?: string;
  themeControl?: React.ReactNode;
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

function legalSectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LegalPage({
  page,
  isAuthenticated,
  onNavigate,
  onOpenPrimary,
  onOpenSecondary,
  secondaryHref,
  themeControl,
}: LegalPageProps) {
  return (
    <PublicSiteShell
      isAuthenticated={isAuthenticated}
      primaryLabel="Request a website health check"
      secondaryLabel={isAuthenticated ? "Open Operations" : "Internal login"}
      secondaryHref={secondaryHref}
      onOpenPrimary={onOpenPrimary}
      onOpenSecondary={onOpenSecondary}
      legalLinks={LEGAL_PAGE_LINKS}
      onOpenLegal={onNavigate}
      onNavigate={onNavigate}
      themeControl={themeControl}
    >
      <article className="legal-document-shell">
        <div className="scanlark-public-container legal-document-layout">
          <aside className="legal-toc" aria-label={`${page.title} contents`}>
            <div>Contents</div>
            <nav>
              {page.sections.slice(0, 12).map((section) => (
                <a
                  key={section.title}
                  href={`#${legalSectionId(section.title)}`}
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="legal-document">
            <header className="legal-hero">
              <span>Legal information</span>
              <h1>{page.title}</h1>
              <p>{page.intro}</p>
              <div>Last updated: {page.lastUpdated}</div>
            </header>

            <div className="legal-section-stack">
              {page.sections.map((section) => (
                <section
                  className="legal-section"
                  id={legalSectionId(section.title)}
                  key={section.title}
                >
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
                  {section.afterParagraphs?.map((paragraph) => (
                    <p key={paragraph}>{renderTextWithEmailLinks(paragraph)}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      </article>
    </PublicSiteShell>
  );
}
