export type DamageType = 'bonk' | 'fire' | 'pop';
export type PlainKind = 'sunny' | 'soggy' | 'stony';
export type PowerKind = 'zinger' | 'spicy' | 'popper';
export type KernelKind = PlainKind | PowerKind;

export type Resist = 'immune' | 'weak';

export interface KernelDef {
  kind: KernelKind;
  name: string;
  power: boolean;
  color: string;
  /** Relative chance this kernel is the one knocked off by a hit. */
  knockWeight: number;
  /** Used for the director's power score. */
  powerWeight: number;
  resist: Partial<Record<DamageType, Resist>>;
}

export const PLAIN_KINDS: readonly PlainKind[] = ['sunny', 'soggy', 'stony'];
export const POWER_KINDS: readonly PowerKind[] = ['zinger', 'spicy', 'popper'];
export const KERNEL_KINDS: readonly KernelKind[] = [...PLAIN_KINDS, ...POWER_KINDS];

export const KERNELS: Record<KernelKind, KernelDef> = {
  sunny: { kind: 'sunny', name: 'Sunny', power: false, color: '#ffd23f', knockWeight: 4, powerWeight: 1, resist: {} },
  soggy: {
    kind: 'soggy',
    name: 'Soggy',
    power: false,
    color: '#2ec4b6',
    knockWeight: 1,
    powerWeight: 3,
    resist: { fire: 'immune' },
  },
  stony: {
    kind: 'stony',
    name: 'Stony',
    power: false,
    color: '#8d99ae',
    knockWeight: 1,
    powerWeight: 5,
    resist: { bonk: 'immune', pop: 'weak' },
  },
  zinger: { kind: 'zinger', name: 'Zinger', power: true, color: '#ff8c1a', knockWeight: 1, powerWeight: 1, resist: {} },
  spicy: { kind: 'spicy', name: 'Spicy', power: true, color: '#e63946', knockWeight: 1, powerWeight: 3, resist: {} },
  popper: { kind: 'popper', name: 'Popper', power: true, color: '#f1e3c8', knockWeight: 1, powerWeight: 3, resist: {} },
};

export const POWER_DAMAGE: Record<PowerKind, DamageType> = {
  zinger: 'bonk',
  spicy: 'fire',
  popper: 'pop',
};

export const DAMAGE_ICON: Record<DamageType, string> = {
  bonk: '⭐',
  fire: '🔥',
  pop: '💥',
};

export function isPower(kind: KernelKind): kind is PowerKind {
  return KERNELS[kind].power;
}
