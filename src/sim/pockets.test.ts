import { describe, expect, it } from 'vitest';
import { pocketSlotsFor, rollOffer } from './perks';
import type { PowerKind } from './kernels';
import { layoutPockets, swapPocket } from './pockets';
import { makeRng } from './rng';

describe('power pockets', () => {
  it('fills empty pockets and queues the rest', () => {
    const laid = layoutPockets({ zinger: 2, spicy: 1, popper: 3 }, 2, [], []);
    expect(laid.pockets).toEqual(['zinger', 'spicy']);
    expect(laid.waiting).toEqual(['popper']);
  });

  it('drops an empty power and promotes the waiting one', () => {
    const laid = layoutPockets({ zinger: 0, spicy: 2, popper: 1 }, 2, ['zinger', 'spicy'], ['popper']);
    expect(laid.pockets).toEqual(['spicy', 'popper']);
    expect(laid.waiting).toEqual([]);
  });

  it('swaps a pocket with a waiting power', () => {
    const pockets: PowerKind[] = ['zinger', 'spicy'];
    const waiting: PowerKind[] = ['popper'];
    expect(swapPocket(pockets, waiting, 'zinger', 'popper')).toBe(true);
    expect(pockets).toEqual(['popper', 'spicy']);
    expect(waiting).toEqual(['zinger']);
  });

  it('grows from 3 pockets to 5, and Extra Pocket can fill the gap early', () => {
    expect(pocketSlotsFor(1, [])).toBe(3);
    expect(pocketSlotsFor(3, [])).toBe(4);
    expect(pocketSlotsFor(5, [])).toBe(5);
    expect(pocketSlotsFor(1, ['pocket', 'pocket'])).toBe(5);
    expect(pocketSlotsFor(5, ['pocket'])).toBe(5);
  });

  it('stops offering a once-only perk after you take it', () => {
    const rng = makeRng(1);
    const offer = rollOffer(rng, ['boomerang', 'husk', 'butter', 'lucky'], 5);
    expect(offer).toHaveLength(3);
    for (const id of offer) expect(['appetite', 'magnet', 'zoomies', 'quick', 'range']).toContain(id);
  });
});