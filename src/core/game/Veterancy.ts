// Shared warship-veterancy math. Lives in src/core (integer percent math, no
// floats) so the engine and the renderer derive identical effective max health.

/**
 * Effective max health for a warship at a given veterancy level.
 *
 * Each veterancy level adds `healthBonusPercent`% of base max health, floored to
 * an integer to keep src/core deterministic. Returns `baseMaxHealth` unchanged
 * at veterancy 0 (and therefore for any non-veteran or non-warship unit).
 */
export function maxHealthWithVeterancy(
  baseMaxHealth: number,
  veterancy: number,
  healthBonusPercent: number,
): number {
  if (veterancy <= 0) {
    return baseMaxHealth;
  }
  return (
    baseMaxHealth +
    Math.floor((baseMaxHealth * veterancy * healthBonusPercent) / 100)
  );
}

/**
 * Warship shells per volley by veterancy rank (gold stripes).
 * Rank 0–1: one shell. Rank 2: two. Rank 3: three.
 * Marauders always fire one — callers must not use this for marauders.
 */
export function warshipShellCountForVeterancy(veterancy: number): number {
  if (veterancy >= 3) {
    return 3;
  }
  if (veterancy >= 2) {
    return 2;
  }
  return 1;
}

/**
 * Integer percent multiplier for a Warship's shell damage.
 * Rank 0: 100 (base). Rank 1+: 100 + bonusPercent (heavy round, not stacked).
 */
export function warshipShellDamagePercent(
  veterancy: number,
  bonusPercent: number,
): number {
  if (veterancy <= 0) {
    return 100;
  }
  return 100 + bonusPercent;
}

/**
 * Assign `shotCount` shots across ranked targets (primary first). Extra shots
 * split onto additional targets, then leftover rounds stack back on the
 * primary via round-robin. Returns an array of length `shotCount`.
 */
export function assignWarshipVolleyTargets<T>(
  targets: readonly T[],
  shotCount: number,
): T[] {
  if (targets.length === 0 || shotCount <= 0) {
    return [];
  }
  const uniqueCount = Math.min(targets.length, shotCount);
  const assigned: T[] = [];
  for (let i = 0; i < shotCount; i++) {
    assigned.push(targets[i % uniqueCount]);
  }
  return assigned;
}

/**
 * HP a max-rank Warship's onboard repairman restores this tick.
 * Ranks below `maxVeterancy` return 0. Callers must also restrict to
 * UnitType.Warship — Marauders share WarshipExecution but do not get this.
 *
 * Default rate is 1 HP every 2 ticks (see Config): 5 HP/s at ~10 ticks/s,
 * or 50 HP per 10 seconds ≈ 3% of rank-3 max health (1600). Half of
 * port-proximity heal (1 HP/tick), so a damaged hull does not snap back
 * in a few seconds (empty → full takes 320s) but a long fight still
 * shows regen. One shell is 250–375 HP, so this cannot out-heal incoming
 * fire.
 */
export function warshipMaxRankRepairHpThisTick(
  veterancy: number,
  maxVeterancy: number,
  tick: number,
  hpPerPulse: number,
  intervalTicks: number,
): number {
  if (veterancy < maxVeterancy || maxVeterancy <= 0) {
    return 0;
  }
  if (hpPerPulse <= 0 || intervalTicks <= 0) {
    return 0;
  }
  if (tick % intervalTicks !== 0) {
    return 0;
  }
  return hpPerPulse;
}
