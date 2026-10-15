import { KERNEL_KINDS, KERNELS, type DamageType, type KernelKind, type PlainKind } from './kernels';
import { pickWeighted, type Rng } from './rng';

/** Kernel counts per type. The order they were picked up is tracked separately. */
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

/** Oldest first. Used when a cob is created from counts and has no pickup history yet. */
export function countsToOrder(kernels: Kernels): KernelKind[] {
  const order: KernelKind[] = [];
  for (const kind of KERNEL_KINDS) {
    for (let n = kernels[kind]; n > 0; n--) order.push(kind);
  }
  return order;
}

/** True when `order` lists exactly the kernels in `kernels`. */
export function orderMatches(order: readonly KernelKind[], kernels: Kernels): boolean {
  if (order.length !== total(kernels)) return false;
  const seen = emptyKernels();
  for (let i = 0; i < order.length; i++) seen[order[i]]++;
  for (const kind of KERNEL_KINDS) if (seen[kind] !== kernels[kind]) return false;
  return true;
}

/**
 * Makes `order` list the same kernels as `kernels`, oldest pickup first.
 * A list that already matches is left alone so pickup order is not regrouped by type.
 */
export function syncKernelOrder(order: KernelKind[], kernels: Kernels): KernelKind[] {
  if (orderMatches(order, kernels)) return order;
  order.length = 0;
  for (const kind of KERNEL_KINDS) {
    for (let n = kernels[kind]; n > 0; n--) order.push(kind);
  }
  return order;
}

/** Drops the most recently picked kernel of each listed kind. Survivors keep their order. */
export function removeLatestKernels(order: KernelKind[], removed: readonly KernelKind[]): void {
  if (removed.length === 0 || order.length === 0) return;
  const need = emptyKernels();
  let left = 0;
  for (const kind of removed) {
    need[kind]++;
    left++;
  }
  for (let i = order.length - 1; i >= 0 && left > 0; i--) {
    const kind = order[i];
    if (need[kind] > 0) {
      need[kind]--;
      left--;
      order.splice(i, 1);
    }
  }
}

/**
 * Slot contents from the tip toward the base: kernels in pickup order
 * (oldest first), then empty sockets. A cob with more kernels than drawn
 * slots is sampled evenly along that order, so kinds stay where they were
 * picked up instead of being grouped by type.
 */
export function arrangedKernels(order: readonly KernelKind[], sockets: number, drawn: number): (KernelKind | null)[] {
  const count = order.length;
  const real = Math.max(sockets, count);
  const n = Math.max(0, Math.min(drawn, real));
  const out: (KernelKind | null)[] = [];
  if (n === 0) return out;
  let kernelSlots = Math.round((count * n) / real);
  if (count > 0) kernelSlots = Math.max(1, kernelSlots);
  kernelSlots = Math.min(count, n, kernelSlots);
  if (kernelSlots >= count) {
    for (let i = 0; i < count; i++) out.push(order[i]);
  } else if (kernelSlots === 1) {
    out.push(order[0]);
  } else {
    for (let i = 0; i < kernelSlots; i++) {
      const idx = Math.round((i * (count - 1)) / (kernelSlots - 1));
      out.push(order[idx]);
    }
  }
  while (out.length < n) out.push(null);
  return out;
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
