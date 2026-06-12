import tls from "tls";
import { validateCrawlTarget } from "./fetchUrl";
import { REQUEST_TIMEOUT_MS, SSL_CERT_EXPIRING_SOON_DAYS } from "./limits";

type CertificateSummary = Record<string, string>;

export type TlsCertificateInspectionResult =
  | {
      ok: true;
      hostname: string;
      port: number;
      authorized: boolean;
      authorizationError: string | null;
      subject: CertificateSummary;
      issuer: CertificateSummary;
      validFrom: string | null;
      validTo: string | null;
      daysUntilExpiry: number | null;
      sanDnsNames: string[];
      hostnameMatches: boolean;
      isExpired: boolean;
      isExpiringSoon: boolean;
      isHostnameMismatch: boolean;
      isInvalid: boolean;
    }
  | {
      ok: false;
      hostname: string;
      port: number;
      error: string;
    };

type InspectTlsCertificateOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

type TlsCertificateConnectionMode =
  | "validated"
  | "diagnostic_invalid_certificate";

type TlsCertificateConnection = {
  cert: tls.DetailedPeerCertificate;
  authorized: boolean;
  authorizationError: string | null;
  mode: TlsCertificateConnectionMode;
};

type TlsConnectionFailure = {
  error: Error | null;
  timedOut: boolean;
  aborted: boolean;
};

const TLS_CERTIFICATE_VALIDATION_ERROR_CODES = new Set([
  "CERT_CHAIN_TOO_LONG",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_REVOKED",
  "CERT_UNTRUSTED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "HOSTNAME_MISMATCH",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_DECRYPT_CERT_SIGNATURE",
  "UNABLE_TO_GET_CRL",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

function classifyTlsError(
  error: Error | null,
  timedOut: boolean,
  aborted: boolean,
): string {
  if (timedOut) return "timeout";
  if (aborted) return "aborted";
  if (!error) return "request_failed";

  const code = (error as { code?: string }).code;
  const message = error.message?.toLowerCase() ?? "";

  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "dns";
  if (code === "ECONNREFUSED" || code === "ECONNRESET")
    return "connection_failed";
  if (message.includes("refusing to crawl")) return "unsafe_destination";
  if (message.includes("tls") || message.includes("ssl")) return "tls";

  return "request_failed";
}

function toTlsConnectionFailure(error: unknown): TlsConnectionFailure {
  if (
    error &&
    typeof error === "object" &&
    "timedOut" in error &&
    "aborted" in error
  ) {
    const failure = error as Partial<TlsConnectionFailure>;
    return {
      error: failure.error instanceof Error ? failure.error : null,
      timedOut: failure.timedOut === true,
      aborted: failure.aborted === true,
    };
  }
  return {
    error: error instanceof Error ? error : null,
    timedOut: false,
    aborted: false,
  };
}

function isCertificateValidationFailure(failure: TlsConnectionFailure) {
  if (failure.timedOut || failure.aborted || !failure.error) return false;

  const code = (failure.error as { code?: string }).code;
  if (code && TLS_CERTIFICATE_VALIDATION_ERROR_CODES.has(code)) return true;

  const message = failure.error.message.toLowerCase();
  return (
    message.includes("certificate") ||
    message.includes("self-signed") ||
    message.includes("hostname/ip does not match") ||
    message.includes("unable to verify") ||
    message.includes("unable to get issuer")
  );
}

function compactCertificateRecord(value: unknown): CertificateSummary {
  if (!value || typeof value === "string" || typeof value !== "object") {
    return {};
  }
  const compact: CertificateSummary = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string" && entry) compact[key] = entry;
  }
  return compact;
}

function parseSanDnsNames(subjectAltName: string | undefined): string[] {
  if (!subjectAltName) return [];
  return subjectAltName
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.toUpperCase().startsWith("DNS:"))
    .map((part) => part.slice(4).trim())
    .filter(Boolean);
}

