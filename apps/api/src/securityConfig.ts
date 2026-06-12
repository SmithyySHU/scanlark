type Env = Record<string, string | undefined>;

export const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
] as const;

export function isProductionLikeEnv(env: Env = process.env): boolean {
  const nodeEnv = env.NODE_ENV ?? "development";
  return nodeEnv !== "development" && nodeEnv !== "test";
}

export function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, "");
  }
}

function configuredPublicWebOrigins(env: Env): string[] {
  return [env.WEB_ORIGIN, env.APP_URL, env.APP_BASE_URL]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

function configuredCorsOrigins(env: Env): string[] {
  return [env.WEB_ORIGIN, env.APP_URL, env.APP_BASE_URL, env.API_ORIGIN]
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function isHttpsOrigin(origin: string): boolean {
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return false;
  }
}

function hasMinLength(value: string | undefined, min: number): boolean {
  return typeof value === "string" && value.trim().length >= min;
}

export function getAllowedCorsOrigins(env: Env = process.env): Set<string> {
  const origins = configuredCorsOrigins(env);
  if (!isProductionLikeEnv(env)) {
    origins.push(...LOCAL_DEV_ORIGINS);
  }
  return new Set(origins);
}

export function getSecurityConfigErrors(env: Env = process.env): string[] {
  if (!isProductionLikeEnv(env)) return [];

  const errors: string[] = [];
  if (env.DEV_BYPASS_AUTH === "true") {
    errors.push("DEV_BYPASS_AUTH must be false in production-like mode");
  }
  if (!hasMinLength(env.SESSION_SECRET, 32)) {
    errors.push("SESSION_SECRET must be at least 32 characters");
  }
  if (!hasMinLength(env.API_INTERNAL_TOKEN, 32)) {
    errors.push("API_INTERNAL_TOKEN must be at least 32 characters");
  }
  if (!hasMinLength(env.REPORT_SHARE_TOKEN_SECRET, 32)) {
    errors.push("REPORT_SHARE_TOKEN_SECRET must be at least 32 characters");
  }

  const publicWebOrigins = configuredPublicWebOrigins(env);
  if (publicWebOrigins.length === 0) {
    errors.push("WEB_ORIGIN, APP_URL, or APP_BASE_URL must be configured");
  }

  for (const origin of configuredCorsOrigins(env)) {
    if (isLocalOrigin(origin)) {
      errors.push(`Localhost origin is not allowed in production: ${origin}`);
    }
    if (!isHttpsOrigin(origin)) {
      errors.push(`Production origins must use HTTPS: ${origin}`);
    }
  }

  return errors;
}

export function assertSecurityConfig(env: Env = process.env): void {
  const errors = getSecurityConfigErrors(env);
  if (errors.length > 0) {
    throw new Error(`Invalid security configuration: ${errors.join("; ")}`);
  }
}
