import { describe, expect, it } from "vitest";
import { getActiveModifiers, getModifierLabels } from "../../src/client/Utils";

// The doomsday clock is part of the public "special" modifier rotation, so an
// active isDoomsdayClock modifier must surface a lobby badge like every other
// rotation modifier.
describe("doomsday clock public modifier", () => {
  it("surfaces a doomsday-clock badge when the modifier is active", () => {
    const mods = getActiveModifiers({ isDoomsdayClock: true });
    expect(mods).toHaveLength(1);
    expect(mods[0].badgeKey).toBe("public_game_modifier.doomsday_clock");
    expect(mods[0].labelKey).toBe("game_settings.doomsday_clock");
  });

  it("names the preset when a speed is provided", () => {
    const mods = getActiveModifiers({ isDoomsdayClock: true }, "fast");
    expect(mods).toHaveLength(1);
    expect(mods[0].badgeKey).toBe(
      "public_game_modifier.doomsday_clock_with_speed",
    );
    expect(mods[0].labelKey).toBe("game_settings.doomsday_clock");
    // The speed is resolved to its translated label and passed as a badge param.
    expect(mods[0].badgeParams?.speed).toBeDefined();
  });

  it("omits the badge when the modifier is absent", () => {
    expect(getActiveModifiers({})).toHaveLength(0);
    expect(getActiveModifiers(undefined)).toHaveLength(0);
  });
});

// Lobby cards (homepage + more-games) read getModifierLabels. Nuke/SAM
// themes still exist as modifiers, but those labels are omitted from pills.
describe("lobby card modifier pills hide nuke/SAM themes", () => {
  it("still describes water nukes, no-SAM, and no-nukes for non-card UI", () => {
    expect(getActiveModifiers({ isWaterNukes: true })[0].badgeKey).toBe(
      "public_game_modifier.water_nukes",
    );
    expect(getActiveModifiers({ isSAMsDisabled: true })[0].badgeKey).toBe(
      "public_game_modifier.sams_disabled",
    );
    expect(getActiveModifiers({ isNukesDisabled: true })[0].badgeKey).toBe(
      "public_game_modifier.nukes_disabled",
    );
  });

  it("omits those labels from lobby-card pills while keeping other badges", () => {
    const labels = getModifierLabels({
      isWaterNukes: true,
      isSAMsDisabled: true,
      isNukesDisabled: true,
      isCompact: true,
    });
    expect(labels).toEqual(["public_game_modifier.compact_map"]);
    expect(
      getModifierLabels({
        isWaterNukes: true,
        isSAMsDisabled: true,
        isNukesDisabled: true,
      }),
    ).toEqual([]);
  });
});
