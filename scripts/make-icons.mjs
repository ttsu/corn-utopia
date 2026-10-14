// Generates the gray-box PWA icons (a smiling cob on a field) with no image dependencies.
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
const FIELD = hex('#9fd36b');
const INK = hex('#2b2b2b');
const CORN = hex('#ffd23f');
const BODY = hex('#fff1b8');
const WHITE = [255, 255, 255];
const BLUE = hex('#3a86ff');

/** scale < 1 shrinks the cob toward the center (maskable icons need a safe zone). */
function cob(scale) {
  return (u, v) => {
    const x = (u - 0.5) / scale;
    const y = (v - 0.5) / scale;
    const d = Math.hypot(x, y);
    const R = 0.36;
    if (d > R + 0.035) return FIELD;
    if (d > R + 0.012) return BLUE;
    if (d > R) return WHITE;
    for (const side of [-1, 1]) {
      const ex = side * 0.12;
      const ey = -0.08;
      const ed = Math.hypot(x - ex, y - ey);
      if (ed < 0.035) return INK;
      if (ed < 0.075) return WHITE;
      if (ed < 0.09) return INK;
    }
    if (y > 0.06 && y < 0.2 && Math.abs(x) < 0.16) {
      const mouth = Math.hypot(x, (y - 0.06) * 1.4);
      if (mouth < 0.15 && y > 0.06) return INK;
    }
    const s = 0.085;
    const row = Math.round(y / (s * 0.866));
    const off = row % 2 ? s / 2 : 0;
    const col = Math.round((x - off) / s);
    const kd = Math.hypot(x - (col * s + off), y - row * s * 0.866);
    if (kd < s * 0.36 && d < R - 0.04) return CORN;
    return BODY;
  };
}

writeFileSync(new URL('icon-192.png', OUT), png(192, cob(1)));
writeFileSync(new URL('icon-512.png', OUT), png(512, cob(1)));
writeFileSync(new URL('icon-maskable-512.png', OUT), png(512, cob(0.72)));
writeFileSync(new URL('apple-touch-icon.png', OUT), png(180, cob(0.9)));
writeFileSync(new URL('favicon.png', OUT), png(64, cob(1.15)));
console.log('icons written to public/icons/');
