// Renders every SFX and a slice of every music track in headless Chromium (OfflineAudioContext) and
// reports peak / RMS / clipping. Usage: node tools/audio-check.mjs [--raw] [names…]
import { createServer } from 'vite';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const raw = args.includes('--raw');
const only = args.filter((a) => !a.startsWith('--'));
const server = await createServer({ server: { port: 5900 + Math.floor(Math.random() * 90), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}tools/audio-lab.html`, { waitUntil: "load" });
const res = await page.evaluate(async ({ raw, only }) => {
  const { renderOffline } = await import('/src/audio/offline.js');
  const { SFX_NAMES, TRACK_NAMES } = await import('/src/audio/audio.js');
  const out = { sfx: {}, music: {} };
  for (const n of SFX_NAMES) if (!only.length || only.includes(n)) out.sfx[n] = await renderOffline('sfx', n, { seconds: 3, raw });
  for (const n of TRACK_NAMES) if (!only.length || only.includes(n)) {
    out.music[n] = await renderOffline('music', n, { seconds: 24, raw });
    if (!only.length || only.includes(n)) out.music[n + '+disco+boss'] = await renderOffline('music', n, { seconds: 12, raw, mods: { invincible: true, boss: true } });
  }
  return out;
}, { raw, only });
let bad = 0;
const row = (k, r, kind) => {
  const flags = [];
  if (r.silent) flags.push('SILENT');
  if (r.clip) flags.push(`CLIP×${r.clip}`);
  if (kind === 'sfx' && r.loud < 0.02) flags.push('quiet');
  if (kind === 'music' && r.rms < 0.03) flags.push('quiet');
  if (r.errors) flags.push(`ERR×${r.errors}`);
  if (flags.some((f) => f !== 'quiet')) bad++;
  console.log(`${kind.padEnd(5)} ${k.padEnd(26)} peak ${r.peak.toFixed(3)}  rms ${r.rms.toFixed(4)}  loud ${r.loud.toFixed(4)}  tail ${r.tail}s  ${flags.join(' ')}`);
};
for (const [k, r] of Object.entries(res.sfx)) row(k, r, 'sfx');
for (const [k, r] of Object.entries(res.music)) row(k, r, 'music');
if (errors.length) console.log('page errors:', errors.slice(0, 5));
await browser.close();
await server.close();
console.log(bad ? `${bad} problem(s)` : 'audio OK');
process.exit(bad ? 1 : 0);
