import { Application, BitmapText, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Camera, Input } from './input';
import { dominantPlain, shieldBadges, total, type Kernels } from './sim/cob';
import { DAMAGE_ICON, KERNELS, PLAIN_KINDS, POWER_KINDS, isPower, type KernelKind, type PowerKind } from './sim/kernels';
import { popperRadius, viewRadius, type Enemy, type SimEvent, type World } from './sim/world';

const FIELD = 0x9fd36b;
const PLAYER_COLOR = 0x3a86ff;
const GREEN = 0x22b24c;
const RED = 0xe5383b;
const INK = 0x2b2b2b;
const WHITE = 0xffffff;
const BODY_TINT: Record<string, number> = { sunny: 0xfff1b8, soggy: 0xb6efe8, stony: 0xd3d8e0 };
const BARE_TINT = 0xf4efe1;
/** Kernel textures are drawn at this radius and scaled to fit. */
const TEX_R = 32;
/** Kernel dots smaller than this many screen pixels aren't drawn (the body tint carries the look). */
const MIN_DOT_PX = 1.2;
/** Big cobs show at most this many sockets; each dot then stands for several kernels, in proportion. */
const MAX_DRAWN_SLOTS = 240;
/** Small cobs never draw smaller than this on screen, so snacks stay visible when you're huge. */
const MIN_ENEMY_PX = 9;

interface Floater {
  x: number;
  y: number;
  text: string;
  color: number;
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
  color: number;
  size: number;
  square: boolean;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  ttl: number;
  max: number;
  color: number;
}

interface KernelTextures {
  dot: Texture;
  square: Texture;
  groundPlain: Texture;
  groundPower: Texture;
  cobPower: Record<PowerKind, Texture>;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (css: string) => parseInt(css.slice(1), 16);
const KERNEL_COLOR = Object.fromEntries(Object.entries(KERNELS).map(([k, d]) => [k, hex(d.color)])) as Record<KernelKind, number>;

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
  if (slotCache.size > 400) slotCache.clear();
  slotCache.set(n, out);
  return out;
}

/** Reuses display objects frame to frame; anything not claimed this frame is hidden. */
class Pool<T extends Container> {
  private items: T[] = [];
  private used = 0;
  constructor(
    readonly layer: Container,
    private make: () => T,
  ) {}
  begin(): void {
    this.used = 0;
  }
  next(): T {
    let item = this.items[this.used];
    if (!item) {
      item = this.make();
      this.layer.addChild(item);
      this.items.push(item);
    }
    item.visible = true;
    this.used++;
    return item;
  }
  end(): void {
    for (let i = this.used; i < this.items.length; i++) this.items[i].visible = false;
  }
}

class SpritePool extends Pool<Sprite> {
  constructor(layer: Container) {
    super(layer, () => {
      const s = new Sprite();
      s.anchor.set(0.5);
      return s;
    });
  }
  place(tex: Texture, x: number, y: number, rx: number, ry: number, tint: number, alpha = 1): Sprite {
    const s = this.next();
    if (s.texture !== tex) s.texture = tex;
    s.position.set(x, y);
    s.scale.set(rx / TEX_R, ry / TEX_R);
    s.tint = tint;
    s.alpha = alpha;
    return s;
  }
}

class TextPool extends Pool<Text> {
  constructor(layer: Container) {
    super(layer, () => {
      const t = new Text({
        text: '',
        style: { fontFamily: 'system-ui, sans-serif', fontWeight: '900', fontSize: 20, fill: WHITE, stroke: { color: 0x000000, width: 4, alpha: 0.65 } },
      });
      t.anchor.set(0.5);
      return t;
    });
  }
  show(text: string, x: number, y: number, size: number, color: number, alpha = 1, scale = 1): Text {
    const t = this.next();
    if (t.text !== text) t.text = text;
    if (t.style.fontSize !== size) t.style.fontSize = size;
    if (t.style.fill !== color) t.style.fill = color;
    t.position.set(x, y);
    t.alpha = alpha;
    t.scale.set(scale);
    return t;
  }
}

class LabelPool extends Pool<BitmapText> {
  constructor(layer: Container, size: number, color: number) {
    super(layer, () => {
      const t = new BitmapText({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontWeight: 'bold', fontSize: size, fill: color } });
      t.anchor.set(0.5);
      return t;
    });
  }
  show(text: string, x: number, y: number, scale = 1): BitmapText {
    const t = this.next();
    if (t.text !== text) t.text = text;
    t.position.set(x, y);
    t.scale.set(scale);
    return t;
  }
}

