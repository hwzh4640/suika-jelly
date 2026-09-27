import { NAME_MAX, resetsIn, sanitizeName, type Boards, type Entry, type SubmitResponse } from '../../shared/scoreRules';
import { FRUITS } from '../game/fruits';
import type { GameStats } from '../game/Game';
import { LANGS, LANG_NAMES, getLang, onLangChange, setLang, t, type Lang, type StringKey } from '../i18n';
import type { FailureKind, Result } from '../net/leaderboard';
import { Renderer } from '../render/renderer';
import { audio } from '../audio/context';

export interface HudActions {
  play(): void;
  restart(): void;
  menu(): void;
  pause(): void;
  resume(): void;
  /** UI feedback for buttons the HUD handles itself. */
  click(): void;
}

/** Everything the game-over panel needs to know about the finished game. */
export interface OverData {
  score: number;
  best: number;
  newBest: boolean;
  /** Identifies this game to the leaderboard so it can only be submitted once. */
  gameId: string;
  stats: GameStats;
}

/** The HUD's view of the leaderboard. Absent when the feature is not configured. */
export interface LeaderboardPort {
  submit(name: string, over: OverData): Promise<Result<SubmitResponse>>;
  boards(): Promise<Result<Boards>>;
  /** Name used last time on this device. */
  lastName(): string;
  /** Ids of rows submitted from this device. */
  mine(): Set<number>;
}

type Screen = 'none' | 'title' | 'over' | 'pause' | 'board';
type Tab = 'all' | 'week';

interface SubmitState {
  phase: 'idle' | 'submitting' | 'done' | 'error' | 'final';
  name: string;
  error?: FailureKind;
  result?: SubmitResponse;
}

interface BoardState {
  tab: Tab;
  phase: 'loading' | 'ready' | 'error';
  data: Boards | null;
  fetchedAt: number;
  returnTo: 'title' | 'pause' | 'over';
}

/** A board fetched this recently is shown as-is instead of being requested again. */
const BOARD_FRESH_MS = 30_000;
const COMPACT_ROWS = 5;

const isTouch = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
}

/** Create an element. Text always goes through textContent, never innerHTML. */
function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text) e.textContent = text;
  return e;
}

function button(className: string, text: string, onClick: () => void, id = ''): HTMLButtonElement {
  const b = make('button', className, text);
  b.type = 'button';
  if (id) b.id = id;
  b.addEventListener('click', onClick);
  return b;
}

/** All DOM chrome: HUD pills, corner buttons, evolution ring and the overlay panels. */
export class Hud {
  private hud = el<HTMLDivElement>('hud');
  private scoreEl = el<HTMLSpanElement>('score');
  private bestEl = el<HTMLSpanElement>('best');
  private scorePill = el<HTMLDivElement>('scorePill');
  private nextIcon = el<HTMLCanvasElement>('nextIcon');
  private ring = el<HTMLDivElement>('ring');
  private overlay = el<HTMLDivElement>('overlay');
  private muteBtn = el<HTMLButtonElement>('muteBtn');
  private pauseBtn = el<HTMLButtonElement>('pauseBtn');
  private lastNext = -1;
  private bumpTimer = 0;
  private screen: Screen = 'none';
  private overData: OverData = { score: 0, best: 0, newBest: false, gameId: '', stats: { secs: 0, drops: 0, merges: 0, tier: 0 } };
  private submit: SubmitState = { phase: 'idle', name: '' };
  private board: BoardState = { tab: 'all', phase: 'loading', data: null, fetchedAt: 0, returnTo: 'title' };
  private boardRequest = 0;
  private titleCanResume = false;
  private rightMargin = 0;

  constructor(
    private actions: HudActions,
    private lb: LeaderboardPort | null = null,
  ) {
    this.muteBtn.addEventListener('click', () => {
      audio.unlock();
      audio.setMuted(!audio.muted);
    });
    audio.onMuteChange(() => this.refreshMute());
    this.refreshMute();
    this.pauseBtn.addEventListener('click', () => this.actions.pause());
    onLangChange(() => this.refresh());
    this.buildRing();
    this.refresh();
  }

