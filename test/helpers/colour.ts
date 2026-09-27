/**
 * How different two colours look, for people with normal colour vision and for the three
 * common kinds of colour-vision deficiency. Distances are Euclidean in OKLab, times 100:
 * roughly, 2 is just noticeable side by side, 10 is clearly different, 20+ is unmistakable.
 */
export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';
export const VISIONS: readonly Vision[] = ['normal', 'protan', 'deutan', 'tritan'];

type V3 = [number, number, number];

/** Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB. */
const SIM: Record<Vision, [V3, V3, V3]> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

export function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
}

export function hexToLinear(hex: string): V3 {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear((n >> 16) & 255), srgbToLinear((n >> 8) & 255), srgbToLinear(n & 255)];
}

export function simulate(rgb: V3, vision: Vision): V3 {
  const m = SIM[vision];
  return m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]))) as V3;
}

export function oklab([r, g, b]: V3): V3 {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

export function distance(a: V3, b: V3, vision: Vision = 'normal'): number {
  const x = oklab(simulate(a, vision));
  const y = oklab(simulate(b, vision));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** The smallest distance across all kinds of vision: how well the worst-off player can tell them apart. */
export function worstCase(a: V3, b: V3): { d: number; vision: Vision } {
  let best: { d: number; vision: Vision } = { d: Infinity, vision: 'normal' };
  for (const vision of VISIONS) {
    const d = distance(a, b, vision);
    if (d < best.d) best = { d, vision };
  }
  return best;
}
