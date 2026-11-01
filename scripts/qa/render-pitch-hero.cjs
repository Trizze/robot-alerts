const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 1800, height: 1400 },
      deviceScaleFactor: 2,
    });
    await p.addInitScript(() => {
      const old = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        return old.call(
          this,
          type,
          type.startsWith("webgl")
            ? { ...attrs, preserveDrawingBuffer: true }
            : attrs,
        );
      };
    });
    await p.route("https://static-cdn.jtvnw.net/hero-demo.png", (r) =>
      r.fulfill({
        path: "data/avatars/14824099.png",
        contentType: "image/png",
        headers: { "access-control-allow-origin": "*" },
      }),
    );
    await p.route("**/robot/api/**", (r) =>
      r.fulfill({
        status: r.request().method() === "POST" ? 204 : 200,
        contentType: "application/json",
        body:
          r.request().method() === "POST"
            ? undefined
            : JSON.stringify(
                new URL(r.request().url()).pathname.endsWith("/api/me")
                  ? {
                      viewer: {
                        id: "14824099",
                        displayName: "Trizze",
                        points: 1000,
                        tier: 5,
                        patternScale: 1,
                        selectedPattern: "fabric_pattern_07",
                        chestType: "emote",
                        chestValue: "emotesv2_5d523adb8bbb4786821cd7091e47da21",
                        avatarUrl: "https://static-cdn.jtvnw.net/hero-demo.png",
                        owned: [{ id: "fabric_pattern_07" }],
                      },
                    }
                  : {
                      emotes: [
                        {
                          id: "emotesv2_5d523adb8bbb4786821cd7091e47da21",
                          name: "PopNemo",
                          animated: true,
                        },
                      ],
                    },
              ),
      }),
    );
    await p.goto("http://127.0.0.1:3902/robot/");
    await p.waitForFunction(
      () => document.querySelector("#viewer-status").hidden,
    );
    await p
      .locator(".pattern")
      .filter({ hasText: "Fabric Pattern 07" })
      .click();
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      const wrap = document.querySelector(".viewer-wrap");
      wrap.style.width = "720px";
      wrap.style.height = "1080px";
    });
    await p.locator("#robot-view").hover();
    await p.mouse.wheel(0, -240);
    await p.waitForTimeout(600);
    const data = await p
      .locator("#robot-view")
      .evaluate((c) => c.toDataURL().split(",")[1]);
    fs.writeFileSync(
      "website-staging/examples/16-hero-robot.png",
      Buffer.from(data, "base64"),
    );
    console.log(
      "Current 3D model, Fabric Pattern 07, PopNemo and own avatar rendered at high resolution.",
    );
  } finally {
    await b.close();
  }
})();
