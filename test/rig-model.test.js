import test from "node:test";
import assert from "node:assert/strict";
import {
  DIRECTIONS,
  rigModel,
  registerRobotPart,
  solveArm,
  viewModel,
} from "../public/shared/rig-model.js";
test("eight views have independent projections and never mirror the avatar artwork", () => {
  assert.equal(DIRECTIONS.length, 8);
  const views = DIRECTIONS.map(viewModel);
  assert.equal(new Set(views.map((v) => JSON.stringify(v))).size, 8);
  for (const view of views) if (view.screen) assert.ok(view.screen[0] > 0);
  for (const direction of ["back", "back-left", "back-right"])
    assert.equal(viewModel(direction).screen, null);
  for (const direction of ["left", "right"])
    assert.equal(viewModel(direction).screen, null);
  for (const view of views) {
    if (view.screen)
      assert.deepEqual(
        view.screen.slice(1, 4),
        [0, 0, 1],
        "Screen faces stay upright without shear",
      );
    assert.ok(
      Math.abs(view.hips[0] - view.hips[1]) >= 20,
      "Boots have separate standing footprints",
    );
  }
});
test("replacement limbs carry dimensions/materials and alter reach without changing scene code", () => {
  registerRobotPart({
    id: "test-long-arm",
    slot: "rightArm",
    dimensions: { upper: 16, lower: 18, width: 8, hand: 8 },
    material: { metal: "#cd9864", shade: "#885c45" },
  });
  const base = rigModel(),
    equipped = rigModel({ rightArm: "test-long-arm" });
  assert.equal(equipped.rightArm.upper + equipped.rightArm.lower, 34);
  assert.equal(equipped.rightArm.material.metal, "#cd9864");
  assert.ok(equipped.bounds.width > base.bounds.width);
  const shoulder = { x: 47, y: 72 },
    target = { x: 77, y: 75 },
    result = solveArm(
      shoulder,
      target,
      equipped.rightArm.upper,
      equipped.rightArm.lower,
    );
  assert.ok(
    Math.hypot(result.hand.x - target.x, result.hand.y - target.y) < 0.01,
  );
  const short = solveArm(
    shoulder,
    target,
    base.rightArm.upper,
    base.rightArm.lower,
  );
  assert.ok(Math.hypot(short.hand.x - target.x, short.hand.y - target.y) > 5);
});
test("attachment art requires eight views, and unknown slots/parts are rejected", () => {
  assert.throws(
    () =>
      registerRobotPart({
        id: "bad-hat",
        slot: "hat",
        views: { front: () => null },
      }),
    /eight directions/,
  );
  assert.throws(
    () => rigModel({ rightArm: "unowned-arbitrary-code" }),
    /Unknown/,
  );
  assert.throws(
    () =>
      registerRobotPart({
        id: "bad-dimension",
        slot: "leftArm",
        dimensions: { upper: Infinity },
      }),
    /dimensions/,
  );
});
test("arm solver stays finite for unreachable or coincident targets", () => {
  for (const target of [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: -1000, y: -1000 },
  ]) {
    const result = solveArm({ x: 0, y: 0 }, target, 12, 8);
    assert.ok(Number.isFinite(result.upper) && Number.isFinite(result.lower));
  }
});
