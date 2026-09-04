import { SoundEffectController } from "../../../src/client/controllers/SoundEffectController";
import {
  PlayAnnouncerEvent,
  PlaySoundEffectEvent,
} from "../../../src/client/sound/Sounds";
import { EventBus } from "../../../src/core/EventBus";
import { UnitType } from "../../../src/core/game/Game";
import { GameUpdateType } from "../../../src/core/game/GameUpdates";

describe("SoundEffectController", () => {
  let eventBus: EventBus;
  let played: string[];
  let announced: string[];
  let tick: number;
  let units: Map<number, any>;
  let me: object;
  let game: any;
  let controller: SoundEffectController;

  function makeDetonatedWarhead(id: number) {
    return {
      id: () => id,
      type: () => UnitType.MIRVWarhead,
      isActive: () => false,
      reachedTarget: () => true,
      createdAt: () => 0,
      owner: () => ({}),
    };
  }

  function makeOwnedUnit(
    id: number,
    type: UnitType,
    owner: object,
    isActive: () => boolean,
  ) {
    return {
      id: () => id,
      type: () => type,
      isActive,
      reachedTarget: () => false,
      createdAt: () => 0,
      owner: () => owner,
    };
  }

  function tickWithUnits(...us: Array<{ id: () => number }>) {
    tick++;
    units = new Map(us.map((u) => [u.id(), u]));
    game.updatesSinceLastTick = () => ({
      [GameUpdateType.Unit]: us.map((u) => ({ id: u.id() })),
    });
    controller.tick();
  }

  beforeEach(() => {
    eventBus = new EventBus();
    played = [];
    announced = [];
    eventBus.on(PlaySoundEffectEvent, (e) => played.push(e.effect));
    eventBus.on(PlayAnnouncerEvent, (e) => announced.push(e.line));
    tick = 0;
    me = {
      isAlive: () => true,
      hasSpawned: () => true,
    };
    game = {
      ticks: () => tick,
      unit: (id: number) => units.get(id),
      myPlayer: () => me,
      inSpawnPhase: () => false,
      updatesSinceLastTick: () => undefined,
    };
    controller = new SoundEffectController(game, eventBus);
  });

  it("plays at most one warhead boom per interval", () => {
    // 10 warheads detonate on the same tick — one boom.
    tickWithUnits(
      ...Array.from({ length: 10 }, (_, i) => makeDetonatedWarhead(i)),
    );
    expect(played).toEqual(["atom-hit"]);

    // More warheads land on the next few ticks — still inside the interval.
    tickWithUnits(makeDetonatedWarhead(20));
    tickWithUnits(makeDetonatedWarhead(21));
    expect(played).toEqual(["atom-hit"]);

    // Once the interval has passed, the next detonation booms again.
    tick += 5;
    tickWithUnits(makeDetonatedWarhead(30));
    expect(played).toEqual(["atom-hit", "atom-hit"]);
  });

  it("does not play a boom for intercepted warheads", () => {
    const intercepted = {
      id: () => 1,
      type: () => UnitType.MIRVWarhead,
      isActive: () => false,
      reachedTarget: () => false,
      createdAt: () => 0,
      owner: () => ({}),
    };
    tickWithUnits(intercepted);
    expect(played).toEqual([]);
  });

  it("announces when your warship is destroyed", () => {
    let active = true;
    const warship = makeOwnedUnit(1, UnitType.Warship, me, () => active);
    tickWithUnits(warship);
    expect(announced).toEqual([]);
    active = false;
    tickWithUnits(warship);
    expect(announced).toEqual(["warship-destroyed"]);
  });

  it("announces when your marauder is destroyed", () => {
    let active = true;
    const marauder = makeOwnedUnit(2, UnitType.Marauder, me, () => active);
    tickWithUnits(marauder);
    active = false;
    tickWithUnits(marauder);
    expect(announced).toEqual(["marauder-destroyed"]);
  });

  it("does not announce when an enemy warship is destroyed", () => {
    let active = true;
    const enemy = {};
    const warship = makeOwnedUnit(3, UnitType.Warship, enemy, () => active);
    tickWithUnits(warship);
    active = false;
    tickWithUnits(warship);
    expect(announced).toEqual([]);
  });

  it("does not announce a unit that was already inactive when first seen", () => {
    tickWithUnits(makeOwnedUnit(4, UnitType.Warship, me, () => false));
    expect(announced).toEqual([]);
  });

  it.each([
    [UnitType.City, "city-destroyed"],
    [UnitType.Port, "port-destroyed"],
    [UnitType.PortGun, "port-gun-destroyed"],
    [UnitType.Factory, "factory-destroyed"],
  ] as const)("announces when your %s is destroyed", (type, line) => {
    let active = true;
    const unit = makeOwnedUnit(10, type, me, () => active);
    tickWithUnits(unit);
    active = false;
    tickWithUnits(unit);
    expect(announced).toEqual([line]);
  });

  it("announces game over when you die and become a spectator", () => {
    (me as { isAlive: () => boolean }).isAlive = () => false;
    game.updatesSinceLastTick = () => undefined;
    controller.tick();
    expect(announced).toEqual(["game-over"]);
    controller.tick();
    expect(announced).toEqual(["game-over"]);
  });

  it("does not announce game over for a spectator who never spawned", () => {
    (me as { isAlive: () => boolean; hasSpawned: () => boolean }).isAlive =
      () => false;
    (me as { hasSpawned: () => boolean }).hasSpawned = () => false;
    controller.tick();
    expect(announced).toEqual([]);
  });
});
