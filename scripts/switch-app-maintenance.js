// Owner-run maintenance only, while the service is stopped. Never delete channels:
// their foreign-key children include the earned points ledger and saved settings.
import { createCipheriv, randomBytes } from "node:crypto";

export function resetAppAuthorizations(db, encryptionKey) {
  if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32)
    throw new Error("Invalid existing encryption key");
  db.exec("BEGIN IMMEDIATE");
  try {
    const channels = db.prepare("SELECT id FROM channels").all();
    const update = db.prepare(
      "UPDATE channels SET connected=0,credential=?,nonce=?,tag=? WHERE id=?",
    );
    for (const { id } of channels) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
      cipher.setAAD(Buffer.from(id));
      const encrypted = Buffer.concat([
        cipher.update("{}", "utf8"),
        cipher.final(),
      ]);
      update.run(encrypted, nonce, cipher.getAuthTag(), id);
    }
    db.exec(
      "DELETE FROM bot_credentials; DELETE FROM sessions; DELETE FROM unlock_notices;",
    );
    db.exec("COMMIT");
    return { reconnectChannels: channels.length };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
