// Dev tool (agent Ennemis): gameplay checks driven through window.__LB (?debug).
// node tools/enemies-check.mjs [scenario …]   scenarios: stomp spin hurt cat platforms hazards boulder (default: all)
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const only = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
mkdirSync('test-results', { recursive: true });

// warm-up: the first visit may trigger Vite's dependency optimisation + a full reload
await page.goto(`${base}?debug`);
await page.waitForTimeout(2500);

let fails = 0;
const ok = (cond, msg, extra = '') => { console.log(`  ${cond ? '✓' : '✗'} ${msg} ${extra}`); if (!cond) fails++; };
async function load(id) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${base}?debug&level=${id}`);
      await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 20000 });
      break;
    } catch (e) { if (i === 2) throw e; }
  }
  await page.waitForFunction(() => window.__LB?.level?.time > 1.0, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__deaths = [];
    window.__LB.bus.on('level:death', (d) => window.__deaths.push(d.cause));
    window.__find = (type, kind, n = 0) => window.__LB.level.entities.filter((e) => e.def?.type === type && e.def?.kind === kind)[n];
    window.__put = (x, y, z) => { const p = window.__LB.player; p.pos.set(x, y, z); p.vel.set(0, 0, 0); p.syncBox(); p.coyoteT = 0; p.grounded = false; window.__maxVy = -99; };
    // exact per-step recorder of the player's vertical speed
    const L = window.__LB.level, orig = L.update.bind(L);
    window.__maxVy = -99;
    L.update = (dt) => { orig(dt); window.__maxVy = Math.max(window.__maxVy, L.player.vel.y); };
  });
}
const ev = (fn, arg) => page.evaluate(fn, arg);
// waits in GAME time (the headless renderer can be much slower than real time)
async function wait(ms) {
  const t0 = await ev(() => window.__LB?.level?.time ?? 0);
  await page.waitForFunction((t) => (window.__LB?.level?.time ?? 1e9) >= t, t0 + ms / 1000, { timeout: 120000, polling: 16 });
}
const run = (name) => !only.length || only.includes(name);

// ------------------------------------------------------------------ stomp
if (run('stomp')) {
  console.log('stomp (T-enemies-1)');
  await load('T-enemies-1');
  await ev(() => { const c = window.__find('enemy', 'crab'); c.patrol = null; window.__crab = c; window.__put(c.pos.x, c.pos.y + 1.6, c.pos.z); window.__LB.player.vel.y = -4; });
  await wait(450);
  const maxVy = await ev(() => window.__maxVy);
  const r = await ev(() => ({ st: window.__crab.state, dead: window.__crab.dead, gone: window.__LB.level.goneNow.has(window.__crab.id), pdead: window.__LB.player.dead }));
  ok(r.st === 'squash', 'crab squashed by a stomp', JSON.stringify(r));
  ok(maxVy > 6, 'player bounced off the crab', `maxVy=${maxVy.toFixed(1)}`);
  ok(r.gone, 'crab marked gone (checkpoint logic)');
  ok(!r.pdead, 'player alive after stomp');
  await wait(1200);
  ok(await ev(() => !window.__LB.level.entities.includes(window.__crab)), 'squashed crab removed from the level');
  // turtle: stomp flips it, second stomp = trampoline
  await ev(() => { const t = window.__find('enemy', 'turtle'); t.patrol = null; window.__t = t; window.__put(t.pos.x, t.pos.y + 1.6, t.pos.z); window.__LB.player.vel.y = -4; });
  await wait(500);
  ok(await ev(() => window.__t.st === 'flipped' && window.__t.state === 'live'), 'turtle flipped (still alive)');
  await ev(() => { const t = window.__t; window.__put(t.pos.x, t.pos.y + 1.6, t.pos.z); window.__LB.player.vel.y = -4; });
  await wait(450);
  const vy2 = await ev(() => window.__maxVy);
  ok(vy2 > 12, 'flipped turtle = trampoline (big bounce)', `vy=${vy2.toFixed(1)}`);
  // porcupine: spiked → stomping hurts
  await ev(() => { const p = window.__find('enemy', 'porcupine'); window.__pc = p; p.st = 'spiked'; p.stT = 0; window.__LB.game.masks = 1; window.__put(p.pos.x, p.pos.y + 1.6, p.pos.z); window.__LB.player.vel.y = -4; });
  await wait(400);
  const pc = await ev(() => ({ masks: window.__LB.game.masks, st: window.__pc.state }));
  ok(pc.masks === 0 && pc.st === 'live', 'spiked porcupine hurts the stomper', JSON.stringify(pc));
}

// ------------------------------------------------------------------ spin → kicked towards the camera
if (run('spin')) {
  console.log('spin kick (T-enemies-1)');
  await load('T-enemies-1');
  // screenshots: enemy flying to the lens, then splatted on it
  await ev(() => { const c = window.__find('enemy', 'cactus'); c.st = 'idle'; window.__put(c.pos.x, c.pos.y, c.pos.z + 1.1); });
  await wait(100);
  await page.keyboard.press('KeyJ');
  await wait(250);
  await page.screenshot({ path: 'test-results/enemies-kick-fly.png' });
  await wait(450);
  await page.screenshot({ path: 'test-results/enemies-kick-splat.png' });
  await ev(() => { const s = window.__find('enemy', 'scorpion'); s.patrol = null; s.cd = 99; window.__s = s; window.__put(s.pos.x, s.pos.y, s.pos.z + 1.2); });
  await wait(150);
  await page.keyboard.press('KeyJ');
  let minCam = 99, sawKick = false, maxScale = 0;
  for (let i = 0; i < 40; i++) {
    await wait(50);
    const r = await ev(() => {
      const s = window.__s, cam = window.__LB.rig.camera;
      return { st: s.state, d: s.body.position.distanceTo(cam.position), sc: s.body.scale.x, dead: s.dead };
    });
    if (r.st === 'kick') { sawKick = true; minCam = Math.min(minCam, r.d); maxScale = Math.max(maxScale, r.sc); }
    if (r.dead) break;
  }
  ok(sawKick, 'spin kicks the scorpion');
  ok(minCam < 2.6, 'kicked enemy flies right in front of the camera lens', `min dist=${minCam.toFixed(2)}`);
  ok(maxScale > 1.0, 'kicked enemy grows on screen', `scale=${maxScale.toFixed(2)}`);
  await wait(300);
  ok(await ev(() => window.__s.dead && window.__LB.level.goneNow.has(window.__s.id)), 'kicked enemy dead + marked gone');
  // porcupine spiked: the spin bounces off without killing it nor hurting Lumen
  await ev(() => { const p = window.__find('enemy', 'porcupine'); window.__pc = p; p.patrol = null; window.__LB.game.masks = 1; window.__put(p.pos.x, p.pos.y, p.pos.z + 1.3); p.st = 'spiked'; p.stT = -5; });
  await page.keyboard.press('KeyJ');
  await wait(250);
  const pr = await ev(() => ({ st: window.__pc.state, masks: window.__LB.game.masks }));
  ok(pr.st === 'live' && pr.masks === 1, 'spin on a spiked porcupine bounces off (TOING), no damage', JSON.stringify(pr));
}

// ------------------------------------------------------------------ hurt
if (run('hurt')) {
  console.log('hurt (T-enemies-1)');
  await load('T-enemies-1');
  await ev(() => { const c = window.__find('enemy', 'crab'); c.patrol = null; window.__crab = c; window.__LB.game.masks = 1; window.__put(c.pos.x + 0.5, c.pos.y, c.pos.z); });
  await wait(200);
  const r = await ev(() => ({ masks: window.__LB.game.masks, dead: window.__LB.player.dead, hurtT: window.__LB.player.hurtT, crab: window.__crab.state }));
  ok(r.masks === 0 && !r.dead && r.hurtT > 0, 'walking into a crab costs a mask', JSON.stringify(r));
  ok(r.crab === 'live', 'crab survives a side touch');
  await ev(() => window.__put(window.__crab.pos.x + 6, window.__crab.pos.y, window.__crab.pos.z));
  await wait(1800);
  await ev(() => { const c = window.__crab; window.__put(c.pos.x + 0.5, c.pos.y, c.pos.z); });
  await wait(300);
  const d = await ev(() => ({ dead: window.__LB.player.dead, deaths: window.__deaths }));
  ok(d.dead || d.deaths.length > 0, 'without mask, touching the crab kills', JSON.stringify(d));
  await wait(2600);
  const rs = await ev(() => ({ st: window.__crab.state, x: window.__crab.pos.x, hx: window.__crab.home.x }));
  ok(rs.st === 'live' && Math.abs(rs.x - rs.hx) < 0.01, 'enemies reset on respawn', JSON.stringify(rs));
  // plant: telegraph then bite
  await ev(() => { const p = window.__find('enemy', 'plant'); window.__pl = p; window.__LB.game.masks = 2; window.__put(p.pos.x, p.pos.y, p.pos.z + 2.1); });
  const seen = new Set();
  for (let i = 0; i < 20; i++) { await wait(50); seen.add(await ev(() => window.__pl.st)); }
  ok(seen.has('windup') && seen.has('bite'), 'plant telegraphs (windup) then bites', [...seen].join(','));
  ok(await ev(() => window.__LB.game.masks < 2), 'plant bite reaches a player standing 2.1 m away');
}

// ------------------------------------------------------------------ cat
if (run('cat')) {
  console.log('cat (T-enemies-1)');
  await load('T-enemies-1');
  await ev(() => { window.__LB.game.lights = 20; const c = window.__find('enemy', 'cat'); window.__cat = c; window.__put(c.pos.x, c.pos.y, c.pos.z + 2); });
  await wait(300);
  const a = await ev(() => ({ lights: window.__LB.game.lights, st: window.__cat.st, loot: window.__cat.loot }));
  ok(a.lights === 15 && a.st === 'flee' && a.loot === 5, 'cat steals 5 fireflies and flees', JSON.stringify(a));
  await ev(() => { const c = window.__cat; window.__put(c.pos.x, c.pos.y, c.pos.z + 0.8); });
  await page.keyboard.press('KeyJ');
  await wait(200);
  const b = await ev(() => ({ lights: window.__LB.game.lights, state: window.__cat.state, dead: window.__LB.player.dead }));
  ok(b.lights === 20 && !b.dead, 'spinning the cat gives them back (and it is harmless)', JSON.stringify(b));
}

// ------------------------------------------------------------------ platforms
if (run('platforms')) {
  console.log('platforms (T-enemies-7)');
  await load('T-enemies-7');
  // moving
  await ev(() => { const m = window.__find('platform', 'moving'); window.__m = m; const b = m.box; window.__put((b.min.x + b.max.x) / 2, b.max.y + 0.02, (b.min.z + b.max.z) / 2); });
  await wait(100);
  const m0 = await ev(() => ({ p: window.__LB.player.pos.z, b: (window.__m.box.min.z + window.__m.box.max.z) / 2 }));
  let maxD = 0;
  for (let i = 0; i < 10; i++) { await wait(250); maxD = Math.max(maxD, await ev((z0) => Math.abs((window.__m.box.min.z + window.__m.box.max.z) / 2 - z0), m0.b)); }
  const m1 = await ev(() => ({ p: window.__LB.player.pos.z, b: (window.__m.box.min.z + window.__m.box.max.z) / 2, on: window.__LB.player.groundSolid?.__owner === window.__m, y: window.__LB.player.pos.y }));
  ok(maxD > 1, 'moving platform moves', `max Δ=${maxD.toFixed(2)}`);
  ok(m1.on && Math.abs((m1.p - m0.p) - (m1.b - m0.b)) < 0.15, 'player carried by the moving platform', `player Δ=${(m1.p - m0.p).toFixed(2)} platform Δ=${(m1.b - m0.b).toFixed(2)}`);
  // falling
  await ev(() => { const f = window.__find('platform', 'falling'); window.__f = f; const b = f.box; window.__put((b.min.x + b.max.x) / 2, b.max.y + 0.02, (b.min.z + b.max.z) / 2); window.__fy = b.max.y; });
  await wait(300);
  const f1 = await ev(() => window.__f.box.max.y);
  await wait(900);
  const f2 = await ev(() => ({ y: window.__f.box.max.y, py: window.__LB.player.pos.y }));
  ok(Math.abs(f1 - (await ev(() => window.__fy))) < 0.01 && f2.y < f1 - 0.5, 'falling platform waits then drops', `${f1.toFixed(2)} → ${f2.y.toFixed(2)}`);
  await wait(2500);
  // sinking
  await load('T-enemies-7');
  await ev(() => { const s = window.__find('platform', 'sinking'); window.__s = s; const b = s.box; window.__s0 = b.max.y; window.__put((b.min.x + b.max.x) / 2, b.max.y + 0.02, (b.min.z + b.max.z) / 2); });
  await wait(500);
  const s1 = await ev(() => ({ y: window.__s.box.max.y, y0: window.__s0 }));
  ok(s1.y < s1.y0 - 0.1, 'lily pad sinks under Lumen', `${s1.y0.toFixed(2)} → ${s1.y.toFixed(2)}`);
  await wait(1500);
  ok(await ev(() => window.__deaths.includes('water')), 'staying on the lily pad = drowned (water)', await ev(() => JSON.stringify(window.__deaths)));
  await wait(2500);
  // bouncy
  await ev(() => { const b = window.__find('platform', 'bouncy').box; window.__put((b.min.x + b.max.x) / 2, b.max.y + 1.2, (b.min.z + b.max.z) / 2); });
  await wait(500);
  const vy = await ev(() => window.__maxVy);
  ok(vy > 15, 'bouncy platform launches high', `vy=${vy.toFixed(1)}`);
  await wait(1500);
  // rotating
  await ev(() => {
    const r = window.__find('platform', 'rotating'); window.__r = r; const b = r.box;
    window.__rc = [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2];
    window.__put(window.__rc[0] + 1.2, b.max.y + 0.02, window.__rc[1]);
  });
  await wait(150);
  const a0 = await ev(() => { const p = window.__LB.player.pos; return { a: Math.atan2(p.x - window.__rc[0], p.z - window.__rc[1]), r: Math.hypot(p.x - window.__rc[0], p.z - window.__rc[1]), t: window.__LB.level.time }; });
  await wait(1000);
  const a1 = await ev(() => { const p = window.__LB.player.pos; return { a: Math.atan2(p.x - window.__rc[0], p.z - window.__rc[1]), r: Math.hypot(p.x - window.__rc[0], p.z - window.__rc[1]), t: window.__LB.level.time, on: window.__LB.player.groundSolid?.__owner === window.__r }; });
  let da = a1.a - a0.a; da = Math.atan2(Math.sin(da), Math.cos(da));
  const expect = 1.2 * (a1.t - a0.t);
  ok(a1.on && Math.abs(da - expect) < 0.25 && Math.abs(a1.r - a0.r) < 0.2, 'rotating disc carries Lumen around its centre', `Δangle=${da.toFixed(2)} expected≈${expect.toFixed(2)} r ${a0.r.toFixed(2)}→${a1.r.toFixed(2)}`);
  // vanishing
  const states = new Set();
  for (let i = 0; i < 30; i++) { await wait(100); states.add(await ev(() => window.__find('platform', 'vanishing').intangible)); }
  ok(states.has(true) && states.has(false), 'vanishing platform toggles intangible');
}

// ------------------------------------------------------------------ hazards
if (run('hazards')) {
  console.log('hazards (T-enemies-2)');
  await load('T-enemies-2');
  // wind pushes along +x
  await ev(() => { const w = window.__find('hazard', 'wind'); const b = w.box; window.__put((b.min.x + b.max.x) / 2 - 2, b.min.y + 0.05, (b.min.z + b.max.z) / 2); window.__wx = window.__LB.player.pos.x; });
  await wait(500);
  const dx = await ev(() => window.__LB.player.pos.x - window.__wx);
  ok(dx > 0.8, 'wind zone pushes Lumen', `Δx=${dx.toFixed(2)}`);
  // crusher squashes
  await ev(() => { const c = window.__find('hazard', 'crusher'); window.__put(c.box.min.x + 1, c.def.y + 0.02, c.box.min.z + 1); window.__LB.game.masks = 0; });
  await wait(3800);
  ok(await ev(() => window.__deaths.includes('squash')), 'crusher squashes Lumen standing under it', await ev(() => JSON.stringify(window.__deaths)));
  await wait(2500);
  // water
  await ev(() => { const w = window.__find('hazard', 'water'); window.__put(w.def.x, w.def.y + 1, w.def.z); });
  await wait(900);
  ok(await ev(() => window.__deaths.includes('water')), 'falling into water = death "water"');
  await wait(2500);
  // laser always on (h 1.0): standing hurts, sliding passes under
  await ev(() => { const l = window.__find('hazard', 'laser', 1); window.__LB.game.masks = 1; window.__put(l.def.x, l.def.y + 0.02, l.def.z); });
  await wait(150);
  ok(await ev(() => window.__LB.game.masks === 0), 'standing in a laser = zap');
  // barrels launch and roll towards the start
  await ev(() => { const b = window.__find('hazard', 'barrels'); window.__put(b.def.x + 3, b.def.y + 0.02, b.def.z + 8); window.__LB.player.frozen = true; });
  await wait(3000);
  ok(await ev(() => window.__LB.level.entities.find((e) => e.def?.kind === 'barrels').object3d.children.some((c) => c.visible && c.userData.roll)), 'barrels are launched');
}

// ------------------------------------------------------------------ boulder chase
if (run('boulder')) {
  for (const id of ['T-enemies-3', 'T-enemies-6']) {
    console.log(`boulder chase (${id})`);
    await load(id);
    const snap = () => ev(() => { const b = window.__find('hazard', 'boulder'); const p = window.__LB.player; return { bz: b.pos.z, by: b.pos.y, sp: b.speed, pz: p.pos.z, t: window.__LB.level.time, dead: p.dead }; });
    const s0 = await snap();
    ok(Math.abs(s0.bz - s0.pz - 10) < 1, 'boulder starts 10 m behind Lumen', `gap=${(s0.bz - s0.pz).toFixed(1)}`);
    await page.keyboard.down('ArrowDown');
    await wait(1500);
    const s1 = await snap();
    await wait(2000);
    const s2 = await snap();
    await page.screenshot({ path: `test-results/enemies-chase-${id}.png` });
    const bsp = (s1.bz - s2.bz) / (s2.t - s1.t), psp = (s1.pz - s2.pz) / (s2.t - s1.t);
    ok(bsp > 5.5 && bsp < 7.5, 'boulder rolls a bit slower than Lumen runs', `boulder ${bsp.toFixed(2)} m/s vs Lumen ${psp.toFixed(2)} m/s`);
    ok(!s2.dead, 'running away keeps Lumen alive');
    await page.keyboard.up('ArrowDown');
    let caught = false;
    for (let i = 0; i < 20 && !caught; i++) { await wait(250); caught = (await ev(() => window.__deaths)).includes('squash'); }
    ok(caught, 'stopping = squashed by the boulder');
    await wait(3500);
    const s3 = await ev(() => { const b = window.__find('hazard', 'boulder'); const cp = window.__LB.level.checkpoint; return { gap: b.pos.z - cp[2], dead: window.__LB.player.dead }; });
    ok(!s3.dead && Math.abs(s3.gap - 10) < 1.5, 'after respawn the boulder is ~10 m behind the checkpoint', `gap=${s3.gap.toFixed(1)}`);
    // far ahead → it accelerates
    await ev(() => { const p = window.__LB.player; window.__put(p.pos.x, p.pos.y + 0.1, p.pos.z - 30); p.frozen = true; });
    await wait(2500);
    const s4 = await snap();
    ok(s4.sp > 8, 'boulder accelerates when Lumen is far ahead', `speed=${s4.sp.toFixed(2)}`);
    await ev(() => { window.__LB.player.frozen = false; window.__LB.completeLevel(); });
    await wait(1600);
    const s5 = await snap();
    ok(s5.sp < 0.5, 'boulder stops when the level is finished', `speed=${s5.sp.toFixed(2)}`);
  }
}

const bad = errors.filter((e) => !/favicon|GL_|WebGL|GPU stall/.test(e));
ok(bad.length === 0, 'no console errors', bad.slice(0, 3).join(' | '));
await browser.close(); await server.close();
console.log(fails ? `${fails} check(s) failed` : 'all checks OK');
process.exit(fails ? 1 : 0);
