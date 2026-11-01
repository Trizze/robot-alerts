# Status — 2026-11-01

## Terminal-only bot setup — 2026-11-02 (LIVE)

- Removed all service-owner controls and metadata from the website. Old `/auth/start?role=bot` now returns 410. Streamer Connect/Disconnect remains per-channel and needs no bot-account login.
- Owner runs `npm run setup:bot` on marvin through the existing unlocked universe-admin gate. It prints the exact Twitch link privately; any browser/private window logged into TrizzeBot works, with no Robot Alerts session. No Client ID/Secret entry, new redirect, tunnel or extra port. Only the owner runs it; agent has not issued a real setup link or inspected its values.
- Server stores only one hashed, ten-minute, single-use setup state. Callback verifies the exact bot account and chat scope; tokens remain encrypted, and no viewer account/session is created. Wrong account, missing scope, denial, expiry, replay and replaced/in-flight setup reject without replacing existing credentials. Status checks are owner-requested local DB reads, never Twitch polling.
- `robot-alerts:terminal-bot-1` is live and healthy with unchanged private env/data/limits. Previous container `robot-alerts-before-terminal-bot-20261102` retained. Trizze remains connected with announcements enabled; bot authorization awaits the owner's terminal completion. Static dry run listed 245 files; published only via robot-deploy.
- 126 overall / 48 shared-service tests pass. Local and deployed browser checks verify owner controls absent even for an owner-shaped API response and streamer controls intact. Existing progression/OBS/media behavior is preserved.

## Current chat setup

- Owner requested and enabled Trizze’s per-channel announcements; confirmed through the live source. Old Trizze announcement backlog cleared; no chat messages sent. TrizzeBot service authorization is absent (checked metadata only, no tokens read). One-time owner action remains: `npm run setup:bot`, then open the printed Twitch link as TrizzeBot in any browser. Streamer Connect/Disconnect remains independent.

## Latest release — streamer bot opt-in and landing polish

