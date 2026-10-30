# Status before compact — 2026-10-30

## What works now

- Node app with Twitch EventSub WebSocket, SQLite, localhost Settings and one OBS browser-source overlay. Setup was completed by the user. Default/Gaming alert themes and separate Settings light/dark mode are available; 1080p, 1440p and 4K use the same source URL.
- Sub, resub, gift, cheer, follow, raid and `!robot` flows are implemented; a synthetic demo uses separate SQLite data. Commands and demo work without an OpenAI key.
- Original angular, jointed CRT robot has eight views, visible mechanical connections, square avatar screen and replacement-part hooks. Cosmetic rendering is currently disabled. Meteor crash/dance, run/button and raid crowd animations are implemented. Cards share fixed bounds.
- Raid card uses the configured alert duration, then accepts chatters for 15 seconds; some robots collide in smoke, others cross and despawn. Limit: 128 participants, 24 simultaneous robots. Demo uses synthetic participants.
- `npm test` passes **42 tests**. `npm start` runs live; `npm run demo` runs isolated demo; `npm run setup` is private interactive Twitch setup. Browser reviews checked button contact, planted feet, raid timeout/collisions/cleanup and fixed card position.

## What is half done

- Latest raid/crowd changes have isolated demo/browser verification but still need real Twitch and OBS verification. Restart the app and refresh Settings/OBS to load API version `robot-alerts-scenes-11`.
- **Latest requested work is not implemented:** running limbs move too quickly; raid text should default to 3 seconds; text duration should be configurable per animation; add a custom-media animation where the viewer's robot runs in and the streamer's uploaded MP4/WebM/GIF/PNG/JPG appears above the fixed alert box. A preliminary duration change failed a regression check and was reverted; all 42 tests pass after reverting. No upload implementation or gait fix was completed.
- Art and animations need the user's visual feedback. Actual cosmetic selection/rendering is hidden; replacement limbs/materials and sockets are groundwork, not a finished cosmetic catalog.
- CRT resub time capsule, optional LLM styling/theme prompt, viewer page, full cross-install portability and comprehensive first-clip history are unfinished or deferred. The CRT currently displays only the avatar.
- **Repository state:** only `STATUS.md` has been committed; application files remain untracked and need to be tracked and committed before submission.

## Decisions and reasoning

- One modular rig with separate replaceable body parts: future cosmetics can change geometry, limb length and materials. Use an original angular CRT design with shading and visible mechanical connections; the user rejected Foozle inspiration and rounded, floating parts.
- One square CRT displays the Twitch picture; side/rear views show the monitor housing. Uniform baseline robot for now; cosmetics later. No ambient auras; small button feedback and raid collision smoke are allowed.
- Meteor: fall, sideways CRT/profile picture, card grows upward, launch, rotate, land and dance. Button stays left of the card and visibly contacts the hand. Running feet should plant instead of sliding.
- Slow arm and leg movement to match travel speed. Default raid text to 3 seconds, with configurable text durations for each animation. Custom uploaded alerts must prominently show the triggering viewer's robot; future chosen clothing should carry through when cosmetics are implemented.
- The alert text box must stay at the same position and size for every animation; themes affect alert styling, not the robot. Browser source URL stays unchanged when resolution changes.
- Ordinary live alerts/commands/bot replies remain restricted to **Trizze** and **itsTrizze** during testing. Raids from any channel and the subsequent visual-only chat crowd are exceptions; other chatters gain no progress or bot reply from that participation. Twitch does not provide a verified raid attendee list.
- Visually inspect actual rendered results and fresh unseeked motion before reporting completion. Ask the user for help after 20 unsuccessful attempts, or sooner if a design decision is needed or the same issue repeats.

## Open questions for the user

- What file-size and duration limits should apply to uploaded custom alerts? Choose reasonable defaults if no preference is given. Does the latest button/raid animation look right in a real OBS stream?
- When should the two-account testing restriction be lifted? Which cosmetic parts and unlock/equip behavior should be exposed first?
- Resolve the remaining cross-install identity/hosting and time-capsule scope before promising those features for submission.

## Next steps, in priority order

1. Implement and visually review the slower gait, 3-second raid default, per-animation text timing and custom-media upload/animation. Preserve fixed card bounds and show the triggering viewer's rig; validate uploads and keep demo isolated.
2. Restart the app, refresh Settings/OBS, and verify real Twitch events, raid crowd, custom media and cleanup; incorporate user feedback.
3. Track and commit the application and documentation deliberately, excluding secrets and local data; prepare the submission and Twitch demo video. Deadline: **November 2, 2026, 23:00 Sweden**; internal target 22:00. Preserve submitted artifacts after the deadline until results.

## Setup and rules to remember

- Project: `/home/marvin/robot-alerts`; run `npm start` there. Settings: `http://localhost:3210/settings`; OBS source: `http://localhost:3210/overlay`. Twitch OAuth callback: `http://localhost:3211/callback`. If port 3210 is occupied, an older app may be running in another PowerShell/SSH window.
- Broadcaster: **trizze**; bot: **TrizzeBot**; temporary testing viewers: **Trizze** and **itsTrizze**. Do not put IDs, tokens or private credential values in this document.
- To send visual/document files to Windows: `~/bin/send-to-pc "Robot Alerts" [subfolder] <file>...`; destination is `Downloads\Marvin\Robot Alerts`. Never use raw Taildrop/scp or send secrets.
- Never read, print, copy, search or log `.env`, OAuth/API tokens, `~/.codex/auth.json`, SSH keys or other secret files. Application code reads secrets from environment variables; logs mask tokens. Follow repo `AGENTS.md` and the user's machine rules; do not change hooks or config. Do not send chat/email or other messages without explicit authorization.
