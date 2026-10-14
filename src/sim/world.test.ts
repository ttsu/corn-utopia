import { describe, expect, it } from 'vitest';
import { kernelsOf, total } from './cob';
import { defaultTuning } from './tuning';
import { EMPTY_COMMAND, canFire, createWorld, step, type InputCommand, type World } from './world';

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
  });
  return w.enemies[w.enemies.length - 1];
}

describe('world', () => {
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

  it('grows a size tier when sockets fill and never shrinks', () => {
    const w = quietWorld();
    w.player.kernels = kernelsOf({ sunny: 12 });
    step(w, EMPTY_COMMAND);
    expect(w.player.tier).toBe(2);
    w.player.kernels = kernelsOf({ sunny: 2 });
    step(w, EMPTY_COMMAND);
    expect(w.player.tier).toBe(2);
  });
});
