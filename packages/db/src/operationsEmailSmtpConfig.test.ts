import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveOperationsEmailTestRecipient,
  getOperationsEmailSmtpConfig,
  operationsEmailRealSendPolicy,
  operationsEmailRetryDelayMs,
} from "./operationsEmailSmtpConfig";

function configuredEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    OPERATIONS_EMAIL_SMTP_HOST: "smtp.example.test",
    OPERATIONS_EMAIL_SMTP_USERNAME: "connor@scanlark.com",
    OPERATIONS_EMAIL_SMTP_PASSWORD: "test-only-secret",
    ...overrides,
  };
}

test("SMTP and real-send gates default closed", () => {
  const config = getOperationsEmailSmtpConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.realSendMode, "disabled");
  assert.equal(
    operationsEmailRealSendPolicy("client@example.com", config).allowed,
    false,
  );
});

test("fixed SMTP sender must match the authenticated envelope identity", () => {
  const config = getOperationsEmailSmtpConfig(
    configuredEnv({ OPERATIONS_EMAIL_SMTP_USERNAME: "other@example.com" }),
  );
  assert.equal(config.configured, false);
  assert.ok(config.errors.includes("smtp_envelope_sender_must_match_from"));

  const overridden = getOperationsEmailSmtpConfig(
    configuredEnv({
      OPERATIONS_EMAIL_SMTP_FROM_NAME: "Someone Else",
      OPERATIONS_EMAIL_SMTP_FROM_ADDRESS: "someone@example.com",
      OPERATIONS_EMAIL_SMTP_USERNAME: "someone@example.com",
    }),
  );
  assert.equal(overridden.configured, false);
  assert.ok(overridden.errors.includes("smtp_from_identity_must_remain_fixed"));
  assert.equal(overridden.fromName, "Connor Smith");
  assert.equal(overridden.fromAddress, "connor@scanlark.com");
});

test("test recipient is derived only from the authenticated allowlisted actor", () => {
  const config = getOperationsEmailSmtpConfig(
    configuredEnv({
      OPERATIONS_EMAIL_TEST_ALLOWED_RECIPIENTS:
        "connor@scanlark.com,support@scanlark.com",
    }),
  );
  assert.equal(
    deriveOperationsEmailTestRecipient("Connor@Scanlark.com", config),
    "connor@scanlark.com",
  );
  assert.equal(
    deriveOperationsEmailTestRecipient("support@scanlark.com", config),
    "support@scanlark.com",
  );
  assert.equal(
    deriveOperationsEmailTestRecipient("client@example.com", config),
    null,
  );
});

test("allowlist mode permits only configured real recipients", () => {
  const config = getOperationsEmailSmtpConfig(
    configuredEnv({
      OPERATIONS_EMAIL_REAL_SEND_MODE: "allowlist",
      OPERATIONS_EMAIL_REAL_SEND_ALLOWED_RECIPIENTS: "client@example.com",
    }),
  );
  assert.equal(
    operationsEmailRealSendPolicy("CLIENT@example.com", config).allowed,
    true,
  );
  assert.deepEqual(operationsEmailRealSendPolicy("other@example.com", config), {
    allowed: false,
    reason: "recipient_not_allowlisted",
  });
});

test("retry delay is exponential and bounded", () => {
  const config = { retryBaseSeconds: 30, retryMaxSeconds: 100 };
  assert.equal(operationsEmailRetryDelayMs(1, config), 30_000);
  assert.equal(operationsEmailRetryDelayMs(2, config), 60_000);
  assert.equal(operationsEmailRetryDelayMs(3, config), 100_000);
});
