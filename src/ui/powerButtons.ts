import { DAMAGE_ICON, KERNELS, POWER_DAMAGE, type PowerKind } from '../sim/kernels';
import { canFire, heartLocked, rechargeSeconds, type World } from '../sim/world';

interface ButtonEls {
  root: HTMLButtonElement;
  ring: HTMLDivElement;
  count: HTMLSpanElement;
  swap: HTMLDivElement;
  last: string;
}

/** Bigger buttons sit closer to the thumb. Up to five, which is the pocket cap. */
const ARC: { x: number; y: number; size: number }[] = [
  { x: 0, y: 0, size: 92 },
  { x: 104, y: 4, size: 76 },
  { x: 8, y: 104, size: 76 },
  { x: 96, y: 92, size: 68 },
  { x: 168, y: 28, size: 64 },
];

/**
 * One button per power in a pocket. Fires on pointerdown so it feels instant,
 * and each button tracks its own pointer so it works while the other thumb steers.
 * A swap arrow trades that pocket for the power waiting in line.
 */
export class PowerButtons {
  private buttons: ButtonEls[] = [];
  private waitingRow: HTMLDivElement;
  private hint: HTMLDivElement;
  private signature = '';

  constructor(
    private container: HTMLElement,
    private onPress: (kind: PowerKind) => void,
    private onSwap: (pocket: PowerKind, withKind: PowerKind) => void,
  ) {
    this.hint = document.createElement('div');
    this.hint.className = 'power-hint';
    this.hint.textContent = 'Chomp a snack to get a power';
    this.waitingRow = document.createElement('div');
    this.waitingRow.className = 'waiting';
    this.container.append(this.hint, this.waitingRow);
  }

  update(w: World): void {
    const pockets = w.player.pockets;
    const waiting = w.player.waiting;
    const signature = `${pockets.join(',')}|${waiting.join(',')}`;
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild(pockets, waiting);
    }
    this.hint.hidden = pockets.length > 0;
    const locked = heartLocked(w);
    pockets.forEach((kind, i) => {
      const b = this.buttons[i];
      if (!b) return;
      const n = w.player.kernels[kind];
      const cd = w.player.cooldowns[kind];
      const frac = cd > 0 ? cd / rechargeSeconds(w, kind) : 0;
      const state = n === 0 ? 'empty' : locked ? 'locked' : canFire(w, kind) ? 'ready' : 'charging';
      const key = `${n}|${state}|${Math.round(frac * 40)}|${waiting.length}`;
      if (key === b.last) return;
      b.last = key;
      b.count.textContent = String(n);
      b.root.classList.toggle('empty', state === 'empty');
      b.root.classList.toggle('locked', state === 'locked');
      b.swap.hidden = waiting.length === 0;
      b.ring.style.background = frac > 0 ? `conic-gradient(rgba(0,0,0,0.45) ${frac * 360}deg, transparent 0deg)` : 'transparent';
    });
  }

  private rebuild(pockets: readonly PowerKind[], waiting: readonly PowerKind[]): void {
    for (const b of this.buttons) b.root.remove();
    this.buttons = [];
    this.waitingRow.replaceChildren();
    pockets.forEach((kind, i) => {
      const spot = ARC[Math.min(i, ARC.length - 1)];
      const def = KERNELS[kind];
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'power';
      root.setAttribute('aria-label', def.name);
      root.style.width = `${spot.size}px`;
      root.style.height = `${spot.size}px`;
      root.style.right = `${spot.x}px`;
      root.style.bottom = `${spot.y}px`;
      const ring = document.createElement('div');
      ring.className = 'ring';
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.style.background = def.color;
      icon.textContent = DAMAGE_ICON[POWER_DAMAGE[kind]];
      const count = document.createElement('span');
      count.className = 'count';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = def.name;
      const swap = document.createElement('div');
      swap.className = 'swap';
      swap.textContent = '⇄';
      swap.setAttribute('role', 'button');
      swap.setAttribute('aria-label', `Swap ${def.name}`);
      swap.hidden = waiting.length === 0;
      swap.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = waiting[0];
        if (next) this.onSwap(kind, next);
      });
      root.append(ring, icon, count, label, swap);
      root.addEventListener('pointerdown', (e) => {
        if (e.target === swap) return;
        e.preventDefault();
        e.stopPropagation();
        root.classList.add('pressed');
        this.onPress(kind);
      });
      const release = () => root.classList.remove('pressed');
      root.addEventListener('pointerup', release);
      root.addEventListener('pointercancel', release);
      root.addEventListener('pointerleave', release);
      root.addEventListener('contextmenu', (e) => e.preventDefault());
      this.container.append(root);
      this.buttons.push({ root, ring, count, swap, last: '' });
    });

    for (const kind of waiting) {
      const def = KERNELS[kind];
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'wait-chip';
      chip.style.background = def.color;
      chip.textContent = DAMAGE_ICON[POWER_DAMAGE[kind]];
      chip.setAttribute('aria-label', `Waiting: ${def.name}`);
      chip.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pocket = pockets[0];
        if (pocket) this.onSwap(pocket, kind);
      });
      this.waitingRow.append(chip);
    }
  }
}
