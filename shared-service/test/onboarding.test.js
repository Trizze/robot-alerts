import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHmac, randomUUID } from "node:crypto";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";
import { OverlayHub } from "../src/overlay-hub.js";

test("streamer setup enforces ownership, validates settings, and sends deduplicated visual events without test points", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [{ id: "green_marble_pattern_tiles", tier: 1 }],
  });
  for (const id of ["123", "789"]) {
    store.upsertViewer(id, "Streamer");
    store.saveChannel(id, "Streamer", {
      access_token: randomBytes(32).toString("hex"),
    });
  }
  const secret = randomBytes(32).toString("hex");
  const server = createService({
    store,
    webhookSecret: secret,
    frontendUrl: "https://trizze.tv/robot/",
    twitch: {
      lookup: async () => ({
        profile_image_url: "https://static-cdn.jtvnw.net/example-300x300.png",
      }),
      revoke: async () => true,
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const owner = {
    cookie: `__Host-robot_session=${store.createSession("123", "streamer")}`,
    origin: "https://trizze.tv",
    "content-type": "application/json",
  };
  const other = {
    cookie: `__Host-robot_session=${store.createSession("789", "streamer")}`,
    origin: "https://trizze.tv",
    "content-type": "application/json",
  };
  const viewer = {
    cookie: `__Host-robot_session=${store.createSession("123", "viewer")}`,
    origin: "https://trizze.tv",
  };
  assert.equal((await fetch(base + "/api/channel/settings")).status, 401);
  assert.equal(
    (await fetch(base + "/api/channel/settings", { headers: viewer })).status,
    403,
  );
  assert.equal((await fetch(base + "/overlay/000/events")).status, 404);
  assert.equal(
    (
      await fetch(base + "/overlay/123/events", {
        headers: { origin: "https://evil.invalid" },
      })
    ).status,
    403,
  );
  for (const input of [
    { resolution: "4k" },
    { preset: "06" },
    { theme: "<script>" },
    { channelId: "789" },
    null,
  ])
    assert.equal(
      (
        await fetch(base + "/api/channel/settings", {
          method: "POST",
          headers: owner,
          body: JSON.stringify(input),
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await fetch(base + "/api/channel/settings", {
        method: "POST",
        headers: { ...owner, origin: "https://evil.invalid" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/channel/test", {
        method: "POST",
        headers: owner,
      })
    ).status,
    409,
  );
  const stream = await fetch(base + "/overlay/123/events");
  const reader = stream.body.getReader();
  let buffer = "";
  async function message() {
    while (!buffer.includes("\n\n")) {
      const { value, done } = await reader.read();
      assert.equal(done, false);
      buffer += new TextDecoder().decode(value);
    }
    const end = buffer.indexOf("\n\n"),
      row = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return JSON.parse(row.replace(/^data: /, ""));
  }
  assert.equal((await message()).kind, "settings");
  const settings = { resolution: "1440p", preset: "02", theme: "gaming" };
  assert.equal(
    (
      await fetch(base + "/api/channel/settings", {
        method: "POST",
        headers: owner,
        body: JSON.stringify(settings),
      })
    ).status,
    200,
  );
  assert.deepEqual((await message()).settings, settings);
  assert.equal(
    (await fetch(base + "/api/channel/settings", { headers: other })).status,
    200,
  );
  assert.equal(store.overlaySettings("789").resolution, "1080p");
  assert.equal(
    (
      await fetch(base + "/api/channel/test", {
        method: "POST",
        headers: viewer,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/channel/test", {
        method: "POST",
        headers: owner,
      })
    ).status,
    200,
  );
  let alert = (await message()).alert;
  assert.equal(alert.demo, true);
  assert.equal(alert.viewer.id, "123");
  assert.equal(alert.settings.preset, "02");
  assert.equal(store.viewer("123").points, 0);
  // A real award earns an installed pattern; the next webhook must carry it
  // to any participating channel's display stream without altering its scale.
  store.record({
    id: randomUUID(),
    channel: "123",
    at: new Date().toISOString(),
    type: "gift",
    tier: "1000",
    gifts: 10,
    viewer: { id: "456", name: "Supporter" },
  });
  store.selectPattern("456", "green_marble_pattern_tiles");
  store.updateAppearance("456", {
    patternScale: 1.5,
    chestType: "emote",
    chestValue: "304486301",
  });
  assert.equal(
    (
      await fetch(base + "/api/channel/test", {
        method: "POST",
        headers: owner,
      })
    ).status,
    429,
  );
  const id = randomUUID(),
    at = new Date().toISOString(),
    payload = JSON.stringify({
      subscription: {
        id: randomUUID(),
        type: "channel.cheer",
        version: "1",
        condition: { broadcaster_user_id: "123" },
      },
      event: {
        broadcaster_user_id: "123",
        user_id: "456",
        user_name: "Supporter",
        bits: 500,
        is_anonymous: false,
      },
    });
  const headers = {
    "twitch-eventsub-message-id": id,
    "twitch-eventsub-message-timestamp": at,
    "twitch-eventsub-message-signature":
      "sha256=" +
      createHmac("sha256", secret)
        .update(id)
        .update(at)
        .update(payload)
        .digest("hex"),
    "twitch-eventsub-message-type": "notification",
    "twitch-eventsub-subscription-type": "channel.cheer",
    "twitch-eventsub-subscription-version": "1",
  };
  for (let i = 0; i < 2; i++)
    assert.equal(
      (
        await fetch(base + "/eventsub", {
          method: "POST",
          headers,
          body: payload,
        })
      ).status,
      204,
    );
  alert = (await message()).alert;
  assert.equal(alert.type, "cheer");
  assert.equal(alert.bits, 500);
  assert.equal(alert.demo, false);
  assert.equal(store.viewer("456").points, 11);
  assert.equal(alert.viewer.selectedPattern, "green_marble_pattern_tiles");
  assert.equal(alert.viewer.patternScale, 1.5);
  assert.equal(alert.viewer.chestType, "emote");
  assert.equal(alert.viewer.chestValue, "304486301");
  assert.equal(
    (
      await fetch(base + "/api/channel/settings", {
        method: "POST",
        headers: owner,
        body: JSON.stringify(settings),
      })
    ).status,
    200,
  );
  assert.equal(
    (await message()).kind,
    "settings",
    "duplicate delivery emitted no second alert",
  );
  await reader.cancel();
  store.saveChannel("123", "Reconnected", {
    access_token: randomBytes(32).toString("hex"),
  });
  assert.deepEqual(store.overlaySettings("123"), settings);
  store.deleteChannel("123");
  assert.equal(store.overlaySettings("123"), null);
});

test("display streams are bounded and slow consumers are disconnected", () => {
  const hub = new OverlayHub(),
    clients = [];
  function response() {
    return {
      status: 0,
      writeHead(s) {
        this.status = s;
        return this;
      },
      write() {
        return true;
      },
      end() {},
      on() {},
      destroy() {
        this.destroyed = true;
      },
    };
  }
  for (let i = 0; i < 4; i++) {
    const res = response();
    clients.push(res);
    hub.connect("123", {}, res, {});
  }
  assert.equal(clients[3].status, 429);
  assert.equal(hub.total, 3);
  clients[0].write = () => false;
  hub.send("123", { kind: "settings" });
  assert.equal(clients[0].destroyed, true);
  hub.close();
});

test("OAuth setup return is limited to the fixed onboarding route", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  const server = createService({
    store,
    webhookSecret: randomBytes(32).toString("hex"),
    frontendUrl: "https://trizze.tv/robot/",
    twitch: {
      authorizationUrl: (state) =>
        `https://id.twitch.tv/oauth2/authorize?state=${state}`,
      exchange: async () => ({ access_token: randomBytes(32).toString("hex") }),
      user: async () => ({ id: "123", display_name: "Streamer" }),
      subscribe: async () => {},
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [returnTo, expected] of [
    ["start", "https://trizze.tv/robot/start/"],
    ["https://evil.invalid", "https://trizze.tv/robot/"],
  ]) {
    const start = await fetch(
      base +
        "/auth/start?role=streamer&returnTo=" +
        encodeURIComponent(returnTo),
      { redirect: "manual" },
    );
    const state = new URL(start.headers.get("location")).searchParams.get(
      "state",
    );
    const cookie = start.headers.get("set-cookie").split(";")[0];
    const finish = await fetch(
      base + "/auth/callback?code=ephemeral-test-code&state=" + state,
      { headers: { cookie }, redirect: "manual" },
    );
    assert.equal(finish.status, 303);
    assert.equal(finish.headers.get("location"), expected);
  }
});
