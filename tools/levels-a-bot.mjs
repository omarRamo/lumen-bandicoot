// Level design A — autopilot playtest. node tools/levels-a-bot.mjs <id…> [--max=150] [--shot]
// Drives window.__LB through input.setVirtual: follows the floor ahead, jumps over pits / onto steps / onto crates,
// slides under low bars, spins when stuck. Reports deaths (with positions), completion and time.
// Works with stub entities (missing moving/sinking platforms will show up as deaths at those spots).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const ids = args.filter((a) => !a.startsWith('--'));
const MAX = +(args.find((a) => a.startsWith('--max='))?.slice(6) ?? 150);
const SHOT = args.includes('--shot');
const TRACE = args.includes('--trace');
const AT = args.find((a) => a.startsWith('--at='))?.slice(5).split(',').map(Number);
const POWERS = args.find((a) => a.startsWith('--powers='))?.slice(9).split(',') ?? [];
mkdirSync('test-results', { recursive: true });

const ISOLATE = process.argv.includes('--isolate');
const isolate = {
  name: 'levels-a-isolate', enforce: 'pre',
  load(id) { if (ISOLATE && /src[\\/]levels[\\/](w3|w4|secret|bosses)\.js$/.test(id)) return 'export default [];'; },
};
const server = await createServer({ root: process.cwd(), plugins: [isolate], server: { hmr: false, port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}?debug&level=${id}`);
  await page.waitForFunction(() => window.__LB?.level?.player, null, { timeout: 30000 });
  await page.evaluate((powers) => {
    const LB = window.__LB;
    for (const p of powers) LB.setPower(p);
    const st = (window.__BOT = { deaths: [], done: false, stuckT: 0, log: [], jumpT: 0, slideT: 0, spinT: 0, lastDeadT: -1 });
    const fwd = LB.level.data.dir === 'x' ? { x: 1, z: 0 } : { x: 0, z: -1 };
    const along = (x, z) => x * fwd.x + z * fwd.z;
    const cross = (x, z) => x * -fwd.z + z * fwd.x; // right-hand lateral (for -Z: +x; for +X: +z)
    const boxes = () => {
      const L = LB.level;
      const out = [];
      for (const s of L.world.all) out.push(s);
      for (const e of L.solids) if (e.box && !e.dead && !e.intangible) out.push(e.box);
      return out;
    };
    const span = (b) => {
      const a0 = along(b.min.x, b.min.z), a1 = along(b.max.x, b.max.z);
      const c0 = cross(b.min.x, b.min.z), c1 = cross(b.max.x, b.max.z);
      return { a0: Math.min(a0, a1), a1: Math.max(a0, a1), c0: Math.min(c0, c1), c1: Math.max(c0, c1), top: b.max.y, bot: b.min.y };
    };
    const tick = () => {
      requestAnimationFrame(tick);
      const L = LB.level; if (!L) return;
      const p = L.player, g = LB.game;
      g.lives = 50;
      if (L.finished) { st.done = true; LB.input.setVirtual({ x: 0, y: 0, jump: false, spin: false, slide: false }); return; }
      if (p.dead) {
        if (st.lastDeadT !== L.stats.deaths) { st.lastDeadT = L.stats.deaths; st.deaths.push([+p.pos.x.toFixed(1), +p.pos.y.toFixed(1), +p.pos.z.toFixed(1)]); }
        LB.input.setVirtual({ x: 0, y: 0, jump: false, spin: false, slide: false }); return;
      }
      const pa = along(p.pos.x, p.pos.z), pc = cross(p.pos.x, p.pos.z), py = p.pos.y;
      const B = boxes().map(span);
      // target surface ahead
      const look = pa + 2.5;
      let best = null, bs = Infinity;
      for (const s of B) {
        if (s.a0 > look || s.a1 < look - 1.5) continue;
        if (s.top > py + 2.2 || s.top < py - 6) continue;
        if (s.c1 - s.c0 < 0.9) continue;
        const cc = Math.min(Math.max(pc, s.c0 + 0.5), s.c1 - 0.5);
        const sc = Math.abs(cc - pc) + 2 * Math.max(0, s.top - py - 0.33) + 0.4 * Math.abs(s.top - py);
        if (sc < bs) { bs = sc; best = { ...s, cc }; }
      }
      let target = pc;
      if (best) target = best.cc;
      // ground below a point ahead
      const groundAt = (d) => {
        let top = -Infinity;
        for (const s of B) if (pa + d >= s.a0 && pa + d <= s.a1 && pc >= s.c0 && pc <= s.c1 && s.top <= py + 0.35 && s.top > top) top = s.top;
        return top;
      };
      let jump = false, slide = false, spin = false;
      if (p.grounded) {
        const gAhead = groundAt(0.8);
        if (gAhead < py - 3) {
          // pit: is there a landing ahead?
          const land = B.some((s) => s.a0 > pa && s.a0 < pa + 7 && s.top <= py + 2.2 && s.top > py - 4 && s.c1 > pc - 2.5 && s.c0 < pc + 2.5);
          if (land) jump = true;
        }
        for (const s of B) {
          if (s.a0 > pa + 0.2 && s.a0 < pa + 0.75 && pc + 0.3 > s.c0 && pc - 0.3 < s.c1) {
            if (s.top > py + 0.33 && s.top <= py + 2.25 && s.bot < py + 1.1) jump = true;
            if (s.bot > py + 0.45 && s.bot < py + 1.15) slide = true;
          }
        }
        if (slide) jump = false;
      }
      // stuck → spin, then jump
      const v = p.vel.x * fwd.x + p.vel.z * fwd.z;
      if (Math.abs(v) < 1 && p.grounded && !p.sliding) st.stuckT += 1 / 60; else st.stuckT = 0;
      if (st.stuckT > 0.25) spin = true;
      if (st.stuckT > 0.6) jump = true;
      if (st.stuckT > 1.2) { target = pc + (Math.random() < 0.5 ? -1.5 : 1.5); }
      // hold jump for full height; release first if still held (a new press needs an edge)
      if (jump && st.vj) { st.vj = false; st.pending = true; }
      else if (jump || st.pending) { st.pending = false; st.jumpT = 0.4; }
      st.jumpT -= 1 / 60;
      st.vj = st.jumpT > 0 && (p.vel.y > -0.5 || p.grounded);
      const wishA = 1, wishC = Math.max(-1, Math.min(1, (target - pc) * 1.2));
      const wx = fwd.x * wishA + -fwd.z * wishC, wz = fwd.z * wishA + fwd.x * wishC;
      const r = LB.rig.right, f = LB.rig.forward;
      let sx = wx * r.x + wz * r.z, sy = wx * f.x + wz * f.z;
      if (p.autoRun) sx = wishC;
      LB.input.setVirtual({ x: sx, y: p.autoRun ? 0 : sy, jump: st.vj, spin, slide });
      if (st.trace) st.log.push([+L.time.toFixed(2), +p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2), p.grounded ? 'G' : 'A', jump ? 'J' : '', st.vj ? 'h' : '', slide ? 'S' : '', spin ? 'P' : '', +sx.toFixed(2), +sy.toFixed(2)].join(' '));
      if (st.log.length > 4000) st.log.splice(0, 2000);
    };
    requestAnimationFrame(tick);
  }, POWERS);
  if (TRACE) await page.evaluate(() => { window.__BOT.trace = true; });
  if (AT) await page.evaluate((at) => { const L = window.__LB.level; L.player.pos.set(...at); L.setCheckpoint({ x: at[0], y: at[1], z: at[2] }); }, AT);
  const t0 = Date.now();
  let res;
  while (true) {
    await page.waitForTimeout(1000);
    res = await page.evaluate(() => {
      const L = window.__LB.level, p = L.player;
      return { t: +L.time.toFixed(1), done: window.__BOT.done, deaths: window.__BOT.deaths, pos: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)),
        crates: `${L.stats.crates}/${L.stats.cratesTotal}`, goal: L.data.goal, fps: Math.round(window.__LB.fps) };
    });
    if (res.done || res.t > MAX || Date.now() - t0 > MAX * 3000) break;
    if (res.deaths.length > 25) break;
  }
  if (SHOT) await page.screenshot({ path: `test-results/bot-${id}.png` });
  console.log(`${res.done ? '✓' : '✗'} ${id} t=${res.t}s deaths=${res.deaths.length} crates=${res.crates} pos=${res.pos} goal=${res.goal} fps=${res.fps}`);
  if (res.deaths.length) console.log('   deaths at', JSON.stringify(res.deaths.slice(0, 12)));
  if (errors.length) console.log('   errors', errors.slice(0, 4));
  if (TRACE) console.log((await page.evaluate(() => window.__BOT.log)).join('\n'));
  await page.close();
}
await browser.close();
await server.close();
