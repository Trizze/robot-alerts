import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { refreshEmotes } from "../../scripts/refresh-global-emotes.js";

test("refresh writes only public Twitch emote details and preserves the previous snapshot on an empty response", async () => {
  const dir = await mkdtemp(join(tmpdir(), "robot-emotes-")),
    output = pathToFileURL(join(dir, "global-emotes.json"));
  try {
    const client = {
      globalEmotes: async () => [
        { id: "35063", name: "mcaT", format: ["static"] },
        { id: "emotesv2_abcd", name: "Dance", format: ["animated", "static"] },
        { id: "../bad", name: "Bad", format: [] },
      ],
    };
    assert.equal(await refreshEmotes(client, output), 2);
    const snapshot = await readFile(output, "utf8");
    assert.deepEqual(JSON.parse(snapshot).emotes, [
      { name: "mcaT", id: "35063", animated: false },
      { name: "Dance", id: "emotesv2_abcd", animated: true },
    ]);
    await assert.rejects(
      refreshEmotes({ globalEmotes: async () => [] }, output),
    );
    assert.equal(await readFile(output, "utf8"), snapshot);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
