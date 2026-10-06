// Crates & collectibles functional check (agent Caisses).
// Usage: node tools/crates-check.mjs [--shots]   → drives window.__LB (?debug) on T-crates-1 / T-crates-2 and asserts:
// land-break + bounce + counter + lights, spin break, ? crate (10 bounces), spring, TNT 3-2-1 + chain, nitro touch,
// nitro switch (harmless cascade), switch/outline, stack falling, checkpoint + respawn rules, legs crate, mystery,
// pickups (light magnet, sock, sign toast, goal), time crates (time trial). Screenshots in test-results/crates-*.png.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Other teams' files may be mid-edit: stub missing CSS imports so the game still boots.
const stubMissingCss = {
  name: 'stub-missing-css',
  resolveId(id, importer) {
    if (!id.endsWith('.css') || !importer) return null;
    const p = resolve(dirname(importer), id);
    return existsSync(p) ? null : '\0stub.css';
  },
  load(id) { return id === '\0stub.css' ? '' : null; },
};

// The crate sandbox levels need no enemies/hazards/bosses: stub those modules (other teams, possibly mid-edit)
// unless --full is given.
const FULL = process.argv.includes('--full');
const isolateOthers = {
  name: 'isolate-other-entities',
  enforce: 'pre',
  load(id) {
    if (FULL) return null;
    return /src\/game\/entities\/(enemies|hazards|bosses)\.js$/.test(id.split('?')[0]) ? '// stubbed by tools/crates-check.mjs\n' : null;
  },
};

const server = await createServer({ server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error', plugins: [stubMissingCss, isolateOthers] });
await server.listen();
const base = server.resolvedUrls.local[0];
mkdirSync('test-results', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

let pass = 0, fail = 0;
function check(name, ok, info = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? `  ${info}` : ''}`);
}
const wait = (ms) => page.waitForTimeout(ms);
const gwait = (ms) => page.evaluate((m) => window.__CT.sleep(m), ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

async function go(id, tt = false) {
  await page.goto(`${base}?debug&level=${id}${tt ? '&tt' : ''}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 });
  await wait(400);
  await ev(() => {
    const LB = window.__LB;
    const p = LB.player;
    window.__bounces = [];
    const orig = p.bounce.bind(p);
    p.bounce = (v) => { window.__bounces.push(v ?? 12.5); orig(v); };
    window.__toasts = [];
    LB.bus.on('toast', (t) => window.__toasts.push(t));
    window.__deaths = [];
    LB.bus.on('level:death', (d) => window.__deaths.push({ cause: d.cause, t: +LB.level.time.toFixed(2), pos: [LB.player.pos.x, LB.player.pos.y, LB.player.pos.z].map((v) => +v.toFixed(2)) }));
    window.__dialogs = [];
    LB.bus.on('dialog', (t) => window.__dialogs.push(t));
    window.__CT = {
      crates: (kind) => LB.level.entities.filter((e) => e.isCrate && (!kind || e.kind === kind)),
      byId: (id) => LB.level.entities.find((e) => e.id === id),
      // drop Lumen 2.2 m above an entity (crate top) with no speed
      dropOn(e, h = 1.4) { const P = LB.player; P.vel.set(0, 0, 0); P.pos.set(e.x ?? e.def.x, (e.box?.max.y ?? e.def.y + 1) + h, e.z ?? e.def.z); P.grounded = false; },
      put(x, y, z) { const P = LB.player; P.vel.set(0, 0, 0); P.pos.set(x, y, z); },
      // wait for GAME time (ms), not wall time: the headless renderer can be slow under load
      sleep(ms) {
        const L = LB.level, t0 = L.time;
        return new Promise((r) => { const tick = () => (LB.level !== L || L.time >= t0 + ms / 1000 ? r() : setTimeout(tick, 10)); tick(); });
      },
    };
  });
}

// ===================================================================== T-crates-1
await go('T-crates-1');
let s = await ev(() => {
  const L = window.__LB.level;
  return { total: L.stats.cratesTotal, crates: window.__CT.crates().length, kinds: [...new Set(window.__CT.crates().map((e) => e.kind))].sort() };
});
check('T-crates-1 loads, crates counted (no iron/time)', s.total > 30 && !s.kinds.includes('time1'), JSON.stringify(s));
await page.screenshot({ path: 'test-results/crates-start.png' });