  private refreshMute(): void {
    this.muteBtn.textContent = audio.muted ? '🔇' : '🔊';
    this.muteBtn.setAttribute('aria-label', t(audio.muted ? 'btn.unmute' : 'btn.mute'));
    this.muteBtn.title = this.muteBtn.getAttribute('aria-label') ?? '';
  }

  /**
   * Re-translate static labels and rebuild whichever overlay is open. Panels are rebuilt
   * from instance state, so anything the player typed or fetched survives.
   */
  refresh(): void {
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((e) => {
      e.textContent = t(e.dataset.t as StringKey);
    });
    this.refreshMute();
    this.pauseBtn.setAttribute('aria-label', t('btn.pause'));
    document.title = `${t('app.title')}`;
    if (this.screen === 'title') this.title(this.titleCanResume);
    else if (this.screen === 'over') this.renderOver();
    else if (this.screen === 'pause') this.paused();
    else if (this.screen === 'board') this.renderBoard();
  }

  /** Update CSS vars so the HUD tracks the letterboxed world box. */
  layout(left: number, top: number, w: number, h: number, viewportW: number): void {
    const s = document.documentElement.style;
    s.setProperty('--box-left', `${left}px`);
    s.setProperty('--box-top', `${top}px`);
    s.setProperty('--box-w', `${w}px`);
    s.setProperty('--box-h', `${h}px`);
    this.rightMargin = viewportW - (left + w);
    this.updateRing();
  }

  private updateRing(): void {
    this.ring.classList.toggle('hidden', this.rightMargin < 190 || this.screen !== 'none');
  }

  setScore(score: number, best: number): void {
    if (this.scoreEl.textContent !== String(score)) {
      this.scoreEl.textContent = String(score);
      this.scorePill.classList.add('bump');
      clearTimeout(this.bumpTimer);
      this.bumpTimer = window.setTimeout(() => this.scorePill.classList.remove('bump'), 160);
    }
    this.bestEl.textContent = String(best);
  }

  setNext(tier: number): void {
    if (tier === this.lastNext) return;
    this.lastNext = tier;
    Renderer.drawIcon(this.nextIcon, tier, 36);
  }

  setDanger(on: boolean): void {
    this.hud.classList.toggle('danger', on);
  }

  private buildRing(): void {
    const items = this.ring.querySelector('.ring-items')!;
    items.innerHTML = '';
    const n = FRUITS.length;
    const R = 66;
    FRUITS.forEach((_, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const c = document.createElement('canvas');
      const size = 22 + i * 2.4;
      Renderer.drawIcon(c, i, size);
      c.style.left = `${88 + Math.cos(a) * R}px`;
      c.style.top = `${88 + Math.sin(a) * R}px`;
      items.appendChild(c);
    });
    items.appendChild(make('div', 'arrow', '↻'));
  }

  private evoRow(): HTMLElement {
    const row = make('div', 'evo');
    FRUITS.forEach((_, i) => {
      if (i > 0) row.appendChild(make('span', 'sep', '›'));
      const c = document.createElement('canvas');
      Renderer.drawIcon(c, i, 16 + i * 1.4);
      row.appendChild(c);
    });
    return row;
  }

  private langRow(): HTMLElement {
    const row = make('div', 'row lang-row');
    for (const lang of LANGS) {
      row.appendChild(button('btn secondary' + (getLang() === lang ? ' active' : ''), LANG_NAMES[lang as Lang], () => setLang(lang)));
    }
    return row;
  }

  private boardButton(returnTo: BoardState['returnTo']): HTMLButtonElement {
    return button('btn secondary', t('lb.title'), () => this.openBoard(returnTo), 'lbBtn');
  }

  private show(panel: HTMLElement): void {
    this.overlay.innerHTML = '';
    this.overlay.appendChild(panel);
    this.overlay.classList.remove('hidden');
    this.overlay.scrollTop = 0;
    this.updateRing();
  }

  hide(): void {
    this.screen = 'none';
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    this.hud.classList.remove('hidden');
    this.pauseBtn.classList.remove('hidden');
    this.updateRing();
  }

