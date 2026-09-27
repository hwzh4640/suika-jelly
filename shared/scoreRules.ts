/**
 * Leaderboard rules shared by the Worker, the game client and the tests. Pure TypeScript:
 * no DOM, no Workers APIs, no imports from the game, so both sides compile it as-is.
 *
 * The numeric limits mirror the game rules (src/game/fruits.ts, src/game/constants.ts);
 * test/scoreRules.test.ts fails if they drift apart.
 */
export const API_VERSION = 1;
export const NAME_MAX = 16;
export const SCORE_MAX = 1_000_000;
export const SECS_MAX = 86_400;
export const DROPS_MAX = 200_000;
export const TIER_MAX = 10;
/** Highest tier the player can be handed to drop. */
export const DROP_TIER_MAX = 4;
/** Seconds that must pass between two drops. */
export const MIN_DROP_INTERVAL = 0.45;
/** Points for merging two fruits of tier i. */
export const MERGE_SCORE: readonly number[] = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66];
/**
 * A single dropped fruit contributes at most 21.28 points over its whole merge chain
 * (dropped at tier 4: 15/2 + 21/4 + 28/8 + 36/16 + 45/32 + 55/64 + 66/128).
 */
export const MAX_POINTS_PER_DROP = 22;
export const LIMIT_DEFAULT = 20;
export const LIMIT_MAX = 50;
export const BODY_MAX_BYTES = 1024;

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

export interface Entry {
  id: number;
  name: string;
  score: number;
  /** Server time of submission, epoch ms. */
  at: number;
}

export interface Board {
  /** Rows on this board, including those beyond `top`. */
  total: number;
  top: Entry[];
}

export interface Boards {
  now: number;
  weekStart: number;
  weekEnd: number;
  all: Board;
  week: Board;
}

export interface SubmitRequest {
  v: number;
  /** Client-generated id of the game; makes retries and double clicks idempotent. */
  gid: string;
  name: string;
  score: number;
  secs: number;
  drops: number;
  merges: number;
  tier: number;
}

export interface SubmitResponse {
  ok: true;
  /** True when this game had already been submitted; `entry` is the stored row. */
  duplicate: boolean;
  entry: Entry;
  rank: { all: number; week: number };
  boards: Boards;
}

export type ErrorCode = 'bad-json' | 'invalid' | 'origin' | 'too-large' | 'implausible' | 'rate' | 'busy' | 'not-found' | 'server';

export interface ErrorResponse {
  ok: false;
  error: ErrorCode;
  field?: string;
  /** Seconds until another attempt may succeed (rate limiting). */
  retryAfter?: number;
}

/** Start of the UTC week (Monday 00:00) containing `ms`. */
export function weekStart(ms: number): number {
  const day = Math.floor(ms / DAY_MS);
  // 1970-01-01 was a Thursday, so with Monday = 0 the weekday of epoch day d is (d + 3) % 7.
  return (day - ((day + 3) % 7)) * DAY_MS;
}

/** Whole days and hours left until the weekly board resets. */
export function resetsIn(now: number, weekEnd: number): { d: number; h: number } {
  const hours = Math.max(0, Math.ceil((weekEnd - now) / 3_600_000));
  return { d: Math.floor(hours / 24), h: hours % 24 };
}

/**
 * Clean a player-typed name for public display. Keeps letters of any script and emoji;
 * removes control characters, invisible formatting (zero-width, bidi overrides), private-use
 * and unpaired surrogates; limits stacked combining marks; collapses whitespace.
 * Returns '' when nothing usable is left.
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  let s = raw.slice(0, 256).normalize('NFC');
  // Invisible formatting goes first: JavaScript counts U+FEFF as whitespace, and it must
  // vanish rather than turn into a visible space.
  s = s.replace(/[\p{Cf}\p{Co}\p{Cs}\p{Cn}]/gu, '');
  s = s.replace(/[\p{Zl}\p{Zp}\s]+/gu, ' ');
  s = s.replace(/\p{Cc}/gu, '');
  s = s.replace(/(\p{M}{2})\p{M}+/gu, '$1');
  s = s.replace(/^[\p{M}\s]+/u, '');
  s = s.replace(/ {2,}/g, ' ').trim();
  s = Array.from(s).slice(0, NAME_MAX).join('').trim();
  return s;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function int(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
}

export type Validation = { ok: true; value: SubmitRequest } | { ok: false; field: string };

/** Shape and range check of a submission. On success the name is already sanitised. */
export function validateSubmission(body: unknown): Validation {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, field: 'body' };
  const b = body as Record<string, unknown>;
  if (b.v !== API_VERSION) return { ok: false, field: 'v' };
  if (typeof b.gid !== 'string' || !UUID.test(b.gid)) return { ok: false, field: 'gid' };
  const name = sanitizeName(b.name);
  if (!name) return { ok: false, field: 'name' };
  if (!int(b.score, 1, SCORE_MAX)) return { ok: false, field: 'score' };
  if (!int(b.secs, 1, SECS_MAX)) return { ok: false, field: 'secs' };
  if (!int(b.drops, 2, DROPS_MAX)) return { ok: false, field: 'drops' };
  if (!int(b.merges, 1, DROPS_MAX)) return { ok: false, field: 'merges' };
  if (!int(b.tier, 1, TIER_MAX)) return { ok: false, field: 'tier' };
  return {
    ok: true,
    value: { v: API_VERSION, gid: b.gid.toLowerCase(), name, score: b.score, secs: b.secs, drops: b.drops, merges: b.merges, tier: b.tier },
  };
}

/**
 * Could a real game have produced these numbers? Returns the name of the first rule that
 * fails, or null when the submission is consistent with the game rules. This only rules out
 * impossible results; it cannot prove that a possible result was actually played.
 */
export function checkPlausible(r: Pick<SubmitRequest, 'score' | 'secs' | 'drops' | 'merges' | 'tier'>): string | null {
  // Drops are rate limited by the cooldown.
  if (r.drops > r.secs / MIN_DROP_INTERVAL + 2) return 'drops-per-second';
  // Every merge removes at least one fruit, and fruits only enter through drops.
  if (r.merges > r.drops - 1) return 'merges-per-drop';
  if (r.score > MAX_POINTS_PER_DROP * r.drops) return 'score-per-drop';
  // Each merge is worth between 1 and 66 points.
  if (r.score < r.merges) return 'score-below-merges';
  if (r.score > (MERGE_SCORE[TIER_MAX] as number) * r.merges) return 'score-per-merge';
  // The top fruit was made by merging two of the tier below, which paid out at least once.
  if (r.score < (MERGE_SCORE[r.tier - 1] as number)) return 'score-below-tier';
  // A fruit above the droppable tiers is built from 2^(tier - 4) dropped fruits at best.
  if (r.tier > DROP_TIER_MAX && r.drops < 2 ** (r.tier - DROP_TIER_MAX)) return 'drops-below-tier';
  return null;
}

export function clampLimit(raw: string | null): number {
  const n = raw === null ? LIMIT_DEFAULT : Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.max(1, n));
}
