export type DamageType = 'bonk' | 'fire' | 'freeze' | 'zap' | 'pop' | 'sticky';
export type PlainKind = 'sunny' | 'sweetie' | 'soggy' | 'toasty' | 'rubbery' | 'leafy' | 'stony' | 'tough' | 'goldie';
export type PowerKind = 'zinger' | 'spicy' | 'popper' | 'frosty' | 'boing' | 'zappy' | 'caramel' | 'sprout' | 'gem';
export type KernelKind = PlainKind | PowerKind;

export type Resist = 'immune' | 'weak' | 'half';

export interface KernelDef {
  kind: KernelKind;
  name: string;
  power: boolean;
  color: string;
  /** Relative chance this kernel is the one knocked off by a hit. */
  knockWeight: number;
  /** Used for the director's power score. */
  powerWeight: number;
  /** Hits of a normal damage type needed to pop one kernel. */
  hits: number;
  resist: Partial<Record<DamageType, Resist>>;
}

/**
 * Plain kernels, weakest first. A full cob drops the earliest kind it can
 * spare, so Sunny goes before a Tough Nut or a Goldie.
 */
export const PLAIN_KINDS: readonly PlainKind[] = [
  'sunny',
  'sweetie',
  'soggy',
  'toasty',
  'rubbery',
  'leafy',
  'stony',
  'tough',
  'goldie',
];

/**
 * Button order, thumb outward. The first four are the M1 set. Later powers
 * keep the places after them, and only five can be armed at once.
 * Boing, Caramel, and Gem stay in the sim and stay off this list, so they
 * never get a button or show up as loot.
 */
export const POWER_KINDS: readonly PowerKind[] = ['zinger', 'spicy', 'popper', 'frosty', 'zappy', 'sprout'];

/** Parked powers. Still typed and simulated, not offered in a run. */
export const HIDDEN_POWERS: readonly PowerKind[] = ['boing', 'caramel', 'gem'];

export const ALL_POWER_KINDS: readonly PowerKind[] = [...POWER_KINDS, ...HIDDEN_POWERS];

/** The snacks around spawn each carry one of these, so a plain start can arm up. */
export const STARTER_POWERS: readonly PowerKind[] = ['zinger', 'spicy', 'popper', 'frosty'];

export const KERNEL_KINDS: readonly KernelKind[] = [...PLAIN_KINDS, ...ALL_POWER_KINDS];

/** Damage types that can knock a kernel off. Sticky only slows. */
export const KNOCK_DAMAGE: readonly DamageType[] = ['bonk', 'fire', 'freeze', 'zap', 'pop'];

const plain = (
  kind: PlainKind,
  name: string,
  color: string,
  powerWeight: number,
  hits: number,
  resist: Partial<Record<DamageType, Resist>>,
  knockWeight = 1,
): KernelDef => ({ kind, name, power: false, color, knockWeight, powerWeight, hits, resist });

const power = (kind: PowerKind, name: string, color: string, powerWeight: number): KernelDef => ({
  kind,
  name,
  power: true,
  color,
  knockWeight: 1,
  powerWeight,
  hits: 1,
  resist: {},
});

export const KERNELS: Record<KernelKind, KernelDef> = {
  sunny: plain('sunny', 'Sunny', '#ffd23f', 1, 1, {}, 4),
  sweetie: plain('sweetie', 'Sweetie', '#fff4ea', 1.5, 1, {}, 1.2),
  soggy: plain('soggy', 'Soggy', '#2ec4b6', 3, 1, { fire: 'immune', zap: 'weak' }),
  toasty: plain('toasty', 'Toasty', '#d4894c', 3, 1, { freeze: 'immune' }),
  rubbery: plain('rubbery', 'Rubbery', '#ff8fab', 3, 1, { zap: 'immune', bonk: 'half' }),
  leafy: plain('leafy', 'Leafy', '#7dce6a', 3, 1, { pop: 'immune' }),
  stony: plain('stony', 'Stony', '#8d99ae', 5, 1, { bonk: 'immune', pop: 'weak' }),
  tough: plain('tough', 'Tough Nut', '#6b3e26', 5, 3, {}, 0.6),
  goldie: plain('goldie', 'Goldie', '#f5c518', 8, 1, {}, 0.5),
  zinger: power('zinger', 'Zinger', '#ff8c1a', 1),
  spicy: power('spicy', 'Spicy', '#e63946', 3),
  popper: power('popper', 'Popper', '#f1e3c8', 3),
  frosty: power('frosty', 'Frosty', '#7ec8ff', 3),
  boing: power('boing', 'Boing', '#b388ff', 3),
  zappy: power('zappy', 'Zappy', '#ffe14a', 5),
  caramel: power('caramel', 'Caramel', '#a97142', 5),
  sprout: power('sprout', 'Sprout', '#3dbe4a', 5),
  gem: power('gem', 'Gem', '#e7d6ff', 12),
};

export const POWER_DAMAGE: Record<PowerKind, DamageType> = {
  zinger: 'bonk',
  spicy: 'fire',
  popper: 'pop',
  frosty: 'freeze',
  boing: 'bonk',
  zappy: 'zap',
  caramel: 'sticky',
  sprout: 'bonk',
  gem: 'bonk',
};

export const DAMAGE_ICON: Record<DamageType, string> = {
  bonk: '⭐',
  fire: '🔥',
  freeze: '❄️',
  zap: '⚡',
  pop: '💥',
  sticky: '🍯',
};

export function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const key of keys) out[key] = 0;
  return out;
}

export function isPower(kind: KernelKind): kind is PowerKind {
  return KERNELS[kind].power;
}
