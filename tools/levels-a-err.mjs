import { createServer } from 'vite';
import { chromium } from 'playwright';
const ISOLATE = process.argv.includes('--isolate');
const isolate = {
  name: 'levels-a-isolate', enforce: 'pre',
  load(id) { if (ISOLATE && /src[\\/]levels[\\/](w3|w4|secret|bosses)\.js$/.test(id)) return 'export default [];'; },
};
const server = await createServer({ root: process.cwd(), plugins: [isolate], server: { hmr: false, port: 5900 + Math.floor(Math.random() * 90), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message)); page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
page.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0, 300)));
await page.goto(`${server.resolvedUrls.local[0]}?debug&level=${process.argv.slice(2).find((a) => !a.startsWith('--')) || '1-1'}`);
await page.waitForTimeout(6000);
await browser.close(); await server.close();
