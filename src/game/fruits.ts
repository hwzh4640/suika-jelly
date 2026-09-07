export interface FruitSpec {
  key: FruitKey;
  r: number;
  /** Main body colour. */
  color: string;
  /** Highlight tint (light through the jelly). */
  light: string;
  /** Rim / shadow colour. */
  dark: string;
}

export type FruitKey =
  | 'cherry'
  | 'strawberry'
  | 'grape'
  | 'dekopon'
  | 'persimmon'
  | 'apple'
  | 'pear'
  | 'peach'
  | 'pineapple'
  | 'melon'
  | 'watermelon';

export const FRUITS: readonly FruitSpec[] = [
  { key: 'cherry', r: 16, color: '#ff3b5c', light: '#ffb3c1', dark: '#a8122e' },
  { key: 'strawberry', r: 22, color: '#ff2d55', light: '#ffa4b5', dark: '#b0103a' },
  { key: 'grape', r: 29, color: '#8d4fe0', light: '#d9c2ff', dark: '#4a1f8f' },
  { key: 'dekopon', r: 34, color: '#ff9f1c', light: '#ffe0a8', dark: '#b85e00' },
  { key: 'persimmon', r: 42, color: '#ff7a1a', light: '#ffc99a', dark: '#b34700' },
  { key: 'apple', r: 50, color: '#e63946', light: '#ffb8bd', dark: '#8f1520' },
  { key: 'pear', r: 58, color: '#c9d84a', light: '#f3fbb0', dark: '#7e8a1d' },
  { key: 'peach', r: 66, color: '#ffa07a', light: '#ffe3d1', dark: '#c65a3b' },
  { key: 'pineapple', r: 76, color: '#ffc836', light: '#fff3b8', dark: '#b8860b' },
  { key: 'melon', r: 88, color: '#a5e07a', light: '#eaffd0', dark: '#4f8f2f' },
  { key: 'watermelon', r: 100, color: '#2f9e57', light: '#a8f0a0', dark: '#164d2c' },
];

export const TIER_COUNT = FRUITS.length;
/** Only the first five tiers are ever dropped by the player. */
export const DROP_TIERS = 5;

/** Points awarded for merging two fruits of tier i (0-indexed): triangular numbers. */
export const SCORE: readonly number[] = FRUITS.map((_, i) => ((i + 1) * (i + 2)) / 2);

export function fruit(tier: number): FruitSpec {
  const f = FRUITS[tier];
  if (!f) throw new Error(`bad tier ${tier}`);
  return f;
}

/** Tier produced by merging two fruits of `tier`, or null when two watermelons vanish. */
export function nextTier(tier: number): number | null {
  return tier + 1 < TIER_COUNT ? tier + 1 : null;
}
