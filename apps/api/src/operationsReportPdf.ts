import { existsSync } from "node:fs";
import { chromium } from "playwright";
import type { OperationsClientReportPayload } from "@scanlark/db";

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilenamePart(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function operationsReportPdfFilename(
  payload: OperationsClientReportPayload,
) {
  const business = sanitizeFilenamePart(payload.business.name) || "business";
  const domain = sanitizeFilenamePart(payload.site.domain) || "website";
  return `scanlark-website-health-report-${business}-${domain}-${payload.report.coverDate}.pdf`;
}

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

function formatDate(value: string | null) {
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

function listItems(items: string[]) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
}

function findingEvidenceTable(
  finding: OperationsClientReportPayload["findings"][number],
  limit: number,
) {
  const examples = finding.representativeExamples.slice(0, limit);
  if (examples.length === 0) return "";
  return `
    <table class="evidence-table">
      <thead>
        <tr>
          <th>Affected page/resource</th>
          <th>Result</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${examples
          .map(
            (example) => `
              <tr>
                <td>${escapeHtml(example.affectedResourceUrl ?? example.affectedPageUrl ?? "-")}</td>
                <td>${escapeHtml(example.result ?? "-")}</td>
                <td>${escapeHtml(example.note ?? "-")}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

export function renderOperationsReportHtml(
  payload: OperationsClientReportPayload,
  options: { draft?: boolean } = {},
) {
  const priorities = Object.entries(payload.priorityCounts)
    .filter(([priority, count]) => priority !== "informational" || count > 0)
    .map(
      ([priority, count]) => `
        <article class="priority-item avoid-break">
          <div><strong>${priorityLabel(priority)}</strong><span>${count} included</span></div>
          <p>${priorityDefinition(priority)}</p>
        </article>
      `,
    )
    .join("");
  const actionGroups = Object.entries(payload.actionPlan)
    .filter(([, items]) => items.length > 0)
    .map(
      ([group, items]) => `
        <section class="report-section avoid-break">
          <h3>${actionPlanLabel(group)}</h3>
          ${items
            .map(
              (item) => `
                <article class="action-item avoid-break">
                  <strong>${escapeHtml(item.title)}</strong>
                  ${item.summary ? `<p>${escapeHtml(item.summary)}</p>` : ""}
                </article>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");

  const technicalAppendix = payload.settings.displayTechnicalAppendix
    ? `<section class="report-section page-start">
        <h2>Technical appendix</h2>
        <dl class="scope-grid">
          <dt>Selected scan date</dt><dd>${escapeHtml(formatDate(payload.scan.finishedAt))}</dd>
          <dt>Links/resources checked</dt><dd>${payload.scan.checkedLinks}</dd>
          <dt>Links/resources discovered</dt><dd>${payload.scan.totalLinks}</dd>
          <dt>Included reviewed findings</dt><dd>${payload.findings.length}</dd>
        </dl>
        ${payload.findings
          .map(
            (finding) => `
              <article class="appendix-item avoid-break">
                <h3>${escapeHtml(finding.title)}</h3>
                <p>${finding.occurrenceCount} technical occurrence${finding.occurrenceCount === 1 ? "" : "s"} reviewed.</p>
                ${findingEvidenceTable(finding, 50)}
              </article>
            `,
          )
          .join("")}
      </section>`
    : "";
  const closingSections = [
    payload.settings.displayNextSteps
      ? `<section><h2>Next steps</h2>${listItems(payload.nextSteps)}</section>`
      : "",
    payload.settings.displayMethodologyLimitations
      ? `<section><h2>Methodology and limitations</h2>${listItems(payload.methodology)}</section>`
      : "",
  ].filter(Boolean);
  const closingContent = closingSections.length
    ? `<div class="report-section closing-grid ${closingSections.length === 1 ? "closing-grid--single" : ""}">${closingSections.join("")}</div>`
    : "";

  const positives = payload.positiveObservations
    .map(
      (item) => `
        <article class="positive-item avoid-break">
          <strong>${escapeHtml(item.title)}</strong>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
        </article>
      `,
    )
    .join("");

  const findings = payload.findings
    .map(
      (finding) => `
        <article class="finding avoid-break">
          <div class="finding__meta">${priorityLabel(finding.priority)}</div>
          <h3>${escapeHtml(finding.title)}</h3>
          <p class="finding-counts">
            ${finding.occurrenceCount} technical occurrence${finding.occurrenceCount === 1 ? "" : "s"} ·
            ${finding.affectedPageCount} affected page${finding.affectedPageCount === 1 ? "" : "s"}${
              finding.affectedResourceCount > 0
                ? ` · ${finding.affectedResourceCount} affected resource${finding.affectedResourceCount === 1 ? "" : "s"}`
                : ""
            }
          </p>
          ${
            finding.affectedUrl
              ? `<p class="url">${escapeHtml(finding.affectedUrl)}</p>`
              : finding.affectedUrlNote
                ? `<p>${escapeHtml(finding.affectedUrlNote)}</p>`
                : ""
          }
          ${finding.whatWasFound ? `<h4>What was found</h4><p>${escapeHtml(finding.whatWasFound)}</p>` : ""}
          ${finding.whyItMatters ? `<h4>Why it matters</h4><p>${escapeHtml(finding.whyItMatters)}</p>` : ""}
          ${finding.recommendedAction ? `<h4>Recommended action</h4><p>${escapeHtml(finding.recommendedAction)}</p>` : ""}
          ${finding.clientEvidence ? `<h4>Evidence</h4><p>${escapeHtml(finding.clientEvidence)}</p>` : ""}
          ${findingEvidenceTable(finding, 3)}
          ${finding.estimatedEffort ? `<p class="effort">Estimated effort: ${escapeHtml(finding.estimatedEffort)}</p>` : ""}
        </article>
      `,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.report.title)}</title>
  <style>
    @page { size: A4; margin: 13mm 12mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #172033;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 9.5pt;
      line-height: 1.36;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { font-size: 28pt; line-height: 1.05; margin-bottom: 4mm; }
    h2 { font-size: 15pt; border-bottom: 1px solid #d6deea; padding-bottom: 2.5mm; margin-bottom: 4mm; break-after: avoid-page; page-break-after: avoid; }
    h3 { font-size: 11pt; margin-bottom: 2mm; break-after: avoid-page; page-break-after: avoid; }
    h4 { font-size: 8pt; margin: 3mm 0 1mm; color: #4d5b73; text-transform: uppercase; letter-spacing: .04em; }
    .cover { min-height: 255mm; display: grid; align-content: center; gap: 6mm; page-break-after: always; }
    .brand { color: #315178; font-size: 16pt; font-weight: 800; letter-spacing: 0; }
    .draft-label { display: inline-block; width: fit-content; border: 1px solid #b91c1c; color: #b91c1c; padding: 1.5mm 3mm; border-radius: 999px; font-size: 10pt; font-weight: 900; letter-spacing: .08em; }
    .report-title { color: #526176; font-size: 13pt; font-weight: 650; }
    .cover-meta { display: grid; gap: 2mm; color: #526176; font-size: 12pt; }
    .confidential { margin-top: 14mm; color: #526176; font-size: 10pt; }
    .report-section { margin: 0 0 6mm; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin: 4mm 0 6mm; }
    .summary-card { border: 1px solid #d6deea; border-radius: 2mm; padding: 3mm; background: #f7f9fc; }
    .summary-card strong { display: block; font-size: 15pt; }
    .summary-card span { color: #526176; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
    .finding, .action-item, .positive-item, .priority-item { border: 1px solid #d6deea; border-radius: 2mm; padding: 3.2mm; margin-bottom: 3mm; background: #fff; }
    .action-item, .positive-item { padding: 2.7mm; margin-bottom: 2mm; }
    .finding__meta { display: inline-block; margin-bottom: 2mm; padding: 1mm 2mm; border-radius: 999px; background: #edf3fb; color: #214b76; font-size: 7.8pt; font-weight: 800; }
    .finding-counts { color: #526176; font-size: 8.2pt; margin-bottom: 2mm; }
    .url { overflow-wrap: anywhere; word-break: break-word; color: #526176; }
    .effort { color: #526176; font-size: 9pt; }
    .evidence-table { width: 100%; border-collapse: collapse; margin: 2mm 0; font-size: 7.8pt; table-layout: fixed; }
    .evidence-table th, .evidence-table td { border: 1px solid #d6deea; padding: 1.3mm; vertical-align: top; overflow-wrap: anywhere; word-break: break-word; }
    .evidence-table th { background: #f7f9fc; color: #4d5b73; text-align: left; }
    .appendix-item { border-top: 1px solid #d6deea; padding-top: 4mm; margin-top: 5mm; }
    .priority-item div { display: flex; justify-content: space-between; gap: 5mm; }
    .priority-item span { color: #526176; font-size: 9pt; }
    .priority-item p { margin: 2mm 0 0; }
    .scope-grid { display: grid; grid-template-columns: 52mm 1fr; gap: 2mm 5mm; }
    .scope-grid dt { color: #526176; }
    .scope-grid dd { margin: 0; }
    .page-start { break-before: page; page-break-before: always; }
    .closing-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8mm; align-items: start; }
    .closing-grid--single { grid-template-columns: 1fr; }
    .closing-grid { font-size: 9.5pt; line-height: 1.3; }
    .closing-grid h2 { font-size: 13pt; padding-bottom: 2.5mm; }
    .closing-grid ul { margin: 0; }
    .closing-grid li { margin-bottom: 1mm; }
    .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    .draft-watermark {
      position: fixed;
      inset: 45% 0 auto;
      z-index: 50;
      text-align: center;
      color: rgba(185, 28, 28, 0.12);
      font-size: 64pt;
      font-weight: 900;
      letter-spacing: .1em;
      transform: rotate(-22deg);
      pointer-events: none;
    }
    ul { padding-left: 5mm; }
    li { margin-bottom: 2mm; }
  </style>
</head>
<body>
  ${options.draft ? `<div class="draft-watermark">DRAFT</div>` : ""}
  <section class="cover">
    <div class="brand">${payload.settings.displayLogo ? "Scanlark" : ""}</div>
    ${options.draft ? `<div class="draft-label">DRAFT - INTERNAL REVIEW</div>` : ""}
    <h1>Website Health Report</h1>
    <div class="report-title">${escapeHtml(payload.report.title)}</div>
    <div class="cover-meta">
      <strong>${escapeHtml(payload.business.name)}</strong>
      <span class="url">${escapeHtml(payload.site.displayName ?? payload.site.url)}</span>
      ${payload.report.preparedFor ? `<span>Prepared for ${escapeHtml(payload.report.preparedFor)}</span>` : ""}
      <span>Prepared by ${escapeHtml(payload.report.preparedBy ?? "Scanlark")}</span>
      <span>Report date ${escapeHtml(formatDate(payload.report.coverDate))}</span>
      <span>${escapeHtml(reportTypeLabel(payload.report.reportType))}</span>
    </div>
    ${payload.settings.confidentialNotice ? `<p class="confidential">${escapeHtml(payload.settings.confidentialNotice)}</p>` : ""}
  </section>
  <section class="report-section">
    <h2>Executive summary</h2>
    ${payload.summaries.overallSummary ? `<p>${escapeHtml(payload.summaries.overallSummary)}</p>` : ""}
    ${payload.summaries.executiveSummary ? `<h3>Overall website condition</h3><p>${escapeHtml(payload.summaries.executiveSummary)}</p>` : ""}
    ${payload.summaries.mainStrengths ? `<h3>Main strengths</h3><p>${escapeHtml(payload.summaries.mainStrengths)}</p>` : ""}
    ${payload.summaries.mainConcerns ? `<h3>Main concerns</h3><p>${escapeHtml(payload.summaries.mainConcerns)}</p>` : ""}
    ${payload.summaries.recommendedFirstSteps ? `<h3>Recommended immediate action</h3><p>${escapeHtml(payload.summaries.recommendedFirstSteps)}</p>` : ""}
    <div class="summary-grid">
      ${Object.entries(payload.priorityCounts)
        .filter(
          ([priority, count]) => count > 0 || priority !== "informational",
        )
        .map(
          ([priority, count]) =>
            `<div class="summary-card"><span>${priorityLabel(priority)}</span><strong>${count}</strong></div>`,
        )
        .join("")}
    </div>
  </section>
  ${
    payload.settings.displayWebsiteHealthScore &&
    payload.scan.healthScore != null
      ? `<section class="report-section avoid-break">
          <h2>Website health score</h2>
          <div class="summary-grid">
            <article class="summary-card">
              <span>Reviewed score</span>
              <strong>${payload.scan.healthScore}</strong>
            </article>
          </div>
        </section>`
      : ""
  }
  <section class="report-section">
    <h2>Review scope</h2>
    <dl class="scope-grid">
      <dt>Website</dt><dd class="url">${escapeHtml(payload.site.url)}</dd>
      <dt>Selected scan date</dt><dd>${escapeHtml(formatDate(payload.scan.finishedAt))}</dd>
      <dt>Public links/resources checked</dt><dd>${payload.scan.checkedLinks} of ${payload.scan.totalLinks} discovered</dd>
    </dl>
    ${payload.summaries.scopeLimitations ? `<p>${escapeHtml(payload.summaries.scopeLimitations)}</p>` : ""}
  </section>
  <section class="report-section">
    <h2>Priority overview</h2>
    <p>Priorities reflect the reviewed client impact and recommended order of attention. Labels and descriptions are provided so the overview does not rely on colour alone.</p>
    ${priorities}
  </section>
  ${
    findings
      ? `<section class="report-section page-start"><h2>Key findings</h2>${findings}</section>`
      : ""
  }
  ${
    actionGroups
      ? `<section class="report-section"><h2>Recommended action plan</h2>${actionGroups}</section>`
      : ""
  }
  ${
    payload.settings.displayPositiveObservations && positives
      ? `<section class="report-section"><h2>Positive observations</h2>${positives}</section>`
      : ""
  }
  ${closingContent}
  ${technicalAppendix}
</body>
</html>`;
}

export async function renderOperationsReportPdf(
  payload: OperationsClientReportPayload,
  options: { draft?: boolean } = {},
) {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ??
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderOperationsReportHtml(payload, options), {
      waitUntil: "load",
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#6b7688;padding:0 16mm;display:flex;justify-content:space-between;gap:10mm;"><span>${escapeHtml(payload.settings.footerText ?? "Scanlark")}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
      preferCSSPageSize: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}
