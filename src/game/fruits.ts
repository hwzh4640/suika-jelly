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

/**
 * Colours are chosen to be told apart at a glance, including by colour-blind players: besides
 * hue, the fruits are spread across lightness (cherry and watermelon dark, apple and grape
 * mid, pineapple and melon light), because lightness survives red-green colour blindness.
 * test/palette.test.ts keeps every pair a minimum distance apart; `node scripts/palette.mjs`
 * renders a contact sheet for judging changes by eye.
 */
export const FRUITS: readonly FruitSpec[] = [
  { key: 'cherry', r: 16, color: '#9f033a', light: '#d07c87', dark: '#4a0016' },
  { key: 'strawberry', r: 22, color: '#fe3d87', light: '#fed0da', dark: '#ab0553' },
  { key: 'grape', r: 29, color: '#8a3ee0', light: '#c4a4fc', dark: '#50028f' },
  { key: 'dekopon', r: 34, color: '#feaf28', light: '#fef1e1', dark: '#b47808' },
  { key: 'persimmon', r: 42, color: '#e96402', light: '#ffcfb9', dark: '#943d01' },
  { key: 'apple', r: 50, color: '#d90a1a', light: '#fe9c91', dark: '#7c0109' },
  { key: 'pear', r: 58, color: '#79da53', light: '#deffd3', dark: '#409b0a' },
  { key: 'peach', r: 66, color: '#fed1cf', light: '#fdf0ef', dark: '#ca908d' },
  { key: 'pineapple', r: 76, color: '#fbee36', light: '#fdf8a7', dark: '#baaf08' },
  { key: 'melon', r: 88, color: '#20baa1', light: '#bafbeb', dark: '#047a69' },
  { key: 'watermelon', r: 100, color: '#198f38', light: '#98ce9d', dark: '#01511a' },
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
