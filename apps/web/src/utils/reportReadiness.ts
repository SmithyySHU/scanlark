export type ReportPriority =
  | "critical"
  | "important"
  | "improvement"
  | "informational";

export type ReviewFinding = {
  id: string;
  client_priority: ReportPriority;
  title: string;
  client_explanation: string | null;
  why_it_matters: string | null;
  recommended_action: string | null;
  affected_url: string | null;
  affected_url_note: string | null;
  is_included: boolean;
  is_false_positive: boolean;
  reviewed_at: string | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

export function hasUsableAffectedUrl(finding: ReviewFinding) {
  if (hasText(finding.affected_url)) {
    try {
      const url = new URL(finding.affected_url ?? "");
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }
  return hasText(finding.affected_url_note);
}

export function missingFindingReadinessFields(finding: ReviewFinding) {
  const missing: string[] = [];
  if (!hasText(finding.client_priority)) missing.push("priority");
  if (!hasText(finding.title)) missing.push("title");
  if (!hasText(finding.client_explanation)) missing.push("what was found");
  if (!hasText(finding.why_it_matters)) missing.push("why it matters");
  if (!hasText(finding.recommended_action)) missing.push("recommended action");
  if (!hasUsableAffectedUrl(finding)) {
    missing.push("affected URL or no-URL reason");
  }
  return missing;
}

export function isFindingReady(finding: ReviewFinding) {
  if (!finding.is_included || finding.is_false_positive) return false;
  return missingFindingReadinessFields(finding).length === 0;
}