/** A cob's draw layers, so each cob's kernels sit above its body and below its outline and eyes. */
interface CobLayers {
  body: Graphics;
  kernels: SpritePool;
  overlay: Graphics;
}

export class Renderer {
  readonly cam: Camera = { x: 0, y: 0, zoom: 1, width: 1, height: 1 };
  reduceShake = false;
  private floaters: Floater[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private shake = 0;

  private readonly world = new Container();
  private readonly field = new Graphics();
  private readonly groundGfx = new Graphics();
  private readonly groundSprites: SpritePool;
  private readonly groundLabels: LabelPool;
  private readonly shotSprites: SpritePool;
  private readonly enemies: CobLayers;
  private readonly player: CobLayers;
  private readonly playerLayer = new Container();
  private readonly fxGfx = new Graphics();
  private readonly fxSprites: SpritePool;
  private readonly screenGfx = new Graphics();
  private readonly screenText: TextPool;
  private readonly screenLabels: LabelPool;
  private readonly tex: KernelTextures;

  static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
    const app = new Application();
    await app.init({
      canvas,
      background: FIELD,
      antialias: true,
      autoStart: false,
      sharedTicker: false,
      autoDensity: false,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      width: Math.max(1, canvas.clientWidth),
      height: Math.max(1, canvas.clientHeight),
      preference: 'webgl',
      powerPreference: 'high-performance',
      eventFeatures: { move: false, globalMove: false, click: false, wheel: false },
    });
    return new Renderer(app, canvas);
  }

