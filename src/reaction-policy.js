// Live reactions use verified Twitch user IDs. Empty configuration fails closed.
export function createReactionPolicy(value = "") {
  if (typeof value !== "string")
    throw new Error(
      "ALLOWED_VIEWER_IDS must be a comma-separated list of Twitch user IDs or *",
    );
  const input = value.trim();
  if (input === "*")
    return Object.freeze({
      ids: [],
      all: true,
      allowedViewer: (id) => typeof id === "string" && /^\d{1,32}$/.test(id),
    });
  const ids = input ? input.split(",").map((id) => id.trim()) : [];
  if (ids.some((id) => !/^\d{1,32}$/.test(id)))
    throw new Error("ALLOWED_VIEWER_IDS must contain only Twitch user IDs");
  const unique = [...new Set(ids)],
    allowed = new Set(unique);
  return Object.freeze({
    ids: Object.freeze(unique),
    all: false,
    allowedViewer: (id) => typeof id === "string" && allowed.has(id),
  });
}
export const reactionPolicy = createReactionPolicy(
  process.env.ALLOWED_VIEWER_IDS || "",
);
export const allowedViewer = (id) => reactionPolicy.allowedViewer(id);
export const allowedReaction = (event) => allowedViewer(event?.viewer?.id);
