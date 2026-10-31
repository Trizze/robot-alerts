import { applyJampreArt, updateJampreAvatar } from "./jampre-art.js";
import { footstep } from "./gait.js";
import { surfaceGradient, plate, drawCrt } from "./robot-art.js";
import {
  DIRECTIONS,
  PART_SLOTS,
  rigModel,
  viewModel,
  solveArm,
} from "./rig-model.js";
const NS = "http://www.w3.org/2000/svg";
let serial = 0;
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const rect = (x, y, width, height, fill) =>
  el("rect", { x, y, width, height, fill });
const path = (d, fill) => el("path", { d, fill });
export class RobotRig {
  constructor(viewer, { direction = "front", equipment = {} } = {}) {
    this.viewer = viewer;
    this.direction = direction;
    this.equipment = { ...equipment };
    this.model = rigModel(equipment);
    this.id = `rig-${++serial}`;
    this.svg = el("svg", {
      role: "img",
      "aria-label": `${viewer?.name || "Viewer"}’s robot`,
    });
    this.svg.classList.add("robot");
    this.svg.rig = this;
    this.draw();
  }
  setDirection(d) {
    if (!DIRECTIONS.includes(d)) throw new Error("Unknown direction.");
    if (this.direction !== d) {
      this.direction = d;
      this.draw();
    }
    return this;
  }
  setEquipment(e) {
    this.model = rigModel(e);
    this.equipment = { ...e };
    this.draw();
    return this;
  }
  setViewer(v) {
    this.viewer = v;
    this.updateAvatar();
    return this;
  }
  get foot() {
    return this.model.foot;
  }
  get bounds() {
    return this.model.bounds;
  }
  get reach() {
    return this.model.rightArm.upper + this.model.rightArm.lower;
  }
  getSocket(name) {
    if (/^(right|left)-(hand|elbow|foot|knee)$/.test(name)) {
      const [side, joint] = name.split("-"),
        leg = ["foot", "knee"].includes(joint),
        b = this.bones[`${side}${leg ? "Leg" : "Arm"}`];
      if (!b) return null;
      const a = (((b.angle || 0) + 90) * Math.PI) / 180,
        lower = a + ((b.bend || 0) * Math.PI) / 180;
      const elbow = {
        x: b.origin[0] + Math.cos(a) * b.spec.upper,
        y: b.origin[1] + Math.sin(a) * b.spec.upper,
      };
      return ["elbow", "knee"].includes(joint)
        ? elbow
        : {
            x: elbow.x + Math.cos(lower) * b.spec.lower,
            y: elbow.y + Math.sin(lower) * b.spec.lower,
          };
    }
    return (
      {
        foot: this.foot,
        head: { x: 40, y: 64 - this.model.head.height / 2 },
        hat: { x: 40, y: 64 - this.model.head.height },
        "right-shoulder": { x: this.view.right[0], y: this.view.right[1] },
        "left-shoulder": { x: this.view.left[0], y: this.view.left[1] },
        chest: { x: 40, y: 86 },
      }[name] || null
    );
  }
  updateAvatar() {
    updateJampreAvatar(this, this.viewer);
    const screen = this.svg.querySelector("[data-layer=screen]");
    if (!screen) return;
    screen.replaceChildren();
    if (
      !this.view.screen ||
      !/^\/(?:avatars\/\d+\.(?:png|jpg|webp)|assets\/avatars\/[a-zA-Z0-9_-]+\.svg)$/.test(
        this.viewer?.avatar || "",
      )
    )
      return;
    const image = el("image", {
      class: "avatar",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      href: this.viewer.avatar,
      preserveAspectRatio: "xMidYMid meet",
    });
    if (this.view.screen[0] !== 1) {
      const a = this.view.screen[0];
      image.setAttribute(
        "transform",
        `translate(${(40 - 40 / a) / 2} 0) scale(${1 / a} 1)`,
      );
    }
    image.addEventListener("error", () => image.remove());
    screen.append(image);
  }
  attach(slot, parent, anchor, replacement) {
    const group = el("g", {
      "data-slot": slot,
      transform: `translate(${anchor.x} ${anchor.y})`,
    });
    parent.append(group);
    this.slots[slot] = group;
    const factory = this.model.assets[slot]?.[this.direction];
    if (factory) {
      const art = factory({
        el,
        rect,
        path,
        direction: this.direction,
        model: this.model,
      });
      if (!(art instanceof SVGElement))
        throw new Error("Part factory must return SVG artwork.");
      group.append(art);
      replacement?.setAttribute("display", "none");
    }
  }
  draw() {
    const m = this.model,
      c = m.material,
      v = (this.view = viewModel(this.direction));
    this.slots = {};
    this.bones = {};
    this.spriteAvatar = null;
    this.svg.dataset.direction = this.direction;
    this.svg.setAttribute(
      "viewBox",
      `${m.bounds.x} ${m.bounds.y} ${m.bounds.width} ${m.bounds.height}`,
    );
    this.svg.replaceChildren();
    const defs = (this.defs = el("defs")),
      clip = el("clipPath", { id: this.id });
    clip.append(rect(0, 0, 40, 40, "#fff"));
    defs.append(clip);
    this.svg.append(defs);
    this.body = el("g", { "data-bone": "body" });
    this.svg.append(this.body);
    // Continuous narrow mechanical links sit behind independently replaceable armor.
    const neck = el("g", { "data-connector": "neck" });
    neck.append(
      rect(37, 62, 6, 16, c.ink),
      rect(39, 63, 2, 13, c.shade),
      rect(37, 68, 6, 3, c.metal),
      rect(38, 68, 4, 1, c.highlight),
    );
    this.body.append(neck);
    const waist = el("g", { "data-connector": "waist" });
    waist.append(
      rect(36, 94, 8, 10, c.ink),
      rect(38, 96, 4, 8, c.shade),
      rect(31, 100, 18, 4, c.ink),
      rect(32, 100, 16, 1, c.shade),
    );
    this.svg.append(waist);
    const mirror = v.mirrored ? "translate(80 0) scale(-1 1)" : "";
    this.makeLimb("leftLeg", [v.hips[0], 104], this.svg, true);
    this.makeLimb("rightLeg", [v.hips[1], 104], this.svg, true);
    const far = v.near === "right" ? "leftArm" : "rightArm",
      near = far === "leftArm" ? "rightArm" : "leftArm";
    this.makeLimb(far, v[far === "leftArm" ? "left" : "right"], this.body);
    this.attach("pose", this.body, { x: 40, y: 68 });
    const tc = m.torso.material || c;
    const torso = el("g", {
      "data-layer": "paint",
      transform: `${mirror} translate(40 98) scale(${m.torso.width / 32} ${m.torso.height / 22}) translate(-40 -98)`,
    });
    const torsoFill = surfaceGradient(this.defs, `${this.id}-torso`, tc, el);
    if (v.key === "front" || v.key === "back") {
      plate(torso, 28, 76, 24, 20, tc, torsoFill, { rect, path });
      torso.append(
        rect(31, 92, 18, 2, tc.shade),
        rect(31, 78, 2, 1, tc.ink),
        rect(47, 78, 2, 1, tc.ink),
        rect(31, 90, 2, 1, tc.ink),
        rect(47, 90, 2, 1, tc.ink),
      );
    } else if (v.key === "right") {
      plate(torso, 31, 76, 18, 20, tc, torsoFill, { rect, path });
      torso.append(
        rect(43, 79, 3, 13, tc.shade),
        rect(34, 81, 6, 2, tc.ink),
        rect(34, 85, 6, 2, tc.ink),
        rect(34, 89, 6, 2, tc.ink),
      );
    } else {
      plate(torso, 28, 76, 24, 20, tc, torsoFill, { rect, path });
      torso.append(
        rect(30, 79, 7, 13, tc.shade),
        rect(30, 79, 7, 2, tc.metal),
        rect(38, 92, 10, 2, tc.shade),
      );
    }
    this.body.append(torso);
    this.attach("torso", this.body, { x: 40, y: 86 }, torso);
    this.attach("paint", this.body, { x: 40, y: 86 });
    const cc = m.chest?.material || c,
      chest = el("g", { "data-layer": "chest", transform: mirror });
    if (v.key === "front")
      chest.append(
        rect(33, 82, 14, 7, cc.ink),
        rect(35, 84, 10, 3, cc.light),
        rect(35, 84, 10, 1, cc.highlight),
        rect(33, 89, 14, 1, cc.highlight),
      );
    else if (v.key === "front-right")
      chest.append(
        rect(39, 82, 10, 7, cc.ink),
        rect(41, 84, 6, 3, cc.light),
        rect(41, 84, 6, 1, cc.highlight),
      );
    else if (v.key.startsWith("back"))
      chest.append(
        rect(35, 81, 10, 9, cc.shade),
        rect(37, 83, 6, 1, cc.ink),
        rect(37, 86, 6, 1, cc.ink),
      );
    this.body.append(chest);
    this.attach("chest", this.body, { x: 40, y: 86 }, chest);
    this.head = el("g", { "data-bone": "head" });
    this.body.append(this.head);
    const hc = m.head.material || c;
    const frame = el("g", {
      "data-base": "head",
      transform: `${mirror} translate(40 64) scale(${m.head.width / 56} ${m.head.height / 56}) translate(-40 -64)`,
    });
    const headFill = surfaceGradient(this.defs, `${this.id}-head`, hc, el);
    drawCrt(frame, v, hc, headFill, { rect, path }, this.vents.bind(this));
    this.head.append(frame);
    this.attach("head", this.head, this.getSocket("head"), frame);
    const screen = el("g", {
      "data-layer": "screen",
      ...(v.screen
        ? {
            transform: `matrix(${v.screen.join(" ")})`,
            "clip-path": `url(#${this.id})`,
          }
        : { display: "none" }),
    });
    this.head.append(screen);
    this.updateAvatar();
    this.attach("screen", this.head, this.getSocket("head"));
    this.attach("hat", this.head, this.getSocket("hat"));
    this.makeLimb(near, v[near === "leftArm" ? "left" : "right"], this.body);
    this.attach("entrance", this.svg, this.foot);
    applyJampreArt(this);
    this.setPose("idle", 0);
  }
  vents(parent, x, y, c, width = 32) {
    for (let i = 0; i < 4; i++)
      parent.append(rect(x, y + i * 4, width, 2, c.ink));
    parent.append(
      rect(x + 5, y + 20, width - 10, 10, c.shade),
      rect(x + 9, y + 23, width - 18, 4, c.ink),
    );
  }
  makeLimb(slot, origin, parent, leg = false) {
    const spec = this.model[slot],
      c = spec.material || this.model.material,
      w = spec.width;
    const bone = el("g", {
        "data-bone": slot,
        transform: `translate(${origin[0]} ${origin[1]})`,
      }),
      upper = el("g"),
      lower = el("g"),
      hand = el("g", { transform: `translate(0 ${spec.lower})` });
    const mount = el("g", { "data-connector": leg ? "hip" : "shoulder" }),
      mountX = leg
        ? (origin[0] < 40 ? 35 : 45) - origin[0]
        : (this.view.key === "right"
            ? origin[0] < 40
              ? 31
              : 49
            : origin[0] < 40
              ? 29
              : 51) - origin[0];
    mount.append(
      el("path", {
        d: leg ? `M0 2V-2L${mountX} -3` : `M0 2H${mountX}`,
        fill: "none",
        stroke: c.ink,
        "stroke-width": 4,
      }),
      el("path", {
        d: leg ? `M0 2V-2L${mountX} -3` : `M0 2H${mountX}`,
        fill: "none",
        stroke: c.shade,
        "stroke-width": 2,
      }),
    );
    bone.append(mount);
    const upperLink = el("g", { "data-connector": "upper-link" }),
      lowerLink = el("g", { "data-connector": "lower-link" });
    upperLink.append(
      rect(-1.5, 0, 3, spec.upper + 2, c.ink),
      rect(-0.5, 0, 1, spec.upper + 2, c.shade),
    );
    lowerLink.append(
      rect(-1.5, -2, 3, spec.lower + 5, c.ink),
      rect(-0.5, -1, 1, spec.lower + 4, c.shade),
      rect(-2, -2, 4, 4, c.ink),
      rect(-1, -1, 2, 2, c.metal),
    );
    upper.append(upperLink);
    lower.append(lowerLink);
    const upperArt = el("g", { "data-base": "upper" }),
      lowerArt = el("g", { "data-base": "lower" });
    const fill = surfaceGradient(this.defs, `${this.id}-${slot}`, c, el);
    plate(
      upperArt,
      -w / 2,
      1,
      w,
      Math.max(3, spec.upper - 3),
      c,
      fill,
      { rect, path },
      1,
    );
    plate(
      lowerArt,
      -w / 2,
      2,
      w,
      Math.max(3, spec.lower - 4),
      c,
      fill,
      { rect, path },
      1,
    );
    lowerArt.append(
      rect(-w / 2 + 2, 4, 1, Math.max(1, spec.lower - 8), c.highlight),
      rect(-w / 2 + 1, spec.lower - 3, w - 2, 1, c.ink),
    );
    upper.append(upperArt);
    lower.append(lowerArt);
    if (leg) {
      const side = this.view.key === "right",
        diagonal = this.view.key.includes("right"),
        flip = this.view.mirrored ? -1 : 1;
      hand.setAttribute("data-part", "boot");
      if (side || diagonal) {
        hand.setAttribute(
          "transform",
          `translate(0 ${spec.lower}) scale(${flip} 1)`,
        );
        hand.append(
          path("M-5 -3H4V0H9V2H12V7H-6V0H-5Z", c.ink),
          rect(-3, -2, 6, 4, c.shade),
          rect(-3, 2, 11, 2, c.metal),
          rect(6, 2, 4, 3, c.highlight),
          rect(-5, 5, 16, 2, c.shade),
          rect(-1, -1, 3, 1, c.highlight),
          rect(-3, 7, 3, 1, c.ink),
          rect(5, 7, 4, 1, c.ink),
        );
      } else
        hand.append(
          path("M-5 -3H5V0H7V7H-7V0H-5Z", c.ink),
          rect(-3, -2, 6, 3, c.shade),
          rect(-5, 1, 10, 4, c.metal),
          rect(-4, 2, 8, 1, c.highlight),
          rect(-6, 5, 12, 2, c.shade),
          rect(-4, 7, 3, 1, c.ink),
          rect(1, 7, 3, 1, c.ink),
        );
    } else {
      plate(hand, -spec.hand / 2, 1, spec.hand, 6, c, fill, { rect, path }, 1);
      hand.append(rect(-1, 4, 1, 2, c.ink), rect(1, 4, 1, 2, c.shade));
    }
    lower.append(hand);
    upper.append(lower);
    bone.append(upper);
    parent.append(bone);
    const factory = this.model.assets[slot]?.[this.direction];
    if (factory) {
      const art = factory({
        el,
        rect,
        path,
        direction: this.direction,
        model: this.model,
        dimensions: spec,
      });
      if (
        !art ||
        !["upper", "lower", "hand"].every(
          (key) => art[key] instanceof SVGElement,
        )
      )
        throw new Error(
          "Replacement limbs need upper, lower and hand artwork.",
        );
      upperArt.remove();
      lowerArt.remove();
      upper.prepend(art.upper);
      lower.prepend(art.lower);
      hand.replaceChildren(art.hand);
    }
    bone.setAttribute("data-slot", slot);
    this.slots[slot] = bone;
    this.bones[slot] = { bone, upper, lower, hand, origin, spec };
  }
  rotateBone(slot, upper, lower = 0) {
    const b = this.bones[slot];
    if (b) {
      b.angle = upper;
      b.bend = lower;
      b.upper.setAttribute("transform", `rotate(${upper})`);
      b.lower.setAttribute(
        "transform",
        `translate(0 ${b.spec.upper}) rotate(${lower})`,
      );
      if (slot.endsWith("Leg"))
        b.hand.setAttribute(
          "transform",
          `translate(0 ${b.spec.lower}) scale(${this.view.mirrored ? -1 : 1} 1)`,
        );
    }
  }
  setPose(pose = "idle", time = 0) {
    const wave = Math.sin(time * 14),
      bob =
        pose === "run"
          ? -Math.abs(wave) * 1.2
          : pose === "idle"
            ? Math.sin(time * 2) * 0.3
            : 0;
    this.body.setAttribute("transform", `translate(0 ${bob})`);
    for (const slot of ["leftArm", "rightArm", "leftLeg", "rightLeg"]) {
      const b = this.bones[slot];
      if (this.isJampre && b)
        b.bone.setAttribute(
          "transform",
          `translate(${b.origin[0]} ${b.origin[1]})`,
        );
      this.rotateBone(slot, 0);
    }
    if (pose === "idle")
      for (const slot of ["leftArm", "rightArm"]) {
        const b = this.bones[slot],
          room = this.foot.y - b.origin[1] - 6;
        if (b.spec.upper + b.spec.lower > room) {
          const target = {
              x: b.origin[0] + (b.origin[0] < 40 ? -8 : 8),
              y: this.foot.y - 8,
            },
            solved = solveArm(
              { x: b.origin[0], y: b.origin[1] },
              target,
              b.spec.upper,
              b.spec.lower,
            );
          this.rotateBone(slot, solved.upper, solved.lower);
        }
      }
    if (pose === "run") return this.setLocomotion(time * 30);
    if (pose === "crashed") {
      this.rotateBone("leftArm", -25, 35);
      this.rotateBone("rightArm", 20, -20);
      this.rotateBone("leftLeg", 10, 12);
      this.rotateBone("rightLeg", -8, 10);
    }
    if (pose === "dance") {
      const beat = Math.sin(time);
      this.rotateBone("leftArm", -65 - beat * 40, 40);
      this.rotateBone("rightArm", 65 - beat * 40, -40);
      this.rotateBone("leftLeg", beat * 12, Math.max(0, -beat) * 16);
      this.rotateBone("rightLeg", -beat * 12, Math.max(0, beat) * 16);
    }
    if (pose === "recover") {
      this.rotateBone("leftArm", -25);
      this.rotateBone("rightArm", 25);
      this.rotateBone("leftLeg", -10, 18);
      this.rotateBone("rightLeg", 10, 18);
    }
    this.pose = pose;
    return this;
  }
  setLocomotion(distance) {
    const sign = this.view.mirrored ? -1 : 1,
      reach = Math.min(
        this.model.leftLeg.upper + this.model.leftLeg.lower,
        this.model.rightLeg.upper + this.model.rightLeg.lower,
      ),
      ground = 104 + reach - 3;
    const stride = Math.max(
      4,
      Math.min(
        18,
        Math.sqrt(Math.max(1, reach * reach - (reach - 3) ** 2)) * 1.8,
      ),
    );
    const phase = (distance / (stride / 0.6)) * Math.PI * 2;
    this.body.setAttribute(
      "transform",
      `translate(0 ${Math.sin(phase * 2) * 0.35}) rotate(${sign * (5 + Math.sin(phase) * 1.5)} 80 104)`,
    );
    if (this.isJampre) {
      const length = 28;
      for (const [slot, offset] of [
        ["leftLeg", 0],
        ["rightLeg", 0.5],
      ]) {
        const b = this.bones[slot],
          step = footstep(distance, stride, offset),
          x = Math.max(-length + 0.01, Math.min(length - 0.01, step.x));
        const angle = ((-Math.asin(x / length) * 180) / Math.PI) * sign,
          vertical = length - Math.sqrt(length * length - x * x) - step.lift;
        b.bone.setAttribute(
          "transform",
          `translate(${b.origin[0]} ${b.origin[1] + vertical})`,
        );
        this.rotateBone(slot, angle, 0);
      }
      this.rotateBone("leftArm", sign * (-12 + Math.sin(phase) * 15), 0);
      this.rotateBone("rightArm", sign * (-12 - Math.sin(phase) * 15), 0);
      this.pose = "run";
      this.gait = { stride, soleOffset: ground - this.foot.y + 8 };
      return this;
    }
    for (const [slot, offset] of [
      ["leftLeg", 0],
      ["rightLeg", 0.5],
    ]) {
      const b = this.bones[slot],
        step = footstep(distance, stride, offset),
        target = { x: b.origin[0] + step.x, y: ground - step.lift };
      const solved = solveArm(
        { x: b.origin[0], y: b.origin[1] },
        target,
        b.spec.upper,
        b.spec.lower,
      );
      this.rotateBone(slot, solved.upper * sign, solved.lower * sign);
      const toe = step.stance
        ? 0
        : Math.sin(((step.phase - 0.6) / 0.4) * Math.PI) * 10;
      b.hand.setAttribute(
        "transform",
        `translate(0 ${b.spec.lower}) rotate(${-(solved.upper + solved.lower) * sign + toe * sign}) scale(${sign} 1)`,
      );
    }
    this.rotateBone("leftArm", sign * (-12 + Math.sin(phase) * 15), sign * 18);
    this.rotateBone("rightArm", sign * (-12 - Math.sin(phase) * 15), sign * 18);
    this.pose = "run";
    this.gait = { stride, soleOffset: ground - this.foot.y + 8 };
    return this;
  }
  pressRight(target) {
    if (this.isJampre) {
      const b = this.bones.rightArm,
        dx = target.x - b.origin[0],
        dy = target.y - b.origin[1];
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI - 110;
      this.rotateBone("rightArm", angle, 0);
      return {
        x: b.origin[0] + Math.cos(((angle + 90) * Math.PI) / 180) * this.reach,
        y: b.origin[1] + Math.sin(((angle + 90) * Math.PI) / 180) * this.reach,
      };
    }
    const shoulder = this.getSocket("right-shoulder"),
      part = this.model.rightArm;
    let offset = { x: 0, y: 4 },
      solved;
    for (let i = 0; i < 6; i++) {
      solved = solveArm(
        shoulder,
        { x: target.x - offset.x, y: target.y - offset.y },
        part.upper,
        part.lower,
      );
      const a = ((solved.upper + solved.lower + 90) * Math.PI) / 180;
      offset = { x: 4 * Math.cos(a), y: 4 * Math.sin(a) };
    }
    this.body.setAttribute("transform", "translate(0 0)");
    this.rotateBone("rightArm", solved.upper, solved.lower);
    return { x: solved.hand.x + offset.x, y: solved.hand.y + offset.y };
  }
  reachRight(target) {
    this.body.setAttribute("transform", "translate(0 0)");
    const part = this.model.rightArm,
      solved = solveArm(
        this.getSocket("right-shoulder"),
        target,
        part.upper,
        part.lower,
      );
    this.rotateBone("rightArm", solved.upper, solved.lower);
    return solved.hand;
  }
}
export { DIRECTIONS, PART_SLOTS };
export function robot(viewer, options) {
  return new RobotRig(viewer, options).svg;
}
export function setAvatar(svg, viewer) {
  svg?.rig?.setViewer(viewer);
}
