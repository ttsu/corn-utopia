import {
  applyHit,
  canChomp,
  emptyKernels,
  kernelsOf,
  knockable,
  powerScore,
  total,
  type Kernels,
} from './cob';
import {
  KERNEL_KINDS,
  POWER_DAMAGE,
  POWER_KINDS,
  type DamageType,
  type KernelKind,
  type PowerKind,
} from './kernels';
import { mudSlow, propsForChunk, segmentHitsHay, separateFromHay, type FarmProp } from './farm';
import { armPower, layoutPockets } from './pockets';
import {
  appetiteBonus,
  hasPerk,
  magnetMul,
  pocketSlotsFor,
  rangeMul,
  rechargeMul,
  rollOffer,
  speedMul,
  type PerkId,
} from './perks';
import { chance, hash2, int, makeRng, next, pickWeighted, range, type Rng } from './rng';
import type { Tuning } from './tuning';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

export type EnemyType = 'baby' | 'soggy' | 'rocky';

export interface Body {
  id: number;
  x: number;
  y: number;
  /** Position at the start of the tick, for interpolated rendering. */
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
}

export interface PlayerCob extends Body {
  kernels: Kernels;
  tier: number;
  sockets: number;
  cooldowns: Record<PowerKind, number>;
  targetId: number | null;
  lockedTargetId: number | null;
  facingX: number;
  facingY: number;
  invuln: number;
  bare: boolean;
  lastChance: number;
  streak: number;
  streakTimer: number;
  pickupStreak: number;
  pickupTimer: number;
  /** Ticks at which kernels were fired, for the 5 s "still counts" window. */
  recentFired: number[];
  /** Powers you can fire. Each one keeps its own button for the run. */
  pockets: PowerKind[];
  /** Powers on the cob whose buttons are dimmed until you arm them. */
  waiting: PowerKind[];
  perks: PerkId[];
  /** Ear Up re-rolls left this run. */
  rerolls: number;
  /** Shots fired, so Boomerang can send exactly every 5th one home. */
  shotSerial: number;
  /** Seconds left before Butter Roll can dash again. */
  dashCd: number;
  /** Seconds left in the current dash. */
  dashTime: number;
  /** Hits taken, for Thick Husk (every 5th is blocked). */
  huskHits: number;
}

export interface Enemy extends Body {
  type: EnemyType;
  kernels: Kernels;
  heading: number;
  turnTimer: number;
  chompable: boolean;
  hitFlash: number;
  bumpCooldown: number;
  /** Seconds left backing away after bumping the player. */
  retreat: number;
  seeking: boolean;
  /** Hunters are big, armored cobs that chase you; more of them spawn the bigger you get. */
  hunter: boolean;
  /** Frosty hits toward the next freeze. Resets when the cob freezes. */
  frostHits: number;
  /** Seconds left slowed by Frosty. */
  slowLeft: number;
  /** Seconds left frozen in place. */
  frozenLeft: number;
}

export interface Shot extends Body {
  kind: PowerKind;
  ownerId: number;
  travelled: number;
  range: number;
  speed: number;
  targetId: number | null;
  lob: { sx: number; sy: number; tx: number; ty: number; t: number; dur: number } | null;
  /** Flies back to the player instead of landing. */
  boomerang: boolean;
  returning: boolean;
}

export interface GroundKernel {
  id: number;
  kind: KernelKind;
  value: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Seconds before anyone can pick it up (lets knocked-off kernels visibly scatter). */
  delay: number;
  /** Seconds before enemies can grab it; only the player can pick it up until then. */
  enemyLock: number;
  age: number;
  /** Seconds left on the "you just fired this" sparkle ring. */
  sparkle: number;
  ownerId: number | null;
  dead: boolean;
}

export interface BurnPatch {
  id: number;
  x: number;
  y: number;
  r: number;
  ttl: number;
  tickTimer: number;
}

export type SimEvent =
  | { type: 'fire'; kind: PowerKind; x: number; y: number }
  | { type: 'tink'; x: number; y: number; damage: DamageType }
  | { type: 'hit'; x: number; y: number; damage: DamageType; count: number; weak: boolean; onPlayer: boolean }
  | { type: 'explode'; x: number; y: number; r: number }
  | { type: 'poof'; x: number; y: number }
  | { type: 'pickup'; x: number; y: number; kind: KernelKind; streak: number }
  | { type: 'chomp'; x: number; y: number; streak: number; gained: number }
  | { type: 'bump'; x: number; y: number }
  | { type: 'turnGreen'; x: number; y: number }
  | { type: 'tierUp'; tier: number }
  | { type: 'heartLock' }
  | { type: 'bare' }
  | { type: 'saved' }
  | { type: 'poppedOut' }
  | { type: 'perk'; id: PerkId }
  | { type: 'block'; x: number; y: number }
  | { type: 'dash'; x: number; y: number }
  | { type: 'freeze'; x: number; y: number };

export interface Stats {
  ticks: number;
  chomps: number;
  bestStreak: number;
  maxKernels: number;
  maxTier: number;
  shots: Record<PowerKind, number>;
  firedTotal: number;
  firedRecovered: number;
  kernelsCollected: number;
  tinks: number;
  /** For each tink, how many more presses of the same power before switching to another. */
  switchesAfterTink: number[];
  bumps: number;
  poofs: number;
  /** Overflow kernels converted at the top tier (meta currency later). */
  seeds: number;
}

export interface Director {
  budget: number;
  smoothedPower: number;
  smoothedCount: number;
  plan: { type: EnemyType; kernels: Kernels; cost: number; hunter: boolean } | null;
}

export interface InputCommand {
  moveX: number;
  moveY: number;
  fire: PowerKind[];
  /** World position of a tap on the right side, to lock the target outline. */
  lockAt: { x: number; y: number } | null;
  cycleTarget: boolean;
  /** Index into the current Ear Up offer, or null. */
  pickPerk: number | null;
  reroll: boolean;
  /** Butter Roll double-tap. */
  dash: boolean;
}

export interface World {
  seed: number;
  loadout: Loadout;
  tick: number;
  rng: Rng;
  tuning: Tuning;
  nextId: number;
  player: PlayerCob;
  enemies: Enemy[];
  shots: Shot[];
  ground: GroundKernel[];
  patches: BurnPatch[];
  visitedChunks: Record<string, true>;
  director: Director;
  stats: Stats;
  tinkWatch: { kind: PowerKind; presses: number } | null;
  over: boolean;
  events: SimEvent[];
  /** Hay bales and mud puddles. */
  props: FarmProp[];
  /** Ear Up offers waiting for a tap. The shell pauses while this is non-empty. */
  earUps: { choices: PerkId[] }[];
  /** Separate from the world RNG, so offering a perk doesn't reshuffle spawns. */
  perkRng: Rng;
}

export const EMPTY_COMMAND: InputCommand = {
  moveX: 0,
  moveY: 0,
  fire: [],
  lockAt: null,
  cycleTarget: false,
  pickPerk: null,
  reroll: false,
  dash: false,
};

const TIER_NAMES = [
  'Baby Cob',
  'Snack Cob',
  'Picnic Cob',
  'Big Cob',
  'Mega Cob',
  'Cob-zilla',
  'Corn Castle',
  'Corn Mountain',
  'Golden Ear',
  'Corn Utopia',
];

