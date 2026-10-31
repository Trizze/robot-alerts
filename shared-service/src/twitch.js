// All credentials stay in request bodies or Authorization headers, never URLs.
export function twitchClient({ clientId, clientSecret, callback, webhookSecret, fetcher = fetch }) {
  let appToken;
  async function json(url, options = {}) {
    const response = await fetcher(url, {...options, signal:AbortSignal.timeout(8000), redirect:'error'});
    if (!response.ok) { const error = new Error('Twitch request failed'); error.status = response.status; throw error; }
    return response.status === 204 ? null : response.json();
  }
  async function token(fields) {
    return json('https://id.twitch.tv/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({client_id:clientId, client_secret:clientSecret, ...fields}) });
  }
  async function app() {
    if (!appToken || appToken.expires <= Date.now()) {
      const result = await token({grant_type:'client_credentials'});
      appToken = { value:result.access_token, expires:Date.now() + Math.max(0, result.expires_in - 300) * 1000 };
    }
    return appToken.value;
  }
  async function helix(path, value, options = {}) {
    return json(`https://api.twitch.tv/helix/${path}`, {...options, headers:{'Client-Id':clientId, Authorization:`Bearer ${value}`, ...options.headers}});
  }
  return {
    authorizationUrl(state, role) {
      const url = new URL('https://id.twitch.tv/oauth2/authorize');
      url.search = new URLSearchParams({client_id:clientId, redirect_uri:callback, response_type:'code', state, ...(role === 'streamer' ? {scope:'channel:read:subscriptions bits:read'} : {})}).toString();
      return url.href;
    },
    exchange(code) { return token({grant_type:'authorization_code',code,redirect_uri:callback}); },
    refresh(refreshToken) { return token({grant_type:'refresh_token',refresh_token:refreshToken}); },
    async user(value) { return (await helix('users', value)).data[0]; },
    async globalEmotes() { return (await helix('chat/emotes/global',await app())).data; },
    async lookup(id) { const query = new URLSearchParams({id}); return (await helix(`users?${query}`,await app())).data[0]; },
    async subscribe(channel) {
      const value = await app();
      for (const type of ['channel.subscribe','channel.subscription.message','channel.subscription.gift','channel.cheer']) {
        try { await helix('eventsub/subscriptions',value,{ method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,version:'1',condition:{broadcaster_user_id:channel},transport:{method:'webhook',callback:callback.replace(/\/auth\/callback$/, '/eventsub'),secret:webhookSecret}}) }); } catch (error) { if (error.status !== 409) throw error; }
      }
    },
    async subscription(channel, viewer, value) {
      const query = new URLSearchParams({broadcaster_id:channel,user_id:viewer});
      const result = await helix(`subscriptions?${query}`,value);
      return result.data.find(item => item.user_id === viewer) || null;
    },
    async revoke(value) {
      const response = await fetcher('https://id.twitch.tv/oauth2/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,token:value}),signal:AbortSignal.timeout(8000),redirect:'error'});
      return response.ok;
    }
  };
}
