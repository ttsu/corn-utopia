import { describe, expect, it } from 'vitest';
import { pocketSlotsFor, rollOffer } from './perks';
import type { PowerKind } from './kernels';
import { armPower, layoutPockets } from './pockets';
import { makeRng } from './rng';

const all = { zinger: 1, spicy: 1, popper: 1, frosty: 1 };

describe('power pockets', () => {
  it('arms the first powers and leaves the fourth waiting on its own', () => {
    const laid = layoutPockets(all, 3, [], []);
    expect(laid.pockets).toEqual(['zinger', 'spicy', 'popper']);
    expect(laid.waiting).toEqual(['frosty']);
  });

  it('keeps an empty power on its button instead of promoting the waiting one', () => {
    const laid = layoutPockets({ zinger: 0, spicy: 2, popper: 1, frosty: 1 }, 3, ['zinger', 'spicy', 'popper'], ['frosty']);
    expect(laid.pockets).toEqual(['zinger', 'spicy', 'popper']);
    expect(laid.waiting).toEqual(['frosty']);
  });

  it('arms a waiting power by trading with the latest armed one', () => {
    const pockets: PowerKind[] = ['zinger', 'spicy', 'popper'];
    const waiting: PowerKind[] = ['frosty'];
    expect(armPower(pockets, waiting, 'frosty', all)).toBe(true);
    expect(pockets).toEqual(['zinger', 'spicy', 'frosty']);
    expect(waiting).toEqual(['popper']);
  });

  it('prefers trading away an empty button', () => {
    const pockets: PowerKind[] = ['zinger', 'spicy', 'popper'];
    const waiting: PowerKind[] = ['frosty'];
    expect(armPower(pockets, waiting, 'frosty', { ...all, zinger: 0 })).toBe(true);
    expect(pockets).toEqual(['spicy', 'popper', 'frosty']);
    expect(waiting).toEqual(['zinger']);
  });

  it('arms a waiting power when a new pocket opens', () => {
    const laid = layoutPockets(all, 4, ['zinger', 'spicy', 'popper'], ['frosty']);
    expect(laid.pockets).toEqual(['zinger', 'spicy', 'popper', 'frosty']);
    expect(laid.waiting).toEqual([]);
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
