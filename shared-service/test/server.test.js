import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHmac, randomUUID } from 'node:crypto';
import { SharedStore } from '../src/store.js';
import { createService } from '../src/server.js';

test('signed webhook awards a gift once, and account operations enforce origin and identity', async t => {
  const store = new SharedStore(':memory:',{encryptionKey:randomBytes(32),patternSeed:randomBytes(32),catalog:[{id:'test_pattern',tier:1}]});
  const creds = {access_token:randomBytes(32).toString('hex')};
  store.saveChannel('123','Streamer',creds); store.upsertViewer('456','Viewer');
  const session = store.createSession('456','viewer'), secret = randomBytes(32).toString('hex');
  const server = createService({store,twitch:{},webhookSecret:secret,frontendUrl:'https://trizze.tv/robot/'});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const id = randomUUID(), timestamp = new Date().toISOString();
  const payload = JSON.stringify({subscription:{id:randomUUID(),type:'channel.subscription.gift',version:'1',condition:{broadcaster_user_id:'123'}},event:{broadcaster_user_id:'123',user_id:'456',user_name:'Viewer',total:5,tier:'2000',is_anonymous:false}});
  const signature = 'sha256='+createHmac('sha256',secret).update(id).update(timestamp).update(payload).digest('hex');
  const headers = {'twitch-eventsub-message-id':id,'twitch-eventsub-message-timestamp':timestamp,'twitch-eventsub-message-signature':signature,'twitch-eventsub-message-type':'notification','twitch-eventsub-subscription-type':'channel.subscription.gift','twitch-eventsub-subscription-version':'1'};
  for (let i=0;i<2;i++) assert.equal((await fetch(base+'/eventsub',{method:'POST',headers,body:payload})).status,204);
  assert.equal(store.viewer('456').points,10);
  const login = {cookie:`__Host-robot_session=${session}`};
  assert.equal((await fetch(base+'/api/me',{headers:login})).status,200);
  assert.equal((await fetch(base+'/api/channel',{method:'DELETE',headers:{...login,origin:'https://trizze.tv'}})).status,404);
  assert.equal((await fetch(base+'/api/me',{method:'DELETE',headers:{...login,origin:'https://evil.invalid'}})).status,403);
  assert.equal((await fetch(base+'/api/me',{method:'DELETE',headers:{...login,origin:'https://trizze.tv'}})).status,204);
  assert.equal(store.viewer('456'),null); assert.equal(store.hasChannel('123'),true);
});

test('OAuth state is one-use and a failed channel reconnect preserves existing awards', async t => {
  const store = new SharedStore(':memory:',{encryptionKey:randomBytes(32),patternSeed:randomBytes(32),catalog:[{id:'test_pattern',tier:1}]});
  store.saveChannel('123','Streamer',{access_token:randomBytes(32).toString('hex')});
  store.record({id:randomUUID(),channel:'123',at:new Date().toISOString(),type:'cheer',viewer:{id:'456',name:'Viewer'},bits:500});
  const twitch = {authorizationUrl:state=>`https://id.twitch.tv/oauth2/authorize?state=${state}`,exchange:async()=>({access_token:randomBytes(32).toString('hex')}),user:async()=>({id:'123',display_name:'Streamer'}),subscribe:async()=>{throw Error('offline');}};
  const server = createService({store,twitch,webhookSecret:randomBytes(32).toString('hex'),frontendUrl:'https://trizze.tv/robot/'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
  const base = `http://127.0.0.1:${server.address().port}`;
  const start = await fetch(base+'/auth/start?role=streamer',{redirect:'manual'});
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  const stateCookie = start.headers.get('set-cookie').split(';')[0];
  const url = base+'/auth/callback?'+new URLSearchParams({state,code:randomBytes(16).toString('hex')});
  assert.equal((await fetch(url,{headers:{cookie:stateCookie},redirect:'manual'})).status,503);
  assert.equal(store.viewer('456').points,1); assert.equal(store.hasChannel('123'),true);
  assert.equal((await fetch(url,{headers:{cookie:stateCookie},redirect:'manual'})).status,400);
});

test('appearance settings require the viewer session and reject invalid values', async t => {
 const store = new SharedStore(':memory:',{encryptionKey:randomBytes(32),patternSeed:randomBytes(32),catalog:[]});
 store.upsertViewer('456','Viewer');const session=store.createSession('456','viewer');
 const server=createService({store,twitch:{},webhookSecret:randomBytes(32).toString('hex'),frontendUrl:'https://trizze.tv/robot/'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
 const url=`http://127.0.0.1:${server.address().port}/api/me/appearance`,headers={origin:'https://trizze.tv',cookie:`__Host-robot_session=${session}`,'content-type':'application/json'};
 assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({patternScale:1.4,chestType:'emoji',chestValue:'😀'})})).status,204);
 assert.equal(store.viewer('456').chestValue,'😀');
 assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({patternScale:300})})).status,400);
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,origin:'https://evil.invalid'},body:'{}'})).status,403);
});

test('global emote catalog exposes names, ids and animation metadata without a session', async t => {
 const store = new SharedStore(':memory:',{encryptionKey:randomBytes(32),patternSeed:randomBytes(32),catalog:[]}); let calls=0;
 const twitch={globalEmotes:async()=>{calls++;return [{name:'Dance',id:'emotesv2_123',format:['static','animated']},{name:'Kappa',id:'25',format:['static']},{name:'Bad',id:'../bad',format:[]}];}};
 const server=createService({store,twitch,webhookSecret:randomBytes(32).toString('hex'),frontendUrl:'https://trizze.tv/robot/'});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
 const url=`http://127.0.0.1:${server.address().port}/api/emotes/global`;
 for(let i=0;i<2;i++){const r=await fetch(url,{headers:{origin:'https://trizze.tv'}});assert.equal(r.status,200);assert.deepEqual((await r.json()).emotes,[{name:'Dance',id:'emotesv2_123',animated:true},{name:'Kappa',id:'25',animated:false}]);} assert.equal(calls,1);
});

test('OAuth state entries are bounded and expired entries are pruned before insertion', async t => {
 const store=new SharedStore(':memory:',{encryptionKey:randomBytes(32),patternSeed:randomBytes(32),catalog:[]});
 let now=1000000;const twitch={authorizationUrl:()=> 'https://id.twitch.tv/oauth2/authorize'};
 const server=createService({store,twitch,webhookSecret:randomBytes(32).toString('hex'),frontendUrl:'https://trizze.tv/robot/',maxOAuthStates:2,clock:()=>now});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));store.close();});
 const url=`http://127.0.0.1:${server.address().port}/auth/start?role=viewer`;
 for(let i=0;i<2;i++){const r=await fetch(url,{redirect:'manual'});assert.equal(r.status,302);assert.match(r.headers.get('set-cookie'),/SameSite=Lax/);assert.match(r.headers.get('set-cookie'),/Secure/);}
 assert.equal((await fetch(url,{redirect:'manual'})).status,429);now+=600001;
 assert.equal((await fetch(url,{redirect:'manual'})).status,302);
});
