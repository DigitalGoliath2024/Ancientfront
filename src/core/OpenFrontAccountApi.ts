/**
 * Kill switch for OpenFront's closed-source account API
 * (`api.openfront.io`, `api.openfront.dev`, and the local `localhost:8787`
 * worker). This fork keeps store / clans / inventory / auth / membership
 * code in the repo, but players must not be sent to OpenFront login or have
 * the live client call that API.
 *
 * Default is off. Set `OPENFRONT_ACCOUNT_API_ENABLED=true` (env) later if
 * you point at your own compatible API — do not implement a replacement here.
 */
export const OPENFRONT_ACCOUNT_API_ENABLED = false;

let override: boolean | null = null;

export function isOpenFrontAccountApiEnabled(): boolean {
  if (override !== null) return override;
  const raw =
    typeof process !== "undefined"
      ? process.env.OPENFRONT_ACCOUNT_API_ENABLED
      : undefined;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return OPENFRONT_ACCOUNT_API_ENABLED;
}

/** Test-only: pass `null` to restore env / constant resolution. */
export function setOpenFrontAccountApiEnabled(value: boolean | null): void {
  override = value;
}
