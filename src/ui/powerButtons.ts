import { DAMAGE_ICON, KERNELS, POWER_DAMAGE, POWER_KINDS, type PowerKind } from '../sim/kernels';
import { canFire, heartLocked, rechargeSeconds, type World } from '../sim/world';

interface ButtonEls {
  root: HTMLButtonElement;
  ring: HTMLDivElement;
  count: HTMLSpanElement;
  last: string;
}

/**
 * One button per power type. Fires on pointerdown (not release) so it feels instant,
 * and each button tracks its own pointer so it works while the other thumb steers.
 */
export class PowerButtons {
  private buttons = new Map<PowerKind, ButtonEls>();

  constructor(container: HTMLElement, onPress: (kind: PowerKind) => void) {
    for (const kind of POWER_KINDS) {
      const def = KERNELS[kind];
      const root = document.createElement('button');
      root.className = 'power';
      root.setAttribute('aria-label', def.name);
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
        onPress(kind);
      });
      const release = () => root.classList.remove('pressed');
      root.addEventListener('pointerup', release);
      root.addEventListener('pointercancel', release);
      root.addEventListener('pointerleave', release);
      root.addEventListener('contextmenu', (e) => e.preventDefault());
      container.append(root);
      this.buttons.set(kind, { root, ring, count, last: '' });
    }
  }

  update(w: World): void {
    const locked = heartLocked(w);
    for (const kind of POWER_KINDS) {
      const b = this.buttons.get(kind)!;
      const n = w.player.kernels[kind];
      const cd = w.player.cooldowns[kind];
      const frac = cd > 0 ? cd / rechargeSeconds(w, kind) : 0;
      const state = n === 0 ? 'empty' : locked ? 'locked' : canFire(w, kind) ? 'ready' : 'charging';
      const key = `${n}|${state}|${Math.round(frac * 40)}`;
      if (key === b.last) continue;
      b.last = key;
      b.count.textContent = String(n);
      b.root.classList.toggle('empty', state === 'empty');
      b.root.classList.toggle('locked', state === 'locked');
      b.ring.style.background =
        frac > 0 ? `conic-gradient(rgba(0,0,0,0.45) ${frac * 360}deg, transparent 0deg)` : 'transparent';
    }
  }
}
