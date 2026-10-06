// Saves spectrogram PNGs of SFX / tracks for visual QA. Usage: node tools/audio-spectro.mjs outDir sfx:spin music:title:8 …
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const [outDir, ...items] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const server = await createServer({ server: { port: 5990 + Math.floor(Math.random() * 9), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${server.resolvedUrls.local[0]}tools/audio-lab.html`, { waitUntil: 'load' });
for (const it of items) {
  const [kind, name, secs] = it.split(':');
  const url = await page.evaluate(async ({ kind, name, secs }) => {
    const { renderOffline, spectrogram } = await import('/src/audio/offline.js');
    const buf = await renderOffline(kind, name, { seconds: +secs || 2.5, keep: true });
    const c = document.createElement('canvas');
    spectrogram(buf, c);
    return c.toDataURL('image/png');
  }, { kind, name, secs });
  writeFileSync(`${outDir}/${kind}-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('wrote', `${outDir}/${kind}-${name}.png`);
}
await browser.close();
await server.close();