export function tierName(tier: number): string {
  return TIER_NAMES[tier - 1] ?? `Size ${tier}`;
}

const TIER_SOCKETS = [12, 30, 60, 120, 200, 320, 500, 750];
const SOCKETS_PER_EXTRA_TIER = 250;
export const CHUNK_SIZE = 700;
const GRID_CELL = 64;
const SHOT_SPEED: Record<PowerKind, number> = { zinger: 600, spicy: 440, popper: 0, frosty: 520 };
const FROST_SLOW = 0.4;
const FROST_SLOW_S = 2.4;
const FROST_FREEZE_S = 1.6;
const FIRED_WINDOW_TICKS = 5 * TICK_RATE;
const MAX_SCATTER_PIECES = 6;
const BIG_COB_REF = 30;
const HUNTER_MIN_SIZE = 1.5;
const MAX_EXTRA_HUNTERS = 4;
const MAX_BUDGET = 8;
const MAX_SPAWN_COST = MAX_BUDGET - 0.5;

export function socketsForTier(tier: number): number {
  if (tier <= TIER_SOCKETS.length) return TIER_SOCKETS[tier - 1];
  return TIER_SOCKETS[TIER_SOCKETS.length - 1] + SOCKETS_PER_EXTRA_TIER * (tier - TIER_SOCKETS.length);
}

export function radiusFor(kernelCount: number): number {
  return 7 + 3.3 * Math.sqrt(Math.max(1, kernelCount));
}

/** Half-size of the visible world along the screen's short side. Shared with the renderer's zoom. */
export function viewRadius(player: PlayerCob): number {
  return 260 * sizeScale(player);
}

/**
 * How much the world has "zoomed out" around you. Distances and speeds that should feel the
 * same on screen at every size (move speed, shot range, magnet) are multiplied by this.
 */
export function sizeScale(player: PlayerCob): number {
  return Math.pow(player.r / radiusFor(12), 0.8);
}

/** Kernels knocked off per point of damage, so wearing a cob down takes similar shots at any size. */
/** 0 at the first size tier, rising to 1 at the top tier: how hard the field pushes back. */
export function challenge(w: World): number {
  const top = Math.max(2, w.tuning.maxTier);
  return Math.min(1, Math.max(0, (w.player.tier - 1) / (top - 1)));
}

export function damageScale(w: World): number {
  return Math.max(1, Math.pow(w.player.sockets / socketsForTier(1), w.tuning.damageSizeExponent));
}

export type Loadout = 'game' | 'playtest';

/** `game` starts as a plain Sunny cob; `playtest` uses the mixed loadout for testing matchups. */
export function createWorld(seed: number, tuning: Tuning, loadout: Loadout = 'game'): World {
  const startKernels =
    loadout === 'game'
      ? kernelsOf({ sunny: tuning.gameStartSunny })
      : kernelsOf({
          sunny: tuning.startSunny,
          soggy: tuning.startSoggy,
          stony: tuning.startStony,
          zinger: tuning.startZinger,
          spicy: tuning.startSpicy,
          popper: tuning.startPopper,
          frosty: tuning.startFrosty,
        });
  if (total(startKernels) === 0) startKernels.sunny = 1;

  const player: PlayerCob = {
    id: 1,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    r: radiusFor(12),
    kernels: startKernels,
    tier: 1,
    sockets: socketsForTier(1),
    cooldowns: { zinger: 0, spicy: 0, popper: 0, frosty: 0 },
    targetId: null,
    lockedTargetId: null,
    facingX: 1,
    facingY: 0,
    invuln: 0,
    bare: false,
    lastChance: 0,
    streak: 0,
    streakTimer: 0,
    pickupStreak: 0,
    pickupTimer: 0,
    recentFired: [],
    pockets: [],
    waiting: [],
    perks: [],
    rerolls: 1,
    shotSerial: 0,
    dashCd: 0,
    dashTime: 0,
    huskHits: 0,
  };

  const world: World = {
    seed,
    loadout,
    tick: 0,
    rng: makeRng(seed),
    tuning,
    nextId: 2,
    player,
    enemies: [],
    shots: [],
    ground: [],
    patches: [],
    visitedChunks: {},
    director: { budget: 0, smoothedPower: powerScore(startKernels), smoothedCount: total(startKernels), plan: null },
    stats: {
      ticks: 0,
      chomps: 0,
      bestStreak: 0,
      maxKernels: total(startKernels),
      maxTier: 1,
      shots: { zinger: 0, spicy: 0, popper: 0, frosty: 0 },
      firedTotal: 0,
      firedRecovered: 0,
      kernelsCollected: 0,
      tinks: 0,
      switchesAfterTink: [],
      bumps: 0,
      poofs: 0,
      seeds: 0,
    },
    tinkWatch: null,
    over: false,
    events: [],
    props: [],
    earUps: [],
    perkRng: makeRng(hash2(seed, 4, 19)),
  };

  updateTier(world);
  reconcilePockets(world);
  spawnFieldChunks(world);
  spawnOpeningCobs(world);
  return world;
}

export function pocketSlots(w: World): number {
  return pocketSlotsFor(w.player.tier, w.player.perks);
}

function reconcilePockets(w: World): void {
  const p = w.player;
  const laid = layoutPockets(p.kernels, pocketSlots(w), p.pockets, p.waiting);
  p.pockets = laid.pockets;
  p.waiting = laid.waiting;
}

/** Applies an Ear Up tap. Offering cards happens in updateTier. */
function applyMeta(w: World, cmd: InputCommand): void {
  const p = w.player;
  if (w.earUps.length === 0) return;
  if (cmd.reroll && p.rerolls > 0) {
    p.rerolls--;
    w.earUps[0] = { choices: rollOffer(w.perkRng, p.perks, pocketSlots(w)) };
  } else if (cmd.pickPerk !== null) {
    const id = w.earUps[0].choices[cmd.pickPerk];
    if (id) {
      p.perks.push(id);
      w.earUps.shift();
      w.events.push({ type: 'perk', id });
    }
  }
}

/** Advance the simulation one fixed tick. All game-state changes go through here. */
export function step(w: World, cmd: InputCommand): void {
  w.events.length = 0;
  if (w.over) return;
  applyMeta(w, cmd);
  reconcilePockets(w);
  w.tick++;
  w.stats.ticks = w.tick;

  const p = w.player;
  p.px = p.x;
  p.py = p.y;
  for (const e of w.enemies) {
    e.px = e.x;
    e.py = e.y;
  }
  for (const s of w.shots) {
    s.px = s.x;
    s.py = s.y;
  }
  for (const g of w.ground) {
    g.px = g.x;
    g.py = g.y;
  }

  movePlayer(w, cmd);
  updateTargeting(w, cmd);
  const fired = new Set<PowerKind>();
  for (const kind of cmd.fire) {
    if (fired.has(kind)) continue;
    fired.add(kind);
    if (p.waiting.includes(kind)) {
      armPower(p.pockets, p.waiting, kind, p.kernels);
      continue;
    }
    tryFire(w, kind);
  }
  for (const kind of POWER_KINDS) p.cooldowns[kind] = Math.max(0, p.cooldowns[kind] - DT);

  updateShots(w);
  updatePatches(w);
  updateEnemies(w);
  collidePlayer(w);
  updateGround(w);
  spawnFieldChunks(w);
  runDirector(w);
  updateChompable(w);
  updatePlayerState(w);
  reconcilePockets(w);
  if (w.tick % 30 === 0) mergeGround(w);

  w.ground = w.ground.filter((g) => !g.dead);
}

