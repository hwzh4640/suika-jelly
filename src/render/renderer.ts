import { DANGER_Y, DROP_COOLDOWN, DROP_Y, JAR_BOTTOM, JAR_X0, JAR_X1, WORLD_H, WORLD_W } from '../game/constants';
import { FRUITS, fruit } from '../game/fruits';
import type { Game } from '../game/Game';
import { Effects, Wobbles } from './effects';
import { SPRITE_PAD, clearSpriteCache, getSprite } from './fruitSprites';
import { buildJarLayers, type JarLayers } from './jar';

import { FONT } from './font';
export { FONT };

/** World-space y where the table surface starts (behind the jar). */
const TABLE_Y = 610;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  readonly wobbles = new Wobbles();
  readonly effects = new Effects();
  private jar: JarLayers | null = null;
  private bg: HTMLCanvasElement | null = null;
  private time = 0;
  /** 0..1 fade for the held fruit after a drop. */
  private dangerPulse = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not supported');
    this.ctx = ctx;
    this.resize();
  }

  /** Fit the 480x800 world into the element's box, letterboxing, at device pixel ratio. */
  resize(): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = Math.min(w / WORLD_W, h / WORLD_H);
    this.offsetX = (w - WORLD_W * this.scale) / 2;
    this.offsetY = (h - WORLD_H * this.scale) / 2;
    this.jar = null;
    this.bg = null;
    clearSpriteCache();
  }

  /** Convert a client-space point to world coordinates. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = this.canvas.width / rect.width;
    const px = (clientX - rect.left) * dpr;
    const py = (clientY - rect.top) * dpr;
    return { x: (px - this.offsetX) / this.scale, y: (py - this.offsetY) / this.scale };
  }

  private buildBackground(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width;
    c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const W = c.width;
    const H = c.height;
    const tableY = this.offsetY + TABLE_Y * this.scale;
    // Wall: warm cream to peach.
    const wall = g.createLinearGradient(0, 0, 0, tableY);
    wall.addColorStop(0, '#fff3e0');
    wall.addColorStop(1, '#ffd9bf');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, tableY);
    // Soft bokeh circles on the wall.
    const spots: [number, number, number][] = [[0.12, 0.18, 0.16], [0.85, 0.12, 0.12], [0.75, 0.45, 0.2], [0.2, 0.55, 0.14], [0.5, 0.05, 0.1]];
    for (const [fx, fy, fr] of spots) {
      const r = fr * Math.max(W, H);
      const grad = g.createRadialGradient(fx * W, fy * tableY, 0, fx * W, fy * tableY, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
    }
    // Table: wood with grain.
    const wood = g.createLinearGradient(0, tableY, 0, H);
    wood.addColorStop(0, '#d9a877');
    wood.addColorStop(0.08, '#c8905c');
    wood.addColorStop(1, '#a5693c');
    g.fillStyle = wood;
    g.fillRect(0, tableY, W, H - tableY);
    g.strokeStyle = 'rgba(90,50,20,0.14)';
    g.lineWidth = Math.max(1, this.scale * 1.2);
    const seed = [0.37, 0.71, 0.13, 0.92, 0.55, 0.28, 0.81, 0.46];
    for (let i = 0; i < 14; i++) {
      const y = tableY + ((i + 0.5) / 14) * (H - tableY);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= W; x += W / 12) {
        const j = seed[(i + Math.round(x / (W / 12))) % seed.length]!;
        g.lineTo(x, y + (j - 0.5) * 10 * this.scale);
      }
      g.stroke();
    }
    // Table front edge highlight.
    g.fillStyle = 'rgba(255,240,220,0.5)';
    g.fillRect(0, tableY, W, Math.max(1, 2 * this.scale));
    return c;
  }

  impact(id: number, strength: number): void {
    this.wobbles.impact(id, strength);
  }

  merged(tier: number, result: number | null, x: number, y: number, points: number, id: number | null): void {
    this.effects.burst(x, y, tier, result === null ? 24 : 8 + tier);
    this.effects.popup(x, y - fruit(tier).r * 0.6, `+${points}`, result === null);
    if (id !== null) this.wobbles.born(id);
    if (result === null) this.effects.flash = 0.6;
  }

  reset(): void {
    this.wobbles.clear();
    this.effects.clear();
  }

  frame(game: Game, dt: number): void {
    this.time += dt;
    this.wobbles.update(dt);
    this.effects.update(dt);
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    if (!this.bg) this.bg = this.buildBackground();
    if (!this.jar) this.jar = buildJarLayers(this.scale);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.bg, 0, 0);
    g.drawImage(this.jar.back, this.offsetX, this.offsetY);

    g.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    g.lineCap = 'round';

    if (game.state === 'playing') this.drawHeld(g, game);
    this.drawFruits(g, game);
    this.drawParticles(g);

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.jar.front, this.offsetX, this.offsetY);
    g.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    this.drawDangerLine(g, game, dt);
    this.drawPopups(g);

    if (this.effects.flash > 0) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = `rgba(255,255,255,${this.effects.flash * 0.7})`;
      g.fillRect(0, 0, W, H);
    }
  }

  private drawSprite(g: CanvasRenderingContext2D, tier: number, x: number, y: number, angle: number, sx = 1, sy = 1, alpha = 1): void {
    const r = fruit(tier).r;
    const sprite = getSprite(tier, r * this.scale);
    const half = r * SPRITE_PAD;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    // Squash is applied in world axes (gravity), not the body's rotation, so a landing looks like a landing.
    g.scale(sx, sy);
    g.rotate(angle);
    g.drawImage(sprite, -half, -half, half * 2, half * 2);
    g.restore();
  }

  private drawHeld(g: CanvasRenderingContext2D, game: Game): void {
    const tier = game.current;
    const r = fruit(tier).r;
    const x = game.aimX;
    const bob = Math.sin(this.time * 2.2) * 2;
    const y = DROP_Y + bob;
    // Fade/pop in after a drop.
    const t = 1 - game.cooldown / DROP_COOLDOWN;
    const s = t >= 1 ? 1 : 0.6 + 0.4 * easeOutBack(t);
    // Aim guide down to the pile.
    g.save();
    g.setLineDash([6, 8]);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y + r);
    g.lineTo(x, JAR_BOTTOM - 4);
    g.stroke();
    g.restore();
    // String from the top.
    g.strokeStyle = 'rgba(120,90,60,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, -10);
    g.lineTo(x, y - r * 0.9);
    g.stroke();
    this.drawSprite(g, tier, x, y, 0, s, s, Math.min(1, 0.4 + t));
  }

  private drawFruits(g: CanvasRenderingContext2D, game: Game): void {
    const alive = new Set<number>();
    const bodies = game.bodies();
    for (const b of bodies) {
      alive.add(b.id);
      const w = this.wobbles.get(b.id);
      const breathe = Math.sin(this.time * 3 + w.phase) * 0.008;
      this.drawSprite(g, b.tier, b.x, b.y, b.angle, 1 + w.x + breathe, 1 + w.y - breathe);
    }
    this.wobbles.prune(alive);
  }

  private drawParticles(g: CanvasRenderingContext2D): void {
    for (const p of this.effects.particles) {
      const k = 1 - p.life / p.ttl;
      g.globalAlpha = k;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.25, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  private drawDangerLine(g: CanvasRenderingContext2D, game: Game, dt: number): void {
    const target = game.state === 'playing' && game.dangerActive ? 1 : 0;
    this.dangerPulse += (target - this.dangerPulse) * Math.min(1, dt * 8);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 9);
    const alpha = 0.18 + this.dangerPulse * (0.35 + 0.45 * pulse);
    g.save();
    g.setLineDash([10, 8]);
    g.lineWidth = 2 + this.dangerPulse * 1.5;
    g.strokeStyle = this.dangerPulse > 0.05 ? `rgba(255,60,60,${alpha})` : `rgba(255,255,255,${alpha + 0.2})`;
    g.beginPath();
    g.moveTo(JAR_X0 + 4, DANGER_Y);
    g.lineTo(JAR_X1 - 4, DANGER_Y);
    g.stroke();
    g.restore();
    if (this.dangerPulse > 0.05) {
      const grad = g.createLinearGradient(0, DANGER_Y - 60, 0, DANGER_Y);
      grad.addColorStop(0, 'rgba(255,60,60,0)');
      grad.addColorStop(1, `rgba(255,60,60,${0.22 * this.dangerPulse * (0.6 + 0.4 * pulse)})`);
      g.fillStyle = grad;
      g.fillRect(JAR_X0, DANGER_Y - 60, JAR_X1 - JAR_X0, 60);
    }
  }

  private drawPopups(g: CanvasRenderingContext2D): void {
    for (const p of this.effects.popups) {
      const k = p.life / p.ttl;
      const y = p.y - k * 50;
      g.globalAlpha = 1 - k * k;
      g.font = `800 ${p.big ? 40 : 24}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 5;
      g.strokeStyle = 'rgba(70,30,10,0.75)';
      g.strokeText(p.text, p.x, y);
      g.fillStyle = p.big ? '#ffe066' : '#ffffff';
      g.fillText(p.text, p.x, y);
    }
    g.globalAlpha = 1;
  }

  /** Paint a fruit icon into a small square canvas (HUD "next" preview, evolution ring). */
  static drawIcon(canvas: HTMLCanvasElement, tier: number, cssSize: number): void {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const size = Math.round(cssSize * dpr);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = `${cssSize}px`;
      canvas.style.height = `${cssSize}px`;
    }
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, size, size);
    const r = size / (SPRITE_PAD * 2);
    const sprite = getSprite(tier, r);
    g.drawImage(sprite, 0, 0, size, size);
  }
}

export const TIERS = FRUITS.length;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
