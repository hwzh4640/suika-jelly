import { FRUITS } from '../game/fruits';

/** Squash/stretch spring per fruit body: scale = (1 + x, 1 + y). */
export interface Wobble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

const K = 220;
const C = 14;

export class Wobbles {
  private map = new Map<number, Wobble>();

  get(id: number): Wobble {
    let w = this.map.get(id);
    if (!w) {
      w = { x: 0, y: 0, vx: 0, vy: 0, phase: Math.random() * Math.PI * 2 };
      this.map.set(id, w);
    }
    return w;
  }

  /** A body landed or was hit: squash vertically, bulge horizontally. */
  impact(id: number, strength: number): void {
    const s = Math.min(8, strength);
    const w = this.get(id);
    w.vy -= s * 0.9;
    w.vx += s * 0.6;
  }

  /** A freshly merged fruit pops in wide and short. */
  born(id: number): void {
    const w = this.get(id);
    w.x = 0.3;
    w.y = -0.35;
  }

  update(dt: number): void {
    for (const w of this.map.values()) {
      const ax = -K * w.x - C * w.vx;
      const ay = -K * w.y - C * w.vy;
      w.vx += ax * dt;
      w.vy += ay * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.x = Math.max(-0.5, Math.min(0.6, w.x));
      w.y = Math.max(-0.5, Math.min(0.6, w.y));
    }
  }

  /** Drop entries whose bodies no longer exist. */
  prune(alive: Set<number>): void {
    for (const id of this.map.keys()) if (!alive.has(id)) this.map.delete(id);
  }

  clear(): void {
    this.map.clear();
  }
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  ttl: number;
}

export interface Popup {
  x: number;
  y: number;
  text: string;
  life: number;
  ttl: number;
  big: boolean;
}

export class Effects {
  particles: Particle[] = [];
  popups: Popup[] = [];
  /** Screen flash alpha for the watermelon vanish. */
  flash = 0;

  burst(x: number, y: number, tier: number, count = 10): void {
    const spec = FRUITS[tier]!;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 120 + Math.random() * 160 + tier * 10;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        r: 3 + Math.random() * 3 + tier * 0.6,
        color: i % 2 ? spec.light : spec.color,
        life: 0,
        ttl: 0.35 + Math.random() * 0.2,
      });
    }
  }

  popup(x: number, y: number, text: string, big = false): void {
    this.popups.push({ x, y, text, life: 0, ttl: big ? 1.2 : 0.8, big });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life += dt;
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.ttl);
    for (const p of this.popups) p.life += dt;
    this.popups = this.popups.filter((p) => p.life < p.ttl);
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }

  clear(): void {
    this.particles = [];
    this.popups = [];
    this.flash = 0;
  }
}
