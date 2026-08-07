import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationsEmailImapConfig,
  getOperationsEmailSmtpConfig,
} from "@scanlark/db";
import { tickOperationsEmailCrmFinalisation } from "./operationsEmailFinalisation";
import { tickOperationsEmailSentCopy } from "./operationsEmailSentCopy";
import {
  createOperationsEmailSmtpTickState,
  tickOperationsEmailSmtp,
} from "./operationsEmailWorker";

test("Email ticks disable only their unavailable configured subsystem", async () => {
  const smtp = getOperationsEmailSmtpConfig({});
  const imap = getOperationsEmailImapConfig({});
  assert.deepEqual(
    await tickOperationsEmailSmtp({
      workerId: "test-smtp",
      config: smtp,
      transport: null,
      state: createOperationsEmailSmtpTickState(),
    }),
    { kind: "disabled", safeReason: "smtp_configuration_unavailable" },
  );
  assert.deepEqual(
    await tickOperationsEmailSentCopy({
      workerId: "test-imap",
      config: imap,
    }),
    { kind: "disabled", safeReason: "imap_configuration_unavailable" },
  );
});

test("CRM finalisation tick honours abort without SMTP or database work", async () => {
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(
    await tickOperationsEmailCrmFinalisation({
      workerId: "test-crm",
      signal: controller.signal,
    }),
    { kind: "idle" },
  );
});
