import { Graphics, type Application, type Texture } from 'pixi.js';
import { decorForChunk, type FarmProp } from './sim/farm';
import { dominantPlain, total, type Kernels } from './sim/cob';
import { KERNELS, PLAIN_KINDS, type KernelKind, type PlainKind } from './sim/kernels';
import { CHUNK_SIZE } from './sim/world';

const INK = 0x2b2b2b;
const WHITE = 0xffffff;
export const TEX_R = 32;

const hex = (css: string) => parseInt(css.slice(1), 16);

export const KERNEL_COLOR = Object.fromEntries(Object.entries(KERNELS).map(([k, d]) => [k, hex(d.color)])) as Record<
  KernelKind,
  number
>;

const BODY: Record<PlainKind, number> = { sunny: 0xffe08a, soggy: 0x7fd8cf, stony: 0xc5ced6 };
const HUSK = 0x3f8f2a;
const HUSK_DARK = 0x2f6b1c;

export interface ArtTextures {
  kernels: Record<KernelKind, Texture>;
  dot: Texture;
  square: Texture;
}

export function makeArtTextures(app: Application): ArtTextures {
  const bake = (draw: (g: Graphics) => void): Texture => {
    const g = new Graphics();
    draw(g);
    const tex = app.renderer.generateTexture({ target: g, resolution: 2, antialias: true });
    g.destroy();
    return tex;
  };
  const kernels = {} as Record<KernelKind, Texture>;
  for (const kind of Object.keys(KERNELS) as KernelKind[]) {
    kernels[kind] = bake((g) => drawKernel(g, kind));
  }
  return {
    kernels,
    dot: bake((g) => g.circle(0, 0, TEX_R).fill(WHITE)),
    square: bake((g) => g.rect(-TEX_R, -TEX_R, TEX_R * 2, TEX_R * 2).fill(WHITE)),
  };
}

function eyes(g: Graphics, y: number, r: number, spread: number, pupil = 0.42): void {
  const er = r * 0.16;
  for (const side of [-1, 1]) {
    const ex = side * r * spread;
    g.circle(ex, y, er).fill(WHITE).stroke({ width: r * 0.045, color: INK });
    g.circle(ex, y + er * 0.05, er * pupil).fill(INK);
  }
}

function smile(g: Graphics, y: number, r: number, frown = false): void {
  const w = r * 0.55;
  const h = r * 0.22 * (frown ? -1 : 1);
  g.moveTo(-w / 2, y);
  for (let i = 1; i <= 6; i++) {
    const t = i / 6;
    g.lineTo(-w / 2 + t * w, y + Math.sin(t * Math.PI) * h);
  }
  g.stroke({ width: r * 0.07, color: INK, cap: 'round' });
}

