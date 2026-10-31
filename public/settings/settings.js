import { staticRobotPreview } from "/overlay/sprite-renderer.js";
import { API_VERSION, RESTART_MESSAGE } from "/shared/release.js";
import {
  CARD_PRESETS,
  CARD_PRESET_ORDER,
  CARD_SYMBOLS,
} from "/shared/card-presets.js";
import { createAlertCard } from "/shared/alert-card.js";
const $ = (selector) => document.querySelector(selector);
let state,
  csrf,
  toastTimer,
  socket,
  dirty = false,
  cardDraft,
  cardEvent = "sub";
const text = (tag, content, className) => {
  const node = document.createElement(tag);
  node.textContent = content;
  if (className) node.className = className;
  return node;
};
function toast(message, error = false) {
  $("#toast").textContent = message;
  $("#toast").classList.toggle("error", error);
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").hidden = true), 4500);
}
async function api(path, value = {}) {
  try {
    if (state && state.apiVersion !== API_VERSION)
      throw new Error(RESTART_MESSAGE);
    csrf ||= (await (await fetch("/api/session")).json()).csrf;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Robot-CSRF": csrf },
      body: JSON.stringify(value),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Could not save that change.");
    return result;
  } catch (error) {
    toast(error.message || "Connection lost. Try again.", true);
    throw error;
  }
}
function crew() {
  const visible =
    state.mode === "demo" ? state.testViewers || state.viewers : state.viewers;
  const target = $("#crew");
  target.replaceChildren();
  $("#crew-count").textContent = String(visible.length).padStart(2, "0");
  for (const viewer of visible.slice(0, 4)) {
    const card = text("article", "", "crew-card"),
      holder = text("div", "", "robot-holder");
    holder.append(staticRobotPreview(viewer));
    card.append(
      holder,
      text("div", viewer.name, "crew-name"),
      text("div", "Default robot", "crew-parts"),
    );
    const button = text("button", `Preview ${viewer.name}`, "preview-robot");
    button.setAttribute("aria-label", `Preview ${viewer.name}'s robot`);
    if (state.mode === "live") {
      button.title = "Preview this viewer in OBS without changing their robot.";
    }
    button.addEventListener("click", () => {
      if (state.mode === "live")
        api("/api/preview/viewer", { id: viewer.id }).catch(() => {});
      else trigger("preview", viewer.id).catch(() => {});
    });
    card.append(button);
    target.append(card);
  }
  demoViewerOptions();
  if (!$("#idle-robot").childNodes.length && visible.length)
    $("#idle-robot").append(
      staticRobotPreview(visible.find((viewer) => viewer.avatar) || visible[0]),
    );
}
function demoViewerOptions() {
  const previous = $("#command-viewer").value;
  $("#command-viewer").replaceChildren();
  const viewers =
    state.testViewers || state.viewers.filter((viewer) => viewer.avatar);
  for (const viewer of viewers) {
    const option = text("option", viewer.name);
    option.value = viewer.id;
    $("#command-viewer").append(option);
  }
  if (viewers.some((v) => v.id === previous))
    $("#command-viewer").value = previous;
  if (!viewers.length) {
    const option = text("option", "Waiting for a Twitch profile…");
    option.value = "";
    $("#command-viewer").append(option);
  }
  $("#test-profile-note").textContent = viewers.some((viewer) =>
    /^\d+$/.test(viewer.id),
  )
    ? "Real cached Twitch pictures. Test events do not change viewer progress."
    : "Offline demo profiles. Connect Twitch to test with real chat profile pictures.";
}
function renderFeed() {
  $("#feed").replaceChildren();
  const visible = state.feed.filter(
    (item) => !["unlock", "demo-unlock"].includes(item.type),
  );
  if (!visible.length)
    $("#feed").append(
      text("p", "Quiet for now. Give a robot its cue.", "empty-feed"),
    );
  for (const item of visible.slice(0, 20)) {
    const row = text("div", "", `feed-item ${item.type}`),
      content = text("div", item.text);
    content.append(
      text(
        "small",
        new Date(item.at).toLocaleTimeString("en", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      ),
    );
    row.append(
      text(
        "span",
        item.type === "unlock" ? "✧" : item.type === "chat" ? "⌁" : "↗",
        "feed-icon",
      ),
      content,
    );
    $("#feed").append(row);
  }
}
function populateSettings() {
  const form = $("#appearance-form");
  for (const key of ["theme", "accent", "sound", "volume"])
    form.elements[key].value = state.settings[key];
  for (const kind of ["robot", "parade", "custom"])
    form.elements[`timing-${kind}`].value = state.settings.textDurations[kind];
  form.elements.showAlertBox.checked = state.settings.showAlertBox !== false;
  mediaStatus();
  loadCardEditor();
  const canvas = state.settings.canvas || { width: 1920, height: 1080 };
  form.elements.canvasSize.value = `${canvas.width}x${canvas.height}`;
  $("#event-settings").replaceChildren();
  for (const type of Object.keys(state.settings.events)) {
    const row = text("div", "", "event-setting");
    const label = text("label", ""),
      checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.settings.events[type];
    checkbox.name = `event-${type}`;
    label.append(
      checkbox,
      text(
        "span",
        type === "preview"
          ? "Chat previews"
          : type[0].toUpperCase() + type.slice(1),
      ),
    );
    const select = document.createElement("select");
    select.name = `animation-${type}`;
    select.setAttribute("aria-label", `${type} animation`);
    for (const [value, name] of type === "raid"
      ? [["robot", "Robot run-in"]]
      : [
          ["robot", "Robot run-in"],
          ["custom", "Robot + custom media"],
        ]) {
      const option = text("option", name);
      option.value = value;
      select.append(option);
    }
    select.value = state.settings.animations[type];
    row.append(label, select);
    $("#event-settings").append(row);
  }
}
function thresholds() {
  $("#thresholds").replaceChildren();
  const metricLabels = {
    months: "Subscription months",
    bits: "Observed cumulative bits",
    streak: "Reported watch streak",
    followDays: "Days following",
    gifts: "Observed gift subs",
  };
  for (const part of state.unlocks) {
    const row = document.createElement("tr"),
      name = text("td", part.name);
    name.append(text("small", part.id));
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "10000000";
    input.value = state.settings.thresholds[part.id];
    input.dataset.part = part.id;
    input.setAttribute("aria-label", `${part.name} threshold`);
    const cell = document.createElement("td");
    cell.append(input);
    row.append(
      name,
      text("td", part.layer),
      text("td", metricLabels[part.metric]),
      cell,
    );
    $("#thresholds").append(row);
  }
}
function connectionStatus() {
  const live = state.mode === "live";
  $("#connection-description").textContent = live
    ? `Broadcaster: ${state.connections.broadcaster}. Bot: ${state.connections.bot}. Test alerts use a separate demo database.`
    : "This workspace uses synthetic demo events. Run npm run setup privately when you are ready to connect Twitch.";
  $("#eventsub-status").textContent = !live
    ? "DEMO MODE · NO TWITCH CONNECTION"
    : state.connections.broadcaster === "Connected" &&
        state.connections.bot === "Connected"
      ? "CONNECTED"
      : "CHECK BROADCASTER / BOT STATUS";
  $("#workspace-label").textContent = live
    ? "Viewer progress"
    : "Demo workspace";
  $("#workspace-status").textContent = live ? "LIVE SQLITE" : "ISOLATED SQLITE";
  $("#setup-steps").hidden = live;
}
function syncTheme() {
  const theme =
    state.settings.theme === "gaming" || state.settings.theme === "arcade"
      ? "gaming"
      : "default";
  document.body.dataset.theme = theme;
  for (const button of document.querySelectorAll("button[data-theme]"))
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
}
function render() {
  crew();
  renderFeed();
  populateSettings();
  thresholds();
  playback(state.running);
  queueCount(state.queued);
  connectionStatus();
  syncTheme();
  const live = state.mode === "live";
  $("#mode-tag").textContent = live ? "LIVE TWITCH" : "SYNTHETIC DEMO";
  $("#sidebar-mode").textContent = live ? "Live workspace" : "Demo workspace";
  $("#replay").title =
    "Play synthetic alerts in the preview and OBS. Real viewer progress is unchanged.";
  document.querySelector(".test-foot > span").textContent = live
    ? "Synthetic tests also appear in OBS. Real progress stays unchanged."
    : "Simulated events. Real personality.";
  $("#restart-notice").hidden = state.apiVersion === API_VERSION;
  $("#restart-message").textContent = RESTART_MESSAGE;
}
function playback(running) {
  state.running = running;
  $("#replay").textContent = running
    ? "■ Stop demo replay"
    : "▶ Play the demo";
}
function queueCount(count = 0) {
  $("#queue-count").textContent =
    `${count} alert${count === 1 ? "" : "s"} waiting`;
}
const indexes = {
  "demo-iris": 0,
  "demo-nova": 1,
  "demo-peach": 2,
  "demo-moss": 3,
};
async function trigger(type, id) {
  const selected = id || $("#command-viewer").value;
  await api("/api/demo/event", {
    type,
    viewer: indexes[selected] || 0,
    ...(/^\d+$/.test(selected) ? { sourceViewerId: selected } : {}),
  });
  toast("Test alert queued.");
}
function tab(name) {
  const details = {
    overview: [
      "Control room",
      "Your community, in character.",
      "A familiar face. A little personality. A robot that’s entirely theirs.",
    ],
    appearance: [
      "Look & feel",
      "Set the scene.",
      "Your stream has a personality. Your alerts should, too.",
    ],
    progression: [
      "Earned parts",
      "Built by being here.",
      "Little milestones. Lasting character. Nothing in a shopping cart.",
    ],
    connection: [
      "Connections",
      "A little closer to your crew.",
      "Local by default. Personal by design.",
    ],
  };
  for (const node of document.querySelectorAll(".tab-panel"))
    node.hidden = node.id !== name;
  for (const node of document.querySelectorAll(".nav"))
    node.classList.toggle("active", node.dataset.tab === name);
  $("#page-name").textContent = details[name][0];
  $("#page-title").textContent = details[name][1];
  $("#page-description").textContent = details[name][2];
  resize();
}
function resize() {
  const width = $("#preview-screen").clientWidth,
    canvas = state?.settings?.canvas || { width: 1920, height: 1080 };
  const frame = $("#preview-frame");
  frame.style.width = `${canvas.width}px`;
  frame.style.height = `${canvas.height}px`;
  if (width) frame.style.transform = `scale(${width / canvas.width})`;
  $("#obs-width").textContent = canvas.width;
  $("#obs-height").textContent = canvas.height;
  $("#preview-dimensions").textContent = `${canvas.width} × ${canvas.height}`;
}
async function copyUrl() {
  const url = `${location.origin}/overlay`,
    c = state?.settings?.canvas || { width: 1920, height: 1080 };
  try {
    await navigator.clipboard.writeText(url);
    toast(`OBS URL copied. Set source size to ${c.width} × ${c.height}.`);
  } catch {
    toast(`OBS URL: ${url}`);
  }
}
for (const button of document.querySelectorAll("[data-tab]"))
  button.addEventListener("click", () => tab(button.dataset.tab));
for (const button of document.querySelectorAll("button[data-theme]"))
  button.addEventListener("click", async () => {
    if (!state || button.dataset.theme === state.settings.theme) return;
    try {
      state.settings = await api("/api/settings/theme", {
        theme: button.dataset.theme,
      });
      syncTheme();
      $("#appearance-form").elements.theme.value = state.settings.theme;
      toast(
        `${state.settings.theme === "gaming" ? "Gaming" : "Default"} theme is live in OBS.`,
      );
    } catch {}
  });
for (const button of document.querySelectorAll("[data-event]"))
  button.addEventListener("click", () =>
    trigger(button.dataset.event).catch(() => {}),
  );
for (const button of document.querySelectorAll("[data-scene]"))
  button.addEventListener("click", async () => {
    const selected = $("#command-viewer").value;
    try {
      await api("/api/alerts/clear");
      await api("/api/demo/event", {
        type: "preview",
        animation: button.dataset.scene,
        viewer: indexes[selected] || 0,
        ...(/^\d+$/.test(selected) ? { sourceViewerId: selected } : {}),
      });
    } catch {}
  });
$("#copy-url").addEventListener("click", copyUrl);
$("#obs-copy").addEventListener("click", copyUrl);
$("#overlay-url").textContent = `${location.origin}/overlay`;
$("#replay").addEventListener("click", async () => {
  try {
    await api(state.running ? "/api/demo/stop" : "/api/demo/play");
  } catch {}
});
$("#stop").addEventListener("click", () =>
  api(state.mode === "demo" ? "/api/demo/stop" : "/api/alerts/clear").catch(
    () => {},
  ),
);
$("#command-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await trigger("preview");
  } catch {}
});
function mediaStatus() {
  const type = $("#media-event").value;
  $("#media-status").textContent = state?.settings.customMedia?.[type]
    ? "Media uploaded for this event."
    : "No media uploaded for this event.";
}
$("#media-event").addEventListener("change", mediaStatus);
$("#media-upload").addEventListener("click", async () => {
  try {
    const file = $("#media-file").files[0];
    if (!file) throw new Error("Choose a file first.");
    if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB.");
    csrf ||= (await (await fetch("/api/session")).json()).csrf;
    const res = await fetch("/api/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Robot-CSRF": csrf,
      },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.settings.customMedia[$("#media-event").value] = data.url;
    dirty = true;
    mediaStatus();
    toast("Uploaded locally. Save look & feel to use it.");
  } catch (e) {
    toast(e.message, true);
  }
});
$("#media-remove").addEventListener("click", () => {
  delete state.settings.customMedia[$("#media-event").value];
  dirty = true;
  mediaStatus();
  toast("Save look & feel to remove this media from the event.");
});

