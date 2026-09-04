/**
 * Structure health-bar visibility. Integer-only so the sim stays deterministic.
 *
 * Buildings take real HP at every level. The bar shows whenever hull is
 * chipped (including ports and port guns).
 */

/** Health bars show whenever hull is chipped, at any upgrade level. */
export function portHasVisibleHealthBar(
  _level: number,
  health: number,
  maxHealth: number,
): boolean {
  return maxHealth > 0 && health > 0 && health < maxHealth;
}
