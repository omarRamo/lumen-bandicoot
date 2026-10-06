// Dev tool (agent Personnage): in-game zoomed captures of Lumen.
// node tools/lumen-ingame.mjs <levelId> <script> [out-prefix]
// script = ';;'-separated steps: wait:ms | down:Key | up:Key | press:Key | shot:name | eval:js | kill:cause | masks:n
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [id = 'T-lumen-run', script = 'wait:800,shot:idle', prefix = 'ingame'] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${base}?debug&level=${encodeURIComponent(id)}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 });
for (const step of script.split(/\s*;;\s*/)) {
  const [cmd, ...rest] = step.split(':'); const arg = rest.join(':');
  if (cmd === 'wait') await page.waitForTimeout(+arg);
  else if (cmd === 'down') await page.keyboard.down(arg);
  else if (cmd === 'up') await page.keyboard.up(arg);
  else if (cmd === 'press') await page.keyboard.press(arg);
  else if (cmd === 'eval') await page.evaluate(arg);
  else if (cmd === 'kill') await page.evaluate((c) => window.__LB.game.kill(c), arg);
  else if (cmd === 'masks') await page.evaluate((n) => { const g = window.__LB.game; g.masks = +n; }, arg);
  else if (cmd === 'shot') {
    const box = await page.evaluate(() => {
      const L = window.__LB, p = L.player, cam = L.rig.camera;
      const v = p.pos.clone(); v.y += 0.6; v.project(cam);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
    });
    const w = 360, h = 300;
    const clip = { x: Math.max(0, Math.min(1280 - w, box.x - w / 2)), y: Math.max(0, Math.min(720 - h, box.y - h / 2)), width: w, height: h };
    await page.screenshot({ path: `test-results/${prefix}-${arg}.png`, clip });
    console.log('shot', arg, JSON.stringify(clip));
  } else if (cmd === 'full') await page.screenshot({ path: `test-results/${prefix}-${arg}.png` });
}
await browser.close();
await server.close();
