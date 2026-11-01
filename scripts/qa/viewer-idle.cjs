// Measure actual WebGL draws rather than the implementation's scheduling flags.
const {
    chromium,
  } = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core"),
  assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await p.addInitScript(() => {
      window.robotDraws = 0;
      for (const P of [
        WebGLRenderingContext.prototype,
        WebGL2RenderingContext.prototype,
      ])
        for (const name of ["drawElements", "drawArrays"]) {
          const old = P[name];
          P[name] = function (...args) {
            window.robotDraws++;
            return old.apply(this, args);
          };
        }
    });
    await p.route("**/robot/api/**", (r) =>
      r.fulfill({ status: 401, body: "{}", contentType: "application/json" }),
    );
    const base = process.env.ROBOT_PREVIEW_URL || "http://127.0.0.1:3902";
    await p.goto(base + "/robot/");
    await p.waitForFunction(
      () => document.querySelector("#viewer-status").hidden,
    );
    await p.waitForTimeout(1600);
    const count = await p.evaluate(() => window.robotDraws);
    assert.ok(count > 0);
    await p.waitForTimeout(600);
    assert.equal(
      await p.evaluate(() => window.robotDraws),
      count,
      "static picker makes zero WebGL draws",
    );
    const rect = await p.locator("#robot-view").boundingBox();
    await p.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await p.mouse.down();
    await p.mouse.move(rect.x + rect.width / 2 + 80, rect.y + rect.height / 2, {
      steps: 10,
    });
    await p.mouse.up();
    let moved = 0,
      settled = false;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(300);
      const next = await p.evaluate(() => window.robotDraws);
      if (next === moved) {
        settled = true;
        break;
      }
      moved = next;
    }
    assert.ok(moved > count);
    assert.ok(settled, "rotation must settle back to zero idle draws");
    await p.locator("#chest-kind").selectOption("emote");
    await p
      .getByRole("button", {
        name: "Choose YappingDuck (animated)",
        exact: true,
      })
      .click();
    await p.waitForTimeout(1800);
    const animated = await p.evaluate(() => window.robotDraws);
    await p.waitForTimeout(500);
    assert.ok(
      (await p.evaluate(() => window.robotDraws)) > animated,
      "animated emote continues rendering",
    );
    await p.locator("#chest-kind").selectOption("none");
    await p.locator("#chest-apply").click();
    await p.waitForTimeout(900);
    const stopped = await p.evaluate(() => window.robotDraws);
    await p.waitForTimeout(500);
    assert.equal(
      await p.evaluate(() => window.robotDraws),
      stopped,
      "removing animation stops GPU work",
    );
    console.log(
      "Zero idle draws, responsive rotation, animated-emote playback and return to idle passed.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
