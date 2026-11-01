import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { SharedStore } from "../src/store.js";
import { directoryCache } from "../src/directory-cache.js";
import { unlockMessage, unlockDispatcher } from "../src/unlock-notices.js";
import { parseWebhook } from "../src/eventsub.js";
import { channelSettings } from "../src/channel-settings.js";
import { createService } from "../src/server.js";
const catalog = [1, 2, 3, 4, 5].flatMap((tier) =>
  [0, 1].map((i) => ({
    id: `skin_${tier}_${i}`,
    name: `Skin ${tier}/${i}`,
    tier,
  })),
);
function create() {
  const s = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog,
  });
  s.saveChannel("123", "Streamer", { scope: ["moderator:read:followers"] });
  return s;
}
const event = (extra = {}) => ({
  id: randomUUID(),
  at: new Date().toISOString(),
  channel: "123",
  type: "gift",
  tier: "1000",
  gifts: 5,
  viewer: { id: "456", name: "Viewer" },
  ...extra,
});
test("anonymous summary counts are deduplicated, do not award anyone, and rotate the pooled robot every ten subs", () => {
  const s = create();
  try {
    const e = event({ anonymous: true, viewer: null, gifts: 9 });
    s.record(e);
    s.record(e);
    assert.equal(s.anonymousRobot("123").anonymousGiftTotal, 9);
    assert.equal(s.anonymousRobot("123").selectedPattern, null);
    assert.equal(s.viewer("456"), null);
    assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM ledger").get().n, 0);
    s.record(event({ anonymous: true, viewer: null, gifts: 1 }));
    const first = s.anonymousRobot("123").selectedPattern;
    assert.ok(first);
    s.record(event({ anonymous: true, viewer: null, gifts: 9 }));
    assert.equal(s.anonymousRobot("123").selectedPattern, first);
    s.record(event({ anonymous: true, viewer: null, gifts: 1 }));
    assert.notEqual(s.anonymousRobot("123").selectedPattern, first);
    s.saveChannel("789", "Other", {});
    s.record(
      event({ channel: "789", anonymous: true, viewer: null, gifts: 10 }),
    );
    assert.equal(s.anonymousRobot("789").anonymousGiftTotal, 10);
    assert.equal(s.anonymousRobot("123", "global").anonymousGiftTotal, 30);
    s.deleteChannel("789");
    assert.equal(s.anonymousRobot("123", "global").anonymousGiftTotal, 20);
  } finally {
    s.close();
  }
});
test("NEW persists until a legitimately owned skin is tried, and cannot be cleared for locked skins", () => {
  const s = create();
  try {
    s.record(event({ gifts: 10 }));
    let v = s.viewer("456");
    assert.equal(v.owned.length, 1);
    assert.equal(v.owned[0].isNew, true);
    const p = v.owned[0].id;
    assert.throws(() => s.selectPattern("456", "not_owned"));
    assert.equal(s.viewer("456").owned[0].isNew, true);
    s.selectPattern("456", p);
    assert.equal(s.viewer("456").owned[0].isNew, false);
    assert.equal(s.viewer("456").selectedPattern, p);
    s.selectPattern("456", null);
    assert.equal(s.viewer("456").owned[0].isNew, false);
    s.deleteViewer("456");
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM pattern_seen").get().n,
      0,
    );
  } finally {
    s.close();
  }
});
test("tier and multiple pattern unlocks produce one notice per real award and no command-style replies", async () => {
  const s = create();
  try {
    s.record(event({ gifts: 5 }));
    assert.equal(s.takeUnlockNotice(), null);
    const e = event({ gifts: 100 });
    s.record(e);
    s.record(e);
    const notice = s.takeUnlockNotice();
    assert.equal(notice.tier, 2);
    assert.equal(notice.pattern_count, 3);
    const text = unlockMessage(notice);
    assert.match(text, /reached Tier 2 and unlocked 3 patterns/);
    assert.match(text, /those 100 gifted subs/);
    assert.match(text, /trizze.tv\/robot\//);
    s.finishUnlockNotice(notice.event_id, true);
    assert.equal(s.takeUnlockNotice(), null);
    s.record(event({ gifts: 200 }));
    s.saveBot("999", "TrizzeBot", {
      access_token: randomBytes(24).toString("hex"),
      refresh_token: randomBytes(24).toString("hex"),
    });
    const sent = [];
    const pump = unlockDispatcher(
      s,
      {
        sendChat: async (c, id, message) => {
          sent.push({ c, id, message });
          return true;
        },
      },
      { spacing: 0 },
    );
    await Promise.all([pump(), pump()]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].id, "999");
    assert.match(sent[0].message, /patterns/);
    assert.equal(s.takeUnlockNotice(), null);
  } finally {
    s.close();
  }
});
test("disconnect during bot refresh cannot resurrect encrypted bot authorization", async () => {
  const s = create();
  try {
    s.record(event({ gifts: 10 }));
    s.saveBot("999", "TrizzeBot", {
      access_token: randomBytes(24).toString("hex"),
      refresh_token: randomBytes(24).toString("hex"),
    });
    const pump = unlockDispatcher(
      s,
      {
        sendChat: async () => {
          throw Object.assign(Error("expired"), { status: 401 });
        },
        refresh: async () => {
          s.deleteBot();
          return { access_token: randomBytes(24).toString("hex") };
        },
      },
      { spacing: 0 },
    );
    await pump();
    assert.equal(s.botStatus().connected, false);
  } finally {
    s.close();
  }
});
test("request-driven directory cache shares refreshes, serves failures stale and filters removed IDs", async () => {
  let now = 0,
    calls = 0,
    fail = false,
    release;
  const read = directoryCache(
    async (ids) => {
      calls++;
      if (fail) throw Error("offline");
      await new Promise((r) => (release = r));
      return ids.map((id) => ({ id }));
    },
    () => now,
  );
  const a = read(["1", "2"]),
    b = read(["1", "2"]);
  assert.equal(calls, 1);
  release();
  assert.equal((await a).length, 2);
  await b;
  await read(["1", "2"]);
  assert.equal(calls, 1);
  now = 130000;
  fail = true;
  assert.equal((await read(["1", "2"])).length, 2);
  await read(["1", "2"]);
  assert.equal(calls, 2);
  const result = await read(["1"]);
  assert.deepEqual(result, [{ id: "1" }]);
});
function signed(type, version, condition, event) {
  const secret = randomBytes(32).toString("hex"),
    id = randomUUID(),
    at = new Date().toISOString(),
    body = Buffer.from(
      JSON.stringify({
        subscription: { id: randomUUID(), type, version, condition },
        event,
      }),
    );
  return {
    secret,
    body,
    headers: {
      "twitch-eventsub-message-id": id,
      "twitch-eventsub-message-timestamp": at,
      "twitch-eventsub-message-type": "notification",
      "twitch-eventsub-subscription-type": type,
      "twitch-eventsub-subscription-version": version,
      "twitch-eventsub-message-signature":
        "sha256=" +
        createHmac("sha256", secret)
          .update(id)
          .update(at)
          .update(body)
          .digest("hex"),
    },
  };
}
test("follow v2 and incoming raid v1 use the correct signed condition and recipient channel", () => {
  const f = signed(
    "channel.follow",
    "2",
    { broadcaster_user_id: "123", moderator_user_id: "123" },
    {
      broadcaster_user_id: "123",
      user_id: "456",
      user_name: "Viewer",
      followed_at: new Date().toISOString(),
    },
  );
  assert.equal(parseWebhook(f.headers, f.body, f.secret).event.type, "follow");
  const r = signed(
    "channel.raid",
    "1",
    { to_broadcaster_user_id: "123" },
    {
      to_broadcaster_user_id: "123",
      from_broadcaster_user_id: "789",
      from_broadcaster_user_name: "Raider",
      viewers: 100,
    },
  );
  const raid = parseWebhook(r.headers, r.body, r.secret).event;
  assert.equal(raid.channel, "123");
  assert.equal(raid.viewer.id, "789");
  assert.equal(raid.raidSize, 100);
});
test("bot OAuth is operator-only and preserves the operator session rather than creating a bot session", async (t) => {
  const s = create();
  s.upsertViewer("123", "Operator");
  const owner = s.createSession("123", "streamer"),
    other = s.createSession("456", "viewer");
  const grants = {
    access_token: randomBytes(24).toString("hex"),
    refresh_token: randomBytes(24).toString("hex"),
    scope: ["user:write:chat"],
  };
  const server = createService({
    store: s,
    operatorId: "123",
    botLogin: "TrizzeBot",
    frontendUrl: "https://trizze.tv/robot/",
    webhookSecret: randomBytes(32).toString("hex"),
    twitch: {
      authorizationUrl: (state) =>
        "https://id.twitch.tv/oauth2/authorize?state=" + state,
      exchange: async () => grants,
      user: async () => ({
        id: "999",
        display_name: "TrizzeBot",
        login: "trizzebot",
      }),
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    s.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`,
    cookie = `__Host-robot_session=${owner}`;
  assert.equal(
    (await fetch(base + "/auth/start?role=bot", { redirect: "manual" })).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/auth/start?role=bot", {
        headers: { cookie: `__Host-robot_session=${other}` },
        redirect: "manual",
      })
    ).status,
    403,
  );
  const start = await fetch(base + "/auth/start?role=bot", {
    headers: { cookie },
    redirect: "manual",
  });
  const state = new URL(start.headers.get("location")).searchParams.get(
    "state",
  );
  const response = await fetch(
    base + "/auth/callback?code=example-code&state=" + state,
    {
      headers: { cookie: cookie + "; __Host-robot_state=" + state },
      redirect: "manual",
    },
  );
  assert.equal(response.status, 303);
  assert.equal(s.botStatus().connected, true);
  assert.equal(s.session(owner).id, "123");
  assert.equal(
    s.db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE user_id='999'").get()
      .n,
    0,
  );
  const info = await fetch(base + "/api/bot", { headers: { cookie } });
  assert.deepEqual(await info.json(), { connected: true, name: "TrizzeBot" });
});

test("event switches and self-reported categories are bounded and reject invalid values", () => {
  assert.deepEqual(
    channelSettings({ events: [], games: ["  Just Chatting "] }).games,
    ["Just Chatting"],
  );
  assert.deepEqual(channelSettings({ events: [] }).events, []);
  for (const input of [
    { events: ["unknown"] },
    { events: ["raid", "raid"] },
    { games: Array(6).fill("Game") },
    { games: ["bad\ncategory"] },
    { games: [" "] },
  ])
    assert.throws(() => channelSettings(input));
});
