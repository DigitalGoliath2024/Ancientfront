import { PlayerExecution } from "../../../src/core/execution/PlayerExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";
import { executeTicks } from "../../util/utils";

let game: Game;
let player: Player;
let otherPlayer: Player;

describe("PlayerExecution", () => {
  beforeEach(async () => {
    game = await setup(
      "big_plains",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("player", PlayerType.Human, "client_id1", "player_id"),
        new PlayerInfo("other", PlayerType.Human, "client_id2", "other_id"),
      ],
    );

    player = game.player("player_id");
    otherPlayer = game.player("other_id");

    game.addExecution(new PlayerExecution(player));
    game.addExecution(new PlayerExecution(otherPlayer));
  });

  test("DefensePost lv. 1 is destroyed when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const defensePost = player.buildUnit(UnitType.DefensePost, tile, {});

    game.executeNextTick();
    expect(game.unitCount(UnitType.DefensePost)).toBe(1);
    expect(defensePost.level()).toBe(1);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.DefensePost)).toBe(0);
  });

  test("DefensePost lv. 2+ is destroyed when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const defensePost = player.buildUnit(UnitType.DefensePost, tile, {});
    defensePost.increaseLevel();

    expect(defensePost.level()).toBe(2);
    expect(game.unitCount(UnitType.DefensePost)).toBe(2); // unitCount sums levels
    expect(player.units(UnitType.DefensePost)).toHaveLength(1);
    expect(defensePost.isActive()).toBe(true);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.DefensePost)).toBe(0);
    expect(defensePost.isActive()).toBe(false);
  });

  test("Armory is destroyed when tile owner changes, even if the captor has none", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const armory = player.buildUnit(UnitType.Armory, tile, {});
    armory.increaseLevel();

    expect(armory.isActive()).toBe(true);
    expect(otherPlayer.units(UnitType.Armory)).toHaveLength(0);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(armory.isActive()).toBe(false);
    expect(game.unitCount(UnitType.Armory)).toBe(0);
    expect(otherPlayer.units(UnitType.Armory)).toHaveLength(0);
    expect(game.config().weaponTechLevel(otherPlayer)).toBe(0);
  });

  test("capturing a second Armory cannot leave the captor with two", () => {
    const firstTile = game.ref(50, 50);
    const stolenTile = game.ref(51, 51);
    otherPlayer.conquer(firstTile);
    player.conquer(stolenTile);
    otherPlayer.buildUnit(UnitType.Armory, firstTile, {});
    const stolen = player.buildUnit(UnitType.Armory, stolenTile, {});

    otherPlayer.conquer(stolenTile);
    executeTicks(game, 2);

    expect(stolen.isActive()).toBe(false);
    expect(otherPlayer.units(UnitType.Armory)).toHaveLength(1);
    expect(game.config().weaponTechLevel(otherPlayer)).toBe(1);
  });

  test("Non-DefensePost structures are transferred (not downgraded) when tile owner changes", () => {
    const tile = game.ref(50, 50);
    player.conquer(tile);
    const city = player.buildUnit(UnitType.City, tile, {});

    expect(game.unitCount(UnitType.City)).toBe(1);
    expect(city.level()).toBe(1);
    expect(city.owner()).toBe(player);
    expect(city.isActive()).toBe(true);

    otherPlayer.conquer(tile);
    executeTicks(game, 2);

    expect(game.unitCount(UnitType.City)).toBe(1);
    expect(city.level()).toBe(1);
    expect(city.owner()).toBe(otherPlayer);
    expect(city.isActive()).toBe(true);
  });
});
