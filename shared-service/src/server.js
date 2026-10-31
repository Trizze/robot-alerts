import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { parseWebhook } from './eventsub.js';
import { publicEmotes } from './emote-catalog.js';

const SESSION = '__Host-robot_session', STATE = '__Host-robot_state';
const cookie = (name, value, maxAge) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(x => x.trim().split('=')).filter(x => x.length === 2));
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function body(req) {
  const chunks = []; let length = 0;
  for await (const chunk of req) { length += chunk.length; if (length > 65536) throw new Error('Request too large'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
export function createService({store, twitch, webhookSecret, frontendUrl, maxOAuthStates = 10000, clock = Date.now}) {
  const frontend = new URL(frontendUrl), states = new Map(), refreshes = new Map();
  let emoteCache = {expires:0,items:[],failureUntil:0}, emotePending = null;
  if (frontend.protocol !== 'https:') throw new Error('Frontend must use HTTPS');
  if (!Number.isSafeInteger(maxOAuthStates) || maxOAuthStates < 1) throw new Error('Invalid OAuth state limit');
  const timer = setInterval(() => { store.cleanup(); const now = clock(); for (const [id, state] of states) if (state.expires <= now) states.delete(id); }, 60 * 60 * 1000); timer.unref();
  store.cleanup();
  async function globalEmotes() {
    const now = clock();
    if (emoteCache.expires > now) return emoteCache.items;
    if (emoteCache.failureUntil > now) {
      if (emoteCache.items.length) return emoteCache.items;
      throw new Error('Emote list temporarily unavailable');
    }
    if (!emotePending) {
      emotePending = (async () => {
        try {
          const items = publicEmotes(await twitch.globalEmotes());
          if (!items.length) throw new Error('Empty emote list');
          emoteCache = {expires:clock()+3600000,items,failureUntil:0};
          return items;
        } catch (error) {
          emoteCache.failureUntil = clock()+60000;
          if (emoteCache.items.length) return emoteCache.items;
          throw error;
        }
      })().finally(() => { emotePending = null; });
    }
    return emotePending;
  }
  async function refreshChannel(channel, oldCredentials) {
    if (!refreshes.has(channel)) {
      const work = (async () => {
        const current = store.channelCredentials(channel);
        if (!current) throw new Error('Disconnected channel');
        if (current.access_token !== oldCredentials.access_token) return current;
        const next = await twitch.refresh(current.refresh_token);
        // A disconnect while the network request was in flight must stay deleted.
        const latest = store.channelCredentials(channel);
        if (!latest || !store.hasChannel(channel)) throw new Error('Disconnected channel');
        if (latest.access_token !== current.access_token) return latest;
        store.saveChannel(channel,store.channelName(channel),next); return next;
      })();
      refreshes.set(channel,work);
      work.finally(() => refreshes.delete(channel)).catch(() => {});
    }
    return refreshes.get(channel);
  }
  const server = createServer(async (req,res) => {
    res.setHeader('Cache-Control','no-store'); res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('X-Content-Type-Options','nosniff');
    if (req.headers.origin === frontend.origin) { res.setHeader('Access-Control-Allow-Origin',frontend.origin); res.setHeader('Access-Control-Allow-Credentials','true'); res.setHeader('Vary','Origin'); }
    if (req.method === 'OPTIONS') { if (req.headers.origin !== frontend.origin) { res.writeHead(403).end(); return; } res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}).end(); return; }
    const path = new URL(req.url,'https://local.invalid'); const jar = cookies(req); const session = store.session(jar[SESSION]);
    const respond = (status, data) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(data)); };
    try {
      if (req.method === 'GET' && path.pathname === '/auth/start') {
        const role = path.searchParams.get('role'); if (!['viewer','streamer'].includes(role)) return respond(400,{error:'Invalid role'});
        const now = clock();
        for (const [id, entry] of states) if (entry.expires <= now) states.delete(id);
        if (states.size >= maxOAuthStates) return respond(429,{error:'Too many authorization attempts; try again later'});
        const state = randomBytes(32).toString('base64url'); states.set(state,{role,expires:now+600000});
        res.setHeader('Set-Cookie',cookie(STATE,state,600)); res.writeHead(302,{Location:twitch.authorizationUrl(state,role)}).end(); return;
      }
      if (req.method === 'GET' && path.pathname === '/auth/callback') {
        const state = path.searchParams.get('state'), entry = states.get(state); states.delete(state);
        res.setHeader('Set-Cookie',cookie(STATE,'',0));
        if (!entry || entry.expires <= clock() || !same(state,jar[STATE]) || !path.searchParams.get('code')) return respond(400,{error:'Authorization failed'});
        const credential = await twitch.exchange(path.searchParams.get('code')); const user = await twitch.user(credential.access_token);
        if (!user || !/^\d+$/.test(user.id) || !user.display_name) return respond(400,{error:'Invalid Twitch user'});
        store.upsertViewer(user.id,user.display_name);
        if (entry.role === 'streamer') {
          const previous = store.channelCredentials(user.id), previousName = store.channelName(user.id), wasConnected = store.hasChannel(user.id);
          store.saveChannel(user.id,user.display_name,credential);
          try { await twitch.subscribe(user.id); } catch { if (previous) { store.saveChannel(user.id,previousName,previous); if (!wasConnected) store.markChannelDisconnected(user.id); } else store.deleteChannel(user.id); return respond(503,{error:'Could not connect this channel. Please try again.'}); }
        }
        const token = store.createSession(user.id,entry.role); res.setHeader('Set-Cookie',[cookie(STATE,'',0),cookie(SESSION,token,30*86400)]);
        res.writeHead(303,{Location:frontend.href}).end(); return;
      }
      if (req.method === 'POST' && path.pathname === '/eventsub') {
        const parsed = parseWebhook(req.headers,await body(req),webhookSecret);
        if (parsed.status >= 400) { res.writeHead(parsed.status).end(); return; }
        const channel = parsed.event?.channel || parsed.channel;
        if (parsed.revoked) { if (!store.channelExists(channel)) { res.writeHead(403).end(); return; } store.markChannelDisconnected(channel); res.writeHead(204).end(); return; }
        if (!store.hasChannel(channel)) { res.writeHead(403).end(); return; }
        if (parsed.challenge) { res.writeHead(200,{'Content-Type':'text/plain'}).end(parsed.challenge); return; }
        if (parsed.event) {
          if (parsed.event.type === 'resub') {
            // The resub message has no gift flag; consult the current subscription.
            let credentials = store.channelCredentials(channel), subscription;
            try { subscription = await twitch.subscription(channel,parsed.event.viewer.id,credentials.access_token); }
            catch (error) { if (error.status !== 401) throw error; credentials = await refreshChannel(channel,credentials); subscription = await twitch.subscription(channel,parsed.event.viewer.id,credentials.access_token); }
            if (!subscription || subscription.is_gift !== false) parsed.event.type = 'observation';
          }
          store.record(parsed.event);
        }
        res.writeHead(204).end(); return;
      }
      if (path.pathname === '/api/emotes/global' && req.method === 'GET') {
        return respond(200,{emotes:await globalEmotes()});
      }
      if (path.pathname.startsWith('/api/') && req.method !== 'GET' && req.headers.origin !== frontend.origin) return respond(403,{error:'Invalid origin'});
      if (!session) return respond(401,{error:'Sign in required'});
      if (path.pathname === '/api/me' && req.method === 'GET') {
        const viewer = store.viewer(session.id);
        try { const profile = await twitch.lookup(session.id); const avatar = new URL(profile.profile_image_url); if (avatar.protocol === 'https:' && (avatar.hostname === 'static-cdn.jtvnw.net' || avatar.hostname.endsWith('.jtvnw.net'))) viewer.avatarUrl = avatar.href.replace('300x300','600x600'); } catch {}
        return respond(200,{viewer,channel:store.hasChannel(session.id),channelStored:session.role === 'streamer' && store.channelExists(session.id)});
      }
      if (path.pathname === '/api/me/appearance' && req.method === 'POST') { let input; try { input=JSON.parse((await body(req)).toString('utf8')); store.updateAppearance(session.id,input); } catch { return respond(400,{error:'Invalid appearance'}); } res.writeHead(204).end(); return; }
      if (path.pathname === '/api/me/pattern' && req.method === 'POST') { let input; try { input=JSON.parse((await body(req)).toString('utf8')); } catch { return respond(400,{error:'Invalid request'}); } try { store.selectPattern(session.id,input.pattern); } catch { return respond(400,{error:'Pattern not unlocked'}); } res.writeHead(204).end(); return; }
      if (path.pathname === '/api/session' && req.method === 'DELETE') { store.deleteSession(jar[SESSION]); res.setHeader('Set-Cookie',cookie(SESSION,'',0)); res.writeHead(204).end(); return; }
      if (path.pathname === '/api/me' && req.method === 'DELETE') { store.deleteViewer(session.id); store.deleteSession(jar[SESSION]); res.setHeader('Set-Cookie',cookie(SESSION,'',0)); res.writeHead(204).end(); return; }
      if (path.pathname === '/api/channel' && req.method === 'DELETE' && session.role === 'streamer') { const credentials = store.channelCredentials(session.id); store.deleteChannel(session.id); store.deleteSession(jar[SESSION]); res.setHeader('Set-Cookie',cookie(SESSION,'',0)); if (credentials) await twitch.revoke(credentials.access_token).catch(()=>false); res.writeHead(204).end(); return; }
      return respond(404,{error:'Not found'});
    } catch { if (!res.headersSent) respond(503,{error:'Service temporarily unavailable'}); else res.end(); }
  });
  server.on('close',()=>clearInterval(timer)); return server;
}
