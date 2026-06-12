import type { NextFunction, Request, Response } from "express";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseAdminEmails(value: string | undefined): Set<string> {
  if (!value?.trim()) return new Set();
  return new Set(value.split(",").map(normalizeEmail).filter(Boolean));
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails(process.env.ADMIN_EMAILS).has(normalizeEmail(email));
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
