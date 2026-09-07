import { JAR_BOTTOM, JAR_X0, JAR_X1, NECK_Y, RIM_Y, WORLD_H, WORLD_W } from '../game/constants';

/**
 * A glass mason jar drawn in two layers: everything behind the fruits (back wall, far rim,
 * far thread ridges) and everything in front (near glass with highlights, near rim lip, near
 * threads). Both are drawn in world coordinates onto an offscreen canvas sized to the current
 * render scale so they stay crisp on any DPR.
 */
const CX = (JAR_X0 + JAR_X1) / 2;
/** Outer half-widths. Glass is ~10 px thick around the physics interior. */
const BODY_HW = JAR_X1 - CX + 10;
const NECK_HW = BODY_HW - 4;
const RIDGE_HW = NECK_HW + 8;
const SHOULDER_Y = NECK_Y + 55;
const BOTTOM_RY = 34;
const RIM_RX = NECK_HW + 6;
const RIM_RY = 40;
const RIM_INNER_RX = NECK_HW - 12;
const RIM_INNER_RY = 33;
const RIDGES = [RIM_Y + 14, RIM_Y + 30, RIM_Y + 46];

export interface JarLayers {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
}

export function buildJarLayers(scale: number): JarLayers {
  return { back: layer(scale, drawBack), front: layer(scale, drawFront) };
}

