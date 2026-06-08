import React from "react";

type Tone = "default" | "success" | "warning" | "danger" | "accent";

function toneColor(tone: Tone) {
  if (tone === "success") return "var(--success)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "danger") return "var(--danger)";
  if (tone === "accent") return "var(--accent)";
  return "var(--text)";
}

function toneBackground(tone: Tone) {
  if (tone === "success") {
    return "color-mix(in srgb, var(--success) 14%, var(--panel-elev))";
  }
  if (tone === "warning") {
    return "color-mix(in srgb, var(--warning) 16%, var(--panel-elev))";
  }
  if (tone === "danger") {
    return "color-mix(in srgb, var(--danger) 14%, var(--panel-elev))";
  }
  if (tone === "accent") {
    return "color-mix(in srgb, var(--accent) 18%, var(--panel-elev))";
  }
  return "var(--panel-elev)";
}

export const StatusBadge: React.FC<{
  label: string;
  tone?: Tone;
}> = ({ label, tone = "default" }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px",
      borderRadius: "999px",
      border: `1px solid color-mix(in srgb, ${toneColor(tone)} 20%, var(--border))`,
      background: toneBackground(tone),
      color: toneColor(tone),
      fontSize: "11px",
      fontWeight: 700,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

export const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: Tone;
  className?: string;
}> = ({ label, value, detail, tone = "default", className }) => (
  <div
    className={`surface-card surface-card--metric${className ? ` ${className}` : ""}`}
  >
    <div className="surface-card__label">{label}</div>
    <div className="surface-card__value" style={{ color: toneColor(tone) }}>
      {value}
    </div>
    {detail ? <div className="surface-card__detail">{detail}</div> : null}
  </div>
);

export const CategoryStatusCard: React.FC<{
  title: string;
  description: string;
  detail: React.ReactNode;
  statusLabel: string;
  tone?: Tone;
}> = ({ title, description, detail, statusLabel, tone = "default" }) => (
  <div className="surface-card surface-card--category" data-tone={tone}>
    <div className="category-status-card__header">
      <div className="category-status-card__title">{title}</div>
      <StatusBadge label={statusLabel} tone={tone} />
    </div>
    <div className="category-status-card__description">{description}</div>
    <div className="category-status-card__summary">{detail}</div>
  </div>
);

export const ScoreRingCard: React.FC<{
  label: string;
  score: number | null;
  status: string;
  detail?: React.ReactNode;
  helper?: React.ReactNode;
  stats?: Array<{ label: string; value: React.ReactNode }>;
  tone?: Tone;
}> = ({ label, score, status, detail, helper, stats, tone = "accent" }) => (
  <div className="surface-card surface-card--metric prominent score-ring-card">
    <div className="surface-card__label">{label}</div>
    <div className="score-ring-card__body">
      <div
        className="score-ring"
        style={
          {
            "--score-progress": `${score ?? 0}%`,
            "--score-ring-color": toneColor(tone),
          } as React.CSSProperties
        }
      >
        <div className="score-ring__inner">
          <div className="score-ring__value">
            {score == null ? "-" : `${score}%`}
          </div>
          <div className="score-ring__caption">Overall health</div>
        </div>
      </div>
      <div className="score-ring-card__content">
        <div className="score-ring-card__status">{status}</div>
        {detail ? <div className="surface-card__detail">{detail}</div> : null}
        {helper ? (
          <div className="score-ring-card__helper">{helper}</div>
        ) : null}
        {stats?.length ? (
          <div className="score-ring-card__stats">
            {stats.map((stat) => (
              <div key={String(stat.label)} className="score-ring-card__stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  </div>
);

export const SiteHeader: React.FC<{
  title: string;
  subtitle: string;
  meta: React.ReactNode;
  actions: React.ReactNode;
}> = ({ title, subtitle, meta, actions }) => (
  <div className="site-header-card">
    <div style={{ display: "grid", gap: "10px", minWidth: 0 }}>
      <div>
        <div className="site-header-card__title">{title}</div>
        <div className="site-header-card__subtitle">{subtitle}</div>
      </div>
      <div>{meta}</div>
    </div>
    <div
      style={{
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}
    >
      {actions}
    </div>
  </div>
);
