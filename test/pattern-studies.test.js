import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, PATTERN_PARTS, swatchSvg } from '../assets/robot/patterns/catalog.js';

test('pattern studies have unique stable IDs and support all four robot parts', () => {
  assert.equal(PATTERNS.length, 30);
  assert.equal(new Set(PATTERNS.map(p => p.id)).size, 30);
  assert.deepEqual(PATTERN_PARTS, ['head', 'torso', 'arms', 'legs']);
  assert.ok(PATTERNS.some(p => p.motion));
  for (const pattern of PATTERNS) {
    assert.match(pattern.id, /^[a-z0-9-]+$/);
    assert.match(swatchSvg(pattern), /^<svg\s/);
    assert.match(pattern.background, /^#[0-9a-f]{6}$/i);
  }
});
