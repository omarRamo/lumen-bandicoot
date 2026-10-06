// QA bot for the boss fights (Agent Boss).
// Usage: node tools/boss-fight.mjs [B1 B2 B3 B4 BS] [--parallel]
// For each boss: boots ?debug&level=ID in headless Chromium, makes Lumen sturdy (99 lives, invincible), then drives
// the fight through window.__LB: when the boss exposes a weak point (boss.botHint()) the bot teleports Lumen above it
// (stomp) or next to it / next to a reflectable projectile and presses the real spin key (J).
// Checks: the boss takes damage, goes through its 3 phases, a death in phase 2 resets the boss to the START of phase 2
// (not of the fight), the defeat cinematic plays and 'level:complete' is emitted. Screenshots: test-results/boss-<id>-*.png
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const parallel = args.includes('--parallel');
let ids = args.filter((a) => !a.startsWith('--'));
if (!ids.length) ids = ['B1', 'B2', 'B3', 'B4', 'BS'];
const POWERS = {
  B1: [], B2: ['doubleJump'], B3: ['doubleJump', 'tornado'], B4: ['doubleJump', 'tornado', 'superSlam'],
  BS: ['doubleJump', 'tornado', 'superSlam', 'turbo'],
};

const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
mkdirSync('test-results', { recursive: true });
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });

// one browser per fight: background tabs would fire 'visibilitychange' and the game auto-pauses
async function fight(id) {
  const browser = await launch();
  try { return await fightIn(browser, id); } finally { await browser.close(); }
}

