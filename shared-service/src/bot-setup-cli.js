// Only the owner runs this through authenticated server administration.
// Credentials are consumed from the container environment and never printed.
import { readFileSync } from "node:fs";
import { SharedStore } from "./store.js";
import { startBotSetup, botSetupStatus } from "./bot-setup.js";
import { serviceUrls } from "./urls.js";
let store;
try {
  const input = readFileSync(0, "utf8");
  if (input.length > 1024) throw Error();
  const request = JSON.parse(input);
  const catalog = JSON.parse(
    readFileSync(
      new URL("../../website-staging/patterns/catalog.json", import.meta.url),
    ),
  ).patterns;
  store = new SharedStore(
    process.env.DATA_PATH || "/data/robot-alerts.sqlite",
    {
      encryptionKey: Buffer.from(
        process.env.DATA_ENCRYPTION_KEY || "",
        "base64",
      ),
      patternSeed: Buffer.from(process.env.PATTERN_SEED || "", "base64"),
      catalog,
    },
  );
  if (request.action === "start") {
    const { callback } = serviceUrls(
      process.env.PUBLIC_BASE_URL,
      process.env.FRONTEND_URL,
    );
    const setup = startBotSetup(store),
      url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      redirect_uri: callback,
      response_type: "code",
      scope: "user:write:chat",
      force_verify: "true",
      state: setup.state,
    });
    console.log(
      JSON.stringify({
        url: url.href,
        hash: setup.hash,
        expires: setup.expires,
        bot: process.env.TWITCH_BOT_LOGIN || "TrizzeBot",
      }),
    );
  } else if (request.action === "status")
    console.log(
      JSON.stringify({ status: botSetupStatus(store, request.hash) }),
    );
  else throw Error();
} catch {
  console.error(
    "Bot setup could not run. Check the service version and admin access; no credentials displayed.",
  );
  process.exitCode = 1;
} finally {
  store?.close();
}
