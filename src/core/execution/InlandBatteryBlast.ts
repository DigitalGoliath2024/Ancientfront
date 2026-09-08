import { atan2, cos, sin } from "../DetMath";
import { Game, Player, Structures, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";

function isqrt(n: number): number {
  if (n <= 0) {
    return 0;
  }
  let x0 = n;
  let x1 = (x0 + 1) >> 1;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + ((n / x0) | 0)) >> 1;
  }
  return x0;
}

const PI = atan2(0, -1);
const TWO_PI = PI + PI;
/** ~137.5° step so scatter fills the disk instead of tracing a ring. */
const GOLDEN_STEP = (1375 * TWO_PI) / 3600;

function isEnemyLand(
  mg: Game,
  tile: TileRef,
  owner: Player,
): boolean {
  if (!mg.isLand(tile) || mg.isImpassable(tile)) {
    return false;
  }
  const tileOwner = mg.owner(tile);
  if (!tileOwner.isPlayer()) {
    return false;
  }
  return tileOwner !== owner && !tileOwner.isFriendly(owner);
}

function isProtectedOwner(owner: Player, destroyer: Player): boolean {
  return owner === destroyer || owner.isFriendly(destroyer);
}

function clampCoord(mg: Game, x: number, y: number): TileRef {
  const cx = Math.max(0, Math.min(mg.width() - 1, x));
  const cy = Math.max(0, Math.min(mg.height() - 1, y));
  return mg.ref(cx, cy);
}

function inGunRange(
  mg: Game,
  from: TileRef,
  dest: TileRef,
  minFire2: number,
  range2: number,
): boolean {
  const d2 = mg.euclideanDistSquared(from, dest);
  return d2 >= minFire2 && d2 <= range2;
}

/** At most one shell per building in the disk. Leftover rounds hit ground. */
export function inlandBatteryBuildingShots(
  salvo: number,
  buildings: number,
): number {
  if (salvo <= 0 || buildings <= 0) {
    return 0;
  }
  return salvo < buildings ? salvo : buildings;
}

/**
 * One shell inside the bombardment disk. Radii grow with a sunflower
 * layout so a 10-shell volley fills the circle instead of drawing an O.
 */
export function inlandBatteryScatterDest(
  mg: Game,
  aim: TileRef,
  shotIndex: number,
  shotCount: number,
  diskRadius: number,
): TileRef {
  const ax = mg.x(aim);
  const ay = mg.y(aim);
  if (shotCount <= 1 || diskRadius <= 0) {
    return aim;
  }
  const r = isqrt(
    (diskRadius * diskRadius * (2 * shotIndex + 1)) / (2 * shotCount),
  );
  const ang = shotIndex * GOLDEN_STEP;
  const x = ax + ((r * cos(ang)) | 0);
  const y = ay + ((r * sin(ang)) | 0);
  return clampCoord(mg, x, y);
}

function nearestEnemyLand(
  mg: Game,
  from: TileRef,
  owner: Player,
  range: number,
  minFire: number,
): TileRef | null {
  const range2 = range * range;
  const minFire2 = minFire * minFire;
  const bx = mg.x(from);
  const by = mg.y(from);
  const w = mg.width();
  const h = mg.height();
  // Expanding rings: auto-fire only needs some enemy tile, not a full
  // (2*range)^2 nearest-tile scan. Return on the first hit.
  for (let r = minFire; r <= range; r++) {
    for (let i = -r; i <= r; i++) {
      const ring: Array<[number, number]> = [
        [bx + i, by - r],
        [bx + i, by + r],
        [bx - r, by + i],
        [bx + r, by + i],
      ];
      for (const [x, y] of ring) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = x - bx;
        const dy = y - by;
        const d2 = dx * dx + dy * dy;
        if (d2 < minFire2 || d2 > range2) continue;
        const tile = mg.ref(x, y);
        if (isEnemyLand(mg, tile, owner)) {
          return tile;
        }
      }
    }
  }
  return null;
}

function enemyBuildingsInRange(
  mg: Game,
  from: TileRef,
  owner: Player,
  minFire2: number,
  range2: number,
  searchRange: number,
): Unit[] {
  const found: Unit[] = [];
  for (const { unit, distSquared } of mg.nearbyUnits(
    from,
    searchRange,
    Structures.types,
    undefined,
    true,
  )) {
    if (!unit.isActive()) {
      continue;
    }
    if (isProtectedOwner(unit.owner(), owner)) {
      continue;
    }
    if (distSquared < minFire2 || distSquared > range2) {
      continue;
    }
    const tile = unit.tile();
    if (!mg.isLand(tile) || mg.isImpassable(tile)) {
      continue;
    }
    found.push(unit);
  }
  return found;
}

function snapGroundDest(
  mg: Game,
  from: TileRef,
  owner: Player,
  dest: TileRef,
  minFire2: number,
  range2: number,
): TileRef | null {
  if (
    inGunRange(mg, from, dest, minFire2, range2) &&
    isEnemyLand(mg, dest, owner)
  ) {
    return dest;
  }
  const dx = mg.x(dest);
  const dy = mg.y(dest);
  for (let r = 1; r <= 4; r++) {
    for (let ox = -r; ox <= r; ox++) {
      for (let oy = -r; oy <= r; oy++) {
        if (ox !== r && ox !== -r && oy !== r && oy !== -r) {
          continue;
        }
        if (!mg.isValidCoord(dx + ox, dy + oy)) {
          continue;
        }
        const t = mg.ref(dx + ox, dy + oy);
        if (
          inGunRange(mg, from, t, minFire2, range2) &&
          isEnemyLand(mg, t, owner)
        ) {
          return t;
        }
      }
    }
  }
  return null;
}

