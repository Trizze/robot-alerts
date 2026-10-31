import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { parseWebhook } from '../src/eventsub.js';
const secret = randomBytes(32).toString('hex');
function signed(subscriptionType, event, messageType = 'notification', extra = {}) {
  const id = randomUUID(), timestamp = new Date().toISOString();
  const subscription = { id:randomUUID(), type:subscriptionType, version:'1', condition:{ broadcaster_user_id:'123' } };
  const body = Buffer.from(JSON.stringify({ subscription, event, ...extra }));
  const signature = 'sha256=' + createHmac('sha256', secret).update(id).update(timestamp).update(body).digest('hex');
  return { headers:{ 'twitch-eventsub-message-id':id, 'twitch-eventsub-message-timestamp':timestamp, 'twitch-eventsub-message-signature':signature, 'twitch-eventsub-message-type':messageType, 'twitch-eventsub-subscription-type':subscriptionType, 'twitch-eventsub-subscription-version':'1' }, body };
}
test('signature, raw body and freshness are required before processing', () => {
  const x = signed('channel.cheer', { broadcaster_user_id:'123', user_id:'789', user_name:'viewer', bits:500 });
  assert.equal(parseWebhook(x.headers,x.body,secret).event.bits,500);
  assert.equal(parseWebhook(x.headers,Buffer.concat([x.body,Buffer.from(' ')]),secret).status,403);
  assert.equal(parseWebhook(x.headers,x.body,secret,Date.now()+11*60*1000).status,403);
  assert.equal(parseWebhook({...x.headers, 'twitch-eventsub-message-signature':'sha256=00'},x.body,secret).status,403);
});
test('verified challenges echo only their challenge and reject mismatched type', () => {
  const x = signed('channel.subscribe', null, 'webhook_callback_verification', {challenge:'example-challenge'});
  assert.equal(parseWebhook(x.headers,x.body,secret).challenge, 'example-challenge');
  const headers = { ...x.headers }; delete headers['twitch-eventsub-subscription-type']; delete headers['twitch-eventsub-subscription-version'];
  assert.equal(parseWebhook(headers,x.body,secret).challenge, 'example-challenge');
  const n = signed('channel.cheer',{broadcaster_user_id:'123',user_id:'789',user_name:'viewer',bits:1});
  assert.equal(parseWebhook({...n.headers,'twitch-eventsub-subscription-type':'channel.subscribe'},n.body,secret).status,400);
});
test('gift summary belongs to gifter; recipient notifications do not become gifts', () => {
  const gift = signed('channel.subscription.gift',{broadcaster_user_id:'123',user_id:'789',user_name:'gifter',total:5,tier:'2000',is_anonymous:false});
  const r = parseWebhook(gift.headers,gift.body,secret);
  assert.equal(r.event.viewer.id,'789'); assert.equal(r.event.gifts,5); assert.equal(r.event.tier,'2000');
  const recipient = signed('channel.subscribe',{broadcaster_user_id:'123',user_id:'456',user_name:'recipient',tier:'2000',is_gift:true});
  assert.equal(parseWebhook(recipient.headers,recipient.body,secret).event.type,'observation');
  const anon = signed('channel.subscription.gift',{broadcaster_user_id:'123',user_id:null,total:5,tier:'1000',is_anonymous:true});
  assert.equal(parseWebhook(anon.headers,anon.body,secret).event.viewer,null);
});
