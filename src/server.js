import { ValidationError, classifyRequestError } from "./errors.js";
import { dataRoot, avatarDirectory } from "./paths.js";
import { join } from "node:path";
import { saveMedia, getMedia, cleanupMedia } from "./media.js";
import { deleteAvatarFiles } from "./avatar-files.js";
import { readJsonBody } from "./http-body.js";
import { handleRaidChat } from "./raid-chat.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { Store } from "./db.js";
import { AlertQueue } from "./alerts.js";
import { Commands } from "./commands.js";
import { DemoReplay, seedDemo, makeDemo } from "./demo.js";
import { unlocks, registry } from "./robots/registry.js";
import { TwitchClient } from "./twitch/client.js";
import { EventSub } from "./twitch/eventsub.js";
import { normalize, subscriptions } from "./twitch/normalize.js";
import { Profiles } from "./twitch/profiles.js";
import { DemoWorkspace } from "./demo-workspace.js";
import { chatProfiles, testEvent } from "./preview-events.js";
import { API_VERSION } from "../public/shared/release.js";
import {
  allowedViewer,
  allowedReaction,
  reactionPolicy,
} from "./reaction-policy.js";

const hasTwitch = Boolean(process.env.TWITCH_USER_ACCESS_TOKEN);
const demo = process.env.ROBOT_DEMO === "1" || !hasTwitch;
const channel = demo ? "demo" : process.env.TWITCH_BROADCASTER_IDS;
if (
  !demo &&
  (!/^\d+$/.test(channel || "") ||
    !/^\d+$/.test(process.env.TWITCH_BOT_USER_ID || "") ||
    !process.env.TWITCH_CLIENT_ID ||
    !process.env.TWITCH_CLIENT_SECRET ||
    !process.env.TWITCH_BOT_ACCESS_TOKEN)
)
  throw new Error(
    "Complete npm run setup privately first. This build connects one authorized broadcaster per running instance.",
  );
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be an integer between 1024 and 65535.");
const host = "127.0.0.1";
const store = new Store(join(dataRoot, demo ? "demo.sqlite" : "robots.sqlite"));
const demoStore = demo ? store : new Store(join(dataRoot, "demo.sqlite"));
seedDemo(demoStore);
let twitch,
  profiles,
  validationTimer,
  replyTimer,
  replyBusy = false;
const connections = {
  broadcaster: demo ? "Demo only" : "Not connected",
  bot: demo ? "Demo only" : "Not connected",
};
const transports = [],
  replies = [];