// --- land on a basic crate: breaks, bounce, counter, lights fly in
s = await ev(() => {
  const e = window.__CT.crates('basic').sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || b.z - a.z)[0];
  window.__target = e; window.__l0 = window.__LB.game.lights;
  window.__CT.dropOn(e);
  return { id: e.id, x: e.x, z: e.z };
});
await gwait(700);
s = await ev(() => ({ dead: window.__target.dead, broken: window.__target.broken, bounces: window.__bounces.length, crates: window.__LB.level.stats.crates, vy: window.__LB.player.vel.y }));
check('jump on basic crate → breaks', s.broken && s.dead, JSON.stringify(s));
check('… Lumen bounces', s.bounces >= 1);
check('… crate counter = 1', s.crates === 1);
await gwait(1200);
s = await ev(() => window.__LB.game.lights - window.__l0);
check('… 5 lights fly into Lumen', s === 5, `+${s}`);

// --- spin a basic crate next to Lumen
s = await ev(() => {
  const L = window.__LB.level;
  const e = window.__CT.crates('basic').filter((c) => !c.broken && c.y < 0.1).sort((a, b) => b.z - a.z)[0];
  window.__target = e;
  window.__CT.put(e.x + 1.1, e.y, e.z);
  return { id: e.id, n: L.stats.crates };
});
await gwait(150);
await page.keyboard.press('KeyJ');
await gwait(400);
s = await ev(() => ({ broken: window.__target.broken, crates: window.__LB.level.stats.crates }));
check('spin breaks the crate(s) in reach', s.broken && s.crates >= 2, JSON.stringify(s));
await gwait(1500); // let the flying lights land

// --- "?" crate: 10 bounces then breaks
s = await ev(async () => {
  const e = window.__CT.crates('lights').find((c) => c.y < 0.1);
  window.__target = e;
  const l0 = window.__LB.game.lights;
  for (let i = 0; i < 10 && !e.broken; i++) {
    window.__CT.dropOn(e, 0.6);
    await window.__CT.sleep(260);
  }
  await window.__CT.sleep(1200);
  return { given: e.given, broken: e.broken, lights: window.__LB.game.lights - l0 };
});
check('"?" crate gives 1 light per bounce, breaks at 10', s.broken && s.given === 10 && s.lights === 10, JSON.stringify(s));

// --- spring crate
s = await ev(async () => {
  const e = window.__CT.crates('bounce')[0];
  window.__bounces.length = 0;
  window.__CT.dropOn(e, 0.6);
  await window.__CT.sleep(300);
  return { broken: e.broken, bounce: window.__bounces[0] };
});
check('spring crate: big bounce, does not break on land', !s.broken && s.bounce > 15, JSON.stringify(s));

// --- life & mask crates
s = await ev(async () => {
  const G = window.__LB.game;
  const lives = G.lives, masks = G.masks;
  window.__CT.dropOn(window.__CT.crates('life')[0], 0.6);
  await window.__CT.sleep(350);
  window.__CT.dropOn(window.__CT.crates('mask')[0], 0.6);
  await window.__CT.sleep(350);
  return { life: G.lives - lives, mask: G.masks - masks, dialogs: window.__dialogs.length };
});
check('life crate +1 life, mask crate +1 mask (+ Oku advice)', s.life === 1 && s.mask === 1 && s.dialogs >= 1, JSON.stringify(s));

// --- mystery
s = await ev(async () => {
  const e = window.__CT.crates('mystery')[0];
  window.__CT.dropOn(e, 0.6);
  await window.__CT.sleep(400);
  const P = window.__LB.player;
  return { broken: e.broken, out: e.lastMystery, p: [P.pos.x, P.pos.y, P.pos.z].map((v) => +v.toFixed(2)), dead: P.dead, e: [e.x, e.y, e.z], ground: P.groundSolid?.__owner?.kind };
});
check('mystery crate gives a surprise', s.broken && !!s.out, JSON.stringify(s));
await page.screenshot({ path: 'test-results/crates-mystery.png' });

