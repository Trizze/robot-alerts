// Fixed-step, bounded raid crowd. Each participant crosses in one direction.
export class RaidStream {
  constructor() {
    this.time = 0;
    this.pending = [];
    this.actors = [];
    this.clouds = [];
    this.stats = { crossed: 0, collisions: 0 };
  }
  add(viewer, at, sequence) {
    if (
      !viewer?.avatar ||
      !Number.isFinite(at) ||
      this.pending.length + this.actors.length >= 128
    )
      return false;
    this.pending.push({ viewer, at: Math.max(at, this.time), sequence });
    return true;
  }
  step(dt = 1 / 60) {
    this.time += dt;
    for (let i = 0; i < this.pending.length && this.actors.length < 12; ) {
      const p = this.pending[i];
      if (p.at > this.time) {
        i++;
        continue;
      }
      this.pending.splice(i, 1);
      const lane = Math.floor(p.sequence / 2) % 6,
        direction = p.sequence % 2 === 0 ? 1 : -1;
      this.actors.push({
        ...p,
        lane,
        direction,
        x: direction > 0 ? -160 : 2080,
        y: 210 + lane * 150 + (((p.sequence * 37) % 61) - 30),
        vx: direction * 315,
        age: 0,
        state: "run",
        impact: 0,
      });
    }
    for (const a of this.actors) {
      a.age += dt;
      if (a.state === "impact") {
        a.impact += dt;
        continue;
      }
      a.x += a.vx * dt;
    }
    for (let i = 0; i < this.actors.length; i++)
      for (let j = i + 1; j < this.actors.length; j++) {
        const a = this.actors[i],
          b = this.actors[j];
        if (
          a.state !== "run" ||
          b.state !== "run" ||
          Math.abs(a.y - b.y) > 150 ||
          Math.abs(a.x - b.x) > 100 ||
          a.x < 40 ||
          a.x > 1880 ||
          b.x < 40 ||
          b.x > 1880
        )
          continue;
        a.state = b.state = "impact";
        this.stats.collisions++;
        this.clouds.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, age: 0 });
      }
    for (const c of this.clouds) c.age += dt;
    this.clouds = this.clouds.filter((c) => c.age < 0.8);
    this.actors = this.actors.filter((a) => {
      if (a.state === "impact") return a.impact < 0.28;
      if (a.x > 2100 || a.x < -180) {
        this.stats.crossed++;
        return false;
      }
      return true;
    });
  }
  advance(target) {
    let n = 0;
    while (this.time + 1 / 60 <= target && n++ < 5400) this.step();
  }
  get empty() {
    return !this.pending.length && !this.actors.length && !this.clouds.length;
  }
}
