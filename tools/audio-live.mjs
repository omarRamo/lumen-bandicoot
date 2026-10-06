// Live smoke test of the real engine (real AudioContext in headless Chromium): unlock, every track,
// mods, a burst of every SFX, pause/resume, dispose. Fails on any page error. Usage: node tools/audio-live.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { port: 5980 + Math.floor(Math.random() * 9), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
await page.goto(`${server.resolvedUrls.local[0]}tools/audio-lab.html`, { waitUntil: 'load' });
await page.mouse.click(10, 10); // user gesture → unlock
const wait = (ms) => page.waitForTimeout(ms);
const ev = (name, payload) => page.evaluate(([n, p]) => window.__audio.bus.emit(n, p), [name, payload]);
const state = () => page.evaluate(() => window.__audio.audio.state);
await ev('music', { track: 'title' });
await wait(300);
console.log('after unlock', await state());
const tracks = await page.evaluate(async () => (await import('/src/audio/audio.js')).TRACK_NAMES);
const sfx = await page.evaluate(async () => (await import('/src/audio/audio.js')).SFX_NAMES);
for (const t of tracks) { await ev('music', { track: t }); await wait(250); }
await ev('music', { track: 'jungle' });
await ev('music:mod', { invincible: true }); await wait(800);
await ev('music:mod', { boss: true, danger: true }); await wait(800);
await ev('music:mod', { rate: 0 }); await wait(400);
await ev('music:mod', { rate: 1 }); await wait(200);
for (const n of sfx) { await ev('sfx', { name: n, vol: 0.8 }); await wait(15); }
for (let i = 0; i < 12; i++) { await ev('sfx', { name: 'light' }); await wait(60); }
const s1 = await state();
console.log('after burst', s1);
await wait(3000);
const s2 = await state();
console.log('after 3s', s2);
await page.evaluate(() => window.__audio.audio.dispose());
await browser.close();
await server.close();
const bad = errors.filter((e) => !/favicon/.test(e));
if (bad.length) { console.log('ERRORS', bad.slice(0, 10)); process.exit(1); }
if (s2.voices > 4 || s2.fading > 1 || s2.track !== 'jungle') { console.log('unexpected state'); process.exit(1); }
console.log('live audio OK');
