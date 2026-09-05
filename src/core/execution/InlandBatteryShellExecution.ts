import { Execution, Game, Player, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { PathFinding } from "../pathfinding/PathFinder";
import { PathStatus, SteppingPathFinder } from "../pathfinding/types";
import { applyInlandBatteryBlast } from "./InlandBatteryBlast";

export class InlandBatteryShellExecution implements Execution {
  private active = true;
  private pathFinder: SteppingPathFinder<TileRef>;
  private shell: Unit | undefined;
  private mg: Game;

  constructor(
    private spawn: TileRef,
    private _owner: Player,
    private ownerUnit: Unit,
    private dest: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.pathFinder = PathFinding.Air(mg);
    this.mg = mg;
  }

  tick(_ticks: number): void {
    this.shell ??= this._owner.buildUnit(UnitType.Shell, this.spawn, {});
    if (!this.shell.isActive()) {
      this.active = false;
      return;
    }

    for (let i = 0; i < 3; i++) {
      const result = this.pathFinder.next(this.shell.tile(), this.dest);
      if (result.status === PathStatus.COMPLETE) {
        this.active = false;
        this.shell.setReachedTarget();
        if (this.mg.isLand(this.dest) && !this.mg.isImpassable(this.dest)) {
          applyInlandBatteryBlast(
            this.mg,
            this.dest,
            this._owner,
            this.ownerUnit,
          );
        }
        this.shell.delete(false);
        return;
      } else if (result.status === PathStatus.NEXT) {
        this.shell.move(result.node);
      } else {
        this.shell.delete(false);
        this.active = false;
        return;
      }
    }
  }

  owner(): Player {
    return this._owner;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
