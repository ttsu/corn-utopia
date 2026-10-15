import { storageKey } from './storageKey';

export type Difficulty = 'easy' | 'normal' | 'spicy';

export interface Settings {
  difficulty: Difficulty;
  /** One Fire button that picks the power. Easy Peasy turns this on. */
  smartFire: boolean;
  /** The cob rolls toward the finger instead of using a joystick. */
  followFinger: boolean;
  /** Drag from a power button to aim. Off until a player asks for it. */
  dragAim: boolean;
  /** Powers on the left, joystick on the right. */
  leftHanded: boolean;
  reduceFlashing: boolean;
  reduceShake: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'normal',
  smartFire: false,
  followFinger: false,
  dragAim: false,
  leftHanded: false,
  reduceFlashing: false,
  reduceShake: false,
};

const KEY = 'corn-utopia-settings';

function isDifficulty(v: unknown): v is Difficulty {
  return v === 'easy' || v === 'normal' || v === 'spicy';
}

export function sanitizeSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  const o = raw as Record<string, unknown>;
  if (isDifficulty(o.difficulty)) s.difficulty = o.difficulty;
  for (const key of ['smartFire', 'followFinger', 'dragAim', 'leftHanded', 'reduceFlashing', 'reduceShake'] as const) {
    if (typeof o[key] === 'boolean') s[key] = o[key];
  }
  return s;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(storageKey(KEY));
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(storageKey(KEY), JSON.stringify(s));
}
