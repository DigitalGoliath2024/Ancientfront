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

/** Returns true if a volley actually launched (reload starts then). */
export function fireInlandBatteryVolley(
  mg: Game,
  post: Unit,
  aim: TileRef | null,
): boolean {
  if (!inlandBatteryIsReady(mg, post)) {
    return false;
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
    return false;
  }
  post.setLastVolleyTick(mg.ticks());
  const from = post.tile();
  const owner = post.owner();
  for (const dest of dests) {
    mg.addExecution(
      new InlandBatteryShellExecution(from, owner, post, dest),
    );
  }
  return true;
}

export class InlandBatteryExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(private post: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
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
    fireInlandBatteryVolley(this.mg, this.post, null);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
