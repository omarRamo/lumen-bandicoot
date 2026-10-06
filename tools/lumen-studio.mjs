// Dev tool (agent Personnage): node tools/lumen-studio.mjs [sheet ...] → test-results/lumen-<sheet>.png
// Sheets: model, moves, idle, deaths1, deaths2, oku, mounts. Renders Lumen outside of the game loop.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const sheets = process.argv.slice(2).length ? process.argv.slice(2) : ['model', 'moves', 'idle', 'deaths1', 'deaths2', 'oku', 'mounts'];
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text()); });
// a blank page (independent of the game's boot): the studio module only imports src/art/lumen*.js
await page.route(`${base}__lumen_studio`, (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body style="margin:0;background:#222"><script type="module" src="/tools/lumen-studio-page.mjs"></script></body></html>' }));
await page.goto(`${base}__lumen_studio`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__studio, null, { timeout: 30000 });
for (const s of sheets) {
  const t0 = Date.now();
  const size = await page.evaluate((n) => window.__studio.render(n), s);
  await page.setViewportSize({ width: size.w, height: size.h });
  await page.locator('#studio').screenshot({ path: `test-results/lumen-${s}.png` });
  console.log(`✓ ${s} ${size.w}x${size.h} (${Date.now() - t0} ms)`);
}
await browser.close();
await server.close();
