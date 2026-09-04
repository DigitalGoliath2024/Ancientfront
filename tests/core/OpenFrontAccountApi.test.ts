import { afterEach, describe, expect, it } from "vitest";
import {
  OPENFRONT_ACCOUNT_API_ENABLED,
  isOpenFrontAccountApiEnabled,
  setOpenFrontAccountApiEnabled,
} from "../../src/core/OpenFrontAccountApi";

describe("OpenFront account API kill switch", () => {
  afterEach(() => {
    setOpenFrontAccountApiEnabled(true);
  });

  it("defaults off in this fork", () => {
    expect(OPENFRONT_ACCOUNT_API_ENABLED).toBe(false);
  });

  it("honors the test override", () => {
    setOpenFrontAccountApiEnabled(false);
    expect(isOpenFrontAccountApiEnabled()).toBe(false);
    setOpenFrontAccountApiEnabled(true);
    expect(isOpenFrontAccountApiEnabled()).toBe(true);
  });
});
