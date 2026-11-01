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
    const p = await b.newPage();
    await p.goto("http://127.0.0.1:3902/robot/");
    const data = await p.evaluate(async () => {
      const THREE = await import("three"),
        { GLTFLoader } = await import("./vendor/loaders/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync("./models/robot.glb");
      const scene = new THREE.Scene();
      scene.add(gltf.scene);
      const box = new THREE.Box3();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        let owner = o;
        while (
          owner &&
          !owner.name.includes("head_v2") &&
          !owner.name.includes("screen_curved")
        )
          owner = owner.parent;
        o.visible = Boolean(owner);
        if (o.visible) {
          box.union(new THREE.Box3().setFromObject(o));
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            if (m.name === "AvatarSurface") {
              m.color.set("#242833");
              m.map = null;
            }
        }
      });
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const extent = Math.max(size.x, size.y, size.z) * 0.75;
      const c = new THREE.OrthographicCamera(
        -extent,
        extent,
        extent,
        -extent,
        0.01,
        100,
      );
      c.position.copy(center).add(new THREE.Vector3(3, 1.3, 4));
      c.lookAt(center);
      scene.add(new THREE.HemisphereLight("#fff8ef", "#494256", 2.1));
      const key = new THREE.DirectionalLight("#fff5e6", 2.7);
      key.position.copy(center).add(new THREE.Vector3(4, 6, 5));
      scene.add(key);
      const r = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      r.setSize(512, 512);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.render(scene, c);
      return r.domElement.toDataURL().split(",")[1];
    });
    fs.writeFileSync(
      "assets/robot/brand/crt-render.png",
      Buffer.from(data, "base64"),
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="46" fill="white"/><image x="6" y="6" width="244" height="244" href="data:image/png;base64,${data}"/></svg>`;
    for (const name of ["crt-logo.svg", "favicon.svg"])
      fs.writeFileSync("website-staging/brand/" + name, svg);
    console.log(
      "Rendered approved CRT model as a front three-quarter logo with dark glass.",
    );
  } finally {
    await b.close();
  }
})();