  private constructor(
    private app: Application,
    private canvas: HTMLCanvasElement,
  ) {
    this.tex = makeTextures(app);
    const stage = app.stage;
    stage.addChild(this.field, this.world);

    const groundSpriteLayer = new Container();
    const groundLabelLayer = new Container();
    const shotLayer = new Container();
    this.groundSprites = new SpritePool(groundSpriteLayer);
    this.groundLabels = new LabelPool(groundLabelLayer, 18, 0x333333);
    this.shotSprites = new SpritePool(shotLayer);
    this.enemies = makeCobLayers();
    this.player = makeCobLayers();
    this.playerLayer.addChild(this.player.body, this.player.kernels.layer, this.player.overlay);
    const fxSpriteLayer = new Container();
    this.fxSprites = new SpritePool(fxSpriteLayer);
    this.world.addChild(
      this.groundGfx,
      groundSpriteLayer,
      groundLabelLayer,
      shotLayer,
      this.enemies.body,
      this.enemies.kernels.layer,
      this.enemies.overlay,
      this.playerLayer,
      this.fxGfx,
      fxSpriteLayer,
    );

    const screenTextLayer = new Container();
    const screenLabelLayer = new Container();
    this.screenText = new TextPool(screenTextLayer);
    this.screenLabels = new LabelPool(screenLabelLayer, 20, WHITE);
    stage.addChild(this.screenGfx, screenLabelLayer, screenTextLayer);
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.app.renderer.resize(width, height, Math.min(2, window.devicePixelRatio || 1));
    this.cam.width = width;
    this.cam.height = height;
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

  private floater(x: number, y: number, text: string, color: number, size = 18, ttl = 0.8): void {
    this.floaters.push({ x, y, text, color, size, ttl, max: ttl });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  private burst(x: number, y: number, color: number, count: number, speed: number, square = false): void {
    const scale = 1 / Math.sqrt(this.cam.zoom);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * scale * (0.4 + Math.random() * 0.8);
      const ttl = 0.3 + Math.random() * 0.3;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ttl, max: ttl, color, size: (3 + Math.random() * 3) * scale, square });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  handleEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'tink':
          this.floater(e.x, e.y, `🛡 tink!`, WHITE, 20, 0.9);
          break;
        case 'hit':
          if (e.onPlayer) {
            this.floater(e.x, e.y, `-${e.count}`, RED, 20);
            this.shake = Math.max(this.shake, 6);
          } else {
            this.floater(e.x, e.y, e.weak ? `${DAMAGE_ICON[e.damage]} x2!` : `${DAMAGE_ICON[e.damage]} pop!`, e.weak ? 0xffe066 : WHITE, e.weak ? 24 : 17);
          }
          this.burst(e.x, e.y, 0xfff3b0, 6, 160);
          break;
        case 'explode':
          this.rings.push({ x: e.x, y: e.y, r: e.r, ttl: 0.35, max: 0.35, color: 0xfff8e1 });
          this.burst(e.x, e.y, 0xfff8e1, 14, 260, true);
          this.shake = Math.max(this.shake, 4);
          break;
        case 'poof':
          this.burst(e.x, e.y, 0xe9f5db, 16, 200);
          this.floater(e.x, e.y, 'poof!', WHITE, 16);
          break;
        case 'chomp':
          this.floater(e.x, e.y, e.streak > 1 ? `NOM x${e.streak}!` : 'NOM!', GREEN, 26 + Math.min(e.streak, 6) * 2, 0.9);
          this.burst(e.x, e.y, 0xffd23f, 18, 240);
          this.shake = Math.max(this.shake, 5);
          break;
        case 'turnGreen':
          this.floater(e.x, e.y, 'yum!', GREEN, 16, 0.7);
          break;
        case 'tierUp':
          this.floater(this.cam.x, this.cam.y - 60 / this.cam.zoom, `Size ${e.tier}!`, WHITE, 30, 1.4);
          break;
        case 'bare':
          this.floater(this.cam.x, this.cam.y - 50 / this.cam.zoom, 'Uh-oh! Grab a kernel!', WHITE, 24, 1.6);
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
    const ox = cam.width / 2 + shx - cam.x * cam.zoom;
    const oy = cam.height / 2 + shy - cam.y * cam.zoom;
    this.world.position.set(ox, oy);
    this.world.scale.set(cam.zoom);
    const toScreenX = (x: number) => x * cam.zoom + ox;
    const toScreenY = (y: number) => y * cam.zoom + oy;

    const halfW = cam.width / 2 / cam.zoom + 60;
    const halfH = cam.height / 2 / cam.zoom + 60;
    const visible = (x: number, y: number, r: number) => Math.abs(x - cam.x) < halfW + r && Math.abs(y - cam.y) < halfH + r;

    this.drawField();
    this.screenGfx.clear();
    this.screenText.begin();
    this.screenLabels.begin();

    // Burn patches, ground kernels, shots.
    const g0 = this.groundGfx.clear();
    this.enemies.overlay.clear();
    this.groundSprites.begin();
    this.groundLabels.begin();
    this.shotSprites.begin();
    for (const patch of w.patches) {
      if (!visible(patch.x, patch.y, patch.r)) continue;
      g0.circle(patch.x, patch.y, patch.r).fill({ color: 0xff7b00, alpha: Math.min(1, patch.ttl * 2) * (0.35 + 0.1 * Math.sin(time * 20 + patch.id)) });
    }
    // Ground kernels stay at least a few screen pixels wide so they're findable when you're huge.
    const minGround = 3.2 / cam.zoom;
    const labelScale = Math.max(0.5, 0.55 / cam.zoom);
    for (const g of w.ground) {
      const gx = lerp(g.px, g.x, alpha);
      const gy = lerp(g.py, g.y, alpha);
      if (!visible(gx, gy, 20)) continue;
      const size = Math.max(minGround, 5 + Math.min(g.value - 1, 9) * 0.9);
      const land = g.age < 0.25 ? 1 + Math.sin((g.age / 0.25) * Math.PI) * 0.5 : 1;
      if (g.delay <= 0) this.groundSprites.place(this.tex.dot, gx, gy, size * 2, size * 2, WHITE, 0.25 + 0.15 * Math.sin(time * 5 + g.id));
      if (g.sparkle > 0) {
        g0.circle(gx, gy, size * 2.4 + Math.sin(time * 10) * 1.5).stroke({ width: 2 / Math.sqrt(cam.zoom), color: PLAYER_COLOR, alpha: Math.min(1, g.sparkle) });
      }
      const tex = isPower(g.kind) ? this.tex.groundPower : this.tex.groundPlain;
      this.groundSprites.place(tex, gx, gy, size * land, size / land, KERNEL_COLOR[g.kind]);
      if (g.value > 1) this.groundLabels.show(String(g.value), gx, gy + size + 10 * labelScale, labelScale);
    }
    const shotScale = Math.sqrt(p.r / 18);
    for (const s of w.shots) {
      const sx = lerp(s.px, s.x, alpha);
      const sy = lerp(s.py, s.y, alpha);
      const color = KERNEL_COLOR[s.kind];
      const tex = isPower(s.kind) ? this.tex.groundPower : this.tex.groundPlain;
      if (s.lob) {
        const f = Math.min(1, s.lob.t / s.lob.dur);
        const h = Math.sin(Math.PI * f) * 70 * shotScale;
        g0.ellipse(sx, sy, 7 * shotScale, 4 * shotScale).fill({ color: 0x000000, alpha: 0.2 });
        this.shotSprites.place(tex, sx, sy - h, 8 * shotScale, 8 * shotScale, color, 0.85);
        dashedCircle(this.enemies.overlay, s.lob.tx, s.lob.ty, popperRadius(w), 2 / cam.zoom, WHITE, 0.6, cam.zoom);
        continue;
      }
      const sp = Math.hypot(s.vx, s.vy) || 1;
      const trail = 26 * shotScale;
      g0.moveTo(sx, sy)
        .lineTo(sx - (s.vx / sp) * trail, sy - (s.vy / sp) * trail)
        .stroke({ width: s.r * 1.4, color, alpha: 0.4, cap: 'round' });
      this.shotSprites.place(tex, sx, sy, s.r, s.r, color, 0.8);
    }
    this.groundSprites.end();
    this.groundLabels.end();
    this.shotSprites.end();

    // Enemies. (Their overlay was already started above for popper landing circles.)
    this.enemies.body.clear();
    this.enemies.kernels.begin();
    for (const e of w.enemies) {
      const ex = lerp(e.px, e.x, alpha);
      const ey = lerp(e.py, e.y, alpha);
      if (!visible(ex, ey, e.r + 30)) continue;
      this.drawEnemy(e, ex, ey, time, toScreenX, toScreenY);
    }
    this.enemies.kernels.end();

    this.drawPlayer(w, px, py, time);

    // Target ring.
    const target = p.targetId !== null ? w.enemies.find((e) => e.id === p.targetId) : undefined;
    const fx = this.fxGfx.clear();
    if (target) {
      const tx = lerp(target.px, target.x, alpha);
      const ty = lerp(target.py, target.y, alpha);
      const locked = p.lockedTargetId === target.id;
      const pad = 9 / Math.sqrt(cam.zoom);
      const rr = Math.max(target.r, MIN_ENEMY_PX / cam.zoom) + pad + Math.sin(time * 8) * 2.5 / Math.sqrt(cam.zoom);
      dashedCircle(fx, tx, ty, rr, (locked ? 4 : 3) / Math.sqrt(cam.zoom), WHITE, locked ? 1 : 0.85, cam.zoom, time * 1.5);
      if (locked) this.screenText.show('🔒', toScreenX(tx + rr * 0.75), toScreenY(ty - rr * 0.75), 14, WHITE);
      if (!target.chompable && !p.bare) {
        const need = total(target.kernels) - total(p.kernels) + 1;
        this.drawChompMeter(toScreenX(tx), toScreenY(ty + rr) + 14, need);
      }
    }

    // Rings, particles, floaters.
    for (const ring of this.rings) {
      ring.ttl -= dt;
      const f = 1 - ring.ttl / ring.max;
      fx.circle(ring.x, ring.y, ring.r * (0.4 + 0.6 * f)).stroke({ width: (6 * (1 - f) + 1) / Math.sqrt(cam.zoom), color: ring.color, alpha: Math.max(0, 1 - f) });
    }
    this.rings = this.rings.filter((r) => r.ttl > 0);
    this.fxSprites.begin();
    for (const pt of this.particles) {
      pt.ttl -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      const a = Math.max(0, pt.ttl / pt.max);
      this.fxSprites.place(pt.square ? this.tex.square : this.tex.dot, pt.x, pt.y, pt.size / 2, pt.size / 2, pt.color, a);
    }
    this.fxSprites.end();
    this.particles = this.particles.filter((pt) => pt.ttl > 0);

    const lift = 10 + 10 * Math.min(1, cam.zoom);
    for (const f of this.floaters) {
      f.ttl -= dt;
      f.y -= (40 * dt) / cam.zoom;
      const k = f.ttl / f.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      this.screenText.show(f.text, toScreenX(f.x), toScreenY(f.y) - lift, f.size, f.color, Math.min(1, k * 2), pop);
    }
    this.floaters = this.floaters.filter((f) => f.ttl > 0);

    this.drawJoystick(input);
    this.screenText.end();
    this.screenLabels.end();
    this.app.render();
  }

