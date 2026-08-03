import type { CSSProperties } from "react";

export type ScanlarkLogoVariant = "horizontal" | "stacked" | "mark";
export type ScanlarkLogoTheme = "light" | "dark";

export interface ScanlarkLogoProps {
  variant?: ScanlarkLogoVariant;
  theme?: ScanlarkLogoTheme;
  width?: number | string;
  linked?: boolean;
  href?: string;
  className?: string;
  priority?: boolean;
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
  width = variant === "mark" ? 42 : 190,
  linked = false,
  href = "/",
  className,
  priority = false,
}: ScanlarkLogoProps) {
  const style: CSSProperties = {
    display: "block",
    width,
    height: "auto",
    maxWidth: "100%",
  };

  const image = (
    <img
      src={logoPath(variant, theme)}
      alt={linked ? "Scanlark" : ""}
      aria-hidden={linked ? undefined : true}
      className={className}
      style={style}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );

  if (!linked) {
    return image;
  }

  return (
    <a href={href} aria-label="Scanlark home">
      {image}
    </a>
  );
}
