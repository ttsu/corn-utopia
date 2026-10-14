import { KERNEL_KINDS, KERNELS, type DamageType, type KernelKind, type PlainKind } from './kernels';
import { pickWeighted, type Rng } from './rng';

/** Every cob (player or enemy) is just a count of kernels per type. */
export type Kernels = Record<KernelKind, number>;

export function emptyKernels(): Kernels {
  return { sunny: 0, soggy: 0, stony: 0, zinger: 0, spicy: 0, popper: 0, frosty: 0 };
}

export function kernelsOf(partial: Partial<Kernels>): Kernels {
  return { ...emptyKernels(), ...partial };
}

export function total(k: Kernels): number {
  let n = 0;
  for (const kind of KERNEL_KINDS) n += k[kind];
  return n;
}

export function addAll(into: Kernels, from: Kernels): void {
  for (const kind of KERNEL_KINDS) into[kind] += from[kind];
}

/** The chomp rule: you can chomp any cob with fewer kernels than you. */
export function canChomp(chomper: Kernels, target: Kernels): boolean {
  return total(target) < total(chomper);
}

export function powerScore(k: Kernels): number {
  let p = 0;
  for (const kind of KERNEL_KINDS) p += k[kind] * KERNELS[kind].powerWeight;
  return p;
}

/** Plain kernel type making up the largest share, used for tint and shield badges. */
export function dominantPlain(k: Kernels): PlainKind {
  let best: PlainKind = 'sunny';
  if (k.soggy > k[best]) best = 'soggy';
  if (k.stony > k[best]) best = 'stony';
  return best;
}

/** Damage types that most (>= threshold share) of this cob's kernels are immune to. */
export function shieldBadges(k: Kernels, threshold = 0.5): DamageType[] {
  const n = total(k);
  if (n === 0) return [];
  const out: DamageType[] = [];
  for (const dmg of ['bonk', 'fire', 'pop'] as DamageType[]) {
    let immune = 0;
    for (const kind of KERNEL_KINDS) if (KERNELS[kind].resist[dmg] === 'immune') immune += k[kind];
    if (immune / n >= threshold) out.push(dmg);
  }
  return out;
}

/** Kernels a hit of this damage type could knock off (everything not immune to it). */
export function knockable(k: Kernels, damage: DamageType): number {
  let n = 0;
  for (const kind of KERNEL_KINDS) if (KERNELS[kind].resist[damage] !== 'immune') n += k[kind];
  return n;
}

export interface HitResult {
  removed: KernelKind[];
  /** True when at least one point of damage was fully resisted (tink!). */
  resisted: boolean;
  /** True when a weak-spot kernel was hit (x2). */
  weak: boolean;
}

export interface HitOptions {
  /** Ignore resistances when only one kernel is left (the Heart Kernel always pops). */
  heartIgnoresResist?: boolean;
}

/**
 * Knock `amount` kernels off a cob with one damage type. Each point picks a random
 * non-immune kernel, weighted toward common kernels. Weak kernels lose 2 per point.
 */
export function applyHit(k: Kernels, damage: DamageType, amount: number, rng: Rng, opts: HitOptions = {}): HitResult {
  const result: HitResult = { removed: [], resisted: false, weak: false };
  for (let i = 0; i < amount; i++) {
    const n = total(k);
    if (n === 0) break;
    const ignoreResist = opts.heartIgnoresResist === true && n === 1;
    const pick = pickWeighted(rng, KERNEL_KINDS, (kind) => {
      if (k[kind] <= 0) return 0;
      if (!ignoreResist && KERNELS[kind].resist[damage] === 'immune') return 0;
      return k[kind] * KERNELS[kind].knockWeight;
    });
    if (pick === undefined) {
      result.resisted = true;
      break;
    }
    const isWeak = !ignoreResist && KERNELS[pick].resist[damage] === 'weak';
    const count = Math.min(k[pick], isWeak ? 2 : 1);
    if (isWeak) result.weak = true;
    k[pick] -= count;
    for (let c = 0; c < count; c++) result.removed.push(pick);
  }
  return result;
}
