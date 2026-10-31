import { createPixelText } from "./layer-proof/pixel-text.js";
const base = "/overlay/static-motion-60/";
const allowedAvatar =
  /^\/(?:avatars\/\d+\.(?:png|jpg|webp)|assets\/avatars\/[a-zA-Z0-9_-]+\.svg)$/;
const avatars = new Map(),
  textImages = new Map(),
  screenImages = new Map();
const scratch = document.createElement("canvas");
scratch.width = 1920;
scratch.height = 720;
const mask = scratch.getContext("2d");
function image(src) {
  const picture = new Image();
  picture.src = src;
  return picture.decode().then(() => picture);
}
export const motionReady = (async () => {
  const response = await fetch(base + "manifest-sheets.json");
  if (!response.ok) throw new Error("Robot motion assets unavailable");
  const rig = await response.json(),
    images = {};
  [images.door, images.dust, images.doorFront] = await Promise.all([
    image("/overlay/door/opening.png"),
    image("/overlay/door/dust.png"),
    image("/overlay/door/foreground.png"),
  ]);
  await Promise.all(
    Object.entries(rig.clips).flatMap(([clip, data]) =>
      rig.layers.map(async (layer) => {
        if (!data.frames.some((frame) => frame.sheets?.[layer])) return;
        const key = `${clip}/${layer}`;
        images[key] = await image(base + "sheets/" + key + ".png");
      }),
    ),
  );
  return { rig, images };
})();
// Avoid unhandled rejection if a source is offline; the caller uses the fallback.
motionReady.catch(() => {});
export function avatarFor(viewer) {
  const src = viewer?.avatar;
  if (!allowedAvatar.test(src || "")) return null;
  if (!avatars.has(src)) {
    const pic = new Image();
    pic.src = src;
    avatars.set(src, pic);
  }
  return avatars.get(src);
}
function screenFor(viewer, alert, picture) {
  const n = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
  const label =
    alert.type === "sub"
      ? "SUB"
      : alert.type === "resub"
        ? `${n(alert.months)} MO`
        : alert.type === "cheer"
          ? String(n(alert.bits))
          : "";
  const recipient =
    alert.type === "gift" ? avatarFor(alert.giftedViewer) : null;
  if (!label && !(recipient?.complete && recipient.naturalWidth))
    return picture;
  const key = `${viewer?.avatar}|${alert.type}|${label}|${alert.giftedViewer?.avatar || ""}`;
  if (screenImages.has(key)) return screenImages.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const c = canvas.getContext("2d");
  if (recipient?.complete && recipient.naturalWidth) {
    c.drawImage(picture, 0, 0, 300, 600);
    c.drawImage(recipient, 300, 0, 300, 600);
  } else c.drawImage(picture, 0, 0, 600, 600);
  if (label) {
    const text = createPixelText(label, "#ffffff");
    c.fillStyle = "rgba(12,22,31,.88)";
    c.fillRect(305, 475, 280, 110);
    c.imageSmoothingEnabled = false;
    c.drawImage(text, 315, 480, 260, 100);
  }
  if (screenImages.size >= 32)
    screenImages.delete(screenImages.keys().next().value);
  screenImages.set(key, canvas);
  return canvas;
}
function projected(source, p, smoothing) {
  const w = source.naturalWidth || source.width,
    h = source.naturalHeight || source.height;
  if (!w || !h) return;
  mask.save();
  mask.setTransform(
    (p[1][0] - p[0][0]) / w,
    (p[1][1] - p[0][1]) / w,
    (p[3][0] - p[0][0]) / h,
    (p[3][1] - p[0][1]) / h,
    p[0][0],
    p[0][1],
  );
  mask.imageSmoothingEnabled = smoothing;
  mask.drawImage(source, 0, 0);
  mask.restore();
}
function textFor(alert, viewer) {
  const n = (x) => (Number.isSafeInteger(x) && x >= 0 ? x : 0);
  const tier =
    { 1000: "T1", 2000: "T2", 3000: "T3", prime: "PRIME" }[
      String(alert.tier || "").toLowerCase()
    ] || "SUB";
  const text =
    {
      sub: tier,
      resub: `${n(alert.months)} MO`,
      gift: `x${n(alert.gifts)}`,
      cheer: String(n(alert.bits)),
      follow: "Hi!",
      raid: String(n(alert.raidSize)),
    }[alert.type] || "Hi!";
  const color = /^#[0-9a-f]{6}$/i.test(viewer?.color || "")
      ? viewer.color
      : "#b5a0ff",
    key = text + color;
  if (!textImages.has(key)) textImages.set(key, createPixelText(text, color));
  return textImages.get(key);
}
export function drawRobot(ctx, atlas, clip, index, viewer, alert) {
  const frame = atlas.rig.clips[clip]?.frames[index];
  if (!frame) return;
  if (scratch.height !== atlas.rig.height) scratch.height = atlas.rig.height;
  const img = (layer) => atlas.images[`${clip}/${layer}`];
  const paint = (target, layer) => {
    const box = frame.layers[layer],
      sheet = frame.sheets[layer],
      picture = img(layer);
    if (box && sheet && picture)
      target.drawImage(
        picture,
        sheet[0],
        sheet[1],
        sheet[2],
        sheet[3],
        box[0],
        box[1],
        sheet[2],
        sheet[3],
      );
  };
  for (const layer of atlas.rig.layers) {
    if (layer === "display_mask") continue;
    if (layer === "screen") {
      const picture = avatarFor(viewer),
        box = frame.layers.screen,
        alpha = img("screen");
      if (
        !frame.screen.visible ||
        !picture?.complete ||
        !picture.naturalWidth ||
        !box ||
        !alpha
      )
        continue;
      mask.setTransform(1, 0, 0, 1, 0, 0);
      mask.globalCompositeOperation = "source-over";
      mask.clearRect(0, 0, atlas.rig.width, atlas.rig.height);
      projected(screenFor(viewer, alert, picture), frame.screen.corners, true);
      mask.globalCompositeOperation = "destination-in";
      paint(mask, "screen");
      mask.globalCompositeOperation = "source-over";
      ctx.drawImage(
        scratch,
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
      );
      continue;
    }
    paint(ctx, layer);
    if (layer === "chest" && frame.chestDisplay.visible) {
      const box = frame.layers.display_mask,
        alpha = img("display_mask");
      if (!box || !alpha) continue;
      mask.setTransform(1, 0, 0, 1, 0, 0);
      mask.globalCompositeOperation = "source-over";
      mask.clearRect(0, 0, atlas.rig.width, atlas.rig.height);
      projected(textFor(alert, viewer), frame.chestDisplay.corners, false);
      mask.globalCompositeOperation = "destination-in";
      paint(mask, "display_mask");
      mask.globalCompositeOperation = "source-over";
      ctx.drawImage(
        scratch,
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
        box[0],
        box[1],
        box[2] - box[0],
        box[3] - box[1],
      );
    }
  }
}
export function motionFrame(atlas, age, hold) {
  const fps = atlas.rig.fps,
    clips = atlas.rig.clips,
    run = clips["run-in"].frames.length / fps;
  if (age < run)
    return [
      "run-in",
      Math.min(
        clips["run-in"].frames.length - 1,
        Math.max(0, Math.floor(age * fps)),
      ),
    ];
  if (age < run + hold)
    return ["idle", Math.floor((age - run) * fps) % clips.idle.frames.length];
  const i = Math.floor((age - run - hold) * fps);
  return i < clips["run-out"].frames.length
    ? ["run-out", Math.max(0, i)]
    : null;
}
export function staticRobotPreview(viewer) {
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 540;
  canvas.className = "robot sprite-robot-preview";
  const paint = async () => {
    try {
      const atlas = await motionReady,
        buffer = document.createElement("canvas");
      buffer.width = atlas.rig.width;
      buffer.height = atlas.rig.height;
      const ctx = buffer.getContext("2d");
      drawRobot(
        ctx,
        atlas,
        "run-in",
        atlas.rig.clips["run-in"].frames.length - 1,
        viewer,
        { type: "preview" },
      );
      canvas
        .getContext("2d")
        .drawImage(
          buffer,
          530,
          100 + (atlas.rig.height - 720) / 2,
          300,
          540,
          0,
          0,
          300,
          540,
        );
    } catch {
      canvas.hidden = true;
    }
  };
  const picture = avatarFor(viewer);
  if (picture && !picture.complete)
    picture.addEventListener("load", paint, { once: true });
  paint();
  return canvas;
}
