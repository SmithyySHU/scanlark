import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("./routes/operations.ts", import.meta.url),
  "utf8",
);
const repositorySource = readFileSync(
  new URL("../../../packages/db/src/operationsServices.ts", import.meta.url),
  "utf8",
);

test("managed-service POST returns the transaction-verified repository detail", () => {
  const route = routeSource.slice(
    routeSource.indexOf('router.post("/services"'),
    routeSource.indexOf('router.get("/services/:serviceId"'),
  );
  assert.match(route, /await createOperationsClientService\(/);
  assert.match(route, /return res\.status\(201\)\.json\(\{ service:/);
  assert.match(route, /operations_service_create_failed/);
});

test("managed-service creation commits after required activity, audit and detail", () => {
  const creation = repositorySource.slice(
    repositorySource.indexOf(
      "export async function createOperationsClientService(",
    ),
    repositorySource.indexOf(
      "export async function listOperationsClientServices(",
    ),
  );
  const activity = creation.indexOf("await addActivity(");
  const audit = creation.indexOf("await recordAdminAuditLog(");
  const detail = creation.indexOf("await getOperationsClientServiceDetail(");
  const commit = creation.indexOf('await client.query("COMMIT")');
  assert.ok(activity > 0 && activity < commit);
  assert.ok(audit > activity && audit < commit);
  assert.ok(detail > audit && detail < commit);
  assert.match(creation, /if \(transactionOpen\)/);
  assert.doesNotMatch(
    creation.slice(commit),
    /await (addActivity|recordAdminAuditLog|getOperationsClientServiceDetail)/,
  );
});

test("managed-service detail distinguishes not found from repository failure", () => {
  const route = routeSource.slice(
    routeSource.indexOf('router.get("/services/:serviceId"'),
    routeSource.indexOf('router.patch("/services/:serviceId"'),
  );
  assert.match(route, /if \(!service\)[\s\S]*404, "not_found"/);
  assert.match(route, /catch \(err\)/);
  assert.match(route, /Operations service detail failed/);
  assert.match(route, /500,[\s\S]*"operations_service_detail_failed"/);
});

test("managed-service list parses ended and archived visibility independently", () => {
  const parser = routeSource.slice(
    routeSource.indexOf("function parseClientServiceListOptions"),
    routeSource.indexOf("async function getCommunicationOr404"),
  );
  assert.match(parser, /includeEnded: req\.query\.includeEnded === "true"/);
  assert.match(
    parser,
    /includeArchived: req\.query\.includeArchived === "true"/,
  );
});
