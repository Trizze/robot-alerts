import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { TwitchClient } from '../src/twitch/client.js';
import { normalize, subscriptions } from '../src/twitch/normalize.js';
import { EventSub, validReconnect } from '../src/twitch/eventsub.js';
import { permissions } from '../scripts/setup-lib.js';

const notification = (type, raw, id = 'delivery-one') => ({ metadata: { message_id: id, message_type: 'notification', message_timestamp: new Date().toISOString() }, payload: { subscription: { type }, event: { broadcaster_user_id: '123', ...raw } } });
test('normalization ignores overlapping notification families, foreign Shared Chat and bot echoes', () => {
  assert.equal(normalize(notification('channel.chat.notification', { notice_type: 'resub' }), '123', '456'), null);
  assert.equal(normalize(notification('channel.chat.message', { source_broadcaster_user_id: '999', chatter_user_id: '789' }), '123', '456'), null);
  assert.equal(normalize(notification('channel.chat.message', { chatter_user_id: '456' }), '123', '456'), null);
  const message = normalize(notification('channel.chat.message', { chatter_user_id: '789', chatter_user_name: '<script>data</script>', message_id: 'same-message', message: { text: '!robot' } }), '123', '456');
  assert.equal(message.viewer.name, '<script>data</script>'); assert.equal(message.id, 'chat:123:same-message');
});
test('gift receivers never count as gift senders, anonymous events remain anonymous, streak uses reported count', () => {
  const gift = normalize(notification('channel.subscription.gift', { user_id: '789', user_name: 'Gifter', total: 5, cumulative_total: 100 }), '123', '456'); assert.equal(gift.gifts, 5);
  const recipient = normalize(notification('channel.subscribe', { user_id: '789', user_name: 'Recipient', is_gift: true }), '123', '456'); assert.equal(recipient.type, 'observation'); assert.equal(recipient.gifts, undefined);
  assert.equal(normalize(notification('channel.cheer', { user_id: '789', is_anonymous: true, bits: 100 }), '123', '456').viewer, null);
  assert.equal(normalize(notification('channel.chat.notification', { chatter_user_id: '789', notice_type: 'watch_streak', watch_streak: { streak_count: 7 } }), '123', '456').streak, 7);
});
test('resub and gift notifications preserve the validated subscription tier', () => {
  const resub = normalize(notification('channel.subscription.message', { user_id:'789', user_name:'Viewer', tier:'2000', cumulative_months:12 }), '123', '456');
  const gift = normalize(notification('channel.subscription.gift', { user_id:'789', user_name:'Viewer', tier:'3000', total:5 }), '123', '456');
  assert.equal(resub.tier, '2000'); assert.equal(gift.tier, '3000');
  assert.equal(normalize(notification('channel.subscription.message', { user_id:'789', tier:'bogus' }), '123', '456').tier, undefined);
});
test('subscription ownership separates broadcaster-only and bot-only permissions', () => {
  assert.ok(subscriptions('123', '456', 'bot').every(s => s.condition.user_id === '456'));
  assert.ok(subscriptions('123', '456', 'broadcaster').some(s => s.type === 'channel.raid' && s.condition.to_broadcaster_user_id === '123'));
  assert.equal(subscriptions('123', '456', 'broadcaster').some(s => s.type === 'channel.chat.message'), false);
});
function clientConfig(fetcher) {
  return { clientId: randomBytes(15).toString('hex'), clientSecret: randomBytes(15).toString('hex'), broadcaster: { userId: '123', accessToken: randomBytes(15).toString('hex'), refreshToken: randomBytes(15).toString('hex') }, bot: { userId: '456', accessToken: randomBytes(15).toString('hex'), refreshToken: randomBytes(15).toString('hex') }, fetcher };
}
test('concurrent expired requests share one refresh and validate refreshed identity', async () => {
  let config, refreshed = false, refreshCalls = 0;
  const newAccess = randomBytes(15).toString('hex'), newRefresh = randomBytes(15).toString('hex');
  const fetcher = async (url, options) => {
    if (url.endsWith('/token')) { refreshCalls++; await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(options.body.get('client_secret'), config.clientSecret); refreshed = true; return { ok: true, json: async () => ({ access_token: newAccess, refresh_token: newRefresh }) }; }
    if (url.endsWith('/validate')) return { ok: true, json: async () => ({ client_id: config.clientId, user_id: '456', login: 'robot_bot', scopes: permissions.bot }) };
    if (!refreshed) return { ok: false, status: 401 };
    assert.equal(options.headers.Authorization, `Bearer ${newAccess}`); assert.equal(new URL(url).searchParams.has('access_token'), false);
    return { ok: true, json: async () => ({ data: [] }) };
  };
  config = clientConfig(fetcher); const api = new TwitchClient(config);
  await Promise.all([api.request('bot', 'users'), api.request('bot', 'users')]); assert.equal(refreshCalls, 1);
});
test('Shared Chat suppresses user-token replies instead of broadcasting to partner channels', async () => {
  let sends = 0; const config = clientConfig(async url => { if (url.includes('/chat/messages')) sends++; return { ok: true, json: async () => ({ data: [{ session_id: 'active' }] }) }; });
  const api = new TwitchClient(config); api.identities.bot = { id: '456' };
  assert.deepEqual(await api.reply('123', 'A local message'), { suppressed: true }); assert.equal(sends, 0);
});
test('EventSub creates subscriptions on fresh welcome and transfers without recreating on reconnect', async () => {
  const sockets = [], requests = [], statuses = [];
  class Socket extends EventEmitter {
    constructor(url) { super(); this.url = url; sockets.push(this); }
    close() { this.emit('close'); }
    terminate() { this.emit('close'); }
  }
  const transport = new EventSub({ role: 'bot', Socket, subscriptions: subscriptions('123', '456', 'bot'), api: { request: async (...args) => requests.push(args) }, onStatus: (...args) => statuses.push(args), onEvent: async () => {} });
  const welcome = id => Buffer.from(JSON.stringify({ metadata: { message_type: 'session_welcome' }, payload: { session: { id, keepalive_timeout_seconds: 10 } } }));
  try {
    transport.start(); sockets[0].emit('message', welcome('first-session')); await new Promise(setImmediate); assert.equal(requests.length, 2);
    sockets[0].emit('message', Buffer.from(JSON.stringify({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?reconnect_session=ephemeral-session' } } }))); assert.equal(sockets.length, 2);
    sockets[1].emit('message', welcome('next-session')); await new Promise(setImmediate); assert.equal(requests.length, 2); assert.equal(transport.socket, sockets[1]); assert.ok(statuses.some(([, value]) => value === 'Connected'));
  } finally { transport.stop(); }
});
test('reconnect rejects non-Twitch hosts, credentials and insecure protocols', () => {
  assert.equal(validReconnect('wss://eventsub.wss.twitch.tv/ws?reconnect_session=ephemeral-session'), true);
  for (const value of ['wss://hostile.invalid/ws', 'ws://eventsub.wss.twitch.tv/ws', 'wss://name:password@eventsub.wss.twitch.tv/ws', 'wss://eventsub.wss.twitch.tv:444/ws']) assert.equal(validReconnect(value), false);
});
