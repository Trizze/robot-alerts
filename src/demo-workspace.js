import { Commands } from './commands.js';
import { seedDemo } from './demo.js';

// No Twitch client or live store is accepted here. Synthetic actions cannot send chat or earn live progress.
export class DemoWorkspace {
  constructor(store, queue, channel, log, changed, settings) {
    Object.assign(this, { store, queue, channel, log, changed, settings });
    this.commands = new Commands(store, event => this.enqueue(event), async (_, message) => log('demo-chat', `[Demo] ${message}`));
  }
  enqueue(event, unlocked = []) {
    const viewer = event.viewer?.id ? this.store.viewer(event.viewer.id) : null;
    const pool=[viewer,...(event.participants||[])].filter(p=>p?.avatar);
    const demoRaidChatters=event.type==='raid'?Array.from({length:12},(_,i)=>({...pool[i%pool.length],id:`demo-crowd-${i}`,name:pool[i%pool.length]?.name||'Demo viewer'})):undefined;
    this.queue.enqueue({ ...event, demoRaidChatters, channel: this.channel, viewer, unlocked, demo: true });
  }
  async ingest(event) {
    if (event.channel !== 'demo' || !event.id.startsWith('demo:') || !event.viewer?.id.startsWith('demo-')) throw new Error('Synthetic events must use demo identities.');
    this.store.saveSettings('demo', this.settings());
    const result = this.store.apply(event); if (result.duplicate) return;
    if (event.type === 'chat') await this.commands.handle(event);
    else { this.enqueue(event, result.unlocked); this.log('demo-event', `[Demo] ${event.viewer.name} · ${event.type}`); }
    await this.store.flushAnnouncements({deliver:row=>this.log('demo-unlock', `[Demo] ${row.message}`)});
    this.changed();
  }
  reset() {
    this.queue.cancelDemo();
    this.store.db.exec('DELETE FROM owned; DELETE FROM observations; DELETE FROM viewers; DELETE FROM receipts; DELETE FROM announcements;');
    this.commands.cooldowns.clear(); seedDemo(this.store); this.changed();
  }
}
