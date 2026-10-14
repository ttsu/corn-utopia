import { describe, expect, it } from 'vitest';
import { BODY_RX, COB_KERNEL_ASPECT, COB_KERNEL_DRAW_SCALE, cobHalfWidth, cobKernelSlots, insideCobBody } from './cobLayout';

function read(n: number): { x: number; y: number; halfW: number; halfH: number }[] {
  const raw = cobKernelSlots(n);
  const slots = [];
  for (let i = 0; i < n; i++) {
    const halfW = raw[i * 3 + 2];
    slots.push({ x: raw[i * 3], y: raw[i * 3 + 1], halfW, halfH: halfW * COB_KERNEL_ASPECT });
  }
  return slots;
}

describe('cob kernel layout', () => {
  it('draws attached kernels as horizontal ovals', () => {
    for (const n of [1, 4, 12, 30, 80]) {
      for (const slot of read(n)) {
        expect(slot.halfW).toBeGreaterThan(slot.halfH * 1.5);
      }
    }
  });

  it('keeps every kernel inside the cob', () => {
    for (const n of [1, 2, 3, 8, 12, 30, 60, 120, 240]) {
      for (const slot of read(n)) {
        const halfW = slot.halfW * COB_KERNEL_DRAW_SCALE;
        const halfH = slot.halfH * COB_KERNEL_DRAW_SCALE;
        for (const x of [slot.x - halfW, slot.x + halfW]) {
          for (const y of [slot.y - halfH, slot.y + halfH]) {
            expect(insideCobBody(x, y, 0)).toBe(true);
          }
        }
      }
    }
  });

  it('packs neighbors so they touch', () => {
    for (const n of [6, 12, 30, 60]) {
      const slots = read(n);
      const ys = [...new Set(slots.map((s) => s.y.toFixed(4)))].map(Number).sort((a, b) => a - b);
      expect(ys.length).toBeGreaterThan(1);
      const rowH = slots[0].halfH * 2;
      for (let i = 1; i < ys.length; i++) {
        expect(Math.abs(ys[i] - ys[i - 1] - rowH)).toBeLessThan(rowH * 0.04);
      }
      for (const y of ys) {
        const row = slots.filter((s) => Math.abs(s.y - y) < 1e-3).sort((a, b) => a.x - b.x);
        for (let i = 1; i < row.length; i++) {
          const gap = row[i].x - row[i - 1].x - row[i].halfW - row[i - 1].halfW;
          expect(Math.abs(gap)).toBeLessThan(row[i].halfW * 0.04);
        }
      }
    }
  });

  it('spreads a full ear across most of the cob', () => {
    const slots = read(30);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const slot of slots) {
      minX = Math.min(minX, slot.x - slot.halfW);
      maxX = Math.max(maxX, slot.x + slot.halfW);
    }
    expect(maxX - minX).toBeGreaterThan(BODY_RX * 1.5);
  });

  it('keeps an oval ear, narrower at the tip, and rows follow that curve', () => {
    expect(cobHalfWidth(0)).toBeGreaterThan(cobHalfWidth(-0.7));
    expect(cobHalfWidth(-0.7)).toBeGreaterThan(cobHalfWidth(-0.92));
    expect(cobHalfWidth(-0.15) - cobHalfWidth(-0.75)).toBeGreaterThan(0.08);

    const slots = read(48);
    const rows = new Map<string, { y: number; span: number }>();
    for (const slot of slots) {
      const key = slot.y.toFixed(3);
      const edge = Math.abs(slot.x) + slot.halfW;
      const row = rows.get(key);
      if (!row) rows.set(key, { y: slot.y, span: edge });
      else row.span = Math.max(row.span, edge);
    }
    const list = [...rows.values()];
    const mid = list.reduce((a, b) => (Math.abs(b.y) < Math.abs(a.y) ? b : a));
    const tip = list.reduce((a, b) => (a.y < b.y ? a : b));
    expect(mid.span).toBeGreaterThan(tip.span * 1.2);
  });
});
