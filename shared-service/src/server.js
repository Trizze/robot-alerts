import { claimBotSetup, finishBotSetup, failBotSetup } from "./bot-setup.js";
import { unlockDispatcher } from "./unlock-notices.js";
import { channelSettings } from "./channel-settings.js";
import { directoryCache } from "./directory-cache.js";
import { OverlayHub } from "./overlay-hub.js";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { parseWebhook } from "./eventsub.js";
import { publicEmotes } from "./emote-catalog.js";

const SESSION = "__Host-robot_session",
  STATE = "__Host-robot_state";
const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim().split("="))
      .filter((x) => x.length === 2),
  );
const same = (a, b) =>
  typeof a === "string" &&
  typeof b === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function body(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 65536) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createService({
  store,
  twitch,
  webhookSecret,
  frontendUrl,
  maxOAuthStates = 10000,
  anonymousScope = "channel",
  botLogin = "TrizzeBot",
  clock = Date.now,
}) {
  const hub = new OverlayHub();
  const notifyUnlocks = unlockDispatcher(store, twitch, { clock });
  const streamerMetadata = directoryCache(async (ids) => {
    const items = await twitch.directory(ids);
    return items.map((item) => {
      const avatar = (() => {
        try {
          const u = new URL(item.avatar);
          return u.protocol === "https:" &&
            u.hostname === "static-cdn.jtvnw.net"
            ? u.href.replace(/\d+x\d+(?=\.[a-z]+$)/i, "70x70")
            : undefined;
        } catch {
          return undefined;
        }
      })();
      return {
        id: item.id,
        login: /^[a-z0-9_]{1,25}$/i.test(item.login || "")
          ? item.login
          : undefined,
        avatar,
        live: item.live === true,
        category: String(item.category || "").slice(0, 100),
      };
    });
  }, clock);
  const testCooldown = new Map();
  const frontend = new URL(frontendUrl),
    states = new Map(),
    refreshes = new Map();
  let emoteCache = { expires: 0, items: [], failureUntil: 0 },
    emotePending = null;
  if (frontend.protocol !== "https:")
    throw new Error("Frontend must use HTTPS");
  if (!Number.isSafeInteger(maxOAuthStates) || maxOAuthStates < 1)
    throw new Error("Invalid OAuth state limit");
  const timer = setInterval(
    () => {
      store.cleanup();
      for (const [id, expiry] of testCooldown)
        if (expiry <= clock()) testCooldown.delete(id);
      const now = clock();
      for (const [id, state] of states)
        if (state.expires <= now) states.delete(id);
    },
    60 * 60 * 1000,
  );
  timer.unref();
  store.cleanup();
  async function globalEmotes() {
    const now = clock();
    if (emoteCache.expires > now) return emoteCache.items;
    if (emoteCache.failureUntil > now) {
      if (emoteCache.items.length) return emoteCache.items;
      throw new Error("Emote list temporarily unavailable");
    }
    if (!emotePending) {
      emotePending = (async () => {
        try {
          const items = publicEmotes(await twitch.globalEmotes());
          if (!items.length) throw new Error("Empty emote list");
          emoteCache = { expires: clock() + 3600000, items, failureUntil: 0 };
          return items;
        } catch (error) {
          emoteCache.failureUntil = clock() + 60000;
          if (emoteCache.items.length) return emoteCache.items;
          throw error;
        }
      })().finally(() => {
        emotePending = null;
      });
    }
    return emotePending;
  }
  async function refreshChannel(channel, oldCredentials) {
    if (!refreshes.has(channel)) {
      const work = (async () => {
        const current = store.channelCredentials(channel);
        if (!current) throw new Error("Disconnected channel");
        if (current.access_token !== oldCredentials.access_token)
          return current;
        const next = await twitch.refresh(current.refresh_token);
        // A disconnect while the network request was in flight must stay deleted.
        const latest = store.channelCredentials(channel);
        if (!latest || !store.hasChannel(channel))
          throw new Error("Disconnected channel");
        if (latest.access_token !== current.access_token) return latest;
        store.saveChannel(channel, store.channelName(channel), next);
        return next;
      })();
      refreshes.set(channel, work);
      work.finally(() => refreshes.delete(channel)).catch(() => {});
    }
    return refreshes.get(channel);
  }
  async function publishAlert(channel, event, demo = false) {
    if (
      !store.hasChannel(channel) ||
      !["sub", "resub", "gift", "cheer", "follow", "raid"].includes(
        event.type,
      ) ||
      (!demo && !store.overlaySettings(channel).events.includes(event.type))
    )
      return;
    const saved = event.viewer?.id ? store.viewer(event.viewer.id) : null;
    let avatar = "/robot/assets/twitch-default.webp";
    try {
      if (demo || !event.viewer?.id)
        throw new Error("Neutral preview or anonymous event");
      const profile = await twitch.lookup(event.viewer.id);
      const url = new URL(profile.profile_image_url);
      if (url.protocol === "https:" && url.hostname === "static-cdn.jtvnw.net")
        avatar = url.href.replace("300x300", "600x600");
    } catch {}
    if (
      !store.hasChannel(channel) ||
      (!demo && !store.overlaySettings(channel).events.includes(event.type))
    )
      return;
    const viewer =
      !event.viewer && ["gift", "cheer"].includes(event.type)
        ? store.anonymousRobot(channel, anonymousScope)
        : {
            id: event.viewer?.id || "anonymous",
            name: String(event.viewer?.name || "Anonymous supporter").slice(
              0,
              80,
            ),
            avatar,
            selectedPattern: saved?.selectedPattern || null,
            patternScale: saved?.patternScale || 1,
            chestType: saved?.chestType || "none",
            chestValue: saved?.chestValue || "",
          };
    hub.send(channel, {
      kind: "alert",
      alert: {
        key: randomBytes(12).toString("hex"),
        type: event.type,
        viewer,
        months: event.months,
        bits: event.bits,
        gifts: event.gifts,
        tier: event.tier,
        raidSize: event.raidSize,
        demo,
        settings: store.overlaySettings(channel),
      },
    });
  }
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "OPTIONS") {
      if (req.headers.origin !== frontend.origin) {
        res.writeHead(403).end();
        return;
      }
      res.writeHead(204).end();
      return;
    }
    const path = new URL(req.url, "https://local.invalid");
    const jar = cookies(req);
    const session = store.session(jar[SESSION]);
    const respond = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    try {
      const overlay = /^\/overlay\/(\d{1,32})\/events$/.exec(path.pathname);
      if (req.method === "GET" && overlay) {
        if (req.headers.origin && req.headers.origin !== frontend.origin)
          return respond(403, { error: "Invalid origin" });
        if (!store.hasChannel(overlay[1]))
          return respond(404, { error: "Channel not connected" });
        hub.connect(overlay[1], req, res, store.overlaySettings(overlay[1]));
        return;
      }
      if (req.method === "GET" && path.pathname === "/healthz") {
        store.health();
        res.writeHead(204).end();
        return;
      }
      if (req.method === "GET" && path.pathname === "/auth/start") {
        const role = path.searchParams.get("role");
        if (!["viewer", "streamer", "bot"].includes(role))
          return respond(400, { error: "Invalid role" });
        if (role === "bot")
          return respond(410, {
            error: "Use npm run setup:bot in the owner's terminal",
          });
        const now = clock();
        for (const [id, entry] of states)
          if (entry.expires <= now) states.delete(id);
        if (states.size >= maxOAuthStates)
          return respond(429, {
            error: "Too many authorization attempts; try again later",
          });
        const state = randomBytes(32).toString("base64url");
        states.set(state, {
          role,
          returnTo: ["start", "dashboard"].includes(
            path.searchParams.get("returnTo"),
          )
            ? path.searchParams.get("returnTo")
            : "picker",
          expires: now + 600000,
        });
        res.setHeader("Set-Cookie", cookie(STATE, state, 600));
        res
          .writeHead(302, { Location: twitch.authorizationUrl(state, role) })
          .end();
        return;
      }
      if (req.method === "GET" && path.pathname === "/auth/callback") {
        const terminalSetup = claimBotSetup(
          store,
          path.searchParams.get("state"),
          clock(),
        );
        if (terminalSetup) {
          try {
            if (
              !path.searchParams.get("code") ||
              path.searchParams.has("error")
            )
              throw Error("Authorization denied");
            const credentials = await twitch.exchange(
              path.searchParams.get("code"),
            );
            const bot = await twitch.user(credentials.access_token);
            if (
              !bot ||
              !/^\d{1,32}$/.test(bot.id || "") ||
              typeof bot.display_name !== "string" ||
              String(bot.login || "").toLowerCase() !==
                botLogin.toLowerCase() ||
              !Array.isArray(credentials.scope) ||
              !credentials.scope.includes("user:write:chat")
            ) {
              failBotSetup(store, terminalSetup);
              return respond(403, {
                error:
                  "Authorize this link as TrizzeBot with chat permission, then restart terminal setup",
              });
            }
            finishBotSetup(store, terminalSetup, bot, credentials, clock());
            void notifyUnlocks();
            res
              .writeHead(303, {
                Location: new URL("bot-ready/", frontend).href,
              })
              .end();
          } catch {
            failBotSetup(store, terminalSetup);
            return respond(400, {
              error:
                "Bot authorization failed or expired; restart npm run setup:bot",
            });
          }
          return;
        }
        const state = path.searchParams.get("state"),
          entry = states.get(state);
        states.delete(state);
        res.setHeader("Set-Cookie", cookie(STATE, "", 0));
        if (
          !entry ||
          entry.expires <= clock() ||
          !same(state, jar[STATE]) ||
          !path.searchParams.get("code")
        )
          return respond(400, { error: "Authorization failed" });
        const credential = await twitch.exchange(path.searchParams.get("code"));
        const user = await twitch.user(credential.access_token);
        if (!user || !/^\d+$/.test(user.id) || !user.display_name)
          return respond(400, { error: "Invalid Twitch user" });
        store.upsertViewer(user.id, user.display_name);
        if (entry.role === "streamer") {
          const previous = store.channelCredentials(user.id),
            previousName = store.channelName(user.id),
            wasConnected = store.hasChannel(user.id);
          store.saveChannel(user.id, user.display_name, credential);
          try {
            await twitch.subscribe(user.id, {
              follow: credential.scope?.includes("moderator:read:followers"),
              events: store.overlaySettings(user.id).events,
            });
          } catch {
            if (previous) {
              store.saveChannel(user.id, previousName, previous);
              if (!wasConnected) store.markChannelDisconnected(user.id);
            } else store.deleteChannel(user.id);
            return respond(503, {
              error: "Could not connect this channel. Please try again.",
            });
          }
        }
        const token = store.createSession(user.id, entry.role);
        res.setHeader("Set-Cookie", [
          cookie(STATE, "", 0),
          cookie(SESSION, token, 30 * 86400),
        ]);
        res
          .writeHead(303, {
            Location: ["start", "dashboard"].includes(entry.returnTo)
              ? new URL(entry.returnTo + "/", frontend).href
              : frontend.href,
          })
          .end();
        return;
      }
      if (req.method === "POST" && path.pathname === "/eventsub") {
        const parsed = parseWebhook(
          req.headers,
          await body(req),
          webhookSecret,
        );
        if (parsed.status >= 400) {
          res.writeHead(parsed.status).end();
          return;
        }
        const channel = parsed.event?.channel || parsed.channel;
        if (parsed.revoked) {
          if (!store.channelExists(channel)) {
            res.writeHead(403).end();
            return;
          }
          store.markChannelDisconnected(channel);
          hub.disconnect(channel);
          res.writeHead(204).end();
          return;
        }
        if (!store.hasChannel(channel)) {
          res.writeHead(403).end();
          return;
        }
        if (parsed.challenge) {
          res
            .writeHead(200, { "Content-Type": "text/plain" })
            .end(parsed.challenge);
          return;
        }
        if (parsed.event) {
          const visualEvent = { ...parsed.event };
          if (parsed.event.type === "resub") {
            // The resub message has no gift flag; consult the current subscription.
            let credentials = store.channelCredentials(channel),
              subscription;
            try {
              subscription = await twitch.subscription(
                channel,
                parsed.event.viewer.id,
                credentials.access_token,
              );
            } catch (error) {
              if (error.status !== 401) throw error;
              credentials = await refreshChannel(channel, credentials);
              subscription = await twitch.subscription(
                channel,
                parsed.event.viewer.id,
                credentials.access_token,
              );
            }
            if (!subscription || subscription.is_gift !== false)
              parsed.event.type = "observation";
          }
          const receipt = store.record(parsed.event);
          if (!receipt.duplicate) {
            void notifyUnlocks();
          }
          if (!receipt.duplicate)
            void publishAlert(channel, visualEvent).catch(() => {});
        }
        res.writeHead(204).end();
        return;
      }
      if (path.pathname === "/api/streamers/status" && req.method === "GET") {
        const channels = store.participatingChannels();
        const extra = await streamerMetadata(channels.map((c) => c.id));
        return respond(200, {
          streamers: channels.map((c) => ({
            ...c,
            ...extra.find((e) => e.id === c.id),
            games: store.overlaySettings(c.id)?.games || [],
          })),
        });
      }
      if (path.pathname === "/api/streamers" && req.method === "GET")
        return respond(200, { streamers: store.participatingChannels() });
      if (path.pathname === "/api/emotes/global" && req.method === "GET") {
        return respond(200, { emotes: await globalEmotes() });
      }
      if (
        path.pathname.startsWith("/api/") &&
        req.method !== "GET" &&
        req.headers.origin !== frontend.origin
      )
        return respond(403, { error: "Invalid origin" });
      if (!session) return respond(401, { error: "Sign in required" });
      if (
        path.pathname === "/api/channel/settings" ||
        path.pathname === "/api/channel/test" ||
        path.pathname === "/api/channel/bot"
      ) {
        if (session.role !== "streamer" || !store.hasChannel(session.id))
          return respond(403, { error: "Connect your own channel first" });
        if (path.pathname.endsWith("/bot")) {
          if (!["POST", "DELETE"].includes(req.method))
            return respond(405, { error: "Method not allowed" });
          const enabled = req.method === "POST";
          if (store.overlaySettings(session.id).chatAnnouncements !== enabled)
            store.clearUnlockNotices(session.id);
          store.saveOverlaySettings(session.id, {
            ...store.overlaySettings(session.id),
            chatAnnouncements: enabled,
          });
          return respond(200, {
            enabled,
            available: store.botStatus().connected,
            name: botLogin,
          });
        }
        if (path.pathname.endsWith("/settings") && req.method === "GET")
          return respond(200, {
            channelId: session.id,
            displayName: store.channelName(session.id),
            channelBot: {
              enabled: store.overlaySettings(session.id).chatAnnouncements,
              available: store.botStatus().connected,
              name: botLogin,
            },
            followAllowed: Boolean(
              store
                .channelCredentials(session.id)
                ?.scope?.includes("moderator:read:followers"),
            ),
            settings: store.overlaySettings(session.id),
          });
        if (path.pathname.endsWith("/settings") && req.method === "POST") {
          let input;
          try {
            const raw = JSON.parse((await body(req)).toString("utf8"));
            channelSettings(raw);
            input = channelSettings({
              ...store.overlaySettings(session.id),
              ...raw,
              chatAnnouncements: store.overlaySettings(session.id)
                .chatAnnouncements,
            });
          } catch {
            return respond(400, { error: "Invalid channel settings" });
          }
          const previous = store.overlaySettings(session.id);
          const follow = Boolean(
            store
              .channelCredentials(session.id)
              ?.scope?.includes("moderator:read:followers"),
          );
          if (input.events.includes("follow") && !follow)
            return respond(409, {
              error: "Reconnect Twitch to enable follow alerts",
            });
          if (
            ["raid", "follow"].some(
              (type) =>
                input.events.includes(type) && !previous.events.includes(type),
            )
          ) {
            try {
              await twitch.subscribe(session.id, {
                follow,
                events: input.events,
              });
            } catch {
              return respond(502, {
                error:
                  "Twitch connection unavailable; settings were not changed",
              });
            }
          }
          const value = store.saveOverlaySettings(session.id, input);
          hub.send(session.id, { kind: "settings", settings: value });
          return respond(200, { settings: value });
        }
        if (path.pathname.endsWith("/test") && req.method === "POST") {
          if (!hub.channels.get(session.id)?.size)
            return respond(409, { error: "Connect an overlay before testing" });
          const now = clock();
          if ((testCooldown.get(session.id) || 0) > now)
            return respond(429, { error: "Please wait before testing again" });
          for (const [id, expiry] of testCooldown)
            if (expiry <= now) testCooldown.delete(id);
          if (testCooldown.size >= 10000)
            return respond(429, { error: "Please try later" });
          testCooldown.set(session.id, now + 10000);
          await publishAlert(
            session.id,
            {
              type: "cheer",
              bits: 500,
              viewer: { id: session.id, name: store.channelName(session.id) },
            },
            true,
          );
          return respond(200, { sent: true });
        }
        return respond(405, { error: "Method not allowed" });
      }
      if (path.pathname === "/api/me" && req.method === "GET") {
        const viewer = store.viewer(session.id);
        if (path.searchParams.get("profile") !== "0")
          try {
            const profile = await twitch.lookup(session.id);
            const avatar = new URL(profile.profile_image_url);
            if (
              avatar.protocol === "https:" &&
              (avatar.hostname === "static-cdn.jtvnw.net" ||
                avatar.hostname.endsWith(".jtvnw.net"))
            )
              viewer.avatarUrl = avatar.href.replace("300x300", "600x600");
          } catch {}
        return respond(200, {
          viewer,
          channel: store.hasChannel(session.id),
          streamer: session.role === "streamer",
          channelStored:
            session.role === "streamer" && store.channelExists(session.id),
        });
      }
      if (path.pathname === "/api/me/appearance" && req.method === "POST") {
        let input;
        try {
          input = JSON.parse((await body(req)).toString("utf8"));
          store.updateAppearance(session.id, input);
        } catch {
          return respond(400, { error: "Invalid appearance" });
        }
        res.writeHead(204).end();
        return;
      }
      if (path.pathname === "/api/me/pattern" && req.method === "POST") {
        let input;
        try {
          input = JSON.parse((await body(req)).toString("utf8"));
        } catch {
          return respond(400, { error: "Invalid request" });
        }
        try {
          store.selectPattern(session.id, input.pattern);
        } catch {
          return respond(400, { error: "Pattern not unlocked" });
        }
        res.writeHead(204).end();
        return;
      }
      if (path.pathname === "/api/session" && req.method === "DELETE") {
        store.deleteSession(jar[SESSION]);
        res.setHeader("Set-Cookie", cookie(SESSION, "", 0));
        res.writeHead(204).end();
        return;
      }
      if (path.pathname === "/api/me" && req.method === "DELETE") {
        store.deleteViewer(session.id);
        store.deleteSession(jar[SESSION]);
        res.setHeader("Set-Cookie", cookie(SESSION, "", 0));
        res.writeHead(204).end();
        return;
      }
      if (
        path.pathname === "/api/channel" &&
        req.method === "DELETE" &&
        session.role === "streamer"
      ) {
        const credentials = store.channelCredentials(session.id);
        store.deleteChannel(session.id);
        hub.disconnect(session.id);
        testCooldown.delete(session.id);
        store.deleteSession(jar[SESSION]);
        res.setHeader("Set-Cookie", cookie(SESSION, "", 0));
        if (credentials)
          await twitch.revoke(credentials.access_token).catch(() => false);
        res.writeHead(204).end();
        return;
      }
      return respond(404, { error: "Not found" });
    } catch {
      if (!res.headersSent)
        respond(503, { error: "Service temporarily unavailable" });
      else res.end();
    }
  });
  server.on("close", () => {
    clearInterval(timer);
    hub.close();
  });
  return server;
}
