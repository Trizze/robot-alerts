// Live chest content shares the robot's animation clock, not an independent timer.
const cache = new Map();
export async function prepareChest(viewer) {
  const type = viewer?.chestType,
    value = viewer?.chestValue;
  if (!["emoji", "emote"].includes(type) || typeof value !== "string" || !value)
    return null;
  if (type === "emote" && !/^[A-Za-z0-9_-]{1,80}$/.test(value))
    throw new Error("Invalid chest emote");
  if (type === "emoji" && Array.from(value).length > 12)
    throw new Error("Invalid chest emoji");
  const key = type + ":" + value;
  if (cache.has(key)) return cache.get(key);
  const pending = (async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const result = {
      canvas,
      ctx,
      frames: [],
      durations: [],
      total: 0,
      last: -1,
    };
    if (type === "emoji") {
      ctx.fillStyle = "#242833";
      ctx.fillRect(0, 0, 512, 512);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "320px sans-serif";
      ctx.fillText(value, 256, 270, 440);
      return result;
    }
    const response = await fetch(
      `https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(value)}/default/dark/3.0`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("Could not load chest emote");
    const blob = await response.blob();
    if (blob.size > 5 * 1024 * 1024) throw new Error("Chest emote too large");
    if (blob.type === "image/gif" && typeof ImageDecoder !== "undefined") {
      const decoder = new ImageDecoder({
        data: await blob.arrayBuffer(),
        type: "image/gif",
      });
      try {
        await decoder.tracks.ready;
        const count = decoder.tracks.selectedTrack.frameCount;
        if (!count || count > 300)
          throw new Error("Unsupported emote animation");
        for (let i = 0; i < count; i++) {
          const { image } = await decoder.decode({ frameIndex: i });
          try {
            result.frames.push(await createImageBitmap(image));
            result.durations.push(
              Math.max(20, (image.duration || 100000) / 1000),
            );
          } finally {
            image.close();
          }
        }
      } catch (e) {
        for (const f of result.frames) f.close();
        throw e;
      } finally {
        decoder.close();
      }
    } else {
      result.frames = [await createImageBitmap(blob)];
      result.durations = [1000];
    }
    result.total = result.durations.reduce((a, b) => a + b, 0);
    return result;
  })();
  if (cache.size >= 16) {
    const [old, promise] = cache.entries().next().value;
    cache.delete(old);
    promise.then((s) => s.frames.forEach((f) => f.close())).catch(() => {});
  }
  cache.set(key, pending);
  pending.catch(() => {
    if (cache.get(key) === pending) cache.delete(key);
  });
  return pending;
}
export function chestFrame(surface, seconds = 0) {
  if (!surface.frames.length) return surface.canvas;
  let elapsed = Math.max(0, seconds * 1000) % surface.total,
    index = 0;
  while (
    index < surface.frames.length - 1 &&
    elapsed >= surface.durations[index]
  )
    elapsed -= surface.durations[index++];
  if (index !== surface.last) {
    surface.ctx.fillStyle = "#242833";
    surface.ctx.fillRect(0, 0, 512, 512);
    surface.ctx.drawImage(surface.frames[index], 48, 48, 416, 416);
    surface.last = index;
  }
  return surface.canvas;
}
