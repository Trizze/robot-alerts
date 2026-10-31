import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { twitchClient } from "../src/twitch.js";

test("all Twitch requests set a timeout and reject redirects", async () => {
  const calls = [],
    value = randomBytes(32).toString("hex");
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.includes("/oauth2/token")
          ? { access_token: value, expires_in: 3600 }
          : { data: [] },
    };
  };
  const client = twitchClient({
    clientId: randomBytes(16).toString("hex"),
    clientSecret: randomBytes(32).toString("hex"),
    callback: "https://example.invalid/auth/callback",
    webhookSecret: randomBytes(32).toString("hex"),
    fetcher,
  });
  await client.exchange(randomBytes(16).toString("hex"));
  await client.globalEmotes();
  await client.revoke(value);
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.options.redirect, "error");
    assert.ok(call.options.signal instanceof AbortSignal);
    assert.equal(call.options.signal.aborted, false);
  }
});

test("webhook and OAuth callbacks use their explicit public path", async () => {
  const calls = [],
    value = randomBytes(32).toString("hex");
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () =>
        url.includes("/oauth2/token")
          ? { access_token: value, expires_in: 3600 }
          : { data: [] },
    };
  };
  const callback = "https://trizze.tv/robot/api/auth/callback",
    webhookCallback = "https://trizze.tv/robot/api/eventsub";
  const client = twitchClient({
    clientId: randomBytes(16).toString("hex"),
    clientSecret: randomBytes(32).toString("hex"),
    callback,
    webhookCallback,
    webhookSecret: randomBytes(32).toString("hex"),
    fetcher,
  });
  assert.equal(
    new URL(
      client.authorizationUrl(randomBytes(16).toString("hex"), "viewer"),
    ).searchParams.get("redirect_uri"),
    callback,
  );
  await client.subscribe("123");
  const subscriptions = calls.filter((c) =>
    c.url.endsWith("/eventsub/subscriptions"),
  );
  assert.equal(subscriptions.length, 4);
  for (const item of subscriptions)
    assert.equal(
      JSON.parse(item.options.body).transport.callback,
      webhookCallback,
    );
});
