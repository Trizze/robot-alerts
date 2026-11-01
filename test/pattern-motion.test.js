import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const base = new URL("../website-staging/overlay/", import.meta.url);
const maps = JSON.parse(
  readFileSync(new URL("pattern-motion/manifest.json", base)),
);
const motion = JSON.parse(
  readFileSync(new URL("static-motion-60/manifest-sheets.json", base)),
);

test("surface maps match the production motion clock, camera footprint and frame counts", () => {
  assert.equal(maps.fps, motion.fps);
  assert.equal(maps.width, motion.width);
  assert.equal(maps.height, motion.height);
  assert.equal(maps.mapScale, 2);
  for (const [name, clip] of Object.entries(maps.clips)) {
    assert.equal(clip.frames.length, motion.clips[name].frames.length);
    for (const [i, frame] of clip.frames.entries()) {
      const parts = ["head", "torso", "arm_l", "arm_r", "legs"]
        .map((key) => motion.clips[name].frames[i].layers[key])
        .filter(Boolean);
      if (!parts.length) {
        assert.equal(frame.box, null);
        continue;
      }
      const expected = [
        Math.min(...parts.map((b) => b[0])),
        Math.min(...parts.map((b) => b[1])),
        Math.max(...parts.map((b) => b[2])),
        Math.max(...parts.map((b) => b[3])),
      ];
      assert.ok(frame.box, `${name}/${i}: missing visible paint`);
      for (let axis = 0; axis < 4; axis++)
        assert.ok(
          Math.abs(frame.box[axis] * maps.mapScale - expected[axis]) <= 5,
          `${name}/${i}: surface maps diverged from the robot`,
        );
    }
  }
});
test("every surface map shares lossless RGBA sheet dimensions and valid crop rectangles", () => {
  assert.deepEqual(maps.kinds, ["high", "low", "normal", "shade"]);
  for (const value of [...maps.origin, ...maps.span])
    assert.ok(Number.isFinite(value));
  assert.ok(maps.span.every((value) => value > 0));
  for (const [name, clip] of Object.entries(maps.clips)) {
    const [width, height] = clip.sheetSize;
    assert.ok(width <= 4096 && height <= 4096);
    for (const kind of maps.kinds) {
      const png = readFileSync(
        new URL(`pattern-motion/${name}/${kind}.png`, base),
      );
      assert.equal(png.subarray(1, 4).toString(), "PNG");
      assert.deepEqual(
        [png.readUInt32BE(16), png.readUInt32BE(20)],
        [width, height],
      );
      assert.equal(png[24], 8);
      assert.equal(
        png[25],
        6,
        "RGBA pixels must remain lossless; no JPEG data maps",
      );
    }
    for (const frame of clip.frames)
      if (frame.sheet) {
        const [x, y, w, h] = frame.sheet;
        assert.ok(
          x >= 0 &&
            y >= 0 &&
            w > 0 &&
            h > 0 &&
            x + w <= width &&
            y + h <= height,
        );
        assert.equal(w, frame.box[2] - frame.box[0]);
        assert.equal(h, frame.box[3] - frame.box[1]);
      }
  }
});
