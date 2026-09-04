/**
 * Hostinger's npm install often leaves esbuild without the execute bit,
 * which shows up as spawn EACCES. chmod the native CLI bins we need to run.
 */
import fs from "node:fs";
import path from "node:path";

const names = new Set(["esbuild", "tsx"]);

function visit(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      visit(full);
      continue;
    }
    if (!names.has(entry.name)) continue;
    try {
      fs.chmodSync(full, 0o755);
    } catch {
      // Best-effort: some hosts refuse chmod; start still tries.
    }
  }
}

visit(path.join(process.cwd(), "node_modules", "@esbuild"));
visit(path.join(process.cwd(), "node_modules", "esbuild"));
visit(path.join(process.cwd(), "node_modules", "tsx"));
