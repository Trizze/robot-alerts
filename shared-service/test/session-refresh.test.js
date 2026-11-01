import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";

test("session restoration never waits for an optional Twitch profile lookup", async (t) => {
  const store = new SharedStore(":memory:", {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
  store.upsertViewer("123", "Viewer");
  const token = store.createSession("123", "viewer");
  let lookups = 0,
    release;
  const profile = new Promise((resolve) => {
    release = resolve;
  });
  const server = createService({
    store,
    frontendUrl: "https://trizze.tv/robot/",
    webhookSecret: randomBytes(32).toString("hex"),
    twitch: {
      lookup: () => {
        lookups++;
        return profile;
      },
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`,
    headers = { cookie: `__Host-robot_session=${token}` };
  const first = await fetch(base + "/api/me?profile=0", {
    headers,
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(first.status, 200);
  assert.equal((await first.json()).viewer.id, "123");
  assert.equal(lookups, 0);
  const slow = fetch(base + "/api/me", { headers });
  const refreshed = await fetch(base + "/api/me?profile=0", {
    headers,
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(refreshed.status, 200);
  assert.equal((await refreshed.json()).viewer.displayName, "Viewer");
  release({
    profile_image_url: "https://static-cdn.jtvnw.net/example-300x300.png",
  });
  assert.equal(
    (await (await slow).json()).viewer.avatarUrl,
    "https://static-cdn.jtvnw.net/example-600x600.png",
  );
  assert.deepEqual({ ...store.session(token) }, { id: "123", role: "viewer" });
  assert.equal((await fetch(base + "/api/me?profile=0")).status, 401);
});
