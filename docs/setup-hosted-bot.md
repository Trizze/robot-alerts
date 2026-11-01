# Authorize TrizzeBot from your terminal

On **marvin**, run:

```sh
cd /home/marvin/robot-alerts
npm run setup:bot
```

If the admin gate has expired, run `universe-admin 1` first.

1. The command prints your exact Twitch authorization link. It uses the existing app configuration, so you do not enter a Client ID or Secret.
2. Open that link in **any browser or private window signed into Twitch as TrizzeBot**. You do not need to log into the Robot Alerts website at all.
3. Confirm the Twitch page shows TrizzeBot, then click **Authorize** for chat permission.
4. Return to the terminal and press **Enter**. It confirms success or tells you to retry with the right account.

Links expire after ten minutes and work once. Rerunning setup replaces an unfinished link. A failed attempt preserves any existing bot authorization. Stopping the terminal does not undo a completed browser authorization.

Trizze's channel announcements are already enabled. Streamers use Connect/Disconnect TrizzeBot in their own dashboards; only the operator uses this terminal setup. No whispers, welcome message or test message is sent by setup. A successful authorization allows delivery of eligible real unlock notices in enabled channels.

Do not use the retired Service owner setup on the website. Do not run app migration again or share secrets/callback URLs. Only the owner runs this command; automated tests use synthetic credentials and do not authorize a real account.
