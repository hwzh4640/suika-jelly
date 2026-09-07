import { describe, expect, it } from 'vitest';
import { DROP_TIERS, FRUITS, SCORE, TIER_COUNT, nextTier } from '../src/game/fruits';
import { Rng } from '../src/game/rng';

describe('fruits', () => {
  it('has 11 tiers with strictly increasing radii', () => {
    expect(TIER_COUNT).toBe(11);
    for (let i = 1; i < FRUITS.length; i++) expect(FRUITS[i]!.r).toBeGreaterThan(FRUITS[i - 1]!.r);
  });
  it('scores are triangular numbers', () => {
    expect(SCORE).toEqual([1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]);
  });
  it('nextTier caps at watermelon', () => {
    expect(nextTier(0)).toBe(1);
    expect(nextTier(9)).toBe(10);
    expect(nextTier(10)).toBeNull();
  });
  it('drop rolls stay within the first five tiers', () => {
    const rng = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      const t = rng.int(0, DROP_TIERS - 1);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(5);
    }
  });
});
