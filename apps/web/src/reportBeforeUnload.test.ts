import assert from "node:assert/strict";
import test from "node:test";
import {
  preventReportUnload,
  registerReportBeforeUnloadGuard,
} from "./components/operations/reports/reportBeforeUnload";

class FakeBeforeUnloadTarget {
  readonly listeners = new Set<(event: BeforeUnloadEvent) => void>();
  addCount = 0;
  removeCount = 0;

  addEventListener(
    type: "beforeunload",
    listener: (event: BeforeUnloadEvent) => void,
  ) {
    assert.equal(type, "beforeunload");
    this.addCount += 1;
    this.listeners.add(listener);
  }

  removeEventListener(
    type: "beforeunload",
    listener: (event: BeforeUnloadEvent) => void,
  ) {
    assert.equal(type, "beforeunload");
    this.removeCount += 1;
    this.listeners.delete(listener);
  }
}

test("clean reports do not register a beforeunload guard", () => {
  const target = new FakeBeforeUnloadTarget();
  const cleanup = registerReportBeforeUnloadGuard(target, false);

  assert.equal(target.addCount, 0);
  assert.equal(target.listeners.size, 0);
  cleanup();
  assert.equal(target.removeCount, 0);
});

test("dirty reports use the standard native beforeunload signal", () => {
  let prevented = false;
  const event = {
    preventDefault() {
      prevented = true;
    },
    returnValue: "",
  } as BeforeUnloadEvent;

  preventReportUnload(event);

  assert.equal(prevented, true);
  assert.notEqual(event.returnValue, "");
});

test("saving or unmounting removes the exact registered listener once", () => {
  const target = new FakeBeforeUnloadTarget();
  const cleanup = registerReportBeforeUnloadGuard(target, true);

  assert.equal(target.addCount, 1);
  assert.equal(target.listeners.size, 1);

  cleanup();
  cleanup();

  assert.equal(target.removeCount, 1);
  assert.equal(target.listeners.size, 0);
});
