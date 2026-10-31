const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 100000000) : 0;
export function normalize(message, channel, botId) {
  const raw = message.payload?.event, type = message.payload?.subscription?.type;
  if (!raw || !message.metadata?.message_id) return null;
  const source = raw.source_broadcaster_user_id || raw.broadcaster_user_id || raw.to_broadcaster_user_id;
  if (source !== channel) return null;
  const event = { id: message.metadata.message_id, channel, at: message.metadata.message_timestamp || new Date().toISOString() };
  const viewer = (id, name, anonymous = false) => !anonymous && /^\d+$/.test(id || '') ? { id, name: String(name || 'Viewer').slice(0, 80), color: /^#[\da-f]{6}$/i.test(raw.color || '') ? raw.color : undefined } : null;
  if (type === 'channel.chat.message') {
    if (raw.chatter_user_id === botId) return null;
    return { ...event, id: `chat:${channel}:${raw.source_message_id || raw.message_id || event.id}`, type: 'chat', viewer: viewer(raw.chatter_user_id, raw.chatter_user_name), message: String(raw.message?.text || '').slice(0, 500) };
  }
  if (type === 'channel.chat.notification') {
    if (raw.notice_type !== 'watch_streak') return null;
    return { ...event, type: 'observation', viewer: viewer(raw.chatter_user_id, raw.chatter_user_name, raw.chatter_is_anonymous), streak: safeCount(raw.watch_streak?.streak_count) };
  }
  if (type === 'channel.subscribe') return { ...event, type: raw.is_gift ? 'observation' : 'sub', viewer: viewer(raw.user_id, raw.user_name), months: 1, tier: ['1000','2000','3000'].includes(raw.tier) ? raw.tier : undefined };
  if (type === 'channel.subscription.message') return { ...event, type: 'resub', viewer: viewer(raw.user_id, raw.user_name), months: safeCount(raw.cumulative_months), tier: ['1000','2000','3000'].includes(raw.tier) ? raw.tier : undefined };
  if (type === 'channel.subscription.gift') return { ...event, type: 'gift', viewer: viewer(raw.user_id, raw.user_name, raw.is_anonymous), gifts: safeCount(raw.total), tier: ['1000','2000','3000'].includes(raw.tier) ? raw.tier : undefined };
  if (type === 'channel.cheer') return { ...event, type: 'cheer', viewer: viewer(raw.user_id, raw.user_name, raw.is_anonymous), bits: safeCount(raw.bits) };
  if (type === 'channel.follow') return { ...event, type: 'follow', viewer: viewer(raw.user_id, raw.user_name), followedAt: Number.isFinite(Date.parse(raw.followed_at)) ? raw.followed_at : undefined };
  if (type === 'channel.raid') return { ...event, type: 'raid', viewer: viewer(raw.from_broadcaster_user_id, raw.from_broadcaster_user_name), raidSize: safeCount(raw.viewers) };
  return null;
}
export function subscriptions(channel, botId, role) {
  return role === 'bot' ? ['channel.chat.message', 'channel.chat.notification'].map(type => ({ type, version: '1', condition: { broadcaster_user_id: channel, user_id: botId } })) : [
    ...['channel.subscribe', 'channel.subscription.message', 'channel.subscription.gift', 'channel.cheer'].map(type => ({ type, version: '1', condition: { broadcaster_user_id: channel } })),
    { type: 'channel.raid', version: '1', condition: { to_broadcaster_user_id: channel } },
    { type: 'channel.follow', version: '2', condition: { broadcaster_user_id: channel, moderator_user_id: channel } }
  ];
}
