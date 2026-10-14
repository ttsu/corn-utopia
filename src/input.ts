import type { PowerKind } from './sim/kernels';
import type { InputCommand } from './sim/world';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
}

export function screenToWorld(cam: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: cam.x + (sx - cam.width / 2) / cam.zoom, y: cam.y + (sy - cam.height / 2) / cam.zoom };
}

export interface JoystickState {
  originX: number;
  originY: number;
  x: number;
  y: number;
}

const JOYSTICK_RADIUS = 60;
const KEY_POWERS: Record<string, PowerKind> = { Digit1: 'zinger', Digit2: 'spicy', Digit3: 'popper' };

/**
 * Turns touch, mouse, and keyboard into one InputCommand per tick. Tracks several pointers at
 * once so the joystick and power buttons work together.
 */
export class Input {
  joystick: (JoystickState & { pointerId: number }) | null = null;
  private keys = new Set<string>();
  private queuedFire: PowerKind[] = [];
  private queuedTap: { x: number; y: number } | null = null;
  private queuedCycle = false;
  enabled = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private onPauseKey: () => void,
  ) {
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.joystick = null;
    });
  }

  queueFire(kind: PowerKind): void {
    if (this.enabled) this.queuedFire.push(kind);
  }

  reset(): void {
    this.joystick = null;
    this.queuedFire.length = 0;
    this.queuedTap = null;
    this.queuedCycle = false;
  }

  private onDown = (e: PointerEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < rect.width / 2) {
      if (this.joystick) return;
      this.joystick = { pointerId: e.pointerId, originX: x, originY: y, x, y };
      this.canvas.setPointerCapture(e.pointerId);
    } else {
      this.queuedTap = { x, y };
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.joystick || e.pointerId !== this.joystick.pointerId) return;
    const rect = this.canvas.getBoundingClientRect();
    this.joystick.x = e.clientX - rect.left;
    this.joystick.y = e.clientY - rect.top;
    const dx = this.joystick.x - this.joystick.originX;
    const dy = this.joystick.y - this.joystick.originY;
    const d = Math.hypot(dx, dy);
    // Let the joystick base follow a thumb that drifts far past the edge.
    if (d > JOYSTICK_RADIUS * 1.6) {
      const pull = d - JOYSTICK_RADIUS * 1.6;
      this.joystick.originX += (dx / d) * pull;
      this.joystick.originY += (dy / d) * pull;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (this.joystick && e.pointerId === this.joystick.pointerId) this.joystick = null;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.onPauseKey();
      return;
    }
    if (!this.enabled) return;
    if (e.code === 'Tab') {
      e.preventDefault();
      this.queuedCycle = true;
      return;
    }
    const power = KEY_POWERS[e.code];
    if (power && !e.repeat) this.queuedFire.push(power);
    this.keys.add(e.code);
  };

  /** Joystick output in -1..1, for drawing. */
  joystickVector(): { x: number; y: number } {
    if (!this.joystick) return { x: 0, y: 0 };
    const dx = (this.joystick.x - this.joystick.originX) / JOYSTICK_RADIUS;
    const dy = (this.joystick.y - this.joystick.originY) / JOYSTICK_RADIUS;
    const m = Math.hypot(dx, dy);
    return m > 1 ? { x: dx / m, y: dy / m } : { x: dx, y: dy };
  }

  get joystickRadius(): number {
    return JOYSTICK_RADIUS;
  }

  sample(cam: Camera): InputCommand {
    let mx = 0;
    let my = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) my -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) my += 1;
    if (mx === 0 && my === 0) {
      const v = this.joystickVector();
      const m = Math.hypot(v.x, v.y);
      if (m > 0.12) {
        mx = v.x;
        my = v.y;
      }
    }
    const cmd: InputCommand = {
      moveX: mx,
      moveY: my,
      fire: this.queuedFire.splice(0),
      lockAt: this.queuedTap ? screenToWorld(cam, this.queuedTap.x, this.queuedTap.y) : null,
      cycleTarget: this.queuedCycle,
    };
    this.queuedTap = null;
    this.queuedCycle = false;
    return cmd;
  }
}
