import { chance, hash2, int, makeRng, range } from './rng';

export type Biome = 'farm' | 'picnic' | 'kitchen';

/** Sunny Farm, then Picnic Park, then the Kitchen Counter. Later rings wait for M3. */
export function biomeAt(x: number, y: number): Biome {
  const d = Math.hypot(x, y);
  if (d < 4000) return 'farm';
  if (d < 8000) return 'picnic';
  return 'kitchen';
}

export interface FarmProp {
  kind: 'hay' | 'mud' | 'butter' | 'sink';
  x: number;
  y: number;
  r: number;
}

/** Keep the opening snacks clear of bales. Grass and flowers still fill this pocket. */
const CLEAR_RADIUS = 480;

/** Offsets for one haystack, bottom bale first so the pile reads as stacked. */
const HAY_STACK = [
  { ox: 0, oy: 20 },
  { ox: 7, oy: -6 },
  { ox: -5, oy: -32 },
];

/** Hay, mud, butter, and sinks for one chunk. Its own RNG, so it doesn't disturb kernel spawns. */
export function propsForChunk(seed: number, cx: number, cy: number, chunkSize: number): FarmProp[] {
  const biome = biomeAt((cx + 0.5) * chunkSize, (cy + 0.5) * chunkSize);
  const rng = makeRng(hash2(seed, cx + 9176, cy - 4403));
  if (biome === 'picnic') return picnicProps(rng, cx, cy, chunkSize);
  if (biome === 'kitchen') return kitchenProps(rng, cx, cy, chunkSize);
  const props: FarmProp[] = [];
  const clumps = chance(rng, 0.35) ? 2 : 1;
  for (let c = 0; c < clumps; c++) {
    const x = (cx + range(rng, 0.22, 0.78)) * chunkSize;
    const y = (cy + range(rng, 0.22, 0.78)) * chunkSize;
    if (Math.hypot(x, y) < CLEAR_RADIUS) continue;
    const radius = range(rng, 38, 44);
    for (const stack of HAY_STACK) {
      props.push({
        kind: 'hay',
        x: x + stack.ox + range(rng, -3, 3),
        y: y + stack.oy + range(rng, -2, 2),
        r: radius,
      });
    }
  }
  const mudN = int(rng, 0, 2);
  for (let i = 0; i < mudN; i++) {
    const x = (cx + range(rng, 0.2, 0.8)) * chunkSize;
    const y = (cy + range(rng, 0.2, 0.8)) * chunkSize;
    if (Math.hypot(x, y) < CLEAR_RADIUS) continue;
    props.push({ kind: 'mud', x, y, r: range(rng, 36, 64) });
  }
  return props;
}

function picnicProps(rng: ReturnType<typeof makeRng>, cx: number, cy: number, chunkSize: number): FarmProp[] {
  // Blankets are scenery. Ants are the hazard, and they spawn with the director.
  const props: FarmProp[] = [];
  const n = int(rng, 0, 1);
  for (let i = 0; i < n; i++) {
    props.push({
      kind: 'mud',
      x: (cx + range(rng, 0.25, 0.75)) * chunkSize,
      y: (cy + range(rng, 0.25, 0.75)) * chunkSize,
      r: range(rng, 28, 46),
    });
  }
  return props;
}

function kitchenProps(rng: ReturnType<typeof makeRng>, cx: number, cy: number, chunkSize: number): FarmProp[] {
  const props: FarmProp[] = [];
  const butters = int(rng, 1, 2);
  for (let i = 0; i < butters; i++) {
    const x = (cx + range(rng, 0.2, 0.8)) * chunkSize;
    const y = (cy + range(rng, 0.2, 0.8)) * chunkSize;
    if (Math.hypot(x, y) < CLEAR_RADIUS) continue;
    props.push({ kind: 'butter', x, y, r: range(rng, 40, 70) });
  }
  if (chance(rng, 0.55)) {
    const x = (cx + range(rng, 0.3, 0.7)) * chunkSize;
    const y = (cy + range(rng, 0.3, 0.7)) * chunkSize;
    if (Math.hypot(x, y) >= CLEAR_RADIUS) props.push({ kind: 'sink', x, y, r: range(rng, 46, 68) });
  }
  return props;
}

export interface Decor {
  kind: 'grass' | 'dirt' | 'flower';
  x: number;
  y: number;
  r: number;
  spin: number;
}

/** Scenery only: tufts, dirt, and flowers. Not in the simulation. */
export function decorForChunk(seed: number, cx: number, cy: number, chunkSize: number): Decor[] {
  const rng = makeRng(hash2(seed, cx - 88, cy + 2501));
  const out: Decor[] = [];
  const n = int(rng, 5, 9);
  for (let i = 0; i < n; i++) {
    const kind: Decor['kind'] = i % 7 === 0 ? 'flower' : i % 3 === 0 ? 'dirt' : 'grass';
    out.push({
      kind,
      x: (cx + range(rng, 0.05, 0.95)) * chunkSize,
      y: (cy + range(rng, 0.05, 0.95)) * chunkSize,
      r: kind === 'dirt' ? range(rng, 28, 70) : range(rng, 8, 16),
      spin: range(rng, 0, Math.PI),
    });
  }
  return out;
}

/** 1 in open ground, slower in mud, faster in a kitchen butter puddle. */
export function mudSlow(x: number, y: number, props: readonly FarmProp[]): number {
  let slow = 1;
  let boost = 1;
  for (const p of props) {
    if ((x - p.x) ** 2 + (y - p.y) ** 2 >= p.r * p.r) continue;
    if (p.kind === 'mud') slow = Math.min(slow, 0.55);
    if (p.kind === 'butter') boost = Math.max(boost, 1.35);
  }
  return slow * boost;
}

/** A sink splash shoves you out. Returns a velocity to add, in pixels per second. */
export function sinkPush(x: number, y: number, props: readonly FarmProp[]): { x: number; y: number } {
  let px = 0;
  let py = 0;
  for (const p of props) {
    if (p.kind !== 'sink') continue;
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= p.r || d < 1) continue;
    const push = (1 - d / p.r) * 220;
    px += (dx / d) * push;
    py += (dy / d) * push;
  }
  return { x: px, y: py };
}

/** Pushes a circle out of any hay bale it overlaps. Two passes so a shove into a neighbor still resolves. */
export function separateFromHay(x: number, y: number, radius: number, props: readonly FarmProp[]): { x: number; y: number } {
  for (let pass = 0; pass < 2; pass++) {
    for (const p of props) {
      if (p.kind !== 'hay') continue;
      let dx = x - p.x;
      let dy = y - p.y;
      const min = radius + p.r * 0.82;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      if (d < 1e-4) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = min - (d < 1e-4 ? 0 : d);
      x += dx * push;
      y += dy * push;
    }
  }
  return { x, y };
}

/** True when the segment from (x0, y0) to (x1, y1) crosses a hay bale. */
export function segmentHitsHay(x0: number, y0: number, x1: number, y1: number, radius: number, props: readonly FarmProp[]): boolean {
  for (const p of props) {
    if (p.kind !== 'hay') continue;
    const reach = p.r * 0.82 + radius;
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= reach * reach) return true;
    }
  }
  return false;
}
