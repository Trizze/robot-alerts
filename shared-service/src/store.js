import { channelSettings, DEFAULT_SETTINGS } from "./channel-settings.js";
import { DatabaseSync } from "node:sqlite";
import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  contributionUnits,
  earnedPatternSlots,
  unlockedPatternTier,
} from "../../src/robots/pattern-points.js";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const validId = (id) => typeof id === "string" && /^\d{1,32}$/.test(id);

export class SharedStore {
  constructor(path, { encryptionKey, patternSeed, catalog }) {
    if (
      !Buffer.isBuffer(encryptionKey) ||
      encryptionKey.length !== 32 ||
      !Buffer.isBuffer(patternSeed) ||
      patternSeed.length < 32
    )
      throw new Error("Encryption and pattern keys must be configured");
    if (
      !Array.isArray(catalog) ||
      catalog.some(
        (p) =>
          !p ||
          !/^[a-z0-9_]+$/.test(p.id) ||
          !Number.isInteger(p.tier) ||
          p.tier < 1 ||
          p.tier > 5,
      ) ||
      new Set(catalog.map((p) => p.id)).size !== catalog.length
    )
      throw new Error("Invalid pattern catalog");
    this.key = encryptionKey;
    this.patternSeed = Buffer.from(patternSeed);
    this.catalog = catalog.map((item) => Object.freeze({ ...item }));
    this.patternRankCache = new Map();
    this.counts = [1, 2, 3, 4, 5].map(
      (tier) => catalog.filter((p) => p.tier === tier).length,
    );
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS viewers(id TEXT PRIMARY KEY, display_name TEXT NOT NULL, selected_pattern TEXT);
      CREATE TABLE IF NOT EXISTS channels(id TEXT PRIMARY KEY, display_name TEXT NOT NULL, credential BLOB NOT NULL, nonce BLOB NOT NULL, tag BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger(viewer_id TEXT NOT NULL REFERENCES viewers(id) ON DELETE CASCADE, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, event_type TEXT NOT NULL, point_units INTEGER NOT NULL CHECK(point_units > 0), occurred_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS ledger_viewer ON ledger(viewer_id);
      CREATE INDEX IF NOT EXISTS ledger_channel ON ledger(channel_id);
      CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('viewer','streamer')), expires_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS pattern_seen(viewer_id TEXT NOT NULL REFERENCES viewers(id) ON DELETE CASCADE, pattern_id TEXT NOT NULL, PRIMARY KEY(viewer_id,pattern_id));
      INSERT OR IGNORE INTO pattern_seen SELECT id,selected_pattern FROM viewers WHERE selected_pattern IS NOT NULL;
      CREATE TABLE IF NOT EXISTS bot_setup(id INTEGER PRIMARY KEY CHECK(id=1),hash TEXT NOT NULL,expires_at INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('pending','processing','complete','failed')));
      CREATE TABLE IF NOT EXISTS bot_credentials(id INTEGER PRIMARY KEY CHECK(id=1),twitch_id TEXT NOT NULL,display_name TEXT NOT NULL,credential BLOB NOT NULL,nonce BLOB NOT NULL,tag BLOB NOT NULL);
      CREATE TABLE IF NOT EXISTS unlock_notices(event_id TEXT PRIMARY KEY,channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,viewer_id TEXT NOT NULL REFERENCES viewers(id) ON DELETE CASCADE,pattern_count INTEGER NOT NULL,tier INTEGER NOT NULL,event_type TEXT NOT NULL,quantity INTEGER NOT NULL,created_at INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE IF NOT EXISTS anonymous_gifts(channel_id TEXT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,total INTEGER NOT NULL DEFAULT 0);`);
    const columns = new Set(
      this.db
        .prepare("PRAGMA table_info(viewers)")
        .all()
        .map((column) => column.name),
    );
    if (!columns.has("pattern_scale"))
      this.db.exec(
        "ALTER TABLE viewers ADD COLUMN pattern_scale REAL NOT NULL DEFAULT 1",
      );
    if (!columns.has("chest_type"))
      this.db.exec(
        "ALTER TABLE viewers ADD COLUMN chest_type TEXT NOT NULL DEFAULT 'none'",
      );
    if (!columns.has("chest_value"))
      this.db.exec(
        "ALTER TABLE viewers ADD COLUMN chest_value TEXT NOT NULL DEFAULT ''",
      );
    const channelColumns = new Set(
      this.db
        .prepare("PRAGMA table_info(channels)")
        .all()
        .map((column) => column.name),
    );
    if (!channelColumns.has("connected"))
      this.db.exec(
        "ALTER TABLE channels ADD COLUMN connected INTEGER NOT NULL DEFAULT 1",
      );
    if (!channelColumns.has("overlay_settings"))
      this.db.exec("ALTER TABLE channels ADD COLUMN overlay_settings TEXT");
  }
  overlaySettings(id) {
    if (!this.channelExists(id)) return null;
    const value = this.db
      .prepare("SELECT overlay_settings FROM channels WHERE id=?")
      .get(id)?.overlay_settings;
    return value ? channelSettings(JSON.parse(value)) : { ...DEFAULT_SETTINGS };
  }
  saveOverlaySettings(id, input) {
    if (!this.hasChannel(id)) throw new Error("Channel not connected");
    const value = channelSettings(input);
    this.db
      .prepare("UPDATE channels SET overlay_settings=? WHERE id=?")
      .run(JSON.stringify(value), id);
    return value;
  }
  saveChannel(id, displayName, credentials) {
    if (
      !validId(id) ||
      typeof displayName !== "string" ||
      !displayName ||
      !credentials ||
      typeof credentials !== "object"
    )
      throw new Error("Invalid channel");
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from(id));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(credentials), "utf8"),
      cipher.final(),
    ]);
    this.db
      .prepare(
        "INSERT INTO channels(id,display_name,credential,nonce,tag,connected) VALUES(?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name, credential=excluded.credential, nonce=excluded.nonce, tag=excluded.tag, connected=1",
      )
      .run(id, displayName.slice(0, 80), encrypted, nonce, cipher.getAuthTag());
  }
  channelCredentials(id) {
    if (!validId(id)) return null;
    const row = this.db
      .prepare("SELECT credential, nonce, tag FROM channels WHERE id=?")
      .get(id);
    if (!row) return null;
    const cipher = createDecipheriv("aes-256-gcm", this.key, row.nonce);
    cipher.setAAD(Buffer.from(id));
    cipher.setAuthTag(row.tag);
    return JSON.parse(
      Buffer.concat([cipher.update(row.credential), cipher.final()]).toString(
        "utf8",
      ),
    );
  }
  channelName(id) {
    return validId(id)
      ? this.db.prepare("SELECT display_name FROM channels WHERE id=?").get(id)
          ?.display_name
      : null;
  }
  participatingChannels() {
    return this.db
      .prepare(
        "SELECT id, display_name AS displayName FROM channels WHERE connected=1 ORDER BY display_name COLLATE NOCASE, id",
      )
      .all();
  }
  channelExists(id) {
    return (
      validId(id) &&
      !!this.db.prepare("SELECT 1 FROM channels WHERE id=?").get(id)
    );
  }
  hasChannel(id) {
    return (
      validId(id) &&
      !!this.db
        .prepare("SELECT 1 FROM channels WHERE id=? AND connected=1")
        .get(id)
    );
  }
  markChannelDisconnected(id) {
    if (validId(id))
      this.db.prepare("UPDATE channels SET connected=0 WHERE id=?").run(id);
  }
  record(event, now = Date.now()) {
    if (
      !event ||
      typeof event.id !== "string" ||
      !event.id ||
      event.id.length > 256 ||
      !validId(event.channel) ||
      !this.hasChannel(event.channel)
    )
      throw new Error("Invalid event channel");
    if (!Number.isSafeInteger(now) || !Number.isFinite(Date.parse(event.at)))
      throw new Error("Invalid event time");
    const units = contributionUnits(event, { creditGifts: true });
    if (
      units &&
      (!validId(event.viewer?.id) ||
        typeof event.viewer?.name !== "string" ||
        !event.viewer.name)
    )
      throw new Error("Invalid viewer");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const before = units ? this.viewer(event.viewer.id) : null;
      const receipt = this.db
        .prepare("INSERT OR IGNORE INTO receipts VALUES(?,?,?)")
        .run(event.id, event.channel, now + SEVEN_DAYS);
      if (!receipt.changes) {
        this.db.exec("COMMIT");
        return { duplicate: true, awarded: 0 };
      }
      if (
        event.type === "gift" &&
        event.anonymous === true &&
        Number.isSafeInteger(event.gifts) &&
        event.gifts > 0
      ) {
        this.db
          .prepare(
            "INSERT INTO anonymous_gifts(channel_id,total) VALUES(?,?) ON CONFLICT(channel_id) DO UPDATE SET total=total+excluded.total",
          )
          .run(event.channel, Math.min(event.gifts, 100000000));
      }
      if (units) {
        this.db
          .prepare(
            "INSERT INTO viewers(id,display_name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name",
          )
          .run(event.viewer.id, event.viewer.name.slice(0, 80));
        this.db
          .prepare("INSERT INTO ledger VALUES(?,?,?,?,?)")
          .run(event.viewer.id, event.channel, event.type, units, event.at);
      }
      if (units) {
        const after = this.viewer(event.viewer.id);
        const known = new Set(before?.owned.map((p) => p.id) || []);
        const count = after.owned.filter((p) => !known.has(p.id)).length;
        if (count && this.overlaySettings(event.channel).chatAnnouncements)
          this.db
            .prepare(
              "INSERT OR IGNORE INTO unlock_notices(event_id,channel_id,viewer_id,pattern_count,tier,event_type,quantity,created_at) VALUES(?,?,?,?,?,?,?,?)",
            )
            .run(
              event.id,
              event.channel,
              event.viewer.id,
              count,
              after.tier > (before?.tier || 0) ? after.tier : 0,
              event.type,
              event.gifts || event.bits || 1,
              now,
            );
      }
      this.db.exec("COMMIT");
      return { duplicate: false, awarded: units };
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  viewer(id) {
    if (!validId(id)) return null;
    const row = this.db
      .prepare(
        "SELECT id,display_name,selected_pattern,pattern_scale,chest_type,chest_value FROM viewers WHERE id=?",
      )
      .get(id);
    if (!row) return null;
    const points = this.db
      .prepare(
        "SELECT COALESCE(SUM(point_units),0) AS units FROM ledger WHERE viewer_id=?",
      )
      .get(id).units;
    const slots = earnedPatternSlots(points, this.counts);
    // A keyed ordering is a stable, random-looking draw without storing another
    // personal-data table. Keep the catalog and seed stable after launch.
    const owned = [];
    if (slots.some(Boolean)) {
      const ranked = this.rankedPatterns(id);
      for (let tier = 1; tier <= 5; tier++)
        owned.push(...ranked[tier - 1].slice(0, slots[tier - 1]));
    }
    const seen = new Set(
      this.db
        .prepare("SELECT pattern_id FROM pattern_seen WHERE viewer_id=?")
        .all(id)
        .map((p) => p.pattern_id),
    );
    return {
      id: row.id,
      displayName: row.display_name,
      points: points / 500,
      tier: unlockedPatternTier(points),
      selectedPattern: owned.some((p) => p.id === row.selected_pattern)
        ? row.selected_pattern
        : null,
      patternScale: row.pattern_scale,
      chestType: row.chest_type,
      chestValue: row.chest_value,
      owned: owned.map((p) => ({ ...p, isNew: !seen.has(p.id) })),
    };
  }
  saveBot(id, name, credentials) {
    if (
      !validId(id) ||
      typeof name !== "string" ||
      !credentials ||
      typeof credentials !== "object"
    )
      throw new Error("Invalid bot authorization");
    const nonce = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    cipher.setAAD(Buffer.from("robot-alerts:bot"));
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(credentials), "utf8"),
      cipher.final(),
    ]);
    this.db
      .prepare(
        "INSERT INTO bot_credentials VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET twitch_id=excluded.twitch_id,display_name=excluded.display_name,credential=excluded.credential,nonce=excluded.nonce,tag=excluded.tag",
      )
      .run(id, name.slice(0, 80), encrypted, nonce, cipher.getAuthTag());
  }
  botCredentials() {
    const r = this.db.prepare("SELECT * FROM bot_credentials WHERE id=1").get();
    if (!r) return null;
    const c = createDecipheriv("aes-256-gcm", this.key, r.nonce);
    c.setAAD(Buffer.from("robot-alerts:bot"));
    c.setAuthTag(r.tag);
    return {
      id: r.twitch_id,
      name: r.display_name,
      credentials: JSON.parse(
        Buffer.concat([c.update(r.credential), c.final()]).toString("utf8"),
      ),
    };
  }
  botStatus() {
    const r = this.db
      .prepare(
        "SELECT twitch_id AS id,display_name AS name FROM bot_credentials WHERE id=1",
      )
      .get();
    return r ? { connected: true, name: r.name } : { connected: false };
  }
  deleteBot() {
    this.db.exec("DELETE FROM bot_credentials");
  }
  clearUnlockNotices(channel) {
    this.db
      .prepare("DELETE FROM unlock_notices WHERE channel_id=?")
      .run(channel);
  }
  takeUnlockNotice(now = Date.now()) {
    const row = this.db
      .prepare(
        "SELECT n.*,v.display_name AS displayName FROM unlock_notices n JOIN viewers v ON v.id=n.viewer_id JOIN channels c ON c.id=n.channel_id WHERE n.state='pending' AND n.created_at>? AND c.connected=1 ORDER BY n.created_at LIMIT 1",
      )
      .get(now - 15 * 60 * 1000);
    if (!row) return null;
    const result = this.db
      .prepare(
        "UPDATE unlock_notices SET state='sending' WHERE event_id=? AND state='pending'",
      )
      .run(row.event_id);
    return result.changes ? row : null;
  }
  finishUnlockNotice(id, ok) {
    if (ok)
      this.db.prepare("DELETE FROM unlock_notices WHERE event_id=?").run(id);
    else
      this.db
        .prepare("UPDATE unlock_notices SET state='failed' WHERE event_id=?")
        .run(id);
  }
  anonymousRobot(channel, scope = "channel") {
    const total =
      scope === "global"
        ? this.db
            .prepare(
              "SELECT COALESCE(SUM(total),0) AS total FROM anonymous_gifts",
            )
            .get().total
        : this.db
            .prepare("SELECT total FROM anonymous_gifts WHERE channel_id=?")
            .get(channel)?.total || 0;
    const bucket = Math.floor(total / 10);
    const key = scope === "global" ? "global" : channel;
    const patterns = this.catalog
      .map((p) => ({
        id: p.id,
        rank: createHmac("sha256", this.patternSeed)
          .update(`anonymous:${key}:${p.id}`)
          .digest("hex"),
      }))
      .sort((a, b) => a.rank.localeCompare(b.rank));
    return {
      id: "anonymous",
      name: "Anonymous",
      anonymous: true,
      anonymousGiftTotal: total,
      avatar: "/robot/assets/twitch-default.webp",
      selectedPattern:
        bucket && patterns.length
          ? patterns[(bucket - 1) % patterns.length].id
          : null,
      patternScale: 1,
      chestType: "none",
      chestValue: "",
    };
  }
  rankedPatterns(id) {
    const cached = this.patternRankCache.get(id);
    if (cached) {
      this.patternRankCache.delete(id);
      this.patternRankCache.set(id, cached);
      return cached;
    }
    const ranks = [1, 2, 3, 4, 5].map((tier) =>
      this.catalog
        .filter((p) => p.tier === tier)
        .map((p) => ({
          pattern: p,
          rank: createHmac("sha256", this.patternSeed)
            .update(id + ":" + tier + ":" + p.id)
            .digest("hex"),
        }))
        .sort((a, b) => a.rank.localeCompare(b.rank))
        .map((item) => item.pattern),
    );
    this.patternRankCache.set(id, ranks);
    if (this.patternRankCache.size > 256)
      this.patternRankCache.delete(this.patternRankCache.keys().next().value);
    return ranks;
  }
  upsertViewer(id, name) {
    if (!validId(id) || typeof name !== "string" || !name)
      throw new Error("Invalid viewer");
    this.db
      .prepare(
        "INSERT INTO viewers(id,display_name) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name",
      )
      .run(id, name.slice(0, 80));
    return this.viewer(id);
  }
  selectPattern(id, pattern) {
    const viewer = this.viewer(id);
    if (!viewer) throw new Error("Viewer not found");
    if (pattern !== null && !viewer.owned.some((p) => p.id === pattern))
      throw new Error("Pattern not unlocked");
    this.db
      .prepare("UPDATE viewers SET selected_pattern=? WHERE id=?")
      .run(pattern, id);
    if (pattern !== null)
      this.db
        .prepare("INSERT OR IGNORE INTO pattern_seen VALUES(?,?)")
        .run(id, pattern);
    return this.viewer(id);
  }
  updateAppearance(id, changes) {
    const current = this.viewer(id);
    if (
      !current ||
      !changes ||
      typeof changes !== "object" ||
      Array.isArray(changes) ||
      Object.keys(changes).some(
        (key) => !["patternScale", "chestType", "chestValue"].includes(key),
      )
    )
      throw new Error("Invalid appearance");
    const scale = changes.patternScale ?? current.patternScale;
    const type = changes.chestType ?? current.chestType;
    const value = changes.chestValue ?? current.chestValue;
    if (
      typeof scale !== "number" ||
      !Number.isFinite(scale) ||
      scale < 0.5 ||
      scale > 2 ||
      !["none", "emoji", "emote"].includes(type) ||
      typeof value !== "string" ||
      value.length > 80
    )
      throw new Error("Invalid appearance");
    if (type === "none" && value !== "") throw new Error("Invalid chest");
    if (type === "emote" && !/^[A-Za-z0-9_-]{1,80}$/.test(value))
      throw new Error("Invalid chest");
    if (
      type === "emoji" &&
      ([
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          value,
        ),
      ].length !== 1 ||
        !/(?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/u.test(
          value,
        ))
    )
      throw new Error("Invalid chest");
    this.db
      .prepare(
        "UPDATE viewers SET pattern_scale=?,chest_type=?,chest_value=? WHERE id=?",
      )
      .run(scale, type, value, id);
    return this.viewer(id);
  }
  createSession(id, role, now = Date.now(), ttl = THIRTY_DAYS) {
    if (
      !validId(id) ||
      !["viewer", "streamer"].includes(role) ||
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(ttl) ||
      ttl <= 0 ||
      ttl > THIRTY_DAYS
    )
      throw new Error("Invalid session");
    const session = randomBytes(32).toString("base64url");
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(hash(session), id, role, now + ttl);
    return session;
  }
  session(session, now = Date.now()) {
    if (typeof session !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(session))
      return null;
    return (
      this.db
        .prepare(
          "SELECT user_id AS id,role FROM sessions WHERE hash=? AND expires_at>?",
        )
        .get(hash(session), now) || null
    );
  }
  deleteSession(session) {
    if (typeof session === "string" && /^[A-Za-z0-9_-]{43}$/.test(session))
      this.db.prepare("DELETE FROM sessions WHERE hash=?").run(hash(session));
  }
  deleteChannel(id) {
    if (!validId(id)) return;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const affected = this.db
        .prepare("SELECT DISTINCT viewer_id FROM ledger WHERE channel_id=?")
        .all(id);
      this.db.prepare("DELETE FROM channels WHERE id=?").run(id);
      this.db
        .prepare("DELETE FROM sessions WHERE user_id=? AND role='streamer'")
        .run(id);
      for (const { viewer_id } of affected) {
        const current = this.viewer(viewer_id);
        if (current && !current.selectedPattern)
          this.db
            .prepare("UPDATE viewers SET selected_pattern=NULL WHERE id=?")
            .run(viewer_id);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  deleteViewer(id) {
    this.db.prepare("DELETE FROM bot_credentials WHERE twitch_id=?").run(id);
    if (!validId(id)) return;
    this.patternRankCache.delete(id);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare("DELETE FROM viewers WHERE id=?").run(id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  cleanup(now = Date.now()) {
    this.db
      .prepare(
        "DELETE FROM unlock_notices WHERE created_at<=? OR state='failed'",
      )
      .run(now - SEVEN_DAYS);
    this.db.prepare("DELETE FROM bot_setup WHERE expires_at<=?").run(now);
    this.db.prepare("DELETE FROM receipts WHERE expires_at<=?").run(now);
    this.db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  }
  health() {
    this.db.prepare("SELECT 1").get();
  }
  close() {
    this.db.close();
  }
}