/** A kernel you can tell apart by color, shape, and a tiny face. */
function drawKernel(g: Graphics, kind: KernelKind): void {
  const R = TEX_R;
  const color = KERNEL_COLOR[kind];
  const ink = Math.max(2, R * 0.08);
  if (kind === 'stony') {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
      pts.push(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.9);
    }
    g.poly(pts, true).fill(color).stroke({ width: ink, color: INK, join: 'round' });
    g.moveTo(-R * 0.15, -R * 0.35).lineTo(R * 0.05, R * 0.05).lineTo(-R * 0.02, R * 0.4).stroke({ width: ink * 0.7, color: 0x6d7580 });
  } else if (kind === 'popper') {
    g.circle(-R * 0.28, R * 0.08, R * 0.48).fill(color);
    g.circle(R * 0.3, R * 0.1, R * 0.46).fill(color);
    g.circle(0, -R * 0.22, R * 0.5).fill(color).stroke({ width: ink, color: INK });
    g.circle(-R * 0.28, R * 0.08, R * 0.48).stroke({ width: ink * 0.6, color: INK });
    g.circle(R * 0.3, R * 0.1, R * 0.46).stroke({ width: ink * 0.6, color: INK });
  } else {
    g.circle(0, 0, R * 0.9).fill(color).stroke({ width: ink, color: INK });
  }
  if (kind === 'soggy') g.ellipse(0, -R * 0.35, R * 0.28, R * 0.18).fill({ color: WHITE, alpha: 0.55 });
  if (kind === 'zinger') {
    g.poly([0, -R * 0.95, R * 0.28, -R * 0.35, -R * 0.28, -R * 0.35], true).fill(0xfff3b0).stroke({ width: ink * 0.6, color: INK });
  }
  if (kind === 'spicy') {
    g.poly([0, -R * 1.02, R * 0.22, -R * 0.45, 0, -R * 0.62, -R * 0.22, -R * 0.45], true).fill(0xffb703).stroke({ width: ink * 0.55, color: 0xc4450a });
  }
  if (kind === 'frosty') {
    g.poly([0, -R * 1.05, R * 0.2, -R * 0.58, 0, -R * 0.72, -R * 0.2, -R * 0.58], true)
      .fill(0xf4fbff)
      .stroke({ width: ink * 0.5, color: 0x2f6f99 });
  }
  const excited = kind === 'zinger' || kind === 'spicy' || kind === 'popper' || kind === 'frosty';
  eyes(g, excited ? -R * 0.02 : -R * 0.08, R, 0.34, excited ? 0.34 : 0.46);
  smile(g, R * 0.32, R, kind === 'stony');
}

export interface CobDraw {
  x: number;
  y: number;
  r: number;
  kernels: Kernels;
  /** Empty sockets to show when this is the player. 0 draws only real kernels. */
  sockets: number;
  angle: number;
  time: number;
  id: number;
  flash: boolean;
}

type Rot = (lx: number, ly: number) => [number, number];

function rotator(x: number, y: number, angle: number): Rot {
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  return (lx, ly) => [x + lx * co - ly * si, y + lx * si + ly * co];
}

/** Push a local point out from the cob's center so a stroke sits just outside the shape. */
function outward(lx: number, ly: number, pad: number): [number, number] {
  const d = Math.hypot(lx, ly) || 1;
  return [lx + (lx / d) * pad, ly + (ly / d) * pad];
}

function leafPts(rot: Rot, r: number, side: number, pad: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const ly = r * (0.1 + t * 0.95);
    const lx = side * r * (0.15 + Math.sin(t * Math.PI) * 0.55);
    const [ox, oy] = outward(lx, ly, pad);
    pts.push(...rot(ox, oy));
  }
  const [bx, by] = outward(side * r * 0.05, r * 0.2, pad);
  pts.push(...rot(bx, by));
  return pts;
}

function bodyPts(rot: Rot, r: number, time: number, id: number, pad: number): number[] {
  const rx = r * 0.62;
  const ry = r * 0.98;
  const wob = time * 2 + id;
  const pts: number[] = [];
  const N = 24;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lx = Math.cos(a) * (rx + Math.sin(a * 5 + wob) * rx * 0.045);
    const ly = Math.sin(a) * (ry + Math.cos(a * 3 + wob) * ry * 0.03);
    const [ox, oy] = outward(lx, ly, pad);
    pts.push(...rot(ox, oy));
  }
  return pts;
}

/** Dashes that crawl along the husk and the body. `dash` and `gap` are world-space lengths. */
export function dashCobOutline(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  angle: number,
  time: number,
  id: number,
  color: number,
  width: number,
  alpha: number,
  pad: number,
  dash: number,
  gap: number,
  spin = 0,
): void {
  const rot = rotator(x, y, angle);
  dashClosed(g, leafPts(rot, r, -1, pad), dash, gap, spin);
  dashClosed(g, leafPts(rot, r, 1, pad), dash, gap, spin);
  dashClosed(g, bodyPts(rot, r, time, id, pad), dash, gap, spin);
  g.stroke({ width, color, alpha, join: 'round', cap: 'round' });
}

