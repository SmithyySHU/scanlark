import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { Client } from "pg";
import { closeConnection } from "./client";
import { DATABASE_URL } from "./env";
import {
  createOperationsClientService,
  getOperationsClientServiceDetail,
  listOperationsClientServices,
  type OperationsClientServiceStatus,
} from "./operationsServices";

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
const sqlKey = key.replace(/-/g, "");
const actor = { id: "", email: `service-create-${key}@scanlark.test` };
let workspaceA = "";
let workspaceB = "";
let businessA = "";
let businessAOther = "";
let businessB = "";
let contactA = "";
let contactAOther = "";
let contactB = "";
let siteA = "";
let siteAOther = "";
let siteB = "";
let planA = "";
let planB = "";
const createdServiceIds: string[] = [];

async function serviceCount(name: string) {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM operations_client_services WHERE name = $1`,
    [name],
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function insertService(input: {
  businessId: string;
  name: string;
  status: OperationsClientServiceStatus;
  contactId?: string | null;
  planId?: string | null;
  archived?: boolean;
}) {
  const result = await db.query<{ id: string }>(
    `INSERT INTO operations_client_services (
       business_id, contact_id, service_plan_id, service_number, name, status,
       zero_cost_confirmed, start_date, included_scope, excluded_scope,
       custom_terms, created_by_user_id, archived_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, true,
       CASE WHEN $6 = 'draft' THEN NULL ELSE current_date END,
       'Included', 'Excluded', 'Test fixture terms', $7,
       CASE WHEN $8 THEN now() ELSE NULL END
     ) RETURNING id`,
    [
      input.businessId,
      input.contactId ?? null,
      input.planId ?? null,
      `SL-T2-${randomUUID()}`,
      input.name,
      input.status,
      actor.id,
      input.archived === true,
    ],
  );
  const id = result.rows[0].id;
  createdServiceIds.push(id);
  return id;
}

before(async () => {
  if (!enabled) return;
  await db.connect();
  const user = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, 'service-create-test') RETURNING id`,
    [actor.email],
  );
  actor.id = user.rows[0].id;
  const workspaces = await db.query<{ id: string }>(
    `INSERT INTO internal_workspaces (name, code)
     VALUES ($1, $2), ($3, $4) RETURNING id`,
    [
      `Service workspace A ${key}`,
      `service-a-${key}`,
      `Service workspace B ${key}`,
      `service-b-${key}`,
    ],
  );
  workspaceA = workspaces.rows[0].id;
  workspaceB = workspaces.rows[1].id;
  const businesses = await db.query<{ id: string }>(
    `INSERT INTO operations_businesses (internal_workspace_id, name, created_by_user_id)
     VALUES ($1, $3, $5), ($1, $4, $5), ($2, $6, $5) RETURNING id`,
    [
      workspaceA,
      workspaceB,
      `Service business A ${key}`,
      `Service business A other ${key}`,
      actor.id,
      `Service business B ${key}`,
    ],
  );
  businessA = businesses.rows[0].id;
  businessAOther = businesses.rows[1].id;
  businessB = businesses.rows[2].id;
  const contacts = await db.query<{ id: string }>(
    `INSERT INTO operations_contacts (business_id, first_name, email)
     VALUES ($1, 'Primary', $4), ($2, 'Other', $5), ($3, 'Foreign', $6)
     RETURNING id`,
    [
      businessA,
      businessAOther,
      businessB,
      `primary-${key}@example.test`,
      `other-${key}@example.test`,
      `foreign-${key}@example.test`,
    ],
  );
  contactA = contacts.rows[0].id;
  contactAOther = contacts.rows[1].id;
  contactB = contacts.rows[2].id;
  const sites = await db.query<{ id: string }>(
    `INSERT INTO sites (url, user_id)
     VALUES ($1, $4), ($2, $4), ($3, $4) RETURNING id`,
    [
      `https://service-a-${key}.test`,
      `https://service-a-other-${key}.test`,
      `https://service-b-${key}.test`,
      actor.id,
    ],
  );
  siteA = sites.rows[0].id;
  siteAOther = sites.rows[1].id;
  siteB = sites.rows[2].id;
  await db.query(
    `INSERT INTO operations_business_sites (business_id, site_id, created_by_user_id)
     VALUES ($1, $4, $7), ($2, $5, $7), ($3, $6, $7)`,
    [businessA, businessAOther, businessB, siteA, siteAOther, siteB, actor.id],
  );
  const plans = await db.query<{ id: string }>(
    `INSERT INTO operations_service_plan_templates (
       internal_workspace_id, name, code, default_currency,
       default_price_minor, default_billing_cadence, default_scan_frequency,
       default_report_frequency, default_review_frequency,
       includes_uptime_monitoring, includes_issue_alerts,
       includes_monthly_report, includes_advice, includes_small_fixes,
       included_support_minutes, included_fix_count, response_target_text,
       scope_summary, included_scope, excluded_scope, created_by_user_id
     ) VALUES (
       $1, $3, $4, 'GBP', 12500, 'quarterly', 'fortnightly',
       'quarterly', 'annual', true, true, true, true, true,
       90, 3, 'Two working days', 'Plan summary', 'Included plan scope',
       'Excluded plan scope', $5
     ), (
       $2, $6, $7, 'GBP', 9900, 'monthly', 'weekly', 'monthly',
       'quarterly', false, true, true, true, false, NULL, NULL, NULL,
       'Foreign plan', 'Foreign included', 'Foreign excluded', $5
     ) RETURNING id`,
    [
      workspaceA,
      workspaceB,
      `Integrity plan ${key}`,
      `integrity-plan-${key}`,
      actor.id,
      `Foreign plan ${key}`,
      `foreign-plan-${key}`,
    ],
  );
  planA = plans.rows[0].id;
  planB = plans.rows[1].id;
});

