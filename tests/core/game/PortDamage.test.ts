import { describe, expect, it } from "vitest";
import {
  applyPortIntegrityDelta,
  portDemotionBucketHp,
  portHasVisibleHealthBar,
  type PortIntegrity,
} from "../../../src/core/game/PortDamage";

const MAX = 1000;

function port(overrides: Partial<PortIntegrity> = {}): PortIntegrity {
  return {
    level: 1,
    health: MAX,
    demotionDamage: 0,
    ...overrides,
  };
}

describe("PortDamage", () => {
  it("uses L1 max HP as the demotion bucket", () => {
    expect(portDemotionBucketHp(MAX)).toBe(MAX);
  });

  it("does not show a health bar above level 1, even if HP is chipped", () => {
    expect(portHasVisibleHealthBar(2, MAX, MAX)).toBe(false);
    expect(portHasVisibleHealthBar(10, 1, MAX)).toBe(false);
    expect(portHasVisibleHealthBar(1, MAX, MAX)).toBe(false);
    expect(portHasVisibleHealthBar(1, 500, MAX)).toBe(true);
    expect(portHasVisibleHealthBar(1, 0, MAX)).toBe(false);
  });

  it("chips L1 HP without changing level", () => {
    const result = applyPortIntegrityDelta(port(), -250, MAX);
    expect(result.level).toBe(1);
    expect(result.health).toBe(750);
    expect(result.demotionDamage).toBe(0);
    expect(result.destroyed).toBe(false);
  });

  it("destroys an L1 port when HP hits 0", () => {
    const result = applyPortIntegrityDelta(port({ health: 200 }), -200, MAX);
    expect(result.destroyed).toBe(true);
    expect(result.health).toBe(0);
    expect(result.level).toBe(1);
  });

  it("demotes L2+ without reducing reported HP", () => {
    const result = applyPortIntegrityDelta(port({ level: 5 }), -MAX, MAX);
    expect(result.level).toBe(4);
    expect(result.health).toBe(MAX);
    expect(result.demotionDamage).toBe(0);
    expect(result.destroyed).toBe(false);
    expect(portHasVisibleHealthBar(result.level, result.health, MAX)).toBe(
      false,
    );
  });

  it("accumulates partial demotion without dropping a level", () => {
    const first = applyPortIntegrityDelta(port({ level: 3 }), -400, MAX);
    expect(first.level).toBe(3);
    expect(first.health).toBe(MAX);
    expect(first.demotionDamage).toBe(400);

    const second = applyPortIntegrityDelta(first, -600, MAX);
    expect(second.level).toBe(2);
    expect(second.health).toBe(MAX);
    expect(second.demotionDamage).toBe(0);
  });

  it("spills leftover into L1 HP when the last extra level drops", () => {
    const result = applyPortIntegrityDelta(
      port({ level: 2 }),
      -(MAX + 250),
      MAX,
    );
    expect(result.level).toBe(1);
    expect(result.health).toBe(750);
    expect(result.destroyed).toBe(false);
    expect(portHasVisibleHealthBar(result.level, result.health, MAX)).toBe(
      true,
    );
  });

  it("spills across several levels in one hit, then into L1 HP", () => {
    // 3 full buckets + 100 leftover: L5 → L2 with 100 toward the next drop
    const partial = applyPortIntegrityDelta(
      port({ level: 5 }),
      -(3 * MAX + 100),
      MAX,
    );
    expect(partial.level).toBe(2);
    expect(partial.health).toBe(MAX);
    expect(partial.demotionDamage).toBe(100);
    expect(portHasVisibleHealthBar(partial.level, partial.health, MAX)).toBe(
      false,
    );

    // Remaining 900 in the L2 bucket + 400 into L1 hull
    const spilled = applyPortIntegrityDelta(partial, -(900 + 400), MAX);
    expect(spilled.level).toBe(1);
    expect(spilled.health).toBe(600);
    expect(spilled.destroyed).toBe(false);
    expect(portHasVisibleHealthBar(spilled.level, spilled.health, MAX)).toBe(
      true,
    );
  });

  it("destroys a high-level port when leftover empties L1 HP", () => {
    const result = applyPortIntegrityDelta(
      port({ level: 3 }),
      -(2 * MAX + MAX),
      MAX,
    );
    expect(result.destroyed).toBe(true);
    expect(result.level).toBe(1);
    expect(result.health).toBe(0);
  });

  it("repairs L1 HP and L2+ demotion progress without restoring levels", () => {
    const l1 = applyPortIntegrityDelta(port({ health: 400 }), 200, MAX);
    expect(l1.health).toBe(600);
    expect(l1.level).toBe(1);

    const l2 = applyPortIntegrityDelta(
      port({ level: 4, demotionDamage: 300 }),
      500,
      MAX,
    );
    expect(l2.level).toBe(4);
    expect(l2.demotionDamage).toBe(0);
    expect(l2.health).toBe(MAX);
  });
});