/** Walk a closed polygon and leave dash subpaths. One stroke() after all loops. */
function dashClosed(g: Graphics, pts: number[], dash: number, gap: number, spin: number): void {
  const n = pts.length / 2;
  if (n < 3) return;
  const lens: number[] = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const len = Math.hypot(pts[j * 2]! - pts[i * 2]!, pts[j * 2 + 1]! - pts[i * 2 + 1]!);
    lens[i] = len;
    total += len;
  }
  if (!(total > 1)) return;
  const period = Math.max(1, dash + gap);
  const phase = ((spin % period) + period) % period;
  const on = (d: number) => {
    const u = (((d - phase) % period) + period) % period;
    return u < dash;
  };
  const at = (d: number): [number, number] => {
    let rem = d >= total ? 0 : d;
    for (let i = 0; i < n; i++) {
      if (rem <= lens[i]! || i === n - 1) {
        const t = lens[i]! > 0 ? Math.min(1, rem / lens[i]!) : 0;
        const j = (i + 1) % n;
        return [
          pts[i * 2]! + (pts[j * 2]! - pts[i * 2]!) * t,
          pts[i * 2 + 1]! + (pts[j * 2 + 1]! - pts[i * 2 + 1]!) * t,
        ];
      }
      rem -= lens[i]!;
    }
    return [pts[0]!, pts[1]!];
  };

  const step = Math.max(1.25, Math.min(dash / 3, 4));
  let drawing = false;
  for (let d = 0; d <= total; d += step) {
    const dd = Math.min(d, total);
    const here = dd === total ? 0 : dd;
    if (on(here)) {
      const [px, py] = at(here);
      if (!drawing) g.moveTo(px, py);
      else g.lineTo(px, py);
      drawing = true;
    } else {
      drawing = false;
    }
  }
}

/** Status color that follows the husk and the oblong body, instead of a circle. */
export function strokeCobOutline(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  angle: number,
  time: number,
  id: number,
  color: number,
  width: number,
  alpha = 1,
  pad = 0,
): void {
  const rot = rotator(x, y, angle);
  const style = { width, color, alpha, join: 'round' as const, cap: 'round' as const };
  g.poly(leafPts(rot, r, -1, pad), true).stroke(style);
  g.poly(leafPts(rot, r, 1, pad), true).stroke(style);
  g.poly(bodyPts(rot, r, time, id, pad), true).stroke(style);
}

/** Icy wash in the shape of the cob body. */
export function fillCobBody(
  g: Graphics,
  x: number,
  y: number,
  r: number,
  angle: number,
  time: number,
  id: number,
  color: number,
  alpha: number,
): void {
  g.poly(bodyPts(rotator(x, y, angle), r, time, id, 0), true).fill({ color, alpha });
}

/** Flat cutout cob: husk, body tinted by its kernels, thick wobbly ink. */
export function drawCobShell(g: Graphics, c: CobDraw): { primary: PlainKind; secondary: PlainKind | null } {
  const { x, y, r, angle, time, id, flash } = c;
  const primary = dominantPlain(c.kernels);
  const n = total(c.kernels) || 1;
  let secondary: PlainKind | null = null;
  for (const kind of PLAIN_KINDS) {
    if (kind !== primary && c.kernels[kind] / n >= 0.3) secondary = kind;
  }
  const rot = rotator(x, y, angle);
  const leaf = (side: number) => {
    g.poly(leafPts(rot, r, side, 0), true).fill(side < 0 ? HUSK_DARK : HUSK).stroke({ width: Math.max(2, r * 0.05), color: INK });
  };
  const [sx, sy] = rot(0, r * 0.85);
  g.ellipse(sx, sy, r * 0.7, r * 0.22).fill({ color: 0x000000, alpha: 0.16 });
  leaf(-1);
  leaf(1);

  g.poly(bodyPts(rot, r, time, id, 0), true)
    .fill(flash ? WHITE : BODY[primary])
    .stroke({ width: Math.max(2.5, r * 0.075), color: INK, join: 'round' });

  if (primary === 'soggy' || secondary === 'soggy') {
    for (const side of [-0.28, 0.22]) {
      const [dx, dy] = rot(r * side, r * 0.72);
      g.ellipse(dx, dy, r * 0.08, r * 0.16).fill(0x2ec4b6).stroke({ width: Math.max(1.5, r * 0.03), color: INK });
    }
  }
  if (primary === 'stony' || secondary === 'stony') {
    const crack: number[] = [];
    for (const [lx, ly] of [
      [-0.2, -0.4],
      [0.05, -0.05],
      [-0.08, 0.35],
    ]) {
      crack.push(...rot(r * lx, r * ly));
    }
    g.poly(crack).stroke({ width: Math.max(1.5, r * 0.035), color: 0x6d7580 });
  }
  return { primary, secondary };
}