const csrf = randomBytes(32).toString("hex");
const peers = new Map();
const feed = [];
const broadcast = (value) => {
  const text = JSON.stringify(value);
  for (const peer of peers.keys())
    if (peer.readyState === WebSocket.OPEN) peer.send(text);
};
const visibleViewers = () => {
  const viewers = store.list();
  return demo ? viewers : viewers.filter((viewer) => allowedViewer(viewer.id));
};
const log = (type, text) => {
  feed.unshift({
    type,
    text: String(text).slice(0, 450),
    at: new Date().toISOString(),
  });
  feed.splice(40);
  broadcast({ kind: "feed", feed });
};
const queue = new AlertQueue(broadcast, (channel) => store.settings(channel));
async function reply(channel, text, actorId) {
  if (demo) return log("chat", text);
  if (allowedViewer(actorId) && replies.length < 60)
    replies.push({ channel, text, actorId });
}
const commands = new Commands(
  store,
  (event) => {
    if (!queue.raidCrowdOpen(event.channel, false)) enqueue(event);
  },
  reply,
);
function enqueue(event, unlocked = []) {
  const viewer = event.viewer?.id ? store.viewer(event.viewer.id) : null;
  queue.enqueue({
    type: event.type,
    channel: event.channel,
    viewer,
    bits: event.bits,
    gifts: event.gifts,
    months: event.months,
    tier: event.tier,
    raidSize: event.raidSize,
    unlocked,
    demo,
  });
}
async function ingest(event) {
  const crowdChat = handleRaidChat(event, { queue, store, profiles });
  if (!demo && !allowedReaction(event) && event.type !== "raid") return;
  const result = store.apply(event);
  if (result.duplicate) return;
  let viewerBroadcastDone = false;
  if (
    profiles &&
    (event.type !== "chat" ||
      !result.viewer?.avatar ||
      /^!robot(?:\s|$)/i.test(event.message))
  ) {
    let timeout;
    const enrichment = profiles.enrich(event).then(() => {
      if (!event.viewer?.id || !store.viewer(event.viewer.id)) return [];
      const observed = store.apply({
        ...event,
        id: `${event.id}:profile`,
        type: "observation",
        bits: undefined,
        gifts: undefined,
      });
      if (viewerBroadcastDone)
        broadcast({ kind: "viewers", viewers: visibleViewers() });
      broadcast({ kind: "test-viewers", viewers: availableTestViewers() });
      if (queue.current?.viewer?.id === event.viewer.id) {
        queue.current.viewer = store.viewer(event.viewer.id);
        broadcast({
          kind: "profile",
          key: queue.current.key,
          viewer: queue.current.viewer,
        });
      }

      return observed.unlocked || [];
    });
    const unlocked = await Promise.race([
      enrichment,
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve([]), 1500);
      }),
    ]);
    clearTimeout(timeout);
    result.unlocked.push(...unlocked);
    enrichment.catch(() =>
      log(
        "error",
        "Profile refresh unavailable; robot defaults remain available.",
      ),
    );
  }
  if (event.type === "chat") await commands.handle(event);
  else if (event.type !== "observation") {
    enqueue(event, result.unlocked);
    log(
      "event",
      `${event.viewer?.name || "Anonymous"} · ${event.type}${event.bits ? ` · ${event.bits} bits` : ""}${event.gifts ? ` · ${event.gifts} gifts` : ""}`,
    );
  }
  await store.flushAnnouncements({
    allow: (row) => demo || allowedViewer(row.viewer),
    deliver: async (row) => {
      log("unlock", row.message);
      if (!demo) await reply(row.channel, row.message, row.viewer);
    },
  });
  viewerBroadcastDone = true;
  broadcast({ kind: "viewers", viewers: visibleViewers() });
}
const demoWorkspace = new DemoWorkspace(
  demoStore,
  queue,
  channel,
  log,
  () => {
    broadcast({ kind: "demo-viewers", viewers: demoStore.list() });
    if (demo) broadcast({ kind: "viewers", viewers: visibleViewers() });
  },
  () => store.settings(channel),
);
function availableTestViewers() {
  const real = chatProfiles(store.list()).filter((viewer) =>
    allowedViewer(viewer.id),
  );
  return real.length
    ? real
    : demo
      ? demoStore
          .list()
          .filter((viewer) => viewer.avatar && !/^\d+$/.test(viewer.id))
      : [];
}
function makeTest(type, index = 0, sourceViewerId) {
  return testEvent(
    type,
    index,
    chatProfiles(store.list()).filter((viewer) => allowedViewer(viewer.id)),
    { sourceViewerId, allowFixtures: demo },
  );
}
const replay = new DemoReplay(
  (event) =>
    demoWorkspace.ingest(event).catch(() => log("error", "Demo event failed.")),
  () => broadcast({ kind: "replay", running: replay?.running || false }),
  makeTest,
);
function state() {
  return {
    apiVersion: API_VERSION,
    serverTime: Date.now(),
    mode: demo ? "demo" : "live",
    liveReady: true,
    connections,
    channel,
    settings: store.settings(channel),
    viewers: visibleViewers(),
    demoViewers: demoStore.list(),
    testViewers: availableTestViewers(),
    testAccounts: reactionPolicy.ids,
    unlocks,
    registry,
    feed,
    running: replay.running,
    current: queue.current,
    queued: queue.pending.length,
    aiEnabled: false,
  };
}
function allowedHost(value) {
  return value === `127.0.0.1:${port}` || value === `localhost:${port}`;
}
function allowedOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && allowedHost(url.host);
  } catch {
    return false;
  }
}
function send(res, code, body, type = "application/json") {
  res.writeHead(code, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(
    type === "application/json" && !Buffer.isBuffer(body)
      ? JSON.stringify(body)
      : body,
  );
}
const mime = {
  ".json": "application/json",
  ".webm": "video/webm",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const server = http.createServer(async (req, res) => {
  if (!allowedHost(req.headers.host))
    return send(res, 403, { error: "Local access only." });
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
  );
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/vendor/gsap.min.js")
      return send(
        res,
        200,
        await readFile(
          new URL("../node_modules/gsap/dist/gsap.min.js", import.meta.url),
        ),
        mime[".js"],
      );
    if (req.method === "GET" && url.pathname === "/api/state")
      return send(res, 200, state());
    if (req.method === "GET" && url.pathname === "/api/session") {
      if (
        req.headers["sec-fetch-site"] === "cross-site" ||
        (req.headers.origin && !allowedOrigin(req.headers.origin))
      )
        return send(res, 403, { error: "Same-origin access required." });
      return send(res, 200, { csrf });
    }
    if (req.method === "GET" && url.pathname.startsWith("/media/")) {
      const file = await getMedia(url.pathname.slice(7));
      return file
        ? send(res, 200, file.bytes, file.type)
        : send(res, 404, { error: "Media unavailable." });
    }
    if (req.method === "POST" && url.pathname === "/api/media") {
      if (
        !allowedOrigin(req.headers.origin) ||
        req.headers["x-robot-csrf"] !== csrf ||
        req.headers["content-type"] !== "application/octet-stream"
      )
        return send(res, 403, {
          error: "Open the local settings page to upload.",
        });
      return send(res, 200, { url: await saveMedia(req) });
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      if (
        !allowedOrigin(req.headers.origin) ||
        req.headers["x-robot-csrf"] !== csrf ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return send(res, 403, {
          error: "Open the local settings page to make changes.",
        });
      const input = await readJsonBody(req);
      if (
        url.pathname === "/api/settings" ||
        url.pathname === "/api/settings/theme"
      ) {
        const themeOnly = url.pathname.endsWith("/theme");
        if (themeOnly && !["default", "gaming"].includes(input.theme))
          throw new ValidationError("Unknown theme.");
        const settings = store.saveSettings(
          channel,
          themeOnly
            ? { ...store.settings(channel), theme: input.theme }
            : input,
        );
        await cleanupMedia([
          ...store.mediaReferences(),
          ...(demoStore === store ? [] : demoStore.mediaReferences()),
        ]);
        queue.updateTheme(settings.theme);
        broadcast({ kind: "settings", settings });
        return send(res, 200, settings);
      }
      if (url.pathname === "/api/preview/viewer") {
        const viewer =
          typeof input.id === "string" ? store.viewer(input.id) : null;
        if (!viewer) throw new ValidationError("Viewer not found.");
        if (!demo && !allowedViewer(viewer.id))
          return send(res, 403, {
            error: "This viewer is not in the configured live allowlist.",
          });
        queue.enqueue({
          type: "preview",
          channel,
          viewer,
          demo: true,
          unlocked: [],
        });
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/alerts/clear") {
        queue.stop();
        broadcast({ kind: "idle", queued: 0 });
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/demo/play") {
        if (!demo && !availableTestViewers().length)
          return send(res, 409, {
            error:
              "Send !robot in chat to cache a Twitch profile picture, then retry.",
          });
        replay.play();
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/demo/stop") {
        replay.stop();
        queue.cancelDemo();
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/demo/event") {
        if (
          ![
            "sub",
            "resub",
            "gift",
            "cheer",
            "raid",
            "follow",
            "preview",
          ].includes(input.type)
        )
          return send(res, 400, { error: "Unknown test alert type." });
        if (
          input.animation &&
          !["robot", "meteor", "parachute", "run-button", "custom"].includes(
            input.animation,
          )
        )
          return send(res, 400, { error: "Unknown test animation." });
        if (!demo && !availableTestViewers().length)
          return send(res, 409, {
            error:
              "Send !robot in chat to cache a Twitch profile picture, then retry.",
          });
        await demoWorkspace.ingest({
          ...makeTest(
            input.type,
            Math.max(0, Math.min(3, Number(input.viewer) || 0)),
            input.sourceViewerId,
          ),
          animationOverride:
            input.animation === "parachute" ? "meteor" : input.animation,
        });
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/demo/command") {
        const event = makeDemo(
          "chat",
          Math.max(0, Math.min(3, Number(input.viewer) || 0)),
        );
        event.message = String(input.message || "").slice(0, 300);
        await demoWorkspace.ingest(event);
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/demo/reset") {
        replay.stop();
        demoWorkspace.reset();
        return send(res, 200, { ok: true });
      }
      if (url.pathname === "/api/viewer/delete") {
        if (typeof input.id !== "string")
          throw new ValidationError("A viewer ID is required.");
        store.deleteViewer(input.id);
        if (profiles) await profiles.deleteCachedAvatar(input.id);
        else await deleteAvatarFiles(input.id);
        broadcast({ kind: "viewers", viewers: visibleViewers() });
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: "Unknown API route." });
    }
    if (req.method !== "GET")
      return send(res, 405, { error: "Method not allowed." });
    if (/^\/avatars\/\d+\.(png|jpg|webp)$/.test(url.pathname)) {
      try {
        return send(
          res,
          200,
          await readFile(
            join(avatarDirectory, url.pathname.slice("/avatars/".length)),
          ),
          mime["." + url.pathname.split(".").pop()],
        );
      } catch {
        return send(res, 404, { error: "Avatar unavailable." });
      }
    }
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      throw new ValidationError("Invalid URL encoding.");
    }
    const path =
      url.pathname === "/" || url.pathname === "/settings"
        ? "settings/index.html"
        : url.pathname === "/overlay"
          ? "overlay/index.html"
          : decoded.replace(/^\//, "");
    if (
      !/^[a-zA-Z0-9/_\-.]+$/.test(path) ||
      path.split("/").some((p) => p === ".." || p.startsWith("."))
    )
      return send(res, 404, { error: "Not found." });
    const ext = "." + path.split(".").pop();
    if (!mime[ext]) return send(res, 404, { error: "Not found." });
    try {
      return send(res, 200, await readFile(publicRoot + path), mime[ext]);
    } catch {
      return send(res, 404, { error: "Not found." });
    }
  } catch (error) {
    const failure = classifyRequestError(error, (message) =>
      console.error(message),
    );
    return send(res, failure.status, { error: failure.message });
  }
});
const ws = new WebSocketServer({ noServer: true, maxPayload: 1024 });
server.on("upgrade", (req, socket, head) => {
  if (
    !allowedHost(req.headers.host) ||
    !allowedOrigin(req.headers.origin) ||
    !["/ws?role=overlay", "/ws?role=settings"].includes(req.url)
  )
    return socket.destroy();
  ws.handleUpgrade(req, socket, head, (client) => {
    const role = req.url.endsWith("overlay") ? "overlay" : "settings";
    peers.set(client, role);
    client.send(JSON.stringify({ kind: "state", state: state() }));
    client.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        if (role === "overlay" && message.kind === "complete")
          queue.complete(message.key);
      } catch {}
    });
    client.on("error", () => client.close());
    client.on("close", () => peers.delete(client));
  });
});
server.listen(port, host, () => {
  console.log(
    `Robot Alerts · ${demo ? "DEMO" : "LIVE"} · http://${host}:${port}/settings`,
  );
  console.log(
    `OBS browser source · http://${host}:${port}/overlay · 1920 × 1080`,
  );
  console.log(
    demo
      ? "Synthetic events only. No Twitch or OpenAI requests."
      : "Connecting to Twitch. Credentials: ***",
  );
  if (!demo && !reactionPolicy.all && !reactionPolicy.ids.length)
    console.log(
      "Live reactions are disabled until ALLOWED_VIEWER_IDS is configured.",
    );
  if (process.env.ROBOT_DEMO === "1") setTimeout(() => replay.play(), 2000);
  if (!demo)
    connectTwitch().catch(() => {
      log(
        "error",
        "Twitch authorization failed. Check setup privately; no credential values were logged.",
      );
      for (const transport of transports) transport.stop();
    });
});
async function connectTwitch() {
  twitch = new TwitchClient({
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
    broadcaster: {
      userId: channel,
      accessToken: process.env.TWITCH_USER_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_REFRESH_TOKEN,
    },
    bot: {
      userId: process.env.TWITCH_BOT_USER_ID,
      accessToken: process.env.TWITCH_BOT_ACCESS_TOKEN,
      refreshToken: process.env.TWITCH_BOT_REFRESH_TOKEN,
    },
  });
  await Promise.all(
    ["broadcaster", "bot"].map((role) => twitch.validate(role)),
  );
  profiles = new Profiles(twitch, store, channel);
  if (!availableTestViewers().length)
    for (const identity of Object.values(twitch.identities))
      await ingest({
        id: `profile:${identity.id}:${Date.now()}`,
        type: "observation",
        channel,
        at: new Date().toISOString(),
        viewer: { id: identity.id, name: identity.login },
      });
  for (const role of ["broadcaster", "bot"]) {
    const transport = new EventSub({
      api: twitch,
      role,
      subscriptions: subscriptions(
        channel,
        process.env.TWITCH_BOT_USER_ID,
        role,
      ),
      onEvent: async (message) => {
        const event = normalize(
          message,
          channel,
          process.env.TWITCH_BOT_USER_ID,
        );
        if (event) await ingest(event);
      },
      onStatus: (identity, status) => {
        connections[identity] = status;
        broadcast({ kind: "connection", connections });
        if (status.includes("revoked")) {
          for (const t of transports) t.stop();
          replies.length = 0;
        }
      },
    });
    transports.push(transport);
    transport.start();
  }
  validationTimer = setInterval(async () => {
    try {
      await Promise.all(
        ["broadcaster", "bot"].map((role) => twitch.validate(role)),
      );
    } catch {
      for (const transport of transports) transport.stop();
      replies.length = 0;
      log(
        "error",
        "Twitch validation failed. Reauthorize privately with setup.",
      );
    }
  }, 3600000);
  replyTimer = setInterval(async () => {
    if (replyBusy || !replies.length || connections.bot !== "Connected") return;
    replyBusy = true;
    const next = replies.shift();
    if (!allowedViewer(next.actorId)) {
      replyBusy = false;
      return;
    }
    try {
      const result = await twitch.reply(next.channel, next.text);
      log(
        "chat",
        result.suppressed
          ? "Bot replies paused during Shared Chat to prevent cross-posting."
          : next.text,
      );
    } catch {
      log(
        "error",
        "Bot reply could not be delivered. It will not be retried automatically.",
      );
    } finally {
      replyBusy = false;
    }
  }, 1600);
}
function shutdown() {
  clearInterval(validationTimer);
  clearInterval(replyTimer);
  for (const transport of transports) transport.stop();
  replay.stop();
  queue.stop();
  for (const peer of peers.keys()) peer.close();
  ws.close();
  server.close(() => {
    if (demoStore !== store) demoStore.close();
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
