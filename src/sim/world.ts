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
  ALL_POWER_KINDS,
  KERNEL_KINDS,
  PLAIN_KINDS,
  POWER_DAMAGE,
  POWER_KINDS,
  STARTER_POWERS,
  zeroCounts,
  type DamageType,
  type KernelKind,
  type PowerKind,
} from './kernels';
import type { Difficulty } from '../settings';
import { biomeAt, mudSlow, propsForChunk, sinkPush, segmentHitsHay, separateFromHay, type FarmProp } from './farm';
import { milestoneName, milestoneOf, type Milestone } from './milestones';
import { armPower, layoutPockets } from './pockets';
import {
  appetiteBonus,
  butterMul,
  everyFifth,
  luckyMul,
  magnetMul,
  perkCount,
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
/**
 * Starting dash. Short and only a bit faster than walking, on purpose:
 * Butter Roll is what turns it into a real burst.
 */
export const DASH_COOLDOWN = 1.2;
export const DASH_TIME = 0.12;
/** Burst speed as a multiple of move speed, before Butter Roll. */
export const DASH_BURST = 1.7;

export type EnemyType =
  | 'baby'
  | 'nibbler'
  | 'soggy'
  | 'rocky'
  | 'zoomer'
  | 'shooter'
  | 'bouncy'
  | 'husky'
  | 'bomber'
  | 'crow'
  | 'ant'
  | 'cousin'
  | 'steve'
  | 'butter'
  | 'harvey'
  | 'king';

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
  /** Seconds left after a hit before ground kernels can be scooped again. */
  pickupLock: number;
  bare: boolean;
  lastChance: number;
  streak: number;
  streakTimer: number;
  pickupStreak: number;
  pickupTimer: number;
  /** Recent shots, so a milestone doesn't flicker off the moment you fire. */
  recentFired: { tick: number; kind: PowerKind }[];
  /** Hits soaked by Tough Nuts and half-strength kernels. */
  chip: Kernels;
  /** Seconds until the next Sweetie grows a Sunny. */
  sweetieTimer: number;
  /** Highest milestone already celebrated, per power. */
  milestoneSeen: Record<PowerKind, Milestone>;
  /** Powers you can fire. Each one keeps its own button for the run. */
  pockets: PowerKind[];
  /** Powers on the cob whose buttons are dimmed until you arm them. */
  waiting: PowerKind[];
  perks: PerkId[];
  /** Ear Up re-rolls left this run. */
  rerolls: number;
  /** Shots fired, so Boomerang can send exactly every 5th one home. */
  shotSerial: number;
  /** Seconds left before you can dash again. */
  dashCd: number;
  /** Seconds left in the current dash. */
  dashTime: number;
  /** Hits taken, for Thick Husk. */
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
  /** Seconds left burning, for Kettle Corn and the little flame. */
  burnLeft: number;
  /** Seconds left since a zap, for Disco Cob. */
  zapLeft: number;
  /** Seconds left stuck in caramel (slow, and no picking kernels up). */
  caramelLeft: number;
  /** Seconds left unable to move (Taffy, or Caramel Corn). */
  stuckLeft: number;
  /** Husky shield. Only Pop knocks it off. */
  husk: number;
  /** Non-cobs pop from shots. 0 means this is a cob you chomp. */
  popHp: number;
  popMax: number;
  shotCd: number;
  /** Popcorn Bomber fuse. Negative means it isn't swelling yet. */
  fuse: number;
  /** Kernels a crow or ant is carrying off. */
  loot: Kernels;
  chip: Kernels;
  king: boolean;
  kingPhase: number;
  kingStart: number;
  gustCd: number;
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
  /** The attack this shot performs. A Gem flies as a Gem and strikes as something else. */
  attack: PowerKind;
  /** Damage multiplier (Gem, and a few milestones). */
  mul: number;
  /** Boing ricochets left. */
  bounces: number;
  /** Enemies this shot has already bonked. */
  seen: number[];
  /** Enemy shots and sprout seeds. Seeds vanish instead of becoming a kernel. */
  foe: boolean;
  seed: boolean;
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
  /** Fire burns, caramel stops pickups, slick is the Butter Knight's trail. Omitted patches burn. */
  kind?: 'fire' | 'caramel' | 'slick';
}

export interface Plant {
  id: number;
  x: number;
  y: number;
  ttl: number;
  cd: number;
  /** Seconds between seed shots. */
  every: number;
  mul: number;
}

export interface Poi {
  id: number;
  kind: 'pinata' | 'patch' | 'sprinkler' | 'shrine' | 'rescue' | 'stalk';
  x: number;
  y: number;
  hp: number;
  power: PowerKind | null;
  stock: number;
  timer: number;
  used: boolean;
}

export interface Barrier {
  x: number;
  y: number;
  r: number;
  ttl: number;
}

export interface Boom {
  x: number;
  y: number;
  r: number;
  ttl: number;
  damage: number;
  shake: number;
}

export interface DealChoice {
  icon: string;
  name: string;
  blurb: string;
  pay: KernelKind;
  payN: number;
  gain: KernelKind;
  gainN: number;
}

export interface Deal {
  title: string;
  choices: DealChoice[];
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
  | { type: 'freeze'; x: number; y: number }
  | { type: 'combo'; name: string; x: number; y: number }
  | { type: 'milestone'; kind: PowerKind; name: string }
  | { type: 'harvest' }
  | { type: 'victory'; x: number; y: number }
  | { type: 'coat'; x: number; y: number; phase: number }
  | { type: 'trade'; name: string };

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
  /** World position of a tap on the right side, to lock the target circle. */
  lockAt: { x: number; y: number } | null;
  cycleTarget: boolean;
  /** Index into the current Ear Up offer, or null. */
  pickPerk: number | null;
  reroll: boolean;
  /** Dash button, or Space / Shift. */
  dash: boolean;
  /** Smart Fire: the sim picks the best armed power for the current target. */
  smart: boolean;
  /** World point a drag-aim shot should fly toward. Null keeps auto-target. */
  aim: { x: number; y: number } | null;
  /** Index into the current shrine deal, or null. */
  pickDeal: number | null;
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
  /** Hay bales, mud, butter, and sinks. */
  props: FarmProp[];
  plants: Plant[];
  pois: Poi[];
  barriers: Barrier[];
  booms: Boom[];
  /** Shrine trades waiting for a tap. The shell pauses while this is non-empty. */
  deals: Deal[];
  difficulty: Difficulty;
  /** 0 hides the Harvest Moon. Otherwise King Cob arrives when the timer ends. */
  harvestSeconds: number;
  won: boolean;
  kingSpawned: boolean;
  /** Tick of the next scripted event. */
  nextEvent: number;
  eventStep: number;
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
  smart: false,
  aim: null,
  pickDeal: null,
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
const SHOT_SPEED: Record<PowerKind, number> = {
  zinger: 600,
  spicy: 440,
  popper: 0,
  frosty: 520,
  boing: 540,
  zappy: 880,
  caramel: 380,
  sprout: 420,
  gem: 500,
};
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
const EVENT_GAP = 150 * TICK_RATE;
/** Piñatas, patches, sprinklers, shrines, rescues, and stalks. Off until the field is calmer. */
const SHOW_POINTS_OF_INTEREST = false;
const HARVEST_DEFAULT = 600;

export interface RunOptions {
  difficulty?: Difficulty;
  /** Seconds until King Cob. Omit to use the tuning value. 0 turns the moon off. */
  harvestSeconds?: number;
}

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
export function createWorld(seed: number, tuning: Tuning, loadout: Loadout = 'game', options: RunOptions = {}): World {
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
    cooldowns: zeroCounts(ALL_POWER_KINDS),
    targetId: null,
    lockedTargetId: null,
    facingX: 1,
    facingY: 0,
    invuln: 0,
    pickupLock: 0,
    bare: false,
    lastChance: 0,
    streak: 0,
    streakTimer: 0,
    pickupStreak: 0,
    pickupTimer: 0,
    recentFired: [],
    chip: emptyKernels(),
    sweetieTimer: 8,
    milestoneSeen: zeroCounts(ALL_POWER_KINDS) as Record<PowerKind, Milestone>,
    pockets: [],
    waiting: [],
    perks: [],
    rerolls: 1,
    shotSerial: 0,
    dashCd: 0,
    dashTime: 0,
    huskHits: 0,
  };

