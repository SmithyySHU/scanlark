import type { CSSProperties } from "react";

export type ScanlarkLogoVariant = "horizontal" | "stacked" | "mark";
export type ScanlarkLogoTheme = "light" | "dark";
export type ScanlarkLogoSize = "compact" | "default" | "large";

export interface ScanlarkLogoProps {
  variant?: ScanlarkLogoVariant;
  theme?: ScanlarkLogoTheme;
  size?: ScanlarkLogoSize;
  width?: number | string;
  linked?: boolean;
  href?: string;
  className?: string;
  priority?: boolean;
  alt?: string;
  tagline?: string;
}

function logoPath(
  variant: ScanlarkLogoVariant,
  theme: ScanlarkLogoTheme,
): string {
  const suffix = theme === "dark" ? "-dark" : "";

  if (variant === "mark") {
    return `/brand/logo/scanlark-mark${suffix}.svg`;
  }

  if (variant === "stacked") {
    return `/brand/logo/scanlark-stacked${suffix}.svg`;
  }

  return `/brand/logo/scanlark-horizontal${suffix}.svg`;
}

export function ScanlarkLogo({
  variant = "horizontal",
  theme = "light",
  size = "default",
  width,
  linked = false,
  href = "/",
  className,
  priority = false,
  alt = "Scanlark",
  tagline,
}: ScanlarkLogoProps) {
  const resolvedWidth =
    width ??
    (variant === "mark"
      ? size === "large"
        ? 52
        : size === "compact"
          ? 34
          : 42
      : size === "large"
        ? 216
        : size === "compact"
          ? 156
          : 190);
  const style: CSSProperties = {
    display: "block",
    width: resolvedWidth,
    height: "auto",
    maxWidth: "100%",
  };

  const image = (
    <img
      src={logoPath(variant, theme)}
      alt={linked ? alt : ""}
      aria-hidden={linked ? undefined : true}
      className={className}
      style={style}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
    />
  );

  const content = tagline ? (
    <span className="scanlark-logo-lockup">
      {image}
      <span>{tagline}</span>
    </span>
  ) : (
    image
  );

  if (!linked) {
    return content;
  }

  return (
    <a href={href} aria-label="Scanlark home">
      {content}
    </a>
  );
}
