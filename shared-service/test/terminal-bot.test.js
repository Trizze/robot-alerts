import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SharedStore } from "../src/store.js";
import { createService } from "../src/server.js";
import {
  startBotSetup,
  claimBotSetup,
  finishBotSetup,
  failBotSetup,
  botSetupStatus,
} from "../src/bot-setup.js";
function fixture(path = ":memory:") {
  return new SharedStore(path, {
    encryptionKey: randomBytes(32),
    patternSeed: randomBytes(32),
    catalog: [],
  });
}
const grants = () => ({
  access_token: randomBytes(24).toString("hex"),
  refresh_token: randomBytes(24).toString("hex"),
  scope: ["user:write:chat"],
});
const bot = { id: "999", login: "trizzebot", display_name: "TrizzeBot" };
async function service(t, store, overrides = {}) {
  let calls = 0;
  const server = createService({
    store,
    botLogin: "TrizzeBot",
    frontendUrl: "https://trizze.tv/robot/",
    webhookSecret: randomBytes(32).toString("hex"),
    twitch: {
      exchange: async () => {
        calls++;
        return grants();
      },
      user: async () => bot,
      ...overrides,
    },
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    store.close();
  });
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    calls: () => calls,
  };
}
test("terminal bot authorization needs no website session and never logs the bot into the picker", async (t) => {
  const s = fixture();
  s.upsertViewer("123", "Owner");
  const owner = s.createSession("123", "streamer");
  const api = await service(t, s);
  for (const headers of [{}, { cookie: `__Host-robot_session=${owner}` }])
    assert.equal(
      (
        await fetch(api.base + "/auth/start?role=bot", {
          headers,
          redirect: "manual",
        })
      ).status,
      410,
    );
  const setup = startBotSetup(s);
  assert.equal(
    s.db.prepare("SELECT hash FROM bot_setup").get().hash,
    createHash("sha256").update(setup.state).digest("hex"),
  );
  const r = await fetch(
    api.base + "/auth/callback?code=example-code&state=" + setup.state,
    { redirect: "manual" },
  );
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "https://trizze.tv/robot/bot-ready/");
  assert.equal(r.headers.get("set-cookie"), null);
  assert.equal(botSetupStatus(s, setup.hash), "complete");
  assert.equal(s.botStatus().connected, true);
  assert.equal(s.session(owner).id, "123");
  assert.equal(s.viewer("999"), null);
  assert.equal(s.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 1);
  assert.equal(
    (
      await fetch(
        api.base + "/auth/callback?code=example-code&state=" + setup.state,
        { redirect: "manual" },
      )
    ).status,
    400,
  );
  assert.equal(api.calls(), 1, "replay must not exchange another code");
  assert.equal(
    (
      await fetch(api.base + "/api/bot", {
        headers: { cookie: `__Host-robot_session=${owner}` },
      })
    ).status,
    404,
  );
});
test("wrong bot account, missing permission and denied grants fail without replacing existing credentials", async (t) => {
  for (const mode of ["wrong-account", "missing-scope", "denied"]) {
    await t.test(mode, async (t) => {
      const s = fixture();
      s.saveBot("999", "TrizzeBot", grants());
      const previous = s.botCredentials();
      const api = await service(t, s, {
        user: async () =>
          mode === "wrong-account"
            ? { ...bot, id: "123", login: "trizze" }
            : bot,
        exchange: async () => ({
          ...grants(),
          scope: mode === "missing-scope" ? [] : ["user:write:chat"],
        }),
      });
      const setup = startBotSetup(s);
      const query =
        mode === "denied" ? "error=access_denied" : "code=example-code";
      const r = await fetch(
        api.base + "/auth/callback?" + query + "&state=" + setup.state,
        { redirect: "manual" },
      );
      assert.ok([400, 403].includes(r.status));
      assert.equal(botSetupStatus(s, setup.hash), "failed");
      assert.deepEqual(s.botCredentials(), previous);
    });
  }
});
test("expired or replaced setup cannot save credentials, and cleanup bounds the record", () => {
  const s = fixture();
  try {
    const old = startBotSetup(s, 1000);
    assert.equal(claimBotSetup(s, old.state, 1001), old.hash);
    const current = startBotSetup(s, 1002);
    assert.throws(() => finishBotSetup(s, old.hash, bot, grants(), 1003));
    failBotSetup(s, old.hash);
    assert.equal(botSetupStatus(s, current.hash, 1003), "pending");
    assert.equal(s.botStatus().connected, false);
    assert.equal(claimBotSetup(s, "forged", 1003), null);
    assert.equal(claimBotSetup(s, current.state, 1002 + 600000), null);
    assert.equal(botSetupStatus(s, current.hash, 1002 + 600000), "expired");
    s.cleanup(1002 + 600000);
    assert.equal(
      s.db.prepare("SELECT COUNT(*) AS n FROM bot_setup").get().n,
      0,
    );
  } finally {
    s.close();
  }
});
test("server CLI prints only the authorization link and status, using existing callback and minimum scope", () => {
  const root = mkdtempSync(join(tmpdir(), "robot-terminal-bot-"));
  try {
    const secret = randomBytes(24).toString("hex");
    const env = {
      PATH: process.env.PATH,
      NODE_NO_WARNINGS: "1",
      DATA_PATH: join(root, "data.sqlite"),
      DATA_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      PATTERN_SEED: randomBytes(32).toString("base64"),
      TWITCH_CLIENT_ID: randomBytes(15).toString("hex"),
      TWITCH_CLIENT_SECRET: secret,
      PUBLIC_BASE_URL: "https://trizze.tv/robot/api/",
      FRONTEND_URL: "https://trizze.tv/robot/",
    };
    const call = (input) =>
      execFileSync(process.execPath, ["shared-service/src/bot-setup-cli.js"], {
        env,
        input: JSON.stringify(input),
        encoding: "utf8",
      });
    const output = call({ action: "start" }),
      setup = JSON.parse(output),
      url = new URL(setup.url);
    assert.equal(output.includes(secret), false);
    assert.equal(output.includes(env.DATA_ENCRYPTION_KEY), false);
    assert.equal(url.origin, "https://id.twitch.tv");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("scope"), "user:write:chat");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://trizze.tv/robot/api/auth/callback",
    );
    assert.equal(url.searchParams.has("access_token"), false);
    assert.deepEqual(JSON.parse(call({ action: "status", hash: setup.hash })), {
      status: "pending",
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
