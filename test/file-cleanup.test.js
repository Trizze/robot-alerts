import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  utimes,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deleteAvatarFiles } from "../src/avatar-files.js";
import { cleanupMedia } from "../src/media.js";
import { Store } from "../src/db.js";

test("avatar deletion removes only the specified numeric viewer’s cached images", async () => {
  const dir = await mkdtemp(join(tmpdir(), "robot-avatars-"));
  try {
    for (const name of ["123.png", "123.jpg", "123.webp", "456.png"])
      await writeFile(join(dir, name), "image");
    await deleteAvatarFiles("../456", dir);
    await deleteAvatarFiles("123", dir);
    for (const ext of ["png", "jpg", "webp"])
      await assert.rejects(readFile(join(dir, `123.${ext}`)), {
        code: "ENOENT",
      });
    assert.equal(await readFile(join(dir, "456.png"), "utf8"), "image");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("media cleanup preserves files referenced by any channel and recent uploads", async () => {
  const dir = await mkdtemp(join(tmpdir(), "robot-media-")),
    store = new Store(":memory:");
  try {
    const old = "00000000-0000-4000-8000-000000000001.png",
      keep = "00000000-0000-4000-8000-000000000002.png",
      recent = "00000000-0000-4000-8000-000000000003.png";
    for (const name of [old, keep, recent])
      await writeFile(join(dir, name), "image");
    const past = new Date(Date.now() - 2 * 86400000);
    await utimes(join(dir, old), past, past);
    await utimes(join(dir, keep), past, past);
    store.saveSettings("first", { customMedia: { sub: `/media/${keep}` } });
    store.saveSettings("second", {});
    await cleanupMedia(store.mediaReferences(), { directory: dir });
    await assert.rejects(readFile(join(dir, old)), { code: "ENOENT" });
    assert.equal(await readFile(join(dir, keep), "utf8"), "image");
    assert.equal(await readFile(join(dir, recent), "utf8"), "image");
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("avatar deletion waits for in-flight downloads and blocks new ones", async () => {
  const { Profiles } = await import("../src/twitch/profiles.js");
  const dir = await mkdtemp(join(tmpdir(), "robot-profile-race-")),
    previous = process.cwd();
  let release;
  try {
    process.chdir(dir);
    await mkdir("data/avatars", { recursive: true });
    const profiles = new Profiles({}, {}, "1", {
      avatarDir: join(dir, "data/avatars"),
    });
    profiles.downloadAvatar = async (id) => {
      await new Promise((resolve) => {
        release = resolve;
      });
      await writeFile(`data/avatars/${id}.png`, "image");
      return `/avatars/${id}.png`;
    };
    const pending = profiles.avatar("123", "unused");
    await new Promise((resolve) => setImmediate(resolve));
    const deletion = profiles.deleteCachedAvatar("123");
    assert.equal(await profiles.avatar("123", "unused"), null);
    release();
    await pending;
    await deletion;
    await assert.rejects(readFile("data/avatars/123.png"), { code: "ENOENT" });
  } finally {
    process.chdir(previous);
    await rm(dir, { recursive: true, force: true });
  }
});
