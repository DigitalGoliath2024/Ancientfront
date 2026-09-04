import { describe, expect, it } from "vitest";
import { portHasVisibleHealthBar } from "../../../src/core/game/PortDamage";

const MAX = 1000;

describe("PortDamage", () => {
  it("shows a health bar at any level while hull is chipped", () => {
    expect(portHasVisibleHealthBar(2, MAX, MAX)).toBe(false);
    expect(portHasVisibleHealthBar(10, 1, MAX)).toBe(true);
    expect(portHasVisibleHealthBar(1, MAX, MAX)).toBe(false);
    expect(portHasVisibleHealthBar(1, 500, MAX)).toBe(true);
    expect(portHasVisibleHealthBar(1, 0, MAX)).toBe(false);
  });
});
