import { describe, expect, it, vi } from "vitest";
import { GameMapType, maps } from "../../src/core/game/Game";
import { SCHEDULED_PUBLIC_GAME_TYPES } from "../../src/core/Schemas";
import {
  buildPublicPlaylistMaps,
  isExcludedFromPublicPlaylist,
  MapPlaylist,
} from "../../src/server/MapPlaylist";

vi.mock("../../src/server/MapLandTiles", () => ({
  getMapLandTiles: async () => 1_000_000,
}));

const COSMIC_OR_TOURNAMENT = maps.filter(
  (m) => m.categories.includes("cosmic") || m.categories.includes("tournament"),
);

describe("MapPlaylist public rotation excludes cosmic and tournament", () => {
  it("marks every cosmic and tournament map as playlist-excluded", () => {
    expect(COSMIC_OR_TOURNAMENT.length).toBeGreaterThan(0);
    for (const mapInfo of COSMIC_OR_TOURNAMENT) {
      expect(isExcludedFromPublicPlaylist(mapInfo)).toBe(true);
    }
    const world = maps.find((m) => m.type === GameMapType.World);
    expect(world).toBeDefined();
    expect(isExcludedFromPublicPlaylist(world!)).toBe(false);
  });

  it("omits those maps from FFA, team, and special weighted lists", () => {
    const excludedTypes = new Set(COSMIC_OR_TOURNAMENT.map((m) => m.type));
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      const playlist = buildPublicPlaylistMaps(type);
      expect(playlist.length).toBeGreaterThan(0);
      for (const map of playlist) {
        expect(excludedTypes.has(map)).toBe(false);
      }
      expect(playlist).toContain(GameMapType.World);
    }
  });

  it("keeps Sol out of special even though its frequency would otherwise include it", () => {
    expect(GameMapType.Sol).toBeDefined();
    const sol = maps.find((m) => m.type === GameMapType.Sol);
    expect(sol?.categories).toContain("cosmic");
    expect(sol?.ffaFrequency).toBe(0);
    expect(sol?.teamFrequency).toBe(0);
    expect(sol?.specialFrequency).toBe(-1);
    expect(sol!.multiplayerFrequency).toBeGreaterThan(0);
    expect(buildPublicPlaylistMaps("special")).not.toContain(GameMapType.Sol);
    expect(buildPublicPlaylistMaps("ffa")).not.toContain(GameMapType.Sol);
    expect(buildPublicPlaylistMaps("team")).not.toContain(GameMapType.Sol);
  });

  it("never schedules a cosmic or tournament map on rolled public configs", async () => {
    const excludedTypes = new Set(COSMIC_OR_TOURNAMENT.map((m) => m.type));
    const playlist = new MapPlaylist();
    for (const type of SCHEDULED_PUBLIC_GAME_TYPES) {
      for (let i = 0; i < 40; i++) {
        const config = await playlist.gameConfig(type);
        expect(excludedTypes.has(config.gameMap)).toBe(false);
      }
    }
  });
});
