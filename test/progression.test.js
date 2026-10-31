import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/db.js";
import { defaults } from "../src/robots/registry.js";
const event = (id, type, more = {}) => ({
  id,
  type,
  channel: "channel-a",
  at: new Date().toISOString(),
  viewer: { id: "viewer-1", name: "<img src=x onerror=bad()>" },
  ...more,
});
test("duplicate delivery and cross-channel tenure do not multiply progress", () => {
  const store = new Store(":memory:");
  try {
    store.apply(event("one", "resub", { months: 3 }));
    store.apply(event("two", "resub", { months: 3, channel: "channel-b" }));
    assert.equal(store.viewer("viewer-1").metrics.months, 3);
    store.apply(event("cheer-one", "cheer", { bits: 1000 }));
    const duplicate = store.apply(event("cheer-one", "cheer", { bits: 1000 }));
    assert.equal(duplicate.duplicate, true);
    assert.equal(store.viewer("viewer-1").metrics.bits, 1000);
    store.apply(
      event("cheer-two", "cheer", { bits: 150, channel: "channel-b" }),
    );
    assert.equal(store.viewer("viewer-1").metrics.bits, 1150);
  } finally {
    store.close();
  }
});
test("explicit customization survives unlocks, and locked or arbitrary parts are rejected", () => {
  const store = new Store(":memory:");
  try {
    store.apply(event("one", "sub", { months: 1 }));
    store.setLook("viewer-1", { hat: "none" });
    store.apply(event("two", "resub", { months: 12 }));
    assert.equal(store.viewer("viewer-1").look.hat, "none");
    assert.ok(store.viewer("viewer-1").owned.includes("crown"));
    assert.throws(
      () => store.setLook("viewer-1", { entrance: "beacon" }),
      /not earned/,
    );
    assert.throws(
      () => store.setLook("viewer-1", { script: "bad" }),
      /Unknown/,
    );
    store.setLook("viewer-1", {}, true);
    assert.deepEqual(store.viewer("viewer-1").look, defaults);
    assert.ok(store.viewer("viewer-1").owned.includes("crown"));
  } finally {
    store.close();
  }
});
test("chat text is not stored and anonymous gifts gain no ownership", () => {
  const store = new Store(":memory:");
  try {
    store.apply(
      event("chat-one", "chat", { message: "<script>untrusted</script>" }),
    );
    store.apply(event("chat-two", "chat", { message: "later" }));
    const observation = store.db
      .prepare(
        "SELECT first_message, followed_at FROM observations WHERE viewer=? AND channel=?",
      )
      .get("viewer-1", "channel-a");
    assert.equal(observation.first_message, null);
    assert.equal(observation.followed_at, null);
    const result = store.apply(
      event("anon", "gift", { viewer: null, gifts: 100 }),
    );
    assert.equal(result.viewer, null);
    assert.equal(store.list().length, 1);
    assert.equal(store.viewer("viewer-1").metrics.gifts, 0);
  } finally {
    store.close();
  }
});
