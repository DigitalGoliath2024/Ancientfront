import { ConstructionExecution } from "../../../src/core/execution/ConstructionExecution";
import {
  Game,
  MAX_UPGRADE_AMOUNT,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

const coastX = 7;

describe("Bulk combat-ship construction", () => {
  let game: Game;
  let player: Player;

  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [new PlayerInfo("navy", PlayerType.Human, null, "player_1_id")],
    );
    player = game.player("player_1_id");
    player.conquer(game.ref(coastX, 10));
    player.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    executeTicks(game, 2);
  });

  test("one intent can spawn several warships, staggered about two seconds apart", () => {
    const water = game.ref(coastX + 1, 10);
    game.addExecution(
      new ConstructionExecution(player, UnitType.Warship, water, undefined, 3),
    );
    executeTicks(game, 4);
    expect(player.units(UnitType.Warship)).toHaveLength(1);

    executeTicks(game, game.config().combatShipBulkSpawnDelayTicks());
    expect(player.units(UnitType.Warship)).toHaveLength(2);

    executeTicks(game, game.config().combatShipBulkSpawnDelayTicks());
    expect(player.units(UnitType.Warship)).toHaveLength(3);
  });

  test("one intent can spawn several marauders, staggered about two seconds apart", () => {
    const water = game.ref(coastX + 1, 10);
    game.addExecution(
      new ConstructionExecution(player, UnitType.Marauder, water, undefined, 2),
    );
    executeTicks(game, 4);
    expect(player.units(UnitType.Marauder)).toHaveLength(1);

    executeTicks(game, game.config().combatShipBulkSpawnDelayTicks());
    expect(player.units(UnitType.Marauder)).toHaveLength(2);
  });

  test("warship bulk prices escalate like extra ships", async () => {
    game = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [new PlayerInfo("navy", PlayerType.Human, null, "player_1_id")],
    );
    player = game.player("player_1_id");
    player.addGold(50_000_000n);
    player.conquer(game.ref(coastX, 10));
    player.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    executeTicks(game, 2);

    const water = game.ref(coastX + 1, 10);
    const bu = player
      .buildableUnits(water)
      .find((u) => u.type === UnitType.Warship);
    expect(bu?.canBuild).not.toBe(false);
    expect(bu?.upgradeCosts).toHaveLength(MAX_UPGRADE_AMOUNT);
    expect(bu!.upgradeCosts![0]).toBe(bu!.cost);
    expect(bu!.upgradeCosts![1]).toBeGreaterThan(bu!.cost);
  });
});
