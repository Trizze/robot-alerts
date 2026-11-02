import test from "node:test";
import assert from "node:assert/strict";
import { tierProgress } from "../website-staging/shared/tier-progress.js";
test("tier bar measures progress between the current and next thresholds", () => {
  assert.deepEqual(tierProgress(0), {
    tier: 0,
    from: 0,
    to: 1,
    value: 0,
    remaining: 1,
  });
  assert.equal(tierProgress(1).value, 0);
  assert.equal(tierProgress(50.5).value, 0.5);
  assert.deepEqual(tierProgress(350), {
    tier: 3,
    from: 250,
    to: 500,
    value: 0.4,
    remaining: 150,
  });
  assert.equal(tierProgress(999.5).remaining, 0.5);
  assert.deepEqual(tierProgress(1000), {
    tier: 5,
    from: 1000,
    to: null,
    value: 1,
    remaining: 0,
  });
  assert.equal(tierProgress(2000).value, 1);
  assert.equal(tierProgress(NaN).value, 0);
});
