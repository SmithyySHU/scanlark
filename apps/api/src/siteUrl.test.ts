import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSiteUrlInput, SITE_URL_VALIDATION_MESSAGE } from "./siteUrl";

test("normalizes common website URL inputs", () => {
  assert.equal(normalizeSiteUrlInput("site.com"), "https://site.com");
  assert.equal(normalizeSiteUrlInput("www.site.com/"), "https://www.site.com");
  assert.equal(normalizeSiteUrlInput("HTTPS://site.com"), "https://site.com");
  assert.equal(normalizeSiteUrlInput("http://site.com"), "http://site.com");
  assert.equal(
    normalizeSiteUrlInput(" https://www.site.com/some-page?ref=test "),
    "https://www.site.com/some-page?ref=test",
  );
});

test("normalizes common transposed scheme typo", () => {
  assert.equal(normalizeSiteUrlInput("http//:site.com"), "http://site.com");
  assert.equal(normalizeSiteUrlInput("https//:site.com"), "https://site.com");
});

test("rejects unsupported or non-public-looking URL inputs before crawling", () => {
  assert.throws(() => normalizeSiteUrlInput("javascript:alert(1)"), {
    message: "unsupported_protocol",
  });
  assert.throws(() => normalizeSiteUrlInput("ftp://site.com"), {
    message: "unsupported_protocol",
  });
  assert.throws(() => normalizeSiteUrlInput("localhost:3000"), {
    message: "unsupported_protocol",
  });
});

test("keeps the friendly validation message stable", () => {
  assert.equal(
    SITE_URL_VALIDATION_MESSAGE,
    "Please enter a valid website address, for example site.com or https://site.com.",
  );
});
