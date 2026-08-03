import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const caddyfile = readFileSync(new URL("../../../Caddyfile", import.meta.url), {
  encoding: "utf8",
});

const authSource = readFileSync(new URL("./auth.ts", import.meta.url), {
  encoding: "utf8",
});

test("www permanently redirects to the public root hostname", () => {
  assert.match(
    caddyfile,
    /\{\$SCANLARK_WWW_DOMAIN:www\.scanlark\.com\} \{[\s\S]*redir https:\/\/\{\$SCANLARK_PUBLIC_DOMAIN:scanlark\.com\}\{uri\} permanent[\s\S]*\}/,
  );
});

test("public root redirects application-only paths to the app hostname", () => {
  const privateRouteLine = caddyfile
    .split("\n")
    .find((line) => line.includes("@privateAppRoutes path"));
  assert(privateRouteLine);
  for (const path of [
    "/login*",
    "/register*",
    "/dashboard*",
    "/monitoring*",
    "/operations*",
    "/admin*",
    "/report*",
  ]) {
    assert(privateRouteLine.includes(path), `${path} is missing`);
  }
  assert.match(
    caddyfile,
    /handle @privateAppRoutes \{[\s\S]*redir https:\/\/\{\$SCANLARK_APP_DOMAIN:app\.scanlark\.com\}\{uri\} permanent[\s\S]*\}/,
  );
});

test("root-domain API routes are not proxied to authenticated API handlers", () => {
  assert.match(
    caddyfile,
    /handle \/api\/public\/config \{[\s\S]*"registrationAvailable":false[\s\S]*\}/,
  );
  assert.match(
    caddyfile,
    /handle \/api\/me \{[\s\S]*respond `\{"error":"unauthorized"\}` 401[\s\S]*\}/,
  );
  assert.match(
    caddyfile,
    /handle \/api\/\* \{[\s\S]*respond `\{"error":"not_found"\}` 404[\s\S]*\}/,
  );
});

test("session cookie remains host-only and secure in production", () => {
  assert.match(authSource, /httpOnly:\s*true/);
  assert.match(authSource, /sameSite:\s*"lax"/);
  assert.match(authSource, /secure:\s*NODE_ENV === "production"/);
  assert.doesNotMatch(authSource, /domain\s*:/);
});