  /** `canResume` adds a Resume button for a game that is paused behind the menu. */
  title(canResume = false): void {
    this.screen = 'title';
    this.titleCanResume = canResume;
    this.hud.classList.add('hidden');
    this.pauseBtn.classList.add('hidden');
    const p = make('div', 'panel');
    p.appendChild(make('h1', '', t('app.title')));
    p.appendChild(make('p', 'tagline', t('app.tagline')));
    p.appendChild(this.evoRow());
    p.appendChild(make('p', 'muted', t(isTouch ? 'menu.howtoTouch' : 'menu.howtoMouse')));
    const row = make('div', 'row');
    if (canResume) row.appendChild(button('btn primary', t('btn.resume'), () => this.actions.resume(), 'resumeBtn'));
    row.appendChild(button(canResume ? 'btn' : 'btn primary', t(canResume ? 'menu.newGame' : 'menu.play'), () => this.actions.play(), 'playBtn'));
    p.appendChild(row);
    if (this.lb) {
      const more = make('div', 'row');
      more.appendChild(this.boardButton('title'));
      p.appendChild(more);
    }
    p.appendChild(this.langRow());
    this.show(p);
  }

  gameOver(data: OverData): void {
    this.screen = 'over';
    this.overData = data;
    this.submit = { phase: 'idle', name: this.lb?.lastName() ?? '' };
    this.pauseBtn.classList.add('hidden');
    this.renderOver();
  }

  private renderOver(): void {
    const { score, best, newBest } = this.overData;
    const p = make('div', 'panel');
    p.appendChild(make('h2', '', t('over.title')));
    p.appendChild(make('p', 'muted', t('over.score')));
    p.appendChild(make('div', 'big-score', String(score)));
    if (newBest) p.appendChild(make('div', 'new-best', t('over.newBest')));
    p.appendChild(make('p', 'muted', `${t('over.best')}: ${best}`));
    const block = this.submitBlock();
    if (block) p.appendChild(block);
    const row = make('div', 'row');
    row.appendChild(button('btn primary', t('over.restart'), () => this.actions.restart(), 'restartBtn'));
    row.appendChild(button('btn secondary', t('over.menu'), () => this.actions.menu(), 'menuBtn'));
    if (this.lb) row.appendChild(this.boardButton('over'));
    p.appendChild(row);
    this.show(p);
  }

  /* ---------- Leaderboard: name entry on the game-over panel ---------- */

  private submitMessage(): string {
    const s = this.submit;
    if (s.phase === 'submitting') return t('submit.sending');
    if (s.phase !== 'error' && s.phase !== 'final') return '';
    switch (s.error) {
      case 'rate':
        return t('submit.errRate');
      case 'rejected':
        return t('submit.errRejected');
      case 'server':
        return t('submit.errServer');
      default:
        return t('submit.errNetwork');
    }
  }

