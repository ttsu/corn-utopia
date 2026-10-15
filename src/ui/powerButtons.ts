import { DAMAGE_ICON, KERNELS, POWER_DAMAGE, POWER_KINDS, type PowerKind } from '../sim/kernels';
import { milestoneName } from '../sim/milestones';
import { DASH_COOLDOWN, canFire, heartLocked, powerMilestone, rechargeSeconds, type World } from '../sim/world';

interface ButtonEls {
  root: HTMLButtonElement;
  ring: HTMLDivElement;
  count: HTMLSpanElement;
  last: string;
}

/** The big button under the right thumb. Powers arc around it and never take this spot. */
const DASH_SPOT = { x: 0, y: 0, size: 96 };

const BUTTON_SIZE = 68;
/**
 * Center-to-center distance from the dash to the buttons that flank it
 * (one to the left, one above). Close enough to sit under the thumb,
 * far enough that the circle clears the dash.
 */
const FLANK_DISTANCE = 116;
/**
 * How far the middle of the arc bows out past the straight line between
 * the flanks. The bow is what lets every gap match without the buttons
 * stacking on the same two rays.
 */
const BULGE = 78;

export interface ArcSpot {
  /** CSS `right`, px from the cluster's bottom-right corner. */
  x: number;
  /** CSS `bottom`. */
  y: number;
  size: number;
  /** From the dash center: 0 points left, increasing toward up. */
  angle: number;
}

/** One fixed place per power, in POWER_KINDS order. */
const ARC_SLOTS = 4;

/**
 * Fixed places around the dash, thumb outward. Index matches POWER_KINDS.
 * Centers are equal steps on one circle, so the edge gaps match. The circle
 * bows around the dash: the first and last buttons flank it, and the middle
 * bows out into the field.
 */
export function powerButtonArc(slots = ARC_SLOTS, buttonSize = BUTTON_SIZE): ArcSpot[] {
  const d = FLANK_DISTANCE;
  const h = BULGE;
  const halfChord = d / Math.SQRT2;
  const radius = (h * h + halfChord * halfChord) / (2 * h);
  const mid = d / 2;
  const center = mid - (radius - h) / Math.SQRT2;
  const start = Math.atan2(-center, d - center);
  let sweep = Math.atan2(d - center, -center) - start;
  if (sweep > Math.PI) sweep -= Math.PI * 2;
  if (sweep < -Math.PI) sweep += Math.PI * 2;
  const origin = DASH_SPOT.size / 2;
  const spots: ArcSpot[] = [];
  for (let i = 0; i < slots; i++) {
    const t = slots === 1 ? 0.5 : i / (slots - 1);
    const a = start + sweep * t;
    const relX = center + radius * Math.cos(a);
    const relY = center + radius * Math.sin(a);
    spots.push({
      x: origin + relX - buttonSize / 2,
      y: origin + relY - buttonSize / 2,
      size: buttonSize,
      angle: Math.atan2(relY, relX),
    });
  }
  return spots;
}

const INNER = powerButtonArc(5, 58);
const OUTER = powerButtonArc(4, 50);

function spotForPower(kind: PowerKind): ArcSpot {
  const i = POWER_KINDS.indexOf(kind);
  if (i < INNER.length) return INNER[i];
  const outer = OUTER[Math.min(OUTER.length - 1, i - INNER.length)];
  const dash = DASH_SPOT.size / 2;
  const cx = outer.x + outer.size / 2;
  const cy = outer.y + outer.size / 2;
  const dx = cx - dash;
  const dy = cy - dash;
  const dist = Math.hypot(dx, dy) || 1;
  const push = 74;
  return { ...outer, x: outer.x + (dx / dist) * push, y: outer.y + (dy / dist) * push };
}

/** Names sit just outside the button, away from the dash, so they don't land on a neighbor. */
export function labelOffset(angle: number, size: number): { x: number; y: number } {
  const out = size / 2 + 16;
  return { x: -Math.cos(angle) * out, y: -Math.sin(angle) * out };
}

/**
 * One button per power you've picked up, always in that power's place.
 * An armed button fires. A dimmed one is waiting; tapping it arms that power
 * (the sim trades it in) without moving any button.
 */
export class PowerButtons {
  private buttons: ButtonEls[] = [];
  private hint: HTMLDivElement;
  private dash: { root: HTMLButtonElement; ring: HTMLDivElement; last: string };
  smart = false;
  dragAim = false;
  leftHanded = false;
  private smartBtn: HTMLButtonElement | null = null;
  private drag: { kind: PowerKind; x: number; y: number } | null = null;
  private signature = '';

