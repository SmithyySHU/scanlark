import assert from "node:assert/strict";
import test from "node:test";
import {
  coverageAccountedCount,
  coverageAttentionSections,
  groupOperationsReportCoverage,
} from "./reportCoverage";
import type {
  OperationsReportCoverage,
  OperationsReportCoverageItem,
} from "./types";

function item(
  index: number,
  input: Partial<OperationsReportCoverageItem> = {},
): OperationsReportCoverageItem {
  return {
    sourceIssueId: `issue-${index}`,
    category: "seo_basic",
    issueType: "missing_meta_description",
    title: "Missing meta description",
    affectedUrl: `https://example.test/page-${index}`,
    disposition: "grouped_into_client_finding",
    reason: "Represented by a grouped client finding.",
    reportFindingId: "finding-meta",
    reportFindingTitle: "Meta descriptions are missing",
    ...input,
  };
}

function fixture(): OperationsReportCoverage {
  const items: OperationsReportCoverageItem[] = [
    ...Array.from({ length: 37 }, (_, index) => item(index)),
    item(37, {
      disposition: "included_client_finding",
      reportFindingId: "finding-security-1",
      reportFindingTitle: "HSTS is missing",
      category: "security_header",
      issueType: "hsts_missing",
      title: "HSTS missing",
    }),
    item(38, {
      disposition: "included_client_finding",
      reportFindingId: "finding-security-2",
      reportFindingTitle: "Referrer-Policy is missing",
      category: "security_header",
      issueType: "referrer_policy_missing",
      title: "Referrer-Policy missing",
    }),
    item(39, {
      disposition: "false_positive",
      reportFindingId: "finding-false-positive",
      reportFindingTitle: "Reviewed link",
      category: "link_integrity",
      issueType: "broken_link",
    }),
    item(40, {
      disposition: "unaccounted",
      reportFindingId: "finding-blocked",
      reportFindingTitle: "Links require manual destination verification",
      category: "link_integrity",
      issueType: "blocked_link",
      title: "Blocked link",
      reason: "The manual disposition conflicts with client inclusion.",
    }),
  ];
  return {
    participatingSourceIssues: 41,
    includedClientFindings: 2,
    groupedIntoClientFindings: 37,
    manualVerificationRequired: 0,
    excludedByOperator: 0,
    falsePositives: 1,
    internalSystemOnly: 0,
    unaccounted: 1,
    complete: false,
    items,
  };
}

test("coverage groups repeated observations instead of producing default source rows", () => {
  const coverage = fixture();
  const sections = groupOperationsReportCoverage(coverage.items);
  const grouped = sections.find(
    (section) => section.disposition === "grouped_into_client_finding",
  );
  assert.equal(coverageAccountedCount(coverage), 40);
  assert.equal(grouped?.count, 37);
  assert.equal(grouped?.groups.length, 1);
  assert.equal(grouped?.groups[0].items.length, 37);
});

test("attention view contains unaccounted/manual groups while full view retains every source", () => {
  const coverage = fixture();
  const sections = groupOperationsReportCoverage(coverage.items);
  const attention = coverageAttentionSections(sections);
  assert.equal(attention.length, 1);
  assert.equal(attention[0].disposition, "unaccounted");
  assert.equal(attention[0].groups[0].items[0].sourceIssueId, "issue-40");
  assert.equal(
    sections
      .flatMap((section) => section.groups)
      .flatMap((group) => group.items).length,
    41,
  );
});

test("legitimate manual classification removes the unaccounted total without losing attention", () => {
  const coverage = fixture();
  coverage.items[40] = {
    ...coverage.items[40],
    disposition: "manual_verification_required",
    reason: "The automated destination check was inconclusive.",
  };
  coverage.manualVerificationRequired = 1;
  coverage.unaccounted = 0;
  coverage.complete = true;
  const attention = coverageAttentionSections(
    groupOperationsReportCoverage(coverage.items),
  );
  assert.equal(coverageAccountedCount(coverage), 41);
  assert.equal(attention[0].disposition, "manual_verification_required");
  assert.equal(attention[0].count, 1);
});
