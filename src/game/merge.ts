/** Pure helpers for resolving same-tier collisions, kept DOM/physics free so they can be unit tested. */
export interface Pair<T> {
  a: T;
  b: T;
}

/**
 * Pick a set of disjoint pairs from candidate pairs: once a body is part of a merge it cannot
 * be used again in the same step. Order of first appearance wins.
 */
export function resolveMergePairs<T>(pairs: readonly Pair<T>[], id: (x: T) => number): Pair<T>[] {
  const used = new Set<number>();
  const out: Pair<T>[] = [];
  for (const p of pairs) {
    const ia = id(p.a);
    const ib = id(p.b);
    if (ia === ib || used.has(ia) || used.has(ib)) continue;
    used.add(ia);
    used.add(ib);
    out.push(p);
  }
  return out;
}

export interface Vec {
  x: number;
  y: number;
}

export function midpoint(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** New fruit inherits half of the parents' mean velocity so it settles quickly. */
export function mergedVelocity(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 4, y: (a.y + b.y) / 4 };
}
