import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";
import { channelSettings } from "../src/channel-settings.js";
test("public directory exposes connected channel identities only and removes disconnected channels", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  store.saveChannel("123", "Trizze", {
    value: randomBytes(20).toString("hex"),
  });
  store.saveChannel("456", "itsTrizze", {
    value: randomBytes(20).toString("hex"),
  });
  store.saveChannel("789", "Disconnected", {
    value: randomBytes(20).toString("hex"),
  });
  store.markChannelDisconnected("789");
  const server = createService({
    store,
    twitch: {},
    webhookSecret: randomBytes(32).toString("hex"),
    frontendUrl: "https://trizze.tv/robot/",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api/streamers`;
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual((await response.json()).streamers, [
    { id: "456", displayName: "itsTrizze" },
    { id: "123", displayName: "Trizze" },
  ]);
  store.markChannelDisconnected("123");
  store.deleteChannel("456");
  assert.deepEqual((await (await fetch(url)).json()).streamers, []);
});
test("no alert box is a validated channel-owned design choice", () => {
  assert.equal(channelSettings({ preset: "none" }).preset, "none");
  assert.throws(() => channelSettings({ preset: "<script>" }));
  assert.throws(() => channelSettings({ preset: "none", channelId: "456" }));
});
