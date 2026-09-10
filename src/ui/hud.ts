import { FRUITS } from '../game/fruits';
import { LANGS, LANG_NAMES, getLang, onLangChange, setLang, t, type Lang, type StringKey } from '../i18n';
import { Renderer } from '../render/renderer';
import { audio } from '../audio/context';

export interface HudActions {
  play(): void;
  restart(): void;
  menu(): void;
  pause(): void;
  resume(): void;
}

const isTouch = typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
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
  private screen: 'none' | 'title' | 'over' | 'pause' = 'none';
  private overData = { score: 0, best: 0, newBest: false };
  private titleCanResume = false;
  private rightMargin = 0;

  constructor(private actions: HudActions) {
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

  /** Re-translate static labels and re-render whichever overlay is open. */
  refresh(): void {
    document.querySelectorAll<HTMLElement>('[data-t]').forEach((e) => {
      e.textContent = t(e.dataset.t as StringKey);
    });
    this.refreshMute();
    this.pauseBtn.setAttribute('aria-label', t('btn.pause'));
    document.title = `${t('app.title')}`;
    if (this.screen === 'title') this.title(this.titleCanResume);
    else if (this.screen === 'over') this.gameOver(this.overData.score, this.overData.best, this.overData.newBest);
    else if (this.screen === 'pause') this.paused();
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
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    arrow.textContent = '↻';
    items.appendChild(arrow);
  }

  private evoRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'evo';
    FRUITS.forEach((_, i) => {
      if (i > 0) {
        const s = document.createElement('span');
        s.className = 'sep';
        s.textContent = '›';
        row.appendChild(s);
      }
      const c = document.createElement('canvas');
      Renderer.drawIcon(c, i, 16 + i * 1.4);
      row.appendChild(c);
    });
    return row;
  }

  private langRow(): HTMLElement {
    const row = document.createElement('div');
    row.className = 'row lang-row';
    for (const lang of LANGS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn secondary' + (getLang() === lang ? ' active' : '');
      b.textContent = LANG_NAMES[lang as Lang];
      b.addEventListener('click', () => setLang(lang));
      row.appendChild(b);
    }
    return row;
  }

  private show(panel: HTMLElement): void {
    this.overlay.innerHTML = '';
    this.overlay.appendChild(panel);
    this.overlay.classList.remove('hidden');
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
    const p = document.createElement('div');
    p.className = 'panel';
    const h1 = document.createElement('h1');
    h1.textContent = t('app.title');
    p.appendChild(h1);
    const tag = document.createElement('p');
    tag.className = 'tagline';
    tag.textContent = t('app.tagline');
    p.appendChild(tag);
    p.appendChild(this.evoRow());
    const how = document.createElement('p');
    how.className = 'muted';
    how.textContent = t(isTouch ? 'menu.howtoTouch' : 'menu.howtoMouse');
    p.appendChild(how);
    const row = document.createElement('div');
    row.className = 'row';
    if (canResume) {
      const resume = document.createElement('button');
      resume.type = 'button';
      resume.className = 'btn primary';
      resume.id = 'resumeBtn';
      resume.textContent = t('btn.resume');
      resume.addEventListener('click', () => this.actions.resume());
      row.appendChild(resume);
    }
    const play = document.createElement('button');
    play.type = 'button';
    play.className = canResume ? 'btn' : 'btn primary';
    play.id = 'playBtn';
    play.textContent = t(canResume ? 'menu.newGame' : 'menu.play');
    play.addEventListener('click', () => this.actions.play());
    row.appendChild(play);
    p.appendChild(row);
    p.appendChild(this.langRow());
    this.show(p);
  }

  gameOver(score: number, best: number, newBest: boolean): void {
    this.screen = 'over';
    this.overData = { score, best, newBest };
    this.pauseBtn.classList.add('hidden');
    const p = document.createElement('div');
    p.className = 'panel';
    const h2 = document.createElement('h2');
    h2.textContent = t('over.title');
    p.appendChild(h2);
    const label = document.createElement('p');
    label.className = 'muted';
    label.textContent = t('over.score');
    p.appendChild(label);
    const big = document.createElement('div');
    big.className = 'big-score';
    big.textContent = String(score);
    p.appendChild(big);
    if (newBest) {
      const nb = document.createElement('div');
      nb.className = 'new-best';
      nb.textContent = t('over.newBest');
      p.appendChild(nb);
    }
    const bestP = document.createElement('p');
    bestP.className = 'muted';
    bestP.textContent = `${t('over.best')}: ${best}`;
    p.appendChild(bestP);
    const row = document.createElement('div');
    row.className = 'row';
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn primary';
    again.id = 'restartBtn';
    again.textContent = t('over.restart');
    again.addEventListener('click', () => this.actions.restart());
    row.appendChild(again);
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'btn secondary';
    menu.textContent = t('over.menu');
    menu.addEventListener('click', () => this.actions.menu());
    row.appendChild(menu);
    p.appendChild(row);
    this.show(p);
  }

  paused(): void {
    this.screen = 'pause';
    const p = document.createElement('div');
    p.className = 'panel';
    const h2 = document.createElement('h2');
    h2.textContent = t('pause.title');
    p.appendChild(h2);
    const row = document.createElement('div');
    row.className = 'row';
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'btn primary';
    resume.id = 'resumeBtn';
    resume.textContent = t('btn.resume');
    resume.addEventListener('click', () => this.actions.resume());
    row.appendChild(resume);
    const menu = document.createElement('button');
    menu.type = 'button';
    menu.className = 'btn secondary';
    menu.textContent = t('over.menu');
    menu.addEventListener('click', () => this.actions.menu());
    row.appendChild(menu);
    p.appendChild(row);
    p.appendChild(this.langRow());
    this.show(p);
  }
}
