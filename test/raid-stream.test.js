import test from "node:test";
import assert from "node:assert/strict";
import { RaidStream } from "../public/shared/raid-stream.js";
const viewer = (i) => ({
  id: String(i),
  name: `viewer ${i}`,
  avatar: "/assets/avatars/iris.svg",
});
test("runners cross from both directions with steady speeds and visible impact", () => {
  const world = new RaidStream();
  for (let i = 0; i < 13; i++) world.add(viewer(i), 0.2 + i * 0.35, i);
  world.advance(3);
  assert.ok(world.actors.some((a) => a.direction === 1));
  assert.ok(world.actors.some((a) => a.direction === -1));
  assert.ok(world.actors.every((a) => Math.abs(a.vx) === 315));
  world.advance(5);
  assert.ok(world.stats.collisions > 0);
  world.advance(20);
  assert.ok(world.stats.crossed > 0);
  assert.ok(world.empty);
});
test("runners use the full vertical area and at most twelve are visible", () => {
  const world = new RaidStream();
  for (let i = 0; i < 30; i++) world.add(viewer(i), 0, i);
  world.advance(0.2);
  assert.ok(world.actors.length <= 12);
  assert.ok(new Set(world.actors.map((a) => a.y)).size > 6);
  assert.ok(Math.min(...world.actors.map((a) => a.y)) < 200);
  assert.ok(Math.max(...world.actors.map((a) => a.y)) > 930);
});

test("overlapping runners collide even on adjacent rows", () => {
  const w = new RaidStream();
  w.actors = [
    { x: 500, y: 500, lane: 1, direction: 1, vx: 315, age: 0, state: "run" },
    { x: 550, y: 640, lane: 2, direction: -1, vx: -315, age: 0, state: "run" },
  ];
  w.step();
  assert.equal(w.stats.collisions, 1);
  assert.equal(w.clouds.length, 1);
  assert.ok(w.actors.every((a) => a.state === "impact"));
});
