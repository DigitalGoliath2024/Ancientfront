import { isLandBuildCarouselItem } from "../src/client/hud/layers/BuildMenu";
import { ConstructionExecution } from "../src/core/execution/ConstructionExecution";
import { NavalMineExecution } from "../src/core/execution/NavalMineExecution";
import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  BuildableAttacks,
  BuildMenus,
  Game,
  GameMode,
  MessageType,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { GameUpdateType } from "../src/core/game/GameUpdates";
import {
  NAVAL_MINE_ADDITIONAL_COST,
  NAVAL_MINE_ARMING_TICKS,
  NAVAL_MINE_FIRST_COST,
  NAVAL_MINE_MAX_ACTIVE,
  MARAUDER_SPRITE_HALF,
  TRANSPORT_SPRITE_HALF,
  WARSHIP_SPRITE_HALF,
  canSeeNavalMine,
  navalMinesUnlocked,
  waterDistToOwnedLand,
} from "../src/core/game/NavalMine";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;

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

function unlockMines(player: Player) {
  conquerPatch(player, 5, 10);
  const armory = player.buildUnit(UnitType.Armory, game.ref(5, 10), {});
  armory.increaseLevel();
  armory.increaseLevel();
  armory.increaseLevel();
  expect(armory.level()).toBe(4);
}

function placeMine(player: Player, x: number, y: number) {
  const tile = game.ref(x, y);
  game.addExecution(new NavalMineExecution(player, tile));
  executeTicks(game, 1);
  const mines = player.units(UnitType.NavalMine).filter((u) => u.isActive());
  return mines[mines.length - 1];
}

