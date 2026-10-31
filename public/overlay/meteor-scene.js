import { ALERT_LAYOUT, placeAlertPanel } from "/shared/alert-layout.js";
import { createMeteorTimeline } from "./meteor-timeline.js";
export class MeteorStoryboard {
  constructor(scene) {
    this.scene = scene;
    this.rig = scene.rig;
    scene.scale = 2.5;
    this.rig.setDirection("front");
    Object.assign(
      this,
      createMeteorTimeline(
        globalThis.gsap,
        1.85 + (scene.alert?.textDuration ?? 6),
      ),
    );
    const { x, y, width, height } = ALERT_LAYOUT;
    scene.props.replaceChildren();
    scene.root.dataset.storyboard = "meteor";
  }
  render(time) {
    const { scene: s, rig, state: v, timing: t } = this;
    this.timeline.time(Math.max(0, Math.min(time, t.end)), false);
    const { y, height } = ALERT_LAYOUT,
      lineY = y + height;
    // The head is always front-facing; the whole rig turns sideways on impact,
    // so the actual avatar rotates 90 degrees with the monitor rather than hiding.
    rig.setDirection("front");
    const dancing = time >= t.dance && !s.reduced,
      beat = dancing ? v.dance : 0;
    let footY = v.y;
    let angle = v.angle;
    if (time < t.lying) rig.setPose("recover", 0);
    else if (time < t.launch) rig.setPose("crashed", 0);
    else if (time < t.land) rig.setPose("recover", 0);
    else if (time < t.dance) rig.setPose("recover", 0);
    else rig.setPose(dancing ? "dance" : "idle", beat);
    if (dancing) {
      angle += Math.sin(beat) * 5;
      footY -= Math.abs(Math.sin(beat)) * 9;
    }
    // Rest the sideways monitor's lower edge on the line/card top. Equipment
    // dimensions remain part of the shared rig instead of a baked crash sprite.
    if (time >= t.lying && time < t.launch)
      footY = lineY - height * v.growth - (rig.model.head.width * s.scale) / 2;
    if (time >= t.land) {
      // Pose-aware sole contact, including equipped leg length and dance tilt.
      const a = (angle * Math.PI) / 180,
        soles = ["left-foot", "right-foot"].map((name) => {
          const p = rig.getSocket(name),
            dx = (p.x - rig.foot.x) * s.scale,
            dy = (p.y - rig.foot.y + 8) * s.scale;
          return dx * Math.sin(a) + dy * Math.cos(a);
        });
      footY =
        y - Math.max(...soles) - (dancing ? Math.abs(Math.sin(beat)) * 9 : 0);
    }
    s.place(v.x + (dancing ? Math.sin(beat) * 8 : 0), footY, angle);
    placeAlertPanel(s.panel);
    s.panel.style.opacity =
      v.growth > 0 && time < t.grow + (s.alert?.textDuration ?? 6)
        ? String(v.fade)
        : "0";
    s.panel.style.clipPath = `inset(${(1 - v.growth) * 100}% 0 0 0)`;
    const typed = s.panel.querySelector(".name-typed");
    if (typed) typed.style.clipPath = `inset(0 ${(1 - v.typed) * 100}% 0 0)`;
    s.actor.style.opacity = String(v.fade);
    s.root.dataset.phase =
      time < t.impact
        ? "fall"
        : time < t.lying
          ? "impact"
          : time < t.grow
            ? "lying"
            : time < t.launch
              ? "grow"
              : time < t.land
                ? "airborne"
                : time < t.dance
                  ? "land"
                  : time < t.exit
                    ? "dance"
                    : "exit";
  }
  stop() {
    this.timeline.kill();
  }
}
