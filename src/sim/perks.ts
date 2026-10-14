import { int, type Rng } from './rng';

/** Cob perks offered by Ear Up! when you grow a size tier. */
export type PerkId =
  | 'appetite'
  | 'magnet'
  | 'zoomies'
  | 'quick'
  | 'pocket'
  | 'range'
  | 'boomerang'
  | 'husk'
  | 'butter'
  | 'lucky';

export interface PerkDef {
  id: PerkId;
  /** Icon-first label, a few words. */
  name: string;
  blurb: string;
  icon: string;
  /** Drops out of later offers after you take it. Every current perk stacks instead. */
  once: boolean;
}

export const PERKS: readonly PerkDef[] = [
  { id: 'appetite', name: 'Big Appetite', blurb: 'Chomp Bonus +2', icon: '😋', once: false },
  { id: 'magnet', name: 'Big Magnet', blurb: 'Pickup radius +30%', icon: '🧲', once: false },
  { id: 'zoomies', name: 'Zoomies', blurb: 'Move speed +10%', icon: '💨', once: false },
  { id: 'quick', name: 'Quick Hands', blurb: 'Buttons recharge 15% faster', icon: '👐', once: false },
  { id: 'pocket', name: 'Extra Pocket', blurb: 'Unlock the next power button', icon: '➕', once: false },
  { id: 'range', name: 'Long Shot', blurb: 'Shots fly 20% further', icon: '🏹', once: false },
  { id: 'boomerang', name: 'Boomerang', blurb: '20% of shots fly back', icon: '🔄', once: false },
  { id: 'husk', name: 'Thick Husk', blurb: 'Block 20% of hits', icon: '🛡️', once: false },
  { id: 'butter', name: 'Butter Roll', blurb: 'Dash +25% further', icon: '🧈', once: false },
  { id: 'lucky', name: 'Lucky Ear', blurb: 'Rare kernels +25%', icon: '🍀', once: false },
];

const BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p])) as Record<PerkId, PerkDef>;

export function perkDef(id: PerkId): PerkDef {
  return BY_ID[id];
}

export function perkCount(perks: readonly PerkId[], id: PerkId): number {
  let n = 0;
  for (const p of perks) if (p === id) n++;
  return n;
}

export function hasPerk(perks: readonly PerkId[], id: PerkId): boolean {
  return perkCount(perks, id) > 0;
}

/** Pockets from size, before the Extra Pocket perk. Tier 1–2: 3, tier 3–4: 4, tier 5+: 5. */
export function basePocketSlots(tier: number): number {
  if (tier >= 5) return 5;
  if (tier >= 3) return 4;
  return 3;
}

export function pocketSlotsFor(tier: number, perks: readonly PerkId[]): number {
  return Math.min(5, basePocketSlots(tier) + perkCount(perks, 'pocket'));
}

export function appetiteBonus(perks: readonly PerkId[]): number {
  return perkCount(perks, 'appetite') * 2;
}

export function magnetMul(perks: readonly PerkId[]): number {
  return Math.pow(1.3, perkCount(perks, 'magnet'));
}

export function speedMul(perks: readonly PerkId[]): number {
  return Math.pow(1.1, perkCount(perks, 'zoomies'));
}

export function rechargeMul(perks: readonly PerkId[]): number {
  return Math.pow(0.85, perkCount(perks, 'quick'));
}

export function rangeMul(perks: readonly PerkId[]): number {
  return Math.pow(1.2, perkCount(perks, 'range'));
}

/** Each Butter Roll makes the dash 25% further. Zero copies is the starting dash. */
export function butterMul(perks: readonly PerkId[]): number {
  return Math.pow(1.25, perkCount(perks, 'butter'));
}

/** Each Lucky Ear makes rare kernels 25% more common. */
export function luckyMul(perks: readonly PerkId[]): number {
  return Math.pow(1.25, perkCount(perks, 'lucky'));
}

/**
 * One stack hits 1 of every 5 (the 5th). Each extra stack adds another of the
 * five, spread out, up to all of them.
 */
const FIFTHS: readonly (readonly number[])[] = [[], [4], [1, 4], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4]];

export function everyFifth(index: number, stacks: number): boolean {
  const n = Math.min(FIFTHS.length - 1, stacks);
  if (n <= 0 || index <= 0) return false;
  return FIFTHS[n].includes((index - 1) % 5);
}

/**
 * Three distinct Ear Up cards. Extra Pocket drops out once you already have 5
 * buttons. Every other perk can come back, and each copy stacks.
 */
export function rollOffer(rng: Rng, owned: readonly PerkId[], slots: number): PerkId[] {
  const have = new Set(owned);
  const pool = PERKS.filter((p) => {
    if (p.id === 'pocket') return slots < 5;
    if (p.once && have.has(p.id)) return false;
    return true;
  }).map((p) => p.id);

  const choices: PerkId[] = [];
  const bag = [...pool];
  while (choices.length < 3 && bag.length > 0) {
    const i = int(rng, 0, bag.length - 1);
    choices.push(bag.splice(i, 1)[0]);
  }
  const stackable = PERKS.filter((p) => !p.once && p.id !== 'pocket').map((p) => p.id);
  while (choices.length < 3) choices.push(stackable[int(rng, 0, stackable.length - 1)]);
  return choices;
}
