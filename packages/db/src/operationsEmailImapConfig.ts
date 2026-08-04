export type OperationsEmailImapSecurityMode = "tls" | "starttls";

export type OperationsEmailImapConfig = {
  configured: boolean;
  errors: string[];
  host: string;
  port: number;
  securityMode: OperationsEmailImapSecurityMode;
  username: string;
  password: string;
  sentMailbox: string | null;
  connectionTimeoutMs: number;
  socketTimeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  workerPollMs: number;
  workerLeaseSeconds: number;
  mailboxCacheMs: number;
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

function safeMailbox(value: string | undefined) {
  const mailbox = value?.trim();
  if (!mailbox) return null;
  if (mailbox.length > 500 || /[\r\n\u0000-\u001f]/.test(mailbox)) return null;
  return mailbox;
}

export function getOperationsEmailImapConfig(
  env: NodeJS.ProcessEnv = process.env,
): OperationsEmailImapConfig {
  const host = env.OPERATIONS_EMAIL_IMAP_HOST?.trim() ?? "";
  const username = env.OPERATIONS_EMAIL_IMAP_USERNAME?.trim() ?? "";
  const password = env.OPERATIONS_EMAIL_IMAP_PASSWORD ?? "";
  const securityValue =
    env.OPERATIONS_EMAIL_IMAP_SECURITY_MODE?.trim().toLowerCase() || "tls";
  const securityMode: OperationsEmailImapSecurityMode =
    securityValue === "starttls" ? "starttls" : "tls";
  const rawMailbox = env.OPERATIONS_EMAIL_IMAP_SENT_MAILBOX;
  const sentMailbox = safeMailbox(rawMailbox);
  const errors: string[] = [];
  if (!host) errors.push("imap_host_missing");
  if (!username) errors.push("imap_username_missing");
  if (!password) errors.push("imap_password_missing");
  if (securityValue !== "tls" && securityValue !== "starttls")
    errors.push("imap_security_mode_invalid");
  if (rawMailbox?.trim() && !sentMailbox)
    errors.push("imap_sent_mailbox_invalid");
  return {
    configured: errors.length === 0,
    errors,
    host,
    port: boundedPositiveInt(
      env.OPERATIONS_EMAIL_IMAP_PORT,
      securityMode === "tls" ? 993 : 143,
      1,
      65535,
    ),
    securityMode,
    username,
    password,
    sentMailbox,
    connectionTimeoutMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_IMAP_CONNECTION_TIMEOUT_MS,
      10_000,
      1_000,
      60_000,
    ),
    socketTimeoutMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_IMAP_SOCKET_TIMEOUT_MS,
      30_000,
      2_000,
      120_000,
    ),
    maxAttempts: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_MAX_ATTEMPTS,
      3,
      1,
      10,
    ),
    retryBaseMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_RETRY_BASE_MS,
      30_000,
      1_000,
      3_600_000,
    ),
    retryMaxMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_RETRY_MAX_MS,
      900_000,
      10_000,
      86_400_000,
    ),
    workerPollMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_WORKER_POLL_MS,
      2_000,
      250,
      60_000,
    ),
    workerLeaseSeconds: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_WORKER_LEASE_SECONDS,
      120,
      30,
      900,
    ),
    mailboxCacheMs: boundedPositiveInt(
      env.OPERATIONS_EMAIL_SENT_COPY_MAILBOX_CACHE_MS,
      300_000,
      30_000,
      3_600_000,
    ),
  };
}

export function operationsEmailSentCopyRetryDelayMs(
  attemptCount: number,
  config: Pick<OperationsEmailImapConfig, "retryBaseMs" | "retryMaxMs">,
) {
  return Math.min(
    config.retryMaxMs,
    config.retryBaseMs * 2 ** Math.max(0, attemptCount - 1),
  );
}
