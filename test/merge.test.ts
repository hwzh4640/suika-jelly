import { describe, expect, it } from 'vitest';
import { mergedVelocity, midpoint, resolveMergePairs } from '../src/game/merge';

describe('merge helpers', () => {
  it('dedupes pairs sharing a body, first wins', () => {
    const A = { id: 1 }, B = { id: 2 }, C = { id: 3 }, D = { id: 4 };
    const out = resolveMergePairs([{ a: A, b: B }, { a: B, b: C }, { a: C, b: D }, { a: A, b: A }], (x) => x.id);
    expect(out).toEqual([{ a: A, b: B }, { a: C, b: D }]);
  });
  it('midpoint and velocity maths', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
    expect(mergedVelocity({ x: 4, y: 0 }, { x: 0, y: 4 })).toEqual({ x: 1, y: 1 });
  });
});
