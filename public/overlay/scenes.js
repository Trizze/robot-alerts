import { placeAlertPanel } from "/shared/alert-layout.js";
import { MeteorStoryboard } from "./meteor-scene.js";
const NS = "http://www.w3.org/2000/svg";
const node = (tag, cls) => {
  const n = document.createElement(tag);
  n.className = cls;
  return n;
};
const clamp = (value) => Math.max(0, Math.min(1, value));
const phase = (time, start, duration) => clamp((time - start) / duration);
const smooth = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;
export function fitCanvas(stage, width, height) {
  const scale = Math.min(width / 1920, height / 1080);
  stage.style.width = "1920px";
  stage.style.height = "1080px";
  stage.style.transformOrigin = "0 0";
  stage.style.transform = `translate(${(width - 1920 * scale) / 2}px, ${(height - 1080 * scale) / 2}px) scale(${scale})`;
  return scale;
}
export class AlertScene {
  constructor(stage, rig, card, kind, startedAt, alert) {
    Object.assign(this, { stage, rig, card, kind, startedAt, alert });
    this.frame = null;
    this.clockStart = performance.now() - Math.max(0, Date.now() - startedAt);
    this.scale = 3;
    this.fixedTime = null;
    this.root = node("section", `cinematic-scene scene-${kind}`);
    this.root.scene = this;
    this.actor = node("div", "scene-actor");
    this.actor.append(rig.svg);
    this.props = document.createElementNS(NS, "svg");
    this.props.setAttribute("viewBox", "0 0 1920 1080");
    this.props.setAttribute("class", "scene-props");
    this.props.setAttribute("aria-hidden", "true");
    this.panel = node("div", "scene-card");
    this.panel.append(card);
    placeAlertPanel(this.panel);
    this.root.append(this.props, this.actor, this.panel);
    stage.append(this.root);
    if (kind === "meteor") this.storyboard = new MeteorStoryboard(this);
    else if (kind === "custom") this.buildCustom();
    else this.buildButton();
    this.root.dataset.animation = kind;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.tick();
  }
  place(x, y, angle = 0) {
    this.position = { x, y, angle };
    const b = this.rig.bounds,
      f = this.rig.foot,
      s = this.scale;
    Object.assign(this.actor.style, {
      width: `${b.width * s}px`,
      height: `${b.height * s}px`,
      left: `${x - (f.x - b.x) * s}px`,
      top: `${y - (f.y - b.y) * s}px`,
      transformOrigin: `${(f.x - b.x) * s}px ${(f.y - b.y) * s}px`,
      transform: `rotate(${angle}deg)`,
    });
  }
  local(point) {
    const p = this.position,
      a = (-p.angle * Math.PI) / 180,
      x = point.x - p.x,
      y = point.y - p.y;
    return {
      x: this.rig.foot.x + (x * Math.cos(a) - y * Math.sin(a)) / this.scale,
      y: this.rig.foot.y + (x * Math.sin(a) + y * Math.cos(a)) / this.scale,
    };
  }
  world(point) {
    const p = this.position,
      a = (p.angle * Math.PI) / 180,
      x = (point.x - this.rig.foot.x) * this.scale,
      y = (point.y - this.rig.foot.y) * this.scale;
    return {
      x: p.x + x * Math.cos(a) - y * Math.sin(a),
      y: p.y + x * Math.sin(a) + y * Math.cos(a),
    };
  }
  showPanel(time, start) {
    const t =
      smooth(phase(time, start, 0.5)) *
      (1 - smooth(phase(time, start + (this.alert?.textDuration ?? 6), 0.25)));
    placeAlertPanel(this.panel);
    this.panel.style.opacity = String(t);
    this.panel.style.clipPath = "none";
    const typed = this.panel.querySelector(".name-typed");
    if (typed)
      typed.style.clipPath = `inset(0 ${(1 - phase(time, start, 0.45)) * 100}% 0 0)`;
    if (t > 0 && !this.panel.classList.contains("revealed"))
      this.panel.classList.add("revealed");
  }
  buildButton() {
    this.rig.setDirection("right");
    this.floor = 940;
    const shoulder = this.rig.getSocket("right-shoulder");
    this.button = {
      x: 610,
      y: this.floor + (shoulder.y - this.rig.foot.y) * this.scale + 6,
    };
    this.stopX =
      this.button.x -
      (shoulder.x - this.rig.foot.x) * this.scale -
      this.rig.reach * this.scale * 0.78;
    this.finalX = Math.min(
      this.stopX - 90,
      710 - (this.rig.bounds.width * this.scale) / 2 - 24,
    );
    this.props.innerHTML =
      '<g data-prop="button"><path data-prop="pedestal" fill="#718782" stroke="#20353c" stroke-width="6"/><rect data-prop="button-cap" width="66" height="20" rx="3" fill="#db8976" stroke="#20353c" stroke-width="5"/><path data-prop="floor" stroke="#60736e" stroke-width="4"/></g><g data-prop="press-feedback" fill="none" stroke="#c8efb4" stroke-width="5"><path data-prop="press-rays"/></g>';
    this.cap = this.props.querySelector("[data-prop=button-cap]");
    const x = this.button.x,
      y = this.button.y;
    this.props
      .querySelector("[data-prop=pedestal]")
      .setAttribute(
        "d",
        `M${x - 19} ${y + 10}h38v${this.floor - y - 18}h21v12h-80v-12h21z`,
      );
    this.props
      .querySelector("[data-prop=floor]")
      .setAttribute("d", `M${x - 60} ${this.floor + 5}h120`);
  }
  runButton(time) {
    const run = smooth(phase(time, 0, 3)),
      push = smooth(phase(time, 3.65, 0.5)),
      start = -this.rig.bounds.width * this.scale;
    const x =
      time < 3
        ? mix(start, this.stopX, run)
        : mix(this.stopX, this.finalX, push);
    this.rig.setDirection(
      time < 4.15 ? "right" : time < 4.5 ? "front-right" : "front",
    );
    let footY = this.floor + 5 - 8 * this.scale;
    if (time < 3) {
      this.rig.setLocomotion((x - start) / this.scale);
      footY = this.floor + 5 - this.rig.gait.soleOffset * this.scale;
    } else
      this.rig.setPose(time >= 3.65 && time < 4.7 ? "recover" : "idle", time);
    this.place(
      x,
      footY,
      time >= 3.65 && time < 4.7
        ? -Math.sin(phase(time, 3.65, 1.05) * Math.PI) * 12
        : 0,
    );
    if (time >= 3 && time < 3.8) {
      const shoulder = this.rig.getSocket("right-shoulder"),
        t = smooth(phase(time, 3, 0.4)),
        depress = time >= 3.4 ? 7 * smooth(phase(time, 3.4, 0.12)) : 0;
      const target = this.local({
        x: this.button.x,
        y: this.button.y - 8 + depress,
      });
      this.rig.pressRight({
        x: mix(shoulder.x, target.x, t),
        y: mix(shoulder.y + this.rig.reach, target.y, t),
      });
    }
    const press = smooth(phase(time, 3.4, 0.12)),
      x0 = this.button.x,
      y0 = this.button.y - 10 + press * 7;
    this.cap.setAttribute("x", x0 - 33);
    this.cap.setAttribute("y", y0);
    this.cap.setAttribute("fill", time >= 3.4 ? "#b8e69c" : "#db8976");
    const f = phase(time, 3.4, 0.35),
      visible = time >= 3.4 && time < 3.75 && !this.reduced;
    const rays = this.props.querySelector("[data-prop=press-rays]"),
      r = 46 + f * 24;
    rays.setAttribute(
      "d",
      `M${x0 - r} ${y0 - 8}l-12-8M${x0 + r} ${y0 - 8}l12-8M${x0} ${y0 - r / 2}v-15`,
    );
    this.props.querySelector("[data-prop=press-feedback]").style.opacity =
      visible ? String(1 - f) : "0";
    this.showPanel(time, 3.65);
    this.root.dataset.phase =
      time < 3
        ? "running"
        : time < 3.4
          ? "pressing"
          : time < 3.65
            ? "pressed"
            : time < 4.7
              ? "pushed"
              : "idle";
  }
  buildCustom() {
    const src = this.alert?.settings.customMedia?.[this.alert.type];
    if (src) {
      const video = /\.(mp4|webm)$/.test(src);
      this.media = document.createElement(video ? "video" : "img");
      this.media.className = "custom-media";
      if (video) {
        this.media.muted = false;
        this.media.loop = true;
        this.media.playsInline = true;
      } else this.media.alt = "";
      this.media.src = src;
      this.root.append(this.media);
    }
  }
  runCustom(time) {
    const start = -this.rig.bounds.width * this.scale,
      end = 510,
      run = smooth(phase(time, 0, 3)),
      x = mix(start, end, run),
      floor = 940;
    this.rig.setDirection(time < 3 ? "front-right" : "front");
    if (time < 3) this.rig.setLocomotion((x - start) / this.scale);
    else this.rig.setPose("idle", time);
    this.place(
      x,
      floor - (time < 3 ? this.rig.gait.soleOffset : 8) * this.scale,
    );
    this.showPanel(time, 3);
    if (this.media) {
      this.media.style.opacity = this.panel.style.opacity;
      if (this.media.tagName === "VIDEO") {
        if (time >= 3 && !this.mediaStarted) {
          this.mediaStarted = true;
          this.media.play().catch(() => {
            this.media.muted = true;
            this.media.play().catch(() => {});
          });
        } else if (time < 3 && this.mediaStarted) {
          this.media.pause();
          this.media.currentTime = 0;
          this.mediaStarted = false;
        }
      }
    }
    this.root.dataset.phase = time < 3 ? "running" : "custom-alert";
  }
  renderAt(time) {
    const t = this.reduced
      ? Math.max(time, this.storyboard ? this.storyboard.timing.dance : 4)
      : time;
    if (this.kind === "meteor") this.storyboard.render(t);
    else if (this.kind === "custom") this.runCustom(t);
    else this.runButton(t);
  }
  seek(time) {
    this.fixedTime = time;
    this.renderAt(time);
  }
  tick() {
    this.renderAt(
      this.fixedTime ??
        Math.max(0, (performance.now() - this.clockStart) / 1000),
    );
    this.frame = requestAnimationFrame(() => this.tick());
  }
  stop() {
    if (this.media?.tagName === "VIDEO") {
      this.media.pause();
      this.media.removeAttribute("src");
      this.media.load();
    }
    this.storyboard?.stop();
    cancelAnimationFrame(this.frame);
    this.root.remove();
  }
}
