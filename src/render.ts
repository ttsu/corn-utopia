import { Application, BitmapText, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import {
  KERNEL_ASPECT,
  KERNEL_COLOR,
  KERNEL_HALF_W,
  TEX_R,
  drawCobShell,
  drawFace,
  drawFarm,
  drawFlair,
  fillCobBody,
  makeArtTextures,
  strokeCobOutline,
  type ArtTextures,
  type Mood,
} from './art';
import type { Camera, Input } from './input';
import { perkDef } from './sim/perks';
import { shieldBadges, total, type Kernels } from './sim/cob';
import { DAMAGE_ICON, PLAIN_KINDS, POWER_KINDS, type KernelKind } from './sim/kernels';
import { popperRadius, viewRadius, type Enemy, type SimEvent, type World } from './sim/world';

const FIELD = 0x8fce6a;
const PLAYER_COLOR = 0xf4a300;
const GREEN = 0x22b24c;
const RED = 0xe5383b;
const INK = 0x2b2b2b;
const WHITE = 0xffffff;
const BARE_TINT = 0xf4efe1;
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

interface SmugMark {
  x: number;
  y: number;
  ttl: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Kernel slots in cob-local units of r, ordered tip-to-base.
 * Straight columns down the ear; odd columns nest half a kernel lower,
 * the way kernels line up on a real cob.
 */
const slotCache = new Map<number, Float32Array>();
function slotsFor(n: number): Float32Array {
  const cached = slotCache.get(n);
  if (cached) return cached;
  const count = Math.max(1, n);
  // Fill the cob body (half-size about 0.62 by 0.98) so the rows read as an ear.
  const rx = 0.56;
  const ry = 0.84;
  const inset = 1;
  let cols = 1;
  let rows = count;
  let best = Infinity;
  const maxCols = Math.min(count, 10);
  for (let c = 1; c <= maxCols; c++) {
    const rowsNeeded = Math.ceil(count / c);
    const cellW = (2 * rx * inset) / c;
    const cellH = (2 * ry * inset) / rowsNeeded;
    const score = Math.abs(Math.log(cellH / cellW / KERNEL_ASPECT)) + (c === 1 && count > 3 ? 0.45 : 0);
    if (score < best) {
      best = score;
      cols = c;
      rows = rowsNeeded;
    }
  }
  const cellW = (2 * rx * inset) / cols;
  const cellH = (2 * ry * inset) / rows;
  const halfW = Math.min(cellW * 0.52, (cellH * 0.52) / KERNEL_ASPECT);
  const pts: [number, number][] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = -((cols - 1) * cellW) / 2 + col * cellW;
      const y = -((rows - 1) * cellH) / 2 + row * cellH + (col % 2) * cellH * 0.5;
      pts.push([x, y]);
    }
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const shift = (minY + maxY) / 2;
  for (const p of pts) p[1] -= shift;
  pts.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = pts[i][0];
    out[i * 3 + 1] = pts[i][1];
    out[i * 3 + 2] = halfW;
  }
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
  place(tex: Texture, x: number, y: number, rx: number, ry: number, tint: number, alpha = 1, rotation = 0): Sprite {
    const s = this.next();
    if (s.texture !== tex) s.texture = tex;
    s.position.set(x, y);
    s.scale.set(rx / TEX_R, ry / TEX_R);
    s.rotation = rotation;
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
  /** Status color, drawn behind the cob so leaf strokes don't cross the body. */
  outline: Graphics;
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
  private twirl = 0;
  private smug: SmugMark[] = [];
  private lastZ = -1;

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
  private readonly tex: ArtTextures;

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
    this.tex = makeArtTextures(app);
    const stage = app.stage;
    stage.addChild(this.world);
    this.world.addChild(this.field);

    const groundSpriteLayer = new Container();
    const groundLabelLayer = new Container();
    const shotLayer = new Container();
    this.groundSprites = new SpritePool(groundSpriteLayer);
    this.groundLabels = new LabelPool(groundLabelLayer, 18, 0x333333);
    this.shotSprites = new SpritePool(shotLayer);
    this.enemies = makeCobLayers();
    this.player = makeCobLayers();
    this.playerLayer.addChild(this.player.outline, this.player.body, this.player.kernels.layer, this.player.overlay);
    const fxSpriteLayer = new Container();
    this.fxSprites = new SpritePool(fxSpriteLayer);
    this.world.addChild(
      this.groundGfx,
      groundSpriteLayer,
      groundLabelLayer,
      shotLayer,
      this.enemies.outline,
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
        case 'fire':
          this.burst(e.x, e.y, KERNEL_COLOR[e.kind], 5, 140);
          this.shake = Math.max(this.shake, 2);
          break;
        case 'tink':
          this.floater(e.x, e.y, `🛡 tink!`, WHITE, 20, 0.9);
          this.smug.push({ x: e.x, y: e.y, ttl: 0.8 });
          break;
        case 'hit':
          if (e.onPlayer) {
            this.floater(e.x, e.y, `-${e.count}`, RED, 20);
            this.shake = Math.max(this.shake, 6);
          } else {
            this.floater(e.x, e.y, e.weak ? `${DAMAGE_ICON[e.damage]} x2!` : `${DAMAGE_ICON[e.damage]} pop!`, e.weak ? 0xffe066 : WHITE, e.weak ? 24 : 17);
          }
          this.burst(e.x, e.y, 0xfff3b0, e.weak ? 10 : 6, e.weak ? 220 : 160);
          break;
        case 'pickup':
          this.rings.push({ x: e.x, y: e.y, r: 16, ttl: 0.25, max: 0.25, color: KERNEL_COLOR[e.kind] });
          break;
        case 'block':
          this.floater(e.x, e.y - 10, 'blocked!', WHITE, 18, 0.7);
          break;
        case 'dash':
          this.burst(e.x, e.y, 0xffe08a, 8, 180);
          break;
        case 'freeze':
          this.floater(e.x, e.y - 8, 'frozen!', 0xd7f3ff, 22, 1.4);
          this.burst(e.x, e.y, 0xd7f3ff, 8, 120);
          break;
        case 'perk': {
          const def = perkDef(e.id);
          this.floater(this.cam.x, this.cam.y - 40 / Math.max(0.2, this.cam.zoom), `${def.icon} ${def.name}!`, WHITE, 26, 1.3);
          this.twirl = Math.PI * 2;
          break;
        }
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
          this.burst(e.x, e.y, 0xffd23f, 22, 280, true);
          this.shake = Math.max(this.shake, 9);
          break;
        case 'turnGreen':
          this.floater(e.x, e.y, 'yum!', GREEN, 16, 0.7);
          break;
        case 'tierUp':
          this.floater(this.cam.x, this.cam.y - 60 / this.cam.zoom, `Size ${e.tier}!`, WHITE, 30, 1.4);
          this.twirl = Math.PI * 2;
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
    this.twirl = Math.max(0, this.twirl - dt * 9);
    for (const mark of this.smug) mark.ttl -= dt;
    this.smug = this.smug.filter((mark) => mark.ttl > 0);
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

    this.drawFarm(w);
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
      if (g.delay <= 0) {
        const glow = 0.22 + 0.12 * Math.sin(time * 5 + g.id);
        this.groundSprites.place(this.tex.dot, gx, gy, size * 2.1, size * 2.1, KERNEL_COLOR[g.kind], glow);
      }
      if (g.sparkle > 0) {
        g0.circle(gx, gy, size * 2.4 + Math.sin(time * 10) * 1.5).stroke({ width: 2 / Math.sqrt(cam.zoom), color: PLAYER_COLOR, alpha: Math.min(1, g.sparkle) });
      }
      const landed = g.delay <= 0;
      this.groundSprites.place(this.tex.kernels[g.kind], gx, gy, size * land, size / land, WHITE, landed ? 1 : 0.95);
      if (g.value > 1) this.groundLabels.show(String(g.value), gx, gy + size + 10 * labelScale, labelScale);
    }
    const shotScale = Math.sqrt(p.r / 18);
    for (const s of w.shots) {
      const sx = lerp(s.px, s.x, alpha);
      const sy = lerp(s.py, s.y, alpha);
      const color = KERNEL_COLOR[s.kind];
      const tex = this.tex.kernels[s.kind];
      if (s.lob) {
        const f = Math.min(1, s.lob.t / s.lob.dur);
        const h = Math.sin(Math.PI * f) * 70 * shotScale;
        g0.ellipse(sx, sy, 7 * shotScale, 4 * shotScale).fill({ color: 0x000000, alpha: 0.2 });
        this.shotSprites.place(tex, sx, sy - h, 8 * shotScale, 8 * shotScale, WHITE, 0.95);
        dashedCircle(this.enemies.overlay, s.lob.tx, s.lob.ty, popperRadius(w), 2 / cam.zoom, WHITE, 0.6, cam.zoom);
        continue;
      }
      const sp = Math.hypot(s.vx, s.vy) || 1;
      const trail = 26 * shotScale;
      g0.moveTo(sx, sy)
        .lineTo(sx - (s.vx / sp) * trail, sy - (s.vy / sp) * trail)
        .stroke({ width: s.r * 1.4, color, alpha: 0.4, cap: 'round' });
      this.shotSprites.place(tex, sx, sy, s.r, s.r, WHITE, 0.92);
    }
    this.groundSprites.end();
    this.groundLabels.end();
    this.shotSprites.end();

    // Enemies. (Their overlay was already started above for popper landing circles.)
    this.enemies.outline.clear();
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

    // Dashed aim marker. A circle, so it stays readable on top of the cob-shaped outline.
    const target = p.targetId !== null ? w.enemies.find((e) => e.id === p.targetId) : undefined;
    const fx = this.fxGfx.clear();
    if (target) {
      const tx = lerp(target.px, target.x, alpha);
      const ty = lerp(target.py, target.y, alpha);
      const pose = enemyPose(target, ty, time, cam.zoom);
      const locked = p.lockedTargetId === target.id;
      const rr = pose.r * 1.12 + 6 / Math.sqrt(cam.zoom) + (Math.sin(time * 8) * 2) / Math.sqrt(cam.zoom);
      dashedCircle(fx, tx, pose.cy, rr, (locked ? 3 : 2.4) / Math.sqrt(cam.zoom), WHITE, locked ? 1 : 0.85, cam.zoom, time * 1.5);
      if (locked) this.screenText.show('🔒', toScreenX(tx + rr * 0.7), toScreenY(pose.cy - rr * 0.7), 14, WHITE);
      if (!target.chompable && !p.bare) {
        const need = total(target.kernels) - total(p.kernels) + 1;
        this.drawChompMeter(toScreenX(tx), toScreenY(pose.cy + rr) + 14, need);
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

  private drawFarm(w: World): void {
    const cam = this.cam;
    const halfW = cam.width / 2 / cam.zoom + 40;
    const halfH = cam.height / 2 / cam.zoom + 40;
    const g = this.field.clear();
    drawFarm(g, w.seed, w.props, cam.x - halfW, cam.y - halfH, cam.x + halfW, cam.y + halfH);
  }

  /** Crisp status line plus a soft halo, both behind the cob art. */
  private strokeStatus(
    g: Graphics,
    x: number,
    y: number,
    r: number,
    angle: number,
    time: number,
    id: number,
    color: number,
    width: number,
    alpha: number,
    pad: number,
  ): void {
    strokeCobOutline(g, x, y, r, angle, time, id, color, width * 1.65, alpha * 0.22, pad + width * 0.22);
    strokeCobOutline(g, x, y, r, angle, time, id, color, width, alpha, pad);
  }

  /** Draws a cob body with its kernels in sockets. `sockets` > kernel count shows empty holes. */
  private drawCobBody(layers: CobLayers, x: number, y: number, r: number, k: Kernels, sockets: number, angle: number, time: number, id: number, flash: boolean): void {
    const spec = { x, y, r, kernels: k, sockets, angle, time, id, flash };
    drawCobShell(layers.body, spec);
    drawFlair(layers.overlay, spec);
    const count = total(k);
    const real = Math.max(sockets, count);
    if (real === 0) return;
    // Keep kernels chunky. A full-size cob has hundreds of sockets; drawing all of
    // them turns the ear into gray noise, so big cobs show a proportional sample.
    const minDot = 5 / this.cam.zoom;
    let n = Math.min(real, MAX_DRAWN_SLOTS);
    let slots = slotsFor(n);
    let dot = (slots[2] * r) / KERNEL_HALF_W;
    while (n > 14 && slots[2] * r * 2 < minDot) {
      n = Math.max(14, Math.floor(n * 0.72));
      slots = slotsFor(n);
      dot = (slots[2] * r) / KERNEL_HALF_W;
    }
    if (slots[2] * r * this.cam.zoom < MIN_DOT_PX) return;
    const shown = drawnCounts(k, real, n);
    const pool = layers.kernels;
    const co = Math.cos(angle);
    const si = Math.sin(angle);
    let i = 0;
    const put = (kind: KernelKind | null, scale: number, alpha = 1) => {
      const lx = slots[i * 3] * r;
      const ly = slots[i * 3 + 1] * r;
      const wx = x + lx * co - ly * si;
      const wy = y + lx * si + ly * co;
      const tex = kind ? this.tex.kernels[kind] : this.tex.kernels.sunny;
      const rx = dot * scale;
      pool.place(tex, wx, wy, rx, rx, kind ? WHITE : 0x6b4a1b, alpha, angle);
      i++;
    };
    // Power kernels sit in the top band, then plain kernels, then empty sockets.
    for (const kind of POWER_KINDS) for (let c = shown[kind]; c > 0; c--) put(kind, 0.92);
    for (const kind of PLAIN_KINDS) for (let c = shown[kind]; c > 0; c--) put(kind, 1);
    while (i < n) put(null, 0.55, 0.4);
  }

  private drawEnemy(e: Enemy, x: number, y: number, time: number, toScreenX: (x: number) => number, toScreenY: (y: number) => number): void {
    const layers = this.enemies;
    const { r, cy, angle } = enemyPose(e, y, time, this.cam.zoom);
    // Half again as thick as the first pass, so red and green read on a phone.
    const outline = Math.max(1.7, 1.15 / this.cam.zoom) * 1.5;
    const smug = this.smug.some((mark) => (mark.x - x) ** 2 + (mark.y - y) ** 2 < (r + 30) ** 2);

    const edge = layers.outline;
    if (e.chompable) {
      const wobble = Math.sin(time * 8 + e.id) * 0.08;
      this.strokeStatus(edge, x, cy, r, angle, time, e.id, GREEN, outline * 0.95, 1, outline * (0.48 + wobble));
    } else {
      this.strokeStatus(edge, x, cy, r, angle, time, e.id, RED, outline, 1, outline * 0.5);
      if (e.hunter) {
        // Hunters pulse a second red edge so kids can tell "this one is coming for me".
        const pulse = 0.5 + 0.5 * Math.sin(time * 7 + e.id);
        this.strokeStatus(edge, x, cy, r, angle, time, e.id, RED, outline * 0.55, 0.22 + 0.28 * pulse, outline * (1.05 + pulse * 0.25));
      }
    }
    if (e.frozenLeft > 0) {
      this.strokeStatus(edge, x, cy, r, angle, time, e.id, 0x9ad7ff, outline * 0.75, 1, outline * 0.4);
    } else if (e.slowLeft > 0) {
      this.strokeStatus(edge, x, cy, r, angle, time, e.id, 0x7ec8e3, outline * 0.55, 0.85, outline * 0.32);
    }

    this.drawCobBody(layers, x, cy, r, e.kernels, 0, angle, time, e.id, e.hitFlash > 0);

    const g = layers.overlay;
    if (e.frozenLeft > 0) fillCobBody(g, x, cy, r, angle, time, e.id, 0xd7f3ff, 0.45);
    const mood: Mood = e.frozenLeft > 0 ? 'surprised' : smug ? 'smug' : e.chompable ? 'worried' : 'angry';
    drawFace(g, x, cy, r, angle, e.vx, e.vy, mood);

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
    const px = x + wobble;
    const lean = Math.max(-0.4, Math.min(0.4, p.vx / 110));
    const rock = Math.sin(time * 6) * 0.07;
    const angle = lean * 0.4 + rock + this.twirl;
    const bob = Math.sin(time * 6) * p.r * 0.04;

    if (n <= 1 || p.bare) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 8);
      body.circle(px, y, p.r + 10 + pulse * 6).fill({ color: 0xff5050, alpha: 0.18 + pulse * 0.2 });
    }

    this.playerLayer.alpha = flashing ? 0.55 : 1;
    if (p.bare) {
      body.ellipse(px, y + bob, p.r * 0.85, p.r * 0.7).fill(BARE_TINT).stroke({ width: Math.max(3, p.r * 0.06), color: INK });
      body.ellipse(px, y + bob + p.r * 0.15, p.r * 1.05, p.r * 0.55).fill(0x6aa84f).stroke({ width: Math.max(2, p.r * 0.05), color: INK });
    } else {
      this.drawCobBody(layers, px, y + bob, p.r, p.kernels, p.sockets, angle, time, 1, flashing);
    }
    layers.kernels.end();

    const fill = p.sockets > 0 ? n / p.sockets : 1;
    const mood: Mood = p.bare ? 'asleep' : n <= 1 ? 'worried' : p.streakTimer > 0 ? 'chewing' : fill < 0.45 ? 'determined' : 'happy';
    drawFace(g, px, y + bob, p.r, p.bare ? 0 : angle, p.facingX, p.facingY, mood);
    if (p.bare) {
      const zBucket = Math.floor(time * 1.4);
      if (zBucket !== this.lastZ) {
        this.lastZ = zBucket;
        this.floater(px + p.r * 0.4, y - p.r, 'Zzz', WHITE, 18, 1.1);
      }
    }

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
  return { outline: new Graphics(), body: new Graphics(), kernels: new SpritePool(kernelLayer), overlay: new Graphics() };
}

/** Bob, lean, and on-screen size shared by the cob drawing and its aim marker. */
function enemyPose(e: Enemy, y: number, time: number, zoom: number): { r: number; cy: number; angle: number } {
  const r = Math.max(e.r, MIN_ENEMY_PX / zoom);
  const jiggly = e.type === 'soggy' ? 1.4 : e.type === 'rocky' ? 0.45 : 1;
  const bob = Math.sin(time * 6 * jiggly + e.id) * r * 0.055 * jiggly;
  const lean = Math.max(-0.45, Math.min(0.45, e.vx / 90));
  const rock = Math.sin(time * 5 * jiggly + e.id) * (e.chompable ? 0.14 : 0.08) * jiggly;
  return { r, cy: y + bob, angle: lean * 0.35 + rock };
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
