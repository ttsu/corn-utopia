import { describe, expect, it } from 'vitest';
import { kernelsOf, total } from './cob';
import { STARTER_POWERS } from './kernels';
import { defaultTuning } from './tuning';
import { EMPTY_COMMAND, bestPower, bumpLossFor, canFire, challenge, createWorld, damageScale, shotRange, step, type InputCommand, type World } from './world';

function quietWorld(seed = 1): World {
  const w = createWorld(seed, defaultTuning());
  w.enemies = [];
  w.ground = [];
  w.tuning.maxEnemies = 0;
  return w;
}

const fire = (kind: InputCommand['fire'][number]): InputCommand => ({ ...EMPTY_COMMAND, fire: [kind] });

function addEnemy(w: World, x: number, y: number, kernels: ReturnType<typeof kernelsOf>) {
  w.enemies.push({
    id: w.nextId++,
    type: 'baby',
    kernels,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    r: 15,
    heading: 0,
    turnTimer: 99,
    chompable: false,
    hitFlash: 0,
    bumpCooldown: 0,
    retreat: 0,
    seeking: true,
    hunter: false,
    frostHits: 0,
    slowLeft: 0,
    frozenLeft: 0,
    burnLeft: 0,
    zapLeft: 0,
    caramelLeft: 0,
    stuckLeft: 0,
    husk: 0,
    popHp: 0,
    popMax: 0,
    shotCd: 0,
    fuse: -1,
    loot: kernelsOf({}),
    chip: kernelsOf({}),
    king: false,
    kingPhase: 0,
    kingStart: 0,
    gustCd: 0,
  });
  return w.enemies[w.enemies.length - 1];
}

