import { DAMAGE_ICON, KERNELS, POWER_DAMAGE, POWER_KINDS, type PowerKind } from '../sim/kernels';
import { canFire, heartLocked, rechargeSeconds, type World } from '../sim/world';

interface ButtonEls {
  root: HTMLButtonElement;
  ring: HTMLDivElement;
  count: HTMLSpanElement;
  last: string;
}

/** Fixed places, thumb outward. Index matches POWER_KINDS, so a power never changes buttons. */
const ARC: { x: number; y: number; size: number }[] = [
  { x: 0, y: 0, size: 92 },
  { x: 104, y: 4, size: 76 },
  { x: 8, y: 104, size: 76 },
  { x: 96, y: 92, size: 68 },
  { x: 168, y: 28, size: 64 },
];

/**
 * One button per power you've picked up, always in that power's place.
 * An armed button fires. A dimmed one is waiting; tapping it arms that power
 * (the sim trades it in) without moving any button.
 */
export class PowerButtons {
  private buttons: ButtonEls[] = [];
  private hint: HTMLDivElement;
  private signature = '';

  constructor(
    private container: HTMLElement,
    private onPress: (kind: PowerKind) => void,
  ) {
    this.hint = document.createElement('div');
    this.hint.className = 'power-hint';
    this.hint.textContent = 'Chomp a snack to get a power';
    this.container.append(this.hint);
  }

  update(w: World): void {
    const pockets = w.player.pockets;
    const waiting = w.player.waiting;
    const shown = POWER_KINDS.filter((k) => pockets.includes(k) || waiting.includes(k));
    const signature = shown.map((k) => `${k}:${waiting.includes(k) ? 'wait' : 'on'}`).join(',');
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild(shown, waiting);
    }
    this.hint.hidden = shown.length > 0;
    const locked = heartLocked(w);
    for (const b of this.buttons) {
      const kind = b.root.dataset.kind as PowerKind;
      const benched = waiting.includes(kind);
      const n = w.player.kernels[kind];
      const cd = w.player.cooldowns[kind];
      const frac = cd > 0 ? cd / rechargeSeconds(w, kind) : 0;
      const state = benched ? 'benched' : n === 0 ? 'empty' : locked ? 'locked' : canFire(w, kind) ? 'ready' : 'charging';
      const key = `${n}|${state}|${Math.round(frac * 40)}`;
      if (key === b.last) continue;
      b.last = key;
      b.count.textContent = String(n);
      b.root.setAttribute('aria-label', benched ? `${KERNELS[kind].name}, tap to arm` : KERNELS[kind].name);
      b.root.classList.toggle('benched', state === 'benched');
      b.root.classList.toggle('empty', state === 'empty');
      b.root.classList.toggle('locked', state === 'locked');
      b.ring.style.background = !benched && frac > 0 ? `conic-gradient(rgba(0,0,0,0.45) ${frac * 360}deg, transparent 0deg)` : 'transparent';
    }
  }

  private rebuild(shown: readonly PowerKind[], waiting: readonly PowerKind[]): void {
    for (const b of this.buttons) b.root.remove();
    this.buttons = [];
    for (const kind of shown) {
      const spot = ARC[Math.min(POWER_KINDS.indexOf(kind), ARC.length - 1)];
      const def = KERNELS[kind];
      const benched = waiting.includes(kind);
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'power';
      root.dataset.kind = kind;
      root.setAttribute('aria-label', benched ? `${def.name}, tap to arm` : def.name);
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
      root.append(ring, icon, count, label);
      root.addEventListener('pointerdown', (e) => {
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
      this.buttons.push({ root, ring, count, last: '' });
    }
  }
}
