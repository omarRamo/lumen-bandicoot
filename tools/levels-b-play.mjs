// Level design B — scripted play-test. node tools/levels-b-play.mjs <levelId> "<script>" [--fixride] [--shot name]
// script = ';'-separated steps:  power:doubleJump | tp:x,y,z | hold:ArrowUp,KeyJ:1.5 (keys:seconds) | tap:Space |
//          wait:0.5 | log  | shot:name
// --fixride: patches the player so ride autoRun keeps its speed (works around the decel/autoRun fight in player.js).
import { createServer } from 'vite';
import { chromium } from 'playwright';
const [id, script = 'hold:ArrowUp:3;log'] = process.argv.slice(2);
const fixRide = process.argv.includes('--fixride');
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: process.argv.includes('--big') ? { width: 960, height: 540 } : { width: 400, height: 225 } });
page.on('pageerror', (e) => console.log('[err]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[c]', m.text().slice(0, 200)); });
await page.goto(`${base}?debug&level=${id}`);
await page.waitForFunction(() => window.__LB?.level?.player);
if (fixRide) {
  await page.evaluate(() => {
    const P = Object.getPrototypeOf(window.__LB.player);
    if (P.__fixed) return;
    P.__fixed = true;
    const up = P.update;
    P.update = function (dt, ctx) {
      if (this.autoRun && !this.dead && ctx.rig) {
        const f = ctx.rig.forward, along = this.vel.x * f.x + this.vel.z * f.z;
        const add = this.autoRun - along;
        this.vel.x += f.x * add; this.vel.z += f.z * add;
        if (this.grounded) { this.vel.x += f.x * 48 * dt; this.vel.z += f.z * 48 * dt; } // cancel the decel pull
      }
      return up.call(this, dt, ctx);
    };
  });
}
const snap = () => page.evaluate(() => {
  const L = window.__LB.level, p = L.player, c = window.__LB.rig.camera;
  return { t: +L.time.toFixed(1), p: [p.pos.x, p.pos.y, p.pos.z].map((v) => +v.toFixed(1)), v: +Math.hypot(p.vel.x, p.vel.z).toFixed(1), g: p.grounded, dead: p.dead,
    cam: [c.position.x, c.position.y, c.position.z].map((v) => +v.toFixed(1)), crates: `${L.stats.crates}/${L.stats.cratesTotal}`, deaths: L.stats.deaths, lights: L.stats.lights, socks: L.stats.socks.length, fin: L.finished };
});
/** wait `secs` of GAME time (headless rendering is slow), logging every 0.5 game-second if asked */
async function gameWait(secs, verbose = false) {
  const t0 = await page.evaluate(() => window.__LB.level.time);
  let next = t0 + 0.5;
  for (;;) {
    await page.waitForTimeout(60);
    const tt = await page.evaluate(() => window.__LB.level?.time ?? 0);
    if (verbose && tt >= next) { next += 0.5; console.log('  ', JSON.stringify(await snap())); }
    if (tt >= t0 + secs || tt < t0) break;
  }
}
await page.waitForTimeout(500);
for (const step of script.split(';').map((s) => s.trim()).filter(Boolean)) {
  const [cmd, ...rest] = step.split(':');
  const arg = rest.join(':');
  if (cmd === 'power') await page.evaluate((p) => window.__LB.setPower(p), arg);
  else if (cmd === 'tp') await page.evaluate((a) => { window.__LB.teleport(...a); window.__LB.player.vel.set(0, 0, 0); }, arg.split(',').map(Number));
  else if (cmd === 'hold') {
    const [keys, secs] = arg.split(':');
    const ks = keys.split(',');
    for (const k of ks) await page.keyboard.down(k);
    await gameWait(Number(secs), process.argv.includes('--v'));
    for (const k of ks) await page.keyboard.up(k);
  } else if (cmd === 'down') { for (const k of arg.split(',')) await page.keyboard.down(k); }
  else if (cmd === 'up') { for (const k of arg.split(',')) await page.keyboard.up(k); }
  else if (cmd === 'tap') { for (const k of arg.split(',')) await page.keyboard.press(k); }
  else if (cmd === 'wait') await gameWait(Number(arg));
  else if (cmd === 'log') console.log(step, JSON.stringify(await snap()));
  else if (cmd === 'shot') await page.screenshot({ path: `test-results/play-${id}-${arg}.png` });
  else if (cmd === 'trace') { // trace:seconds — log every 0.5 s while keys are held
    await gameWait(Number(arg), true);
  }
}
await browser.close(); await server.close();
