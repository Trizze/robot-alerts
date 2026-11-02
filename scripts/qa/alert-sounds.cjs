const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const assert = require("node:assert/strict");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const page = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
      errors = [],
      writes = [],
      testEvents = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let settings = {
      resolution: "1080p",
      preset: "03",
      theme: "default",
      events: ["sub", "resub", "gift", "cheer"],
      games: [],
    };
    await page.route("**/robot/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      let value = {};
      if (path.endsWith("/test")) {
        testEvents.push(route.request().postDataJSON());
        value = { sent: true };
      } else if (path.endsWith("/api/me"))
        value = { channel: true, streamer: true };
      else if (path.endsWith("/settings")) {
        if (route.request().method() === "POST") {
          settings = route.request().postDataJSON();
          writes.push(settings);
        }
        value = {
          settings,
          channelId: "123",
          displayName: "Demo streamer",
          followAllowed: true,
        };
      }
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    });
    await page.goto("http://127.0.0.1:3902/robot/dashboard/");
    await page.waitForSelector("#sound-toggle:not(:disabled)");
    await page.locator("#sound-toggle").click();
    assert.equal(
      await page.locator("#alert-sound-controls input[type=file]").count(),
      0,
    );
    assert.equal(await page.locator("#sound-choice option").count(), 6);
    const enabledEvents = [...settings.events];
    const stock = "/robot/sounds/robot-arrival.mp3";
    const saveDone = () =>
      page.waitForFunction(() =>
        document
          .querySelector("#setup-feedback")
          .textContent.startsWith("Design saved"),
      );
    await page.locator("#sound-choice").selectOption(stock);
    await saveDone();
    assert.equal(settings.sounds.sub, stock);
    await page.locator("#sound-all").click();
    await saveDone();
    assert.equal(Object.keys(settings.sounds).length, 6);
    assert.ok(Object.values(settings.sounds).every((src) => src === stock));
    assert.deepEqual(settings.events, enabledEvents);
    for (const src of [
      "/robot/sounds/robot-arrival.mp3",
      "/robot/sounds/arcade-win.mp3",
      "/robot/sounds/soft-chime.mp3",
      "/robot/sounds/power-up.mp3",
      "/robot/sounds/glitch-pop.mp3",
    ]) {
      await page.locator("#sound-choice").selectOption(src);
      await saveDone();
      const duration = await page.evaluate(
        (src) =>
          new Promise((resolve, reject) => {
            const sound = new Audio(src);
            const timeout = setTimeout(
              () => reject(new Error("Audio did not load")),
              5000,
            );
            sound.onloadedmetadata = () => {
              clearTimeout(timeout);
              resolve(sound.duration);
              sound.removeAttribute("src");
              sound.load();
            };
            sound.onerror = () => {
              clearTimeout(timeout);
              reject(new Error("Audio decode failed"));
            };
            sound.load();
          }),
        src,
      );
      assert.ok(duration > 0 && duration < 5);
      await page.locator("#sound-play").click();
    }
    await page.locator("#sound-event").selectOption("gift");
    const chosen = "/robot/sounds/soft-chime.mp3";
    await page.locator("#sound-choice").selectOption(chosen);
    await saveDone();
    assert.equal(settings.sounds.gift, chosen);
    assert.equal(settings.sounds.sub, "/robot/sounds/glitch-pop.mp3");
    await page.locator("#sound-volume").fill("0.35");
    await page.locator("#sound-volume").dispatchEvent("change");
    await page.locator("#sound-delay").fill("0.6");
    await page.locator("#sound-delay").dispatchEvent("change");
    await saveDone();
    assert.equal(settings.soundVolume, 0.35);
    assert.equal(settings.soundDelay, 0.6);
    for (const id of ["test-design", "test-source"]) {
      await page.locator("#" + id).click();
      await page.waitForFunction(() =>
        document
          .querySelector("#setup-feedback")
          .textContent.startsWith("gift test sent"),
      );
    }
    assert.equal(testEvents.length, 2);
    assert.ok(testEvents.every((event) => event.type === "gift"));
    await page.screenshot({
      path: "/tmp/robot-alert-sound-controls.png",
      fullPage: true,
    });
    await page.locator("#sound-choice").selectOption("");
    await saveDone();
    assert.equal(settings.sounds.gift, undefined);
    assert.equal(await page.locator("#sound-play").isDisabled(), true);
    assert.equal(settings.sounds.sub, "/robot/sounds/glitch-pop.mp3");
    await page.locator("#sound-all").click();
    await saveDone();
    assert.deepEqual(settings.sounds, {});
    assert.deepEqual(settings.events, enabledEvents);
    assert.deepEqual(errors, []);
    console.log(
      "Dashboard: five decodable library sounds; no upload control; per-event selection, preview, apply-to-all, silence, autosave, volume/delay and matching tests passed.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    console.log("Mobile: sound controls have no horizontal overflow.");
    const overlay = await b.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    overlay.on("pageerror", (e) => errors.push(e.message));
    await overlay.addInitScript(
      ({ src }) => {
        window.soundPlays = [];
        window.soundStops = [];
        const NativeAudio = window.Audio;
        window.Audio = class extends NativeAudio {
          play() {
            window.soundPlays.push({
              at: performance.now(),
              ready: document.querySelector(".rendered-alert")?.dataset.ready,
            });
            return super.play();
          }
          pause() {
            window.soundStops.push(performance.now());
            super.pause();
          }
        };
        window.EventSource = class {
          constructor() {
            setTimeout(() => {
              this.onopen?.();
              this.onmessage?.({
                data: JSON.stringify({
                  kind: "alert",
                  alert: {
                    type: "raid",
                    demo: true,
                    raidSize: 5,
                    viewer: {
                      id: "123",
                      name: "Demo viewer",
                      avatar: "/robot/assets/twitch-default.webp",
                    },
                    settings: {
                      preset: "03",
                      theme: "default",
                      sounds: { raid: src },
                      soundVolume: 0.2,
                      soundDelay: 0.15,
                    },
                  },
                }),
              });
            }, 100);
          }
          close() {}
        };
      },
      {
        src: "/robot/sounds/soft-chime.mp3",
      },
    );
    await overlay.goto("http://127.0.0.1:3902/robot/overlay/?channel=123");
    await overlay.waitForFunction(() => window.soundPlays.length === 1, {
      timeout: 45000,
    });
    assert.equal(
      await overlay.evaluate(() => window.soundPlays[0].ready),
      "true",
    );
    await overlay.waitForTimeout(3300);
    await overlay.screenshot({ path: "/tmp/robot-alert-sound-playback.png" });
    await overlay.waitForFunction(() => window.soundStops.length > 0, {
      timeout: 20000,
    });
    assert.deepEqual(errors, []);
    console.log(
      "Overlay: audio starts after the sprite assets are ready and stops when the alert finishes; fresh playback has no browser errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
