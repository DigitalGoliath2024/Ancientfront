import { Execution, Game, Player, PlayerType, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import {
  fireInlandBatteryVolley,
  inlandBatteryShouldAutoFire,
} from "./InlandBatteryExecution";

export class FireInlandBatteryExecution implements Execution {
  private active = true;
  private mg: Game;

  constructor(
    private player: Player,
    private unitId: number,
    private tile: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.active) {
      return;
    }
    this.active = false;
    const unit = this.mg.unit(this.unitId);
    if (
      unit === undefined ||
      !unit.isActive() ||
      unit.owner() !== this.player ||
      unit.type() !== UnitType.InlandBattery
    ) {
      return;
    }
    if (inlandBatteryShouldAutoFire(unit)) {
      return;
    }
    if (!this.mg.isValidRef(this.tile)) {
      return;
    }
    fireInlandBatteryVolley(this.mg, unit, this.tile);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}

export class SetInlandBatteryAutoExecution implements Execution {
  private active = true;

  constructor(
    private player: Player,
    private unitId: number,
    private autoFire: boolean,
  ) {}

  init(mg: Game, _ticks: number): void {
    const unit = mg.unit(this.unitId);
    if (
      unit === undefined ||
      !unit.isActive() ||
      unit.owner() !== this.player ||
      unit.type() !== UnitType.InlandBattery
    ) {
      this.active = false;
      return;
    }
    if (this.player.type() !== PlayerType.Human) {
      this.active = false;
      return;
    }
    unit.setAutoFire(this.autoFire);
    this.active = false;
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
