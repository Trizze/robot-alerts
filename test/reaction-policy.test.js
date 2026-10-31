import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionPolicy } from '../src/reaction-policy.js';

test('configured live allowlist accepts only verified numeric Twitch IDs', () => {
 const policy=createReactionPolicy('14824099, 429225647,14824099');
 assert.deepEqual(policy.ids,['14824099','429225647']);
 for (const id of ['14824099','429225647']) assert.equal(policy.allowedViewer(id),true);
 for (const id of ['789','','Trizze','demo-14824099',null]) assert.equal(policy.allowedViewer(id),false);
});
test('empty configuration fails closed and all viewers require explicit opt-in', () => {
 assert.equal(createReactionPolicy('').allowedViewer('14824099'),false);
 assert.equal(createReactionPolicy('*').allowedViewer('789'),true);
 assert.equal(createReactionPolicy('*').allowedViewer('Viewer'),false);
 assert.throws(()=>createReactionPolicy('14824099,Viewer'));
 assert.throws(()=>createReactionPolicy('*,14824099'));
});
