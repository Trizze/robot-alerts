import { ValidationError } from './errors.js';
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
      CREATE INDEX IF NOT EXISTS receipts_created_at ON receipts(created_at);
      CREATE TABLE IF NOT EXISTS settings(channel TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS announcements(id TEXT PRIMARY KEY, channel TEXT, message TEXT, status TEXT DEFAULT 'pending');
      CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO migrations VALUES(1);`);
    if (!this.db.prepare('PRAGMA table_info(announcements)').all().some(column => column.name === 'viewer')) this.db.exec('ALTER TABLE announcements ADD COLUMN viewer TEXT');
    const aggregate = selection => `WITH selected AS (${selection}),
      parts AS (SELECT p.viewer,json_group_array(p.part) AS parts FROM owned p JOIN selected s ON s.id=p.viewer GROUP BY p.viewer),
      metrics AS (SELECT o.viewer,MAX(o.months) AS months,SUM(o.bits) AS bits,SUM(o.gifts) AS gifts,MAX(o.streak) AS streak FROM observations o JOIN selected s ON s.id=o.viewer GROUP BY o.viewer)
      SELECT s.*,COALESCE(p.parts,'[]') AS parts,m.months,m.bits,m.gifts,m.streak FROM selected s
      LEFT JOIN parts p ON p.viewer=s.id LEFT JOIN metrics m ON m.viewer=s.id ORDER BY s.ordinal DESC`;
    const statements = {
      settings:'SELECT value FROM settings WHERE channel=?', saveSettings:'INSERT OR REPLACE INTO settings VALUES(?,?)', allSettings:'SELECT value FROM settings',
      viewer:aggregate('SELECT rowid AS ordinal,* FROM viewers WHERE id=?'), list:aggregate('SELECT rowid AS ordinal,* FROM viewers ORDER BY rowid DESC LIMIT 60'), explicit:'SELECT explicit FROM viewers WHERE id=?',
      setLook:'UPDATE viewers SET look=?, explicit=? WHERE id=?', updateProfile:'UPDATE viewers SET avatar=COALESCE(?,avatar), color=COALESCE(?,color), palette=COALESCE(?,palette) WHERE id=?',
      deleteViewer:'DELETE FROM viewers WHERE id=?', receipt:'SELECT 1 FROM receipts WHERE id=?', addReceipt:'INSERT INTO receipts VALUES(?,?)',
      pruneReceipt:'DELETE FROM receipts WHERE created_at < ?',
      upsertViewer:`INSERT INTO viewers(id,name,color,avatar,look) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=COALESCE(excluded.color,viewers.color),avatar=COALESCE(excluded.avatar,viewers.avatar)`,
      addObservation:'INSERT OR IGNORE INTO observations(viewer,channel) VALUES(?,?)',
      updateObservation:`UPDATE observations SET months=MAX(months,?),bits=bits+?,gifts=gifts+?,streak=MAX(streak,?),followed_at=COALESCE(?,followed_at) WHERE viewer=? AND channel=?`,
      follows:'SELECT followed_at FROM observations WHERE viewer=? AND followed_at IS NOT NULL', addOwned:'INSERT OR IGNORE INTO owned VALUES(?,?,?,?,?)',
      updateLook:'UPDATE viewers SET look=? WHERE id=?', announce:'INSERT OR IGNORE INTO announcements(id,channel,message,viewer) VALUES(?,?,?,?)',
      pendingAnnouncements:"SELECT * FROM announcements WHERE status='pending'", markAnnouncementSent:"UPDATE announcements SET status='sent' WHERE id=? AND status='pending'"
    };
    this.sql=Object.fromEntries(Object.entries(statements).map(([name,sql])=>[name,this.db.prepare(sql)]));
    this.pruneReceipts();
    this.receiptTimer=setInterval(()=>this.pruneReceipts(),3600000);this.receiptTimer.unref();
  }
  settings(channel = 'demo') { const row = this.sql.settings.get(channel); return row ? validateSettings(JSON.parse(row.value)) : structuredClone(baseSettings); }
  saveSettings(channel, value) { const settings = validateSettings(value); this.sql.saveSettings.run(channel, JSON.stringify(settings)); return settings; }
  mediaReferences() {
    const result = new Set();
    function collect(value) {
      if (typeof value === 'string' && /^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp|mp4|webm)$/.test(value)) result.add(value);
      else if (value && typeof value === 'object') for (const child of Object.values(value)) collect(child);
    }
    for (const row of this.sql.allSettings.all()) collect(JSON.parse(row.value));
    return [...result];
  }
  mapViewer(row) {
    if (!row) return null;
    return { id:row.id,name:row.name,color:row.color,avatar:row.avatar,palette:row.palette ? JSON.parse(row.palette) : null,look:JSON.parse(row.look),owned:JSON.parse(row.parts),metrics:{months:row.months,bits:row.bits,gifts:row.gifts,streak:row.streak} };
  }
  viewer(id) { return this.mapViewer(this.sql.viewer.get(id)); }
  list() { return this.sql.list.all().map(row=>this.mapViewer(row)); }
  setLook(id, patch, reset = false) {
    const viewer = this.viewer(id); if (!viewer) throw new ValidationError('Say !robot first to build your robot.');
    const explicit = reset ? [] : [...new Set([...JSON.parse(this.sql.explicit.get(id).explicit), ...Object.keys(patch)])];
    const look = reset ? { ...defaults } : validateLook({ ...viewer.look, ...patch }, viewer.owned);
    this.sql.setLook.run(JSON.stringify(look), JSON.stringify(explicit), id);
    return this.viewer(id);
  }
  updateProfile(id, profile) { this.sql.updateProfile.run(profile.avatar || null, profile.color || null, profile.palette ? JSON.stringify(profile.palette) : null, id); }
  deleteViewer(id) { this.sql.deleteViewer.run(id); }
  apply(event) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.sql.receipt.get(event.id)) { this.db.exec('ROLLBACK'); return { duplicate: true }; }
      this.sql.addReceipt.run(event.id, new Date().toISOString());
      if (!event.viewer?.id) { this.db.exec('COMMIT'); return { unlocked: [], viewer: null }; }
      const v = event.viewer;
      this.sql.upsertViewer.run(v.id, v.name.slice(0, 80), v.color || null, v.avatar || null, JSON.stringify(defaults));
      this.sql.addObservation.run(v.id, event.channel);
      const count = key => Number.isSafeInteger(event[key]) && event[key] > 0 ? Math.min(event[key], 100000000) : 0;
      this.sql.updateObservation.run(count('months'), event.type === 'cheer' ? count('bits') : 0, event.type === 'gift' ? count('gifts') : 0, count('streak'), event.followedAt || null, v.id, event.channel);
      const current = this.viewer(v.id); const metrics = current.metrics;
      const follows = this.sql.follows.all(v.id);
      metrics.followDays = Math.max(0, ...follows.map(r => Math.floor((Date.now() - Date.parse(r.followed_at)) / 86400000)).filter(Number.isFinite));
      const settings = this.settings(event.channel); const unlocked = [];
      const look = current.look; const explicit = JSON.parse(this.sql.explicit.get(v.id).explicit);
      for (const part of unlocks) if (metrics[part.metric] >= settings.thresholds[part.id]) {
        const inserted = this.sql.addOwned.run(v.id, part.id, event.at, event.channel, JSON.stringify({ metric: part.metric, value: metrics[part.metric], threshold: settings.thresholds[part.id] }));
        if (inserted.changes) { unlocked.push(part); if (!explicit.includes(part.layer)) look[part.layer] = part.id; }
      }
      this.sql.updateLook.run(JSON.stringify(look), v.id);
      if (unlocked.length) this.sql.announce.run(event.id, event.channel, `${v.name.slice(0, 50)} earned ${unlocked.map(p => p.name).join(', ')}! Try !robot parts`, v.id);
      this.db.exec('COMMIT');
      return { unlocked, viewer: this.viewer(v.id) };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  async flushAnnouncements({allow=()=>true,deliver}) {
    for (const row of this.sql.pendingAnnouncements.all()) {
      if (!allow(row)) continue;
      if (!this.sql.markAnnouncementSent.run(row.id).changes) continue;
      await deliver(row);
    }
  }
  pruneReceipts(now=Date.now()) { return this.sql.pruneReceipt.run(new Date(now-30*86400000).toISOString()).changes; }
  close() { clearInterval(this.receiptTimer); this.db.close(); }
}
