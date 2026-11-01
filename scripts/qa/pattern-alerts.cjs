// Run against a local static server. PLAYWRIGHT_CORE and CHROMIUM name existing tools.
const { chromium } = require(
  process.env.PLAYWRIGHT_CORE ||
    "/tmp/robot-alerts-browser-tools/node_modules/playwright-core",
);
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const output = path.resolve("assets/robot/pattern-motion/review");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/tmp/chromium",
    args: [
      "--no-sandbox",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://static-cdn.jtvnw.net/pattern-demo.svg", (r) =>
    r.fulfill({
      path: "public/assets/avatars/nova.svg",
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.addInitScript(() => {
    window.EventSource = class {
      constructor() {
        window.displayStream = this;
        setTimeout(() => this.onopen?.(), 20);
      }
      close() {}
    };
  });
  await page.goto(
    (process.env.ROBOT_PREVIEW_URL || "http://127.0.0.1:3901") +
      "/overlay/?channel=123",
  );
  await page.addStyleTag({ content: "body{background:#24272c!important}" });
  await page.evaluate(async () => {
    const m = await import("./sprite-renderer.js?v=patterns-1");
    await m.motionReady;
    const avatar = m.avatarFor({
      avatar: "https://static-cdn.jtvnw.net/pattern-demo.svg",
    });
    await avatar.decode();
  });
  const patterns = [
    "green_marble_pattern_tiles",
    "crinkled_gold_foil",
    "black_and_white_graphic_marble_tiles",
  ];
  for (const [number, pattern] of patterns.entries()) {
    const started = Date.now();
    await page.evaluate(
      ({ pattern, number }) =>
        window.displayStream.onmessage({
          data: JSON.stringify({
            kind: "alert",
            alert: {
              key: pattern,
              type: "cheer",
              bits: 500,
              viewer: {
                id: "123",
                name: "Demo viewer",
                avatar: "https://static-cdn.jtvnw.net/pattern-demo.svg",
                selectedPattern: pattern,
                patternScale: 1,
              },
              settings: {
                preset: ["03", "04", "07"][number],
                theme: "default",
              },
            },
          }),
        }),
      { pattern, number },
    );
    // Fresh playback, no seeking. First case deliberately includes cold surface-map loading.
    await page.waitForSelector('.cinematic-scene[data-ready="true"]', {
      timeout: 45000,
    });
    await page.waitForTimeout(1500);
    assert.equal(
      await page.locator("#connection").isVisible(),
      false,
      "pattern asset loading failed",
    );
    await page.screenshot({
      path: path.join(output, pattern + "-arrival.png"),
    });
    await page.waitForTimeout(1900);
    await page.screenshot({ path: path.join(output, pattern + "-idle.png") });
    await page.waitForSelector(".cinematic-scene", {
      state: "detached",
      timeout: 22000,
    });
    console.log(
      "Fresh playback and cleanup passed:",
      pattern,
      "elapsed",
      Date.now() - started,
    );
  }
  // Compare sizes and ensure baseline/profile/chest are preserved in the same final pose.
  await page.evaluate(async () => {
    const { motionReady, drawRobot, avatarFor } = await import(
      "./sprite-renderer.js?v=patterns-1"
    );
    const { preparePattern } = await import("./pattern-loader.js?v=patterns-1");
    const atlas = await motionReady,
      stage = document.querySelector("#stage");
    stage.replaceChildren();
    for (const [i, scale] of [0.5, 1, 2].entries()) {
      const viewer = {
        id: "123",
        name: "Demo viewer",
        avatar: "https://static-cdn.jtvnw.net/pattern-demo.svg",
        selectedPattern: "crinkled_gold_foil",
        patternScale: scale,
      };
      viewer._patternSurface = await preparePattern(viewer);
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      drawRobot(canvas.getContext("2d"), atlas, "idle", 0, viewer, {
        type: "cheer",
        bits: 500,
      });
      const cropped = document.createElement("canvas");
      cropped.width = 400;
      cropped.height = 700;
      cropped
        .getContext("2d")
        .drawImage(canvas, 480, 250, 400, 700, 0, 0, 400, 700);
      cropped.style = `position:absolute;left:${200 + i * 480}px;top:180px`;
      stage.append(cropped);
      const label = document.createElement("p");
      label.textContent = `Pattern size ${scale * 100}%`;
      label.style = `position:absolute;left:${260 + i * 480}px;top:110px;color:white;font:30px Arial`;
      stage.append(label);
    }
  });
  await page.screenshot({ path: path.join(output, "pattern-sizes.png") });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log("Pattern scale comparison captured; no browser errors.");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
