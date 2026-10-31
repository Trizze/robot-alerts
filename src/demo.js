import { randomUUID } from 'node:crypto';

export const demoViewers = [
  { id: 'demo-iris', name: 'iris.exe', color: '#c1f885', avatar: '/assets/avatars/iris.svg' },
  { id: 'demo-nova', name: 'nova.wav', color: '#b5a0ff', avatar: '/assets/avatars/nova.svg' },
  { id: 'demo-peach', name: 'peachbyte', color: '#ffad8e', avatar: '/assets/avatars/peach.svg' },
  { id: 'demo-moss', name: 'moss_mode', color: '#86dbd3', avatar: '/assets/avatars/moss.svg' }
];
export function makeDemo(type = 'sub', viewerIndex = 0) {
  const viewer = demoViewers[viewerIndex % demoViewers.length];
  return { id: `demo:${randomUUID()}`, channel: 'demo', type, at: new Date().toISOString(), viewer, months: type === 'resub' ? 12 : type === 'sub' ? 1 : undefined, tier: type === 'sub' ? '1000' : undefined, bits: type === 'cheer' ? 1200 : undefined, gifts: type === 'gift' ? 5 : undefined, raidSize: type === 'raid' ? 42 : undefined, message: type === 'chat' ? 'First stream here. Already feels like home.' : undefined };
}
export function seedDemo(store) {
  demoViewers.forEach((viewer, index) => {
    store.apply({ ...makeDemo('chat', index), id: `seed:${viewer.id}`, followedAt: new Date(Date.now() - [400, 20, 90, 200][index] * 86400000).toISOString() });
  });
  store.db.prepare("UPDATE announcements SET status='suppressed' WHERE status='pending'").run();
}
export class DemoReplay {
  constructor(ingest, update, factory = makeDemo) { this.ingest = ingest; this.update = update; this.factory = factory; this.timers = []; this.running = false; }
  play() {
    this.stop(); this.running = true; this.update();
    const steps = [['sub', 0], ['cheer', 1], ['gift', 2], ['resub', 0], ['raid', 3], ['follow', 1]];
    steps.forEach(([type, index], i) => this.timers.push(setTimeout(() => { try { Promise.resolve(this.ingest(this.factory(type, index))).catch(() => this.stop()); } catch { this.stop(); } }, i * 11500)));
    this.timers.push(setTimeout(() => { this.running = false; this.update(); }, steps.length * 11500));
  }
  stop() { this.timers.forEach(clearTimeout); this.timers = []; this.running = false; this.update(); }
}
