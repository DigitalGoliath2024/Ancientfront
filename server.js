/**
 * Hostinger watches this process for server.listen() within 3 seconds.
 * Spawning a child (tsx / node dist/server.mjs) made listen() happen in
 * another PID, so Hostinger restarted the app in a loop.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const bundled = path.join(root, "dist", "server.mjs");

if (!existsSync(bundled)) {
  throw new Error(
    "Missing dist/server.mjs. On Hostinger run the production build; locally use npm run start:server-dev.",
  );
}

await import(pathToFileURL(bundled).href);
