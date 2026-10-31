import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../src/db.js';
import { AlertQueue } from '../src/alerts.js';
import { DemoWorkspace } from '../src/demo-workspace.js';
import { makeDemo, seedDemo } from '../src/demo.js';

test('live-mode tests use saved theme but never change real viewer progress', async () => {
  const live = new Store(':memory:'), demo = new Store(':memory:');
  const queue = new AlertQueue(() => {}, () => live.settings('123')); const messages = [];
  try {
    live.apply({ id: 'real-event', type: 'resub', channel: '123', at: new Date().toISOString(), viewer: { id: '789', name: 'RealViewer' }, months: 3 });
    live.saveSettings('123', { ...live.settings('123'), theme: 'gaming' });
    const before = live.list(); seedDemo(demo);
    const workspace = new DemoWorkspace(demo, queue, '123', (type, message) => messages.push({ type, message }), () => {}, () => live.settings('123'));
    await workspace.ingest(makeDemo('resub'));
    assert.equal(queue.current.demo, true); assert.equal(queue.current.settings.theme, 'gaming'); assert.equal(queue.current.viewer.id, 'demo-iris');
    assert.ok(demo.viewer('demo-iris').owned.includes('crown'));
    const command = makeDemo('chat'); command.message = '!robot hat crown'; await workspace.ingest(command);
    assert.ok(messages.some(row => row.type === 'demo-chat' && row.message.includes('hat set to crown')));
    assert.deepEqual(live.list(), before);
    await assert.rejects(workspace.ingest({ ...makeDemo('gift'), viewer: { id: '789', name: 'RealViewer' } }), /demo identities/);
    assert.deepEqual(live.list(), before);
  } finally { queue.stop(); live.close(); demo.close(); }
});

test('stopping/resetting a demo preserves current and queued live alerts', async () => {
  const live = new Store(':memory:'), demo = new Store(':memory:');
  const queue = new AlertQueue(() => {}, () => live.settings('123')); seedDemo(demo);
  const workspace = new DemoWorkspace(demo, queue, '123', () => {}, () => {}, () => live.settings('123'));
  try {
    queue.enqueue({ type: 'sub', channel: '123', demo: false, viewer: { id: '789' } }); const current = queue.current.key;
    await workspace.ingest(makeDemo('cheer')); queue.enqueue({ type: 'gift', channel: '123', demo: false, viewer: { id: '999' } });
    workspace.reset();
    assert.equal(queue.current.key, current); assert.equal(queue.pending.length, 1); assert.equal(queue.pending[0].viewer.id, '999'); assert.equal(queue.pending[0].demo, false);
    assert.equal(demo.viewer('demo-nova').metrics.bits, 0);
  } finally { queue.stop(); live.close(); demo.close(); }
});

test('live viewers cannot join a synthetic raid by mistake', () => {
  const store = new Store(':memory:'); const queue = new AlertQueue(() => {}, () => store.settings('123'));
  try {
    queue.enqueue({ type: 'raid', channel: '123', demo: true });
    assert.equal(queue.joinRaid('123', { id: '789' }), false); assert.equal(queue.current.participants.length, 0);
  } finally { queue.stop(); store.close(); }
});