- `robot-alerts:chat-1` is live, healthy, same private env/database and limits. Prior stopped container: `robot-alerts-before-chat-20261101`. Data counts unchanged across upgrade: two viewers, two channels, one award, one session. Owner's new app configuration was retained without inspecting it.
- Every streamer can Connect/Disconnect TrizzeBot for their own chat; one-time bot OAuth is now terminal-only (superseding that release's owner controls). Off by default; progress continues while off. Connect does not send a welcome/backlog. Stale design saves cannot undo the preference; disconnect prevents refresh retries. No whispers.
- Landing page: transparent CRT header logo, dark favicon, lavender wordmark, no underlined links, styled CTA buttons, shorter balanced hero viewer and much larger demo dialog with closer video framing. Public files: `18-demo-closeup.mp4`, `18-demo-poster.webp`, v3 logo/favicon. Prior media retained.
- 120 overall / 42 shared-service tests pass, including per-channel ownership, origin checks, silent progress and disable-during-refresh. Local desktop/mobile renders and fresh demo playback inspected; real-browser button tests intercept writes and send no chat. Robot dry run: 244 files; pitch dry run: one file. Both published using only the provided scripts.

## What works now

- Shared OAuth, encrypted channel credentials, hashed 30-day sessions, seven-day webhook dedupe, gift-summary-only points, global viewer patterns and per-frame pattern/chest rendering are live. Trizze and itsTrizze verified Get Started and Send test to OBS. Trizze retains the labeled Tier 5 grant (1,000 points); no real paid-event verification yet.
- `/robots/` pitch and refreshed public media are live: interactive black-pattern current model, official Twitch default avatar, 22-second 720p/30 fps demo above the supplied full-overlay background, current-model sample art and default-avatar CRT logo/favicon. Old media URLs were replaced with neutral examples; no remote files deleted.
- Compact picker/dashboard/privacy/how/directory pages are **live** with event switches, per-channel anonymous gift robots, NEW inventory markers, combined unlock notices and verified directory metadata. All public pages return 200; API health returns 204. The approved dry run listed 240 frontend files, then robot-deploy published them after the backend upgrade. No remote files were deleted.
- 114 overall tests pass (`npm test`), including 40 service tests (`node --test shared-service/test/*.test.js`). Browser checks: `node scripts/qa/serve-pages.cjs`, then `node scripts/qa/compact-pages.cjs`, `node scripts/qa/site-pages.cjs`, `node scripts/qa/account-emotes.cjs`, `node scripts/qa/viewer-idle.cjs`. Desktop 1366×768 and phone 390×844 fit their viewport; long inventories/panels scroll internally. Fresh demo playback, rotation, settings autosaves, guarded deletion and all 307 active global emotes pass. Screenshots/video sent to PC.
- Same cold-browser 2-second measurement: picker transfer fell from 14,892,618 to 939,809 bytes (~94%); pitch from 2,675,983 to 997,042 (~63%). First contentful paint measured 192 ms picker / 172 ms pitch / 156 ms dashboard on this connection (not a universal latency guarantee). Inventory thumbnails total 185 KB instead of nearly 15 MB of full textures. Shell/account loads before heavy 3D modules; picker/pitch stop GPU rendering while static. Public pitch poster is 24 KB; video preloads only when opened. Local app restarted with the two authorized viewer IDs and silent command/legacy-part replies.

- Earlier compact backend checkpoint was fast-1; current service and rollback details are in Latest release above. The same database, private env and resource limits remain in use.

## Owner-run Twitch app switch

- `npm run setup:hosted-app` privately prompts for the new app Client ID/Secret on marvin and updates only the hosted service through the existing universe-admin gate. Instructions: `docs/switch-twitch-app.md`. Only the owner runs it; the agent never enters or inspects credentials. It preserves both data/pattern keys and earned data, rotates the webhook secret to reject old-app deliveries, clears old auth/sessions, and recreates the same image/limits with rollback on failed startup. Streamers and TrizzeBot must reauthorize afterward. Four new preservation/recovery/input tests pass; 118 overall and 40 shared-service tests pass. Owner subsequently reported a bot OAuth account/permission error; service recreation uses the owner’s current private env. Do not rerun app migration just to enable chat announcements.

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

1. Owner runs `npm run setup:bot` once on marvin and opens its Twitch link as TrizzeBot. Optional follow alerts require reconnecting a broadcaster for moderator:read:followers. No tokens are entered in chat.
2. Verify one real paid event across both connected channels, combined announcement, NEW/equip persistence and anonymous display. Refresh existing OBS sources for the picture-only CRT renderer. Synthetic/browser tests do not award real points or send chat.
3. Continue unfinished hosted raid chat crowds/custom uploads only within agreed scope. Finish Devpost credits/demo submission before Nov 2 23:00 Europe/Stockholm (internal target 22:00); preserve submitted artifacts afterward.


## Setup and safety

- Repo `/home/marvin/robot-alerts`. Local: `env ALLOWED_VIEWER_IDS=14824099,429225647 npm start`; settings http://localhost:3210/settings, source /overlay, OAuth 3211. Existing process may own 3210; never start a second one. Hosted picker https://trizze.tv/robot/, pitch /robots/, API /robot/api/. Accounts by username: trizze, itsTrizze, TrizzeBot.
- Static deploy sources `~/robot-site` and `~/robots-site`; only robot-deploy/robots-deploy, dry list first, standing publish permission, no manual SSH/SFTP or remote deletes. Backend Docker transfer only through the explicitly unlocked universe-admin gate. No unrelated sites, Caddy or firewall changes.
- Never read .env, keys, tokens, credential stores or secret logs. Runtime consumes env privately; logs mask credentials with ***. No tokens in URLs or images. Backend data `/srv/robot-alerts/data`; private root-only env `/etc/robot-alerts/robot-alerts.env` (do not inspect). Keep SQLite plus both independent encryption/pattern keys backed up privately.
- Send files with `~/bin/send-to-pc "Robot Alerts" <files>` into Downloads\Marvin\Robot Alerts. Blender is on Windows; use approved MCP/scp helper only for Blender-to-marvin captures, copy retained uploads into assets immediately. No edits to user-sculpted meshes without asking. Inspect actual renders/fresh playback; ask for help after 20 unsuccessful corrections, earlier for repeated failures.
