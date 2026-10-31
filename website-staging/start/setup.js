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
  settings = { resolution: "1080p", preset: "03", theme: "default" },
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
function step(n) {
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
  location.assign(new URL("auth/start?role=streamer&returnTo=start", base));
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
  for (const b of document.querySelectorAll("[data-theme]"))
    b.setAttribute("aria-pressed", String(settings.theme === b.dataset.theme));
  for (const b of document.querySelectorAll("[data-preset]"))
    b.setAttribute(
      "aria-pressed",
      String(settings.preset === b.dataset.preset),
    );
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
for (const id of CARD_PRESET_ORDER) {
  const b = document.createElement("button"),
    swatch = document.createElement("i");
  b.type = "button";
  b.dataset.preset = id;
  swatch.style.background = CARD_PRESETS[id].colors.accent;
  b.append(swatch, document.createTextNode(CARD_PRESETS[id].name));
  b.onclick = () => {
    settings.preset = id;
    preview();
    feedback("Preview updated. Save design to apply it to your channel.");
  };
  $("#design-options").append(b);
}
for (const b of document.querySelectorAll("[data-theme]"))
  b.onclick = () => {
    settings.theme = b.dataset.theme;
    settings.preset = settings.theme === "gaming" ? "02" : "03";
    preview();
    feedback("Theme preview updated. Save design to apply it.");
  };
$("#save-design").onclick = () =>
  action($("#save-design"), "Saving design…", async () => {
    await save();
    feedback("Design saved. Your existing OBS source updates automatically.");
    $("#setup-done").textContent =
      "You’re ready. Keep your browser source in OBS, and Robot Alerts will handle incoming events.";
  });
preview();
try {
  const me = await api("api/me");
  if (me.channel && me.streamer) {
    const value = await api("api/channel/settings");
    connected = true;
    channelId = value.channelId;
    settings = value.settings;
    $("#channel-status").textContent = `Connected as ${me.viewer.displayName}.`;
    $("#setup-login").hidden = true;
    for (const b of document.querySelectorAll("[data-step]"))
      b.disabled = false;
    $(`[name="resolution"][value="${settings.resolution}"]`).checked = true;
    source();
    preview();
    step(2);
  } else {
    $("#channel-status").textContent =
      `Signed in as ${me.viewer.displayName}. Connect your streamer channel to continue.`;
  }
} catch {
  $("#channel-status").textContent =
    "Log in with the Twitch account you stream from.";
}
addEventListener("pageshow", () => {
  if (!connected) {
    $("#setup-login").disabled = false;
    $("#setup-login").textContent = "Log in with Twitch ↗";
  }
});
