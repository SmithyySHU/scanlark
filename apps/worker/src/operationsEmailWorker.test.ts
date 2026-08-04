import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workerSource = readFileSync(
  new URL("./operationsEmailWorker.ts", import.meta.url),
  "utf8",
);

test("worker persists the transmission-risk marker before handing raw MIME to Nodemailer", () => {
  const body = workerSource.slice(
    workerSource.indexOf(
      "export async function processOneOperationsEmailDelivery",
    ),
    workerSource.indexOf("export async function runOperationsEmailSmtpWorker"),
  );
  const marker = body.indexOf(
    "const transmissionMarked = await markOperationsEmailTransmissionBegun",
  );
  const submit = body.indexOf("await sendFrozenOperationsEmailMime");
  assert.ok(marker >= 0);
  assert.ok(submit > marker);
  assert.match(body, /if \(!transmissionMarked\)[\s\S]*throw new Error/);
});

test("uncertain recovery is periodic and SMTP worker contains no Checkpoint 6 work", () => {
  assert.equal(
    workerSource.includes("markExpiredOperationsEmailRiskLeasesUncertain"),
    true,
  );
  for (const forbidden of [
    "claimPendingOperationsEmailSentCopy",
    "markOperationsEmailSentCopyAppended",
    "sent_communication_id",
    "last_contacted",
    "follow_up",
    "imap",
  ]) {
    assert.equal(
      workerSource.toLowerCase().includes(forbidden.toLowerCase()),
      false,
    );
  }
});