  private submitBlock(): HTMLElement | null {
    if (!this.lb || this.overData.score < 1) return null;
    const s = this.submit;
    const box = make('div', 'submit-box');
    box.id = 'submitBox';
    box.dataset.phase = s.phase;

    if (s.phase === 'done' && s.result) {
      const { rank, entry, boards } = s.result;
      const line = rank.week > 0 ? t('submit.done', { all: rank.all, week: rank.week }) : t('submit.doneAll', { all: rank.all });
      const status = make('p', 'submit-status ok', line);
      status.setAttribute('role', 'status');
      box.appendChild(status);
      box.appendChild(this.compactList(boards.all.top, entry, rank.all));
      return box;
    }

    const status = make('p', 'submit-status' + (s.phase === 'error' || s.phase === 'final' ? ' bad' : ''), this.submitMessage());
    status.id = 'submitStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    // Refused for good (implausible, rate limited): nothing more to type or press.
    if (s.phase === 'final') {
      box.appendChild(status);
      return box;
    }

    const form = make('form', 'submit-form');
    form.noValidate = true;
    const label = make('label', 'submit-label', t('submit.label'));
    label.htmlFor = 'nameInput';
    const input = make('input', 'name-input');
    input.id = 'nameInput';
    input.name = 'name';
    input.type = 'text';
    input.value = s.name;
    input.placeholder = t('submit.placeholder');
    // Looser than NAME_MAX on purpose: input methods compose in Latin letters that can be
    // longer than the name they produce. The value is clipped to NAME_MAX once committed.
    input.maxLength = NAME_MAX * 3;
    input.setAttribute('autocomplete', 'nickname');
    input.autocapitalize = 'words';
    input.spellcheck = false;
    input.enterKeyHint = 'send';
    input.setAttribute('aria-describedby', 'nameHint');
    input.disabled = s.phase === 'submitting';
    const send = make('button', 'btn submit-btn', t(s.phase === 'error' ? 'lb.retry' : 'submit.send'));
    send.type = 'submit';
    send.id = 'submitBtn';
    send.disabled = s.phase === 'submitting' || !sanitizeName(s.name);
    const hint = make('p', 'hint', t('submit.hint'));
    hint.id = 'nameHint';

    let composing = false;
    let composedAt = -1e9;
    const commit = () => {
      const points = Array.from(input.value);
      if (points.length > NAME_MAX) input.value = points.slice(0, NAME_MAX).join('');
      this.submit.name = input.value;
      send.disabled = !sanitizeName(input.value);
    };
    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      composedAt = performance.now();
      commit();
    });
    input.addEventListener('input', () => {
      if (composing) this.submit.name = input.value;
      else commit();
    });
    // The on-screen keyboard covers the lower half of a phone; bring the field back into view.
    input.addEventListener('focus', () => {
      window.setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      // Enter that confirms an input-method candidate is not a request to send.
      if (composing || performance.now() - composedAt < 80) return;
      commit();
      void this.sendScore();
    });

    const fields = make('div', 'submit-fields');
    fields.append(input, send);
    form.append(label, fields, hint, status);
    box.appendChild(form);
    return box;
  }

  private async sendScore(): Promise<void> {
    const name = sanitizeName(this.submit.name);
    if (!this.lb || !name) return;
    // Flipping the phase before the first await is what makes a double click send once.
    if (this.submit.phase === 'submitting' || this.submit.phase === 'done' || this.submit.phase === 'final') return;
    const over = this.overData;
    this.submit = { phase: 'submitting', name };
    this.actions.click();
    this.renderOver();
    const r = await this.lb.submit(name, over);
    // A new game was finished while this one was in flight: its panel is not ours to touch.
    if (this.overData.gameId !== over.gameId) return;
    if (r.ok) {
      this.submit = { phase: 'done', name: r.data.entry.name, result: r.data };
      this.board.data = r.data.boards;
      this.board.fetchedAt = Date.now();
      this.board.phase = 'ready';
    } else {
      this.submit = { phase: r.retryable ? 'error' : 'final', name, error: r.error };
    }
    if (this.screen === 'over') this.renderOver();
  }

  private row(rank: number | null, e: Entry, me: boolean): HTMLLIElement {
    const li = make('li', 'lb-row' + (me ? ' me' : ''));
    if (me) li.setAttribute('aria-current', 'true');
    li.dataset.id = String(e.id);
    li.appendChild(make('span', 'lb-rank', rank === null ? '' : String(rank)));
    const name = make('span', 'lb-name');
    name.appendChild(make('span', 'lb-name-text', e.name));
    if (me) name.appendChild(make('span', 'lb-you', t('lb.you')));
    li.appendChild(name);
    li.appendChild(make('span', 'lb-score', String(e.score)));
    return li;
  }

  /** Top few rows, plus the player's own row below a gap when it is further down. */
  private compactList(top: readonly Entry[], own: Entry, ownRank: number): HTMLElement {
    const mine = this.lb?.mine() ?? new Set<number>();
    const list = make('ol', 'lb-list compact');
    const shown = top.slice(0, COMPACT_ROWS);
    shown.forEach((e, i) => list.appendChild(this.row(i + 1, e, e.id === own.id || mine.has(e.id))));
    if (!shown.some((e) => e.id === own.id)) {
      const gap = make('li', 'lb-gap', '⋯');
      gap.setAttribute('aria-hidden', 'true');
      list.appendChild(gap);
      list.appendChild(this.row(ownRank, own, true));
    }
    return list;
  }

  /* ---------- Leaderboard: full board screen ---------- */

  private openBoard(returnTo: BoardState['returnTo']): void {
    if (!this.lb) return;
    this.actions.click();
    this.board.returnTo = returnTo;
    this.screen = 'board';
    if (this.board.data && Date.now() - this.board.fetchedAt < BOARD_FRESH_MS) {
      this.board.phase = 'ready';
      this.renderBoard();
    } else {
      void this.loadBoard();
    }
  }

  private async loadBoard(): Promise<void> {
    if (!this.lb) return;
    const request = ++this.boardRequest;
    this.board.phase = 'loading';
    this.renderBoard();
    const r = await this.lb.boards();
    if (request !== this.boardRequest) return;
    if (r.ok) {
      this.board.data = r.data;
      this.board.fetchedAt = Date.now();
      this.board.phase = 'ready';
    } else {
      this.board.phase = 'error';
    }
    if (this.screen === 'board') this.renderBoard();
  }

  private closeBoard(): void {
    this.actions.click();
    this.boardRequest++;
    const to = this.board.returnTo;
    if (to === 'pause') this.paused();
    else if (to === 'over') {
      this.screen = 'over';
      this.renderOver();
    } else this.title(this.titleCanResume);
  }

  private renderBoard(): void {
    if (this.screen !== 'board') return;
    const b = this.board;
    const p = make('div', 'panel board-panel');
    p.id = 'boardPanel';
    p.appendChild(make('h2', '', t('lb.title')));

    const tabs = make('div', 'row lb-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const [tab, key] of [['all', 'lb.tabAll'], ['week', 'lb.tabWeek']] as const) {
      const btn = button('btn secondary' + (b.tab === tab ? ' active' : ''), t(key), () => {
        if (this.board.tab === tab) return;
        this.actions.click();
        this.board.tab = tab;
        this.renderBoard();
      });
      btn.id = tab === 'all' ? 'tabAll' : 'tabWeek';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(b.tab === tab));
      tabs.appendChild(btn);
    }
    p.appendChild(tabs);

    const body = make('div', 'lb-body');
    body.setAttribute('role', 'tabpanel');
    body.setAttribute('aria-live', 'polite');
    if (b.phase === 'loading') {
      body.appendChild(make('p', 'muted lb-note', t('lb.loading')));
    } else if (b.phase === 'error' || !b.data) {
      body.appendChild(make('p', 'lb-note bad', t('lb.error')));
      body.appendChild(button('btn', t('lb.retry'), () => void this.loadBoard(), 'lbRetry'));
    } else {
      const board = b.tab === 'all' ? b.data.all : b.data.week;
      if (board.top.length === 0) {
        body.appendChild(make('p', 'muted lb-note', t('lb.empty')));
      } else {
        const mine = this.lb?.mine() ?? new Set<number>();
        const list = make('ol', 'lb-list');
        board.top.forEach((e, i) => list.appendChild(this.row(i + 1, e, mine.has(e.id))));
        body.appendChild(list);
      }
      if (b.tab === 'week') {
        const serverNow = b.data.now + (Date.now() - b.fetchedAt);
        body.appendChild(make('p', 'muted lb-resets', t('lb.resets', resetsIn(serverNow, b.data.weekEnd))));
      }
    }
    p.appendChild(body);

    const row = make('div', 'row');
    row.appendChild(button('btn secondary', t('lb.back'), () => this.closeBoard(), 'lbBack'));
    p.appendChild(row);
    this.show(p);
  }

  paused(): void {
    this.screen = 'pause';
    const p = make('div', 'panel');
    p.appendChild(make('h2', '', t('pause.title')));
    const row = make('div', 'row');
    row.appendChild(button('btn primary', t('btn.resume'), () => this.actions.resume(), 'resumeBtn'));
    row.appendChild(button('btn secondary', t('over.menu'), () => this.actions.menu(), 'menuBtn'));
    if (this.lb) row.appendChild(this.boardButton('pause'));
    p.appendChild(row);
    p.appendChild(this.langRow());
    this.show(p);
  }
}
