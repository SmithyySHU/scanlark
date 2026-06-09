import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../", ".env"),
});

type ValidatedEmailConfig = {
  enabled: boolean;
  from: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
};

export type ApiRuntimeConfig = {
  nodeEnv: string;
  isProductionLike: boolean;
  devBypassAuth: boolean;
  webOrigin: string | null;
  appBaseUrl: string | null;
  apiInternalToken: string | null;
  emailTestTo: string | null;
  authCookieName: string;
  authTokenTtlDays: number;
  sessionSecret: string | null;
  reportShareTokenSecret: string | null;
  email: ValidatedEmailConfig;
};

function isProductionLike(nodeEnv: string) {
  return nodeEnv !== "development" && nodeEnv !== "test";
}

function asNonEmptyString(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireAbsoluteUrl(
  name: string,
  value: string | null,
  errors: string[],
): string | null {
  if (!value) {
    errors.push(`${name} is required`);
    return null;
  }
  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    errors.push(`${name} must be a valid absolute URL`);
    return null;
  }
}

function parsePositiveNumber(
  name: string,
  rawValue: string | undefined,
  defaultValue: number,
  errors: string[],
) {
  if (rawValue == null || rawValue.trim().length === 0) return defaultValue;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive number`);
    return defaultValue;
  }
  return parsed;
}

function buildErrorMessage(service: string, errors: string[]) {
  return `${service} runtime config is invalid:\n- ${errors.join("\n- ")}`;
}

function validateEmailConfig(
  errors: string[],
  allowDisabled: boolean,
): ValidatedEmailConfig {
  const enabled = process.env.EMAIL_ENABLED === "true";
  const from =
    asNonEmptyString(process.env.EMAIL_FROM) ??
    "Scanlark <alerts@scanlark.local>";
  const smtpHost = asNonEmptyString(process.env.SMTP_HOST) ?? "";
  const smtpPort = parsePositiveNumber(
    "SMTP_PORT",
    process.env.SMTP_PORT,
    587,
    errors,
  );
  const smtpUser = asNonEmptyString(process.env.SMTP_USER) ?? "";
  const smtpPass = asNonEmptyString(process.env.SMTP_PASS) ?? "";

  if (enabled || !allowDisabled) {
    if (!asNonEmptyString(process.env.EMAIL_FROM)) {
      errors.push("EMAIL_FROM is required when EMAIL_ENABLED=true");
    }
    if (!smtpHost) {
      errors.push("SMTP_HOST is required when EMAIL_ENABLED=true");
    }
  }
  if (enabled) {
    if (smtpUser && !smtpPass) {
      errors.push("SMTP_PASS is required when SMTP_USER is set");
    }
    if (smtpPass && !smtpUser) {
      errors.push("SMTP_USER is required when SMTP_PASS is set");
    }
  }

  return {
    enabled,
    from,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
  };
}

function loadApiRuntimeConfig(): ApiRuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const productionLike = isProductionLike(nodeEnv);
  const devBypassAuth = process.env.DEV_BYPASS_AUTH === "true";
  const errors: string[] = [];

  const authTokenTtlDays = parsePositiveNumber(
    "AUTH_TOKEN_TTL_DAYS",
    process.env.AUTH_TOKEN_TTL_DAYS,
    30,
    errors,
  );
  const authCookieName =
    asNonEmptyString(process.env.AUTH_COOKIE_NAME) ?? "ls_session";
  const sessionSecret = asNonEmptyString(process.env.SESSION_SECRET);
  const webOrigin = asNonEmptyString(process.env.WEB_ORIGIN);
  const appBaseUrl =
    asNonEmptyString(process.env.APP_BASE_URL) ??
    asNonEmptyString(process.env.APP_URL);
  const apiInternalToken = asNonEmptyString(process.env.API_INTERNAL_TOKEN);
  const reportShareTokenSecret = asNonEmptyString(
    process.env.REPORT_SHARE_TOKEN_SECRET,
  );

  if (productionLike) {
    if (!sessionSecret) {
      errors.push("SESSION_SECRET is required in production-like mode");
    } else if (sessionSecret.length < 32) {
      errors.push("SESSION_SECRET must be at least 32 characters long");
    }
    requireAbsoluteUrl("WEB_ORIGIN", webOrigin, errors);
    requireAbsoluteUrl("APP_BASE_URL or APP_URL", appBaseUrl, errors);
    if (!apiInternalToken) {
      errors.push("API_INTERNAL_TOKEN is required in production-like mode");
    }
    if (!reportShareTokenSecret) {
      errors.push(
        "REPORT_SHARE_TOKEN_SECRET is required in production-like mode",
      );
    }
  }

  const validatedWebOrigin = webOrigin
    ? requireAbsoluteUrl("WEB_ORIGIN", webOrigin, errors)
    : null;
  const validatedAppBaseUrl = appBaseUrl
    ? requireAbsoluteUrl("APP_BASE_URL or APP_URL", appBaseUrl, errors)
    : null;
  const email = validateEmailConfig(errors, true);

  if (errors.length > 0) {
    throw new Error(buildErrorMessage("API", errors));
  }

  return {
    nodeEnv,
    isProductionLike: productionLike,
    devBypassAuth,
    webOrigin: validatedWebOrigin,
    appBaseUrl: validatedAppBaseUrl,
    apiInternalToken,
    emailTestTo: asNonEmptyString(process.env.EMAIL_TEST_TO),
    authCookieName,
    authTokenTtlDays,
    sessionSecret,
    reportShareTokenSecret,
    email,
  };
}

export const apiRuntimeConfig = loadApiRuntimeConfig();
