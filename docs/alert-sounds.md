# Alert sounds

Streamer Dashboard → Alert design → **Sound effects** offers five bundled choices: Robot entrance (4.2 s), Arcade win (1.8 s), Soft chime (1.6 s), Power up (1.8 s) and Glitch pop (1.4 s). Choose an event, select a sound and it saves automatically. No sound disables that event's audio. Preview sound listens immediately; both Send test to OBS buttons test the selected event while this panel is open. Tests never award points or send chat.

**Apply to all alerts** copies the selection, including No sound, to all six event types. It does not enable disabled events or change volume/delay. Individual event overrides remain available. Volume is shared; 0 mutes all sounds. Start delay is measured from animation readiness. The Robot entrance mix is timed to the full door/run-in scene and works with zero delay; a notification chime can instead be delayed until the robot arrives.

Custom sound uploads are removed from the website and API. The server accepts only exact paths from the shipped library, rejecting data URLs, external URLs and arbitrary local paths. The player has the same allowlist. Channel-settings requests are back to the normal 64 KB limit. At startup, the owner-approved cleanup removes legacy custom audio from channel settings, preserving built-in choices, other preferences, points, sessions and connections. Reads also filter legacy audio so it cannot be broadcast. This removes the untrusted sound-upload route; it is not a guarantee against every possible software vulnerability.

Enable browser-source audio in OBS. Refresh the existing OBS source once after installing this library update. The source URL is unchanged.

MP3 files are in `website-staging/sounds/`; WAV masters and timing files are in `assets/audio/`. Sources and the original Kenney CC0 license are retained in `assets/third-party/kenney-interface-sounds/`. Rebuild the entrance with `python3 scripts/mix-alert-sound.py`, and the other four with `python3 scripts/mix-sound-library.py` (installed ffmpeg required). No network or paid API is used.

The service image includes the shared library catalog, not the audio masters. The five small MP3s are static assets. No new npm dependencies or background processing are needed. Do not roll back to an older public release that accepts custom audio: that would reopen uploads. Cleanup does not restore removed custom recordings on rollback; points and sessions remain in the existing database.
