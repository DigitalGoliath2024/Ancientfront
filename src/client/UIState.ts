import { PlayerBuildableUnitType } from "../core/game/Game";

export interface UIState {
  attackRatio: number;
  ghostStructure: PlayerBuildableUnitType | null;
  rocketDirectionUp: boolean;
  upgradeMultiplier: number;
  /** Own inland battery being aimed for a manual volley; null when not aiming. */
  inlandBatteryAimUnitId?: number | null;
}
