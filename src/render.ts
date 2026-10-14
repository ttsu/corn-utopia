import type { Camera, Input } from './input';
import { dominantPlain, shieldBadges, total, type Kernels } from './sim/cob';
import { DAMAGE_ICON, KERNEL_KINDS, KERNELS, isPower, type KernelKind } from './sim/kernels';
import { viewRadius, type Enemy, type SimEvent, type World } from './sim/world';

const PLAYER_COLOR = '#3a86ff';
const GREEN = '#22b24c';
const RED = '#e5383b';
const BODY_TINT: Record<string, string> = { sunny: '#fff1b8', soggy: '#b6efe8', stony: '#d3d8e0' };

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  ttl: number;
  max: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  max: number;
  color: string;
  size: number;
  square: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  ttl: number;
  max: number;
  color: string;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Unit-circle kernel slots for a cob with n slots, ordered top-to-bottom. */
const slotCache = new Map<number, Float32Array>();
function slotsFor(n: number): Float32Array {
  const cached = slotCache.get(n);
  if (cached) return cached;
  let s = Math.sqrt(Math.PI / (Math.max(n, 1) * 0.866)) * 0.9;
  let pts: [number, number][] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    pts = [];
    const lim = 1 - s * 0.55;
    for (let row = 0, y = -1; y <= 1; row++, y += s * 0.866) {
      const off = row % 2 ? s / 2 : 0;
      for (let x = -1 + off; x <= 1; x += s) if (x * x + y * y <= lim * lim) pts.push([x, y]);
    }
    if (pts.length >= n) break;
    s *= 0.96;
  }
  pts.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
  pts = pts.slice(0, n).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out = new Float32Array(n * 3);
  pts.forEach(([x, y], i) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = s * 0.42;
  });
  slotCache.set(n, out);
  return out;
}

