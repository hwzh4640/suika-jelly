import { JAR_BOTTOM, JAR_X0, JAR_X1, NECK_X1, NECK_Y, RIM_Y, SHOULDER_Y, WORLD_H, WORLD_W } from '../game/constants';
import { FONT } from './font';

/**
 * A glass mason jar, drawn in two layers around the fruit: `back` holds everything you see
 * through the fruit (inner back wall, floor, far half of the lip and threads); `front` holds
 * the near glass (Fresnel edges, wall thickness, reflections, near lip, threads, thick base,
 * embossed logo). Every horizontal circle is foreshortened by the same factor K so the lip,
 * threads, shoulder and base all agree on one viewing angle, slightly from above.
 */
const K = 0.17;
const CX = (JAR_X0 + JAR_X1) / 2;
const WALL = 9;
/** Half-widths. Inner ones coincide with the physics walls. */
const BODY_IN = JAR_X1 - CX;
const BODY_OUT = BODY_IN + WALL;
const NECK_IN = NECK_X1 - CX;
const NECK_OUT = NECK_IN + WALL;
const THREAD_R = NECK_OUT + 7;
const LIP_OUT = NECK_OUT + 9;
const LIP_IN = NECK_IN;
/** Centre line of the outer bottom ellipse; the inner floor is JAR_BOTTOM. */
const BASE_Y = JAR_BOTTOM + 9;
const ry = (rx: number) => rx * K;

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

/** One side of the outer profile from just under the lip down to the base centre line. */
function sideProfile(g: CanvasRenderingContext2D, side: -1 | 1, inset = 0, start = true): void {
  const x = (hw: number) => CX + side * (hw - inset);
  if (start) g.moveTo(x(NECK_OUT), RIM_Y + 6);
  else g.lineTo(x(NECK_OUT), RIM_Y + 6);
  g.lineTo(x(NECK_OUT), NECK_Y);
  g.bezierCurveTo(x(NECK_OUT), NECK_Y + 26, x(BODY_OUT), SHOULDER_Y - 18, x(BODY_OUT), SHOULDER_Y);
  g.lineTo(x(BODY_OUT), BASE_Y);
}

/** Closed outer silhouette: down the left, around the base, up the right, across under the lip. */
function silhouette(g: CanvasRenderingContext2D, inset = 0): void {
  g.beginPath();
  sideProfile(g, -1, inset);
  g.ellipse(CX, BASE_Y, BODY_OUT - inset, ry(BODY_OUT - inset), 0, Math.PI, 0, true);
  // right side, bottom-up
  const x = (hw: number) => CX + (hw - inset);
  g.lineTo(x(BODY_OUT), SHOULDER_Y);
  g.bezierCurveTo(x(BODY_OUT), SHOULDER_Y - 18, x(NECK_OUT), NECK_Y + 26, x(NECK_OUT), NECK_Y);
  g.lineTo(x(NECK_OUT), RIM_Y + 6);
  g.closePath();
}

/** Points along the thread helix; `front` selects the half facing the viewer. */
function helix(g: CanvasRenderingContext2D, front: boolean): void {
  const turns = 2.3;
  const y0 = RIM_Y + 15;
  const pitch = 16;
  const r = ry(THREAD_R);
  let drawing = false;
  g.beginPath();
  const n = Math.round(turns * 140);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * turns;
    const th = t * Math.PI * 2 + Math.PI; // start at the back so the thread begins hidden
    const x = CX + THREAD_R * Math.cos(th);
    const y = y0 + pitch * t + r * Math.sin(th);
    const isFront = Math.sin(th) > 0.02;
    if (isFront === front) {
      if (!drawing) g.moveTo(x, y);
      else g.lineTo(x, y);
      drawing = true;
    } else drawing = false;
  }
}

function lipRing(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_OUT, ry(LIP_OUT), 0, 0, Math.PI * 2);
  g.ellipse(CX, RIM_Y, LIP_IN, ry(LIP_IN), 0, 0, Math.PI * 2, true);
}

