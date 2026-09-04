import { isOpenFrontAccountApiEnabled } from "../core/OpenFrontAccountApi";

/**
 * Fetch against OpenFront's account API (cosmetics, auth, shop, clans, …).
 * When the kill switch is off this never hits the network — callers already
 * treat non-200 as false / empty / fallback.
 */
export function fetchAccountApi(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!isOpenFrontAccountApiEnabled()) {
    return Promise.resolve(
      new Response(null, {
        status: 503,
        statusText: "OpenFront account API disabled",
      }),
    );
  }
  return fetch(input, init);
}
