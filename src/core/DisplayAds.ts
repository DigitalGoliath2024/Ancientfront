/**
 * Kill switch for OpenFront's display-ad stack (Playwire RAMP / Google Ad
 * Manager, AdShield, Admiral). This fork must not load those publisher tags.
 *
 * Default is off. Set `DISPLAY_ADS_ENABLED=true` (env) only if you later run
 * your own ad account — do not reuse OpenFront's Playwire / Google Ads IDs.
 */
export const DISPLAY_ADS_ENABLED = false;

let override: boolean | null = null;

export function isDisplayAdsEnabled(): boolean {
  if (override !== null) return override;
  const raw =
    typeof process !== "undefined"
      ? process.env.DISPLAY_ADS_ENABLED
      : undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return DISPLAY_ADS_ENABLED;
}

/** Test-only: pass `null` to restore env / constant resolution. */
export function setDisplayAdsEnabled(value: boolean | null): void {
  override = value;
}
