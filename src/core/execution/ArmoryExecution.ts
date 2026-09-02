import { Execution, Game, Unit } from "../game/Game";

/** Keeps the unique Armory alive; weapon tech is read from the unit's level. */
export class ArmoryExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(private armory: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (!this.armory.isActive()) {
      this.active = false;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
