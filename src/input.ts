import type { Game } from './game/Game';
import type { Renderer } from './render/renderer';

export interface InputHandlers {
  /** Called on the first pointer/key gesture so audio can be unlocked. */
  gesture(): void;
  drop(): void;
  togglePause(): void;
  toggleMute(): void;
}

/** Pointer: press/drag to aim, release to drop. Mouse hover also aims. Keyboard for desktop. */
export function bindInput(canvas: HTMLCanvasElement, game: Game, renderer: Renderer, h: InputHandlers): (dt: number) => void {
  let activePointer: number | null = null;
  const keys = new Set<string>();

  const aim = (ev: PointerEvent) => {
    if (game.state !== 'playing') return;
    game.setAim(renderer.toWorld(ev.clientX, ev.clientY).x);
  };
  const onDown = (ev: PointerEvent) => {
    ev.preventDefault();
    h.gesture();
    if (game.state !== 'playing') return;
    activePointer = ev.pointerId;
    try {
      canvas.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    aim(ev);
  };
  const onMove = (ev: PointerEvent) => {
    if (activePointer !== null && ev.pointerId !== activePointer) return;
    if (activePointer === null && ev.pointerType !== 'mouse') return;
    aim(ev);
  };
  const onUp = (ev: PointerEvent) => {
    if (activePointer === null || ev.pointerId !== activePointer) return;
    activePointer = null;
    aim(ev);
    h.drop();
  };
  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId === activePointer) activePointer = null;
  };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.repeat && (ev.code === 'Space' || ev.code === 'Enter')) return;
    if ((ev.target as HTMLElement | null)?.tagName === 'BUTTON' && (ev.code === 'Space' || ev.code === 'Enter')) return;
    switch (ev.code) {
      case 'ArrowLeft':
      case 'KeyA':
      case 'ArrowRight':
      case 'KeyD':
        keys.add(ev.code);
        ev.preventDefault();
        break;
      case 'Space':
      case 'ArrowDown':
      case 'KeyS':
      case 'Enter':
        h.gesture();
        h.drop();
        ev.preventDefault();
        break;
      case 'KeyP':
      case 'Escape':
        h.togglePause();
        break;
      case 'KeyM':
        h.toggleMute();
        break;
    }
  };
  const onKeyUp = (ev: KeyboardEvent) => keys.delete(ev.code);

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());

  /** Per-frame keyboard aiming. Returns nothing; call from the game loop. */
  const tick = (dt: number) => {
    if (game.state !== 'playing') return;
    let dir = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dir -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dir += 1;
    if (dir) game.setAim(game.aimX + dir * 360 * dt);
  };
  return tick;
}
