// Render current licensed geometry; all examples use Twitch's official default avatar.
const {
  chromium,
} = require("/tmp/robot-alerts-browser-tools/node_modules/playwright-core");
const fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const b = await chromium.launch({
    executablePath: "/tmp/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage();
    await p.route("**/app-fast.js*", (r) =>
      r.fulfill({ contentType: "text/javascript", body: "" }),
    );
    await p.goto("http://127.0.0.1:3902/robot/");
    const outputs = await p.evaluate(async () => {
      const THREE = await import("three"),
        { GLTFLoader } = await import("/robot/vendor/loaders/GLTFLoader.js"),
        { installPatternMapping } = await import(
          "/robot/pattern-mapping.js?v=2"
        );
      const scene = new THREE.Scene(),
        gltf = await new GLTFLoader().loadAsync("/robot/models/robot.glb"),
        model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model),
        center = box.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= box.min.y;
      scene.add(model);
      scene.add(new THREE.HemisphereLight("#f2eafa", "#494256", 2.5));
      const key = new THREE.DirectionalLight("#fff3ea", 3);
      key.position.set(4, 6, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight("#c4b1ff", 1.6);
      fill.position.set(-4, 2, -3);
      scene.add(fill);
      const r = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      r.outputColorSpace = THREE.SRGBColorSpace;
      const camera = new THREE.OrthographicCamera(
        -1.35,
        1.35,
        1.8,
        -1.8,
        0.01,
        100,
      );
      r.setSize(600, 800);
      const face = await new THREE.TextureLoader().loadAsync(
        "/robot/assets/twitch-default.webp",
      );
      face.colorSpace = THREE.SRGBColorSpace;
      face.flipY = false;
      const scale = { value: 1 },
        aspect = { value: 1 };
      const paints = new Set();
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (m.name === "RobotPattern") {
            if (!paints.has(m)) installPatternMapping(m, scale, aspect);
            paints.add(m);
          }
          if (m.name === "AvatarSurface") {
            m.map = face;
            m.color.set("#fff");
            m.needsUpdate = true;
          }
          if (m.name === "ChestDisplay") {
            m.map = null;
            m.color.set("#242833");
            m.needsUpdate = true;
          }
        }
      });
      const names = [
        ["01-default-front", null, true],
        ["02-default-angle", null, false],
        ["03-marble", "black_marquina_marble", false],
        ["04-rusty-metal", "rusty_metal_02", false],
        ["05-denim", "denim_fabric_03", false],
        ["06-fabric", "fabric_pattern_07", false],
        ["07-space-explorer-front", "blue_metal_plate", true],
        ["08-space-explorer-angle", "blue_metal_plate", false],
        ["11-tier-1-catalog", "rusty_metal_02", true],
        ["12-tier-3-catalog", "floral_jacquard", false],
        ["13-tier-5-catalog", "black_marquina_marble", true],
        ["17-black-poster", "black_marquina_marble", false],
      ];
      const result = {};
      for (const [name, pattern, front] of names) {
        let tex = null;
        if (pattern) {
          tex = await new THREE.TextureLoader().loadAsync(
            "/robot/patterns/" + pattern + ".jpg",
          );
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          aspect.value = tex.image.width / tex.image.height;
        }
        for (const m of paints) {
          m.map = tex;
          m.color.set("#fff");
          m.needsUpdate = true;
        }
        camera.position.set(front ? 0 : 4, front ? 1.7 : 2.5, front ? 7 : 5);
        camera.lookAt(0, 1.35, 0);
        r.render(scene, camera);
        result[name] = r.domElement
          .toDataURL(
            name === "17-black-poster" ? "image/webp" : "image/jpeg",
            0.84,
          )
          .split(",")[1];
        if (tex) tex.dispose();
      }
      for (const m of paints) {
        m.map = null;
        m.needsUpdate = true;
      }
      const headBox = new THREE.Box3();
      model.traverse((o) => {
        if (!o.isMesh) return;
        let a = o;
        while (
          a &&
          !a.name.includes("head_v2") &&
          !a.name.includes("screen_curved")
        )
          a = a.parent;
        o.visible = Boolean(a);
        if (o.visible) headBox.union(new THREE.Box3().setFromObject(o));
      });
      const c = headBox.getCenter(new THREE.Vector3()),
        extent =
          Math.max(...headBox.getSize(new THREE.Vector3()).toArray()) * 0.75;
      camera.left = -extent;
      camera.right = extent;
      camera.top = extent;
      camera.bottom = -extent;
      camera.position.copy(c).add(new THREE.Vector3(3, 1.3, 4));
      camera.lookAt(c);
      camera.updateProjectionMatrix();
      r.setSize(160, 160);
      r.render(scene, camera);
      result.logo = r.domElement.toDataURL("image/png").split(",")[1];
      return result;
    });
    for (const [name, data] of Object.entries(outputs)) {
      if (name === "logo") {
        const head = `<image x="6" y="6" width="244" height="244" href="data:image/png;base64,${data}"/>`;
        for (const n of [
          "crt-logo-v3.svg",
          "crt-logo.svg",
          "favicon-v3.svg",
          "favicon.svg",
        ]) {
          const background = n.startsWith("favicon")
            ? '<rect width="256" height="256" rx="46" fill="#181a25"/>'
            : "";
          fs.writeFileSync(
            "website-staging/brand/" + n,
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${background}${head}</svg>`,
          );
        }
        continue;
      }
      fs.writeFileSync(
        "website-staging/examples/" +
          name +
          (name === "17-black-poster" ? ".webp" : ".jpg"),
        Buffer.from(data, "base64"),
      );
    }
    console.log(
      "Regenerated current-model sample art, black poster and default-avatar logos. No personal photos used.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