function drawBack(g: CanvasRenderingContext2D): void {
  // Contact shadow on the table, soft and slightly behind.
  g.save();
  g.filter = 'blur(7px)';
  g.fillStyle = 'rgba(80,45,20,0.30)';
  g.beginPath();
  g.ellipse(CX + 6, BASE_Y + 10, BODY_OUT + 18, ry(BODY_OUT) + 14, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.filter = 'blur(2px)';
  g.fillStyle = 'rgba(60,35,15,0.35)';
  g.beginPath();
  g.ellipse(CX, BASE_Y + 4, BODY_OUT, ry(BODY_OUT) + 2, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Inner back wall: glass tint, dense at the edges (Fresnel), clear in the middle,
  // with a faint vertical falloff so the top reads lighter than the base.
  g.save();
  silhouette(g);
  g.clip();
  const tint = g.createLinearGradient(CX - BODY_OUT, 0, CX + BODY_OUT, 0);
  tint.addColorStop(0, 'rgba(120,170,205,0.55)');
  tint.addColorStop(0.07, 'rgba(160,205,235,0.30)');
  tint.addColorStop(0.25, 'rgba(205,235,252,0.12)');
  tint.addColorStop(0.5, 'rgba(220,242,255,0.08)');
  tint.addColorStop(0.75, 'rgba(205,235,252,0.12)');
  tint.addColorStop(0.93, 'rgba(160,205,235,0.30)');
  tint.addColorStop(1, 'rgba(120,170,205,0.55)');
  g.fillStyle = tint;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  const vert = g.createLinearGradient(0, RIM_Y, 0, BASE_Y);
  vert.addColorStop(0, 'rgba(255,255,255,0.10)');
  vert.addColorStop(1, 'rgba(90,140,180,0.16)');
  g.fillStyle = vert;
  g.fillRect(0, 0, WORLD_W, WORLD_H);
  // Refraction bands: the background seen through the curved glass darkens toward the sides.
  for (const s of [-1, 1] as const) {
    const x0 = CX + s * BODY_IN;
    const band = g.createLinearGradient(x0, 0, x0 - s * 46, 0);
    band.addColorStop(0, 'rgba(70,110,145,0.30)');
    band.addColorStop(1, 'rgba(70,110,145,0)');
    g.fillStyle = band;
    g.fillRect(Math.min(x0, x0 - s * 46), SHOULDER_Y, 46, JAR_BOTTOM - SHOULDER_Y);
  }
  // Inner edges of the back wall.
  g.strokeStyle = 'rgba(50,90,125,0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  sideProfile(g, -1, WALL);
  sideProfile(g, 1, WALL);
  g.stroke();
  // Thick glass floor seen from above: a bright disc with a denser ring and a soft centre.
  const floor = g.createRadialGradient(CX, JAR_BOTTOM, 10, CX, JAR_BOTTOM, BODY_IN);
  floor.addColorStop(0, 'rgba(210,240,255,0.30)');
  floor.addColorStop(0.7, 'rgba(160,210,240,0.42)');
  floor.addColorStop(1, 'rgba(110,165,205,0.70)');
  g.fillStyle = floor;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM, BODY_IN, ry(BODY_IN), 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM - 3, BODY_IN - 16, ry(BODY_IN - 16), 0, 0, Math.PI * 2);
  g.stroke();
  // A soft caustic glow on the floor where light focuses through the jar.
  const caustic = g.createRadialGradient(CX + 30, JAR_BOTTOM - 2, 0, CX + 30, JAR_BOTTOM - 2, 90);
  caustic.addColorStop(0, 'rgba(255,255,240,0.45)');
  caustic.addColorStop(1, 'rgba(255,255,240,0)');
  g.fillStyle = caustic;
  g.beginPath();
  g.ellipse(CX + 30, JAR_BOTTOM - 2, 90, ry(90), 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Far half of the thread helix, dimmed by the glass in front of it.
  g.strokeStyle = 'rgba(70,110,150,0.28)';
  g.lineWidth = 6;
  helix(g, false);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 3;
  helix(g, false);
  g.stroke();

  // Far half of the lip bead and the inside of the mouth.
  g.save();
  g.beginPath();
  g.rect(0, 0, WORLD_W, RIM_Y);
  g.clip();
  const backLip = g.createLinearGradient(0, RIM_Y - ry(LIP_OUT), 0, RIM_Y);
  backLip.addColorStop(0, 'rgba(230,246,255,0.75)');
  backLip.addColorStop(1, 'rgba(150,195,228,0.55)');
  g.fillStyle = backLip;
  lipRing(g);
  g.fill('evenodd');
  g.strokeStyle = 'rgba(80,125,165,0.5)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_OUT, ry(LIP_OUT), 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
  // Mouth: the inner wall curving away, dark at the back, clear toward the front.
  g.save();
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_IN, ry(LIP_IN), 0, 0, Math.PI * 2);
  g.clip();
  const mouth = g.createLinearGradient(0, RIM_Y - ry(LIP_IN), 0, RIM_Y + ry(LIP_IN) * 0.4);
  mouth.addColorStop(0, 'rgba(50,90,130,0.55)');
  mouth.addColorStop(0.5, 'rgba(120,170,210,0.25)');
  mouth.addColorStop(1, 'rgba(180,220,245,0.10)');
  g.fillStyle = mouth;
  g.fillRect(0, RIM_Y - 40, WORLD_W, 80);
  g.restore();
}

function drawFront(g: CanvasRenderingContext2D): void {
  // Everything inside the silhouette.
  g.save();
  silhouette(g);
  g.clip();
  // Faint overall sheen, a touch warmer at the top where the room reflects.
  const sheen = g.createLinearGradient(0, RIM_Y, 0, BASE_Y);
  sheen.addColorStop(0, 'rgba(255,245,235,0.10)');
  sheen.addColorStop(0.5, 'rgba(225,242,255,0.05)');
  sheen.addColorStop(1, 'rgba(200,230,250,0.10)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  // Fresnel: glass brightens sharply at grazing angles along both edges.
  for (const s of [-1, 1] as const) {
    const x0 = CX + s * BODY_OUT;
    const fres = g.createLinearGradient(x0, 0, x0 - s * 30, 0);
    fres.addColorStop(0, `rgba(255,255,255,${s < 0 ? 0.75 : 0.55})`);
    fres.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    fres.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fres;
    g.fillRect(Math.min(x0, x0 - s * 30), SHOULDER_Y - 6, 30, BASE_Y - SHOULDER_Y + 40);
    const xn = CX + s * NECK_OUT;
    const fresN = g.createLinearGradient(xn, 0, xn - s * 22, 0);
    fresN.addColorStop(0, `rgba(255,255,255,${s < 0 ? 0.7 : 0.5})`);
    fresN.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = fresN;
    g.fillRect(Math.min(xn, xn - s * 22), RIM_Y, 22, NECK_Y - RIM_Y + 4);
  }
  // Wall thickness: the glass seen edge-on along the profile. Bright core, dark inner boundary.
  for (const s of [-1, 1] as const) {
    g.beginPath();
    sideProfile(g, s, WALL / 2);
    g.strokeStyle = `rgba(240,250,255,${s < 0 ? 0.6 : 0.45})`;
    g.lineWidth = WALL - 2;
    g.stroke();
    g.beginPath();
    sideProfile(g, s, WALL);
    g.strokeStyle = 'rgba(55,95,135,0.45)';
    g.lineWidth = 1.6;
    g.stroke();
  }
  // Shoulder: a lit bevel on the left, shadowed on the right, with a bright crease where it meets the body.
  const shL = g.createLinearGradient(0, NECK_Y - 4, 0, SHOULDER_Y + 10);
  shL.addColorStop(0, 'rgba(255,255,255,0)');
  shL.addColorStop(0.55, 'rgba(255,255,255,0.32)');
  shL.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shL;
  g.fillRect(CX - BODY_OUT, NECK_Y - 4, BODY_OUT * 2, SHOULDER_Y - NECK_Y + 14);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(CX - NECK_OUT + 12, NECK_Y + 2);
  g.bezierCurveTo(CX - NECK_OUT + 10, NECK_Y + 24, CX - BODY_OUT + 14, SHOULDER_Y - 16, CX - BODY_OUT + 16, SHOULDER_Y + 2);
  g.stroke();
  g.strokeStyle = 'rgba(60,100,140,0.25)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(CX + NECK_OUT - 12, NECK_Y + 2);
  g.bezierCurveTo(CX + NECK_OUT - 10, NECK_Y + 24, CX + BODY_OUT - 14, SHOULDER_Y - 16, CX + BODY_OUT - 16, SHOULDER_Y + 2);
  g.stroke();
  // Shoulder ring: the perspective ellipse where the shoulder meets the body.
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(CX, SHOULDER_Y + 2, BODY_OUT - 2, ry(BODY_OUT - 2), 0, 0.15, Math.PI - 0.15);
  g.stroke();

  // Window reflections: one tall soft bar on the left with a hard inner edge, a thin one beside it,
  // and a dimmer narrow one on the right.
  const refl = (x: number, w: number, y0: number, y1: number, a: number) => {
    const grad = g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.2, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.75, `rgba(255,255,255,${a * 0.7})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    roundRect(g, x, y0, w, y1 - y0, Math.min(w / 2, 18));
    g.fill();
  };
  refl(CX - BODY_OUT + 20, 38, SHOULDER_Y + 18, BASE_Y - 48, 0.62);
  refl(CX - BODY_OUT + 64, 9, SHOULDER_Y + 40, BASE_Y - 90, 0.45);
  refl(CX + BODY_OUT - 40, 14, SHOULDER_Y + 30, BASE_Y - 70, 0.38);
  refl(CX - NECK_OUT + 16, 22, RIM_Y + 8, NECK_Y - 2, 0.5);
  refl(CX + NECK_OUT - 30, 9, RIM_Y + 10, NECK_Y - 4, 0.32);

  // Embossed brand, raised out of the glass: light from the upper left, shadow lower right.
  emboss(g, 'Suika Jelly', CX, 478, 40, 0.42);
  emboss(g, '果凍 · JELLY JAR', CX, 514, 14, 0.32);
  g.restore();

  // Thick base: the crescent between the inner floor's front edge and the outer bottom.
  g.beginPath();
  g.ellipse(CX, BASE_Y, BODY_OUT, ry(BODY_OUT), 0, 0, Math.PI);
  g.ellipse(CX, JAR_BOTTOM, BODY_IN, ry(BODY_IN), 0, Math.PI, 0, true);
  g.closePath();
  const baseGrad = g.createLinearGradient(0, JAR_BOTTOM, 0, BASE_Y + ry(BODY_OUT));
  baseGrad.addColorStop(0, 'rgba(225,245,255,0.55)');
  baseGrad.addColorStop(0.5, 'rgba(170,215,242,0.65)');
  baseGrad.addColorStop(1, 'rgba(120,175,215,0.80)');
  g.fillStyle = baseGrad;
  g.fill();
  // Front rim of the floor (the glass floor's edge seen through the wall).
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, JAR_BOTTOM, BODY_IN, ry(BODY_IN), 0, 0.05, Math.PI - 0.05);
  g.stroke();
  // Bright bottom edge highlight with a darker line under it.
  g.strokeStyle = 'rgba(40,80,120,0.5)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.ellipse(CX, BASE_Y, BODY_OUT, ry(BODY_OUT), 0, 0.02, Math.PI - 0.02);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(CX, BASE_Y - 3, BODY_OUT - 4, ry(BODY_OUT - 4), 0, 0.5, Math.PI - 0.7);
  g.stroke();

  // Near half of the thread helix: a shadow groove under a lit ridge that fades toward the sides.
  g.strokeStyle = 'rgba(35,75,115,0.42)';
  g.lineWidth = 8;
  helix(g, true);
  g.save();
  g.translate(0, 3);
  g.stroke();
  g.restore();
  const ridge = g.createLinearGradient(CX - THREAD_R, 0, CX + THREAD_R, 0);
  ridge.addColorStop(0, 'rgba(255,255,255,0.35)');
  ridge.addColorStop(0.22, 'rgba(255,255,255,0.95)');
  ridge.addColorStop(0.5, 'rgba(235,248,255,0.7)');
  ridge.addColorStop(0.8, 'rgba(255,255,255,0.55)');
  ridge.addColorStop(1, 'rgba(255,255,255,0.3)');
  g.strokeStyle = ridge;
  g.lineWidth = 5.5;
  helix(g, true);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.5;
  g.save();
  g.translate(0, -2);
  helix(g, true);
  g.stroke();
  g.restore();

  // Outer silhouette line: crisp dark edge with a lighter line just inside it.
  silhouette(g);
  g.strokeStyle = 'rgba(45,85,125,0.6)';
  g.lineWidth = 2.2;
  g.stroke();
  silhouette(g, 2.5);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 1.2;
  g.stroke();

  // Near half of the lip bead: a rounded torus, lit on top, shaded underneath.
  g.save();
  g.beginPath();
  g.rect(0, RIM_Y, WORLD_W, WORLD_H);
  g.clip();
  const lip = g.createLinearGradient(0, RIM_Y, 0, RIM_Y + ry(LIP_OUT));
  lip.addColorStop(0, 'rgba(250,253,255,0.95)');
  lip.addColorStop(0.45, 'rgba(215,238,252,0.85)');
  lip.addColorStop(1, 'rgba(140,185,222,0.85)');
  g.fillStyle = lip;
  lipRing(g);
  g.fill('evenodd');
  g.strokeStyle = 'rgba(60,100,140,0.6)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_OUT, ry(LIP_OUT), 0, 0, Math.PI);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_IN, ry(LIP_IN), 0, 0, Math.PI);
  g.stroke();
  g.restore();
  // Specular streak along the top of the bead and a soft glint on the left.
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_OUT - 4, ry(LIP_OUT) - 3, 0, Math.PI * 0.55, Math.PI * 0.92);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(CX, RIM_Y, LIP_OUT - 4, ry(LIP_OUT) - 3, 0, Math.PI * 1.15, Math.PI * 1.55);
  g.stroke();
  // Shadow the lip casts onto the neck.
  const lipShadow = g.createLinearGradient(0, RIM_Y + ry(LIP_OUT), 0, RIM_Y + ry(LIP_OUT) + 12);
  lipShadow.addColorStop(0, 'rgba(40,80,120,0.28)');
  lipShadow.addColorStop(1, 'rgba(40,80,120,0)');
  g.fillStyle = lipShadow;
  g.fillRect(CX - NECK_OUT, RIM_Y + ry(LIP_OUT), NECK_OUT * 2, 12);

  // Light pooling on the table in front of the jar.
  g.save();
  g.filter = 'blur(6px)';
  g.fillStyle = 'rgba(255,250,235,0.35)';
  g.beginPath();
  g.ellipse(CX + 24, BASE_Y + ry(BODY_OUT) + 8, 120, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function emboss(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, strength = 1): void {
  g.font = `italic 800 ${size}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = `rgba(40,80,120,${0.28 * strength})`;
  g.fillText(text, x + 1.5, y + 1.5);
  g.fillStyle = `rgba(255,255,255,${0.75 * strength})`;
  g.fillText(text, x - 1.5, y - 1.5);
  g.fillStyle = `rgba(215,238,252,${0.22 * strength})`;
  g.fillText(text, x, y);
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
