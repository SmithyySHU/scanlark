import { isValidEmailAddress } from "./validation";

export type OperationsEmailRealSendMode = "disabled" | "allowlist" | "live";
export type OperationsEmailSmtpSecurity = "tls" | "starttls";

const FIXED_SMTP_FROM_NAME = "Connor Smith";
const FIXED_SMTP_FROM_ADDRESS = "connor@scanlark.com";

export type OperationsEmailSmtpConfig = {
  configured: boolean;
  errors: string[];
  host: string;
  port: number;
  security: OperationsEmailSmtpSecurity;
  username: string;
  password: string;
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  socketTimeoutMs: number;
  fromName: string;
  fromAddress: string;
  replyToAddress: string;
  testAllowedRecipients: Set<string>;
  realSendMode: OperationsEmailRealSendMode;
  realSendAllowedRecipients: Set<string>;
  maxAutomaticAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
  workerPollMs: number;
  workerLeaseSeconds: number;
  readinessIntervalMs: number;
};

function boundedPositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback;
}

function emailSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => isValidEmailAddress(item)),
  );
}

export function getOperationsEmailSmtpConfig(
  env: NodeJS.ProcessEnv = process.env,
): OperationsEmailSmtpConfig {
  const host = env.OPERATIONS_EMAIL_SMTP_HOST?.trim() ?? "";
  const username = env.OPERATIONS_EMAIL_SMTP_USERNAME?.trim() ?? "";
  const password = env.OPERATIONS_EMAIL_SMTP_PASSWORD ?? "";
  const port = boundedPositiveInt(
    env.OPERATIONS_EMAIL_SMTP_PORT,
    587,
    1,
    65535,
  );
  const securityValue =
    env.OPERATIONS_EMAIL_SMTP_SECURITY?.trim().toLowerCase() || "starttls";
  const security: OperationsEmailSmtpSecurity =
    securityValue === "tls" ? "tls" : "starttls";
  const modeValue = env.OPERATIONS_EMAIL_REAL_SEND_MODE?.trim().toLowerCase();
  const realSendMode: OperationsEmailRealSendMode =
    modeValue === "allowlist" || modeValue === "live" ? modeValue : "disabled";
  const configuredFromName =
    env.OPERATIONS_EMAIL_SMTP_FROM_NAME?.trim() || FIXED_SMTP_FROM_NAME;
  const configuredFromAddress =
    env.OPERATIONS_EMAIL_SMTP_FROM_ADDRESS?.trim().toLowerCase() ||
    FIXED_SMTP_FROM_ADDRESS;
  const fromName = FIXED_SMTP_FROM_NAME;
  const fromAddress = FIXED_SMTP_FROM_ADDRESS;
  const replyToAddress =
    env.OPERATIONS_EMAIL_SMTP_REPLY_TO_ADDRESS?.trim().toLowerCase() ||
    "contact@scanlark.com";
  const errors: string[] = [];
  if (!host) errors.push("smtp_host_missing");
  if (!username) errors.push("smtp_username_missing");
  if (!password) errors.push("smtp_password_missing");
  if (securityValue !== "tls" && securityValue !== "starttls")
    errors.push("smtp_security_invalid");
  if (
    configuredFromName !== FIXED_SMTP_FROM_NAME ||
    configuredFromAddress !== FIXED_SMTP_FROM_ADDRESS
  ) {
    errors.push("smtp_from_identity_must_remain_fixed");
  }
  if (!isValidEmailAddress(fromAddress)) errors.push("smtp_from_invalid");
  if (!isValidEmailAddress(replyToAddress))
    errors.push("smtp_reply_to_invalid");
  if (username && username.toLowerCase() !== fromAddress) {
    errors.push("smtp_envelope_sender_must_match_from");
  }
  return {
    configured: errors.length === 0,
    errors,
    host,
    port,
    security,
    username,
    password,
    connectionTimeoutMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_CONNECTION_TIMEOUT_MS,
      10_000,
      1_000,
      60_000,
    ),
    greetingTimeoutMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_GREETING_TIMEOUT_MS,
      10_000,
      1_000,
      60_000,
    ),
    socketTimeoutMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_SOCKET_TIMEOUT_MS,
      30_000,
      2_000,
      120_000,
    ),
    fromName,
    fromAddress,
    replyToAddress,
    testAllowedRecipients: emailSet(
      env.OPERATIONS_EMAIL_TEST_ALLOWED_RECIPIENTS,
    ),
    realSendMode,
    realSendAllowedRecipients: emailSet(
      env.OPERATIONS_EMAIL_REAL_SEND_ALLOWED_RECIPIENTS,
    ),
    maxAutomaticAttempts: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_MAX_AUTOMATIC_ATTEMPTS,
      3,
      1,
      10,
    ),
    retryBaseSeconds: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_RETRY_BASE_SECONDS,
      30,
      5,
      3600,
    ),
    retryMaxSeconds: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_RETRY_MAX_SECONDS,
      900,
      30,
      86_400,
    ),
    workerPollMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_WORKER_POLL_MS,
      1500,
      250,
      60_000,
    ),
    workerLeaseSeconds: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_WORKER_LEASE_SECONDS,
      120,
      30,
      900,
    ),
    readinessIntervalMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SMTP_READINESS_INTERVAL_MS,
      300_000,
      30_000,
      3_600_000,
    ),
  };
}

export function deriveOperationsEmailTestRecipient(
  actorEmail: string,
  config: Pick<OperationsEmailSmtpConfig, "testAllowedRecipients">,
) {
  const normalized = actorEmail.trim().toLowerCase();
  return config.testAllowedRecipients.has(normalized) ? normalized : null;
}

export function operationsEmailRealSendPolicy(
  recipient: string,
  config: Pick<
    OperationsEmailSmtpConfig,
    "realSendMode" | "realSendAllowedRecipients"
  >,
) {
  const normalized = recipient.trim().toLowerCase();
  if (config.realSendMode === "disabled") {
    return { allowed: false, reason: "real_send_disabled" } as const;
  }
  if (
    config.realSendMode === "allowlist" &&
    !config.realSendAllowedRecipients.has(normalized)
  ) {
    return { allowed: false, reason: "recipient_not_allowlisted" } as const;
  }
  return { allowed: true, reason: null } as const;
}

export function operationsEmailRetryDelayMs(
  automaticAttemptCount: number,
  config: Pick<
    OperationsEmailSmtpConfig,
    "retryBaseSeconds" | "retryMaxSeconds"
  >,
) {
  const exponent = Math.max(0, automaticAttemptCount - 1);
  return (
    Math.min(config.retryMaxSeconds, config.retryBaseSeconds * 2 ** exponent) *
    1000
  );
}
