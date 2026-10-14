/**
 * Headless balance report: a simple bot plays several seeded runs with the default tuning
 * (plus optional overrides) and prints how fast it grows. Run with `npm run bot`.
 *
 *   BOT_TUNING='{"snackSize":0.4}' BOT_SEEDS=10 BOT_MINUTES=5 npm run bot
 *
 * The bot chases chompable cobs and kernels, dodges big cobs, and fires a power the target
 * doesn't resist. It's far more efficient than a kid, so treat its times as a lower bound.
 */
import { it } from 'vitest';
import { total } from '../src/sim/cob';
import { KERNELS, PLAIN_KINDS, POWER_DAMAGE, POWER_KINDS } from '../src/sim/kernels';
import { defaultTuning, sanitizeTuning } from '../src/sim/tuning';
import { DT, EMPTY_COMMAND, createWorld, step, type InputCommand, type World } from '../src/sim/world';

const seeds = Number(process.env.BOT_SEEDS ?? 6);
const minutes = Number(process.env.BOT_MINUTES ?? 8);
const overrides = process.env.BOT_TUNING ? JSON.parse(process.env.BOT_TUNING) : {};

function botCommand(w: World, lastShot: { tick: number }): InputCommand {
  const p = w.player;
  let tx = p.x;
  let ty = p.y;
  let best = Infinity;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (e.chompable && d < best) {
      best = d;
      tx = e.x;
      ty = e.y;
    }
  }
  for (const g of w.ground) {
    const d = Math.hypot(g.x - p.x, g.y - p.y) * 1.5;
    if (d < best) {
      best = d;
      tx = g.x;
      ty = g.y;
    }
  }
  let fx = 0;
  let fy = 0;
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (!e.chompable && d < e.r + p.r + 60) {
      fx += (p.x - e.x) / d;
      fy += (p.y - e.y) / d;
    }
  }
  const mx = tx - p.x + fx * 400;
  const my = ty - p.y + fy * 400;
  const m = Math.hypot(mx, my) || 1;
  const cmd: InputCommand = { ...EMPTY_COMMAND, moveX: mx / m, moveY: my / m, fire: [] };

  const target = w.enemies.find((e) => e.id === p.targetId);
  if (target && !target.chompable && w.tick - lastShot.tick > 12 && total(p.kernels) > 3) {
    for (const kind of POWER_KINDS) {
      const dmg = POWER_DAMAGE[kind];
      const immune = PLAIN_KINDS.filter((pk) => KERNELS[pk].resist[dmg] === 'immune').reduce((a, pk) => a + target.kernels[pk], 0);
      if (p.kernels[kind] > 0 && immune < total(target.kernels) * 0.6) {
        cmd.fire = [kind];
        lastShot.tick = w.tick;
        break;
      }
    }
  }
  return cmd;
}

it('bot balance report', () => {
  const tuning = sanitizeTuning({ ...defaultTuning(), ...overrides });
  const rows: string[] = [];
  const milestones = [30, 60, 130];
  for (let seed = 1; seed <= seeds; seed++) {
    const w = createWorld(seed, { ...tuning });
    const reached: Record<number, number> = {};
    const lastShot = { tick: 0 };
    while (!w.over && w.tick < minutes * 60 / DT) {
      step(w, botCommand(w, lastShot));
      const n = total(w.player.kernels);
      for (const m of milestones) if (reached[m] === undefined && n >= m) reached[m] = Math.round(w.tick * DT);
    }
    const s = w.stats;
    const fmt = (m: number) => (reached[m] === undefined ? '-' : `${reached[m]}s`);
    rows.push(
      `seed ${String(seed).padStart(2)}  ${w.over ? 'popped out' : 'survived  '} at ${Math.round(w.tick * DT)}s  ` +
        `reach 30/60/130: ${fmt(30)}/${fmt(60)}/${fmt(130)}  max ${s.maxKernels}  chomps ${s.chomps}  ` +
        `shots ${s.firedTotal}  scooped ${s.firedRecovered}  tinks ${s.tinks}  bumps ${s.bumps}  seeds ${s.seeds}`,
    );
  }
  process.stdout.write(`\nBot report (${seeds} runs, ${minutes} min max, overrides ${JSON.stringify(overrides)})\n${rows.join('\n')}\n\n`);
}, 600_000);
