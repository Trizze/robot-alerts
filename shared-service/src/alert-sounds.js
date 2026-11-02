import { isLibrarySound } from "../../website-staging/shared/sound-library.js";
export { BUILTIN_SOUND } from "../../website-staging/shared/sound-library.js";
export const SOUND_EVENTS = ["sub", "resub", "gift", "cheer", "follow", "raid"];
export const validSound = isLibrarySound;

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
    throw new Error("Choose a sound from the library");
  return { ...value };
}

export function librarySoundsOnly(sounds) {
  if (!sounds || typeof sounds !== "object" || Array.isArray(sounds)) return {};
  return Object.fromEntries(
    Object.entries(sounds).filter(
      ([type, src]) => SOUND_EVENTS.includes(type) && validSound(src),
    ),
  );
}

export function overlaySoundSettings(settings, type) {
  const { sounds, ...rest } = settings;
  if (type && validSound(sounds?.[type]))
    rest.sounds = { [type]: sounds[type] };
  return rest;
}
