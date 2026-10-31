# Robot Alerts: Twitch setup, step by step

You need one developer application and two Twitch accounts: your existing streamer account, plus a normal second account that will speak in chat as the bot. No second developer application is needed.

## 1. Create the bot account

On your Windows PC, open a private/incognito browser window. Go to https://www.twitch.tv/ and choose **Sign Up**. Choose the name you want viewers to see in chat, create the account and verify its email. Keep that private window signed into the bot. Use a different email address if Twitch does not allow reuse; do not change your main account's security settings just to reuse its address. The bot does not need to be an Affiliate or Partner.

Your regular browser window should stay signed into your streamer account. No bot password is entered into Robot Alerts: passwords and 2FA codes are entered only on Twitch's own website.

## 2. Prepare the streamer account

In your normal browser window, sign into your streamer account. Make sure its email is verified. Go to Twitch Settings → Security and Privacy and enable two-factor authentication if it is not already enabled. Twitch requires verified email and 2FA for registering applications.

## 3. Register one application

Open https://dev.twitch.tv/console/apps and sign in as the streamer. Choose **Register Your Application** (the direct registration page is https://dev.twitch.tv/console/apps/create).

Fill in:

| Field | Value |
| --- | --- |
| Name | A unique name, for example `Robot Alerts by YourChannel` |
| OAuth Redirect URLs | `http://localhost:3211/callback` — click **Add** after entering it |
| Category | **Chat Bot** |
| Client Type, if shown | **Confidential** — the local server holds a client secret |

Complete the robot check and click **Create**. The name must be unique across Twitch applications, so add your channel name if needed.

Return to Applications and click **Manage** beside the app. Find **Client ID**. Click **New Secret** to generate a Client Secret. Leave this page open. You will paste both values into hidden terminal prompts, never into the assistant conversation. Generating a new secret invalidates a previous one; do not regenerate it casually after setup.

## 4. Connect the Windows browser to the SSH machine

The browser runs on Windows, while the OAuth callback server runs on the machine you SSH into. Open a second PowerShell window on Windows and run:

```powershell
ssh -N -L 3211:127.0.0.1:3211 -L 3210:127.0.0.1:3210 <your-usual-SSH-host>
```

Replace `<your-usual-SSH-host>` (including angle brackets) with the same host or SSH alias you normally use. For example, if your normal command is `ssh marvin@my-linux-pc`, the final argument is `marvin@my-linux-pc`. This command normally stays blank while running: leave it open. No firewall or SSH configuration changes are required. If a port is already forwarded, reuse the existing tunnel instead of starting a duplicate.

Port 3211 is for setup. Port 3210 is for the local dashboard and OBS preview later. If you run everything locally on one PC instead of over SSH, no tunnel is necessary.

## 5. Run the private setup

In your usual SSH terminal:

```bash
cd /home/marvin/robot-alerts
npm run setup
```

The script attempts to open the console when a local desktop browser is available. Over SSH it prints a safe console link for you to open on Windows. It cannot directly open a Windows browser from the remote Linux process.

After the application is registered, press Enter. Type your broadcaster username and the bot username without `https://twitch.tv/`. Paste Client ID into its hidden prompt and press Enter; then paste Client Secret into its hidden prompt and press Enter. Pasted characters are not echoed. The script prints `***` after submission. Ctrl+U clears a hidden input; Ctrl+C cancels setup.

Setup never asks for your Twitch password. It refuses to read or overwrite an existing `.env`. If one exists, stop and move it to a private location yourself before retrying; do not paste its contents into chat.

## 6. Authorize the broadcaster

Open `http://localhost:3211/start/broadcaster` in your regular browser window. Confirm that Twitch shows your streamer account, review the permissions and choose **Authorize**. The permissions allow Robot Alerts to read subscription events, cheers and follower dates. The browser returns to the local setup page. Back in the terminal, wait for **Broadcaster verified**.

## 7. Authorize the bot

When prompted, open `http://localhost:3211/start/bot` in the private/incognito window signed into the bot. Review the account and authorize reading and sending chat messages. Do not open this link in the streamer window. If the wrong account authorizes, the script refuses it; switch accounts and reopen the current local link to retry.

For the selected local WebSocket/user-token design, setup does not request moderation powers, `user:bot` or `channel:bot` cloud-bot grants. It does not post any test chat messages. Subscription and cheer features depend on the channel's actual Twitch eligibility.

## 8. Finish

After both accounts are verified, setup creates a private `.env` with owner-only permissions on Linux. It contains the app credentials and each account's access/refresh credentials. It is ignored by Git. Never open or send it to the assistant, include it in screenshots, or copy it with `send-to-pc`.

`npm start` uses Node's environment loader; application code accesses only `process.env`. OpenAI is optional and left empty. No new npm package is required for setup.

Run `npm start` to connect the live Twitch transport, then open http://localhost:3210/settings on Windows through the tunnel. Live transport is implemented and mock-tested, but still needs your real-channel verification. Both broadcaster and bot should show Connected in the Connections panel. `npm run demo` uses synthetic events without loading `.env` or making Twitch/OpenAI calls; stop the live instance before starting a demo on the same port. Add http://localhost:3210/overlay to OBS as a 1920 × 1080 Browser source.

Refreshed credentials stay in memory; the app never rewrites `.env`. Twitch may rotate refresh credentials. If a restart cannot use the saved grant, privately move the old `.env` aside yourself and run setup again. A persistent secure refresh store is not implemented yet.

## Troubleshooting

- **Windows browser cannot reach localhost:3211:** check that the SSH tunnel is still running and setup is waiting in the terminal. The local callback server exists only during setup.
- **Redirect URI mismatch:** the app must contain exactly `http://localhost:3211/callback`, without a trailing slash. Use HTTP and localhost, not your Linux host's IP.
- **Wrong account:** open the bot link in its private window; the script checks the returned username and ID. Retry the current local link after switching accounts.
- **Twitch rejects authorization:** verify Client Secret and registered redirect URL. Do not paste error bodies containing credentials into chat.
- **Setup times out:** each account authorization has a ten-minute limit. Run setup again; incomplete flows do not create `.env`.
- **Port 3211 is busy:** close the previous setup process/tunnel as appropriate before retrying. Setup binds only to loopback.

## Official references

- Registering an app: https://dev.twitch.tv/docs/authentication/register-app/
- Authorization-code grant: https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow
- Token validation: https://dev.twitch.tv/docs/authentication/validate-tokens/
- Chat/EventSub authentication: https://dev.twitch.tv/docs/chat/authenticating/
- EventSub chat message permissions: https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage

The setup implementation uses authorization codes with a random single-use state. Access tokens travel only through official Twitch HTTPS request bodies/responses and authentication headers; they are never put in overlay or authorization URLs. Credentials are never printed, and remote error bodies are never echoed. The callback removes the temporary code from the displayed URL after success.