after(async () => {
  if (!enabled) return;
  await db.query(
    `DELETE FROM admin_audit_log
     WHERE target_id = ANY($1::text[])
        OR admin_email = $2`,
    [createdServiceIds, actor.email],
  );
  await db.query(
    `DELETE FROM operations_client_services WHERE id = ANY($1::uuid[])`,
    [createdServiceIds],
  );
  await db.query(
    `DELETE FROM operations_service_plan_templates WHERE id = ANY($1::uuid[])`,
    [[planA, planB]],
  );
  await db.query(
    `DELETE FROM operations_businesses WHERE id = ANY($1::uuid[])`,
    [[businessA, businessAOther, businessB]],
  );
  await db.query(`DELETE FROM sites WHERE id = ANY($1::uuid[])`, [
    [siteA, siteAOther, siteB],
  ]);
  await db.query(`DELETE FROM internal_workspaces WHERE id = ANY($1::uuid[])`, [
    [workspaceA, workspaceB],
  ]);
  await db.query(`DELETE FROM users WHERE id = $1`, [actor.id]);
  await db.end();
  await closeConnection();
});

test("fresh service creation is atomic, plan-backed and immediately retrievable", async () => {
  if (!enabled) return;
  const name = `Atomic managed service ${key}`;
  const result = await createOperationsClientService(workspaceA, actor, {
    businessId: businessA,
    contactId: contactA,
    servicePlanId: planA,
    name,
    zeroCostConfirmed: false,
    siteIds: [siteA, siteA],
  });
  assert.equal(typeof result, "object");
  if (typeof result === "string") return;
  createdServiceIds.push(result.service.id);
  assert.equal(await serviceCount(name), 1);
  assert.equal(result.service.business_id, businessA);
  assert.equal(result.service.contact_id, contactA);
  assert.equal(result.service.service_plan_id, planA);
  assert.equal(result.service.agreed_price_minor, 12500);
  assert.equal(result.service.billing_cadence, "quarterly");
  assert.equal(result.service.scan_frequency, "fortnightly");
  assert.equal(result.service.report_frequency, "quarterly");
  assert.equal(result.service.review_frequency, "annual");
  assert.equal(result.service.included_support_minutes, 90);
  assert.equal(result.service.included_fix_count, 3);
  assert.equal(result.service.included_scope, "Included plan scope");
  assert.equal(result.sites.length, 1);
  assert.equal(result.sites[0].site_id, siteA);
  assert.equal(result.sites[0].is_primary, true);
  assert.equal(result.activities.length, 1);
  assert.equal(result.activities[0].activity_type, "service_created");
  assert.ok(
    await getOperationsClientServiceDetail(workspaceA, result.service.id),
  );
  assert.equal(
    await getOperationsClientServiceDetail(workspaceB, result.service.id),
    null,
  );
  const audit = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM admin_audit_log
     WHERE action = 'operations_client_service_created' AND target_id = $1`,
    [result.service.id],
  );
  assert.equal(Number(audit.rows[0]?.count ?? 0), 1);
});

test("invalid workspace, contact, plan and site relationships leave no service", async () => {
  if (!enabled) return;
  const cases = [
    {
      name: `Wrong workspace business ${key}`,
      input: { businessId: businessB, contactId: contactB, siteIds: [siteB] },
      expected: "business_not_found",
    },
    {
      name: `Wrong business contact ${key}`,
      input: {
        businessId: businessA,
        contactId: contactAOther,
        siteIds: [siteA],
      },
      expected: "contact_not_found",
    },
    {
      name: `Wrong workspace contact ${key}`,
      input: { businessId: businessA, contactId: contactB, siteIds: [siteA] },
      expected: "contact_not_found",
    },
    {
      name: `Wrong workspace plan ${key}`,
      input: { businessId: businessA, servicePlanId: planB, siteIds: [siteA] },
      expected: "service_plan_not_found",
    },
    {
      name: `Wrong business site ${key}`,
      input: {
        businessId: businessA,
        contactId: contactA,
        siteIds: [siteAOther],
      },
      expected: "site_not_linked_to_business",
    },
    {
      name: `Wrong workspace site ${key}`,
      input: { businessId: businessA, contactId: contactA, siteIds: [siteB] },
      expected: "site_not_linked_to_business",
    },
  ];
  for (const fixture of cases) {
    const result = await createOperationsClientService(workspaceA, actor, {
      name: fixture.name,
      zeroCostConfirmed: true,
      includedScope: "Included",
      excludedScope: "Excluded",
      ...fixture.input,
    });
    assert.equal(result, fixture.expected);
    assert.equal(await serviceCount(fixture.name), 0);
  }
});

test("former post-commit activity failure rolls back service, sites and audit", async () => {
  if (!enabled) return;
  const failureName = `Activity failure ${key}`;
  const auditBefore = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM admin_audit_log
     WHERE action = 'operations_client_service_created'
       AND metadata_json->>'businessId' = $1`,
    [businessA],
  );
  const functionName = `scanlark_service_create_failure_${sqlKey}`;
  const triggerName = `scanlark_service_create_failure_${sqlKey}`;
  await db.query(`
    CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM operations_client_services
        WHERE id = NEW.client_service_id AND name = '${failureName}'
      ) THEN
        RAISE EXCEPTION 'forced_service_creation_activity_failure';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON operations_client_service_activity
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);
  try {
    await assert.rejects(
      createOperationsClientService(workspaceA, actor, {
        businessId: businessA,
        contactId: contactA,
        servicePlanId: planA,
        name: failureName,
        siteIds: [siteA],
      }),
      /forced_service_creation_activity_failure/,
    );
  } finally {
    await db.query(
      `DROP TRIGGER IF EXISTS ${triggerName} ON operations_client_service_activity;
       DROP FUNCTION IF EXISTS ${functionName}();`,
    );
  }
  assert.equal(await serviceCount(failureName), 0);
  const residue = await db.query<{
    sites: string;
    activity: string;
    audit: string;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM operations_client_service_sites css
        JOIN operations_client_services service ON service.id = css.client_service_id
        WHERE service.name = $1)::text AS sites,
       (SELECT COUNT(*) FROM operations_client_service_activity activity
        JOIN operations_client_services service ON service.id = activity.client_service_id
        WHERE service.name = $1)::text AS activity,
       (SELECT COUNT(*) FROM admin_audit_log
        WHERE action = 'operations_client_service_created'
          AND metadata_json->>'businessId' = $2)::text AS audit`,
    [failureName, businessA],
  );
  assert.equal(Number(residue.rows[0]?.sites ?? 0), 0);
  assert.equal(Number(residue.rows[0]?.activity ?? 0), 0);
  assert.equal(
    Number(residue.rows[0]?.audit ?? 0),
    Number(auditBefore.rows[0]?.count ?? 0),
  );
});

