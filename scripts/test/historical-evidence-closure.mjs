import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import {
  createRevisedOperationsQuote,
  createRevisedOperationsReport,
  freezeOperationsQuoteRender,
  freezeOperationsReportRender,
  getOperationsQuoteDetail,
  getOperationsReportDetail,
  getOperationsReportPdfRender,
  getOperationsReportPreview,
  markOperationsCommunicationSent,
  markOperationsReportStatus,
  recordOperationsQuoteAccepted,
  recordOperationsQuoteSent,
  recordOperationsReportSent,
  saveOperationsReportPdfRender,
  updateOperationsCommunication,
  updateOperationsQuote,
  updateOperationsReport,
} from "../../packages/db/src/index.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("B5 verification requires loopback PostgreSQL");
}
if (!/test|audit|verify/i.test(parsed.pathname.slice(1))) {
  throw new Error("B5 verification requires a disposable database name");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("B5 verification cannot run in production");
}

const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const actorId = randomUUID();
const actor = { id: actorId, email: `b5-${actorId}@scanlark.test` };
const workspaceId = randomUUID();
const businessId = randomUUID();
const siteId = randomUUID();
const scanId = randomUUID();
const contactId = randomUUID();
let directSqlRejections = 0;

async function rejectsArtifact(action) {
  await assert.rejects(action, /artifact_immutable/);
}

async function rejectsSql(statement, values = []) {
  await assert.rejects(
    db.query(statement, values),
    /scanlark_artifact_immutable|scanlark_invalid_lifecycle_transition/,
  );
  directSqlRejections += 1;
}

async function snapshotReport(reportId) {
  const result = await db.query(
    `SELECT r.title, r.status, r.content_revision, r.sent_at, r.frozen_at,
            r.frozen_render_json,
            encode(digest(p.pdf_bytes, 'sha256'), 'hex') AS actual_pdf_sha,
            p.sha256 AS stored_pdf_sha, p.pdf_bytes
       FROM operations_reports r
       LEFT JOIN LATERAL (
         SELECT * FROM operations_report_pdf_renders
         WHERE operations_report_id = r.id ORDER BY generated_at DESC LIMIT 1
       ) p ON true
      WHERE r.id = $1`,
    [reportId],
  );
  return result.rows[0];
}

async function snapshotQuote(quoteId) {
  const result = await db.query(
    `SELECT q.title, q.status, q.content_revision, q.sent_at, q.accepted_at,
            q.subtotal_minor, q.total_minor, q.frozen_at, q.frozen_render_json,
            encode(digest(p.pdf_bytes, 'sha256'), 'hex') AS actual_pdf_sha,
            p.sha256 AS stored_pdf_sha, p.pdf_bytes
       FROM operations_quotes q
       LEFT JOIN LATERAL (
         SELECT * FROM operations_quote_pdf_renders
         WHERE operations_quote_id = q.id ORDER BY generated_at DESC LIMIT 1
       ) p ON true
      WHERE q.id = $1`,
    [quoteId],
  );
  return result.rows[0];
}

