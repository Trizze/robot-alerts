import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Profiles } from "../src/twitch/profiles.js";

test("failed avatar refresh preserves an existing cached profile picture", async () => {
  let update;
  const profiles = new Profiles(
    {
      request: async (_role, route) =>
        route === "users"
          ? {
              data: [
                { profile_image_url: "https://example.com/not-twitch.png" },
              ],
            }
          : { data: [] },
    },
    { updateProfile: (_id, value) => (update = value) },
    "channel",
  );
  await profiles.load({ type: "chat", viewer: { id: "123" } });
  assert.equal(Object.hasOwn(update, "avatar"), false);
});

test("avatar downloader requests 600px Twitch image and rejects foreign hosts", async () => {
  const originalFetch = globalThis.fetch,
    cwd = process.cwd(),
    dir = await mkdtemp(join(tmpdir(), "robot-avatar-"));
  let requested;
  try {
    process.chdir(dir);
    globalThis.fetch = async (url) => {
      requested = String(url);
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "image/png" },
      });
    };
    const profiles = new Profiles(null, null, "channel", {
      avatarDir: join(dir, "data/avatars"),
    });
    assert.equal(
      await profiles.avatar(
        "123",
        "https://static-cdn.jtvnw.net/jtv_user_pictures/test-profile_image-300x300.png",
      ),
      "/avatars/123.png",
    );
    assert.equal(
      requested,
      "https://static-cdn.jtvnw.net/jtv_user_pictures/test-profile_image-600x600.png",
    );
    assert.deepEqual([...(await readFile("data/avatars/123.png"))], [1, 2, 3]);
    requested = null;
    assert.equal(
      await profiles.avatar("123", "https://example.com/300x300.png"),
      null,
    );
    assert.equal(requested, null);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});
