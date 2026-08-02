import { recordAdminAuditLog, type AdminActor } from "./admin";
import { ensureConnected } from "./client";
import { formatIssuePresentation } from "./issuePresentation";
import type { ScanIssue, ScanIssueSeverity } from "./scanIssues";

export const OPERATIONS_REPORT_STATUSES = [
  "draft",
  "needs_review",
  "ready_to_send",
  "sent",
  "client_replied",
  "fixes_quoted",
  "work_in_progress",
  "completed",
  "archived",
] as const;

export const OPERATIONS_REPORT_TYPES = [
  "initial_health_check",
  "follow_up",
  "post_fix_retest",
  "monthly_monitoring",
  "incident",
  "custom",
] as const;

export const OPERATIONS_REPORT_CLIENT_PRIORITIES = [
  "critical",
  "important",
  "improvement",
  "informational",
] as const;

export const OPERATIONS_REPORT_COMPARISON_STATUSES = [
  "resolved",
  "still_present",
  "improved",
  "worsened",
  "new",
  "unable_to_compare",
] as const;

export type OperationsReportStatus =
  (typeof OPERATIONS_REPORT_STATUSES)[number];
export type OperationsReportType = (typeof OPERATIONS_REPORT_TYPES)[number];
export type OperationsReportClientPriority =
  (typeof OPERATIONS_REPORT_CLIENT_PRIORITIES)[number];
export type OperationsReportComparisonStatus =
  (typeof OPERATIONS_REPORT_COMPARISON_STATUSES)[number];

export type OperationsReportDisplaySettings = {
  displayLogo: boolean;
  displayScanlarkContact: boolean;
  displayWebsiteHealthScore: boolean;
  displayTechnicalAppendix: boolean;
  displayMethodologyLimitations: boolean;
  displayPricingOffer: boolean;
  footerText: string | null;
};

export type OperationsReportRow = {
  id: string;
  business_id: string;
  site_id: string;
  scan_run_id: string;
  prepared_contact_id: string | null;
  supersedes_report_id: string | null;
  comparison_report_id: string | null;
  delivery_communication_id: string | null;
  follow_up_task_id: string | null;
  title: string;
  status: OperationsReportStatus;
  report_type: OperationsReportType;
  version_number: number;
  executive_summary: string | null;
  overall_summary: string | null;
  main_strengths: string | null;
  main_concerns: string | null;
  recommended_first_steps: string | null;
  scope_limitations: string | null;
  prepared_for: string | null;
  prepared_by: string | null;
  cover_date: Date;
  valid_until: Date | null;
  sent_at: Date | null;
  completed_at: Date | null;
  archived_at: Date | null;
  follow_up_at: Date | null;
  no_major_findings_waived: boolean;
  display_settings_json: Partial<OperationsReportDisplaySettings>;
  frozen_render_json: OperationsClientReportPayload | null;
  frozen_at: Date | null;
  last_pdf_generated_at: Date | null;
  created_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  business_name?: string | null;
  site_url?: string | null;
  site_display_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
  contact_email?: string | null;
  included_findings?: number;
  excluded_findings?: number;
  critical_findings?: number;
  important_findings?: number;
  improvement_findings?: number;
  informational_findings?: number;
};

