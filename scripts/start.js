import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("..", import.meta.url)));
if (
  !existsSync("node_modules/ws/package.json") ||
  !existsSync("node_modules/gsap/package.json")
) {
  console.log("Installing locked npm dependencies (ws, gsap)…");
  const install = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["ci", "--ignore-scripts", "--no-audit", "--no-fund"],
    { stdio: "inherit", shell: false },
  );
  if (install.status !== 0) process.exit(install.status || 1);
}
if (process.argv.includes("--demo")) process.env.ROBOT_DEMO = "1";
await import("../src/server.js");
