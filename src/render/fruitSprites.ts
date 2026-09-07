import { FRUITS, type FruitSpec } from '../game/fruits';
import { Rng } from '../game/rng';

/**
 * Jelly fruit sprites. Each tier is drawn once per pixel size into an offscreen canvas in a
 * unit space (fruit radius = 1) and cached. The look is a glossy translucent gummy: offset
 * radial gradient, sub-surface glow on the lit-through side, rim light, sharp specular.
 */
const cache = new Map<string, HTMLCanvasElement>();

/** Sprite canvas is PAD × radius wide so stems, leaves and crowns fit. */
export const SPRITE_PAD = 1.6;

export function clearSpriteCache(): void {
  cache.clear();
}

export function getSprite(tier: number, pxRadius: number): HTMLCanvasElement {
  const r = Math.max(4, Math.round(pxRadius / 2) * 2);
  const key = `${tier}:${r}`;
  let c = cache.get(key);
  if (!c) {
    c = buildSprite(tier, r);
    cache.set(key, c);
  }
  return c;
}

function buildSprite(tier: number, r: number): HTMLCanvasElement {
  const spec = FRUITS[tier]!;
  const size = Math.ceil(r * SPRITE_PAD * 2);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.translate(size / 2, size / 2);
  g.scale(r, r);
  drawJelly(g, spec, tier);
  return c;
}

/** Draw a full jelly fruit centred at the origin with radius 1. */
export function drawJelly(g: CanvasRenderingContext2D, spec: FruitSpec, tier: number): void {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // --- decorations that sit behind the body (grape cluster halo, pineapple crown back) ---
  g.save();
  circleClip(g);
  base(g, spec);
  DETAIL[spec.key]?.(g, spec, tier);
  gloss(g, spec);
  g.restore();
  outline(g, spec);
  TOP[spec.key]?.(g, spec);
  g.restore();
}

function circleClip(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.arc(0, 0, 1, 0, Math.PI * 2);
  g.clip();
}

function base(g: CanvasRenderingContext2D, s: FruitSpec): void {
  const grad = g.createRadialGradient(-0.35, -0.4, 0.05, 0, 0, 1.25);
  grad.addColorStop(0, s.light);
  grad.addColorStop(0.42, s.color);
  grad.addColorStop(1, s.dark);
  g.fillStyle = grad;
  g.fillRect(-1, -1, 2, 2);
}

function gloss(g: CanvasRenderingContext2D, s: FruitSpec): void {
  // Sub-surface glow: light passing through the jelly on the far side.
  const glow = g.createRadialGradient(0.35, 0.45, 0, 0.3, 0.4, 0.95);
  glow.addColorStop(0, withAlpha(s.light, 0.45));
  glow.addColorStop(1, withAlpha(s.light, 0));
  g.fillStyle = glow;
  g.fillRect(-1, -1, 2, 2);
  // Rim light along the bottom edge.
  g.beginPath();
  g.arc(0, 0, 0.9, Math.PI * 0.15, Math.PI * 0.85);
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 0.14;
  g.stroke();
  // Deep edge darkening for volume.
  const edge = g.createRadialGradient(0, 0, 0.7, 0, 0, 1);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, withAlpha(s.dark, 0.45));
  g.fillStyle = edge;
  g.fillRect(-1, -1, 2, 2);
  // Main specular: soft-edged ellipse top-left.
  g.save();
  g.translate(-0.42, -0.46);
  g.rotate(-Math.PI / 4.5);
  const spec = g.createRadialGradient(0, 0, 0, 0, 0, 0.3);
  spec.addColorStop(0, 'rgba(255,255,255,0.95)');
  spec.addColorStop(0.7, 'rgba(255,255,255,0.75)');
  spec.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = spec;
  g.beginPath();
  g.ellipse(0, 0, 0.3, 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Secondary sparkle.
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.arc(-0.1, -0.66, 0.06, 0, Math.PI * 2);
  g.fill();
  // Tiny lower-right reflection.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(0.45, 0.5, 0.1, 0.05, Math.PI / 4, 0, Math.PI * 2);
  g.fill();
}

function outline(g: CanvasRenderingContext2D, s: FruitSpec): void {
  g.beginPath();
  g.arc(0, 0, 0.985, 0, Math.PI * 2);
  g.strokeStyle = withAlpha(s.dark, 0.5);
  g.lineWidth = 0.035;
  g.stroke();
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function leaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color = '#4caf50'): void {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const grad = g.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, '#2e7d32');
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, '#a5e07a');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.35, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.35, 0, 0);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 0.02;
  g.beginPath();
  g.moveTo(0.05, 0);
  g.lineTo(len * 0.9, 0);
  g.stroke();
  g.restore();
}

function stem(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w = 0.07): void {
  g.strokeStyle = '#6d4c2a';
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.quadraticCurveTo((x0 + x1) / 2 + 0.15, (y0 + y1) / 2, x1, y1);
  g.stroke();
}

type Detail = (g: CanvasRenderingContext2D, s: FruitSpec, tier: number) => void;

