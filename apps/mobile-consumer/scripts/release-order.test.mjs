import assert from "node:assert/strict";
import test from "node:test";

import { planRelease, readContract } from "./release-order.mjs";

const ready = { storeReleased: true, contract: 2, updateId: "upd_1", reachable: 95, total: 100 };

test("the number is read from the published JavaScript, never from typed input", () => {
  assert.equal(readContract("export const CONTRACT = 4;\n"), 4);
  assert.throws(() => readContract("export const CONTRACT = x;"), /CONTRACT/);
});

test("before store release 1 the minimum stays unset", () => {
  assert.equal(planRelease({ ...ready, storeReleased: false }).action, "hold");
});

test("a missing update or an unreadable install count refuses the fast order", () => {
  assert.equal(planRelease({ ...ready, updateId: null }).action, "refuse");
  assert.equal(planRelease({ ...ready, reachable: null }).action, "refuse");
  assert.equal(planRelease({ ...ready, total: 0 }).action, "refuse");
});

test("too few installs that can receive the update refuse the fast order", () => {
  assert.equal(planRelease({ ...ready, reachable: 80, total: 100 }).action, "refuse");
});

test("enough installs raise to the update's own number", () => {
  const decision = planRelease(ready);
  assert.equal(decision.action, "raise");
  assert.equal(decision.minimum, 2);
});
