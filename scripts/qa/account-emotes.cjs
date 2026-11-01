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
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let mode = "ok",
      pending = [],
      saved = [];
    await page.route("**/robot/api/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/api/me")) {
        if (url.searchParams.get("profile") !== "0")
          await new Promise((resolve) => pending.push(resolve));
        return route.fulfill({
          status: mode === "offline" ? 503 : mode === "guest" ? 401 : 200,
          contentType: "application/json",
          body: JSON.stringify({
            viewer: {
              id: "14824099",
              displayName: "Trizze",
              points: 1000,
              tier: 5,
              patternScale: 1,
              chestType: "none",
              chestValue: "",
              owned: [],
            },
            channel: true,
            streamer: true,
          }),
        });
      }
      if (url.pathname.endsWith("/appearance")) {
        saved.push(route.request().postDataJSON());
        return route.fulfill({ status: 204 });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          emotes: [
            { id: "25", name: "Kappa", animated: false },
            { id: "35063", name: "mcaT", animated: false },
            { id: "196892", name: "TwitchUnity", animated: false },
            {
              id: "emotesv2_bea88a2caa044e409c1b32ee0850b825",
              name: "YappingDuck",
              animated: true,
            },
          ],
        }),
      });
    });
    await page.addInitScript(() => {
      window.accountLabels = [];
      new MutationObserver(() => {
        const t = document.querySelector("#account-status")?.textContent;
        if (t && window.accountLabels.at(-1) !== t)
          window.accountLabels.push(t);
      }).observe(document, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    const base = process.env.ROBOT_PREVIEW_URL || "http://127.0.0.1:3902/robot";
    await page.goto(base + "/");
    await page.waitForFunction(() =>
      document
        .querySelector("#account-status")
        .textContent.startsWith("Signed in as Trizze"),
    );
    assert.ok(pending.length, "optional profile request should remain pending");
    assert.equal(await page.locator("#tier").textContent(), "TIER 5");
    assert.ok(
      !(await page.evaluate(() => window.accountLabels)).includes(
        "Not signed in",
      ),
    );
    pending.splice(0).forEach((resolve) => resolve());
    await page.reload();
    await page.waitForFunction(() =>
      document
        .querySelector("#account-status")
        .textContent.startsWith("Signed in as Trizze"),
    );
    assert.ok(
      !(await page.evaluate(() => window.accountLabels)).includes(
        "Not signed in",
      ),
    );
    pending.splice(0).forEach((resolve) => resolve());
    await page.waitForFunction(
      () => document.querySelector("#viewer-status").hidden,
    );
    await page.locator("#chest-kind").selectOption("emote");
    await page.locator("[data-emote-search]").fill("KAPPA");
    await page
      .getByRole("button", { name: "Choose Kappa", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector("#chest-apply").disabled,
    );
    assert.deepEqual(saved.at(-1), { chestType: "emote", chestValue: "25" });
    await page.locator("[data-emote-search]").fill("mcat");
    assert.equal(await page.locator(".emote-choice").count(), 1);
    await page.locator("[data-emote-search]").fill("");
    await page.locator("[data-emote-animated]").check();
    assert.equal(await page.locator(".emote-choice").count(), 1);
    assert.match(await page.locator(".emote-choice").textContent(), /ANIMATED/);
    await page.locator("[data-emote-animated]").uncheck();
    await page.screenshot({ path: "/tmp/robot-emote-grid-desktop.png" });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.locator("#emote-picker").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "/tmp/robot-emote-grid-mobile.png" });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    mode = "offline";
    await page.reload();
    await page.waitForFunction(
      () => !document.querySelector("#account-retry").hidden,
    );
    assert.equal(
      await page.locator("#account-status").textContent(),
      "Could not check sign-in.",
    );
    assert.equal(await page.locator("#login").isVisible(), false);
    mode = "ok";
    await page.locator("#account-retry").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#account-status")
        .textContent.startsWith("Signed in as"),
    );
    pending.splice(0).forEach((resolve) => resolve());
    mode = "guest";
    await page.reload();
    await page.waitForFunction(
      () =>
        document.querySelector("#account-status").textContent ===
        "Not signed in",
    );
    assert.equal(await page.locator("#login").isVisible(), true);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log(
    "Refresh restores Tier 5 before the delayed profile; no false logout. Retry, guest, emote search/save/animated filter and mobile layout passed.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