/** Frost and popcorn bits from the power kernels on this cob. */
export function drawFlair(g: Graphics, c: CobDraw): void {
  const { x, y, r, angle, time, kernels } = c;
  const rot = (lx: number, ly: number): [number, number] => {
    const co = Math.cos(angle);
    const si = Math.sin(angle);
    return [x + lx * co - ly * si, y + lx * si + ly * co];
  };
  const ink = Math.max(1.5, r * 0.04);
  if (kernels.frosty > 0) {
    for (const side of [-1, 1]) {
      const [ix, iy] = rot(side * r * 0.48, r * 0.05);
      g.poly([ix, iy - r * 0.28, ix + side * r * 0.1, iy + r * 0.02, ix - side * r * 0.02, iy + r * 0.02], true)
        .fill(0xd7f3ff)
        .stroke({ width: ink, color: 0x2f6f99 });
    }
  }
  if (kernels.popper > 0 && Math.sin(time * 6 + c.id) > 0.35) {
    const [px, py] = rot(r * 0.55, -r * 0.2);
    g.circle(px, py, r * 0.1).fill(0xfff8e7).stroke({ width: ink, color: INK });
  }
}

export type Mood = 'happy' | 'angry' | 'worried' | 'surprised' | 'smug' | 'determined' | 'chewing' | 'asleep';

/** Big face on the cob, above the kernels. */
export function drawFace(g: Graphics, x: number, y: number, r: number, angle: number, lookX: number, lookY: number, mood: Mood): void {
  const co = Math.cos(angle);
  const si = Math.sin(angle);
  const rot = (lx: number, ly: number): [number, number] => [x + lx * co - ly * si, y + lx * si + ly * co];
  const er = Math.max(2.4, r * (mood === 'surprised' ? 0.26 : 0.22));
  const m = Math.hypot(lookX, lookY) || 1;
  const px = (lookX / m) * er * 0.38;
  const py = (lookY / m) * er * 0.38;
  for (const side of [-1, 1]) {
    const [ex, ey] = rot(side * r * 0.3, -r * 0.18);
    if (mood === 'asleep') {
      g.moveTo(ex - er, ey).quadraticCurveTo(ex, ey + er * 0.9, ex + er, ey).stroke({ width: Math.max(1.5, er * 0.28), color: INK, cap: 'round' });
      continue;
    }
    const ry = mood === 'smug' ? er * 0.55 : er;
    g.ellipse(ex, ey, er, ry).fill(WHITE).stroke({ width: Math.max(1.5, er * 0.16), color: INK });
    g.circle(ex + px, ey + py + (mood === 'smug' ? ry * 0.2 : 0), er * (mood === 'surprised' ? 0.32 : 0.48)).fill(INK);
    if (mood === 'angry' || mood === 'worried' || mood === 'determined') {
      const tilt = mood === 'worried' ? -1 : 1;
      const [x1, y1] = rot(side * r * 0.3 - side * er, -r * 0.18 - er * 1.35 - tilt * er * 0.35);
      const [x2, y2] = rot(side * r * 0.3 + side * er, -r * 0.18 - er * 1.35 + tilt * er * 0.45);
      g.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: Math.max(1.5, er * 0.28), color: INK, cap: 'round' });
    }
  }
  const [mx, my] = rot(0, r * 0.22);
  const mw = r * 0.42;
  const frown = mood === 'angry';
  const open = mood === 'surprised' || mood === 'chewing';
  if (mood === 'asleep') return;
  if (open) {
    g.ellipse(mx, my, mw * 0.38, mood === 'chewing' ? r * 0.16 : r * 0.12).fill(0x3a2a22).stroke({ width: Math.max(1.5, r * 0.04), color: INK });
    return;
  }
  const h = (mood === 'worried' ? 0.5 : 1) * r * 0.16 * (frown ? -1 : 1);
  const [ax, ay] = rot(-mw / 2, r * 0.22);
  g.moveTo(ax, ay);
  for (let i = 1; i <= 7; i++) {
    const t = i / 7;
    const [qx, qy] = rot(-mw / 2 + mw * t, r * 0.22 + Math.sin(t * Math.PI) * h);
    g.lineTo(qx, qy);
  }
  g.stroke({ width: Math.max(1.5, r * 0.055), color: INK, cap: 'round' });
}

