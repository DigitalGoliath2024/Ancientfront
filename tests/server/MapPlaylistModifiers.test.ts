import { describe, expect, it, vi } from "vitest";
import { SCHEDULED_PUBLIC_GAME_TYPES } from "../../src/core/Schemas";
import { UnitType } from "../../src/core/game/Game";
import {
  MapPlaylist,
  isExcludedFromPublicPlaylistModifiers,
  publicPlaylistExcludedModifiers,
} from "../../src/server/MapPlaylist";

vi.mock("../../src/server/MapLandTiles", () => ({
  getMapLandTiles: async () => 1_000_000,
}));

const NUKE_SAM_UNITS = [
  UnitType.MissileSilo,
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.SAMLauncher,
] as const;

describe("MapPlaylist public rotation excludes nuke/SAM modifiers", () => {
  it("lists water nukes, no-SAM, and no-nukes as playlist-excluded", () => {
    expect(publicPlaylistExcludedModifiers()).toEqual(
      expect.arrayContaining([
        "isWaterNukes",
        "isSAMsDisabled",
        "isNukesDisabled",
      ]),
    );
    expect(isExcludedFromPublicPlaylistModifiers("isWaterNukes")).toBe(true);
    expect(isExcludedFromPublicPlaylistModifiers("isSAMsDisabled")).toBe(true);
    expect(isExcludedFromPublicPlaylistModifiers("isNukesDisabled")).toBe(true);
    expect(isExcludedFromPublicPlaylistModifiers("isDoomsdayClock")).toBe(
      false,
    );
  });

  it("never rolls water nukes, no-SAM, or no-nukes onto special configs", async () => {
    const playlist = new MapPlaylist();
    for (let i = 0; i < 80; i++) {
      const config = await playlist.gameConfig("special");
      expect(config.publicGameModifiers?.isWaterNukes).toBeFalsy();
      expect(config.publicGameModifiers?.isSAMsDisabled).toBeFalsy();
      expect(config.publicGameModifiers?.isNukesDisabled).toBeFalsy();
      expect(config.waterNukes).toBeFalsy();
      for (const unit of NUKE_SAM_UNITS) {
        expect(config.disabledUnits ?? []).not.toContain(unit);
      }
    }
  });

  it("does not apply map-forced water nukes when every chance roll succeeds", async () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const playlist = new MapPlaylist();
      for (let i = 0; i < 40; i++) {
        const config = await playlist.gameConfig("special");
        expect(config.publicGameModifiers?.isWaterNukes).toBeFalsy();
        expect(config.waterNukes).toBeFalsy();
      }
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("never applies those modifiers to FFA or team public configs either", async () => {
    const playlist = new MapPlaylist();
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      for (let i = 0; i < 10; i++) {
        const config = await playlist.gameConfig(type);
        expect(config.publicGameModifiers?.isWaterNukes).toBeFalsy();
        expect(config.publicGameModifiers?.isSAMsDisabled).toBeFalsy();
        expect(config.publicGameModifiers?.isNukesDisabled).toBeFalsy();
        expect(config.waterNukes).toBeFalsy();
        for (const unit of NUKE_SAM_UNITS) {
          expect(config.disabledUnits ?? []).not.toContain(unit);
        }
      }
    }
  });
});
