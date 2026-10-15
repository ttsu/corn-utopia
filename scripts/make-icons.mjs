// Generates the PWA icons (a cute smiling corn cob with husk leaves and kernel rows) with no image dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const ss = 3;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [pr, pg, pb] = pixel((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size);
          r += pr; g += pg; b += pb;
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / (ss * ss);
      raw[o + 1] = g / (ss * ss);
      raw[o + 2] = b / (ss * ss);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

const FIELD = hex('#9fd36b');
const FIELD_GLOW = hex('#bde68c');
const SHADOW = hex('#7ab34b');
const INK = hex('#2b2b2b');
const BODY = hex('#ffe08a');
const BODY_SHADE = hex('#f2c75c');
const KERNEL = hex('#ffd23f');
const KERNEL_HI = hex('#fff2a6');
const KERNEL_SHADE = hex('#e5ac1b');
const HUSK_L = hex('#3a8a26');
const HUSK_R = hex('#4ea635');
const HUSK_HI = hex('#6cc24a');
const HUSK_VEIN = hex('#2a6819');
const SILK = hex('#ffe885');
const SILK_SHADE = hex('#f4bd33');
const WHITE = [255, 255, 255];
const CHEEK = hex('#ff8fab');
const MOUTH_BG = hex('#4a2520');
const TONGUE = hex('#ff758f');

