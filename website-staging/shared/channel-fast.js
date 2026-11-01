import { API_BASE } from "../config.js?v=shared-service-1";
import { createAlertCard } from "../shared/alert-card.js";
import { CARD_PRESETS, CARD_PRESET_ORDER } from "../shared/card-presets.js";
const $ = (s) => document.querySelector(s),
  base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin),
  dimensions = {
    "720p": [1280, 720],
    "1080p": [1920, 1080],
    "1440p": [2560, 1440],
  };
let channelId,
  followAllowed = false,
  settings = {
    resolution: "1080p",
    preset: "03",
    theme: "default",
    events: ["sub", "resub", "gift", "cheer"],
    games: [],
  },
  connected = false;
function feedback(text) {
  $("#setup-feedback").textContent = text;
}
async function api(path, options = {}) {
  const r = await fetch(new URL(path, base), {
    credentials: "include",
    signal: AbortSignal.timeout(12000),
    ...options,
  });
  if (!r.ok)
    throw new Error(
      r.status === 401
        ? "Please log in with Twitch first."
        : r.status === 403
          ? "Connect your streamer channel to continue."
          : r.status === 409
            ? "No overlay is connected yet. Add the browser source in OBS, then try again."
            : r.status === 429
              ? "Please wait a few seconds before testing again."
              : "Could not complete that request. Please try again.",
    );
  return r.json();
}
async function action(button, text, work) {
  if (button.disabled) return;
  const old = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = text;
  feedback(text);
  try {
    await work();
  } catch (e) {
    feedback(e.message);
  } finally {
    button.textContent = old;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}
const isDashboard = location.pathname.includes("/dashboard/");
function step(n) {
  if (isDashboard) {
    for (let i = 1; i <= 4; i++)
      $(`#step-${i}`).hidden = !connected
        ? i !== 1
        : i === 1 || (i === 3 && n !== 3);
    return;
  }
  for (let i = 1; i <= 4; i++) {
    $(`#step-${i}`).hidden = i !== n;
    const b = $(`[data-step="${i}"]`);
    b.toggleAttribute("aria-current", i === n);
    if (i === n) b.setAttribute("aria-current", "step");
  }
  feedback("");
  $(".setup-steps").scrollIntoView({ block: "start", behavior: "smooth" });
}
for (const b of document.querySelectorAll("[data-step]"))
  b.onclick = () => step(Number(b.dataset.step));
function source() {
  const url = new URL("../overlay/", location.href);
  url.search = new URLSearchParams({
    channel: channelId,
    resolution: settings.resolution,
  });
  $("#source-url").value = url.href;
  const [w, h] = dimensions[settings.resolution];
  $("#obs-width").textContent = w;
  $("#obs-height").textContent = h;
}
for (const radio of document.querySelectorAll('[name="resolution"]'))
  radio.onchange = () => {
    settings.resolution = radio.value;
    source();
    if (connected) scheduleDesignSave();
  };
async function save() {
  await api("api/channel/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}
$("#setup-login").onclick = () => {
  const b = $("#setup-login");
  b.disabled = true;
  b.textContent = "Opening Twitch…";
  feedback("Opening Twitch to connect your channel…");
  location.assign(
    new URL(
      `auth/start?role=streamer&returnTo=${isDashboard ? "dashboard" : "start"}`,
      base,
    ),
  );
};
$("#copy-source").onclick = () =>
  action($("#copy-source"), "Copying…", async () => {
    try {
      await navigator.clipboard.writeText($("#source-url").value);
      feedback("Source URL copied. Paste it into your OBS browser source.");
    } catch {
      $("#source-url").select();
      feedback("Press Ctrl+C (or Cmd+C) to copy the selected URL.");
    }
  });
$("#to-obs").onclick = () =>
  action($("#to-obs"), "Saving…", async () => {
    await save();
    step(3);
  });
$("#to-theme").onclick = () => step(4);
async function test(button) {
  await action(button, "Sending test…", async () => {
    await api("api/channel/test", { method: "POST" });
    feedback(
      "Test sent to your connected OBS source. Test alerts do not award points.",
    );
  });
}
$("#test-source").onclick = () => test($("#test-source"));
$("#test-design").onclick = () =>
  action($("#test-design"), "Saving & sending test…", async () => {
    await save();
    await api("api/channel/test", { method: "POST" });
    feedback("Design saved and test sent to your OBS source.");
  });
function preview() {
  for (const b of document.querySelectorAll("[data-preset]"))
    b.setAttribute(
      "aria-pressed",
      String(settings.preset === b.dataset.preset),
    );
  if (settings.preset === "none") {
    $("#preview-card").replaceChildren();
    $("#design-preview").hidden = true;
    return;
  }
  $("#design-preview").hidden = false;
  const card = createAlertCard({
    type: "cheer",
    bits: 500,
    viewer: { name: "Your viewer" },
    settings: { card: { preset: settings.preset }, theme: settings.theme },
  });
  $("#preview-card").replaceChildren(card);
  fitPreview();
}
function fitPreview() {
  const wrap = $("#design-preview"),
    inner = $("#preview-card"),
    scale = Math.min(1, Math.max(0, (wrap.clientWidth - 30) / 790));
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = "top left";
  wrap.style.height = `${230 * scale + 30}px`;
}
new ResizeObserver(fitPreview).observe($("#design-preview"));
for (const id of [...CARD_PRESET_ORDER, "none"]) {
  const b = document.createElement("button"),
    swatch = document.createElement("i");
  b.type = "button";
  b.dataset.preset = id;
  swatch.style.background =
    id === "none" ? "#777" : CARD_PRESETS[id].colors.accent;
  b.append(
    swatch,
    document.createTextNode(
      id === "none" ? "No alert box" : CARD_PRESETS[id].name,
    ),
  );
  b.onclick = () => {
    settings.preset = id;
    preview();
    scheduleDesignSave();
  };
  $("#design-options").append(b);
}
let saveChain = Promise.resolve(),
  saveRevision = 0;
function scheduleDesignSave() {
  const revision = ++saveRevision,
    snapshot = { ...settings };
  feedback(
    connected ? "Saving design…" : "Connect your channel to save this design.",
  );
  if (!connected) return;
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      await api("api/channel/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      if (revision === saveRevision)
        feedback("Design saved. Your OBS source updates automatically.");
    })
    .catch(() => {
      if (revision === saveRevision)
        feedback("Could not save design. Choose it again to retry.");
    });
}
preview();
function eventControls() {
  const root = $("#event-options");
  if (!root) return;
  root.replaceChildren();
  for (const [id, name] of [
    ["sub", "New sub"],
    ["resub", "Resub"],
    ["gift", "Gift subs"],
    ["cheer", "Cheer"],
    ["follow", "Follow"],
    ["raid", "Raid"],
  ]) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.value = id;
    input.checked = settings.events.includes(id);
    if (id === "follow" && !followAllowed) {
      input.disabled = true;
      label.title = "Reconnect Twitch to enable follow alerts";
    }
    input.onchange = () => {
      settings.events = Array.from(
        root.querySelectorAll("input:checked"),
        (e) => e.value,
      );
      scheduleDesignSave();
    };
    label.append(input, document.createTextNode(" " + name));
    root.append(label);
  }
  if ($("#usual-games")) {
    $("#usual-games").value = settings.games.join(", ");
    $("#usual-games").onchange = () => {
      settings.games = $("#usual-games")
        .value.split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      scheduleDesignSave();
    };
  }
}
try {
  const value = await api("api/channel/settings");
  followAllowed = value.followAllowed === true;
  connected = true;
  channelId = value.channelId;
  settings = { ...settings, ...value.settings };
  $("#channel-status").textContent =
    `Connected as ${value.displayName || "your channel"}.`;
  $("#setup-login").hidden = true;
  for (const b of document.querySelectorAll("[data-step]")) b.disabled = false;
  $(`[name="resolution"][value="${settings.resolution}"]`).checked = true;
  source();
  preview();
  eventControls();
  if ($("#bot-controls")) {
    const box = $("#bot-controls");
    box.hidden = false;
    let channelBot = value.channelBot || {
      enabled: false,
      available: false,
      name: "TrizzeBot",
    };
    const button = document.createElement("button");
    button.id = "connect-channel-bot";
    button.className = "quiet";
    button.type = "button";
    const note = document.createElement("p");
    note.className = "bot-note";
    function botState() {
      button.textContent = channelBot.enabled
        ? "Disconnect TrizzeBot"
        : "Connect TrizzeBot";
      button.setAttribute("aria-pressed", String(channelBot.enabled));
      note.textContent = channelBot.enabled
        ? channelBot.available
          ? "Tier and pattern unlock announcements are on in your chat."
          : "Enabled for your channel. Waiting for the bot service to be authorized."
        : "Add tier and pattern unlock announcements to your chat.";
    }
    button.onclick = () =>
      action(
        button,
        channelBot.enabled ? "Disconnecting…" : "Connecting…",
        async () => {
          channelBot = await api("api/channel/bot", {
            method: channelBot.enabled ? "DELETE" : "POST",
          });
          settings.chatAnnouncements = channelBot.enabled;
          botState();
          feedback(note.textContent);
        },
      ).then(botState);
    botState();
    box.append(button, note);
    if (value.canManageBot) {
      const details = document.createElement("details"),
        summary = document.createElement("summary");
      details.className = "operator-bot";
      summary.textContent = "Service owner setup";
      const text = document.createElement("p");
      text.textContent =
        "One-time bot account authorization for the service. Streamers use Connect TrizzeBot above.";
      const authorize = document.createElement("button");
      authorize.id = "authorize-service-bot";
      authorize.className = "quiet";
      authorize.textContent = value.bot?.connected
        ? "Reauthorize TrizzeBot account"
        : "Authorize TrizzeBot account";
      authorize.onclick = () =>
        location.assign(new URL("auth/start?role=bot", base));
      details.append(summary, text, authorize);
      box.append(details);
    }
  }
  if (!followAllowed) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link-button";
    b.textContent = "Enable follow alerts";
    b.onclick = () =>
      location.assign(
        new URL("auth/start?role=streamer&returnTo=dashboard", base),
      );
    $("#event-options").after(b);
  }
  if ($("#dashboard-status"))
    $("#dashboard-status").textContent =
      `Connected as ${value.displayName || "your channel"}.`;
  step(isDashboard ? 4 : 2);
} catch {
  $("#step-1").hidden = false;
  if ($("#dashboard-status"))
    $("#dashboard-status").textContent =
      "Connect your Twitch channel to manage it here.";
  $("#channel-status").textContent =
    "Log in with the Twitch account you stream from.";
}
$("#dashboard-skeleton")?.remove();
addEventListener("pageshow", () => {
  if (!connected) {
    $("#setup-login").disabled = false;
    $("#setup-login").textContent = "Log in with Twitch ↗";
  }
});
