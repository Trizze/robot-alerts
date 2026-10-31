import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deleteAvatarFiles } from '../avatar-files.js';
import { avatarDirectory } from '../paths.js';

export class Profiles {
  constructor(api, store, channel, {avatarDir=avatarDirectory}={}) { this.api = api; this.store = store; this.channel = channel; this.avatarDir = avatarDir; this.cache = new Map(); this.pending = new Map(); this.avatarPending = new Map(); this.deleting = new Set(); this.generations = new Map(); }
  async enrich(event) {
    if (!event.viewer?.id) return;
    const id = event.viewer.id;
    if (this.pending.has(id)) return this.pending.get(id);
    if (Date.now() - (this.cache.get(id) || 0) < 3600000 && event.type !== 'resub') return;
    if (this.pending.size >= 4) return;
    const task = this.load(event).catch(() => {}).finally(() => this.pending.delete(id)); this.pending.set(id, task); return task;
  }
  async load(event) {
    const id = event.viewer.id; this.cache.set(id, Date.now()); if (this.cache.size > 10000) this.cache.delete(this.cache.keys().next().value);
    const [users, colors, follow] = await Promise.allSettled([
      this.api.request('broadcaster', 'users', { query: { id } }),
      this.api.request('bot', 'chat/color', { query: { user_id: id } }),
      this.api.request('broadcaster', 'channels/followers', { query: { broadcaster_id: this.channel, user_id: id } })
    ]);
    const profile = {};
    if (colors.status === 'fulfilled' && /^#[\da-f]{6}$/i.test(colors.value.data?.[0]?.color || '')) profile.color = colors.value.data[0].color;
    if (users.status === 'fulfilled') {
      const avatar = await this.avatar(id, users.value.data?.[0]?.profile_image_url);
      if (avatar) profile.avatar = avatar;
    }
    this.store.updateProfile(id, profile);
    if (follow.status === 'fulfilled') {
      const date = follow.value.data?.[0]?.followed_at;
      if (date && Number.isFinite(Date.parse(date))) this.store.db.prepare('UPDATE observations SET followed_at=? WHERE viewer=? AND channel=?').run(date, id, this.channel);
    }
  }
  async avatar(id, src) {
    if (this.deleting.has(id)) return null;
    const task = this.downloadAvatar(id,src);
    if (!this.avatarPending.has(id)) this.avatarPending.set(id,new Set());
    this.avatarPending.get(id).add(task);
    try { return await task; } finally { const pending=this.avatarPending.get(id); pending?.delete(task); if (!pending?.size) this.avatarPending.delete(id); }
  }
  async deleteCachedAvatar(id) {
    this.deleting.add(id); this.generations.set(id,(this.generations.get(id) || 0)+1);
    try { await Promise.allSettled([...(this.avatarPending.get(id) || []),...(this.pending.has(id) ? [this.pending.get(id)] : [])]); await deleteAvatarFiles(id,this.avatarDir); this.cache.delete(id); }
    finally { this.deleting.delete(id); }
  }
  async downloadAvatar(id, src) {
    if (!/^\d+$/.test(id)) return null;
    try {
      const url = new URL(src);
      if (url.protocol !== 'https:' || url.hostname !== 'static-cdn.jtvnw.net' || url.username || url.password || url.port) return null;
      url.pathname = url.pathname.replace(/300x300(?=\.[a-z]+$)/i, '600x600');
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(4000) });
      const type = response.headers.get('content-type')?.split(';')[0];
      const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
      if (!response.ok || !extensions[type] || Number(response.headers.get('content-length')) > 1048576) return null;
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1048576) { await reader.cancel(); return null; } chunks.push(Buffer.from(value)); }
      await mkdir(this.avatarDir, { recursive: true }); await writeFile(join(this.avatarDir, `${id}.${extensions[type]}`), Buffer.concat(chunks));
      return `/avatars/${id}.${extensions[type]}`;
    } catch { return null; }
  }
  async crowdProfile(viewer,isValid=()=>true) {
    const cached=this.store.viewer(viewer.id);if(cached?.avatar)return cached;
    this.crowdQueue ||= [];this.crowdActive ||= 0;
    if(this.crowdQueue.length>=128)return viewer;
    return new Promise(resolve=>{this.crowdQueue.push({viewer,resolve,isValid,generation:this.generations.get(viewer.id) || 0});this.runCrowdQueue();});
  }
  runCrowdQueue(){
    while(this.crowdActive<4&&this.crowdQueue.length){
      const {viewer,resolve,isValid,generation}=this.crowdQueue.shift();if(!isValid() || generation!==(this.generations.get(viewer.id) || 0)){resolve(viewer);continue;}this.crowdActive++;
      this.api.request('broadcaster','users',{query:{id:viewer.id}}).then(async result=>{if(generation!==(this.generations.get(viewer.id) || 0)){resolve(viewer);return;}const user=result.data?.[0],avatar=await this.avatar(viewer.id,user?.profile_image_url);resolve({...viewer,avatar});}).catch(()=>resolve(viewer)).finally(()=>{this.crowdActive--;this.runCrowdQueue();});
    }
  }
}
