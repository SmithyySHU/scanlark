import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  OperationsEmailFailureClass,
  OperationsEmailRetryPolicy,
  OperationsEmailSmtpConfig,
  OperationsEmailSmtpPhase,
} from "@scanlark/db";

export type OperationsEmailTransport = Pick<
  Transporter,
  "verify" | "sendMail" | "close"
>;

export function createOperationsEmailTransport(
  config: OperationsEmailSmtpConfig,
): OperationsEmailTransport {
  if (!config.configured)
    throw new Error("operations_email_smtp_not_configured");
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.security === "tls",
    requireTLS: config.security === "starttls",
    auth: { user: config.username, pass: config.password },
    connectionTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.greetingTimeoutMs,
    socketTimeout: config.socketTimeoutMs,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: config.host,
    },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export async function verifyOperationsEmailTransport(
  transport: Pick<OperationsEmailTransport, "verify">,
) {
  try {
    const verified = await transport.verify();
    return verified
      ? ({ status: "verified", safeErrorCode: null } as const)
      : ({
          status: "unavailable",
          safeErrorCode: "smtp_verification_rejected",
        } as const);
  } catch {
    return {
      status: "unavailable",
      safeErrorCode: "smtp_verification_failed",
    } as const;
  }
}

function normalizeRecipient(value: unknown) {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (value && typeof value === "object" && "address" in value) {
    return String((value as { address: unknown }).address)
      .trim()
      .toLowerCase();
  }
  return "";
}

export async function sendFrozenOperationsEmailMime(
  transport: Pick<OperationsEmailTransport, "sendMail">,
  input: {
    rawMime: Buffer;
    envelopeSender: string;
    envelopeRecipient: string;
  },
) {
  const info = await transport.sendMail({
    envelope: {
      from: input.envelopeSender,
      to: [input.envelopeRecipient],
    },
    raw: input.rawMime,
  });
  const intended = input.envelopeRecipient.trim().toLowerCase();
  const accepted: string[] = Array.isArray(info.accepted)
    ? info.accepted
        .map((value: unknown) => normalizeRecipient(value))
        .filter(Boolean)
    : [];
  const rejected: string[] = Array.isArray(info.rejected)
    ? info.rejected
        .map((value: unknown) => normalizeRecipient(value))
        .filter(Boolean)
    : [];
  return {
    accepted: accepted.includes(intended),
    acceptedRecipients: accepted.filter((value) => value === intended),
    rejectedRecipients: rejected.filter((value) => value === intended),
    providerResponseId:
      typeof info.messageId === "string" ? info.messageId.slice(0, 300) : null,
  };
}

type NodemailerErrorShape = {
  code?: unknown;
  command?: unknown;
  responseCode?: unknown;
};

export type OperationsEmailSmtpFailureClassification = {
  smtpPhase: OperationsEmailSmtpPhase;
  failureClass: OperationsEmailFailureClass;
  retryPolicy: OperationsEmailRetryPolicy;
  transmissionMayHaveBegun: boolean;
  safeDisplayError: string;
  sanitizedProviderCode: string | null;
  sanitizedCommand: string | null;
  responseCode: number | null;
  responseClass: number | null;
};

function safeToken(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, "")
    .trim();
  return normalized ? normalized.slice(0, 100) : null;
}

export function classifyOperationsEmailSmtpError(
  error: unknown,
  input: { automaticAttemptCount: number; maxAutomaticAttempts: number },
): OperationsEmailSmtpFailureClassification {
  const record =
    error && typeof error === "object" ? (error as NodemailerErrorShape) : {};
  const code = safeToken(record.code);
  const command = safeToken(record.command);
  const responseCode =
    typeof record.responseCode === "number" &&
    record.responseCode >= 100 &&
    record.responseCode <= 599
      ? record.responseCode
      : null;
  const responseClass = responseCode ? Math.floor(responseCode / 100) : null;
  const preTransmissionCommand =
    command != null &&
    /^(CONN|CONNECT|EHLO|HELO|STARTTLS|AUTH|MAIL FROM|RCPT TO)/.test(command);
  const authentication =
    code === "EAUTH" || command?.startsWith("AUTH") === true;
  const recipientRejected =
    code === "EENVELOPE" || command?.startsWith("RCPT TO") === true;
  const connectionFailure =
    code === "ECONNECTION" || command === "CONN" || command === "CONNECT";
  const phase: OperationsEmailSmtpPhase = connectionFailure
    ? "connect"
    : preTransmissionCommand
      ? "envelope"
      : command === "DATA"
        ? "post_data"
        : "unknown";

  if (authentication) {
    return {
      smtpPhase: "envelope",
      failureClass: "configuration",
      retryPolicy: "manual",
      transmissionMayHaveBegun: false,
      safeDisplayError:
        "SMTP authentication or sender configuration must be corrected before retrying.",
      sanitizedProviderCode: code,
      sanitizedCommand: command,
      responseCode,
      responseClass,
    };
  }
  if (
    (recipientRejected && responseClass !== 4) ||
    (preTransmissionCommand && responseClass === 5)
  ) {
    return {
      smtpPhase: "envelope",
      failureClass: "permanent",
      retryPolicy: "manual",
      transmissionMayHaveBegun: false,
      safeDisplayError:
        "The mail provider rejected the envelope. Review the recipient and sender configuration before retrying.",
      sanitizedProviderCode: code,
      sanitizedCommand: command,
      responseCode,
      responseClass,
    };
  }
  const conclusivelyTransient =
    connectionFailure ||
    (preTransmissionCommand && responseClass === 4) ||
    (preTransmissionCommand && code === "ETIMEDOUT");
  if (conclusivelyTransient) {
    const canRetry = input.automaticAttemptCount < input.maxAutomaticAttempts;
    return {
      smtpPhase: phase,
      failureClass: "transient_pre_acceptance",
      retryPolicy: canRetry ? "automatic" : "manual",
      transmissionMayHaveBegun: false,
      safeDisplayError: canRetry
        ? "The outgoing mail provider is temporarily unavailable. A bounded automatic retry is scheduled."
        : "Automatic SMTP attempts are exhausted. Manual review is required.",
      sanitizedProviderCode: code,
      sanitizedCommand: command,
      responseCode,
      responseClass,
    };
  }
  return {
    smtpPhase: phase === "post_data" ? "post_data" : "unknown",
    failureClass: "uncertain",
    retryPolicy: "never",
    transmissionMayHaveBegun: true,
    safeDisplayError:
      "This message may already have been accepted by the mail provider. It will not be sent again automatically. Check the Connor mailbox and recipient outcome before preparing another communication.",
    sanitizedProviderCode: code,
    sanitizedCommand: command,
    responseCode,
    responseClass,
  };
}
