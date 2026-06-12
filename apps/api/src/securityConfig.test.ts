import assert from "node:assert/strict";
import test from "node:test";
import {
  getAllowedCorsOrigins,
  getSecurityConfigErrors,
  normalizeOrigin,
} from "./securityConfig";

const secureProductionEnv = {
  NODE_ENV: "production",
  DEV_BYPASS_AUTH: "false",
  SESSION_SECRET: "s".repeat(32),
  API_INTERNAL_TOKEN: "i".repeat(32),
  REPORT_SHARE_TOKEN_SECRET: "r".repeat(32),
  APP_URL: "https://app.scanlark.com/dashboard",
  WEB_ORIGIN: "https://app.scanlark.com",
  API_ORIGIN: "https://app.scanlark.com/api",
};

test("normalizeOrigin returns the URL origin", () => {
  assert.equal(
    normalizeOrigin("https://app.scanlark.com/api/path"),
    "https://app.scanlark.com",
  );
});

test("production security config accepts strong public settings", () => {
  assert.deepEqual(getSecurityConfigErrors(secureProductionEnv), []);
});

test("production security config rejects dev bypass and weak secrets", () => {
  const errors = getSecurityConfigErrors({
    ...secureProductionEnv,
    DEV_BYPASS_AUTH: "true",
    SESSION_SECRET: "short",
    API_INTERNAL_TOKEN: "short",
    REPORT_SHARE_TOKEN_SECRET: "short",
  });

  assert(errors.some((error) => error.includes("DEV_BYPASS_AUTH")));
  assert(errors.some((error) => error.includes("SESSION_SECRET")));
  assert(errors.some((error) => error.includes("API_INTERNAL_TOKEN")));
  assert(errors.some((error) => error.includes("REPORT_SHARE_TOKEN_SECRET")));
});

test("production security config rejects localhost and non-HTTPS origins", () => {
  const errors = getSecurityConfigErrors({
    ...secureProductionEnv,
    APP_URL: "http://localhost:5173",
    WEB_ORIGIN: "http://scanlark.example.com",
    API_ORIGIN: "http://localhost:3001/api",
  });

  assert(errors.some((error) => error.includes("Localhost origin")));
  assert(errors.some((error) => error.includes("Production origins")));
});

test("development CORS includes localhost but production CORS does not add it", () => {
  assert(
    getAllowedCorsOrigins({ NODE_ENV: "development" }).has(
      "http://localhost:5173",
    ),
  );
  assert(
    !getAllowedCorsOrigins(secureProductionEnv).has("http://localhost:5173"),
  );
});
