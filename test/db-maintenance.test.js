import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../src/db.js";

test("the store does not expose the removed clip cache operation", () => {
  const store = new Store(":memory:");
  try {
    assert.equal(store.cacheClip, undefined);
  } finally {
    store.close();
  }
});

test("viewer list aggregates multiple channels without multiplying metrics or unlocks", () => {
  const store = new Store(":memory:");
  try {
    const e = (id, channel, bits) => ({
      id,
      type: "cheer",
      channel,
      at: new Date().toISOString(),
      viewer: { id: "123", name: "Viewer" },
      bits,
    });
    store.apply(e("one", "a", 500));
    store.apply(e("two", "b", 700));
    const row = store.viewer("123"),
      list = store.list();
    assert.equal(list.length, 1);
    assert.deepEqual(list[0], row);
    assert.equal(row.metrics.bits, 1200);
    assert.equal(new Set(row.owned).size, row.owned.length);
  } finally {
    store.close();
  }
});

test("receipt cleanup is indexed, scheduled separately and retains recent receipts", () => {
  const store = new Store(":memory:");
  try {
    const now = Date.now(),
      old = new Date(now - 31 * 86400000).toISOString(),
      recent = new Date(now - 86400000).toISOString();
    store.db.prepare("INSERT INTO receipts VALUES(?,?)").run("old", old);
    store.db.prepare("INSERT INTO receipts VALUES(?,?)").run("recent", recent);
    store.apply({
      id: "next",
      channel: "a",
      at: new Date().toISOString(),
      type: "observation",
      viewer: null,
    });
    assert.ok(store.db.prepare("SELECT 1 FROM receipts WHERE id=?").get("old"));
    assert.equal(store.pruneReceipts(now), 1);
    assert.equal(
      store.db.prepare("SELECT 1 FROM receipts WHERE id=?").get("old"),
      undefined,
    );
    assert.ok(
      store.db.prepare("SELECT 1 FROM receipts WHERE id=?").get("recent"),
    );
    assert.ok(
      store.db
        .prepare("PRAGMA index_list('receipts')")
        .all()
        .some((row) => row.name === "receipts_created_at"),
    );
  } finally {
    store.close();
  }
});

test("announcement flushing respects the viewer filter and delivers each pending row once", async () => {
  const store = new Store(":memory:");
  try {
    store.db
      .prepare(
        "INSERT INTO announcements(id,channel,message,viewer) VALUES(?,?,?,?)",
      )
      .run("a", "channel", "allowed", "1");
    store.db
      .prepare(
        "INSERT INTO announcements(id,channel,message,viewer) VALUES(?,?,?,?)",
      )
      .run("b", "channel", "blocked", "2");
    const delivered = [];
    await store.flushAnnouncements({
      allow: (row) => row.viewer === "1",
      deliver: (row) => delivered.push(row.message),
    });
    await store.flushAnnouncements({
      allow: (row) => row.viewer === "1",
      deliver: (row) => delivered.push(row.message),
    });
    assert.deepEqual(delivered, ["allowed"]);
    assert.equal(
      store.db.prepare("SELECT status FROM announcements WHERE id=?").get("b")
        .status,
      "pending",
    );
  } finally {
    store.close();
  }
});