  constructor(
    private container: HTMLElement,
    private onPress: (kind: PowerKind) => void,
    private onDash: () => void,
    private onSmart: () => void,
    private onAim: (kind: PowerKind, clientX: number, clientY: number) => void,
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
    const signature = `${this.smart ? 'smart' : 'arc'}|${this.leftHanded ? 'L' : 'R'}|` + shown.map((k) => `${k}:${waiting.includes(k) ? 'wait' : 'on'}`).join(',');
    if (signature !== this.signature) {
      this.signature = signature;
      this.rebuild(shown, waiting);
    }
    this.container.classList.toggle('lefty', this.leftHanded);
    this.dash.root.style.right = this.leftHanded ? 'auto' : '0px';
    this.dash.root.style.left = this.leftHanded ? '0px' : 'auto';
    this.hint.hidden = shown.length > 0 || this.smart;
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
      const level = powerMilestone(w, kind);
      const named = milestoneName(kind, level);
      const key = `${n}|${state}|${Math.round(frac * 40)}|${level}`;
      if (key === b.last) continue;
      b.last = key;
      b.count.textContent = String(n);
      b.root.setAttribute('aria-label', benched ? `${KERNELS[kind].name}, tap to arm` : named ? `${KERNELS[kind].name} ${named}` : KERNELS[kind].name);
      b.root.classList.toggle('benched', state === 'benched');
      b.root.classList.toggle('empty', state === 'empty');
      b.root.classList.toggle('locked', state === 'locked');
      b.root.classList.toggle('mile', level > 0);
      b.ring.style.background = !benched && frac > 0 ? `conic-gradient(rgba(0,0,0,0.45) ${frac * 360}deg, transparent 0deg)` : 'transparent';
    }
  }

  private rebuild(shown: readonly PowerKind[], waiting: readonly PowerKind[]): void {
    for (const b of this.buttons) b.root.remove();
    this.buttons = [];
    this.smartBtn?.remove();
    this.smartBtn = null;
    if (this.smart) {
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'power smart-fire';
      root.textContent = 'Fire';
      root.setAttribute('aria-label', 'Smart Fire');
      root.style.width = '84px';
      root.style.height = '84px';
      root.style.bottom = '108px';
      root.style.right = this.leftHanded ? 'auto' : '8px';
      root.style.left = this.leftHanded ? '8px' : 'auto';
      root.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        root.classList.add('pressed');
        this.onSmart();
      });
      root.addEventListener('pointerup', () => root.classList.remove('pressed'));
      root.addEventListener('pointercancel', () => root.classList.remove('pressed'));
      root.addEventListener('contextmenu', (e) => e.preventDefault());
      this.container.append(root);
      this.smartBtn = root;
      return;
    }
    for (const kind of shown) {
      const spot = spotForPower(kind);
      const def = KERNELS[kind];
      const benched = waiting.includes(kind);
      const root = document.createElement('button');
      root.type = 'button';
      root.className = 'power';
      root.dataset.kind = kind;
      root.setAttribute('aria-label', benched ? `${def.name}, tap to arm` : def.name);
      root.style.width = `${spot.size}px`;
      root.style.height = `${spot.size}px`;
      root.style.bottom = `${spot.y}px`;
      root.style.right = this.leftHanded ? 'auto' : `${spot.x}px`;
      root.style.left = this.leftHanded ? `${spot.x}px` : 'auto';
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
      const offset = labelOffset(spot.angle, spot.size);
      label.style.left = `calc(50% + ${offset.x}px)`;
      label.style.top = `calc(50% + ${offset.y}px)`;
      label.style.bottom = 'auto';
      label.style.transform = 'translate(-50%, -50%)';
      root.append(ring, icon, count, label);
      root.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.dragAim) {
          this.drag = { kind, x: e.clientX, y: e.clientY };
          root.setPointerCapture(e.pointerId);
          return;
        }
        root.classList.add('pressed');
        this.onPress(kind);
      });
      const release = (e: PointerEvent) => {
        root.classList.remove('pressed');
        if (!this.drag || this.drag.kind !== kind) return;
        const moved = Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y);
        const from = this.drag;
        this.drag = null;
        if (moved > 18) this.onAim(from.kind, e.clientX, e.clientY);
        else this.onPress(from.kind);
      };
      root.addEventListener('pointerup', release);
      root.addEventListener('pointercancel', () => {
        this.drag = null;
        root.classList.remove('pressed');
      });
      root.addEventListener('contextmenu', (e) => e.preventDefault());
      this.container.append(root);
      this.buttons.push({ root, ring, count, last: '' });
    }
  }
}
