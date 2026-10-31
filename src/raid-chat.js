// Participation is a visual-only exception to the live testing allowlist. It
// reads cached identity but never records messages, progress, unlocks or replies.
export function handleRaidChat(event, { queue, store, profiles }) {
  if (
    event.type !== "chat" ||
    !/^\d+$/.test(event.viewer?.id || "") ||
    !queue.raidCrowdOpen(event.channel, false)
  )
    return false;
  const key = queue.current.key,
    cached = store.viewer(event.viewer.id),
    viewer = { ...event.viewer, avatar: cached?.avatar };
  if (
    queue.joinRaid(event.channel, viewer, false) &&
    !viewer.avatar &&
    profiles
  )
    profiles
      .crowdProfile(viewer, () => queue.current?.key === key)
      .then((profile) => queue.updateRaidViewer(key, viewer.id, profile))
      .catch(() => {});
  return true;
}
