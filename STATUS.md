# Status — 2026-11-01

## What works now

- Shared OAuth, encrypted channel credentials, hashed 30-day sessions, seven-day webhook dedupe, gift-summary-only points, global viewer patterns and per-frame pattern/chest rendering are live. Trizze and itsTrizze verified Get Started and Send test to OBS. Trizze retains the labeled Tier 5 grant (1,000 points); no real paid-event verification yet.
- `/robots/` pitch and refreshed public media are live: interactive black-pattern current model, official Twitch default avatar, 22-second 720p/30 fps demo above the supplied full-overlay background, current-model sample art and default-avatar CRT logo/favicon. Old media URLs were replaced with neutral examples; no remote files deleted.
- Compact picker/dashboard/privacy/how/directory pages are **live** with event switches, per-channel anonymous gift robots, NEW inventory markers, combined unlock notices and verified directory metadata. All public pages return 200; API health returns 204. The approved dry run listed 240 frontend files, then robot-deploy published them after the backend upgrade. No remote files were deleted.
- 114 overall tests pass (`npm test`), including 40 service tests (`node --test shared-service/test/*.test.js`). Browser checks: `node scripts/qa/serve-pages.cjs`, then `node scripts/qa/compact-pages.cjs`, `node scripts/qa/site-pages.cjs`, `node scripts/qa/account-emotes.cjs`, `node scripts/qa/viewer-idle.cjs`. Desktop 1366×768 and phone 390×844 fit their viewport; long inventories/panels scroll internally. Fresh demo playback, rotation, settings autosaves, guarded deletion and all 307 active global emotes pass. Screenshots/video sent to PC.
- Same cold-browser 2-second measurement: picker transfer fell from 14,892,618 to 939,809 bytes (~94%); pitch from 2,675,983 to 997,042 (~63%). First contentful paint measured 192 ms picker / 172 ms pitch / 156 ms dashboard on this connection (not a universal latency guarantee). Inventory thumbnails total 185 KB instead of nearly 15 MB of full textures. Shell/account loads before heavy 3D modules; picker/pitch stop GPU rendering while static. Public pitch poster is 24 KB; video preloads only when opened. Local app restarted with the two authorized viewer IDs and silent command/legacy-part replies.

- Backend `robot-alerts:fast-1` is live (also release). Stopped previous container `robot-alerts-before-fast-20261101` is retained. Row counts survived unchanged: two viewers, two channels, one ledger award and ten sessions. Same DB/private env, loopback port 8100, 192 MiB / 0.5 CPU / log limits; measured idle memory about 14 MiB. No secrets read.

## Owner-run Twitch app switch — ready, not executed

- `npm run setup:hosted-app` privately prompts for the new app Client ID/Secret on marvin and updates only the hosted service through the existing universe-admin gate. Instructions: `docs/switch-twitch-app.md`. Only the owner runs it; no real credentials were entered or inspected. It preserves both data/pattern keys and earned data, rotates the webhook secret to reject old-app deliveries, clears old auth/sessions, and recreates the same image/limits with rollback on failed startup. Streamers and TrizzeBot must reauthorize afterward. Four new preservation/recovery/input tests pass; 118 overall and 40 shared-service tests pass. No live app credentials have been changed.

## Half done

- Hosted bot credentials need the owner's one-time TrizzeBot OAuth after deployment. Only the configured operator may connect it. Hosted live-chat raid crowds, custom-media uploads, Blender effect clips/action camera and real OBS/paid-event progression verification remain unfinished.

## Decisions and reasoning

- Whole-robot patterns replace geometry cosmetics. Shared viewer progress follows participating channels. Points: Tier 1/2/3 subs = 1/2/5; 500 bits = 1; recipients/anonymous donors get no personal points. Tier thresholds 10/100/250/500/1,000; one draw at tier entry, evenly spaced further draws through Tiers 1–4, then every 100 points in Tier 5.
- CRT shows profile images only; event amounts stay on the card/chest. All examples/demos use the official default picture, never the owner's photo. Nine card presets plus no panel; no Gaming/Default categories.
- Five header links, same position across pages; Get Started remains reachable from the dashboard/footer. Compact viewport layout, chest controls below size, full right inventory, owned-first/high-tier-first All ordering, NEW until first owned equip, all globals displayed with no Show More.
- Streamers configure visual event switches and up to five usual categories. Funding events still earn points with visuals off. Live status/avatar/current category come from request-cached Helix data, not inferred history or polling. Follow needs broadcaster moderator:read:followers consent.
- Anonymous gifts use a per-channel pool by default; change to global is supported if requested. Count summary subs once, change randomly ordered skin every ten subs, never invent donor identity. Bot only sends one combined tier/pattern notice per award with the picker link, no normal event or command replies.

## Open questions for the owner

- Pending preference: keep one Anonymous robot per channel (current default), or use one global pool? No response received; channel default is documented.
- After release, connect TrizzeBot once from the operator dashboard; reconnect a streamer only if enabling follow permission.

## Next steps in priority order

1. Owner connects TrizzeBot once from the Trizze operator dashboard; authorize the bot account in Twitch, not the broadcaster account. Optional follow alerts require reconnecting a broadcaster for moderator:read:followers. No tokens are entered in chat.
2. Verify one real paid event across both connected channels, combined announcement, NEW/equip persistence and anonymous display. Refresh existing OBS sources for the picture-only CRT renderer. Synthetic/browser tests do not award real points or send chat.
3. Continue unfinished hosted raid chat crowds/custom uploads only within agreed scope. Finish Devpost credits/demo submission before Nov 2 23:00 Europe/Stockholm (internal target 22:00); preserve submitted artifacts afterward.


## Setup and safety

- Repo `/home/marvin/robot-alerts`. Local: `env ALLOWED_VIEWER_IDS=14824099,429225647 npm start`; settings http://localhost:3210/settings, source /overlay, OAuth 3211. Existing process may own 3210; never start a second one. Hosted picker https://trizze.tv/robot/, pitch /robots/, API /robot/api/. Accounts by username: trizze, itsTrizze, TrizzeBot.
- Static deploy sources `~/robot-site` and `~/robots-site`; only robot-deploy/robots-deploy, dry list first, standing publish permission, no manual SSH/SFTP or remote deletes. Backend Docker transfer only through the explicitly unlocked universe-admin gate. No unrelated sites, Caddy or firewall changes.
- Never read .env, keys, tokens, credential stores or secret logs. Runtime consumes env privately; logs mask credentials with ***. No tokens in URLs or images. Backend data `/srv/robot-alerts/data`; private root-only env `/etc/robot-alerts/robot-alerts.env` (do not inspect). Keep SQLite plus both independent encryption/pattern keys backed up privately.
- Send files with `~/bin/send-to-pc "Robot Alerts" <files>` into Downloads\Marvin\Robot Alerts. Blender is on Windows; use approved MCP/scp helper only for Blender-to-marvin captures, copy retained uploads into assets immediately. No edits to user-sculpted meshes without asking. Inspect actual renders/fresh playback; ask for help after 20 unsuccessful corrections, earlier for repeated failures.
