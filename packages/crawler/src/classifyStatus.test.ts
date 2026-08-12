import assert from "node:assert/strict";
import test from "node:test";
import { classifyStatus } from "./classifyStatus";

test("link response evidence distinguishes broken from restricted or unverifiable", () => {
  assert.equal(
    classifyStatus("https://www.linkedin.com/example", 403),
    "blocked",
  );
  assert.equal(
    classifyStatus("https://www.instagram.com/example", 429),
    "blocked",
  );
  assert.equal(
    classifyStatus("https://external.example/missing", 404),
    "broken",
  );
  assert.equal(classifyStatus("https://external.example/gone", 410), "broken");
  assert.equal(
    classifyStatus("https://external.example/timeout"),
    "no_response",
  );
  assert.equal(classifyStatus("https://external.example/working", 200), "ok");
});