  private drawField(): void {
    const cam = this.cam;
    const g = this.field.clear();
    const step = 120;
    const halfW = cam.width / 2 / cam.zoom;
    const halfH = cam.height / 2 / cam.zoom;
    const toX = (x: number) => (x - cam.x) * cam.zoom + cam.width / 2;
    const toY = (y: number) => (y - cam.y) * cam.zoom + cam.height / 2;
    for (let x = Math.floor((cam.x - halfW) / step) * step; x <= cam.x + halfW; x += step) g.moveTo(toX(x), 0).lineTo(toX(x), cam.height);
    for (let y = Math.floor((cam.y - halfH) / step) * step; y <= cam.y + halfH; y += step) g.moveTo(0, toY(y)).lineTo(cam.width, toY(y));
    g.stroke({ width: 2, color: 0x3c6e28, alpha: 0.18 });
  }

  /** Draws a cob body with its kernels in sockets. `sockets` > kernel count shows empty holes. */
  private drawCobBody(layers: CobLayers, x: number, y: number, r: number, k: Kernels, sockets: number, tint: number): void {
    layers.body.circle(x, y, r).fill(tint);
    const count = total(k);
    const real = Math.max(sockets, count);
    if (real === 0) return;
    const n = Math.min(real, MAX_DRAWN_SLOTS);
    const slots = slotsFor(n);
    const inner = r * 0.9;
    const dot = slots[2] * inner;
    if (dot * this.cam.zoom < MIN_DOT_PX) return;
    const shown = drawnCounts(k, real, n);
    const pool = layers.kernels;
    let i = 0;
    // Power kernels sit in the top band, then plain kernels, then empty sockets.
    for (const kind of POWER_KINDS) {
      const tex = this.tex.cobPower[kind];
      for (let c = 0; c < shown[kind]; c++, i++) pool.place(tex, x + slots[i * 3] * inner, y + slots[i * 3 + 1] * inner, dot * 0.85, dot * 0.85, WHITE);
    }
    for (const kind of PLAIN_KINDS) {
      const color = KERNEL_COLOR[kind];
      for (let c = 0; c < shown[kind]; c++, i++) pool.place(this.tex.dot, x + slots[i * 3] * inner, y + slots[i * 3 + 1] * inner, dot, dot, color);
    }
    for (; i < n; i++) pool.place(this.tex.dot, x + slots[i * 3] * inner, y + slots[i * 3 + 1] * inner, dot * 0.6, dot * 0.6, 0x503c14, 0.35);
  }

