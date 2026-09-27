import { describe, expect, it } from 'vitest';
import { DROP_COOLDOWN } from '../src/game/constants';
import { DROP_TIERS, SCORE, TIER_COUNT } from '../src/game/fruits';
import {
  DAY_MS,
  DROP_TIER_MAX,
  MAX_POINTS_PER_DROP,
  MERGE_SCORE,
  MIN_DROP_INTERVAL,
  TIER_MAX,
  WEEK_MS,
  checkPlausible,
  clampLimit,
  resetsIn,
  sanitizeName,
  validateSubmission,
  weekStart,
} from '../shared/scoreRules';

const GID = '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b';
const good = { v: 1, gid: GID, name: 'Sam', score: 300, secs: 120, drops: 60, merges: 40, tier: 6 };

describe('constants mirror the game rules', () => {
  it('merge scores, tiers and cooldown match the game', () => {
    expect(MERGE_SCORE).toEqual(SCORE);
    expect(TIER_MAX).toBe(TIER_COUNT - 1);
    expect(DROP_TIER_MAX).toBe(DROP_TIERS - 1);
    expect(MIN_DROP_INTERVAL).toBeLessThanOrEqual(DROP_COOLDOWN);
  });
  it('MAX_POINTS_PER_DROP covers the best possible merge chain of one dropped fruit', () => {
    let best = 0;
    for (let start = 0; start <= DROP_TIER_MAX; start++) {
      let sum = 0;
      for (let t = start; t <= TIER_MAX; t++) sum += SCORE[t]! / 2 ** (t - start + 1);
      best = Math.max(best, sum);
    }
    expect(best).toBeCloseTo(21.28125);
    expect(MAX_POINTS_PER_DROP).toBeGreaterThanOrEqual(best);
  });
});

describe('sanitizeName', () => {
  it('keeps ordinary names in any script, and emoji', () => {
    expect(sanitizeName('Sam Dam')).toBe('Sam Dam');
    expect(sanitizeName('小明')).toBe('小明');
    expect(sanitizeName('張偉 🍉')).toBe('張偉 🍉');
    expect(sanitizeName('Zoë')).toBe('Zoë');
  });
  it('trims and collapses whitespace, including ideographic space and newlines', () => {
    expect(sanitizeName('  a \t\n  b  ')).toBe('a b');
    expect(sanitizeName('小\u3000\u3000明')).toBe('小 明');
    expect(sanitizeName('a\u2028b')).toBe('a b');
  });
  it('removes control, zero-width and bidi override characters', () => {
    expect(sanitizeName('a\u0000b\u0007c')).toBe('abc');
    expect(sanitizeName('ab\u200b\u200d\ufeffcd')).toBe('abcd');
    expect(sanitizeName('\u202eevil\u202c')).toBe('evil');
    expect(sanitizeName('x\u2066y\u2069')).toBe('xy');
  });
  it('removes private-use characters and unpaired surrogates', () => {
    expect(sanitizeName('a\ue000b')).toBe('ab');
    expect(sanitizeName('a\ud83db')).toBe('ab');
  });
  it('limits stacked combining marks and drops leading ones', () => {
    // NFC folds the first accent into the letter; of the rest, two survive.
    expect(sanitizeName('e' + '\u0301'.repeat(30))).toBe('\u00e9\u0301\u0301');
    expect(sanitizeName('a' + '\u0489'.repeat(30))).toBe('a\u0489\u0489');
    expect(Array.from(sanitizeName('\u0301\u0301abc'))).toEqual(['a', 'b', 'c']);
  });
  it('truncates to 16 code points without splitting an emoji', () => {
    expect(Array.from(sanitizeName('a'.repeat(40)))).toHaveLength(16);
    const melons = sanitizeName('🍉'.repeat(30));
    expect(Array.from(melons)).toHaveLength(16);
    expect(melons).toBe('🍉'.repeat(16));
  });
  it('returns an empty string when nothing usable is left', () => {
    expect(sanitizeName('')).toBe('');
    expect(sanitizeName('   ')).toBe('');
    expect(sanitizeName('\u200b\u200b')).toBe('');
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(42)).toBe('');
    expect(sanitizeName({ toString: () => 'x' })).toBe('');
  });
  it('treats markup as plain text (rendering must use textContent)', () => {
    expect(sanitizeName('<b>x</b>')).toBe('<b>x</b>');
  });
});