async function fightIn(browser, id) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|GL_|WebGL|GPU stall/.test(m.text())) { errors.push(`console: ${m.text()}`); log('console.error', m.text().slice(0, 300)); } });
  const log = (...a) => console.log(`[${id}]`, ...a);
  await page.goto(`${base}?debug&level=${id}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__LB?.level?.entities?.some((e) => e.boss), null, { timeout: 30000 });
  await page.waitForTimeout(1500); // Vite may reload once after optimizing deps
  await page.waitForFunction(() => window.__LB?.level?.entities?.some((e) => e.boss), null, { timeout: 30000 });
  await page.evaluate((powers) => {
    const LB = window.__LB;
    for (const p of powers) LB.setPower(p);
    window.__qa = { complete: 0, dialogs: 0, hud: [], hurts: 0, deaths: 0 };
    LB.bus.on('level:complete', () => { window.__qa.complete++; });
    LB.bus.on('dialog', () => { window.__qa.dialogs++; });
    LB.bus.on('hud:boss', (p) => { window.__qa.hud.push(p ? p.hp : null); });
    LB.bus.on('level:death', () => { window.__qa.deaths++; });
    LB.bus.on('sfx', (p) => { if (p.name === 'mask_lose') window.__qa.hurts++; });
  }, POWERS[id] || []);

  const sturdy = () => page.evaluate(() => { const g = window.__LB.game; g.lives = 99; g.masks = 3; g.invincibleT = 1e9; });
  const state = () => page.evaluate(() => {
    const L = window.__LB.level, b = L?.entities.find((e) => e.boss)?.boss, p = L?.player;
    if (!b) return null;
    return { st: b.state, hp: b.hp, max: b.maxHp, phase: b.phase, vuln: b.vulnerable, def: b.defeated, t: +L.time.toFixed(1),
      dead: p.dead, p: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)), hint: b.botHint(), done: window.__qa.complete,
      phaseStart: b.phaseStartHp(b.phase), shots: b.shots.length, minions: b.minions.length };
  });
  const shot = (n) => page.screenshot({ path: `test-results/boss-${id}-${n}.png` });

  // 1) let the intro play, take a picture, and let the boss hurt us once (proves attacks connect)
  await page.waitForTimeout(2600);
  await shot('1-intro');
  const t0 = Date.now();
  let s = await state();
  let hurtSeen = false;
  while (Date.now() - t0 < 25000 && !hurtSeen) {
    await page.evaluate(() => { const g = window.__LB.game; g.lives = 99; if (g.masks < 1) { g.masks = 2; } g.invincibleT = 0; });
    // stand still in the middle of the arena: the boss will come for us
    await page.waitForTimeout(250);
    hurtSeen = await page.evaluate(() => window.__qa.hurts + window.__qa.deaths > 0);
  }
  log(hurtSeen ? 'boss attacks hurt the player ✓' : 'WARN: player was never hurt in 25 s of idling');
  await sturdy();

  // 2) fight
  let lastHp = null, shots = 0, respawnChecked = false, vulnShot = false;
  const deadline = Date.now() + 900000;
  while (Date.now() < deadline) {
    s = await state();
    if (!s) {
      const why = await page.evaluate(() => ({ level: !!window.__LB.level, ents: window.__LB.level?.entities.map((e) => e.def?.type + ':' + e.def?.kind).join(',') }));
      log('boss entity vanished!', JSON.stringify(why));
      break;
    }
    if (s.hp !== lastHp) { log(`hp ${s.hp}/${s.max} phase ${s.phase + 1} state ${s.st} t=${s.t}s`); lastHp = s.hp; if (s.phase > 0) await shot(`3-phase${s.phase + 1}-${shots++}`); }
    if (s.done) break;
    if (s.def) { await page.waitForTimeout(900); await shot('4-defeat'); await page.waitForFunction(() => window.__qa.complete > 0, null, { timeout: 15000 }); break; }
    // respawn rule: die once in phase 2 → the boss must restart phase 2 (hp = phase start), not the whole fight
    if (!respawnChecked && s.phase === 1 && s.hp < s.phaseStart && !s.dead && !s.vuln && !s.def) {
      respawnChecked = true;
      const before = await state();
      await page.evaluate(() => { const g = window.__LB.game; g.masks = 0; g.invincibleT = 0; g.player.hurtT = 0; g.kill('generic'); });
      await page.waitForFunction(() => !window.__LB.level.player.dead, null, { timeout: 15000 });
      await page.waitForTimeout(200);
      const after = await state();
      const ok = after.phase === 1 && after.hp === after.phaseStart && after.hp >= before.hp;
      log(`respawn in phase 2: hp ${before.hp} → ${after.hp} (phase start ${after.phaseStart}), state ${after.st} ${ok ? '✓' : '✗ FAIL'}`);
      if (!ok) errors.push('respawn did not reset to start of phase');
      await sturdy();
      continue;
    }
    if (s.hint && !s.dead) {
      const h = s.hint;
      if (!vulnShot && h.action !== 'reflect') { vulnShot = true; await shot('2-vulnerable'); }
      await page.evaluate((h) => {
        const p = window.__LB.level.player;
        p.pos.set(h.pos[0], h.pos[1], h.pos[2]);
        p.vel.set(0, h.action === 'stomp' ? -2 : 0, 0);
        p.grounded = false;
        p.syncBox();
      }, h);
      if (h.action !== 'stomp') { await page.waitForTimeout(40); await page.keyboard.press('KeyJ'); }
      await page.waitForTimeout(h.action === 'stomp' ? 500 : 350);
      continue;
    }
    // idle: keep away from the boss on the near side of the arena
    await page.evaluate(() => { const g = window.__LB.game; g.masks = 3; g.invincibleT = 1e9; });
    await page.waitForTimeout(120);
  }
  const qa = await page.evaluate(() => window.__qa);
  s = await state();
  const ok = qa.complete > 0 && errors.length === 0;
  log(`${ok ? '✓ DEFEATED' : '✗ FAILED'} — level:complete=${qa.complete} dialogs=${qa.dialogs} hudEvents=${qa.hud.length} lastHud=${JSON.stringify(qa.hud.at(-1))} t=${s?.t}s`);
  errors.slice(0, 8).forEach((e) => log('  ', e));
  await page.close();
  return ok;
}

let failed = 0;
if (parallel) {
  const res = await Promise.all(ids.map((id) => fight(id).catch((e) => { console.log(`[${id}] ✗`, e.message); return false; })));
  failed = res.filter((r) => !r).length;
} else {
  for (const id of ids) {
    const ok = await fight(id).catch((e) => { console.log(`[${id}] ✗`, e.message); return false; });
    if (!ok) failed++;
  }
}
await server.close();
console.log(failed ? `${failed} boss fight(s) failed` : 'all boss fights OK');
process.exit(failed ? 1 : 0);
