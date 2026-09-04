/**
 * Hostinger cannot spawn tsx/esbuild at runtime (EACCES on the esbuild binary).
 * Production build emits dist/server.mjs; fall back to tsx for local dev.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const bundled = path.join(root, "dist", "server.mjs");
const args = existsSync(bundled)
  ? [bundled]
  : ["--import", "tsx", path.join(root, "src/server/Server.ts")];

const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