/** Surface detail drawn inside the circle, before the gloss pass. */
const DETAIL: Partial<Record<FruitSpec['key'], Detail>> = {
  cherry(g, s) {
    // Crease from the stem.
    g.strokeStyle = withAlpha(s.dark, 0.35);
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.05, -0.95);
    g.quadraticCurveTo(0.2, -0.5, 0.05, -0.1);
    g.stroke();
  },
  strawberry(g, s) {
    const rng = new Rng(7);
    for (let row = -0.75; row <= 0.85; row += 0.3) {
      const off = Math.round((row + 0.75) / 0.3) % 2 ? 0.16 : 0;
      for (let x = -0.9 + off; x <= 0.9; x += 0.32) {
        if (x * x + row * row > 0.9) continue;
        const jx = x + rng.range(-0.02, 0.02);
        const jy = row + rng.range(-0.02, 0.02);
        // dimple
        g.fillStyle = withAlpha(s.dark, 0.35);
        g.beginPath();
        g.ellipse(jx, jy + 0.02, 0.075, 0.095, 0, 0, Math.PI * 2);
        g.fill();
        // seed
        g.fillStyle = '#ffe9a8';
        g.beginPath();
        g.ellipse(jx, jy, 0.045, 0.07, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath();
        g.ellipse(jx - 0.012, jy - 0.025, 0.015, 0.025, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
  grape(g, s) {
    const pts: [number, number][] = [[0, 0]];
    for (let i = 0; i < 6; i++) pts.push([Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * 0.56, Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * 0.56]);
    // Draw back-to-front so lower berries overlap upper ones' bottoms.
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of pts) {
      const grad = g.createRadialGradient(x - 0.15, y - 0.17, 0.02, x, y, 0.5);
      grad.addColorStop(0, s.light);
      grad.addColorStop(0.45, s.color);
      grad.addColorStop(1, s.dark);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 0.44, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = withAlpha(s.dark, 0.35);
      g.lineWidth = 0.02;
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath();
      g.ellipse(x - 0.16, y - 0.18, 0.11, 0.07, -Math.PI / 4, 0, Math.PI * 2);
      g.fill();
    }
  },
  dekopon(g, s) {
    const rng = new Rng(11);
    g.fillStyle = withAlpha(s.dark, 0.16);
    for (let i = 0; i < 70; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 0.92;
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.028, 0, Math.PI * 2);
      g.fill();
    }
  },
  persimmon(g, s) {
    // Faint horizontal lobes.
    g.strokeStyle = withAlpha(s.dark, 0.18);
    g.lineWidth = 0.05;
    for (const x of [-0.45, 0.45]) {
      g.beginPath();
      g.moveTo(x, -0.85);
      g.quadraticCurveTo(x * 1.3, 0, x, 0.85);
      g.stroke();
    }
  },
  apple(g, s) {
    const blush = g.createRadialGradient(0.35, 0.35, 0, 0.3, 0.3, 0.9);
    blush.addColorStop(0, 'rgba(255,214,90,0.5)');
    blush.addColorStop(1, 'rgba(255,214,90,0)');
    g.fillStyle = blush;
    g.fillRect(-1, -1, 2, 2);
    g.fillStyle = withAlpha(s.dark, 0.35);
    g.beginPath();
    g.ellipse(0, -0.78, 0.26, 0.11, 0, 0, Math.PI * 2);
    g.fill();
  },
  pear(g, s) {
    const bottom = g.createLinearGradient(0, -1, 0, 1);
    bottom.addColorStop(0, 'rgba(255,255,255,0)');
    bottom.addColorStop(1, withAlpha(s.dark, 0.3));
    g.fillStyle = bottom;
    g.fillRect(-1, -1, 2, 2);
    const rng = new Rng(5);
    g.fillStyle = 'rgba(120,80,30,0.28)';
    for (let i = 0; i < 40; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 0.9;
      g.beginPath();
      g.arc(Math.cos(a) * d, Math.sin(a) * d, 0.03, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = withAlpha(s.dark, 0.3);
    g.beginPath();
    g.ellipse(0, -0.82, 0.2, 0.08, 0, 0, Math.PI * 2);
    g.fill();
  },
  peach(g, s) {
    const tone = g.createLinearGradient(-0.8, -0.8, 0.8, 0.8);
    tone.addColorStop(0, 'rgba(255,120,150,0.55)');
    tone.addColorStop(0.55, 'rgba(255,160,122,0)');
    tone.addColorStop(1, 'rgba(255,225,160,0.55)');
    g.fillStyle = tone;
    g.fillRect(-1, -1, 2, 2);
    g.strokeStyle = withAlpha(s.dark, 0.4);
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.05, -0.98);
    g.quadraticCurveTo(0.35, -0.3, 0.1, 0.55);
    g.stroke();
    g.fillStyle = withAlpha(s.dark, 0.3);
    g.beginPath();
    g.ellipse(0, -0.8, 0.22, 0.09, 0, 0, Math.PI * 2);
    g.fill();
  },
  pineapple(g, s) {
    g.strokeStyle = withAlpha(s.dark, 0.35);
    g.lineWidth = 0.045;
    for (const ang of [Math.PI / 3, -Math.PI / 3]) {
      g.save();
      g.rotate(ang);
      for (let x = -1.2; x <= 1.2; x += 0.3) {
        g.beginPath();
        g.moveTo(x, -1.3);
        g.lineTo(x, 1.3);
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = withAlpha(s.dark, 0.3);
    for (let y = -0.9; y <= 0.9; y += 0.26) {
      const off = Math.round((y + 0.9) / 0.26) % 2 ? 0.15 : 0;
      for (let x = -0.9 + off; x <= 0.9; x += 0.3) {
        if (x * x + y * y > 0.85) continue;
        g.beginPath();
        g.arc(x, y, 0.035, 0, Math.PI * 2);
        g.fill();
      }
    }
  },
  melon(g) {
    const rng = new Rng(3);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 0.035;
    for (let i = 0; i < 90; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * 0.95;
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      const dir = rng.range(0, Math.PI * 2);
      const len = rng.range(0.12, 0.3);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(dir + 0.6) * len * 0.5, y + Math.sin(dir + 0.6) * len * 0.5, x + Math.cos(dir) * len, y + Math.sin(dir) * len);
      g.stroke();
    }
  },
  watermelon(g, s) {
    g.strokeStyle = withAlpha(s.dark, 0.85);
    g.lineWidth = 0.17;
    for (let k = -2.5; k <= 2.5; k++) {
      const x = k * 0.33;
      g.beginPath();
      g.moveTo(x * 0.25, -1.05);
      for (let t = 0; t <= 1; t += 0.05) {
        const y = -1.05 + t * 2.1;
        const bulge = Math.sin(t * Math.PI);
        const px = x * (0.25 + 1.1 * bulge) + Math.sin(t * 22 + k) * 0.035;
        g.lineTo(px, y);
      }
      g.stroke();
    }
    // Lighter inner stripe core for depth.
    g.strokeStyle = 'rgba(130,220,120,0.25)';
    g.lineWidth = 0.05;
    for (let k = -2.5; k <= 2.5; k++) {
      const x = k * 0.33;
      g.beginPath();
      for (let t = 0; t <= 1; t += 0.05) {
        const y = -1.05 + t * 2.1;
        const bulge = Math.sin(t * Math.PI);
        const px = x * (0.25 + 1.1 * bulge) + Math.sin(t * 22 + k) * 0.035;
        if (t === 0) g.moveTo(px, y);
        else g.lineTo(px, y);
      }
      g.stroke();
    }
  },
};

type Top = (g: CanvasRenderingContext2D, s: FruitSpec) => void;

/** Bits that poke outside the circle: stems, leaves, crowns. */
const TOP: Partial<Record<FruitSpec['key'], Top>> = {
  cherry(g) {
    stem(g, 0.05, -0.92, 0.35, -1.4, 0.08);
    leaf(g, 0.3, -1.3, 0.35, 0.35);
  },
  strawberry(g) {
    for (let i = -2; i <= 2; i++) leaf(g, 0, -0.82, 0.5, -Math.PI / 2 + i * 0.55);
    g.fillStyle = '#2e7d32';
    g.beginPath();
    g.arc(0, -0.86, 0.09, 0, Math.PI * 2);
    g.fill();
  },
  grape(g) {
    stem(g, 0, -0.95, 0.12, -1.35, 0.07);
  },
  dekopon(g, s) {
    // Bumpy knob on top.
    const grad = g.createRadialGradient(-0.08, -1.05, 0.02, 0, -0.95, 0.35);
    grad.addColorStop(0, s.light);
    grad.addColorStop(0.5, s.color);
    grad.addColorStop(1, s.dark);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, -0.92, 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = withAlpha(s.dark, 0.45);
    g.lineWidth = 0.03;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(-0.1, -1.05, 0.09, 0.05, -Math.PI / 4, 0, Math.PI * 2);
    g.fill();
    stem(g, 0, -1.2, 0.05, -1.4, 0.06);
    leaf(g, 0.03, -1.35, 0.35, -0.2);
  },
  persimmon(g) {
    for (let i = 0; i < 4; i++) leaf(g, 0, -0.9, 0.42, -Math.PI / 2 + (i - 1.5) * 0.8, '#7cb342');
    stem(g, 0, -0.95, 0, -1.25, 0.08);
  },
  apple(g) {
    stem(g, 0, -0.85, 0.12, -1.3, 0.08);
    leaf(g, 0.1, -1.15, 0.4, -0.4);
  },
  pear(g) {
    stem(g, 0, -0.9, -0.08, -1.35, 0.08);
  },
  peach(g) {
    leaf(g, 0.02, -0.9, 0.45, -0.25);
  },
  pineapple(g) {
    for (let i = -3; i <= 3; i++) {
      const a = -Math.PI / 2 + i * 0.28;
      const len = 0.62 - Math.abs(i) * 0.05;
      leaf(g, 0, -0.75, len, a, '#43a047');
    }
  },
  melon(g) {
    stem(g, 0, -0.95, 0.1, -1.3, 0.1);
  },
  watermelon(g) {
    stem(g, 0, -0.95, 0.15, -1.25, 0.11);
  },
};
