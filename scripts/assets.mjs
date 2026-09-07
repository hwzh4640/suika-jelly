/**
 * Regenerate PWA/icon/preview assets into public/ using headless Chromium:
 *   - icons/icon-192.png, icons/icon-512.png, icons/icon-512-maskable.png, apple-touch-icon.png
 *   - splash/<w>x<h>.png Apple launch screens for every current iPhone/iPad size
 *   - cover.png 1200x630 Open Graph preview rendered from the real game
 * Prints the <link rel="apple-touch-startup-image"> tags to paste into index.html.
 *   npm run build && node scripts/assets.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const PW = process.env.PLAYWRIGHT_CORE ?? '/home/hanwenz/.nvm/versions/node/v24.18.0/lib/node_modules/openclaw/node_modules/playwright-core/index.mjs';
const CHROME = process.env.CHROME_PATH ?? path.join(homedir(), '.cache/ms-playwright/chromium-1223/chrome-linux/chrome');
const { chromium } = await import(PW);

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const svg = readFileSync('public/icon.svg', 'utf8');
const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });

async function icon(size, file) {
  const ctx = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<body style="margin:0"><img src="${dataUrl}" style="display:block;width:${size}px;height:${size}px"></body>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: file });
  await ctx.close();
}
await icon(180, 'public/apple-touch-icon.png');
await icon(192, 'public/icons/icon-192.png');
await icon(512, 'public/icons/icon-512.png');
await icon(512, 'public/icons/icon-512-maskable.png');

// Apple launch screens: [css width, css height, dpr]
const devices = [
  [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2],
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [810, 1080, 2], [768, 1024, 2], [744, 1133, 2],
];
const links = [];
for (const [w, h, dpr] of devices) {
  for (const orient of ['portrait', 'landscape']) {
    const cw = orient === 'portrait' ? w : h;
    const ch = orient === 'portrait' ? h : w;
    const ctx = await browser.newContext({ viewport: { width: cw, height: ch }, deviceScaleFactor: dpr });
    const p = await ctx.newPage();
    const iconSize = Math.round(Math.min(cw, ch) * 0.34);
    await p.setContent(`<body style="margin:0;width:${cw}px;height:${ch}px;background:linear-gradient(#fff3e0,#ffd9bf);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,-apple-system,'PingFang SC','Hiragino Sans GB',sans-serif">
      <img src="${dataUrl}" style="width:${iconSize}px;height:${iconSize}px;border-radius:${Math.round(iconSize * 0.22)}px;box-shadow:0 12px 40px rgba(90,50,20,.25)">
      <div style="margin-top:${Math.round(iconSize * 0.18)}px;font-size:${Math.round(iconSize * 0.2)}px;font-weight:900;background:linear-gradient(90deg,#ff5f7e,#ff9f1c,#4caf50,#2f9e57);-webkit-background-clip:text;color:transparent">Suika Jelly</div>
      <div style="margin-top:6px;font-size:${Math.round(iconSize * 0.11)}px;font-weight:700;color:#8a6a58">果冻合成大西瓜 · 果凍合成大西瓜</div></body>`);
    await p.waitForTimeout(100);
    const file = `splash/${cw * dpr}x${ch * dpr}.png`;
    await p.screenshot({ path: 'public/' + file });
    links.push(`    <link rel="apple-touch-startup-image" href="${file}" media="screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: ${orient})" />`);
    await ctx.close();
  }
}
console.log(links.join('\n'));

// Open Graph cover: the real game with a curated pile of jellies and the title beside the jar.
if (!existsSync('dist')) throw new Error('run npm run build first (cover.png renders from the preview build)');
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4174/suika-jelly/?lang=en', { waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__game);
  await p.evaluate(() => {
    window.__game.play();
    const g = window.__game;
    const pile = [[10, 240, 640], [8, 110, 660], [7, 375, 650], [6, 100, 560], [5, 360, 530], [4, 240, 480], [3, 150, 470], [2, 330, 430], [1, 95, 480], [0, 400, 450], [2, 230, 400], [1, 300, 380], [3, 70, 380]];
    for (const [t, x, y] of pile) g.spawn(t, x, y);
    g.setNext(1, 3);
    g.game.setAim(300);
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('corner').classList.add('hidden');
    document.getElementById('ring').classList.add('hidden');
    const s = document.createElement('style');
    s.textContent = `
      .cover { position: absolute; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; font-family: system-ui, -apple-system, 'PingFang SC', 'Hiragino Sans GB', sans-serif; }
      .cover.l { left: 60px; width: 330px; }
      .cover.r { right: 60px; width: 330px; text-align: right; align-items: flex-end; }
      .cover h1 { margin: 0; font-size: 64px; line-height: 1.05; font-weight: 900; background: linear-gradient(90deg,#ff5f7e,#ff9f1c,#4caf50,#2f9e57); -webkit-background-clip: text; color: transparent; }
      .cover .zh { margin-top: 10px; font-size: 34px; font-weight: 800; color: #5a3a2a; }
      .cover p { margin: 14px 0 0; font-size: 22px; line-height: 1.35; color: #8a6a58; font-weight: 600; }
      .cover .tag { display: inline-block; margin-top: 18px; padding: 8px 18px; border-radius: 999px; background: rgba(255,255,255,.65); border: 1.5px solid rgba(255,255,255,.9); color: #5a3a2a; font-weight: 700; font-size: 18px; }
    `;
    document.head.appendChild(s);
    const l = document.createElement('div');
    l.className = 'cover l';
    l.innerHTML = '<h1>Suika Jelly</h1><div class="zh">果冻合成大西瓜</div><p>Drop jellies. Match two of a kind. Grow a watermelon.</p>';
    const r = document.createElement('div');
    r.className = 'cover r';
    r.innerHTML = '<p>English · 简体中文 · 繁體中文</p><span class="tag">Phone &amp; desktop · free</span><span class="tag">Original chiptune soundtrack</span>';
    document.getElementById('app').append(l, r);
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'public/cover.png' });
  await ctx.close();
} finally {
  server.kill();
}
await browser.close();
console.error('assets generated');
