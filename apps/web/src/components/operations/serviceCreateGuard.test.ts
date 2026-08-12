import assert from "node:assert/strict";
import test from "node:test";
import { beginServiceCreate, finishServiceCreate } from "./serviceCreateGuard";

test("managed-service submission permits one request until it finishes", () => {
  const state = { current: false };
  assert.equal(beginServiceCreate(state), true);
  assert.equal(beginServiceCreate(state), false);
  assert.equal(state.current, true);
  finishServiceCreate(state);
  assert.equal(beginServiceCreate(state), true);
});
