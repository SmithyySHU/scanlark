import assert from "node:assert/strict";
import test from "node:test";
import type { OperationsQuotePreviewPayload } from "@scanlark/db";
import {
  operationsQuotePdfFilename,
  renderOperationsQuoteHtml,
  renderOperationsQuotePdf,
} from "./operationsQuotePdf";

const payload: OperationsQuotePreviewPayload = {
  quote: {
    id: "quote-id",
    quoteNumber: "SL-Q-104",
    title: "Website repairs",
    status: "ready_to_send",
    currency: "GBP",
    validUntil: "2026-08-18",
    estimatedStartDate: null,
    estimatedCompletionDate: null,
    estimatedDurationText: null,
    sentAt: null,
    acceptedAt: null,
  },
  business: { id: "business-id", name: "Example & Co" },
  contact: { name: "Alex Client", email: "alex@example.com" },
  report: null,
  items: [
    {
      id: "item-id",
      title: "Repair broken links",
      description: "Fix reviewed links",
      quantity: 1,
      unitPriceMinor: 25000,
      lineTotalMinor: 25000,
      itemType: "website_fix",
      isOptional: false,
      estimatedEffort: null,
    },
  ],
  totals: {
    subtotalMinor: 25000,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: 25000,
    vatRegistered: false,
    vatRatePercent: 20,
    vatNotice: "No VAT charged.",
  },
  scope: {
    summary: "Complete the agreed repairs.",
    included: "Broken-link repairs",
    excluded: "New development",
    assumptions: null,
    clientResponsibilities: null,
    accessRequirementsSummary: null,
    paymentTerms: "Payment on completion",
  },
  limitations: ["Agreed scope only"],
  generatedAt: "2026-08-04T09:30:00.000Z",
};

test("quote HTML is a self-contained escaped commercial document", () => {
  const html = renderOperationsQuoteHtml(payload);
  assert.ok(html.includes("SL-Q-104"));
  assert.ok(html.includes("Example &amp; Co"));
  assert.ok(html.includes("£250.00"));
  assert.equal(html.includes("<script"), false);
  assert.equal(operationsQuotePdfFilename(payload), "SL-Q-104.pdf");
});

test(
  "quote PDF is rendered durably on the server with Playwright",
  {
    skip: process.env.RUN_OPERATIONS_PDF_RENDER_TEST !== "true",
  },
  async () => {
    const pdf = await renderOperationsQuotePdf(payload);
    assert.ok(pdf.length > 1000);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
  },
);