  private drawEyes(g: Graphics, x: number, y: number, r: number, lookX: number, lookY: number, mood: 'happy' | 'angry' | 'worried' | 'surprised'): void {
    const er = Math.max(2.5, r * 0.22);
    const ey = y - r * 0.15;
    const m = Math.hypot(lookX, lookY) || 1;
    const lx = (lookX / m) * er * 0.35;
    const ly = (lookY / m) * er * 0.35;
    const line = Math.max(1.5, er * 0.18);
    for (const side of [-1, 1]) {
      const ex = x + side * r * 0.32;
      g.circle(ex, ey, er).fill(WHITE).stroke({ width: line, color: INK });
      g.circle(ex + lx, ey + ly, er * (mood === 'surprised' ? 0.3 : 0.5)).fill(INK);
      if (mood === 'angry' || mood === 'worried') {
        const tilt = mood === 'angry' ? 1 : -1;
        g.moveTo(ex - side * er, ey - er * 1.3 - tilt * er * 0.4)
          .lineTo(ex + side * er, ey - er * 1.3 + tilt * er * 0.4)
          .stroke({ width: Math.max(1.5, er * 0.35), color: INK });
      }
    }
  }

  private drawEnemy(e: Enemy, x: number, y: number, time: number, toScreenX: (x: number) => number, toScreenY: (y: number) => number): void {
    const layers = this.enemies;
    const r = Math.max(e.r, MIN_ENEMY_PX / this.cam.zoom);
    const bob = Math.sin(time * 6 + e.id) * r * 0.04;
    const cy = y + bob;
    const outline = Math.max(4, 2.2 / this.cam.zoom);

    layers.body.ellipse(x, y + r * 0.85, r * 0.9, r * 0.3).fill({ color: 0x000000, alpha: 0.15 });
    this.drawCobBody(layers, x, cy, r, e.kernels, 0, e.hitFlash > 0 ? WHITE : BODY_TINT[dominantPlain(e.kernels)]);

    const g = layers.overlay;
    if (e.chompable) {
      const amp = Math.max(1.6, r * 0.03);
      const pts: number[] = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        const rr = r + outline / 2 + Math.sin(a * 6 + time * 10) * amp;
        pts.push(x + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.poly(pts, true).stroke({ width: outline, color: GREEN });
    } else {
      g.circle(x, cy, r + outline / 2).stroke({ width: outline * 1.1, color: RED });
    }
    this.drawEyes(g, x, cy, r, e.vx, e.vy, e.chompable ? 'worried' : 'angry');

    const badges = shieldBadges(e.kernels);
    if (badges.length > 0) {
      const text = badges.map((b) => `🛡${DAMAGE_ICON[b]}`).join(' ');
      const sx = toScreenX(x);
      const sy = toScreenY(cy - r) - 14;
      const label = this.screenText.show(text, sx, sy, 13, WHITE);
      const tw = label.width;
      this.screenGfx.roundRect(sx - tw / 2 - 5, sy - 10, tw + 10, 20, 10).fill({ color: 0x000000, alpha: 0.45 });
    }
  }

  private drawPlayer(w: World, x: number, y: number, time: number): void {
    const p = w.player;
    const layers = this.player;
    const n = total(p.kernels);
    const flashing = p.invuln > 0 && Math.floor(time * 20) % 2 === 0;
    const wobble = p.invuln > 0 ? Math.sin(time * 40) * Math.max(2, p.r * 0.05) : 0;
    const body = layers.body.clear();
    const g = layers.overlay.clear();
    layers.kernels.begin();

    body.ellipse(x, y + p.r * 0.85, p.r, p.r * 0.32).fill({ color: 0x000000, alpha: 0.18 });
    if (n <= 1 || p.bare) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 8);
      body.circle(x, y, p.r + 10 + pulse * 6).fill({ color: 0xff5050, alpha: 0.25 + pulse * 0.3 });
    }

