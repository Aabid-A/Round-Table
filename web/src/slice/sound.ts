import type { Cue } from './cues.js';

const KEY = 'round-table-slice-muted';

/** Whether sound is muted. Remembered between visits; off (muted false) only after the player has clicked once, since a page may not make sound before. */
export function readMuted(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
export function writeMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* the setting simply is not remembered */
  }
}

/** Sound made from oscillators and filtered noise: a chair on stone, wooden tokens, a candle hissing out, a low bell. Created on the first click. */
export class Sound {
  private ctx: AudioContext | null = null;
  private fire: GainNode | null = null;
  muted: boolean;
  constructor(muted: boolean) {
    this.muted = muted;
  }
  /** Start the audio engine (after a click) and the low fire bed. */
  start(): void {
    if (this.ctx || typeof AudioContext === 'undefined') return;
    this.ctx = new AudioContext();
    this.fire = this.ctx.createGain();
    this.fire.gain.value = this.muted ? 0 : 0.05;
    const noise = this.noise(2);
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    noise.connect(lp).connect(this.fire).connect(this.ctx.destination);
    noise.start();
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.fire && this.ctx) this.fire.gain.setTargetAtTime(muted ? 0 : 0.05, this.ctx.currentTime, 0.1);
  }
  private noise(seconds: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }
  private burst(freq: number, q: number, seconds: number, gain: number, sweepTo?: number): void {
    const ctx = this.ctx!;
    const src = this.noise(seconds);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + seconds);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }
  private tone(freq: number, seconds: number, gain: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + seconds + 0.05);
  }
  play(cue: Cue): void {
    if (!this.ctx || this.muted) return;
    switch (cue) {
      case 'chair': this.burst(180, 1.2, 0.7, 0.35, 90); break;
      case 'point': this.burst(900, 2, 0.12, 0.12, 400); break;
      case 'token': for (let i = 0; i < 4; i++) setTimeout(() => this.ready() && this.burst(1400 - i * 120, 6, 0.09, 0.25), i * 350); break;
      case 'mask': this.burst(300, 3, 0.18, 0.4); this.tone(90, 0.5, 0.25); break;
      case 'snuff': for (let i = 0; i < 6; i++) setTimeout(() => this.ready() && this.burst(3200, 0.8, 0.5, 0.18, 1400), i * 600); break;
      case 'dawn': this.tone(196, 2.6, 0.12); this.tone(294, 2.2, 0.06); break;
      case 'select': this.tone(520, 0.14, 0.08, 'triangle'); break;
      case 'confirm': this.tone(392, 0.2, 0.1, 'triangle'); this.tone(588, 0.3, 0.08, 'triangle'); break;
    }
  }
  private ready(): boolean {
    return this.ctx !== null && !this.muted;
  }
}
