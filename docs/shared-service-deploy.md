# Robot Alerts shared service: deploy and rollback

Backend only: static picker `https://trizze.tv/robot/`, API
`https://trizze.tv/robot/api/`. No new server or registry. Build locally and
transfer the image to Hetzner.

## Before first start

1. Register Twitch redirect
   `https://trizze.tv/robot/api/auth/callback`.
2. Create root-owned, mode `600` `/etc/robot-alerts/robot-alerts.env` with
   `PUBLIC_BASE_URL=https://trizze.tv/robot/api/`,
   `FRONTEND_URL=https://trizze.tv/robot/`, `PORT=8080`,
   `DATA_PATH=/data/robot-alerts.sqlite`, `TWITCH_CLIENT_ID`,
   `TWITCH_CLIENT_SECRET`, `TWITCH_WEBHOOK_SECRET`, `DATA_ENCRYPTION_KEY`, and
   `PATTERN_SEED`. Generate secrets directly on the server; never put them in
   commands, chat, repo or image. Back up the SQLite file and both independent
   32-byte base64 keys together. Losing the encryption key makes streamer
   credentials unreadable. Streamer OAuth requests `channel:read:subscriptions`
   and `bits:read`.

## Build, transfer and run

The root `.dockerignore` allowlists the context, excluding `.env`, local data
and unrelated code. The image uses Node built-ins only. Its Node base is pinned
by digest and must already be in local Docker. `--pull=false` alone does not
prevent download of a missing base, so inspect it first and stop if absent.

```sh
docker image inspect node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 >/dev/null
docker build --pull=false -t robot-alerts:release -f shared-service/Dockerfile .
docker save robot-alerts:release | ssh <your-server> 'docker load'
```

On the server, create the data directory, then run:

```sh
install -d -o 1000 -g 1000 -m 0750 /srv/robot-alerts/data
docker run -d --name robot-alerts \
  --pull=never \
  --restart unless-stopped \
  --memory=192m --memory-swap=192m --cpus=0.5 \
  --log-driver=json-file --log-opt max-size=5m --log-opt max-file=2 \
  --publish 127.0.0.1:8100:8080 \
  --mount type=bind,src=/srv/robot-alerts/data,dst=/data \
  --env-file /etc/robot-alerts/robot-alerts.env \
  robot-alerts:release
```

The process listens on all interfaces inside the container; only host loopback
publishes it. Never expose 8080/8100 publicly. Twitch is event-driven: no
polling loops; emotes fetch on demand with a one-hour cache and one-minute
failure backoff.

## Caddy and Cloudflare

Put this route inside the existing `trizze.tv` site block, before static-file
and PHP handling:

```caddyfile
handle_path /robot/api/* {
    skip_log
    reverse_proxy 127.0.0.1:8100
}
```

`handle_path` strips `/robot/api`, leaving `/healthz`, `/auth/...`, `/eventsub`
and `/api/...`. On Caddy 2.6, `skip_log` prevents OAuth callback queries from
entering access logs. Validate before reload; keep other routes unchanged.

Responses set `Cache-Control: no-store`; also bypass Cloudflare cache for
`/robot/api/*`. Test the EventSub challenge. No exception is needed unless
Cloudflare challenges/blocks POSTs; if so, exempt only `/robot/api/eventsub`
from the specific blocking phase and keep app signature checks. Free Bot Fight
Mode cannot be skipped by custom rules. See Cloudflare's [feature
interactions](https://developers.cloudflare.com/waf/feature-interoperability/)
and [skip options](https://developers.cloudflare.com/waf/custom-rules/skip/options/).
If using a skip rule, disable its optional matching-request logging.

## Smoke check and rollback

Both health checks should return `204`:

```sh
docker ps --filter name=robot-alerts
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8100/healthz
curl -sS -o /dev/null -w '%{http_code}\n' https://trizze.tv/robot/api/healthz
```

Test EventSub verification and streamer OAuth with a real channel before
calling this production-ready. Do not log IPs, user agents, tokens or OAuth
callback queries.

Before upgrade, retain the old image as `robot-alerts:previous` and back up
SQLite with the service stopped. Roll back by stopping/removing the new
container and running `robot-alerts:previous` with the same options, volume and
env file. Restore the DB only if needed; never remove the data directory or
change either key.

Current release (2026-10-31): onboarding is deployed; `robot-alerts:onboarding`
and `robot-alerts:release` name the new image. The stopped
`robot-alerts-before-onboarding` container retains the previous configuration
for rollback: stop/remove the new container, rename that retained container to
`robot-alerts`, and start it. Keep the same data directory and keys.


## Session refresh release — 2026-11-01

Current image: `robot-alerts:session-emotes-1`, also tagged `robot-alerts:release`.
Built locally from the cached previous release, loaded through the authorized
admin alias, with no registry pull or server build. Previous container:
`robot-alerts-before-session-fix-20261101` (stopped, retained for rollback).
Database, env file, network binding and resource/log limits are unchanged.
Sessions remain in SQLite across restarts; no reauthorization is required.
The picker restores identity without waiting for optional Twitch avatar lookup.
Rollback uses the retained previous container/image with the same persistent
volume and private env file; do not restore an older database over new awards.


## Site pages release — 2026-11-01

Current backend: `robot-alerts:pages-1` (also `release`); retained previous
container: `robot-alerts-before-pages-20261101`. Same persistent database,
private env, loopback binding and resource/log limits. Before rolling back to
the previous validator, switch any No alert box choice to a named design;
the previous release does not recognize the new `none` preset. Do not replace
the database with an older copy and lose later awards.

Static sources/deployments: `~/robot-site` → `/robot/` through `robot-deploy`;
`~/robots-site` → `/robots/` through `robots-deploy`. Dry run each script first.
The owner authorizes subsequent uploads without repeated permission questions.
Both scripts upload only; existing legacy entry points remain for cached pages.
No PHP, credentials or backend files belong in either static directory.
