import {
  applyInlandBatteryBlast,
  inlandBatteryShotDest,
} from "../src/core/execution/InlandBatteryBlast";
import { PlayerExecution } from "../src/core/execution/PlayerExecution";
import { InlandBatteryExecution } from "../src/core/execution/InlandBatteryExecution";
import { InlandBatteryShellExecution } from "../src/core/execution/InlandBatteryShellExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

let game: Game;
let player1: Player;
let player2: Player;

describe("Inland Battery", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { instantBuild: true },
      [
        new PlayerInfo("gunner", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("target", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    player1.addGold(20_000_000n);
    player2.addGold(20_000_000n);
    executeTicks(game, 10);
  });

  test("is in the land build menu and costs 1.5 million", () => {
    expect(game.config().unitInfo(UnitType.InlandBattery).upgradable).toBe(
      true,
    );
    expect(game.config().unitInfo(UnitType.InlandBattery).maxLevel).toBe(10);
    expect(game.config().unitInfo(UnitType.InlandBattery).cost(game, player1)).toBe(
      1_500_000n,
    );
  });

  test("range grows from 100 to 210 and shell count equals level", () => {
    expect(game.config().inlandBatteryRange(1)).toBe(100);
    expect(game.config().inlandBatteryRange(10)).toBe(210);
    expect(game.config().inlandBatteryRange(50)).toBe(210);
    expect(game.config().inlandBatteryShellCount(1)).toBe(1);
    expect(game.config().inlandBatteryShellCount(10)).toBe(10);
  });

  test("places on owned land and not on water", () => {
    const land = game.ref(5, 10);
    player1.conquer(land);
    expect(player1.canBuild(UnitType.InlandBattery, land)).not.toBe(false);

    const water = game.ref(15, 10);
    expect(game.isWater(water)).toBe(true);
    expect(player1.canBuild(UnitType.InlandBattery, water)).toBe(false);
  });

  test("water impact is a dud", () => {
    const land = game.ref(5, 10);
    player1.conquer(land);
    const battery = player1.buildUnit(UnitType.InlandBattery, land, {});
    const water = game.ref(15, 10);
    expect(game.isWater(water)).toBe(true);
    const owner = game.owner(water);
    const beforeFallout = game.numTilesWithFallout();
    const shell = new InlandBatteryShellExecution(
      land,
      player1,
      battery,
      water,
    );
    game.addExecution(shell);
    executeTicks(game, 80);
    expect(game.numTilesWithFallout()).toBe(beforeFallout);
    expect(game.owner(water)).toBe(owner);
    expect(battery.isActive()).toBe(true);
  });

  test("land blast unowns enemy tiles and scorches them", () => {
    const center = game.ref(5, 10);
    player2.conquer(center);
    for (let x = 4; x <= 6; x++) {
      for (let y = 9; y <= 11; y++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) {
          player2.conquer(tile);
        }
      }
    }
    expect(game.owner(center)).toBe(player2);
    applyInlandBatteryBlast(game, center, player1, null);
    expect(game.owner(center).isPlayer()).toBe(false);
    expect(game.hasFallout(center)).toBe(true);
  });

  test("does not scorch the shooter's land or delete their battery", () => {
    const gunTile = game.ref(5, 10);
    const near = game.ref(6, 10);
    player1.conquer(gunTile);
    player1.conquer(near);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    applyInlandBatteryBlast(game, gunTile, player1, battery);
    expect(battery.isActive()).toBe(true);
    expect(game.owner(gunTile)).toBe(player1);
    expect(game.hasFallout(gunTile)).toBe(false);
  });

  test("blast radius is a small patch, not a 10-tile crater", () => {
    expect(game.config().inlandBatteryBlastRadius()).toBe(4);
    const center = game.ref(2, 8);
    const far = game.ref(2, 2);
    player2.conquer(center);
    player2.conquer(far);
    applyInlandBatteryBlast(game, center, player1, null);
    expect(game.hasFallout(center)).toBe(true);
    expect(game.owner(far)).toBe(player2);
    expect(game.hasFallout(far)).toBe(false);
  });

  test("fires a shell at nearby enemy land", () => {
    const gunTile = game.ref(1, 10);
    const enemyTile = game.ref(6, 10);
    player1.conquer(gunTile);
    player2.conquer(enemyTile);
    const battery = player1.buildUnit(UnitType.InlandBattery, gunTile, {});
    game.addExecution(new InlandBatteryExecution(battery));
    executeTicks(game, 40);
    const shells = player1.units(UnitType.Shell).filter((u) => u.isActive());
    const fallout = game.numTilesWithFallout();
    expect(shells.length + fallout).toBeGreaterThan(0);
    expect(battery.isActive()).toBe(true);
  });

  test("level 10 salvo fans into an arc instead of one tile", () => {
    const from = game.ref(1, 8);
    const aim = game.ref(6, 8);
    const dests = new Set<number>();
    for (let i = 0; i < 10; i++) {
      dests.add(inlandBatteryShotDest(game, from, aim, i, 10, 100));
    }
    expect(dests.size).toBeGreaterThan(3);
  });

  test("is destroyed when the tile is captured, not transferred", () => {
    const tile = game.ref(5, 10);
    player1.conquer(tile);
    const battery = player1.buildUnit(UnitType.InlandBattery, tile, {});
    game.addExecution(new PlayerExecution(player1));
    game.addExecution(new PlayerExecution(player2));
    player2.conquer(tile);
    executeTicks(game, 2);
    expect(battery.isActive()).toBe(false);
    expect(player2.units(UnitType.InlandBattery)).toHaveLength(0);
  });
});
