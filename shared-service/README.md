# Shared Robot Alerts service (work in progress)

This separate service handles Twitch OAuth, points, channel settings and public read-only overlay events. The new `/robot/start/` onboarding flow and `/robot/overlay/` source are implemented and tested locally; production rollout and real-channel verification remain required. Hosted alerts currently support subs, resubs, gift summaries and cheers using the default rendered robot. Saved viewer patterns are not yet mapped onto the animated robot. Revoked channels are marked disconnected and their display streams close.

The service uses SQLite on a persistent volume, encrypted broadcaster credentials, hashed expiring sessions, an award ledger and seven-day EventSub deduplication records. A scheduled hourly cleanup removes expired receipts and sessions. The container assumes a single process and one persistent volume; do not run multiple independent copies against different databases. Configure the reverse proxy to terminate HTTPS and avoid retaining request logs, IP addresses, user agents or authorization query strings. Backups and database access need the same deletion and confidentiality policy.

Only environment variables configure secrets. The two 32-byte keys are supplied as base64; retain them securely across restarts. Changing the encryption key makes existing channel credentials unreadable. Changing the pattern seed or editing the existing catalog can change viewers' earned patterns; catalog evolution requires a migration strategy before launch. The frontend's `config.js` points to the same-origin service path, and the Twitch application needs the service callback registered by the operator. Never deploy this container through the static website deploy script.

The shared webhook requires Twitch broadcaster authorization for `channel:read:subscriptions` and `bits:read`. Gift summary notifications award the gifter; gift-recipient subscription events do not. To avoid crediting gifted renewals, the implementation checks the viewer's current subscription, which is an imperfect snapshot if the subscription changes between the event and the lookup. Twitch's subscription-message event only fires when a viewer chooses to share their resub message, so it does not reliably report every renewal. The points policy must not be presented as comprehensive until that limitation is resolved.

Run tests with `node --test shared-service/test/*.test.js`. Build from the repository root with `docker build -f shared-service/Dockerfile .`; do not publish without a security and live integration review. No production keys are provided or required for the tests.

The website retrieves global Twitch emote names and animation metadata from the service using the app credential. While the backend is offline, the static snapshot (a small sample until the operator refreshes and publishes it) is used; a previously known emote ID remains accepted. Channel-specific emote names are not yet searchable. The chest preview decodes animated GIF frames in browsers supporting ImageDecoder; browsers without it report that animation is unsupported.

## Browser origin and request limits

The frontend and service must share the same HTTPS origin: `https://trizze.tv/robot/` and `https://trizze.tv/robot/api/` are the intended configuration. A reverse proxy strips `/robot/api/` before forwarding to the service. Sessions use `SameSite=Lax; Secure` cookies, and requests that modify data require the exact frontend Origin. Cross-origin deployment is not supported. Protect the public `/auth/start` endpoint with reverse-proxy rate limiting as well as the service’s bounded, expiring in-memory state map.

The service listens on `0.0.0.0` inside its container. Only the reverse proxy should reach port 8080: place the service on a private container network, or bind a published port to host loopback only. Do not expose port 8080 directly to the internet. `/healthz` is a minimal health probe. The Node base image is digest-pinned; update and review the pin deliberately to receive security fixes.

Deleting viewer data ends all sessions for that Twitch user, including any streamer session. It does not disconnect the user’s channel; channel disconnection remains a separate action and removes that channel’s ledger contributions.

## Streamer onboarding and hosted overlay

The static `/robot/start/` flow connects a streamer, saves 720p/1080p/1440p preferences, provides the OBS source URL and previews the existing nine alert-box styles. Settings belong to the authenticated streamer only. The source uses the public numeric channel ID, never a token. `/overlay/<channel-id>/events` sends only public display data over SSE; other channel data and credentials are never exposed. An authenticated, origin-checked test endpoint sends visual test alerts without recording points, limited to one per ten seconds and requiring a connected source.

Streams are capped at three per channel and 200 total, with backpressure disconnects and 25-second heartbeats. The browser queues at most twelve alerts and stops animation when idle. No Twitch polling is introduced. Settings changes push to the existing source. Streamer preferences are removed with their channel. Follow/raid delivery, live chat raid crowds, moving-robot pattern mapping and hosted uploads remain separate work; the local app and its renderer stay available.
