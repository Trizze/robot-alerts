import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOUND_LIBRARY } from "../../website-staging/shared/sound-library.js";
import { channelSettings } from "../src/channel-settings.js";
import {
  validSound,
  BUILTIN_SOUND,
  librarySoundsOnly,
  overlaySoundSettings,
} from "../src/alert-sounds.js";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";
import { playAlertSound } from "../../website-staging/shared/alert-audio.js";

const source = BUILTIN_SOUND;
const oldUpload =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

test("every bundled sound is a unique shipped MP3 and is accepted by the API", () => {
  assert.equal(SOUND_LIBRARY.length, 5);
  assert.equal(new Set(SOUND_LIBRARY.map((item) => item.src)).size, 5);
  for (const item of SOUND_LIBRARY) {
    assert.ok(item.name && item.duration > 0 && item.duration < 5);
    const file = readFileSync(
      new URL(
        "../../website-staging" + item.src.replace("/robot/", "/"),
        import.meta.url,
      ),
    );
    assert.ok(file.length > 100 && file.length < 100000);
    assert.equal(validSound(item.src), true);
  }
});

test("sound settings accept only bundled paths and finite playback settings", () => {
  assert.equal(validSound(source), true);
  assert.equal(validSound(oldUpload), false);
  assert.deepEqual(librarySoundsOnly({ sub: oldUpload, cheer: source }), {
    cheer: source,
  });
  assert.equal(validSound(BUILTIN_SOUND), true);
  for (const src of [
    "https://example.invalid/sound.mp3",
    "javascript:alert(1)",
    "data:text/html;base64,AAAA",
    "data:audio/wav;base64,SGVsbG8=",
    "/robot/sounds/not-bundled.mp3",
    source + "?arbitrary=1",
    "/robot/sounds/../other.mp3",
    "https://trizze.tv" + source,
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

test("bundled sound settings stay channel-owned and reject uploads", async (t) => {
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
  const input = {
    sounds: { gift: source },
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
  assert.equal((await save({ sounds: { sub: oldUpload } })).status, 400);
  assert.deepEqual(store.overlaySettings("123").sounds, input.sounds);
  assert.equal(
    (await save({ sounds: { sub: source }, junk: "x".repeat(65537) })).status,
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
    playAlertSound({ sounds: { sub: oldUpload } }, "sub");
    playAlertSound(
      { sounds: { sub: "https://evil.invalid/audio.mp3" } },
      "sub",
    );
    assert.equal(players.length, 2);
  } finally {
    globalThis.Audio = original;
  }
});

test("legacy uploaded sound bytes are never returned or broadcast", () => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  try {
    store.saveChannel("123", "Demo", {});
    const legacy = {
      preset: "02",
      sounds: { sub: oldUpload, cheer: source },
      soundVolume: 0.4,
      soundDelay: 1.2,
    };
    store.db
      .prepare("UPDATE channels SET overlay_settings=? WHERE id=?")
      .run(JSON.stringify(legacy), "123");
    const settings = store.overlaySettings("123");
    assert.deepEqual(settings.sounds, { cheer: source });
    assert.equal(settings.preset, "02");
    assert.equal(settings.soundVolume, 0.4);
    assert.equal(settings.soundDelay, 1.2);
    assert.equal(overlaySoundSettings(settings, "sub").sounds, undefined);
    assert.equal(JSON.stringify(settings).includes("base64"), false);
  } finally {
    store.close();
  }
});

test("a blocked player retries on a gesture and removes its listener on success or stop", async () => {
  const previous = {
    Audio: globalThis.Audio,
    add: globalThis.addEventListener,
    remove: globalThis.removeEventListener,
  };
  let listener,
    attempts = 0,
    blocked = 0,
    playing = 0;
  globalThis.addEventListener = (type, fn) => {
    listener = fn;
  };
  globalThis.removeEventListener = (type, fn) => {
    if (listener === fn) listener = undefined;
  };
  globalThis.Audio = class {
    play() {
      attempts++;
      return attempts === 1
        ? Promise.reject(new Error("Gesture required"))
        : Promise.resolve();
    }
    pause() {}
    removeAttribute() {}
    load() {}
  };
  try {
    const stop = playAlertSound(
      { sounds: { sub: source } },
      "sub",
      () => blocked++,
      false,
      () => playing++,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(blocked, 1);
    assert.equal(typeof listener, "function");
    listener();
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(attempts, 2);
    assert.equal(playing, 1);
    assert.equal(listener, undefined);
    stop();
    assert.equal(listener, undefined);
  } finally {
    globalThis.Audio = previous.Audio;
    if (previous.add) globalThis.addEventListener = previous.add;
    else delete globalThis.addEventListener;
    if (previous.remove) globalThis.removeEventListener = previous.remove;
    else delete globalThis.removeEventListener;
  }
});

test("startup removes previous uploads once and preserves points, sessions and other settings", () => {
  const folder = mkdtempSync(join(tmpdir(), "robot-sound-migration-"));
  const options = {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [{ id: "test_skin", tier: 1 }],
  };
  const file = join(folder, "test.sqlite");
  let store = new SharedStore(file, options);
  try {
    store.saveChannel("123", "Demo", {});
    store.upsertViewer("123", "Demo");
    const session = store.createSession("123", "streamer");
    store.record({
      id: "synthetic-sub",
      channel: "123",
      type: "sub",
      tier: "1000",
      viewer: { id: "456", name: "Demo supporter" },
      at: new Date().toISOString(),
    });
    const viewer = store.viewer("456");
    const settings = {
      preset: "02",
      soundVolume: 0.4,
      soundDelay: 1.2,
      chatAnnouncements: true,
      sounds: { sub: oldUpload, cheer: source },
    };
    store.db
      .prepare("UPDATE channels SET overlay_settings=? WHERE id=?")
      .run(JSON.stringify(settings), "123");
    store.close();
    store = new SharedStore(file, options);
    const raw = JSON.parse(
      store.db
        .prepare("SELECT overlay_settings FROM channels WHERE id=?")
        .get("123").overlay_settings,
    );
    assert.deepEqual(raw, { ...settings, sounds: { cheer: source } });
    assert.deepEqual(store.viewer("456"), viewer);
    assert.equal(store.session(session).id, "123");
    assert.equal(store.hasChannel("123"), true);
    assert.equal(store.removeUploadedSounds(), 0);
  } finally {
    store.close();
    rmSync(folder, { recursive: true, force: true });
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