export function drawFarm(
  g: Graphics,
  seed: number,
  props: readonly FarmProp[],
  left: number,
  top: number,
  right: number,
  bottom: number,
): void {
  const x0 = Math.floor(left / CHUNK_SIZE) - 1;
  const x1 = Math.floor(right / CHUNK_SIZE) + 1;
  const y0 = Math.floor(top / CHUNK_SIZE) - 1;
  const y1 = Math.floor(bottom / CHUNK_SIZE) + 1;
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      for (const d of decorForChunk(seed, cx, cy, CHUNK_SIZE)) {
        if (d.x < left - 80 || d.x > right + 80 || d.y < top - 80 || d.y > bottom + 80) continue;
        if (d.kind === 'dirt') {
          g.ellipse(d.x, d.y, d.r, d.r * 0.62).fill({ color: 0xc4a574, alpha: 0.45 });
        } else if (d.kind === 'flower') {
          g.moveTo(d.x, d.y).lineTo(d.x, d.y - d.r).stroke({ width: 2, color: HUSK_DARK });
          g.circle(d.x, d.y - d.r, 4).fill(d.spin > 1.5 ? 0xffd23f : 0xff8fab).stroke({ width: 1.5, color: INK });
        } else {
          const h = d.r;
          g.moveTo(d.x, d.y)
            .lineTo(d.x - 4, d.y - h)
            .moveTo(d.x, d.y)
            .lineTo(d.x + 1, d.y - h * 1.15)
            .moveTo(d.x, d.y)
            .lineTo(d.x + 5, d.y - h * 0.85)
            .stroke({ width: 2, color: 0x3d7a28, cap: 'round' });
        }
      }
    }
  }
  const piled = [...props].sort((a, b) => b.y - a.y);
  for (const p of piled) {
    if (p.x < left - p.r || p.x > right + p.r || p.y < top - p.r || p.y > bottom + p.r) continue;
    if (p.kind === 'mud') {
      g.ellipse(p.x, p.y, p.r, p.r * 0.72).fill(0x8d6b4a).stroke({ width: 3, color: 0x6b4f34 });
      g.ellipse(p.x - p.r * 0.2, p.y - p.r * 0.15, p.r * 0.35, p.r * 0.16).fill({ color: WHITE, alpha: 0.25 });
    } else {
      g.roundRect(p.x - p.r, p.y - p.r * 0.62, p.r * 2, p.r * 1.24, p.r * 0.25)
        .fill(0xf0d264)
        .stroke({ width: Math.max(3, p.r * 0.08), color: INK });
      g.moveTo(p.x - p.r * 0.7, p.y - p.r * 0.28)
        .lineTo(p.x + p.r * 0.7, p.y - p.r * 0.28)
        .moveTo(p.x - p.r * 0.7, p.y + p.r * 0.22)
        .lineTo(p.x + p.r * 0.7, p.y + p.r * 0.22)
        .stroke({ width: 2, color: 0xc4a035 });
    }
  }
}