function parseDaysUntilExpiry(validTo: string | undefined): {
  validTo: string | null;
  daysUntilExpiry: number | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
} {
  if (!validTo) {
    return {
      validTo: null,
      daysUntilExpiry: null,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const expiry = new Date(validTo);
  if (Number.isNaN(expiry.getTime())) {
    return {
      validTo,
      daysUntilExpiry: null,
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = expiry.getTime() - Date.now();
  const daysUntilExpiry = Math.floor(diffMs / msPerDay);
  const isExpired = diffMs < 0;
  const isExpiringSoon =
    !isExpired && diffMs <= SSL_CERT_EXPIRING_SOON_DAYS * msPerDay;

  return {
    validTo: expiry.toISOString(),
    daysUntilExpiry,
    isExpired,
    isExpiringSoon,
  };
}

function parseIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

function normalizeAuthorizationError(value: unknown): string | null {
  if (value instanceof Error) return value.message;
  if (typeof value === "string" && value) return value;
  return null;
}

function createFailureResult(
  hostname: string,
  port: number,
  failure: TlsConnectionFailure,
): TlsCertificateInspectionResult {
  return {
    ok: false,
    hostname,
    port,
    error: classifyTlsError(failure.error, failure.timedOut, failure.aborted),
  };
}

async function connectForPeerCertificate({
  hostname,
  port,
  timeoutMs,
  signal,
  allowInvalidCertificatesForDiagnostics,
}: {
  hostname: string;
  port: number;
  timeoutMs: number;
  signal?: AbortSignal;
  allowInvalidCertificatesForDiagnostics: boolean;
}): Promise<TlsCertificateConnection> {
  return await new Promise<TlsCertificateConnection>((resolve, reject) => {
    let timedOut = false;
    let aborted = false;
    let settled = false;

    /*
     * This is the only TLS validation bypass in the crawler, and it is
     * diagnostic-only. It is used after a normal validating connection fails
     * with a certificate validation error so Scanlark can read certificate
     * metadata and report expiry, trust, or hostname problems. No HTTP request
     * is sent over this socket and no page/body content is read.
     */
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: !allowInvalidCertificatesForDiagnostics,
    });

    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy(new Error("timeout"));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      if (signal && abortListener) {
        signal.removeEventListener("abort", abortListener);
      }
      if (!socket.destroyed) socket.destroy();
    };

    const fail = (error: Error | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject({
        error,
        timedOut,
        aborted,
      } satisfies TlsConnectionFailure);
    };

    const abortListener = signal
      ? () => {
          aborted = true;
          socket.destroy(new Error("aborted"));
        }
      : null;

    if (signal) {
      if (signal.aborted) {
        aborted = true;
        socket.destroy(new Error("aborted"));
      } else if (abortListener) {
        signal.addEventListener("abort", abortListener, { once: true });
      }
    }

    socket.once("secureConnect", () => {
      try {
        const cert = socket.getPeerCertificate(true);
        if (!cert || Object.keys(cert).length === 0) {
          throw new Error("missing_certificate");
        }

        if (settled) return;
        settled = true;
        const authorizationError = normalizeAuthorizationError(
          socket.authorizationError,
        );
        cleanup();
        resolve({
          cert,
          authorized: socket.authorized,
          authorizationError,
          mode: allowInvalidCertificatesForDiagnostics
            ? "diagnostic_invalid_certificate"
            : "validated",
        });
      } catch (error) {
        fail(error instanceof Error ? error : new Error("request_failed"));
      }
    });

    socket.once("error", (error) => {
      fail(error);
    });
  });
}

function buildInspectionResult(
  hostname: string,
  port: number,
  connection: TlsCertificateConnection,
): TlsCertificateInspectionResult {
  const cert = connection.cert;
  const hostnameMatchError = tls.checkServerIdentity(hostname, cert);
  const authorizationError = connection.authorizationError;
  const expiryInfo = parseDaysUntilExpiry(cert.valid_to);
  const validFrom = parseIsoDate(cert.valid_from);
  const isHostnameMismatch = Boolean(hostnameMatchError);
  const isExpired =
    expiryInfo.isExpired || authorizationError === "CERT_HAS_EXPIRED";
  const isInvalid = !connection.authorized && !isExpired && !isHostnameMismatch;

  return {
    ok: true,
    hostname,
    port,
    authorized: connection.authorized,
    authorizationError,
    subject: compactCertificateRecord(cert.subject),
    issuer: compactCertificateRecord(cert.issuer),
    validFrom,
    validTo: expiryInfo.validTo,
    daysUntilExpiry: expiryInfo.daysUntilExpiry,
    sanDnsNames: parseSanDnsNames(cert.subjectaltname),
    hostnameMatches: !isHostnameMismatch,
    isExpired,
    isExpiringSoon: expiryInfo.isExpiringSoon,
    isHostnameMismatch,
    isInvalid,
  };
}

export default async function inspectTlsCertificate(
  rawUrl: string,
  options?: InspectTlsCertificateOptions,
): Promise<TlsCertificateInspectionResult> {
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const validatedUrl = await validateCrawlTarget(rawUrl);
  const hostname = validatedUrl.hostname;
  const port = validatedUrl.port ? Number(validatedUrl.port) : 443;

  try {
    const connection = await connectForPeerCertificate({
      hostname,
      port,
      timeoutMs,
      signal: options?.signal,
      allowInvalidCertificatesForDiagnostics: false,
    });
    return buildInspectionResult(hostname, port, connection);
  } catch (error) {
    const validationFailure = toTlsConnectionFailure(error);
    if (!isCertificateValidationFailure(validationFailure)) {
      return createFailureResult(hostname, port, validationFailure);
    }

    try {
      const diagnosticConnection = await connectForPeerCertificate({
        hostname,
        port,
        timeoutMs,
        signal: options?.signal,
        allowInvalidCertificatesForDiagnostics: true,
      });
      return buildInspectionResult(hostname, port, diagnosticConnection);
    } catch (diagnosticError) {
      return createFailureResult(
        hostname,
        port,
        toTlsConnectionFailure(diagnosticError),
      );
    }
  }
}