try {
  await db.query(
    `INSERT INTO users (id,email,password_hash) VALUES ($1,$2,'b5-test')`,
    [actor.id, actor.email],
  );
  await db.query(
    `INSERT INTO internal_workspaces (id,name,code) VALUES ($1,'B5 verify',$2)`,
    [workspaceId, `b5-${workspaceId}`],
  );
  await db.query(
    `INSERT INTO internal_workspace_memberships (workspace_id,user_id,role)
     VALUES ($1,$2,'owner')`,
    [workspaceId, actor.id],
  );
  await db.query(
    `INSERT INTO operations_businesses
       (id,name,internal_workspace_id,created_by_user_id)
     VALUES ($1,'B5 synthetic client',$2,$3)`,
    [businessId, workspaceId, actor.id],
  );
  await db.query(
    `INSERT INTO operations_contacts (id,business_id,first_name,last_name,email)
     VALUES ($1,$2,'Synthetic','Client','client@scanlark.test')`,
    [contactId, businessId],
  );
  await db.query(
    `INSERT INTO sites (id,url,user_id,verification_status)
     VALUES ($1,'https://b5.scanlark.test',$2,'permission_confirmed')`,
    [siteId, actor.id],
  );
  await db.query(
    `INSERT INTO operations_business_sites (business_id,site_id) VALUES ($1,$2)`,
    [businessId, siteId],
  );
  await db.query(
    `INSERT INTO scan_runs (id,site_id,status,start_url,finished_at,checked_links,total_links)
     VALUES ($1,$2,'completed','https://b5.scanlark.test',now(),12,12)`,
    [scanId, siteId],
  );

  const reportId = randomUUID();
  await db.query(
    `INSERT INTO operations_reports (
       id,business_id,site_id,scan_run_id,prepared_contact_id,title,status,
       executive_summary,overall_summary,main_strengths,main_concerns,
       recommended_first_steps,scope_limitations,prepared_for,prepared_by,
       display_settings_json,created_by_user_id
     ) VALUES ($1,$2,$3,$4,$5,'B5 lifecycle report','draft',
       'Healthy baseline with reviewed improvements.','The website was reviewed.',
       'Clear public content.','A small set of improvements remains.',
       'Address the reviewed items.','Public pages only.','Synthetic Client',
       'B5 Actor','{}'::jsonb,$6)`,
    [reportId, businessId, siteId, scanId, contactId, actor.id],
  );
  const finding = await db.query(
    `INSERT INTO operations_report_findings (
       operations_report_id,source_type,category,original_severity,client_priority,
       title,client_explanation,why_it_matters,recommended_action,affected_url,
       reviewed_at,display_order
     ) VALUES ($1,'manual','content','medium','important','Reviewed finding',
       'A synthetic explanation.','It affects clarity.','Update the wording.',
       'https://b5.scanlark.test/page',now(),0) RETURNING id`,
    [reportId],
  );
  const observation = await db.query(
    `INSERT INTO operations_report_positive_observations
       (operations_report_id,title,description,reviewed_at,display_order)
     VALUES ($1,'Positive observation','Synthetic strength',now(),0) RETURNING id`,
    [reportId],
  );
  const actionPlan = await db.query(
    `INSERT INTO operations_report_action_plan_items
       (operations_report_id,report_finding_id,group_key,title,summary,reviewed_at,display_order)
     VALUES ($1,$2,'address_now','Address finding','Synthetic action',now(),0) RETURNING id`,
    [reportId, finding.rows[0].id],
  );
  const comparison = await db.query(
    `INSERT INTO operations_report_comparison_items
       (operations_report_id,current_finding_id,comparison_status,summary)
     VALUES ($1,$2,'new','Synthetic comparison') RETURNING id`,
    [reportId, finding.rows[0].id],
  );
  await markOperationsReportStatus(
    workspaceId,
    actor,
    reportId,
    "needs_review",
  );
  await freezeOperationsReportRender(
    workspaceId,
    actor,
    reportId,
    "b5_report_preview_frozen",
  );
  const reportPdf = Buffer.from("%PDF-1.4 B5 original report");
  await saveOperationsReportPdfRender(
    workspaceId,
    reportId,
    "b5-report.pdf",
    reportPdf,
  );
  await freezeOperationsReportRender(
    workspaceId,
    actor,
    reportId,
    "operations_report_pdf_generated",
  );
  await getOperationsReportPreview(workspaceId, reportId);
  const reportReady = await markOperationsReportStatus(
    workspaceId,
    actor,
    reportId,
    "ready_to_send",
  );
  assert.ok(reportReady && !("readinessIssues" in reportReady));
  const staleReportRevision = reportReady.report.content_revision ?? 1;
  await recordOperationsReportSent(workspaceId, actor, reportId, {
    contactId,
    deliveryMethod: "email_attachment",
  });
  const reportSent = await snapshotReport(reportId);
  assert.equal(reportSent.status, "sent");
  assert.equal(reportSent.actual_pdf_sha, reportSent.stored_pdf_sha);
  await rejectsArtifact(() =>
    updateOperationsReport(workspaceId, actor, reportId, {
      title: "Stale overwrite",
      expectedRevision: staleReportRevision,
    }),
  );
  await rejectsSql(
    `UPDATE operations_reports SET title='SQL bypass' WHERE id=$1`,
    [reportId],
  );
  await rejectsSql(
    `UPDATE operations_report_findings SET title='SQL bypass' WHERE id=$1`,
    [finding.rows[0].id],
  );
  await rejectsSql(
    `INSERT INTO operations_report_positive_observations (operations_report_id,title) VALUES ($1,'SQL bypass')`,
    [reportId],
  );
  await rejectsSql(
    `DELETE FROM operations_report_action_plan_items WHERE id=$1`,
    [actionPlan.rows[0].id],
  );
  await rejectsSql(
    `UPDATE operations_report_comparison_items SET summary='SQL bypass' WHERE id=$1`,
    [comparison.rows[0].id],
  );
  await rejectsSql(
    `UPDATE operations_report_pdf_renders SET filename='SQL bypass.pdf' WHERE operations_report_id=$1`,
    [reportId],
  );
  await rejectsSql(
    `DELETE FROM operations_report_pdf_renders WHERE operations_report_id=$1`,
    [reportId],
  );
  await rejectsSql(`DELETE FROM operations_reports WHERE id=$1`, [reportId]);
  await markOperationsReportStatus(
    workspaceId,
    actor,
    reportId,
    "client_replied",
  );
  const reportForward = await snapshotReport(reportId);
  assert.deepEqual(
    reportForward.frozen_render_json,
    reportSent.frozen_render_json,
  );
  assert.deepEqual(reportForward.pdf_bytes, reportSent.pdf_bytes);

  const reportRace = await Promise.all([
    createRevisedOperationsReport(workspaceId, actor, reportId),
    createRevisedOperationsReport(workspaceId, actor, reportId),
  ]);
  assert.equal(
    reportRace.filter((value) => typeof value !== "string").length,
    1,
  );
  assert.equal(
    reportRace.filter((value) => value === "report_already_superseded").length,
    1,
  );
  const revisedReport = reportRace.find((value) => typeof value !== "string");
  assert.ok(revisedReport && typeof revisedReport !== "string");
  assert.equal(revisedReport.report.version_number, 2);
  assert.equal(revisedReport.report.supersedes_report_id, reportId);
  assert.equal(revisedReport.report.status, "draft");
  assert.equal(revisedReport.report.frozen_render_json, null);
  assert.equal(
    await getOperationsReportPdfRender(workspaceId, revisedReport.report.id),
    null,
  );
  await updateOperationsReport(workspaceId, actor, revisedReport.report.id, {
    title: "B5 revised report",
    expectedRevision: revisedReport.report.content_revision ?? 1,
  });
  assert.equal((await snapshotReport(reportId)).title, "B5 lifecycle report");

  const quoteId = randomUUID();
  const quoteSeries = randomUUID();
  await db.query(
    `INSERT INTO operations_quotes (
       id,business_id,contact_id,revision_series_id,revision_number,quote_number,
       title,status,currency,subtotal_minor,total_minor,scope_summary,payment_terms,
       created_by_user_id
     ) VALUES ($1,$2,$3,$4,1,$5,'B5 lifecycle quote','draft','GBP',12500,12500,
       'Synthetic commercial scope','Payment within 14 days',$6)`,
    [
      quoteId,
      businessId,
      contactId,
      quoteSeries,
      `B5-Q-${randomUUID()}`,
      actor.id,
    ],
  );
  const quoteItem = await db.query(
    `INSERT INTO operations_quote_items
       (quote_id,title,quantity,unit_price_minor,line_total_minor,display_order)
     VALUES ($1,'Synthetic work',1,12500,12500,0) RETURNING id`,
    [quoteId],
  );
  const requirement = await db.query(
    `INSERT INTO operations_quote_access_requirements (quote_id,description,display_order)
     VALUES ($1,'Synthetic access requirement',0) RETURNING id`,
    [quoteId],
  );
  await freezeOperationsQuoteRender(workspaceId, actor, quoteId);
  const quotePdf = Buffer.from("%PDF-1.4 B5 original quote");
  const quoteHash = createHash("sha256").update(quotePdf).digest("hex");
  await db.query(
    `INSERT INTO operations_quote_pdf_renders
       (operations_quote_id,quote_revision,filename,pdf_bytes,size_bytes,sha256,
        generation_source,source_snapshot_sha256,source_updated_at,source_snapshot_json)
     VALUES ($1,1,'b5-quote.pdf',$2,$3,$4,'actor',$4,now(),'{}')`,
    [quoteId, quotePdf, quotePdf.length, quoteHash],
  );
  const quoteBefore = await getOperationsQuoteDetail(workspaceId, quoteId);
  assert.ok(quoteBefore);
  const staleQuoteRevision = quoteBefore.quote.content_revision ?? 1;
  await recordOperationsQuoteSent(workspaceId, actor, quoteId, {
    contactId,
    deliveryMethod: "email_attachment",
  });
  const quoteSent = await snapshotQuote(quoteId);
  assert.equal(quoteSent.status, "sent");
  assert.equal(quoteSent.actual_pdf_sha, quoteSent.stored_pdf_sha);
  await rejectsArtifact(() =>
    updateOperationsQuote(workspaceId, actor, quoteId, {
      scopeSummary: "Stale overwrite",
      expectedRevision: staleQuoteRevision,
    }),
  );
  await rejectsSql(
    `UPDATE operations_quotes SET scope_summary='SQL bypass' WHERE id=$1`,
    [quoteId],
  );
  await rejectsSql(
    `UPDATE operations_quote_items SET unit_price_minor=1 WHERE id=$1`,
    [quoteItem.rows[0].id],
  );
  await rejectsSql(
    `INSERT INTO operations_quote_items (quote_id,title,quantity,unit_price_minor,line_total_minor) VALUES ($1,'SQL bypass',1,1,1)`,
    [quoteId],
  );
  await rejectsSql(
    `DELETE FROM operations_quote_access_requirements WHERE id=$1`,
    [requirement.rows[0].id],
  );
  await rejectsSql(
    `UPDATE operations_quote_pdf_renders SET filename='SQL bypass.pdf' WHERE operations_quote_id=$1`,
    [quoteId],
  );
  await rejectsSql(
    `DELETE FROM operations_quote_pdf_renders WHERE operations_quote_id=$1`,
    [quoteId],
  );
  await rejectsSql(`DELETE FROM operations_quotes WHERE id=$1`, [quoteId]);
  await recordOperationsQuoteAccepted(workspaceId, actor, quoteId, {
    acceptedAt: new Date(),
    acceptanceMethod: "email",
    contactId,
    totalMinorConfirmed: 12500,
    selectedItemsConfirmed: true,
    freezeConfirmed: true,
  });
  const quoteAccepted = await snapshotQuote(quoteId);
  assert.equal(quoteAccepted.status, "accepted");
  assert.deepEqual(
    quoteAccepted.frozen_render_json,
    quoteSent.frozen_render_json,
  );
  assert.deepEqual(quoteAccepted.pdf_bytes, quoteSent.pdf_bytes);
  const quoteRace = await Promise.all([
    createRevisedOperationsQuote(workspaceId, actor, quoteId),
    createRevisedOperationsQuote(workspaceId, actor, quoteId),
  ]);
  assert.equal(
    quoteRace.filter((value) => typeof value !== "string").length,
    1,
  );
  assert.equal(
    quoteRace.filter((value) => value === "quote_revision_not_latest").length,
    1,
  );
  const revisedQuote = quoteRace.find((value) => typeof value !== "string");
  assert.ok(revisedQuote && typeof revisedQuote !== "string");
  assert.equal(revisedQuote.quote.revision_number, 2);
  assert.equal(revisedQuote.quote.supersedes_quote_id, quoteId);
  assert.equal(revisedQuote.items.length, 1);
  assert.equal(revisedQuote.accessRequirements.length, 1);
  assert.equal(revisedQuote.quote.frozen_render_json, null);

  const communication = await db.query(
    `INSERT INTO operations_communications (
       business_id,contact_id,direction,channel,status,subject,body,preheader,
       html_document,plain_text_body,sender_name,sender_email,recipient_name,
       recipient_email,template_snapshot_json
     ) VALUES ($1,$2,'outbound','email','ready','B5 communication','Original body',
       'Original preheader','<p>Original body</p>','Original body','B5 Actor',
       'b5-actor@scanlark.test','Synthetic Client','client@scanlark.test','{}')
     RETURNING id,content_revision`,
    [businessId, contactId],
  );
  const communicationId = communication.rows[0].id;
  const staleCommunicationRevision = communication.rows[0].content_revision;
  await markOperationsCommunicationSent(
    workspaceId,
    actor,
    businessId,
    communicationId,
  );
  await rejectsArtifact(() =>
    updateOperationsCommunication(
      workspaceId,
      actor,
      businessId,
      communicationId,
      {
        body: "Stale overwrite",
        expectedRevision: staleCommunicationRevision,
      },
    ),
  );
  await rejectsSql(
    `UPDATE operations_communications SET subject='SQL bypass' WHERE id=$1`,
    [communicationId],
  );
  await rejectsSql(
    `UPDATE operations_communications SET html_document='<p>SQL bypass</p>' WHERE id=$1`,
    [communicationId],
  );
  await rejectsSql(
    `UPDATE operations_communications SET recipient_email='other@scanlark.test' WHERE id=$1`,
    [communicationId],
  );
  await rejectsSql(
    `UPDATE operations_communications SET quote_id=$2 WHERE id=$1`,
    [communicationId, quoteId],
  );
  await rejectsSql(`DELETE FROM operations_communications WHERE id=$1`, [
    communicationId,
  ]);
  await db.query(
    `UPDATE operations_communications SET follow_up_at=now() WHERE id=$1`,
    [communicationId],
  );

  const lineage = await db.query(
    `SELECT
       (SELECT count(*) FROM operations_reports WHERE supersedes_report_id=$1)::int AS report_successors,
       (SELECT count(*) FROM operations_quotes WHERE supersedes_quote_id=$2)::int AS quote_successors`,
    [reportId, quoteId],
  );
  assert.deepEqual(lineage.rows[0], {
    report_successors: 1,
    quote_successors: 1,
  });
  console.log(
    JSON.stringify({
      result: "Historical evidence lifecycle closure passed",
      directSqlRejections,
      reportRevisionRace: "one successor",
      quoteRevisionRace: "one successor",
      staleReportSave: "artifact_immutable",
      staleQuoteSave: "artifact_immutable",
      staleCommunicationSave: "artifact_immutable",
    }),
  );
} finally {
  await db.end();
}