    this.playerLayer.alpha = flashing ? 0.5 : 1;
    const tint = p.bare ? BARE_TINT : BODY_TINT[dominantPlain(p.kernels)];
    this.drawCobBody(layers, x + wobble, y, p.r, p.kernels, p.sockets, tint);
    layers.kernels.end();

    const ring = Math.max(5, 2.5 / this.cam.zoom);
    g.circle(x + wobble, y, p.r + ring * 0.4).stroke({ width: ring, color: WHITE }).stroke({ width: ring * 0.5, color: PLAYER_COLOR });

    const mood = p.bare ? 'surprised' : n <= 1 ? 'worried' : 'happy';
    this.drawEyes(g, x + wobble, y, p.r, p.facingX, p.facingY, mood);

    if (p.bare) {
      const f = Math.max(0, p.lastChance / w.tuning.lastChanceSeconds);
      const r = p.r + 16;
      const a0 = -Math.PI / 2;
      g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r)
        .arc(x, y, r, a0, a0 + Math.PI * 2 * f)
        .stroke({ width: 5, color: RED });
    }

    // When down to the Heart Kernel, point at the nearest kernels on the ground.
    if (n <= 1 || p.bare) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const gk of w.ground) {
        const d = (gk.x - p.x) ** 2 + (gk.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = gk;
        }
      }
      if (best) {
        const a = Math.atan2(best.y - p.y, best.x - p.x);
        const dist = p.r + 26 + Math.sin(time * 10) * 4;
        const ax = x + Math.cos(a) * dist;
        const ay = y + Math.sin(a) * dist;
        const pt = (fx: number, fy: number) => [ax + Math.cos(a) * fx - Math.sin(a) * fy, ay + Math.sin(a) * fx + Math.cos(a) * fy];
        g.poly([...pt(10, 0), ...pt(-6, -8), ...pt(-6, 8)], true)
          .fill(WHITE)
          .stroke({ width: 2, color: INK });
      }
    }
  }

  private drawChompMeter(x: number, y: number, need: number): void {
    const g = this.screenGfx;
    const shown = Math.min(need, 10);
    const pip = 4;
    const gap = 3;
    const width = shown * (pip * 2 + gap) - gap;
    g.roundRect(x - width / 2 - 6, y - pip - 4, width + 12 + (need > 10 ? 34 : 0), pip * 2 + 8, 8).fill({ color: 0x000000, alpha: 0.45 });
    for (let i = 0; i < shown; i++) g.circle(x - width / 2 + pip + i * (pip * 2 + gap), y, pip).fill(RED);
    if (need > 10) {
      const label = this.screenLabels.show(`+${need - 10}`, 0, y, 0.6);
      label.position.x = x + width / 2 + 4 + label.width / 2;
    }
  }

  private drawJoystick(input: Input): void {
    const js = input.joystick;
    if (!js) return;
    const v = input.joystickVector();
    const R = input.joystickRadius;
    this.screenGfx
      .circle(js.originX, js.originY, R)
      .fill({ color: WHITE, alpha: 0.35 })
      .circle(js.originX + v.x * R, js.originY + v.y * R, R * 0.45)
      .fill({ color: WHITE, alpha: 0.85 });
  }
}

