import { ValidationError } from "./errors.js";
import { mediaDirectory } from "./paths.js";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  stat,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
const signatures = [
  [
    "png",
    "image/png",
    (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  ],
  ["jpg", "image/jpeg", (b) => b[0] === 255 && b[1] === 216 && b[2] === 255],
  [
    "gif",
    "image/gif",
    (b) => ["GIF87a", "GIF89a"].includes(b.subarray(0, 6).toString("ascii")),
  ],
  [
    "webp",
    "image/webp",
    (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  ],
  ["mp4", "video/mp4", (b) => b.subarray(4, 8).toString("ascii") === "ftyp"],
  [
    "webm",
    "video/webm",
    (b) => b.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")),
  ],
];
const limit = 25 * 1024 * 1024;
export async function saveMedia(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ValidationError("File exceeds 25 MB.");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks),
    match = signatures.find(([, , check]) => check(bytes));
  if (!match || bytes.length < 12)
    throw new ValidationError("Use an MP4, WebM, GIF, PNG, JPG or WebP file.");
  const name = `${randomUUID()}.${match[0]}`;
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(join(mediaDirectory, name), bytes, { flag: "wx" });
  return `/media/${name}`;
}
export async function getMedia(name) {
  if (!/^[a-f0-9-]{36}\.(png|jpg|gif|webp|mp4|webm)$/.test(name)) return null;
  const type = signatures.find(([ext]) => name.endsWith(`.${ext}`))?.[1];
  try {
    return { bytes: await readFile(join(mediaDirectory, name)), type };
  } catch {
    return null;
  }
}

// Only old, unreferenced uploads are removed; the grace period protects uploads
// that are still being configured in another open settings tab.
export async function cleanupMedia(
  references,
  { directory = mediaDirectory, now = Date.now(), graceMs = 86400000 } = {},
) {
  const keep = new Set(references);
  let files;
  try {
    files = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const file of files) {
    if (
      !file.isFile() ||
      !/^[a-f0-9-]{36}\.(png|jpg|gif|webp|mp4|webm)$/.test(file.name) ||
      keep.has(`/media/${file.name}`)
    )
      continue;
    const path = join(directory, file.name);
    try {
      const info = await stat(path);
      if (now - info.mtimeMs >= graceMs) await unlink(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}
