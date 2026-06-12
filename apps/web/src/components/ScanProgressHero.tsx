import React, { useEffect, useRef, useState } from "react";

export const ScanProgressHero: React.FC<{
  progress: number;
  indeterminate?: boolean;
  title: string;
  stage: string;
  summary: string;
  headerTimestamp?: string | null;
  hideSummary?: boolean;
  hideRingFallback?: boolean;
  hideStageChip?: boolean;
  counters: Array<{ label: string; value: React.ReactNode }>;
  note?: string;
  statusTone?: "default" | "success" | "warning" | "danger" | "accent";
  previewTitle?: string;
  previewItems?: Array<{ label: string; detail: string }>;
  summaryStats?: Array<{ label: string; value: React.ReactNode }>;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}> = ({
  progress,
  indeterminate = false,
  title,
  stage,
  summary,
  headerTimestamp,
  hideSummary = false,
  hideRingFallback = false,
  hideStageChip = false,
  counters,
  note,
  statusTone = "accent",
  previewTitle,
  previewItems,
  summaryStats,
  primaryAction,
  secondaryAction,
}) => {
  const ringColor =
    statusTone === "success"
      ? "var(--success)"
      : statusTone === "warning"
        ? "var(--warning)"
        : statusTone === "danger"
          ? "var(--danger)"
          : statusTone === "default"
            ? "var(--text-muted)"
            : "var(--accent)";
  const normalizedProgress = Number.isFinite(progress)
    ? Math.min(100, Math.max(0, progress))
    : 0;
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const [displayedProgress, setDisplayedProgress] =
    useState(normalizedProgress);
  const displayedProgressRef = useRef(normalizedProgress);
  const ringDashOffset =
    ringCircumference *
    (1 - Math.min(100, Math.max(0, displayedProgress)) / 100);

  useEffect(() => {
    if (indeterminate) {
      displayedProgressRef.current = 0;
      setDisplayedProgress(0);
      return;
    }
    const start = displayedProgressRef.current;
    const end = normalizedProgress;
    if (start === end) return;
    const duration = 650;
    let frameId = 0;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime == null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = start + (end - start) * eased;
      displayedProgressRef.current = next;
      setDisplayedProgress(next);
      if (t < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [indeterminate, normalizedProgress]);

  return (
    <div className="scan-hero-card" data-tone={statusTone}>
      <div className="scan-hero-card__visual">
        <div className="scan-hero-card__visual-surface">
          <div className="scan-hero-card__ring">
            <div
              className={`scan-hero-card__ring-outer${indeterminate ? " is-indeterminate" : ""}`}
              role="img"
              aria-label={`${stage}: ${
                indeterminate
                  ? "progress pending while links are discovered"
                  : `${displayedProgress.toFixed(0)} percent complete`
              }`}
              style={
                {
                  "--scan-progress": `${displayedProgress}%`,
                  "--scan-ring-color": ringColor,
                } as React.CSSProperties
              }
            >
              <svg
                className="scan-hero-card__ring-svg"
                viewBox="0 0 120 120"
                aria-hidden="true"
              >
                <circle
                  className="scan-hero-card__ring-svg-track"
                  cx="60"
                  cy="60"
                  r={ringRadius}
                />
                <circle
                  className="scan-hero-card__ring-svg-progress"
                  cx="60"
                  cy="60"
                  r={ringRadius}
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringDashOffset}
                />
              </svg>
              <div className="scan-hero-card__ring-orbit" aria-hidden="true" />
              <div className="scan-hero-card__ring-inner">
                <strong>
                  {indeterminate ? "..." : `${displayedProgress.toFixed(0)}%`}
                </strong>
                <span>{stage}</span>
              </div>
            </div>
            {!hideRingFallback ? (
              <div className="scan-hero-card__ring-fallback">
                {indeterminate
                  ? "Discovering links"
                  : `${displayedProgress.toFixed(0)}% complete`}
              </div>
            ) : null}
          </div>
          <div className="scan-hero-card__visual-copy">
            <div className="scan-hero-card__header-row">
              <div>
                <div className="scan-hero-card__eyebrow">Scan status</div>
                <div className="scan-hero-card__title">{title}</div>
              </div>
              {headerTimestamp ? (
                <div className="scan-hero-card__timestamp">
                  {headerTimestamp}
                </div>
              ) : null}
            </div>
            {!hideStageChip ? (
              <div className="scan-hero-card__stage-chip">{stage}</div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="scan-hero-card__content">
        {!hideSummary && summary ? (
          <div>
            <div className="scan-hero-card__summary">{summary}</div>
          </div>
        ) : null}
        <div className="scan-hero-card__counter-grid">
          {counters.map((item) => (
            <div key={item.label} className="scan-hero-card__counter">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        {previewItems && previewItems.length > 0 ? (
          <div className="scan-hero-card__preview">
            <div className="scan-hero-card__preview-title">
              {previewTitle ?? "Scan activity"}
            </div>
            <div className="scan-hero-card__preview-list">
              {previewItems.map((item) => (
                <div
                  key={`${item.label}:${item.detail}`}
                  className="scan-hero-card__preview-item"
                >
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {summaryStats && summaryStats.length > 0 ? (
          <div className="scan-hero-card__summary-grid">
            {summaryStats.map((item) => (
              <div
                key={String(item.label)}
                className="scan-hero-card__summary-item"
              >
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
        {note ? <div className="scan-hero-card__note">{note}</div> : null}
        {primaryAction || secondaryAction ? (
          <div className="scan-hero-card__actions">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    </div>
  );
};
