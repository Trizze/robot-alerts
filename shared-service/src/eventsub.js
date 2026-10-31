import { createHmac, timingSafeEqual } from "node:crypto";
import { normalize } from "../../src/twitch/normalize.js";

const MAX_AGE_MS = 10 * 60 * 1000;
const TYPES = new Set([
  "channel.subscribe",
  "channel.subscription.message",
  "channel.subscription.gift",
  "channel.cheer",
]);

// Verify the exact raw request body before parsing or acting on it.
export function verifyWebhook(headers, rawBody, secret, now = Date.now()) {
  const id = headers["twitch-eventsub-message-id"];
  const timestamp = headers["twitch-eventsub-message-timestamp"];
  const signature = headers["twitch-eventsub-message-signature"];
  if (
    typeof secret !== "string" ||
    secret.length < 10 ||
    secret.length > 100 ||
    !Buffer.isBuffer(rawBody)
  )
    return false;
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 256 ||
    typeof timestamp !== "string" ||
    typeof signature !== "string" ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || Math.abs(now - time) > MAX_AGE_MS) return false;
  const actual = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", secret)
    .update(id)
    .update(timestamp)
    .update(rawBody)
    .digest();
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseWebhook(headers, rawBody, secret, now = Date.now()) {
  if (!verifyWebhook(headers, rawBody, secret, now)) return { status: 403 };
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { status: 400 };
  }
  const type = headers["twitch-eventsub-message-type"];
  const subscription = payload?.subscription;
  if (
    !subscription ||
    !TYPES.has(subscription.type) ||
    subscription.version !== "1" ||
    !/^\d+$/.test(subscription.condition?.broadcaster_user_id || "")
  )
    return { status: 400 };
  // Twitch does not include these headers on callback verification requests.
  if (
    type !== "webhook_callback_verification" &&
    (headers["twitch-eventsub-subscription-type"] !== subscription.type ||
      headers["twitch-eventsub-subscription-version"] !== subscription.version)
  )
    return { status: 400 };
  if (type === "webhook_callback_verification") {
    if (
      typeof payload.challenge !== "string" ||
      !payload.challenge ||
      payload.challenge.length > 1024
    )
      return { status: 400 };
    return {
      status: 200,
      challenge: payload.challenge,
      channel: subscription.condition.broadcaster_user_id,
      subscriptionId: subscription.id,
      subscriptionType: subscription.type,
    };
  }
  if (type === "revocation")
    return {
      status: 204,
      revoked: true,
      channel: subscription.condition.broadcaster_user_id,
      subscriptionId: subscription.id,
      subscriptionType: subscription.type,
    };
  if (type !== "notification") return { status: 400 };
  const channel = subscription.condition.broadcaster_user_id;
  const event = normalize(
    {
      metadata: {
        message_id: headers["twitch-eventsub-message-id"],
        message_timestamp: headers["twitch-eventsub-message-timestamp"],
      },
      payload: { subscription, event: payload.event },
    },
    channel,
    null,
  );
  if (!event) return { status: 400 };
  // Twitch's gift summary credits the gifter. Per-recipient subscribe events
  // are observations and do not credit the recipient or the same gift twice.
  return { status: 204, event };
}
