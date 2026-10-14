/**
 * Every number M0 is meant to tune lives here. The in-game Tuning panel edits these live,
 * and they're saved to localStorage so a playtest setup survives reloads.
 */
export interface TuningSpec {
  label: string;
  group: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

const spec = (group: string, label: string, value: number, min: number, max: number, step: number): TuningSpec => ({
  group,
  label,
  value,
  min,
  max,
  step,
});

export const TUNING_SPECS = {
  playerSpeed: spec('Player', 'Move speed', 200, 80, 400, 10),
  magnetRadius: spec('Player', 'Magnet radius (beyond body)', 70, 0, 250, 5),
  magnetPull: spec('Player', 'Magnet pull strength', 900, 200, 3000, 50),
  bumpLoss: spec('Player', 'Kernels lost per bump', 2, 1, 6, 1),
  mercySeconds: spec('Player', 'Mercy invulnerability (s)', 0.75, 0.2, 2, 0.05),
  lastChanceSeconds: spec('Player', 'Last Chance (s)', 3, 1, 8, 0.5),
  maxTier: spec('Player', 'Top size tier (then extras become Seeds)', 10, 2, 30, 1),
  damageSizeExponent: spec('Player', 'Damage growth with size (exponent)', 0.4, 0, 1.5, 0.05),

  gameStartSunny: spec('Starting cob', 'Game start: Sunny kernels', 10, 1, 30, 1),

  startSunny: spec('Playtest mix', 'Sunny', 3, 0, 30, 1),
  startSoggy: spec('Playtest mix', 'Soggy', 0, 0, 10, 1),
  startStony: spec('Playtest mix', 'Stony', 0, 0, 10, 1),
  startZinger: spec('Playtest mix', 'Zinger', 4, 0, 15, 1),
  startSpicy: spec('Playtest mix', 'Spicy', 2, 0, 15, 1),
  startPopper: spec('Playtest mix', 'Popper', 2, 0, 15, 1),

  zingerRecharge: spec('Powers', 'Zinger recharge (s)', 0.3, 0.05, 2, 0.05),
  spicyRecharge: spec('Powers', 'Spicy recharge (s)', 0.7, 0.05, 3, 0.05),
  popperRecharge: spec('Powers', 'Popper recharge (s)', 1.1, 0.05, 3, 0.05),
  zingerDamage: spec('Powers', 'Zinger knocks off', 1, 1, 5, 1),
  spicyDamage: spec('Powers', 'Spicy knocks off', 2, 1, 6, 1),
  popperDamage: spec('Powers', 'Popper knocks off (each cob)', 1, 1, 5, 1),
  shotRange: spec('Powers', 'Shot range (at size 1)', 380, 150, 900, 10),
  popperRadius: spec('Powers', 'Popper blast radius', 75, 30, 200, 5),
  burnSeconds: spec('Powers', 'Spicy burn patch (s)', 1.5, 0, 5, 0.25),
  homing: spec('Powers', 'Shot homing (0 = straight)', 5, 0, 20, 0.5),

  chompBonusMin: spec('Chomp', 'Chomp Bonus min', 1, 0, 10, 1),
  chompBonusMax: spec('Chomp', 'Chomp Bonus max', 2, 0, 10, 1),
  streakSeconds: spec('Chomp', 'Chomp Streak window (s)', 3, 0.5, 8, 0.5),

  bandChompable: spec('Director', 'Spawns chompable now (%)', 60, 0, 100, 5),
  bandWearDown: spec('Director', 'Spawns needing wear-down (%)', 30, 0, 100, 5),
  snackSize: spec('Director', 'Snack size (x your count ^ exponent)', 0.5, 0.2, 3, 0.05),
  snackExponent: spec('Director', 'Snack size exponent (1 = grows with you)', 0.2, 0, 1, 0.05),
  wearDownMax: spec('Director', 'Wear-down size (x your count)', 1.6, 1.05, 3, 0.05),
  projectMax: spec('Director', 'Project size (x your count)', 2.8, 1.5, 6, 0.1),
  budgetBase: spec('Director', 'Spawn budget base / s', 0.4, 0, 5, 0.05),
  budgetPerPower: spec('Director', 'Budget per power / s', 0.0015, 0, 0.05, 0.0005),
  budgetPerMinute: spec('Director', 'Budget per minute / s', 0.15, 0, 2, 0.05),
  bigCobFalloff: spec('Director', 'Big cobs get rarer as you grow (exponent)', 1.2, 0, 2, 0.05),
  maxEnemies: spec('Director', 'Max enemies', 30, 5, 120, 1),
  enemySpeed: spec('Director', 'Enemy speed multiplier', 1, 0.3, 2.5, 0.05),
  nervousSpeed: spec('Director', 'Chompable cobs flee speed (x)', 1.3, 0, 2.5, 0.05),
  enemyGrabs: spec('Director', 'Enemies grab ground kernels (0/1)', 1, 0, 1, 1),
  fieldKernels: spec('Director', 'Loose kernels per field chunk', 3, 0, 30, 1),
} satisfies Record<string, TuningSpec>;

export type TuningKey = keyof typeof TUNING_SPECS;
export type Tuning = Record<TuningKey, number>;

export const TUNING_KEYS = Object.keys(TUNING_SPECS) as TuningKey[];

export function defaultTuning(): Tuning {
  const t = {} as Tuning;
  for (const key of TUNING_KEYS) t[key] = TUNING_SPECS[key].value;
  return t;
}

export function sanitizeTuning(raw: unknown): Tuning {
  const t = defaultTuning();
  if (raw && typeof raw === 'object') {
    for (const key of TUNING_KEYS) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        const s = TUNING_SPECS[key];
        t[key] = Math.min(s.max, Math.max(s.min, v));
      }
    }
  }
  return t;
}
