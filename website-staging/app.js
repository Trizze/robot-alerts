import * as THREE from "three";
import { GLTFLoader } from "./vendor/loaders/GLTFLoader.js";
import { OrbitControls } from "./vendor/controls/OrbitControls.js";
import { API_BASE } from "./config.js?v=shared-service-1";
import { installPatternMapping } from "./pattern-mapping.js?v=2";

const $ = (selector) => document.querySelector(selector);
const status = $("#action-status");
const canvas = $("#robot-view");
const patternScale = { value: 1 },
  patternAspect = { value: 1 };
let chestMaterial,
  chestRequest = 0,
  saveTimer,
  chestAnimation = null,
  selectedEmoji = "";
// A small offline preview while the separate service is not connected.
let emotes = [
  { name: "Kappa", id: "25", animated: false },
  { name: "mcaT", id: "35063", animated: false },
  { name: "TwitchUnity", id: "196892", animated: false },
  { name: "TombRaid", id: "864205", animated: false },
  { name: "twitchRaid", id: "62836", animated: false },
];
const emojis = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😍",
  "🥰",
  "😘",
  "😋",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😜",
  "🤪",
  "🤔",
  "🤗",
  "🤭",
  "🤫",
  "🤖",
  "👾",
  "👻",
  "💀",
  "😺",
  "😸",
  "😹",
  "😻",
  "🙀",
  "😼",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "💖",
  "💯",
  "✨",
  "🔥",
  "⭐",
  "🌟",
  "💫",
  "🎉",
  "🎊",
  "🎮",
  "🏆",
  "👑",
  "🚀",
  "🌈",
  "🌙",
  "☀️",
  "⚡",
  "💎",
  "💰",
  "🍕",
  "🍔",
  "🍿",
  "☕",
  "🐱",
  "🐶",
  "🦊",
  "🐸",
  "🐼",
  "🐙",
  "🦄",
  "🐲",
  "👍",
  "👋",
  "🤘",
  "🫶",
  "👏",
  "💪",
];
let model,
  material,
  screenMaterial,
  viewer = null,
  catalog = [],
  currentFilter = "all",
  previewId = null,
  imageRequest = 0,
  avatarRequest = 0;
const owned = () =>
  new Set((viewer?.owned || []).map((p) => (typeof p === "string" ? p : p.id)));
function service(path) {
  if (!API_BASE) throw new Error("The shared service is not configured yet.");
  const base = new URL(API_BASE.replace(/\/?$/, "/"), location.origin);
  return new URL(path.replace(/^\/+/, ""), base).href;
}
async function request(path, options = {}) {
  const response = await fetch(service(path), {
    credentials: "include",
    signal: AbortSignal.timeout(12000),
    ...options,
  });
  if (!response.ok) {
    const failure = new Error(
      response.status === 401
        ? "Please sign in first."
        : "The service could not complete that request.",
    );
    failure.status = response.status;
    throw failure;
  }
  return response.status === 204 ? null : response.json();
}
function error(message) {
  status.textContent = message;
}
function label(text, className) {
  const e = document.createElement("span");
  e.className = className;
  e.textContent = text;
  return e;
}