const cardSamples = {
  sub: {},
  resub: { months: 12 },
  gift: { gifts: 5 },
  cheer: { bits: 500 },
  raid: { raidSize: 42 },
  follow: {},
  preview: {},
};
for (const id of CARD_PRESET_ORDER) {
  const preset = CARD_PRESETS[id];
  const option = text("option", `${id} · ${preset.name}`);
  option.value = id;
  $("#card-preset").append(option);
}
for (const [id, label] of Object.entries(CARD_SYMBOLS)) {
  const option = text(
    "option",
    id === "event" || id === "uploaded" || id === "none"
      ? label
      : `${label}  ${id}`,
  );
  option.value = id;
  $("#card-symbol").append(option);
}
for (const [key, label] of Object.entries({
  background: "Background",
  text: "General text",
  name: "Viewer name",
  message: "Message",
  accent: "Alert type",
  secondary: "Decoration",
  symbol: "Symbol",
  amount: "Amount value",
  amountUnit: "Amount unit",
})) {
  const row = document.createElement("label"),
    input = document.createElement("input");
  row.append(text("span", label));
  input.type = "color";
  input.dataset.cardColor = key;
  row.append(input);
  $("#card-colors").append(row);
}
function loadCardEditor() {
  cardDraft = structuredClone(state.settings.card);
  cardEvent = $("#card-event").value;
  $("#card-preset").value = cardDraft.preset;
  for (const input of document.querySelectorAll("[data-card-color]"))
    input.value = cardDraft.colors[input.dataset.cardColor];
  loadCardEvent();
}
function saveCardEvent() {
  if (!cardDraft) return;
  cardDraft.events[cardEvent] = {
    ...(cardDraft.events[cardEvent] || {}),
    label: $("#card-label").value,
    detail: $("#card-detail").value,
    amountValue: $("#card-amount-value").value,
    amountUnit: $("#card-amount-unit").value,
    symbol: $("#card-symbol").value,
  };
}
function loadCardEvent() {
  const value = cardDraft.events[cardEvent] || {};
  $("#card-label").value = value.label || "";
  $("#card-detail").value = value.detail || "";
  $("#card-amount-value").value = value.amountValue || "";
  $("#card-amount-unit").value = value.amountUnit || "";
  $("#card-symbol").value = value.symbol || "event";
  $("#card-symbol-status").textContent = value.upload
    ? "A symbol is uploaded for this event."
    : "No symbol uploaded for this event.";
  updateCardPreview();
}
function updateCardPreview() {
  if (!cardDraft) return;
  const alert = {
    type: cardEvent,
    ...cardSamples[cardEvent],
    viewer: { name: "itsTrizze" },
    settings: { card: cardDraft },
  };
  $("#card-preview").replaceChildren(createAlertCard(alert));
}
$("#card-customize").addEventListener("click", () => {
  const fields = $("#card-editor-fields");
  fields.hidden = !fields.hidden;
  $("#card-customize").setAttribute("aria-expanded", String(!fields.hidden));
});
$("#card-preset").addEventListener("change", (e) => {
  saveCardEvent();
  cardDraft.preset = e.target.value;
  cardDraft.colors = structuredClone(CARD_PRESETS[cardDraft.preset].colors);
  for (const input of document.querySelectorAll("[data-card-color]"))
    input.value = cardDraft.colors[input.dataset.cardColor];
  dirty = true;
  updateCardPreview();
});
$("#card-colors").addEventListener("input", (e) => {
  if (!e.target.dataset.cardColor) return;
  cardDraft.colors[e.target.dataset.cardColor] = e.target.value;
  dirty = true;
  updateCardPreview();
});
$("#card-reset-colors").addEventListener("click", () => {
  cardDraft.colors = structuredClone(CARD_PRESETS[cardDraft.preset].colors);
  for (const input of document.querySelectorAll("[data-card-color]"))
    input.value = cardDraft.colors[input.dataset.cardColor];
  dirty = true;
  updateCardPreview();
});
$("#card-event").addEventListener("change", (e) => {
  saveCardEvent();
  cardEvent = e.target.value;
  loadCardEvent();
});
for (const id of [
  "card-label",
  "card-detail",
  "card-amount-value",
  "card-amount-unit",
  "card-symbol",
])
  $("#" + id).addEventListener("input", () => {
    saveCardEvent();
    dirty = true;
    updateCardPreview();
  });
