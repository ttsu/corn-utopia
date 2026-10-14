/**
 * Headless balance report: a simple bot plays several seeded runs with the default tuning
 * (plus optional overrides) and prints how fast it grows. Run with `npm run bot`.
 *
 *   BOT_TUNING='{"snackSize":0.4}' BOT_SEEDS=10 BOT_MINUTES=5 BOT_LOADOUT=playtest npm run bot
 *
 * The bot chases chompable cobs and kernels, dodges big cobs, and fires a power the target
 * doesn't resist. It's far more efficient than a kid, so treat its times as a lower bound.
 */
import { it } from 'vitest';
import { total } from '../src/sim/cob';
import { KERNELS, PLAIN_KINDS, POWER_DAMAGE, POWER_KINDS } from '../src/sim/kernels';
import { defaultTuning, sanitizeTuning } from '../src/sim/tuning';
import { DT, EMPTY_COMMAND, createWorld, debugGrow, step, viewRadius, type InputCommand, type Loadout, type World } from '../src/sim/world';

const seeds = Number(process.env.BOT_SEEDS ?? 6);
const minutes = Number(process.env.BOT_MINUTES ?? 8);
const trace = process.env.BOT_TRACE === '1';
const startSize = Number(process.env.BOT_START_SIZE ?? 0);
const overrides = process.env.BOT_TUNING ? JSON.parse(process.env.BOT_TUNING) : {};
/** `chase` plays well; `idle` drifts in slow circles and never shoots (a distracted kid). */
const mode = process.env.BOT_MODE === 'idle' ? 'idle' : 'chase';
const loadout: Loadout = process.env.BOT_LOADOUT === 'playtest' ? 'playtest' : 'game';

function botCommand(w: World, lastShot: { tick: number }): InputCommand {
  const p = w.player;
  if (w.earUps.length > 0) return { ...EMPTY_COMMAND, pickPerk: 0 };
  if (mode === 'idle') {
    const a = w.tick * DT * 0.4;
    return { ...EMPTY_COMMAND, moveX: Math.cos(a) * 0.3, moveY: Math.sin(a) * 0.3 };
  }
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
    for (const kind of p.pockets.length > 0 ? p.pockets : POWER_KINDS) {
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
  const milestones = [30, 120, 500, 1250];
  const tiers: Record<number, { ticks: number; bumps: number; lost: number; sizeTicks: number; redTicks: number }> = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const w = createWorld(seed, { ...tuning }, loadout);
    if (startSize > total(w.player.kernels)) {
      debugGrow(w, startSize - total(w.player.kernels));
      step(w, EMPTY_COMMAND);
    }
    const reached: Record<number, number> = {};
    const lastShot = { tick: 0 };
    const income = { chomp: 0, other: 0, last: total(w.player.kernels) };
    while (!w.over && w.tick < minutes * 60 / DT) {
      step(w, botCommand(w, lastShot));
      const tier = (tiers[w.player.tier] ??= { ticks: 0, bumps: 0, lost: 0, sizeTicks: 0, redTicks: 0 });
      tier.ticks++;
      tier.sizeTicks += total(w.player.kernels);
      const near = viewRadius(w.player) * 1.3;
      for (const e of w.enemies) if (!e.chompable && Math.hypot(e.x - w.player.x, e.y - w.player.y) < near) tier.redTicks++;
      for (const ev of w.events) {
        if (ev.type === 'bump') tier.bumps++;
        if (ev.type === 'hit' && ev.onPlayer) tier.lost += ev.count;
      }
      if (trace && seed === Number(process.env.BOT_TRACE_SEED ?? 1)) {
        const now = total(w.player.kernels);
        let chomped = 0;
        for (const ev of w.events) if (ev.type === 'chomp') chomped += ev.gained;
        const fired = w.events.filter((ev) => ev.type === 'fire').length;
        income.chomp += chomped;
        income.other += now - income.last - chomped + fired;
        income.last = now;
        if (w.tick % (Number(process.env.BOT_TRACE_EVERY ?? 30) / DT) === 0) {
          const big = w.enemies.filter((e) => !e.chompable).length;
          process.stdout.write(
            `  t=${Math.round(w.tick * DT)}s size ${now} (tier ${w.player.tier})  +chomps ${income.chomp}  +scooped/other ${income.other}  enemies ${w.enemies.length} (${big} too big, ${w.enemies.filter((e) => e.hunter).length} hunters)\n`,
          );
          income.chomp = 0;
          income.other = 0;
        }
      }
      const n = total(w.player.kernels);
      for (const m of milestones) if (reached[m] === undefined && n >= m) reached[m] = Math.round(w.tick * DT);
    }
    const s = w.stats;
    const fmt = (m: number) => (reached[m] === undefined ? '-' : `${reached[m]}s`);
    rows.push(
      `seed ${String(seed).padStart(2)}  ${w.over ? 'popped out' : 'survived  '} at ${Math.round(w.tick * DT)}s  ` +
        `reach 30/120/500/1250: ${fmt(30)}/${fmt(120)}/${fmt(500)}/${fmt(1250)}  max ${s.maxKernels}  end ${total(w.player.kernels)}  chomps ${s.chomps}  ` +
        `shots ${s.firedTotal}  scooped ${s.firedRecovered}  tinks ${s.tinks}  bumps ${s.bumps}  seeds ${s.seeds}`,
    );
  }
  const tierRows = Object.entries(tiers).map(([tier, d]) => {
    const mins = (d.ticks * DT) / 60;
    const avgSize = d.sizeTicks / d.ticks;
    return (
      `  tier ${tier.padStart(2)}  ${String(Math.round((d.ticks * DT) / seeds)).padStart(4)}s avg  ` +
      `bumps/min ${(d.bumps / mins).toFixed(1).padStart(5)}  lost ${((d.lost / avgSize / mins) * 100).toFixed(1).padStart(5)}% of cob/min  ` +
      `red cobs nearby ${(d.redTicks / d.ticks).toFixed(1)}`
    );
  });
  process.stdout.write(
    `\nBot report (${mode} bot, ${loadout} start${startSize ? `, start size ${startSize}` : ''}, ${seeds} runs, ${minutes} min max, overrides ${JSON.stringify(overrides)})\n` +
      `${rows.join('\n')}\n${tierRows.join('\n')}\n\n`,
  );
}, 600_000);
