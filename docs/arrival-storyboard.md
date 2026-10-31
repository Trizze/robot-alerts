# Meteor arrival

This replaces and removes the parachute, tree, ropes and canopy. Existing `arrival` and `parachute` settings migrate to `meteor`; the retired name is accepted only for compatibility. The current robot artwork remains a placeholder while the user chooses a third-party asset. See [the asset shortlist](robot-asset-shortlist.md).

`meteor-timeline.js` defines one deterministic GSAP timeline. `meteor-scene.js` applies it to the same articulated rig and its equipped parts. The logical stage remains 1920×1080 and scales uniformly to 1080p, 1440p and 4K browser sources.

| Time | Action |
| --- | --- |
| 0–1.05s | Robot falls diagonally onto an invisible contact surface at y=880. |
| 1.05–1.35s | Brief rigid-body impact/recoil. |
| 1.35–1.85s | Robot lies sideways at the contact surface, facing the viewer; its avatar is visibly rotated 90 degrees. |
| 1.85–2.40s | The card reveals upward from its bottom edge, beginning from nothing. The lying robot is lifted with the rising surface. |
| 2.40–3.40s | Robot launches, rotates from sideways to upright and lands on top of the card. |
| 3.40–3.65s | Landing/recovery beat. |
| 3.65–7.80s | Front-facing dance using the same arm/leg joints. |
| 7.80–8.30s | Fade out. |

The alert box always occupies x=710, y=650, width=790, height=230. Growth reveals it with a bottom-anchored clip inside those fixed bounds, rather than moving or resizing the layout. Every other alert family uses the same bounds. The avatar stays inside the square CRT throughout. There is no canopy, aura, particle system or CRT text replacement.

Unit checks cover sideways impact, growth/push coupling, continuous launch, landing-before-dance, deterministic seeking and old settings migration. Browser checks verify the actual head contacts the invisible surface and rising card, retains the front view while sideways, then lands upright and dances. Normalized card bounds must match at all three supported resolutions.

## Entrance playback and visual review

Fresh WebSocket alerts start on receipt in the browser, independently of server/client clock differences. Reconnects resume from an age measured entirely on the server, using `serverTime`. Scene elapsed time then uses `performance.now()` so a wall-clock adjustment during playback cannot skip motion. The overhead entrance starts at x=800, foot-anchor y=-110 and accelerates over 1.05s with a quadratic ease; it spends more time visibly crossing the screen than the old cubic curve.

Corrective review, attempt 1: observed 34 visible falling frames during real unseeked browser playback with the browser clock deliberately 60s ahead. Inspected rendered top-entry, falling, impact, card-push, airborne, standing and dance frames. The neck/waist and every limb joint have visible mechanical links beneath separate armor; eight-direction screenshots and elbow/knee link overlap checks passed.
