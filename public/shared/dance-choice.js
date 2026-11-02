export const DANCE_CLIPS = Object.freeze([
  "dance-shuffle",
  "dance-disco",
  "dance-victory",
]);
export function chooseDance(random = Math.random) {
  const n = random();
  if (!Number.isFinite(n) || n < 0 || n >= 1)
    throw new RangeError("Invalid dance choice");
  return DANCE_CLIPS[Math.floor(n * DANCE_CLIPS.length)];
}
export function dancePose(atlas, pose, age, dance) {
  const frames = atlas.rig.clips[dance]?.frames;
  if (
    !pose ||
    pose[0] !== "idle" ||
    !DANCE_CLIPS.includes(dance) ||
    !frames?.length
  )
    return pose;
  const runSeconds = atlas.rig.clips["run-in"].frames.length / atlas.rig.fps;
  const index =
    Math.max(0, Math.floor((age - runSeconds) * atlas.rig.fps + 1e-7)) %
    frames.length;
  return [dance, index];
}
export function danceHold(atlas, hold, dance) {
  const frames = atlas.rig.clips[dance]?.frames;
  if (!DANCE_CLIPS.includes(dance) || !frames?.length) return hold;
  const loop = frames.length / atlas.rig.fps;
  return Math.ceil((hold - 1e-9) / loop) * loop;
}
