import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useOperationsReportDraft,
  useOptionalOperationsReportDraft,
} from "../../../hooks/useOperationsReport";
import {
  useReportFindings,
  type ReportFindingFilter,
  type ReportFindingSort,
} from "../../../hooks/useReportFindings";
import {
  formatOperationsDate,
  formatOperationsDateTime,
  sanitizeFilenamePart,
} from "../../../utils/reportFormatting";
import {
  isFindingReady,
  missingFindingReadinessFields,
} from "../../../utils/reportReadiness";
import { ReportClientPreview } from "./ReportClientPreview";
import type {
  ClientReportPayload,
  OperationsReportActionPlanGroup,
  OperationsReportActionPlanItem,
  OperationsReportDetail,
  OperationsReportFinding,
  OperationsReportFindingSource,
  OperationsReportPositiveObservation,
  OperationsReportPriority,
  OperationsReportReadinessIssue,
  OperationsReportRegroupPreview,
} from "./types";

type ReportTab =
  | "overview"
  | "summary"
  | "findings"
  | "action_plan"
  | "preview"
  | "settings"
  | "activity";

const priorityOptions: Array<{
  value: OperationsReportPriority;
  label: string;
}> = [
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "improvement", label: "Improvement" },
  { value: "informational", label: "Informational" },
];

const tabs: Array<{ key: ReportTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "summary", label: "Executive summary" },
  { key: "findings", label: "Findings" },
  { key: "action_plan", label: "Action plan" },
  { key: "preview", label: "Preview" },
  { key: "settings", label: "Settings" },
  { key: "activity", label: "Activity" },
];

function reportStatusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function priorityLabel(value: string) {
  return priorityOptions.find((item) => item.value === value)?.label ?? value;
}

function reviewStateLabel(finding: OperationsReportFinding) {
  if (finding.is_false_positive) return "False positive";
  if (!finding.is_included) return "Excluded";
  if (isFindingReady(finding)) return "Ready";
  return "Needs review";
}

function findingIsIncluded(finding: OperationsReportFinding) {
  return finding.is_included && !finding.is_false_positive;
}

function firstExampleText(finding: OperationsReportFinding) {
  const example = finding.representative_examples_json[0];
  return (
    example?.affectedPageUrl ??
    example?.affectedResourceUrl ??
    finding.affected_url ??
    ""
  );
}

