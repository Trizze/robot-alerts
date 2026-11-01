export function unlockMessage(row) {
  const name = String(row.displayName || "Viewer")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .slice(0, 40);
  const count = row.pattern_count,
    quantity = row.quantity;
  const action =
    row.event_type === "gift"
      ? `${quantity === 1 ? "that gifted sub" : `those ${quantity} gifted subs`}`
      : row.event_type === "cheer"
        ? `those ${quantity} bits`
        : row.event_type === "resub"
          ? "that resub"
          : "that subscription";
  const achievement = row.tier
    ? `reached Tier ${row.tier} and unlocked`
    : "unlocked";
  return `@${name}, you ${achievement} ${count} ${count === 1 ? "pattern" : "patterns"} from ${action}! Check them out at trizze.tv/robot/.`.slice(
    0,
    450,
  );
}
// Work exists only after an award or bot connection. No Twitch polling loop.
export function unlockDispatcher(
  store,
  twitch,
  { clock = Date.now, spacing = 1600 } = {},
) {
  let work;
  return () => {
    if (work) return work;
    work = (async () => {
      for (let sent = 0; sent < 50; sent++) {
        let bot = store.botCredentials();
        if (!bot) return;
        const row = store.takeUnlockNotice(clock());
        if (!row) return;
        try {
          let result;
          try {
            result = await twitch.sendChat(
              row.channel_id,
              bot.id,
              unlockMessage(row),
              bot.credentials.access_token,
            );
          } catch (e) {
            if (e.status !== 401) throw e;
            const next = await twitch.refresh(bot.credentials.refresh_token);
            const current = store.botCredentials();
            if (
              !current ||
              current.id !== bot.id ||
              current.credentials.refresh_token !==
                bot.credentials.refresh_token
            )
              throw Error("Bot disconnected during refresh");
            store.saveBot(bot.id, bot.name, { ...bot.credentials, ...next });
            bot = store.botCredentials();
            result = await twitch.sendChat(
              row.channel_id,
              bot.id,
              unlockMessage(row),
              bot.credentials.access_token,
            );
          }
          store.finishUnlockNotice(row.event_id, result !== false);
        } catch {
          store.finishUnlockNotice(row.event_id, false);
        }
        if (spacing)
          await new Promise((resolve) => setTimeout(resolve, spacing));
      }
    })()
      .catch(() => {})
      .finally(() => (work = null));
    return work;
  };
}
