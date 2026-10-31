import { API_BASE } from "../config.js?v=shared-service-1";
import { SpriteScene } from "./sprite-scene.js";
import { createAlertCard } from "../shared/alert-card.js";
const stage = document.querySelector("#stage"),
  status = document.querySelector("#connection");
const channel = new URLSearchParams(location.search).get("channel");
let current,
  timer,
  settings = { preset: "03", theme: "default" };
const queue = [];
function fit() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  Object.assign(stage.style, {
    width: "1920px",
    height: "1080px",
    transform: `translate(${(innerWidth - 1920 * scale) / 2}px,${(innerHeight - 1080 * scale) / 2}px) scale(${scale})`,
  });
}
addEventListener("resize", fit);
fit();
function clear() {
  clearTimeout(timer);
  current?.stop();
  current = null;
}
function next() {
  clear();
  const message = queue.shift();
  if (!message) return;
  const alert = {
    ...message,
    startedAt: Date.now(),
    textDuration: 6,
    settings: {
      ...settings,
      scale: 1,
      showAlertBox: true,
      card: { preset: settings.preset },
    },
  };
  current = new SpriteScene(stage, createAlertCard(alert), alert, next, () => {
    clear();
    status.hidden = false;
    status.textContent =
      "Robot animation could not load. Refresh this browser source.";
  });
  timer = setTimeout(next, 11000);
}
if (!/^\d{1,32}$/.test(channel || "")) {
  status.textContent = "Set up your source at trizze.tv/robot/start/.";
} else {
  const base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin);
  const stream = new EventSource(new URL(`overlay/${channel}/events`, base));
  stream.onopen = () => {
    status.hidden = true;
  };
  stream.onerror = () => {
    status.hidden = false;
    status.textContent =
      "Robot Alerts reconnecting… Check that your channel is connected.";
  };
  stream.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.kind === "settings") {
        settings = message.settings;
        if (current) {
          current.alert.settings = {
            ...current.alert.settings,
            theme: settings.theme,
            card: { preset: settings.preset },
          };
          current.panel.replaceChildren(createAlertCard(current.alert));
          current.root.classList.toggle("gaming", settings.theme === "gaming");
          current.root.classList.toggle("default", settings.theme !== "gaming");
        }
      }
      if (message.kind === "alert" && queue.length < 12) {
        settings = message.alert.settings;
        queue.push(message.alert);
        if (!current) next();
      }
    } catch {
      status.hidden = false;
      status.textContent = "Robot Alerts received an invalid event.";
    }
  };
  addEventListener("pagehide", () => {
    stream.close();
    clear();
  });
}
