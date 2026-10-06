// UI visual tour: node tools/ui-tour.mjs [desktop|mobile|all] [harness|flow|both]
// Boots Vite + Chromium (swiftshader), walks every UI screen through tools/ui-harness.html and the real game
// flow (title → intro → map → 1-1 → pause → results → map), saves screenshots in test-results/ui/.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const which = process.argv[2] || 'all';
const part = process.argv[3] || 'both';
const OUT = 'test-results/ui';
mkdirSync(OUT, { recursive: true });

const server = await createServer({
  // hmr off: other agents edit files while the tour runs, and a hot reload would restart the page
  server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false }, logLevel: 'error',
  // pre-bundle every dep up front: a late discovery makes vite reload the page in the middle of the tour
  optimizeDeps: { entries: ['index.html', 'tools/ui-harness.html'], include: ['three', 'three/examples/jsm/geometries/RoundedBoxGeometry.js', 'three/examples/jsm/utils/BufferGeometryUtils.js'] },
});
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const PROFILES = {
  desktop: { viewport: { width: 1280, height: 720 } },
  mobile: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
process.on('unhandledRejection', (e) => { console.log('✗ unhandled:', e?.message?.split('\n')[0]); });
let failures = 0;
let step = '';

async function newPage(profile, prefix) {
  const ctx = await browser.newContext({ ...PROFILES[profile], locale: 'fr-FR' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  const shot = async (name) => { step = name; await page.screenshot({ path: `${OUT}/${prefix}-${name}.png` }); console.log(`  📸 ${prefix}-${name}`); };
  return { ctx, page, errors, shot };
}
function report(label, errors) {
  const bad = errors.filter((e) => !/favicon|GL_|WebGL|GPU stall|fonts\.g|ERR_|net::/.test(e));
  if (bad.length) { failures++; console.log(`✗ ${label}`); bad.slice(0, 8).forEach((e) => console.log('   ', e)); }
  else console.log(`✓ ${label}`);
}

const PROGRESS = {
  '1-1': { done: true, crates: true, socks: ['red'], deaths: 3, bestTime: 28.4, spoon: 'gold' },
  '1-2': { done: true, socks: [], deaths: 12, bestTime: 61.2, spoon: 'bronze' },
  '1-3': { done: true, crates: true, deaths: 1 },
};

async function harness(profile) {
  const P = profile[0];
  const { ctx, page, errors, shot } = await newPage(profile, `${P}-h`);
  await page.addInitScript((prog) => {
    localStorage.setItem('lumen-bandicoot-save-v1', JSON.stringify({ v: 1, lang: 'fr', levels: prog, lives: 7, lights: 42, powers: [], seenStories: ['intro'], settings: {} }));
  }, PROGRESS);
  await page.goto(`${base}tools/ui-harness.html`, { waitUntil: 'networkidle' });
  await sleep(1500); // vite may re-optimize deps and reload once
  await page.waitForFunction(() => window.H?.ready);
  await sleep(400);

  // title
  page.evaluate(() => { window.__t = window.H.ui.title(); });
  await sleep(1500); await shot('title');
  await page.keyboard.press('Space'); await sleep(500);

  // stories (first panel + one with typing finished)
  const stories = await page.evaluate(async () => (await import('/src/ui/story-data.js')).STORY_IDS);
  for (const id of stories) {
    const n = await page.evaluate(async (sid) => (await import('/src/ui/story-data.js')).STORIES[sid].length, id);
    page.evaluate((sid) => { window.__s = window.H.ui.story(sid); }, id);
    await page.waitForSelector('.lb-story');
    for (let i = 0; i < n; i++) {
      await sleep(350);
      await page.keyboard.press('Space');
      await page.waitForSelector('.lb-story-box.is-done', { timeout: 10000 });
      await sleep(150);
      if (id === 'intro' || profile === 'desktop' || i === 0 || i === n - 1) await shot(`story-${id}-${i}`);
      await page.keyboard.press('Space');
      await page.waitForFunction((k) => !document.querySelector('.lb-story') || document.querySelectorAll('.lb-story-dots i.on').length > k + 1 || document.querySelector('.lb-story.lb-out'), i, { timeout: 10000 });
    }
    await page.waitForSelector('.lb-story', { state: 'detached' });
  }

  // map
  const key = async (k, ms = 260) => { await page.keyboard.press(k); await sleep(ms); };
  page.evaluate(() => { window.__m = window.H.ui.map({ save: window.H.save, game: window.H.game }).then((r) => { window.__pick = r; }); });
  await sleep(1500); await shot('map');
  await key('ArrowLeft', 350); await shot('map-walk');
  await sleep(700);
  await key('Enter', 400); await shot('map-card');
  await key('Backspace');
  await key('Escape', 600); await page.waitForSelector('.lb-options'); await shot('options');
  await key('ArrowDown'); await key('ArrowDown'); await key('ArrowDown'); await key('ArrowRight', 400);
  await shot('options-lang-en');
  await key('ArrowLeft'); await key('ArrowDown'); await key('ArrowDown'); await key('Enter', 600);
  await page.waitForSelector('.lb-controls'); await shot('controls');
  await key('Escape', 400); await key('ArrowDown'); await key('Enter', 600);
  await page.waitForSelector('.lb-confirm'); await shot('reset-confirm');
  await key('Escape', 400); await key('Escape', 600);
  await page.waitForSelector('.lb-options', { state: 'detached' });
  const reopen = async () => { await key('Escape', 500); await page.waitForSelector('.lb-options'); await key('Escape', 600); await page.waitForSelector('.lb-options', { state: 'detached' }); };
  await page.evaluate(() => { const L = window.H.save.levels; window.H.ORDER.slice(0, 9).forEach((id, i) => { L[id] = { done: true, crates: i % 2 === 0, socks: i % 3 ? [] : ['blue'], spoon: ['gold', 'silver', 'bronze', null][i % 4] }; }); });
  await reopen();
  await page.click('.lb-tab:nth-child(2)'); await sleep(1200); await shot('map-island2');
  await page.evaluate(() => { for (const id of window.H.ORDER) window.H.save.levels[id] = { done: true, crates: true }; });
  await reopen();
  await page.click('.lb-tab:nth-child(3)'); await sleep(1200); await shot('map-island3');
  await page.click('.lb-tab:nth-child(4)'); await sleep(1200); await shot('map-island4');
  await page.click('.lb-tab:nth-child(5)'); await sleep(1200); await shot('map-secret');
  // keyboard: walk back to island 4 across the border
  await key('ArrowLeft', 900); await shot('map-cross');
  // mouse: back to 1-1 and play it
  await page.click('.lb-tab:nth-child(1)'); await sleep(500);
  await page.click('.lb-node:nth-child(1)'); await sleep(900);
  await page.click('.lb-card-btns .lb-btn-primary'); await sleep(600);
  const pick = await page.evaluate(() => window.__pick);
  console.log('  map pick →', JSON.stringify(pick));
  if (!pick || pick.levelId !== '1-1') { failures++; console.log('✗ map did not return 1-1'); }

  // HUD
  await page.evaluate(() => {
    const { ui, bus, LEVELS, game } = window.H;
    game.timeTrial = true;
    ui.touch.setVisible(document.documentElement.matches(':root') && ('ontouchstart' in window));
    bus.emit('toast', { text: { fr: 'Ceci n\'est pas Crash Bandicoot.', en: 'This is not Crash Bandicoot.' }, kind: 'big', duration: 6 });
    ui.hud.show(LEVELS['1-1']);
    bus.emit('hud:lights', { value: 42 }); bus.emit('hud:lives', { value: 7 }); bus.emit('hud:masks', { value: 2 });
    bus.emit('hud:crates', { broken: 5, total: 24 });
    bus.emit('hud:timer', { t: 23.47, frozen: false });
    bus.emit('toast', { text: { fr: 'Attention : caisse TNT. Elle mord.', en: 'Careful: TNT crate. It bites.' }, kind: 'warn', duration: 6 });
    bus.emit('toast', { text: { fr: 'Panneau : « Ceci n\'est pas Crash. Nos avocats insistent. »', en: 'Sign' }, kind: 'joke', duration: 6 });
    bus.emit('dialog', { speaker: 'oku', text: { fr: 'Astuce : saute. Non, plus haut. Non, pas comme ça.', en: 'Tip: jump.' } });
  });
  await sleep(900); await shot('hud');
  await page.evaluate(() => {
    const { bus } = window.H;
    bus.emit('hud:boss', { name: { fr: 'Papa Crabe Royal', en: 'Royal Papa Crab' }, hp: 2, maxHp: 3 });
    bus.emit('hud:timer', { t: 41.02, frozen: true });
    bus.emit('hud:masks', { value: 3 });
    bus.emit('level:checkpoint', {});
    bus.emit('dialog', { speaker: 'cortisol', text: { fr: 'Tu ne passeras pas ! Enfin, si, mais lentement.', en: '…' } });
  });
  await sleep(450); await shot('hud-boss-checkpoint');
  await sleep(5000); await shot('hud-idle');

  // pause
  page.evaluate(() => { window.__p = window.H.ui.pause().then((r) => { window.__pr = r; }); });
  await sleep(700); await shot('pause');
  await key('ArrowDown'); await key('Enter', 400);
  const pr = await page.evaluate(() => window.__pr);
  console.log('  pause →', pr);
  if (pr !== 'restart') { failures++; console.log('✗ pause did not return restart'); }
  await page.evaluate(() => { window.H.ui.hud.hide(); window.H.ui.touch.setVisible(false); });

  // results
  page.evaluate(() => { window.__r = window.H.ui.results({ id: '1-1', name: { fr: 'Plage du Débutant', en: 'Beginner Beach' }, crates: 24, cratesTotal: 24, allCrates: true, lights: 87, deaths: 12, socks: ['red', 'blue'], time: 27.31, timeTrial: true }, { goldSock: true, newSpoon: 'gold', firstClear: true }); });
  await sleep(900); await shot('results-counting');
  await sleep(3500); await shot('results');
  await page.keyboard.press('Enter'); await sleep(500);

  // game over
  page.evaluate(() => { window.__g = window.H.ui.gameOver().then((r) => { window.__gr = r; }); });
  await sleep(1200); await shot('gameover');
  await key('ArrowRight'); await key('Enter', 400);
  console.log('  gameOver →', await page.evaluate(() => window.__gr));

  // powers
  for (const p of ['doubleJump', 'tornado', 'superSlam', 'turbo']) {
    page.evaluate((pw) => { window.__pw = window.H.ui.powerUnlocked(pw); }, p);
    await sleep(900); await shot(`power-${p}`);
    await key('Enter', 400);
  }
  // loading
  await page.evaluate(() => window.H.ui.loading(true));
  await sleep(300); await shot('loading');
  await page.evaluate(() => window.H.ui.loading(false));

  // touch controls (mobile only): drag the stick with CDP multi-touch
  if (profile === 'mobile') {
    await page.evaluate(() => { window.H.ui.hud.show(window.H.LEVELS['1-1']); window.H.ui.touch.setVisible(true); });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 160, y: 280, id: 1 }] });
    await sleep(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 205, y: 240, id: 1 }] });
    await sleep(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 205, y: 240, id: 1 }, { x: 780, y: 330, id: 2 }] });
    await sleep(120);
    const v = await page.evaluate(() => ({ ...window.H.input.virtual }));
    console.log('  virtual (stick + jump held) →', JSON.stringify(v));
    if (!(v.x > 0.3 && v.y > 0.3 && v.jump)) { failures++; console.log('✗ touch stick/jump not reaching input.setVirtual'); }
    await shot('touch-active');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    const v2 = await page.evaluate(() => ({ ...window.H.input.virtual }));
    if (v2.x !== 0 || v2.jump) { failures++; console.log('✗ touch release did not reset', JSON.stringify(v2)); }
    await shot('touch-idle');
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(400); await shot('rotate');
  }
  report(`${profile} harness`, errors);
  await ctx.close();
}