let renderer, camera, controls;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(4, 2.5, 5);
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 10;
  controls.target.set(0, 1.35, 0);
  controls.update();
  scene.add(new THREE.HemisphereLight(0xf2eafa, 0x494256, 2.1));
  const key = new THREE.DirectionalLight(0xfff3ea, 2.7);
  key.position.set(4, 6, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc4b1ff, 1.4);
  fill.position.set(-4, 2, -3);
  scene.add(fill);
  new GLTFLoader().load(
    "./models/robot.glb",
    (gltf) => {
      model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model),
        center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      scene.add(model);
      model.traverse((object) => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const m of materials) {
          if (m.name === "RobotPattern") material = m;
          if (m.name === "AvatarSurface") screenMaterial = m;
          if (m.name === "ChestDisplay") chestMaterial = m;
        }
      });
      if (material)
        installPatternMapping(material, patternScale, patternAspect);
      const initialType = viewer?.chestType || "none",
        initialValue = viewer?.chestValue || "";
      renderChest(
        initialType,
        initialValue,
        Boolean(emotes.find((item) => item.id === initialValue)?.animated),
      );
      $("#viewer-status").hidden = true;
      if (viewer?.avatarUrl) showAvatar(viewer.avatarUrl);
      if (previewId) {
        const selected = catalog.find((p) => p.id === previewId);
        if (selected) preview(selected, { save: false });
      }
    },
    undefined,
    () => {
      $("#viewer-status").textContent =
        "The robot preview could not be loaded.";
    },
  );
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  renderer.setAnimationLoop(() => {
    if (chestAnimation) {
      const animation = chestAnimation;
      let time = (performance.now() - animation.started) % animation.total;
      let index = 0;
      while (
        index < animation.frames.length - 1 &&
        time >= animation.durations[index]
      )
        time -= animation.durations[index++];
      if (index !== animation.lastFrame) {
        animation.ctx.fillStyle = "#dfe2eb";
        animation.ctx.fillRect(0, 0, 512, 512);
        animation.ctx.drawImage(animation.frames[index], 48, 48, 416, 416);
        animation.texture.needsUpdate = true;
        animation.lastFrame = index;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  });
  $("#reset-view").addEventListener("click", () => {
    camera.position.set(4, 2.5, 5);
    controls.target.set(0, 1.35, 0);
    controls.update();
  });
} catch {
  $("#viewer-status").textContent =
    "Your browser could not start the 3D preview.";
}

function setChestControls(type) {
  $("#chest-kind").value = type;
  $("#chest-value").hidden = type !== "emote";
  $("#emote-hint").hidden = type !== "emote";
  $("#emoji-picker").hidden = type !== "emoji";
}
function renderEmojiPicker() {
  const grid = $("#emoji-picker");
  grid.replaceChildren();
  for (const symbol of emojis) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "emoji-choice" + (symbol === selectedEmoji ? " selected" : "");
    button.textContent = symbol;
    button.setAttribute("aria-label", `Choose ${symbol}`);
    button.setAttribute("aria-pressed", String(symbol === selectedEmoji));
    button.addEventListener("click", async () => {
      selectedEmoji = symbol;
      renderEmojiPicker();
      if ((await renderChest("emoji", symbol)) !== false)
        saveAppearance({ chestType: "emoji", chestValue: symbol });
    });
    grid.append(button);
  }
}
function refreshEmoteSuggestions() {
  const list = $("#emote-suggestions");
  list.replaceChildren();
  for (const emote of emotes) {
    const option = document.createElement("option");
    option.value = emote.name;
    list.append(option);
  }
}
async function loadEmotes() {
  try {
    const response = await fetch("./global-emotes.json");
    if (response.ok) {
      const snapshot = await response.json();
      if (Array.isArray(snapshot.emotes) && snapshot.emotes.length)
        emotes = snapshot.emotes;
    }
  } catch {
    /* The built-in list remains available. */
  }
  try {
    const result = await request("/api/emotes/global");
    if (Array.isArray(result.emotes) && result.emotes.length)
      emotes = result.emotes;
  } catch {
    /* Use the latest local snapshot. */
  }
  refreshEmoteSuggestions();
}
function findEmote(input) {
  const value = input.trim();
  return (
    emotes.find((item) => item.name === value) ||
    emotes.find((item) => item.name.toLowerCase() === value.toLowerCase()) ||
    emotes.find((item) => item.id === value)
  );
}
async function decodeEmoteAnimation(url) {
  if (typeof ImageDecoder === "undefined")
    throw new Error("Animated emotes are not supported by this browser.");
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("Could not load animated emote.");
  const data = await response.arrayBuffer();
  if (data.byteLength > 5 * 1024 * 1024)
    throw new Error("Animated emote is too large.");
  const decoder = new ImageDecoder({ data, type: "image/gif" }),
    frames = [],
    durations = [];
  try {
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack.frameCount;
    if (!count || count > 300) throw new Error("Unsupported animated emote.");
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        frames.push(await createImageBitmap(image));
        durations.push(Math.max(20, (image.duration || 100000) / 1000));
      } finally {
        image.close();
      }
    }
    return {
      frames,
      durations,
      total: durations.reduce((sum, value) => sum + value, 0),
    };
  } catch (error) {
    for (const frame of frames) frame.close();
    throw error;
  } finally {
    decoder.close();
  }
}
async function renderChest(type = "none", value = "", animated = false) {
  if (!chestMaterial) return false;
  const requestId = ++chestRequest;
  const surface = document.createElement("canvas");
  surface.width = surface.height = 512;
  const ctx = surface.getContext("2d");
  ctx.fillStyle = "#242833";
  ctx.fillRect(0, 0, 512, 512);
  if (type === "emoji" && value) {
    ctx.font = "320px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, 256, 270, 440);
  }
  let animation;
  if (type === "emote" && value) {
    ctx.fillStyle = "#dfe2eb";
    ctx.fillRect(0, 0, 512, 512);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) {
      error("That Twitch emote is invalid.");
      return false;
    }
    try {
      const url = `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(value)}/${animated ? "animated" : "static"}/dark/3.0`;
      if (animated) {
        animation = await decodeEmoteAnimation(url);
        if (requestId !== chestRequest) {
          for (const frame of animation.frames) frame.close();
          return false;
        }
        ctx.drawImage(animation.frames[0], 48, 48, 416, 416);
      } else {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.src = url;
        await image.decode();
        if (requestId !== chestRequest) return false;
        ctx.drawImage(image, 48, 48, 416, 416);
      }
    } catch (failure) {
      error(failure.message || "That Twitch emote could not be loaded.");
      return false;
    }
  }
  if (requestId !== chestRequest) return false;
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  if (chestAnimation) for (const frame of chestAnimation.frames) frame.close();
  chestAnimation = animation
    ? { ...animation, ctx, texture, started: performance.now(), lastFrame: 0 }
    : null;
  const old = chestMaterial.map;
  chestMaterial.map = texture;
  chestMaterial.color.set(0xffffff);
  chestMaterial.needsUpdate = true;
  if (old) old.dispose();
  return true;
}
async function saveAppearance(changes) {
  if (!viewer) {
    error("Previewing only. Sign in to save your appearance.");
    return;
  }
  try {
    await request("/api/me/appearance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    error("Appearance saved.");
  } catch {
    error("Could not save your appearance.");
  }
}
async function showAvatar(url) {
  if (!screenMaterial) return;
  const requestId = ++avatarRequest;
  try {
    const image = await new THREE.TextureLoader().loadAsync(url);
    if (requestId !== avatarRequest) {
      image.dispose();
      return;
    }
    image.colorSpace = THREE.SRGBColorSpace;
    image.flipY = false;
    const old = screenMaterial.map;
    screenMaterial.map = image;
    screenMaterial.color.set(0xffffff);
    screenMaterial.needsUpdate = true;
    if (old) old.dispose();
  } catch {
    /* The rest of the preview still works if Twitch's image is unavailable. */
  }
}
async function preview(pattern, { save = true } = {}) {
  previewId = pattern.id;
  renderInventory();
  if (!material) return;
  const requestId = ++imageRequest;
  try {
    const map = await new THREE.TextureLoader().loadAsync(pattern.image);
    if (requestId !== imageRequest) {
      map.dispose();
      return;
    }
    patternAspect.value = map.image.width / map.image.height;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;
    const old = material.map;
    material.map = map;
    material.color.set(0xffffff);
    material.needsUpdate = true;
    if (old) old.dispose();
    if (!save) return;
    if (!viewer || !owned().has(pattern.id)) {
      error(
        viewer
          ? "Previewing a locked pattern."
          : "Previewing. Sign in to use an earned pattern.",
      );
      return;
    }
    await request("/api/me/pattern", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: pattern.id }),
    });
    viewer.selectedPattern = pattern.id;
    renderInventory();
    error("Pattern saved.");
  } catch {
    error("Could not load or save that pattern. Please try again.");
  }
}
function renderInventory() {
  const container = $("#inventory");
  container.replaceChildren();
  const have = owned();
  const items = catalog.filter(
    (p) => currentFilter === "all" || String(p.tier) === currentFilter,
  );
  $("#pattern-count").textContent = viewer
    ? `${have.size} UNLOCKED`
    : `${catalog.length} PATTERNS`;
  for (const pattern of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pattern" + (pattern.id === previewId ? " selected" : "");
    b.setAttribute(
      "aria-label",
      `${pattern.name}, tier ${pattern.tier}, ${have.has(pattern.id) ? "unlocked" : "locked"}`,
    );
    const img = document.createElement("img");
    img.src = pattern.image;
    img.alt = "";
    img.loading = "lazy";
    b.append(
      img,
      label(pattern.name, "pattern-name"),
      label(
        have.has(pattern.id)
          ? viewer?.selectedPattern === pattern.id
            ? "SELECTED"
            : "UNLOCKED"
          : `TIER ${pattern.tier} · LOCKED`,
        "pattern-meta",
      ),
    );
    b.addEventListener("click", () => preview(pattern));
    container.append(b);
  }
}
function setViewer(data) {
  viewer = data?.viewer || null;
  $("#pattern-scale").value = String(
    Math.round((viewer?.patternScale ?? 1) * 100),
  );
  patternScale.value = Number($("#pattern-scale").value) / 100;
  $("#pattern-scale-value").textContent = `${$("#pattern-scale").value}%`;
  const type = viewer?.chestType || "none",
    value = viewer?.chestValue || "",
    emote = emotes.find((item) => item.id === value);
  selectedEmoji = type === "emoji" ? value : "";
  renderEmojiPicker();
  setChestControls(type);
  $("#chest-value").value = emote?.name || (type === "emote" ? value : "");
  renderChest(type, value, Boolean(emote?.animated));
  if (viewer?.avatarUrl) showAvatar(viewer.avatarUrl);
  else {
    avatarRequest++;
    if (screenMaterial?.map) {
      screenMaterial.map.dispose();
      screenMaterial.map = null;
      screenMaterial.needsUpdate = true;
    }
  }
  const channel = Boolean(data?.channel),
    channelStored = Boolean(data?.channelStored || data?.channel);
  $("#login").hidden = Boolean(viewer);
  $("#logout").hidden = !viewer;
  $("#delete-viewer").hidden = !viewer;
  $("#disconnect").hidden = !channelStored;
  $("#account-status").textContent = viewer
    ? `Signed in as ${viewer.displayName}${channelStored && !channel ? " · Channel disconnected" : ""}`
    : "Not signed in";
  $("#inventory-intro").textContent = viewer
    ? "Choose an unlocked pattern to save it to your robot."
    : "Sign in to see what you’ve earned. You can preview any pattern below.";
  $("#points").replaceChildren(
    document.createTextNode(viewer ? String(viewer.points) + " " : "— "),
    label("POINTS", "small-label"),
  );
  $("#tier").textContent = `TIER ${viewer?.tier ?? "—"}`;
  renderInventory();
  if (viewer?.selectedPattern) {
    const p = catalog.find((x) => x.id === viewer.selectedPattern);
    if (p) preview(p, { save: false });
  }
}
$("#pattern-scale").addEventListener("input", (e) => {
  patternScale.value = Number(e.target.value) / 100;
  $("#pattern-scale-value").textContent = `${e.target.value}%`;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => saveAppearance({ patternScale: patternScale.value }),
    600,
  );
});
renderEmojiPicker();
refreshEmoteSuggestions();
$("#chest-kind").addEventListener("change", (e) => {
  setChestControls(e.target.value);
  if (e.target.value === "none") {
    renderChest();
    saveAppearance({ chestType: "none", chestValue: "" });
  }
});
$("#chest-apply").addEventListener("click", async () => {
  const type = $("#chest-kind").value;
  if (type === "emoji") {
    if (!selectedEmoji) error("Choose an emoji below.");
    else if ((await renderChest("emoji", selectedEmoji)) !== false)
      saveAppearance({ chestType: "emoji", chestValue: selectedEmoji });
    return;
  }
  if (type === "none") {
    if ((await renderChest()) !== false)
      saveAppearance({ chestType: "none", chestValue: "" });
    return;
  }
  const typed = $("#chest-value").value.trim();
  const match =
    findEmote(typed) ||
    (/^(?:\d{1,32}|emotesv2_[A-Za-z0-9_-]{1,70})$/.test(typed)
      ? { name: typed, id: typed, animated: false }
      : null);
  if (!match) {
    error(
      API_BASE
        ? "Emote not found. Try a Twitch global emote name."
        : "Emote not in the preview list. More will be available when the shared service is connected.",
    );
    return;
  }
  $("#chest-value").value = match.name;
  if ((await renderChest("emote", match.id, match.animated)) !== false)
    saveAppearance({ chestType: "emote", chestValue: match.id });
});
$("#chest-value").addEventListener("input", (e) => {
  if (e.isComposing) return;
  const field = e.currentTarget,
    value = field.value;
  const match = emotes.find(
    (item) => item.name.toLowerCase() === value.toLowerCase(),
  );
  if (!match || match.name === value) return;
  const start = field.selectionStart,
    end = field.selectionEnd;
  field.value = match.name;
  if (start !== null && end !== null) field.setSelectionRange(start, end);
});
$("#chest-value").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    $("#chest-apply").click();
  }
});
for (const b of document.querySelectorAll(".filter"))
  b.addEventListener("click", () => {
    currentFilter = b.dataset.tier;
    for (const x of document.querySelectorAll(".filter"))
      x.classList.toggle("active", x === b);
    renderInventory();
  });
