import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player1: Player;

describe("Marauder", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [new PlayerInfo("navy", PlayerType.Human, null, "player_1_id")],
    );
    player1 = game.player("player_1_id");
    executeTicks(game, 50);
  });

  test("costs half as much as a warship", () => {
    const warshipCost = game.config().unitInfo(UnitType.Warship).cost(game, player1);
    const marauderCost = game
      .config()
      .unitInfo(UnitType.Marauder)
      .cost(game, player1);
    expect(marauderCost).toBe(warshipCost / 2n);
  });

  test("has half the hit points of a warship", () => {
    const warshipHp = game.config().unitInfo(UnitType.Warship).maxHealth;
    const marauderHp = game.config().unitInfo(UnitType.Marauder).maxHealth;
    expect(marauderHp).toBe((warshipHp ?? 0) / 2);
  });

  test("spawns as a combat ship with half the warship hull", () => {
    const marauder = player1.buildUnit(
      UnitType.Marauder,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    expect(marauder.type()).toBe(UnitType.Marauder);
    expect(marauder.health()).toBe(500);
  });

  test("moves one and a half times as fast as a warship", () => {
    const marauderStart = game.ref(coastX + 1, 10);
    const warshipStart = game.ref(coastX + 1, 12);
    const dest = game.ref(15, 11);
    expect(game.isWater(dest)).toBe(true);

    const marauder = player1.buildUnit(UnitType.Marauder, marauderStart, {
      patrolTile: marauderStart,
    });
    const warship = player1.buildUnit(UnitType.Warship, warshipStart, {
      patrolTile: warshipStart,
    });
    marauder.setTargetTile(dest);
    warship.setTargetTile(dest);

    const marauderExec = new WarshipExecution(marauder);
    const warshipExec = new WarshipExecution(warship);
    marauderExec.init(game, 50);
    warshipExec.init(game, 50);

    marauderExec.tick(50);
    warshipExec.tick(50);
    marauderExec.tick(51);
    warshipExec.tick(51);

    const marauderMoved = game.manhattanDist(marauderStart, marauder.tile());
    const warshipMoved = game.manhattanDist(warshipStart, warship.tile());
    expect(warshipMoved).toBe(2);
    expect(marauderMoved).toBe(3);
  });
});
