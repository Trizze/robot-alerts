# Robot Alerts specification

Updated 2026-10-31. This is the requested direction, not a claim that the new renderer or Blender motion set is implemented. Existing application behavior remains in place until the new path is proven end to end.

## Terminal bot authorization — 2026-11-02

One-time bot-account authorization happens only through the owner's marvin terminal: `npm run setup:bot`. No service-owner controls appear on the public site. The private CLI issues a bounded, hashed ten-minute OAuth state; the owner opens the printed Twitch authorization link as TrizzeBot in any browser, without a Robot Alerts website session. The existing HTTPS callback verifies the single-use state, configured bot login and minimum chat scope, and saves credentials encrypted. It neither logs the bot into the picker nor creates a viewer/streamer session. Channel-level Connect/Disconnect continues to control only that streamer's announcements. Failed/replayed/expired/replaced setup cannot replace bot credentials; status is checked from the terminal, not through public endpoints.

## Channel bot and landing-page refinement — 2026-11-01

Connect TrizzeBot is a per-streamer opt-in to unlock announcements in that streamer's channel. One-time service bot OAuth is separate and runs through `npm run setup:bot` in the owner's terminal. Default announcements off; points accrue regardless, connect never replays old unlocks or posts a welcome, and disconnect blocks future sends including token-refresh retries. Only the dedicated channel-bot endpoint changes this preference; ordinary design saves preserve it.

The brand uses a transparent CRT header icon, a dark rounded favicon and a soft lavender wordmark. Links have no underlines and use color, hover/focus or button shapes. The landing robot preview is shorter and balanced against the copy. Its demo opens in a large viewport-bounded player and uses a closer center crop enlarged from the existing 16:9 footage (960×540 crop from 1280×720, encoded back to 1280×720); the two original full-frame demos are retained.

## Current implementation and decisions — 2026-11-01

The shared hosted service and static picker supersede the earlier local-only plan below. Use the approved default model with one whole-robot pattern. The CRT displays profile pictures only, including cheers and resubs; no SUB/amount/month text. Nine uncategorized card presets plus no panel are configurable per channel. The viewer-selected chest emoji/emote is separate from CRT content.

Pages share five navigation links (no Get Started header tab), fixed header alignment and a compact viewport shell. Lists/panels scroll internally when content exceeds the screen. The robot picker places size and chest controls beneath the viewer and uses full-height inventory on the right. Pattern cards use small WebP thumbnails, owned-first ordering, descending tiers in All, and NEW markers until first equipped. The pitch has an interactive black-pattern robot and uses the official Twitch default avatar in every example/logo/demo; the demo runs at its full OBS-relative framing above the supplied background. Heavy viewer modules load after the page shell/account request. Horizontal shimmer skeletons indicate loading.

Each channel can enable sub, resub, gift, cheer, follow and raid visuals independently; funding data is still processed for global progression if its visual is off. Follow requires explicit additional broadcaster permission. The public directory shows verified live channels first, public pictures and self-reported usual categories (falling back to current/last Twitch category, not fabricated history). Live metadata is request-cached, never polled.

Anonymous gift-summary events count only once toward a per-channel anonymous robot pool by default (global mode is configurable). A new randomly ordered catalog skin is selected every ten subs, without attributing points to recipients or inventing the hidden donor. Pattern/tier unlocks produce one combined chat notice per award, with all pattern unlocks in that notice and the picker link. No ordinary event or command replies. Hosted bot authorization is operator-only, encrypted, minimum-scope OAuth; delivery is event-driven.

## Product and priorities

Each viewer has a CRT-headed robot identified by Twitch user ID. Its profile picture appears on the monitor, its Twitch name color colors the chest display, and earned parts can personalize it. Chat commands remain the primary customization interface; nothing is bought. The same look and inventory are shared across channels connected to one instance. Sharing across independent self-hosted installs remains unresolved.

Build for the hackathon's equally weighted innovation, impact, implementation and design criteria: make individual recognition visible, keep the streamer setup simple, and show a reliable Twitch-connected demo. The internal submission target is November 2, 2026, 22:00 Europe/Stockholm; the deadline is 23:00. Preserve submitted artifacts unchanged after the deadline until results. Credit licensed third-party material, including Jampre's CRT monitor, as documented in `CREDITS.md` and the Devpost credits draft.

