import type {
  OperationsReportCoverage,
  OperationsReportCoverageItem,
  OperationsReportSourceDisposition,
} from "./types";

export type OperationsReportCoverageDisposition =
  | OperationsReportSourceDisposition
  | "unaccounted";

export type OperationsReportCoverageGroup = {
  key: string;
  disposition: OperationsReportCoverageDisposition;
  category: string;
  issueType: string;
  reportFindingId: string | null;
  reportFindingTitle: string | null;
  title: string;
  reason: string;
  items: OperationsReportCoverageItem[];
};

export type OperationsReportCoverageSection = {
  disposition: OperationsReportCoverageDisposition;
  label: string;
  count: number;
  groups: OperationsReportCoverageGroup[];
};

const DISPOSITION_ORDER: OperationsReportCoverageDisposition[] = [
  "unaccounted",
  "manual_verification_required",
  "included_client_finding",
  "grouped_into_client_finding",
  "excluded_by_operator",
  "false_positive",
  "internal_system_only",
];

const DISPOSITION_LABELS: Record<OperationsReportCoverageDisposition, string> =
  {
    included_client_finding: "Included directly",
    grouped_into_client_finding: "Grouped into client findings",
    manual_verification_required: "Manual verification required",
    excluded_by_operator: "Excluded by operator",
    false_positive: "False positives",
    internal_system_only: "Internal/system only",
    unaccounted: "Unaccounted",
  };

export function coverageDispositionLabel(
  disposition: OperationsReportCoverageDisposition,
) {
  return DISPOSITION_LABELS[disposition];
}

export function coverageAccountedCount(coverage: OperationsReportCoverage) {
  return Math.max(0, coverage.participatingSourceIssues - coverage.unaccounted);
}

function groupTitle(items: OperationsReportCoverageItem[]) {
  const first = items[0];
  if (items.every((item) => item.title === first.title)) return first.title;
  return first.issueType.replaceAll("_", " ");
}

export function groupOperationsReportCoverage(
  items: OperationsReportCoverageItem[],
): OperationsReportCoverageSection[] {
  const grouped = new Map<string, OperationsReportCoverageItem[]>();
  for (const item of items) {
    const key = [
      item.disposition,
      item.reportFindingId ?? "unmapped",
      item.category,
      item.issueType,
    ].join(":");
    const current = grouped.get(key);
    if (current) current.push(item);
    else grouped.set(key, [item]);
  }

  return DISPOSITION_ORDER.map((disposition) => {
    const groups = [...grouped.entries()]
      .filter(([, rows]) => rows[0].disposition === disposition)
      .map(([key, rows]) => ({
        key,
        disposition,
        category: rows[0].category,
        issueType: rows[0].issueType,
        reportFindingId: rows[0].reportFindingId,
        reportFindingTitle: rows[0].reportFindingTitle,
        title: groupTitle(rows),
        reason: rows[0].reason,
        items: rows,
      }))
      .sort(
        (left, right) =>
          right.items.length - left.items.length ||
          left.title.localeCompare(right.title),
      );
    return {
      disposition,
      label: coverageDispositionLabel(disposition),
      count: groups.reduce((total, group) => total + group.items.length, 0),
      groups,
    };
  }).filter((section) => section.count > 0);
}

export function coverageAttentionSections(
  sections: OperationsReportCoverageSection[],
) {
  return sections.filter(
    (section) =>
      section.disposition === "unaccounted" ||
      section.disposition === "manual_verification_required",
  );
}
