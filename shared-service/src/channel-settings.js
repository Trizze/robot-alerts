export const PRESETS = ["02", "03", "04", "05", "07", "08", "09", "01", "10"];
export const DEFAULT_SETTINGS = Object.freeze({
  resolution: "1080p",
  preset: "03",
  theme: "default",
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
  return value;
}
