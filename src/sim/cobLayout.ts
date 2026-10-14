/**
 * How kernels sit on a cob, in units of the cob's radius.
 * The body is a vertical rounded rectangle. Kernels on it are horizontal
 * rounded rectangles, packed so neighboring kernels touch.
 */

/** Half-width and half-height of the cob body. */
export const BODY_RX = 0.66;
export const BODY_RY = 0.98;
/** Corner radius of the cob body. */
export const BODY_CORNER = 0.2;

/** Height / width of a kernel while it is attached. Below 1 means horizontal. */
export const COB_KERNEL_ASPECT = 0.56;

/**
 * Sprites are drawn a little bigger than their slots so the rounded corners
 * overlap and the cob color doesn't show between kernels.
 */
export const COB_KERNEL_DRAW_SCALE = 1.14;

/** Kernel block fills the ear, from just under the tip down to the base. */
const FIELD_PAD_X = 0.05;
const FIELD_TOP = -0.42;
const FIELD_BOTTOM = 0.86;

const slotCache = new Map<number, Float32Array>();

/** Local outline of the cob body, in units of r, starting at the top and going clockwise. */
export function cobBodyLocal(steps = 5): Array<[number, number]> {
  const rx = BODY_RX;
  const ry = BODY_RY;
  const rad = Math.min(BODY_CORNER, rx, ry);
  const pts: Array<[number, number]> = [];
  const arc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
  };
  arc(rx - rad, -ry + rad, -Math.PI / 2, 0);
  arc(rx - rad, ry - rad, 0, Math.PI / 2);
  arc(-rx + rad, ry - rad, Math.PI / 2, Math.PI);
  arc(-rx + rad, -ry + rad, Math.PI, (Math.PI * 3) / 2);
  return pts;
}

/** True when a point lies inside the cob body, optionally shrunk by `margin`. */
export function insideCobBody(x: number, y: number, margin = 0): boolean {
  const rx = BODY_RX - margin;
  const ry = BODY_RY - margin;
  if (rx <= 0 || ry <= 0) return false;
  const rad = Math.min(BODY_CORNER, rx, ry);
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax > rx + 1e-6 || ay > ry + 1e-6) return false;
  const ix = rx - rad;
  const iy = ry - rad;
  if (ax <= ix || ay <= iy) return true;
  const dx = ax - ix;
  const dy = ay - iy;
  return dx * dx + dy * dy <= rad * rad + 1e-6;
}

/**
 * Kernel slots in cob-local units of r, ordered tip-to-base.
 * Each record is x, y, halfWidth. Height is halfWidth * COB_KERNEL_ASPECT.
 * Odd rows shift by half a kernel so the rows nest, and kernels touch.
 */
export function cobKernelSlots(count: number): Float32Array {
  const n = Math.max(1, Math.floor(count));
  const cached = slotCache.get(n);
  if (cached) return cached;

  const fieldRx = BODY_RX - FIELD_PAD_X;
  const fieldW = fieldRx * 2;
  const fieldH = FIELD_BOTTOM - FIELD_TOP;
  const aspect = COB_KERNEL_ASPECT;
  // One kernel should not stretch into a plank across the whole ear.
  const maxKernelW = fieldW * 0.72;

  let cols = 1;
  let rows = n;
  let kernelW = 0;
  let best = -1;
  const maxCols = Math.min(n, 16);
  for (let c = 1; c <= maxCols; c++) {
    const r = Math.ceil(n / c);
    const stagger = r > 1 && c > 1 ? 0.5 : 0;
    const w = Math.min(fieldW / (c + stagger), fieldH / (r * aspect), maxKernelW);
    const blockW = (c + stagger) * w;
    const blockH = r * w * aspect;
    let coverage = blockW * blockH;
    if (c === 1 && n >= 3) coverage *= 0.45;
    if (coverage > best) {
      best = coverage;
      cols = c;
      rows = r;
      kernelW = w;
    }
  }

  const kernelH = kernelW * aspect;
  const halfW = kernelW / 2;
  const stagger = rows > 1 && cols > 1;
  const centerFix = stagger ? -kernelW / 4 : 0;
  const pts: [number, number][] = [];
  for (let row = 0; row < rows && pts.length < n; row++) {
    const rowCount = Math.min(cols, n - pts.length);
    const shift = stagger && row % 2 === 1 ? kernelW / 2 : 0;
    const fullLeft = -((cols - 1) * kernelW) / 2 + shift + centerFix;
    const fullRight = fullLeft + (cols - 1) * kernelW;
    const rowCenter = (fullLeft + fullRight) / 2;
    const left = rowCenter - ((rowCount - 1) * kernelW) / 2;
    for (let col = 0; col < rowCount; col++) pts.push([left + col * kernelW, row]);
  }

  const blockH = rows * kernelH;
  const slack = Math.max(0, fieldH - blockH);
  const y0 = FIELD_TOP + kernelH / 2 + slack * 0.45;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = pts[i][0];
    out[i * 3 + 1] = y0 + pts[i][1] * kernelH;
    out[i * 3 + 2] = halfW;
  }
  if (slotCache.size > 400) slotCache.clear();
  slotCache.set(n, out);
  return out;
}
