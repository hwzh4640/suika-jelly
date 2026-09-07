import { describe, expect, it } from 'vitest';
import { Game, type GameEvents } from '../src/game/Game';
import { DANGER_Y, JAR_BOTTOM } from '../src/game/constants';

class MemStore {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
}

function run(game: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) game.step(1 / 60);
}

describe('Game', () => {
  it('merges two touching cherries into a strawberry and scores 1', () => {
    const merges: number[] = [];
    const events: GameEvents = { onMerge: (tier) => merges.push(tier) };
    const g = new Game(events, new MemStore());
    g.newGame(1);
    g.spawn(0, 200, JAR_BOTTOM - 16);
    g.spawn(0, 228, JAR_BOTTOM - 16);
    run(g, 0.5);
    expect(merges).toEqual([0]);
    const bodies = g.bodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]!.tier).toBe(1);
    expect(g.score).toBe(1);
  });

  it('two watermelons vanish for 66 points', () => {
    const g = new Game({}, new MemStore());
    g.newGame(2);
    g.spawn(10, 140, JAR_BOTTOM - 100);
    g.spawn(10, 340, JAR_BOTTOM - 100);
    run(g, 1);
    expect(g.bodies()).toHaveLength(0);
    expect(g.score).toBe(66);
  });

  it('drop() respects cooldown and dequeues the next fruit', () => {
    const g = new Game({}, new MemStore());
    g.newGame(3);
    g.setQueue(2, 4);
    expect(g.drop(240)).toBe(true);
    expect(g.current).toBe(4);
    expect(g.drop(240)).toBe(false);
    run(g, 0.5);
    expect(g.drop(240)).toBe(true);
    expect(g.bodies().map((b) => b.tier).sort()).toEqual([2, 4]);
  });

  it('a settled fruit above the danger line ends the game and persists best', () => {
    const store = new MemStore();
    let over: [number, number, boolean] | null = null;
    const g = new Game({ onGameOver: (s, b, n) => (over = [s, b, n]) }, store);
    g.newGame(4);
    g.spawn(0, 240, DANGER_Y - 10, true);
    run(g, 0.5);
    expect(g.state).toBe('playing');
    expect(g.dangerActive).toBe(true);
    run(g, 1.5);
    expect(g.state).toBe('gameOver');
    expect(over).not.toBeNull();
    expect(store.getItem('suika.best')).toBe(String(g.best));
  });

  it('game over is not triggered by a fruit merely passing the line while falling', () => {
    const g = new Game({}, new MemStore());
    g.newGame(5);
    g.setQueue(0, 0);
    g.drop(240);
    run(g, 2);
    expect(g.state).toBe('playing');
  });
});
