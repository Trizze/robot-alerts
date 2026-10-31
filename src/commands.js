import { layers, unlocks } from './robots/registry.js';

export class Commands {
  constructor(store, preview, reply) { this.store = store; this.preview = preview; this.reply = reply; this.cooldowns = new Map(); }
  async handle(event) {
    if (!event.viewer?.id || !/^!robot(?:\s|$)/i.test(event.message || '')) return;
    const key = `${event.channel}:${event.viewer.id}`;
    if (Date.now() - (this.cooldowns.get(key) || 0) < 4000) return;
    this.cooldowns.set(key, Date.now());
    if (this.cooldowns.size > 10000) this.cooldowns.delete(this.cooldowns.keys().next().value);
    const [, command, ...words] = event.message.trim().slice(0, 300).split(/\s+/);
    let message;
    try {
      if (!command) { this.preview({ ...event, type: 'preview' }); message = 'Your robot is on its way!'; }
      else if (command === 'help') message = '!robot · !robot parts [layer] · !robot <layer> <part-id> · !robot reset';
      else if (command === 'parts') {
        const viewer = this.store.viewer(event.viewer.id); const layer = words[0];
        message = unlocks.filter(p => viewer.owned.includes(p.id) && (!layer || p.layer === layer)).map(p => `${p.layer}: ${p.id}`).join(' · ') || 'Your personal defaults are ready. Earn more parts through subs, bits, streaks, follow age and gifts.';
      } else if (command === 'reset') { this.store.setLook(event.viewer.id, {}, true); message = 'Personal defaults restored. Your earned parts are still yours.'; }
      else if (command === 'style') message = 'AI styling is not enabled. Use !robot parts, then !robot <layer> <part-id>.';
      else if (layers.includes(command) && words.length === 1) { this.store.setLook(event.viewer.id, { [command]: words[0] }); message = `${command} set to ${words[0]}. Try !robot`; }
      else message = 'Try !robot help for commands, or !robot parts to see what you own.';
    } catch (error) { message = error.message; }
    await this.reply(event.channel, `${event.viewer.name.slice(0, 40)}: ${message}`.slice(0, 450), event.viewer.id);
  }
}