function layer(scale: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(WORLD_W * scale);
  c.height = Math.ceil(WORLD_H * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  draw(g);
  return c;
}

/** Silhouette of the jar body from the neck down, not including the bottom ellipse's front half. */
function bodyPath(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.moveTo(CX - NECK_HW, NECK_Y);
  g.quadraticCurveTo(CX - BODY_HW - 2, NECK_Y + 12, CX - BODY_HW, SHOULDER_Y);
  g.lineTo(CX - BODY_HW, JAR_BOTTOM);
  g.ellipse(CX, JAR_BOTTOM, BODY_HW, BOTTOM_RY, 0, Math.PI, 0, true);
  g.lineTo(CX + BODY_HW, SHOULDER_Y);
  g.quadraticCurveTo(CX + BODY_HW + 2, NECK_Y + 12, CX + NECK_HW, NECK_Y);
  g.lineTo(CX + NECK_HW, RIM_Y);
  g.lineTo(CX - NECK_HW, RIM_Y);
  g.closePath();
}

function drawBack(g: CanvasRenderingContext2D): void {
  // Soft shadow on the table.
  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(70,40,20,0.28)';
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM + 26, BODY_HW + 26, 30, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Back wall tint: glass is bluish and slightly denser at the edges.
  g.save();
  bodyPath(g);
  g.clip();
  const tint = g.createLinearGradient(CX - BODY_HW, 0, CX + BODY_HW, 0);
  tint.addColorStop(0, 'rgba(150,200,230,0.42)');
  tint.addColorStop(0.18, 'rgba(200,235,255,0.16)');
  tint.addColorStop(0.5, 'rgba(215,240,255,0.10)');
  tint.addColorStop(0.82, 'rgba(200,235,255,0.16)');
  tint.addColorStop(1, 'rgba(150,200,230,0.42)');
  g.fillStyle = tint;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Base thickness: a denser ellipse where the glass bottom is.
  const baseGrad = g.createRadialGradient(CX, JAR_BOTTOM, 20, CX, JAR_BOTTOM, BODY_HW);
  baseGrad.addColorStop(0, 'rgba(160,210,235,0.25)');
  baseGrad.addColorStop(1, 'rgba(120,175,210,0.55)');
  g.fillStyle = baseGrad;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM, BODY_HW, BOTTOM_RY, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM - 6, BODY_HW - 14, BOTTOM_RY - 8, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  // Far half of the thread ridges.
  for (const y of RIDGES) {
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(CX, y, RIDGE_HW, 11, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }

  // Far half of the rim lip (top of the opening).
  g.save();
  g.beginPath();
  g.rect(0, 0, WORLD_W, RIM_Y);
  g.clip();
  rimRing(g, 'rgba(225,245,255,0.55)', 'rgba(150,195,225,0.5)');
  g.restore();
  // The opening itself: faint glass tint so it reads as a hole.
  g.fillStyle = 'rgba(180,220,245,0.18)';
  g.beginPath();
  g.ellipse(CX, RIM_Y, RIM_INNER_RX, RIM_INNER_RY, 0, 0, Math.PI * 2);
  g.fill();
}

function rimRing(g: CanvasRenderingContext2D, top: string, bottom: string): void {
  const grad = g.createLinearGradient(0, RIM_Y - RIM_RY, 0, RIM_Y + RIM_RY);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI * 2);
  g.ellipse(CX, RIM_Y, RIM_INNER_RX, RIM_INNER_RY, 0, 0, Math.PI * 2, true);
  g.fill('evenodd');
  g.strokeStyle = 'rgba(90,135,170,0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(CX, RIM_Y, RIM_INNER_RX, RIM_INNER_RY, 0, 0, Math.PI * 2);
  g.stroke();
}

function drawFront(g: CanvasRenderingContext2D): void {
  g.save();
  bodyPath(g);
  g.clip();
  // Overall front-glass sheen.
  g.fillStyle = 'rgba(220,240,255,0.07)';
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Edge darkening inside both walls (refraction makes the sides look denser).
  const left = g.createLinearGradient(CX - BODY_HW, 0, CX - BODY_HW + 22, 0);
  left.addColorStop(0, 'rgba(60,105,140,0.42)');
  left.addColorStop(1, 'rgba(60,105,140,0)');
  g.fillStyle = left;
  g.fillRect(CX - BODY_HW, 0, 22, WORLD_H);
  const right = g.createLinearGradient(CX + BODY_HW, 0, CX + BODY_HW - 22, 0);
  right.addColorStop(0, 'rgba(60,105,140,0.42)');
  right.addColorStop(1, 'rgba(60,105,140,0)');
  g.fillStyle = right;
  g.fillRect(CX + BODY_HW - 22, 0, 22, WORLD_H);
  // Main vertical highlight band (left) with soft edges.
  const band = g.createLinearGradient(CX - BODY_HW + 14, 0, CX - BODY_HW + 60, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  band.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band;
  roundRect(g, CX - BODY_HW + 14, SHOULDER_Y + 10, 46, JAR_BOTTOM - SHOULDER_Y - 40, 20);
  g.fill();
  // Thin secondary highlight on the right.
  const band2 = g.createLinearGradient(CX + BODY_HW - 34, 0, CX + BODY_HW - 18, 0);
  band2.addColorStop(0, 'rgba(255,255,255,0)');
  band2.addColorStop(0.5, 'rgba(255,255,255,0.42)');
  band2.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = band2;
  roundRect(g, CX + BODY_HW - 34, SHOULDER_Y + 40, 16, JAR_BOTTOM - SHOULDER_Y - 90, 8);
  g.fill();
  // Shoulder highlights.
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(CX - NECK_HW + 6, NECK_Y + 2);
  g.quadraticCurveTo(CX - BODY_HW + 6, NECK_Y + 14, CX - BODY_HW + 8, SHOULDER_Y + 6);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.moveTo(CX + NECK_HW - 6, NECK_Y + 2);
  g.quadraticCurveTo(CX + BODY_HW - 6, NECK_Y + 14, CX + BODY_HW - 8, SHOULDER_Y + 6);
  g.stroke();
  // Caustic streaks near the bottom.
  g.strokeStyle = 'rgba(255,255,255,0.3)';
  g.lineWidth = 2;
  for (const [x0, x1] of [[CX - 90, CX - 40], [CX + 20, CX + 70]] as const) {
    g.beginPath();
    g.moveTo(x0, JAR_BOTTOM - 26);
    g.quadraticCurveTo((x0 + x1) / 2, JAR_BOTTOM - 34, x1, JAR_BOTTOM - 24);
    g.stroke();
  }
  g.restore();

  // Near half of the glass bottom (the thick rounded base).
  const baseGrad = g.createLinearGradient(0, JAR_BOTTOM, 0, JAR_BOTTOM + BOTTOM_RY);
  baseGrad.addColorStop(0, 'rgba(200,235,255,0.25)');
  baseGrad.addColorStop(1, 'rgba(140,190,220,0.6)');
  g.fillStyle = baseGrad;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM, BODY_HW, BOTTOM_RY, 0, 0, Math.PI);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM, BODY_HW - 3, BOTTOM_RY - 3, 0, 0.1, Math.PI - 0.1);
  g.stroke();

  // Outer silhouette.
  bodyPath(g);
  g.strokeStyle = 'rgba(90,135,170,0.55)';
  g.lineWidth = 2.5;
  g.stroke();

  // Near half of the thread ridges: shadow, then lit ridge.
  for (const y of RIDGES) {
    g.strokeStyle = 'rgba(40,80,115,0.35)';
    g.lineWidth = 8;
    g.beginPath();
    g.ellipse(CX, y + 3, RIDGE_HW, 11, 0, 0, Math.PI);
    g.stroke();
    const ridge = g.createLinearGradient(CX - RIDGE_HW, 0, CX + RIDGE_HW, 0);
    ridge.addColorStop(0, 'rgba(255,255,255,0.35)');
    ridge.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    ridge.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    ridge.addColorStop(1, 'rgba(255,255,255,0.3)');
    g.strokeStyle = ridge;
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(CX, y, RIDGE_HW, 11, 0, 0, Math.PI);
    g.stroke();
  }
  // Neck side edges.
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(CX - NECK_HW + 4, RIM_Y + 4);
  g.lineTo(CX - NECK_HW + 4, NECK_Y);
  g.moveTo(CX + NECK_HW - 4, RIM_Y + 4);
  g.lineTo(CX + NECK_HW - 4, NECK_Y);
  g.stroke();

  // Near half of the rim lip.
  g.save();
  g.beginPath();
  g.rect(0, RIM_Y, WORLD_W, WORLD_H);
  g.clip();
  rimRing(g, 'rgba(240,250,255,0.85)', 'rgba(165,205,235,0.75)');
  g.restore();
  // Lip highlight streak.
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(CX, RIM_Y, RIM_RX - 4, RIM_RY - 4, 0, Math.PI * 0.62, Math.PI * 0.95);
  g.stroke();
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export const JAR_CX = CX;
export const JAR_RIM = { rx: RIM_INNER_RX, ry: RIM_INNER_RY };