test("central, business and detail views share canonical service visibility", async () => {
  if (!enabled) return;
  const draftId = await insertService({
    businessId: businessA,
    name: `Visible draft ${key}`,
    status: "draft",
  });
  const activeId = await insertService({
    businessId: businessA,
    contactId: contactA,
    planId: planA,
    name: `Visible active ${key}`,
    status: "active",
  });
  const pausedId = await insertService({
    businessId: businessA,
    name: `Visible paused ${key}`,
    status: "paused",
  });
  const endedId = await insertService({
    businessId: businessA,
    name: `Ended service ${key}`,
    status: "completed",
  });
  const archivedId = await insertService({
    businessId: businessA,
    name: `Archived service ${key}`,
    status: "draft",
    archived: true,
  });
  const otherBusinessId = await insertService({
    businessId: businessAOther,
    name: `Other business service ${key}`,
    status: "active",
  });
  const foreignId = await insertService({
    businessId: businessB,
    name: `Foreign workspace service ${key}`,
    status: "active",
  });
  const malformedId = await insertService({
    businessId: businessA,
    contactId: contactAOther,
    planId: planB,
    name: `Relationship mismatch ${key}`,
    status: "draft",
  });

  await db.query(
    `INSERT INTO operations_client_service_sites (
       client_service_id, site_id, is_primary, removed_at
     ) VALUES ($1, $2, true, NULL), ($1, $2, false, now())`,
    [activeId, siteA],
  );
  await db.query(
    `INSERT INTO operations_client_service_sites (
       client_service_id, site_id, is_primary
     ) VALUES ($1, $2, true)`,
    [malformedId, siteAOther],
  );

  const currentOptions = { limit: 100, offset: 0 };
  const central = await listOperationsClientServices(
    workspaceA,
    currentOptions,
  );
  const business = await listOperationsClientServices(workspaceA, {
    ...currentOptions,
    businessId: businessA,
  });
  const centralBusinessIds = central.services
    .filter((service) => service.business_id === businessA)
    .map((service) => service.id)
    .sort();
  assert.deepEqual(
    business.services.map((service) => service.id).sort(),
    centralBusinessIds,
  );
  assert.equal(
    new Set(central.services.map((service) => service.id)).size,
    central.services.length,
  );
  assert.ok(business.services.some((service) => service.id === draftId));
  assert.ok(business.services.some((service) => service.id === activeId));
  assert.ok(business.services.some((service) => service.id === pausedId));
  assert.ok(!business.services.some((service) => service.id === endedId));
  assert.ok(!business.services.some((service) => service.id === archivedId));
  assert.ok(
    !business.services.some((service) => service.id === otherBusinessId),
  );

  const active = business.services.find((service) => service.id === activeId);
  assert.equal(active?.business_name, `Service business A ${key}`);
  assert.equal(active?.plan_name, `Integrity plan ${key}`);
  assert.equal(active?.covered_site_count, 1);
  assert.equal(active?.integrity_issue_count, 0);
  const malformed = business.services.find(
    (service) => service.id === malformedId,
  );
  assert.equal(malformed?.covered_site_count, 0);
  assert.equal(malformed?.integrity_issue_count, 3);
  assert.equal(
    malformed?.diagnostic_classification,
    "relationship_integrity_violation",
  );

  const history = await listOperationsClientServices(workspaceA, {
    ...currentOptions,
    businessId: businessA,
    includeEnded: true,
  });
  assert.ok(history.services.some((service) => service.id === endedId));
  assert.ok(!history.services.some((service) => service.id === archivedId));

  const withArchived = await listOperationsClientServices(workspaceA, {
    ...currentOptions,
    businessId: businessA,
    includeEnded: true,
    includeArchived: true,
  });
  assert.ok(withArchived.services.some((service) => service.id === archivedId));

  const emptyDetail = await getOperationsClientServiceDetail(
    workspaceA,
    draftId,
  );
  assert.ok(emptyDetail);
  assert.deepEqual(emptyDetail?.sites, []);
  assert.deepEqual(emptyDetail?.usage, []);
  assert.deepEqual(emptyDetail?.activities, []);
  assert.deepEqual(emptyDetail?.reviews, []);
  assert.deepEqual(emptyDetail?.incidents, []);
  assert.deepEqual(emptyDetail?.reports, []);
  assert.deepEqual(emptyDetail?.tasks, []);
  assert.deepEqual(emptyDetail?.integrityIssues, []);
  assert.equal(emptyDetail?.diagnosticClassification, "valid_draft");

  const malformedDetail = await getOperationsClientServiceDetail(
    workspaceA,
    malformedId,
  );
  assert.deepEqual(malformedDetail?.integrityIssues.sort(), [
    "contact_business_mismatch",
    "covered_site_business_mismatch",
    "service_plan_workspace_mismatch",
  ]);
  assert.ok(
    malformedDetail?.activationIssues.includes("covered_site_required"),
  );

  const foreign = await listOperationsClientServices(workspaceB, {
    ...currentOptions,
    businessId: businessB,
  });
  assert.ok(foreign.services.some((service) => service.id === foreignId));
  assert.ok(!foreign.services.some((service) => service.id === activeId));
  assert.equal(
    await getOperationsClientServiceDetail(workspaceB, activeId),
    null,
  );
});
