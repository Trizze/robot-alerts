import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/db.js';

test('the store does not expose the removed clip cache operation', () => {
 const store=new Store(':memory:');try {assert.equal(store.cacheClip,undefined);}finally{store.close();}
});

test('viewer list aggregates multiple channels without multiplying metrics or unlocks', () => {
 const store=new Store(':memory:');try {
  const e=(id,channel,bits)=>({id,type:'cheer',channel,at:new Date().toISOString(),viewer:{id:'123',name:'Viewer'},bits});
  store.apply(e('one','a',500));store.apply(e('two','b',700));
  const row=store.viewer('123'),list=store.list();assert.equal(list.length,1);assert.deepEqual(list[0],row);assert.equal(row.metrics.bits,1200);assert.equal(new Set(row.owned).size,row.owned.length);
 }finally{store.close();}
});
