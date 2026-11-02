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
      writes = [];
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
      if (path.endsWith("/api/me")) value = { channel: true, streamer: true };
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
    await page.locator("#sound-builtin").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.equal(settings.sounds.sub, "/robot/sounds/robot-arrival.mp3");
    await page.locator("#sound-event").selectOption("gift");
    const wav = Buffer.alloc(2044);
    wav.write("RIFF");
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    await page
      .locator("#sound-file")
      .setInputFiles({ name: "test.wav", mimeType: "audio/wav", buffer: wav });
    await page.waitForFunction(
      () =>
        document.querySelector("#sound-status").textContent ===
        "Custom sound selected.",
    );
    await page.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.match(settings.sounds.gift, /^data:audio\/wav;base64,/);
    await page.locator("#sound-volume").fill("0.35");
    await page.locator("#sound-volume").dispatchEvent("change");
    await page.locator("#sound-delay").fill("0.6");
    await page.locator("#sound-delay").dispatchEvent("change");
    await page.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.equal(settings.soundVolume, 0.35);
    assert.equal(settings.soundDelay, 0.6);
    await page.locator("#sound-play").click();
    await page.waitForTimeout(150);
    await page.screenshot({
      path: "/tmp/robot-alert-sound-controls.png",
      fullPage: true,
    });
    await page.locator("#sound-remove").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#setup-feedback")
        .textContent.startsWith("Design saved"),
    );
    assert.equal(settings.sounds.gift, undefined);
    assert.equal(settings.sounds.sub, "/robot/sounds/robot-arrival.mp3");
    await page.locator("#sound-file").setInputFiles({
      name: "fake.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("<script>bad</script>"),
    });
    await page.waitForFunction(
      () =>
        document.querySelector("#sound-status").textContent ===
        "This file is not supported audio.",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Dashboard: per-event upload, preview, volume, delay, autosave, removal and invalid-file rejection passed.",
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
        src:
          settings.sounds.sub === undefined
            ? ""
            : `data:audio/wav;base64,${wav.toString("base64")}`,
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
