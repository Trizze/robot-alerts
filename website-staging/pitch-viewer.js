// First paint is a small poster; the interactive model starts after paint/idle.
import { installPatternMapping } from "/robot/pattern-mapping.js?v=2";
const wrap = document.querySelector("[data-pitch-viewer]"),
  canvas = wrap?.querySelector("canvas");
let pending;
async function boot() {
  if (pending) return pending;
  pending = (async () => {
    const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
      import("three"),
      import("/robot/vendor/loaders/GLTFLoader.js"),
      import("/robot/vendor/controls/OrbitControls.js"),
    ]);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(4, 2.5, 5);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 1.35, 0);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 3;
    controls.maxDistance = 9;
    controls.update();
    scene.add(new THREE.HemisphereLight("#f2eafa", "#494256", 2.1));
    const key = new THREE.DirectionalLight("#fff3ea", 2.7);
    key.position.set(4, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight("#c4b1ff", 1.4);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const [gltf, pattern, face] = await Promise.all([
      new GLTFLoader().loadAsync("/robot/models/robot.glb"),
      new THREE.TextureLoader().loadAsync(
        "/robot/patterns/black_marquina_marble.jpg",
      ),
      new THREE.TextureLoader().loadAsync("/robot/assets/twitch-default.webp"),
    ]);
    const model = gltf.scene,
      box = new THREE.Box3().setFromObject(model),
      center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    scene.add(model);
    pattern.wrapS = pattern.wrapT = THREE.RepeatWrapping;
    pattern.colorSpace = THREE.SRGBColorSpace;
    pattern.flipY = false;
    face.colorSpace = THREE.SRGBColorSpace;
    face.flipY = false;
    const painted = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.name === "RobotPattern" && !painted.has(m)) {
          installPatternMapping(
            m,
            { value: 1 },
            { value: pattern.image.width / pattern.image.height },
          );
          m.map = pattern;
          m.color.set("#ffffff");
          m.needsUpdate = true;
          painted.add(m);
        }
        if (m.name === "AvatarSurface") {
          m.map = face;
          m.color.set("#fff");
          m.needsUpdate = true;
        }
      }
    });
    let framing = 1;
    const resize = () => {
      const w = wrap.clientWidth,
        h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const nextFraming = Math.max(1, 0.48 / camera.aspect);
      camera.position
        .sub(controls.target)
        .multiplyScalar(nextFraming / framing)
        .add(controls.target);
      framing = nextFraming;
      controls.minDistance = 3 * framing;
      controls.maxDistance = 9 * framing;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };
    new ResizeObserver(resize).observe(wrap);
    resize();
    let frames = 0,
      scheduled = false;
    function draw() {
      scheduled = false;
      controls.update();
      renderer.render(scene, camera);
      if (frames-- > 0) request();
    }
    function request() {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(draw);
      }
    }
    controls.addEventListener("change", () => {
      frames = 12;
      request();
    });
    canvas.addEventListener("pointerdown", () => {
      frames = 15;
      request();
    });
    canvas.addEventListener(
      "wheel",
      () => {
        frames = 15;
        request();
      },
      { passive: true },
    );
    request();
    wrap.querySelector("img").hidden = true;
    wrap.dataset.ready = "true";
  })().catch(() => {
    wrap.dataset.error = "true";
  });
  return pending;
}
if (wrap) {
  wrap.addEventListener("pointerenter", boot, { once: true });
  wrap.addEventListener("focusin", boot, { once: true });
  if ("requestIdleCallback" in window)
    requestIdleCallback(boot, { timeout: 1200 });
  else setTimeout(boot, 100);
}
const dialog = document.querySelector("#demo-dialog");
document.querySelector("#watch-demo")?.addEventListener("click", () => {
  dialog.showModal();
  const v = dialog.querySelector("video");
  v.play().catch(() => {});
});
dialog?.addEventListener("close", () => dialog.querySelector("video").pause());
