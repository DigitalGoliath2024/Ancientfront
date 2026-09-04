import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DISPLAY_ADS_ENABLED,
  isDisplayAdsEnabled,
  setDisplayAdsEnabled,
} from "../../src/core/DisplayAds";

describe("display ads kill switch", () => {
  afterEach(() => {
    setDisplayAdsEnabled(null);
  });

  it("defaults off in this fork", () => {
    expect(DISPLAY_ADS_ENABLED).toBe(false);
  });

  it("honors the test override", () => {
    setDisplayAdsEnabled(false);
    expect(isDisplayAdsEnabled()).toBe(false);
    setDisplayAdsEnabled(true);
    expect(isDisplayAdsEnabled()).toBe(true);
  });
});

describe("index.html ad tags", () => {
  const html = readFileSync(resolve("index.html"), "utf8");

  it("does not load Playwire, AdShield, or OpenFront Google Ads", () => {
    expect(html).not.toContain("cdn.intergient.com");
    expect(html).not.toContain("HgWESkOz");
    expect(html).not.toContain("AW-16702609763");
    expect(html).not.toContain("googletag.pubads");
    expect(html).not.toContain("page_url");
  });
});
