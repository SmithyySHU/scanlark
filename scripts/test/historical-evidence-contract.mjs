import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("B4 verification requires a loopback PostgreSQL host");
}
if (!/test|audit|verify/i.test(parsed.pathname.slice(1))) {
  throw new Error("B4 verification requires a disposable database name");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("B4 verification cannot run in production");
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

async function rejected(
  statement,
  values = [],
  expected = /scanlark_|violates (check|unique) constraint/,
) {
  await assert.rejects(client.query(statement, values), expected);
}

try {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const otherWorkspaceId = randomUUID();
  const businessId = randomUUID();
  const otherBusinessId = randomUUID();
  const siteId = randomUUID();
  const scanRunId = randomUUID();
  await client.query(
    `INSERT INTO users (id,email,password_hash) VALUES ($1,$2,'b4-test')`,
    [userId, `b4-${userId}@scanlark.test`],
  );
  await client.query(
    `INSERT INTO internal_workspaces (id,name,code) VALUES ($1,'B4 verify',$2),($3,'B4 other',$4)`,
    [
      workspaceId,
      `b4-${workspaceId}`,
      otherWorkspaceId,
      `b4-${otherWorkspaceId}`,
    ],
  );
  await client.query(
    `INSERT INTO operations_businesses (id,name,internal_workspace_id,created_by_user_id)
     VALUES ($1,'B4 client',$2,$3),($4,'B4 other client',$5,$3)`,
    [businessId, workspaceId, userId, otherBusinessId, otherWorkspaceId],
  );
  await client.query(
    `INSERT INTO sites (id,url,user_id) VALUES ($1,'https://b4.scanlark.test',$2)`,
    [siteId, userId],
  );
  await client.query(
    `INSERT INTO scan_runs (id,site_id,status,start_url,finished_at)
     VALUES ($1,$2,'completed','https://b4.scanlark.test',now())`,
    [scanRunId, siteId],
  );

  await rejected(
    `INSERT INTO operations_reports (business_id,site_id,scan_run_id,title,status,sent_at)
     VALUES ($1,$2,$3,'Invalid historical report','sent',now())`,
    [businessId, siteId, scanRunId],
  );
  await rejected(
    `INSERT INTO operations_quotes (business_id,revision_series_id,revision_number,quote_number,title,status,sent_at)
     VALUES ($1,$2,1,$3,'Invalid historical quote','sent',now())`,
    [businessId, randomUUID(), `B4-${randomUUID()}`],
  );
  await rejected(
    `INSERT INTO operations_communications (business_id,status,body) VALUES ($1,'sent','Missing timestamp')`,
    [businessId],
  );
  await rejected(
    `INSERT INTO operations_communications (business_id,status,body) VALUES ($1,'received','Missing timestamp')`,
    [businessId],
  );

  const reportId = randomUUID();
  await client.query(
    `INSERT INTO operations_reports (id,business_id,site_id,scan_run_id,title,status,frozen_render_json,frozen_at,sent_at)
     VALUES ($1,$2,$3,$4,'Frozen report','draft',$5::jsonb,now(),now())`,
    [
      reportId,
      businessId,
      siteId,
      scanRunId,
      JSON.stringify({ report: "frozen" }),
    ],
  );
  const reportFinding = await client.query(
    `INSERT INTO operations_report_findings
       (operations_report_id,source_type,category,original_severity,client_priority,title)
     VALUES ($1,'manual','content','medium','important','Frozen finding') RETURNING id`,
    [reportId],
  );
  const reportPdf = Buffer.from("B4 report PDF");
  const reportHash = createHash("sha256").update(reportPdf).digest("hex");
  const reportRender = await client.query(
    `INSERT INTO operations_report_pdf_renders
       (operations_report_id,filename,pdf_bytes,content_type,size_bytes,sha256,source_version,source_snapshot_sha256,generation_source)
     VALUES ($1,'report.pdf',$2,'application/pdf',$3,$4,'b4',$4,'actor') RETURNING id`,
    [reportId, reportPdf, reportPdf.length, reportHash],
  );
  await client.query(
    `UPDATE operations_reports SET status='sent' WHERE id=$1`,
    [reportId],
  );
  await rejected(`UPDATE operations_reports SET title='Changed' WHERE id=$1`, [
    reportId,
  ]);
  await rejected(
    `UPDATE operations_report_findings SET title='Changed' WHERE id=$1`,
    [reportFinding.rows[0].id],
  );
  await rejected(`DELETE FROM operations_report_findings WHERE id=$1`, [
    reportFinding.rows[0].id,
  ]);
  await rejected(
    `UPDATE operations_report_pdf_renders SET filename='changed.pdf' WHERE id=$1`,
    [reportRender.rows[0].id],
  );
  await rejected(`DELETE FROM operations_report_pdf_renders WHERE id=$1`, [
    reportRender.rows[0].id,
  ]);
  await client.query(
    `UPDATE operations_reports SET status='client_replied',follow_up_at=now() WHERE id=$1`,
    [reportId],
  );
  assert.deepEqual(
    (
      await client.query(
        `SELECT frozen_render_json FROM operations_reports WHERE id=$1`,
        [reportId],
      )
    ).rows[0].frozen_render_json,
    { report: "frozen" },
  );

  const reportRevisionId = randomUUID();
  await client.query(
    `INSERT INTO operations_reports
       (id,business_id,site_id,scan_run_id,title,version_number,supersedes_report_id)
     VALUES ($1,$2,$3,$4,'Editable revision',2,$5)`,
    [reportRevisionId, businessId, siteId, scanRunId, reportId],
  );
  await client.query(
    `UPDATE operations_reports SET title='Edited revision' WHERE id=$1`,
    [reportRevisionId],
  );
  await rejected(
    `INSERT INTO operations_reports
       (business_id,site_id,scan_run_id,title,version_number,supersedes_report_id)
     VALUES ($1,$2,$3,'Branch',2,$4)`,
    [businessId, siteId, scanRunId, reportId],
  );
  await rejected(
    `INSERT INTO operations_reports
       (business_id,site_id,scan_run_id,title,version_number,supersedes_report_id)
     VALUES ($1,$2,$3,'Cross workspace',2,$4)`,
    [otherBusinessId, siteId, scanRunId, reportId],
  );

  const quoteId = randomUUID();
  const quoteSeriesId = randomUUID();
  await client.query(
    `INSERT INTO operations_quotes
       (id,business_id,revision_series_id,revision_number,quote_number,title,status,
        subtotal_minor,total_minor,frozen_render_json,frozen_at,sent_at)
     VALUES ($1,$2,$3,1,$4,'Frozen quote','draft',1000,1000,$5::jsonb,now(),now())`,
    [
      quoteId,
      businessId,
      quoteSeriesId,
      `B4-${randomUUID()}`,
      JSON.stringify({ quote: "frozen" }),
    ],
  );
  const quoteItem = await client.query(
    `INSERT INTO operations_quote_items (quote_id,title,quantity,unit_price_minor,line_total_minor)
     VALUES ($1,'Frozen item',1,1000,1000) RETURNING id`,
    [quoteId],
  );
  const quotePdf = Buffer.from("B4 quote PDF");
  const quoteHash = createHash("sha256").update(quotePdf).digest("hex");
  const quoteRender = await client.query(
    `INSERT INTO operations_quote_pdf_renders
       (operations_quote_id,quote_revision,filename,pdf_bytes,size_bytes,sha256,generation_source,
        source_snapshot_sha256,source_updated_at,source_snapshot_json)
     VALUES ($1,1,'quote.pdf',$2,$3,$4,'actor',$4,now(),'{}') RETURNING id`,
    [quoteId, quotePdf, quotePdf.length, quoteHash],
  );
  await client.query(`UPDATE operations_quotes SET status='sent' WHERE id=$1`, [
    quoteId,
  ]);
  await rejected(
    `UPDATE operations_quotes SET scope_summary='Changed' WHERE id=$1`,
    [quoteId],
  );
  await rejected(
    `UPDATE operations_quote_items SET unit_price_minor=2000 WHERE id=$1`,
    [quoteItem.rows[0].id],
  );
  await rejected(`DELETE FROM operations_quote_items WHERE id=$1`, [
    quoteItem.rows[0].id,
  ]);
  await rejected(
    `UPDATE operations_quote_pdf_renders SET filename='changed.pdf' WHERE id=$1`,
    [quoteRender.rows[0].id],
  );
  await rejected(`DELETE FROM operations_quote_pdf_renders WHERE id=$1`, [
    quoteRender.rows[0].id,
  ]);
  await client.query(
    `UPDATE operations_quotes SET status='accepted',accepted_at=now() WHERE id=$1`,
    [quoteId],
  );
  assert.deepEqual(
    (
      await client.query(
        `SELECT frozen_render_json FROM operations_quotes WHERE id=$1`,
        [quoteId],
      )
    ).rows[0].frozen_render_json,
    { quote: "frozen" },
  );

  const quoteRevisionId = randomUUID();
  await client.query(
    `INSERT INTO operations_quotes
       (id,business_id,revision_series_id,revision_number,supersedes_quote_id,quote_number,title)
     VALUES ($1,$2,$3,2,$4,$5,'Editable quote revision')`,
    [quoteRevisionId, businessId, quoteSeriesId, quoteId, `B4-${randomUUID()}`],
  );
  await client.query(
    `UPDATE operations_quotes SET title='Edited quote revision' WHERE id=$1`,
    [quoteRevisionId],
  );
  await rejected(
    `INSERT INTO operations_quotes
       (business_id,revision_series_id,revision_number,supersedes_quote_id,quote_number,title)
     VALUES ($1,$2,2,$3,$4,'Branch quote')`,
    [businessId, quoteSeriesId, quoteId, `B4-${randomUUID()}`],
  );
  await rejected(
    `INSERT INTO operations_quotes
       (business_id,revision_series_id,revision_number,supersedes_quote_id,quote_number,title)
     VALUES ($1,$2,2,$3,$4,'Cross workspace quote')`,
    [otherBusinessId, quoteSeriesId, quoteId, `B4-${randomUUID()}`],
  );

  const manualCommunication = await client.query(
    `INSERT INTO operations_communications (business_id,direction,channel,status,subject,body)
     VALUES ($1,'outbound','email','draft','Manual','Manual body') RETURNING id`,
    [businessId],
  );
  await client.query(
    `UPDATE operations_communications SET status='sent',sent_at=now(),occurred_at=now() WHERE id=$1`,
    [manualCommunication.rows[0].id],
  );
  await rejected(
    `UPDATE operations_communications SET body='Changed' WHERE id=$1`,
    [manualCommunication.rows[0].id],
  );
  await rejected(
    `UPDATE operations_communications SET recipient_email='changed@example.test' WHERE id=$1`,
    [manualCommunication.rows[0].id],
  );
  await client.query(
    `UPDATE operations_communications SET follow_up_at=now(),follow_up_completed_at=now() WHERE id=$1`,
    [manualCommunication.rows[0].id],
  );
  await rejected(`DELETE FROM operations_communications WHERE id=$1`, [
    manualCommunication.rows[0].id,
  ]);

  const emailCommunication = await client.query(
    `INSERT INTO operations_communications
       (business_id,direction,channel,status,subject,body,html_document,plain_text_body,
        sender_email,recipient_email,template_snapshot_json,sent_at,occurred_at,external_message_id)
     VALUES ($1,'outbound','email','sent','Email final','Email final','<p>Email final</p>',
       'Email final','sender@example.test','client@example.test',$2::jsonb,now(),now(),$3)
     RETURNING id`,
    [
      businessId,
      JSON.stringify({
        operationsEmail: { messageId: randomUUID(), deliveryId: randomUUID() },
      }),
      `<${randomUUID()}@scanlark.test>`,
    ],
  );
  await rejected(
    `UPDATE operations_communications SET html_document='<p>Changed</p>' WHERE id=$1`,
    [emailCommunication.rows[0].id],
  );

  await rejected(`DELETE FROM operations_reports WHERE id=$1`, [reportId]);
  await rejected(`DELETE FROM operations_quotes WHERE id=$1`, [quoteId]);

  console.log("Historical evidence database contract passed");
} finally {
  await client.end();
}
