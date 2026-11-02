import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseDance,
  dancePose,
  danceHold,
  DANCE_CLIPS,
} from "../website-staging/shared/dance-choice.js";
const atlas = {
  rig: {
    fps: 60,
    clips: {
      "run-in": { frames: Array(108) },
      idle: { frames: Array(60) },
      ...Object.fromEntries(
        DANCE_CLIPS.map((name) => [name, { frames: Array(96) }]),
      ),
    },
  },
};
test("each alert chooses one of three dances and invalid random values cannot form asset paths", () => {
  assert.deepEqual(
    [0, 0.4, 0.9].map((n) => chooseDance(() => n)),
    DANCE_CLIPS,
  );
  for (const n of [-1, 1, NaN, Infinity])
    assert.throws(() => chooseDance(() => n));
});
test("dance replaces only idle, loops from one clock and finishes on neutral before run-out", () => {
  assert.deepEqual(dancePose(atlas, ["run-in", 20], 0.4, "dance-shuffle"), [
    "run-in",
    20,
  ]);
  assert.deepEqual(dancePose(atlas, ["idle", 0], 1.8, "dance-shuffle"), [
    "dance-shuffle",
    0,
  ]);
  assert.deepEqual(dancePose(atlas, ["idle", 30], 2.3, "dance-shuffle"), [
    "dance-shuffle",
    30,
  ]);
  assert.deepEqual(dancePose(atlas, ["run-out", 4], 8.3, "dance-shuffle"), [
    "run-out",
    4,
  ]);
  assert.equal(danceHold(atlas, 6, "dance-shuffle"), 6.4);
  assert.equal(danceHold(atlas, 3, "dance-disco"), 3.2);
  assert.equal(danceHold(atlas, 3.2, "dance-victory"), 3.2);
  assert.deepEqual(dancePose(atlas, ["idle", 2], 2.5, "not-a-clip"), [
    "idle",
    2,
  ]);
  assert.equal(danceHold({ rig: { clips: {} } }, 6, "dance-shuffle"), 6);
});
