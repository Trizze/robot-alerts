// Run by the operator. Node may populate process.env at startup; this program
// never reads configuration files or prints credentials or Twitch responses.
import { writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { twitchClient } from "../shared-service/src/twitch.js";
import { publicEmotes } from "../shared-service/src/emote-catalog.js";

export async function refreshEmotes(
  twitch,
  output = new URL("../website-staging/global-emotes.json", import.meta.url),
) {
  const emotes = publicEmotes(await twitch.globalEmotes());
  if (!emotes.length) throw new Error("Twitch returned an empty emote list");
  const target =
    output instanceof URL ? output : new URL(output, import.meta.url);
  const temporary = new URL(target.href + ".tmp");
  await writeFile(temporary, JSON.stringify({ emotes }) + "\n", {
    mode: 0o644,
  });
  await rename(temporary, target);
  return emotes.length;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { TWITCH_CLIENT_ID: clientId, TWITCH_CLIENT_SECRET: clientSecret } =
    process.env;
  if (!clientId || !clientSecret) {
    console.error(
      "Set the Twitch client ID and secret in your environment first.",
    );
    process.exitCode = 1;
  } else {
    const twitch = twitchClient({ clientId, clientSecret });
    try {
      const count = await refreshEmotes(twitch);
      console.log(
        `Saved ${count} global emotes to website-staging/global-emotes.json.`,
      );
    } catch {
      console.error(
        "Unable to refresh the Twitch global emote list. Check your app credentials and connection.",
      );
      process.exitCode = 1;
    }
  }
}
