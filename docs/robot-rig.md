# Robot rig and scene guide

The overlay uses one articulated SVG robot in eight directions: front, front-right, right, back-right, back, back-left, left and front-left. The square CRT contains only the Twitch avatar, framed on all four sides. Front diagonals use upright panels without shear; the avatar keeps its proportions and crops to the visible face. True side and rear views show the monitor casing without an avatar. Boots have separate standing footprints, cuffs, toe caps and soles; side-view toes point in the viewing direction. Narrow mechanical links leave air between armor plates. The current original baseline is angular and modular, with separated armor blocks, recessed square joints and shaded bevels. It has no rounded primitive body parts or shoulder crossbar. The CRT has a thick bezel, deep tapered side housing, ventilation, a recessed rear service cover and connector details. No Foozle artwork or design adaptation is used. The current visible baseline is uniform; viewer customization remains hidden.

## Replacement cosmetics

Cosmetics can replace geometry and materials, including longer arms or legs. They are not limited to decorations. `public/shared/rig-model.js` owns the trusted part registry; `public/shared/robot-rig.js` draws and articulates it. Viewer text is never interpreted as SVG or executable art.

Register code-owned parts with `registerRobotPart({id, slot, dimensions, material, views})`. Dimensions include `upper`, `lower`, `width`, `height` and `hand`, as appropriate for the slot. Materials override named palette colors. Custom artwork supplies a factory for every direction in `DIRECTIONS`. Limb factories return `upper`, `lower` and `hand` SVG elements so the existing shoulder/elbow hierarchy moves the replacement artwork. Equipment is a slot-to-part-ID object passed into `RobotRig` before starting a scene.

Scenes use joint sockets and measured reach rather than a separate baked robot image. The button scene positions the robot using its equipped arm length and solves the press at the shoulder/elbow. Feet determine the ground anchor; meteor landing uses foot sockets. Head attachments inherit the head transform through the crash, launch and rotation. Longer idle arms fold to avoid dragging through the ground. This establishes the replacement contract; extreme future silhouettes still need an art and motion review when added.

Browser verification includes a longer copper arm reaching the button and an equipped hat remaining attached through both scenes. No cosmetic editor or new unlock catalog is exposed in this art pass.

## Scenes and resolution

Settings has an Animation workshop with Meteor and Run + button tests, plus an eight-direction gallery at `/robot-lab/index.html`. Each event can select its animation. Cinematic scenes run for at least twelve seconds so the setup and recognition panel have time to finish. The existing raid parade remains available.

The GSAP meteor storyboard crashes onto an invisible contact surface, lies sideways with its CRT facing the viewer, is pushed up by the growing alert card, rotates in the air, lands upright and dances. See [the storyboard guide](arrival-storyboard.md). The run/button scene uses the same equipped rig.

Choose 1920×1080, 2560×1440 or 3840×2160 in Settings, then manually match the existing OBS browser source dimensions. Settings updates the local preview and size instructions; it cannot change OBS source properties. Keep the same overlay URL. The logical scene scales uniformly to the viewport; no second source is needed.

## Temporary live testing restriction

Ordinary alerts, previews, commands and bot responses remain limited to Twitch IDs `14824099` (Trizze) and `429225647` (itsTrizze). Raid notifications from any channel and the 15-second visual-only chat crowd are exceptions. Display names cannot bypass the ordinary-alert check. Other accounts' saved data is retained. Pending announcements without an allowed owner remain unsent. Offline demo fixtures stay isolated and can still run.

Restart the Node process after backend updates and refresh Settings and the existing OBS browser source. A version mismatch in Settings requests this restart.

## Shared recognition box

Every alert family and both themes use the same logical card bounds: x=710, y=650, width=790, height=230. `public/shared/alert-layout.js` owns this invariant. Simple and raid alerts use the same placement as cinematic scenes; reveal and exit may change opacity but never the box position or size. Legacy position/scale values are retained in stored settings but no longer move or resize this box; their inactive controls are hidden. Canvas resolution uniformly scales the whole composition.

## Angular art pass

`public/shared/robot-art.js` contains the original baseline artwork and shared surface shading. Per-rig gradient IDs prevent conflicts when many robots appear together. Each module uses its own material palette, so replacement parts keep their material and dimensions while the scene continues using the existing joints. Head, torso, upper/lower limbs, hands and boots retain visible separation rather than one continuous outer shell. The eight screen projections stay upright; only front and front-diagonal faces display the avatar. Side and rear views emphasize the CRT tube enclosure and bezel depth. This remains an articulated SVG rig, with painted surface depth rather than a 3D mesh.

## Connected modular joints

The chassis has narrow recessed mechanical links rather than floating armor pieces: neck into torso, waist into pelvis, shoulder/hip mounts, and upper/lower limb rods through elbows, knees, wrists and ankles. These links follow their existing bones, extend with equipped limb lengths and remain when replacement armor factories remove the baseline artwork. Separating the shells preserves cosmetic freedom while keeping the robot structurally connected. Visual reviews must inspect the assembled rig and fresh motion; after twenty failed corrective attempts ask the user for help, or sooner if a design decision is needed.

## Raid crowd and locomotion

The raid card uses the configured alert duration. It then disappears, opening a 15-second visual-only window for chatters. A raid may come from any channel; ordinary alerts, commands and bot replies remain restricted to the two testing accounts. Crowd-only chat from other accounts is not stored as message history or progression and triggers no bot reply. Twitch does not provide a raid attendee roster: chat participants are shown as chatters, not represented as verified raiders.

The server accepts one participation per Twitch ID, up to 128 per raid. At most 24 robots run simultaneously; remaining accepted participants queue. Cached Twitch avatars are used when available; otherwise the application fetches the public profile image with bounded concurrency. Runners disappear after leaving the viewport; colliding robots disappear into short smoke clouds. Remaining robots finish after the input window closes. The offline demo uses synthetic chatters and stays isolated from live progress.

Locomotion phase is based on distance travelled. During stance the planted foot cancels body movement, and the swing foot lifts and returns. The button is left of the fixed card; its hand reaches the cap and a brief press effect reinforces contact. The meteor card grows from nothing without a visible starting line. Decorative icon outlines are removed.
