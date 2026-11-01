import { createSurfaceCompositor } from "./pattern-surface.js?v=patterns-1";
import { patternSelection } from "../shared/pattern-selection.js";
const base = new URL("./pattern-motion/", import.meta.url);
let compositor, metadata, resources;
const textures = new Map();
async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Pattern mapping assets unavailable.");
  return response.json();
}
async function upload(url, repeat = false) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Robot pattern image unavailable.");
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
    imageOrientation: repeat ? "flipY" : "none",
  });
  try {
    return {
      texture: compositor.texture(bitmap, repeat),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}
function mapsReady() {
  if (!resources)
    resources = (async () => {
      compositor ||= createSurfaceCompositor();
      metadata = await readJson(new URL("manifest.json?v=patterns-1", base));
      if (metadata.version !== "patterns-1")
        throw new Error("Refresh this source to load its robot patterns.");
      const clips = {};
      // Upload serially to keep peak decoding memory bounded. Bitmaps close immediately.
      for (const name of Object.keys(metadata.clips)) {
        const images = [];
        for (const kind of metadata.kinds)
          images.push(
            await upload(new URL(`${name}/${kind}.png?v=patterns-1`, base)),
          );
        clips[name] = {
          textures: images.map((i) => i.texture),
          size: [images[0].width, images[0].height],
        };
      }
      return clips;
    })();
  return resources;
}
let catalog;
export async function preparePattern(viewer) {
  if (!viewer?.selectedPattern) return null;
  catalog ||= readJson(
    new URL("../patterns/catalog.json", import.meta.url),
  ).then((data) => (Array.isArray(data) ? data : data.patterns));
  const selection = patternSelection(viewer, await catalog);
  if (!selection) return null;
  await mapsReady();
  if (!textures.has(selection.id)) {
    if (textures.size >= 8) {
      const [key, old] = textures.entries().next().value;
      textures.delete(key);
      old
        .then((item) => compositor.deleteTexture(item.texture))
        .catch(() => {});
    }
    const request = upload(
      new URL(`../patterns/${selection.id}.jpg`, import.meta.url),
      true,
    ).then((item) => ({
      texture: item.texture,
      aspect: item.width / item.height,
    }));
    textures.set(selection.id, request);
    request.catch(() => {
      if (textures.get(selection.id) === request) textures.delete(selection.id);
    });
  }
  return {
    maps: await resources,
    texture: await textures.get(selection.id),
    scale: selection.scale,
  };
}
export function drawPattern(ctx, prepared, clip, index) {
  if (!prepared) return;
  const frame = metadata.clips[clip]?.frames[index];
  if (!frame?.box || !frame.sheet) return;
  const surface = compositor.draw(
    prepared.maps[clip],
    prepared.texture,
    metadata,
    frame,
    prepared.scale,
  );
  const [x, y, x2, y2] = frame.box,
    s = metadata.mapScale;
  ctx.drawImage(surface, x * s, y * s, (x2 - x) * s, (y2 - y) * s);
}
