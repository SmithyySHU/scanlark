import { useMemo } from "react";
import {
  isFindingReady,
  missingFindingReadinessFields,
  type ReviewFinding,
} from "../utils/reportReadiness";

export type ReportFindingFilter =
  | "all"
  | "included"
  | "excluded"
  | "needs_editing"
  | "ready"
  | "possible_false_positive"
  | "critical"
  | "important"
  | "improvement"
  | "informational";

export type ReportFindingSort =
  | "review_state"
  | "priority"
  | "display_order"
  | "occurrence_count"
  | "affected_page_count"
  | "title";

export type FilterableReportFinding = ReviewFinding & {
  category: string;
  affected_url: string | null;
  original_severity: string;
  occurrence_count: number;
  affected_page_count: number;
  affected_resource_count: number;
  group_label: string | null;
  display_order: number;
};

const priorityRank: Record<ReportFindingFilter, number> = {
  critical: 0,
  important: 1,
  improvement: 2,
  informational: 3,
  all: 4,
  included: 4,
  excluded: 4,
  needs_editing: 4,
  ready: 4,
  possible_false_positive: 4,
};

function reviewStateRank(finding: FilterableReportFinding) {
  if (finding.is_false_positive) return 3;
  if (!finding.is_included) return 2;
  if (isFindingReady(finding)) return 1;
  return 0;
}

export function useReportFindings<TFinding extends FilterableReportFinding>(
  findings: TFinding[],
  filter: ReportFindingFilter,
  category: string,
  search: string,
  sort: ReportFindingSort = "review_state",
) {
  return useMemo(
    () => getReportFindingsView(findings, filter, category, search, sort),
    [category, filter, findings, search, sort],
  );
}

export function getReportFindingsView<TFinding extends FilterableReportFinding>(
  findings: TFinding[],
  filter: ReportFindingFilter,
  category: string,
  search: string,
  sort: ReportFindingSort = "review_state",
) {
  const searchText = search.trim().toLowerCase();
  const counts: Record<ReportFindingFilter, number> = {
    all: findings.length,
    included: 0,
    excluded: 0,
    needs_editing: 0,
    ready: 0,
    possible_false_positive: 0,
    critical: 0,
    important: 0,
    improvement: 0,
    informational: 0,
  };
  const categories = new Map<string, number>();

  for (const finding of findings) {
    const included = finding.is_included && !finding.is_false_positive;
    if (included) counts.included += 1;
    if (!finding.is_included && !finding.is_false_positive)
      counts.excluded += 1;
    if (included && missingFindingReadinessFields(finding).length > 0) {
      counts.needs_editing += 1;
    }
    if (isFindingReady(finding)) counts.ready += 1;
    if (finding.is_false_positive) counts.possible_false_positive += 1;
    if (included) counts[finding.client_priority] += 1;
    categories.set(
      finding.category,
      (categories.get(finding.category) ?? 0) + 1,
    );
  }

  const filtered = findings.filter((finding) => {
    const included = finding.is_included && !finding.is_false_positive;
    if (filter === "included" && !included) return false;
    if (
      filter === "excluded" &&
      (finding.is_included || finding.is_false_positive)
    ) {
      return false;
    }
    if (
      filter === "needs_editing" &&
      (!included || missingFindingReadinessFields(finding).length === 0)
    ) {
      return false;
    }
    if (filter === "ready" && !isFindingReady(finding)) return false;
    if (filter === "possible_false_positive" && !finding.is_false_positive) {
      return false;
    }
    if (
      ["critical", "important", "improvement", "informational"].includes(
        filter,
      ) &&
      (!included || finding.client_priority !== filter)
    ) {
      return false;
    }
    if (category && finding.category !== category) return false;
    if (!searchText) return true;
    return (
      finding.title.toLowerCase().includes(searchText) ||
      (finding.affected_url ?? "").toLowerCase().includes(searchText)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "priority") {
      return priorityRank[a.client_priority] - priorityRank[b.client_priority];
    }
    if (sort === "display_order") {
      return (
        a.display_order - b.display_order || a.title.localeCompare(b.title)
      );
    }
    if (sort === "occurrence_count") {
      return b.occurrence_count - a.occurrence_count;
    }
    if (sort === "affected_page_count") {
      return b.affected_page_count - a.affected_page_count;
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    return (
      reviewStateRank(a) - reviewStateRank(b) ||
      priorityRank[a.client_priority] - priorityRank[b.client_priority] ||
      a.display_order - b.display_order ||
      a.title.localeCompare(b.title)
    );
  });

  return {
    filtered: sorted,
    counts,
    categories: Array.from(categories.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
  };
}