describe("Naval Mine", () => {
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
    executeTicks(game, 1);
  });

  test("is a water-attack placeable and not a land structure", () => {
    expect(BuildableAttacks.has(UnitType.NavalMine)).toBe(true);
    expect(BuildMenus.has(UnitType.NavalMine)).toBe(true);
    expect(isLandBuildCarouselItem(UnitType.NavalMine)).toBe(false);
    expect(isLandBuildCarouselItem(UnitType.City)).toBe(true);
    expect(isLandBuildCarouselItem(UnitType.Warship)).toBe(true);
    expect(game.config().unitInfo(UnitType.NavalMine).maxHealth).toBeUndefined();
  });

  test("locked until Armory level 4", () => {
    conquerPatch(player1, 5, 10);
    const water = game.ref(coastX + 2, 10);
    expect(navalMinesUnlocked(player1)).toBe(false);
    expect(player1.canBuild(UnitType.NavalMine, water)).toBe(false);

    const armory = player1.buildUnit(UnitType.Armory, game.ref(5, 10), {});
    expect(player1.canBuild(UnitType.NavalMine, water)).toBe(false);
    armory.increaseLevel();
    armory.increaseLevel();
    expect(game.config().weaponTechLevel(player1)).toBe(3);
    expect(player1.canBuild(UnitType.NavalMine, water)).toBe(false);
    armory.increaseLevel();
    expect(navalMinesUnlocked(player1)).toBe(true);
    expect(player1.canBuild(UnitType.NavalMine, water)).not.toBe(false);
  });

  test("costs 250k then 500k by current active count", async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: false, instantBuild: true },
      [
        new PlayerInfo("coast", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("fleet", PlayerType.Human, null, "player_2_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player1.addGold(10_000_000n);
    unlockMines(player1);
    const info = game.config().unitInfo(UnitType.NavalMine);
    expect(info.cost(game, player1)).toBe(BigInt(NAVAL_MINE_FIRST_COST));

    const first = player1.buildUnit(
      UnitType.NavalMine,
      game.ref(coastX + 2, 4),
      {},
    );
    expect(info.cost(game, player1)).toBe(BigInt(NAVAL_MINE_ADDITIONAL_COST));
    player1.buildUnit(UnitType.NavalMine, game.ref(coastX + 2, 12), {});
    expect(info.cost(game, player1)).toBe(BigInt(NAVAL_MINE_ADDITIONAL_COST));

    first.delete(false);
    expect(info.cost(game, player1)).toBe(BigInt(NAVAL_MINE_ADDITIONAL_COST));
    const leftover = player1.units(UnitType.NavalMine).filter((u) => u.isActive());
    leftover[0].delete(false);
    expect(info.cost(game, player1)).toBe(BigInt(NAVAL_MINE_FIRST_COST));
  });

  test("max three active mines per player", () => {
    unlockMines(player1);
    const tiles = [
      game.ref(coastX + 1, 2),
      game.ref(coastX + 1, 6),
      game.ref(coastX + 1, 10),
      game.ref(coastX + 1, 14),
    ];
    player1.buildUnit(UnitType.NavalMine, tiles[0], {});
    player1.buildUnit(UnitType.NavalMine, tiles[1], {});
    player1.buildUnit(UnitType.NavalMine, tiles[2], {});
    expect(player1.units(UnitType.NavalMine).length).toBe(NAVAL_MINE_MAX_ACTIVE);
    expect(player1.canBuild(UnitType.NavalMine, tiles[3])).toBe(false);
  });

  test("rejects land, impassable, and tiles under a ship", () => {
    unlockMines(player1);
    expect(player1.canBuild(UnitType.NavalMine, game.ref(5, 10))).toBe(false);
    const water = game.ref(coastX + 2, 10);
    player2.buildUnit(UnitType.Warship, water, { patrolTile: water });
    expect(player1.canBuild(UnitType.NavalMine, water)).toBe(false);
  });

  test("requires 15 tiles between mines", () => {
    unlockMines(player1);
    const first = game.ref(coastX + 2, 0);
    expect(player1.canBuild(UnitType.NavalMine, first)).not.toBe(false);
    player1.buildUnit(UnitType.NavalMine, first, {});
    const tooClose = game.ref(coastX + 2, 14);
    expect(player1.canBuild(UnitType.NavalMine, tooClose)).toBe(false);
    const farEnough = game.ref(coastX + 2, 15);
    expect(player1.canBuild(UnitType.NavalMine, farEnough)).not.toBe(false);
  });

  test("water distance to owned land is capped at 30", () => {
    unlockMines(player1);
    const coastalWater = game.ref(coastX + 1, 10);
    expect(game.isWater(coastalWater)).toBe(true);
    expect(waterDistToOwnedLand(game, player1, coastalWater, 0)).toBe(0);
    const farther = game.ref(15, 10);
    expect(game.isWater(farther)).toBe(true);
    const dist = waterDistToOwnedLand(game, player1, farther, 30);
    expect(dist).not.toBe(false);
    expect(waterDistToOwnedLand(game, player1, farther, (dist as number) - 1)).toBe(
      false,
    );
  });

  test("does not trigger until 100 ticks have armed it", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    const mine = placeMine(player1, coastX + 2, 10);
    expect(mine.isActive()).toBe(true);

    const ship = player2.buildUnit(UnitType.Marauder, tile, {
      patrolTile: tile,
    });
    executeTicks(game, NAVAL_MINE_ARMING_TICKS - 1);
    expect(mine.isActive()).toBe(true);
    expect(ship.isActive()).toBe(true);

    executeTicks(game, 2);
    expect(mine.isActive()).toBe(false);
    expect(ship.isActive()).toBe(false);
  });

  test("trade ships pass without trigger or reveal", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    const mine = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const port = player2.buildUnit(UnitType.Port, game.ref(coastX, 12), {});
    const trade = player2.buildUnit(UnitType.TradeShip, tile, {
      targetUnit: port,
    });
    executeTicks(game, 5);
    expect(mine.isActive()).toBe(true);
    expect(trade.isActive()).toBe(true);
  });

  test("destroys marauder and troop transport", () => {
    unlockMines(player1);
    const marauderTile = game.ref(coastX + 2, 10);
    const mine1 = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const marauder = player2.buildUnit(UnitType.Marauder, marauderTile, {
      patrolTile: marauderTile,
    });
    executeTicks(game, 2);
    expect(mine1.isActive()).toBe(false);
    expect(marauder.isActive()).toBe(false);

    const transportTile = game.ref(coastX + 2, 2);
    const mine2 = placeMine(player1, coastX + 2, 2);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const transport = player2.buildUnit(UnitType.TransportShip, transportTile, {
      troops: 100,
    });
    executeTicks(game, 2);
    expect(mine2.isActive()).toBe(false);
    expect(transport.isActive()).toBe(false);
  });

  test("warship takes 70 percent of max HP", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const warship = player2.buildUnit(UnitType.Warship, tile, {
      patrolTile: tile,
    });
    game.addExecution(new WarshipExecution(warship));
    const max = warship.maxHealth();
    executeTicks(game, 2);
    expect(warship.isActive()).toBe(true);
    expect(warship.health()).toBe(max - Math.floor((max * 70) / 100));
  });

  test("owner and teammate see a mine; enemies do not", async () => {
    game = await setup(
      "half_land_half_ocean",
      {
        infiniteGold: true,
        instantBuild: true,
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [
        new PlayerInfo("a", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("b", PlayerType.Human, null, "player_2_id"),
        new PlayerInfo("c", PlayerType.Human, null, "player_3_id"),
      ],
    );
    player1 = game.player("player_1_id");
    player2 = game.player("player_2_id");
    const player3 = game.player("player_3_id");
    executeTicks(game, 1);
    unlockMines(player1);
    const mine = player1.buildUnit(
      UnitType.NavalMine,
      game.ref(coastX + 2, 10),
      {},
    );
    expect(canSeeNavalMine(player1, mine.owner())).toBe(true);
    if (player2.isOnSameTeam(player1)) {
      expect(canSeeNavalMine(player2, mine.owner())).toBe(true);
      expect(canSeeNavalMine(player3, mine.owner())).toBe(false);
    } else {
      expect(canSeeNavalMine(player2, mine.owner())).toBe(false);
    }
  });

  test("detonation messages go to victim and owner", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    player2.buildUnit(UnitType.Marauder, tile, { patrolTile: tile });
    const updates = game.executeNextTick();
    executeTicks(game, 1);
    const events = [
      ...(updates[GameUpdateType.DisplayEvent] ?? []),
      ...(game.executeNextTick()[GameUpdateType.DisplayEvent] ?? []),
    ];
    const messages = events.map((e) => e.message);
    expect(messages).toContain("events_display.naval_mine_struck");
    expect(messages).toContain("events_display.naval_mine_triggered");
    expect(
      events.some(
        (e) =>
          e.message === "events_display.naval_mine_struck" &&
          e.messageType === MessageType.NAVAL_MINE_STRUCK,
      ),
    ).toBe(true);
  });

  test("ConstructionExecution places a mine via the build_unit path", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    game.addExecution(
      new ConstructionExecution(player1, UnitType.NavalMine, tile),
    );
    executeTicks(game, 4);
    expect(player1.units(UnitType.NavalMine).length).toBe(1);
  });

  test("owner and teammate ships do not trigger", () => {
    unlockMines(player1);
    const tile = game.ref(coastX + 2, 10);
    const mine = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const own = player1.buildUnit(UnitType.Warship, tile, { patrolTile: tile });
    executeTicks(game, 3);
    expect(mine.isActive()).toBe(true);
    expect(own.isActive()).toBe(true);
  });

  test("warship one tile away detonates — 13×13 hull covers the mine", () => {
    unlockMines(player1);
    const mine = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const beside = game.ref(coastX + 3, 10);
    const warship = player2.buildUnit(UnitType.Warship, beside, {
      patrolTile: beside,
    });
    const max = warship.maxHealth();
    executeTicks(game, 2);
    expect(mine.isActive()).toBe(false);
    expect(warship.isActive()).toBe(true);
    expect(warship.health()).toBe(max - Math.floor((max * 70) / 100));
  });

  test("warship at the 13×13 hull edge detonates", () => {
    unlockMines(player1);
    const mineX = coastX + 2;
    const mineY = 10;
    const mine = placeMine(player1, mineX, mineY);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const edge = game.ref(mineX, mineY - WARSHIP_SPRITE_HALF);
    expect(game.isWater(edge)).toBe(true);
    const warship = player2.buildUnit(UnitType.Warship, edge, {
      patrolTile: edge,
    });
    executeTicks(game, 2);
    expect(mine.isActive()).toBe(false);
    expect(warship.health()).toBeLessThan(warship.maxHealth());
  });

  test("warship outside the 13×13 hull does not trigger", () => {
    unlockMines(player1);
    const mineX = coastX + 2;
    const mineY = 10;
    const mine = placeMine(player1, mineX, mineY);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const outside = game.ref(mineX, mineY - WARSHIP_SPRITE_HALF - 1);
    expect(game.isWater(outside)).toBe(true);
    const warship = player2.buildUnit(UnitType.Warship, outside, {
      patrolTile: outside,
    });
    executeTicks(game, 5);
    expect(mine.isActive()).toBe(true);
    expect(warship.isActive()).toBe(true);
    expect(warship.health()).toBe(warship.maxHealth());
  });

  test("marauder and transport hulls trigger one tile away", () => {
    unlockMines(player1);
    const mine1 = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const marauder = player2.buildUnit(UnitType.Marauder, game.ref(coastX + 3, 10), {
      patrolTile: game.ref(coastX + 3, 10),
    });
    executeTicks(game, 2);
    expect(mine1.isActive()).toBe(false);
    expect(marauder.isActive()).toBe(false);

    const mine2 = placeMine(player1, coastX + 2, 2);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const transport = player2.buildUnit(
      UnitType.TransportShip,
      game.ref(coastX + 3, 2),
      { troops: 100 },
    );
    executeTicks(game, 2);
    expect(mine2.isActive()).toBe(false);
    expect(transport.isActive()).toBe(false);
  });

  test("marauder and transport miss when outside their smaller hulls", () => {
    unlockMines(player1);
    const mineX = coastX + 2;
    const mine = placeMine(player1, mineX, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const marauderTile = game.ref(mineX, 10 - MARAUDER_SPRITE_HALF - 1);
    const marauder = player2.buildUnit(UnitType.Marauder, marauderTile, {
      patrolTile: marauderTile,
    });
    executeTicks(game, 3);
    expect(mine.isActive()).toBe(true);
    expect(marauder.isActive()).toBe(true);

    marauder.delete(false);
    const transportTile = game.ref(mineX, 10 - TRANSPORT_SPRITE_HALF - 1);
    const transport = player2.buildUnit(UnitType.TransportShip, transportTile, {
      troops: 50,
    });
    executeTicks(game, 3);
    expect(mine.isActive()).toBe(true);
    expect(transport.isActive()).toBe(true);
  });

  test("trade ship hull overlap does not trigger", () => {
    unlockMines(player1);
    const mine = placeMine(player1, coastX + 2, 10);
    executeTicks(game, NAVAL_MINE_ARMING_TICKS + 1);
    const port = player2.buildUnit(UnitType.Port, game.ref(coastX, 12), {});
    const beside = game.ref(coastX + 3, 10);
    const trade = player2.buildUnit(UnitType.TradeShip, beside, {
      targetUnit: port,
    });
    executeTicks(game, 5);
    expect(mine.isActive()).toBe(true);
    expect(trade.isActive()).toBe(true);
  });

  test("no team cap: each teammate can hold three mines", async () => {
    game = await setup(
      "half_land_half_ocean",
      {
        infiniteGold: true,
        instantBuild: true,
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [
        new PlayerInfo("a", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("b", PlayerType.Human, null, "player_2_id"),
        new PlayerInfo("c", PlayerType.Human, null, "player_3_id"),
      ],
    );
    player1 = game.player("player_1_id");
    const others = [
      game.player("player_2_id"),
      game.player("player_3_id"),
    ];
    executeTicks(game, 1);
    const teammate = others.find((p) => p.isOnSameTeam(player1));
    expect(teammate).toBeDefined();

    unlockMines(player1);
    for (let x = 2; x <= 8; x++) {
      for (let y = 1; y <= 4; y++) {
        const tile = game.ref(x, y);
        if (game.isLand(tile)) {
          teammate!.conquer(tile);
        }
      }
    }
    const armory = teammate!.buildUnit(UnitType.Armory, game.ref(5, 2), {});
    armory.increaseLevel();
    armory.increaseLevel();
    armory.increaseLevel();
    expect(navalMinesUnlocked(teammate!)).toBe(true);

    for (let i = 0; i < NAVAL_MINE_MAX_ACTIVE; i++) {
      player1.buildUnit(UnitType.NavalMine, game.ref(coastX + 1, i * 2), {});
      teammate!.buildUnit(UnitType.NavalMine, game.ref(coastX + 2, i * 2), {});
    }
    expect(player1.units(UnitType.NavalMine).length).toBe(NAVAL_MINE_MAX_ACTIVE);
    expect(teammate!.units(UnitType.NavalMine).length).toBe(
      NAVAL_MINE_MAX_ACTIVE,
    );
    expect(player1.canBuild(UnitType.NavalMine, game.ref(coastX + 1, 14))).toBe(
      false,
    );
    expect(
      teammate!.canBuild(UnitType.NavalMine, game.ref(coastX + 2, 14)),
    ).toBe(false);
  });
});
