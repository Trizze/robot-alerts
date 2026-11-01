export const PRESETS = [
  "02",
  "03",
  "04",
  "05",
  "07",
  "08",
  "09",
  "01",
  "10",
  "none",
];
export const DEFAULT_SETTINGS = Object.freeze({
  resolution: "1080p",
  preset: "03",
  theme: "default",
  events: ["sub", "resub", "gift", "cheer"],
  games: [],
});
export function channelSettings(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !Object.hasOwn(DEFAULT_SETTINGS, key))
  )
    throw new Error("Invalid channel settings");
  const value = { ...DEFAULT_SETTINGS, ...input };
  if (
    !["720p", "1080p", "1440p"].includes(value.resolution) ||
    !PRESETS.includes(value.preset) ||
    !["default", "gaming"].includes(value.theme)
  )
    throw new Error("Invalid channel settings");
  if (
    !Array.isArray(value.events) ||
    value.events.length > 6 ||
    new Set(value.events).size !== value.events.length ||
    value.events.some(
      (x) => !["sub", "resub", "gift", "cheer", "follow", "raid"].includes(x),
    ) ||
    !Array.isArray(value.games) ||
    value.games.length > 5 ||
    value.games.some(
      (x) =>
        typeof x !== "string" ||
        !x.trim() ||
        x.length > 60 ||
        /[\r\n\x00-\x1f]/.test(x),
    )
  )
    throw new Error("Invalid channel settings");
  value.events = [...value.events];
  value.games = value.games.map((x) => x.trim());
  return value;
}