export type OperationsReportFindingRow = {
  id: string;
  operations_report_id: string;
  source_issue_id: string | null;
  source_link_id: string | null;
  source_type: "scan_issue" | "scan_link" | "manual";
  source_fingerprint: string | null;
  category: string;
  original_severity: ScanIssueSeverity;
  client_priority: OperationsReportClientPriority;
  title: string;
  technical_summary: string | null;
  client_explanation: string | null;
  why_it_matters: string | null;
  recommended_action: string | null;
  affected_url: string | null;
  evidence_json: Record<string, unknown>;
  is_included: boolean;
  is_false_positive: boolean;
  internal_note: string | null;
  display_order: number;
  estimated_effort: string | null;
  comparison_status: OperationsReportComparisonStatus | null;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportComparisonItemRow = {
  id: string;
  operations_report_id: string;
  original_finding_id: string | null;
  current_finding_id: string | null;
  source_fingerprint: string | null;
  comparison_status: OperationsReportComparisonStatus;
  summary: string | null;
  manual_note: string | null;
  is_manually_overridden: boolean;
  created_at: Date;
  updated_at: Date;
};

export type OperationsReportActivityRow = {
  id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown>;
  created_at: Date;
};

export type OperationsReportDetail = {
  report: OperationsReportRow;
  findings: OperationsReportFindingRow[];
  comparisonItems: OperationsReportComparisonItemRow[];
  activity: OperationsReportActivityRow[];
};

export type OperationsReportCreateInput = {
  businessId: string;
  siteId: string;
  scanRunId: string;
  reportType: OperationsReportType;
  title: string;
  preparedContactId?: string | null;
  preparedFor?: string | null;
  preparedBy?: string | null;
  coverDate?: Date | null;
  allowDuplicate?: boolean;
  supersedesReportId?: string | null;
  comparisonReportId?: string | null;
};

export type OperationsReportUpdateInput = {
  title?: string;
  status?: OperationsReportStatus;
  reportType?: OperationsReportType;
  executiveSummary?: string | null;
  overallSummary?: string | null;
  mainStrengths?: string | null;
  mainConcerns?: string | null;
  recommendedFirstSteps?: string | null;
  scopeLimitations?: string | null;
  preparedFor?: string | null;
  preparedBy?: string | null;
  preparedContactId?: string | null;
  coverDate?: Date | null;
  validUntil?: Date | null;
  noMajorFindingsWaived?: boolean;
  displaySettings?: Partial<OperationsReportDisplaySettings>;
};

export type OperationsReportFindingUpdateInput = {
  clientPriority?: OperationsReportClientPriority;
  title?: string;
  clientExplanation?: string | null;
  whyItMatters?: string | null;
  recommendedAction?: string | null;
  internalNote?: string | null;
  estimatedEffort?: string | null;
  isIncluded?: boolean;
  isFalsePositive?: boolean;
  displayOrder?: number;
  comparisonStatus?: OperationsReportComparisonStatus | null;
};

export type OperationsReportListParams = {
  search?: string | null;
  status?: OperationsReportStatus | null;
  reportType?: OperationsReportType | null;
  businessId?: string | null;
  siteId?: string | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  awaitingFollowUp?: boolean;
  archived?: boolean | null;
  limit: number;
  offset: number;
};

export type OperationsClientReportPayload = {
  report: {
    id: string;
    title: string;
    status: OperationsReportStatus;
    reportType: OperationsReportType;
    versionNumber: number;
    preparedFor: string | null;
    preparedBy: string | null;
    coverDate: string;
    validUntil: string | null;
    sentAt: string | null;
  };
  business: {
    id: string;
    name: string;
  };
  site: {
    id: string;
    url: string;
    displayName: string | null;
    domain: string;
  };
  scan: {
    id: string;
    finishedAt: string | null;
    checkedLinks: number;
    totalLinks: number;
  };
  summaries: {
    executiveSummary: string | null;
    overallSummary: string | null;
    mainStrengths: string | null;
    mainConcerns: string | null;
    recommendedFirstSteps: string | null;
    scopeLimitations: string | null;
  };
  settings: OperationsReportDisplaySettings;
  priorityCounts: Record<OperationsReportClientPriority, number>;
  findings: Array<{
    id: string;
    priority: OperationsReportClientPriority;
    title: string;
    affectedUrl: string | null;
    whatWasFound: string | null;
    whyItMatters: string | null;
    recommendedAction: string | null;
    evidence: Record<string, unknown>;
    estimatedEffort: string | null;
    displayOrder: number;
    comparisonStatus: OperationsReportComparisonStatus | null;
  }>;
  positiveObservations: string[];
  methodology: string[];
  nextSteps: string[];
  comparison: Array<{
    id: string;
    status: OperationsReportComparisonStatus;
    summary: string | null;
  }>;
  generatedAt: string;
};

type CountRow = { count: string };

export type OperationsReportDeleteEligibility = {
  allowed: boolean;
  reasons: string[];
  dependencyCounts: Record<string, number>;
};

type ReportRelationshipRow = {
  business_id: string;
  business_name: string;
  site_id: string;
  site_url: string;
  site_display_name: string | null;
  scan_run_id: string;
  scan_status: string;
  finished_at: Date | null;
  checked_links: number;
  total_links: number;
  contact_id: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
};

const DEFAULT_DISPLAY_SETTINGS: OperationsReportDisplaySettings = {
  displayLogo: true,
  displayScanlarkContact: true,
  displayWebsiteHealthScore: false,
  displayTechnicalAppendix: true,
  displayMethodologyLimitations: true,
  displayPricingOffer: false,
  footerText: "Prepared by Scanlark for client use.",
};

function countValue(row: CountRow | undefined): number {
  return Number.parseInt(row?.count ?? "0", 10) || 0;
}

function addDependencyReason(
  reasons: string[],
  dependencyCounts: Record<string, number>,
  key: string,
  count: number,
  label: string,
) {
  dependencyCounts[key] = count;
  if (count > 0) reasons.push(`${label}: ${count}`);
}

function textValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requiredText(value: string | null | undefined, key: string): string {
  const text = textValue(value);
  if (!text) throw new Error(`${key}_required`);
  return text;
}

function normalizeUrlForFingerprint(value: string | null | undefined) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    if (
      (parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")
    ) {
      parsed.port = "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.trim().toLowerCase();
  }
}

function siteDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value;
  }
}

function sourceFingerprint(
  issue: Pick<
    ScanIssue,
    "category" | "issue_type" | "affected_url" | "source_url"
  >,
) {
  return [
    issue.category,
    issue.issue_type,
    normalizeUrlForFingerprint(issue.affected_url),
    normalizeUrlForFingerprint(issue.source_url),
  ].join("|");
}

function priorityFromSeverity(
  severity: ScanIssueSeverity,
): OperationsReportClientPriority {
  if (severity === "critical") return "critical";
  if (severity === "high") return "important";
  if (severity === "medium" || severity === "low") return "improvement";
  return "informational";
}

function mergeDisplaySettings(
  settings: Partial<OperationsReportDisplaySettings> | null | undefined,
): OperationsReportDisplaySettings {
  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...(settings ?? {}),
    footerText:
      textValue(settings?.footerText) ?? DEFAULT_DISPLAY_SETTINGS.footerText,
  };
}

function dateOnly(value: Date | null): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | null): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function reportSelect() {
  return `
    r.*,
    b.name AS business_name,
    s.url AS site_url,
    s.site_display_name,
    c.first_name AS contact_first_name,
    c.last_name AS contact_last_name,
    c.email AS contact_email,
    COALESCE(finding_counts.included_findings, 0)::int AS included_findings,
    COALESCE(finding_counts.excluded_findings, 0)::int AS excluded_findings,
    COALESCE(finding_counts.critical_findings, 0)::int AS critical_findings,
    COALESCE(finding_counts.important_findings, 0)::int AS important_findings,
    COALESCE(finding_counts.improvement_findings, 0)::int AS improvement_findings,
    COALESCE(finding_counts.informational_findings, 0)::int AS informational_findings
  `;
}

function reportJoins() {
  return `
    JOIN operations_businesses b ON b.id = r.business_id
    JOIN sites s ON s.id = r.site_id
    LEFT JOIN operations_contacts c ON c.id = r.prepared_contact_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false)::int AS included_findings,
        COUNT(*) FILTER (WHERE f.is_included = false OR f.is_false_positive = true)::int AS excluded_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'critical')::int AS critical_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'important')::int AS important_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'improvement')::int AS improvement_findings,
        COUNT(*) FILTER (WHERE f.is_included = true AND f.is_false_positive = false AND f.client_priority = 'informational')::int AS informational_findings
      FROM operations_report_findings f
      WHERE f.operations_report_id = r.id
    ) finding_counts ON TRUE
  `;
}

async function getReportRelationship(input: {
  businessId: string;
  siteId: string;
  scanRunId: string;
  contactId?: string | null;
}): Promise<ReportRelationshipRow | null> {
  const client = await ensureConnected();
  const res = await client.query<ReportRelationshipRow>(
    `
      SELECT b.id AS business_id,
             b.name AS business_name,
             s.id AS site_id,
             s.url AS site_url,
             s.site_display_name,
             r.id AS scan_run_id,
             r.status AS scan_status,
             r.finished_at,
             r.checked_links,
             r.total_links,
             c.id AS contact_id,
             c.first_name AS contact_first_name,
             c.last_name AS contact_last_name,
             c.email AS contact_email
      FROM operations_businesses b
      JOIN operations_business_sites obs ON obs.business_id = b.id
      JOIN sites s ON s.id = obs.site_id
      JOIN scan_runs r ON r.site_id = s.id
      LEFT JOIN operations_contacts c
        ON c.business_id = b.id
       AND c.id = $4
       AND c.archived_at IS NULL
      WHERE b.id = $1
        AND s.id = $2
        AND r.id = $3
      LIMIT 1
    `,
    [input.businessId, input.siteId, input.scanRunId, input.contactId ?? null],
  );
  return res.rows[0] ?? null;
}