/** Kernels in draw order: power kernels first (they sit in the top band), then plain. */
function kernelOrder(k: Kernels): KernelKind[] {
  const out: KernelKind[] = [];
  for (const kind of KERNEL_KINDS) if (isPower(kind)) for (let i = 0; i < k[kind]; i++) out.push(kind);
  for (const kind of KERNEL_KINDS) if (!isPower(kind)) for (let i = 0; i < k[kind]; i++) out.push(kind);
  return out;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  readonly cam: Camera = { x: 0, y: 0, zoom: 1, width: 1, height: 1 };
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private shake = 0;
  private dpr = 1;
  reduceShake = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
    this.cam.width = rect.width;
    this.cam.height = rect.height;
  }

  snapCamera(w: World): void {
    this.cam.x = w.player.x;
    this.cam.y = w.player.y;
    this.cam.zoom = this.targetZoom(w);
    this.floaters = [];
    this.particles = [];
    this.rings = [];
  }

  private targetZoom(w: World): number {
    // Area-based so narrow phone screens don't zoom out so far that cobs become specks.
    return Math.sqrt(this.cam.width * this.cam.height) / (2.3 * viewRadius(w.player));
  }

  private floater(x: number, y: number, text: string, color: string, size = 18, ttl = 0.8): void {
    this.floaters.push({ x, y, text, color, size, ttl, max: ttl });
  }

  private burst(x: number, y: number, color: string, count: number, speed: number, square = false): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const ttl = 0.3 + Math.random() * 0.3;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ttl, max: ttl, color, size: 3 + Math.random() * 3, square });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'tink':
          this.floater(e.x, e.y - 8, `🛡 tink!`, '#ffffff', 20, 0.9);
          break;
        case 'hit':
          if (e.onPlayer) {
            this.floater(e.x, e.y - 30, `-${e.count}`, RED, 20);
            this.shake = Math.max(this.shake, 6);
          } else {
            this.floater(e.x, e.y - 6, e.weak ? `${DAMAGE_ICON[e.damage]} x2!` : `${DAMAGE_ICON[e.damage]} pop!`, e.weak ? '#ffe066' : '#ffffff', e.weak ? 24 : 17);
          }
          this.burst(e.x, e.y, '#fff3b0', 6, 160);
          break;
        case 'explode':
          this.rings.push({ x: e.x, y: e.y, r: e.r, ttl: 0.35, max: 0.35, color: '#fff8e1' });
          this.burst(e.x, e.y, '#fff8e1', 14, 260, true);
          this.shake = Math.max(this.shake, 4);
          break;
        case 'poof':
          this.burst(e.x, e.y, '#e9f5db', 16, 200);
          this.floater(e.x, e.y, 'poof!', '#ffffff', 16);
          break;
        case 'chomp':
          this.floater(e.x, e.y - 10, e.streak > 1 ? `NOM x${e.streak}!` : 'NOM!', GREEN, 26 + Math.min(e.streak, 6) * 2, 0.9);
          this.burst(e.x, e.y, '#ffd23f', 18, 240);
          this.shake = Math.max(this.shake, 5);
          break;
        case 'turnGreen':
          this.floater(e.x, e.y - 10, 'yum!', GREEN, 16, 0.7);
          break;
        case 'tierUp':
          this.floater(this.cam.x, this.cam.y - 60 / this.cam.zoom, `Size ${e.tier}!`, '#ffffff', 30, 1.4);
          break;
        case 'bare':
          this.floater(this.cam.x, this.cam.y - 50 / this.cam.zoom, 'Uh-oh! Grab a kernel!', '#ffffff', 24, 1.6);
          break;
        case 'saved':
          this.floater(this.cam.x, this.cam.y - 50 / this.cam.zoom, 'Phew!', GREEN, 26, 1);
          break;
        default:
          break;
      }
    }
  }

  draw(w: World, alpha: number, input: Input, dt: number, time: number): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const p = w.player;
    const px = lerp(p.px, p.x, alpha);
    const py = lerp(p.py, p.y, alpha);

    const follow = 1 - Math.exp(-10 * dt);
    cam.x = lerp(cam.x, px, follow);
    cam.y = lerp(cam.y, py, follow);
    cam.zoom = lerp(cam.zoom, this.targetZoom(w), 1 - Math.exp(-2.5 * dt));

    this.shake = Math.max(0, this.shake - dt * 30);
    const sh = this.reduceShake ? 0 : this.shake;
    const shx = (Math.random() - 0.5) * sh;
    const shy = (Math.random() - 0.5) * sh;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#9fd36b';
    ctx.fillRect(0, 0, cam.width, cam.height);

    ctx.save();
    ctx.translate(cam.width / 2 + shx, cam.height / 2 + shy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    this.drawField();

    const halfW = cam.width / 2 / cam.zoom + 60;
    const halfH = cam.height / 2 / cam.zoom + 60;
    const visible = (x: number, y: number, r: number) => Math.abs(x - cam.x) < halfW + r && Math.abs(y - cam.y) < halfH + r;

    // Burn patches.
    for (const patch of w.patches) {
      if (!visible(patch.x, patch.y, patch.r)) continue;
      ctx.globalAlpha = Math.min(1, patch.ttl * 2) * (0.35 + 0.1 * Math.sin(time * 20 + patch.id));
      ctx.fillStyle = '#ff7b00';
      ctx.beginPath();
      ctx.arc(patch.x, patch.y, patch.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ground kernels.
    for (const g of w.ground) {
      const gx = lerp(g.px, g.x, alpha);
      const gy = lerp(g.py, g.y, alpha);
      if (!visible(gx, gy, 20)) continue;
      const size = 5 + Math.min(g.value - 1, 9) * 0.9;
      const land = g.age < 0.25 ? 1 + Math.sin((g.age / 0.25) * Math.PI) * 0.5 : 1;
      if (g.delay <= 0) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 5 + g.id);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gx, gy, size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (g.sparkle > 0) {
        ctx.strokeStyle = PLAYER_COLOR;
        ctx.globalAlpha = Math.min(1, g.sparkle);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gx, gy, size * 2.4 + Math.sin(time * 10) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      this.drawKernel(g.kind, gx, gy, size * land, size / land);
      if (g.value > 1) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(g.value), gx, gy + size + 10);
      }
    }

    // Player shots.
    for (const s of w.shots) {
      const sx = lerp(s.px, s.x, alpha);
      const sy = lerp(s.py, s.y, alpha);
      const color = KERNELS[s.kind].color;
      if (s.lob) {
        const f = Math.min(1, s.lob.t / s.lob.dur);
        const h = Math.sin(Math.PI * f) * 70;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(sx, sy, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        this.drawKernel(s.kind, sx, sy - h, 8, 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(s.lob.tx, s.lob.ty, w.tuning.popperRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        continue;
      }
      const sp = Math.hypot(s.vx, s.vy) || 1;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = s.r * 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - (s.vx / sp) * 26, sy - (s.vy / sp) * 26);
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      this.drawKernel(s.kind, sx, sy, s.r, s.r);
      ctx.globalAlpha = 1;
    }

    // Enemies.
    for (const e of w.enemies) {
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      if (!visible(ex, ey, e.r + 30)) continue;
      this.drawEnemy(e, ex, ey, time);
    }

    this.drawPlayer(w, px, py, time);

    // Target ring.
    const target = p.targetId !== null ? w.enemies.find((e) => e.id === p.targetId) : undefined;
    if (target) {
      const tx = lerp(target.px, target.x, alpha);
      const ty = lerp(target.py, target.y, alpha);
      const locked = p.lockedTargetId === target.id;
      const rr = target.r + 9 + Math.sin(time * 8) * 2.5;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(time * 1.5);
      ctx.strokeStyle = locked ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = locked ? 4 : 3;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      if (locked) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔒', tx + rr * 0.75, ty - rr * 0.75);
      }
      if (!target.chompable && !p.bare) {
        const need = total(target.kernels) - total(p.kernels) + 1;
        this.drawChompMeter(tx, ty + rr + 10, need);
      }
    }

    // Particles, rings, floaters.
    for (const ring of this.rings) {
      ring.ttl -= dt;
      const f = 1 - ring.ttl / ring.max;
      ctx.globalAlpha = Math.max(0, 1 - f);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 6 * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r * (0.4 + 0.6 * f), 0, Math.PI * 2);
      ctx.stroke();
    }
    this.rings = this.rings.filter((r) => r.ttl > 0);
    for (const pt of this.particles) {
      pt.ttl -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      ctx.globalAlpha = Math.max(0, pt.ttl / pt.max);
      ctx.fillStyle = pt.color;
      if (pt.square) ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.particles = this.particles.filter((pt) => pt.ttl > 0);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floaters) {
      f.ttl -= dt;
      f.y -= 40 * dt;
      const k = f.ttl / f.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      const size = f.size / cam.zoom ** 0.5;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.font = `900 ${size * pop}px system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    this.floaters = this.floaters.filter((f) => f.ttl > 0);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';

    ctx.restore();

    this.drawJoystick(input);
  }

  private drawField(): void {
    const ctx = this.ctx;
    const cam = this.cam;
    const halfW = cam.width / 2 / cam.zoom;
    const halfH = cam.height / 2 / cam.zoom;
    const step = 120;
    ctx.strokeStyle = 'rgba(60,110,40,0.18)';
    ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath();
    for (let x = Math.floor((cam.x - halfW) / step) * step; x <= cam.x + halfW; x += step) {
      ctx.moveTo(x, cam.y - halfH);
      ctx.lineTo(x, cam.y + halfH);
    }
    for (let y = Math.floor((cam.y - halfH) / step) * step; y <= cam.y + halfH; y += step) {
      ctx.moveTo(cam.x - halfW, y);
      ctx.lineTo(cam.x + halfW, y);
    }
    ctx.stroke();
  }

  private drawKernel(kind: KernelKind, x: number, y: number, sx: number, sy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = KERNELS[kind].color;
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 1.5;
    if (isPower(kind)) {
      ctx.fillRect(x - sx, y - sy, sx * 2, sy * 2);
      ctx.strokeRect(x - sx, y - sy, sx * 2, sy * 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, sx, sy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Draws a cob body with its kernels in sockets. `sockets` > kernel count shows empty holes. */
  private drawCobBody(x: number, y: number, r: number, k: Kernels, sockets: number, tint: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const order = kernelOrder(k);
    const n = Math.max(sockets, order.length);
    if (n === 0) return;
    const slots = slotsFor(n);
    const inner = r * 0.9;
    const dot = slots[2] * inner;
    if (dot * this.cam.zoom < 1.2) return;
    for (let i = 0; i < n; i++) {
      const kx = x + slots[i * 3] * inner;
      const ky = y + slots[i * 3 + 1] * inner;
      const kind = order[i];
      if (kind === undefined) {
        ctx.fillStyle = 'rgba(80,60,20,0.35)';
        ctx.beginPath();
        ctx.arc(kx, ky, dot * 0.6, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = KERNELS[kind].color;
      if (isPower(kind)) {
        ctx.fillRect(kx - dot * 0.85, ky - dot * 0.85, dot * 1.7, dot * 1.7);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.8, dot * 0.25);
        ctx.strokeRect(kx - dot * 0.85, ky - dot * 0.85, dot * 1.7, dot * 1.7);
      } else {
        ctx.beginPath();
        ctx.arc(kx, ky, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawEyes(x: number, y: number, r: number, lookX: number, lookY: number, mood: 'happy' | 'angry' | 'worried' | 'surprised'): void {
    const ctx = this.ctx;
    const er = Math.max(2.5, r * 0.22);
    const ey = y - r * 0.15;
    const m = Math.hypot(lookX, lookY) || 1;
    const lx = (lookX / m) * er * 0.35;
    const ly = (lookY / m) * er * 0.35;
    for (const side of [-1, 1]) {
      const ex = x + side * r * 0.32;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2b2b2b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.arc(ex + lx, ey + ly, er * (mood === 'surprised' ? 0.3 : 0.5), 0, Math.PI * 2);
      ctx.fill();
      if (mood === 'angry' || mood === 'worried') {
        ctx.lineWidth = Math.max(1.5, er * 0.35);
        ctx.beginPath();
        const tilt = mood === 'angry' ? 1 : -1;
        ctx.moveTo(ex - side * er, ey - er * 1.3 - tilt * er * 0.4);
        ctx.lineTo(ex + side * er, ey - er * 1.3 + tilt * er * 0.4);
        ctx.stroke();
      }
    }
  }

  private drawEnemy(e: Enemy, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    const bob = Math.sin(time * 6 + e.id) * e.r * 0.04;
    const cy = y + bob;
    const color = e.chompable ? GREEN : RED;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + e.r * 0.85, e.r * 0.9, e.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawCobBody(x, cy, e.r, e.kernels, 0, e.hitFlash > 0 ? '#ffffff' : BODY_TINT[dominantPlain(e.kernels)]);

    ctx.strokeStyle = color;
    ctx.lineWidth = e.chompable ? 4 : 4.5;
    ctx.beginPath();
    if (e.chompable) {
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const rr = e.r + 2 + Math.sin(a * 6 + time * 10) * 1.6;
        const ax = x + Math.cos(a) * rr;
        const ay = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(ax, ay);
        else ctx.lineTo(ax, ay);
      }
    } else {
      ctx.arc(x, cy, e.r + 2, 0, Math.PI * 2);
    }
    ctx.stroke();

    this.drawEyes(x, cy, e.r, e.vx, e.vy, e.chompable ? 'worried' : 'angry');

    const badges = shieldBadges(e.kernels);
    if (badges.length > 0) {
      const text = badges.map((b) => `🛡${DAMAGE_ICON[b]}`).join(' ');
      ctx.font = `bold ${Math.max(11, 13 / this.cam.zoom ** 0.4)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(text).width;
      const by = cy - e.r - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.roundRect(x - tw / 2 - 5, by - 11, tw + 10, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(text, x, by + 3);
    }
  }

  private drawPlayer(w: World, x: number, y: number, time: number): void {
    const ctx = this.ctx;
    const p = w.player;
    const n = total(p.kernels);
    const flashing = p.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    const wobble = p.invuln > 0 ? Math.sin(time * 40) * 2 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, y + p.r * 0.85, p.r, p.r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    if (n <= 1 || p.bare) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 8);
      ctx.fillStyle = `rgba(255,80,80,${0.25 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, p.r + 10 + pulse * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = flashing ? 0.5 : 1;
    const tint = p.bare ? '#f4efe1' : BODY_TINT[dominantPlain(p.kernels)];
    this.drawCobBody(x + wobble, y, p.r, p.kernels, p.sockets, tint);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x + wobble, y, p.r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = PLAYER_COLOR;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const mood = p.bare ? 'surprised' : n <= 1 ? 'worried' : 'happy';
    this.drawEyes(x + wobble, y, p.r, p.facingX, p.facingY, mood);
    ctx.globalAlpha = 1;

    if (p.bare) {
      const f = Math.max(0, p.lastChance / w.tuning.lastChanceSeconds);
      ctx.strokeStyle = RED;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, p.r + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
      ctx.stroke();
    }

    // When down to the Heart Kernel, point at the nearest kernels on the ground.
    if (n <= 1 || p.bare) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const g of w.ground) {
        const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      if (best) {
        const a = Math.atan2(best.y - p.y, best.x - p.x);
        const ax = x + Math.cos(a) * (p.r + 26 + Math.sin(time * 10) * 4);
        const ay = y + Math.sin(a) * (p.r + 26 + Math.sin(time * 10) * 4);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-6, -8);
        ctx.lineTo(-6, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawChompMeter(x: number, y: number, need: number): void {
    const ctx = this.ctx;
    const shown = Math.min(need, 10);
    const pip = 4;
    const gap = 3;
    const width = shown * (pip * 2 + gap) - gap;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(x - width / 2 - 6, y - pip - 4, width + 12 + (need > 10 ? 24 : 0), pip * 2 + 8, 8);
    ctx.fill();
    for (let i = 0; i < shown; i++) {
      ctx.fillStyle = RED;
      ctx.beginPath();
      ctx.arc(x - width / 2 + pip + i * (pip * 2 + gap), y, pip, 0, Math.PI * 2);
      ctx.fill();
    }
    if (need > 10) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`+${need - 10}`, x + width / 2 + 2, y + 4);
    }
  }

  private drawJoystick(input: Input): void {
    const js = input.joystick;
    if (!js) return;
    const ctx = this.ctx;
    const v = input.joystickVector();
    const R = input.joystickRadius;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(js.originX, js.originY, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(js.originX + v.x * R, js.originY + v.y * R, R * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