// ---------------------------------------------------------------------------
// Player

function movePlayer(w: World, cmd: InputCommand): void {
  const p = w.player;
  const t = w.tuning;
  if (cmd.dash && hasPerk(p.perks, 'butter') && p.dashCd <= 0 && !p.bare && p.dashTime <= 0) {
    const burst = t.playerSpeed * Math.pow(sizeScale(p), 0.75) * speedMul(p.perks) * 3.4;
    const fx = p.facingX || 1;
    const fy = p.facingY;
    const m = Math.hypot(fx, fy) || 1;
    p.vx = (fx / m) * burst;
    p.vy = (fy / m) * burst;
    p.dashTime = 0.18;
    p.dashCd = 1.2;
    w.events.push({ type: 'dash', x: p.x, y: p.y });
  }

  if (p.dashTime > 0) {
    p.dashTime = Math.max(0, p.dashTime - DT);
  } else {
    let mx = cmd.moveX;
    let my = cmd.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    const slow = mudSlow(p.x, p.y, w.props);
    if (mag > 0.05) {
      const speed = t.playerSpeed * Math.pow(sizeScale(p), 0.75) * speedMul(p.perks) * (p.bare ? 1.1 : 1) * slow;
      const tx = mx * speed;
      const ty = my * speed;
      const k = 1 - Math.exp(-12 * DT);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
      p.facingX = mx / Math.max(mag, 1e-6);
      p.facingY = my / Math.max(mag, 1e-6);
    } else {
      const k = Math.exp(-4 * DT);
      p.vx *= k;
      p.vy *= k;
    }
  }
  p.x += p.vx * DT;
  p.y += p.vy * DT;
  const freed = separateFromHay(p.x, p.y, p.r, w.props);
  p.x = freed.x;
  p.y = freed.y;
}

function updateTargeting(w: World, cmd: InputCommand): void {
  const p = w.player;
  const reach = shotRange(w);
  const maxRange = reach * 1.6;

  if (cmd.lockAt) {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of w.enemies) {
      const d = Math.hypot(e.x - cmd.lockAt.x, e.y - cmd.lockAt.y) - e.r;
      if (d < 50 * sizeScale(p) && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    p.lockedTargetId = best ? best.id : null;
  }

  if (cmd.cycleTarget) {
    const sorted = w.enemies
      .filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < maxRange)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (sorted.length > 0) {
      const idx = sorted.findIndex((e) => e.id === p.targetId);
      p.lockedTargetId = sorted[(idx + 1) % sorted.length].id;
    }
  }

  if (p.lockedTargetId !== null) {
    const locked = findEnemy(w, p.lockedTargetId);
    if (!locked || Math.hypot(locked.x - p.x, locked.y - p.y) > maxRange) p.lockedTargetId = null;
  }

  if (p.lockedTargetId !== null) {
    p.targetId = p.lockedTargetId;
    return;
  }

  // Auto-target: nearest red-outlined cob, favoring ones in front of you.
  let best: Enemy | null = null;
  let bestScore = Infinity;
  for (const e of w.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > reach + e.r) continue;
    const inFront = (dx * p.facingX + dy * p.facingY) / Math.max(d, 1e-6) > 0.3;
    let score = d * (inFront ? 0.7 : 1);
    if (e.chompable) score *= 3;
    if (e.id === p.targetId) score *= 0.85;
    if (score < bestScore) {
      best = e;
      bestScore = score;
    }
  }
  p.targetId = best ? best.id : null;
}

/** Whether a power button can fire right now (used by both the sim and the HUD). */
export function canFire(w: World, kind: PowerKind): boolean {
  const p = w.player;
  return !p.bare && !w.over && p.pockets.includes(kind) && p.kernels[kind] > 0 && p.cooldowns[kind] <= 0 && total(p.kernels) > 1;
}

export function heartLocked(w: World): boolean {
  return total(w.player.kernels) <= 1;
}

export function popperRadius(w: World): number {
  return w.tuning.popperRadius * sizeScale(w.player);
}

export function shotRange(w: World): number {
  return w.tuning.shotRange * sizeScale(w.player) * rangeMul(w.player.perks);
}

function rechargeFor(t: Tuning, kind: PowerKind): number {
  if (kind === 'zinger') return t.zingerRecharge;
  if (kind === 'spicy') return t.spicyRecharge;
  if (kind === 'frosty') return t.frostyRecharge;
  return t.popperRecharge;
}

export function rechargeSeconds(w: World, kind: PowerKind): number {
  return rechargeFor(w.tuning, kind) * rechargeMul(w.player.perks);
}

function damageFor(w: World, kind: PowerKind): number {
  const t = w.tuning;
  const base = kind === 'zinger' ? t.zingerDamage : kind === 'spicy' ? t.spicyDamage : kind === 'frosty' ? t.frostyDamage : t.popperDamage;
  return Math.round(base * damageScale(w));
}

/** Share of the target's knockable kernels a hit shakes loose, so big cobs take similar shots at any size. */
function shakeFor(w: World, source: PowerKind | null): number {
  const t = w.tuning;
  const pct =
    source === 'zinger' ? t.zingerShake : source === 'spicy' ? t.spicyShake : source === 'popper' ? t.popperShake : source === 'frosty' ? t.frostyShake : t.burnShake;
  return pct / 100;
}

function tryFire(w: World, kind: PowerKind): void {
  const p = w.player;
  if (p.bare || p.cooldowns[kind] > 0 || p.kernels[kind] <= 0 || !p.pockets.includes(kind)) return;
  if (total(p.kernels) <= 1) {
    w.events.push({ type: 'heartLock' });
    return;
  }
  p.kernels[kind]--;
  p.shotSerial++;
  p.cooldowns[kind] = rechargeSeconds(w, kind);
  p.recentFired.push(w.tick);

  const target = p.targetId !== null ? findEnemy(w, p.targetId) : undefined;
  let dx = p.facingX;
  let dy = p.facingY;
  if (target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d > 1e-3) {
      dx = (target.x - p.x) / d;
      dy = (target.y - p.y) / d;
    }
  }
  const sx = p.x + dx * (p.r + 4);
  const sy = p.y + dy * (p.r + 4);
  const scale = sizeScale(p);
  const reach = shotRange(w);

  let lob: Shot['lob'] = null;
  let vx = 0;
  let vy = 0;
  if (kind === 'popper') {
    let tx = target ? target.x + target.vx * 0.35 : p.x + dx * Math.min(reach, 240 * scale);
    let ty = target ? target.y + target.vy * 0.35 : p.y + dy * Math.min(reach, 240 * scale);
    const dist = Math.hypot(tx - p.x, ty - p.y);
    if (dist > reach) {
      tx = p.x + ((tx - p.x) / dist) * reach;
      ty = p.y + ((ty - p.y) / dist) * reach;
    }
    lob = { sx, sy, tx, ty, t: 0, dur: 0.4 + Math.min(dist, reach) / (900 * scale) };
  } else {
    vx = dx * SHOT_SPEED[kind] * scale;
    vy = dy * SHOT_SPEED[kind] * scale;
  }

  w.shots.push({
    id: w.nextId++,
    x: sx,
    y: sy,
    px: sx,
    py: sy,
    vx,
    vy,
    r: (kind === 'spicy' ? 7 : kind === 'frosty' ? 6 : 5) * Math.sqrt(scale),
    kind,
    ownerId: p.id,
    travelled: 0,
    range: reach,
    speed: SHOT_SPEED[kind] * scale,
    targetId: target ? target.id : null,
    lob,
    boomerang: hasPerk(p.perks, 'boomerang') && p.shotSerial % 5 === 0,
    returning: false,
  });

  w.stats.shots[kind]++;
  w.stats.firedTotal++;
  if (w.tinkWatch) {
    if (w.tinkWatch.kind === kind) {
      w.tinkWatch.presses++;
    } else {
      w.stats.switchesAfterTink.push(w.tinkWatch.presses);
      w.tinkWatch = null;
    }
  }
  w.events.push({ type: 'fire', kind, x: sx, y: sy });
}

