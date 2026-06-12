import assert from "node:assert/strict";
import test from "node:test";
import { validateCrawlTarget } from "./fetchUrl";

test("validateCrawlTarget rejects unsupported protocols", async () => {
  await assert.rejects(
    () => validateCrawlTarget("file:///etc/passwd"),
    /Disallowed protocol/,
  );
  await assert.rejects(
    () => validateCrawlTarget("ftp://example.com"),
    /Disallowed protocol/,
  );
});

test("validateCrawlTarget rejects non-web ports", async () => {
  await assert.rejects(
    () => validateCrawlTarget("https://example.com:8443"),
    /Disallowed port/,
  );
});

test("validateCrawlTarget rejects local and private targets", async () => {
  await assert.rejects(
    () => validateCrawlTarget("https://localhost"),
    /localhost|loopback/,
  );
  await assert.rejects(
    () => validateCrawlTarget("https://127.0.0.1"),
    /localhost|loopback/,
  );
  await assert.rejects(
    () => validateCrawlTarget("https://10.0.0.1"),
    /internal\/private/,
  );
});
