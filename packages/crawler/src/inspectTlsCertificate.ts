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

export default async function inspectTlsCertificate(
  rawUrl: string,
  options?: InspectTlsCertificateOptions,
): Promise<TlsCertificateInspectionResult> {
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const validatedUrl = await validateCrawlTarget(rawUrl);
  const hostname = validatedUrl.hostname;
  const port = validatedUrl.port ? Number(validatedUrl.port) : 443;

  let timedOut = false;
  let aborted = false;

  return await new Promise<TlsCertificateInspectionResult>((resolve) => {
    const socket = tls.connect({
      host: hostname,
      port,
      servername: hostname,
      rejectUnauthorized: false,
    });

    const cleanup = () => {
      clearTimeout(timer);
      if (options?.signal && abortListener) {
        options.signal.removeEventListener("abort", abortListener);
      }
      if (!socket.destroyed) socket.destroy();
    };

    const fail = (err: Error | null) => {
      const error = classifyTlsError(err, timedOut, aborted);
      cleanup();
      resolve({
        ok: false,
        hostname,
        port,
        error,
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      socket.destroy(new Error("timeout"));
    }, timeoutMs);

    const abortListener = options?.signal
      ? () => {
          aborted = true;
          socket.destroy(new Error("aborted"));
        }
      : null;

    if (options?.signal) {
      if (options.signal.aborted) {
        aborted = true;
        socket.destroy(new Error("aborted"));
      } else if (abortListener) {
        options.signal.addEventListener("abort", abortListener, { once: true });
      }
    }

    socket.once("secureConnect", () => {
      try {
        const cert = socket.getPeerCertificate(true);
        if (!cert || Object.keys(cert).length === 0) {
          throw new Error("missing_certificate");
        }

        const hostnameMatchError = tls.checkServerIdentity(hostname, cert);
        const authorizationError =
          socket.authorizationError instanceof Error
            ? socket.authorizationError.message
            : (socket.authorizationError ?? null);
        const expiryInfo = parseDaysUntilExpiry(cert.valid_to);
        const validFrom = parseIsoDate(cert.valid_from);
        const isHostnameMismatch = Boolean(hostnameMatchError);
        const isExpired =
          expiryInfo.isExpired || authorizationError === "CERT_HAS_EXPIRED";
        const isInvalid =
          !socket.authorized && !isExpired && !isHostnameMismatch;

        cleanup();
        resolve({
          ok: true,
          hostname,
          port,
          authorized: socket.authorized,
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
