/**
 * How kernels sit on a cob, in units of the cob's radius.
 * The ear is an oval, narrower at the tip. Kernels on it are horizontal
 * ovals, packed in rows that follow that curve.
 */

/** Half-width and half-height of the oval ear. Negative y is the tip. */
export const BODY_RX = 0.62;
export const BODY_RY = 0.98;

/** Height / width of a kernel while it is attached. Below 1 means horizontal. */
export const COB_KERNEL_ASPECT = 0.64;

/**
 * Sprites are drawn a little bigger than their slots so neighboring ovals
 * overlap and the cob color doesn't show between kernels.
 */
export const COB_KERNEL_DRAW_SCALE = 1.2;

const slotCache = new Map<number, Float32Array>();

/** Half-width of the oval ear at local y. The tip (negative y) narrows. */
export function cobHalfWidth(y: number, margin = 0): number {
  const ry = BODY_RY - margin;
  const rx = BODY_RX - margin;
  if (ry <= 0 || rx <= 0) return 0;
  const ny = y / ry;
  if (ny <= -1 || ny >= 1) return 0;
  // A plain oval. The tip is a little narrower than the base, like an ear.
  const ellipse = Math.sqrt(Math.max(0, 1 - ny * ny));
  const taper = ny < 0 ? 1 + ny * 0.08 : 1;
  return rx * ellipse * taper;
}

/** True when a point lies inside the oval ear, optionally shrunk by `margin`. */
export function insideCobBody(x: number, y: number, margin = 0): boolean {
  return Math.abs(x) <= cobHalfWidth(y, margin) + 1e-4;
}

/** Local outline of the oval ear, in units of r, starting at the tip and going clockwise. */
export function cobBodyLocal(steps = 18): Array<[number, number]> {
  const right: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const y = -BODY_RY + (i / steps) * 2 * BODY_RY;
    right.push([cobHalfWidth(y), y]);
  }
  const pts = right.slice();
  for (let i = right.length - 2; i > 0; i--) pts.push([-right[i][0], right[i][1]]);
  return pts;
}

interface Row {
  y: number;
  count: number;
  stagger: boolean;
}

function rowsForWidth(w: number): Row[] {
  const h = w * COB_KERNEL_ASPECT;
  const drawHalfH = (h * COB_KERNEL_DRAW_SCALE) / 2;
  const drawHalfW = (w * COB_KERNEL_DRAW_SCALE) / 2;
  const rows: Row[] = [];
  if (h <= 0.01) return rows;
  const span = BODY_RY * 1.72;
  const rowCount = Math.max(1, Math.floor(span / h));
  const y0 = -((rowCount - 1) * h) / 2;
  for (let row = 0; row < rowCount; row++) {
    const y = y0 + row * h;
    const half = Math.min(cobHalfWidth(y - drawHalfH, 0.03), cobHalfWidth(y + drawHalfH, 0.03), cobHalfWidth(y, 0.03));
    if (half < drawHalfW * 0.85) continue;
    const stagger = row % 2 === 1;
    let k = 1;
    for (let tryK = 1; tryK <= 16; tryK++) {
      const extra = stagger && tryK > 1 ? w / 4 : 0;
      const extent = ((tryK - 1) * w) / 2 + drawHalfW + extra;
      if (extent <= half + 1e-4) k = tryK;
      else break;
    }
    rows.push({ y, count: k, stagger: stagger && k > 1 });
  }
  return rows;
}

function placeRows(rows: readonly Row[], w: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (const row of rows) {
    if (row.count < 1) continue;
    const centerFix = row.stagger ? -w / 4 : 0;
    const shift = row.stagger ? w / 2 : 0;
    const left = -((row.count - 1) * w) / 2 + shift + centerFix;
    for (let col = 0; col < row.count; col++) pts.push([left + col * w, row.y]);
  }
  pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return pts;
}

/**
 * Kernel slots in cob-local units of r, ordered tip-to-base.
 * Each record is x, y, halfWidth. Height is halfWidth * COB_KERNEL_ASPECT.
 * Rows follow the oval, and odd rows nest by half a kernel.
 */
export function cobKernelSlots(count: number): Float32Array {
  const n = Math.max(1, Math.floor(count));
  const cached = slotCache.get(n);
  if (cached) return cached;

  let lo = 0.025;
  let hi = 0.48;
  let bestW = lo;
  let bestRows = rowsForWidth(lo);
  for (let iter = 0; iter < 16; iter++) {
    const mid = (lo + hi) / 2;
    const rows = rowsForWidth(mid);
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    if (total >= n) {
      bestW = mid;
      bestRows = rows;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  let rows = bestRows.map((row) => ({ ...row }));
  let total = rows.reduce((sum, row) => sum + row.count, 0);
  // Drop extra kernels from the short tip rows so the wide middle rows stay full.
  while (total > n) {
    let pick = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].count < 1) continue;
      if (
        pick < 0 ||
        rows[i].count < rows[pick].count ||
        (rows[i].count === rows[pick].count && Math.abs(rows[i].y) > Math.abs(rows[pick].y))
      ) {
        pick = i;
      }
    }
    if (pick < 0) break;
    rows[pick].count--;
    total--;
  }
  rows = rows.filter((row) => row.count > 0);
  const kernelH = bestW * COB_KERNEL_ASPECT;
  const y0 = -((rows.length - 1) * kernelH) / 2;
  rows.forEach((row, i) => {
    row.y = y0 + i * kernelH;
    row.stagger = i % 2 === 1 && row.count > 1;
  });

  let pts = placeRows(rows, bestW);
  if (pts.length < n) {
    const h = bestW * COB_KERNEL_ASPECT;
    while (pts.length < n) {
      const y = pts.length ? pts[pts.length - 1][1] + h : 0;
      pts.push([0, y]);
    }
  }
  pts = pts.slice(0, n);

  let fit = 1;
  const drawn = (s: number) => {
    const hw = ((bestW * s) / 2) * COB_KERNEL_DRAW_SCALE;
    const hh = hw * COB_KERNEL_ASPECT;
    return pts.every(([x, y]) => {
      const px = x * s;
      const py = y * s;
      return insideCobBody(px - hw, py - hh) && insideCobBody(px + hw, py - hh) && insideCobBody(px - hw, py + hh) && insideCobBody(px + hw, py + hh);
    });
  };
  if (!drawn(1)) {
    let lo = 0.8;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (drawn(mid)) lo = mid;
      else hi = mid;
    }
    fit = lo;
  }

  const halfW = (bestW * fit) / 2;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = pts[i][0] * fit;
    out[i * 3 + 1] = pts[i][1] * fit;
    out[i * 3 + 2] = halfW;
  }
  if (slotCache.size > 400) slotCache.clear();
  slotCache.set(n, out);
  return out;
}
