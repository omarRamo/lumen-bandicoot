// Dev tool (agent Caisses): node tools/crates-perf.mjs [levelId] — fps with crate FX layers toggled, draw calls.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('[err]', e.message));
await page.goto(`${base}?debug&level=${process.argv[2] || 'T-crates-1'}`);
await page.waitForFunction(() => window.__LB?.level?.player);
await page.waitForTimeout(2500);
const fps = async (label) => { await page.waitForTimeout(1500); console.log(label.padEnd(28), Math.round(await page.evaluate(() => window.__LB.fps))); };
await fps('baseline');
const r = await page.evaluate(() => {
  const L = window.__LB.level;
  const fx = L.entities.find((e) => e.object3d?.name === 'crate-fx');
  const out = [];
  fx?.object3d.children.forEach((c) => out.push(`${c.type}:${c.material?.type}:${c.count ?? ''}`));
  return out;
});
console.log(r.join('\n'));
await page.evaluate(() => { const L = window.__LB.level; L.entities.find((e) => e.object3d?.name === 'crate-fx').object3d.visible = false; });
await fps('crate-fx hidden');
await page.evaluate(() => { const L = window.__LB.level; L.entities.find((e) => e.object3d?.name === 'crate-fx').object3d.visible = true; for (const e of L.entities) if (e.object3d && e.object3d.name !== 'crate-fx') e.object3d.visible = false; });
await fps('entity groups hidden');
await page.evaluate(() => { const L = window.__LB.level; for (const c of L.entities.find((e) => e.object3d?.name === 'crate-fx').object3d.children) if (c.isInstancedMesh) c.castShadow = false; });
await fps('+ no instanced shadows');
const prof = await page.evaluate(async () => {
  const L = window.__LB.level;
  const acc = new Map();
  for (const e of L.entities) {
    if (!e.update) continue;
    const key = `${e.def?.type}/${e.def?.kind}`;
    const f = e.update;
    e.update = function (...a) { const t = performance.now(); const r = f.apply(this, a); acc.set(key, (acc.get(key) || 0) + performance.now() - t); return r; };
  }
  const lu = L.update.bind(L); let lt = 0, n = 0;
  L.update = (dt) => { const t = performance.now(); lu(dt); lt += performance.now() - t; n++; };
  const env = L.env; const eu = env.update?.bind(env); let et = 0;
  if (eu) env.update = (...a) => { const t = performance.now(); eu(...a); et += performance.now() - t; };
  await new Promise((r) => setTimeout(r, 2000));
  return { steps: n, levelMsPerStep: +(lt / n).toFixed(3), envMsPerStep: +(et / n).toFixed(3), top: [...acc].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}: ${(v / n).toFixed(3)}ms`) };
});
console.log(JSON.stringify(prof, null, 1));
await browser.close(); await server.close();
