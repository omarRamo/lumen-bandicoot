// Browser smoke test: boots every level directly (?level=ID&debug), runs a few seconds of simulated input,
// fails on any console error / page error, and saves screenshots to test-results/.
// Usage: node tests/browser/smoke.mjs [levelId ...]   (defaults to every level)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const server = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = 'http://127.0.0.1:5199/';
mkdirSync('test-results', { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`${base}?debug`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__LB && window.__LB.ORDER, null, { timeout: 30000 });
let ids = process.argv.slice(2);
if (!ids.length) ids = await page.evaluate(() => Object.keys(window.__LB.LEVELS));

let failed = 0;
for (const id of ids) {
  errors.length = 0;
  await page.goto(`${base}?debug&level=${encodeURIComponent(id)}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowUp');
    const info = await page.evaluate(() => {
      const L = window.__LB.level, p = L?.player;
      return { pos: p && [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(2)), ents: L?.entities.length, crates: L?.stats.cratesTotal, fps: Math.round(window.__LB.fps) };
    });
    await page.screenshot({ path: `test-results/level-${id}.png` });
    const bad = errors.filter((e) => !/favicon|GL_|WebGL|GPU stall/.test(e));
    console.log(`${bad.length ? '✗' : '✓'} ${id} ${JSON.stringify(info)}`);
    if (bad.length) { failed++; bad.slice(0, 6).forEach((e) => console.log('   ', e)); }
  } catch (err) {
    failed++;
    console.log(`✗ ${id} ${err.message.split('\n')[0]}`);
    errors.slice(0, 6).forEach((e) => console.log('   ', e));
  }
}
await browser.close();
await server.close();
console.log(failed ? `${failed} level(s) failed` : 'all levels OK');
process.exit(failed ? 1 : 0);
