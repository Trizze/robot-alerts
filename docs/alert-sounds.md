# Alert sounds

In Streamer Dashboard → Alert design → **Sound effects**, select an event and upload an MP3, WAV or OGG, or choose **Use robot entrance mix**. Sound changes save automatically. Use Preview sound to listen; Send test to OBS tests the full entrance. Back to designs restores the style picker. Turn on browser-source audio in OBS and check its mixer volume.

Uploads must be at most 96 KB; the browser also checks duration (15 seconds maximum) and decodes the file before saving. Compress longer recordings to MP3/OGG first. Volume applies to all event sounds; 0 mutes them. Start delay is measured from the animation becoming ready, so slow asset loading cannot make audio start ahead of the robot. Audio stops when the alert ends. No sound is enabled automatically on existing channels.

Audio uploads are public overlay media, stored inside channel settings in SQLite, not credentials or private recordings. The server validates allowed event keys, canonical base64, size and audio magic bytes; it accepts no remote audio URLs. Only the authenticated channel owner can save settings, with the existing Origin check. Disconnecting/deleting the channel removes its settings. Only the current event's sound is attached to an alert, rather than sending every uploaded sound on every event. The larger 800,000-byte request limit applies only to authenticated channel settings; other request limits remain unchanged.

The supplied 4.2-second mix is `website-staging/sounds/robot-arrival.mp3`; the editable master is `assets/audio/robot-arrival.wav`. It combines Kenney CC0 effects: descent at 0.12 s, landing at 0.48 s, door opening at 0.80 s, motor start at 1.05 s, alternating taps at 1.22–2.88 s, and the reveal chime at 2.98 s. Use zero start delay for this entrance mix. The MP3 is about 50 KB and measured peak is -2.4 dBFS.

Rebuild with `python3 scripts/mix-alert-sound.py` (requires installed ffmpeg). Timing and source filenames are in `assets/audio/robot-arrival-timeline.json`. The source effects and original license are retained under `assets/third-party/kenney-interface-sounds/`.

Rollback to an older service validator requires removing the new `sounds`, `soundVolume` and `soundDelay` fields from channel settings first, using the new release; otherwise old validators reject those settings. No database schema migration is involved. Keep the current data volume and encryption keys; never restore an older database over later point awards.
