import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, stat, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OAuthSetup,
  CALLBACK,
  permissions,
  normalizeLogin,
  equalState,
  exchangeCode,
  saveEnv,
  assertNewEnv,
} from "../scripts/setup-lib.js";

test("usernames and states reject malformed or absent data", () => {
  assert.equal(normalizeLogin("@Robot_Bot"), "robot_bot");
  assert.throws(() => normalizeLogin("https://twitch.tv/robot"));
  assert.equal(equalState(null, null), false);
  assert.equal(equalState("hello", "shorter"), false);
  assert.equal(equalState("hello", "hello"), true);
});
function credentials() {
  return {
    clientId: randomBytes(15).toString("hex"),
    clientSecret: randomBytes(15).toString("hex"),
    access: randomBytes(15).toString("hex"),
    refresh: randomBytes(15).toString("hex"),
  };
}
function mockTwitch(values, role = "bot", login = "robot_bot") {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/token")) {
      assert.equal(new URL(url).search, "");
      assert.equal(options.body.get("client_secret"), values.clientSecret);
      assert.equal(options.body.get("redirect_uri"), CALLBACK);
      assert.equal(options.body.get("grant_type"), "authorization_code");
      return {
        ok: true,
        json: async () => ({
          access_token: values.access,
          refresh_token: values.refresh,
        }),
      };
    }
    assert.equal(url, "https://id.twitch.tv/oauth2/validate");
    assert.equal(options.headers.Authorization, `OAuth ${values.access}`);
    return {
      ok: true,
      json: async () => ({
        client_id: values.clientId,
        user_id: "123456",
        login,
        scopes: permissions[role],
      }),
    };
  };
  return { fetcher, calls };
}
test("authorization exchange keeps credentials in request body/headers and verifies identity", async () => {
  const values = credentials(),
    { fetcher, calls } = mockTwitch(values);
  const result = await exchangeCode({
    ...values,
    code: randomBytes(15).toString("hex"),
    expectedLogin: "robot_bot",
    role: "bot",
    fetcher,
  });
  assert.equal(result.userId, "123456");
  assert.equal(calls.length, 2);
  await assert.rejects(
    exchangeCode({
      ...values,
      code: "invalid",
      expectedLogin: "wrong_account",
      role: "bot",
      fetcher,
    }),
    /wrong Twitch account/,
  );
});
test("network and Twitch failures cannot echo response bodies", async () => {
  const values = credentials();
  await assert.rejects(
    exchangeCode({
      ...values,
      code: "invalid",
      role: "bot",
      expectedLogin: "robot_bot",
      fetcher: async () => {
        throw new Error(values.access);
      },
    }),
    (error) => !error.message.includes(values.access),
  );
  await assert.rejects(
    exchangeCode({
      ...values,
      code: "invalid",
      role: "bot",
      expectedLogin: "robot_bot",
      fetcher: async () => ({
        ok: false,
        status: 401,
        json: () => {
          throw new Error(values.access);
        },
      }),
    }),
    /HTTP 401/,
  );
});
test("callback validates host and state, uses one-time code, and supports wrong-account retry", async () => {
  const values = credentials(),
    { fetcher, calls } = mockTwitch(values);
  const server = new OAuthSetup({ ...values, fetcher, port: 0 });
  await server.listen();
  const base = `http://127.0.0.1:${server.port}`;
  const resultPromise = server.begin("bot", "robot_bot");
  try {
    const noState = await fetch(`${base}/callback?code=invalid`, {
      redirect: "manual",
    });
    assert.equal(noState.status, 400);
    assert.equal(calls.length, 0);
    const start = await fetch(`${base}/start/bot`, { redirect: "manual" });
    assert.equal(start.status, 302);
    const authorize = new URL(start.headers.get("location"));
    assert.equal(authorize.searchParams.get("response_type"), "code");
    assert.equal(authorize.searchParams.has("client_secret"), false);
    const wrong = await fetch(`${base}/callback?state=wrong&code=invalid`);
    assert.equal(wrong.status, 400);
    assert.equal(calls.length, 0);
    const code = randomBytes(15).toString("hex"),
      state = authorize.searchParams.get("state");
    const complete = await fetch(
      `${base}/callback?${new URLSearchParams({ state, code })}`,
      { redirect: "manual" },
    );
    assert.equal(complete.status, 303);
    assert.equal(complete.headers.get("location"), "/done");
    assert.equal((await resultPromise).login, "robot_bot");
    assert.equal(calls.length, 2);
    const replay = await fetch(
      `${base}/callback?${new URLSearchParams({ state, code })}`,
    );
    assert.equal(replay.status, 404);
    assert.equal(calls.length, 2);
  } finally {
    await server.close();
  }
});
test("wrong account can retry without saving credentials", async () => {
  const values = credentials();
  let wrong = true;
  const fetcher = async (...args) =>
    mockTwitch(values, "bot", wrong ? "wrong_account" : "robot_bot").fetcher(
      ...args,
    );
  const server = new OAuthSetup({ ...values, fetcher, port: 0 });
  await server.listen();
  const base = `http://127.0.0.1:${server.port}`;
  const waiting = server.begin("bot", "robot_bot");
  const complete = async () => {
    const response = await fetch(`${base}/start/bot`, { redirect: "manual" });
    const state = new URL(response.headers.get("location")).searchParams.get(
      "state",
    );
    return fetch(
      `${base}/callback?${new URLSearchParams({ state, code: randomBytes(15).toString("hex") })}`,
      { redirect: "manual" },
    );
  };
  try {
    assert.equal((await complete()).status, 400);
    wrong = false;
    assert.equal((await complete()).status, 303);
    assert.equal((await waiting).login, "robot_bot");
  } finally {
    await server.close();
  }
});
test("private configuration write refuses overwrite, symlinks and newline injection", async () => {
  const folder = await mkdtemp(join(tmpdir(), "robot-setup-test-"));
  const target = join(folder, "configuration.txt");
  try {
    await assertNewEnv(target);
    await saveEnv(target, { PORT: "3210" });
    if (process.platform !== "win32")
      assert.equal((await stat(target)).mode & 0o777, 0o600);
    await assert.rejects(assertNewEnv(target), /already exists/);
    await assert.rejects(
      saveEnv(target, { PORT: "9999" }),
      /not read or overwritten/,
    );
    await assert.rejects(
      saveEnv(join(folder, "invalid.txt"), { PORT: "3210\nOTHER=oops" }),
      /invalid configuration/,
    );
    const { symlink } = await import("node:fs/promises");
    await writeFile(join(folder, "existing.txt"), "ordinary data");
    await symlink(join(folder, "existing.txt"), join(folder, "link.txt"));
    await assert.rejects(
      saveEnv(join(folder, "link.txt"), { PORT: "3210" }),
      /not read or overwritten/,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
