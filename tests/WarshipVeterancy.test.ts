import { ShellExecution } from "../src/core/execution/ShellExecution";
import { WarshipExecution } from "../src/core/execution/WarshipExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  Unit,
  UnitType,
} from "../src/core/game/Game";
import {
  assignWarshipVolleyTargets,
  warshipMaxRankRepairHpThisTick,
  warshipShellCountForVeterancy,
  warshipShellDamagePercent,
} from "../src/core/game/Veterancy";
import { setup } from "./util/Setup";
import { executeTicks } from "./util/utils";

const coastX = 7;
let game: Game;
let attacker: Player;
let defender: Player;

describe("Warship veterancy", () => {
  beforeEach(async () => {
    game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [
        new PlayerInfo("attacker", PlayerType.Human, null, "player_1_id"),
        new PlayerInfo("defender", PlayerType.Human, null, "player_2_id"),
      ],
    );
    attacker = game.player("player_1_id");
    defender = game.player("player_2_id");
  });

  function buildWarship(player: Player, x: number, y: number): Unit {
    return player.buildUnit(UnitType.Warship, game.ref(x, y), {
      patrolTile: game.ref(x, y),
    });
  }

  test("killing an enemy warship grants one veterancy level", () => {
    const ship = buildWarship(attacker, coastX, 10);
    expect(ship.veterancy()).toBe(0);

    ship.recordKill(UnitType.Warship);

    expect(ship.veterancy()).toBe(1);
  });

  test("veterancy is capped at the configured maximum", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const max = game.config().warshipMaxVeterancy();

    for (let i = 0; i < max + 3; i++) {
      ship.recordKill(UnitType.Warship);
    }

    expect(ship.veterancy()).toBe(max);
  });

  test("destroying transport ships alone fills a level at the threshold", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const threshold = game.config().warshipVeterancyTransportKills();

    for (let i = 0; i < threshold - 1; i++) {
      ship.recordKill(UnitType.TransportShip);
    }
    expect(ship.veterancy()).toBe(0);

    ship.recordKill(UnitType.TransportShip);
    expect(ship.veterancy()).toBe(1);
  });

  test("capturing trade ships alone fills a level at the threshold", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const threshold = game.config().warshipVeterancyTradeCaptures();

    for (let i = 0; i < threshold - 1; i++) {
      ship.recordTradeCapture();
    }
    expect(ship.veterancy()).toBe(0);

    ship.recordTradeCapture();
    expect(ship.veterancy()).toBe(1);
  });

  test("transports and captures share one progress meter", () => {
    const ship = buildWarship(attacker, coastX, 10);
    // Defaults: 10 transports OR 25 captures = 1 level, so a transport is worth
    // 1/10 of a level and a capture 1/25. Mixed progress combines.
    for (let i = 0; i < 5; i++) ship.recordKill(UnitType.TransportShip);
    for (let i = 0; i < 12; i++) ship.recordTradeCapture();
    expect(ship.veterancy()).toBe(0); // 5/10 + 12/25 = 0.98 < 1

    ship.recordTradeCapture();
    expect(ship.veterancy()).toBe(1); // 5/10 + 13/25 = 1.02 ≥ 1
  });

  test("a warship kill resets transport/capture progress", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const threshold = game.config().warshipVeterancyTransportKills();

    // Build up 9/10 of a level from transports (no level yet).
    for (let i = 0; i < threshold - 1; i++) {
      ship.recordKill(UnitType.TransportShip);
    }
    expect(ship.veterancy()).toBe(0);

    // A warship kill grants a level AND wipes the partial progress.
    ship.recordKill(UnitType.Warship);
    expect(ship.veterancy()).toBe(1);

    // Had progress carried, this transport would have completed level 2.
    // Since it reset, we're still at level 1.
    ship.recordKill(UnitType.TransportShip);
    expect(ship.veterancy()).toBe(1);
  });

  test("partial progress carries past a level-up", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const threshold = game.config().warshipVeterancyTradeCaptures();

    // One past the threshold → level 1 with 1 capture's worth carried over.
    for (let i = 0; i < threshold + 1; i++) ship.recordTradeCapture();
    expect(ship.veterancy()).toBe(1);

    // The carried progress means one fewer capture completes level 2.
    for (let i = 0; i < threshold - 1; i++) ship.recordTradeCapture();
    expect(ship.veterancy()).toBe(2);
  });

  test("veterancy raises max health but does not instantly heal", () => {
    const ship = buildWarship(attacker, coastX, 10);
    const base = game.config().unitInfo(UnitType.Warship).maxHealth!;
    const bonusPercent = game.config().warshipVeterancyHealthBonus();

    // Drop below full so a (removed) instant heal would be observable.
    ship.modifyHealth(-100);
    expect(ship.maxHealth()).toBe(base);
    expect(ship.health()).toBe(base - 100);

    ship.recordKill(UnitType.Warship); // veterancy 1

    // The cap rises, but current health is unchanged — the ship heals toward
    // the new max normally, it does not jump on level-up.
    expect(ship.maxHealth()).toBe(
      base + Math.floor((base * 1 * bonusPercent) / 100),
    );
    expect(ship.health()).toBe(base - 100);
  });

  test("non-warships never gain veterancy", () => {
    const transport = defender.buildUnit(
      UnitType.TransportShip,
      game.ref(coastX, 10),
      {},
    );

    transport.recordKill(UnitType.Warship);
    transport.recordTradeCapture();

    expect(transport.veterancy()).toBe(0);
  });

  test("warship shell count is 1, 1, 2, 3 by veterancy rank", () => {
    expect(warshipShellCountForVeterancy(0)).toBe(1);
    expect(warshipShellCountForVeterancy(1)).toBe(1);
    expect(warshipShellCountForVeterancy(2)).toBe(2);
    expect(warshipShellCountForVeterancy(3)).toBe(3);
    expect(game.config().warshipVeterancyShellCount(0)).toBe(1);
    expect(game.config().warshipVeterancyShellCount(1)).toBe(1);
    expect(game.config().warshipVeterancyShellCount(2)).toBe(2);
    expect(game.config().warshipVeterancyShellCount(3)).toBe(3);
  });

  test("heavy-round damage is +50% from rank 1 onward, not stacked", () => {
    const bonusPercent = game.config().warshipVeterancyShellDamageBonus();
    expect(bonusPercent).toBe(50);
    expect(warshipShellDamagePercent(0, bonusPercent)).toBe(100);
    expect(warshipShellDamagePercent(1, bonusPercent)).toBe(150);
    expect(warshipShellDamagePercent(3, bonusPercent)).toBe(150);

    const target = buildWarship(defender, coastX + 5, 10);
    const baseShooter = buildWarship(attacker, coastX, 10);
    const rank1 = buildWarship(attacker, coastX + 1, 10);
    const rank3 = buildWarship(attacker, coastX + 2, 10);
    rank1.recordKill(UnitType.Warship);
    for (let i = 0; i < 3; i++) {
      rank3.recordKill(UnitType.Warship);
    }
    expect(rank1.veterancy()).toBe(1);
    expect(rank3.veterancy()).toBe(3);

    const boostedValues = new Set<number>();
    for (let i = 0; i < 30; i++) {
      // Advance the tick so each pair of shells rolls a different seed.
      game.executeNextTick();

      const baseShell = new ShellExecution(
        baseShooter.tile(),
        attacker,
        baseShooter,
        target,
      );
      const rank1Shell = new ShellExecution(
        rank1.tile(),
        attacker,
        rank1,
        target,
      );
      const rank3Shell = new ShellExecution(
        rank3.tile(),
        attacker,
        rank3,
        target,
      );
      baseShell.init(game, game.ticks());
      rank1Shell.init(game, game.ticks());
      rank3Shell.init(game, game.ticks());

      const dBase = baseShell.getEffectOnTargetForTesting();
      const d1 = rank1Shell.getEffectOnTargetForTesting();
      const d3 = rank3Shell.getEffectOnTargetForTesting();

      // Same seed → same roll. Heavy damage is 3/2, identical at rank 1 and 3.
      expect(d1).toBe(Math.floor((dBase * 150) / 100));
      expect(d3).toBe(d1);
      boostedValues.add(d1);
    }

    expect(boostedValues.size).toBeGreaterThan(1);
  });

  test("marauder shell damage still stacks +20% per stripe", () => {
    const bonusPercent = game.config().marauderVeterancyShellDamageBonus();
    expect(bonusPercent).toBe(20);
    const target = buildWarship(defender, coastX + 5, 10);
    const base = defender.buildUnit(UnitType.Marauder, game.ref(coastX, 10), {
      patrolTile: game.ref(coastX, 10),
    });
    const vet = defender.buildUnit(UnitType.Marauder, game.ref(coastX + 1, 10), {
      patrolTile: game.ref(coastX + 1, 10),
    });
    for (let i = 0; i < 3; i++) {
      vet.recordKill(UnitType.Warship);
    }
    expect(vet.veterancy()).toBe(3);

    const baseShell = new ShellExecution(base.tile(), defender, base, target);
    const vetShell = new ShellExecution(vet.tile(), defender, vet, target);
    baseShell.init(game, game.ticks());
    vetShell.init(game, game.ticks());
    expect(vetShell.getEffectOnTargetForTesting()).toBe(
      Math.floor(
        (baseShell.getEffectOnTargetForTesting() * (100 + 3 * bonusPercent)) /
          100,
      ),
    );
  });

  test("volley assignment focuses one ship or splits extras by rank order", () => {
    expect(assignWarshipVolleyTargets(["a"], 3)).toEqual(["a", "a", "a"]);
    expect(assignWarshipVolleyTargets(["a", "b"], 3)).toEqual(["a", "b", "a"]);
    expect(assignWarshipVolleyTargets(["a", "b", "c"], 3)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(assignWarshipVolleyTargets(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  test("a shell landing the killing blow awards veterancy to the firing warship", () => {
    const shooter = buildWarship(attacker, coastX, 10);
    const target = buildWarship(defender, coastX + 1, 10);

    // Leave the target on its last sliver of health so any shell finishes it.
    target.modifyHealth(-(target.health() - 1));
    expect(target.health()).toBe(1);

    game.addExecution(
      new ShellExecution(shooter.tile(), attacker, shooter, target),
    );
    for (let i = 0; i < 30 && target.isActive(); i++) {
      game.executeNextTick();
    }

    expect(target.isActive()).toBe(false);
    expect(shooter.veterancy()).toBe(1);
  });

  function promote(ship: Unit, ranks: number): void {
    for (let i = 0; i < ranks; i++) {
      ship.recordKill(UnitType.Warship);
    }
  }

  function fireVolley(shooter: Unit): ShellExecution[] {
    game.config().warshipShellAttackRate = () => 0;
    game.config().warshipTargettingRange = () => 20;
    const fired: ShellExecution[] = [];
    const original = game.addExecution.bind(game);
    game.addExecution = (...execs) => {
      for (const exec of execs) {
        if (exec instanceof ShellExecution) {
          fired.push(exec);
        }
      }
      original(...execs);
    };
    original(new WarshipExecution(shooter));
    executeTicks(game, 2);
    return fired;
  }

  function volleyTargets(fired: ShellExecution[]): Unit[] {
    return fired.map((shell) => shell.getTargetForTesting());
  }

  test.each([
    { rank: 0, shells: 1 },
    { rank: 1, shells: 1 },
    { rank: 2, shells: 2 },
    { rank: 3, shells: 3 },
  ])(
    "a rank-$rank warship fires $shells shells at a single target",
    ({ rank, shells }) => {
      const shooter = buildWarship(attacker, coastX + 1, 10);
      promote(shooter, rank);
      const target = buildWarship(defender, coastX + 2, 10);

      const fired = fireVolley(shooter);

      expect(fired).toHaveLength(shells);
      expect(volleyTargets(fired)).toEqual(Array(shells).fill(target));
    },
  );

  test("a rank-3 warship splits three shells across three ships", () => {
    const shooter = buildWarship(attacker, coastX + 1, 10);
    promote(shooter, 3);
    const near = buildWarship(defender, coastX + 2, 10);
    const mid = buildWarship(defender, coastX + 3, 10);
    const far = buildWarship(defender, coastX + 4, 10);

    const fired = fireVolley(shooter);

    expect(fired).toHaveLength(3);
    expect(volleyTargets(fired)).toEqual([near, mid, far]);
  });

  test("a rank-3 warship with two targets stacks the leftover on the primary", () => {
    const shooter = buildWarship(attacker, coastX + 1, 10);
    promote(shooter, 3);
    const near = buildWarship(defender, coastX + 2, 10);
    const mid = buildWarship(defender, coastX + 3, 10);

    const fired = fireVolley(shooter);

    expect(fired).toHaveLength(3);
    expect(volleyTargets(fired)).toEqual([near, mid, near]);
  });

  test("max-rank repair formula is 1 HP every 2 ticks at rank 3 only", () => {
    const max = 3;
    const pulse = 1;
    const interval = 2;
    expect(warshipMaxRankRepairHpThisTick(3, max, 0, pulse, interval)).toBe(1);
    expect(warshipMaxRankRepairHpThisTick(3, max, 1, pulse, interval)).toBe(0);
    expect(warshipMaxRankRepairHpThisTick(3, max, 2, pulse, interval)).toBe(1);
    expect(warshipMaxRankRepairHpThisTick(2, max, 0, pulse, interval)).toBe(0);
    expect(warshipMaxRankRepairHpThisTick(1, max, 0, pulse, interval)).toBe(0);
    expect(warshipMaxRankRepairHpThisTick(0, max, 0, pulse, interval)).toBe(0);
    expect(game.config().warshipMaxRankRepairHpPerPulse()).toBe(1);
    expect(game.config().warshipMaxRankRepairIntervalTicks()).toBe(2);
    expect(game.config().warshipMaxRankRepairHp(3, 0)).toBe(1);
    expect(game.config().warshipMaxRankRepairHp(2, 0)).toBe(0);
  });

  function expectedMaxRankRepair(fromTick: number, numTicks: number): number {
    let healed = 0;
    for (let i = 0; i < numTicks; i++) {
      healed += game.config().warshipMaxRankRepairHp(3, fromTick + i);
    }
    return healed;
  }

  function tickWarship(ship: Unit, numTicks: number): void {
    game.addExecution(new WarshipExecution(ship));
    executeTicks(game, 1); // init only
    executeTicks(game, numTicks);
  }

  test("a rank-3 warship passively repairs hull HP over ticks", () => {
    const ship = buildWarship(attacker, coastX, 10);
    promote(ship, 3);
    expect(ship.veterancy()).toBe(3);

    const missing = 80;
    ship.modifyHealth(-missing);
    const damaged = ship.health();

    game.addExecution(new WarshipExecution(ship));
    executeTicks(game, 1); // init
    const startTick = game.ticks();
    const ticks = 20;
    executeTicks(game, ticks);

    const healed = expectedMaxRankRepair(startTick, ticks);
    expect(healed).toBeGreaterThan(0);
    expect(ship.health()).toBe(damaged + healed);
    expect(ship.health()).toBeLessThan(ship.maxHealth());
  });

  test.each([0, 1, 2])(
    "a rank-%s warship does not passively repair hull HP",
    (rank) => {
      const ship = buildWarship(attacker, coastX, 10);
      promote(ship, rank);
      expect(ship.veterancy()).toBe(rank);

      ship.modifyHealth(-80);
      const damaged = ship.health();
      tickWarship(ship, 20);
      expect(ship.health()).toBe(damaged);
    },
  );

  test("rank-3 hull repair does not exceed max HP", () => {
    const ship = buildWarship(attacker, coastX, 10);
    promote(ship, 3);
    // Rank-up raises the cap without filling it; push to max first so the
    // repairman would overshoot if modifyHealth did not clamp.
    ship.modifyHealth(ship.maxHealth());
    ship.modifyHealth(-1);
    expect(ship.health()).toBe(ship.maxHealth() - 1);

    tickWarship(ship, 20);
    expect(ship.health()).toBe(ship.maxHealth());
  });

  test("a rank-3 marauder does not get the battleship repairman", () => {
    const marauder = defender.buildUnit(
      UnitType.Marauder,
      game.ref(coastX, 10),
      { patrolTile: game.ref(coastX, 10) },
    );
    promote(marauder, 3);
    expect(marauder.veterancy()).toBe(3);

    marauder.modifyHealth(-80);
    const damaged = marauder.health();
    tickWarship(marauder, 20);
    expect(marauder.health()).toBe(damaged);
  });

  test("a destroyed rank-3 warship does not repair back to life", () => {
    const ship = buildWarship(attacker, coastX, 10);
    promote(ship, 3);
    ship.modifyHealth(-ship.health());
    expect(ship.health()).toBe(0);
    expect(ship.isActive()).toBe(false);

    tickWarship(ship, 20);
    expect(ship.health()).toBe(0);
    expect(ship.isActive()).toBe(false);
  });

  test("a rank-3 marauder still fires one shell", () => {
    const shooter = defender.buildUnit(
      UnitType.Marauder,
      game.ref(coastX + 1, 10),
      { patrolTile: game.ref(coastX + 1, 10) },
    );
    promote(shooter, 3);
    expect(shooter.veterancy()).toBe(3);
    buildWarship(attacker, coastX + 2, 10);

    const fired = fireVolley(shooter);

    expect(fired).toHaveLength(1);
  });
});