## Architecture

A local Node process provides `/settings`, `/overlay` and local APIs, owns SQLite, connects to Twitch EventSub over WebSocket and uses Helix for permitted profile and progression data. No web framework is required. OBS uses one fixed browser-source URL without credentials. Overlay updates use a local WebSocket. Bind to loopback; validate Host and Origin, and protect settings writes with a same-origin session/CSRF mechanism. Modules read secrets only from `process.env`; never log or expose them.

The browser overlay composites Blender-rendered transparent layers on a canvas. Keep the existing layered PNG/SVG rig and animation implementation as a fallback until the pre-rendered renderer is proven end to end. Default and Gaming themes style the alert, not the robot; settings-page light/dark mode is independent. Support 1920×1080, 2560×1440 and 3840×2160 with the same browser-source URL; OBS dimensions are set manually.

## Robot and motion set

Use the approved default CRT robot, with its convex profile-picture screen and default chest display. Replace the planned interchangeable body cosmetics with patterns applied to the existing head housing, torso, arms and legs. Patterns must not cover the avatar or chest display. One selected pattern applies to the entire robot, including the CRT housing, torso, arms and legs; preserve existing viewer data. Create at least 30 whole-robot patterns, with selected patterns animated or given effects. Unlock thresholds await the user's answer.

The single Blender motion set is run-in (about 1 second), a seamless 1-second idle loop, and run-out (about 0.7 seconds). Idle loops for the configured alert duration. The approved static camera uses this set; the action camera remains deferred.

Pattern motion must remain attached to the moving surface and respect the original part occlusion. The hosted path now uses rest-position, face-normal and neutral-lighting PNG maps exported from owned Blender copies. A WebGL 2 raster pass applies the selected catalog pattern at a common physical scale and composites it onto the existing 2D canvas; no 3D model is loaded by the overlay. Maps follow the same clip clock and exclude the face and chest display. Do not use a screen-space texture that slides across moving parts. Keep the legacy rig as fallback. Existing Space Explorer prototype files remain archived as studies, not the new direction.

## Events and presentation

The alert panel sits to the robot's right and presents the viewer's prominent name, alert type and concise event message. Both camera modes end with the same framing: robot left of center and room for the panel on the right. The streamer can disable the built-in panel and use locally uploaded MP4, WebM, PNG, JPG or GIF media instead; the robot remains standing next to the chosen media in both camera modes. The built-in alert panel is enabled by default. Validate upload type and size, use generated local filenames, prevent path traversal and serve media locally without credentials in URLs.

Chest values apply to the default robot; patterns must not cover the display.

| Event | CRT content | Default torso chest display |
| --- | --- | --- |
| New sub | Viewer face | Tier: T1, T2, T3 or PRIME |
| Resub | Viewer face | Months, e.g. `12 MO` |
| Cheer | Viewer face | Bits, e.g. `500` |
| Gift sub | Gifter's face with gifted viewer's face beside it, when the identity is available | Gift count, e.g. `x5` |
| New follower | Viewer face | `Hi!` |
| Raid | Raiding channel's robot | Raid viewer count |

Use the viewer's name color for the default torso's chest light and a screen flicker appropriate to the event. Preserve identity and attribution when Twitch does not supply an individual gift recipient or other requested data; never invent a person or count. Protect untrusted names, chat and media from execution. Sound is selected per event.

Render separate transparent effects layers with the same camera: confetti for subs, coin rain for cheers and sparks for raids. During idle, a newly unlocked part pops on with a flash from the effects layer. Any effect must remain compatible with the per-viewer robot and not obscure recognition.

A raid uses the **static camera**. Several robots use the same run-in with staggered starts and spacing; the raiding channel's robot leads. Flatten parade robots and cap visible robots at **12**. Twitch does not provide a verified attendee roster: use only identities actually observed, never invent attendees. During the existing testing restriction, all raid sources and visual-only participating chatters remain exceptions; ordinary live alerts, commands and replies are restricted to Trizze and itsTrizze. Do not give other chatters progression or bot replies merely for raid participation. How the existing 15-second chat window maps to the new parade remains to be resolved during implementation.

## Cameras

- **Static:** a fixed camera; robot runs in from the left. Leave the right 45% of the frame empty for the alert box.
- **Action:** the robot runs toward the camera from the distance and grows. At a slight downward angle, the camera orbits 360° around the robot to show its outfit, settles facing it from the front, then eases right so the robot ends left of center in the same final framing as the static camera.

