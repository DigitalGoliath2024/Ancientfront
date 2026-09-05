import { Execution, Game, Unit } from "../game/Game";
import { pickInlandBatteryDests } from "./InlandBatteryBlast";
import { InlandBatteryShellExecution } from "./InlandBatteryShellExecution";

export class InlandBatteryExecution implements Execution {
  private mg: Game;
  private active = true;
  private lastVolley = 0;

  constructor(private post: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.post.isActive()) {
      this.active = false;
      return;
    }
    if (this.post.isUnderConstruction()) {
      return;
    }

    const reload = this.mg.config().inlandBatteryReloadTicks();
    if (this.lastVolley !== 0 && this.mg.ticks() - this.lastVolley < reload) {
      return;
    }

    const level = this.post.level();
    const dests = pickInlandBatteryDests(
      this.mg,
      this.post.tile(),
      this.post.owner(),
      this.mg.config().inlandBatteryShellCount(level),
      this.mg.config().inlandBatteryRange(level),
      this.mg.config().inlandBatteryMinFireRange(),
    );
    if (dests.length === 0) {
      return;
    }

    this.lastVolley = this.mg.ticks();
    const from = this.post.tile();
    const owner = this.post.owner();
    for (const dest of dests) {
      this.mg.addExecution(
        new InlandBatteryShellExecution(from, owner, this.post, dest),
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
