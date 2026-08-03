import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppUrl,
  buildSafeAppSearch,
  getAppHostnameRedirectUrl,
  isApplicationOnlyPath,
} from "./appLinks";

const env = {
  VITE_PUBLIC_SITE_URL: "https://scanlark.com",
  VITE_APP_URL: "https://app.scanlark.com",
};

function locationFor(url: string) {
  const parsed = new URL(url);
  return {
    hostname: parsed.hostname,
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
  } as Location;
}

test("public internal login link is an absolute app-domain URL", () => {
  assert.equal(
    buildAppUrl("/login", undefined, env, "https://scanlark.com"),
    "https://app.scanlark.com/login",
  );
});

test("public Open Operations link is an absolute app-domain URL", () => {
  assert.equal(
    buildAppUrl("/operations", undefined, env, "https://scanlark.com"),
    "https://app.scanlark.com/operations",
  );
});

test("dashboard link is an absolute app-domain URL with safe query", () => {
  assert.equal(
    buildAppUrl(
      "/dashboard",
      new URLSearchParams({ selectSite: "1" }),
      env,
      "https://scanlark.com",
    ),
    "https://app.scanlark.com/dashboard?selectSite=1",
  );
});

test("public legal pages are not application-only paths", () => {
  assert.equal(isApplicationOnlyPath("/privacy"), false);
  assert.equal(isApplicationOnlyPath("/cookies"), false);
  assert.equal(isApplicationOnlyPath("/terms"), false);
});

test("application-only root-domain paths redirect to app.scanlark.com", () => {
  assert.equal(
    getAppHostnameRedirectUrl(locationFor("https://scanlark.com/login"), env),
    "https://app.scanlark.com/login",
  );
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor("https://scanlark.com/monitoring"),
      env,
    ),
    "https://app.scanlark.com/monitoring",
  );
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor("https://scanlark.com/report/weekly"),
      env,
    ),
    "https://app.scanlark.com/report/weekly",
  );
});

test("path and safe query parameters are preserved", () => {
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor(
        "https://scanlark.com/operations?search=acme&status=active&next=%2Fdashboard&returnTo=https%3A%2F%2Fevil.example&token=secret",
      ),
      env,
    ),
    "https://app.scanlark.com/operations?search=acme&status=active&next=%2Fdashboard",
  );
});

test("unsafe next query parameters are dropped", () => {
  assert.equal(
    buildSafeAppSearch(
      "?next=https%3A%2F%2Fevil.example%2Fdashboard&search=client",
    ),
    "?search=client",
  );
  assert.equal(buildSafeAppSearch("?next=//evil.example"), "");
});

test("login runs only on the app hostname", () => {
  assert.equal(
    getAppHostnameRedirectUrl(locationFor("https://scanlark.com/login"), env),
    "https://app.scanlark.com/login",
  );
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor("https://app.scanlark.com/login"),
      env,
    ),
    null,
  );
});

test("www continues redirecting app-only paths without creating a loop", () => {
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor("https://www.scanlark.com/operations"),
      env,
    ),
    "https://app.scanlark.com/operations",
  );
  assert.equal(
    getAppHostnameRedirectUrl(locationFor("https://www.scanlark.com/"), env),
    null,
  );
});

test("legacy register is treated as app-only while registration remains closed", () => {
  assert.equal(isApplicationOnlyPath("/register"), true);
  assert.equal(
    getAppHostnameRedirectUrl(
      locationFor("https://scanlark.com/register"),
      env,
    ),
    "https://app.scanlark.com/register",
  );
});
