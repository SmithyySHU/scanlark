import { useEffect, useMemo, useState } from "react";
import {
  useOperationsReportDraft,
  useOptionalOperationsReportDraft,
} from "../../../hooks/useOperationsReport";
import {
  useReportFindings,
  type ReportFindingFilter,
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
  OperationsReportPositiveObservation,
  OperationsReportPriority,
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
  detail: OperationsReportDetail;
  preview: ClientReportPayload | null;
  readinessIssues: string[];
  actionError: string | null;
  onPatchReport: (input: Record<string, unknown>) => Promise<void>;
  onPatchFinding: (
    findingId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onBulkFindings: (input: Record<string, unknown>) => Promise<void>;
  onPatchObservation: (
    observationId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onPatchActionPlanItem: (
    itemId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
  onMarkReady: () => Promise<void>;
  onRecordSent: () => Promise<void>;
  onGeneratePdf: () => Promise<void>;
  onArchive: () => Promise<void>;
  onCreateRetest: () => Promise<void>;
  onCreateQuote: () => void;
};

export function OperationsReportWorkspace({
  detail,
  preview,
  readinessIssues,
  actionError,
  onPatchReport,
  onPatchFinding,
  onBulkFindings,
  onPatchObservation,
  onPatchActionPlanItem,
  onMarkReady,
  onRecordSent,
  onGeneratePdf,
  onArchive,
  onCreateRetest,
  onCreateQuote,
}: Props) {
  const [tab, setTab] = useState<ReportTab>("overview");
  const [filter, setFilter] = useState<ReportFindingFilter>("all");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState(
    detail.findings[0]?.id ?? "",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewMode, setPreviewMode] = useState<"desktop" | "a4">("a4");
  const reportDraft = useOperationsReportDraft(detail.report);
  const selectedFinding = detail.findings.find(
    (finding) => finding.id === selectedFindingId,
  );
  const findingDraft = useOptionalOperationsReportDraft(
    selectedFinding ?? detail.findings[0],
  );
  const { filtered, counts, categories } = useReportFindings(
    detail.findings,
    filter,
    category,
    search,
  );
  const includedCount = detail.findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  ).length;
  const excludedCount = detail.findings.length - includedCount;
  const readyCount = detail.findings.filter(isFindingReady).length;
  const incomplete = detail.findings.filter(
    (finding) =>
      finding.is_included &&
      !finding.is_false_positive &&
      !isFindingReady(finding),
  );
  const previewStale = reportDraft.dirty || findingDraft.dirty;

  useEffect(() => {
    if (!selectedFindingId && detail.findings[0]) {
      setSelectedFindingId(detail.findings[0].id);
    }
  }, [detail.findings, selectedFindingId]);

  const filterButtons = useMemo(
    () =>
      [
        ["all", "All"],
        ["included", "Included"],
        ["excluded", "Excluded"],
        ["needs_editing", "Needs editing"],
        ["ready", "Ready"],
        ["possible_false_positive", "False positives"],
        ["critical", "Critical"],
        ["important", "Important"],
        ["improvement", "Improvement"],
        ["informational", "Informational"],
      ] as Array<[ReportFindingFilter, string]>,
    [],
  );

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

  async function saveFindingAndContinue(nextId?: string) {
    if (!findingDraft.draft) return;
    await onPatchFinding(findingDraft.draft.id, {
      clientPriority: findingDraft.draft.client_priority,
      title: findingDraft.draft.title,
      clientExplanation: findingDraft.draft.client_explanation,
      whyItMatters: findingDraft.draft.why_it_matters,
      recommendedAction: findingDraft.draft.recommended_action,
      clientEvidence: findingDraft.draft.client_evidence,
      affectedUrlNote: findingDraft.draft.affected_url_note,
      internalNote: findingDraft.draft.internal_note,
      falsePositiveReason: findingDraft.draft.false_positive_reason,
      reviewNote: findingDraft.draft.review_note,
      estimatedEffort: findingDraft.draft.estimated_effort,
      displayOrder: findingDraft.draft.display_order,
      reviewedAt: new Date().toISOString(),
    });
    findingDraft.setDirty(false);
    if (nextId) setSelectedFindingId(nextId);
  }

  async function runBulk(
    action: string,
    clientPriority?: OperationsReportPriority,
  ) {
    if (selectedIds.size === 0) return;
    await onBulkFindings({
      action,
      clientPriority,
      findingIds: Array.from(selectedIds),
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

  const currentIncompleteIndex = selectedFinding
    ? incomplete.findIndex((finding) => finding.id === selectedFinding.id)
    : -1;
  const previousIncomplete = incomplete[currentIncompleteIndex - 1];
  const nextIncomplete = incomplete[currentIncompleteIndex + 1];

  return (
    <div className="ops-report-workspace">
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
            · {excludedCount} excluded · {readyCount}/{includedCount} ready ·
            last saved {formatOperationsDateTime(detail.report.updated_at)}
          </span>
        </div>
        <div className="ops-inline-actions">
          <button
            className="ops-button"
            onClick={() => void saveReportSettings()}
          >
            Save
          </button>
          <button className="ops-button" onClick={() => setTab("preview")}>
            Preview
          </button>
          <button className="ops-button" onClick={() => void onGeneratePdf()}>
            Generate PDF
          </button>
          <button className="ops-button" onClick={() => void onMarkReady()}>
            Mark ready
          </button>
          <button className="ops-button" onClick={() => void onRecordSent()}>
            Record sent
          </button>
          <button className="ops-button" onClick={onCreateQuote}>
            Create quote
          </button>
        </div>
      </section>
      {actionError && <div className="ops-error">{actionError}</div>}
      {readinessIssues.length > 0 && (
        <section className="ops-warning">
          {readinessIssues.map((issue) => (
            <div key={issue}>{issue}</div>
          ))}
        </section>
      )}
      <nav className="ops-report-tabs" aria-label="Report sections">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? "active" : ""}
            onClick={() => setTab(item.key)}
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
              <dt>Excluded</dt>
              <dd>{excludedCount}</dd>
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
            </div>
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
        <section className="ops-report-findings-layout">
          <div className="ops-panel">
            <div className="ops-panel__header">
              <h2>Findings</h2>
              <span className="ops-muted">{filtered.length} shown</span>
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
            <div className="ops-inline-actions">
              <button
                className="ops-button"
                onClick={() => void runBulk("include")}
              >
                Include selected
              </button>
              <button
                className="ops-button"
                onClick={() => void runBulk("exclude")}
              >
                Exclude selected
              </button>
              <button
                className="ops-button"
                onClick={() => void runBulk("mark_reviewed")}
              >
                Mark reviewed
              </button>
              <select
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
                const included =
                  finding.is_included && !finding.is_false_positive;
                return (
                  <button
                    key={finding.id}
                    type="button"
                    className={`ops-report-finding-row ${selectedFindingId === finding.id ? "active" : ""}`}
                    onClick={() => setSelectedFindingId(finding.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(finding.id)}
                      onChange={(event) => {
                        event.stopPropagation();
                        updateSelectedIds(finding.id, event.target.checked);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    <span>
                      <strong>{finding.title}</strong>
                      <small>{finding.affected_url ?? "No URL recorded"}</small>
                    </span>
                    <small>{priorityLabel(finding.client_priority)}</small>
                    <small>{finding.category}</small>
                    <small>source {finding.original_severity}</small>
                    <small>
                      {finding.is_false_positive
                        ? "False positive"
                        : included
                          ? missing.length
                            ? "Needs editing"
                            : "Ready"
                          : "Excluded"}
                    </small>
                    <small>
                      {finding.recommended_action ?? "No action yet"}
                    </small>
                  </button>
                );
              })}
            </div>
          </div>
          {findingDraft.draft && (
            <FindingEditor
              finding={findingDraft.draft}
              previousIncomplete={previousIncomplete}
              nextIncomplete={nextIncomplete}
              dirty={findingDraft.dirty}
              onChange={findingDraft.updateDraft}
              onSave={saveFindingAndContinue}
              onPatchFinding={onPatchFinding}
            />
          )}
        </section>
      )}

      {tab === "action_plan" && (
        <section className="ops-two-column">
          <ReportActionPlan
            items={detail.actionPlanItems}
            onPatch={onPatchActionPlanItem}
          />
          <ReportPositiveObservations
            observations={detail.positiveObservations}
            onPatch={onPatchObservation}
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
  previousIncomplete,
  nextIncomplete,
  dirty,
  onChange,
  onSave,
  onPatchFinding,
}: {
  finding: OperationsReportFinding;
  previousIncomplete?: OperationsReportFinding;
  nextIncomplete?: OperationsReportFinding;
  dirty: boolean;
  onChange: (patch: Partial<OperationsReportFinding>) => void;
  onSave: (nextId?: string) => Promise<void>;
  onPatchFinding: (
    findingId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
}) {
  const missing = missingFindingReadinessFields(finding);
  return (
    <aside className="ops-panel ops-report-finding-editor ops-form">
      <div className="ops-panel__header">
        <h2>Edit finding</h2>
        <span className={missing.length ? "ops-muted" : "ops-badge"}>
          {missing.length ? `${missing.length} incomplete` : "Ready"}
        </span>
      </div>
      {missing.length > 0 && (
        <div className="ops-warning">Missing: {missing.join(", ")}</div>
      )}
      <section>
        <h3>Internal technical context</h3>
        <dl className="ops-definition-grid">
          <dt>Source</dt>
          <dd>{finding.source_type}</dd>
          <dt>Severity</dt>
          <dd>{finding.original_severity}</dd>
          <dt>Category</dt>
          <dd>{finding.category}</dd>
          <dt>Source issue</dt>
          <dd>{finding.source_issue_id ?? "-"}</dd>
          <dt>Source link</dt>
          <dd>{finding.source_link_id ?? "-"}</dd>
        </dl>
        {finding.technical_summary && <p>{finding.technical_summary}</p>}
      </section>
      <section>
        <h3>Client-visible content</h3>
        <label>
          Client priority
          <select
            value={finding.client_priority}
            onChange={(event) =>
              onChange({
                client_priority: event.target.value as OperationsReportPriority,
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
        <label>
          Affected page
          <input value={finding.affected_url ?? ""} readOnly />
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
        <label>
          Evidence shown to client
          <textarea
            value={finding.client_evidence ?? ""}
            onChange={(event) =>
              onChange({ client_evidence: event.target.value })
            }
          />
        </label>
        <div className="ops-form-grid">
          <label>
            Estimated effort
            <input
              value={finding.estimated_effort ?? ""}
              onChange={(event) =>
                onChange({ estimated_effort: event.target.value })
              }
            />
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
      </section>
      <section>
        <h3>Internal-only fields</h3>
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
      </section>
      <div className="ops-inline-actions">
        <button
          className="ops-button"
          onClick={() =>
            void onPatchFinding(finding.id, {
              isIncluded: true,
              isFalsePositive: false,
            })
          }
        >
          Include
        </button>
        <button
          className="ops-button"
          onClick={() => void onPatchFinding(finding.id, { isIncluded: false })}
        >
          Exclude
        </button>
        <button
          className="ops-button"
          onClick={() =>
            void onPatchFinding(finding.id, {
              isIncluded: false,
              isFalsePositive: true,
            })
          }
        >
          Mark false positive
        </button>
      </div>
      <div className="ops-inline-actions">
        <button
          className="ops-button"
          disabled={!previousIncomplete}
          onClick={() =>
            previousIncomplete && void onSave(previousIncomplete.id)
          }
        >
          Previous incomplete
        </button>
        <button
          className="ops-button ops-button--primary"
          onClick={() => void onSave(nextIncomplete?.id)}
        >
          {dirty ? "Save and continue" : "Save reviewed"}
        </button>
        <button
          className="ops-button"
          disabled={!nextIncomplete}
          onClick={() => nextIncomplete && void onSave(nextIncomplete.id)}
        >
          Next incomplete
        </button>
      </div>
    </aside>
  );
}

function ReportActionPlan({
  items,
  onPatch,
}: {
  items: OperationsReportActionPlanItem[];
  onPatch: (itemId: string, input: Record<string, unknown>) => Promise<void>;
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
              <article key={item.id} className="ops-list-card">
                <label className="ops-checkbox">
                  <input
                    type="checkbox"
                    checked={item.is_included}
                    onChange={(event) =>
                      void onPatch(item.id, {
                        isIncluded: event.target.checked,
                      })
                    }
                  />
                  Include in action plan
                </label>
                <input
                  value={item.title}
                  onChange={(event) =>
                    void onPatch(item.id, { title: event.target.value })
                  }
                />
                <textarea
                  value={item.summary ?? ""}
                  onChange={(event) =>
                    void onPatch(item.id, { summary: event.target.value })
                  }
                />
                <select
                  value={item.group_key}
                  onChange={(event) =>
                    void onPatch(item.id, { groupKey: event.target.value })
                  }
                >
                  {groups.map((option) => (
                    <option key={option} value={option}>
                      {actionPlanLabel(option)}
                    </option>
                  ))}
                </select>
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}

function ReportPositiveObservations({
  observations,
  onPatch,
}: {
  observations: OperationsReportPositiveObservation[];
  onPatch: (
    observationId: string,
    input: Record<string, unknown>,
  ) => Promise<void>;
}) {
  return (
    <div className="ops-panel">
      <h2>Positive observations</h2>
      <div className="ops-list">
        {observations.map((item) => (
          <article key={item.id} className="ops-list-card">
            <label className="ops-checkbox">
              <input
                type="checkbox"
                checked={item.is_included}
                onChange={(event) =>
                  void onPatch(item.id, { isIncluded: event.target.checked })
                }
              />
              Include in report
            </label>
            <label className="ops-checkbox">
              <input
                type="checkbox"
                checked={Boolean(item.reviewed_at)}
                onChange={(event) =>
                  void onPatch(item.id, {
                    reviewedAt: event.target.checked
                      ? new Date().toISOString()
                      : null,
                  })
                }
              />
              Reviewed
            </label>
            <input
              value={item.title}
              onChange={(event) =>
                void onPatch(item.id, { title: event.target.value })
              }
            />
            <textarea
              value={item.description ?? ""}
              onChange={(event) =>
                void onPatch(item.id, { description: event.target.value })
              }
            />
            {item.source_key && <small>Supported by {item.source_key}</small>}
          </article>
        ))}
      </div>
    </div>
  );
}
