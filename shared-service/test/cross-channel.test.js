import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";

// Exercise the public webhook and viewer APIs together, without live Twitch credentials.
test("signed events from two channels produce one portable viewer inventory", async (t) => {
  const key = randomBytes(32),
    seed = randomBytes(32),
    secret = randomBytes(32).toString("hex");
  const catalog = [
    { id: "pattern_a", tier: 1 },
    { id: "pattern_b", tier: 1 },
    { id: "pattern_c", tier: 1 },
  ];
  const store = new SharedStore(":memory:", {
    encryptionKey: key,
    patternSeed: seed,
    catalog,
  });
  for (const channel of ["100", "200"])
    store.saveChannel(channel, `Channel ${channel}`, {
      value: randomBytes(32).toString("hex"),
    });
  store.upsertViewer("300", "Viewer");
  const session = store.createSession("300", "viewer"),
    streamer = store.createSession("100", "streamer");
  const server = createService({
    store,
    twitch: { revoke: async () => true },
    webhookSecret: secret,
    frontendUrl: "https://trizze.tv/robot/",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const signed = (type, channel, event) => {
    const id = randomUUID(),
      timestamp = new Date().toISOString();
    const body = JSON.stringify({
      subscription: {
        id: randomUUID(),
        type,
        version: "1",
        condition: { broadcaster_user_id: channel },
      },
      event: { broadcaster_user_id: channel, ...event },
    });
    const signature =
      "sha256=" +
      createHmac("sha256", secret)
        .update(id)
        .update(timestamp)
        .update(body)
        .digest("hex");
    return {
      method: "POST",
      body,
      headers: {
        "twitch-eventsub-message-id": id,
        "twitch-eventsub-message-timestamp": timestamp,
        "twitch-eventsub-message-signature": signature,
        "twitch-eventsub-message-type": "notification",
        "twitch-eventsub-subscription-type": type,
        "twitch-eventsub-subscription-version": "1",
      },
    };
  };
  const gift = signed("channel.subscription.gift", "100", {
    user_id: "300",
    user_name: "Viewer",
    total: 15,
    tier: "1000",
    is_anonymous: false,
  });
  assert.equal((await fetch(base + "/eventsub", gift)).status, 204);
  assert.equal((await fetch(base + "/eventsub", gift)).status, 204); // Twitch retry
  const recipient = signed("channel.subscribe", "100", {
    user_id: "400",
    user_name: "Recipient",
    tier: "1000",
    is_gift: true,
  });
  assert.equal((await fetch(base + "/eventsub", recipient)).status, 204);
  const cheer = signed("channel.cheer", "200", {
    user_id: "300",
    user_name: "Viewer",
    bits: 5000,
    is_anonymous: false,
    message: "never persist this chat text",
  });
  assert.equal((await fetch(base + "/eventsub", cheer)).status, 204);
  const read = async () => {
    const r = await fetch(base + "/api/me", {
      headers: { cookie: `__Host-robot_session=${session}` },
    });
    assert.equal(r.status, 200);
    return (await r.json()).viewer;
  };
  const viewer = await read();
  assert.equal(viewer.points, 25);
  assert.equal(viewer.tier, 1);
  assert.equal(viewer.owned.length, 1);
  assert.equal(store.viewer("400"), null);
  const origin = "https://trizze.tv",
    auth = {
      origin,
      cookie: `__Host-robot_session=${session}`,
      "content-type": "application/json",
    };
  assert.equal(
    (
      await fetch(base + "/api/me/pattern", {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ pattern: viewer.owned[0].id }),
      })
    ).status,
    204,
  );
  assert.equal((await read()).selectedPattern, viewer.owned[0].id);
  const rows = store.db.prepare("SELECT * FROM ledger").all();
  assert.equal(rows.length, 2);
  assert.ok(!JSON.stringify(rows).includes("never persist this chat text"));
  assert.equal(
    (
      await fetch(base + "/api/channel", {
        method: "DELETE",
        headers: { origin, cookie: `__Host-robot_session=${streamer}` },
      })
    ).status,
    204,
  );
  const after = await read();
  assert.equal(after.points, 10);
  assert.equal(after.selectedPattern, viewer.owned[0].id);
  assert.equal(store.hasChannel("100"), false);
  assert.equal(store.hasChannel("200"), true);
});
