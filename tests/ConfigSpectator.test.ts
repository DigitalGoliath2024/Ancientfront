import { describe, expect, it } from "vitest";
import { Config } from "../src/core/configuration/Config";
import { EraDisabledUnits, UnitType } from "../src/core/game/Game";
import { GameConfig } from "../src/core/Schemas";

const dummyGameConfig = {} as unknown as GameConfig;

describe("Config.isIntentionalSpectator", () => {
  it("defaults to false when constructor arg is omitted", () => {
    const cfg = new Config(dummyGameConfig, null, false);
    expect(cfg.isIntentionalSpectator()).toBe(false);
  });

  it("returns false when explicitly set to false", () => {
    const cfg = new Config(dummyGameConfig, null, false, false, false);
    expect(cfg.isIntentionalSpectator()).toBe(false);
  });

  it("returns true when explicitly set to true", () => {
    const cfg = new Config(dummyGameConfig, null, false, false, true);
    expect(cfg.isIntentionalSpectator()).toBe(true);
  });
});

describe("Config.isUnitDisabled", () => {
  it("always disables era units even when disabledUnits is empty", () => {
    const cfg = new Config(
      { disabledUnits: [] } as unknown as GameConfig,
      null,
      false,
    );
    expect(cfg.isUnitDisabled(UnitType.SAMLauncher)).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.MissileSilo)).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.AtomBomb)).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.City)).toBe(false);
    for (const type of EraDisabledUnits.types) {
      expect(cfg.isUnitDisabled(type)).toBe(true);
    }
  });
});
