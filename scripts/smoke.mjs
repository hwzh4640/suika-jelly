/**
 * Headless smoke test + screenshots. Uses the Playwright Chromium already cached on this
 * machine. Set BASE_URL to test a deployed site instead of a local preview build.
 *   npm run build && npm run smoke
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PW = process.env.PLAYWRIGHT_CORE ?? '/home/hanwenz/.nvm/versions/node/v24.18.0/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
const CHROME = process.env.CHROME_PATH ?? path.join(homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const OUT = process.env.OUT_DIR ?? '/tmp';
const { chromium } = await import(PW);

let server = null;
let base = process.env.BASE_URL;
if (!base) {
  if (!existsSync('dist')) throw new Error('run npm run build first');
  server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' });
  base = 'http://localhost:4173/suika-jelly/';
  await new Promise((r) => setTimeout(r, 1500));
}
if (!base.endsWith('/')) base += '/';

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const failures = [];

async function run(name, viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr ?? 1, hasTouch: !!opts.touch, isMobile: !!opts.touch, locale: opts.locale ?? 'en-US' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + (opts.query ?? ''), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__game, null, { timeout: 15000 });
  await page.screenshot({ path: `${OUT}/suika-${name}-title.png` });
  await page.click('#playBtn');
  await page.waitForFunction(() => window.__game.state() === 'playing');
  // Drop a spread of fruits, some via real pointer taps, some via the debug hook.
  const box = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { left: parseFloat(cs.getPropertyValue('--box-left')), top: parseFloat(cs.getPropertyValue('--box-top')), w: parseFloat(cs.getPropertyValue('--box-w')), h: parseFloat(cs.getPropertyValue('--box-h')) };
  });
  for (let i = 0; i < 6; i++) {
    const x = box.left + box.w * (0.2 + 0.6 * ((i * 7) % 10) / 10);
    const y = box.top + box.h * 0.5;
    if (opts.touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForTimeout(520);
  }
  for (let i = 0; i < (opts.drops ?? 24); i++) {
    await page.evaluate((x) => window.__game.drop(x), 80 + ((i * 53) % 320));
    await page.waitForTimeout(500);
  }
  // Force a couple of big merges so large tiers show up.
  await page.evaluate(() => { window.__game.spawn(8, 150, 300); window.__game.spawn(8, 330, 300); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__game.spawn(9, 240, 250); });
  await page.waitForTimeout(1500);
  // Music must be running and actually producing signal on the master bus.
  const sound = await page.evaluate(async () => {
    const { audio, music } = window.__game;
    if (!audio.ctx || !audio.master) return { state: 'no-context', playing: music.playing, peak: 0 };
    const an = audio.ctx.createAnalyser();
    an.fftSize = 2048;
    audio.master.connect(an);
    let peak = 0;
    const buf = new Float32Array(an.fftSize);
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 50));
      an.getFloatTimeDomainData(buf);
      for (const v of buf) peak = Math.max(peak, Math.abs(v));
    }
    return { state: audio.ctx.state, playing: music.playing, peak, bpm: music.bpm };
  });
  const score = await page.evaluate(() => window.__game.score());
  const state = await page.evaluate(() => window.__game.state());
  const bodies = await page.evaluate(() => window.__game.bodies().length);
  await page.screenshot({ path: `${OUT}/suika-${name}-play.png` });
  if (opts.gameOver) {
    // Flood the jar with mixed tiers until it overflows, then restart from the panel.
    for (let i = 0; i < 80 && (await page.evaluate(() => window.__game.state())) === 'playing'; i++) {
      await page.evaluate((i) => window.__game.spawn(3 + (i % 4), 100 + ((i * 37) % 280), 120), i);
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => window.__game.state() === 'gameOver', null, { timeout: 15000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/suika-${name}-over.png` });
    await page.click('#restartBtn');
    await page.waitForFunction(() => window.__game.state() === 'playing' && window.__game.bodies().length === 0);
    console.log(`  ${name}: game over + restart OK`);
  }
  const ok = score > 0 && errors.length === 0 && sound.playing && sound.peak > 0.01;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: score=${score} state=${state} bodies=${bodies} errors=${errors.length} audio=${sound.state} music=${sound.playing} peak=${sound.peak.toFixed(3)} bpm=${sound.bpm?.toFixed(0)}`);
  for (const e of errors) console.log('   ', e);
  if (!ok) failures.push(name);
  await ctx.close();
}

await run('mobile', { width: 390, height: 844 }, { dpr: 3, touch: true, locale: 'zh-CN' });
await run('desktop', { width: 1280, height: 720 }, { drops: 30, gameOver: true });
await run('zh-TW', { width: 800, height: 900 }, { query: '?lang=zh-TW', drops: 6 });

await browser.close();
if (server) server.kill();
if (failures.length) {
  console.error('smoke failures:', failures.join(', '));
  process.exit(1);
}
