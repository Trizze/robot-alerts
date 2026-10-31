import { emitKeypressEvents, createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import {
  CONSOLE,
  CALLBACK,
  OAuthSetup,
  SetupError,
  assertNewEnv,
  saveEnv,
  openBrowser,
  normalizeLogin,
  validateCredential,
} from "./setup-lib.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = join(root, ".env");
async function ask(prompt) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  try {
    return await new Promise((resolve, reject) => {
      rl.question(prompt, resolve);
      rl.once("SIGINT", () =>
        reject(new SetupError("Setup cancelled. Nothing was saved.")),
      );
    });
  } finally {
    rl.close();
  }
}
async function hidden(prompt) {
  process.stdout.write(prompt);
  emitKeypressEvents(process.stdin);
  const wasRaw = process.stdin.isRaw;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("keypress", keypress);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write("***\n");
      if (error) reject(error);
      else resolve(value.trim());
    };
    const keypress = (text, key = {}) => {
      if (key.ctrl && ["c", "d"].includes(key.name))
        return finish(new SetupError("Setup cancelled. Nothing was saved."));
      if (key.name === "return" || key.name === "enter") return finish();
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (key.ctrl && key.name === "u") {
        value = "";
        return;
      }
      if (!key.ctrl && !key.meta && text && /^[A-Za-z0-9_-]+$/.test(text))
        value = (value + text).slice(0, 201);
    };
    process.stdin.on("keypress", keypress);
  });
}
async function accountPrompt(label) {
  while (true) {
    try {
      return normalizeLogin(await ask(label));
    } catch (error) {
      if (error.message.startsWith("Setup cancelled")) throw error;
      console.log(error.message);
    }
  }
}
async function credentialPrompt(label) {
  while (true) {
    try {
      return validateCredential(await hidden(label));
    } catch (error) {
      if (error.message.startsWith("Setup cancelled")) throw error;
      console.log(error.message);
    }
  }
}
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new SetupError(
      "Run npm run setup yourself in an interactive terminal. Do not pipe credentials into it.",
    );
  await assertNewEnv(destination);
  console.log("\nROBOT ALERTS · Twitch setup\n");
  console.log(
    "Inputs and tokens stay in this process and your private .env. They are never printed.",
  );
  console.log(
    `Register one Confidential application, category Chat Bot, at ${CONSOLE}`,
  );
  console.log(`Add this exact OAuth redirect URL: ${CALLBACK}`);
  console.log(
    "Use your broadcaster account to own the application; use a second ordinary Twitch account for the bot.",
  );
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) {
    console.log(
      "\nYou are connected over SSH. On Windows, keep this separate PowerShell tunnel open:",
    );
    console.log(
      "ssh -N -L 3211:127.0.0.1:3211 -L 3210:127.0.0.1:3210 <your-usual-SSH-host>",
    );
    console.log(
      "Replace the placeholder with the same host/alias you normally SSH into.",
    );
    console.log(
      "Browser links printed here must be opened on Windows (Ctrl+click or copy/paste).",
    );
  }
  const opened = await openBrowser(CONSOLE);
  if (!opened) console.log(`Open on your PC: ${CONSOLE}`);
  await ask(
    "\nPress Enter once the app is created and its Manage page is open. ",
  );
  const broadcasterLogin = await accountPrompt("Your broadcaster username: ");
  let botLogin = await accountPrompt("Your separate bot username: ");
  while (botLogin === broadcasterLogin) {
    console.log("Use the separate bot account for this two-account setup.");
    botLogin = await accountPrompt("Bot username: ");
  }
  const clientId = await credentialPrompt("Client ID (hidden): ");
  const clientSecret = await credentialPrompt("Client Secret (hidden): ");
  const oauth = new OAuthSetup({ clientId, clientSecret });
  try {
    await oauth.listen();
    console.log(
      "\n1/2 · Broadcaster permissions: subscriptions, bits and follower dates.",
    );
    console.log(
      `In your normal browser window, sign into ${broadcasterLogin}.`,
    );
    const broadcasterWait = oauth.begin("broadcaster", broadcasterLogin);
    const broadcasterLink = "http://localhost:3211/start/broadcaster";
    console.log(`Open: ${broadcasterLink}`);
    void openBrowser(broadcasterLink);
    const broadcaster = await broadcasterWait;
    console.log("Broadcaster verified. Credentials: ***");
    console.log("\n2/2 · Bot permissions: read chat and send chat messages.");
    console.log(`Open a private/incognito window and sign into ${botLogin}.`);
    console.log(
      "Use that private window for the next link, so Twitch does not authorize the broadcaster again.",
    );
    const botWait = oauth.begin("bot", botLogin);
    console.log("Open in that private window: http://localhost:3211/start/bot");
    const bot = await botWait;
    if (bot.userId === broadcaster.userId)
      throw new SetupError(
        "The bot and broadcaster must be different accounts. Nothing was saved.",
      );
    await saveEnv(destination, {
      PORT: "3210",
      TWITCH_CLIENT_ID: clientId,
      TWITCH_CLIENT_SECRET: clientSecret,
      TWITCH_USER_ACCESS_TOKEN: broadcaster.accessToken,
      TWITCH_REFRESH_TOKEN: broadcaster.refreshToken,
      TWITCH_BROADCASTER_IDS: broadcaster.userId,
      TWITCH_BROADCASTER_LOGIN: broadcaster.login,
      TWITCH_BOT_USER_ID: bot.userId,
      TWITCH_BOT_LOGIN: bot.login,
      TWITCH_BOT_ACCESS_TOKEN: bot.accessToken,
      TWITCH_BOT_REFRESH_TOKEN: bot.refreshToken,
      OPENAI_API_KEY: "",
    });
    console.log(
      "\nSetup complete. .env saved with owner-only permissions. Credentials: ***",
    );
    console.log(
      "Never paste .env into chat, commit it, screenshot it or send it to your PC.",
    );
    console.log(
      "The application loads it into process.env at startup. OpenAI is optional and was left empty.",
    );
    console.log(
      "Run npm start to connect Twitch. Live transport still needs a real-channel verification in this build.",
    );
    console.log(
      "Or run npm run demo for isolated synthetic alerts without loading .env.",
    );
  } finally {
    await oauth.close();
  }
}
main().catch((error) => {
  console.error(
    error instanceof SetupError
      ? error.message
      : "Setup could not finish. No credential values were logged.",
  );
  process.exitCode = 1;
});