function hitPlayer(w: World, damage: DamageType, amount: number, fromX: number, fromY: number): void {
  const p = w.player;
  if (p.invuln > 0 || p.bare) return;
  if (hasPerk(p.perks, 'husk')) {
    p.huskHits++;
    if (p.huskHits % 5 === 0) {
      p.invuln = w.tuning.mercySeconds;
      w.events.push({ type: 'block', x: p.x, y: p.y });
      return;
    }
  }
  const res = applyHit(p.kernels, damage, amount, w.rng, { heartIgnoresResist: true });
  if (res.removed.length === 0) {
    if (res.resisted) w.events.push({ type: 'tink', x: p.x, y: p.y, damage });
    return;
  }
  p.invuln = w.tuning.mercySeconds;
  const awayX = p.x - fromX;
  const awayY = p.y - fromY;
  scatterKernels(w, res.removed, p.x, p.y, awayX, awayY, 0.9, null);
  w.events.push({ type: 'hit', x: p.x, y: p.y, damage, count: res.removed.length, weak: res.weak, onPlayer: true });
  if (total(p.kernels) === 0) {
    p.bare = true;
    p.lastChance = w.tuning.lastChanceSeconds;
    w.events.push({ type: 'bare' });
  }
}

function collidePlayer(w: World): void {
  const p = w.player;
  const t = w.tuning;
  for (const e of w.enemies) {
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= p.r + e.r) continue;

    if (!p.bare && canChomp(p.kernels, e.kernels)) {
      const gained = total(e.kernels);
      for (const kind of KERNEL_KINDS) giveKernels(w, kind, e.kernels[kind]);
      p.streak = p.streakTimer > 0 ? p.streak + 1 : 1;
      p.streakTimer = t.streakSeconds;
      const lo = Math.min(t.chompBonusMin, t.chompBonusMax);
      const hi = Math.max(t.chompBonusMin, t.chompBonusMax);
      const streakBonus = p.streak >= 5 ? 2 : p.streak >= 3 ? 1 : 0;
      const bonus = int(w.rng, lo, hi) + streakBonus + appetiteBonus(p.perks);
      giveKernels(w, 'sunny', bonus);
      w.stats.chomps++;
      w.stats.bestStreak = Math.max(w.stats.bestStreak, p.streak);
      w.events.push({ type: 'chomp', x: e.x, y: e.y, streak: p.streak, gained: gained + bonus });
      e.kernels = emptyKernels();
      continue;
    }

    // Bounce apart.
    const nx = d > 1e-3 ? dx / d : 1;
    const ny = d > 1e-3 ? dy / d : 0;
    const overlap = p.r + e.r - d;
    p.x -= nx * overlap * 0.6;
    p.y -= ny * overlap * 0.6;
    e.x += nx * overlap * 0.4;
    e.y += ny * overlap * 0.4;
    const push = sizeScale(p);
    p.vx = -nx * 280 * push;
    p.vy = -ny * 280 * push;
    e.vx = nx * 140 * push;
    e.vy = ny * 140 * push;
    e.heading = Math.atan2(ny, nx);
    if (e.bumpCooldown <= 0) {
      e.bumpCooldown = 0.5;
      e.retreat = e.hunter ? 0.7 : 1.2;
      w.stats.bumps++;
      w.events.push({ type: 'bump', x: p.x + nx * p.r, y: p.y + ny * p.r });
    }
    hitPlayer(w, 'bonk', bumpLossFor(w), e.x, e.y);
  }
  w.enemies = w.enemies.filter((e) => total(e.kernels) > 0);
}

/** Kernels knocked off by a bump: a few when you're small, a share of your cob when you're big. */
export function bumpLossFor(w: World): number {
  const t = w.tuning;
  const flat = Math.round(t.bumpLoss * damageScale(w));
  const share = Math.round((challenge(w) * t.bumpLossTopPct * total(w.player.kernels)) / 100);
  return Math.max(flat, share);
}

function updatePlayerState(w: World): void {
  const p = w.player;
  p.invuln = Math.max(0, p.invuln - DT);
  p.streakTimer = Math.max(0, p.streakTimer - DT);
  if (p.streakTimer === 0) p.streak = 0;
  p.pickupTimer = Math.max(0, p.pickupTimer - DT);
  if (p.pickupTimer === 0) p.pickupStreak = 0;
  p.dashCd = Math.max(0, p.dashCd - DT);
  while (p.recentFired.length > 0 && w.tick - p.recentFired[0] > FIRED_WINDOW_TICKS) p.recentFired.shift();

  if (p.bare) {
    if (total(p.kernels) > 0) {
      p.bare = false;
      p.invuln = w.tuning.mercySeconds;
      w.events.push({ type: 'saved' });
    } else {
      p.lastChance -= DT;
      if (p.lastChance <= 0) {
        w.over = true;
        w.events.push({ type: 'poppedOut' });
      }
    }
  }

  updateTier(w);
  const n = total(p.kernels);
  w.stats.maxKernels = Math.max(w.stats.maxKernels, n);
}

export function maxSockets(w: World): number {
  return socketsForTier(w.tuning.maxTier);
}

/**
 * Adds kernels to the player. Once every socket at the top tier is full, a new kernel
 * replaces a Sunny (or is turned away if it's a Sunny itself) and the leftover becomes Seeds.
 */
function giveKernels(w: World, kind: KernelKind, count: number): void {
  const p = w.player;
  const cap = maxSockets(w);
  for (let i = 0; i < count; i++) {
    if (total(p.kernels) < cap) {
      p.kernels[kind]++;
    } else if (kind !== 'sunny' && p.kernels.sunny > 0) {
      p.kernels.sunny--;
      p.kernels[kind]++;
      w.stats.seeds++;
    } else {
      w.stats.seeds++;
    }
  }
}

/** Debug-only shortcut for checking how big cobs look and perform. */
export function debugGrow(w: World, count: number): void {
  giveKernels(w, 'sunny', count);
}