// --- stack falls when the bottom crate breaks (spin the bottom)
s = await ev(async () => {
  const st = window.__CT.crates().filter((c) => Math.abs(c.x + 3) < 0.01 && Math.abs(c.d.z - window.__CT.crates('lights').find((l) => l.d.y > 1.5).d.z) < 0.01);
  st.sort((a, b) => a.y - b.y);
  const ys0 = st.map((c) => c.y);
  const bottom = st[0];
  window.__CT.put(bottom.x + 1.1, bottom.y, bottom.z);
  await window.__CT.sleep(100);
  bottom.onSpin(window.__LB.player, window.__LB.level.ctx);
  await window.__CT.sleep(900);
  return { ys0, ys1: st.map((c) => +c.y.toFixed(2)), broken: st.map((c) => c.broken) };
});
check('stack: upper crates fall onto the ground', s.broken[0] && Math.abs(s.ys1[1] - s.ys0[0]) < 0.02 && Math.abs(s.ys1[2] - s.ys0[1]) < 0.02, JSON.stringify(s));

// --- iron: unbreakable by spin, ironBounce bounces
s = await ev(async () => {
  const e = window.__CT.crates('iron').find((c) => c.y < 0.1);
  e.onSpin(window.__LB.player, window.__LB.level.ctx);
  e.onSlam(window.__LB.player, window.__LB.level.ctx, 1);
  const a = e.broken;
  e.onSlam(window.__LB.player, window.__LB.level.ctx, 2);
  return { afterSpinSlam: a, afterSuper: e.broken };
});
check('iron: spin/slam no, super slam yes', !s.afterSpinSlam && s.afterSuper, JSON.stringify(s));

// --- checkpoint crate (T-crates-1)
s = await ev(async () => {
  const e = window.__CT.crates('checkpoint')[0];
  window.__CT.dropOn(e, 0.6);
  await window.__CT.sleep(500);
  const L = window.__LB.level;
  return { broken: e.broken, dead: e.dead, lantern: !!e.lantern, cp: L.checkpoint.map((v) => +v.toFixed(2)), n: L.checkpointCount };
});
check('checkpoint crate: sets checkpoint, lantern stays', s.broken && !s.dead && s.lantern && s.n === 1, JSON.stringify(s));
await gwait(300);
await page.screenshot({ path: 'test-results/crates-checkpoint.png' });

// --- TNT: land → countdown 3-2-1 → boom, chain to the neighbour TNT
s = await ev(async () => {
  const tnts = window.__CT.crates('tnt');
  const e = tnts.sort((a, b) => a.x - b.x)[0];
  window.__tnts = tnts;
  window.__CT.dropOn(e, 0.6);
  await window.__CT.sleep(250);
  const P = window.__LB.player;
  const lit = { fuse: +e.fuseT.toFixed(2), look: e.look };
  P.vel.set(0, 0, 0); P.pos.set(e.x + 6, e.y, e.z + 2);  // run away
  return lit;
});
check('TNT: landing lights the fuse (3-2-1)', s.fuse > 2 && s.look === 'tnt3', JSON.stringify(s));
await gwait(1300);
await ev(() => { const e = window.__tnts[0]; const P = window.__LB.player; P.vel.set(0, 0, 0); P.pos.set(e.x + 3, e.y, e.z + 4); });
await gwait(500);
await page.screenshot({ path: 'test-results/crates-tnt-countdown.png' });
s = await ev(() => window.__tnts.map((e) => e.look));
check('… countdown digit visible on the faces', s.includes('tnt1') || s.includes('tnt2'), JSON.stringify(s));
await gwait(1700);
s = await ev(() => ({ dead: window.__tnts.map((e) => e.dead), basics: window.__CT.crates('basic').filter((c) => !c.broken && Math.abs(c.x + 2.5) < 1 && c.z < -30 && c.z > -40).length, alive: !window.__LB.player.dead }));
check('… TNT explodes and chains the neighbour TNT + crates', s.dead.every(Boolean), JSON.stringify(s));
check('… Lumen far enough survives', s.alive);

// --- nitro touch kills (no mask)
s = await ev(async () => {
  const G = window.__LB.game; G.masks = 0;
  const L = window.__LB.level;
  const e = window.__CT.crates('nitro').find((c) => !c.broken);
  window.__CT.put(e.x + 0.84, e.y, e.z);
  await window.__CT.sleep(300);
  return { dead: e.dead, playerDead: window.__LB.player.dead };
});
check('nitro: touching it explodes (and hurts)', s.dead && s.playerDead, JSON.stringify(s));
await page.waitForFunction(() => !window.__LB.player.dead, null, { timeout: 15000 });
await gwait(300);
s = await ev(() => ({ nitros: window.__CT.crates('nitro').filter((c) => !c.broken).length }));
check('… respawn brings the nitro back (broken after checkpoint)', s.nitros === 5, JSON.stringify(s));

