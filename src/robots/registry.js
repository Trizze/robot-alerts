import { ValidationError } from "../errors.js";
import {
  CARD_PRESETS,
  CARD_SYMBOLS,
  CARD_EVENTS,
} from "../../public/shared/card-presets.js";
export const defaults = Object.freeze({
  version: 1,
  head: "crt-classic",
  screen: "avatar",
  hat: "none",
  chest: "beacon",
  paint: "avatar-palette",
  pose: "wave",
  entrance: "walk",
});
export const unlocks = [
  ["months", 1, "hat", "antenna", "Signal antenna"],
  ["months", 3, "head", "reinforced", "Reinforced CRT"],
  ["months", 6, "screen", "visor", "Visor frame"],
  ["months", 12, "hat", "crown", "Anniversary crown"],
  ["months", 24, "chest", "veteran", "Veteran core"],
  ["bits", 100, "paint", "copper", "Copper finish"],
  ["bits", 1000, "chest", "coil", "Tesla coil"],
  ["bits", 5000, "paint", "neon", "Neon finish"],
  ["bits", 10000, "entrance", "spark", "Spark arrival"],
  ["streak", 3, "pose", "salute", "Salute"],
  ["streak", 7, "hat", "mug", "Coffee companion"],
  ["streak", 14, "paint", "comet", "Comet finish"],
  ["streak", 30, "chest", "star", "Star core"],
  ["followDays", 30, "hat", "sprout", "Fresh sprout"],
  ["followDays", 180, "paint", "patina", "Patina finish"],
  ["followDays", 365, "head", "clockwork", "Clockwork CRT"],
  ["gifts", 1, "hat", "parcel", "Gift ribbon"],
  ["gifts", 5, "chest", "helper", "Helping heart"],
  ["gifts", 25, "pose", "cape", "Hero stance"],
  ["gifts", 100, "entrance", "beacon", "Beacon arrival"],
].map(([metric, threshold, layer, id, name]) => ({
  metric,
  threshold,
  layer,
  id,
  name,
}));
export const layers = Object.keys(defaults).filter((key) => key !== "version");
export const registry = Object.fromEntries(
  layers.map((layer) => [
    layer,
    [
      defaults[layer],
      ...unlocks.filter((p) => p.layer === layer).map((p) => p.id),
    ],
  ]),
);
export const baseSettings = {
  theme: "default",
  accent: "#b8f36e",
  volume: 0.25,
  sound: "soft",
  position: "bottom-center",
  scale: 1,
  canvas: { width: 1920, height: 1080 },
  events: {
    sub: true,
    resub: true,
    gift: true,
    cheer: true,
    raid: true,
    follow: true,
    preview: true,
  },
  animations: {
    sub: "robot",
    resub: "robot",
    gift: "robot",
    cheer: "robot",
    raid: "robot",
    follow: "robot",
    preview: "robot",
  },
  card: {
    preset: "01",
    colors: structuredClone(CARD_PRESETS["01"].colors),
    events: {},
  },
  duration: 9,
  textDurations: {
    robot: 6,
    meteor: 6,
    "run-button": 6,
    simple: 6,
    parade: 3,
    custom: 6,
  },
  customMedia: {},
  showAlertBox: true,
  thresholds: Object.fromEntries(unlocks.map((p) => [p.id, p.threshold])),
};
export function validateLook(look, owned) {
  if (
    !look ||
    typeof look !== "object" ||
    Object.keys(look).some((k) => k !== "version" && !layers.includes(k))
  )
    throw new ValidationError("Unknown robot layer.");
  for (const layer of layers)
    if (
      look[layer] !== undefined &&
      (!registry[layer].includes(look[layer]) ||
        (look[layer] !== defaults[layer] && !owned.includes(look[layer])))
    )
      throw new ValidationError(`You have not earned that ${layer} yet.`);
  return { ...defaults, ...look, version: 1 };
}
export function validateSettings(input) {
  if (!input || typeof input !== "object")
    throw new ValidationError("Settings must be an object.");
  const result = structuredClone(baseSettings);
  if (["default", "gaming"].includes(input.theme)) result.theme = input.theme;
  else if (input.theme === "arcade") result.theme = "gaming";
  if (/^#[\da-f]{6}$/i.test(input.accent || "")) result.accent = input.accent;
  for (const [key, min, max] of [
    ["volume", 0, 1],
    ["scale", 0.5, 1.5],
    ["duration", 5, 20],
  ])
    if (Number.isFinite(input[key]))
      result[key] = Math.min(max, Math.max(min, input[key]));
  if (["soft", "arcade", "mute"].includes(input.sound))
    result.sound = input.sound;
  if (
    ["bottom-center", "bottom-left", "bottom-right", "center"].includes(
      input.position,
    )
  )
    result.position = input.position;
  if (typeof input.showAlertBox === "boolean")
    result.showAlertBox = input.showAlertBox;
  if (input.card && typeof input.card === "object") {
    const preset = Object.hasOwn(CARD_PRESETS, input.card.preset)
      ? input.card.preset
      : "01";
    result.card = {
      preset,
      colors: structuredClone(CARD_PRESETS[preset].colors),
      events: {},
    };
    for (const key of Object.keys(result.card.colors))
      if (/^#[0-9a-f]{6}$/i.test(input.card.colors?.[key] || ""))
        result.card.colors[key] = input.card.colors[key];
    for (const type of CARD_EVENTS) {
      const e = input.card.events?.[type];
      if (!e || typeof e !== "object") continue;
      const clean = {};
      for (const key of ["label", "detail", "amountValue", "amountUnit"])
        if (typeof e[key] === "string")
          clean[key] = Array.from(e[key].trim())
            .slice(0, key === "detail" ? 140 : key === "label" ? 32 : 24)
            .join("");
      if (Object.hasOwn(CARD_SYMBOLS, e.symbol)) clean.symbol = e.symbol;
      if (
        typeof e.upload === "string" &&
        /^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp)$/.test(e.upload)
      )
        clean.upload = e.upload;
      result.card.events[type] = clean;
    }
  }

  for (const type of Object.keys(result.events)) {
    if (typeof input.events?.[type] === "boolean")
      result.events[type] = input.events[type];
    if (input.animations?.[type] === "custom" && type !== "raid")
      result.animations[type] = "custom";
    else result.animations[type] = "robot";
  }
  if (
    !Number.isFinite(input.textDurations?.robot) &&
    Number.isFinite(input.textDurations?.["run-button"])
  )
    result.textDurations.robot = Math.max(
      1,
      Math.min(60, input.textDurations["run-button"]),
    );
  for (const kind of Object.keys(result.textDurations))
    if (Number.isFinite(input.textDurations?.[kind]))
      result.textDurations[kind] = Math.max(
        1,
        Math.min(60, input.textDurations[kind]),
      );
  for (const type of Object.keys(result.events))
    if (
      typeof input.customMedia?.[type] === "string" &&
      /^\/media\/[a-f0-9-]{36}\.(png|jpg|gif|webp|mp4|webm)$/.test(
        input.customMedia[type],
      )
    )
      result.customMedia[type] = input.customMedia[type];
  if (
    (input.canvas?.width === 1920 && input.canvas?.height === 1080) ||
    (input.canvas?.width === 2560 && input.canvas?.height === 1440) ||
    (input.canvas?.width === 3840 && input.canvas?.height === 2160)
  )
    result.canvas = { width: input.canvas.width, height: input.canvas.height };
  for (const part of unlocks)
    if (
      Number.isSafeInteger(input.thresholds?.[part.id]) &&
      input.thresholds[part.id] > 0
    )
      result.thresholds[part.id] = Math.min(
        10000000,
        input.thresholds[part.id],
      );
  return result;
}
