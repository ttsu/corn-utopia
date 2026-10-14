import { describe, expect, it } from 'vitest';
import { propsForChunk } from './farm';

describe('sunny farm props', () => {
  it('builds hay as even stacks instead of scattered bales', () => {
    const hay = propsForChunk(1, 2, 3, 700).filter((p) => p.kind === 'hay');
    expect(hay.length).toBeGreaterThanOrEqual(3);
    expect(hay.length % 3).toBe(0);
    for (const bale of hay) {
      expect(bale.r).toBeGreaterThanOrEqual(38);
      expect(bale.r).toBeLessThanOrEqual(44);
      const neighbors = hay.filter((o) => o !== bale && Math.hypot(o.x - bale.x, o.y - bale.y) < 70);
      expect(neighbors.length).toBeGreaterThan(0);
      expect(neighbors.some((o) => o.r === bale.r)).toBe(true);
    }
  });
});