$("#card-symbol-upload").addEventListener("click", async () => {
  try {
    const file = $("#card-symbol-file").files[0];
    if (
      !file ||
      !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
        file.type,
      )
    )
      throw new Error("Choose a PNG, JPG, GIF or WebP image.");
    if (file.size > 25 * 1024 * 1024) throw new Error("File exceeds 25 MB.");
    csrf ||= (await (await fetch("/api/session")).json()).csrf;
    const res = await fetch("/api/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Robot-CSRF": csrf,
      },
      body: file,
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    if (!/^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(result.url))
      throw new Error("Unsupported image.");
    saveCardEvent();
    cardDraft.events[cardEvent].upload = result.url;
    cardDraft.events[cardEvent].symbol = "uploaded";
    $("#card-symbol").value = "uploaded";
    dirty = true;
    loadCardEvent();
    toast("Symbol uploaded. Save look & feel to apply it.");
  } catch (e) {
    toast(e.message, true);
  }
});
$("#card-symbol-remove").addEventListener("click", () => {
  saveCardEvent();
  delete cardDraft.events[cardEvent].upload;
  if (cardDraft.events[cardEvent].symbol === "uploaded")
    cardDraft.events[cardEvent].symbol = "event";
  dirty = true;
  loadCardEvent();
});

