import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { defaults, unlocks, validateLook, baseSettings, validateSettings } from './robots/registry.js';

export class Store {
  constructor(path) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS viewers(id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, avatar TEXT, palette TEXT, look TEXT NOT NULL, explicit TEXT NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS observations(viewer TEXT REFERENCES viewers(id) ON DELETE CASCADE, channel TEXT, months INTEGER DEFAULT 0, bits INTEGER DEFAULT 0, gifts INTEGER DEFAULT 0, streak INTEGER DEFAULT 0, followed_at TEXT, first_message TEXT, first_message_at TEXT, PRIMARY KEY(viewer,channel));
      CREATE TABLE IF NOT EXISTS owned(viewer TEXT REFERENCES viewers(id) ON DELETE CASCADE, part TEXT, earned_at TEXT, channel TEXT, evidence TEXT, PRIMARY KEY(viewer,part));
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(channel TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY, channel TEXT, message TEXT, status TEXT DEFAULT 'pending');
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO migrations VALUES(1);`);
    if (!this.db.prepare('PRAGMA table_info(announcements)').all().some(column => column.name === 'viewer')) this.db.exec('ALTER TABLE announcements ADD COLUMN viewer TEXT');
  }
  settings(channel = 'demo') { const row = this.db.prepare('SELECT value FROM settings WHERE channel=?').get(channel); return row ? validateSettings(JSON.parse(row.value)) : structuredClone(baseSettings); }
  saveSettings(channel, value) { const settings = validateSettings(value); this.db.prepare('INSERT OR REPLACE INTO settings VALUES(?,?)').run(channel, JSON.stringify(settings)); return settings; }
  viewer(id) {
    const row = this.db.prepare('SELECT * FROM viewers WHERE id=?').get(id);
    if (!row) return null;
    return { id: row.id, name: row.name, color: row.color, avatar: row.avatar, palette: row.palette ? JSON.parse(row.palette) : null, look: JSON.parse(row.look), owned: this.db.prepare('SELECT part FROM owned WHERE viewer=?').all(id).map(r => r.part), metrics: this.db.prepare('SELECT MAX(months) months, SUM(bits) bits, SUM(gifts) gifts, MAX(streak) streak FROM observations WHERE viewer=?').get(id) };
  }
  list() { return this.db.prepare('SELECT id FROM viewers ORDER BY rowid DESC LIMIT 60').all().map(r => this.viewer(r.id)); }
  cacheClip(id, channel, value) { this.db.prepare('INSERT OR REPLACE INTO clip_cache VALUES(?,?,?,?)').run(id, channel, JSON.stringify(value), new Date().toISOString()); }
  setLook(id, patch, reset = false) {
    const viewer = this.viewer(id); if (!viewer) throw new Error('Say !robot first to build your robot.');
    const explicit = reset ? [] : [...new Set([...JSON.parse(this.db.prepare('SELECT explicit FROM viewers WHERE id=?').get(id).explicit), ...Object.keys(patch)])];
    const look = reset ? { ...defaults } : validateLook({ ...viewer.look, ...patch }, viewer.owned);
    this.db.prepare('UPDATE viewers SET look=?, explicit=? WHERE id=?').run(JSON.stringify(look), JSON.stringify(explicit), id);
    return this.viewer(id);
  }
  updateProfile(id, profile) { this.db.prepare('UPDATE viewers SET avatar=COALESCE(?,avatar), color=COALESCE(?,color), palette=COALESCE(?,palette) WHERE id=?').run(profile.avatar || null, profile.color || null, profile.palette ? JSON.stringify(profile.palette) : null, id); }
  deleteViewer(id) { this.db.prepare('DELETE FROM viewers WHERE id=?').run(id); }
  apply(event) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT 1 FROM receipts WHERE id=?').get(event.id)) { this.db.exec('ROLLBACK'); return { duplicate: true }; }
      this.db.prepare('INSERT INTO receipts VALUES(?,?)').run(event.id, new Date().toISOString());
      this.db.prepare("DELETE FROM receipts WHERE created_at < datetime('now','-30 days')").run();
      if (!event.viewer?.id) { this.db.exec('COMMIT'); return { unlocked: [], viewer: null }; }
      const v = event.viewer;
      this.db.prepare(`INSERT INTO viewers(id,name,color,avatar,look) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=COALESCE(excluded.color,viewers.color),avatar=COALESCE(excluded.avatar,viewers.avatar)`).run(v.id, v.name.slice(0, 80), v.color || null, v.avatar || null, JSON.stringify(defaults));
      this.db.prepare('INSERT OR IGNORE INTO observations(viewer,channel) VALUES(?,?)').run(v.id, event.channel);
      const count = key => Number.isSafeInteger(event[key]) && event[key] > 0 ? Math.min(event[key], 100000000) : 0;
      this.db.prepare(`UPDATE observations SET months=MAX(months,?),bits=bits+?,gifts=gifts+?,streak=MAX(streak,?),followed_at=COALESCE(?,followed_at) WHERE viewer=? AND channel=?`).run(count('months'), event.type === 'cheer' ? count('bits') : 0, event.type === 'gift' ? count('gifts') : 0, count('streak'), event.followedAt || null, v.id, event.channel);
      const metrics = this.viewer(v.id).metrics;
      const follows = this.db.prepare('SELECT followed_at FROM observations WHERE viewer=? AND followed_at IS NOT NULL').all(v.id);
      metrics.followDays = Math.max(0, ...follows.map(r => Math.floor((Date.now() - Date.parse(r.followed_at)) / 86400000)).filter(Number.isFinite));
      const settings = this.settings(event.channel); const unlocked = [];
      const look = this.viewer(v.id).look; const explicit = JSON.parse(this.db.prepare('SELECT explicit FROM viewers WHERE id=?').get(v.id).explicit);
      for (const part of unlocks) if (metrics[part.metric] >= settings.thresholds[part.id]) {
        const inserted = this.db.prepare('INSERT OR IGNORE INTO owned VALUES(?,?,?,?,?)').run(v.id, part.id, event.at, event.channel, JSON.stringify({ metric: part.metric, value: metrics[part.metric], threshold: settings.thresholds[part.id] }));
        if (inserted.changes) { unlocked.push(part); if (!explicit.includes(part.layer)) look[part.layer] = part.id; }
      }
      this.db.prepare('UPDATE viewers SET look=? WHERE id=?').run(JSON.stringify(look), v.id);
      if (unlocked.length) this.db.prepare('INSERT OR IGNORE INTO announcements(id,channel,message,viewer) VALUES(?,?,?,?)').run(event.id, event.channel, `${v.name.slice(0, 50)} earned ${unlocked.map(p => p.name).join(', ')}! Try !robot parts`, v.id);
      this.db.exec('COMMIT');
      return { unlocked, viewer: this.viewer(v.id) };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
