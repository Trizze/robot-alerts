import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMeteorTimeline } from '../public/overlay/meteor-timeline.js';
import { validateSettings } from '../src/robots/registry.js';
const { gsap } = createRequire(import.meta.url)('gsap');
const close = (a,b) => assert.ok(Math.abs(a-b)<.001, `${a} != ${b}`);
test('crash lands sideways, holds, then card rise carries the body into launch', () => {
  const { timeline, state:s, timing:t } = createMeteorTimeline(gsap);
  try {
    timeline.time(0);close(s.y,-110);
    timeline.time(.5);assert.ok(s.y>80&&s.y<150,'Robot is already visibly falling at 500ms');
    timeline.time(.8);assert.ok(s.y>400&&s.y<500,'Robot crosses the middle of the screen before impact');
    timeline.time(t.lying); close(s.angle,90);close(s.y,810);close(s.growth,0);
    timeline.time(t.grow+.275);assert.ok(s.growth>0&&s.growth<1);close(s.y,810-230*s.growth);
    timeline.time(t.launch);close(s.growth,1);close(s.y,580);close(s.angle,90);
    timeline.time(t.apex);close(s.y,270);assert.ok(s.angle>180&&s.angle<360);
    timeline.time(t.land);close(s.y,630);close(s.angle,360);
  } finally {timeline.kill();}
});
test('landing precedes dance, exit completes, and rewind restores the crash state', () => {
  const { timeline, state:s, timing:t } = createMeteorTimeline(gsap);
  try {
    timeline.time(t.land);close(s.dance,0);
    timeline.time(t.dance+1);assert.ok(s.dance>0);close(s.fade,1);
    timeline.time(t.end);close(s.fade,0);
    timeline.time(t.lying);close(s.angle,90);close(s.growth,0);close(s.dance,0);close(s.fade,1);
    for(const legacy of ['arrival','parachute']) assert.equal(validateSettings({animations:{resub:legacy}}).animations.resub,'robot');
  } finally {timeline.kill();}
});
