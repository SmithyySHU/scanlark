import crypto from "crypto";
import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

type KeySource = (req: Request) => string;

function getRequestIp(req: Request) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function hashValue(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function setRetryAfterHeader(req: Request, res: Response) {
  const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } })
    .rateLimit?.resetTime;
  if (!resetTime) return;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetTime.getTime() - Date.now()) / 1000),
  );
  res.setHeader("Retry-After", String(retryAfterSeconds));
}

function logRateLimit(route: string, req: Request) {
  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "warn",
      service: "scanlark-api",
      event: "api.rate_limited",
      message: "API route rate limited",
      route,
      method: req.method,
      ip: getRequestIp(req),
      userId: req.user?.id ?? null,
    }),
  );
}

export function getIpKey(req: Request) {
  return getRequestIp(req);
}

export function getUserOrIpKey(req: Request) {
  return req.user?.id ? `user:${req.user.id}` : `ip:${getRequestIp(req)}`;
}

export function getUserAndSiteKey(req: Request) {
  return `${getUserOrIpKey(req)}:site:${req.params.siteId ?? "unknown"}`;
}

export function getUserAndScanRunKey(req: Request) {
  return `${getUserOrIpKey(req)}:scanRun:${req.params.scanRunId ?? "unknown"}`;
}

export function getPublicTokenAndIpKey(req: Request) {
  const token =
    typeof req.params.token === "string" ? req.params.token : "unknown";
  return `token:${hashValue(token)}:ip:${getRequestIp(req)}`;
}

export function createApiRateLimiter(options: {
  route: string;
  windowMs: number;
  max: number;
  keyGenerator?: KeySource;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator,
    handler(req, res) {
      setRetryAfterHeader(req, res);
      logRateLimit(options.route, req);
      return res.status(429).json({
        error: "rate_limited",
        message: "Too many requests. Please try again shortly.",
      });
    },
  });
}

const activeSseConnections = new Map<string, number>();

export function createSseConnectionLimiter(options: {
  route: string;
  maxConnections: number;
  keyGenerator?: KeySource;
}) {
  const keySource = options.keyGenerator ?? getUserOrIpKey;

  return (req: Request, res: Response, next: () => void) => {
    const key = keySource(req);
    const current = activeSseConnections.get(key) ?? 0;
    let released = false;

    if (current >= options.maxConnections) {
      res.setHeader("Retry-After", "30");
      logRateLimit(options.route, req);
      res.status(429).json({
        error: "rate_limited",
        message:
          "Too many open connections. Please close another stream and retry.",
      });
      return;
    }

    activeSseConnections.set(key, current + 1);

    const release = () => {
      if (released) return;
      released = true;
      const latest = activeSseConnections.get(key) ?? 0;
      if (latest <= 1) {
        activeSseConnections.delete(key);
      } else {
        activeSseConnections.set(key, latest - 1);
      }
    };

    req.on("close", release);
    res.on("close", release);
    next();
  };
}