function updateTier(w: World): void {
  const p = w.player;
  const before = p.tier;
  while (total(p.kernels) >= p.sockets && p.tier < w.tuning.maxTier) {
    p.tier++;
    p.sockets = socketsForTier(p.tier);
  }
  p.r = radiusFor(p.sockets);
  const gained = p.tier - before;
  if (gained > 0 && w.tick > 0) {
    for (let i = 0; i < gained; i++) w.earUps.push({ choices: rollOffer(w.perkRng, p.perks, pocketSlots(w)) });
    w.events.push({ type: 'tierUp', tier: p.tier });
  }
  w.stats.maxTier = Math.max(w.stats.maxTier, p.tier);
}

// ---------------------------------------------------------------------------
// Shots, burn patches

function updateShots(w: World): void {
  const t = w.tuning;
  const keep: Shot[] = [];
  const p = w.player;
  for (const s of w.shots) {
    if (s.returning) {
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.r + 10) {
        recoverFired(w, s.kind, s.x, s.y);
        continue;
      }
      s.vx = (dx / d) * s.speed;
      s.vy = (dy / d) * s.speed;
      const nx = s.x + s.vx * DT;
      const ny = s.y + s.vy * DT;
      if (segmentHitsHay(s.x, s.y, nx, ny, s.r, w.props)) {
        dropFired(w, s.kind, s.x, s.y, s.ownerId);
        continue;
      }
      s.x = nx;
      s.y = ny;
      s.travelled += s.speed * DT;
      if (s.travelled > s.range * 1.6) {
        dropFired(w, s.kind, s.x, s.y, s.ownerId);
        continue;
      }
      keep.push(s);
      continue;
    }

    if (s.lob) {
      s.lob.t += DT;
      const f = Math.min(1, s.lob.t / s.lob.dur);
      const nx = s.lob.sx + (s.lob.tx - s.lob.sx) * f;
      const ny = s.lob.sy + (s.lob.ty - s.lob.sy) * f;
      if (segmentHitsHay(s.x, s.y, nx, ny, s.r, w.props)) {
        dropFired(w, s.kind, s.x, s.y, s.ownerId);
        continue;
      }
      s.x = nx;
      s.y = ny;
      if (f >= 1) {
        const r = popperRadius(w);
        w.events.push({ type: 'explode', x: s.x, y: s.y, r });
        for (const e of [...w.enemies]) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < r + e.r) hitEnemy(w, e, 'pop', damageFor(w, 'popper'), s.x, s.y, s.kind);
        }
        if (s.boomerang) {
          s.returning = true;
          s.travelled = 0;
          s.lob = null;
          keep.push(s);
        } else dropFired(w, s.kind, s.x, s.y, s.ownerId);
        continue;
      }
      keep.push(s);
      continue;
    }

    const target = s.targetId !== null && !s.returning ? findEnemy(w, s.targetId) : undefined;
    if (target && t.homing > 0) {
      const want = Math.atan2(target.y - s.y, target.x - s.x);
      const cur = Math.atan2(s.vy, s.vx);
      let diff = want - cur;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxTurn = t.homing * DT;
      const turned = cur + Math.max(-maxTurn, Math.min(maxTurn, diff));
      s.vx = Math.cos(turned) * s.speed;
      s.vy = Math.sin(turned) * s.speed;
    }
    const nx = s.x + s.vx * DT;
    const ny = s.y + s.vy * DT;
    s.travelled += s.speed * DT;
    if (segmentHitsHay(s.x, s.y, nx, ny, s.r, w.props)) {
      dropFired(w, s.kind, s.x, s.y, s.ownerId);
      continue;
    }
    s.x = nx;
    s.y = ny;

    let hit: Enemy | null = null;
    for (const e of w.enemies) {
      if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) {
        hit = e;
        break;
      }
    }
    if (hit) {
      hitEnemy(w, hit, POWER_DAMAGE[s.kind], damageFor(w, s.kind), s.x, s.y, s.kind);
      if (s.kind === 'spicy' && t.burnSeconds > 0) {
        w.patches.push({ id: w.nextId++, x: s.x, y: s.y, r: 38 * sizeScale(w.player), ttl: t.burnSeconds, tickTimer: 0.5 });
      }
      const back = Math.max(1, Math.hypot(s.vx, s.vy));
      if (s.boomerang) {
        s.returning = true;
        s.travelled = 0;
        keep.push(s);
      } else dropFired(w, s.kind, s.x - (s.vx / back) * 6, s.y - (s.vy / back) * 6, s.ownerId);
      continue;
    }
    if (s.travelled >= s.range) {
      if (s.boomerang) {
        s.returning = true;
        s.travelled = 0;
        keep.push(s);
      } else dropFired(w, s.kind, s.x, s.y, s.ownerId);
      continue;
    }
    keep.push(s);
  }
  w.shots = keep;
}

function updatePatches(w: World): void {
  const keep: BurnPatch[] = [];
  for (const patch of w.patches) {
    patch.ttl -= DT;
    patch.tickTimer -= DT;
    if (patch.tickTimer <= 0) {
      patch.tickTimer = 0.5;
      for (const e of [...w.enemies]) {
        if (Math.hypot(e.x - patch.x, e.y - patch.y) < patch.r + e.r * 0.5) {
          hitEnemy(w, e, 'fire', Math.round(damageScale(w)), patch.x, patch.y, null);
        }
      }
    }
    if (patch.ttl > 0) keep.push(patch);
  }
  w.patches = keep;
}

/** `source` is the power that caused the hit, or null for quiet damage (burn patches). */
function hitEnemy(
  w: World,
  e: Enemy,
  damage: DamageType,
  amount: number,
  fromX: number,
  fromY: number,
  source: PowerKind | null,
): void {
  if (total(e.kernels) === 0) return;
  amount += Math.round(shakeFor(w, source) * knockable(e.kernels, damage));
  if (e.hunter) {
    // Armor keeps the average damage exact even when a hit is only a kernel or two.
    const scaled = amount * w.tuning.hunterArmor;
    amount = Math.floor(scaled) + (chance(w.rng, scaled - Math.floor(scaled)) ? 1 : 0);
    if (amount <= 0) return;
  }
  const res = applyHit(e.kernels, damage, amount, w.rng);
  if (res.removed.length === 0) {
    if (res.resisted && source !== null) {
      w.events.push({ type: 'tink', x: e.x, y: e.y - e.r, damage });
      w.stats.tinks++;
      if (!w.tinkWatch) w.tinkWatch = { kind: source, presses: 0 };
    }
    return;
  }
  e.hitFlash = 0.15;
  scatterKernels(w, res.removed, e.x, e.y, e.x - fromX, e.y - fromY, 0.5, null, w.tuning.enemyGrabLock);
  w.events.push({
    type: 'hit',
    x: e.x,
    y: e.y - e.r,
    damage,
    count: res.removed.length,
    weak: res.weak,
    onPlayer: false,
  });
  if (res.resisted && source !== null) w.events.push({ type: 'tink', x: e.x + e.r, y: e.y - e.r, damage });
  if (source === 'frosty' && total(e.kernels) > 0) {
    e.frostHits++;
    e.slowLeft = FROST_SLOW_S;
    if (e.frostHits >= 3) {
      e.frostHits = 0;
      e.frozenLeft = FROST_FREEZE_S;
      e.vx = 0;
      e.vy = 0;
      w.events.push({ type: 'freeze', x: e.x, y: e.y });
    }
  }
  if (total(e.kernels) === 0) {
    w.events.push({ type: 'poof', x: e.x, y: e.y });
    w.stats.poofs++;
    w.enemies = w.enemies.filter((o) => o !== e);
  }
}

