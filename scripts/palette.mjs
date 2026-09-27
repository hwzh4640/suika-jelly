/**
 * Design aid for the fruit colours. Renders every fruit at the SAME size (so only colour and
 * pattern can tell them apart), measures the colour each sprite really shows, prints how far
 * apart every pair is for normal and colour-blind vision, and saves a contact sheet.
 *   node scripts/palette.mjs            → /tmp/suika-palette.png
 */
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { writeFileSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH ?? path.join(homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const OUT = process.env.OUT ?? '/tmp/suika-palette.png';
const PORT = process.env.PORT ?? '5179';
const { chromium } = await import(process.env.PLAYWRIGHT_CORE ?? 'playwright-core');

const server = spawn('npx', ['vite', '--port', PORT, '--strictPort'], { stdio: 'ignore', detached: true });
process.on('exit', () => {
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
});
const base = `http://localhost:${PORT}/suika-jelly/`;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    /* not yet */
  }
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: 'block' })).newPage();
await page.goto(base);
await page.waitForFunction(() => !!window.__game);

const result = await page.evaluate(async () => {
  const { getSprite, SPRITE_PAD } = await import('/suika-jelly/src/render/fruitSprites.ts');
  const { FRUITS } = await import('/suika-jelly/src/game/fruits.ts');
  const C = await import('/suika-jelly/test/helpers/colour.ts');
  const R = 56;
  const measured = [];
  for (let t = 0; t < FRUITS.length; t++) {
    const sprite = getSprite(t, R);
    const g = sprite.getContext('2d');
    const { data, width, height } = g.getImageData(0, 0, sprite.width, sprite.height);
    const cx = width / 2;
    const cy = height / 2;
    const sum = [0, 0, 0];
    let n = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.hypot(x - cx, y - cy) > R * 0.9) continue;
        const i = (y * width + x) * 4;
        if (data[i + 3] < 200) continue;
        sum[0] += C.srgbToLinear(data[i]);
        sum[1] += C.srgbToLinear(data[i + 1]);
        sum[2] += C.srgbToLinear(data[i + 2]);
        n++;
      }
    }
    measured.push({ key: FRUITS[t].key, r: FRUITS[t].r, hex: FRUITS[t].color, lin: sum.map((v) => v / n) });
  }
  const pairs = [];
  for (let i = 0; i < measured.length; i++) {
    for (let j = i + 1; j < measured.length; j++) {
      const d = {};
      for (const v of C.VISIONS) d[v] = C.distance(measured[i].lin, measured[j].lin, v);
      pairs.push({ a: measured[i].key, b: measured[j].key, gap: j - i, ...d, worst: Math.min(...Object.values(d)) });
    }
  }
  pairs.sort((p, q) => p.worst - q.worst);

  // Contact sheet: one row per kind of vision, all fruits the same size on the game's background.
  const cell = R * SPRITE_PAD * 2;
  const sheet = document.createElement('canvas');
  sheet.width = Math.ceil(cell * FRUITS.length + 20);
  sheet.height = Math.ceil((cell + 8) * C.VISIONS.length + 12);
  const s = sheet.getContext('2d');
  s.fillStyle = '#f6e3d2';
  s.fillRect(0, 0, sheet.width, sheet.height);
  C.VISIONS.forEach((vision, row) => {
    for (let t = 0; t < FRUITS.length; t++) {
      const sprite = getSprite(t, R);
      const tmp = document.createElement('canvas');
      tmp.width = sprite.width;
      tmp.height = sprite.height;
      const g = tmp.getContext('2d');
      g.drawImage(sprite, 0, 0);
      if (vision !== 'normal') {
        const img = g.getImageData(0, 0, tmp.width, tmp.height);
        for (let i = 0; i < img.data.length; i += 4) {
          const out = C.simulate([C.srgbToLinear(img.data[i]), C.srgbToLinear(img.data[i + 1]), C.srgbToLinear(img.data[i + 2])], vision);
          img.data[i] = C.linearToSrgb(out[0]);
          img.data[i + 1] = C.linearToSrgb(out[1]);
          img.data[i + 2] = C.linearToSrgb(out[2]);
        }
        g.putImageData(img, 0, 0);
      }
      s.drawImage(tmp, 10 + t * cell, 6 + row * (cell + 8), cell, cell);
    }
    s.fillStyle = '#5a3a2a';
    s.font = '600 13px sans-serif';
    s.fillText(vision, 8, 18 + row * (cell + 8));
  });
  return { measured, pairs, sheet: sheet.toDataURL('image/png') };
});

writeFileSync(OUT, Buffer.from(result.sheet.split(',')[1], 'base64'));
const f = (n) => n.toFixed(1).padStart(5);
console.log('closest pairs as rendered (OKLab distance x100; tiers apart in brackets)');
console.log('pair'.padEnd(26), 'normal protan deutan tritan  worst');
for (const p of result.pairs.slice(0, Number(process.env.TOP ?? 14))) {
  console.log(`${p.a} / ${p.b} [${p.gap}]`.padEnd(26), f(p.normal), f(p.protan), ' ' + f(p.deutan), ' ' + f(p.tritan), ' ' + f(p.worst));
}
const adjacent = result.pairs.filter((p) => p.gap === 1);
console.log(`weakest pair overall: ${f(result.pairs[0].worst)}   weakest neighbouring tiers: ${f(Math.min(...adjacent.map((p) => p.worst)))}`);
console.log(`contact sheet: ${OUT}`);
await browser.close();
process.exit(0);
