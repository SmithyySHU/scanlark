import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

type Env = Record<string, string | undefined>;

export const DEFAULT_PUBLIC_CONTACT_EMAIL = "connor@scanlark.com";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function parseEmailAllowlist(value: string | undefined): Set<string> {
  if (!value?.trim()) return new Set();
  return new Set(value.split(",").map(normalizeEmail).filter(Boolean));
}

export function isInternalOnlyMode(env: Env = process.env): boolean {
  return env.INTERNAL_ONLY_MODE?.trim().toLowerCase() === "true";
}

export function getInternalAdminEmails(env: Env = process.env): Set<string> {
  return parseEmailAllowlist(env.INTERNAL_ADMIN_EMAILS);
}

export function isInternalAdminEmail(
  email: string | null | undefined,
  env: Env = process.env,
): boolean {
  if (!email) return false;
  return getInternalAdminEmails(env).has(normalizeEmail(email));
}

export function isRegistrationAvailable(env: Env = process.env): boolean {
  return !isInternalOnlyMode(env);
}

export function getPublicContactEmail(env: Env = process.env): string {
  const configured = env.PUBLIC_CONTACT_EMAIL?.trim();
  return configured || DEFAULT_PUBLIC_CONTACT_EMAIL;
}

function hasValidInternalToken(req: Request, env: Env = process.env): boolean {
  const expected = env.API_INTERNAL_TOKEN;
  const provided =
    typeof req.headers["x-internal-token"] === "string"
      ? req.headers["x-internal-token"]
      : "";
  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isTrustedWorkerNotifyRequest(
  req: Request,
  env: Env = process.env,
): boolean {
  return (
    req.method === "POST" &&
    /^\/scan-runs\/[^/]+\/notify$/.test(req.path) &&
    hasValidInternalToken(req, env)
  );
}

export function internalOnlyGuard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!isInternalOnlyMode()) return next();
  if (isTrustedWorkerNotifyRequest(req)) return next();
  if (!req.user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!isInternalAdminEmail(req.user.email)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return next();
}

export function getPublicConfig(env: Env = process.env) {
  const internalOnlyMode = isInternalOnlyMode(env);
  return {
    internalOnlyMode,
    registrationAvailable: !internalOnlyMode,
    contactEmail: getPublicContactEmail(env),
  };
}