// ---------------------------------------------------------------------------
// Ground kernels

function addGround(
  w: World,
  kind: KernelKind,
  x: number,
  y: number,
  vx: number,
  vy: number,
  delay: number,
  ownerId: number | null,
  value = 1,
  enemyLock = 0,
): void {
  w.ground.push({
    id: w.nextId++,
    kind,
    value,
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    delay,
    enemyLock,
    age: 0,
    sparkle: ownerId !== null ? 3 : 0,
    ownerId,
    dead: false,
  });
}

function dropFired(w: World, kind: PowerKind, x: number, y: number, ownerId: number): void {
  addGround(w, kind, x, y, 0, 0, 0.25, ownerId);
}

/** A boomerang shot made it home: it goes straight back onto the cob. */
function recoverFired(w: World, kind: PowerKind, x: number, y: number): void {
  const p = w.player;
  giveKernels(w, kind, 1);
  p.pickupStreak++;
  p.pickupTimer = 0.6;
  w.stats.kernelsCollected++;
  w.stats.firedRecovered++;
  w.events.push({ type: 'pickup', x, y, kind, streak: p.pickupStreak });
}

function scatterKernels(
  w: World,
  kinds: KernelKind[],
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  delay: number,
  ownerId: number | null,
  enemyLock = 0,
): void {
  const base = Math.atan2(dirY, dirX);
  const scale = sizeScale(w.player);
  const counts = new Map<KernelKind, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  // Big hits drop a few bundles per kind instead of one entity per kernel.
  for (const [kind, count] of counts) {
    const pieces = Math.min(count, MAX_SCATTER_PIECES);
    for (let i = 0; i < pieces; i++) {
      const value = Math.floor(count / pieces) + (i < count % pieces ? 1 : 0);
      const a = base + range(w.rng, -1.4, 1.4);
      const speed = range(w.rng, 140, 300) * scale;
      addGround(w, kind, x, y, Math.cos(a) * speed, Math.sin(a) * speed, delay, ownerId, value, enemyLock);
    }
  }
}

type Grid = Map<number, GroundKernel[]>;

function cellKey(cx: number, cy: number): number {
  return (cx & 0xffff) * 65536 + (cy & 0xffff);
}

function buildGrid(ground: GroundKernel[]): Grid {
  const grid: Grid = new Map();
  for (const g of ground) {
    if (g.dead) continue;
    const key = cellKey(Math.floor(g.x / GRID_CELL), Math.floor(g.y / GRID_CELL));
    let cell = grid.get(key);
    if (!cell) grid.set(key, (cell = []));
    cell.push(g);
  }
  return grid;
}

function queryGrid(grid: Grid, x: number, y: number, radius: number, out: GroundKernel[]): GroundKernel[] {
  out.length = 0;
  const x0 = Math.floor((x - radius) / GRID_CELL);
  const x1 = Math.floor((x + radius) / GRID_CELL);
  const y0 = Math.floor((y - radius) / GRID_CELL);
  const y1 = Math.floor((y + radius) / GRID_CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const cell = grid.get(cellKey(cx, cy));
      if (!cell) continue;
      for (const g of cell) {
        if (!g.dead && (g.x - x) ** 2 + (g.y - y) ** 2 <= radius * radius) out.push(g);
      }
    }
  }
  return out;
}

function updateGround(w: World): void {
  const p = w.player;
  const t = w.tuning;
  const friction = Math.exp(-6 * DT);
  const magnet = p.r + t.magnetRadius * sizeScale(p) * magnetMul(p.perks);

  for (const g of w.ground) {
    g.age += DT;
    g.delay = Math.max(0, g.delay - DT);
    g.enemyLock = Math.max(0, g.enemyLock - DT);
    g.sparkle = Math.max(0, g.sparkle - DT);

    if (g.delay <= 0) {
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d < p.r + 4) {
        collect(w, g);
        continue;
      }
      if (d < magnet) {
        g.vx += (dx / d) * t.magnetPull * DT;
        g.vy += (dy / d) * t.magnetPull * DT;
        g.x += g.vx * DT;
        g.y += g.vy * DT;
        continue;
      }
    }
    g.vx *= friction;
    g.vy *= friction;
    g.x += g.vx * DT;
    g.y += g.vy * DT;
  }

  if (t.enemyGrabs >= 1) {
    const grid = buildGrid(w.ground);
    const found: GroundKernel[] = [];
    for (const e of w.enemies) {
      for (const g of queryGrid(grid, e.x, e.y, e.r + 3, found)) {
        if (g.delay > 0 || g.enemyLock > 0) continue;
        e.kernels[g.kind] += g.value;
        g.dead = true;
      }
    }
  }
}

function collect(w: World, g: GroundKernel): void {
  const p = w.player;
  giveKernels(w, g.kind, g.value);
  p.pickupStreak++;
  p.pickupTimer = 0.6;
  w.stats.kernelsCollected += g.value;
  if (g.ownerId === p.id) w.stats.firedRecovered += g.value;
  g.dead = true;
  w.events.push({ type: 'pickup', x: g.x, y: g.y, kind: g.kind, streak: p.pickupStreak });
}

/** When the ground gets crowded, merge nearby same-type kernels into bundles. */
function mergeGround(w: World): void {
  if (w.ground.length < 350) return;
  const grid = buildGrid(w.ground);
  const found: GroundKernel[] = [];
  for (const g of w.ground) {
    if (g.dead || g.value >= 10 || g.delay > 0) continue;
    for (const o of queryGrid(grid, g.x, g.y, 26, found)) {
      if (o === g || o.dead || o.kind !== g.kind || o.delay > 0 || g.value + o.value > 10) continue;
      g.value += o.value;
      g.enemyLock = Math.max(g.enemyLock, o.enemyLock);
      o.dead = true;
    }
  }
}

// ---------------------------------------------------------------------------
// Enemies

const ENEMY_BASE_SPEED: Record<EnemyType, number> = { baby: 62, soggy: 44, rocky: 100 };

