import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DANCE_CLIPS } from "../website-staging/shared/dance-choice.js";
const rig = JSON.parse(
  readFileSync(
    new URL(
      "../website-staging/overlay/static-motion-60/manifest-sheets.json",
      import.meta.url,
    ),
  ),
);
const maps = JSON.parse(
  readFileSync(
    new URL(
      "../website-staging/overlay/pattern-motion/manifest.json",
      import.meta.url,
    ),
  ),
);
test("all three dances retain eight synchronized 60 fps layers and valid atlas rectangles", () => {
  assert.equal(rig.fps, 60);
  assert.equal(rig.assetVersion, "joints-dances-20261102");
  for (const name of DANCE_CLIPS) {
    const frames = rig.clips[name].frames;
    assert.equal(frames.length, 96);
    for (const layer of rig.layers) {
      const png = readFileSync(
        new URL(
          `../website-staging/overlay/static-motion-60/sheets/${name}/${layer}.png`,
          import.meta.url,
        ),
      );
      const width = png.readUInt32BE(16),
        height = png.readUInt32BE(20);
      for (const frame of frames) {
        const r = frame.sheets[layer];
        if (!r) continue;
        assert.ok(
          r[0] >= 0 &&
            r[1] >= 0 &&
            r[2] > 0 &&
            r[3] > 0 &&
            r[0] + r[2] <= width &&
            r[1] + r[3] <= height,
        );
      }
    }
  }
});
test("dance loops close on the same geometry and CRT/chest projections", () => {
  for (const name of DANCE_CLIPS) {
    const f = rig.clips[name].frames,
      first = f[0],
      last = f.at(-1);
    for (const key of ["screen", "chestDisplay"]) {
      assert.equal(first[key].visible, true);
      assert.equal(last[key].visible, true);
      for (let i = 0; i < 4; i++)
        for (let axis = 0; axis < 2; axis++)
          assert.ok(
            Math.abs(first[key].corners[i][axis] - last[key].corners[i][axis]) <
              0.001,
          );
    }
    for (const layer of rig.layers)
      assert.deepEqual(first.layers[layer], last.layers[layer]);
  }
});
test("each dance has synchronized pattern maps and matching rest-space metadata", () => {
  assert.equal(maps.version, "patterns-dances-1");
  for (const name of DANCE_CLIPS) {
    const c = maps.clips[name];
    assert.equal(c.frames.length, 96);
    assert.ok(c.origin.every(Number.isFinite));
    assert.ok(c.span.every((n) => Number.isFinite(n) && n > 0));
    for (const kind of maps.kinds) {
      const png = readFileSync(
        new URL(
          `../website-staging/overlay/pattern-motion/${name}/${kind}.png`,
          import.meta.url,
        ),
      );
      assert.deepEqual(
        [png.readUInt32BE(16), png.readUInt32BE(20)],
        c.sheetSize,
      );
    }
  }
});
