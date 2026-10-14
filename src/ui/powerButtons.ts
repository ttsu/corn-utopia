import { DAMAGE_ICON, KERNELS, POWER_DAMAGE, POWER_KINDS, type PowerKind } from '../sim/kernels';
import { DASH_COOLDOWN, canFire, heartLocked, rechargeSeconds, type World } from '../sim/world';

interface ButtonEls {
  root: HTMLButtonElement;
  ring: HTMLDivElement;
  count: HTMLSpanElement;
  last: string;
}

/** The big button under the right thumb. Powers arc around it and never take this spot. */
const DASH_SPOT = { x: 0, y: 0, size: 96 };

/** Fixed places around the dash, thumb outward. Index matches POWER_KINDS. */
const ARC: { x: number; y: number; size: number }[] = [
  { x: 108, y: 4, size: 74 },
  { x: 8, y: 108, size: 74 },
  { x: 100, y: 100, size: 66 },
  { x: 176, y: 36, size: 62 },
  { x: 16, y: 184, size: 58 },
];

/**
 * One button per power you've picked up, always in that power's place.
 * An armed button fires. A dimmed one is waiting; tapping it arms that power
 * (the sim trades it in) without moving any button.
 */
export class PowerButtons {
  private buttons: ButtonEls[] = [];
  private hint: HTMLDivElement;
  private dash: { root: HTMLButtonElement; ring: HTMLDivElement; last: string };
  private signature = '';

  constructor(
    private container: HTMLElement,
    private onPress: (kind: PowerKind) => void,
    private onDash: () => void,
  ) {
    this.hint = document.createElement('div');
    this.hint.className = 'power-hint';
    this.hint.textContent = 'Chomp a snack to get a power';
    this.dash = this.makeDash();
    this.container.append(this.hint, this.dash.root);
  }

  private makeDash(): { root: HTMLButtonElement; ring: HTMLDivElement; last: string } {
    const root = document.createElement('button');
    root.type = 'button';
    root.className = 'power dash';
    root.setAttribute('aria-label', 'Dash');
    root.style.width = `${DASH_SPOT.size}px`;
    root.style.height = `${DASH_SPOT.size}px`;
    root.style.right = `${DASH_SPOT.x}px`;
    root.style.bottom = `${DASH_SPOT.y}px`;
    const ring = document.createElement('div');
    ring.className = 'ring';
    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = '💨';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = 'Dash';
    root.append(ring, icon, label);
    root.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      root.classList.add('pressed');
      this.onDash();
    });
    const release = () => root.classList.remove('pressed');
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);
    root.addEventListener('pointerleave', release);
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    return { root, ring, last: '' };
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
    const dashFrac = w.player.dashCd > 0 ? w.player.dashCd / DASH_COOLDOWN : 0;
    const dashKey = `${Math.round(dashFrac * 40)}|${w.player.dashTime > 0 ? 'go' : 'ready'}`;
    if (dashKey !== this.dash.last) {
      this.dash.last = dashKey;
      this.dash.root.classList.toggle('cooling', dashFrac > 0);
      this.dash.ring.style.background = dashFrac > 0 ? `conic-gradient(rgba(0,0,0,0.45) ${dashFrac * 360}deg, transparent 0deg)` : 'transparent';
    }
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
