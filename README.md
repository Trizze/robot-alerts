# Robot Alerts

Robot Alerts turns Twitch events into on-stream alerts starring a viewer's CRT-headed robot. The local streamer app includes an OBS browser-source overlay, configurable alert cards and a demo that runs without Twitch credentials. The current project is a hackathon work in progress; see the limitations below before relying on it for a live stream.

## Run the local app

Requires Node.js 22.16 or newer. Setup needs a Twitch application and separate broadcaster and bot accounts.

1. Clone the repository and enter its directory.
2. Run `npm run setup` yourself. Follow [the setup walkthrough](docs/twitch-setup.md) to register the Twitch application, authorize the accounts and create your private `.env`. Never share credentials or `.env`.
3. Run `npm start`, then open <http://localhost:3210/settings>. In OBS add one browser source at <http://localhost:3210/overlay>, with a 1920 × 1080 source size.

The local server binds to loopback. If OBS and the application run on different computers, follow the tunnel instructions in the walkthrough. Stop the existing app before starting another instance on the same port.

Run `npm run demo` to replay synthetic alerts without Twitch credentials; demo data is kept separate from live data. Run `npm test` for the automated tests. No OpenAI API key is required.

## Current capabilities

- Sub, resub, gift, cheer, follow and raid alerts, a configurable alert card, a settings page, event timing and optional custom media.
- A layered, Blender-rendered 2D robot in the overlay, with a Twitch profile picture on its CRT screen. The original fallback renderer is retained.
- A 3D viewer and whole-robot pattern previews in `website-staging/`. The separately hosted preview at <https://trizze.tv/robot/> is not connected to the shared service.
- An experimental shared service in `shared-service/` with a points ledger, EventSub webhook verification, Twitch OAuth routes and privacy-oriented storage. See its [README](shared-service/README.md) before attempting deployment.

## Important limitations

- Normal live reactions and bot responses are temporarily restricted to the test accounts Trizze and itsTrizze. Raid visual participation has separate behavior. This restriction must be revisited before a general release.
- Shared Twitch login, cross-channel points and persistent appearance selection have not been tested end to end or deployed. The OBS overlay does not yet render the viewer's selected website pattern or chest image. Pattern preview is not a completed unlock system.
- Real Twitch event and OBS testing is still required for the latest renderer. Twitch's resubscription message event depends on the viewer sharing it, so it cannot reliably report every renewal.
- A small list of Twitch global emotes is available in the disconnected website preview. The full global list requires the shared backend. Animated chest preview depends on browser support and has not been verified with an actual animated Twitch emote.
- This repository includes the runnable art and relevant original asset licenses. Large intermediate animation archives and research renders are kept outside the repository; they are not needed to run the app.

## Credits

The CRT monitor is adapted from Jampre's **Crt Monitor**, and the entrance door from witnessk's **Door with frame**, both under CC BY 4.0. See [CREDITS.md](CREDITS.md) and the license files alongside third-party assets for sources, modifications and other material credits.
