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

export type FilterableReportFinding = ReviewFinding & {
  category: string;
  affected_url: string | null;
  original_severity: string;
};

export function useReportFindings(
  findings: FilterableReportFinding[],
  filter: ReportFindingFilter,
  category: string,
  search: string,
) {
  return useMemo(() => {
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
      if (!finding.is_included || finding.is_false_positive)
        counts.excluded += 1;
      if (included && missingFindingReadinessFields(finding).length > 0) {
        counts.needs_editing += 1;
      }
      if (isFindingReady(finding)) counts.ready += 1;
      if (finding.is_false_positive) counts.possible_false_positive += 1;
      counts[finding.client_priority] += 1;
      categories.set(
        finding.category,
        (categories.get(finding.category) ?? 0) + 1,
      );
    }

    const filtered = findings.filter((finding) => {
      const included = finding.is_included && !finding.is_false_positive;
      if (filter === "included" && !included) return false;
      if (filter === "excluded" && included) return false;
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
        finding.client_priority !== filter
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

    return {
      filtered,
      counts,
      categories: Array.from(categories.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      ),
    };
  }, [category, filter, findings, search]);
}