function updateEnemies(w: World): void {
  const p = w.player;
  const t = w.tuning;
  const grid = t.enemyGrabs >= 1 ? buildGrid(w.ground) : null;
  const found: GroundKernel[] = [];
  const scale = sizeScale(p);
  const pressure = challenge(w);
  const rampSpeed = 1 + t.enemySpeedRamp * pressure;

  for (const e of w.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - DT);
    e.bumpCooldown = Math.max(0, e.bumpCooldown - DT);
    e.slowLeft = Math.max(0, e.slowLeft - DT);
    e.frozenLeft = Math.max(0, e.frozenLeft - DT);
    e.turnTimer -= DT;
    const n = total(e.kernels);
    if (e.frozenLeft > 0) {
      e.vx = 0;
      e.vy = 0;
      e.r = radiusFor(n);
      continue;
    }
    const sizeFactor = Math.min(1.15, Math.max(0.55, 1.15 - (0.3 * n) / p.sockets));
    let speed = ENEMY_BASE_SPEED[e.type] * t.enemySpeed * rampSpeed * sizeFactor * Math.pow(scale, 0.75) * mudSlow(e.x, e.y, w.props);
    if (e.slowLeft > 0) speed *= FROST_SLOW;
    const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);
    const distPlayer = Math.hypot(p.x - e.x, p.y - e.y);

    let seek: GroundKernel | null = null;
    if (grid && e.type !== 'rocky' && !e.hunter) {
      let bestD = Infinity;
      for (const g of queryGrid(grid, e.x, e.y, 160 * scale, found)) {
        if (g.enemyLock > 0) continue;
        const d = (g.x - e.x) ** 2 + (g.y - e.y) ** 2;
        if (d < bestD) {
          bestD = d;
          seek = g;
        }
      }
    }

    if (e.retreat > 0) {
      e.retreat -= DT;
      e.heading = toPlayer + Math.PI;
    } else if (e.chompable && distPlayer < 220 * scale && !p.bare) {
      // Nervous: a cob you can chomp backs away, so snacks take a little chasing.
      e.heading = toPlayer + Math.PI + Math.sin((w.tick + e.id * 13) * 0.05) * 0.6;
      speed *= t.nervousSpeed;
    } else if (e.hunter && !e.chompable && !p.bare && distPlayer < 1100 * scale) {
      e.heading = toPlayer + Math.sin((w.tick + e.id * 29) * 0.04) * 0.35;
      speed *= t.hunterSpeed;
    } else if (e.type === 'rocky') {
      if (e.turnTimer <= 0) {
        e.turnTimer = range(w.rng, 2.5, 4.5);
        e.heading = distPlayer < 900 * scale ? toPlayer + range(w.rng, -0.6, 0.6) : range(w.rng, 0, Math.PI * 2);
      }
    } else if (seek) {
      e.heading = Math.atan2(seek.y - e.y, seek.x - e.x);
    } else if (e.type === 'baby' && distPlayer < 650 * scale) {
      // Babies take turns being interested in you, so a crowd doesn't all pile on at once.
      if (e.turnTimer <= 0) {
        e.seeking = chance(w.rng, 0.5);
        e.turnTimer = e.seeking ? range(w.rng, 2, 4) : range(w.rng, 1.5, 3);
        if (!e.seeking) e.heading = range(w.rng, 0, Math.PI * 2);
      }
      if (e.seeking) e.heading = toPlayer + Math.sin((w.tick + e.id * 37) * 0.03) * 0.7;
    } else {
      if (e.turnTimer <= 0) {
        e.turnTimer = range(w.rng, 1, 3);
        const drift = distPlayer < 450 * scale ? toPlayer : range(w.rng, 0, Math.PI * 2);
        e.heading = drift + range(w.rng, -0.9, 0.9);
      }
      if (e.type === 'soggy') speed *= 0.9;
    }

    const k = 1 - Math.exp(-3 * DT);
    e.vx += (Math.cos(e.heading) * speed - e.vx) * k;
    e.vy += (Math.sin(e.heading) * speed - e.vy) * k;
    e.x += e.vx * DT;
    e.y += e.vy * DT;
    const freed = separateFromHay(e.x, e.y, e.r, w.props);
    e.x = freed.x;
    e.y = freed.y;
    e.r = radiusFor(n);
  }

  // Keep cobs from stacking on top of each other.
  for (let i = 0; i < w.enemies.length; i++) {
    const a = w.enemies[i];
    for (let j = i + 1; j < w.enemies.length; j++) {
      const b = w.enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = a.r + b.r;
      if (Math.abs(dx) > minD || Math.abs(dy) > minD) continue;
      const d = Math.hypot(dx, dy);
      if (d >= minD || d < 1e-4) continue;
      const push = (minD - d) / 2;
      a.x -= (dx / d) * push;
      a.y -= (dy / d) * push;
      b.x += (dx / d) * push;
      b.y += (dy / d) * push;
    }
  }
}

function updateChompable(w: World): void {
  const p = w.player;
  for (const e of w.enemies) {
    const now = !p.bare && canChomp(p.kernels, e.kernels);
    if (now && !e.chompable && Math.hypot(e.x - p.x, e.y - p.y) < viewRadius(p) * 1.5) {
      w.events.push({ type: 'turnGreen', x: e.x, y: e.y - e.r });
    }
    e.chompable = now;
  }
}

