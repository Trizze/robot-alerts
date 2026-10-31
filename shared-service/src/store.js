import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { contributionUnits, earnedPatternSlots, unlockedPatternTier } from '../../src/robots/pattern-points.js';

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const validId = id => typeof id === 'string' && /^\d{1,32}$/.test(id);

export class SharedStore {
  constructor(path, { encryptionKey, patternSeed, catalog }) {
    if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32 || !Buffer.isBuffer(patternSeed) || patternSeed.length < 32) throw new Error('Encryption and pattern keys must be configured');
    if (!Array.isArray(catalog) || catalog.some(p => !p || !/^[a-z0-9_]+$/.test(p.id) || !Number.isInteger(p.tier) || p.tier < 1 || p.tier > 5) || new Set(catalog.map(p => p.id)).size !== catalog.length) throw new Error('Invalid pattern catalog');
    this.key = encryptionKey; this.patternSeed = patternSeed; this.catalog = catalog;
    this.counts = [1,2,3,4,5].map(tier => catalog.filter(p => p.tier === tier).length);
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS viewers(id TEXT PRIMARY KEY, display_name TEXT NOT NULL, selected_pattern TEXT);
      CREATE TABLE IF NOT EXISTS channels(id TEXT PRIMARY KEY, display_name TEXT NOT NULL, credential BLOB NOT NULL, nonce BLOB NOT NULL, tag BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(viewer_id TEXT NOT NULL REFERENCES viewers(id) ON DELETE CASCADE, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, event_type TEXT NOT NULL, point_units INTEGER NOT NULL CHECK(point_units > 0), occurred_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ledger_viewer ON ledger(viewer_id);
      CREATE INDEX IF NOT EXISTS ledger_channel ON ledger(channel_id);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('viewer','streamer')), expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);`);
    const columns = new Set(this.db.prepare('PRAGMA table_info(viewers)').all().map(column => column.name));
    if (!columns.has('pattern_scale')) this.db.exec('ALTER TABLE viewers ADD COLUMN pattern_scale REAL NOT NULL DEFAULT 1');
    if (!columns.has('chest_type')) this.db.exec("ALTER TABLE viewers ADD COLUMN chest_type TEXT NOT NULL DEFAULT 'none'");
    if (!columns.has('chest_value')) this.db.exec("ALTER TABLE viewers ADD COLUMN chest_value TEXT NOT NULL DEFAULT ''");
    const channelColumns = new Set(this.db.prepare('PRAGMA table_info(channels)').all().map(column => column.name));
    if (!channelColumns.has('connected')) this.db.exec('ALTER TABLE channels ADD COLUMN connected INTEGER NOT NULL DEFAULT 1');
  }
  saveChannel(id, displayName, credentials) {
    if (!validId(id) || typeof displayName !== 'string' || !displayName || !credentials || typeof credentials !== 'object') throw new Error('Invalid channel');
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials),'utf8'), cipher.final()]);
    this.db.prepare('INSERT INTO channels(id,display_name,credential,nonce,tag,connected) VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, credential=excluded.credential, nonce=excluded.nonce, tag=excluded.tag, connected=1').run(id, displayName.slice(0,80), encrypted, nonce, cipher.getAuthTag());
  }
  channelCredentials(id) {
    if (!validId(id)) return null;
    const row = this.db.prepare('SELECT credential, nonce, tag FROM channels WHERE id=?').get(id);
    if (!row) return null;
    const cipher = createDecipheriv('aes-256-gcm', this.key, row.nonce); cipher.setAAD(Buffer.from(id)); cipher.setAuthTag(row.tag);
    return JSON.parse(Buffer.concat([cipher.update(row.credential),cipher.final()]).toString('utf8'));
  }
  channelName(id) { return validId(id) ? this.db.prepare('SELECT display_name FROM channels WHERE id=?').get(id)?.display_name : null; }
  channelExists(id) { return validId(id) && !!this.db.prepare('SELECT 1 FROM channels WHERE id=?').get(id); }
  hasChannel(id) { return validId(id) && !!this.db.prepare('SELECT 1 FROM channels WHERE id=? AND connected=1').get(id); }
  markChannelDisconnected(id) { if (validId(id)) this.db.prepare('UPDATE channels SET connected=0 WHERE id=?').run(id); }
  record(event, now = Date.now()) {
    if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 256 || !validId(event.channel) || !this.hasChannel(event.channel)) throw new Error('Invalid event channel');
    if (!Number.isSafeInteger(now) || !Number.isFinite(Date.parse(event.at))) throw new Error('Invalid event time');
    const units = contributionUnits(event, { creditGifts:true });
    if (units && (!validId(event.viewer?.id) || typeof event.viewer?.name !== 'string' || !event.viewer.name)) throw new Error('Invalid viewer');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const receipt = this.db.prepare('INSERT OR IGNORE INTO receipts VALUES(?,?,?)').run(event.id, event.channel, now + SEVEN_DAYS);
      if (!receipt.changes) { this.db.exec('COMMIT'); return { duplicate:true, awarded:0 }; }
      if (units) {
        this.db.prepare('INSERT INTO viewers(id,display_name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name').run(event.viewer.id,event.viewer.name.slice(0,80));
        this.db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?)').run(event.viewer.id,event.channel,event.type,units,event.at);
      }
      this.db.exec('COMMIT'); return { duplicate:false, awarded:units };
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  viewer(id) {
    if (!validId(id)) return null;
    const row = this.db.prepare('SELECT id,display_name,selected_pattern,pattern_scale,chest_type,chest_value FROM viewers WHERE id=?').get(id); if (!row) return null;
    const points = this.db.prepare('SELECT COALESCE(SUM(point_units),0) AS units FROM ledger WHERE viewer_id=?').get(id).units;
    const slots = earnedPatternSlots(points,this.counts);
    // A keyed ordering is a stable, random-looking draw without storing another
    // personal-data table. Keep the catalog and seed stable after launch.
    const owned = [];
    for (let tier = 1; tier <= 5; tier++) {
      const ranked = this.catalog.filter(p => p.tier === tier).map(p => ({ ...p, rank:createHmac('sha256',this.patternSeed).update(id + ':' + tier + ':' + p.id).digest('hex') })).sort((a,b) => a.rank.localeCompare(b.rank));
      owned.push(...ranked.slice(0,slots[tier-1]).map(({rank,...p}) => p));
    }
    return { id:row.id, displayName:row.display_name, points:points/500, tier:unlockedPatternTier(points), selectedPattern:owned.some(p=>p.id===row.selected_pattern) ? row.selected_pattern : null, patternScale:row.pattern_scale, chestType:row.chest_type, chestValue:row.chest_value, owned };
  }
  upsertViewer(id,name) {
    if (!validId(id) || typeof name !== 'string' || !name) throw new Error('Invalid viewer');
    this.db.prepare('INSERT INTO viewers(id,display_name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name').run(id,name.slice(0,80));
    return this.viewer(id);
  }
  selectPattern(id, pattern) {
    const viewer = this.viewer(id); if (!viewer) throw new Error('Viewer not found');
    if (pattern !== null && !viewer.owned.some(p => p.id === pattern)) throw new Error('Pattern not unlocked');
    this.db.prepare('UPDATE viewers SET selected_pattern=? WHERE id=?').run(pattern,id); return this.viewer(id);
  }
  updateAppearance(id, changes) {
    const current = this.viewer(id);
    if (!current || !changes || typeof changes !== 'object' || Array.isArray(changes) || Object.keys(changes).some(key => !['patternScale','chestType','chestValue'].includes(key))) throw new Error('Invalid appearance');
    const scale = changes.patternScale ?? current.patternScale;
    const type = changes.chestType ?? current.chestType;
    const value = changes.chestValue ?? current.chestValue;
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < .5 || scale > 2 || !['none','emoji','emote'].includes(type) || typeof value !== 'string' || value.length > 80) throw new Error('Invalid appearance');
    if (type === 'none' && value !== '') throw new Error('Invalid chest');
    if (type === 'emote' && !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error('Invalid chest');
    if (type === 'emoji' && ([...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].length !== 1 || !/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/u.test(value))) throw new Error('Invalid chest');
    this.db.prepare('UPDATE viewers SET pattern_scale=?,chest_type=?,chest_value=? WHERE id=?').run(scale,type,value,id);
    return this.viewer(id);
  }
  createSession(id,role, now=Date.now(),ttl=THIRTY_DAYS) {
    if (!validId(id) || !['viewer','streamer'].includes(role) || !Number.isSafeInteger(now) || !Number.isSafeInteger(ttl) || ttl <= 0 || ttl > THIRTY_DAYS) throw new Error('Invalid session');
    const session = randomBytes(32).toString('base64url');
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(session),id,role,now+ttl); return session;
  }
  session(session,now=Date.now()) {
    if (typeof session !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(session)) return null;
    return this.db.prepare('SELECT user_id AS id,role FROM sessions WHERE hash=? AND expires_at>?').get(hash(session),now) || null;
  }
  deleteSession(session) { if (typeof session === 'string' && /^[A-Za-z0-9_-]{43}$/.test(session)) this.db.prepare('DELETE FROM sessions WHERE hash=?').run(hash(session)); }
  deleteChannel(id) {
    if (!validId(id)) return;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const affected = this.db.prepare('SELECT DISTINCT viewer_id FROM ledger WHERE channel_id=?').all(id);
      this.db.prepare('DELETE FROM channels WHERE id=?').run(id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=? AND role='streamer'").run(id);
      for (const { viewer_id } of affected) {
        const current = this.viewer(viewer_id);
        if (current && !current.selectedPattern) this.db.prepare('UPDATE viewers SET selected_pattern=NULL WHERE id=?').run(viewer_id);
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  deleteViewer(id) {
    if (!validId(id)) return;
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.prepare('DELETE FROM viewers WHERE id=?').run(id); this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  cleanup(now=Date.now()) { this.db.prepare('DELETE FROM receipts WHERE expires_at<=?').run(now); this.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now); }
  health() { this.db.prepare('SELECT 1').get(); }
  close() { this.db.close(); }
}
