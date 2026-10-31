import { RaidScene } from "./raid-scene.js";
import { SpriteScene } from "./sprite-scene.js";
import { localAlertStart } from "/shared/alert-clock.js";
import { placeAlertPanel } from "/shared/alert-layout.js";
import { robot, setAvatar, RobotRig } from "/shared/robot-rig.js";
import { AlertScene, fitCanvas } from "./scenes.js";
import { createAlertCard } from "/shared/alert-card.js";
import { API_VERSION, RESTART_MESSAGE } from "/shared/release.js";
const stage = document.querySelector("#stage"),
  connection = document.querySelector("#connection");
let socket, timer, active, audio, current, scene, rig, idleFrame;
const node = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};
function clear() {
  clearTimeout(timer);
  scene?.stop();
  scene = null;
  cancelAnimationFrame(idleFrame);
  stage.replaceChildren();
  active = null;
  current = null;
  rig = null;
}
function settings(value) {
  const theme = value.theme === "gaming" ? "gaming" : "default";
  stage.dataset.theme = theme;
  stage.style.setProperty("--scale", value.scale || 1);
  const card = stage.querySelector(".alert,.cinematic-scene");
  if (card) {
    card.classList.remove("default", "gaming");
    card.classList.add(theme);
  }
}
function sound(value, type) {
  if (value.sound === "mute" || !value.volume) return;
  try {
    audio ||= new AudioContext();
    if (audio.state !== "running") return;
    const notes =
      type === "cheer"
        ? [392, 523.25, 783.99]
        : type === "raid"
          ? [392, 493.88, 587.33]
          : [523.25, 659.25, 783.99];
    notes.forEach((frequency, i) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain(),
        at = audio.currentTime + i * 0.1;
      osc.type = value.sound === "arcade" ? "triangle" : "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.linearRampToValueAtTime(value.volume * 0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.25);
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start(at);
      osc.stop(at + 0.26);
    });
  } catch {}
}
window.addEventListener("pointerdown", () => {
  try {
    audio ||= new AudioContext();
    audio.resume();
  } catch {}
});
function show(alert) {
  if (!alert || alert.key === active) return;
  clear();
  active = alert.key;
  current = alert;
  settings(alert.settings);
  let remaining =
    (alert.totalDuration || alert.settings.duration) * 1000 -
    (Date.now() - alert.startedAt);
  if (remaining <= 0) return finish(alert.key);
  const theme = alert.settings.theme === "gaming" ? "gaming" : "default";
  const root = node(
    "section",
    `alert ${theme} ${alert.settings.position} ${alert.type === "raid" ? "parade" : "arrival"}`,
  );
  root.dataset.event = alert.type;
  rig = new RobotRig(alert.viewer, { equipment: alert.equipment || {} });
  const robots = node("div", "robot-row");
  const main = node("div", "bot-wrap");
  main.append(rig.svg);
  robots.append(main);
  if (alert.type === "raid")
    for (const viewer of (alert.participants || []).slice(0, 5)) {
      const wrap = node("div", "bot-wrap participant");
      wrap.append(robot(viewer));
      robots.append(wrap);
    }
  root.append(robots);
  const card = createAlertCard(alert);
  root.append(card);
  // The old scenes stay available only if the rendered assets cannot load.
  scene = new SpriteScene(
    stage,
    card,
    alert,
    () => finish(alert.key),
    () => {
      if (active !== alert.key) return;
      scene?.stop();
      if (alert.type === "raid") {
        root.append(card);
        card.classList.add("fixed-alert-card");
        placeAlertPanel(card);
        scene = new RaidScene(stage, root, alert, rig, () => finish(alert.key));
      } else {
        scene = new AlertScene(
          stage,
          rig,
          card,
          alert.animation === "custom" ? "custom" : "run-button",
          alert.startedAt,
          alert,
        );
        scene.root.classList.add(theme);
      }
    },
  );
  let displayed = scene.root;
  if (alert.demo) displayed.append(node("span", "demo-label", "TEST"));
  sound(alert.settings, alert.type);
  timer = setTimeout(
    () => {
      displayed.classList.add("exiting");
      timer = setTimeout(() => finish(alert.key), 250);
    },
    Math.max(0, remaining - 250),
  );
}
function finish(key) {
  clear();
  if (socket?.readyState === WebSocket.OPEN)
    socket.send(JSON.stringify({ kind: "complete", key }));
}
function connect() {
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws?role=overlay`,
  );
  socket.onopen = () => (connection.hidden = true);
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.kind === "state") {
      settings(message.state.settings);
      if (message.state.apiVersion !== API_VERSION) {
        connection.hidden = false;
        connection.textContent = RESTART_MESSAGE;
      }
      if (message.state.current)
        show({
          ...message.state.current,
          startedAt: localAlertStart(message.state.current, {
            serverNow: message.state.serverTime,
          }),
        });
      else clear();
    }
    if (message.kind === "alert")
      show({
        ...message.alert,
        startedAt: localAlertStart(message.alert, { fresh: true }),
      });
    if (message.kind === "idle") clear();
    if (message.kind === "settings") settings(message.settings);
    if (message.kind === "profile" && message.key === active) {
      current.viewer = message.viewer;
      rig?.setViewer(message.viewer);
      scene?.setViewer?.(message.viewer);
    }
    if (
      ["raid-join", "raid-profile"].includes(message.kind) &&
      message.key === active
    )
      scene?.join?.(message.entry);
  };
  socket.onclose = () => {
    connection.textContent = "Robot Alerts reconnecting…";
    connection.hidden = false;
    setTimeout(connect, 2000);
  };
}
const resize = () => fitCanvas(stage, innerWidth, innerHeight);
addEventListener("resize", resize);
resize();
connect();