A streamer selects the mode in settings. Raid always uses static. The detailed camera test requests an approximately 2-second orbit and a 0.5-second final ease, so the action entrance is longer than the approximate 1-second general run-in; treat the action camera test timings as the specific requirement and confirm the final timing at checkpoint 1.

## Render and compositing contract

- Render each robot part separately for the same clips and camera. Each layer is VP9 WebM with alpha; if alpha playback in the OBS browser is unreliable, use a PNG sequence. Test both in the actual OBS browser before choosing. Keep PNG sequences as the source of truth.
- Drive every layer of a clip from **one clock** and draw them together onto one canvas each frame. Do not rely on independent video elements staying synchronized. Preload and cache clips. Outside the canvas, animate only transform and opacity; nothing runs while idle.
- Render each layer with every other object as a holdout so occlusion is baked at render time. Confirm that compositing reproduces correct occlusion in the mixing test, including partially transparent edges and dynamic surfaces; do not assume correctness without visual verification.
- Draw the Twitch profile picture in the browser on the CRT. Export the screen quad's four projected corners **per frame, per clip** in `rig.json`, together with whether it faces the camera; hide the picture when it faces away. The approved source screen is slightly convex: verify the four-corner mapping and masking preserve the desired fit and appearance, and flag any needed refinement rather than silently flattening it.
- When the default torso is equipped, draw live event text on its chest UV display from its four projected corners per frame in `rig.json`, using a pixel-style font sized to fit. It shares the viewer's chest color. The display must support future viewer-selected images, such as a smiley, without implementing that feature now.
- Render paint layers neutral grey and tint per viewer in the canvas with multiply. A single render serves every color. Patterns use per-part surface mapping and masks; animated effects must remain synchronized to the shared animation clock.
- `rig.json` records clip names, frame counts, fps, camera mode, per-frame screen corners and, for the default torso, chest corners, screen-facing visibility, and layer information. Use the same camera and centralized render settings for all layers in a clip.

## Data, progression and unlocks

SQLite is keyed by Twitch user ID. Keep viewer identity, cached avatar and name color, a versioned look JSON, earned inventory, channel-specific observations, event receipts for deduplication and channel settings. Evidence and unlocked ownership are transactionally updated; duplicate deliveries must not multiply progress. Unknown data stays unknown. Anonymous gifts must not credit a guessed identity. Never claim lifetime totals or history Twitch cannot provide.

Keep follow dates only if needed for follow-age progression. Audit first-message storage and related code, settings and tests; retain it only if progression needs it, otherwise remove it. Do not keep unused historical chat content.

A viewer earns 1 point per tier-1 sub, 2 per tier-2 sub, 5 per tier-3 sub, and 1 point per 500 bits. Accumulate fractional Bits exactly in integer bit-equivalent units. Tier thresholds are 10, 100, 250, 500 and 1,000 cumulative points. Tier 0 earns no patterns. On entering any tier, immediately draw one unowned pattern from that tier. For Tiers 1–4, draw subsequent unowned patterns at intervals of (next threshold − current threshold) / number of patterns in the tier, until all are owned. In Tier 5, draw subsequent unowned patterns every 100 additional points, until all are owned. Persist each random draw and event atomically; never draw duplicates. A single selected pattern covers the robot. Higher tiers should have increasingly distinctive, pristine designs; worn textures fit the early tiers. The treatment of gifted subscriptions and shared service architecture are awaiting the user's answers.

Points must accumulate by Twitch user ID across every participating channel, including separately hosted installs. Independent local SQLite databases cannot supply this without shared state; do not present local-only totals as globally shared. Persist immutable event IDs for deduplication and never infer anonymous contributors. Twitch sends `channel.subscription.message` only when a viewer shares a resub message, so automatic renewals are not reliably observable from that event. Preserve legacy owned data and validate pattern IDs server-side.

## Twitch and chat

Use EventSub WebSocket for sub, resub, gift, cheer, raid, follow and chat, with deduplication and reconnect handling. `channel.follow` v2 requires the broadcaster token's `moderator:read:followers` scope; verify current subscription and scope in the implementation, and provide a per-streamer follow-alert toggle. Respect Twitch's actual payload and permissions for recipient identity, name colors and progression metrics. Broadcaster and bot are separate accounts configured through the user's private `npm run setup`.