/** Signed distance to a line segment from (ax, ay) to (bx, by). */
function sdSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = clamp(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** Signed distance to the tapered oval cob ear centered at (0, -0.02). */
function cobEarDist(x, y) {
  const cy = y + 0.02;
  const rx = 0.255;
  const ry = 0.36;
  const ny = clamp(cy / ry, -1.2, 1.2);
  // Slightly narrower toward the top tip, plump in the middle/bottom.
  const taper = ny < 0 ? 1 + ny * 0.14 : 1 - ny * 0.04;
  const ex = x / (rx * taper);
  const ey = cy / ry;
  return (Math.hypot(ex, ey) - 1) * Math.min(rx, ry);
}

/** Signed distance to a curved husk leaf on `side` (-1 left, +1 right), plus local coords. */
function leafInfo(x, y, side) {
  const ax = side * 0.04;
  const ay = 0.33;
  // Angle outward from the cob base
  const ang = side * 0.56;
  const co = Math.cos(ang);
  const si = Math.sin(ang);
  const dx = x - ax;
  const dy = y - ay;
  // u along leaf (0 at base -> L at tip), v perpendicular (positive = outward)
  const u = dx * si - dy * co;
  const v = (dx * co + dy * si) * side;
  const L = 0.52;
  const t = clamp(u / L, 0, 1);
  // Leaf arches outward as it rises, then curls slightly at the tip
  const arch = Math.sin(t * Math.PI) * 0.055 + t * t * 0.04;
  const halfW = 0.135 * Math.sin(Math.pow(t, 0.65) * Math.PI);
  let d;
  if (u < 0) {
    d = Math.hypot(u, v);
  } else if (u > L) {
    d = Math.hypot(u - L, v - arch);
  } else {
    d = Math.abs(v - arch) - halfW;
  }
  return { d, t, v: v - arch, halfW };
}

/** Corn silk tuft at the top of the cob. */
function silkDist(x, y) {
  const d1 = sdSegment(x, y, 0, -0.34, 0, -0.445) - 0.036;
  const d2 = sdSegment(x, y, -0.02, -0.33, -0.075, -0.425) - 0.032;
  const d3 = sdSegment(x, y, 0.02, -0.33, 0.075, -0.425) - 0.032;
  return Math.min(d1, d2, d3);
}

// Precompute rows of horizontal oval kernels across the cob body.
const KERNEL_SLOTS = [];
{
  const rowYs = [-0.285, -0.21, -0.135, -0.06, 0.015, 0.09, 0.165, 0.24];
  const kw = 0.092;
  const rx = 0.048;
  const ry = 0.033;
  rowYs.forEach((ky, rIdx) => {
    const ny = (ky + 0.02) / 0.36;
    const taper = ny < 0 ? 1 + ny * 0.14 : 1 - ny * 0.04;
    const halfSpan = 0.255 * taper * Math.sqrt(Math.max(0, 1 - ny * ny)) - 0.018;
    const count = Math.max(2, Math.round((halfSpan * 2) / kw) + (rIdx % 2 === 1 ? 1 : 0));
    for (let c = 0; c < count; c++) {
      const kx = (c - (count - 1) / 2) * kw;
      if (Math.abs(kx) - rx * 0.65 <= halfSpan) {
        KERNEL_SLOTS.push({ kx, ky, rx, ry });
      }
    }
  });
}

/** scale < 1 shrinks the cob toward the center (maskable icons need a safe zone). */
function cob(scale) {
  return (u, v) => {
    const rawX = (u - 0.5) / scale;
    const rawY = (v - 0.5) / scale;

    // Gentle sunny radial glow on the green field background
    const bgDist = Math.hypot(u - 0.5, v - 0.5);
    let bg = mix(FIELD_GLOW, FIELD, clamp(bgDist * 1.65));

    // Slight cheerful tilt (-5 degrees) matching the in-game cutout rock
    const tilt = -0.085;
    const co = Math.cos(tilt);
    const si = Math.sin(tilt);
    const x = rawX * co - rawY * si;
    const y = rawX * si + rawY * co - 0.01;

    // Ground shadow beneath the cob
    const shDist = Math.hypot((rawX - 0.01) / 0.29, (rawY - 0.37) / 0.065);
    if (shDist < 1) {
      bg = mix(SHADOW, bg, shDist > 0.75 ? (shDist - 0.75) / 0.25 : 0);
    }

    const inkW = 0.028;
    const earD = cobEarDist(x, y);
    const leafL = leafInfo(x, y, -1);
    const leafR = leafInfo(x, y, 1);
    const silkD = silkDist(x, y);

    // 1. Face details (on top of the cob ear)
    if (earD < 0) {
      // Cute rosy cheeks
      for (const side of [-1, 1]) {
        const cd = Math.hypot((x - side * 0.145) / 0.046, (y - -0.045) / 0.03);
        if (cd < 1) {
          return mix(CHEEK, BODY, cd > 0.7 ? (cd - 0.7) / 0.3 : 0.15);
        }
      }

      // Big expressive eyes with white catchlights
      for (const side of [-1, 1]) {
        const ex = side * 0.095;
        const ey = -0.13;
        const ed = Math.hypot(x - ex, y - ey);
        if (ed < 0.072) {
          if (ed > 0.056) return INK;
          // Pupil shifted slightly toward center-top for a friendly look
          const px = ex - side * 0.008;
          const py = ey - 0.004;
          const pd = Math.hypot(x - px, y - py);
          if (pd < 0.034) {
            // Sparkle catchlights
            if (Math.hypot(x - (px - 0.011), y - (py - 0.012)) < 0.011) return WHITE;
            if (Math.hypot(x - (px + 0.01), y - (py + 0.01)) < 0.0055) return WHITE;
            return INK;
          }
          return WHITE;
        }
      }

      // Happy open cartoon smile with a pink tongue
      const my = -0.048;
      if (y >= my - 0.012 && y <= my + 0.095 && Math.abs(x) <= 0.1) {
        const mx = x / 0.082;
        const topEdge = my + 0.006 * mx * mx;
        const botEdge = my + 0.074 * Math.max(0, 1 - mx * mx);
        const inMouth = Math.abs(mx) < 1 && y > topEdge && y < botEdge;
        const borderD = Math.min(
          Math.abs(mx) <= 1.05 ? Math.abs(y - topEdge) : 1,
          Math.abs(mx) <= 1.05 ? Math.abs(y - botEdge) : 1,
          Math.hypot(Math.abs(x) - 0.082, y - my),
        );
        if (inMouth) {
          if (borderD < 0.014) return INK;
          const td = Math.hypot(x / 0.048, (y - (my + 0.068)) / 0.036);
          if (td < 1) return td > 0.82 ? INK : TONGUE;
          return MOUTH_BG;
        }
        if (borderD < 0.014 && y >= topEdge - 0.012 && y <= botEdge + 0.014) {
          return INK;
        }
      }
    }

    // 2. Front husk cuffs wrapping the base of the cob
    const cuffY = 0.255 - 0.05 * (1 - Math.min(1, (x / 0.22) ** 2));
    const inCuffL = earD < 0 && x <= 0.03 && y > cuffY + x * 0.22;
    const inCuffR = earD < 0 && x >= -0.02 && y > cuffY - x * 0.22;
    if (inCuffR || inCuffL) {
      if (earD > -inkW * 0.85) return INK;
      const topCurve = inCuffR ? cuffY - x * 0.22 : cuffY + x * 0.22;
      if (Math.abs(y - topCurve) < 0.02) return INK;
      if (inCuffR && inCuffL && Math.abs(x + 0.02 - (y - cuffY) * 0.25) < 0.018) return INK;
      return inCuffR ? HUSK_R : HUSK_L;
    }

    // 3. Cob ear body and packed horizontal oval kernels
    if (earD < inkW) {
      if (earD >= 0) return INK;

      // Check kernels inside the cob ear
      let bestK = null;
      let bestD = 1;
      for (const k of KERNEL_SLOTS) {
        const dx = (x - k.kx) / k.rx;
        const dy = (y - k.ky) / k.ry;
        const d = Math.hypot(dx, dy);
        if (d < bestD) {
          bestD = d;
          bestK = k;
        }
      }
      if (bestK && bestD < 1.0) {
        if (bestD > 0.78) return INK;
        const hx = (x - (bestK.kx - bestK.rx * 0.18)) / (bestK.rx * 0.42);
        const hy = (y - (bestK.ky - bestK.ry * 0.28)) / (bestK.ry * 0.34);
        if (Math.hypot(hx, hy) < 1) return KERNEL_HI;
        const sy = (y - bestK.ky) / bestK.ry;
        if (sy > 0.35) return KERNEL_SHADE;
        return KERNEL;
      }

      // Base cob body shading near edge
      return earD > -0.035 ? BODY_SHADE : BODY;
    }

    // 4. Side husk leaves (peeling out left & right behind the cob ear)
    for (const [leaf, baseCol] of [
      [leafR, HUSK_R],
      [leafL, HUSK_L],
    ]) {
      if (leaf.d < inkW) {
        if (leaf.d >= 0) return INK;
        // Center vein line along the leaf
        if (leaf.t > 0.12 && leaf.t < 0.86 && Math.abs(leaf.v) < 0.009) return HUSK_VEIN;
        // Highlight along the upper/inner rim of the leaf
        if (leaf.v < -leaf.halfW * 0.35 && leaf.d < -0.012) return HUSK_HI;
        return baseCol;
      }
    }

    // 5. Golden corn silk tuft at the top tip
    if (silkD < inkW * 0.85) {
      if (silkD >= 0) return INK;
      return y < -0.39 ? SILK : SILK_SHADE;
    }

    return bg;
  };
}

writeFileSync(new URL('icon-192.png', OUT), png(192, cob(1)));
writeFileSync(new URL('icon-512.png', OUT), png(512, cob(1)));
writeFileSync(new URL('icon-maskable-512.png', OUT), png(512, cob(0.76)));
writeFileSync(new URL('apple-touch-icon.png', OUT), png(180, cob(0.92)));
writeFileSync(new URL('favicon.png', OUT), png(64, cob(1.12)));
console.log('icons written to public/icons/');
