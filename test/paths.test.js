import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("default app data directory is relative to the repository, not the working directory", () => {
  const moduleURL = new URL("../src/paths.js", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {dataRoot} from ${JSON.stringify(moduleURL)}; console.log(dataRoot)`,
    ],
    { cwd: tmpdir(), encoding: "utf8", env: { PATH: process.env.PATH } },
  );
  assert.equal(result.status, 0);
  assert.equal(
    result.stdout.trim(),
    fileURLToPath(new URL("../data/", import.meta.url)).replace(/\/$/, ""),
  );
});