async function flow(profile) {
  const P = profile[0];
  const { ctx, page, errors, shot } = await newPage(profile, `${P}-f`);
  const touch = profile === 'mobile';
  const tapSel = async (sel) => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  // warm-up: let vite discover/optimize every dependency (it reloads the page once when it does)
  await page.goto(`${base}?debug&level=1-1`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 }).catch(() => {});
  await sleep(2500);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}?debug`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForSelector('.lb-title', { timeout: 30000 });
  await sleep(1400); await shot('title');
  if (touch) await page.touchscreen.tap(400, 200); else await page.keyboard.press('Space');
  await page.waitForSelector('.lb-story', { timeout: 10000 });
  await sleep(1600); await shot('intro');
  if (touch) await tapSel('.lb-story-skip'); else await page.keyboard.press('Escape');
  await page.waitForSelector('.lb-map', { timeout: 10000 });
  await sleep(1400); await shot('map');
  if (touch) await tapSel('.lb-card-btns .lb-btn'); else await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 });
  await sleep(1300); await shot('level');
  if (!touch) { await page.keyboard.down('ArrowUp'); await sleep(900); await page.keyboard.press('KeyJ'); await sleep(500); await page.keyboard.up('ArrowUp'); }
  if (touch) await tapSel('.lb-tbtn-pause'); else await page.keyboard.press('Escape');
  try { await page.waitForSelector('.lb-pause', { timeout: 20000 }); }
  catch (e) {
    await shot('FAIL');
    console.log(await page.evaluate(() => JSON.stringify({ lvl: !!window.__LB.level, fin: window.__LB.level?.finished, t: window.__LB.level?.time, dead: window.__LB.player?.dead, fps: window.__LB.fps, url: location.href })));
    console.log(errors.slice(0, 5));
    throw e;
  }
  await sleep(700); await shot('pause');
  if (touch) await tapSel('.lb-pause .lb-btn-primary'); else await page.keyboard.press('Enter');
  await sleep(500);
  await page.evaluate(() => window.__LB.completeLevel());
  await page.waitForSelector('.lb-results', { timeout: 60000 });
  await sleep(3500); await shot('results');
  // first press skips the count-up if it is still running, second one continues
  for (let i = 0; i < 2 && await page.$('.lb-results:not(.lb-out)'); i++) {
    if (touch) await tapSel('.lb-results .lb-btn-primary'); else await page.keyboard.press('Enter');
    await sleep(900);
  }
  await page.waitForSelector('.lb-map', { timeout: 30000 });
  await sleep(1400); await shot('map-after');
  report(`${profile} flow`, errors);
  await ctx.close();
}

const profiles = which === 'all' ? ['desktop', 'mobile'] : [which];
for (const pr of profiles) {
  try { if (part !== 'flow') await harness(pr); } catch (err) { failures++; console.log(`✗ ${pr} harness crashed: ${err.message}`); }
  try { if (part !== 'harness') await flow(pr); } catch (err) { failures++; console.log(`✗ ${pr} flow crashed at step "${step}": ${err.message.split('\n')[0]}`); }
}
await browser.close();
await server.close();
console.log(failures ? `${failures} problem(s)` : 'UI tour OK');
process.exit(failures ? 1 : 0);