function exampleTextForAction(finding: OperationsReportFinding, index: number) {
  const example = finding.representative_examples_json[index];
  if (!example) return "";
  return [
    example.affectedPageUrl ? `Page: ${example.affectedPageUrl}` : null,
    example.affectedResourceUrl
      ? `Resource: ${example.affectedResourceUrl}`
      : null,
    example.result,
    example.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

function actionPlanLabel(value: string) {
  if (value === "address_now") return "Address now";
  if (value === "address_soon") return "Address soon";
  return "Consider later";
}

function clientReportFilename(payload: ClientReportPayload | null) {
  if (!payload) return "scanlark-website-health-report.pdf";
  const business = sanitizeFilenamePart(payload.business.name) || "business";
  const domain = sanitizeFilenamePart(payload.site.domain) || "website";
  return `scanlark-website-health-report-${business}-${domain}-${payload.report.coverDate}.pdf`;
}

type Props = {
  readOnly: boolean;
  detail: OperationsReportDetail;
  preview: ClientReportPayload | null;
  readinessIssues: OperationsReportReadinessIssue[];
  regroupPreview: OperationsReportRegroupPreview | null;
  actionError: string | null;
  onPatchReport: (input: Record<string, unknown>) => Promise<void>;
  onPatchFinding: (
    findingId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onBulkFindings: (input: Record<string, unknown>) => Promise<void>;
  onPreviewRegroup: () => Promise<void>;
  onApplyRegroup: (previewHash: string) => Promise<void>;
  onPatchObservation: (
    observationId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onPatchActionPlanItem: (
    itemId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onApprove: () => Promise<void>;
  onMarkReady: () => Promise<void>;
  onRecordSent: () => Promise<void>;
  onGeneratePdf: (mode: "draft" | "final") => Promise<void>;
  onArchive: () => Promise<void>;
  onCreateRetest: () => Promise<void>;
  onCreateRevision: () => Promise<void>;
  onCreateQuote: () => void;
};

export function OperationsReportWorkspace({
  readOnly,
  detail,
  preview,
  readinessIssues,
  regroupPreview,
  actionError,
  onPatchReport,
  onPatchFinding,
  onBulkFindings,
  onPreviewRegroup,
  onApplyRegroup,
  onPatchObservation,
  onPatchActionPlanItem,
  onApprove,
  onMarkReady,
  onRecordSent,
  onGeneratePdf,
  onArchive,
  onCreateRetest,
  onCreateRevision,
  onCreateQuote,
}: Props) {
  const historicalReport = [
    "sent",
    "client_replied",
    "fixes_quoted",
    "work_in_progress",
    "completed",
    "archived",
  ].includes(detail.report.status);
  const artifactReadOnly = readOnly || historicalReport;
  const initialFindingFilter: ReportFindingFilter = detail.findings.some(
    (finding) => findingIsIncluded(finding) && !isFindingReady(finding),
  )
    ? "needs_editing"
    : "included";
  const [tab, setTab] = useState<ReportTab>("overview");
  const [filter, setFilter] =
    useState<ReportFindingFilter>(initialFindingFilter);
  const [sort, setSort] = useState<ReportFindingSort>("review_state");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState(
    detail.findings[0]?.id ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewMode, setPreviewMode] = useState<"desktop" | "a4">("a4");
  const [findingDetailOpen, setFindingDetailOpen] = useState(false);
  const [findingSaveState, setFindingSaveState] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [findingSaveError, setFindingSaveError] = useState<string | null>(null);
  const [dirtyChildKeys, setDirtyChildKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const reportDraft = useOperationsReportDraft(detail.report, artifactReadOnly);
  const selectedFinding = detail.findings.find(
    (finding) => finding.id === selectedFindingId,
  );
  const findingDraft = useOptionalOperationsReportDraft(
    selectedFinding ?? detail.findings[0],
    artifactReadOnly,
  );
  const { filtered, counts, categories } = useReportFindings(
    detail.findings,
    filter,
    category,
    search,
    sort,
  );
  const includedCount = detail.findings.filter(findingIsIncluded).length;
  const falsePositiveCount = detail.findings.filter(
    (finding) => finding.is_false_positive,
  ).length;
  const excludedCount = detail.findings.filter(
    (finding) => !finding.is_included && !finding.is_false_positive,
  ).length;
  const rawOccurrenceCount = detail.findings.reduce(
    (total, finding) => total + Math.max(1, finding.occurrence_count ?? 1),
    0,
  );
  const readyCount = detail.findings.filter(isFindingReady).length;
  const incomplete = detail.findings.filter(
    (finding) =>
      finding.is_included &&
      !finding.is_false_positive &&
      !isFindingReady(finding),
  );
  const selectedVisibleIds = useMemo(
    () => new Set(filtered.map((finding) => finding.id)),
    [filtered],
  );
  const selectedVisibleCount = [...selectedIds].filter((id) =>
    selectedVisibleIds.has(id),
  ).length;
  const reviewedIncludedCount = detail.findings.filter(
    (finding) => findingIsIncluded(finding) && finding.reviewed_at,
  ).length;
  const remainingIncludedCount = Math.max(
    0,
    includedCount - reviewedIncludedCount,
  );
  const previewStale =
    reportDraft.dirty || findingDraft.dirty || dirtyChildKeys.size > 0;
  const approvalCurrent =
    Boolean(
      detail.report.approved_at &&
      detail.report.approved_by_user_id &&
      detail.report.approved_content_revision != null,
    ) &&
    detail.report.approved_content_revision ===
      (detail.report.content_revision ?? 1);
  const clientOutputFrozen =
    Boolean(detail.report.frozen_at) &&
    !["draft", "needs_review"].includes(detail.report.status);
  const priorityCounts = priorityOptions.map((priority) => ({
    ...priority,
    count: detail.findings.filter(
      (finding) =>
        finding.is_included &&
        !finding.is_false_positive &&
        finding.client_priority === priority.value,
    ).length,
  }));
  const pdfBlockingIssues = readinessIssues.filter(
    (issue) => issue.code !== "pdf_not_generated",
  );
  const editableDraftReport =
    !clientOutputFrozen &&
    (detail.report.status === "draft" ||
      detail.report.status === "needs_review");
  const pdfUnavailableReason = previewStale
    ? "Save your changes before generating a PDF."
    : pdfBlockingIssues.length > 0
      ? `${pdfBlockingIssues.length} readiness item${pdfBlockingIssues.length === 1 ? "" : "s"} block final PDF generation.`
      : !approvalCurrent
        ? "Approve the current report preview before generating the final PDF."
        : "";
  const includedFindingIds = new Set(
    detail.findings
      .filter((finding) => finding.is_included && !finding.is_false_positive)
      .map((finding) => finding.id),
  );
  const visibleActionPlanItems = detail.actionPlanItems.filter(
    (item) =>
      item.report_finding_id == null ||
      includedFindingIds.has(item.report_finding_id),
  );
  const estimatedMainPages = Math.max(
    5,
    Math.ceil(2 + includedCount * 0.55 + visibleActionPlanItems.length * 0.15),
  );
  const readinessSections = useMemo(() => {
    const sectionLabels: Record<
      OperationsReportReadinessIssue["section"],
      string
    > = {
      settings: "Report details",
      summary: "Executive summary",
      findings: "Findings requiring review",
      action_plan: "Action plan and positives",
      preview: "Preview/PDF",
    };
    return Object.entries(sectionLabels)
      .map(([section, label]) => {
        const issues = readinessIssues.filter(
          (issue) => issue.section === section,
        );
        const grouped = new Map<string, OperationsReportReadinessIssue[]>();
        for (const issue of issues) {
          const finding = issue.findingId
            ? detail.findings.find((item) => item.id === issue.findingId)
            : null;
          const key =
            finding?.group_key ??
            finding?.title ??
            issue.message.replace(/".*"/, '"finding"');
          grouped.set(key, [...(grouped.get(key) ?? []), issue]);
        }
        return {
          section: section as OperationsReportReadinessIssue["section"],
          label,
          issues,
          grouped: [...grouped.entries()].map(([key, items]) => ({
            key,
            first: items[0],
            count: items.length,
          })),
        };
      })
      .filter((section) => section.issues.length > 0);
  }, [detail.findings, readinessIssues]);

  useEffect(() => {
    if (!selectedFindingId && detail.findings[0]) {
      setSelectedFindingId(detail.findings[0].id);
    }
  }, [detail.findings, selectedFindingId]);

  const filterButtons = useMemo(
    () =>
      [
        ["needs_editing", "Needs review"],
        ["included", "Included"],
        ["excluded", "Excluded"],
        ["ready", "Ready"],
        ["possible_false_positive", "False positives"],
        ["critical", "Critical"],
        ["important", "Important"],
        ["improvement", "Improvement"],
        ["informational", "Informational"],
      ] as Array<[ReportFindingFilter, string]>,
    [],
  );

  const selectFinding = useCallback(
    (findingId: string) => {
      if (findingDraft.dirty) {
        const proceed = window.confirm(
          "You have unsaved finding edits. Change finding and discard those unsaved edits?",
        );
        if (!proceed) return;
        findingDraft.setDirty(false);
      }
      setSelectedFindingId(findingId);
      setFindingDetailOpen(true);
    },
    [findingDraft],
  );

  const closeFindingDetail = useCallback(() => {
    setFindingDetailOpen(false);
  }, []);

  const openActionPlanFinding = useCallback(
    (findingId: string) => {
      setTab("findings");
      setFilter("all");
      setCategory("");
      setSearch("");
      selectFinding(findingId);
    },
    [selectFinding],
  );

  function switchTab(nextTab: ReportTab) {
    if (findingDraft.dirty || reportDraft.dirty || dirtyChildKeys.size > 0) {
      const proceed = window.confirm(
        "You have unsaved report edits. Change tab and discard those unsaved edits?",
      );
      if (!proceed) return;
      findingDraft.setDirty(false);
      reportDraft.setDirty(false);
      setDirtyChildKeys(new Set());
    }
    setTab(nextTab);
  }

  useEffect(() => {
    setFindingSaveState(findingDraft.dirty ? "unsaved" : "saved");
    if (findingDraft.dirty) setFindingSaveError(null);
  }, [findingDraft.dirty, selectedFindingId]);

  useEffect(() => {
    if (!previewStale) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [previewStale]);

  useEffect(() => {
    if (filter !== "needs_editing") return;
    if (counts.needs_editing === 0 && counts.included > 0) {
      setFilter("included");
    }
  }, [counts.included, counts.needs_editing, filter]);

  async function saveReportSummary() {
    await onPatchReport({
      executiveSummary: reportDraft.draft.executive_summary,
      overallSummary: reportDraft.draft.overall_summary,
      mainStrengths: reportDraft.draft.main_strengths,
      mainConcerns: reportDraft.draft.main_concerns,
      recommendedFirstSteps: reportDraft.draft.recommended_first_steps,
      scopeLimitations: reportDraft.draft.scope_limitations,
      noMajorFindingsWaived: reportDraft.draft.no_major_findings_waived,
    });
    reportDraft.setDirty(false);
  }

  async function saveReportSettings() {
    await onPatchReport({
      title: reportDraft.draft.title,
      preparedFor: reportDraft.draft.prepared_for,
      preparedBy: reportDraft.draft.prepared_by,
      coverDate: reportDraft.draft.cover_date,
      reportType: reportDraft.draft.report_type,
      displaySettings: reportDraft.draft.display_settings_json,
    });
    reportDraft.setDirty(false);
  }

  async function saveFindingAndContinue(options?: {
    nextId?: string;
    markReviewed?: boolean;
    findingPatch?: Record<string, unknown>;
  }) {
    if (!findingDraft.draft) return;
    setFindingSaveState("saving");
    setFindingSaveError(null);
    try {
      await onPatchFinding(findingDraft.draft.id, {
        clientPriority: findingDraft.draft.client_priority,
        title: findingDraft.draft.title,
        clientExplanation: findingDraft.draft.client_explanation,
        whyItMatters: findingDraft.draft.why_it_matters,
        recommendedAction: findingDraft.draft.recommended_action,
        affectedUrl: findingDraft.draft.affected_url,
        clientEvidence: findingDraft.draft.client_evidence,
        affectedUrlNote: findingDraft.draft.affected_url_note,
        internalNote: findingDraft.draft.internal_note,
        falsePositiveReason: findingDraft.draft.false_positive_reason,
        reviewNote: findingDraft.draft.review_note,
        estimatedEffort: findingDraft.draft.estimated_effort,
        displayOrder: findingDraft.draft.display_order,
        ...options?.findingPatch,
        ...(options?.markReviewed
          ? { reviewedAt: new Date().toISOString() }
          : {}),
      });
      findingDraft.setDirty(false);
      setFindingSaveState("saved");
      if (options?.nextId) setSelectedFindingId(options.nextId);
      if (options?.nextId) setFindingDetailOpen(true);
    } catch (err) {
      setFindingSaveState("error");
      setFindingSaveError(
        err instanceof Error ? err.message : "Failed to save finding",
      );
      throw err;
    }
  }

  async function runBulk(
    action: string,
    clientPriority?: OperationsReportPriority,
  ) {
    if (selectedIds.size === 0) return;
    const findingIds = Array.from(selectedIds).filter((id) =>
      selectedVisibleIds.has(id),
    );
    if (findingIds.length === 0) return;
    if (
      action === "exclude" &&
      !window.confirm(
        `Exclude ${findingIds.length} selected finding${findingIds.length === 1 ? "" : "s"} from the client report? Technical source records will be preserved.`,
      )
    ) {
      return;
    }
    await onBulkFindings({
      action,
      clientPriority,
      findingIds,
    });
    setSelectedIds(new Set());
  }

  function updateSelectedIds(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateDisplaySetting(key: string, value: boolean | string) {
    reportDraft.updateDraft({
      display_settings_json: {
        ...reportDraft.draft.display_settings_json,
        [key]: value,
      },
    });
  }

  function setChildDirty(key: string, dirty: boolean) {
    setDirtyChildKeys((current) => {
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function openReadinessIssue(issue: OperationsReportReadinessIssue) {
    setTab(issue.section);
    if (issue.findingId) {
      selectFinding(issue.findingId);
      setFilter("all");
      setCategory("");
      setSearch("");
    }
    if (issue.section === "findings") {
      setTab("findings");
      setFilter("needs_editing");
    }
  }

  const currentIncompleteIndex = selectedFinding
    ? incomplete.findIndex((finding) => finding.id === selectedFinding.id)
    : -1;
  const previousIncomplete = incomplete[currentIncompleteIndex - 1];
  const nextIncomplete = incomplete[currentIncompleteIndex + 1];

  function blockReadOnlyEditorChange(event: React.FormEvent<HTMLDivElement>) {
    if (!artifactReadOnly) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".ops-report-filterbar")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      className={`ops-report-workspace${artifactReadOnly ? " ops-report-workspace--read-only" : ""}`}
      aria-readonly={artifactReadOnly}
      onChangeCapture={blockReadOnlyEditorChange}
      onSubmitCapture={(event) => {
        if (artifactReadOnly) event.preventDefault();
      }}
    >
      <section className="ops-report-header">
        <div>
          <div className="ops-eyebrow">Report review</div>
          <h1>{detail.report.title}</h1>
          <p>
            {detail.report.business_name} ·{" "}
            {detail.report.site_display_name ?? detail.report.site_url}
          </p>
          <span className="ops-muted">
            {reportStatusLabel(detail.report.status)} · {includedCount} included
            · {excludedCount} excluded · {falsePositiveCount} false positive ·{" "}
            {readyCount}/{includedCount} ready · last saved{" "}
            {formatOperationsDateTime(detail.report.updated_at)}
          </span>
        </div>
        <div className="ops-inline-actions">
          {!artifactReadOnly && (
            <button
              className="ops-button"
              onClick={() => void saveReportSettings()}
            >
              Save
            </button>
          )}
          <button className="ops-button" onClick={() => switchTab("preview")}>
            Preview
          </button>
          {!artifactReadOnly && editableDraftReport && (
            <button
              className="ops-button"
              disabled={previewStale}
              onClick={() => void onGeneratePdf("draft")}
            >
              Generate draft PDF
            </button>
          )}
          {!artifactReadOnly && (
            <>
              <button
                className="ops-button"
                disabled={
                  pdfBlockingIssues.length > 0 ||
                  previewStale ||
                  !approvalCurrent
                }
                onClick={() => void onGeneratePdf("final")}
              >
                Generate final PDF
              </button>
              <button
                className="ops-button"
                disabled={
                  detail.report.status === "ready_to_send" ||
                  readinessIssues.length > 0 ||
                  previewStale ||
                  !approvalCurrent
                }
                onClick={() => void onMarkReady()}
              >
                Mark ready
              </button>
              <button
                className="ops-button"
                onClick={() => void onRecordSent()}
              >
                Record sent
              </button>
              <button className="ops-button" onClick={onCreateQuote}>
                Create quote
              </button>
            </>
          )}
        </div>
      </section>
      {actionError && <div className="ops-error">{actionError}</div>}
      {pdfUnavailableReason && (
        <div className="ops-warning">
          {pdfUnavailableReason}
          {pdfBlockingIssues[0] && !previewStale
            ? ` ${pdfBlockingIssues[0].message}`
            : ""}
        </div>
      )}
      {(clientOutputFrozen || historicalReport) && (
        <div className="ops-warning">
          This report is frozen because it has been sent to the client.
          {historicalReport && !readOnly && (
            <button
              className="ops-button ops-button--primary"
              type="button"
              onClick={() => void onCreateRevision()}
            >
              Create revised report
            </button>
          )}
        </div>
      )}
      {detail.revisionHistory && detail.revisionHistory.length > 1 && (
        <section className="ops-panel">
          <h2>Version history</h2>
          {detail.report.supersedes_report_id && (
            <p className="ops-muted">
              Revision of Version{" "}
              {detail.revisionHistory.find(
                (item) => item.id === detail.report.supersedes_report_id,
              )?.version_number ?? detail.report.version_number - 1}
            </p>
          )}
          {detail.revisionHistory.some(
            (item) => item.supersedes_report_id === detail.report.id,
          ) && (
            <p className="ops-muted">Superseded by a newer report version.</p>
          )}
          <div className="ops-list">
            {detail.revisionHistory.map((revision) => (
              <div key={revision.id} className="ops-list-card">
                <strong>Version {revision.version_number}</strong>
                <span>{revision.title}</span>
                <small>
                  {reportStatusLabel(revision.status)}
                  {revision.sent_at
                    ? ` · sent ${formatOperationsDateTime(revision.sent_at)}`
                    : ""}
                </small>
                {revision.id !== detail.report.id && (
                  <a
                    className="ops-button"
                    href={`/operations/reports/${revision.id}`}
                  >
                    Open version
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {readinessIssues.length > 0 && (
        <section className="ops-readiness-summary">
          <div className="ops-readiness-summary__header">
            <strong>
              Report readiness: {counts.needs_editing} finding
              {counts.needs_editing === 1 ? "" : "s"} need review
            </strong>
            <span>
              {readinessIssues.length} grouped issue
              {readinessIssues.length === 1 ? "" : "s"}
            </span>
          </div>
          {readinessSections.map((section) => (
            <details key={section.section}>
              <summary>
                <strong>{section.label}</strong>
                <span>
                  {section.issues.length} issue
                  {section.issues.length === 1 ? "" : "s"}
                </span>
              </summary>
              <div className="ops-readiness-summary__body">
                <p>{section.grouped[0]?.first.message ?? "Review required"}</p>
                <button
                  className="ops-button"
                  type="button"
                  onClick={() =>
                    section.grouped[0] &&
                    openReadinessIssue(section.grouped[0].first)
                  }
                >
                  Resolve
                </button>
              </div>
              {section.section === "findings" && section.grouped.length > 0 && (
                <div className="ops-readiness-summary__examples">
                  {section.grouped.slice(0, 3).map((group) => {
                    const finding = group.first.findingId
                      ? detail.findings.find(
                          (item) => item.id === group.first.findingId,
                        )
                      : null;
                    const label =
                      finding && finding.affected_page_count > 1
                        ? `${finding.title} - ${finding.affected_page_count} affected pages`
                        : group.first.message;
                    return (
                      <button
                        key={`${section.section}-${group.key}`}
                        type="button"
                        onClick={() => openReadinessIssue(group.first)}
                      >
                        <span>
                          {label}
                          {group.count > 1 ? ` (${group.count} checks)` : ""}
                        </span>
                        <strong>Open</strong>
                      </button>
                    );
                  })}
                </div>
              )}
            </details>
          ))}
        </section>
      )}
      <nav className="ops-report-tabs" aria-label="Report sections">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "active" : ""}
            onClick={() => switchTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="ops-two-column">
          <div className="ops-panel">
            <h2>Overview</h2>
            <dl className="ops-definition-grid">
              <dt>Prepared for</dt>
              <dd>{detail.report.prepared_for ?? "-"}</dd>
              <dt>Cover date</dt>
              <dd>{formatOperationsDate(detail.report.cover_date)}</dd>
              <dt>Included</dt>
              <dd>{includedCount}</dd>
              <dt>Raw occurrences</dt>
              <dd>{rawOccurrenceCount}</dd>
              <dt>Excluded</dt>
              <dd>{excludedCount}</dd>
              <dt>False positive</dt>
              <dd>{falsePositiveCount}</dd>
              <dt>Sent</dt>
              <dd>{formatOperationsDateTime(detail.report.sent_at)}</dd>
              <dt>Frozen</dt>
              <dd>{formatOperationsDateTime(detail.report.frozen_at)}</dd>
            </dl>
            <div className="ops-inline-actions">
              <a
                className="ops-button"
                href={`/report?scanRunId=${detail.report.scan_run_id}`}
              >
                Technical report
              </a>
              <button
                className="ops-button"
                onClick={() => void onCreateRetest()}
              >
                Create re-test
              </button>
              <button className="ops-button" onClick={() => void onArchive()}>
                Archive
              </button>
            </div>
          </div>
          <div className="ops-panel">
            <h2>Readiness</h2>
            <div className="ops-card-grid">
              <div className="ops-summary-card">
                <span>Ready</span>
                <strong>{readyCount}</strong>
                <small>Included findings ready</small>
              </div>
              <div className="ops-summary-card">
                <span>Incomplete</span>
                <strong>{incomplete.length}</strong>
                <small>Need review</small>
              </div>
              <div className="ops-summary-card">
                <span>PDF</span>
                <strong>
                  {detail.report.last_pdf_generated_at ? "Yes" : "No"}
                </strong>
                <small>{clientReportFilename(preview)}</small>
              </div>
              <div className="ops-summary-card">
                <span>Size</span>
                <strong>{estimatedMainPages}p</strong>
                <small>
                  {includedCount} grouped, appendix{" "}
                  {reportDraft.draft.display_settings_json
                    ?.displayTechnicalAppendix
                    ? "on"
                    : "off"}
                </small>
              </div>
            </div>
            <div className="ops-card-grid">
              {priorityCounts.map((priority) => (
                <div key={priority.value} className="ops-summary-card">
                  <span>{priority.label}</span>
                  <strong>{priority.count}</strong>
                  <small>Included findings</small>
                </div>
              ))}
            </div>
          </div>
          <div className="ops-panel">
            <h2>Client grouping</h2>
            <p className="ops-muted">
              {rawOccurrenceCount} raw technical occurrence
              {rawOccurrenceCount === 1 ? "" : "s"} represented as{" "}
              {detail.findings.length} client finding
              {detail.findings.length === 1 ? "" : "s"}.
            </p>
            {detail.findings.length > 15 && (
              <div className="ops-warning">
                This report has {detail.findings.length} grouped client findings
                and may be difficult for a client to review.
              </div>
            )}
            <div className="ops-inline-actions">
              <button
                className="ops-button"
                onClick={() => void onPreviewRegroup()}
                disabled={clientOutputFrozen}
              >
                Regroup client findings
              </button>
              <button
                className="ops-button"
                onClick={() => setFilter("improvement")}
              >
                Review improvements
              </button>
              <button
                className="ops-button"
                onClick={() => void runBulk("exclude")}
                disabled={selectedIds.size === 0}
              >
                Exclude selected
              </button>
            </div>
            {regroupPreview && (
              <div className="ops-regroup-preview">
                <dl className="ops-definition-grid">
                  <dt>Current findings</dt>
                  <dd>{regroupPreview.currentFindingCount}</dd>
                  <dt>Grouped findings</dt>
                  <dd>{regroupPreview.proposedGroupedCount}</dd>
                  <dt>Raw issues</dt>
                  <dd>{regroupPreview.rawSourceIssueCount}</dd>
                  <dt>Occurrences</dt>
                  <dd>{regroupPreview.rawOccurrenceCount}</dd>
                </dl>
                <div className="ops-report-findings-list">
                  {regroupPreview.groups.map((group) => (
                    <div
                      key={group.groupKey}
                      className="ops-report-finding-row"
                    >
                      <span>
                        <strong>{group.title}</strong>
                        <small>
                          {group.sourceIssueCount} source issue
                          {group.sourceIssueCount === 1 ? "" : "s"} ·{" "}
                          {group.occurrenceCount} occurrence
                          {group.occurrenceCount === 1 ? "" : "s"}
                        </small>
                      </span>
                      <small>{group.groupLabel}</small>
                      <small>{group.affectedPageCount} pages</small>
                      <small>{group.affectedResourceCount} resources</small>
                      <small>
                        {group.mergeReviewFindingIds.length > 0
                          ? "Merge review"
                          : group.preservedFindingIds.length > 0
                            ? "Preserves edits"
                            : "Default wording"}
                      </small>
                    </div>
                  ))}
                </div>
                <button
                  className="ops-button ops-button--primary"
                  onClick={() =>
                    void onApplyRegroup(regroupPreview.previewHash)
                  }
                  disabled={Boolean(regroupPreview.blockedReason)}
                >
                  Apply grouped findings
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "summary" && (
        <section className="ops-panel ops-form">
          <h2>Executive summary</h2>
          <label>
            Overall website condition
            <textarea
              value={reportDraft.draft.executive_summary ?? ""}
              onChange={(event) =>
                reportDraft.updateDraft({
                  executive_summary: event.target.value,
                })
              }
            />
          </label>
          <label>
            Short introduction
            <textarea
              value={reportDraft.draft.overall_summary ?? ""}
              onChange={(event) =>
                reportDraft.updateDraft({ overall_summary: event.target.value })
              }
            />
          </label>
          <div className="ops-form-grid">
            <label>
              Main strengths
              <textarea
                value={reportDraft.draft.main_strengths ?? ""}
                onChange={(event) =>
                  reportDraft.updateDraft({
                    main_strengths: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Main concerns
              <textarea
                value={reportDraft.draft.main_concerns ?? ""}
                onChange={(event) =>
                  reportDraft.updateDraft({ main_concerns: event.target.value })
                }
              />
            </label>
          </div>
          <label>
            Immediate recommended actions
            <textarea
              value={reportDraft.draft.recommended_first_steps ?? ""}
              onChange={(event) =>
                reportDraft.updateDraft({
                  recommended_first_steps: event.target.value,
                })
              }
            />
          </label>
          <label>
            Scope and limitations
            <textarea
              value={reportDraft.draft.scope_limitations ?? ""}
              onChange={(event) =>
                reportDraft.updateDraft({
                  scope_limitations: event.target.value,
                })
              }
            />
          </label>
          <label className="ops-checkbox">
            <input
              type="checkbox"
              checked={reportDraft.draft.no_major_findings_waived}
              onChange={(event) =>
                reportDraft.updateDraft({
                  no_major_findings_waived: event.target.checked,
                })
              }
            />
            Explicitly allow a no-major-findings report
          </label>
          <button
            className="ops-button ops-button--primary"
            onClick={() => void saveReportSummary()}
          >
            Save summary
          </button>
        </section>
      )}

      {tab === "findings" && (
        <section
          className={`ops-report-findings-layout ${findingDetailOpen ? "detail-open" : ""}`}
        >
          <div className="ops-panel ops-report-review-queue">
            <div className="ops-panel__header">
              <div>
                <h2>Findings review</h2>
                <span className="ops-muted">
                  {reviewedIncludedCount} of {includedCount} included findings
                  reviewed
                </span>
              </div>
              <span className="ops-badge">{filtered.length} shown</span>
            </div>
            <div className="ops-report-progress">
              <div>
                <strong>{remainingIncludedCount}</strong>
                <small>Remaining</small>
              </div>
              <div>
                <strong>{includedCount}</strong>
                <small>Included</small>
              </div>
              <div>
                <strong>{excludedCount}</strong>
                <small>Excluded</small>
              </div>
              <div>
                <strong>{falsePositiveCount}</strong>
                <small>False positive</small>
              </div>
            </div>
            <div className="ops-filterbar ops-report-filterbar">
              <input
                placeholder="Search title or URL"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">All categories</option>
                {categories.map(([item, count]) => (
                  <option key={item} value={item}>
                    {item} ({count})
                  </option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as ReportFindingSort)
                }
                aria-label="Sort findings"
              >
                <option value="review_state">Review state</option>
                <option value="priority">Priority</option>
                <option value="display_order">Display order</option>
                <option value="occurrence_count">Occurrence count</option>
                <option value="affected_page_count">Affected pages</option>
                <option value="title">Title</option>
              </select>
            </div>
            <div className="ops-segmented">
              {filterButtons.map(([key, label]) => (
                <button
                  key={key}
                  className={filter === key ? "active" : ""}
                  onClick={() => setFilter(key)}
                >
                  {label} ({counts[key]})
                </button>
              ))}
            </div>
            <div className="ops-report-bulkbar">
              <span>
                {selectedVisibleCount} selected
                {selectedIds.size > selectedVisibleCount
                  ? ` (${selectedIds.size - selectedVisibleCount} hidden)`
                  : ""}
              </span>
              <button
                className="ops-button"
                onClick={() =>
                  setSelectedIds(new Set(filtered.map((finding) => finding.id)))
                }
              >
                Select visible
              </button>
              <button
                className="ops-button"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
              <button
                className="ops-button"
                disabled={selectedVisibleCount === 0}
                onClick={() => void runBulk("include")}
              >
                Include selected
              </button>
              <button
                className="ops-button"
                disabled={selectedVisibleCount === 0}
                onClick={() => void runBulk("exclude")}
              >
                Exclude selected
              </button>
              <button
                className="ops-button"
                disabled={selectedVisibleCount === 0}
                onClick={() => void runBulk("mark_reviewed")}
              >
                Mark reviewed
              </button>
              <button
                className="ops-button"
                disabled={selectedVisibleCount === 0}
                onClick={() => void runBulk("restore")}
              >
                Restore selected
              </button>
              <select
                disabled={selectedVisibleCount === 0}
                onChange={(event) => {
                  const value = event.target.value as OperationsReportPriority;
                  if (value) void runBulk("change_priority", value);
                  event.target.value = "";
                }}
              >
                <option value="">Change priority</option>
                {priorityOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ops-report-findings-list">
              {filtered.map((finding) => {
                const missing = missingFindingReadinessFields(finding);
                const included = findingIsIncluded(finding);
                const state = reviewStateLabel(finding);
                const example = firstExampleText(finding);
                return (
                  <div
                    key={finding.id}
                    role="button"
                    tabIndex={0}
                    className={`ops-report-finding-row ${selectedFindingId === finding.id ? "active" : ""} state-${state.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => selectFinding(finding.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectFinding(finding.id);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${finding.title}`}
                      checked={selectedIds.has(finding.id)}
                      onChange={(event) => {
                        event.stopPropagation();
                        updateSelectedIds(finding.id, event.target.checked);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span>
                      <strong>{finding.title}</strong>
                      <small>
                        {included ? "Included" : "Not in client report"} ·{" "}
                        {priorityLabel(finding.client_priority)} ·{" "}
                        {finding.category}
                      </small>
                      {example && <small>{example}</small>}
                    </span>
                    <small>{finding.occurrence_count} occ.</small>
                    <small>{finding.affected_page_count} pages</small>
                    <small>{finding.group_label ?? "Grouped"}</small>
                    <small className="ops-status-pill">{state}</small>
                    <small>
                      {missing.length > 0
                        ? missing.slice(0, 2).join(", ")
                        : (finding.recommended_action ?? "No action yet")}
                    </small>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="ops-empty-card">
                  No findings match the current filters.
                </div>
              )}
            </div>
          </div>
          {findingDraft.draft &&
            (() => {
              const draft = findingDraft.draft;
              return (
                <FindingEditor
                  finding={draft}
                  sources={detail.findingSources.filter(
                    (source) => source.report_finding_id === draft.id,
                  )}
                  previousIncomplete={previousIncomplete}
                  nextIncomplete={nextIncomplete}
                  allIncompleteReviewed={incomplete.length === 0}
                  dirty={findingDraft.dirty}
                  saveState={findingSaveState}
                  saveError={findingSaveError}
                  trapFocus={findingDetailOpen}
                  onChange={findingDraft.updateDraft}
                  onSave={saveFindingAndContinue}
                  onBack={closeFindingDetail}
                />
              );
            })()}
        </section>
      )}

      {tab === "action_plan" && (
        <section className="ops-two-column">
          <ReportActionPlan
            items={visibleActionPlanItems}
            findings={detail.findings}
            onPatch={onPatchActionPlanItem}
            onDirty={setChildDirty}
            onOpenFinding={openActionPlanFinding}
          />
          <ReportPositiveObservations
            observations={detail.positiveObservations}
            onPatch={onPatchObservation}
            onDirty={setChildDirty}
          />
        </section>
      )}

      {tab === "preview" && (
        <section className="ops-panel">
          <div className="ops-panel__header">
            <h2>Client preview</h2>
            <div className="ops-inline-actions">
              <span className="ops-muted">{clientReportFilename(preview)}</span>
              <button
                className={`ops-button ${previewMode === "desktop" ? "ops-button--primary" : ""}`}
                onClick={() => setPreviewMode("desktop")}
              >
                Desktop
              </button>
              <button
                className={`ops-button ${previewMode === "a4" ? "ops-button--primary" : ""}`}
                onClick={() => setPreviewMode("a4")}
              >
                A4
              </button>
            </div>
          </div>
          <section className="ops-empty-card ops-report-approval">
            <h3>Report approval</h3>
            {approvalCurrent ? (
              <p>
                <strong>Approved</strong>
                {detail.report.approved_by_email
                  ? ` by ${detail.report.approved_by_email}`
                  : ""}
                {detail.report.approved_at
                  ? ` · ${formatOperationsDateTime(detail.report.approved_at)}`
                  : ""}
              </p>
            ) : detail.report.approved_at ? (
              <>
                <p>
                  <strong>Changes made since approval — review again</strong>
                </p>
                <p className="ops-muted">
                  Client-visible content changed after approval. Review this
                  preview and approve the current version again.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Not approved</strong>
                </p>
                <p className="ops-muted">
                  Review this client preview, then approve this exact report
                  version before generating the final PDF.
                </p>
              </>
            )}
            {!artifactReadOnly && !previewStale && !approvalCurrent && (
              <button
                className="ops-button ops-button--primary"
                disabled={pdfBlockingIssues.length > 0}
                onClick={() => void onApprove()}
              >
                Approve report for final PDF
              </button>
            )}
            {!approvalCurrent && pdfBlockingIssues.length > 0 && (
              <small className="ops-muted">
                Complete the remaining report review items before approval.
              </small>
            )}
          </section>
          <ReportClientPreview
            payload={preview}
            stale={previewStale}
            mode={previewMode}
          />
        </section>
      )}

      {tab === "settings" && (
        <section className="ops-panel ops-form">
          <h2>Report settings</h2>
          <div className="ops-form-grid">
            <label>
              Report title
              <input
                value={reportDraft.draft.title}
                onChange={(event) =>
                  reportDraft.updateDraft({ title: event.target.value })
                }
              />
            </label>
            <label>
              Prepared for
              <input
                value={reportDraft.draft.prepared_for ?? ""}
                onChange={(event) =>
                  reportDraft.updateDraft({ prepared_for: event.target.value })
                }
              />
            </label>
            <label>
              Prepared by
              <input
                value={reportDraft.draft.prepared_by ?? ""}
                onChange={(event) =>
                  reportDraft.updateDraft({ prepared_by: event.target.value })
                }
              />
            </label>
            <label>
              Cover date
              <input
                type="date"
                value={reportDraft.draft.cover_date?.slice(0, 10) ?? ""}
                onChange={(event) =>
                  reportDraft.updateDraft({ cover_date: event.target.value })
                }
              />
            </label>
          </div>
          <div className="ops-card-grid">
            {(
              [
                ["displayLogo", "Display Scanlark branding"],
                ["displayContactDetails", "Display contact details"],
                ["displayWebsiteHealthScore", "Display reviewed score"],
                ["displayPositiveObservations", "Display positives"],
                ["displayMethodologyLimitations", "Display methodology"],
                ["displayTechnicalAppendix", "Display technical appendix"],
                ["displayNextSteps", "Display next steps"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="ops-checkbox ops-empty-card">
                <input
                  type="checkbox"
                  checked={
                    reportDraft.draft.display_settings_json[key] !== false
                  }
                  onChange={(event) =>
                    updateDisplaySetting(key, event.target.checked)
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <label>
            Footer text
            <input
              value={String(
                reportDraft.draft.display_settings_json.footerText ?? "",
              )}
              onChange={(event) =>
                updateDisplaySetting("footerText", event.target.value)
              }
            />
          </label>
          <label>
            Confidential/client-use notice
            <input
              value={String(
                reportDraft.draft.display_settings_json.confidentialNotice ??
                  "",
              )}
              onChange={(event) =>
                updateDisplaySetting("confidentialNotice", event.target.value)
              }
            />
          </label>
          <button
            className="ops-button ops-button--primary"
            onClick={() => void saveReportSettings()}
          >
            Save settings
          </button>
        </section>
      )}

      {tab === "activity" && (
        <section className="ops-panel">
          <h2>Activity</h2>
          <div className="ops-timeline">
            {detail.activity.map((item) => (
              <div key={item.id} className="ops-note">
                <small>
                  {formatOperationsDateTime(item.created_at)} ·{" "}
                  {item.admin_email}
                </small>
                <p>{item.action}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FindingEditor({
  finding,
  sources,
  previousIncomplete,
  nextIncomplete,
  allIncompleteReviewed,
  dirty,
  saveState,
  saveError,
  trapFocus,
  onChange,
  onSave,
  onBack,
}: {
  finding: OperationsReportFinding;
  sources: OperationsReportFindingSource[];
  previousIncomplete?: OperationsReportFinding;
  nextIncomplete?: OperationsReportFinding;
  allIncompleteReviewed: boolean;
  dirty: boolean;
  saveState: "saved" | "saving" | "unsaved" | "error";
  saveError: string | null;
  trapFocus: boolean;
  onChange: (patch: Partial<OperationsReportFinding>) => void;
  onSave: (options?: {
    nextId?: string;
    markReviewed?: boolean;
    findingPatch?: Record<string, unknown>;
  }) => Promise<void>;
  onBack: () => void;
}) {
  const editorRef = useRef<HTMLElement | null>(null);
  const missing = missingFindingReadinessFields(finding);
  const reviewedNextId = nextIncomplete?.id;
  const saveStateLabel =
    saveState === "saving"
      ? "Saving"
      : saveState === "error"
        ? "Error"
        : dirty
          ? "Unsaved"
          : "Saved";

  const appendClientEvidence = (text: string) => {
    const current = finding.client_evidence?.trim();
    onChange({
      client_evidence: current ? `${current}\n${text}` : text,
    });
  };

  const saveWithFindingPatch = async (input: Record<string, unknown>) => {
    await onSave({ findingPatch: input });
  };

  const exampleText = (
    example: OperationsReportFinding["representative_examples_json"][number],
  ) =>
    [
      example.affectedPageUrl ? `Page: ${example.affectedPageUrl}` : null,
      example.affectedResourceUrl
        ? `Resource: ${example.affectedResourceUrl}`
        : null,
      example.result ? `Result: ${example.result}` : null,
      example.note,
    ]
      .filter(Boolean)
      .join(" - ");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isEditing =
        tagName === "input" || tagName === "textarea" || tagName === "select";
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void onSave({ nextId: reviewedNextId, markReviewed: true });
        return;
      }
      if (isEditing) return;
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        void saveWithFindingPatch({ isIncluded: false });
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        void onSave({ markReviewed: true });
      } else if (
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "j"
      ) {
        event.preventDefault();
        if (nextIncomplete) void onSave({ nextId: nextIncomplete.id });
      } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (previousIncomplete) {
          void onSave({ nextId: previousIncomplete.id });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [finding.id, nextIncomplete, onSave, previousIncomplete, reviewedNextId]);

  useEffect(() => {
    if (!trapFocus || !window.matchMedia("(max-width: 980px)").matches) {
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const selector =
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(
      editor.querySelectorAll<HTMLElement>(selector),
    );
    focusable[0]?.focus();
    const handleTrap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onBack();
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    editor.addEventListener("keydown", handleTrap);
    return () => editor.removeEventListener("keydown", handleTrap);
  }, [finding.id, onBack, trapFocus]);

  return (
    <aside
      ref={editorRef}
      className="ops-panel ops-report-finding-editor ops-form"
    >
      <div className="ops-report-editor-toolbar">
        <button className="ops-button ops-report-back" onClick={onBack}>
          Back to findings
        </button>
        <button
          className="ops-button"
          disabled={!previousIncomplete || saveState === "saving"}
          onClick={() =>
            previousIncomplete && void onSave({ nextId: previousIncomplete.id })
          }
        >
          Previous incomplete
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving" || finding.is_included}
          onClick={() =>
            void saveWithFindingPatch({
              isIncluded: true,
              isFalsePositive: false,
            })
          }
        >
          Restore to report
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving" || !finding.is_included}
          onClick={() =>
            window.confirm(
              "Exclude this finding from the client report? Technical source issues and evidence will be preserved, and linked action-plan output for this finding will be hidden from the client report.",
            ) && void saveWithFindingPatch({ isIncluded: false })
          }
        >
          Exclude from client report
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving"}
          onClick={() =>
            window.confirm(
              "Mark this finding as a false positive for this client report? Technical source records will be preserved.",
            ) &&
            void saveWithFindingPatch({
              isIncluded: false,
              isFalsePositive: true,
            })
          }
        >
          Mark false positive
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving"}
          onClick={() => void onSave()}
        >
          Save
        </button>
        <button
          className="ops-button ops-button--primary"
          disabled={saveState === "saving" || !reviewedNextId}
          onClick={() => void onSave({ nextId: reviewedNextId })}
        >
          Save and next
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving"}
          onClick={() => void onSave({ markReviewed: true })}
        >
          Save and mark reviewed
        </button>
        <button
          className="ops-button"
          disabled={saveState === "saving" || !nextIncomplete}
          onClick={() =>
            nextIncomplete &&
            void onSave({ nextId: nextIncomplete.id, markReviewed: true })
          }
        >
          Save, mark reviewed and next
        </button>
        <button
          className="ops-button"
          disabled={!nextIncomplete}
          onClick={() =>
            nextIncomplete && void onSave({ nextId: nextIncomplete.id })
          }
        >
          Skip for now
        </button>
        <span className={`ops-save-state state-${saveState}`}>
          {saveStateLabel}
        </span>
      </div>

      <div className="ops-panel__header">
        <div>
          <h2>{finding.title || "Untitled finding"}</h2>
          <span className="ops-muted">
            {reviewStateLabel(finding)} ·{" "}
            {priorityLabel(finding.client_priority)}
          </span>
        </div>
        <span className={missing.length ? "ops-muted" : "ops-badge"}>
          {missing.length ? `${missing.length} incomplete` : "Ready"}
        </span>
      </div>
      {allIncompleteReviewed && (
        <div className="ops-success">
          All included findings have been reviewed.
        </div>
      )}
      {missing.length > 0 && (
        <div className="ops-warning">Missing: {missing.join(", ")}</div>
      )}
      {saveError && <div className="ops-error">{saveError}</div>}

      <section>
        <h3>Client-facing content</h3>
        <div className="ops-form-grid">
          <label className="ops-checkbox">
            <input
              type="checkbox"
              checked={finding.is_included && !finding.is_false_positive}
              onChange={(event) =>
                void saveWithFindingPatch({
                  isIncluded: event.target.checked,
                  isFalsePositive: false,
                })
              }
            />
            Included in client report
          </label>
          <label>
            Review state
            <input value={reviewStateLabel(finding)} readOnly />
          </label>
          <label>
            Client priority
            <select
              value={finding.client_priority}
              onChange={(event) =>
                onChange({
                  client_priority: event.target
                    .value as OperationsReportPriority,
                })
              }
            >
              {priorityOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display order
            <input
              type="number"
              min="0"
              value={finding.display_order}
              onChange={(event) =>
                onChange({ display_order: Number(event.target.value) || 0 })
              }
            />
          </label>
        </div>
        <label>
          Client-facing title
          <input
            value={finding.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>
        <label>
          What was found
          <textarea
            value={finding.client_explanation ?? ""}
            onChange={(event) =>
              onChange({ client_explanation: event.target.value })
            }
          />
        </label>
        <label>
          Why it matters
          <textarea
            value={finding.why_it_matters ?? ""}
            onChange={(event) =>
              onChange({ why_it_matters: event.target.value })
            }
          />
        </label>
        <label>
          Recommended action
          <textarea
            value={finding.recommended_action ?? ""}
            onChange={(event) =>
              onChange({ recommended_action: event.target.value })
            }
          />
        </label>
        <div className="ops-form-grid">
          <label>
            Affected page
            <input
              value={finding.affected_url ?? ""}
              onChange={(event) =>
                onChange({ affected_url: event.target.value })
              }
            />
          </label>
          <label>
            No-URL reason or affected URL note
            <input
              value={finding.affected_url_note ?? ""}
              onChange={(event) =>
                onChange({ affected_url_note: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Evidence shown to client
          <textarea
            value={finding.client_evidence ?? ""}
            onChange={(event) =>
              onChange({ client_evidence: event.target.value })
            }
          />
        </label>
        {finding.representative_examples_json.length > 0 && (
          <div className="ops-report-example-list">
            <strong>Representative examples</strong>
            {finding.representative_examples_json
              .slice(0, 5)
              .map((example, index) => {
                const text = exampleText(example);
                return (
                  <div key={`${finding.id}-example-${index}`}>
                    <span>{text || "Example"}</span>
                    <button
                      className="ops-button"
                      type="button"
                      onClick={() => text && appendClientEvidence(text)}
                    >
                      Use in client evidence
                    </button>
                  </div>
                );
              })}
            {finding.affected_page_count > 5 && (
              <small>
                {finding.affected_page_count} pages affected -{" "}
                {Math.min(5, finding.representative_examples_json.length)}{" "}
                examples shown
              </small>
            )}
          </div>
        )}
        <label>
          Estimated effort
          <input
            value={finding.estimated_effort ?? ""}
            onChange={(event) =>
              onChange({ estimated_effort: event.target.value })
            }
          />
        </label>
      </section>

      <details className="ops-report-collapsible">
        <summary>Technical evidence</summary>
        <dl className="ops-definition-grid">
          <dt>Source</dt>
          <dd>{finding.source_type}</dd>
          <dt>Original severity</dt>
          <dd>{finding.original_severity}</dd>
          <dt>Category</dt>
          <dd>{finding.category}</dd>
          <dt>Group</dt>
          <dd>{finding.group_label ?? finding.group_key ?? "Ungrouped"}</dd>
          <dt>Occurrences</dt>
          <dd>{finding.occurrence_count}</dd>
          <dt>Affected pages</dt>
          <dd>{finding.affected_page_count}</dd>
          <dt>Affected resources</dt>
          <dd>{finding.affected_resource_count}</dd>
        </dl>
        {finding.technical_summary && <p>{finding.technical_summary}</p>}
        {finding.requires_merge_review && (
          <div className="ops-warning">
            Merged administrator wording needs review before this finding is
            ready.
          </div>
        )}
        <div className="ops-table-wrap">
          <table className="ops-evidence-table">
            <thead>
              <tr>
                <th>Affected page</th>
                <th>Resource</th>
                <th>Result</th>
                <th>Client reviewed</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>{source.affected_page_url ?? "-"}</td>
                  <td>{source.affected_resource_url ?? "-"}</td>
                  <td>{source.outcome_key ?? source.source_kind}</td>
                  <td>{source.reviewed_for_client ? "Yes" : "No"}</td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={4}>No normalized source records yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="ops-report-collapsible">
        <summary>Internal only - never included in the client report</summary>
        <label>
          Internal note
          <textarea
            value={finding.internal_note ?? ""}
            onChange={(event) =>
              onChange({ internal_note: event.target.value })
            }
          />
        </label>
        <label>
          False-positive reasoning
          <textarea
            value={finding.false_positive_reason ?? ""}
            onChange={(event) =>
              onChange({ false_positive_reason: event.target.value })
            }
          />
        </label>
        <label>
          Review notes
          <textarea
            value={finding.review_note ?? ""}
            onChange={(event) => onChange({ review_note: event.target.value })}
          />
        </label>
      </details>

      <p className="ops-muted">
        Shortcuts: Ctrl/Cmd + Enter saves and opens the next incomplete finding.
        E excludes. R marks reviewed. J/K or arrow keys move between incomplete
        findings when focus is outside a form field.
      </p>
    </aside>
  );
}

function ReportActionPlan({
  items,
  findings,
  onPatch,
  onDirty,
  onOpenFinding,
}: {
  items: OperationsReportActionPlanItem[];
  findings: OperationsReportFinding[];
  onPatch: (itemId: string, input: Record<string, unknown>) => Promise<void>;
  onDirty: (key: string, dirty: boolean) => void;
  onOpenFinding: (findingId: string) => void;
}) {
  const groups: OperationsReportActionPlanGroup[] = [
    "address_now",
    "address_soon",
    "consider_later",
  ];
  return (
    <div className="ops-panel">
      <h2>Action plan</h2>
      {groups.map((group) => (
        <section key={group} className="ops-list">
          <h3>{actionPlanLabel(group)}</h3>
          {items
            .filter((item) => item.group_key === group)
            .map((item) => (
              <ActionPlanItemEditor
                key={item.id}
                item={item}
                finding={
                  item.report_finding_id
                    ? (findings.find(
                        (finding) => finding.id === item.report_finding_id,
                      ) ?? null)
                    : null
                }
                groups={groups}
                onPatch={onPatch}
                onDirty={onDirty}
                onOpenFinding={onOpenFinding}
              />
            ))}
        </section>
      ))}
    </div>
  );
}

function ActionPlanItemEditor({
  item,
  finding,
  groups,
  onPatch,
  onDirty,
  onOpenFinding,
}: {
  item: OperationsReportActionPlanItem;
  finding: OperationsReportFinding | null;
  groups: OperationsReportActionPlanGroup[];
  onPatch: (itemId: string, input: Record<string, unknown>) => Promise<void>;
  onDirty: (key: string, dirty: boolean) => void;
  onOpenFinding: (findingId: string) => void;
}) {
  const draft = useOperationsReportDraft(item);
  const dirtyKey = `action-${item.id}`;

  useEffect(() => {
    onDirty(dirtyKey, false);
  }, [dirtyKey, item.updated_at]);

  function update(patch: Partial<OperationsReportActionPlanItem>) {
    draft.updateDraft(patch);
    onDirty(dirtyKey, true);
  }

  async function save() {
    await onPatch(item.id, {
      title: draft.draft.title,
      summary: draft.draft.summary,
      groupKey: draft.draft.group_key,
      isIncluded: draft.draft.is_included,
      ...(finding ? {} : { reviewedAt: draft.draft.reviewed_at }),
    });
    draft.setDirty(false);
    onDirty(dirtyKey, false);
  }

  return (
    <article className="ops-list-card ops-form">
      {finding && (
        <div className="ops-report-action-context">
          <div>
            <small>Linked finding</small>
            <strong>{finding.title}</strong>
          </div>
          <span className="ops-status-pill">
            {priorityLabel(finding.client_priority)}
          </span>
          <p>
            {finding.affected_url ??
              finding.affected_url_note ??
              "No affected URL recorded"}
          </p>
          <small>
            {finding.occurrence_count} occurrences ·{" "}
            {finding.affected_page_count} pages ·{" "}
            {finding.affected_resource_count} resources
          </small>
          {finding.representative_examples_json.length > 0 && (
            <ul>
              {finding.representative_examples_json
                .slice(0, 3)
                .map((example, index) => (
                  <li key={`${finding.id}-example-${index}`}>
                    {exampleTextForAction(finding, index)}
                  </li>
                ))}
            </ul>
          )}
          <button
            className="ops-button"
            onClick={() => onOpenFinding(finding.id)}
          >
            View finding
          </button>
        </div>
      )}
      <div className="ops-inline-actions">
        <label className="ops-checkbox">
          <input
            type="checkbox"
            checked={draft.draft.is_included}
            onChange={(event) => update({ is_included: event.target.checked })}
          />
          Include
        </label>
        {!finding && (
          <label className="ops-checkbox">
            <input
              type="checkbox"
              checked={Boolean(draft.draft.reviewed_at)}
              onChange={(event) =>
                update({
                  reviewed_at: event.target.checked
                    ? new Date().toISOString()
                    : null,
                })
              }
            />
            Reviewed
          </label>
        )}
      </div>
      <label>
        Action
        <input
          value={draft.draft.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label>
        Short client summary
        <textarea
          value={draft.draft.summary ?? ""}
          onChange={(event) => update({ summary: event.target.value })}
        />
      </label>
      <div className="ops-form-grid">
        <label>
          Timing
          <select
            value={draft.draft.group_key}
            onChange={(event) =>
              update({
                group_key: event.target
                  .value as OperationsReportActionPlanGroup,
              })
            }
          >
            {groups.map((option) => (
              <option key={option} value={option}>
                {actionPlanLabel(option)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        className="ops-button ops-button--primary"
        disabled={!draft.dirty}
        onClick={() => void save()}
      >
        Save action
      </button>
    </article>
  );
}

function ReportPositiveObservations({
  observations,
  onPatch,
  onDirty,
}: {
  observations: OperationsReportPositiveObservation[];
  onPatch: (
    observationId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onDirty: (key: string, dirty: boolean) => void;
}) {
  return (
    <div className="ops-panel">
      <h2>Positive observations</h2>
      <div className="ops-list">
        {observations.length === 0 && (
          <div className="ops-empty-card">
            No scan-supported positive observations are available.
          </div>
        )}
        {observations.map((item) => (
          <PositiveObservationEditor
            key={item.id}
            item={item}
            onPatch={onPatch}
            onDirty={onDirty}
          />
        ))}
      </div>
    </div>
  );
}

function PositiveObservationEditor({
  item,
  onPatch,
  onDirty,
}: {
  item: OperationsReportPositiveObservation;
  onPatch: (
    observationId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onDirty: (key: string, dirty: boolean) => void;
}) {
  const draft = useOperationsReportDraft(item);
  const dirtyKey = `positive-${item.id}`;

  useEffect(() => {
    onDirty(dirtyKey, false);
  }, [dirtyKey, item.updated_at]);

  function update(patch: Partial<OperationsReportPositiveObservation>) {
    draft.updateDraft(patch);
    onDirty(dirtyKey, true);
  }

  async function save() {
    await onPatch(item.id, {
      title: draft.draft.title,
      description: draft.draft.description,
      isIncluded: draft.draft.is_included,
      reviewedAt: draft.draft.reviewed_at,
      displayOrder: draft.draft.display_order,
    });
    draft.setDirty(false);
    onDirty(dirtyKey, false);
  }

  return (
    <article className="ops-list-card ops-form">
      <div className="ops-inline-actions">
        <label className="ops-checkbox">
          <input
            type="checkbox"
            checked={draft.draft.is_included}
            onChange={(event) => update({ is_included: event.target.checked })}
          />
          Include
        </label>
        <label className="ops-checkbox">
          <input
            type="checkbox"
            checked={Boolean(draft.draft.reviewed_at)}
            onChange={(event) =>
              update({
                reviewed_at: event.target.checked
                  ? new Date().toISOString()
                  : null,
              })
            }
          />
          Reviewed
        </label>
      </div>
      <label>
        Observation
        <input
          value={draft.draft.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label>
        Client description
        <textarea
          value={draft.draft.description ?? ""}
          onChange={(event) => update({ description: event.target.value })}
        />
      </label>
      <label>
        Order
        <input
          type="number"
          min="0"
          value={draft.draft.display_order}
          onChange={(event) =>
            update({ display_order: Number(event.target.value) || 0 })
          }
        />
      </label>
      {item.source_key && <small>Supported by scan data</small>}
      <button
        className="ops-button ops-button--primary"
        disabled={!draft.dirty}
        onClick={() => void save()}
      >
        Save observation
      </button>
    </article>
  );
}
