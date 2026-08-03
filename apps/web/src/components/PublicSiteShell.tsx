import React, { useState } from "react";
import type { LegalPageLink } from "../legalPages";
import { SUPPORT_EMAIL } from "../legalPages";
import { ScanlarkLogo } from "./brand/ScanlarkLogo";

type PublicSiteShellProps = {
  isAuthenticated: boolean;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHref?: string;
  secondaryHref?: string;
  onOpenPrimary: () => void;
  onOpenSecondary: () => void;
  legalLinks: LegalPageLink[];
  onOpenLegal: (path: string) => void;
  onNavigate: (path: string) => void;
  themeControl?: React.ReactNode;
  children: React.ReactNode;
};

const publicNavItems = [
  { id: "problems", label: "Problems" },
  { id: "process", label: "How it works" },
  { id: "report", label: "Report" },
  { id: "monitoring", label: "Monitoring" },
  { id: "faq", label: "FAQ" },
];

export function PublicSiteShell({
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
  children,
}: PublicSiteShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleSectionNavigate =
    (sectionId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      closeMobileMenu();
      onNavigate("/landing");
      window.setTimeout(() => {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 40);
    };

  const handleLegalNavigate =
    (path: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      closeMobileMenu();
      onOpenLegal(path);
    };

  const handlePrimaryAction = (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    event.preventDefault();
    closeMobileMenu();
    onOpenPrimary();
  };

  const handleSecondaryAction = (
    event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
  ) => {
    event.preventDefault();
    closeMobileMenu();
    onOpenSecondary();
  };

  return (
    <div className="scanlark-public-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="scanlark-public-header">
        <div className="scanlark-public-container scanlark-public-header__inner">
          <ScanlarkLogo
            linked
            href="/"
            width={198}
            priority
            theme="light"
            className="scanlark-logo-on-surface"
          />
          <nav className="scanlark-public-nav" aria-label="Public navigation">
            {publicNavItems.map((item) => (
              <a
                href={`/#${item.id}`}
                key={item.id}
                onClick={handleSectionNavigate(item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="scanlark-public-actions">
            {themeControl ? (
              <div className="scanlark-public-theme">{themeControl}</div>
            ) : null}
            {secondaryHref ? (
              <a
                className="scanlark-public-login"
                href={secondaryHref}
                onClick={handleSecondaryAction}
              >
                {isAuthenticated ? secondaryLabel : "Internal login"}
              </a>
            ) : (
              <button
                type="button"
                className="scanlark-public-login"
                onClick={handleSecondaryAction}
              >
                {isAuthenticated ? secondaryLabel : "Internal login"}
              </button>
            )}
            {primaryHref ? (
              <a
                className="scanlark-public-button scanlark-public-button--primary"
                href={primaryHref}
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
              </a>
            ) : (
              <button
                type="button"
                className="scanlark-public-button scanlark-public-button--primary"
                onClick={handlePrimaryAction}
              >
                {primaryLabel}
              </button>
            )}
            <button
              type="button"
              className="scanlark-public-menu-button"
              aria-expanded={mobileMenuOpen}
              aria-controls="scanlark-public-mobile-menu"
              onClick={() => setMobileMenuOpen((value) => !value)}
            >
              <span aria-hidden="true" />
              <span className="sr-only">Menu</span>
            </button>
          </div>
        </div>
        <div
          id="scanlark-public-mobile-menu"
          className={`scanlark-public-mobile-menu ${
            mobileMenuOpen ? "is-open" : ""
          }`}
        >
          <div className="scanlark-public-container">
            <nav aria-label="Mobile public navigation">
              {publicNavItems.map((item) => (
                <a
                  href={`/#${item.id}`}
                  key={item.id}
                  onClick={handleSectionNavigate(item.id)}
                >
                  {item.label}
                </a>
              ))}
              {secondaryHref ? (
                <a href={secondaryHref} onClick={handleSecondaryAction}>
                  {isAuthenticated ? secondaryLabel : "Internal login"}
                </a>
              ) : (
                <button type="button" onClick={handleSecondaryAction}>
                  {isAuthenticated ? secondaryLabel : "Internal login"}
                </button>
              )}
              {primaryHref ? (
                <a href={primaryHref} onClick={handlePrimaryAction}>
                  {primaryLabel}
                </a>
              ) : (
                <button type="button" onClick={handlePrimaryAction}>
                  {primaryLabel}
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="scanlark-public-footer">
        <div className="scanlark-public-container scanlark-public-footer__inner">
          <div className="scanlark-public-footer__brand">
            <ScanlarkLogo
              width={184}
              theme="light"
              className="scanlark-logo-on-surface"
            />
            <p>
              Scanlark is operated by Connor Smith in the United Kingdom.
              Business services only. Contact:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
            <p className="scanlark-public-small">
              Founder-operated website health checks for businesses, sole
              traders, charities and organisations.
            </p>
          </div>
          <div className="scanlark-public-footer__links">
            {legalLinks.map((link) => (
              <a
                key={link.slug}
                href={link.path}
                onClick={handleLegalNavigate(link.path)}
              >
                {link.label}
              </a>
            ))}
            {secondaryHref ? (
              <a href={secondaryHref} onClick={handleSecondaryAction}>
                {isAuthenticated ? secondaryLabel : "Internal login"}
              </a>
            ) : (
              <button type="button" onClick={handleSecondaryAction}>
                {isAuthenticated ? secondaryLabel : "Internal login"}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
