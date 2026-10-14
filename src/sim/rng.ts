/** Seeded mulberry32 RNG. State is a plain number so it can be snapshotted. */
export interface Rng {
  state: number;
}

export function makeRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + next(rng) * (max - min);
}

export function int(rng: Rng, min: number, maxInclusive: number): number {
  return Math.floor(range(rng, min, maxInclusive + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return next(rng) < p;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let roll = next(rng) * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Stable hash used to derive per-chunk seeds independent of visit order. */
export function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
