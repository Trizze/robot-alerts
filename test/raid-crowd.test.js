import test from "node:test";
import assert from "node:assert/strict";
import { RaidWorld } from "../public/shared/raid-world.js";
import { footstep } from "../public/shared/gait.js";
import { Store } from "../src/db.js";
import { AlertQueue } from "../src/alerts.js";
import { handleRaidChat } from "../src/raid-chat.js";
test("planted foot cancels body travel; swing clears the floor", () => {
  const stride = 18,
    a = footstep(3, stride),
    b = footstep(6, stride);
  assert.ok(a.stance && b.stance);
  assert.ok(Math.abs(3 + a.x - (6 + b.x)) < 1e-8);
  const swing = footstep(24, stride);
  assert.equal(swing.stance, false);
  assert.ok(swing.lift > 3);
});
test("raid crowd produces collisions/smoke, survivors cross, and all actors despawn", () => {
  const world = new RaidWorld();
  for (let i = 0; i < 8; i++)
    world.add(
      { id: `demo-${i}`, name: "Test", avatar: "/assets/avatars/iris.svg" },
      0.1 + i * 0.1,
      i,
    );
  world.advance(8);
  assert.ok(world.stats.collisions > 0);
  assert.ok(world.stats.smoked > 0);
  world.advance(24);
  assert.ok(world.stats.crossed > 0);
  assert.equal(world.actors.length, 0);
  assert.equal(world.clouds.length, 0);
  assert.ok(world.empty);
});
test("raid text honors configured duration; all-account participation is confined to 25s visual phase", () => {
  const store = new Store(":memory:"),
    sent = [];
  const queue = new AlertQueue(
    (m) => sent.push(m),
    () => ({
      ...store.settings("channel"),
      textDurations: { ...store.settings("channel").textDurations, parade: 5 },
    }),
  );
  try {
    queue.enqueue({ type: "raid", channel: "channel", demo: false });
    const raid = queue.current;
    assert.equal(raid.textDuration, 5);
    assert.equal(raid.raidCrowdSeconds, 25);
    const event = {
      type: "chat",
      channel: "channel",
      viewer: { id: "98765", name: "<img onerror=bad>", color: "#3478ab" },
      message: "Hostile text is not executed",
    };
    const before = store.list();
    assert.equal(
      handleRaidChat({ ...event, channel: "other" }, { queue, store }),
      false,
    );
    raid.startedAt = Date.now() - (raid.raidCrowdStart * 1000 + 100);
    assert.equal(handleRaidChat(event, { queue, store }), true);
    assert.equal(raid.raiders.length, 1);
    assert.equal(raid.raiders[0].viewer.name, event.viewer.name);
    assert.equal(raid.raiders[0].viewer.color, "#3478ab");
    assert.deepEqual(store.list(), before);
    handleRaidChat(event, { queue, store });
    assert.equal(raid.raiders.length, 1);
    queue.complete(raid.key);
    assert.equal(
      queue.current.key,
      raid.key,
      "A preview cannot finish the raid before its crowd window closes",
    );
    raid.startedAt = Date.now() - (raid.raidCrowdStart * 1000 + 25100);
    assert.equal(
      handleRaidChat(
        { ...event, viewer: { id: "12345", name: "Late" } },
        { queue, store },
      ),
      false,
    );
    queue.complete(raid.key);
    assert.equal(queue.current, null);
  } finally {
    queue.stop();
    store.close();
  }
});

test("rendered card durations and the three-second raid default", () => {
  const store = new Store(":memory:"),
    queue = new AlertQueue(
      () => {},
      () => store.settings("demo"),
    );
  try {
    queue.enqueue({ type: "raid", channel: "demo" });
    assert.equal(queue.current.textDuration, 3);
    assert.equal(queue.current.raidCrowdSeconds, 25);
    queue.complete(queue.current.key, true);
    const settings = store.settings("demo");
    settings.textDurations.robot = 12;
    store.saveSettings("demo", settings);
    queue.enqueue({ type: "resub", channel: "demo" });
    assert.equal(queue.current.textDuration, 12);
    assert.ok(queue.current.totalDuration > 13);
  } finally {
    queue.stop();
    store.close();
  }
});
