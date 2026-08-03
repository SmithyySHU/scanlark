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

function reportTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatReportDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function priorityDefinition(value: string) {
  if (value === "critical") {
    return "Confirmed issues that may seriously disrupt access, trust or an important visitor journey.";
  }
  if (value === "important") {
    return "Issues worth addressing soon because they can materially affect visitors or website quality.";
  }
  if (value === "improvement") {
    return "Practical improvements that can strengthen clarity, maintainability or visitor experience.";
  }
  return "Useful context or lower-impact housekeeping that does not require urgent action.";
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
          <h1>Website Health Report</h1>
          <h2>{payload.report.title}</h2>
          <p>
            <strong>{payload.business.name}</strong>
          </p>
          <p>{payload.site.displayName ?? payload.site.url}</p>
          {payload.report.preparedFor && (
            <small>Prepared for {payload.report.preparedFor}</small>
          )}
          <small>
            Prepared by {payload.report.preparedBy ?? "Scanlark"} ·{" "}
            {formatReportDate(payload.report.coverDate)} ·{" "}
            {reportTypeLabel(payload.report.reportType)}
          </small>
          {payload.settings.confidentialNotice && (
            <small>{payload.settings.confidentialNotice}</small>
          )}
        </section>
        <section>
          <h2>Executive summary</h2>
          {payload.summaries.overallSummary && (
            <p>{payload.summaries.overallSummary}</p>
          )}
          {payload.summaries.executiveSummary && (
            <p>
              <strong>Overall website condition: </strong>
              {payload.summaries.executiveSummary}
            </p>
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
          {payload.summaries.recommendedFirstSteps && (
            <p>
              <strong>Recommended immediate action: </strong>
              {payload.summaries.recommendedFirstSteps}
            </p>
          )}
        </section>
        <section className="ops-card-grid">
          {Object.entries(payload.priorityCounts).map(([key, value]) =>
            key === "informational" && value === 0 ? null : (
              <div key={key} className="ops-empty-card">
                <strong>{value}</strong>
                <p>{priorityLabel(key)}</p>
              </div>
            ),
          )}
        </section>
        <section>
          <h2>Review scope</h2>
          <p>
            Website scanned: <span>{payload.site.url}</span>
          </p>
          <p>
            Selected scan date: {formatReportDate(payload.scan.finishedAt)}.
          </p>
          <p>
            Public links/resources checked: {payload.scan.checkedLinks} of{" "}
            {payload.scan.totalLinks} discovered.
          </p>
          {payload.summaries.scopeLimitations && (
            <p>{payload.summaries.scopeLimitations}</p>
          )}
        </section>
        <section>
          <h2>Priority overview</h2>
          <p>
            Priorities reflect the reviewed client impact and recommended order
            of attention. Labels and descriptions are provided so the overview
            does not rely on colour alone.
          </p>
          <div className="ops-list">
            {Object.entries(payload.priorityCounts).map(([priority, count]) =>
              priority === "informational" && count === 0 ? null : (
                <article key={priority} className="ops-list-card">
                  <strong>
                    {priorityLabel(priority)} · {count} included
                  </strong>
                  <p>{priorityDefinition(priority)}</p>
                </article>
              ),
            )}
          </div>
        </section>
        {payload.findings.length > 0 && (
          <section>
            <h2>Key findings</h2>
            <div className="ops-list">
              {payload.findings.map((finding, findingIndex) => (
                <article
                  key={`${findingIndex}-${finding.priority}-${finding.title}-${finding.affectedUrl ?? ""}`}
                  className="ops-list-card"
                >
                  <small>{priorityLabel(finding.priority)}</small>
                  <strong>{finding.title}</strong>
                  <span>
                    {finding.occurrenceCount} technical occurrence
                    {finding.occurrenceCount === 1 ? "" : "s"} ·{" "}
                    {finding.affectedPageCount} affected page
                    {finding.affectedPageCount === 1 ? "" : "s"}
                    {finding.affectedResourceCount > 0
                      ? ` · ${finding.affectedResourceCount} affected resource${
                          finding.affectedResourceCount === 1 ? "" : "s"
                        }`
                      : ""}
                  </span>
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
                  {finding.representativeExamples.length > 0 && (
                    <div className="ops-table-wrap">
                      <table className="ops-evidence-table">
                        <thead>
                          <tr>
                            <th>Affected page/resource</th>
                            <th>Result</th>
                            <th>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {finding.representativeExamples
                            .slice(0, 5)
                            .map((example, index) => (
                              <tr
                                key={`${finding.title}-${example.affectedPageUrl ?? ""}-${example.affectedResourceUrl ?? ""}-${index}`}
                              >
                                <td>
                                  {example.affectedResourceUrl ??
                                    example.affectedPageUrl ??
                                    "-"}
                                </td>
                                <td>{example.result ?? "-"}</td>
                                <td>{example.note ?? "-"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                  {items.map((item, itemIndex) => (
                    <article
                      key={`${group}-${itemIndex}-${item.title}`}
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
                {payload.positiveObservations.map((item, itemIndex) => (
                  <article
                    key={`${itemIndex}-${item.title}`}
                    className="ops-list-card"
                  >
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
        {payload.settings.displayTechnicalAppendix && (
          <section>
            <h2>Technical appendix</h2>
            <p>
              Selected scan date: {formatReportDate(payload.scan.finishedAt)}
            </p>
            <p>
              Links/resources checked: {payload.scan.checkedLinks} of{" "}
              {payload.scan.totalLinks} discovered.
            </p>
            <p>Included reviewed findings: {payload.findings.length}</p>
            <div className="ops-list">
              {payload.findings.map((finding, findingIndex) => (
                <article
                  key={`${findingIndex}-${finding.title}`}
                  className="ops-list-card"
                >
                  <strong>{finding.title}</strong>
                  <p>
                    {finding.occurrenceCount} technical occurrence
                    {finding.occurrenceCount === 1 ? "" : "s"} reviewed.
                  </p>
                  {finding.representativeExamples.length > 0 && (
                    <ul>
                      {finding.representativeExamples.map((example, index) => (
                        <li
                          key={`${finding.title}-appendix-${example.affectedPageUrl ?? ""}-${example.affectedResourceUrl ?? ""}-${index}`}
                        >
                          {example.affectedResourceUrl ??
                            example.affectedPageUrl ??
                            "Reviewed source"}{" "}
                          {example.result ? `- ${example.result}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
