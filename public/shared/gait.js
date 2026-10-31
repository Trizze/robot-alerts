const fraction = (n) => ((n % 1) + 1) % 1;
// During stance, local foot travel cancels root travel exactly. Swing returns
// the foot through a lifted arc; gait phase depends on distance, not wall time.
export function footstep(distance, stride = 18, offset = 0) {
  const phase = fraction(distance / (stride / 0.6) + offset);
  if (phase < 0.6)
    return { x: stride * (0.5 - phase / 0.6), lift: 0, stance: true, phase };
  const t = (phase - 0.6) / 0.4,
    s = t * t * (3 - 2 * t);
  return {
    x: stride * (s - 0.5),
    lift: Math.sin(Math.PI * t) * 4,
    stance: false,
    phase,
  };
}
