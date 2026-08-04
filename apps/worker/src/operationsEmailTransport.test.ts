import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyOperationsEmailSmtpError,
  sendFrozenOperationsEmailMime,
  verifyOperationsEmailTransport,
} from "./operationsEmailTransport";

test("SMTP readiness verification never submits a message", async () => {
  let verifyCalls = 0;
  let sendCalls = 0;
  const result = await verifyOperationsEmailTransport({
    verify: async () => {
      verifyCalls += 1;
      return true;
    },
    sendMail: async () => {
      sendCalls += 1;
      throw new Error("must_not_send");
    },
  } as never);
  assert.deepEqual(result, { status: "verified", safeErrorCode: null });
  assert.equal(verifyCalls, 1);
  assert.equal(sendCalls, 0);
});

test("SMTP submission passes the exact frozen MIME buffer and explicit envelope", async () => {
  const raw = Buffer.from("Message-ID: <fixed@example.test>\r\n\r\nfrozen");
  const submissions: Array<Record<string, unknown>> = [];
  const result = await sendFrozenOperationsEmailMime(
    {
      sendMail: async (options: Record<string, unknown>) => {
        submissions.push(options);
        return {
          accepted: ["client@example.com"],
          rejected: [],
          messageId: "provider-safe-id",
        };
      },
    } as never,
    {
      rawMime: raw,
      envelopeSender: "connor@scanlark.com",
      envelopeRecipient: "client@example.com",
    },
  );
  const submitted = submissions[0];
  assert.ok(submitted);
  assert.strictEqual(submitted?.raw, raw);
  assert.deepEqual(submitted?.envelope, {
    from: "connor@scanlark.com",
    to: ["client@example.com"],
  });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.acceptedRecipients, ["client@example.com"]);
});

test("authentication and permanent envelope failures require manual retry", () => {
  for (const error of [
    { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 },
    { code: "EENVELOPE", command: "RCPT TO", responseCode: 550 },
  ]) {
    const result = classifyOperationsEmailSmtpError(error, {
      automaticAttemptCount: 1,
      maxAutomaticAttempts: 3,
    });
    assert.equal(result.transmissionMayHaveBegun, false);
    assert.equal(result.retryPolicy, "manual");
  }
});

test("only conclusive transient pre-DATA failures receive bounded automatic retry", () => {
  for (const error of [
    { code: "ECONNECTION", command: "CONN" },
    { code: "ETIMEDOUT", command: "MAIL FROM" },
    { command: "RCPT TO", responseCode: 421 },
  ]) {
    const result = classifyOperationsEmailSmtpError(error, {
      automaticAttemptCount: 1,
      maxAutomaticAttempts: 3,
    });
    assert.equal(result.transmissionMayHaveBegun, false);
    assert.equal(result.failureClass, "transient_pre_acceptance");
    assert.equal(result.retryPolicy, "automatic");
  }
  const exhausted = classifyOperationsEmailSmtpError(
    { code: "ECONNECTION", command: "CONN" },
    { automaticAttemptCount: 3, maxAutomaticAttempts: 3 },
  );
  assert.equal(exhausted.retryPolicy, "manual");
});

test("DATA, post-transmission and unknown failures are uncertain and never retried", () => {
  for (const error of [
    { code: "ETIMEDOUT", command: "DATA" },
    { code: "ECONNRESET" },
    new Error("provider details are deliberately ignored"),
  ]) {
    const result = classifyOperationsEmailSmtpError(error, {
      automaticAttemptCount: 1,
      maxAutomaticAttempts: 3,
    });
    assert.equal(result.failureClass, "uncertain");
    assert.equal(result.transmissionMayHaveBegun, true);
    assert.equal(result.retryPolicy, "never");
  }
});
