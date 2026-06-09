import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../../", ".env"),
});

type WorkerRuntimeConfig = {
  nodeEnv: string;
  isProductionLike: boolean;
  apiBaseUrl: string;
  apiInternalToken: string | null;
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
) {
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

function loadWorkerRuntimeConfig(): WorkerRuntimeConfig {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const productionLike = isProductionLike(nodeEnv);
  const errors: string[] = [];

  const rawApiBaseUrl =
    asNonEmptyString(process.env.WORKER_API_BASE) ?? "http://localhost:3001";
  const validatedApiBaseUrl = requireAbsoluteUrl(
    "WORKER_API_BASE",
    rawApiBaseUrl,
    errors,
  );
  const apiInternalToken = asNonEmptyString(process.env.API_INTERNAL_TOKEN);

  if (productionLike) {
    if (!asNonEmptyString(process.env.WORKER_API_BASE)) {
      errors.push("WORKER_API_BASE is required in production-like mode");
    }
    if (!apiInternalToken) {
      errors.push("API_INTERNAL_TOKEN is required in production-like mode");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Worker runtime config is invalid:\n- ${errors.join("\n- ")}`,
    );
  }

  return {
    nodeEnv,
    isProductionLike: productionLike,
    apiBaseUrl: validatedApiBaseUrl ?? rawApiBaseUrl,
    apiInternalToken,
  };
}

export const workerRuntimeConfig = loadWorkerRuntimeConfig();