describe('validateSubmission', () => {
  it('accepts a well-formed submission and returns the sanitised name', () => {
    const r = validateSubmission({ ...good, name: '  Sam\u200b ', gid: GID.toUpperCase() });
    expect(r).toEqual({ ok: true, value: { ...good, name: 'Sam', gid: GID } });
  });
  it('drops unknown fields', () => {
    const r = validateSubmission({ ...good, admin: true });
    expect(r.ok && Object.keys(r.value).sort()).toEqual(['drops', 'gid', 'merges', 'name', 'score', 'secs', 'tier', 'v']);
  });
  it.each([
    ['body', null],
    ['body', 'x'],
    ['body', [good]],
    ['v', { ...good, v: 2 }],
    ['gid', { ...good, gid: 'nope' }],
    ['gid', { ...good, gid: 7 }],
    ['name', { ...good, name: '   ' }],
    ['name', { ...good, name: undefined }],
    ['score', { ...good, score: 0 }],
    ['score', { ...good, score: -5 }],
    ['score', { ...good, score: 1.5 }],
    ['score', { ...good, score: '300' }],
    ['score', { ...good, score: 1_000_001 }],
    ['score', { ...good, score: Number.NaN }],
    ['secs', { ...good, secs: 0 }],
    ['secs', { ...good, secs: 86_401 }],
    ['drops', { ...good, drops: 1 }],
    ['merges', { ...good, merges: 0 }],
    ['tier', { ...good, tier: 0 }],
    ['tier', { ...good, tier: 11 }],
  ])('rejects a bad %s', (field, body) => {
    expect(validateSubmission(body)).toEqual({ ok: false, field });
  });
  it('accepts the boundary values', () => {
    expect(validateSubmission({ ...good, score: 1, secs: 1, drops: 2, merges: 1, tier: 1 }).ok).toBe(true);
    expect(validateSubmission({ ...good, score: 1_000_000, secs: 86_400, tier: 10 }).ok).toBe(true);
  });
});

describe('checkPlausible', () => {
  it('accepts results a real game can produce', () => {
    expect(checkPlausible(good)).toBeNull();
    // Smallest possible scoring game: two cherries merge.
    expect(checkPlausible({ score: 1, secs: 1, drops: 2, merges: 1, tier: 1 })).toBeNull();
    // A strong game: about 3000 points from 400 drops in 15 minutes.
    expect(checkPlausible({ score: 3000, secs: 900, drops: 400, merges: 380, tier: 10 })).toBeNull();
  });
  it.each([
    ['drops-per-second', { ...good, secs: 10, drops: 60 }],
    ['merges-per-drop', { ...good, drops: 40, merges: 40 }],
    ['score-per-drop', { ...good, score: 1321 }],
    ['score-below-merges', { ...good, score: 39 }],
    ['score-per-merge', { score: 200, secs: 600, drops: 100, merges: 3, tier: 6 }],
    ['score-below-tier', { score: 20, secs: 600, drops: 100, merges: 10, tier: 8 }],
    ['drops-below-tier', { score: 600, secs: 600, drops: 40, merges: 30, tier: 10 }],
  ])('rejects %s', (rule, r) => {
    expect(checkPlausible(r)).toBe(rule);
  });
  it('allows exactly the fastest legal drop rate', () => {
    // 45 s at one drop per 0.45 s is 100 drops, plus the slack of 2.
    expect(checkPlausible({ score: 100, secs: 45, drops: 102, merges: 60, tier: 3 })).toBeNull();
    expect(checkPlausible({ score: 100, secs: 45, drops: 103, merges: 60, tier: 3 })).toBe('drops-per-second');
  });
});

describe('weekStart', () => {
  const monday = Date.UTC(2026, 8, 21); // Monday 2026-09-21
  it('is the Monday 00:00 UTC on or before the instant', () => {
    expect(new Date(monday).getUTCDay()).toBe(1);
    expect(weekStart(monday)).toBe(monday);
    expect(weekStart(monday + 1)).toBe(monday);
    expect(weekStart(monday + 3 * DAY_MS + 12345)).toBe(monday);
    expect(weekStart(monday + WEEK_MS - 1)).toBe(monday); // Sunday 23:59:59.999
    expect(weekStart(monday + WEEK_MS)).toBe(monday + WEEK_MS);
    expect(weekStart(monday - 1)).toBe(monday - WEEK_MS);
  });
  it('handles the epoch, which was a Thursday', () => {
    expect(weekStart(0)).toBe(-3 * DAY_MS);
    expect(new Date(weekStart(0)).getUTCDay()).toBe(1);
  });
  it('always lands on a Monday at midnight', () => {
    for (let i = 0; i < 400; i++) {
      const t = Date.UTC(2026, 0, 1) + i * (DAY_MS + 3_600_000 * 5);
      const w = new Date(weekStart(t));
      expect(w.getUTCDay()).toBe(1);
      expect(w.getUTCHours() + w.getUTCMinutes() + w.getUTCSeconds() + w.getUTCMilliseconds()).toBe(0);
      expect(t - weekStart(t)).toBeLessThan(WEEK_MS);
      expect(t - weekStart(t)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('resetsIn and clampLimit', () => {
  it('reports whole days and hours, rounding up', () => {
    expect(resetsIn(0, WEEK_MS)).toEqual({ d: 7, h: 0 });
    expect(resetsIn(0, DAY_MS + 3_600_000 + 1)).toEqual({ d: 1, h: 2 });
    expect(resetsIn(0, 1)).toEqual({ d: 0, h: 1 });
    expect(resetsIn(10, 5)).toEqual({ d: 0, h: 0 });
  });
  it('clamps the limit parameter', () => {
    expect(clampLimit(null)).toBe(20);
    expect(clampLimit('5')).toBe(5);
    expect(clampLimit('0')).toBe(1);
    expect(clampLimit('999')).toBe(50);
    expect(clampLimit('abc')).toBe(20);
  });
});
