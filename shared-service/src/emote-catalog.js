// Keep only the public fields the website needs; never persist API responses wholesale.
export function publicEmotes(items) {
  if (!Array.isArray(items)) throw new Error("Invalid emote catalog");
  return items
    .filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        item.name.length > 0 &&
        item.name.length <= 80 &&
        typeof item.id === "string" &&
        /^[A-Za-z0-9_-]{1,80}$/.test(item.id),
    )
    .map((item) => ({
      name: item.name,
      id: item.id,
      animated: Array.isArray(item.format) && item.format.includes("animated"),
    }));
}
