import type { ClientReportPayload } from "./types";

function priorityLabel(value: string) {
  if (value === "critical") return "Critical";
  if (value === "important") return "Important";
  if (value === "improvement") return "Improvement";
  return "Informational";
}

function actionPlanLabel(value: string) {
  if (value === "address_now") return "Address now";
  if (value === "address_soon") return "Address soon";
  return "Consider later";
}

export function ReportClientPreview({
  payload,
  stale,
  mode,
}: {
  payload: ClientReportPayload | null;
  stale: boolean;
  mode: "desktop" | "a4";
}) {
  if (!payload) {
    return <div className="ops-empty-card">Preview is not available.</div>;
  }
  return (
    <div className={`ops-report-preview ops-report-preview--${mode}`}>
      {stale && (
        <div className="ops-warning">
          Preview is based on saved report data. Save changes to refresh it.
        </div>
      )}
      <div className="ops-client-report">
        <section className="ops-client-cover">
          <div className="ops-client-brand">
            {payload.settings.displayLogo ? "Scanlark" : ""}
          </div>
          <h1>{payload.report.title}</h1>
          <p>{payload.business.name}</p>
          <p>{payload.site.displayName ?? payload.site.url}</p>
          <small>
            Prepared for {payload.report.preparedFor ?? "Client"} ·{" "}
            {payload.report.coverDate}
          </small>
        </section>
        <section>
          <h2>Executive summary</h2>
          {payload.summaries.executiveSummary && (
            <p>{payload.summaries.executiveSummary}</p>
          )}
          {payload.summaries.overallSummary && (
            <p>{payload.summaries.overallSummary}</p>
          )}
          {payload.summaries.mainStrengths && (
            <p>
              <strong>Main strengths: </strong>
              {payload.summaries.mainStrengths}
            </p>
          )}
          {payload.summaries.mainConcerns && (
            <p>
              <strong>Main concerns: </strong>
              {payload.summaries.mainConcerns}
            </p>
          )}
        </section>
        <section className="ops-card-grid">
          {Object.entries(payload.priorityCounts).map(([key, value]) => (
            <div key={key} className="ops-empty-card">
              <strong>{value}</strong>
              <p>{priorityLabel(key)}</p>
            </div>
          ))}
        </section>
        <section>
          <h2>Review scope</h2>
          <p>
            Website scanned: <span>{payload.site.url}</span>
          </p>
          <p>
            Pages and links checked: {payload.scan.checkedLinks} checked links
            from {payload.scan.totalLinks} discovered links.
          </p>
          {payload.summaries.scopeLimitations && (
            <p>{payload.summaries.scopeLimitations}</p>
          )}
        </section>
        {payload.findings.length > 0 && (
          <section>
            <h2>Key findings</h2>
            <div className="ops-list">
              {payload.findings.map((finding) => (
                <article
                  key={`${finding.priority}-${finding.title}-${finding.affectedUrl ?? ""}`}
                  className="ops-list-card"
                >
                  <small>{priorityLabel(finding.priority)}</small>
                  <strong>{finding.title}</strong>
                  {finding.affectedUrl ? (
                    <span>{finding.affectedUrl}</span>
                  ) : (
                    finding.affectedUrlNote && (
                      <span>{finding.affectedUrlNote}</span>
                    )
                  )}
                  {finding.whatWasFound && <p>{finding.whatWasFound}</p>}
                  {finding.whyItMatters && <p>{finding.whyItMatters}</p>}
                  {finding.recommendedAction && (
                    <p>{finding.recommendedAction}</p>
                  )}
                  {finding.clientEvidence && <p>{finding.clientEvidence}</p>}
                  {finding.estimatedEffort && (
                    <small>Estimated effort: {finding.estimatedEffort}</small>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
        {Object.entries(payload.actionPlan).some(
          ([, items]) => items.length,
        ) && (
          <section>
            <h2>Recommended action plan</h2>
            {Object.entries(payload.actionPlan).map(([group, items]) =>
              items.length > 0 ? (
                <div key={group} className="ops-list">
                  <h3>{actionPlanLabel(group)}</h3>
                  {items.map((item) => (
                    <article
                      key={`${group}-${item.title}`}
                      className="ops-list-card"
                    >
                      <strong>{item.title}</strong>
                      {item.summary && <p>{item.summary}</p>}
                    </article>
                  ))}
                </div>
              ) : null,
            )}
          </section>
        )}
        {payload.settings.displayPositiveObservations &&
          payload.positiveObservations.length > 0 && (
            <section>
              <h2>Positive observations</h2>
              <div className="ops-list">
                {payload.positiveObservations.map((item) => (
                  <article key={item.title} className="ops-list-card">
                    <strong>{item.title}</strong>
                    {item.description && <p>{item.description}</p>}
                  </article>
                ))}
              </div>
            </section>
          )}
        {payload.settings.displayNextSteps && payload.nextSteps.length > 0 && (
          <section>
            <h2>Next steps</h2>
            <ul>
              {payload.nextSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        {payload.settings.displayMethodologyLimitations &&
          payload.methodology.length > 0 && (
            <section>
              <h2>Methodology and limitations</h2>
              <ul>
                {payload.methodology.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}
      </div>
    </div>
  );
}
