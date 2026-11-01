// All credentials stay in request bodies or Authorization headers, never URLs.
export function twitchClient({
  clientId,
  clientSecret,
  callback,
  webhookCallback,
  webhookSecret,
  fetcher = fetch,
}) {
  let appToken;
  async function json(url, options = {}) {
    const response = await fetcher(url, {
      ...options,
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) {
      const error = new Error("Twitch request failed");
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async function token(fields) {
    return json("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...fields,
      }),
    });
  }
  async function app() {
    if (!appToken || appToken.expires <= Date.now()) {
      const result = await token({ grant_type: "client_credentials" });
      appToken = {
        value: result.access_token,
        expires: Date.now() + Math.max(0, result.expires_in - 300) * 1000,
      };
    }
    return appToken.value;
  }
  async function helix(path, value, options = {}) {
    return json(`https://api.twitch.tv/helix/${path}`, {
      ...options,
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${value}`,
        ...options.headers,
      },
    });
  }
  return {
    authorizationUrl(state, role) {
      const url = new URL("https://id.twitch.tv/oauth2/authorize");
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callback,
        response_type: "code",
        state,
        ...(role === "streamer"
          ? {
              scope:
                "channel:read:subscriptions bits:read moderator:read:followers",
            }
          : role === "bot"
            ? { scope: "user:write:chat", force_verify: "true" }
            : {}),
      }).toString();
      return url.href;
    },
    exchange(code) {
      return token({
        grant_type: "authorization_code",
        code,
        redirect_uri: callback,
      });
    },
    refresh(refreshToken) {
      return token({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    },
    async user(value) {
      return (await helix("users", value)).data[0];
    },
    async globalEmotes() {
      return (await helix("chat/emotes/global", await app())).data;
    },
    async directory(ids) {
      const value = await app(),
        items = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        const userQuery = new URLSearchParams(batch.map((id) => ["id", id]));
        const channelQuery = new URLSearchParams(
          batch.map((id) => ["broadcaster_id", id]),
        );
        const streamQuery = new URLSearchParams(
          batch.map((id) => ["user_id", id]),
        );
        const [users, channels, streams] = await Promise.all([
          helix(`users?${userQuery}`, value),
          helix(`channels?${channelQuery}`, value),
          helix(`streams?${streamQuery}`, value),
        ]);
        for (const id of batch) {
          const user = users.data.find((x) => x.id === id),
            channel = channels.data.find((x) => x.broadcaster_id === id),
            live = streams.data.find((x) => x.user_id === id);
          items.push({
            id,
            login: user?.login,
            avatar: user?.profile_image_url,
            live: Boolean(live),
            category: live?.game_name || channel?.game_name || "",
          });
        }
      }
      return items;
    },
    async lookup(id) {
      const query = new URLSearchParams({ id });
      return (await helix(`users?${query}`, await app())).data[0];
    },
    async subscribe(channel, { follow = false, events = [] } = {}) {
      const value = await app();
      const types = [
        ...[
          "channel.subscribe",
          "channel.subscription.message",
          "channel.subscription.gift",
          "channel.cheer",
        ].map((type) => ({
          type,
          version: "1",
          condition: { broadcaster_user_id: channel },
        })),
      ];
      if (events.includes("raid"))
        types.push({
          type: "channel.raid",
          version: "1",
          condition: { to_broadcaster_user_id: channel },
        });
      if (follow && events.includes("follow"))
        types.push({
          type: "channel.follow",
          version: "2",
          condition: {
            broadcaster_user_id: channel,
            moderator_user_id: channel,
          },
        });
      for (const entry of types)
        try {
          await helix("eventsub/subscriptions", value, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...entry,
              transport: {
                method: "webhook",
                callback: webhookCallback,
                secret: webhookSecret,
              },
            }),
          });
        } catch (e) {
          if (e.status !== 409) throw e;
        }
    },
    async sendChat(channel, sender, message, value) {
      const result = await helix("chat/messages", value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcaster_id: channel,
          sender_id: sender,
          message,
        }),
      });
      return result.data?.[0]?.is_sent === true;
    },
    async subscription(channel, viewer, value) {
      const query = new URLSearchParams({
        broadcaster_id: channel,
        user_id: viewer,
      });
      const result = await helix(`subscriptions?${query}`, value);
      return result.data.find((item) => item.user_id === viewer) || null;
    },
    async revoke(value) {
      const response = await fetcher("https://id.twitch.tv/oauth2/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, token: value }),
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      return response.ok;
    },
  };
}
