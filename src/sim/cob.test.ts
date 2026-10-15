import { describe, expect, it } from 'vitest';
import { applyHit, arrangedKernels, canChomp, kernelsOf, removeLatestKernels, shieldBadges, total } from './cob';
import type { KernelKind } from './kernels';
import { makeRng } from './rng';

describe('chomp rule', () => {
  it('chomps only cobs with fewer kernels', () => {
    const me = kernelsOf({ sunny: 10 });
    expect(canChomp(me, kernelsOf({ sunny: 9 }))).toBe(true);
    expect(canChomp(me, kernelsOf({ sunny: 10 }))).toBe(false);
    expect(canChomp(me, kernelsOf({ stony: 11 }))).toBe(false);
  });

  it('compares kernel count, not kernel type', () => {
    expect(canChomp(kernelsOf({ sunny: 3, zinger: 3 }), kernelsOf({ stony: 5 }))).toBe(true);
  });
});

describe('applyHit', () => {
  it('fire bounces off a fully Soggy cob (tink)', () => {
    const k = kernelsOf({ soggy: 6 });
    const res = applyHit(k, 'fire', 2, makeRng(1));
    expect(res.removed).toEqual([]);
    expect(res.resisted).toBe(true);
    expect(total(k)).toBe(6);
  });

  it('fire knocks only non-Soggy kernels off a mixed cob', () => {
    const k = kernelsOf({ soggy: 5, sunny: 2 });
    const res = applyHit(k, 'fire', 4, makeRng(7));
    expect(res.removed).toEqual(['sunny', 'sunny']);
    expect(res.resisted).toBe(true);
    expect(k).toMatchObject({ soggy: 5, sunny: 0 });
  });

  it('bonk bounces off Stony, pop hits Stony for double', () => {
    const k = kernelsOf({ stony: 6 });
    expect(applyHit(k, 'bonk', 1, makeRng(3)).resisted).toBe(true);
    const res = applyHit(k, 'pop', 1, makeRng(3));
    expect(res.weak).toBe(true);
    expect(res.removed).toEqual(['stony', 'stony']);
    expect(k.stony).toBe(4);
  });

  it('the Heart Kernel ignores resistances when asked', () => {
    const k = kernelsOf({ stony: 1 });
    expect(applyHit(k, 'bonk', 1, makeRng(1)).removed).toEqual([]);
    expect(applyHit(k, 'bonk', 1, makeRng(1), { heartIgnoresResist: true }).removed).toEqual(['stony']);
  });

  it('never removes more kernels than exist', () => {
    const k = kernelsOf({ sunny: 1 });
    const res = applyHit(k, 'bonk', 5, makeRng(1));
    expect(res.removed.length).toBe(1);
    expect(total(k)).toBe(0);
  });
});

describe('kernel pickup order', () => {
  it('draws kernels in the order they were picked up, not grouped by type', () => {
    const order: KernelKind[] = ['sunny', 'spicy', 'sunny', 'zinger', 'soggy'];
    expect(arrangedKernels(order, 0, order.length)).toEqual(order);
  });

  it('leaves empty sockets after the kernels you have', () => {
    expect(arrangedKernels(['sunny', 'zinger'], 4, 4)).toEqual(['sunny', 'zinger', null, null]);
  });

  it('samples a crowded cob from the start of the pickup order through the end', () => {
    const order: KernelKind[] = ['zinger', 'sunny', 'sunny', 'sunny', 'soggy'];
    expect(arrangedKernels(order, 0, 3)).toEqual(['zinger', 'sunny', 'soggy']);
  });

  it('removes the newest kernel of a kind and keeps the others in place', () => {
    const order: KernelKind[] = ['sunny', 'zinger', 'sunny', 'zinger', 'soggy'];
    removeLatestKernels(order, ['zinger', 'sunny']);
    expect(order).toEqual(['sunny', 'zinger', 'soggy']);
  });
});

describe('shieldBadges', () => {
  it('shows a badge for resistances covering most kernels', () => {
    expect(shieldBadges(kernelsOf({ soggy: 6, sunny: 2 }))).toEqual(['fire']);
    expect(shieldBadges(kernelsOf({ stony: 3, sunny: 5 }))).toEqual([]);
  });
});
