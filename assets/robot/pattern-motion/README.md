# Animated whole-robot patterns

The hosted overlay keeps the approved `joints-20261031` PNG motion. Additional
rest-space surface maps let any selected catalog texture follow the moving
geometry, with a common physical scale across the CRT case, body and limbs.
The profile surface and chest display remain clear. No 3D model or Three.js
is loaded by the overlay.

Blender's separate `RA_PatternMaps` scene evaluates bevels on owned copies of
the isolated source; original meshes and actions remain unchanged. Four maps
per pose store high/low rest coordinates (12 bits per axis), face normals and
white baked lighting with an occlusion mask. A WebGL 2 raster pass samples
these images with the picker's triplanar projection and 50–200% scale. It is
drawn onto the existing 2D canvas before the live face and chest content.

The 108 run-in, 60 idle and 74 run-out poses share the original camera and
60 fps clock. Half-resolution maps use nearest-neighbor sampling; never apply
lossy compression or linear resizing to encoded coordinates. The maps add
about 15 MB compressed and 155 MiB GPU texture storage. Upload bitmaps close
immediately; pattern textures have an eight-entry cache. No backend rendering,
paid API, extra Twitch call or new dependency is needed. Unpatterned alerts
do not load maps or create a WebGL context. Failed assets or graphics context
loss report an overlay error.

Rebuild: `scripts/blender/prepare_pattern_maps.py`, then
`scripts/blender/render_pattern_maps.py` with namespace `ra_pattern_proof=False`.
The existing authorized Blender SCP destination is unchanged. Retain incoming
ZIPs here before `python3 scripts/pack-pattern-motion.py`. Runtime sheets live
in `website-staging/overlay/pattern-motion/`. Raw archives and review media
stay local and are excluded from the static deployment.

Tests cover production frame/camera bounds, lossless PNG atlas dimensions,
selection validation, scale limits and real award → webhook → overlay delivery.
`scripts/qa/pattern-alerts.cjs` exercises fresh playback/cleanup with Green
Marble, Gold Foil and Black and White Graphic Marble plus 50/100/200% sizing.
Review captures and robot-only motion were inspected and sent to the PC.
Actual OBS playback and a real two-channel event test remain pending.
Existing Jampre CC BY 4.0 and catalog texture credits still apply.
