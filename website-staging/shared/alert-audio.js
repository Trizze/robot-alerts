import { isLibrarySound } from "./sound-library.js?v=bundled-1";
export { BUILTIN_SOUND } from "./sound-library.js?v=bundled-1";

// One owned player/timer per alert; stop on completion, error or page exit.
export function playAlertSound(
  settings,
  type,
  onBlocked = () => {},
  delay = true,
  onPlaying = () => {},
) {
  const source = settings.sounds?.[type];
  const volume = settings.soundVolume ?? 0.7;
  if (
    !source ||
    !Number.isFinite(volume) ||
    volume <= 0 ||
    volume > 1 ||
    !isLibrarySound(source)
  )
    return () => {};
  const audio = new Audio(source + "?v=audio-fix-1");
  audio.volume = volume;
  let stopped = false;
  const retry = () => {
    if (!stopped) start();
  };
  const start = () =>
    audio
      .play()
      .then(() => {
        globalThis.removeEventListener?.("pointerdown", retry);
        if (!stopped) onPlaying();
      })
      .catch((error) => {
        if (stopped) return;
        globalThis.addEventListener?.("pointerdown", retry, { once: true });
        onBlocked(error);
      });
  const seconds = delay
    ? Math.min(10, Math.max(0, settings.soundDelay || 0))
    : 0;
  const timer = setTimeout(start, seconds * 1000);
  return () => {
    stopped = true;
    globalThis.removeEventListener?.("pointerdown", retry);
    clearTimeout(timer);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };
}