async function getReportById(
  reportId: string,
): Promise<OperationsReportRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportRow>(
    `
      SELECT ${reportSelect()}
      FROM operations_reports r
      ${reportJoins()}
      WHERE r.id = $1
      LIMIT 1
    `,
    [reportId],
  );
  return res.rows[0] ?? null;
}

async function listFindings(
  reportId: string,
): Promise<OperationsReportFindingRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportFindingRow>(
    `
      SELECT *
      FROM operations_report_findings
      WHERE operations_report_id = $1
      ORDER BY display_order ASC, created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listComparisonItems(
  reportId: string,
): Promise<OperationsReportComparisonItemRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportComparisonItemRow>(
    `
      SELECT *
      FROM operations_report_comparison_items
      WHERE operations_report_id = $1
      ORDER BY created_at ASC
    `,
    [reportId],
  );
  return res.rows;
}

async function listReportActivity(
  reportId: string,
): Promise<OperationsReportActivityRow[]> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportActivityRow>(
    `
      SELECT *
      FROM admin_audit_log
      WHERE (target_type = 'operations_report' AND target_id = $1)
         OR (
           target_type IN ('operations_report_finding', 'operations_report_comparison')
           AND metadata_json->>'reportId' = $1
         )
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [reportId],
  );
  return res.rows;
}

async function insertFindingsForScan(
  client: Awaited<ReturnType<typeof ensureConnected>>,
  reportId: string,
  scanRunId: string,
) {
  const issuesRes = await client.query<ScanIssue>(
    `
      SELECT *
      FROM scan_issues
      WHERE scan_run_id = $1
        AND status = 'open'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        category ASC,
        affected_url ASC
    `,
    [scanRunId],
  );

  let order = 0;
  for (const issue of issuesRes.rows) {
    const presentation = formatIssuePresentation(issue);
    await client.query(
      `
        INSERT INTO operations_report_findings (
          operations_report_id,
          source_issue_id,
          source_type,
          source_fingerprint,
          category,
          original_severity,
          client_priority,
          title,
          technical_summary,
          client_explanation,
          why_it_matters,
          recommended_action,
          affected_url,
          evidence_json,
          is_included,
          display_order
        )
        VALUES ($1, $2, 'scan_issue', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, $14)
      `,
      [
        reportId,
        issue.id,
        sourceFingerprint(issue),
        issue.category,
        issue.severity,
        priorityFromSeverity(issue.severity),
        presentation.userTitle,
        presentation.technicalDetail,
        presentation.whatItMeans || presentation.shortSummary,
        presentation.whyItMatters,
        presentation.suggestedFix,
        issue.affected_url,
        {
          issueType: issue.issue_type,
          sourceUrl: issue.source_url,
          sourceTitle: issue.title,
          sourceDescription: issue.description,
          changeStatus: issue.change_status,
          evidence: issue.evidence_json,
          detectedAt: issue.last_seen_at.toISOString(),
        },
        order++,
      ],
    );
  }
}

export async function createOperationsReport(
  actor: AdminActor,
  input: OperationsReportCreateInput,
): Promise<
  | OperationsReportDetail
  | "business_site_scan_invalid"
  | "scan_not_reportable"
  | "duplicate_report"
  | "contact_not_found"
