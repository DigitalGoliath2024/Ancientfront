import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

describe("Upgraded buildings take extra HP instead of demoting", () => {
  let game: Game;
  let player1: Player;
  let player2: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("navy", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("shore", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 1);
  });

  function upgradeTo(type: UnitType, tile: ReturnType<Game["ref"]>, level: number) {
    const unit = player2.buildUnit(type, tile, {});
    for (let i = 1; i < level; i++) {
      unit.increaseLevel();
    }
    return unit;
  }

  it.each([
    [UnitType.City, 5, 10],
    [UnitType.Factory, 4, 10],
    [UnitType.PortGun, 7, 10],
    [UnitType.InlandBattery, 5, 10],
    [UnitType.Armory, 5, 12],
    [UnitType.Port, 7, 12],
  ] as const)("%s L3 keeps its level and chips HP from one hull of damage", (type, x, y) => {
    const building = upgradeTo(type, game.ref(x, y), 3);
    const hull = building.maxHealth();
    building.modifyHealth(-Math.min(hull - 1, 1000), player1);
    expect(building.isActive()).toBe(true);
    expect(building.level()).toBe(3);
    expect(building.health()).toBeLessThan(hull);
    expect(building.structureNeedsRepair()).toBe(true);
  });

  it.each([
    [UnitType.City, 5, 10],
    [UnitType.Factory, 4, 10],
    [UnitType.PortGun, 7, 10],
    [UnitType.InlandBattery, 5, 10],
    [UnitType.Armory, 5, 12],
    [UnitType.Port, 7, 12],
  ] as const)("%s is destroyed when its scaled hull hits 0", (type, x, y) => {
    const building = upgradeTo(type, game.ref(x, y), 3);
    building.modifyHealth(-building.maxHealth(), player1);
    expect(building.isActive()).toBe(false);
  });

  it("port guns still cap at level 10", () => {
    const gun = upgradeTo(UnitType.PortGun, game.ref(7, 10), 10);
    expect(gun.level()).toBe(10);
    expect(game.config().unitInfo(UnitType.PortGun).maxLevel).toBe(10);
    expect(gun.maxHealth()).toBe(1000 + 9 * game.config().portGunHealthPerLevel());
  });
});