export function findEnemy(w: World, id: number): Enemy | undefined {
  return w.enemies.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// World generation and director

function spawnFieldChunks(w: World): void {
  const p = w.player;
  const pcx = Math.floor(p.x / CHUNK_SIZE);
  const pcy = Math.floor(p.y / CHUNK_SIZE);
  const reach = Math.max(1, Math.ceil((viewRadius(p) * 1.6) / CHUNK_SIZE));
  for (let cx = pcx - reach; cx <= pcx + reach; cx++) {
    for (let cy = pcy - reach; cy <= pcy + reach; cy++) {
      const key = `${cx},${cy}`;
      if (w.visitedChunks[key]) continue;
      w.visitedChunks[key] = true;
      for (const prop of propsForChunk(w.seed, cx, cy, CHUNK_SIZE)) w.props.push(prop);
      const rng = makeRng(hash2(w.seed, cx, cy));
      const lucky = hasPerk(w.player.perks, 'lucky');
      const clumps = int(rng, 1, 3);
      // Loose kernels are a starter snack; they thin out as you grow so they don't become passive income.
      const thinning = Math.min(1, Math.max(0.1, 30 / total(p.kernels)));
      const totalKernels = Math.round(w.tuning.fieldKernels * thinning * range(rng, 0.6, 1.4));
      for (let c = 0; c < clumps; c++) {
        const ox = (cx + range(rng, 0.1, 0.9)) * CHUNK_SIZE;
        const oy = (cy + range(rng, 0.1, 0.9)) * CHUNK_SIZE;
        if (Math.hypot(ox, oy) < 220) continue;
        const count = Math.round(totalKernels / clumps);
        for (let i = 0; i < count; i++) {
          const a = range(rng, 0, Math.PI * 2);
          const d = Math.sqrt(next(rng)) * 45;
          addGround(w, 'sunny', ox + Math.cos(a) * d, oy + Math.sin(a) * d, 0, 0, 0, null);
        }
        if (chance(rng, lucky ? 0.55 : 0.35)) {
          const kind = POWER_KINDS[int(rng, 0, POWER_KINDS.length - 1)];
          const extra = int(rng, 1, 2);
          for (let i = 0; i < extra; i++) addGround(w, kind, ox + range(rng, -20, 20), oy + range(rng, -20, 20), 0, 0, 0, null);
        }
        if (chance(rng, lucky ? 0.35 : 0.15)) {
          const kind = chance(rng, 0.5) ? 'soggy' : 'stony';
          const extra = int(rng, 1, 3);
          for (let i = 0; i < extra; i++) addGround(w, kind, ox + range(rng, -25, 25), oy + range(rng, -25, 25), 0, 0, 0, null);
        }
      }
    }
  }
}

function composeEnemy(rng: Rng, type: EnemyType, count: number, lucky = false): Kernels {
  const k = emptyKernels();
  const main = type === 'soggy' ? 'soggy' : type === 'rocky' ? 'stony' : 'sunny';
  const mainShare = type === 'baby' ? (lucky ? 0.7 : 0.9) : lucky ? 0.5 : 0.65;
  for (let i = 0; i < count; i++) {
    const roll = next(rng);
    if (roll < mainShare) k[main]++;
    else if (roll < 0.9) k.sunny++;
    else k[POWER_KINDS[int(rng, 0, POWER_KINDS.length - 1)]]++;
  }
  return k;
}

function planSpawn(w: World): NonNullable<Director['plan']> {
  const t = w.tuning;
  const rng = w.rng;
  const c = Math.max(2, w.director.smoothedCount);
  const roll = next(rng) * 100;
  // Cobs bigger than you are what let you double in size, so they get rarer as you grow.
  const bigScale = Math.min(1, Math.pow(BIG_COB_REF / c, t.bigCobFalloff));
  const bigShare = Math.max(0, 100 - t.bandChompable) * bigScale;
  const wearShare = (Math.min(t.bandWearDown, 100 - t.bandChompable) / Math.max(1e-6, 100 - t.bandChompable)) * bigShare;
  let count: number;
  let type: EnemyType;
  const early = w.tick < 15 * TICK_RATE;
  if (!early && next(rng) * 100 < t.huntersAtTop * challenge(w)) {
    count = Math.max(Math.ceil(c) + 1, Math.round(c * range(rng, HUNTER_MIN_SIZE, Math.max(HUNTER_MIN_SIZE, t.hunterSize))));
    type = chance(rng, 0.5) ? 'soggy' : 'rocky';
    return { type, kernels: composeEnemy(rng, type, count, hasPerk(w.player.perks, 'lucky')), cost: Math.min(MAX_SPAWN_COST, 1 + count / c), hunter: true };
  }
  if (roll >= bigShare || early) {
    // Snacks grow slower than you do, so each chomp is a smaller share of a bigger cob.
    const snack = Math.pow(c, t.snackExponent) * t.snackSize * range(rng, 0.6, 1.4);
    count = Math.max(1, Math.min(Math.floor(c) - 1, Math.round(snack)));
    type = pickWeighted(rng, ['baby', 'soggy', 'rocky'] as EnemyType[], (ty) => (ty === 'baby' ? 75 : 12.5))!;
  } else {
    const lo = roll < wearShare ? 1.05 : t.wearDownMax;
    const hi = roll < wearShare ? t.wearDownMax : Math.max(t.wearDownMax, t.projectMax);
    count = Math.max(Math.ceil(c) + 1, Math.round(c * range(rng, lo, hi)));
    type = pickWeighted(rng, ['baby', 'soggy', 'rocky'] as EnemyType[], (ty) => (ty === 'baby' ? 30 : 35))!;
  }
  const kernels = composeEnemy(rng, type, count, hasPerk(w.player.perks, 'lucky'));
  // Cost is relative to your size so the spawn rate doesn't stall as you grow.
  return { type, kernels, cost: Math.min(MAX_SPAWN_COST, 1 + count / c), hunter: false };
}

function spawnEnemy(w: World, type: EnemyType, kernels: Kernels, x: number, y: number, hunter = false): Enemy {
  const p = w.player;
  const e: Enemy = {
    id: w.nextId++,
    type,
    kernels,
    x,
    y,
    px: x,
    py: y,
    vx: 0,
    vy: 0,
    r: radiusFor(total(kernels)),
    heading: Math.atan2(p.y - y, p.x - x) + range(w.rng, -0.5, 0.5),
    turnTimer: range(w.rng, 0.5, 2),
    chompable: canChomp(p.kernels, kernels),
    hitFlash: 0,
    bumpCooldown: 0,
    retreat: 0,
    seeking: true,
    hunter,
    frostHits: 0,
    slowLeft: 0,
    frozenLeft: 0,
  };
  w.enemies.push(e);
  return e;
}

function spawnOpeningCobs(w: World): void {
  const p = w.player;
  const n = total(p.kernels);
  // A few quick snacks (each carrying a power kernel, so a plain Sunny start can arm up),
  // plus two big cobs that are too big to eat by snacking alone.
  const babyPowers: PowerKind[] = ['zinger', 'spicy', 'popper', 'frosty'];
  const opening: [EnemyType, number][] = [
    ['baby', Math.max(1, Math.round(n * 0.2))],
    ['baby', Math.max(1, Math.round(n * 0.3))],
    ['baby', Math.max(1, Math.round(n * 0.35))],
    ['baby', Math.max(1, Math.round(n * 0.45))],
    ['soggy', Math.round(n * 3.6)],
    ['rocky', Math.round(n * 4)],
  ];
  opening.forEach(([type, count], i) => {
    const a = (i / opening.length) * Math.PI * 2 + range(w.rng, -0.3, 0.3);
    const d = range(w.rng, 230, 420);
    const kernels = composeEnemy(w.rng, type, count, hasPerk(w.player.perks, 'lucky'));
    if (type === 'baby' && babyPowers[i]) kernels[babyPowers[i]] += 1;
    spawnEnemy(w, type, kernels, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  });
}

function runDirector(w: World): void {
  const p = w.player;
  const t = w.tuning;
  const dir = w.director;
  const firedRecent = p.recentFired.length;
  const effCount = total(p.kernels) + firedRecent;
  const power = powerScore(p.kernels) + firedRecent * 2;
  dir.smoothedPower += (power - dir.smoothedPower) * (1 - Math.exp(-DT / 10));
  dir.smoothedCount += (effCount - dir.smoothedCount) * (1 - Math.exp(-DT / 2));

  const seconds = w.tick * DT;
  const minutes = seconds / 60;
  const wave = seconds % 65 < 45 ? 1 : 2;
  dir.budget += (t.budgetBase + t.budgetPerPower * dir.smoothedPower + t.budgetPerMinute * minutes) * wave * DT;
  dir.budget = Math.min(dir.budget, MAX_BUDGET);

  if (!dir.plan) dir.plan = planSpawn(w);
  const view = viewRadius(p);
  const enemyCap = Math.min(t.maxEnemies, Math.round(10 + minutes * 8));
  // Hunters may exceed the cap a little, so a field full of uneaten snacks can't hold them back.
  const room = w.enemies.length < enemyCap || (dir.plan.hunter && w.enemies.filter((e) => e.hunter).length < MAX_EXTRA_HUNTERS);
  if (room && dir.budget >= dir.plan.cost) {
    dir.budget -= dir.plan.cost;
    const speed = Math.hypot(p.vx, p.vy);
    const ahead = speed > 30 && chance(w.rng, 0.7);
    const a = ahead ? Math.atan2(p.vy, p.vx) + range(w.rng, -1.1, 1.1) : range(w.rng, 0, Math.PI * 2);
    const d = view * range(w.rng, 2.1, 2.5);
    spawnEnemy(w, dir.plan.type, dir.plan.kernels, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, dir.plan.hunter);
    dir.plan = null;
  }

  const despawn = view * 4.5;
  w.enemies = w.enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < despawn);
}