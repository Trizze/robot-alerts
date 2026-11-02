import { isLibrarySound } from "./sound-library.js?v=bundled-1";
export { BUILTIN_SOUND } from "./sound-library.js?v=bundled-1";

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
    !isLibrarySound(source)
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