The server resolves a viewer's cached profile, permitted progression and look, then queues an alert snapshot. A bounded queue and timeout prevent a disconnected overlay from blocking subsequent alerts. Acknowledgements and reconnects must not replay old alerts indefinitely. Chat content and viewer names are untrusted.

`!robot` previews the caller's own robot; earned-part listing and equipping use validated IDs and owned inventory. Optional `!robot style <words>` may select owned parameters through an LLM later, but the core commands and demo work without an OpenAI key. Do not send chat history, avatars, files, credentials or tokens to an LLM. The shared viewer page and cross-channel service are in development; the local alert app remains a separate client. The shared service uses signed EventSub webhooks, while the local alert app retains its WebSocket connection.

## Settings and demonstration

Local settings provide theme, event toggles including follow, static/action camera mode, alert timing, thresholds, per-event sound, built-in-panel toggle, uploaded custom media, canvas dimensions, connection status and test controls. Maintain the same OBS source URL. Defaults should be usable without customization. Validate settings and media, and make saved versus unsaved changes clear.

`npm start` starts the application; `npm run demo` uses synthetic events and a separate demo database with no Twitch/OpenAI requests or live progress changes. `npm run setup` is run privately by the user and must not expose credentials. A stranger can clone, configure from `.env.example`, start, and add one browser source. Document any actual installation dependencies honestly.

Acceptance requires real OBS checks of alpha playback and synchronized compositing, transparent backgrounds, current viewer identity/color, both camera modes and matching final framing, each event's screen/chest/effect/sound, per-event durations, custom media with robot visible, static raid and 12-robot limit, and fallback behavior. Also verify hostile input handling, no token leakage, demo isolation, EventSub reconnect and the full test suite. Record a real authorized Twitch interaction for submission.

## Implementation checkpoints

Work through these in order; stop for the user's notes after each requested checkpoint. Do not run checkpoint 1 until the user issues the Blender-work prompt.

1. **Camera tests:** on the plain base robot, make one composite PNG sequence per camera at 30 fps, EEVEE and transparent background. The current wider static test is 1920×720; the action test is 1280×720. These are camera-review sizes, not the final output format. Static: run in from left, stop left of center, two idle loops, run out left. Action: begin at dot size, approach over about 3 seconds with slower, longer airborne steps, ease into idle, orbit 360° in about 2 seconds, face front, ease right for 0.5 seconds, idle, then run out. Ease the start of running and the start and end of turns. Use separate objects and a proper two-step run, arm swing, small skid/overshoot, and a seamless 1-second idle. Send both sequences as ZIPs and a contact sheet sampling every tenth frame. Stop for timing and framing notes.
2. **Layer proof:** with the approved camera, render the run-in with holdouts for head, screen, torso, each arm, both legs and chest. Export `rig.json` with per-frame screen corners/visibility and clip/layer metadata. Encode VP9 alpha, retain PNG sources, and test a single-clock canvas compositor with a profile picture at 1080p and 1440p. Send a recording or frame grabs. Stop.
3. **Color alignment:** render a second run-in set with distinct colors for each part. Build a test page to toggle parts between normal and colored sets during playback; confirm alignment and occlusion. Send frame grabs. Stop.
4. **Chest display:** render a blank chest and export its per-frame corners. Implement and show the event-specific display text on the composited run-in, including tier, months, gift count, bits, follow greeting and raid count. Send each case. Stop.
5. **Full set:** after approval of checkpoints 2–4, render idle and run-out for all base and chest layers in both camera modes at 1920×1080, 60 fps, plus confetti, coin rain and sparks. Update `rig.json`, overlay, follow toggle and tests; retain the fallback PNG rig. Run the full test suite and update `STATUS.md`.

For Blender work, use short idempotent scripts, clear object/action names, the same camera per clip, and centralized render settings. Never delete objects not created by the assistant; ask before editing user-sculpted meshes. If a Blender call fails twice, tell the user rather than retrying. Capture/review results and deliver requested files using the user's authorized transfer workflow. No Blender animation is performed before checkpoint 1 is explicitly started.

## Repository layout

