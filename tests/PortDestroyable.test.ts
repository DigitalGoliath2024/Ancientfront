import { ShellExecution } from "../src/core/execution/ShellExecution";
import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { portHasVisibleHealthBar } from "../src/core/game/PortDamage";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let player1: Player;
let player2: Player;

describe("Destroyable ports", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("coast", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("fleet", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 50);
  });

  function buildPort(level = 1) {
    const port = player2.buildUnit(UnitType.Port, game.ref(coastX, 10), {});
    for (let i = 1; i < level; i++) {
      port.increaseLevel();
    }
    return port;
  }

  test("L1 ports have a hull matching the configured max", () => {
    expect(game.config().unitInfo(UnitType.Port).maxHealth).toBe(1000);
    expect(game.config().portMaxHealth()).toBe(1000);
    const port = buildPort();
    expect(port.hasHealth()).toBe(true);
    expect(port.health()).toBe(1000);
    expect(port.maxHealth()).toBe(1000);
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(false);
  });

  test("cities and silos have a finite hull", () => {
    expect(game.config().unitInfo(UnitType.City).maxHealth).toBe(
      game.config().cityMaxHealth(),
    );
    expect(game.config().unitInfo(UnitType.MissileSilo).maxHealth).toBe(
      game.config().missileSiloMaxHealth(),
    );
    const city = player2.buildUnit(UnitType.City, game.ref(coastX, 12), {});
    expect(city.hasHealth()).toBe(true);
    expect(city.health()).toBe(game.config().cityMaxHealth());
  });

  test("upgrades add HP and keep the level; damage chips the bar", () => {
    const port = buildPort(4);
    expect(port.level()).toBe(4);
    expect(port.maxHealth()).toBe(
      game.config().portMaxHealth() + 3 * game.config().portHealthPerLevel(),
    );
    port.modifyHealth(-400, player1);
    expect(port.isActive()).toBe(true);
    expect(port.level()).toBe(4);
    expect(port.health()).toBe(port.maxHealth() - 400);
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(true);
    expect(port.structureNeedsRepair()).toBe(true);
  });

  test("L1 dies and is gone when HP hits 0", () => {
    const port = buildPort();
    port.modifyHealth(-port.health(), player1);
    expect(port.isActive()).toBe(false);
    expect(player2.units(UnitType.Port)).toHaveLength(0);
  });

  test("an upgraded port dies when its full scaled hull is emptied", () => {
    const port = buildPort(3);
    port.modifyHealth(-port.maxHealth(), player1);
    expect(port.isActive()).toBe(false);
  });

  test("upgrading a damaged port refills to the new max", () => {
    const port = buildPort();
    port.modifyHealth(-400, player1);
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(true);
    port.increaseLevel();
    expect(port.level()).toBe(2);
    expect(port.health()).toBe(port.maxHealth());
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(false);
  });

  test("warship shells chip an L1 port", () => {
    const port = buildPort();
    const spawn = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const startingHealth = port.health();
    const shell = new ShellExecution(spawn, player1, warship, port);
    shell.init(game, game.ticks());
    const damage = shell.getEffectOnTargetForTesting();
    expect(damage).toBeGreaterThan(0);
    port.modifyHealth(-damage, player1);
    expect(port.isActive()).toBe(true);
    expect(port.health()).toBe(startingHealth - damage);
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(true);
  });

  test("warship shells chip an upgraded port without dropping its level", () => {
    const port = buildPort(2);
    const spawn = game.ref(coastX + 1, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const max = port.maxHealth();
    const shell = new ShellExecution(spawn, player1, warship, port);
    shell.init(game, game.ticks());
    const damage = shell.getEffectOnTargetForTesting();
    port.modifyHealth(-damage, player1);
    expect(port.isActive()).toBe(true);
    expect(port.level()).toBe(2);
    expect(port.health()).toBe(max - damage);
    expect(
      portHasVisibleHealthBar(port.level(), port.health(), port.maxHealth()),
    ).toBe(true);
  });

  test("warships fire on a nearby enemy port", () => {
    const port = buildPort();
    const warship = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const startingHealth = port.health();
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 50);
    expect(port.isActive()).toBe(true);
    expect(port.health()).toBeLessThan(startingHealth);
  });

  test("marauders fire on a nearby enemy port", () => {
    const port = buildPort();
    const marauder = player1.buildUnit(
      UnitType.Marauder,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const startingHealth = port.health();
    game.addExecution(new WarshipExecution(marauder));
    executeTicks(game, 50);
    expect(port.health()).toBeLessThan(startingHealth);
  });
});
