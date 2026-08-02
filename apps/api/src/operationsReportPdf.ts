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

function listItems(items: string[]) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
}

export function renderOperationsReportHtml(
  payload: OperationsClientReportPayload,
) {
  const actionGroups = Object.entries(payload.actionPlan)
    .filter(([, items]) => items.length > 0)
    .map(
      ([group, items]) => `
        <section class="report-section avoid-break">
          <h3>${actionPlanLabel(group)}</h3>
          ${items
            .map(
              (item) => `
                <article class="action-item">
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
    @page { size: A4; margin: 18mm 16mm 20mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #172033;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, p { margin-top: 0; }
    h1 { font-size: 30pt; line-height: 1.05; margin-bottom: 12mm; }
    h2 { font-size: 18pt; border-bottom: 1px solid #d6deea; padding-bottom: 4mm; }
    h3 { font-size: 13pt; margin-bottom: 3mm; }
    h4 { font-size: 9pt; margin: 5mm 0 1.5mm; color: #4d5b73; text-transform: uppercase; letter-spacing: .04em; }
    .cover { min-height: 246mm; display: grid; align-content: center; gap: 7mm; page-break-after: always; }
    .brand { color: #315178; font-size: 12pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .cover-meta { display: grid; gap: 2mm; color: #526176; font-size: 12pt; }
    .confidential { margin-top: 14mm; color: #526176; font-size: 10pt; }
    .report-section { margin: 0 0 10mm; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 6mm 0 10mm; }
    .summary-card { border: 1px solid #d6deea; border-radius: 3mm; padding: 4mm; background: #f7f9fc; }
    .summary-card strong { display: block; font-size: 18pt; }
    .summary-card span { color: #526176; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
    .finding, .action-item, .positive-item { border: 1px solid #d6deea; border-radius: 3mm; padding: 5mm; margin-bottom: 5mm; background: #fff; }
    .finding__meta { display: inline-block; margin-bottom: 3mm; padding: 1.5mm 2.5mm; border-radius: 999px; background: #edf3fb; color: #214b76; font-size: 8.5pt; font-weight: 800; }
    .url { overflow-wrap: anywhere; word-break: break-word; color: #526176; }
    .effort { color: #526176; font-size: 9pt; }
    .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    ul { padding-left: 5mm; }
    li { margin-bottom: 2mm; }
  </style>
</head>
<body>
  <section class="cover">
    <div class="brand">${payload.settings.displayLogo ? "Scanlark" : ""}</div>
    <h1>${escapeHtml(payload.report.title)}</h1>
    <div class="cover-meta">
      <strong>${escapeHtml(payload.business.name)}</strong>
      <span>${escapeHtml(payload.site.displayName ?? payload.site.url)}</span>
      <span>Prepared for ${escapeHtml(payload.report.preparedFor ?? "Client")}</span>
      <span>Prepared by ${escapeHtml(payload.report.preparedBy ?? "Scanlark")}</span>
      <span>${escapeHtml(payload.report.coverDate)}</span>
    </div>
    ${payload.settings.confidentialNotice ? `<p class="confidential">${escapeHtml(payload.settings.confidentialNotice)}</p>` : ""}
  </section>
  <section class="report-section">
    <h2>Executive summary</h2>
    ${payload.summaries.executiveSummary ? `<p>${escapeHtml(payload.summaries.executiveSummary)}</p>` : ""}
    ${payload.summaries.overallSummary ? `<p>${escapeHtml(payload.summaries.overallSummary)}</p>` : ""}
    ${payload.summaries.mainStrengths ? `<h3>Main strengths</h3><p>${escapeHtml(payload.summaries.mainStrengths)}</p>` : ""}
    ${payload.summaries.mainConcerns ? `<h3>Main concerns</h3><p>${escapeHtml(payload.summaries.mainConcerns)}</p>` : ""}
    ${payload.summaries.recommendedFirstSteps ? `<h3>Recommended immediate action</h3><p>${escapeHtml(payload.summaries.recommendedFirstSteps)}</p>` : ""}
    <div class="summary-grid">
      ${Object.entries(payload.priorityCounts)
        .map(
          ([priority, count]) =>
            `<div class="summary-card"><span>${priorityLabel(priority)}</span><strong>${count}</strong></div>`,
        )
        .join("")}
    </div>
  </section>
  <section class="report-section">
    <h2>Review scope</h2>
    <p>Website scanned: <span class="url">${escapeHtml(payload.site.url)}</span></p>
    <p>Pages and links checked: ${payload.scan.checkedLinks} checked links from ${payload.scan.totalLinks} discovered links.</p>
    ${payload.summaries.scopeLimitations ? `<p>${escapeHtml(payload.summaries.scopeLimitations)}</p>` : ""}
  </section>
  ${
    findings
      ? `<section class="report-section"><h2>Key findings</h2>${findings}</section>`
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
  ${
    payload.settings.displayNextSteps
      ? `<section class="report-section"><h2>Next steps</h2>${listItems(payload.nextSteps)}</section>`
      : ""
  }
  ${
    payload.settings.displayMethodologyLimitations
      ? `<section class="report-section"><h2>Methodology and limitations</h2>${listItems(payload.methodology)}</section>`
      : ""
  }
</body>
</html>`;
}

export async function renderOperationsReportPdf(
  payload: OperationsClientReportPayload,
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
    await page.setContent(renderOperationsReportHtml(payload), {
      waitUntil: "load",
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#6b7688;padding:0 16mm;display:flex;justify-content:space-between;"><span>Scanlark</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
      margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
      preferCSSPageSize: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}
