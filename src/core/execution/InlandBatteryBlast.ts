import { atan2 } from "../DetMath";
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

function sectorOf(
  dx: number,
  dy: number,
  salvo: number,
): number {
  let a = atan2(dy, dx) + PI;
  if (a < 0) {
    a = 0;
  }
  if (a >= TWO_PI) {
    a = TWO_PI - 1 / 1024;
  }
  let s = ((a * salvo) / TWO_PI) | 0;
  if (s < 0) {
    s = 0;
  }
  if (s >= salvo) {
    s = salvo - 1;
  }
  return s;
}

/**
 * Wide U-fan: consecutive shells land about 8 tiles apart (touching 4-tile
 * burns). Offset is in tiles, not scaled down when the target is close.
 */
export function inlandBatteryShotDest(
  mg: Game,
  from: TileRef,
  aim: TileRef,
  shotIndex: number,
  shotCount: number,
  range: number,
): TileRef {
  const fx = mg.x(from);
  const fy = mg.y(from);
  const ax = mg.x(aim);
  const ay = mg.y(aim);
  const dx = ax - fx;
  const dy = ay - fy;
  const dist = isqrt(dx * dx + dy * dy);
  const travel = dist < range ? dist : range;
  if (dist === 0) {
    return aim;
  }
  let cx = fx + (((dx * travel) / dist) | 0);
  let cy = fy + (((dy * travel) / dist) | 0);
  if (shotCount > 1) {
    const off = shotIndex * 2 - (shotCount - 1);
    const spread = 4;
    cx += (((-dy * off * spread) / dist) | 0);
    cy += (((dx * off * spread) / dist) | 0);
  }
  if (!mg.isValidCoord(cx, cy)) {
    cx = Math.max(0, Math.min(mg.width() - 1, cx));
    cy = Math.max(0, Math.min(mg.height() - 1, cy));
  }
  return mg.ref(cx, cy);
}

/**
 * One dest per shell: cover every direction that has enemy land, punch a
 * little past the nearest contact, and spend leftover shells on the original
 * wide U-fan so a single neighbor still gets a spread salvo.
 */
export function pickInlandBatteryDests(
  mg: Game,
  from: TileRef,
  owner: Player,
  salvo: number,
  range: number,
  minFire: number,
): TileRef[] {
  const range2 = range * range;
  const minFire2 = minFire * minFire;
  const blast = mg.config().inlandBatteryBlastRadius();
  const punch = 2 * blast;
  const bx = mg.x(from);
  const by = mg.y(from);
  const x0 = Math.max(0, bx - range);
  const x1 = Math.min(mg.width() - 1, bx + range);
  const y0 = Math.max(0, by - range);
  const y1 = Math.min(mg.height() - 1, by + range);

  const nearest: (TileRef | null)[] = new Array(salvo).fill(null);
  const nearestD2: number[] = new Array(salvo).fill(range2 + 1);
  let bestOverall: TileRef | null = null;
  let bestOverallD2 = range2 + 1;

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = mg.ref(x, y);
      const d2 = mg.euclideanDistSquared(from, tile);
      if (d2 < minFire2 || d2 > range2) {
        continue;
      }
      if (!isEnemyLand(mg, tile, owner)) {
        continue;
      }
      const s = sectorOf(x - bx, y - by, salvo);
      if (d2 < nearestD2[s]) {
        nearestD2[s] = d2;
        nearest[s] = tile;
      }
      if (d2 < bestOverallD2) {
        bestOverallD2 = d2;
        bestOverall = tile;
      }
    }
  }

  if (bestOverall === null) {
    return [];
  }

  const structPick: (TileRef | null)[] = new Array(salvo).fill(null);
  const structD2: number[] = new Array(salvo).fill(range2 + 1);
  for (const { unit, distSquared } of mg.nearbyUnits(
    from,
    range,
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
    const s = sectorOf(mg.x(tile) - bx, mg.y(tile) - by, salvo);
    if (distSquared < structD2[s]) {
      structD2[s] = distSquared;
      structPick[s] = tile;
    }
  }

  const desiredD2: number[] = new Array(salvo);
  const pick: (TileRef | null)[] = nearest.slice();
  const pickErr: number[] = new Array(salvo);
  for (let s = 0; s < salvo; s++) {
    if (nearest[s] === null) {
      desiredD2[s] = 0;
      pickErr[s] = 0;
      continue;
    }
    const nearDist = isqrt(nearestD2[s]);
    const want = nearDist + punch;
    const wantClamped = want > range ? range : want;
    desiredD2[s] = wantClamped * wantClamped;
    pickErr[s] = nearestD2[s] > desiredD2[s] ? nearestD2[s] - desiredD2[s] : desiredD2[s] - nearestD2[s];
  }

  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = mg.ref(x, y);
      const d2 = mg.euclideanDistSquared(from, tile);
      if (d2 < minFire2 || d2 > range2) {
        continue;
      }
      if (!isEnemyLand(mg, tile, owner)) {
        continue;
      }
      const s = sectorOf(x - bx, y - by, salvo);
      if (nearest[s] === null) {
        continue;
      }
      const err = d2 > desiredD2[s] ? d2 - desiredD2[s] : desiredD2[s] - d2;
      if (err < pickErr[s]) {
        pickErr[s] = err;
        pick[s] = tile;
      }
    }
  }

  const dests: TileRef[] = [];
  const used = new Set<TileRef>();
  for (let s = 0; s < salvo; s++) {
    const tile = structPick[s] ?? pick[s];
    if (tile === null || used.has(tile)) {
      continue;
    }
    used.add(tile);
    dests.push(tile);
  }

  for (let i = 0; i < salvo * 3 && dests.length < salvo; i++) {
    const dest = inlandBatteryShotDest(
      mg,
      from,
      bestOverall,
      i % salvo,
      salvo,
      range,
    );
    if (mg.euclideanDistSquared(from, dest) < minFire2) {
      continue;
    }
    if (used.has(dest)) {
      continue;
    }
    const destOwner = mg.owner(dest);
    if (
      destOwner.isPlayer() &&
      (destOwner === owner || destOwner.isFriendly(owner))
    ) {
      continue;
    }
    used.add(dest);
    dests.push(dest);
  }

  return dests;
}

function isProtectedOwner(owner: Player, destroyer: Player): boolean {
  return owner === destroyer || owner.isFriendly(destroyer);
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
  for (const unit of mg.units()) {
    if (!unit.isActive()) {
      continue;
    }
    if (unit === skipUnit) {
      continue;
    }
    const type = unit.type();
    if (
      type === UnitType.Shell ||
      type === UnitType.AtomBomb ||
      type === UnitType.HydrogenBomb ||
      type === UnitType.MIRVWarhead ||
      type === UnitType.MIRV ||
      type === UnitType.SAMMissile
    ) {
      continue;
    }
    if (mg.euclideanDistSquared(dst, unit.tile()) > radius2) {
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