// --- nitro switch: every nitro explodes, harmlessly, and counts
s = await ev(async () => {
  const L = window.__LB.level;
  const sw = window.__CT.crates('nitroSwitch')[0];
  const n0 = L.stats.crates;
  const nitros = window.__CT.crates('nitro').filter((c) => !c.broken);
  const row = nitros.filter((c) => c.z < sw.z - 1);
  window.__CT.put(0, row[0].y, row[0].z + 1.6); // stand right in front of the nitro row (not touching)
  await window.__CT.sleep(60);
  sw.onSlam(window.__LB.player, L.ctx, 1);
  await window.__CT.sleep(1500);
  return { nitrosDead: nitros.every((c) => c.dead), counted: L.stats.crates - n0, alive: !window.__LB.player.dead, n: nitros.length, deaths: window.__deaths, nit: nitros.map((c) => [c.x, c.z]) };
});
check('nitro switch: all nitros explode (cascade), count, harmless', s.nitrosDead && s.counted >= s.n + 1 && s.alive, JSON.stringify(s));

// --- switch / outline
s = await ev(async () => {
  const outs = window.__CT.crates('outline');
  const before = outs.map((o) => o.intangible);
  const sw = window.__CT.crates('switch')[0];
  window.__CT.put(sw.x - 1.5, 0, sw.z + 2);
  sw.onSpin(window.__LB.player, window.__LB.level.ctx);
  await window.__CT.sleep(250);
  const mid = outs.filter((o) => o.active).length;
  await window.__CT.sleep(1200);
  return { before: before.every(Boolean), mid, after: outs.filter((o) => o.active && !o.intangible).length, n: outs.length };
});
check('switch materializes outlines one by one', s.before && s.mid < s.n && s.after === s.n, JSON.stringify(s));
await page.screenshot({ path: 'test-results/crates-outlines.png' });

// --- legs crate runs away
s = await ev(async () => {
  const e = window.__CT.crates('legs')[0];
  const x0 = e.x, z0 = e.z;
  window.__CT.put(e.x - 2.5, e.y, e.z + 1);
  await window.__CT.sleep(1600);
  return { state: e.state, moved: +Math.hypot(e.x - x0, e.z - z0).toFixed(2) };
});
check('legs crate runs away when approached', s.state === 'run' && s.moved > 1, JSON.stringify(s));
await page.screenshot({ path: 'test-results/crates-legs.png' });

// --- pickups: light magnet, sock, sign toast
s = await ev(async () => {
  const L = window.__LB.level, G = window.__LB.game;
  const light = L.entities.find((e) => e.def?.kind === 'light' && e.def.type === 'pickup');
  const l0 = G.lights;
  window.__CT.put(light.x + 1.8, light.y - 0.7, light.z);
  await window.__CT.sleep(600);
  const sock = L.entities.find((e) => e.def?.kind === 'sock');
  window.__CT.put(sock.def.x, sock.def.y - 1, sock.def.z);
  await window.__CT.sleep(300);
  const sign = L.entities.find((e) => e.def?.kind === 'sign' && !e.shown);
  window.__CT.put(sign.d.x + 1, sign.d.y, sign.d.z + 1);
  await window.__CT.sleep(200);
  return { light: G.lights - l0, lightDead: !!light.dead, socks: L.stats.socks, signShown: sign.shown, toasts: window.__toasts.map((t) => t.kind) };
});
check('light pickup magnetized + collected', s.light >= 1 && s.lightDead, JSON.stringify(s));
check('sock collected → stats.socks', s.socks.length === 1);
check('sign → joke toast', s.signShown && s.toasts.includes('joke'));

// --- goal
s = await ev(async () => {
  const L = window.__LB.level;
  const g = L.entities.find((e) => e.def?.kind === 'goal');
  window.__CT.put(g.d.x, g.d.y + 0.2, g.d.z + 2);
  await window.__CT.sleep(500);
  const shot = { x: g.d.x, z: g.d.z };
  window.__CT.put(g.d.x, g.d.y + 0.2, g.d.z);
  await window.__CT.sleep(300);
  return { finished: L.finished, shot };
});
check('goal portal completes the level', s.finished, JSON.stringify(s));
await page.screenshot({ path: 'test-results/crates-goal.png' });

