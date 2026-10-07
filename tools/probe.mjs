// Dev tool: node tools/probe.mjs <levelId> "<js steps>" — runs the production build, executes an async script with
// helpers { LB, wait(gameSeconds), key(code, ms), shot(name) } inside Node, prints what it returns.
import { build, preview } from 'vite';
import { chromium } from 'playwright';
const [id, script] = process.argv.slice(2);
const outDir = `test-results/probe-dist-${process.pid}`;
await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } });
const server = await preview({ preview: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1' }, build: { outDir }, logLevel: 'error' });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${server.resolvedUrls.local[0]}?debug&level=${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 90000 });
const wait = (s) => page.evaluate((s) => new Promise((r) => { const t0 = window.__LB.level.time; const f = () => (window.__LB.level.time - t0 >= s ? r() : requestAnimationFrame(f)); f(); }), s);
const key = async (code, ms = 100) => { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); };
const shot = (name) => page.screenshot({ path: `test-results/probe-${name}.png` });
const LB = (fn, arg) => page.evaluate(fn, arg);
const fn = new Function('h', `return (async ({ LB, wait, key, shot, page }) => { ${script} })(h);`);
try { console.log(JSON.stringify(await fn({ LB, wait, key, shot, page }), null, 1)); } catch (e) { console.log('ERR', e.message); }
await browser.close();
server.httpServer.close();
const { rmSync } = await import('node:fs'); rmSync(outDir, { recursive: true, force: true });
