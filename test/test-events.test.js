import test from "node:test";
import assert from "node:assert/strict";
import { chatProfiles, testEvent } from "../src/preview-events.js";
import { Store } from "../src/db.js";
const profiles = [
  { id: "1001", name: "ChatterOne", avatar: "/avatars/1001.png" },
  { id: "1002", name: "ChatterTwo", avatar: "/avatars/1002.jpg" },
];
test("test alerts use a selected genuine cached avatar under a synthetic identity", () => {
  const event = testEvent("resub", 0, profiles, { sourceViewerId: "1002" });
  assert.equal(event.viewer.id, "demo-1002");
  assert.equal(event.viewer.sourceUserId, "1002");
  assert.equal(event.viewer.name, "ChatterTwo");
  assert.equal(event.viewer.avatar, "/avatars/1002.jpg");
  assert.equal(event.channel, "demo");
  assert.equal(event.months, 12);
  const raid = testEvent("raid", 0, profiles);
  assert.equal(raid.participants[0].avatar, "/avatars/1002.jpg");
  assert.equal(
    chatProfiles([{ id: "demo-one", avatar: "/assets/avatars/iris.svg" }])
      .length,
    0,
  );
  assert.equal(
    chatProfiles([{ ...profiles[0], id: "demo-1001" }, profiles[0]]).length,
    1,
  );
  assert.equal(
    chatProfiles([{ ...profiles[0], avatar: "/avatars/9999.png" }]).length,
    0,
  );
});
test("live tests never silently substitute offline fixture pictures", () => {
  assert.throws(() => testEvent("follow", 0, []), /Send !robot/);
  assert.throws(
    () => testEvent("follow", 0, profiles, { sourceViewerId: "999" }),
    /available cached/,
  );
  assert.ok(
    testEvent("follow", 0, [], { allowFixtures: true }).viewer.id.startsWith(
      "demo-",
    ),
  );
});
test("synthetic contributions with real avatars cannot credit the real account", () => {
  const live = new Store(":memory:"),
    demo = new Store(":memory:");
  try {
    live.apply({
      id: "real",
      type: "chat",
      viewer: profiles[0],
      channel: "channel",
      at: new Date().toISOString(),
      message: "!robot",
    });
    const original = live.viewer("1001");
    demo.apply(testEvent("cheer", 0, profiles));
    assert.equal(demo.viewer("demo-1001").metrics.bits, 1200);
    assert.equal(demo.viewer("1001"), null);
    assert.deepEqual(live.viewer("1001"), original);
  } finally {
    live.close();
    demo.close();
  }
});
