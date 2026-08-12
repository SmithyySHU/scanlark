import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { closeConnection } from "./client";
import { DATABASE_URL } from "./env";
import {
  createOperationsReport,
  getOperationsReportCoverage,
  getOperationsReportDetail,
  previewOperationsReportRegroup,
  regroupOperationsReportFindings,
  updateOperationsReportFinding,
} from "./operationsReports";

function disposableDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      /test|audit|verify/i.test(url.pathname.slice(1)) &&
      process.env.NODE_ENV !== "production"
    );
  } catch {
    return false;
  }
}

const enabled = disposableDatabaseUrl(DATABASE_URL);
const db = new Client({ connectionString: DATABASE_URL });
const key = randomUUID();
const actor = { id: "", email: `coverage-${key}@scanlark.test` };
let workspaceId = "";
let otherWorkspaceId = "";
let businessId = "";
let siteId = "";
let scanRunId = "";
let reportId = "";

before(async () => {
  if (!enabled) return;
  await db.connect();
  const user = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'coverage-test') RETURNING id`,
    [actor.email],
  );
  actor.id = user.rows[0].id;
  const workspaces = await db.query<{ id: string }>(
    `INSERT INTO internal_workspaces (name, code)
     VALUES ($1, $2), ($3, $4) RETURNING id`,
    [
      `Coverage workspace ${key}`,
      `coverage-${key}`,
      `Other coverage workspace ${key}`,
      `coverage-other-${key}`,
    ],
  );
  workspaceId = workspaces.rows[0].id;
  otherWorkspaceId = workspaces.rows[1].id;
  const business = await db.query<{ id: string }>(
    `INSERT INTO operations_businesses (internal_workspace_id, name, created_by_user_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [workspaceId, `Mixed coverage business ${key}`, actor.id],
  );
  businessId = business.rows[0].id;
  const site = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id) VALUES ($1, $2) RETURNING id`,
    [`https://coverage-${key}.test`, actor.id],
  );
  siteId = site.rows[0].id;
  await db.query(
    `INSERT INTO operations_business_sites (business_id, site_id, created_by_user_id)
     VALUES ($1, $2, $3)`,
    [businessId, siteId, actor.id],
  );
  const scan = await db.query<{ id: string }>(
    `INSERT INTO scan_runs (site_id, status, start_url, finished_at)
     VALUES ($1, 'completed', $2, now()) RETURNING id`,
    [siteId, `https://coverage-${key}.test`],
  );
  scanRunId = scan.rows[0].id;

  const issues: Array<{
    category: string;
    severity: string;
    issueType: string;
    affectedUrl: string;
    sourceUrl?: string;
    title: string;
    evidence?: Record<string, unknown>;
  }> = [];
  for (let index = 1; index <= 6; index += 1) {
    issues.push({
      category: "seo_basic",
      severity: "low",
      issueType: "missing_meta_description",
      affectedUrl: `https://coverage-${key}.test/page-${index}`,
      title: `Missing meta description ${index}`,
    });
  }
  issues.push(
    {
      category: "seo_basic",
      severity: "medium",
      issueType: "missing_h1",
      affectedUrl: `https://coverage-${key}.test/no-heading`,
      title: "Missing H1",
    },
    {
      category: "link_integrity",
      severity: "medium",
      issueType: "broken_link",
      affectedUrl: "https://external.example/confirmed-404",
      sourceUrl: `https://coverage-${key}.test/resources`,
      title: "Confirmed broken external link",
      evidence: { status_code: 404, classification: "broken" },
    },
    {
      category: "link_integrity",
      severity: "low",
      issueType: "blocked_link",
      affectedUrl: "https://www.linkedin.com/company/example",
      sourceUrl: `https://coverage-${key}.test/contact`,
      title: "Restricted social destination",
      evidence: { status_code: 999, classification: "blocked" },
    },
    {
      category: "security_header",
      severity: "medium",
      issueType: "hsts_missing",
      affectedUrl: `https://coverage-${key}.test`,
      title: "HSTS header missing",
    },
    {
      category: "security_header",
      severity: "low",
      issueType: "referrer_policy_missing",
      affectedUrl: `https://coverage-${key}.test`,
      title: "Referrer-Policy missing",
    },
    {
      category: "security_header",
      severity: "medium",
      issueType: "frame_ancestors_missing",
      affectedUrl: `https://coverage-${key}.test`,
      title: "frame-ancestors missing",
    },
    {
      category: "security_header",
      severity: "low",
      issueType: "x_frame_options_missing",
      affectedUrl: `https://coverage-${key}.test`,
      title: "X-Frame-Options missing",
    },
    {
      category: "sitemap",
      severity: "medium",
      issueType: "sitemap_missing",
      affectedUrl: `https://coverage-${key}.test/sitemap.xml`,
      title: "Sitemap missing",
    },
    {
      category: "robots",
      severity: "low",
      issueType: "robots_no_sitemap_reference",
      affectedUrl: `https://coverage-${key}.test/robots.txt`,
      title: "Robots sitemap reference missing",
    },
  );
  for (const issue of issues) {
    await db.query(
      `INSERT INTO scan_issues (
         scan_run_id, site_id, category, severity, issue_type, affected_url,
         source_url, title, description, evidence_json
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        scanRunId,
        siteId,
        issue.category,
        issue.severity,
        issue.issueType,
        issue.affectedUrl,
        issue.sourceUrl ?? null,
        issue.title,
        `${issue.title} deterministic evidence.`,
        issue.evidence ?? {},
      ],
    );
  }

  const created = await createOperationsReport(workspaceId, actor, {
    businessId,
    siteId,
    scanRunId,
    reportType: "initial_health_check",
    title: "Mixed category coverage report",
  });
  if (typeof created === "string")
    assert.fail(`report creation failed: ${created}`);
  reportId = created.report.id;
});

after(async () => {
  if (!enabled) return;
  await db.query(
    `DELETE FROM admin_audit_log WHERE target_id = ANY($1::text[])`,
    [[reportId, businessId].filter(Boolean)],
  );
  if (reportId)
    await db.query(`DELETE FROM operations_reports WHERE id = $1`, [reportId]);
  if (businessId)
    await db.query(`DELETE FROM operations_businesses WHERE id = $1`, [
      businessId,
    ]);
  if (siteId) await db.query(`DELETE FROM sites WHERE id = $1`, [siteId]);
  await db.query(`DELETE FROM internal_workspaces WHERE id = ANY($1::uuid[])`, [
    [workspaceId, otherWorkspaceId].filter(Boolean),
  ]);
  if (actor.id) await db.query(`DELETE FROM users WHERE id = $1`, [actor.id]);
  await db.end();
  await closeConnection();
});

test("mixed scan categories reconcile every source without hiding security controls", async () => {
  if (!enabled) return;
  const detail = await getOperationsReportDetail(workspaceId, reportId);
  assert.ok(detail);
  assert.equal(detail.coverage.participatingSourceIssues, 15);
  assert.equal(detail.coverage.unaccounted, 0);
  assert.equal(detail.coverage.complete, true);
  assert.equal(
    detail.coverage.includedClientFindings +
      detail.coverage.groupedIntoClientFindings +
      detail.coverage.manualVerificationRequired +
      detail.coverage.excludedByOperator +
      detail.coverage.falsePositives +
      detail.coverage.internalSystemOnly,
    detail.coverage.participatingSourceIssues,
  );

  const security = detail.findings.find(
    (finding) =>
      finding.group_key === "security_header:browser_security_controls",
  );
  assert.ok(security);
  assert.equal(security.source_issue_count, 4);
  assert.match(security.title, /HSTS/);
  assert.match(security.title, /Referrer-Policy/);
  assert.match(security.title, /CSP frame-ancestors/);
  assert.match(security.title, /X-Frame-Options/);
  assert.equal(
    detail.findingSources.filter(
      (source) => source.report_finding_id === security.id,
    ).length,
    4,
  );

  const meta = detail.findings.find(
    (finding) => finding.group_key === "seo_basic:meta_description",
  );
  assert.ok(meta);
  assert.equal(meta.source_issue_count, 6);
  assert.equal(meta.representative_examples_json.length, 5);
  assert.equal(
    detail.findingSources.filter(
      (source) => source.report_finding_id === meta.id,
    ).length,
    6,
  );

  const blocked = detail.findings.find((finding) =>
    finding.group_key?.includes(":blocked_link:"),
  );
  assert.ok(blocked);
  assert.equal(blocked.is_included, false);
  assert.match(blocked.title, /manual destination verification/i);
  assert.equal(detail.coverage.manualVerificationRequired, 1);
  assert.equal(
    detail.coverage.items.find((item) => item.issueType === "blocked_link")
      ?.disposition,
    "manual_verification_required",
  );
  assert.equal(
    await getOperationsReportCoverage(otherWorkspaceId, reportId),
    null,
  );

  const blockedSource = detail.coverage.items.find(
    (item) => item.issueType === "blocked_link",
  );
  assert.ok(blockedSource);
  await db.query(
    `UPDATE operations_report_findings
     SET is_included = true
     WHERE id = $1`,
    [blocked.id],
  );
  await db.query(
    `UPDATE operations_report_source_dispositions
     SET disposition = 'manual_verification_required',
         reason = 'The automated request could not confirm that the destination is broken; manual verification is required.'
     WHERE operations_report_id = $1 AND source_issue_id = $2`,
    [reportId, blockedSource.sourceIssueId],
  );
  const inconsistent = await getOperationsReportCoverage(workspaceId, reportId);
  assert.equal(inconsistent?.unaccounted, 1);
  await db.query(
    readFileSync(
      new URL(
        "../migrations/058_operations_report_coverage_repair.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const repaired = await getOperationsReportCoverage(workspaceId, reportId);
  assert.equal(repaired?.manualVerificationRequired, 1);
  assert.equal(repaired?.unaccounted, 0);
  await db.query(
    `UPDATE operations_reports SET content_revision = 1 WHERE id = $1`,
    [reportId],
  );
});

test("false-positive, exclude and restore actions remain accounted", async () => {
  if (!enabled) return;
  const detail = await getOperationsReportDetail(workspaceId, reportId);
  assert.ok(detail);
  const heading = detail.findings.find(
    (finding) =>
      finding.category === "seo_basic" &&
      finding.group_key === "seo_basic:missing_h1",
  );
  const broken = detail.findings.find((finding) =>
    finding.group_key?.includes(":broken:404:"),
  );
  assert.ok(heading);
  assert.ok(broken);

  await updateOperationsReportFinding(
    workspaceId,
    actor,
    reportId,
    heading.id,
    {
      isIncluded: false,
      isFalsePositive: true,
      falsePositiveReason: "Confirmed manually as expected page structure.",
      expectedRevision: 1,
    },
  );
  let coverage = await getOperationsReportCoverage(workspaceId, reportId);
  assert.equal(coverage?.falsePositives, 1);
  assert.equal(coverage?.unaccounted, 0);

  await updateOperationsReportFinding(workspaceId, actor, reportId, broken.id, {
    isIncluded: false,
    expectedRevision: 2,
  });
  coverage = await getOperationsReportCoverage(workspaceId, reportId);
  assert.equal(coverage?.excludedByOperator, 1);
  assert.equal(coverage?.unaccounted, 0);

  const preview = await previewOperationsReportRegroup(workspaceId, reportId);
  assert.ok(preview);
  const regrouped = await regroupOperationsReportFindings(
    workspaceId,
    actor,
    reportId,
    { confirm: true, previewHash: preview.previewHash },
  );
  assert.ok(
    regrouped &&
      !("blockedReason" in regrouped) &&
      !("stalePreview" in regrouped),
  );
  if (!regrouped || "blockedReason" in regrouped || "stalePreview" in regrouped)
    return;
  const regroupedHeading = regrouped.findings.find(
    (finding) => finding.group_key === "seo_basic:missing_h1",
  );
  const regroupedBroken = regrouped.findings.find((finding) =>
    finding.group_key?.includes(":broken:404:"),
  );
  assert.equal(regroupedHeading?.is_false_positive, true);
  assert.equal(regroupedBroken?.is_included, false);
  assert.equal(regrouped.coverage.falsePositives, 1);
  assert.equal(
    regrouped.coverage.excludedByOperator,
    1,
    JSON.stringify(
      regrouped.coverage.items.filter(
        (item) => item.disposition === "excluded_by_operator",
      ),
    ),
  );
  assert.equal(regrouped.coverage.unaccounted, 0);

  assert.ok(regroupedBroken);
  await updateOperationsReportFinding(
    workspaceId,
    actor,
    reportId,
    regroupedBroken.id,
    {
      isIncluded: true,
      isFalsePositive: false,
      expectedRevision: 4,
    },
  );
  coverage = await getOperationsReportCoverage(workspaceId, reportId);
  assert.equal(coverage?.excludedByOperator, 0);
  assert.equal(coverage?.unaccounted, 0);
});
