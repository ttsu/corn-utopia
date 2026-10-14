import { TUNING_KEYS, TUNING_SPECS, defaultTuning, sanitizeTuning, type Tuning, type TuningKey } from '../sim/tuning';
import { storageKey } from '../storageKey';

const STORAGE_KEY = storageKey('corn-utopia.tuning.v1');

export function loadTuning(): Tuning {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeTuning(JSON.parse(raw)) : defaultTuning();
  } catch {
    return defaultTuning();
  }
}

function saveTuning(t: Tuning): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    // Storage can be unavailable (private browsing); tuning still works for this session.
  }
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

/**
 * Live editor for every tuning number. Edits mutate the shared Tuning object in place,
 * so the running world sees them immediately.
 */
export class TuningPanel {
  private inputs = new Map<TuningKey, { range: HTMLInputElement; num: HTMLInputElement }>();

  constructor(
    private root: HTMLElement,
    readonly tuning: Tuning,
  ) {
    const fields = root.querySelector<HTMLElement>('#tuning-fields')!;
    let group = '';
    for (const key of TUNING_KEYS) {
      const spec = TUNING_SPECS[key];
      if (spec.group !== group) {
        group = spec.group;
        const h = document.createElement('h4');
        h.textContent = group;
        fields.append(h);
      }
      const row = document.createElement('label');
      row.className = 'field';
      const name = document.createElement('span');
      name.textContent = spec.label;
      const num = document.createElement('input');
      num.type = 'number';
      num.min = String(spec.min);
      num.max = String(spec.max);
      num.step = String(spec.step);
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(spec.min);
      range.max = String(spec.max);
      range.step = String(spec.step);
      const apply = (v: number) => {
        if (!Number.isFinite(v)) return;
        this.tuning[key] = Math.min(spec.max, Math.max(spec.min, v));
        this.sync(key);
        saveTuning(this.tuning);
      };
      range.addEventListener('input', () => apply(Number(range.value)));
      num.addEventListener('change', () => apply(Number(num.value)));
      row.append(name, num, range);
      fields.append(row);
      this.inputs.set(key, { range, num });
      this.sync(key);
    }

    root.querySelector('#tuning-reset')!.addEventListener('click', () => this.replace(defaultTuning()));
    root.querySelector('#tuning-copy')!.addEventListener('click', () => {
      void navigator.clipboard?.writeText(JSON.stringify(this.tuning, null, 2));
    });
    root.querySelector('#tuning-paste')!.addEventListener('click', async () => {
      let text: string | null = null;
      try {
        text = (await navigator.clipboard?.readText()) ?? null;
      } catch {
        text = null;
      }
      if (!text) text = window.prompt('Paste tuning JSON');
      if (!text) return;
      try {
        this.replace(sanitizeTuning(JSON.parse(text)));
      } catch {
        window.alert('That does not look like tuning settings.');
      }
    });
  }

  private replace(next: Tuning): void {
    Object.assign(this.tuning, next);
    for (const key of TUNING_KEYS) this.sync(key);
    saveTuning(this.tuning);
  }

  private sync(key: TuningKey): void {
    const els = this.inputs.get(key);
    if (!els) return;
    const v = this.tuning[key];
    els.range.value = String(v);
    els.num.value = v.toFixed(decimals(TUNING_SPECS[key].step));
  }

  open(): void {
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }
}