`src/` contains server, Twitch, progression and queue logic; `public/overlay/` and `public/settings/` contain the browser UI; `public/shared/` holds the current fallback rig and shared layout; `public/assets/robot/` holds browser-ready art; `assets/robot/` holds kept Blender sources and renders; `assets/third-party/` holds original licensed assets and their licenses; `test/` contains automated checks; `data/` is ignored local state; `docs/` holds research and submission material. Keep generated assets versioned and do not commit credentials.

## Shared service and whole-robot patterns (latest direction)

A separately hosted service serves participating channels; it is not deployed with the static viewer frontend. Viewers and streamers authenticate with Twitch, and streamers manage only their own channels. Viewers choose one earned pattern for the entire robot, shared between participating streams. Gift summaries credit the gifter once by tier; anonymous gifts and recipient notifications earn nothing. The five thresholds are 10, 100, 250, 500 and 1,000 points; tier entry grants a random pattern, and subsequent draws follow the agreed spacing.

Store only Twitch IDs, display names, points, selected patterns, whole-robot pattern size and chest emoji/emote selection, plus the specifically approved operational records: point-award ledger, seven-day event IDs, hashed sessions lasting at most 30 days, and encrypted streamer credentials. Channel deletion removes its ledger and recomputes totals; viewer deletion removes that viewer's records. No emails, IP addresses, chat content or user agents are retained. The static frontend has a privacy notice and configurable service origin. The existing OBS renderer needs a tested per-frame pattern mapping pipeline before selected patterns can appear in alerts.


## Hosted streamer onboarding (2026-10-31 implementation checkpoint)

`/robot/start/` implements streamer authorization, 720p/1080p/1440p resolution choice, a token-free public browser-source URL, exact OBS dimensions/instructions, a visual test and channel-owned alert-box design settings. The existing nine uncategorized card presets choices affect the alert box only. OBS dimensions are changed manually; saved design changes push to the same source.

The hosted source at `/robot/overlay/?channel=<numeric-id>&resolution=<preset>` reuses the approved PNG/canvas motion. A public read-only SSE connection under the same-origin API carries only display events and design settings. Streams are bounded (3/channel, 200 total), queues cap at 12, animations stop at idle, and heartbeats make no Twitch calls. Channel preference writes/tests require that channel's authenticated streamer session and Origin checks. Tests never award points. This first hosted source handles subscription/resub/gift-summary/cheer events; selected patterns and pattern size now follow the moving robot through all three clips. Hosted follow/raid/chat delivery and hosted uploads remain unfinished. Local overlay code is preserved.


## Hosted site pages and design controls — 2026-11-01

- `/robots/` is the pitch/demo. `/robot/` is Your Robot; separate `/robot/dashboard/`, `/robot/privacy/`, `/robot/start/`, `/robot/streamers/` and `/robot/how-it-works/` destinations share the six-link navigation and the CRT logo/favicon. `/robot/examples/` remains a compatible pitch URL. Use the two approved static deploy scripts; no root-site files are changed.
- The public directory returns only IDs and display names of connected channels; disconnection/revocation removes them. It does not imply a channel is live. Privacy explains public listing; destructive account actions stay hidden behind the existing typed-confirmation dialog on Privacy.
- Pattern sizing is under the viewer, 50–200% in 1% steps. Locked skins remain previewable, with padlocks and a `PREVIEW - LOCKED` watermark projected above the head. A tier-band progress bar and Progress Info dialog explain the existing point/unlock rules. Account, catalog and model arrival order must not prevent saved appearance restoration.
- Streamer Dashboard manages source settings and alert designs; Get Started keeps its four-step guide. Nine designs plus `none` are owner-only settings. Choices save automatically in request order; `none` keeps the robot and hides the card, including when changed during an active alert. Existing OBS URLs remain unchanged.
- Saved chest emoji/emote selections accompany hosted display events. The canvas draws chest content through existing per-frame display corners/masks. GIF frames use the robot clock; dark glass stays `#242833`, with the Twitch avatar retained on the CRT. Failed optional emote loading falls back to event content rather than suppressing the alert.
- Current pitch demo: two 11-second entrances, 1280×720 at 30 fps, Black Marquina Marble + GlitchCat + Neon signal, then Fabric Pattern 07 + PopNemo + Pop arcade. It is rendered from actual overlay components with synthetic events; it is not evidence of real paid Twitch events.
