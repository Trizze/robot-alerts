export const SOUND_EVENTS = ["sub", "resub", "gift", "cheer", "follow", "raid"];
export const MAX_SOUND_BYTES = 96 * 1024;
export const BUILTIN_SOUND = "/robot/sounds/robot-arrival.mp3";

// No remote URLs, HTML, file paths or executable formats. Audio is public overlay media.
export function validSound(source) {
  if (source === BUILTIN_SOUND) return true;
  if (
    typeof source !== "string" ||
    source.length > (MAX_SOUND_BYTES * 4) / 3 + 64
  )
    return false;
  const match =
    /^data:audio\/(mpeg|wav|ogg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (
    bytes.length < 12 ||
    bytes.length > MAX_SOUND_BYTES ||
    bytes.toString("base64") !== match[2]
  )
    return false;
  if (match[1] === "wav")
    return (
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WAVE"
    );
  if (match[1] === "ogg") return bytes.toString("ascii", 0, 4) === "OggS";
  return (
    bytes.toString("ascii", 0, 3) === "ID3" ||
    (bytes[0] === 0xff &&
      (bytes[1] & 0xe0) === 0xe0 &&
      (bytes[1] & 0x18) !== 0x08 &&
      (bytes[1] & 6) !== 0)
  );
}

export function validateSounds(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length > SOUND_EVENTS.length ||
    Object.entries(value).some(
      ([type, source]) => !SOUND_EVENTS.includes(type) || !validSound(source),
    )
  )
    throw new Error("Invalid alert sounds");
  return { ...value };
}

// Send only the sound needed for this alert, never the entire uploaded library.
export function overlaySoundSettings(settings, type) {
  const { sounds, ...rest } = settings;
  if (type && sounds?.[type]) rest.sounds = { [type]: sounds[type] };
  return rest;
}
