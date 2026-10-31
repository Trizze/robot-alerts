export const METEOR_TIMING = Object.freeze({
  impact: 1.05,
  lying: 1.35,
  grow: 1.85,
  launch: 2.4,
  apex: 2.85,
  land: 3.4,
  dance: 3.65,
  exit: 7.8,
  end: 8.3,
});
export function createMeteorTimeline(gsap, exit = METEOR_TIMING.exit) {
  const timing = {
    ...METEOR_TIMING,
    exit: Math.max(METEOR_TIMING.dance + 0.1, exit),
    end: Math.max(METEOR_TIMING.dance + 0.1, exit) + 0.3,
  };
  const state = {
    x: 800,
    y: -110,
    angle: 70,
    growth: 0,
    dance: 0,
    typed: 0,
    fade: 1,
  };
  const timeline = gsap.timeline({ paused: true });
  timeline
    .to(
      state,
      { x: 930, y: 810, angle: 90, duration: timing.impact, ease: "power1.in" },
      0,
    )
    .to(state, { y: 795, duration: 0.12, ease: "power2.out" }, timing.impact)
    .to(
      state,
      { y: 810, duration: 0.18, ease: "power1.in" },
      timing.impact + 0.12,
    )
    .to(
      state,
      {
        growth: 1,
        y: 580,
        duration: timing.launch - timing.grow,
        ease: "power2.in",
      },
      timing.grow,
    )
    .to(
      state,
      { y: 270, duration: timing.apex - timing.launch, ease: "power2.out" },
      timing.launch,
    )
    .to(
      state,
      { y: 630, duration: timing.land - timing.apex, ease: "power2.in" },
      timing.apex,
    )
    .to(
      state,
      { x: 1105, duration: timing.land - timing.launch, ease: "sine.inOut" },
      timing.launch,
    )
    .to(
      state,
      { angle: 360, duration: 0.85, ease: "power1.out" },
      timing.launch,
    )
    .to(state, { typed: 1, duration: 0.45, ease: "none" }, timing.launch)
    .to(
      state,
      {
        dance: Math.PI * 16,
        duration: timing.exit - timing.dance,
        ease: "none",
      },
      timing.dance,
    )
    .to(
      state,
      { fade: 0, duration: timing.end - timing.exit, ease: "power1.in" },
      timing.exit,
    );
  return { state, timeline, timing };
}
