// Deterministic 30 fps screenshots of the actual overlay, including its HTML card.
const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const root = path.resolve("assets/robot/site-demo");
  fs.mkdirSync(root, { recursive: true });
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://static-cdn.jtvnw.net/robot-demo-default.png", (r) =>
      r.fulfill({
        path: "assets/robot/site-demo/twitch-default.png",
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      }),
    );
    await p.goto("http://127.0.0.1:3902/robot/overlay/");
    await p.addStyleTag({
      content:
        "body{background:#14151e url(../assets/demo-background.webp) center/cover no-repeat!important} #connection{display:none!important}",
    });
    const variants = [
      {
        pattern: "black_marquina_marble",
        chest: "304486301",
        preset: "02",
        type: "cheer",
        name: "PixelPilot",
      },
      {
        pattern: "fabric_pattern_07",
        chest: "emotesv2_5d523adb8bbb4786821cd7091e47da21",
        preset: "08",
        type: "resub",
        name: "CosmicCat",
      },
    ];
    let frame = 0;
    for (const [episode, v] of variants.entries()) {
      await p.evaluate(async (v) => {
        window.demoScene?.stop();
        const { SpriteScene } = await import("./sprite-scene.js?v=fast-1");
        const { createAlertCard } = await import("../shared/alert-card.js");
        const alert = {
          type: v.type,
          bits: 500,
          months: 12,
          textDuration: 6,
          startedAt: Date.now(),
          viewer: {
            id: "demo-viewer",
            name: v.name,
            avatar: "https://static-cdn.jtvnw.net/robot-demo-default.png",
            selectedPattern: v.pattern,
            patternScale: 1,
            chestType: "emote",
            chestValue: v.chest,
          },
          settings: {
            theme: "default",
            scale: 1,
            showAlertBox: true,
            card: { preset: v.preset },
          },
        };
        window.demoScene = new SpriteScene(
          document.querySelector("#stage"),
          createAlertCard(alert),
          alert,
          () => {},
          (e) => {
            throw e;
          },
        );
      }, v);
      await p.waitForSelector('[data-ready="true"]', { timeout: 60000 });
      const info = await p.evaluate(() => {
        const s = window.demoScene;
        cancelAnimationFrame(s.frame);
        s.stopped = true;
        return {
          pattern: s.alert.viewer.selectedPattern,
          chestFrames: s.alert.viewer._chestSurface.frames.length,
        };
      });
      console.log(info);
      for (let i = 0; i < 330; i++) {
        await p.evaluate((t) => {
          window.demoScene.render(t);
          for (const a of document.getAnimations()) {
            a.pause();
            a.currentTime = Math.max(0, (t - 2.95) * 1000);
          }
        }, i / 30);
        const file = path.join(
          root,
          `frame_${String(frame++).padStart(4, "0")}.jpg`,
        );
        await p.screenshot({
          path: file,
          type: "jpeg",
          quality: 94,
          clip: { x: 0, y: 0, width: 1920, height: 1080 },
        });
        if (i === 125)
          fs.copyFileSync(
            file,
            path.join(root, `episode-${episode + 1}-review.jpg`),
          );
        if (i === 125 && episode === 1)
          fs.copyFileSync(
            file,
            "website-staging/examples/16-patterns-emotes-poster.jpg",
          );
      }
      const hero = await p.evaluate(async () => {
        const s = window.demoScene,
          { drawRobot } = await import("./sprite-renderer.js?v=fast-1");
        const source = document.createElement("canvas");
        source.width = 1920;
        source.height = 1080;
        drawRobot(
          source.getContext("2d"),
          s.atlas,
          "idle",
          0,
          s.alert.viewer,
          s.alert,
          4,
        );
        const out = document.createElement("canvas");
        out.width = 720;
        out.height = 1080;
        out
          .getContext("2d")
          .drawImage(source, 500, 280, 360, 540, 0, 0, 720, 1080);
        return out.toDataURL("image/png").split(",")[1];
      });
      fs.writeFileSync(
        path.join(root, `robot-${episode + 1}.png`),
        Buffer.from(hero, "base64"),
      );
      console.log(
        "Recorded episode",
        episode + 1,
        "with",
        v.pattern,
        "and design",
        v.preset,
      );
    }
    if (errors.length) throw Error(errors.join(";"));
    console.log(
      "Captured",
      frame,
      "frames, actual 30 fps timeline, no browser errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
