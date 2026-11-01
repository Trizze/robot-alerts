const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await browser.newPage({
        viewport: { width: 1600, height: 1200 },
      }),
      errors = [],
      writes = [],
      deletes = [];
    p.on("pageerror", (e) => errors.push(e.message));
    let settings = { resolution: "1080p", preset: "03", theme: "default" };
    await p.route("**/robot/api/**", (r) => {
      const u = new URL(r.request().url()),
        method = r.request().method();
      let data = { emotes: [] };
      if (method === "DELETE") {
        deletes.push(u.pathname);
        return r.fulfill({ status: 204 });
      }
      if (u.pathname.endsWith("/api/me"))
        data = {
          viewer: {
            id: "14824099",
            displayName: "Trizze",
            points: 350,
            tier: 3,
            patternScale: 1,
            selectedPattern: "fabric_pattern_07",
            chestType: "none",
            chestValue: "",
            owned: [{ id: "fabric_pattern_07" }],
          },
          channel: true,
          channelStored: true,
          streamer: true,
        };
      if (u.pathname.endsWith("/api/channel/settings")) {
        if (method === "POST") {
          settings = r.request().postDataJSON();
          writes.push(settings);
        }
        data = { channelId: "14824099", settings };
      }
      if (
        u.pathname.endsWith("/appearance") ||
        u.pathname.endsWith("/pattern")
      ) {
        writes.push(r.request().postDataJSON());
        return r.fulfill({ status: 204 });
      }
      if (u.pathname.endsWith("/streamers"))
        data = {
          streamers: [
            { id: "14824099", displayName: "Trizze" },
            { id: "429225647", displayName: "itsTrizze" },
          ],
        };
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    });
    const base = process.env.ROBOT_PREVIEW_URL || "http://127.0.0.1:3902";
    await p.goto(base + "/robot/");
    await p.waitForFunction(
      () => document.querySelector("#viewer-status").hidden,
    );
    await p.waitForFunction(
      () => document.querySelector("#tier").textContent === "TIER 3",
    );
    assert.match(
      await p.locator(".pattern.selected").textContent(),
      /Fabric Pattern 07/,
    );
    assert.deepEqual(
      await p.locator("[data-site-header] nav a").allTextContents(),
      [
        "Your Robot",
        "Streamer Dashboard",
        "Privacy",
        "Get Started",
        "Streamers",
        "How it works",
      ],
    );
    assert.equal(await p.locator("#pattern-scale").getAttribute("step"), "1");
    assert.equal(await p.locator(".preview-panel #pattern-scale").count(), 1);
    assert.equal(
      await p.locator("#tier-progress").getAttribute("value"),
      "0.4",
    );
    await p.locator("#progress-info").click();
    assert.equal(await p.locator(".progress-dialog").isVisible(), true);
    assert.match(
      await p.locator(".progress-dialog").textContent(),
      /500 bits = 1 point/,
    );
    await p.keyboard.press("Escape");
    const before = writes.length;
    await p
      .locator(".pattern")
      .filter({ hasText: "Black Marquina Marble" })
      .click();
    await p.waitForFunction(
      () => !document.querySelector("#locked-preview").hidden,
    );
    await p.waitForTimeout(200);
    assert.equal(writes.length, before, "locked preview must not equip");
    await p
      .locator(".pattern")
      .filter({ hasText: "Fabric Pattern 07" })
      .click();
    await p.waitForTimeout(500);
    assert.equal(await p.locator("#locked-preview").isVisible(), false);
    await p.locator("#pattern-scale").evaluate((e) => {
      e.value = "126";
      e.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await p.waitForTimeout(800);
    assert.ok(writes.some((w) => w.patternScale === 1.26));
    await p
      .locator(".pattern")
      .filter({ hasText: "Black Marquina Marble" })
      .click();
    await p.screenshot({ path: "/tmp/robot-pages-picker-desktop.png" });
    await p.setViewportSize({ width: 390, height: 1000 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.screenshot({ path: "/tmp/robot-pages-picker-mobile.png" });
    await p.setViewportSize({ width: 1440, height: 1100 });
    await p.goto(base + "/robot/dashboard/");
    await p.waitForFunction(() => !document.querySelector("#step-4").hidden);
    assert.equal(await p.locator("#save-design").count(), 0);
    assert.equal(await p.locator("[data-preset]").count(), 10);
    await p.locator('[data-preset="04"]').click();
    await p.locator('[data-preset="02"]').click();
    await p.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.equal(settings.preset, "02");
    await p.locator('[data-preset="none"]').click();
    await p.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.equal(settings.preset, "none");
    assert.equal(await p.locator("#design-preview").isVisible(), false);
    await p.screenshot({ path: "/tmp/robot-pages-dashboard.png" });
    await p.goto(base + "/robot/streamers/");
    await p.waitForSelector(".streamer-link");
    assert.equal(await p.locator(".streamer-link").count(), 2);
    await p.locator("#streamer-search").fill("its");
    assert.equal(await p.locator(".streamer-link").count(), 1);
    await p.screenshot({ path: "/tmp/robot-pages-streamers.png" });
    await p.goto(base + "/robot/privacy/");
    await p.waitForFunction(
      () => !document.querySelector("#data-management").hidden,
    );
    assert.equal(await p.locator("#delete-viewer").isVisible(), false);
    await p.locator("#data-management summary").click();
    await p.locator("#delete-viewer").click();
    assert.equal(await p.locator("#confirm-delete").isDisabled(), true);
    await p.keyboard.press("Escape");
    assert.equal(deletes.length, 0);
    await p.locator("#delete-viewer").click();
    await p.locator("#confirm-word").fill("DELETE");
    await p.locator("#confirm-delete").click();
    await p.waitForFunction(
      () => document.querySelector("#data-management").hidden,
    );
    assert.equal(deletes.length, 1);
    await p.addInitScript(
      () =>
        (window.EventSource = class {
          constructor() {
            window.displayStream = this;
            setTimeout(() => this.onopen?.(), 10);
          }
          close() {}
        }),
    );
    await p.goto(base + "/robot/overlay/?channel=14824099");
    await p.evaluate(() =>
      window.displayStream.onmessage({
        data: JSON.stringify({
          kind: "alert",
          alert: {
            type: "cheer",
            bits: 500,
            viewer: { id: "14824099", name: "Trizze" },
            settings: { preset: "none", theme: "default" },
          },
        }),
      }),
    );
    await p.waitForSelector('[data-ready="true"]', { timeout: 45000 });
    await p.waitForTimeout(3400);
    assert.equal(
      await p
        .locator(".scene-card")
        .evaluate((e) => getComputedStyle(e).opacity),
      "0",
    );
    await p.evaluate(() =>
      window.displayStream.onmessage({
        data: JSON.stringify({
          kind: "settings",
          settings: { preset: "02", theme: "default" },
        }),
      }),
    );
    await p.waitForTimeout(100);
    assert.equal(
      await p
        .locator(".scene-card")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Picker lock/slider/progress, dedicated nav/pages, automatic design saving, no-box live switching, directory and guarded privacy deletion passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
