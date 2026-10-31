import test from "node:test";
import assert from "node:assert/strict";
import { alertCopy } from "../public/shared/alert-copy.js";
import { validateSettings } from "../src/robots/registry.js";
import { Store } from "../src/db.js";
import { AlertQueue } from "../src/alerts.js";
import { normalize, subscriptions } from "../src/twitch/normalize.js";

test("canvas settings accept Full HD, QHD and 4K with a safe fallback", () => {
  for (const [width, height] of [
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
  ])
    assert.deepEqual(validateSettings({ canvas: { width, height } }).canvas, {
      width,
      height,
    });
  assert.deepEqual(
    validateSettings({ canvas: { width: 3840, height: 1080 } }).canvas,
    { width: 1920, height: 1080 },
  );
});

test("legacy theme settings map to two themes without losing event switches", () => {
  for (const theme of ["default", "midnight", "studio"])
    assert.equal(validateSettings({ theme }).theme, "default");
  for (const theme of ["gaming", "arcade"])
    assert.equal(validateSettings({ theme }).theme, "gaming");
  const migrated = validateSettings({
    theme: "arcade",
    events: { cheer: false },
  });
  assert.equal(migrated.events.cheer, false);
  assert.equal(migrated.events.follow, true);
});
test("alert defaults have one type and one event line, with correct counts", () => {
  assert.equal(alertCopy({ type: "sub" }).detail, "First time subscriber!");
  assert.deepEqual(alertCopy({ type: "resub", months: 12 }), {
    label: "RE-SUB",
    detail: "Re-subscribed for 12 months!",
    icon: "↻",
  });
  assert.equal(
    alertCopy({ type: "resub", months: 1 }).detail,
    "Re-subscribed for 1 month!",
  );
  assert.equal(
    alertCopy({ type: "cheer", bits: 1200 }).detail,
    "Cheered for 1,200 bits!",
  );
  assert.equal(alertCopy({ type: "gift", gifts: 5 }).detail, "Gifted 5 subs!");
  assert.equal(
    alertCopy({ type: "raid", raidSize: 42 }).detail,
    "Raiding with 42 viewers!",
  );
  assert.equal(alertCopy({ type: "follow" }).label, "NEW FOLLOWER");
  assert.equal(alertCopy({ type: "follow" }).detail, "Followed the stream!");
});
test("switching themes updates active/queued alerts while preserving robot data and timing", () => {
  const store = new Store(":memory:");
  const queue = new AlertQueue(
    () => {},
    () => store.settings("channel"),
  );
  try {
    store.apply({
      id: "one",
      type: "resub",
      channel: "channel",
      at: new Date().toISOString(),
      viewer: { id: "123", name: "Viewer" },
      months: 12,
    });
    const viewer = store.viewer("123"),
      saved = JSON.stringify(viewer);
    queue.enqueue({ type: "sub", channel: "channel", viewer });
    queue.enqueue({ type: "cheer", channel: "channel", viewer });
    const key = queue.current.key,
      startedAt = queue.current.startedAt;
    queue.updateTheme("gaming");
    assert.equal(queue.current.key, key);
    assert.equal(queue.current.startedAt, startedAt);
    assert.equal(queue.current.settings.theme, "gaming");
    assert.equal(queue.pending[0].settings.theme, "gaming");
    assert.equal(JSON.stringify(queue.current.viewer), saved);
    assert.equal(JSON.stringify(store.viewer("123")), saved);
  } finally {
    queue.stop();
    store.close();
  }
});
test("followers subscribe with broadcaster permission and preserve Twitch follow date", () => {
  const subscription = subscriptions("123", "456", "broadcaster").find(
    (s) => s.type === "channel.follow",
  );
  assert.deepEqual(subscription, {
    type: "channel.follow",
    version: "2",
    condition: { broadcaster_user_id: "123", moderator_user_id: "123" },
  });
  const date = new Date().toISOString();
  const event = normalize(
    {
      metadata: { message_id: "follow-one", message_timestamp: date },
      payload: {
        subscription: { type: "channel.follow" },
        event: {
          broadcaster_user_id: "123",
          user_id: "789",
          user_name: "Follower",
          followed_at: date,
        },
      },
    },
    "123",
    "456",
  );
  assert.equal(event.type, "follow");
  assert.equal(event.followedAt, date);
  assert.equal(event.viewer.id, "789");
});
