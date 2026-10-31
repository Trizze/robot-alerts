# Hackathon brief: Codex x TwitchCon Hackathon

Everything known about the competition this project is built for. Read before planning or writing code.

## The event
- Name: Codex x TwitchCon Hackathon. Site: https://twitchcon-codex.devpost.com/ (FAQ at /resources, rules at /rules).
- Sponsor: Amazon Advertising LLC (Twitch). Partner: OpenAI. Administrator: Devpost.
- Theme: "Build for streamers and their community on Twitch with OpenAI Codex." Tagline: "Connect streamers and their community."
- Prizes: $25,000 total. 1st $10,000, 2nd $6,000, 3rd $4,000, two runners-up $2,500 each. The top 5 present on the Codex booth stage at TwitchCon San Diego on November 15, 2026, in front of a live crowd.
- About 371 participants had joined by October 25, 2026.

## Dates
- Submission period: October 23, 2026 10:00 PT to November 2, 2026 14:00 PT (23:00 Swedish time). Internal target: submit by 22:00 Swedish time.
- Judging: November 5 to November 15, 2026. Winners announced at TwitchCon on or around November 15.
- After the deadline the repo, video and description must not change until winners are announced. Further work happens in a copy.

## Hard requirements
- The project must be new, created entirely inside the submission period. Starter templates, libraries, frameworks and AI assistants are allowed. Twitch's Example Chatbot guide is an allowed starting point.
- It must be built with OpenAI Codex. The submission includes the Codex session ID of the thread where most of the build happened (`/status` in Codex). Other AI tools may be used for planning; Codex use is part of the Technological Implementation score.
- It must connect to Twitch: chat, overlay, Twitch API, EventSub or an Extension. Extensions are discouraged by the organizers: review takes 5 to 14 days and judges cannot install an unreviewed Extension. This project uses chat, EventSub, Helix API and a browser-source overlay.
- Repository on GitHub, GitLab or Bitbucket with all source, assets and instructions. Public or private; if private, shared with testing@devpost.com.
- Never commit secrets. Use environment variables and document them in the setup instructions.
- Demo video: under 3 minutes, on YouTube (unlisted is fine, private is not). Must show the project working on Twitch and show how it was built with Codex. No third-party trademarks, copyrighted music, other streamers or games without permission.
- Text description explaining features, functionality and how Codex was used.
- All materials in English.
- The project must run as shown in the video. The entrant must be able to explain how it works (winners are verified).

## How it is judged
Stage one is pass/fail: fits the theme and uses Codex. Stage two scores four criteria with equal weight:
1. Innovation/Idea: how creative and novel, how it differs from existing concepts.
2. Potential Impact: how useful or entertaining for streamers and their communities.
3. Technological implementation: how well it is built and how well it uses Codex.
4. Design: is it easy to use and fun to watch.
Ties break in that order. Judges are not required to test anything; many will judge from the video, description and screenshots alone. AI-assisted judging is permitted by the rules.

## Organizer hints
Suggested directions (starting points, "don't just rebuild these"): streamer collaboration; audience participation (they name Twitch Plays, live polls, streamer distractions); content enhancements (dice roller, sports overlay, IRL and science tools). Judges want original ideas. "Go big, or build something small and scrappy over a weekend."

## What won the previous Twitch hackathon (Streamer Tools 2024)
Winners: PixelWars (viewers send named characters to fight another streamer's audience), Stream Together Timeline (built on the then-newest collab feature), tcghud (AI reads trading cards on camera). Runners-up: Lights Out! (one simple gimmick done well), viewer-controlled Minecraft mobs. Patterns rewarded: the newest Twitch primitives, AI visible on screen, every viewer appearing by name, one idea polished.

## Crowded space to stay away from
Walking chatter avatars (Stream Avatars, Evotars, Stream Creatures), marble races, emote explosions, chat-controlled game input, Pokemon-style catch bots, Twitch's own alert variations (viewers pick a variant at checkout, low usage, no ownership). This project differs by ownership and progression: the robot is the viewer's, it is earned over time, and it follows them across channels.

## 2026 Twitch primitives worth using (verify on dev.twitch.tv change log)
- channel.bits.use carries Custom Power-ups and gigantified emotes (April 2026).
- channel.custom_power_up_redemption.add v1 (May 2026).
- channel.chat.notification: Watch Streaks (April 2026), modiversary and shared_chat_modiversary (June 2026), is_source_only for Shared Chat announcements.
- channel.chat.message fragments include a gif object (July 2026).
- Shared Chat: messages carry source_broadcaster_user_id; Send Chat Announcement has for_source_only.
Watch streaks, modiversary and sub tenure are the loyalty signals this project turns into robot parts.

## Project constraints from the entrant
- Solo entrant, Swedish resident, three Twitch channels available for testing and demo footage (trizze, 247trizze, itstrizze). Experienced with Twitch, OBS, overlays and chat bots.
- The build is recorded locally, not streamed. A short demo stream with real chat supplies the "working on Twitch" footage.
- Judges must be able to run it with no special hardware: clone, fill .env, npm start, add one OBS browser source. A fake-event injector lets anyone see the alerts without a live channel.
- Secrets live only in environment variables (loaded from a file outside the repo by the user, never read by the assistant). Logs mask tokens. No tokens in overlay URLs. Twitch chat content and user names are hostile input: escape before rendering, never pass to a shell or a file path.
- The video plan: 0:00 to 0:10 a robot alert fires with a real viewer; 0:10 to 1:00 real chat on stream, unlocks, a raid march, the resub time capsule; 1:00 to 2:00 Codex building it (first prompt, EventSub wiring, a bug it fixed, the injector); 2:00 to 2:40 install in three steps and the settings page; 2:40 to 2:55 what comes next.

## Session IDs
See docs/codex-sessions.md. The main build thread's ID is what gets submitted.
