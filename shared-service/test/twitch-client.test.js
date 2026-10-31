import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { twitchClient } from '../src/twitch.js';

test('all Twitch requests set a timeout and reject redirects', async () => {
 const calls=[], value=randomBytes(32).toString('hex');
 const fetcher=async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('/oauth2/token')?{access_token:value,expires_in:3600}:{data:[]}};};
 const client=twitchClient({clientId:randomBytes(16).toString('hex'),clientSecret:randomBytes(32).toString('hex'),callback:'https://example.invalid/auth/callback',webhookSecret:randomBytes(32).toString('hex'),fetcher});
 await client.exchange(randomBytes(16).toString('hex'));await client.globalEmotes();await client.revoke(value);
 assert.equal(calls.length,4);for (const call of calls) {assert.equal(call.options.redirect,'error');assert.ok(call.options.signal instanceof AbortSignal);assert.equal(call.options.signal.aborted,false);}
});
