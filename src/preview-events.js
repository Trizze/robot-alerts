import { makeDemo } from './demo.js';
export function chatProfiles(viewers) {
  const profiles = new Map();
  for (const viewer of viewers) {
    const id = /^\d+$/.test(viewer.id) ? viewer.id : /^demo-\d+$/.test(viewer.id) ? viewer.id.slice(5) : null;
    const avatar = /^\/avatars\/(\d+)\.(png|jpg|webp)$/.exec(viewer.avatar || '');
    if (id && avatar?.[1] === id && !profiles.has(id)) profiles.set(id, { ...viewer, id });
  }
  return [...profiles.values()];
}
export function testEvent(type, index, viewers, { sourceViewerId, allowFixtures = false } = {}) {
  const profiles = chatProfiles(viewers);
  if (!profiles.length) { if (allowFixtures) return makeDemo(type, index); throw new Error('No Twitch picture cached yet. Send !robot in chat, then retry.'); }
  const source = sourceViewerId ? profiles.find(viewer => viewer.id === sourceViewerId) : profiles[index % profiles.length];
  if (!source) throw new Error('Choose an available cached chat profile.');
  const copy = viewer => ({ id: `demo-${viewer.id}`, sourceUserId: viewer.id, name: viewer.name, avatar: viewer.avatar, color: viewer.color });
  return { ...makeDemo(type, index), viewer: copy(source), participants: type === 'raid' ? profiles.filter(v => v.id !== source.id).slice(0, 5).map(copy) : [] };
}
