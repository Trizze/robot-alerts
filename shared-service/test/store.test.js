import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { SharedStore } from '../src/store.js';
const key = randomBytes(32), seed = randomBytes(32);
const catalog = [1,2,3,4,5].flatMap(tier => Array.from({length:2},(_,i)=>({id:`pattern_${tier}_${i}`,tier})));
const create = () => new SharedStore(':memory:',{encryptionKey:key,patternSeed:seed,catalog});
const channel = (s,id) => s.saveChannel(id,'Channel',{value:randomBytes(32).toString('hex')});
const event = (more={}) => ({id:randomUUID(),channel:'1',at:new Date().toISOString(),type:'gift',tier:'1000',gifts:5,viewer:{id:'3',name:'Viewer'},...more});

test('gift summary credits the gifter once and ignores recipient and anonymous notifications', () => {
 const s=create(); try { channel(s,'1'); const e=event(); assert.equal(s.record(e).awarded,2500); assert.equal(s.record(e).duplicate,true);
 s.record(event({type:'observation',viewer:{id:'4',name:'Recipient'},gifts:undefined}));
 s.record(event({viewer:null})); assert.equal(s.viewer('3').points,5); assert.equal(s.viewer('4'),null);
 } finally {s.close();}
});
test('shared totals, stable unique draws and channel deletion recompute correctly', () => {
 const s=create(); try { channel(s,'1');channel(s,'2');
 s.record(event({id:randomUUID(),gifts:15}));s.record(event({id:randomUUID(),channel:'2',gifts:10}));
 const before=s.viewer('3');assert.equal(before.points,25);assert.equal(before.tier,1);assert.equal(before.owned.length,1);
 assert.deepEqual(s.viewer('3').owned,before.owned); s.selectPattern('3',before.owned[0].id);
 s.deleteChannel('1');const after=s.viewer('3');assert.equal(after.points,10);assert.equal(after.owned.length,1);assert.equal(after.selectedPattern,before.owned[0].id);
 s.deleteChannel('2');assert.equal(s.viewer('3').points,0);assert.equal(s.viewer('3').selectedPattern,null);
 } finally {s.close();}
});
test('credential ciphertext, hashed sessions and retention cleanup', () => {
 const s=create(); try { const value=randomBytes(32).toString('hex');s.saveChannel('1','Channel',{value});
 const row=s.db.prepare('SELECT credential FROM channels WHERE id=?').get('1');assert.ok(!Buffer.from(row.credential).includes(Buffer.from(value)));assert.equal(s.channelCredentials('1').value,value);
 const session=s.createSession('1','streamer',1000,10000);const stored=s.db.prepare('SELECT hash FROM sessions').get().hash;assert.notEqual(stored,session);assert.equal(s.session(session,2000).id,'1');assert.equal(s.session(session,11000),null);
 s.record(event(),1000);s.cleanup(1000+7*86400000);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n,0);assert.equal(s.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
 } finally {s.close();}
});
test('viewer deletion removes only that viewer and their ledger', () => {
 const s=create();try {channel(s,'1');s.record(event());s.record(event({viewer:{id:'4',name:'Other'}}));s.deleteViewer('3');assert.equal(s.viewer('3'),null);assert.equal(s.viewer('4').points,5);}finally{s.close();}
});
test('appearance preferences are validated and removed with the viewer', () => {
 const s=create(); try {
  s.upsertViewer('3','Viewer'); assert.equal(s.viewer('3').patternScale,1);
  s.updateAppearance('3',{patternScale:1.5,chestType:'emoji',chestValue:'😀'});
  assert.equal(s.viewer('3').patternScale,1.5);assert.equal(s.viewer('3').chestValue,'😀');
  s.updateAppearance('3',{chestType:'emote',chestValue:'25'});assert.equal(s.viewer('3').chestType,'emote');
  for (const bad of [{patternScale:10},{chestType:'emote',chestValue:'../bad'},{chestType:'emoji',chestValue:'hello'},{other:'x'}]) assert.throws(()=>s.updateAppearance('3',bad));
  s.deleteViewer('3');assert.equal(s.viewer('3'),null);
 } finally { s.close(); }
});
