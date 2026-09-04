import fs from "fs";
import path from "path";
import type { AssetManifest } from "../core/AssetUrls";
import { staticRoot } from "./ProjectPaths";

const manifestPath = path.join(staticRoot(), "asset-manifest.json");

let cachedManifest: AssetManifest | null = null;

export async function getRuntimeAssetManifest(): Promise<AssetManifest> {
  if (cachedManifest !== null) {
    return cachedManifest;
  }
  if (!fs.existsSync(manifestPath)) {
    cachedManifest = {};
    return cachedManifest;
  }
  try {
    cachedManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as AssetManifest;
  } catch (err) {
    console.error(`Failed to parse asset manifest at ${manifestPath}:`, err);
    cachedManifest = {};
  }
  return cachedManifest;
}

export function clearRuntimeAssetManifestCache(): void {
  cachedManifest = null;
}