// ===================================================================== T-crates-2: checkpoint & respawn rules
await go('T-crates-2');
s = await ev(async () => {
  const L = window.__LB.level, CT = window.__CT;
  const sleep = (ms) => window.__CT.sleep(ms);
  const at = (lat, fwdZ) => CT.crates().filter((c) => Math.abs(c.d.x - lat) < 0.01 && Math.abs(c.d.z - fwdZ) < 0.01);
  const A = CT.crates('basic').find((c) => c.d.x === 0 && c.d.z > -6);
  CT.dropOn(A, 0.6); await sleep(400);
  const cp = CT.crates('checkpoint')[0];
  CT.dropOn(cp, 0.6); await sleep(400);
  const C = CT.crates('basic').find((c) => c.d.x === 0 && c.d.z < -10 && c.d.z > -14);
  CT.dropOn(C, 0.6); await sleep(400);
  const stack = at(2, C.d.z).sort((a, b) => a.y - b.y);
  CT.put(stack[0].x + 1.2, 0, stack[0].z);
  stack[0].onSpin(window.__LB.player, L.ctx); await sleep(900);
  const fallen = stack.slice(1).map((c) => +c.y.toFixed(2));
  // switch after checkpoint
  const sw = CT.crates('switch')[0];
  sw.onSpin(window.__LB.player, L.ctx); await sleep(800);
  const outsActive = CT.crates('outline').filter((o) => o.active).length;
  // TNT lit then die
  const tnt = CT.crates('tnt')[0];
  CT.dropOn(tnt, 0.6); await sleep(200);
  const legs = CT.crates('legs')[0];
  const before = { crates: L.stats.crates, fallen, outsActive, tntLit: tnt.fuseT > 0 };
  window.__LB.game.kill('fall');
  await sleep(3500);
  const after = {
    A: !!L.entities.find((e) => e.id === A.id),
    cpLantern: !!L.entities.find((e) => e.id === cp.id && e.lantern),
    C: !!L.entities.find((e) => e.id === C.id && !e.broken),
    stackYs: at(2, C.d.z).filter((c) => !c.broken).map((c) => +c.y.toFixed(2)).sort(),
    outlines: CT.crates('outline').map((o) => o.active),
    switchBack: CT.crates('switch').length === 1 && !CT.crates('switch')[0].broken,
    tntReset: CT.crates('tnt').length === 1 && CT.crates('tnt')[0].fuseT === 0,
    crates: L.stats.crates,
    respawnAt: [L.player.pos.x, L.player.pos.z].map((v) => +v.toFixed(1)), cpPos: [cp.x, cp.z],
    legsHome: legs.x === legs.d.x && legs.z === legs.d.z,
  };
  return { before, after };
});
check('respawn: crate broken before checkpoint stays broken', !s.after.A, JSON.stringify(s.before));
check('respawn: checkpoint lantern stays', s.after.cpLantern);
check('respawn: crate broken after checkpoint comes back', s.after.C);
check('respawn: fallen stack restored (3 crates at 0/1/2)', JSON.stringify(s.after.stackYs) === '[0,1,2]', JSON.stringify(s.after.stackYs));
check('respawn: outlines back to ghosts, switch restored', s.after.outlines.every((a) => !a) && s.after.switchBack, JSON.stringify(s.after.outlines));
check('respawn: lit TNT reset', s.after.tntReset);
check('respawn: counter back to the checkpoint value (2)', s.after.crates === 2, `${s.before.crates} → ${s.after.crates}`);
check('respawn: Lumen at the checkpoint', Math.abs(s.after.respawnAt[1] - s.after.cpPos[1]) < 0.5, JSON.stringify(s.after));

// ===================================================================== time trial: time crates
await go('T-crates-1', true);
s = await ev(async () => {
  const G = window.__LB.game, CT = window.__CT;
  const t = CT.crates('time2')[0];
  if (!t) return { exists: false };
  const f0 = G.freezeT;
  CT.dropOn(t, 0.6);
  await window.__CT.sleep(300);
  return { exists: true, broken: t.broken, froze: G.freezeT > f0, counts: t.counts };
});
check('time trial: time crates exist and freeze the timer, do not count', s.exists && s.broken && s.froze && !s.counts, JSON.stringify(s));

const bad = errors.filter((e) => !/favicon|GL_|WebGL|GPU stall/.test(e));
check('no console errors', bad.length === 0, bad.slice(0, 5).join('\n   '));
await browser.close();
await server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