  const harvest = options.harvestSeconds ?? (tuning.harvestSeconds || HARVEST_DEFAULT);

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
    plants: [],
    pois: [],
    barriers: [],
    booms: [],
    deals: [],
    difficulty: options.difficulty ?? 'normal',
    harvestSeconds: harvest,
    won: false,
    kingSpawned: false,
    nextEvent: EVENT_GAP,
    eventStep: 0,
    visitedChunks: {},
    director: { budget: 0, smoothedPower: powerScore(startKernels), smoothedCount: total(startKernels), plan: null },
    stats: {
      ticks: 0,
      chomps: 0,
      bestStreak: 0,
      maxKernels: total(startKernels),
      maxTier: 1,
      shots: zeroCounts(ALL_POWER_KINDS),
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

/** Applies an Ear Up tap or a shrine trade. Offering cards happens elsewhere. */
function applyMeta(w: World, cmd: InputCommand): void {
  const p = w.player;
  if (w.earUps.length > 0) {
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
    return;
  }
  if (w.deals.length === 0 || cmd.pickDeal === null) return;
  const choice = w.deals[0].choices[cmd.pickDeal];
  w.deals.shift();
  if (!choice || p.kernels[choice.pay] < choice.payN) return;
  p.kernels[choice.pay] -= choice.payN;
  giveKernels(w, choice.gain, choice.gainN);
  w.events.push({ type: 'trade', name: choice.name });
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
  if (cmd.smart) {
    const best = bestPower(w);
    if (best) tryFire(w, best, cmd.aim);
  }
  for (const kind of cmd.fire) {
    if (fired.has(kind)) continue;
    fired.add(kind);
    if (p.waiting.includes(kind)) {
      armPower(p.pockets, p.waiting, kind, p.kernels);
      continue;
    }
    tryFire(w, kind, cmd.aim);
  }
  for (const kind of ALL_POWER_KINDS) p.cooldowns[kind] = Math.max(0, p.cooldowns[kind] - DT);

  updateShots(w);
  updatePatches(w);
  updatePlants(w);
  updateBooms(w);
  updateBarriers(w);
  updatePois(w);
  updateEnemies(w);
  collidePlayer(w);
  updateGround(w);
  spawnFieldChunks(w);
  runDirector(w);
  runEvents(w);
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
  if (cmd.dash && p.dashCd <= 0 && p.dashTime <= 0) {
    let fx = cmd.moveX;
    let fy = cmd.moveY;
    let m = Math.hypot(fx, fy);
    if (m < 0.12) {
      fx = p.facingX || 1;
      fy = p.facingY;
      m = Math.hypot(fx, fy) || 1;
    }
    const burst = t.playerSpeed * Math.pow(sizeScale(p), 0.75) * speedMul(p.perks) * DASH_BURST * butterMul(p.perks);
    p.vx = (fx / m) * burst;
    p.vy = (fy / m) * burst;
    p.facingX = fx / m;
    p.facingY = fy / m;
    p.dashTime = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
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
    const slow = speedHere(w, p.x, p.y);
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
  const shove = sinkPush(p.x, p.y, w.props);
  p.x += shove.x * DT;
  p.y += shove.y * DT;
  const freed = separateFromHay(p.x, p.y, p.r, w.props);
  const walled = separateFromBarriers(freed.x, freed.y, p.r, w.barriers);
  p.x = walled.x;
  p.y = walled.y;
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
  if (kind === 'popper') return t.popperRecharge;
  if (kind === 'boing') return t.boingRecharge;
  if (kind === 'zappy') return t.zappyRecharge;
  if (kind === 'caramel') return t.caramelRecharge;
  if (kind === 'sprout') return t.sproutRecharge;
  return t.gemRecharge;
}

export function rechargeSeconds(w: World, kind: PowerKind): number {
  return rechargeFor(w.tuning, kind) * rechargeMul(w.player.perks);
}

function damageFor(w: World, kind: PowerKind): number {
  const t = w.tuning;
  const base =
    kind === 'zinger'
      ? t.zingerDamage
      : kind === 'spicy'
        ? t.spicyDamage
        : kind === 'frosty'
          ? t.frostyDamage
          : kind === 'popper'
            ? t.popperDamage
            : kind === 'boing'
              ? t.boingDamage
              : kind === 'zappy'
                ? t.zappyDamage
                : kind === 'sprout'
                  ? t.sproutDamage
                  : t.zingerDamage;
  return Math.max(1, Math.round(base * damageScale(w)));
}

/** Share of the target's knockable kernels a hit shakes loose, so big cobs take similar shots at any size. */
function shakeFor(w: World, source: PowerKind | null): number {
  const t = w.tuning;
  const pct =
    source === 'zinger'
      ? t.zingerShake
      : source === 'spicy'
        ? t.spicyShake
        : source === 'popper'
          ? t.popperShake
          : source === 'frosty'
            ? t.frostyShake
            : source === 'boing'
              ? t.boingShake
              : source === 'zappy'
                ? t.zappyShake
                : source === 'sprout'
                  ? t.sproutShake
                  : source === null
                    ? t.burnShake
                    : t.zingerShake;
  return pct / 100;
}

/** How many of a power you are "holding", counting shots from the last few seconds. */
export function powerHeld(w: World, kind: PowerKind): number {
  let n = w.player.kernels[kind];
  for (const shot of w.player.recentFired) if (shot.kind === kind) n++;
  return n;
}

export function powerMilestone(w: World, kind: PowerKind): Milestone {
  return milestoneOf(powerHeld(w, kind));
}

/**
 * The armed power that knocks the most off the current target.
 * Sticky is a last resort: it never pops kernels on its own.
 */
export function bestPower(w: World): PowerKind | null {
  const target = w.player.targetId !== null ? findEnemy(w, w.player.targetId) : undefined;
  let best: PowerKind | null = null;
  let bestScore = -1;
  for (const kind of w.player.pockets) {
    if (!canFire(w, kind)) continue;
    const attack = kind === 'gem' ? 'zinger' : kind;
    const dmg = POWER_DAMAGE[attack];
    let score = 0.2;
    if (!target) score = kind === 'zinger' ? 1 : 0.4;
    else if (target.popMax > 0) score = 2 + damageFor(w, attack);
    else if (dmg === 'sticky') score = 0.15;
    else score = knockable(target.kernels, dmg) * damageFor(w, attack);
    if (score > bestScore) {
      best = kind;
      bestScore = score;
    }
  }
  return best;
}

function tryFire(w: World, kind: PowerKind, aim: { x: number; y: number } | null): void {
  const p = w.player;
  if (p.bare || p.cooldowns[kind] > 0 || p.kernels[kind] <= 0 || !p.pockets.includes(kind)) return;
  if (total(p.kernels) <= 1) {
    w.events.push({ type: 'heartLock' });
    return;
  }
  p.kernels[kind]--;
  p.shotSerial++;
  p.cooldowns[kind] = rechargeSeconds(w, kind);
  p.recentFired.push({ tick: w.tick, kind });
  const level = powerMilestone(w, kind);
  if (level > p.milestoneSeen[kind]) {
    p.milestoneSeen[kind] = level;
    const name = milestoneName(kind, level);
    if (name) w.events.push({ type: 'milestone', kind, name });
  }

  const target = p.targetId !== null ? findEnemy(w, p.targetId) : undefined;
  let dx = p.facingX;
  let dy = p.facingY;
  let manual = false;
  if (aim) {
    const ad = Math.hypot(aim.x - p.x, aim.y - p.y);
    if (ad > 8) {
      dx = (aim.x - p.x) / ad;
      dy = (aim.y - p.y) / ad;
      manual = true;
    }
  }
  if (!manual && target) {
    const d = Math.hypot(target.x - p.x, target.y - p.y);
    if (d > 1e-3) {
      dx = (target.x - p.x) / d;
      dy = (target.y - p.y) / d;
    }
  }

  const casts = gemCasts(w, kind, level);
  const angles = shotAngles(kind, level);
  const boomerang = everyFifth(p.shotSerial, perkCount(p.perks, 'boomerang'));
  let boomed = false;
  for (const cast of casts) {
    angles.forEach((angle, i) => {
      const turn = angle;
      const fx = dx * Math.cos(turn) - dy * Math.sin(turn);
      const fy = dx * Math.sin(turn) + dy * Math.cos(turn);
      launchShot(w, {
        kind,
        attack: cast.attack,
        mul: cast.mul,
        dx: fx,
        dy: fy,
        target: manual ? undefined : target,
        rangeMul: kind === 'spicy' && level >= 20 ? 0.45 : 1,
        bounces: boingBounces(cast.attack, cast.attack === kind ? level : 0),
        boomerang: boomerang && !boomed && i === 0,
      });
      boomed = true;
    });
  }

  w.stats.shots[kind]++;
  w.stats.firedTotal++;
  if (w.tinkWatch) {
    if (w.tinkWatch.kind === kind) w.tinkWatch.presses++;
    else {
      w.stats.switchesAfterTink.push(w.tinkWatch.presses);
      w.tinkWatch = null;
    }
  }
}

function gemCasts(w: World, kind: PowerKind, level: Milestone): { attack: PowerKind; mul: number }[] {
  if (kind !== 'gem') return [{ attack: kind, mul: 1 }];
  const pool = POWER_KINDS.filter((k) => k !== 'gem');
  if (level >= 20) {
    const armed = w.player.pockets.filter((k) => k !== 'gem');
    const list = armed.length > 0 ? armed : [pool[int(w.rng, 0, pool.length - 1)]];
    return list.map((attack) => ({ attack, mul: 2 }));
  }
  const mul = level >= 5 ? 3 : 2;
  const n = level >= 10 ? 2 : 1;
  const out: { attack: PowerKind; mul: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ attack: pool[int(w.rng, 0, pool.length - 1)], mul });
  return out;
}

function shotAngles(kind: PowerKind, level: Milestone): number[] {
  if (kind === 'spicy' && level >= 20) return [-0.28, -0.14, 0, 0.14, 0.28];
  if (kind === 'spicy' && level >= 10) return [-0.2, 0, 0.2];
  if (kind === 'zinger' && level >= 20) return [-0.14, 0, 0.14];
  return [0];
}

function boingBounces(attack: PowerKind, level: Milestone): number {
  if (attack !== 'boing') return 0;
  if (level >= 20) return 11;
  if (level >= 5) return 5;
  return 3;
}

function launchShot(
  w: World,
  spec: {
    kind: PowerKind;
    attack: PowerKind;
    mul: number;
    dx: number;
    dy: number;
    target: Enemy | undefined;
    rangeMul: number;
    bounces: number;
    boomerang: boolean;
    foe?: boolean;
    seed?: boolean;
    x?: number;
    y?: number;
  },
): void {
  const p = w.player;
  const scale = sizeScale(p);
  const reach = shotRange(w) * spec.rangeMul;
  const sx = spec.x ?? p.x + spec.dx * (p.r + 4);
  const sy = spec.y ?? p.y + spec.dy * (p.r + 4);
  const attack = spec.attack;
  const speedKind = attack === 'gem' ? 'zinger' : attack;
  let lob: Shot['lob'] = null;
  let vx = 0;
  let vy = 0;
  if (attack === 'popper') {
    let tx = spec.target ? spec.target.x + spec.target.vx * 0.35 : sx + spec.dx * Math.min(reach, 240 * scale);
    let ty = spec.target ? spec.target.y + spec.target.vy * 0.35 : sy + spec.dy * Math.min(reach, 240 * scale);
    const dist = Math.hypot(tx - sx, ty - sy);
    if (dist > reach) {
      tx = sx + ((tx - sx) / dist) * reach;
      ty = sy + ((ty - sy) / dist) * reach;
    }
    lob = { sx, sy, tx, ty, t: 0, dur: 0.4 + Math.min(dist, reach) / (900 * scale) };
  } else {
    const speed = SHOT_SPEED[speedKind] * scale * (attack === 'zinger' && powerMilestone(w, 'zinger') >= 5 && spec.kind === 'zinger' ? 1.25 : 1);
    vx = spec.dx * speed;
    vy = spec.dy * speed;
  }
  const spicyBig = spec.kind === 'spicy' && powerMilestone(w, 'spicy') >= 5 ? 1.45 : 1;
  w.shots.push({
    id: w.nextId++,
    x: sx,
    y: sy,
    px: sx,
    py: sy,
    vx,
    vy,
    r: (attack === 'spicy' ? 7 : attack === 'frosty' ? 6 : 5) * Math.sqrt(scale) * spicyBig,
    kind: spec.kind,
    ownerId: spec.foe ? 0 : p.id,
    travelled: 0,
    range: reach,
    speed: Math.hypot(vx, vy) || SHOT_SPEED[speedKind] * scale,
    targetId: spec.target ? spec.target.id : null,
    lob,
    boomerang: spec.boomerang,
    returning: false,
    attack,
    mul: spec.mul,
    bounces: spec.bounces,
    seen: [],
    foe: spec.foe === true,
    seed: spec.seed === true,
  });
  w.events.push({ type: 'fire', kind: spec.kind, x: sx, y: sy });
}

function hitPlayer(w: World, damage: DamageType, amount: number, fromX: number, fromY: number): void {
  const p = w.player;
  if (p.invuln > 0 || p.bare) return;
  if (perkCount(p.perks, 'husk') > 0) {
    p.huskHits++;
    if (everyFifth(p.huskHits, perkCount(p.perks, 'husk'))) {
      p.invuln = w.tuning.mercySeconds;
      w.events.push({ type: 'block', x: p.x, y: p.y });
      return;
    }
  }
  const res = applyHit(p.kernels, damage, amount, w.rng, { heartIgnoresResist: true, chip: p.chip });
  if (res.removed.length === 0) {
    if (res.resisted) w.events.push({ type: 'tink', x: p.x, y: p.y, damage });
    return;
  }
  p.invuln = w.tuning.mercySeconds;
  p.pickupLock = w.tuning.pickupLockSeconds;
  const awayX = p.x - fromX;
  const awayY = p.y - fromY;
  scatterKernels(w, res.removed, p.x, p.y, awayX, awayY, 0.9, null);
  w.events.push({ type: 'hit', x: p.x, y: p.y, damage, count: res.removed.length, weak: res.weak, onPlayer: true });
  if (total(p.kernels) === 0) {
    p.bare = true;
    // Last Chance is the one window where scooping has to work immediately.
    p.pickupLock = 0;
    p.lastChance = w.difficulty === 'easy' ? Math.max(6, w.tuning.lastChanceSeconds) : w.tuning.lastChanceSeconds;
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

    if (!p.bare && e.popMax === 0 && canChomp(p.kernels, e.kernels)) {
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
      if (e.king && !w.won) {
        w.won = true;
        w.stats.seeds += 25 + p.kernels.goldie;
        w.events.push({ type: 'victory', x: e.x, y: e.y });
      }
      e.kernels = emptyKernels();
      e.popHp = 0;
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
  w.enemies = w.enemies.filter((e) => total(e.kernels) > 0 || e.popHp > 0);
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
  p.pickupLock = Math.max(0, p.pickupLock - DT);
  p.streakTimer = Math.max(0, p.streakTimer - DT);
  if (p.streakTimer === 0) p.streak = 0;
  p.pickupTimer = Math.max(0, p.pickupTimer - DT);
  if (p.pickupTimer === 0) p.pickupStreak = 0;
  p.dashCd = Math.max(0, p.dashCd - DT);
  while (p.recentFired.length > 0 && w.tick - p.recentFired[0].tick > FIRED_WINDOW_TICKS) p.recentFired.shift();

  if (p.kernels.sweetie > 0) {
    p.sweetieTimer -= DT;
    if (p.sweetieTimer <= 0) {
      p.sweetieTimer = 8 / Math.sqrt(p.kernels.sweetie);
      giveKernels(w, 'sunny', 1);
    }
  } else p.sweetieTimer = 8;

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

/** Sunny first, then the rest of the plains in PLAIN_KINDS order. Powers outrank every plain kernel. */
function kernelRank(kind: KernelKind): number {
  const plain = PLAIN_KINDS.indexOf(kind as (typeof PLAIN_KINDS)[number]);
  if (plain >= 0) return plain;
  return PLAIN_KINDS.length;
}

/**
 * The plain kernel a full cob will drop to make room for `incoming`.
 * Weaker plains go first. Nothing outranks a power kernel, so a plain pickup
 * can never take the socket of a kernel you can shoot.
 */
function capVictim(kernels: Kernels, incoming: KernelKind): KernelKind | null {
  const rank = kernelRank(incoming);
  for (const kind of PLAIN_KINDS) {
    if (kernels[kind] > 0 && kernelRank(kind) < rank) return kind;
  }
  return null;
}

/**
 * Adds kernels to the player. Once every socket at the top tier is full, a new kernel
 * replaces the weakest weaker one and the leftover becomes Seeds. A Sunny replaces
 * nothing. A power kernel replaces any plain kernel, and a plain kernel never replaces a power kernel.
 */
function giveKernels(w: World, kind: KernelKind, count: number): void {
  const p = w.player;
  const cap = maxSockets(w);
  for (let i = 0; i < count; i++) {
    if (total(p.kernels) < cap) {
      p.kernels[kind]++;
      continue;
    }
    const victim = capVictim(p.kernels, kind);
    if (victim) {
      p.kernels[victim]--;
      p.kernels[kind]++;
    }
    const gold = 1 + Math.floor(p.kernels.goldie * 0.1);
    w.stats.seeds += gold;
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
        const rain = s.attack === 'popper' && s.kind === 'popper' && powerMilestone(w, 'popper') >= 5 ? 1.3 : 1;
        const heavy = s.attack === 'popper' && s.kind === 'popper' && powerMilestone(w, 'popper') >= 10 ? 1 : 0;
        const r = popperRadius(w) * rain;
        w.events.push({ type: 'explode', x: s.x, y: s.y, r });
        const amount = Math.round(damageFor(w, 'popper') * s.mul) + heavy;
        for (const e of [...w.enemies]) {
          if (Math.hypot(e.x - s.x, e.y - s.y) < r + e.r) hitEnemy(w, e, 'pop', amount, s.x, s.y, s.attack, s.kind);
        }
        if (s.kind === 'popper' && powerMilestone(w, 'popper') >= 20) {
          w.booms.push({ x: s.x, y: s.y, r: r * 0.65, ttl: 0.22, damage: amount, shake: shakeFor(w, 'popper') });
        }
        if (keepOrLand(w, s)) keep.push(s);
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

    if (s.foe && Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r) {
      hitPlayer(w, POWER_DAMAGE[s.attack], Math.max(1, Math.round(damageFor(w, s.attack) * 0.5)), s.x, s.y);
      dropFired(w, s.kind, s.x, s.y, null);
      continue;
    }

    let hit: Enemy | null = null;
    for (const e of w.enemies) {
      if (s.seen.includes(e.id)) continue;
      if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) {
        hit = e;
        break;
      }
    }
    if (hit) {
      const amount = shotFlat(w, s);
      hitEnemy(w, hit, POWER_DAMAGE[s.attack], amount, s.x, s.y, s.attack, s.kind);
      if (s.attack === 'spicy' && t.burnSeconds > 0) {
        const big = s.kind === 'spicy' && powerMilestone(w, 'spicy') >= 5 ? 1.35 : 1;
        w.patches.push({
          id: w.nextId++,
          x: s.x,
          y: s.y,
          r: 38 * sizeScale(w.player) * big,
          ttl: t.burnSeconds,
          tickTimer: 0.5,
          kind: 'fire',
        });
      }
      if (s.attack === 'zappy') zapChain(w, s, hit);
      if (s.attack === 'frosty') freezeSlick(w, s.x, s.y);
      if (ricochet(w, s, hit)) {
        keep.push(s);
        continue;
      }
      if (s.attack === 'sprout' && !s.foe) plantSprout(w, s);
      else if (keepOrLand(w, s)) keep.push(s);
      continue;
    }
    if (strikePoi(w, s.x, s.y)) {
      if (s.attack === 'sprout' && !s.foe) plantSprout(w, s);
      else if (keepOrLand(w, s)) keep.push(s);
      continue;
    }
    if (s.travelled >= s.range) {
      if (s.attack === 'sprout' && !s.foe) plantSprout(w, s);
      else if (keepOrLand(w, s)) keep.push(s);
      continue;
    }
    keep.push(s);
  }
  w.shots = keep;
}

function shotFlat(w: World, s: Shot): number {
  let n = Math.round(damageFor(w, s.attack) * s.mul);
  if (s.kind === 'zinger' && s.attack === 'zinger' && powerMilestone(w, 'zinger') >= 10) n += 1;
  if (s.kind === 'boing' && s.attack === 'boing' && powerMilestone(w, 'boing') >= 10) n += 1;
  return Math.max(1, n);
}

function keepOrLand(w: World, s: Shot): boolean {
  if (s.seed) return false;
  if (s.boomerang && !s.foe) {
    s.returning = true;
    s.travelled = 0;
    s.lob = null;
    return true;
  }
  dropFired(w, s.kind, s.x, s.y, s.foe ? null : s.ownerId);
  return false;
}

function ricochet(w: World, s: Shot, from: Enemy): boolean {
  if (s.attack !== 'boing' || s.bounces <= 0) return false;
  s.seen.push(from.id);
  let next: Enemy | null = null;
  let best = Infinity;
  const reach = 280 * sizeScale(w.player);
  for (const e of w.enemies) {
    if (s.seen.includes(e.id)) continue;
    if (e.popMax === 0 && total(e.kernels) === 0) continue;
    const d = Math.hypot(e.x - s.x, e.y - s.y);
    if (d < reach && d < best) {
      best = d;
      next = e;
    }
  }
  if (!next) return false;
  s.bounces--;
  const d = Math.hypot(next.x - s.x, next.y - s.y) || 1;
  s.vx = ((next.x - s.x) / d) * (s.speed || 1);
  s.vy = ((next.y - s.y) / d) * (s.speed || 1);
  s.targetId = next.id;
  s.x += (s.vx / (s.speed || 1)) * (from.r + s.r);
  s.y += (s.vy / (s.speed || 1)) * (from.r + s.r);
  return true;
}

function zapChain(w: World, s: Shot, first: Enemy): void {
  const level = s.kind === 'zappy' ? powerMilestone(w, 'zappy') : 0;
  let hops = level >= 10 ? 4 : level >= 5 ? 3 : 2;
  let from = first;
  const seen = new Set<number>([first.id]);
  if (level >= 20) {
    for (const e of [...w.enemies]) {
      if (e === first) continue;
      if (Math.hypot(e.x - first.x, e.y - first.y) < first.r + e.r + 36) {
        hitEnemy(w, e, 'zap', shotFlat(w, s), first.x, first.y, 'zappy', s.kind);
        seen.add(e.id);
      }
    }
  }
  while (hops > 0) {
    let next: Enemy | null = null;
    let best = Infinity;
    for (const e of w.enemies) {
      if (seen.has(e.id)) continue;
      const d = Math.hypot(e.x - from.x, e.y - from.y);
      if (d < 220 * sizeScale(w.player) && d < best) {
        best = d;
        next = e;
      }
    }
    if (!next) break;
    seen.add(next.id);
    hitEnemy(w, next, 'zap', shotFlat(w, s), from.x, from.y, 'zappy', s.kind);
    from = next;
    hops--;
  }
}

function freezeSlick(w: World, x: number, y: number): void {
  w.patches = w.patches.filter((p) => p.kind !== 'slick' || (p.x - x) ** 2 + (p.y - y) ** 2 > (p.r + 18) ** 2);
}

function plantSprout(w: World, s: Shot): void {
  const level = s.kind === 'sprout' ? powerMilestone(w, 'sprout') : 0;
  const ttl = level >= 5 ? 8 : 6;
  const every = level >= 10 ? 0.45 : 0.75;
  const spots = level >= 20 ? [0, 34] : [0];
  for (const off of spots) {
    w.plants.push({ id: w.nextId++, x: s.x + off, y: s.y, ttl, cd: 0.25, every, mul: s.mul });
  }
  const inCaramel = w.patches.some((p) => (p.kind ?? 'fire') === 'caramel' && (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (p.r + 8) ** 2);
  if (!inCaramel) return;
  w.events.push({ type: 'combo', name: 'Corn Maze', x: s.x, y: s.y });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    w.barriers.push({ x: s.x + Math.cos(a) * 70, y: s.y + Math.sin(a) * 70, r: 16, ttl: 4 });
  }
}

function strikePoi(w: World, x: number, y: number): boolean {
  for (const poi of w.pois) {
    if (poi.used || poi.hp <= 0) continue;
    if (poi.kind !== 'pinata' && poi.kind !== 'rescue' && poi.kind !== 'stalk') continue;
    if ((poi.x - x) ** 2 + (poi.y - y) ** 2 > 36 * 36) continue;
    poi.hp--;
    if (poi.hp <= 0) openPoi(w, poi);
    return true;
  }
  return false;
}

function updatePatches(w: World): void {
  const keep: BurnPatch[] = [];
  for (const patch of w.patches) {
    patch.ttl -= DT;
    patch.tickTimer -= DT;
    if (patch.tickTimer <= 0 && (patch.kind ?? 'fire') === 'fire') {
      patch.tickTimer = 0.5;
      for (const e of [...w.enemies]) {
        if (Math.hypot(e.x - patch.x, e.y - patch.y) < patch.r + e.r * 0.5) {
          hitEnemy(w, e, 'fire', Math.max(1, Math.round(damageScale(w))), patch.x, patch.y, null);
          e.burnLeft = Math.max(e.burnLeft, 0.6);
        }
      }
    }
    if (patch.ttl > 0) keep.push(patch);
  }
  w.patches = keep;
}

/** `source` is the attack. `shell` is the kernel that was fired, for milestones and tink tracking. */
function hitEnemy(
  w: World,
  e: Enemy,
  damage: DamageType,
  amount: number,
  fromX: number,
  fromY: number,
  source: PowerKind | null,
  shell: PowerKind | null = source,
  pierce?: readonly KernelKind[],
): void {
  if (e.popMax > 0) {
    const loss = Math.max(1, amount);
    e.popHp -= loss;
    e.hitFlash = 0.15;
    w.events.push({ type: 'hit', x: e.x, y: e.y - e.r, damage, count: loss, weak: false, onPlayer: false });
    if (e.type === 'harvey') scatterKernels(w, Array.from({ length: Math.min(6, loss) }, () => 'sunny' as const), e.x, e.y, 1, 0, 0.2, null);
    if (e.popHp <= 0) defeatFoe(w, e);
    return;
  }
  if (total(e.kernels) === 0) return;
  if (e.husk > 0) {
    if (damage !== 'pop') {
      if (source) {
        w.events.push({ type: 'tink', x: e.x, y: e.y - e.r, damage });
        w.stats.tinks++;
        if (shell && !w.tinkWatch) w.tinkWatch = { kind: shell, presses: 0 };
      }
      return;
    }
    e.husk--;
    e.hitFlash = 0.15;
    w.events.push({ type: 'hit', x: e.x, y: e.y - e.r, damage, count: 1, weak: false, onPlayer: false });
    return;
  }
  if (damage === 'sticky') {
    const level = shell === 'caramel' ? powerMilestone(w, 'caramel') : 0;
    e.caramelLeft = 3.2 * (level >= 5 ? 1.45 : 1);
    e.slowLeft = Math.max(e.slowLeft, e.caramelLeft);
    if (level >= 20) e.stuckLeft = Math.max(e.stuckLeft, 0.9);
    w.patches.push({
      id: w.nextId++,
      x: e.x,
      y: e.y,
      r: 34 * sizeScale(w.player) * (level >= 10 ? 1.45 : 1),
      ttl: e.caramelLeft,
      tickTimer: 9,
      kind: 'caramel',
    });
    e.hitFlash = 0.15;
    return;
  }

  const wasFrozen = e.frozenLeft > 0;
  const wasBurn = e.burnLeft > 0;
  const wasCaramel = e.caramelLeft > 0;
  const wasZap = e.zapLeft > 0;
  const before = total(e.kernels);
  const soggyShare = before > 0 ? e.kernels.soggy / before : 0;

  if (!pierce) amount += Math.round(shakeFor(w, source) * knockable(e.kernels, damage));
  if (e.hunter && !pierce) {
    const scaled = amount * w.tuning.hunterArmor;
    amount = Math.floor(scaled) + (chance(w.rng, scaled - Math.floor(scaled)) ? 1 : 0);
    if (amount <= 0) return;
  }
  const res = applyHit(e.kernels, damage, amount, w.rng, { chip: e.chip, pierce });
  if (res.removed.length === 0 && !res.chipped) {
    if (res.resisted && source !== null) {
      w.events.push({ type: 'tink', x: e.x, y: e.y - e.r, damage });
      w.stats.tinks++;
      if (shell && !w.tinkWatch) w.tinkWatch = { kind: shell, presses: 0 };
    }
    return;
  }
  e.hitFlash = 0.15;
  if (res.removed.length > 0) {
    scatterKernels(w, res.removed, e.x, e.y, e.x - fromX, e.y - fromY, 0.5, null, w.tuning.enemyGrabLock * (w.difficulty === 'spicy' ? 0.55 : 1));
    w.events.push({
      type: 'hit',
      x: e.x,
      y: e.y - e.r,
      damage,
      count: res.removed.length,
      weak: res.weak,
      onPlayer: false,
    });
  }
  if (res.resisted && source !== null) w.events.push({ type: 'tink', x: e.x + e.r, y: e.y - e.r, damage });

  if (!pierce && source === 'spicy' && wasFrozen) {
    w.events.push({ type: 'combo', name: 'Steam Burst', x: e.x, y: e.y });
    hitEnemy(w, e, 'fire', 3, fromX, fromY, 'spicy', shell, ['toasty']);
  }
  if (!pierce && source === 'popper' && wasFrozen) {
    w.events.push({ type: 'combo', name: 'Shatter', x: e.x, y: e.y });
    hitEnemy(w, e, 'pop', 4, fromX, fromY, 'popper', shell, ['stony']);
  }
  if (!pierce && source === 'zappy' && soggyShare >= 0.5) {
    w.events.push({ type: 'combo', name: 'Splash Zap', x: e.x, y: e.y });
    for (const other of [...w.enemies]) {
      if (other === e) continue;
      if (Math.hypot(other.x - e.x, other.y - e.y) < 180 * sizeScale(w.player)) {
        hitEnemy(w, other, 'zap', Math.max(1, amount), e.x, e.y, 'zappy', shell, []);
      }
    }
  }
  if (!pierce && source === 'popper' && wasBurn) {
    w.events.push({ type: 'combo', name: 'Kettle Corn', x: e.x, y: e.y });
    for (let i = 0; i < 5; i++) addGround(w, 'sunny', e.x + range(w.rng, -20, 20), e.y + range(w.rng, -20, 20), 0, 0, 0.2, null);
  }
  if (!pierce && source === 'spicy' && wasCaramel) {
    w.events.push({ type: 'combo', name: 'Caramel Corn', x: e.x, y: e.y });
    e.stuckLeft = 4;
    e.vx = 0;
    e.vy = 0;
  }
  if (!pierce && shell === 'gem' && wasZap) {
    w.events.push({ type: 'combo', name: 'Disco Cob', x: e.x, y: e.y });
    for (const other of [...w.enemies]) {
      if (other === e) continue;
      if (Math.hypot(other.x - e.x, other.y - e.y) < 160 * sizeScale(w.player)) {
        hitEnemy(w, other, 'bonk', 2, e.x, e.y, 'zinger', 'gem', []);
      }
    }
  }

  if (source === 'spicy') e.burnLeft = Math.max(e.burnLeft, 2.4);
  if (source === 'zappy') e.zapLeft = Math.max(e.zapLeft, 2);
  if (source === 'frosty' && (res.removed.length > 0 || res.chipped)) {
    const level = shell === 'frosty' ? powerMilestone(w, 'frosty') : 0;
    e.frostHits++;
    e.slowLeft = Math.max(e.slowLeft, FROST_SLOW_S * (level >= 5 ? 1.5 : 1));
    const need = level >= 10 ? 2 : 3;
    if (e.frostHits >= need) {
      e.frostHits = 0;
      e.frozenLeft = FROST_FREEZE_S;
      e.vx = 0;
      e.vy = 0;
      w.events.push({ type: 'freeze', x: e.x, y: e.y });
    }
    if (level >= 20) {
      for (const other of w.enemies) {
        if (other === e) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) < 120) other.slowLeft = Math.max(other.slowLeft, 1.4);
      }
    }
  }
  if (e.king && e.kingStart > 0) advanceKing(w, e);
  if (total(e.kernels) === 0 && e.popMax === 0) {
    w.events.push({ type: 'poof', x: e.x, y: e.y });
    w.stats.poofs++;
    w.enemies = w.enemies.filter((o) => o !== e);
  }
}

function advanceKing(w: World, e: Enemy): void {
  const left = total(e.kernels) / e.kingStart;
  const phase = left < 0.34 ? 2 : left < 0.66 ? 1 : 0;
  if (phase === e.kingPhase) return;
  e.kingPhase = phase;
  const n = total(e.kernels);
  e.kernels = emptyKernels();
  e.chip = emptyKernels();
  if (phase === 1) {
    e.kernels.stony = Math.round(n * 0.75);
    e.kernels.sunny = n - e.kernels.stony;
  } else {
    e.kernels.tough = Math.round(n * 0.45);
    e.kernels.sunny = Math.round(n * 0.35);
    e.kernels.soggy = n - e.kernels.tough - e.kernels.sunny;
  }
  w.events.push({ type: 'coat', x: e.x, y: e.y, phase });
}

function defeatFoe(w: World, e: Enemy): void {
  const loot = total(e.loot) > 0 ? e.loot : foeLoot(e.type);
  const kinds: KernelKind[] = [];
  for (const kind of KERNEL_KINDS) for (let i = 0; i < loot[kind]; i++) kinds.push(kind);
  if (kinds.length > 0) scatterKernels(w, kinds, e.x, e.y, 1, 0, 0.15, null);
  w.events.push({ type: 'poof', x: e.x, y: e.y });
  w.stats.poofs++;
  e.popHp = 0;
  e.kernels = emptyKernels();
  w.enemies = w.enemies.filter((o) => o !== e);
}

function foeLoot(type: EnemyType): Kernels {
  const k = emptyKernels();
  if (type === 'steve') {
    k.zinger = 2;
    k.spicy = 2;
    k.popper = 1;
    k.frosty = 1;
  } else if (type === 'butter') {
    k.sunny = 8;
    k.frosty = 2;
  } else if (type === 'harvey') {
    k.sunny = 24;
    k.sweetie = 4;
    k.popper = 2;
  }
  return k;
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

function dropFired(w: World, kind: PowerKind, x: number, y: number, ownerId: number | null): void {
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
  // Big Magnet grows how far the magnet reaches. Pull strength stays the same.
  const goldie = 1 + 0.08 * p.kernels.goldie;
  const diffMagnet = w.difficulty === 'easy' ? 1.8 : w.difficulty === 'spicy' ? 0.75 : 1;
  const magnet = p.r + t.magnetRadius * sizeScale(p) * magnetMul(p.perks) * goldie * diffMagnet;

  for (const g of w.ground) {
    g.age += DT;
    g.delay = Math.max(0, g.delay - DT);
    g.enemyLock = Math.max(0, g.enemyLock - DT);
    g.sparkle = Math.max(0, g.sparkle - DT);

    if (g.delay <= 0 && p.pickupLock <= 0) {
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

  const grabs = w.difficulty === 'easy' ? 0 : t.enemyGrabs;
  if (grabs >= 1) {
    const grid = buildGrid(w.ground);
    const found: GroundKernel[] = [];
    for (const e of w.enemies) {
      if (e.caramelLeft > 0) continue;
      const stealing = e.type === 'crow' || e.type === 'ant';
      for (const g of queryGrid(grid, e.x, e.y, e.r + (stealing ? 16 : 3), found)) {
        if (g.delay > 0 || g.enemyLock > 0 || g.dead) continue;
        if (stealing) e.loot[g.kind] += g.value;
        else e.kernels[g.kind] += g.value;
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

const ENEMY_BASE_SPEED: Record<EnemyType, number> = {
  baby: 62,
  nibbler: 120,
  soggy: 44,
  rocky: 100,
  zoomer: 150,
  shooter: 72,
  bouncy: 84,
  husky: 46,
  bomber: 58,
  crow: 150,
  ant: 96,
  cousin: 108,
  steve: 42,
  butter: 78,
  harvey: 120,
  king: 48,
};

function updateEnemies(w: World): void {
  const p = w.player;
  const t = w.tuning;
  const grabsOn = w.difficulty !== 'easy' && t.enemyGrabs >= 1;
  const grid = grabsOn ? buildGrid(w.ground) : null;
  const found: GroundKernel[] = [];
  const scale = sizeScale(p);
  const pressure = challenge(w);
  const rampSpeed = 1 + t.enemySpeedRamp * pressure;

  for (const e of w.enemies) {
    e.hitFlash = Math.max(0, e.hitFlash - DT);
    e.bumpCooldown = Math.max(0, e.bumpCooldown - DT);
    e.slowLeft = Math.max(0, e.slowLeft - DT);
    e.frozenLeft = Math.max(0, e.frozenLeft - DT);
    e.burnLeft = Math.max(0, e.burnLeft - DT);
    e.zapLeft = Math.max(0, e.zapLeft - DT);
    e.caramelLeft = Math.max(0, e.caramelLeft - DT);
    e.stuckLeft = Math.max(0, e.stuckLeft - DT);
    e.turnTimer -= DT;
    e.shotCd = Math.max(0, e.shotCd - DT);
    e.gustCd = Math.max(0, e.gustCd - DT);
    const n = total(e.kernels);
    if (e.frozenLeft > 0 || e.stuckLeft > 0) {
      e.vx = 0;
      e.vy = 0;
      if (e.popMax === 0) e.r = radiusFor(Math.max(1, n));
      continue;
    }
    const sizeFactor = Math.min(1.15, Math.max(0.55, 1.15 - (0.3 * n) / p.sockets));
    let speed = ENEMY_BASE_SPEED[e.type] * t.enemySpeed * rampSpeed * sizeFactor * Math.pow(scale, 0.75) * speedHere(w, e.x, e.y);
    if (w.difficulty === 'easy') speed *= 0.8;
    if (w.difficulty === 'spicy') speed *= 1.12;
    if (e.slowLeft > 0 || e.caramelLeft > 0) speed *= FROST_SLOW;
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

    if (e.retreat > 0 && e.popMax === 0) {
      e.retreat -= DT;
      e.heading = toPlayer + Math.PI;
    } else if (e.type === 'zoomer') {
      if (e.turnTimer <= 0) {
        e.turnTimer = range(w.rng, 1.4, 2.6);
        e.heading = range(w.rng, 0, Math.PI * 2);
      }
    } else if (e.type === 'nibbler' || e.type === 'cousin' || e.type === 'king') {
      e.heading = toPlayer + Math.sin((w.tick + e.id) * 0.05) * 0.25;
      if (e.type === 'cousin') speed *= 1.05;
    } else if (e.type === 'shooter') {
      const prefer = 260 * scale;
      e.heading = distPlayer < prefer ? toPlayer + Math.PI : toPlayer;
      if (e.shotCd <= 0 && distPlayer < shotRange(w) && total(e.kernels) > 1) foeShoot(w, e);
    } else if (e.type === 'bouncy') {
      speed *= Math.sin(w.tick * 0.25 + e.id) > 0 ? 1.7 : 0.35;
      if (e.turnTimer <= 0) {
        e.turnTimer = range(w.rng, 0.4, 1);
        e.heading = toPlayer + range(w.rng, -0.8, 0.8);
      }
    } else if (e.type === 'bomber') {
      e.heading = toPlayer;
      if (e.fuse < 0 && distPlayer < 110 * scale) e.fuse = 1;
      if (e.fuse >= 0) {
        e.fuse -= DT;
        speed = 0;
        if (e.fuse <= 0) {
          hitPlayer(w, 'pop', Math.max(2, Math.round(damageScale(w))), e.x, e.y);
          w.events.push({ type: 'explode', x: e.x, y: e.y, r: 70 });
          e.kernels = emptyKernels();
        }
      }
    } else if (e.type === 'crow' || e.type === 'ant') {
      let bx = 0;
      let by = 0;
      let best = Infinity;
      for (const g of w.ground) {
        if (g.dead || g.enemyLock > 0) continue;
        const d = (g.x - e.x) ** 2 + (g.y - e.y) ** 2;
        if (d < best) {
          best = d;
          bx = g.x;
          by = g.y;
        }
      }
      if (best < (420 * scale) ** 2) e.heading = Math.atan2(by - e.y, bx - e.x);
      else e.heading = toPlayer + (e.type === 'crow' ? Math.PI * 0.85 : 0);
    } else if (e.type === 'steve') {
      if (e.turnTimer <= 0) {
        e.turnTimer = range(w.rng, 1.5, 3);
        e.heading = toPlayer + range(w.rng, -1, 1);
      }
      if (e.gustCd <= 0) {
        e.gustCd = 4.5;
        if (distPlayer < 420 * scale) {
          p.vx += Math.cos(toPlayer) * -260 * scale;
          p.vy += Math.sin(toPlayer) * -260 * scale;
          w.events.push({ type: 'dash', x: e.x, y: e.y });
        }
        if (w.difficulty !== 'easy') spawnEnemy(w, 'crow', emptyKernels(), e.x + 40, e.y, false, { popHp: 3, popMax: 3 });
      }
    } else if (e.type === 'butter') {
      e.heading = toPlayer;
      if (e.shotCd <= 0) {
        e.shotCd = 0.35;
        w.patches.push({ id: w.nextId++, x: e.x, y: e.y, r: 28, ttl: 5, tickTimer: 9, kind: 'slick' });
      }
    } else if (e.type === 'harvey') {
      if (e.turnTimer <= 0) e.heading = range(w.rng, -0.2, 0.2);
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
    const walled = separateFromBarriers(freed.x, freed.y, e.r, w.barriers);
    e.x = walled.x;
    e.y = walled.y;
    e.r = e.popMax > 0 ? Math.max(e.r, radiusFor(Math.max(8, e.popMax))) : radiusFor(Math.max(1, n));
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
    const now = e.popMax === 0 && !p.bare && canChomp(p.kernels, e.kernels);
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
      const lucky = luckyMul(w.player.perks);
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
        if (chance(rng, Math.min(0.92, 0.35 * lucky))) {
          const kind = POWER_KINDS[int(rng, 0, Math.min(POWER_KINDS.length - 1, 3 + Math.floor(lucky)))];
          const extra = int(rng, 1, 2);
          for (let i = 0; i < extra; i++) addGround(w, kind, ox + range(rng, -20, 20), oy + range(rng, -20, 20), 0, 0, 0, null);
        }
        if (chance(rng, Math.min(0.85, 0.15 * lucky))) {
          const plains: KernelKind[] = biomeAt(ox, oy) === 'kitchen' ? ['soggy', 'toasty', 'leafy'] : biomeAt(ox, oy) === 'picnic' ? ['sweetie', 'rubbery'] : ['soggy', 'stony'];
          const kind = plains[int(rng, 0, plains.length - 1)];
          const extra = int(rng, 1, 3);
          for (let i = 0; i < extra; i++) addGround(w, kind, ox + range(rng, -25, 25), oy + range(rng, -25, 25), 0, 0, 0, null);
        }
        // Shrines and the other points of interest are parked until the field is calmer.
        if (SHOW_POINTS_OF_INTEREST && chance(rng, 0.22)) spawnPoi(w, rng, ox, oy);
      }
    }
  }
}

function composeEnemy(rng: Rng, type: EnemyType, count: number, rare = 1): Kernels {
  const k = emptyKernels();
  if (type === 'nibbler') {
    k.sunny = 1;
    return k;
  }
  const main: KernelKind =
    type === 'soggy'
      ? 'soggy'
      : type === 'rocky'
        ? 'stony'
        : type === 'bouncy'
          ? 'rubbery'
          : type === 'husky'
            ? 'tough'
            : type === 'zoomer'
              ? 'zappy'
              : type === 'bomber'
                ? 'popper'
                : 'sunny';
  const baseMain = type === 'baby' ? 0.9 : 0.62;
  const mainShare = Math.max(0.2, 1 - (1 - baseMain) * rare);
  const plains = PLAIN_KINDS.filter((kind) => kind !== 'goldie');
  for (let i = 0; i < count; i++) {
    const roll = next(rng);
    if (roll < mainShare) k[main]++;
    else if (roll < 0.86) k[plains[int(rng, 0, Math.min(plains.length - 1, 2 + Math.floor(rare)))]]++;
    else if (roll < 0.97) k[POWER_KINDS[int(rng, 0, POWER_KINDS.length - 1)]]++;
    else k.goldie += chance(rng, Math.min(0.8, (rare - 1) * 0.5)) ? 1 : 0;
    if (k.goldie === 0 && roll >= 0.97) k.sunny++;
  }
  if (total(k) === 0) k.sunny = Math.max(1, count);
  return k;
}

const ROSTER: readonly EnemyType[] = ['baby', 'nibbler', 'soggy', 'rocky', 'zoomer', 'shooter', 'bouncy', 'husky', 'bomber', 'cousin', 'ant'];

function rosterWeight(w: World, type: EnemyType, big: boolean): number {
  if (w.player.tier < 2 && (type === 'shooter' || type === 'bomber' || type === 'cousin' || type === 'husky')) return 0;
  const resist = type === 'soggy' || type === 'rocky' || type === 'bouncy' || type === 'husky';
  let weight = type === 'baby' ? (big ? 3 : 8) : type === 'nibbler' ? (big ? 1 : 5) : 2.2;
  if (resist && w.difficulty === 'easy') weight *= 0.35;
  if (resist && w.difficulty === 'spicy') weight *= 1.45;
  if (big && type === 'baby') weight *= 0.45;
  const biome = biomeAt(w.player.x, w.player.y);
  if (type === 'ant') return biome === 'picnic' && w.difficulty !== 'easy' ? 4 : 0;
  if (biome === 'picnic' && type === 'zoomer') weight += 2;
  if (biome === 'kitchen' && (type === 'soggy' || type === 'bouncy')) weight += 2;
  if (biome === 'farm' && type === 'baby') weight += 1;
  return weight;
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
  const hunterPct = t.huntersAtTop * (w.difficulty === 'easy' ? 0.4 : w.difficulty === 'spicy' ? 1.35 : 1);
  if (!early && next(rng) * 100 < hunterPct * challenge(w)) {
    count = Math.max(Math.ceil(c) + 1, Math.round(c * range(rng, HUNTER_MIN_SIZE, Math.max(HUNTER_MIN_SIZE, t.hunterSize))));
    type = pickWeighted(rng, ['soggy', 'rocky', 'bouncy', 'husky'] as EnemyType[], (ty) => rosterWeight(w, ty, true)) ?? 'soggy';
    return { type, kernels: composeEnemy(rng, type, count, luckyMul(w.player.perks)), cost: Math.min(MAX_SPAWN_COST, 1 + count / c), hunter: true };
  }
  if (roll >= bigShare || early) {
    // Snacks grow slower than you do, so each chomp is a smaller share of a bigger cob.
    const snack = Math.pow(c, t.snackExponent) * t.snackSize * range(rng, 0.6, 1.4);
    count = Math.max(1, Math.min(Math.floor(c) - 1, Math.round(snack)));
    type = pickWeighted(rng, ROSTER, (ty) => rosterWeight(w, ty, false)) ?? 'baby';
  } else {
    const lo = roll < wearShare ? 1.05 : t.wearDownMax;
    const hi = roll < wearShare ? t.wearDownMax : Math.max(t.wearDownMax, t.projectMax);
    count = Math.max(Math.ceil(c) + 1, Math.round(c * range(rng, lo, hi)));
    type = pickWeighted(rng, ROSTER, (ty) => rosterWeight(w, ty, true)) ?? 'baby';
  }
  const kernels = composeEnemy(rng, type, count, luckyMul(w.player.perks));
  // Cost is relative to your size so the spawn rate doesn't stall as you grow.
  return { type, kernels, cost: Math.min(MAX_SPAWN_COST, 1 + count / c), hunter: false };
}

function spawnEnemy(
  w: World,
  type: EnemyType,
  kernels: Kernels,
  x: number,
  y: number,
  hunter = false,
  extra: Partial<Enemy> = {},
): Enemy {
  const p = w.player;
  const popMax = extra.popMax ?? 0;
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
    r: popMax > 0 ? radiusFor(Math.max(10, popMax)) : radiusFor(Math.max(1, total(kernels))),
    heading: Math.atan2(p.y - y, p.x - x) + range(w.rng, -0.5, 0.5),
    turnTimer: range(w.rng, 0.5, 2),
    chompable: popMax === 0 && canChomp(p.kernels, kernels),
    hitFlash: 0,
    bumpCooldown: 0,
    retreat: 0,
    seeking: true,
    hunter,
    frostHits: 0,
    slowLeft: 0,
    frozenLeft: 0,
    burnLeft: 0,
    zapLeft: 0,
    caramelLeft: 0,
    stuckLeft: 0,
    husk: type === 'husky' ? 3 : 0,
    popHp: popMax,
    popMax,
    shotCd: 0.4,
    fuse: -1,
    loot: emptyKernels(),
    chip: emptyKernels(),
    king: type === 'king',
    kingPhase: 0,
    kingStart: type === 'king' ? total(kernels) : 0,
    gustCd: 1.2,
    ...extra,
  };
  w.enemies.push(e);
  return e;
}

function spawnOpeningCobs(w: World): void {
  const p = w.player;
  const n = total(p.kernels);
  // A few quick snacks (each carrying a power kernel, so a plain Sunny start can arm up),
  // plus two big cobs that are too big to eat by snacking alone.
  const babyPowers: PowerKind[] = [...STARTER_POWERS];
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
    const kernels = composeEnemy(w.rng, type, count, luckyMul(w.player.perks));
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
  const diffBudget = w.difficulty === 'spicy' ? 1.3 : w.difficulty === 'easy' ? 0.85 : 1;
  dir.budget += (t.budgetBase + t.budgetPerPower * dir.smoothedPower + t.budgetPerMinute * minutes) * wave * diffBudget * DT;
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
    if (dir.plan.type === 'ant') {
      spawnEnemy(w, 'ant', emptyKernels(), p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, false, { popHp: 2, popMax: 2 });
    } else if (dir.plan.type === 'nibbler') {
      const pack = Math.min(4, Math.max(1, Math.round(total(dir.plan.kernels))));
      for (let i = 0; i < pack; i++) {
        const j = a + i * 0.4;
        spawnEnemy(w, 'nibbler', kernelsOf({ sunny: 1 }), p.x + Math.cos(j) * d, p.y + Math.sin(j) * d);
      }
    } else {
      spawnEnemy(w, dir.plan.type, dir.plan.kernels, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, dir.plan.hunter);
    }
    dir.plan = null;
  }

  const despawn = view * 4.5;
  w.enemies = w.enemies.filter((e) => e.king || e.type === 'steve' || e.type === 'butter' || e.type === 'harvey' || Math.hypot(e.x - p.x, e.y - p.y) < despawn);
}

function speedHere(w: World, x: number, y: number): number {
  let s = mudSlow(x, y, w.props);
  for (const patch of w.patches) {
    if ((x - patch.x) ** 2 + (y - patch.y) ** 2 > patch.r * patch.r) continue;
    if (patch.kind === 'slick') s *= 0.45;
    if (patch.kind === 'caramel') s *= 0.4;
  }
  return s;
}

function separateFromBarriers(x: number, y: number, radius: number, barriers: readonly Barrier[]): { x: number; y: number } {
  for (const b of barriers) {
    let dx = x - b.x;
    let dy = y - b.y;
    const min = radius + b.r;
    const d = Math.hypot(dx, dy);
    if (d >= min) continue;
    if (d < 1e-4) {
      dx = 1;
      dy = 0;
    } else {
      dx /= d;
      dy /= d;
    }
    x += dx * (min - (d < 1e-4 ? 0 : d));
    y += dy * (min - (d < 1e-4 ? 0 : d));
  }
  return { x, y };
}

function foeShoot(w: World, e: Enemy): void {
  if (w.shots.filter((s) => s.foe).length > 10) return;
  const kind = POWER_KINDS.find((k) => e.kernels[k] > 0) ?? 'zinger';
  if (e.kernels[kind] <= 0 || total(e.kernels) <= 1) return;
  e.kernels[kind]--;
  e.shotCd = 2.4;
  const p = w.player;
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
  launchShot(w, {
    kind,
    attack: kind === 'gem' ? 'zinger' : kind,
    mul: 1,
    dx: (p.x - e.x) / d,
    dy: (p.y - e.y) / d,
    target: undefined,
    rangeMul: 0.8,
    bounces: 0,
    boomerang: false,
    foe: true,
    x: e.x,
    y: e.y,
  });
}

function spawnPoi(w: World, rng: Rng, x: number, y: number): void {
  if (Math.hypot(x, y) < 260) return;
  const roll = next(rng);
  const kind: Poi['kind'] = roll < 0.28 ? 'pinata' : roll < 0.5 ? 'patch' : roll < 0.7 ? 'sprinkler' : roll < 0.86 ? 'shrine' : roll < 0.96 ? 'rescue' : 'stalk';
  const power = kind === 'patch' ? POWER_KINDS[int(rng, 0, 4)] : null;
  w.pois.push({
    id: w.nextId++,
    kind,
    x,
    y,
    hp: kind === 'pinata' ? 4 : kind === 'rescue' ? 3 : kind === 'stalk' ? 5 : 0,
    power,
    stock: 0,
    timer: 0,
    used: false,
  });
}

function openPoi(w: World, poi: Poi): void {
  poi.used = true;
  poi.hp = 0;
  if (poi.kind === 'pinata') {
    const kinds: KernelKind[] = [];
    for (let i = 0; i < 10; i++) kinds.push(i < 6 ? 'sunny' : POWER_KINDS[int(w.rng, 0, 4)]);
    scatterKernels(w, kinds, poi.x, poi.y, 0, 1, 0.1, null);
    w.events.push({ type: 'explode', x: poi.x, y: poi.y, r: 50 });
  } else if (poi.kind === 'rescue') {
    giveKernels(w, 'sunny', 6);
    giveKernels(w, 'sweetie', 2);
    w.events.push({ type: 'combo', name: 'Rescue!', x: poi.x, y: poi.y });
  } else if (poi.kind === 'stalk') {
    giveKernels(w, 'gem', 1);
    w.events.push({ type: 'combo', name: 'Golden Stalk', x: poi.x, y: poi.y });
  }
}

function updatePois(w: World): void {
  const p = w.player;
  for (const poi of w.pois) {
    if (poi.used) continue;
    poi.timer -= DT;
    if (poi.kind === 'patch' && poi.power && poi.timer <= 0) {
      poi.timer = 4;
      poi.stock = Math.min(4, poi.stock + 1);
    }
    const near = Math.hypot(p.x - poi.x, p.y - poi.y) < p.r + 36;
    if (!near) continue;
    if (poi.kind === 'patch' && poi.power && poi.stock > 0) {
      giveKernels(w, poi.power, poi.stock);
      poi.stock = 0;
    } else if (poi.kind === 'sprinkler' && poi.timer <= 0) {
      poi.timer = 2;
      giveKernels(w, 'sunny', 1);
    } else if (poi.kind === 'shrine' && w.deals.length === 0 && w.earUps.length === 0 && p.kernels.sunny >= 10) {
      poi.used = true;
      w.deals.push({
        title: 'Salt Shaker',
        choices: [
          { icon: '🌶️', name: 'Spicy', blurb: 'Give 10 Sunny', pay: 'sunny', payN: 10, gain: 'spicy', gainN: 1 },
          { icon: '💧', name: 'Soggy', blurb: 'Give 10 Sunny', pay: 'sunny', payN: 10, gain: 'soggy', gainN: 2 },
        ],
      });
    }
  }
}

function updatePlants(w: World): void {
  const keep: Plant[] = [];
  for (const plant of w.plants) {
    plant.ttl -= DT;
    plant.cd -= DT;
    if (plant.cd <= 0) {
      plant.cd = plant.every;
      let best: Enemy | null = null;
      let bestD = Infinity;
      for (const e of w.enemies) {
        const d = Math.hypot(e.x - plant.x, e.y - plant.y);
        if (d < bestD && d < shotRange(w)) {
          bestD = d;
          best = e;
        }
      }
      if (best && total(best.kernels) + best.popHp > 0) {
        const d = bestD || 1;
        launchShot(w, {
          kind: 'sprout',
          attack: 'zinger',
          mul: plant.mul,
          dx: (best.x - plant.x) / d,
          dy: (best.y - plant.y) / d,
          target: best,
          rangeMul: 0.7,
          bounces: 0,
          boomerang: false,
          seed: true,
          x: plant.x,
          y: plant.y,
        });
      }
    }
    if (plant.ttl > 0) keep.push(plant);
    else dropFired(w, 'sprout', plant.x, plant.y, w.player.id);
  }
  w.plants = keep;
}

function updateBooms(w: World): void {
  const keep: Boom[] = [];
  for (const boom of w.booms) {
    boom.ttl -= DT;
    if (boom.ttl <= 0) {
      w.events.push({ type: 'explode', x: boom.x, y: boom.y, r: boom.r });
      for (const e of [...w.enemies]) {
        if (Math.hypot(e.x - boom.x, e.y - boom.y) < boom.r + e.r) hitEnemy(w, e, 'pop', boom.damage, boom.x, boom.y, 'popper', 'popper');
      }
      continue;
    }
    keep.push(boom);
  }
  w.booms = keep;
}

function updateBarriers(w: World): void {
  for (const b of w.barriers) b.ttl -= DT;
  w.barriers = w.barriers.filter((b) => b.ttl > 0);
}

function runEvents(w: World): void {
  if (w.harvestSeconds > 0 && !w.kingSpawned && w.tick * DT >= w.harvestSeconds) {
    w.kingSpawned = true;
    spawnKing(w);
    w.events.push({ type: 'harvest' });
  }
  if (w.tick < w.nextEvent || w.kingSpawned) return;
  w.nextEvent = w.tick + EVENT_GAP;
  const which = w.eventStep % 4;
  w.eventStep++;
  if (which === 0) spawnSwarm(w);
  else if (which === 1 && w.difficulty !== 'easy') spawnCrows(w);
  else if (which === 2) spawnHarvey(w);
  else spawnMiniBoss(w);
}

function spawnSwarm(w: World): void {
  const p = w.player;
  const n = Math.min(28, Math.max(0, w.tuning.maxEnemies - w.enemies.length));
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    const d = viewRadius(p) * 1.4;
    spawnEnemy(w, 'nibbler', kernelsOf({ sunny: 1 }), p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
  }
  w.events.push({ type: 'combo', name: 'Kernel Swarm', x: p.x, y: p.y });
}

function spawnCrows(w: World): void {
  const p = w.player;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    spawnEnemy(w, 'crow', emptyKernels(), p.x + Math.cos(a) * 280, p.y + Math.sin(a) * 280, false, { popHp: 3, popMax: 3 });
  }
  w.events.push({ type: 'combo', name: 'Crow Raid', x: p.x, y: p.y });
}

function spawnHarvey(w: World): void {
  const p = w.player;
  spawnEnemy(w, 'harvey', emptyKernels(), p.x - viewRadius(p) * 1.6, p.y, false, { popHp: 24, popMax: 24 });
  w.events.push({ type: 'combo', name: 'Harvey!', x: p.x, y: p.y });
}

function spawnMiniBoss(w: World): void {
  const p = w.player;
  const steve = w.eventStep % 8 < 4;
  if (steve) {
    spawnEnemy(w, 'steve', emptyKernels(), p.x + 220, p.y - 80, false, { popHp: 16, popMax: 16 });
    w.events.push({ type: 'combo', name: 'Scarecrow Steve', x: p.x, y: p.y });
  } else {
    spawnEnemy(w, 'butter', emptyKernels(), p.x - 200, p.y + 60, false, { popHp: 14, popMax: 14 });
    w.events.push({ type: 'combo', name: 'Butter Knight', x: p.x, y: p.y });
  }
}

function spawnKing(w: World): void {
  const p = w.player;
  const n = Math.max(40, Math.round(total(p.kernels) * 1.8));
  const kernels = emptyKernels();
  kernels.soggy = Math.round(n * 0.7);
  kernels.sunny = n - kernels.soggy;
  const a = Math.atan2(p.facingY, p.facingX || 1);
  const e = spawnEnemy(w, 'king', kernels, p.x + Math.cos(a) * viewRadius(p) * 1.3, p.y + Math.sin(a) * viewRadius(p) * 1.3);
  e.king = true;
  e.kingStart = n;
  e.kingPhase = 0;
}