$("#login").addEventListener("click", () => {
  try {
    location.assign(service("/auth/start?role=viewer"));
  } catch (e) {
    error(e.message);
  }
});
$("#connect-streamer").addEventListener("click", () => {
  try {
    location.assign(service("/auth/start?role=streamer"));
  } catch (e) {
    error(e.message);
  }
});
$("#logout").addEventListener("click", async () => {
  try {
    await request("/api/session", { method: "DELETE" });
    setViewer(null);
    error("Signed out.");
  } catch (e) {
    error(e.message);
  }
});
$("#delete-viewer").addEventListener("click", async () => {
  if (
    !confirm(
      "Delete your viewer data and earned points? This cannot be undone.",
    )
  )
    return;
  try {
    await request("/api/me", { method: "DELETE" });
    setViewer(null);
    error("Your viewer data was deleted.");
  } catch (e) {
    error(e.message);
  }
});
$("#disconnect").addEventListener("click", async () => {
  if (!confirm("Disconnect your channel and remove its point records?")) return;
  try {
    await request("/api/channel", { method: "DELETE" });
    setViewer(null);
    error("Your channel was disconnected.");
  } catch (e) {
    error(e.message);
  }
});
async function loadAccount() {
  $("#account-status").textContent = "Checking sign-in…";
  try {
    const data = await request("/api/me");
    setViewer(data);
  } catch (failure) {
    setViewer(null);
    if (failure.status !== 401)
      error("Could not check your sign-in. Please refresh and try again.");
  }
}
const accountReady = loadAccount();
try {
  const r = await fetch("./patterns/catalog.json");
  if (!r.ok) throw Error();
  catalog = (await r.json()).patterns;
  renderInventory();
} catch {
  error("The pattern catalog could not be loaded.");
}
void loadEmotes();
await accountReady;
