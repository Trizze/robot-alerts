export const DIRECTIONS = Object.freeze([
  "front",
  "front-right",
  "right",
  "back-right",
  "back",
  "back-left",
  "left",
  "front-left",
]);
export const PART_SLOTS = Object.freeze([
  "head",
  "torso",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
  "hat",
  "chest",
  "screen",
  "paint",
  "pose",
  "entrance",
]);
const library = new Map();
export const MATERIAL = Object.freeze({
  metal: "#b9c6bd",
  shade: "#697d79",
  ink: "#233137",
  highlight: "#e2e6d8",
  light: "#b1daa7",
});
const limb = (upper, lower, width, hand = 0) => ({ upper, lower, width, hand });
const baseline = {
  head: { width: 56, height: 56 },
  torso: { width: 32, height: 22 },
  leftArm: limb(10, 11, 8, 8),
  rightArm: limb(10, 11, 8, 8),
  leftLeg: limb(8, 9, 8),
  rightLeg: limb(8, 9, 8),
};
// Code-owned asset registry. No chat text, markup or URLs are evaluated.
export function registerRobotPart(part) {
  if (
    !part ||
    !/^[a-z0-9-]+$/.test(part.id || "") ||
    !PART_SLOTS.includes(part.slot) ||
    library.has(part.id)
  )
    throw new Error("Invalid robot part.");
  if (part.dimensions)
    for (const [key, value] of Object.entries(part.dimensions))
      if (
        !["upper", "lower", "width", "height", "hand"].includes(key) ||
        !Number.isFinite(value) ||
        value < 2 ||
        value > 72
      )
        throw new Error("Invalid part dimensions.");
  if (part.material)
    for (const [key, value] of Object.entries(part.material))
      if (!Object.hasOwn(MATERIAL, key) || !/^#[\da-f]{6}$/i.test(value))
        throw new Error("Invalid part material.");
  if (
    part.views &&
    !DIRECTIONS.every((d) => typeof part.views[d] === "function")
  )
    throw new Error("Replacement art must cover all eight directions.");
  if (!baseline[part.slot] && !part.views && !part.material)
    throw new Error("Attachment needs directional art.");
  library.set(part.id, part);
}
export function rigModel(equipment = {}) {
  const model = {
    ...structuredClone(baseline),
    material: { ...MATERIAL },
    equipment: { ...equipment },
    assets: {},
  };
  for (const [slot, id] of Object.entries(equipment)) {
    const part = library.get(id);
    if (!part || part.slot !== slot)
      throw new Error("Unknown replacement part.");
    if (part.dimensions && model[slot])
      Object.assign(model[slot], part.dimensions);
    if (part.material) {
      if (slot === "paint") Object.assign(model.material, part.material);
      else
        model[slot] = {
          ...model[slot],
          material: { ...model.material, ...part.material },
        };
    }
    if (part.views) model.assets[slot] = part.views;
  }
  model.foot = {
    x: 40,
    y:
      104 +
      Math.max(
        model.leftLeg.upper + model.leftLeg.lower,
        model.rightLeg.upper + model.rightLeg.lower,
      ),
  };
  const reach = Math.max(
    model.leftArm.upper + model.leftArm.lower + model.leftArm.hand,
    model.rightArm.upper + model.rightArm.lower + model.rightArm.hand,
  );
  const x = Math.min(-4, 24 - reach),
    y = Math.min(-6, 58 - model.head.height);
  model.bounds = {
    x,
    y,
    width: Math.max(88, 80 - 2 * x),
    height: Math.max(142, model.foot.y + 14 - y),
  };
  return model;
}
export function solveArm(shoulder, target, upper, lower) {
  const dx = target.x - shoulder.x,
    dy = target.y - shoulder.y;
  const distance = Math.max(
    Math.abs(upper - lower) + 0.001,
    Math.min(Math.hypot(dx, dy), upper + lower - 0.001),
  );
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  const a =
    Math.atan2(dy, dx) -
    Math.acos(
      clamp(
        (upper * upper + distance * distance - lower * lower) /
          (2 * upper * distance),
      ),
    );
  const bend =
    Math.PI -
    Math.acos(
      clamp(
        (upper * upper + lower * lower - distance * distance) /
          (2 * upper * lower),
      ),
    );
  return {
    upper: (a * 180) / Math.PI - 90,
    lower: (bend * 180) / Math.PI,
    hand: {
      x: shoulder.x + Math.cos(a) * upper + Math.cos(a + bend) * lower,
      y: shoulder.y + Math.sin(a) * upper + Math.sin(a + bend) * lower,
    },
  };
}
export function viewModel(direction) {
  if (!DIRECTIONS.includes(direction)) throw new Error("Unknown direction.");
  const mirrored = ["left", "front-left", "back-left"].includes(direction),
    key = direction.replace("-left", "-right").replace(/^left$/, "right");
  const data = {
    front: {
      screen: [1, 0, 0, 1, 20, 18],
      left: [20, 80],
      right: [60, 80],
      hips: [29, 51],
      near: "both",
    },
    "front-right": {
      screen: [0.7, 0, 0, 1, 32, 18],
      left: [22, 80],
      right: [59, 80],
      hips: [29, 51],
      near: "right",
    },
    right: {
      screen: null,
      left: [28, 80],
      right: [54, 80],
      hips: [29, 51],
      near: "right",
    },
    "back-right": {
      screen: null,
      left: [22, 80],
      right: [59, 80],
      hips: [29, 51],
      near: "right",
    },
    back: {
      screen: null,
      left: [60, 80],
      right: [20, 80],
      hips: [51, 29],
      near: "both",
    },
  }[key];
  const result = structuredClone(data);
  result.key = key;
  result.mirrored = mirrored;
  if (mirrored) {
    result.left[0] = 80 - result.left[0];
    result.right[0] = 80 - result.right[0];
    result.hips = result.hips.map((x) => 80 - x);
    result.near = "left";
    if (result.screen) {
      const [a, b, c, d, e, f] = result.screen;
      result.screen = [a, b ? -b : 0, c, d, 80 - e - 40 * a, f + 40 * b];
    }
  }
  return result;
}
