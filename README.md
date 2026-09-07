# Suika Jelly · 果冻合成大西瓜

A browser take on the Suika (watermelon) merge game: drop glossy jelly fruits into a glass
mason jar, and when two identical jellies touch they squish together into the next fruit.
Grow a watermelon, don't let the jar overflow.

**Play:** https://pages.hz.ax/suika-jelly/

- Works on phones (touch: drag to aim, release to drop) and desktop (mouse or `←` `→` + `Space`).
- English, 简体中文, 繁體中文 — auto-detected, switchable in the menu, or `?lang=zh-TW`.
- Original chiptune loop and all sound effects are synthesised in the browser with Web Audio;
  no audio files. The tempo creeps up as the jar fills. `M` toggles mute, `P` pauses.
- Physics by [matter-js](https://brm.io/matter-js/); everything else is hand-drawn Canvas 2D.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173/suika-jelly/
npm test           # vitest: rules, merge maths, song data, i18n
npm run build      # tsc + vite → dist/
npm run smoke      # headless Chromium: plays, checks audio output, screenshots to /tmp
```

Pushes to `main` deploy through GitHub Actions to GitHub Pages.

## Scoring

Merging two fruits of tier *n* (cherry = 1) scores the triangular number *n(n+1)/2*:
1, 3, 6, 10, 15, 21, 28, 36, 45, 55 and 66 for two watermelons, which vanish.
