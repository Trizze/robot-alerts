import { RobotRig } from "/shared/robot-rig.js";
import { RaidWorld } from "/shared/raid-world.js";
const NS = "http://www.w3.org/2000/svg";
export class RaidScene {
  constructor(stage, root, alert, rig, onDone) {
    Object.assign(this, { stage, root, alert, rig, onDone });
    this.clockStart =
      performance.now() - Math.max(0, Date.now() - alert.startedAt);
    this.fixedTime = null;
    this.world = new RaidWorld();
    this.entries = new Map();
    this.bots = new Map();
    this.smokes = new Map();
    this.done = false;
    this.layer = document.createElement("div");
    this.layer.className = "raid-crowd";
    root.append(this.layer);
    stage.append(root);
    this.root.scene = this;
    this.root.classList.add("raid-alert");
    this.card = root.querySelector(".card");
    this.hero = root.querySelector(".robot-row");
    this.scale = 1.45;
    for (const entry of alert.raiders || []) this.join(entry);
    if (alert.demo)
      for (const [i, viewer] of (alert.demoRaidChatters || []).entries())
        this.join({ viewer, at: 0.2 + i * 0.35, sequence: i });
    this.tick();
  }
  join(entry) {
    if (!entry?.viewer?.id) return;
    const old = this.entries.get(entry.sequence);
    this.entries.set(entry.sequence, {
      ...entry,
      spawned: old?.spawned || false,
    });
  }
  smoke(cloud) {
    const el = document.createElementNS(NS, "svg");
    el.setAttribute("viewBox", "-110 -100 220 200");
    el.classList.add("raid-smoke");
    el.innerHTML =
      '<path d="M-85 30C-110 0-75-29-50-20C-62-62-8-78 15-45C40-79 82-46 70-15C111-13 110 37 75 45C71 81 23 90 0 60C-34 93-84 70-70 42Z" fill="#d5d9cd"/><path d="M-76 32Q-48 52-30 28Q-4 49 17 25Q53 49 77 25Q58 76 9 55Q-42 82-76 32Z" fill="#91a29c"/><path d="M-62-10Q-43-42-18-31M22-31Q54-44 63-14" fill="none" stroke="#eef0df" stroke-width="9"/>';
    this.layer.append(el);
    this.smokes.set(cloud.id, el);
    return el;
  }
  render(time) {
    const textTime = this.alert.textDuration,
      ct = time - textTime;
    const typed = this.card.querySelector(".name-typed");
    if (typed)
      typed.style.clipPath = `inset(0 ${(1 - Math.max(0, Math.min(1, (time - 0.15) / 0.45))) * 100}% 0 0)`;
    const show = time < textTime;
    this.card.style.visibility = show ? "visible" : "hidden";
    this.hero.style.visibility = show ? "visible" : "hidden";
    this.root.dataset.phase = show ? "raid-text" : "raid-crowd";
    if (show) {
      this.rig.setPose("idle", time);
      return;
    }
    for (const e of this.entries.values())
      if (!e.spawned && e.viewer.avatar && Number.isFinite(e.at)) {
        this.world.add(e.viewer, e.at, e.sequence);
        e.spawned = true;
      }
    this.world.advance(ct);
    const active = new Set();
    for (const a of this.world.actors) {
      active.add(a.id);
      let bot = this.bots.get(a.id);
      if (!bot) {
        const actor = document.createElement("div");
        actor.className = "raid-runner";
        const rig = new RobotRig(a.viewer, {
            direction: a.direction > 0 ? "front-right" : "front-left",
          }),
          label = document.createElement("span");
        label.className = "raid-runner-name";
        label.textContent = a.viewer.name;
        actor.append(rig.svg, label);
        this.layer.append(actor);
        bot = { actor, rig };
        this.bots.set(a.id, bot);
      }
      const { rig, actor } = bot,
        b = rig.bounds,
        s = this.scale;
      let footY,
        angle = 0;
      if (a.state === "run") {
        rig.setDirection(a.direction > 0 ? "front-right" : "front-left");
        rig.setLocomotion(a.distance / s);
        footY = a.y - rig.gait.soleOffset * s;
      } else {
        rig.setDirection("front");
        rig.setPose("recover");
        footY = a.y - 8 * s - Math.sin((a.impact / 0.22) * Math.PI) * 28;
        angle = a.direction * a.impact * 180;
      }
      Object.assign(actor.style, {
        width: `${b.width * s}px`,
        height: `${b.height * s}px`,
        left: `${a.x - (rig.foot.x - b.x) * s}px`,
        top: `${footY - (rig.foot.y - b.y) * s}px`,
        transformOrigin: `${(rig.foot.x - b.x) * s}px ${(rig.foot.y - b.y) * s}px`,
        transform: `rotate(${angle}deg)`,
        zIndex: String(a.lane + 1),
      });
    }
    for (const [id, bot] of this.bots)
      if (!active.has(id)) {
        bot.actor.remove();
        this.bots.delete(id);
      }
    const smokeIds = new Set();
    for (const cloud of this.world.clouds) {
      smokeIds.add(cloud.id);
      const el = this.smokes.get(cloud.id) || this.smoke(cloud),
        p = Math.min(1, cloud.age / 0.85),
        scale = 0.3 + globalThis.gsap.parseEase("power2.out")(p) * 1.05;
      Object.assign(el.style, {
        left: `${cloud.x - 110}px`,
        top: `${cloud.y - 100}px`,
        opacity: String(1 - p * p),
        transform: `scale(${scale})`,
      });
    }
    for (const [id, el] of this.smokes)
      if (!smokeIds.has(id)) {
        el.remove();
        this.smokes.delete(id);
      }
    const loading = [...this.entries.values()].some(
      (e) => !e.spawned && !e.viewer.avatar,
    );
    if (
      !this.done &&
      ct >= this.alert.raidCrowdSeconds &&
      this.world.empty &&
      (!loading || ct >= this.alert.raidCrowdSeconds + 4)
    ) {
      this.done = true;
      queueMicrotask(() => this.onDone?.());
    }
  }
  seek(time) {
    this.fixedTime = time;
    this.render(time);
  }
  tick() {
    this.render(this.fixedTime ?? (performance.now() - this.clockStart) / 1000);
    this.frame = requestAnimationFrame(() => this.tick());
  }
  stop() {
    cancelAnimationFrame(this.frame);
    for (const b of this.bots.values()) b.actor.remove();
    for (const e of this.smokes.values()) e.remove();
    this.bots.clear();
    this.smokes.clear();
    this.entries.clear();
    this.layer.remove();
  }
}
