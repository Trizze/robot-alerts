import test from "node:test";
import assert from "node:assert/strict";
import {
  contributionUnits,
  unlockedPatternTier,
  earnedPatternSlots,
  drawPendingPatterns,
  UNITS_PER_POINT,
} from "../src/robots/pattern-points.js";
const viewer = { id: "123" };
test("subscriptions and bits use exact point-equivalent integer units", () => {
  assert.equal(contributionUnits({ type: "sub", viewer, tier: "1000" }), 500);
  assert.equal(
    contributionUnits({ type: "resub", viewer, tier: "2000" }),
    1000,
  );
  assert.equal(contributionUnits({ type: "sub", viewer, tier: "3000" }), 2500);
  assert.equal(
    contributionUnits({ type: "cheer", viewer, bits: 499 }) +
      contributionUnits({ type: "cheer", viewer, bits: 1 }),
    UNITS_PER_POINT,
  );
  assert.equal(contributionUnits({ type: "sub", viewer, tier: "unknown" }), 0);
  assert.equal(
    contributionUnits({ type: "cheer", viewer: null, bits: 500 }),
    0,
  );
});
test("all tier thresholds are inclusive and cumulative", () => {
  for (const [points, expected] of [
    [0, 0],
    [0.998, 0],
    [1, 1],
    [100, 2],
    [250, 3],
    [500, 4],
    [1000, 5],
  ])
    assert.equal(unlockedPatternTier(points * UNITS_PER_POINT), expected);
  assert.equal(unlockedPatternTier(500 - 1), 0);
  assert.equal(unlockedPatternTier(15 * 500 + 10 * 500), 1);
  assert.throws(() => unlockedPatternTier(-1), RangeError);
});
test("gift scoring is opt-in until ownership policy is decided", () => {
  const event = { type: "gift", viewer, tier: "2000", gifts: 3 };
  assert.equal(contributionUnits(event), 0);
  assert.equal(contributionUnits(event, { creditGifts: true }), 3000);
});

test("one pattern unlocks on entry and later rewards follow the tier interval", () => {
  const counts = [18, 11, 11, 8, 10];
  const slots = (p) => earnedPatternSlots(p * UNITS_PER_POINT, counts);
  assert.deepEqual(slots(0), [0, 0, 0, 0, 0]);
  assert.deepEqual(slots(1), [1, 0, 0, 0, 0]);
  assert.deepEqual(slots(6), [1, 0, 0, 0, 0]);
  assert.deepEqual(slots(6.5), [2, 0, 0, 0, 0]);
  assert.deepEqual(slots(95), [18, 0, 0, 0, 0]);
  assert.deepEqual(slots(100), [18, 1, 0, 0, 0]);
  assert.deepEqual(slots(250), [18, 11, 1, 0, 0]);
  assert.deepEqual(slots(500), [18, 11, 11, 1, 0]);
  assert.deepEqual(slots(1000), [18, 11, 11, 8, 1]);
  assert.deepEqual(earnedPatternSlots(12500, [0, 0, 0, 0, 0]), [0, 0, 0, 0, 0]);
});
test("fractional intervals use exact bit units and highest tier awards every 100 points", () => {
  const counts = [18, 11, 11, 8, 10];
  // The second tier-2 slot needs ceil(150 * 500 / 11) units after entry.
  const boundary = 100 * 500 + Math.ceil((150 * 500) / 11);
  assert.equal(earnedPatternSlots(boundary - 1, counts)[1], 1);
  assert.equal(earnedPatternSlots(boundary, counts)[1], 2);
  assert.equal(earnedPatternSlots(1900 * 500, counts)[4], 10);
  assert.equal(earnedPatternSlots(2000 * 500, counts)[4], 10);
  assert.equal(earnedPatternSlots(1099 * 500, counts)[4], 1);
  assert.equal(earnedPatternSlots(1100 * 500, counts)[4], 2);
  assert.equal(
    earnedPatternSlots(1100 * 500, counts, {
      highestTierIntervalUnits: 100 * 500,
    })[4],
    2,
  );
  assert.equal(
    earnedPatternSlots(5000 * 500, counts, {
      highestTierIntervalUnits: 100 * 500,
    })[4],
    10,
  );
});

test("random draws only return unowned patterns from tiers with earned slots", () => {
  const catalog = [
    { id: "a", tier: 1 },
    { id: "b", tier: 1 },
    { id: "c", tier: 1 },
    { id: "d", tier: 2 },
  ];
  const awards = drawPendingPatterns(catalog, ["a"], [3, 1, 0, 0, 0], () => 0);
  assert.deepEqual(
    awards.map((x) => x.id),
    ["b", "c", "d"],
  );
  assert.deepEqual(
    drawPendingPatterns(
      catalog,
      ["a", "b", "c", "d"],
      [3, 1, 0, 0, 0],
      () => 0,
    ),
    [],
  );
  assert.throws(
    () => drawPendingPatterns([...catalog, catalog[0]], [], [1, 0, 0, 0, 0]),
    /catalog/,
  );
  assert.throws(
    () => drawPendingPatterns(catalog, [], [1, 0, 0, 0, 0], () => 9),
    RangeError,
  );
});
