export const thresholds = [1, 100, 250, 500, 1000];
export function tierProgress(points) {
  const n = Number.isFinite(points) ? Math.max(0, points) : 0;
  const tier = thresholds.filter((p) => n >= p).length;
  const from = tier ? thresholds[tier - 1] : 0;
  const to = thresholds[tier] ?? null;
  return {
    tier,
    from,
    to,
    value: to ? Math.min(1, (n - from) / (to - from)) : 1,
    remaining: to ? Math.max(0, to - n) : 0,
  };
}
