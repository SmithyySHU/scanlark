import assert from "node:assert/strict";
import test from "node:test";
import {
  getOperationsEmailImapConfig,
  operationsEmailSentCopyRetryDelayMs,
} from "./operationsEmailImapConfig";

test("IMAP Sent-copy configuration defaults closed and contains no inferred mailbox", () => {
  const config = getOperationsEmailImapConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.sentMailbox, null);
  assert.ok(config.errors.includes("imap_password_missing"));
});

test("IMAP configuration accepts TLS credentials and rejects unsafe mailbox paths", () => {
  const configured = getOperationsEmailImapConfig({
    OPERATIONS_EMAIL_IMAP_HOST: "imap.example.test",
    OPERATIONS_EMAIL_IMAP_USERNAME: "connor@example.test",
    OPERATIONS_EMAIL_IMAP_PASSWORD: "test-only",
    OPERATIONS_EMAIL_IMAP_SENT_MAILBOX: "Sent Items",
  });
  assert.equal(configured.configured, true);
  assert.equal(configured.port, 993);
  assert.equal(configured.sentMailbox, "Sent Items");

  const unsafe = getOperationsEmailImapConfig({
    OPERATIONS_EMAIL_IMAP_HOST: "imap.example.test",
    OPERATIONS_EMAIL_IMAP_USERNAME: "connor@example.test",
    OPERATIONS_EMAIL_IMAP_PASSWORD: "test-only",
    OPERATIONS_EMAIL_IMAP_SENT_MAILBOX: "Sent\nInjected",
  });
  assert.equal(unsafe.configured, false);
  assert.ok(unsafe.errors.includes("imap_sent_mailbox_invalid"));
});

test("Sent-copy retry delay is exponential and bounded", () => {
  const config = { retryBaseMs: 1_000, retryMaxMs: 3_000 };
  assert.equal(operationsEmailSentCopyRetryDelayMs(1, config), 1_000);
  assert.equal(operationsEmailSentCopyRetryDelayMs(2, config), 2_000);
  assert.equal(operationsEmailSentCopyRetryDelayMs(3, config), 3_000);
});
