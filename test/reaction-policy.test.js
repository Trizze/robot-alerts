import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedReaction, allowedViewer } from '../src/reaction-policy.js';
test('temporary reactions allow only verified Trizze and itsTrizze IDs', () => {
  for (const id of ['14824099', '429225647']) assert.equal(allowedReaction({ viewer: { id } }), true);
  for (const id of ['789', '', 'Trizze', 'demo-14824099']) assert.equal(allowedViewer(id), false);
  assert.equal(allowedReaction({ viewer: { id: '789', name: 'Trizze' } }), false);
  assert.equal(allowedReaction({ viewer: null }), false);
});
