import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { audio } from './audio/context';
import { Music } from './audio/music';
import { sfx } from './audio/sfx';
import { WORLD_H, WORLD_W } from './game/constants';
import { Game, type GameEvents } from './game/Game';
import { detectLang, setLang, type Lang } from './i18n';
import { bindInput } from './input';
import { createClient, loadName, myEntries, newGameId, rememberEntry, saveName, scoresUrl } from './net/leaderboard';
import { Renderer } from './render/renderer';
import { API_VERSION, sanitizeName } from '../shared/scoreRules';
import { Hud, type LeaderboardPort } from './ui/hud';

setLang(detectLang(), false);
registerSW({ immediate: true });

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const music = new Music();
let paused = false;

const events: GameEvents = {
  onStateChange(state) {
    if (state === 'playing') {
      hud.hide();
      renderer.reset();
      music.start();
    }
  },
  onScore(score, best) {
    hud.setScore(score, best);
  },
  onDrop() {
    hud.setNext(game.next);
  },
  onMerge(tier, result, x, y, points, id) {
    renderer.merged(tier, result, x, y, points, id);
    if (result === null) sfx.vanish();
    else sfx.merge(tier);
  },
  onImpact(id, strength) {
    renderer.impact(id, strength);
    if (strength > 2.5) sfx.drop(strength);
  },
  onGameOver(score, best, newBest, stats) {
    music.stop();
    sfx.gameOver();
    hud.gameOver({ score, best, newBest, stats, gameId: newGameId() });
  },
};

const game = new Game(events);

/** Null when no scores API was configured at build time: the leaderboard UI then stays hidden. */
const scores = createClient({ baseUrl: scoresUrl() });
const leaderboard: LeaderboardPort | null = scores.enabled
  ? {
      async submit(name, over) {
        const r = await scores.submitScore({ v: API_VERSION, gid: over.gameId, name, score: over.score, ...over.stats });
        if (r.ok) {
          saveName(r.data.entry.name);
          rememberEntry(r.data.entry.id);
        }
        return r;
      },
      boards: () => scores.fetchBoards(),
      lastName: () => sanitizeName(loadName()),
      mine: () => myEntries(),
    }
  : null;

const hud = new Hud(
  {
  play: () => {
    audio.unlock();
    sfx.click();
    paused = false;
    game.newGame();
    hud.setNext(game.next);
  },
  restart: () => {
    audio.unlock();
    sfx.click();
    game.newGame();
    hud.setNext(game.next);
  },
  menu: () => {
    sfx.click();
    // A game in progress stays paused behind the menu so it can be resumed.
    if (game.state === 'playing') {
      paused = true;
      music.stop(0.3);
      hud.title(true);
    } else {
      paused = false;
      music.stop(0.3);
      game.state = 'title';
      hud.title();
    }
  },
  pause: () => {
    sfx.click();
    if (game.state === 'playing' && !paused) togglePause();
  },
  resume: () => {
    sfx.click();
    paused = false;
    music.start();
    hud.hide();
  },
  click: () => {
    audio.unlock();
    sfx.click();
  },
  },
  leaderboard,
);

function togglePause(): void {
  if (game.state !== 'playing') return;
  paused = !paused;
  if (paused) {
    music.stop(0.2);
    hud.paused();
  } else {
    music.start();
    hud.hide();
  }
}

const inputTick = bindInput(canvas, game, renderer, {
  gesture: () => audio.unlock(),
  drop: () => {
    if (paused) return;
    if (game.drop()) sfx.click();
  },
  togglePause,
  toggleMute: () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
  },
});

function layout(): void {
  renderer.resize();
  const dpr = canvas.width / canvas.getBoundingClientRect().width;
  hud.layout(renderer.offsetX / dpr, renderer.offsetY / dpr, (WORLD_W * renderer.scale) / dpr, (WORLD_H * renderer.scale) / dpr, window.innerWidth);
}
new ResizeObserver(layout).observe(canvas);
window.addEventListener('orientationchange', () => setTimeout(layout, 150));
layout();

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused) {
    inputTick(dt);
    game.step(dt);
  }
  music.fill = game.fill;
  hud.setDanger(game.state === 'playing' && game.dangerActive);
  renderer.frame(game, paused ? 0 : dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

hud.title();
hud.setScore(0, game.best);

/** Debug / automation hooks. */
declare global {
  interface Window {
    __game: {
      game: Game;
      renderer: Renderer;
      drop(x?: number): boolean;
      setNext(current: number, next?: number): void;
      spawn(tier: number, x: number, y: number, pinned?: boolean): number;
      stats(): ReturnType<Game['stats']>;
      leaderboard: { enabled: boolean; url: string };
      step(ms: number): void;
      state(): string;
      score(): number;
      bodies(): ReturnType<Game['bodies']>;
      setLang(lang: Lang): void;
      play(): void;
      audio: typeof audio;
      music: Music;
    };
  }
}
window.__game = {
  game,
  renderer,
  drop: (x) => game.drop(x),
  setNext: (c, n) => game.setQueue(c, n),
  spawn: (tier, x, y, pinned) => game.spawn(tier, x, y, pinned),
  stats: () => game.stats(),
  leaderboard: { enabled: scores.enabled, url: scoresUrl() },
  step: (ms) => game.step(ms / 1000),
  state: () => game.state,
  score: () => game.score,
  bodies: () => game.bodies(),
  setLang: (l) => setLang(l),
  play: () => {
    game.newGame();
    hud.setNext(game.next);
  },
  audio,
  music,
};
