/**
 * Port hull / demotion math. Integer-only so the sim stays deterministic.
 *
 * Level 1 uses real HP (the visible health bar). Each level above 1 is a
 * hidden demotion bucket equal to that same hull: damage fills the bucket,
 * then the port drops one level and leftover spills into the next bucket
 * (or into L1 HP). L2+ never reduces reported HP, so health bars stay off.
 */

export type PortIntegrity = {
  level: number;
  health: number;
  /** Damage toward the next demotion. Meaningful only while level > 1. */
  demotionDamage: number;
};

export type PortIntegrityResult = PortIntegrity & {
  destroyed: boolean;
};

/** One demotion bucket is exactly one L1 hull. */
export function portDemotionBucketHp(maxHealth: number): number {
  return maxHealth;
}

/** Health bars are L1-only, and only while the hull is actually chipped. */
export function portHasVisibleHealthBar(
  level: number,
  health: number,
  maxHealth: number,
): boolean {
  return level <= 1 && maxHealth > 0 && health > 0 && health < maxHealth;
}

export function applyPortIntegrityDelta(
  state: PortIntegrity,
  delta: number,
  maxHealth: number,
): PortIntegrityResult {
  if (maxHealth <= 0 || delta === 0) {
    return { ...state, destroyed: false };
  }

  let { level, health, demotionDamage } = state;
  if (level < 1) {
    return { level, health: 0, demotionDamage: 0, destroyed: true };
  }

  if (delta > 0) {
    if (level <= 1) {
      health = Math.min(maxHealth, health + delta);
    } else {
      demotionDamage = Math.max(0, demotionDamage - delta);
    }
    return { level, health, demotionDamage, destroyed: false };
  }

  let remaining = -delta;
  const bucket = portDemotionBucketHp(maxHealth);

  while (remaining > 0 && level > 1) {
    const space = bucket - demotionDamage;
    if (remaining < space) {
      demotionDamage += remaining;
      remaining = 0;
      break;
    }
    remaining -= space;
    demotionDamage = 0;
    level -= 1;
    health = maxHealth;
  }

  if (remaining > 0 && level <= 1) {
    health = Math.max(0, health - remaining);
  }

  return {
    level,
    health,
    demotionDamage,
    destroyed: level <= 1 && health <= 0,
  };
}
