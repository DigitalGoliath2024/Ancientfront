/**
 * Hostinger (and similar hosts) require a JavaScript entry file.
 * The game server itself lives in TypeScript; tsx loads it.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(
  process.execPath,
  ["--import", "tsx", path.join(root, "src/server/Server.ts")],
  {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
