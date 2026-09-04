import {
  Execution,
  Game,
  MessageType,
  Player,
  Unit,
  UnitType,
} from "../game/Game";
import { TileRef } from "../game/GameMap";
import {
  applyNavalMineDamage,
  triggeringShipOnTile,
} from "../game/NavalMine";

export class NavalMineExecution implements Execution {
  private mg: Game;
  private mine: Unit | null = null;
  private active = true;
  private placedTick = 0;
  private armed = false;

  constructor(
    private player: Player,
    private tile: TileRef,
    existing?: Unit,
  ) {
    this.mine = existing ?? null;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.placedTick = ticks;
    if (this.mine !== null) {
      return;
    }
    const spawn = this.player.canBuild(UnitType.NavalMine, this.tile);
    if (spawn === false) {
      this.active = false;
      return;
    }
    this.mine = this.player.buildUnit(UnitType.NavalMine, spawn, {});
  }

  tick(ticks: number): void {
    if (this.mine === null || !this.mine.isActive()) {
      this.active = false;
      return;
    }

    if (!this.armed) {
      if (ticks - this.placedTick < this.mg.config().navalMineArmingTicks()) {
        return;
      }
      this.armed = true;
    }

    const ship = triggeringShipOnTile(this.mg, this.mine);
    if (ship === undefined) {
      return;
    }

    applyNavalMineDamage(this.mg, ship);
    this.mg.displayMessage(
      "events_display.naval_mine_struck",
      MessageType.NAVAL_MINE_STRUCK,
      ship.owner().id(),
    );
    this.mg.displayMessage(
      "events_display.naval_mine_triggered",
      MessageType.NAVAL_MINE_TRIGGERED,
      this.mine.owner().id(),
    );
    this.mine.delete(false);
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
