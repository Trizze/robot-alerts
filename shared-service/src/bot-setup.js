// Setup can only be issued by the server-side CLI, never a public HTTP endpoint.
import { createHash, randomBytes } from "node:crypto";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const validState = (value) =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
const validHash = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export function startBotSetup(store, now = Date.now()) {
  const state = randomBytes(32).toString("base64url"),
    hash = digest(state),
    expires = now + 10 * 60 * 1000;
  store.db
    .prepare(
      "INSERT INTO bot_setup VALUES(1,?,?, 'pending') ON CONFLICT(id) DO UPDATE SET hash=excluded.hash,expires_at=excluded.expires_at,status='pending'",
    )
    .run(hash, expires);
  return { state, hash, expires };
}
export function claimBotSetup(store, state, now = Date.now()) {
  if (!validState(state)) return null;
  const hash = digest(state);
  return store.db
    .prepare(
      "UPDATE bot_setup SET status='processing' WHERE id=1 AND hash=? AND expires_at>? AND status='pending'",
    )
    .run(hash, now).changes
    ? hash
    : null;
}
export function finishBotSetup(
  store,
  hash,
  bot,
  credentials,
  now = Date.now(),
) {
  if (!validHash(hash)) throw Error("Invalid setup");
  store.db.exec("BEGIN IMMEDIATE");
  try {
    if (
      !store.db
        .prepare(
          "SELECT 1 FROM bot_setup WHERE hash=? AND status='processing' AND expires_at>?",
        )
        .get(hash, now)
    )
      throw Error("Setup expired or replaced");
    store.saveBot(bot.id, bot.display_name, credentials);
    store.db
      .prepare("UPDATE bot_setup SET status='complete' WHERE hash=?")
      .run(hash);
    store.db.exec("COMMIT");
  } catch (error) {
    store.db.exec("ROLLBACK");
    throw error;
  }
}
export function failBotSetup(store, hash) {
  if (validHash(hash))
    store.db
      .prepare(
        "UPDATE bot_setup SET status='failed' WHERE hash=? AND status='processing'",
      )
      .run(hash);
}
export function botSetupStatus(store, hash, now = Date.now()) {
  if (!validHash(hash)) return "expired";
  const row = store.db
    .prepare("SELECT status,expires_at FROM bot_setup WHERE hash=?")
    .get(hash);
  return !row || row.expires_at <= now ? "expired" : row.status;
}
