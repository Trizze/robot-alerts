export const BUILTIN_SOUND = "/robot/sounds/robot-arrival.mp3";
export const MAX_SOUND_BYTES = 96 * 1024;

export async function readSound(file) {
  if (
    !file ||
    file.size > MAX_SOUND_BYTES ||
    !/\.(mp3|wav|ogg)$/i.test(file.name)
  )
    throw new Error("Choose an MP3, WAV or OGG up to 96 KB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  let mime;
  if (text(0, 4) === "RIFF" && text(8, 12) === "WAVE") mime = "wav";
  else if (text(0, 4) === "OggS") mime = "ogg";
  else if (
    text(0, 3) === "ID3" ||
    (bytes[0] === 255 && (bytes[1] & 224) === 224)
  )
    mime = "mpeg";
  else throw new Error("This file is not supported audio.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  const src = `data:audio/${mime};base64,${btoa(binary)}`;
  const audio = new Audio(src);
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Could not read this audio file.")),
        5000,
      );
      audio.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Could not read this audio file."));
      };
      audio.load();
    });
    if (!Number.isFinite(audio.duration) || audio.duration > 15)
      throw new Error("Keep alert sounds to 15 seconds or less.");
    return src;
  } finally {
    audio.removeAttribute("src");
    audio.load();
  }
}

// One owned player/timer per alert; stop on completion, error or page exit.
export function playAlertSound(
  settings,
  type,
  onBlocked = () => {},
  delay = true,
) {
  const source = settings.sounds?.[type];
  const volume = settings.soundVolume ?? 0.7;
  if (
    !source ||
    !Number.isFinite(volume) ||
    volume <= 0 ||
    volume > 1 ||
    !(
      source === BUILTIN_SOUND ||
      /^data:audio\/(?:mpeg|wav|ogg);base64,[A-Za-z0-9+/]+={0,2}$/.test(source)
    )
  )
    return () => {};
  const audio = new Audio(source);
  audio.volume = volume;
  let stopped = false;
  const start = () =>
    audio.play().catch(() => {
      if (!stopped) onBlocked();
    });
  const seconds = delay
    ? Math.min(10, Math.max(0, settings.soundDelay || 0))
    : 0;
  const timer = setTimeout(start, seconds * 1000);
  return () => {
    stopped = true;
    clearTimeout(timer);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };
}
