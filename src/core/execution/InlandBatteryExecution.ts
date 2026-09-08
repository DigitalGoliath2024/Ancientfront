import { Execution, Game, PlayerType, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { pickInlandBatteryDests } from "./InlandBatteryBlast";
import { InlandBatteryShellExecution } from "./InlandBatteryShellExecution";

export function inlandBatteryIsReady(mg: Game, post: Unit): boolean {
  if (!post.isActive() || post.isUnderConstruction()) {
    return false;
  }
  const last = post.lastVolleyTick();
  if (last === 0) {
    return true;
  }
  return mg.ticks() - last >= mg.config().inlandBatteryReloadTicks();
}

export function inlandBatteryShouldAutoFire(post: Unit): boolean {
  if (post.owner().type() !== PlayerType.Human) {
    return true;
  }
  return post.autoFire();
}

/** Returns the first shell dest if a volley launched, otherwise null. */
export function fireInlandBatteryVolley(
  mg: Game,
  post: Unit,
  aim: TileRef | null,
): TileRef | null {
  if (!inlandBatteryIsReady(mg, post)) {
    return null;
  }
  const level = post.level();
  const dests = pickInlandBatteryDests(
    mg,
    post.tile(),
    post.owner(),
    mg.config().inlandBatteryShellCount(level),
    mg.config().inlandBatteryRange(level),
    mg.config().inlandBatteryMinFireRange(),
    mg.config().inlandBatterySpreadRadius(level),
    aim,
  );
  if (dests.length === 0) {
    return null;
  }
  post.setLastVolleyTick(mg.ticks());
  const from = post.tile();
  const owner = post.owner();
  for (const dest of dests) {
    mg.addExecution(
      new InlandBatteryShellExecution(from, owner, post, dest),
    );
  }
  return dests[0];
}

export class InlandBatteryExecution implements Execution {
  private mg: Game;
  private active = true;
  private nextAttemptTick = 0;
  private lastAim: TileRef | null = null;

  constructor(private post: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    this.nextAttemptTick = this.post.id() % 15;
  }

  tick(ticks: number): void {
    if (!this.post.isActive()) {
      this.active = false;
      return;
    }
    if (this.post.type() !== UnitType.InlandBattery) {
      this.active = false;
      return;
    }
    if (!inlandBatteryShouldAutoFire(this.post)) {
      return;
    }
    if (ticks < this.nextAttemptTick) {
      return;
    }
    if (!inlandBatteryIsReady(this.mg, this.post)) {
      this.nextAttemptTick = ticks + 8;
      return;
    }
    const aim = this.lastAim;
    const fired = fireInlandBatteryVolley(this.mg, this.post, aim);
    if (fired !== null) {
      this.lastAim = fired;
      this.nextAttemptTick = ticks + 8;
    } else {
      this.lastAim = null;
      // Empty searches used to rescan a 200-tile disk every tick.
      this.nextAttemptTick = ticks + 30;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
