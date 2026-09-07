import { audio } from './context';

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.6, slideTo?: number, when = 0): void {
  const ctx = audio.ctx;
  const out = audio.sfx;
  if (!ctx || !out) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function pop(dur: number, vol = 0.5, freq = 900, when = 0): void {
  const ctx = audio.ctx;
  const out = audio.sfx;
  if (!ctx || !out) return;
  const t0 = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = audio.noiseBuffer();
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** Soft jelly landing. */
  drop(strength: number): void {
    const v = Math.min(0.5, 0.15 + strength * 0.05);
    tone(260, 0.09, 'sine', v, 140);
    pop(0.05, v * 0.6, 700);
  },
  /** Two jellies squish together; pitch climbs with the tier. */
  merge(tier: number): void {
    const f = 330 * Math.pow(2, tier / 7);
    pop(0.06, 0.35, 1200);
    tone(f * 0.8, 0.12, 'sine', 0.45, f);
    tone(f * 1.5, 0.18, 'triangle', 0.4, undefined, 0.07);
    if (tier >= 6) tone(f * 2, 0.25, 'triangle', 0.3, undefined, 0.14);
  },
  /** Two watermelons vanish. */
  vanish(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.5, undefined, i * 0.09));
    pop(0.4, 0.5, 2500);
  },
  gameOver(): void {
    [392, 349, 311, 261].forEach((f, i) => tone(f, 0.38, 'sawtooth', 0.3, undefined, i * 0.22));
  },
  click(): void {
    tone(1200, 0.04, 'square', 0.15);
  },
};