/**
 * Salvo dests scattered inside the aim disk. Buildings inside that disk
 * are auto-located with at most one shell each. Extra rounds crater enemy
 * ground in the disk.
 * `aim` is the click tile for manual fire, or null to pick automatically.
 */
export function pickInlandBatteryDests(
  mg: Game,
  from: TileRef,
  owner: Player,
  salvo: number,
  range: number,
  minFire: number,
  diskRadius: number,
  aim: TileRef | null = null,
): TileRef[] {
  if (salvo <= 0) {
    return [];
  }
  const range2 = range * range;
  const minFire2 = minFire * minFire;
  const allBuildings = enemyBuildingsInRange(
    mg,
    from,
    owner,
    minFire2,
    range2,
    range,
  );

  let center = aim;
  if (center !== null) {
    if (!inGunRange(mg, from, center, minFire2, range2)) {
      return [];
    }
  } else if (allBuildings.length > 0) {
    allBuildings.sort(
      (a, b) =>
        mg.euclideanDistSquared(from, a.tile()) -
        mg.euclideanDistSquared(from, b.tile()),
    );
    center = allBuildings[0].tile();
  } else {
    center = nearestEnemyLand(mg, from, owner, range, minFire);
  }
  if (center === null) {
    return [];
  }

  const disk2 = diskRadius * diskRadius;
  const buildings = allBuildings.filter(
    (unit) => mg.euclideanDistSquared(center, unit.tile()) <= disk2,
  );
  buildings.sort(
    (a, b) =>
      mg.euclideanDistSquared(center, a.tile()) -
      mg.euclideanDistSquared(center, b.tile()),
  );

  const dests: TileRef[] = [];
  const used = new Set<TileRef>();
  const buildingShots = inlandBatteryBuildingShots(salvo, buildings.length);
  for (let i = 0; i < buildingShots; i++) {
    const tile = buildings[i].tile();
    dests.push(tile);
    used.add(tile);
  }

  for (let i = 0; dests.length < salvo && i < salvo * 8; i++) {
    const scatter = inlandBatteryScatterDest(
      mg,
      center,
      i,
      salvo,
      diskRadius,
    );
    const snapped = snapGroundDest(mg, from, owner, scatter, minFire2, range2);
    if (snapped === null || used.has(snapped)) {
      continue;
    }
    used.add(snapped);
    dests.push(snapped);
  }

  return dests;
}

/**
 * Relinquish enemy land in radius, scorch it, and instantly destroy enemy
 * buildings and other land units in the same circle. Never scorches the
 * shooter's land or deletes the firing battery.
 */
export function applyInlandBatteryBlast(
  mg: Game,
  dst: TileRef,
  destroyer: Player,
  skipUnit: Unit | null,
): void {
  const radius = mg.config().inlandBatteryBlastRadius();
  const radius2 = radius * radius;
  const tiles = mg.circleSearch(
    dst,
    radius,
    (tile, d2) => d2 <= radius2 && mg.isLand(tile) && !mg.isImpassable(tile),
  );

  const tilesPerPlayers = new Map<Player, number>();
  for (const tile of tiles) {
    const owner = mg.owner(tile);
    if (owner.isPlayer() && isProtectedOwner(owner, destroyer)) {
      continue;
    }
    if (owner.isPlayer()) {
      owner.relinquish(tile);
      tilesPerPlayers.set(owner, (tilesPerPlayers.get(owner) ?? 0) + 1);
    }
    if (!mg.hasOwner(tile) && !mg.hasFallout(tile)) {
      mg.setFallout(tile, true);
    }
  }

  for (const [player, numImpactedTiles] of tilesPerPlayers) {
    const tilesBefore = player.numTilesOwned() + numImpactedTiles;
    if (tilesBefore <= 0) {
      continue;
    }
    const troopLoss = ((player.troops() * numImpactedTiles) / tilesBefore) | 0;
    if (troopLoss > 0) {
      player.removeTroops(troopLoss);
    }
    for (const attack of player.outgoingAttacks()) {
      const attackTroops = attack.troops();
      const deaths = ((attackTroops * numImpactedTiles) / tilesBefore) | 0;
      if (deaths > 0) {
        attack.setTroops(attackTroops - deaths);
      }
    }
  }

  const doomed: Unit[] = [];
  for (const { unit } of mg.nearbyUnits(dst, radius, [
    ...Structures.types,
    UnitType.Train,
  ])) {
    if (!unit.isActive() || unit === skipUnit) {
      continue;
    }
    if (!mg.isLand(unit.tile())) {
      continue;
    }
    if (isProtectedOwner(unit.owner(), destroyer)) {
      continue;
    }
    doomed.push(unit);
  }
  for (const unit of doomed) {
    if (unit.isActive()) {
      unit.delete(true, destroyer);
    }
  }
}