/** Scales kernel counts down to `n` drawn slots (largest remainder), keeping every kind that's present visible. */
function drawnCounts(k: Kernels, real: number, n: number): Kernels {
  if (real <= n) return k;
  const out = { ...k };
  const kinds = [...POWER_KINDS, ...PLAIN_KINDS] as KernelKind[];
  const rest: [KernelKind, number][] = [];
  let used = 0;
  for (const kind of kinds) {
    const exact = (k[kind] * n) / real;
    out[kind] = k[kind] > 0 ? Math.max(1, Math.floor(exact)) : 0;
    used += out[kind];
    rest.push([kind, exact - Math.floor(exact)]);
  }
  const target = Math.round((total(k) * n) / real);
  rest.sort((a, b) => b[1] - a[1]);
  for (let j = 0; used < target && j < rest.length; j++) {
    if (k[rest[j][0]] > 0) {
      out[rest[j][0]]++;
      used++;
    }
  }
  return out;
}

function makeCobLayers(): CobLayers {
  const kernelLayer = new Container();
  return { body: new Graphics(), kernels: new SpritePool(kernelLayer), overlay: new Graphics() };
}

/** A dashed ring, in screen-length dashes so it reads the same at any zoom. */
function dashedCircle(g: Graphics, x: number, y: number, r: number, width: number, color: number, alpha: number, zoom: number, spin = 0): void {
  const dash = 10 / zoom;
  const gap = 7 / zoom;
  const segments = Math.max(6, Math.floor((Math.PI * 2 * r) / (dash + gap)));
  const step = (Math.PI * 2) / segments;
  const on = step * (dash / (dash + gap));
  for (let i = 0; i < segments; i++) {
    const a0 = spin + i * step;
    g.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r).arc(x, y, r, a0, a0 + on);
  }
  g.stroke({ width, color, alpha });
}

function makeTextures(app: Application): KernelTextures {
  const R = TEX_R;
  const bake = (draw: (g: Graphics) => void): Texture => {
    const g = new Graphics();
    draw(g);
    const tex = app.renderer.generateTexture({ target: g, resolution: 2, antialias: true });
    g.destroy();
    return tex;
  };
  const outline = R * 0.2;
  const cobPower = {} as Record<PowerKind, Texture>;
  for (const kind of POWER_KINDS) {
    cobPower[kind] = bake((g) =>
      g
        .rect(-R + outline / 2, -R + outline / 2, R * 2 - outline, R * 2 - outline)
        .fill(KERNEL_COLOR[kind])
        .stroke({ width: outline, color: WHITE }),
    );
  }
  return {
    dot: bake((g) => g.circle(0, 0, R).fill(WHITE)),
    square: bake((g) => g.rect(-R, -R, R * 2, R * 2).fill(WHITE)),
    groundPlain: bake((g) => g.circle(0, 0, R - outline / 2).fill(WHITE).stroke({ width: outline, color: INK })),
    groundPower: bake((g) =>
      g
        .rect(-R + outline / 2, -R + outline / 2, R * 2 - outline, R * 2 - outline)
        .fill(WHITE)
        .stroke({ width: outline, color: INK }),
    ),
    cobPower,
  };
}
