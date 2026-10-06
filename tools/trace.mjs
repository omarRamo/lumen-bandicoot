// Dev tool: node tools/trace.mjs <levelId> [screenshot.png] — runs forward 2.4 s, prints player/camera trace.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => console.log('[c]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[err]', e.message));
await page.goto(`${base}?debug&level=${process.argv[2] || '1-1'}`);
await page.waitForFunction(() => window.__LB?.level?.player);
const snap = () => page.evaluate(() => { const p = window.__LB.player, c = window.__LB.rig.camera; return { t: +window.__LB.level.time.toFixed(2), p: [p.pos.x, p.pos.y, p.pos.z].map(v => +v.toFixed(2)), g: p.grounded, dead: p.dead, cam: [c.position.x, c.position.y, c.position.z].map(v => +v.toFixed(2)), solids: window.__LB.level.solids.length }; });
console.log(await snap());
await page.keyboard.down('ArrowUp');
for (let i = 0; i < 8; i++) { await page.waitForTimeout(300); console.log(await snap()); }
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: process.argv[3] || 'test-results/dbg.png' });
await browser.close(); await server.close();
