import { describe, expect, it } from 'vitest';
import { FRUITS } from '../src/game/fruits';
import { distance, hexToLinear, oklab } from './helpers/colour';

/**
 * Players tell fruits apart by colour first. These limits are on the base colours; what is
 * drawn (gloss, seeds, stripes) is measured by `node scripts/palette.mjs`, which is the tool
 * to use when changing the palette. The numbers are OKLab distances times 100: about 10 is
 * clearly different, and the old palette had three reds only 2 to 4 apart.
 */
const MIN_ANY_PAIR = 12;
const MIN_NEIGHBOURS_COLOUR_BLIND = 9;

const colours = FRUITS.map((f) => ({ key: f.key, c: hexToLinear(f.color), light: hexToLinear(f.light), dark: hexToLinear(f.dark) }));

describe('fruit palette', () => {
  it('every pair of fruits is clearly different in colour', () => {
    const tooClose: string[] = [];
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j < colours.length; j++) {
        const d = distance(colours[i]!.c, colours[j]!.c);
        if (d < MIN_ANY_PAIR) tooClose.push(`${colours[i]!.key}/${colours[j]!.key} ${d.toFixed(1)}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('fruits of similar size stay apart for red-green colour-blind players', () => {
    // Within two tiers the sizes are close, so size cannot do the job colour fails at.
    const tooClose: string[] = [];
    for (let i = 0; i < colours.length; i++) {
      for (let j = i + 1; j <= i + 2 && j < colours.length; j++) {
        const d = Math.min(distance(colours[i]!.c, colours[j]!.c, 'protan'), distance(colours[i]!.c, colours[j]!.c, 'deutan'));
        if (d < MIN_NEIGHBOURS_COLOUR_BLIND) tooClose.push(`${colours[i]!.key}/${colours[j]!.key} ${d.toFixed(1)}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it('each fruit has a lighter highlight and a darker rim than its body', () => {
    for (const f of colours) {
      const L = oklab(f.c)[0];
      // The palest fruits are already near white, so their highlight can only be a little lighter.
      expect(oklab(f.light)[0], f.key).toBeGreaterThan(L + 0.02);
      expect(oklab(f.dark)[0], f.key).toBeLessThan(L - 0.1);
    }
  });

  it('colours are six-digit hex', () => {
    for (const f of FRUITS) for (const v of [f.color, f.light, f.dark]) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('colour distance helper', () => {
  it('is zero for identical colours and large for opposite ones', () => {
    expect(distance(hexToLinear('#336699'), hexToLinear('#336699'))).toBeCloseTo(0);
    expect(distance(hexToLinear('#000000'), hexToLinear('#ffffff'))).toBeCloseTo(100, 0);
  });
  it('sees red and green as far apart normally and closer when red-green colour-blind', () => {
    const red = hexToLinear('#d90a1a');
    const green = hexToLinear('#2f9e57');
    expect(distance(red, green)).toBeGreaterThan(25);
    expect(distance(red, green, 'protan')).toBeLessThan(distance(red, green) * 0.75);
    expect(distance(red, green, 'deutan')).toBeLessThan(distance(red, green) * 0.75);
  });
  it('would have failed the old palette', () => {
    const cherry = hexToLinear('#ff3b5c');
    const strawberry = hexToLinear('#ff2d55');
    const apple = hexToLinear('#e63946');
    expect(distance(cherry, strawberry)).toBeLessThan(MIN_ANY_PAIR);
    expect(distance(strawberry, apple)).toBeLessThan(MIN_ANY_PAIR);
  });
});
