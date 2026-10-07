// Level design A — screenshots of chosen spots. node tools/levels-a-shots.mjs [--isolate] id@x,y,z[@hold] …
// e.g. 1-5@0,0,-30 2-3@0,10,-70@up  (hold = key held 0.8 s before the shot: up|down|left|right)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const ISOLATE = process.argv.includes('--isolate');
const isolate = {
  name: 'levels-a-isolate', enforce: 'pre',
  load(id) { if (ISOLATE && /src[\\/]levels[\\/](w3|w4|secret|bosses)\.js$/.test(id)) return 'export default [];'; },
};
const shots = process.argv.slice(2).filter((a) => !a.startsWith('--'));
mkdirSync('test-results', { recursive: true });
const server = await createServer({ root: process.cwd(), plugins: [isolate], server: { hmr: false, port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[err]', e.message));
for (const s of shots) {
  const [id, at, hold] = s.split('@');
  await page.goto(`${server.resolvedUrls.local[0]}?debug&level=${id}`);
  await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 });
  if (at) {
    const p = at.split(',').map(Number);
    await page.evaluate((p) => { const L = window.__LB.level; L.player.pos.set(...p); L.player.vel.set(0, 0, 0); window.__LB.rig.snap(L.player); }, p);
  }
  await page.waitForTimeout(600);
  if (hold) {
    const key = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[hold];
    await page.keyboard.down(key); await page.waitForTimeout(800); await page.keyboard.up(key);
  } else await page.waitForTimeout(800);
  const file = `test-results/shot-${s.replace(/[^\w.-]+/g, '_')}.png`;
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();
await server.close();
