import { existsSync } from "node:fs";
import { chromium } from "playwright";
import type { OperationsQuotePreviewPayload } from "@scanlark/db";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / 100,
  );
}

export function operationsQuotePdfFilename(
  payload: OperationsQuotePreviewPayload,
) {
  const safe = payload.quote.quoteNumber.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${safe || "scanlark-quote"}.pdf`;
}

export function renderOperationsQuoteHtml(
  payload: OperationsQuotePreviewPayload,
) {
  const rows = payload.items
    .map(
      (item) =>
        `<tr><td><strong>${escapeHtml(item.title)}</strong>${item.description ? `<br><span>${escapeHtml(item.description)}</span>` : ""}</td><td>${item.quantity}</td><td>${money(item.unitPriceMinor, payload.quote.currency)}</td><td>${money(item.lineTotalMinor, payload.quote.currency)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font:14px/1.5 Arial,sans-serif;color:#17212b}h1{color:#14233b;margin:0 0 8px}.brand{color:#185c73;font-weight:700}.meta{color:#64748b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:28px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #d9e0e7;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#64748b}td:nth-child(n+2),th:nth-child(n+2){text-align:right}.total{margin:18px 0 30px;text-align:right;font-size:18px}.section{margin:22px 0;break-inside:avoid}.footer{margin-top:36px;padding-top:14px;border-top:1px solid #d9e0e7;color:#64748b;font-size:11px}</style></head><body><div class="brand">SCANLARK</div><h1>${escapeHtml(payload.quote.title)}</h1><div class="meta">Quote ${escapeHtml(payload.quote.quoteNumber)}</div><div class="grid"><div><strong>Prepared for</strong><br>${escapeHtml(payload.business.name)}${payload.contact.name ? `<br>${escapeHtml(payload.contact.name)}` : ""}</div><div><strong>Valid until</strong><br>${escapeHtml(payload.quote.validUntil ?? "As agreed")}</div></div><table><thead><tr><th>Scope</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><strong>Total: ${money(payload.totals.totalMinor, payload.quote.currency)}</strong><br><small>${escapeHtml(payload.totals.vatNotice)}</small></div>${payload.scope.summary ? `<div class="section"><h2>Scope summary</h2><p>${escapeHtml(payload.scope.summary)}</p></div>` : ""}${payload.scope.included ? `<div class="section"><h2>Included</h2><p>${escapeHtml(payload.scope.included)}</p></div>` : ""}${payload.scope.excluded ? `<div class="section"><h2>Excluded</h2><p>${escapeHtml(payload.scope.excluded)}</p></div>` : ""}${payload.scope.paymentTerms ? `<div class="section"><h2>Payment terms</h2><p>${escapeHtml(payload.scope.paymentTerms)}</p></div>` : ""}<div class="footer">Connor Smith · Founder, Scanlark · contact@scanlark.com · scanlark.com</div></body></html>`;
}

export async function renderOperationsQuotePdf(
  payload: OperationsQuotePreviewPayload,
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
    await page.setContent(renderOperationsQuoteHtml(payload), {
      waitUntil: "load",
    });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      tagged: true,
    });
  } finally {
    await browser.close();
  }
}
