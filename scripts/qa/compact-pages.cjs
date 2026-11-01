const {
    chromium,
  } = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core"),
  assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } }),
      errors = [],
      writes = [];
    let botEnabled = false;
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("**/robot/api/**", (r) => {
      const u = new URL(r.request().url());
      let d = {
        emotes: JSON.parse(
          fs.readFileSync("website-staging/global-emotes.json"),
        ).emotes,
      };
      if (u.pathname.endsWith("/api/me"))
        d = {
          viewer: {
            id: "123",
            displayName: "Viewer",
            points: 350,
            tier: 3,
            patternScale: 1,
            chestType: "none",
            chestValue: "",
            selectedPattern: "fabric_pattern_07",
            owned: [{ id: "fabric_pattern_07", isNew: true }],
          },
          streamer: true,
          channel: true,
        };
      if (u.pathname.endsWith("/api/channel/settings")) {
        if (r.request().method() === "POST")
          writes.push(r.request().postDataJSON());
        d = {
          channelId: "123",
          displayName: "Streamer",
          followAllowed: true,
          channelBot: {
            enabled: botEnabled,
            available: true,
            name: "TrizzeBot",
          },
          canManageBot: false,
          settings: {
            preset: "02",
            resolution: "1080p",
            theme: "default",
            events: ["sub", "resub", "gift", "cheer"],
            games: [],
          },
        };
      }
      if (u.pathname.endsWith("/api/channel/bot")) {
        botEnabled = r.request().method() !== "DELETE";
        d = { enabled: botEnabled, available: true, name: "TrizzeBot" };
      }
      if (u.pathname.includes("/streamers"))
        d = {
          streamers: [
            {
              id: "123",
              displayName: "Streamer",
              live: true,
              avatar: "/robot/assets/twitch-default.webp",
              games: ["VALORANT"],
            },
            {
              id: "456",
              displayName: "Other",
              live: false,
              category: "Just Chatting",
            },
          ],
        };
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(d),
      });
    });
    const base = process.env.ROBOT_PREVIEW_URL || "http://127.0.0.1:3902";
    for (const size of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      await p.setViewportSize(size);
      for (const route of [
        "/robots/",
        "/robot/",
        "/robot/dashboard/",
        "/robot/privacy/",
        "/robot/how-it-works/",
        "/robot/streamers/",
        "/robot/start/",
      ]) {
        await p.goto(base + route);
        await p.waitForTimeout(500);
        const box = await p.evaluate(() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
          header: Math.round(
            document.querySelector("[data-site-header]").getBoundingClientRect()
              .left,
          ),
        }));
        assert.ok(
          box.w <= size.width,
          route + " horizontal overflow " + JSON.stringify(box),
        );
        assert.ok(
          box.h <= size.height,
          route + " vertical overflow " + JSON.stringify(box),
        );
        assert.equal(box.header, size.width === 1366 ? 107 : 14);
        console.log(size.width, route, "fits");
        await p.screenshot({
          path:
            "/tmp/compact-" +
            size.width +
            "-" +
            route.split("/").filter(Boolean).join("-") +
            ".png",
        });
      }
    }
    await p.setViewportSize({ width: 1366, height: 768 });
    await p.goto(base + "/robot/");
    await p.waitForSelector(".pattern");
    assert.match(
      await p.locator(".pattern").first().textContent(),
      /Fabric Pattern 07/,
    );
    assert.equal(await p.locator(".pattern-new").count(), 1);
    await p.locator("#chest-kind").selectOption("emote");
    await p.waitForSelector(".emote-choice");
    assert.equal(await p.locator(".emote-choice").count(), 307);
    assert.equal(await p.locator("[data-emote-more]").isVisible(), false);
    await p.goto(base + "/robot/dashboard/");
    await p.waitForSelector("#event-options input");
    await p.locator("#connect-channel-bot").click();
    await p.waitForFunction(
      () =>
        document.querySelector("#connect-channel-bot").textContent ===
        "Disconnect TrizzeBot",
    );
    assert.equal(await p.locator("#authorize-service-bot").count(), 0);
    await p.locator("#connect-channel-bot").click();
    await p.waitForFunction(
      () =>
        document.querySelector("#connect-channel-bot").textContent ===
        "Connect TrizzeBot",
    );
    await p.locator('#event-options input[value="raid"]').check();
    await p.waitForTimeout(500);
    assert.ok(writes.some((x) => x.events.includes("raid")));
    await p.goto(base + "/robots/");
    await p.waitForSelector('[data-pitch-viewer][data-ready="true"]', {
      timeout: 60000,
    });
    const c = p.locator("[data-pitch-viewer] canvas"),
      a = await c.screenshot();
    const rect = await c.boundingBox();
    await p.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await p.mouse.down();
    await p.mouse.move(
      rect.x + rect.width / 2 + 100,
      rect.y + rect.height / 2,
      { steps: 15 },
    );
    await p.mouse.up();
    await p.waitForTimeout(300);
    assert.notDeepEqual(a, await c.screenshot(), "pitch robot must rotate");
    await p.locator("#watch-demo").click();
    assert.ok(
      (await p.locator("#demo-dialog").boundingBox()).width > 1000,
      "demo should open at cinema size on desktop",
    );
    await p.waitForFunction(
      () => document.querySelector("#demo-dialog video").currentTime > 4,
      { timeout: 15000 },
    );
    await p.screenshot({ path: "/tmp/compact-fresh-demo.png" });
    assert.deepEqual(errors, []);
    console.log(
      "No errors. 307 global emotes, owned-first NEW markers, event autosave, interactive pitch and fresh demo playback passed.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