$("#appearance-form").addEventListener("input", () => {
  dirty = true;
});
$("#appearance-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget,
    value = structuredClone(state.settings);
  for (const key of ["theme", "accent", "sound"])
    value[key] = form.elements[key].value;
  value.volume = Number(form.elements.volume.value);
  for (const kind of ["robot", "parade", "custom"])
    value.textDurations[kind] = Number(form.elements[`timing-${kind}`].value);
  value.showAlertBox = form.elements.showAlertBox.checked;
  saveCardEvent();
  value.card = structuredClone(cardDraft);
  const [width, height] = form.elements.canvasSize.value.split("x").map(Number);
  value.canvas = { width, height };
  for (const type of Object.keys(value.events)) {
    value.events[type] = form.elements[`event-${type}`].checked;
    value.animations[type] = form.elements[`animation-${type}`].value;
  }
  try {
    state.settings = await api("/api/settings", value);
    dirty = false;
    toast("Look & feel saved. New alerts will use these settings.");
  } catch {}
});
$("#appearance-test").addEventListener("click", async () => {
  if (dirty) return toast("Save your changes before testing them.");
  tab("overview");
  await trigger("preview");
});
$("#save-thresholds").addEventListener("click", async () => {
  const values = structuredClone(state.settings);
  for (const input of document.querySelectorAll("[data-part]")) {
    const value = Number(input.value);
    if (!Number.isSafeInteger(value) || value < 1 || value > 10000000)
      return toast(
        "Thresholds must be whole numbers between 1 and 10,000,000.",
        true,
      );
    values.thresholds[input.dataset.part] = value;
  }
  try {
    state.settings = await api("/api/settings", values);
    toast("Thresholds saved. Viewers are checked on their next interaction.");
  } catch {}
});
$("#reset-demo").addEventListener("click", async () => {
  if (
    !confirm(
      "Reset all synthetic demo robots and earned parts? Live data is unaffected.",
    )
  )
    return;
  try {
    await api("/api/demo/reset");
    toast("Demo progress reset.");
  } catch {}
});
function connect() {
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?role=settings`,
  );
  socket.onopen = () =>
    ($("#socket-status").textContent = "Workshop connected");
  socket.onclose = () => {
    $("#socket-status").textContent = "Reconnecting";
    setTimeout(connect, 2000);
  };
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.kind === "state") {
      state = message.state;
      render();
      resize();
    }
    if (message.kind === "feed") {
      state.feed = message.feed;
      renderFeed();
    }
    if (message.kind === "viewers") {
      state.viewers = message.viewers;
      crew();
    }
    if (message.kind === "demo-viewers") {
      state.demoViewers = message.viewers;
      demoViewerOptions();
    }
    if (message.kind === "test-viewers") {
      state.testViewers = message.viewers;
      demoViewerOptions();
    }
    if (message.kind === "settings") {
      state.settings = message.settings;
      syncTheme();
      resize();
      if (!dirty) populateSettings();
      else $("#appearance-form").elements.theme.value = state.settings.theme;
    }
    if (message.kind === "replay") playback(message.running);
    if (message.kind === "connection") {
      state.connections = message.connections;
      connectionStatus();
    }
    if (message.kind === "queue") queueCount(message.queued);
    if (message.kind === "alert") {
      $("#idle-robot").style.opacity = "0";
      $("#idle-message").style.opacity = "0";
      queueCount(message.queued);
    }
    if (message.kind === "idle") {
      $("#idle-robot").style.opacity = ".93";
      $("#idle-message").style.opacity = "1";
      queueCount(message.queued);
    }
    if (message.kind === "overflow")
      toast(`${message.count} alerts summarized during this burst.`);
  };
}
function colorMode(mode) {
  document.body.dataset.colorMode = mode;
  $("#color-mode-toggle").textContent =
    mode === "light" ? "Dark mode" : "Light mode";
  $("#color-mode-toggle").setAttribute(
    "aria-label",
    `Switch settings to ${mode === "light" ? "dark" : "light"} mode`,
  );
  try {
    localStorage.setItem("robot-alerts-color-mode", mode);
  } catch {}
}
let initialMode = "dark";
try {
  if (localStorage.getItem("robot-alerts-color-mode") === "light")
    initialMode = "light";
} catch {}
colorMode(initialMode);
$("#color-mode-toggle").addEventListener("click", () =>
  colorMode(document.body.dataset.colorMode === "dark" ? "light" : "dark"),
);
new ResizeObserver(resize).observe($("#preview-screen"));
window.addEventListener("resize", resize);
connect();
