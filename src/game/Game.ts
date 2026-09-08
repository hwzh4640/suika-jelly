import { DANGER_Y, DROP_COOLDOWN, DROP_Y, JAR_BOTTOM, JAR_X0, JAR_X1, NECK_X0, NECK_X1, OVERFLOW_SECONDS, STEP_MS } from './constants';
import { DROP_TIERS, SCORE, fruit, nextTier } from './fruits';
import { mergedVelocity, midpoint, resolveMergePairs } from './merge';
import { Physics } from './Physics';
import { Rng, randomSeed } from './rng';

export type GameState = 'title' | 'playing' | 'gameOver';

export interface FruitView {
  id: number;
  tier: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
}

export interface GameEvents {
  onStateChange?(state: GameState): void;
  onScore?(score: number, best: number): void;
  onDrop?(tier: number, x: number): void;
  /** `result` is null when two watermelons vanish. */
  onMerge?(tier: number, result: number | null, x: number, y: number, points: number, id: number | null): void;
  onImpact?(id: number, strength: number): void;
  onGameOver?(score: number, best: number, newBest: boolean): void;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const BEST_KEY = 'suika.best';

function defaultStore(): KeyValueStore | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* ignore */
  }
  return null;
}

/** All game rules. No DOM, no rendering; drive it with step()/drop() and read views. */
export class Game {
  readonly physics = new Physics();
  state: GameState = 'title';
  score = 0;
  best = 0;
  /** Tier currently held above the jar. */
  current = 0;
  /** Tier shown in the "next" preview. */
  next = 0;
  aimX = (JAR_X0 + JAR_X1) / 2;
  cooldown = 0;
  /** Seconds a settled fruit has been above the danger line. */
  overTimer = 0;
  /** True while any fruit is above the danger line. */
  dangerActive = false;
  /** 0..1: how far the settled pile reaches from the floor to the danger line. */
  fill = 0;
  time = 0;
  private accumulator = 0;
  private rng = new Rng(1);
  private store: KeyValueStore | null;

  constructor(private events: GameEvents = {}, store?: KeyValueStore | null) {
    this.store = store === undefined ? defaultStore() : store;
    this.best = this.readBest();
    this.physics.onImpact = (b, s) => {
      if (s > 1.5) this.events.onImpact?.(b.plugin.id, s);
    };
  }

  private readBest(): number {
    try {
      const v = this.store?.getItem(BEST_KEY);
      const n = v ? parseInt(v, 10) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  }

  newGame(seed: number = randomSeed()): void {
    this.rng = new Rng(seed);
    this.physics.clear();
    this.score = 0;
    this.time = 0;
    this.accumulator = 0;
    this.cooldown = 0;
    this.overTimer = 0;
    this.dangerActive = false;
    this.fill = 0;
    this.current = this.rollTier();
    this.next = this.rollTier();
    this.aimX = (JAR_X0 + JAR_X1) / 2;
    this.setState('playing');
    this.events.onScore?.(this.score, this.best);
  }

  private rollTier(): number {
    return this.rng.int(0, DROP_TIERS - 1);
  }

  private setState(s: GameState): void {
    if (this.state === s) return;
    this.state = s;
    this.events.onStateChange?.(s);
  }

  /** Clamp an x so the held fruit fits through the jar's mouth. */
  clampX(x: number, tier = this.current): number {
    const r = fruit(tier).r;
    return Math.min(NECK_X1 - r - 2, Math.max(NECK_X0 + r + 2, x));
  }

  setAim(x: number): void {
    this.aimX = this.clampX(x);
  }

  get canDrop(): boolean {
    return this.state === 'playing' && this.cooldown <= 0;
  }

  /** Release the held fruit at the current (or given) aim x. Returns true if a fruit was dropped. */
  drop(x?: number): boolean {
    if (x !== undefined) this.setAim(x);
    if (!this.canDrop) return false;
    const tier = this.current;
    this.physics.spawn(tier, this.aimX, DROP_Y, this.time);
    this.events.onDrop?.(tier, this.aimX);
    this.current = this.next;
    this.next = this.rollTier();
    this.aimX = this.clampX(this.aimX);
    this.cooldown = DROP_COOLDOWN;
    return true;
  }

  /** Override the queued fruits (used by tests / debug hooks). */
  setQueue(current: number, next = current): void {
    this.current = current;
    this.next = next;
    this.aimX = this.clampX(this.aimX);
  }

  /** Spawn a fruit directly into the jar (tests / debug). `pinned` freezes it in place. */
  spawn(tier: number, x: number, y: number, pinned = false): number {
    const b = this.physics.spawn(tier, x, y, this.time);
    if (pinned) this.physics.pin(b);
    return b.plugin.id;
  }

  /** Advance the simulation by `dt` seconds using a fixed physics step. */
  step(dt: number): void {
    if (this.state !== 'playing') return;
    this.accumulator += Math.min(0.1, dt) * 1000;
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < 5) {
      this.accumulator -= STEP_MS;
      this.fixedStep(STEP_MS / 1000);
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
  }

  private fixedStep(dt: number): void {
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.physics.step();
    this.resolveMerges();
    this.checkOverflow(dt);
  }

  private resolveMerges(): void {
    const pairs = resolveMergePairs(this.physics.pending, (b) => b.plugin.id);
    this.physics.pending = [];
    for (const { a, b } of pairs) {
      if (!this.physics.has(a) || !this.physics.has(b)) continue;
      const tier = a.plugin.tier;
      const pos = midpoint(a.position, b.position);
      const vel = mergedVelocity(a.velocity, b.velocity);
      this.physics.remove(a);
      this.physics.remove(b);
      const result = nextTier(tier);
      let id: number | null = null;
      if (result !== null) id = this.physics.spawn(result, pos.x, pos.y, this.time, vel).plugin.id;
      const points = SCORE[tier] ?? 0;
      this.score += points;
      if (this.score > this.best) this.best = this.score;
      this.events.onMerge?.(tier, result, pos.x, pos.y, points, id);
      this.events.onScore?.(this.score, this.best);
    }
  }

  private checkOverflow(dt: number): void {
    let danger = false;
    let settledOver = false;
    let minTop = JAR_BOTTOM;
    for (const b of this.physics.fruits.values()) {
      const top = b.position.y - b.circleRadius!;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      if (top < DANGER_Y) {
        danger = true;
        if (this.time - b.plugin.born > 0.6 && speed < 0.25) settledOver = true;
      }
      if (speed < 0.5 && top < minTop) minTop = top;
    }
    this.dangerActive = danger;
    this.fill = Math.max(0, Math.min(1, (JAR_BOTTOM - minTop) / (JAR_BOTTOM - DANGER_Y)));
    this.overTimer = settledOver ? this.overTimer + dt : 0;
    if (this.overTimer >= OVERFLOW_SECONDS) this.gameOver();
  }

  private gameOver(): void {
    const newBest = this.score > 0 && this.score >= this.readBest() && this.score === this.best;
    try {
      this.store?.setItem(BEST_KEY, String(this.best));
    } catch {
      /* ignore */
    }
    this.setState('gameOver');
    this.events.onGameOver?.(this.score, this.best, newBest);
  }

  /** Snapshot of every fruit in the jar for rendering. */
  bodies(): FruitView[] {
    const out: FruitView[] = [];
    for (const b of this.physics.fruits.values()) {
      out.push({ id: b.plugin.id, tier: b.plugin.tier, x: b.position.x, y: b.position.y, angle: b.angle, vx: b.velocity.x, vy: b.velocity.y });
    }
    return out;
  }
}
