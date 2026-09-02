import { PortGunExecution } from "../src/core/execution/PortGunExecution";
import { ShellExecution } from "../src/core/execution/ShellExecution";
import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  BuildableAttacks,
  BuildMenus,
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
let player2: Player;

describe("Port Gun", () => {
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

  test("caps at level 10 and reaches max range there", () => {
    const info = game.config().unitInfo(UnitType.PortGun);
    expect(info.upgradable).toBe(true);
    expect(info.maxLevel).toBe(10);
    expect(game.config().portGunRange(1)).toBe(80);
    expect(game.config().portGunRange(2)).toBe(83);
    expect(game.config().portGunRange(4)).toBe(91);
    expect(game.config().portGunRange(10)).toBe(113);
    expect(game.config().portGunRange(50)).toBe(113);
    const gun = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    for (let i = 0; i < 9; i++) {
      gun.increaseLevel();
    }
    expect(gun.level()).toBe(10);
    expect(player1.canUpgradeUnit(gun)).toBe(false);
  });

  test("each upgrade adds 4 percent shell damage", () => {
    const spawn = game.ref(coastX, 10);
    const targetTile = game.ref(coastX + 1, 10);
    const target = player2.buildUnit(UnitType.Warship, targetTile, {
      patrolTile: targetTile,
    });
    const gun = player1.buildUnit(UnitType.PortGun, spawn, {});
    const shell = new ShellExecution(spawn, player1, gun, target);
    shell.init(game, game.ticks());
    const base = shell.getEffectOnTargetForTesting();

    gun.increaseLevel();
    const upgraded = new ShellExecution(spawn, player1, gun, target);
    upgraded.init(game, game.ticks());
    expect(upgraded.getEffectOnTargetForTesting()).toBe(
      Math.floor((base * 104) / 100),
    );
  });

  test("the first upgrade adds armor, peaking at 75 percent by level 10", () => {
    const spawn = game.ref(coastX + 1, 10);
    const gunTile = game.ref(coastX, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const gun = player2.buildUnit(UnitType.PortGun, gunTile, {});
    const shell = new ShellExecution(spawn, player1, warship, gun);
    shell.init(game, game.ticks());
    const base = shell.getEffectOnTargetForTesting();

    gun.increaseLevel();
    const armored = new ShellExecution(spawn, player1, warship, gun);
    armored.init(game, game.ticks());
    expect(armored.getEffectOnTargetForTesting()).toBe(
      Math.floor((base * 92) / 100),
    );
  });

  test("port gun armor reaches 75 percent at level 10", () => {
    const spawn = game.ref(coastX + 1, 10);
    const gunTile = game.ref(coastX, 10);
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const gun = player2.buildUnit(UnitType.PortGun, gunTile, {});
    const shell = new ShellExecution(spawn, player1, warship, gun);
    shell.init(game, game.ticks());
    const base = shell.getEffectOnTargetForTesting();

    for (let i = 0; i < 9; i++) {
      gun.increaseLevel();
    }
    expect(gun.level()).toBe(10);
    const stacked = new ShellExecution(spawn, player1, warship, gun);
    stacked.init(game, game.ticks());
    expect(stacked.getEffectOnTargetForTesting()).toBe(
      Math.floor((base * 25) / 100),
    );
  });

  test("fires on a nearby enemy warship", () => {
    const spawn = game.ref(coastX, 10);
    const targetTile = game.ref(coastX + 1, 10);
    const warship = player2.buildUnit(UnitType.Warship, targetTile, {
      patrolTile: targetTile,
    });
    const gun = player1.buildUnit(UnitType.PortGun, spawn, {});
    const startingHealth = warship.health();

    game.addExecution(new PortGunExecution(gun));
    executeTicks(game, 50);

    expect(warship.health()).toBeLessThan(startingHealth);
  });

  test("has hull that ships can damage", () => {
    expect(game.config().unitInfo(UnitType.PortGun).maxHealth).toBe(1000);
    const gun = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    expect(gun.hasHealth()).toBe(true);
    expect(gun.health()).toBe(1000);
  });

  test("warships shell nearby port guns", () => {
    const gun = player2.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    const warship = player1.buildUnit(
      UnitType.Warship,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const startingHealth = gun.health();
    game.addExecution(new WarshipExecution(warship));
    executeTicks(game, 50);
    expect(gun.isActive()).toBe(true);
    expect(gun.health()).toBeLessThan(startingHealth);
  });

  test("marauders shell nearby port guns", () => {
    const gun = player2.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    const marauder = player1.buildUnit(
      UnitType.Marauder,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    const startingHealth = gun.health();
    game.addExecution(new WarshipExecution(marauder));
    executeTicks(game, 50);
    expect(gun.health()).toBeLessThan(startingHealth);
  });

  test("transport light guns deal half warship shell damage", () => {
    const spawn = game.ref(coastX + 1, 10);
    const target = player2.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    const warship = player1.buildUnit(UnitType.Warship, spawn, {
      patrolTile: spawn,
    });
    const transport = player1.buildUnit(UnitType.TransportShip, spawn, {
      targetTile: spawn,
    });

    const warshipShell = new ShellExecution(spawn, player1, warship, target);
    warshipShell.init(game, game.ticks());
    const full = warshipShell.getEffectOnTargetForTesting();

    const transportShell = new ShellExecution(
      spawn,
      player1,
      transport,
      target,
    );
    transportShell.init(game, game.ticks());
    expect(transportShell.getEffectOnTargetForTesting()).toBe(
      Math.floor(full / 2),
    );
  });

  test("missile-era units are not in the build menu", () => {
    expect(BuildMenus.has(UnitType.SAMLauncher)).toBe(false);
    expect(BuildMenus.has(UnitType.MissileSilo)).toBe(false);
    expect(BuildMenus.has(UnitType.AtomBomb)).toBe(false);
    expect(BuildableAttacks.has(UnitType.Warship)).toBe(true);
    expect(BuildMenus.has(UnitType.PortGun)).toBe(true);
  });

  test("transport light guns shoot half as far as warships", () => {
    const warshipRange = game.config().warshipTargettingRange();
    expect(game.config().transportTargettingRange()).toBe(warshipRange / 2);
  });

  test("Repairman does not heal below level 4", () => {
    const gun = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    gun.increaseLevel();
    gun.increaseLevel();
    expect(gun.level()).toBe(3);
    gun.modifyHealth(-50);
    const damaged = gun.health();
    game.addExecution(new PortGunExecution(gun));
    executeTicks(game, 20);
    expect(gun.health()).toBe(damaged);
  });

  test("Repairman slowly heals at level 4", () => {
    const gun = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    gun.increaseLevel();
    gun.increaseLevel();
    gun.increaseLevel();
    expect(gun.level()).toBe(4);
    gun.modifyHealth(-50);
    const damaged = gun.health();
    const interval = game.config().portGunRepairmanInterval(4);
    const heal = game.config().portGunRepairmanHealPerPulse(4);
    game.addExecution(new PortGunExecution(gun));
    executeTicks(game, interval + 4);
    expect(gun.health()).toBe(damaged + heal);
  });

  test("Repairman heals a bit faster above level 4", () => {
    const level4 = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 10), {});
    level4.increaseLevel();
    level4.increaseLevel();
    level4.increaseLevel();
    const level5 = player1.buildUnit(UnitType.PortGun, game.ref(coastX, 12), {});
    level5.increaseLevel();
    level5.increaseLevel();
    level5.increaseLevel();
    level5.increaseLevel();
    level4.modifyHealth(-50);
    level5.modifyHealth(-50);
    const damaged4 = level4.health();
    const damaged5 = level5.health();
    const interval5 = game.config().portGunRepairmanInterval(5);
    game.addExecution(new PortGunExecution(level4));
    game.addExecution(new PortGunExecution(level5));
    executeTicks(game, interval5 + 2);
    expect(level5.health()).toBeGreaterThan(damaged5);
    expect(level4.health()).toBe(damaged4);
  });

  test("Repairman at level 10 matches the old high-tier pace", () => {
    expect(game.config().portGunRepairmanHealPerPulse(4)).toBe(1);
    expect(game.config().portGunRepairmanHealPerPulse(6)).toBe(2);
    expect(game.config().portGunRepairmanHealPerPulse(10)).toBe(4);
    expect(game.config().portGunRepairmanInterval(10)).toBe(4);
    expect(game.config().portGunRepairmanHealPerPulse(50)).toBe(4);
    expect(game.config().portGunRepairmanInterval(50)).toBe(4);
  });

  test("volley size is 1, then 2 at level 4, then 3 at level 7", () => {
    expect(game.config().portGunShellCount(1)).toBe(1);
    expect(game.config().portGunShellCount(3)).toBe(1);
    expect(game.config().portGunShellCount(4)).toBe(2);
    expect(game.config().portGunShellCount(6)).toBe(2);
    expect(game.config().portGunShellCount(7)).toBe(3);
    expect(game.config().portGunShellCount(10)).toBe(3);
    expect(game.config().portGunShellCount(50)).toBe(3);
  });

  test("a level 4 battery fires two shells in one volley", () => {
    const spawn = game.ref(coastX, 10);
    const targetTile = game.ref(coastX + 8, 10);
    player2.buildUnit(UnitType.Warship, targetTile, {
      patrolTile: targetTile,
    });
    const gun = player1.buildUnit(UnitType.PortGun, spawn, {});
    gun.increaseLevel();
    gun.increaseLevel();
    gun.increaseLevel();
    expect(gun.level()).toBe(4);
    game.addExecution(new PortGunExecution(gun));
    executeTicks(game, 4);
    expect(
      player1.units(UnitType.Shell).filter((unit) => unit.isActive()).length,
    ).toBe(2);
  });
});
