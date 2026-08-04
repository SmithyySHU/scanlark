import type { NextFunction, Request, Response } from "express";
import {
  isInternalAdminEmail,
  isInternalOnlyMode,
  normalizeEmail,
  parseEmailAllowlist,
} from "./internalAccess";

export function isAdminEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (!email) return false;
  if (parseEmailAllowlist(env.ADMIN_EMAILS).has(normalizeEmail(email))) {
    return true;
  }
  return isInternalOnlyMode(env) && isInternalAdminEmail(email, env);
}

export function adminGuard(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Unauthorized",
    });
  }
  if (!isAdminEmail(req.user.email)) {
    return res.status(403).json({
      error: "admin_required",
      message: "Admin access required",
    });
  }
  return next();
}
