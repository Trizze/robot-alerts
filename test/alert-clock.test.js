import test from 'node:test';
import assert from 'node:assert/strict';
import { localAlertStart } from '../public/shared/alert-clock.js';
test('fresh alert entrance is independent of Windows/server clock skew',()=>{
  for(const offset of [-60000,0,60000]) assert.equal(localAlertStart({startedAt:10000},{fresh:true,now:10000+offset}),10000+offset);
});
test('reconnect resumes from server-measured age and ignores clock mismatch',()=>{
  assert.equal(localAlertStart({startedAt:10000},{serverNow:10750,now:90000}),89250);
  assert.equal(localAlertStart({startedAt:10000},{serverNow:9500,now:90000}),90000);
});
