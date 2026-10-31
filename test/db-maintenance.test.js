import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/db.js';

test('the store does not expose the removed clip cache operation', () => {
 const store=new Store(':memory:');try {assert.equal(store.cacheClip,undefined);}finally{store.close();}
});
