import { permissions } from "../../scripts/setup-lib.js";
export class TwitchError extends Error {
  constructor(status, message = "Twitch request failed.") {
    super(`${message} (HTTP ${status})`);
    this.status = status;
  }
}
export class TwitchClient {
  #credentials;
  constructor({ clientId, clientSecret, broadcaster, bot, fetcher = fetch }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetcher = fetcher;
    this.#credentials = { broadcaster: { ...broadcaster }, bot: { ...bot } };
    this.refreshing = new Map();
    this.identities = {};
  }
  async fetchJson(url, options) {
    let response;
    try {
      response = await this.fetcher(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new TwitchError(0, "Twitch could not be reached.");
    }
    if (!response.ok) throw new TwitchError(response.status);
    try {
      return response.status === 204 ? {} : await response.json();
    } catch {
      throw new TwitchError(0, "Invalid Twitch response.");
    }
  }
  async refresh(role) {
    if (this.refreshing.has(role)) return this.refreshing.get(role);
    const promise = (async () => {
      const credentials = this.#credentials[role];
      if (!credentials?.refreshToken)
        throw new TwitchError(
          401,
          "Run npm run setup privately to reauthorize.",
        );
      const result = await this.fetchJson("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: "refresh_token",
        }),
      });
      if (
        typeof result.access_token !== "string" ||
        typeof result.refresh_token !== "string"
      )
        throw new TwitchError(401, "Twitch refresh failed.");
      credentials.accessToken = result.access_token;
      credentials.refreshToken = result.refresh_token;
      // Runtime refresh stays in memory. No secret file is read or rewritten.
    })();
    this.refreshing.set(role, promise);
    try {
      await promise;
    } finally {
      this.refreshing.delete(role);
    }
  }
  async validate(role, retry = true) {
    const credentials = this.#credentials[role];
    let result;
    try {
      result = await this.fetchJson("https://id.twitch.tv/oauth2/validate", {
        headers: { Authorization: `OAuth ${credentials.accessToken}` },
      });
    } catch (error) {
      if (error.status === 401 && retry) {
        await this.refresh(role);
        return this.validate(role, false);
      }
      throw error;
    }
    if (
      result.client_id !== this.clientId ||
      result.user_id !== credentials.userId ||
      !permissions[role].every((scope) => result.scopes?.includes(scope))
    )
      throw new TwitchError(
        401,
        "Twitch identity or permissions do not match setup.",
      );
    this.identities[role] = { id: result.user_id, login: result.login };
    return this.identities[role];
  }
  async request(
    role,
    path,
    { query, method = "GET", body } = {},
    retry = true,
  ) {
    if (!/^[a-z_/]+$/.test(path)) throw new Error("Invalid Twitch endpoint.");
    const url = new URL(`https://api.twitch.tv/helix/${path}`);
    if (query) url.search = new URLSearchParams(query).toString();
    try {
      return await this.fetchJson(url.href, {
        method,
        headers: {
          "Client-Id": this.clientId,
          Authorization: `Bearer ${this.#credentials[role].accessToken}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      if (error.status === 401 && retry) {
        await this.refresh(role);
        await this.validate(role, false);
        return this.request(role, path, { query, method, body }, false);
      }
      throw error;
    }
  }
  async sharedChatActive(channel) {
    try {
      const result = await this.request("broadcaster", "shared_chat/session", {
        query: { broadcaster_id: channel },
      });
      return Boolean(result.data?.length);
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }
  async reply(channel, message) {
    // User-token sends cannot be source-scoped in Shared Chat. Suppress rather than cross-post.
    if (await this.sharedChatActive(channel)) return { suppressed: true };
    const response = await this.request("bot", "chat/messages", {
      method: "POST",
      body: {
        broadcaster_id: channel,
        sender_id: this.identities.bot.id,
        message: message.slice(0, 450),
      },
    });
    if (!response.data?.[0]?.is_sent)
      throw new TwitchError(0, "Twitch did not deliver the bot message.");
    return { sent: true };
  }
}
