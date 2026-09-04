import { AttackLogicInput, Config } from "../src/core/configuration/Config";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  TerrainType,
  UnitType,
} from "../src/core/game/Game";
import { UserSettings } from "../src/core/game/UserSettings";
import { GameConfig } from "../src/core/Schemas";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const config = new Config({} as GameConfig, new UserSettings(), false);

function defender(
  o: Partial<NonNullable<AttackLogicInput["defender"]>> & {
    numTiles: number;
    troops: number;
  },
): NonNullable<AttackLogicInput["defender"]> {
  return {
    type: PlayerType.Human,
    isTraitor: false,
    isDisconnectedTeammate: false,
    ...o,
  };
}

function attack(o: Partial<AttackLogicInput> = {}) {
  return config.attackLogic({
    terrain: TerrainType.Plains,
    attackTroops: 100_000,
    attacker: { type: PlayerType.Human, numTiles: 20_000 },
    defender: defender({ numTiles: 20_000, troops: 100_000 }),
    defenderHasDefensePost: false,
    falloutRatio: null,
    borderSize: 100,
    ...o,
  });
}

let game: Game;
let player1: Player;
let player2: Player;

function conquerPatch(player: Player, cx: number, cy: number, radius = 3) {
  for (let x = cx - radius; x <= cx + radius; x++) {
    for (let y = cy - radius; y <= cy + radius; y++) {
      const tile = game.ref(x, y);
      if (game.isLand(tile)) {
        player.conquer(tile);
      }
    }
  }
}

describe("Armory", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("a", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("b", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    executeTicks(game, 1);
  });

  test("caps at three weapon tiers: swords, muskets, cartridge guns", () => {
    expect(game.config().weaponTechMaxLevel()).toBe(3);
    expect(game.config().unitInfo(UnitType.Armory).maxLevel).toBe(4);
    expect(game.config().unitInfo(UnitType.Armory).unique).toBe(true);
  });

  test("no armory is fists; building starts at swords", () => {
    expect(game.config().weaponTechLevel(player1)).toBe(0);
    const tile = game.ref(5, 10);
    conquerPatch(player1, 5, 10);
    const armory = player1.buildUnit(UnitType.Armory, tile, {});
    expect(armory.level()).toBe(1);
    expect(game.config().weaponTechLevel(player1)).toBe(1);
  });

  test("two upgrades reach cartridge guns; a third unlocks mines", () => {
    const tile = game.ref(5, 10);
    conquerPatch(player1, 5, 10);
    const armory = player1.buildUnit(UnitType.Armory, tile, {});
    expect(player1.canUpgradeUnit(armory)).toBe(true);
    armory.increaseLevel();
    expect(game.config().weaponTechLevel(player1)).toBe(2);
    armory.increaseLevel();
    expect(game.config().weaponTechLevel(player1)).toBe(3);
    expect(player1.canUpgradeUnit(armory)).toBe(true);
    armory.increaseLevel();
    expect(armory.level()).toBe(4);
    expect(game.config().weaponTechLevel(player1)).toBe(3);
    expect(player1.canUpgradeUnit(armory)).toBe(false);
  });

  test("only one at a time; rebuild after destroy", () => {
    const tile = game.ref(5, 10);
    const other = game.ref(6, 11);
    conquerPatch(player1, 5, 10);
    const first = player1.buildUnit(UnitType.Armory, tile, {});
    expect(player1.canBuild(UnitType.Armory, other)).toBe(false);
    first.delete(false);
    expect(game.config().weaponTechLevel(player1)).toBe(0);
    expect(player1.canBuild(UnitType.Armory, other)).not.toBe(false);
  });

  test("cartridge guns beat fists in the land-fight formula", () => {
    const fists = attack({ attackerWeaponTech: 0, defenderWeaponTech: 0 });
    const cartridge = attack({
      attackerWeaponTech: 3,
      defenderWeaponTech: 0,
    });
    expect(cartridge.attackerTroopLoss).toBeLessThan(fists.attackerTroopLoss);
    expect(cartridge.defenderTroopLoss).toBeGreaterThan(fists.defenderTroopLoss);
    expect(cartridge.tickFraction).toBeLessThan(fists.tickFraction);
  });

  test("matching tech leaves the golden formula unchanged", () => {
    const fists = attack();
    const bothCartridge = attack({
      attackerWeaponTech: 3,
      defenderWeaponTech: 3,
    });
    expect(bothCartridge.attackerTroopLoss).toBe(fists.attackerTroopLoss);
    expect(bothCartridge.defenderTroopLoss).toBe(fists.defenderTroopLoss);
    expect(bothCartridge.tickFraction).toBe(fists.tickFraction);
  });

  test("build and three upgrades cost 500k, 1.5M, 3M, then 2M", async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: false, instantBuild: true },
      [
        new PlayerInfo("a", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("b", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player1.addGold(10_000_000n);
    conquerPatch(player1, 5, 10);
    const info = game.config().unitInfo(UnitType.Armory);
    expect(info.cost(game, player1)).toBe(500_000n);
    const armory = player1.buildUnit(UnitType.Armory, game.ref(5, 10), {});
    expect(info.cost(game, player1)).toBe(1_500_000n);
    player1.upgradeUnit(armory);
    expect(armory.level()).toBe(2);
    expect(info.cost(game, player1)).toBe(3_000_000n);
    player1.upgradeUnit(armory);
    expect(armory.level()).toBe(3);
    expect(info.cost(game, player1)).toBe(2_000_000n);
    player1.upgradeUnit(armory);
    expect(armory.level()).toBe(4);
    expect(player1.canUpgradeUnit(armory)).toBe(false);
  });

  test("omitted tech matches fists so golden attackLogic stays valid", () => {
    const omitted = attack();
    const fists = attack({ attackerWeaponTech: 0, defenderWeaponTech: 0 });
    expect(omitted.attackerTroopLoss).toBe(fists.attackerTroopLoss);
    expect(omitted.defenderTroopLoss).toBe(fists.defenderTroopLoss);
    expect(omitted.tickFraction).toBe(fists.tickFraction);
  });
});