describe('world', () => {
  it('starts the real game as a plain Sunny cob, with opening snacks that carry power kernels', () => {
    const w = createWorld(3, defaultTuning());
    expect(w.player.kernels).toEqual(kernelsOf({ sunny: defaultTuning().gameStartSunny }));
    const babies = w.enemies.filter((e) => e.type === 'baby');
    expect(babies.length).toBe(4);
    for (const kind of STARTER_POWERS) expect(babies.some((b) => b.kernels[kind] > 0)).toBe(true);
    for (const b of babies) expect(total(b.kernels)).toBeLessThan(total(w.player.kernels));

    const mix = createWorld(3, defaultTuning(), 'playtest');
    expect(mix.player.kernels.zinger).toBe(defaultTuning().startZinger);
  });

  it('pushes back harder as the cob grows: hunters spawn and bumps cost a share of the cob', () => {
    const countHunters = (sunny: number) => {
      const w = createWorld(5, { ...defaultTuning(), maxEnemies: 120 });
      w.player.kernels = kernelsOf({ sunny });
      let hunters = 0;
      const seen = new Set<number>();
      for (let i = 0; i < 60 * 60; i++) {
        step(w, EMPTY_COMMAND);
        for (const e of w.enemies) {
          if (e.hunter && !seen.has(e.id)) hunters++;
          seen.add(e.id);
        }
        // Clear the field so the enemy cap never holds spawns back.
        w.enemies = [];
      }
      return { hunters, challenge: challenge(w), bump: bumpLossFor(w), size: total(w.player.kernels) };
    };
    const small = countHunters(8);
    const big = countHunters(1200);
    expect(small.challenge).toBe(0);
    expect(small.hunters).toBe(0);
    expect(big.challenge).toBe(1);
    expect(big.hunters).toBeGreaterThan(5);
    expect(big.bump).toBeGreaterThanOrEqual(Math.floor(big.size * 0.025));
    expect(small.bump).toBe(defaultTuning().bumpLoss);
  });

  it('scales damage and reach up as the cob grows', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 1000 });
    for (let i = 0; i < 2; i++) step(w, EMPTY_COMMAND);
    expect(w.player.tier).toBeGreaterThan(5);
    expect(damageScale(w)).toBeGreaterThan(2);
    expect(shotRange(w)).toBeGreaterThan(w.tuning.shotRange * 2);
  });

  it('shakes loose a share of the target, so big cobs lose more per hit but resistant kernels stay put', () => {
    const knockedBy = (target: ReturnType<typeof kernelsOf>) => {
      const w = quietWorld();
      w.player.kernels = kernelsOf({ sunny: 3, zinger: 3 });
      const e = addEnemy(w, 120, 0, target);
      const before = total(e.kernels);
      step(w, EMPTY_COMMAND);
      step(w, fire('zinger'));
      for (let i = 0; i < 60 && total(e.kernels) === before; i++) step(w, EMPTY_COMMAND);
      return { knocked: before - total(e.kernels), left: e.kernels };
    };
    const t = defaultTuning();
    const small = knockedBy(kernelsOf({ sunny: 20 }));
    const big = knockedBy(kernelsOf({ sunny: 2000 }));
    expect(small.knocked).toBe(t.zingerDamage + Math.round((t.zingerShake / 100) * 20));
    expect(big.knocked).toBe(t.zingerDamage + Math.round((t.zingerShake / 100) * 2000));

    const mixed = knockedBy(kernelsOf({ sunny: 100, stony: 1900 }));
    expect(mixed.knocked).toBe(t.zingerDamage + Math.round((t.zingerShake / 100) * 100));
    expect(mixed.left.stony).toBe(1900);
  });

  it('is deterministic for the same seed and inputs', () => {
    const run = () => {
      const w = createWorld(42, defaultTuning());
      for (let i = 0; i < 1200; i++) {
        step(w, { ...EMPTY_COMMAND, moveX: Math.sin(i / 50), moveY: Math.cos(i / 70), fire: i % 20 === 0 ? ['zinger'] : [] });
      }
      return JSON.stringify({ p: w.player, e: w.enemies.length, g: w.ground.length, rng: w.rng.state });
    };
    expect(run()).toBe(run());
  });

  it('firing spends a kernel that lands on the ground for pickup', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 3, zinger: 2 });
    step(w, fire('zinger'));
    expect(w.player.kernels.zinger).toBe(1);
    expect(w.shots.length).toBe(1);
    for (let i = 0; i < 120 && w.shots.length > 0; i++) step(w, EMPTY_COMMAND);
    expect(w.shots.length).toBe(0);
    const landed = w.ground.filter((g) => g.kind === 'zinger');
    expect(landed.length).toBe(1);
    expect(landed[0].ownerId).toBe(w.player.id);
  });

  it('respects recharge: taps during recharge are ignored', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 3, zinger: 5 });
    step(w, fire('zinger'));
    step(w, fire('zinger'));
    expect(w.player.kernels.zinger).toBe(4);
  });

  it('never fires the Heart Kernel', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ zinger: 1 });
    expect(canFire(w, 'zinger')).toBe(false);
    step(w, fire('zinger'));
    expect(w.player.kernels.zinger).toBe(1);
    expect(w.events.some((e) => e.type === 'heartLock')).toBe(true);
  });

  it('chomping a smaller cob takes all its kernels plus a Chomp Bonus', () => {
    const w = quietWorld();
    w.tuning.chompBonusMin = 2;
    w.tuning.chompBonusMax = 2;
    w.player.kernels = kernelsOf({ sunny: 8 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 3, spicy: 1 }));
    step(w, EMPTY_COMMAND);
    expect(w.enemies.length).toBe(0);
    expect(w.player.kernels).toMatchObject({ sunny: 13, spicy: 1 });
  });

  it('bumping a bigger cob knocks kernels onto the ground', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 8 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 12 }));
    step(w, EMPTY_COMMAND);
    expect(w.enemies.length).toBe(1);
    expect(total(w.player.kernels)).toBe(8 - w.tuning.bumpLoss);
    const nearby = w.ground.filter((g) => Math.hypot(g.x - w.player.x, g.y - w.player.y) < 100);
    expect(nearby.length).toBe(w.tuning.bumpLoss);
  });

  it('kernels knocked off a cob are only the player’s to grab for a while', () => {
    const w = quietWorld();
    const lock = w.tuning.enemyGrabLock;
    w.tuning.enemySpeed = 0;
    const x = w.player.x + 800;
    const y = w.player.y;
    const cob = addEnemy(w, x, y, kernelsOf({ sunny: 30 }));
    w.patches.push({ id: w.nextId++, x, y, r: 40, ttl: 0.1, tickTimer: 0 });
    step(w, EMPTY_COMMAND);
    const left = total(cob.kernels);
    expect(left).toBeLessThan(30);
    expect(w.ground.every((g) => g.enemyLock > lock - 0.1)).toBe(true);

    const sitOnCob = () => {
      for (const g of w.ground) Object.assign(g, { x: cob.x, y: cob.y, vx: 0, vy: 0 });
    };
    for (let i = 0; i < 60 * (lock - 1); i++) step(w, EMPTY_COMMAND);
    sitOnCob();
    for (let i = 0; i < 30; i++) step(w, EMPTY_COMMAND);
    expect(total(cob.kernels)).toBe(left);

    sitOnCob();
    for (let i = 0; i < 60 * 2; i++) step(w, EMPTY_COMMAND);
    expect(w.enemies).toContain(cob);
    expect(total(cob.kernels)).toBe(30);
  });

  it('getting hit on the Heart Kernel leads to Last Chance, then All Popped Out', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ stony: 1 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 12 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.bare).toBe(true);
    w.enemies = [];
    w.ground = [];
    for (let i = 0; i < 60 * (w.tuning.lastChanceSeconds + 0.5) && !w.over; i++) step(w, EMPTY_COMMAND);
    expect(w.over).toBe(true);
  });

  it('a Zinger tinks off a Stony cob and is recorded for the switch metric', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 3, zinger: 3, popper: 1 });
    const rock = addEnemy(w, 120, 0, kernelsOf({ stony: 20 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.targetId).toBe(rock.id);
    step(w, fire('zinger'));
    let tinked = false;
    for (let i = 0; i < 60 && !tinked; i++) {
      step(w, EMPTY_COMMAND);
      tinked = w.events.some((e) => e.type === 'tink');
    }
    expect(tinked).toBe(true);
    expect(rock.kernels.stony).toBe(20);
    for (let i = 0; i < 30; i++) step(w, EMPTY_COMMAND);
    step(w, fire('popper'));
    expect(w.stats.switchesAfterTink).toEqual([0]);
  });

  it('at the top tier, extra kernels upgrade Sunny kernels and the rest become Seeds', () => {
    const w = quietWorld();
    w.tuning.maxTier = 1;
    w.tuning.chompBonusMin = 0;
    w.tuning.chompBonusMax = 0;
    w.player.kernels = kernelsOf({ sunny: 11 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 2, spicy: 3 }));
    step(w, EMPTY_COMMAND);
    expect(total(w.player.kernels)).toBe(12);
    expect(w.player.kernels.spicy).toBe(3);
    expect(w.stats.seeds).toBe(4);
  });

  it('at the top tier, a power kernel replaces any plain kernel', () => {
    const w = quietWorld();
    w.tuning.maxTier = 1;
    w.tuning.chompBonusMin = 0;
    w.tuning.chompBonusMax = 0;
    w.player.kernels = kernelsOf({ stony: 12 });
    addEnemy(w, 10, 0, kernelsOf({ spicy: 3 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels.spicy).toBe(3);
    expect(w.player.kernels.stony).toBe(9);
    expect(total(w.player.kernels)).toBe(12);
    expect(w.stats.seeds).toBe(3);
  });

  it('at the top tier, a plain kernel never replaces a power kernel', () => {
    const w = quietWorld();
    w.tuning.maxTier = 1;
    w.tuning.chompBonusMin = 0;
    w.tuning.chompBonusMax = 0;
    w.player.kernels = kernelsOf({ zinger: 6, stony: 6 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 4, soggy: 2 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels.zinger).toBe(6);
    expect(w.player.kernels.stony).toBe(6);
    expect(w.stats.seeds).toBe(6);
  });

  it('at the top tier, a tougher plain kernel replaces a weaker one', () => {
    const w = quietWorld();
    w.tuning.maxTier = 1;
    w.tuning.chompBonusMin = 0;
    w.tuning.chompBonusMax = 0;
    w.player.kernels = kernelsOf({ sunny: 4, soggy: 8 });
    addEnemy(w, 10, 0, kernelsOf({ soggy: 2, stony: 3 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels).toMatchObject({ sunny: 0, soggy: 9, stony: 3 });
    expect(w.stats.seeds).toBe(5);
  });

  it('a fired power kernel reclaims its socket from the plain kernel that filled it', () => {
    const w = quietWorld();
    w.tuning.maxTier = 1;
    w.tuning.chompBonusMin = 0;
    w.tuning.chompBonusMax = 0;
    w.player.kernels = kernelsOf({ zinger: 4, stony: 8 });
    step(w, fire('zinger'));
    expect(w.player.kernels).toMatchObject({ zinger: 3, stony: 8 });
    // The enemy sits off the shot's path so the chomp fills the socket without eating the Zinger.
    addEnemy(w, 0, 8, kernelsOf({ stony: 5 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels).toMatchObject({ zinger: 3, stony: 9 });
    expect(w.stats.seeds).toBe(4);

    for (let i = 0; i < 120 && w.shots.length > 0; i++) step(w, EMPTY_COMMAND);
    const spent = w.ground.find((g) => g.kind === 'zinger' && g.ownerId === w.player.id);
    expect(spent).toBeDefined();
    spent!.x = w.player.x;
    spent!.y = w.player.y;
    spent!.vx = 0;
    spent!.vy = 0;
    spent!.delay = 0;
    w.player.vx = 0;
    w.player.vy = 0;
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels).toMatchObject({ zinger: 4, stony: 8 });
    expect(w.stats.seeds).toBe(5);
  });

  it('grows a size tier when sockets fill and never shrinks', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 12 });
    step(w, EMPTY_COMMAND);
    expect(w.player.tier).toBe(2);
    w.player.kernels = kernelsOf({ sunny: 2 });
    step(w, EMPTY_COMMAND);
    expect(w.player.tier).toBe(2);
  });

  it('offers an Ear Up choice on a new tier and applies the one you pick', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 12 });
    step(w, EMPTY_COMMAND);
    expect(w.earUps).toHaveLength(1);
    expect(w.earUps[0].choices).toHaveLength(3);
    const picked = w.earUps[0].choices[1];
    const x = w.player.x;
    step(w, { ...EMPTY_COMMAND, moveX: 1 });
    expect(w.player.perks).toEqual([]);
    expect(w.player.x).toBeGreaterThan(x);
    step(w, { ...EMPTY_COMMAND, pickPerk: 1 });
    expect(w.player.perks).toEqual([picked]);
    expect(w.earUps).toHaveLength(0);
    expect(w.player.rerolls).toBe(1);
  });

  it('re-rolls an Ear Up offer once per run', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 12 });
    step(w, EMPTY_COMMAND);
    step(w, { ...EMPTY_COMMAND, reroll: true });
    expect(w.player.rerolls).toBe(0);
    const after = w.earUps[0].choices.join(',');
    expect(w.earUps[0].choices).toHaveLength(3);
    step(w, { ...EMPTY_COMMAND, reroll: true });
    expect(w.earUps[0].choices.join(',')).toBe(after);
    expect(w.player.rerolls).toBe(0);
  });

  it('puts a chomped power kernel into a pocket you can fire', () => {
    const w = quietWorld();
    expect(w.player.pockets).toEqual([]);
    addEnemy(w, 10, 0, kernelsOf({ sunny: 2, spicy: 1 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.pockets).toEqual(['spicy']);
    expect(w.player.kernels.spicy).toBe(1);
  });

  it('Big Appetite adds 2 kernels to the Chomp Bonus', () => {
    const w = quietWorld();
    w.tuning.chompBonusMin = 2;
    w.tuning.chompBonusMax = 2;
    w.player.perks = ['appetite'];
    w.player.kernels = kernelsOf({ sunny: 8 });
    addEnemy(w, 10, 0, kernelsOf({ sunny: 3 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.kernels.sunny).toBe(8 + 3 + 2 + 2);
  });

  it('starts with a short magnet, and Big Magnet stretches the radius', () => {
    expect(defaultTuning().magnetRadius).toBe(10);
    expect(defaultTuning().magnetPull).toBe(3000);
    const dropped = (perks: World['player']['perks'], pastBody: number) => {
      const w = quietWorld();
      w.props = [];
      w.player.perks = perks;
      const x = w.player.r + pastBody;
      w.ground = [
        {
          id: 50,
          kind: 'sunny',
          value: 1,
          x,
          y: 0,
          px: x,
          py: 0,
          vx: 0,
          vy: 0,
          delay: 0,
          enemyLock: 0,
          age: 1,
          sparkle: 0,
          ownerId: null,
          dead: false,
        },
      ];
      step(w, EMPTY_COMMAND);
      return w.ground[0].x;
    };
    expect(dropped([], 6)).toBeLessThan(quietWorld().player.r + 6);
    expect(dropped([], 14)).toBe(quietWorld().player.r + 14);
    expect(dropped(['magnet'], 12)).toBeLessThan(quietWorld().player.r + 12);
    expect(dropped(['magnet', 'magnet'], 16)).toBeLessThan(quietWorld().player.r + 16);
  });

  it('dashes from the start, and Butter Roll makes that dash further', () => {
    const run = (perks: World['player']['perks']) => {
      const w = quietWorld();
      w.props = [];
      w.player.perks = perks;
      step(w, { ...EMPTY_COMMAND, dash: true, moveX: 1 });
      for (let i = 0; i < 20; i++) step(w, EMPTY_COMMAND);
      return w.player.x;
    };
    const walked = (() => {
      const w = quietWorld();
      w.props = [];
      for (let i = 0; i < 20; i++) step(w, { ...EMPTY_COMMAND, moveX: 1 });
      return w.player.x;
    })();
    const plain = run([]);
    expect(plain).toBeGreaterThan(walked);
    expect(run(['butter'])).toBeGreaterThan(plain * 1.15);
    expect(run(['butter', 'butter'])).toBeGreaterThan(run(['butter']) * 1.15);
  });

  it('Thick Husk blocks every 5th bump', () => {
    const w = quietWorld();
    w.tuning.mercySeconds = 0;
    w.tuning.bumpLoss = 2;
    w.player.perks = ['husk'];
    w.player.kernels = kernelsOf({ sunny: 10 });
    const e = addEnemy(w, 0, 0, kernelsOf({ sunny: 80 }));
    let blocks = 0;
    for (let i = 0; i < 5; i++) {
      e.x = w.player.x;
      e.y = w.player.y;
      e.bumpCooldown = 0;
      step(w, EMPTY_COMMAND);
      if (w.events.some((ev) => ev.type === 'block')) blocks++;
    }
    expect(blocks).toBe(1);
    expect(total(w.player.kernels)).toBe(2);
  });

  it('a second Thick Husk blocks another hit in every five', () => {
    const w = quietWorld();
    w.tuning.mercySeconds = 0;
    w.tuning.bumpLoss = 2;
    w.player.perks = ['husk', 'husk'];
    w.player.kernels = kernelsOf({ sunny: 10 });
    const e = addEnemy(w, 0, 0, kernelsOf({ sunny: 80 }));
    let blocks = 0;
    for (let i = 0; i < 5; i++) {
      e.x = w.player.x;
      e.y = w.player.y;
      e.bumpCooldown = 0;
      step(w, EMPTY_COMMAND);
      if (w.events.some((ev) => ev.type === 'block')) blocks++;
    }
    expect(blocks).toBe(2);
    expect(total(w.player.kernels)).toBe(4);
  });

  it('sends every 5th shot back home with Boomerang', () => {
    const w = quietWorld();
    w.props = [];
    w.player.perks = ['boomerang'];
    w.player.kernels = kernelsOf({ sunny: 10, zinger: 6 });
    w.tuning.zingerRecharge = 0;
    for (let i = 0; i < 5; i++) step(w, fire('zinger'));
    expect(w.player.kernels.zinger).toBe(1);
    for (let i = 0; i < 180; i++) step(w, EMPTY_COMMAND);
    expect(w.shots).toHaveLength(0);
    expect(w.player.kernels.zinger).toBe(2);
    expect(w.ground.filter((g) => g.kind === 'zinger')).toHaveLength(4);
  });

  it('hay bales stop a shot, and mud slows you down', () => {
    const blocked = quietWorld();
    blocked.props = [{ kind: 'hay', x: 90, y: 0, r: 28 }];
    blocked.player.kernels = kernelsOf({ sunny: 4, zinger: 2 });
    const rock = addEnemy(blocked, 220, 0, kernelsOf({ sunny: 30 }));
    step(blocked, fire('zinger'));
    for (let i = 0; i < 90 && blocked.shots.length > 0; i++) step(blocked, EMPTY_COMMAND);
    expect(blocked.shots).toHaveLength(0);
    expect(rock.kernels.sunny).toBe(30);
    expect(blocked.ground.some((g) => g.kind === 'zinger' && g.x < 130)).toBe(true);

    const slosh = (mud: boolean) => {
      const w = quietWorld();
      w.props = mud ? [{ kind: 'mud', x: 0, y: 0, r: 400 }] : [];
      for (let i = 0; i < 40; i++) step(w, { ...EMPTY_COMMAND, moveX: 1 });
      return w.player.x;
    };
    expect(slosh(true)).toBeLessThan(slosh(false) * 0.7);
  });

  it('keeps each power on its own button and arms a waiting one without firing it', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 8, zinger: 1, spicy: 1, popper: 1, frosty: 1 });
    step(w, EMPTY_COMMAND);
    expect(w.player.pockets).toEqual(['zinger', 'spicy', 'popper']);
    expect(w.player.waiting).toEqual(['frosty']);
    step(w, fire('frosty'));
    expect(w.player.pockets).toEqual(['zinger', 'spicy', 'frosty']);
    expect(w.player.waiting).toEqual(['popper']);
    expect(w.shots).toHaveLength(0);
  });

  it('Frosty slows a cob and the third hit freezes it', () => {
    const w = quietWorld();
    w.props = [];
    w.tuning.frostyRecharge = 0;
    w.tuning.frostyShake = 0;
    w.player.kernels = kernelsOf({ sunny: 20, frosty: 5 });
    const e = addEnemy(w, 90, 0, kernelsOf({ sunny: 40 }));
    const land = () => {
      const before = e.kernels.sunny;
      step(w, fire('frosty'));
      for (let i = 0; i < 40 && e.kernels.sunny === before; i++) step(w, EMPTY_COMMAND);
    };
    land();
    expect(e.slowLeft).toBeGreaterThan(0);
    expect(e.frozenLeft).toBe(0);
    const x = e.x;
    for (let i = 0; i < 20; i++) step(w, EMPTY_COMMAND);
    expect(Math.abs(e.x - x)).toBeLessThan(8);
    land();
    land();
    expect(e.frozenLeft).toBeGreaterThan(0);
    const frozenX = e.x;
    for (let i = 0; i < 20; i++) step(w, EMPTY_COMMAND);
    expect(e.x).toBe(frozenX);
  });

  it('caramel sticks a cob and leaves its kernels on', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 4, caramel: 2 });
    const e = addEnemy(w, 80, 0, kernelsOf({ sunny: 20 }));
    step(w, EMPTY_COMMAND);
    step(w, fire('caramel'));
    for (let i = 0; i < 90 && e.caramelLeft === 0; i++) step(w, EMPTY_COMMAND);
    expect(e.caramelLeft).toBeGreaterThan(0);
    expect(total(e.kernels)).toBe(20);
  });

  it('Steam Burst on a frozen cob ignores Toasty', () => {
    const w = quietWorld();
    w.tuning.spicyShake = 0;
    w.player.kernels = kernelsOf({ sunny: 4, spicy: 2 });
    const e = addEnemy(w, 90, 0, kernelsOf({ sunny: 8, toasty: 6 }));
    e.frozenLeft = 2;
    step(w, EMPTY_COMMAND);
    let burst = false;
    step(w, fire('spicy'));
    if (w.events.some((ev) => ev.type === 'combo' && ev.name === 'Steam Burst')) burst = true;
    for (let i = 0; i < 90 && e.kernels.toasty === 6; i++) {
      step(w, EMPTY_COMMAND);
      if (w.events.some((ev) => ev.type === 'combo' && ev.name === 'Steam Burst')) burst = true;
    }
    expect(burst).toBe(true);
    expect(e.kernels.toasty).toBeLessThan(6);
  });

  it('Smart Fire prefers a power the target does not resist', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 4, zinger: 2, spicy: 2 });
    const e = addEnemy(w, 40, 0, kernelsOf({ stony: 30 }));
    step(w, EMPTY_COMMAND);
    expect(w.player.targetId).toBe(e.id);
    expect(bestPower(w)).toBe('spicy');
  });

  it('spawns King Cob when the Harvest Moon timer ends', () => {
    const w = quietWorld();
    w.harvestSeconds = 1 / 60;
    step(w, EMPTY_COMMAND);
    expect(w.kingSpawned).toBe(true);
    expect(w.enemies.some((e) => e.king)).toBe(true);
    expect(w.events.some((e) => e.type === 'harvest')).toBe(true);
  });

  it('Easy Peasy skips the crow raid', () => {
    const run = (difficulty: 'easy' | 'normal') => {
      const w = createWorld(2, { ...defaultTuning(), maxEnemies: 80 }, 'game', { difficulty, harvestSeconds: 0 });
      w.enemies = [];
      for (let n = 0; n < 4; n++) {
        w.nextEvent = w.tick;
        step(w, EMPTY_COMMAND);
      }
      return w.enemies.some((e) => e.type === 'crow');
    };
    expect(run('easy')).toBe(false);
    expect(run('normal')).toBe(true);
  });
});
