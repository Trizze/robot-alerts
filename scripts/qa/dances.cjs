const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await b.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: "/tmp/robot-dance-recordings",
      size: { width: 1920, height: 1080 },
    },
  });
  try {
    const p = await context.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("http://127.0.0.1:3902/robot/overlay/");
    await p.addStyleTag({
      content:
        "body{background:#13151d!important}#connection{display:none!important}",
    });
    for (const [index, dance] of [
      "dance-shuffle",
      "dance-disco",
      "dance-victory",
    ].entries()) {
      await p.evaluate(
        async ({ dance, index }) => {
          window.danceView?.stop();
          window.finished = false;
          window.renderFailure = null;
          const { SpriteScene } = await import(
            "/robot/overlay/sprite-scene.js?v=dances-1"
          );
          const { createAlertCard } = await import(
            "/robot/shared/alert-card.js"
          );
          const alert = {
            dance,
            startedAt: Date.now(),
            type: ["cheer", "resub", "sub"][index],
            textDuration: 3,
            bits: 500,
            months: 12,
            tier: "1000",
            viewer: {
              id: "123",
              name: ["PixelPilot", "CosmicCat", "CircuitFox"][index],
              avatar: "/robot/assets/twitch-default.webp",
              selectedPattern: [
                "black_marquina_marble",
                "fabric_pattern_07",
                "crinkled_gold_foil",
              ][index],
              patternScale: 1,
              chestType: "emoji",
              chestValue: ["😊", "🚀", "⭐"][index],
            },
            settings: {
              theme: "default",
              card: { preset: ["02", "08", "04"][index] },
            },
          };
          window.danceView = new SpriteScene(
            document.querySelector("#stage"),
            createAlertCard(alert),
            alert,
            () => {
              window.finished = true;
              window.danceView.stop();
            },
            (error) => {
              window.renderFailure = error.message;
            },
          );
        },
        { dance, index },
      );
      await p.waitForFunction(
        () =>
          window.danceView?.root.dataset.ready === "true" ||
          window.renderFailure,
        { timeout: 60000 },
      );
      assert.equal(await p.evaluate(() => window.renderFailure), null);
      assert.equal(
        await p.locator(".rendered-alert").getAttribute("data-dance"),
        dance,
      );
      await p.waitForTimeout(3400);
      const first = await p.evaluate(() => window.danceView.canvas.toDataURL());
      await p.screenshot({ path: `/tmp/${dance}-1080.png` });
      await p.waitForTimeout(700);
      const next = await p.evaluate(() => window.danceView.canvas.toDataURL());
      assert.notEqual(first, next, "Dance must visibly move during the hold");
      assert.equal(
        await p.locator(".rendered-alert").getAttribute("data-dance"),
        dance,
      );
      await p.waitForFunction(() => window.finished, { timeout: 20000 });
      assert.equal(await p.locator(".rendered-alert").count(), 0);
      console.log(
        "Fresh playback, patterned body, fixed selected dance and cleanup:",
        dance,
      );
    }
    await p.setViewportSize({ width: 2560, height: 1440 });
    await p.evaluate(async () => {
      const { SpriteScene } = await import(
        "/robot/overlay/sprite-scene.js?v=dances-1"
      );
      const { createAlertCard } = await import("/robot/shared/alert-card.js");
      const a = {
        dance: "dance-disco",
        startedAt: Date.now(),
        type: "raid",
        raidSize: 12,
        textDuration: 3,
        viewer: {
          id: "123",
          name: "Demo raider",
          avatar: "/robot/assets/twitch-default.webp",
          selectedPattern: "fabric_pattern_07",
          patternScale: 1,
          chestType: "emoji",
          chestValue: "🚀",
        },
        settings: { theme: "default", card: { preset: "03" } },
      };
      window.danceView = new SpriteScene(
        document.querySelector("#stage"),
        createAlertCard(a),
        a,
        () => window.danceView.stop(),
        (e) => (window.renderFailure = e.message),
      );
    });
    await p.waitForFunction(
      () => window.danceView.root.dataset.ready === "true",
    );
    await p.waitForTimeout(3700);
    await p.screenshot({ path: "/tmp/dance-disco-1440.png" });
    assert.deepEqual(errors, []);
    assert.equal(await p.evaluate(() => window.renderFailure), null);
    await p.evaluate(() => window.danceView.stop());
    const video = p.video();
    await p.close();
    await video.saveAs("/tmp/robot-dances-review.webm");
    console.log(
      "1440p preview and zero browser errors passed; video /tmp/robot-dances-review.webm",
    );
  } finally {
    await context.close();
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