> {
  const client = await ensureConnected();
  const title = requiredText(input.title, "report_title");
  const relationship = await getReportRelationship({
    businessId: input.businessId,
    siteId: input.siteId,
    scanRunId: input.scanRunId,
    contactId: input.preparedContactId,
  });
  if (!relationship) return "business_site_scan_invalid";
  if (input.preparedContactId && !relationship.contact_id) {
    return "contact_not_found";
  }
  if (relationship.scan_status !== "completed" || !relationship.finished_at) {
    return "scan_not_reportable";
  }

  try {
    await client.query("BEGIN");
    if (!input.allowDuplicate) {
      const duplicate = await client.query<{ id: string }>(
        `
          SELECT id
          FROM operations_reports
          WHERE business_id = $1
            AND site_id = $2
            AND scan_run_id = $3
            AND report_type = $4
            AND archived_at IS NULL
          LIMIT 1
        `,
        [input.businessId, input.siteId, input.scanRunId, input.reportType],
      );
      if (duplicate.rows[0]) {
        await client.query("ROLLBACK");
        return "duplicate_report";
      }
    }

    const versionRes = await client.query<{ version: number }>(
      `
        SELECT COALESCE(MAX(version_number), 0)::int + 1 AS version
        FROM operations_reports
        WHERE business_id = $1
          AND site_id = $2
          AND scan_run_id = $3
      `,
      [input.businessId, input.siteId, input.scanRunId],
    );
    const version = versionRes.rows[0]?.version ?? 1;
    const reportRes = await client.query<OperationsReportRow>(
      `
        INSERT INTO operations_reports (
          business_id,
          site_id,
          scan_run_id,
          prepared_contact_id,
          supersedes_report_id,
          comparison_report_id,
          title,
          status,
          report_type,
          version_number,
          prepared_for,
          prepared_by,
          cover_date,
          display_settings_json,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'needs_review', $8, $9, $10, $11, COALESCE($12, CURRENT_DATE), $13, $14)
        RETURNING *
      `,
      [
        input.businessId,
        input.siteId,
        input.scanRunId,
        input.preparedContactId ?? null,
        input.supersedesReportId ?? null,
        input.comparisonReportId ?? null,
        title,
        input.reportType,
        version,
        textValue(input.preparedFor) ??
          ([relationship.contact_first_name, relationship.contact_last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
            relationship.business_name),
        textValue(input.preparedBy) ?? actor.email,
        input.coverDate ?? null,
        DEFAULT_DISPLAY_SETTINGS,
        actor.id,
      ],
    );
    const report = reportRes.rows[0];
    await insertFindingsForScan(client, report.id, input.scanRunId);
    await client.query("COMMIT");

    await recordAdminAuditLog(actor, {
      action: "operations_report_created",
      targetType: "operations_report",
      targetId: report.id,
      metadata: {
        businessId: input.businessId,
        siteId: input.siteId,
        scanRunId: input.scanRunId,
        reportType: input.reportType,
      },
    });
    return (await getOperationsReportDetail(
      report.id,
    )) as OperationsReportDetail;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function listOperationsReportableScanRuns(input: {
  businessId: string;
  siteId: string;
  limit: number;
}) {
  const client = await ensureConnected();
  const linked = await client.query<{ id: string }>(
    `
      SELECT obs.site_id AS id
      FROM operations_business_sites obs
      WHERE obs.business_id = $1
        AND obs.site_id = $2
    `,
    [input.businessId, input.siteId],
  );
  if (!linked.rows[0]) return null;
  const res = await client.query(
    `
      SELECT r.id,
             r.site_id,
             r.status,
             r.started_at,
             r.finished_at,
             r.checked_links,
             r.total_links,
             COALESCE(issue_counts.open_issues, 0)::int AS open_issues,
             COALESCE(issue_counts.high_priority, 0)::int AS high_priority
      FROM scan_runs r
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE si.status = 'open')::int AS open_issues,
               COUNT(*) FILTER (WHERE si.status = 'open' AND si.severity IN ('critical', 'high'))::int AS high_priority
        FROM scan_issues si
        WHERE si.scan_run_id = r.id
      ) issue_counts ON TRUE
      WHERE r.site_id = $1
        AND r.status = 'completed'
        AND r.finished_at IS NOT NULL
      ORDER BY r.finished_at DESC
      LIMIT $2
    `,
    [input.siteId, input.limit],
  );
  return { scanRuns: res.rows };
}

export async function listOperationsReports(
  params: OperationsReportListParams,
) {
  const client = await ensureConnected();
  const filters: string[] = [];
  const values: unknown[] = [];

  if (params.archived === true) {
    filters.push(`r.archived_at IS NOT NULL`);
  } else if (params.archived === false || params.archived == null) {
    filters.push(`r.archived_at IS NULL`);
  }
  if (params.status) {
    values.push(params.status);
    filters.push(`r.status = $${values.length}`);
  }
  if (params.reportType) {
    values.push(params.reportType);
    filters.push(`r.report_type = $${values.length}`);
  }
  if (params.businessId) {
    values.push(params.businessId);
    filters.push(`r.business_id = $${values.length}`);
  }
  if (params.siteId) {
    values.push(params.siteId);
    filters.push(`r.site_id = $${values.length}`);
  }
  if (params.dateFrom) {
    values.push(params.dateFrom);
    filters.push(`r.created_at >= $${values.length}`);
  }
  if (params.dateTo) {
    values.push(params.dateTo);
    filters.push(`r.created_at <= $${values.length}`);
  }
  if (params.awaitingFollowUp) {
    filters.push(
      `r.follow_up_at IS NOT NULL AND r.follow_up_at <= now() AND r.status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress')`,
    );
  }
  if (params.search?.trim()) {
    values.push(`%${params.search.trim().toLowerCase()}%`);
    filters.push(
      `(lower(r.title) LIKE $${values.length} OR lower(b.name) LIKE $${values.length} OR lower(s.url) LIKE $${values.length})`,
    );
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const pageValues = [...values, params.limit, params.offset];
  const limitPlaceholder = `$${pageValues.length - 1}`;
  const offsetPlaceholder = `$${pageValues.length}`;
  const [rows, total, summary] = await Promise.all([
    client.query<OperationsReportRow>(
      `
        SELECT ${reportSelect()}
        FROM operations_reports r
        ${reportJoins()}
        ${where}
        ORDER BY r.updated_at DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      pageValues,
    ),
    client.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM operations_reports r
        JOIN operations_businesses b ON b.id = r.business_id
        JOIN sites s ON s.id = r.site_id
        ${where}
      `,
      values,
    ),
    client.query<{
      draft: string;
      needs_review: string;
      ready_to_send: string;
      sent_this_month: string;
      awaiting_client_response: string;
      completed: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status = 'draft' AND archived_at IS NULL)::text AS draft,
          COUNT(*) FILTER (WHERE status = 'needs_review' AND archived_at IS NULL)::text AS needs_review,
          COUNT(*) FILTER (WHERE status = 'ready_to_send' AND archived_at IS NULL)::text AS ready_to_send,
          COUNT(*) FILTER (WHERE status = 'sent' AND sent_at >= date_trunc('month', now()) AND archived_at IS NULL)::text AS sent_this_month,
          COUNT(*) FILTER (WHERE status IN ('sent', 'client_replied') AND archived_at IS NULL)::text AS awaiting_client_response,
          COUNT(*) FILTER (WHERE status = 'completed' AND archived_at IS NULL)::text AS completed
        FROM operations_reports
      `,
    ),
  ]);

  const summaryRow = summary.rows[0];
  return {
    reports: rows.rows,
    totalMatching: countValue(total.rows[0]),
    countReturned: rows.rows.length,
    limit: params.limit,
    offset: params.offset,
    summary: {
      draft: countValue({ count: summaryRow?.draft ?? "0" }),
      needsReview: countValue({ count: summaryRow?.needs_review ?? "0" }),
      readyToSend: countValue({ count: summaryRow?.ready_to_send ?? "0" }),
      sentThisMonth: countValue({ count: summaryRow?.sent_this_month ?? "0" }),
      awaitingClientResponse: countValue({
        count: summaryRow?.awaiting_client_response ?? "0",
      }),
      completed: countValue({ count: summaryRow?.completed ?? "0" }),
    },
  };
}

export async function getOperationsReportDetail(
  reportId: string,
): Promise<OperationsReportDetail | null> {
  const report = await getReportById(reportId);
  if (!report) return null;
  const [findings, comparisonItems, activity] = await Promise.all([
    listFindings(reportId),
    listComparisonItems(reportId),
    listReportActivity(reportId),
  ]);
  return { report, findings, comparisonItems, activity };
}

export async function updateOperationsReport(
  actor: AdminActor,
  reportId: string,
  input: OperationsReportUpdateInput,
): Promise<OperationsReportDetail | null | "contact_not_found"> {
  const existing = await getReportById(reportId);
  if (!existing) return null;
  if (input.preparedContactId) {
    const client = await ensureConnected();
    const contact = await client.query<{ id: string }>(
      `SELECT id FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
      [input.preparedContactId, existing.business_id],
    );
    if (!contact.rows[0]) return "contact_not_found";
  }
  const client = await ensureConnected();
  const settings =
    input.displaySettings === undefined
      ? existing.display_settings_json
      : mergeDisplaySettings({
          ...existing.display_settings_json,
          ...input.displaySettings,
        });
  await client.query(
    `
      UPDATE operations_reports
      SET title = COALESCE($2, title),
          status = COALESCE($3, status),
          report_type = COALESCE($4, report_type),
          executive_summary = CASE WHEN $5::boolean THEN $6 ELSE executive_summary END,
          overall_summary = CASE WHEN $7::boolean THEN $8 ELSE overall_summary END,
          main_strengths = CASE WHEN $9::boolean THEN $10 ELSE main_strengths END,
          main_concerns = CASE WHEN $11::boolean THEN $12 ELSE main_concerns END,
          recommended_first_steps = CASE WHEN $13::boolean THEN $14 ELSE recommended_first_steps END,
          scope_limitations = CASE WHEN $15::boolean THEN $16 ELSE scope_limitations END,
          prepared_for = CASE WHEN $17::boolean THEN $18 ELSE prepared_for END,
          prepared_by = CASE WHEN $19::boolean THEN $20 ELSE prepared_by END,
          prepared_contact_id = CASE WHEN $21::boolean THEN $22 ELSE prepared_contact_id END,
          cover_date = COALESCE($23, cover_date),
          valid_until = CASE WHEN $24::boolean THEN $25 ELSE valid_until END,
          no_major_findings_waived = COALESCE($26, no_major_findings_waived),
          display_settings_json = $27,
          updated_at = now()
      WHERE id = $1
    `,
    [
      reportId,
      input.title === undefined
        ? null
        : requiredText(input.title, "report_title"),
      input.status ?? null,
      input.reportType ?? null,
      input.executiveSummary !== undefined,
      textValue(input.executiveSummary),
      input.overallSummary !== undefined,
      textValue(input.overallSummary),
      input.mainStrengths !== undefined,
      textValue(input.mainStrengths),
      input.mainConcerns !== undefined,
      textValue(input.mainConcerns),
      input.recommendedFirstSteps !== undefined,
      textValue(input.recommendedFirstSteps),
      input.scopeLimitations !== undefined,
      textValue(input.scopeLimitations),
      input.preparedFor !== undefined,
      textValue(input.preparedFor),
      input.preparedBy !== undefined,
      textValue(input.preparedBy),
      input.preparedContactId !== undefined,
      input.preparedContactId ?? null,
      input.coverDate ?? null,
      input.validUntil !== undefined,
      input.validUntil ?? null,
      input.noMajorFindingsWaived,
      settings,
    ],
  );
  await recordAdminAuditLog(actor, {
    action: "operations_report_updated",
    targetType: "operations_report",
    targetId: reportId,
    metadata: { fields: Object.keys(input) },
  });
  return getOperationsReportDetail(reportId);
}

export async function updateOperationsReportFinding(
  actor: AdminActor,
  reportId: string,
  findingId: string,
  input: OperationsReportFindingUpdateInput,
): Promise<OperationsReportFindingRow | null> {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportFindingRow>(
    `
      UPDATE operations_report_findings
      SET client_priority = COALESCE($3, client_priority),
          title = COALESCE($4, title),
          client_explanation = CASE WHEN $5::boolean THEN $6 ELSE client_explanation END,
          why_it_matters = CASE WHEN $7::boolean THEN $8 ELSE why_it_matters END,
          recommended_action = CASE WHEN $9::boolean THEN $10 ELSE recommended_action END,
          internal_note = CASE WHEN $11::boolean THEN $12 ELSE internal_note END,
          estimated_effort = CASE WHEN $13::boolean THEN $14 ELSE estimated_effort END,
          is_included = COALESCE($15, is_included),
          is_false_positive = COALESCE($16, is_false_positive),
          display_order = COALESCE($17, display_order),
          comparison_status = CASE WHEN $18::boolean THEN $19 ELSE comparison_status END,
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      findingId,
      input.clientPriority ?? null,
      input.title === undefined
        ? null
        : requiredText(input.title, "finding_title"),
      input.clientExplanation !== undefined,
      textValue(input.clientExplanation),
      input.whyItMatters !== undefined,
      textValue(input.whyItMatters),
      input.recommendedAction !== undefined,
      textValue(input.recommendedAction),
      input.internalNote !== undefined,
      textValue(input.internalNote),
      input.estimatedEffort !== undefined,
      textValue(input.estimatedEffort),
      input.isIncluded,
      input.isFalsePositive,
      input.displayOrder,
      input.comparisonStatus !== undefined,
      input.comparisonStatus ?? null,
    ],
  );
  const finding = res.rows[0] ?? null;
  if (finding) {
    await recordAdminAuditLog(actor, {
      action: "operations_report_finding_updated",
      targetType: "operations_report_finding",
      targetId: findingId,
      metadata: { reportId, fields: Object.keys(input) },
    });
  }
  return finding;
}

export async function reorderOperationsReportFindings(
  actor: AdminActor,
  reportId: string,
  orderedFindingIds: string[],
) {
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    let index = 0;
    for (const id of orderedFindingIds) {
      await client.query(
        `
          UPDATE operations_report_findings
          SET display_order = $3,
              updated_at = now()
          WHERE operations_report_id = $1
            AND id = $2
        `,
        [reportId, id, index++],
      );
    }
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations_report_findings_reordered",
      targetType: "operations_report",
      targetId: reportId,
      metadata: { count: orderedFindingIds.length },
    });
    return listFindings(reportId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

function readinessIssues(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
) {
  const issues: string[] = [];
  if (!textValue(report.title)) issues.push("Report title is required.");
  if (!report.business_id || !report.site_id || !report.scan_run_id) {
    issues.push("Business, website and source scan must be valid.");
  }
  const included = findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  if (included.length === 0 && !report.no_major_findings_waived) {
    issues.push("Include at least one finding or waive major findings.");
  }
  if (!textValue(report.executive_summary)) {
    issues.push("Executive summary must be reviewed and saved.");
  }
  for (const finding of included) {
    if (!textValue(finding.title) || !textValue(finding.client_explanation)) {
      issues.push(
        "Included findings need client-facing titles and explanations.",
      );
      break;
    }
  }
  return issues;
}

function positiveObservations(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
) {
  const observations: string[] = [];
  const siteUrl = report.site_url ?? "";
  if (siteUrl.startsWith("https://"))
    observations.push("HTTPS is active for the reviewed website address.");
  if (
    !findings.some(
      (finding) =>
        finding.category === "link_integrity" &&
        finding.client_priority === "critical",
    )
  ) {
    observations.push(
      "No critical broken-link findings were included in this reviewed client report.",
    );
  }
  if (
    (report.included_findings ?? 0) === 0 &&
    report.no_major_findings_waived
  ) {
    observations.push(
      "No major client-facing findings were selected for this report.",
    );
  }
  return observations;
}

export function buildOperationsClientReportPayload(
  report: OperationsReportRow,
  findings: OperationsReportFindingRow[],
  comparisonItems: OperationsReportComparisonItemRow[] = [],
): OperationsClientReportPayload {
  const included = findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  const priorityCounts = {
    critical: 0,
    important: 0,
    improvement: 0,
    informational: 0,
  } satisfies Record<OperationsReportClientPriority, number>;
  included.forEach((finding) => {
    priorityCounts[finding.client_priority] += 1;
  });
  return {
    report: {
      id: report.id,
      title: report.title,
      status: report.status,
      reportType: report.report_type,
      versionNumber: report.version_number,
      preparedFor: report.prepared_for,
      preparedBy: report.prepared_by,
      coverDate:
        dateOnly(report.cover_date) ?? new Date().toISOString().slice(0, 10),
      validUntil: dateOnly(report.valid_until),
      sentAt: iso(report.sent_at),
    },
    business: {
      id: report.business_id,
      name: report.business_name ?? "Client",
    },
    site: {
      id: report.site_id,
      url: report.site_url ?? "",
      displayName: report.site_display_name ?? null,
      domain: siteDomain(report.site_url ?? ""),
    },
    scan: {
      id: report.scan_run_id,
      finishedAt: null,
      checkedLinks: 0,
      totalLinks: 0,
    },
    summaries: {
      executiveSummary: report.executive_summary,
      overallSummary: report.overall_summary,
      mainStrengths: report.main_strengths,
      mainConcerns: report.main_concerns,
      recommendedFirstSteps: report.recommended_first_steps,
      scopeLimitations: report.scope_limitations,
    },
    settings: mergeDisplaySettings(report.display_settings_json),
    priorityCounts,
    findings: included.map((finding) => ({
      id: finding.id,
      priority: finding.client_priority,
      title: finding.title,
      affectedUrl: finding.affected_url,
      whatWasFound: finding.client_explanation,
      whyItMatters: finding.why_it_matters,
      recommendedAction: finding.recommended_action,
      evidence: finding.evidence_json,
      estimatedEffort: finding.estimated_effort,
      displayOrder: finding.display_order,
      comparisonStatus: finding.comparison_status,
    })),
    positiveObservations: positiveObservations(report, findings),
    methodology: [
      "This report is based on publicly accessible pages checked by Scanlark.",
      "It reflects the selected scan date and website conditions can change afterwards.",
      "This is not a penetration test and does not guarantee search rankings, legal compliance or complete vulnerability coverage.",
      "Forms, authenticated areas and third-party services may require separate testing.",
    ],
    nextSteps: [
      "Review the priority findings first.",
      "Ask for clarification on any finding that is unclear.",
      "Confirm fixes with a fresh Scanlark re-test after changes are made.",
      "Discuss ongoing monitoring if recurring website checks would be useful.",
    ],
    comparison: comparisonItems.map((item) => ({
      id: item.id,
      status: item.comparison_status,
      summary: item.summary,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function getOperationsReportPreview(reportId: string) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  if (detail.report.frozen_render_json) {
    return {
      payload: detail.report.frozen_render_json,
      frozen: true,
      readinessIssues: readinessIssues(detail.report, detail.findings),
    };
  }
  return {
    payload: buildOperationsClientReportPayload(
      detail.report,
      detail.findings,
      detail.comparisonItems,
    ),
    frozen: false,
    readinessIssues: readinessIssues(detail.report, detail.findings),
  };
}

export async function freezeOperationsReportRender(
  actor: AdminActor,
  reportId: string,
  action: string,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const payload = buildOperationsClientReportPayload(
    detail.report,
    detail.findings,
    detail.comparisonItems,
  );
  const client = await ensureConnected();
  await client.query(
    `
      UPDATE operations_reports
      SET frozen_render_json = $2,
          frozen_at = now(),
          last_pdf_generated_at = CASE WHEN $3 = 'operations_report_pdf_generated' THEN now() ELSE last_pdf_generated_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [reportId, payload, action],
  );
  await recordAdminAuditLog(actor, {
    action,
    targetType: "operations_report",
    targetId: reportId,
    metadata: { findingCount: payload.findings.length },
  });
  return payload;
}

export async function markOperationsReportStatus(
  actor: AdminActor,
  reportId: string,
  status: OperationsReportStatus,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  if (status === "ready_to_send") {
    const issues = readinessIssues(detail.report, detail.findings);
    if (issues.length > 0) return { readinessIssues: issues };
    await freezeOperationsReportRender(
      actor,
      reportId,
      "operations_report_ready_render_frozen",
    );
  }
  const client = await ensureConnected();
  const completedAt = status === "completed" ? new Date() : null;
  await client.query(
    `
      UPDATE operations_reports
      SET status = $2,
          completed_at = COALESCE($3, completed_at),
          archived_at = CASE WHEN $2 = 'archived' THEN now() ELSE archived_at END,
          updated_at = now()
      WHERE id = $1
    `,
    [reportId, status, completedAt],
  );
  await recordAdminAuditLog(actor, {
    action: `operations_report_status_${status}`,
    targetType: "operations_report",
    targetId: reportId,
    metadata: {},
  });
  return getOperationsReportDetail(reportId);
}

export async function setOperationsReportArchived(
  actor: AdminActor,
  reportId: string,
  archived: boolean,
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportRow>(
    `
      UPDATE operations_reports
      SET status = CASE WHEN $2 THEN 'archived' ELSE 'draft' END,
          archived_at = CASE WHEN $2 THEN now() ELSE NULL END,
          updated_at = now()
      WHERE id = $1
      RETURNING *
    `,
    [reportId, archived],
  );
  const report = res.rows[0];
  if (!report) return null;
  await recordAdminAuditLog(actor, {
    action: archived
      ? "operations_report_archived"
      : "operations_report_restored",
    targetType: "operations_report",
    targetId: reportId,
    metadata: {},
  });
  return getOperationsReportDetail(reportId);
}

export async function getOperationsReportDeleteEligibility(
  reportId: string,
): Promise<OperationsReportDeleteEligibility | null> {
  const report = await getReportById(reportId);
  if (!report) return null;
  const client = await ensureConnected();
  const [quotes, workOrders, serviceUsage, serviceActivity, communications] =
    await Promise.all([
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_quotes WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_work_orders WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_client_service_usage WHERE operations_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_client_service_activity WHERE related_report_id = $1`,
        [reportId],
      ),
      client.query<CountRow>(
        `SELECT COUNT(*)::text AS count FROM operations_communications WHERE operations_report_id = $1`,
        [reportId],
      ),
    ]);

  const reasons: string[] = [];
  const dependencyCounts: Record<string, number> = {};
  if (!["draft", "needs_review"].includes(report.status)) {
    reasons.push(`status is ${report.status}`);
  }
  if (report.sent_at || report.frozen_at || report.delivery_communication_id) {
    reasons.push("report has delivery or frozen history");
  }
  addDependencyReason(
    reasons,
    dependencyCounts,
    "quotes",
    countValue(quotes.rows[0]),
    "quotes",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "workOrders",
    countValue(workOrders.rows[0]),
    "work orders",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "serviceUsage",
    countValue(serviceUsage.rows[0]),
    "service usage",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "serviceActivity",
    countValue(serviceActivity.rows[0]),
    "service activity",
  );
  addDependencyReason(
    reasons,
    dependencyCounts,
    "communications",
    countValue(communications.rows[0]),
    "communications",
  );

  return { allowed: reasons.length === 0, reasons, dependencyCounts };
}

export async function deleteOperationsReport(
  actor: AdminActor,
  reportId: string,
): Promise<OperationsReportRow | null | OperationsReportDeleteEligibility> {
  const eligibility = await getOperationsReportDeleteEligibility(reportId);
  if (!eligibility) return null;
  if (!eligibility.allowed) return eligibility;

  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM operations_report_comparison_items WHERE operations_report_id = $1`,
      [reportId],
    );
    await client.query(
      `DELETE FROM operations_report_findings WHERE operations_report_id = $1`,
      [reportId],
    );
    const res = await client.query<OperationsReportRow>(
      `DELETE FROM operations_reports WHERE id = $1 RETURNING *`,
      [reportId],
    );
    await client.query("COMMIT");
    const report = res.rows[0] ?? null;
    if (report) {
      await recordAdminAuditLog(actor, {
        action: "operations_report_deleted",
        targetType: "operations_report",
        targetId: reportId,
        metadata: {
          businessId: report.business_id,
          siteId: report.site_id,
          scanRunId: report.scan_run_id,
        },
      });
    }
    return report;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function duplicateOperationsReport(
  actor: AdminActor,
  reportId: string,
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  const created = await createOperationsReport(actor, {
    businessId: detail.report.business_id,
    siteId: detail.report.site_id,
    scanRunId: detail.report.scan_run_id,
    reportType: detail.report.report_type,
    title: `${detail.report.title} copy`,
    preparedContactId: detail.report.prepared_contact_id,
    preparedFor: detail.report.prepared_for,
    preparedBy: detail.report.prepared_by,
    allowDuplicate: true,
    supersedesReportId: detail.report.id,
  });
  return typeof created === "string" ? null : created;
}

export async function recordOperationsReportSent(
  actor: AdminActor,
  reportId: string,
  input: {
    contactId?: string | null;
    deliveryMethod: "email_attachment" | "secure_link" | "in_person" | "other";
    followUpAt?: Date | null;
    updatePipelineStage?: boolean;
  },
) {
  const detail = await getOperationsReportDetail(reportId);
  if (!detail) return null;
  if (input.contactId) {
    const contact =
      detail.report.prepared_contact_id === input.contactId
        ? true
        : (await ensureConnected()).query<{ id: string }>(
            `SELECT id FROM operations_contacts WHERE id = $1 AND business_id = $2 AND archived_at IS NULL`,
            [input.contactId, detail.report.business_id],
          );
    if (contact !== true && !(await contact).rows[0])
      return "contact_not_found";
  }
  const payload = buildOperationsClientReportPayload(
    detail.report,
    detail.findings,
    detail.comparisonItems,
  );
  const client = await ensureConnected();
  try {
    await client.query("BEGIN");
    const communication = await client.query<{ id: string }>(
      `
        INSERT INTO operations_communications (
          business_id,
          contact_id,
          direction,
          channel,
          status,
          subject,
          body,
          sent_at,
          occurred_at,
          follow_up_at,
          created_by_user_id
        )
        VALUES ($1, $2, 'outbound', $3, 'sent', $4, $5, now(), now(), $6, $7)
        RETURNING id
      `,
      [
        detail.report.business_id,
        input.contactId ?? detail.report.prepared_contact_id,
        input.deliveryMethod === "in_person" ? "in_person" : "email",
        `Website health report sent: ${detail.report.title}`,
        `Recorded manual delivery of Operations report "${detail.report.title}" by ${input.deliveryMethod}.`,
        input.followUpAt ?? null,
        actor.id,
      ],
    );
    let taskId: string | null = null;
    if (input.followUpAt) {
      const task = await client.query<{ id: string }>(
        `
          INSERT INTO operations_tasks (
            business_id,
            contact_id,
            source_communication_id,
            title,
            notes,
            due_at,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          detail.report.business_id,
          input.contactId ?? detail.report.prepared_contact_id,
          communication.rows[0].id,
          `Follow up on report: ${detail.report.title}`,
          "Report delivery follow-up.",
          input.followUpAt,
          actor.id,
        ],
      );
      taskId = task.rows[0].id;
    }
    await client.query(
      `
        UPDATE operations_reports
        SET status = 'sent',
            sent_at = now(),
            follow_up_at = $2,
            delivery_communication_id = $3,
            follow_up_task_id = $4,
            frozen_render_json = $5,
            frozen_at = now(),
            updated_at = now()
        WHERE id = $1
      `,
      [
        reportId,
        input.followUpAt ?? null,
        communication.rows[0].id,
        taskId,
        payload,
      ],
    );
    await client.query(
      `
        UPDATE operations_businesses
        SET last_contacted_at = now(),
            next_follow_up_at = COALESCE($2, next_follow_up_at),
            pipeline_stage = CASE WHEN $3 THEN 'report_sent' ELSE pipeline_stage END,
            updated_at = now()
        WHERE id = $1
      `,
      [
        detail.report.business_id,
        input.followUpAt ?? null,
        input.updatePipelineStage === true,
      ],
    );
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations_report_sent",
      targetType: "operations_report",
      targetId: reportId,
      metadata: {
        deliveryMethod: input.deliveryMethod,
        communicationId: communication.rows[0].id,
        followUpScheduled: Boolean(input.followUpAt),
      },
    });
    return getOperationsReportDetail(reportId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function createOperationsReportRetest(
  actor: AdminActor,
  reportId: string,
  scanRunId: string,
  reportType: OperationsReportType = "post_fix_retest",
) {
  const original = await getOperationsReportDetail(reportId);
  if (!original) return null;
  const created = await createOperationsReport(actor, {
    businessId: original.report.business_id,
    siteId: original.report.site_id,
    scanRunId,
    reportType,
    title: `${original.report.title} re-test`,
    preparedContactId: original.report.prepared_contact_id,
    preparedFor: original.report.prepared_for,
    preparedBy: original.report.prepared_by,
    allowDuplicate: true,
    comparisonReportId: original.report.id,
  });
  if (typeof created === "string") return created;
  const client = await ensureConnected();
  const originalIncluded = original.findings.filter(
    (finding) => finding.is_included && !finding.is_false_positive,
  );
  const currentByFingerprint = new Map(
    created.findings
      .filter((finding) => finding.source_fingerprint)
      .map((finding) => [finding.source_fingerprint as string, finding]),
  );
  try {
    await client.query("BEGIN");
    for (const finding of originalIncluded) {
      const current = finding.source_fingerprint
        ? currentByFingerprint.get(finding.source_fingerprint)
        : null;
      await client.query(
        `
          INSERT INTO operations_report_comparison_items (
            operations_report_id,
            original_finding_id,
            current_finding_id,
            source_fingerprint,
            comparison_status,
            summary
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          created.report.id,
          finding.id,
          current?.id ?? null,
          finding.source_fingerprint,
          current ? "still_present" : "resolved",
          current
            ? "A matching finding is still present in the re-test scan."
            : "No matching finding was imported from the re-test scan.",
        ],
      );
    }
    for (const current of created.findings) {
      if (
        current.source_fingerprint &&
        originalIncluded.some(
          (finding) =>
            finding.source_fingerprint === current.source_fingerprint,
        )
      ) {
        continue;
      }
      await client.query(
        `
          INSERT INTO operations_report_comparison_items (
            operations_report_id,
            current_finding_id,
            source_fingerprint,
            comparison_status,
            summary
          )
          VALUES ($1, $2, $3, 'new', 'This finding appears in the re-test scan but was not in the original reviewed report.')
        `,
        [created.report.id, current.id, current.source_fingerprint],
      );
    }
    await client.query("COMMIT");
    await recordAdminAuditLog(actor, {
      action: "operations_report_retest_created",
      targetType: "operations_report",
      targetId: created.report.id,
      metadata: { originalReportId: reportId, scanRunId },
    });
    return getOperationsReportDetail(created.report.id);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

export async function updateOperationsReportComparisonItem(
  actor: AdminActor,
  reportId: string,
  comparisonItemId: string,
  input: {
    comparisonStatus?: OperationsReportComparisonStatus;
    summary?: string | null;
    manualNote?: string | null;
  },
) {
  const client = await ensureConnected();
  const res = await client.query<OperationsReportComparisonItemRow>(
    `
      UPDATE operations_report_comparison_items
      SET comparison_status = COALESCE($3, comparison_status),
          summary = CASE WHEN $4::boolean THEN $5 ELSE summary END,
          manual_note = CASE WHEN $6::boolean THEN $7 ELSE manual_note END,
          is_manually_overridden = true,
          updated_at = now()
      WHERE operations_report_id = $1
        AND id = $2
      RETURNING *
    `,
    [
      reportId,
      comparisonItemId,
      input.comparisonStatus ?? null,
      input.summary !== undefined,
      textValue(input.summary),
      input.manualNote !== undefined,
      textValue(input.manualNote),
    ],
  );
  const item = res.rows[0] ?? null;
  if (item) {
    await recordAdminAuditLog(actor, {
      action: "operations_report_comparison_updated",
      targetType: "operations_report_comparison",
      targetId: comparisonItemId,
      metadata: { reportId, status: item.comparison_status },
    });
  }
  return item;
}

export async function getOperationsReportCountsForSummary() {
  const client = await ensureConnected();
  const res = await client.query<{
    needs_review: string;
    ready_to_send: string;
    awaiting_response: string;
    follow_up_due: string;
  }>(
    `
      SELECT
        COUNT(*) FILTER (WHERE status = 'needs_review' AND archived_at IS NULL)::text AS needs_review,
        COUNT(*) FILTER (WHERE status = 'ready_to_send' AND archived_at IS NULL)::text AS ready_to_send,
        COUNT(*) FILTER (WHERE status IN ('sent', 'client_replied') AND archived_at IS NULL)::text AS awaiting_response,
        COUNT(*) FILTER (
          WHERE follow_up_at IS NOT NULL
            AND follow_up_at <= now()
            AND status IN ('sent', 'client_replied', 'fixes_quoted', 'work_in_progress')
            AND archived_at IS NULL
        )::text AS follow_up_due
      FROM operations_reports
    `,
  );
  const row = res.rows[0];
  return {
    reportsAwaitingReview: countValue({ count: row?.needs_review ?? "0" }),
    reportsReadyToSend: countValue({ count: row?.ready_to_send ?? "0" }),
    reportsAwaitingClientResponse: countValue({
      count: row?.awaiting_response ?? "0",
    }),
    reportFollowUpsDue: countValue({ count: row?.follow_up_due ?? "0" }),
  };
}
