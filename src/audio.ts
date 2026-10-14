import type { PowerKind } from './sim/kernels';

/**
 * Tiny synthesized SFX so M0 needs no audio assets. iOS only allows audio after a user
 * gesture, so `unlock()` must be called from a tap handler.
 */
export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicOn = false;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBeat = 0;
  muted = false;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    this.toneAt(this.ctx.currentTime + delay, freq, dur, type, vol, slideTo);
  }

  private toneAt(t: number, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number): void {
    if (!this.ctx || !this.master || this.muted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  fire(kind: PowerKind): void {
    if (kind === 'zinger') this.tone(900, 0.08, 'square', 0.08, 420);
    else if (kind === 'spicy') {
      this.tone(300, 0.18, 'sawtooth', 0.08, 120);
      this.noise(0.18, 0.25, 900);
    } else if (kind === 'frosty') {
      this.tone(1480, 0.09, 'sine', 0.08, 900);
      this.tone(1960, 0.12, 'sine', 0.05);
    } else this.tone(260, 0.2, 'triangle', 0.15, 520);
  }

  chill(): void {
    this.tone(1760, 0.14, 'sine', 0.08, 700);
    this.tone(1320, 0.18, 'triangle', 0.05);
  }

  /** The "that didn't work, switch powers" sound. Must be distinct from everything else. */
  tink(): void {
    this.tone(2600, 0.12, 'sine', 0.22);
    this.tone(3900, 0.09, 'sine', 0.12);
    this.tone(2600, 0.1, 'sine', 0.12, undefined, 0.07);
  }

  pop(weak: boolean): void {
    this.tone(weak ? 520 : 700, 0.07, 'square', weak ? 0.14 : 0.08, weak ? 180 : 300);
    this.noise(0.06, weak ? 0.5 : 0.25, 2000);
  }

  explode(): void {
    this.noise(0.3, 0.6, 500);
    this.tone(140, 0.25, 'sine', 0.3, 50);
  }

  pickup(streak: number): void {
    const f = 660 * Math.pow(2, Math.min(streak - 1, 14) / 12);
    this.tone(f, 0.06, 'sine', 0.07);
  }

  chomp(streak: number): void {
    this.noise(0.12, 0.6, 700);
    this.noise(0.1, 0.5, 400, 0.08);
    const f = 220 * Math.pow(2, Math.min(streak - 1, 8) / 12);
    this.tone(f, 0.15, 'square', 0.08, f * 1.5, 0.02);
  }

  bump(): void {
    this.tone(160, 0.12, 'sine', 0.3, 80);
  }

  ouch(): void {
    this.tone(500, 0.15, 'triangle', 0.15, 250);
  }

  ding(): void {
    this.tone(1320, 0.12, 'triangle', 0.06);
  }

  tierUp(): void {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.12, undefined, i * 0.08));
  }

  heartLock(): void {
    this.tone(200, 0.1, 'square', 0.05);
  }

  uhOh(): void {
    this.tone(600, 0.15, 'triangle', 0.15, 400);
    this.tone(400, 0.25, 'triangle', 0.15, 300, 0.15);
  }

  saved(): void {
    this.tone(500, 0.1, 'triangle', 0.12, 900);
  }

  poppedOut(): void {
    [784, 659, 523, 392].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.12, undefined, i * 0.25));
  }

  poof(): void {
    this.noise(0.2, 0.3, 1500);
  }

  perk(): void {
    [659, 880, 1174].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, undefined, i * 0.07));
  }

  whoosh(): void {
    this.tone(420, 0.12, 'sine', 0.08, 180);
    this.noise(0.1, 0.2, 1200);
  }

  /**
   * A short cheerful loop (pluck, bass, clap). Scheduled a little ahead so it
   * stays in time, and it follows the mute switch.
   */
  startMusic(): void {
    this.unlock();
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBeat = this.ctx.currentTime + 0.05;
    this.pumpMusic();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }

  private pumpMusic(): void {
    if (!this.ctx || !this.master || !this.musicOn) return;
    const beat = 0.42;
    const melody = [523, 659, 784, 659, 880, 784, 659, 587];
    const bass = [196, 196, 247, 196, 220, 220, 196, 175];
    while (this.nextBeat < this.ctx.currentTime + 0.55) {
      const i = Math.round(this.nextBeat / beat) % melody.length;
      if (!this.muted) {
        this.toneAt(this.nextBeat, melody[i], 0.16, 'triangle', 0.045);
        if (i % 2 === 0) this.toneAt(this.nextBeat, bass[i], 0.2, 'sine', 0.05);
        if (i % 4 === 2) this.noise(0.04, 0.06, 1800, Math.max(0, this.nextBeat - this.ctx.currentTime));
      }
      this.nextBeat += beat;
    }
    this.musicTimer = setTimeout(() => this.pumpMusic(), 180);
  }
}
