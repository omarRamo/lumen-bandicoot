// Browser smoke test: boots every level directly (?level=ID&debug), runs a few seconds of simulated input,
// fails on any console error / page error, and saves screenshots to test-results/.
// Usage: node tests/browser/smoke.mjs [levelId ...]   (defaults to every level)
import { createServer, build, preview } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

// Default: test the production build (fast loads, real bundle). `--dev` uses the Vite dev server instead.
const DEV = process.argv.includes('--dev');
const port = 5200 + Math.floor(Math.random() * 700);
let server;
if (DEV) {
  server = await createServer({ server: { port, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
  await server.listen();
} else {
  const outDir = `test-results/smoke-dist-${process.pid}`;
  await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
  server = await preview({ preview: { port, host: '127.0.0.1' }, build: { outDir }, logLevel: 'error' });
}
const base = server.resolvedUrls.local[0];
mkdirSync('test-results', { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`${base}?debug`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForFunction(() => window.__LB && window.__LB.ORDER, null, { timeout: 30000 });
let ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!ids.length) ids = await page.evaluate(() => Object.keys(window.__LB.LEVELS));

let failed = 0;
for (const id of ids) {
  errors.length = 0;
  await page.goto(`${base}?debug&level=${encodeURIComponent(id)}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  try {
    await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 90000 });
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
if (server.httpServer) await new Promise((r) => server.httpServer.close(r)); else await server.close?.();
if (!DEV) { const { rmSync } = await import('node:fs'); rmSync(`test-results/smoke-dist-${process.pid}`, { recursive: true, force: true }); }
console.log(failed ? `${failed} level(s) failed` : 'all levels OK');
process.exit(failed ? 1 : 0);
