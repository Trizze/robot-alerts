import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { channelSettings } from "../src/channel-settings.js";
import {
  validSound,
  BUILTIN_SOUND,
  MAX_SOUND_BYTES,
  overlaySoundSettings,
} from "../src/alert-sounds.js";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";
import { playAlertSound } from "../../website-staging/shared/alert-audio.js";

const wav = Buffer.alloc(48);
wav.write("RIFF");
wav.write("WAVE", 8);
const source = `data:audio/wav;base64,${wav.toString("base64")}`;

test("sound settings restrict formats, size, event keys and finite playback settings", () => {
  assert.equal(validSound(source), true);
  assert.equal(validSound(BUILTIN_SOUND), true);
  for (const src of [
    "https://example.invalid/sound.mp3",
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "data:audio/wav;base64,SGVsbG8=",
    `data:audio/ogg;base64,${Buffer.alloc(MAX_SOUND_BYTES + 1).toString("base64")}`,
  ])
    assert.equal(validSound(src), false);
  for (const input of [
    { sounds: [] },
    { sounds: null },
    { sounds: { unknown: source } },
    { soundVolume: NaN },
    { soundVolume: "1" },
    { soundVolume: 1.1 },
    { soundDelay: -1 },
    { soundDelay: Infinity },
  ])
    assert.throws(() => channelSettings(input));
  const sounds = { sub: source };
  const settings = channelSettings({ sounds, soundVolume: 0, soundDelay: 2.5 });
  sounds.sub = "corrupted";
  assert.equal(settings.sounds.sub, source);
  assert.equal(settings.soundVolume, 0);
  assert.deepEqual(overlaySoundSettings(settings, "sub").sounds, {
    sub: source,
  });
  assert.equal(overlaySoundSettings(settings, "raid").sounds, undefined);
  assert.equal(overlaySoundSettings(settings).sounds, undefined);
});

test("audio upload settings stay channel-owned, persist and are removed on disconnect", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  for (const id of ["123", "456"]) store.saveChannel(id, "Channel", {});
  const session = store.createSession("123", "streamer");
  const server = createService({
    store,
    twitch: {},
    webhookSecret: randomBytes(32).toString("hex"),
    frontendUrl: "https://trizze.tv/robot/",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.close();
  });
  const url = `http://127.0.0.1:${server.address().port}/api/channel/settings`;
  const headers = {
    cookie: `__Host-robot_session=${session}`,
    origin: "https://trizze.tv",
    "content-type": "application/json",
  };
  // Exercise a valid upload larger than the previous 64 KB JSON limit.
  const larger = Buffer.alloc(60000);
  wav.copy(larger);
  const input = {
    sounds: { gift: `data:audio/wav;base64,${larger.toString("base64")}` },
    soundVolume: 0.4,
    soundDelay: 1.2,
  };
  const save = (body, h = headers) =>
    fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) });
  assert.equal(
    (await save(input, { ...headers, origin: "https://evil.invalid" })).status,
    403,
  );
  assert.equal(
    (await save(input, { origin: "https://trizze.tv" })).status,
    401,
  );
  assert.equal((await save({ ...input, channelId: "456" })).status, 400);
  assert.equal((await save(input)).status, 200);
  assert.deepEqual(store.overlaySettings("123").sounds, input.sounds);
  assert.equal(store.overlaySettings("456").sounds, undefined);
  assert.equal(
    (await save({ sounds: { sub: "data:audio/mpeg;base64,bad" } })).status,
    400,
  );
  assert.deepEqual(store.overlaySettings("123").sounds, input.sounds);
  assert.equal(
    (await save({ sounds: { sub: source }, junk: "x".repeat(800001) })).status,
    400,
  );
  assert.equal((await save({ sounds: {} })).status, 200);
  assert.deepEqual(store.overlaySettings("123").sounds, {});
  store.deleteChannel("123");
  assert.equal(store.overlaySettings("123"), null);
});

test("one alert owns its audio; cancellation prevents delayed playback and releases the source", async () => {
  const original = globalThis.Audio,
    players = [];
  globalThis.Audio = class {
    constructor(src) {
      this.src = src;
      this.plays = 0;
      players.push(this);
    }
    play() {
      this.plays++;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    removeAttribute() {
      this.src = "";
    }
    load() {}
  };
  try {
    const settings = {
      sounds: { sub: source },
      soundVolume: 0.3,
      soundDelay: 0.03,
    };
    const cancel = playAlertSound(settings, "sub");
    cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(players[0].plays, 0);
    assert.equal(players[0].src, "");
    const stop = playAlertSound(settings, "sub", () => {}, false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(players[1].plays, 1);
    assert.equal(players[1].volume, 0.3);
    stop();
    assert.equal(players[1].paused, true);
    playAlertSound({ ...settings, soundVolume: 0 }, "sub");
    playAlertSound(settings, "raid");
    assert.equal(players.length, 2);
  } finally {
    globalThis.Audio = original;
  }
});

test("OBS tests use the selected event and its sound without awarding points or sending chat", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  store.saveChannel("123", "Demo streamer", {});
  store.upsertViewer("123", "Demo streamer");
  store.saveOverlaySettings("123", {
    sounds: Object.fromEntries(
      ["sub", "resub", "gift", "cheer", "follow", "raid"].map((type) => [
        type,
        source,
      ]),
    ),
  });
  let now = Date.now();
  const server = createService({
    store,
    twitch: {},
    webhookSecret: randomBytes(32).toString("hex"),
    frontendUrl: "https://trizze.tv/robot/",
    clock: () => now,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    cookie: `__Host-robot_session=${store.createSession("123", "streamer")}`,
    origin: "https://trizze.tv",
    "content-type": "application/json",
  };
  const stream = await fetch(base + "/overlay/123/events");
  const reader = stream.body.getReader();
  let buffer = "";
  async function message() {
    while (!buffer.includes("\n\n")) {
      const next = await reader.read();
      assert.equal(next.done, false);
      buffer += new TextDecoder().decode(next.value);
    }
    const end = buffer.indexOf("\n\n"),
      row = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return JSON.parse(row.replace(/^data: /, ""));
  }
  await message();
  for (const type of ["sub", "resub", "gift", "cheer", "follow", "raid"]) {
    now += 11000;
    const response = await fetch(base + "/api/channel/test", {
      method: "POST",
      headers,
      body: JSON.stringify({ type }),
    });
    assert.equal(response.status, 200);
    const { alert } = await message();
    assert.equal(alert.type, type);
    assert.deepEqual(alert.settings.sounds, { [type]: source });
    assert.equal(alert.demo, true);
    assert.equal(store.viewer("123").points, 0);
  }
  for (const input of [
    { type: "unknown" },
    { type: "gift", channel: "456" },
    null,
  ])
    assert.equal(
      (
        await fetch(base + "/api/channel/test", {
          method: "POST",
          headers,
          body: JSON.stringify(input),
        })
      ).status,
      400,
    );
  await reader.cancel();
});
