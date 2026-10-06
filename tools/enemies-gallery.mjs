// Dev tool (agent Ennemis): contact sheet of every enemy / hazard / platform of a sandbox level, close-up.
// node tools/enemies-gallery.mjs [levelId=T-enemies-1] [out=test-results/enemies-gallery.png] [type=enemy] [near=0]
//   near=1 → the player stands ~2.5 m in front of each entity (to see attack telegraphs), otherwise 14 m away.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const [levelId = 'T-enemies-1', out = 'test-results/enemies-gallery.png', type = 'enemy', near = '0'] = process.argv.slice(2);
const server = await createServer({ root: process.cwd(), server: { port: 5200 + Math.floor(Math.random() * 700), host: '127.0.0.1', hmr: false, watch: { ignored: ['**/*'] } }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', (e) => console.log('[err]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${base}?debug&level=${levelId}`);
await page.waitForFunction(() => window.__LB?.level?.player);
await page.waitForTimeout(500);
const data = await page.evaluate(async ({ type, near }) => {
  const LB = window.__LB, L = LB.level, cam = LB.rig.camera;
  const ents = L.entities.filter((e) => e.def?.type === type);
  const W = 320, H = 180, cols = 4, rows = Math.ceil(ents.length / cols);
  const sheet = document.createElement('canvas');
  sheet.width = W * cols; sheet.height = H * rows;
  const g = sheet.getContext('2d');
  const gl = document.querySelector('canvas#game') || document.querySelector('canvas');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let target = null;
  LB.rig.update = () => {
    if (!target) return;
    const dd = target.def;
    const liquid = dd.kind === 'water' || dd.kind === 'lava';
    const b = liquid ? { min: { x: dd.x - (dd.w ?? 4) / 2, y: dd.y - 0.5, z: dd.z - (dd.d ?? 4) / 2 }, max: { x: dd.x + (dd.w ?? 4) / 2, y: dd.y + 0.5, z: dd.z + (dd.d ?? 4) / 2 } }
      : target.box || { min: dd, max: dd };
    const cx = (b.min.x + b.max.x) / 2, cy = Math.min(b.max.y, b.min.y + 2.5), cz = (b.min.z + b.max.z) / 2;
    const size = Math.max(1.2, Math.min(6, Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)));
    cam.position.set(cx + size * 0.9, cy + size * 0.55, cz + size * 1.6);
    cam.lookAt(cx, (b.min.y + cy) / 2 + 0.1, cz);
  };
  const p = LB.player;
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    target = e;
    p.frozen = true;
    const d = e.def;
    if (near) LB.teleport(d.x + 0.2, d.y + 0.1, d.z + 2.6); else LB.teleport(d.x + 6, d.y + 0.1, d.z + 14);
    p.vel.set(0, 0, 0);
    const t0 = L.time;
    while (L.time < t0 + (near ? 0.9 : 0.35)) await wait(30);
    await wait(60);
    g.drawImage(gl, (i % cols) * W, Math.floor(i / cols) * H, W, H);
    g.fillStyle = '#000a'; g.fillRect((i % cols) * W, Math.floor(i / cols) * H, 150, 22);
    g.fillStyle = '#fff'; g.font = 'bold 15px sans-serif';
    g.fillText(`${d.kind}${e.st ? ' · ' + e.st : ''}`, (i % cols) * W + 6, Math.floor(i / cols) * H + 16);
  }
  return sheet.toDataURL('image/png');
}, { type, near: near === '1' });
mkdirSync('test-results', { recursive: true });
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log('wrote', out);
await browser.close(); await server.close();
