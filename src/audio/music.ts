import { audio } from './context';
import { noteToFreq } from './notes';
import { BASE_BPM, SONG, STEP_COUNT, type Drum, type Note } from './song';

/**
 * Lookahead step sequencer ("A Tale of Two Clocks"): a JS timer wakes up every 25 ms and
 * schedules every step that falls inside the next 150 ms on the audio clock, so playback is
 * sample-accurate and the 128-step loop wraps without a gap.
 */
export class Music {
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  /** 0..1 jar fill; the tempo rises with it. */
  fill = 0;
  playing = false;

  start(): void {
    if (!audio.unlock() || !audio.ctx || !audio.music) return;
    if (this.playing) return;
    this.playing = true;
    audio.music.gain.cancelScheduledValues(audio.ctx.currentTime);
    audio.music.gain.setTargetAtTime(0.32, audio.ctx.currentTime, 0.05);
    this.step = 0;
    this.nextTime = audio.ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop(fadeSeconds = 0.6): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (audio.ctx && audio.music) {
      audio.music.gain.cancelScheduledValues(audio.ctx.currentTime);
      audio.music.gain.setTargetAtTime(0, audio.ctx.currentTime, fadeSeconds / 3);
    }
  }

  get bpm(): number {
    return BASE_BPM + 20 * this.fill;
  }

  private tick(): void {
    const ctx = audio.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    // After a suspend/resume the audio clock may have jumped; don't spray a burst of stale steps.
    if (this.nextTime < now - 0.25) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.15) {
      this.schedule(this.step, this.nextTime);
      this.nextTime += 60 / this.bpm / 4;
      this.step = (this.step + 1) % STEP_COUNT;
    }
  }

  private schedule(step: number, t: number): void {
    const stepDur = 60 / this.bpm / 4;
    const lead = SONG.lead[step];
    if (lead) this.lead(lead, t, stepDur);
    const arp = SONG.arp[step];
    if (arp) this.arp(arp, t, stepDur);
    const bass = SONG.bass[step];
    if (bass) this.bass(bass, t, stepDur);
    for (const d of SONG.drums[step] ?? []) this.drum(d, t);
  }

  private lead(n: Note, t: number, stepDur: number): void {
    const ctx = audio.ctx!;
    const out = audio.music!;
    const f = noteToFreq(n.n);
    const dur = n.len * stepDur * 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
    g.gain.setValueAtTime(0.16, t + dur - 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(out);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.setValueAtTime(f, t);
    o1.connect(g);
    o1.start(t);
    o1.stop(t + dur + 0.02);
    // A quiet detuned pulse gives the triangle some chip sparkle.
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    g2.connect(g);
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(f * 2, t);
    o2.detune.value = 6;
    o2.connect(g2);
    o2.start(t);
    o2.stop(t + dur + 0.02);
  }

  private arp(n: Note, t: number, stepDur: number): void {
    const ctx = audio.ctx!;
    const out = audio.music!;
    const dur = stepDur * 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(noteToFreq(n.n), t);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private bass(n: Note, t: number, stepDur: number): void {
    const ctx = audio.ctx!;
    const out = audio.music!;
    const f = noteToFreq(n.n) * 2; // octave 3: audible on phone speakers
    const dur = Math.min(0.22, n.len * stepDur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(out);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.02);
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    g2.connect(g);
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(f, t);
    o2.connect(g2);
    o2.start(t);
    o2.stop(t + dur + 0.02);
  }

  private drum(d: Drum, t: number): void {
    const ctx = audio.ctx!;
    const out = audio.music!;
    if (d === 'kick') {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = audio.noiseBuffer();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (d === 'snare') {
      f.type = 'bandpass';
      f.frequency.value = 1800;
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0.4, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      const tone = ctx.createOscillator();
      const tg = ctx.createGain();
      tone.frequency.setValueAtTime(210, t);
      tg.gain.setValueAtTime(0.3, t);
      tg.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      tone.connect(tg).connect(out);
      tone.start(t);
      tone.stop(t + 0.08);
    } else {
      f.type = 'highpass';
      f.frequency.value = 7000;
      g.gain.setValueAtTime(d === 'hat' ? 0.22 : 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    }
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.15);
  }
}
