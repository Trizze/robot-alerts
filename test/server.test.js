import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
async function unusedPort() { const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
test('isolated demo serves UI, enforces origin/CSRF and delivers alerts over WebSocket', { timeout: 15000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), 'robot-server-test-')), port = await unusedPort(), base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.js', import.meta.url))], { cwd: folder, env: { PATH: process.env.PATH, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let socket;
  try {
    await new Promise((resolve, reject) => { child.stdout.on('data', data => { if (String(data).includes('Robot Alerts · DEMO')) resolve(); }); child.once('exit', () => reject(new Error('Demo server exited before startup.'))); child.once('error', reject); });
    assert.equal((await fetch(`${base}/settings`)).status, 200); assert.equal((await fetch(`${base}/overlay`)).status, 200);
    assert.equal((await fetch(`${base}/shared/robot.js`)).status, 200);
    const gsap = await fetch(`${base}/vendor/gsap.min.js`); assert.equal(gsap.status, 200); assert.match(await gsap.text(), /GSAP 3\.13\.0/);
    const state = await (await fetch(`${base}/api/state`)).json(); assert.equal(state.mode, 'demo'); assert.equal(state.viewers.length, 4); assert.equal(state.apiVersion, 'robot-alerts-cards-18'); assert.ok(Math.abs(state.serverTime-Date.now())<5000);
    assert.equal((await fetch(`${base}/api/demo/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://hostile.invalid' }, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/api/session`, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    const session = await (await fetch(`${base}/api/session`)).json();
    const uploadHeaders = { Origin: base, 'X-Robot-CSRF': session.csrf, 'Content-Type': 'application/octet-stream' };
    assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: uploadHeaders, body: '<svg>bad</svg>' })).status, 400);
    assert.equal((await fetch(`${base}/api/media`, { method: 'POST', headers: { ...uploadHeaders, Origin: 'http://hostile.invalid' }, body: Buffer.from('89504e470d0a1a0a00000000','hex') })).status, 403);
    const image = Buffer.from('89504e470d0a1a0a00000000','hex');
    const uploaded = await (await fetch(`${base}/api/media`, { method: 'POST', headers: uploadHeaders, body: image })).json();
    assert.match(uploaded.url, /^\/media\/[a-f0-9-]+\.png$/);
    assert.deepEqual(Buffer.from(await (await fetch(base + uploaded.url)).arrayBuffer()), image);
    socket = new WebSocket(`${base.replace('http:', 'ws:')}/ws?role=overlay`, { origin: base });
    const initial = await new Promise((resolve, reject) => { socket.once('message', data => resolve(JSON.parse(data))); socket.once('error', reject); }); assert.equal(initial.kind, 'state');
    const nextAlert = new Promise(resolve => socket.on('message', data => { const message = JSON.parse(data); if (message.kind === 'alert') resolve(message.alert); }));
    const response = await fetch(`${base}/api/demo/event`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, 'X-Robot-CSRF': session.csrf }, body: JSON.stringify({ type: 'resub', viewer: 0 }) }); assert.equal(response.status, 200);
    const alert = await nextAlert; assert.equal(alert.type, 'resub'); assert.equal(alert.viewer.name, 'iris.exe'); assert.equal(alert.capsule, undefined); assert.ok(alert.unlocked.some(p => p.id === 'crown'));
    socket.send(JSON.stringify({ kind: 'complete', key: alert.key }));
    const headers = { 'Content-Type': 'application/json', Origin: base, 'X-Robot-CSRF': session.csrf };
    assert.equal((await fetch(`${base}/api/settings`, { method: 'POST', headers, body: JSON.stringify({ ...state.settings, volume: 0, theme: 'gaming' }) })).status, 200);
    assert.equal((await (await fetch(`${base}/api/state`)).json()).settings.theme, 'gaming');
    assert.equal((await fetch(`${base}/api/settings/theme`, { method: 'POST', headers, body: JSON.stringify({ theme: 'default' }) })).status, 200);
    assert.equal((await (await fetch(`${base}/api/state`)).json()).settings.theme, 'default');
    assert.equal((await fetch(`${base}/api/demo/event`, { method: 'POST', headers, body: JSON.stringify({ type: 'follow' }) })).status, 200);
    assert.equal((await fetch(`${base}/api/demo/reset`, { method: 'POST', headers, body: '{}' })).status, 200);
  } finally {
    socket?.terminate(); const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await stopped; await rm(folder, { recursive: true, force: true });
  }
});
