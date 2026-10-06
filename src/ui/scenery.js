// Lumen Bandicoot — 2D scenery for cinematics and the world map (skies, seas, islands, props).
import { ell, leaf, line, rrect, star4 } from './art.js';
import { PALETTE as P, rand } from './util.js';

const TAU = Math.PI * 2;

export function sky(g, w, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}

export function sun(g, x, y, r, color = '#ffe7a3', t = 0) {
  const gl = g.createRadialGradient(x, y, r * 0.3, x, y, r * 3);
  gl.addColorStop(0, 'rgba(255,240,190,0.7)'); gl.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 3, 0, TAU); g.fill();
  ell(g, x, y, r * (1 + Math.sin(t * 2) * 0.02), r * (1 + Math.sin(t * 2) * 0.02), color);
}

export function stars(g, w, h, t, n = 60, seed = 7) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h * 0.7, s = 1 + R() * 2.5, ph = R() * 6;
    g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + ph));
    star4(g, x, y, s * 1.6, '#fff6d8');
  }
  g.globalAlpha = 1;
}

export function cloud(g, x, y, s, color = 'rgba(255,255,255,0.85)') {
  ell(g, x, y, 60 * s, 22 * s, color); ell(g, x - 30 * s, y + 4 * s, 34 * s, 18 * s, color);
  ell(g, x + 18 * s, y - 14 * s, 36 * s, 24 * s, color); ell(g, x + 44 * s, y + 4 * s, 30 * s, 16 * s, color);
}

export function sea(g, y, w, h, t, top = '#5fc4c0', bottom = '#2a7f8f') {
  const gr = g.createLinearGradient(0, y, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, y, w, h - y);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.lineCap = 'round';
  for (let row = 0; row < 6; row++) {
    const yy = y + 14 + row * ((h - y) / 6);
    const off = (t * (20 + row * 6) + row * 70) % 140;
    for (let x = -140 + off; x < w + 140; x += 140) {
      g.beginPath(); g.moveTo(x, yy); g.quadraticCurveTo(x + 14, yy - 6, x + 28, yy); g.stroke();
    }
  }
}

export function palm(g, x, y, s, t = 0, lean = 0.15) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const tx = Math.sin(lean) * 120, ty = -120;
  g.strokeStyle = '#8a5a2e'; g.lineWidth = 12; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(tx * 0.2, ty * 0.5, tx, ty); g.stroke();
  g.strokeStyle = '#6e4521'; g.lineWidth = 2;
  for (let i = 1; i < 8; i++) { const k = i / 8; const px = tx * k * k * 0.9 + tx * 0.2 * k * (1 - k) * 2, py = ty * k; g.beginPath(); g.moveTo(px - 6, py); g.lineTo(px + 6, py + 3); g.stroke(); }
  const sw = Math.sin(t * 1.5) * 0.08;
  const fr = ['#3f9a63', '#56b877', '#2f7f52'];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.55 + sw;
    g.save(); g.translate(tx, ty); g.rotate(a + Math.PI / 2);
    g.fillStyle = fr[i % 3]; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(30, -10, 70, 18); g.quadraticCurveTo(30, 4, 0, 0); g.fill();
    g.restore();
  }
  ell(g, tx - 5, ty + 6, 6, 6, '#7a4a20'); ell(g, tx + 6, ty + 7, 6, 6, '#7a4a20');
  g.restore();
}

export function cactus(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#4f9a5a'; rrect(g, -9, -70, 18, 70, 9); g.fill();
  rrect(g, -30, -50, 12, 30, 6); g.fill(); rrect(g, -30, -26, 26, 10, 5); g.fill();
  rrect(g, 18, -60, 12, 30, 6); g.fill(); rrect(g, 4, -36, 26, 10, 5); g.fill();
  ell(g, 0, -72, 5, 5, P.coral);
  g.restore();
}

export function pine(g, x, y, s, snow = true) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#6b4a2a'; g.fillRect(-4, -14, 8, 14);
  for (let i = 0; i < 3; i++) {
    const yy = -14 - i * 20, w = 30 - i * 7;
    g.fillStyle = '#2f6b66'; g.beginPath(); g.moveTo(-w, yy); g.lineTo(0, yy - 34); g.lineTo(w, yy); g.closePath(); g.fill();
    if (snow) { g.fillStyle = '#f4fbff'; g.beginPath(); g.moveTo(-w * 0.45, yy - 18); g.lineTo(0, yy - 34); g.lineTo(w * 0.45, yy - 18); g.quadraticCurveTo(0, yy - 12, -w * 0.45, yy - 18); g.fill(); }
  }
  g.restore();
}

export function factory(g, x, y, s, t = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#5a4f78'; g.beginPath(); g.moveTo(-60, 0); g.lineTo(-60, -50); g.lineTo(-30, -70); g.lineTo(-30, -50); g.lineTo(0, -70); g.lineTo(0, -50); g.lineTo(30, -70); g.lineTo(30, 0); g.closePath(); g.fill();
  g.fillStyle = '#463d63'; g.fillRect(36, -110, 16, 110);
  g.fillStyle = '#e2574c'; g.fillRect(36, -100, 16, 6); g.fillRect(36, -80, 16, 6);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillStyle = Math.floor(t * 2 + i + j) % 3 ? '#ffd76a' : '#b8a0ff'; g.fillRect(-52 + i * 26, -36 + j * 16, 12, 9); }
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    g.globalAlpha = 0.55 * (1 - k); ell(g, 44 + Math.sin(k * 5 + i) * 10 + k * 30, -118 - k * 80, 10 + k * 22, 8 + k * 16, '#b7aecf');
  }
  g.globalAlpha = 1;
  g.restore();
}

export function dune(g, x, y, w, h, c) {
  g.fillStyle = c; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.3, y - h * 1.6, x, y - h); g.quadraticCurveTo(x + w * 0.5, y - h * 0.5, x + w, y); g.closePath(); g.fill();
}

export function iceberg(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#e8f7ff'; g.beginPath(); g.moveTo(-60, 0); g.lineTo(-40, -50); g.lineTo(-18, -38); g.lineTo(0, -90); g.lineTo(26, -44); g.lineTo(44, -60); g.lineTo(64, 0); g.closePath(); g.fill();
  g.fillStyle = '#b8e2f8'; g.beginPath(); g.moveTo(0, -90); g.lineTo(26, -44); g.lineTo(44, -60); g.lineTo(64, 0); g.lineTo(10, 0); g.closePath(); g.fill();
  g.restore();
}

export function moon(g, x, y, r, color = '#ffe9a6') {
  const gl = g.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
  gl.addColorStop(0, 'rgba(255,230,150,0.5)'); gl.addColorStop(1, 'rgba(255,230,150,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * 2.6, 0, TAU); g.fill();
  ell(g, x, y, r, r, color);
  ell(g, x - r * 0.3, y - r * 0.2, r * 0.18, r * 0.18, 'rgba(200,150,40,0.25)');
  ell(g, x + r * 0.35, y + r * 0.25, r * 0.12, r * 0.12, 'rgba(200,150,40,0.25)');
  ell(g, x + r * 0.1, y - r * 0.45, r * 0.08, r * 0.08, 'rgba(200,150,40,0.25)');
}

/** Wobbly blob path around (cx,cy). */
export function blob(g, cx, cy, rx, ry, seed = 1, wob = 0.12, n = 14) {
  const R = rand(seed);
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const k = 1 + (R() - 0.5) * 2 * wob; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p0 = pts[i], p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) g.moveTo((pts[n - 1][0] + p0[0]) / 2, (pts[n - 1][1] + p0[1]) / 2);
    g.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  g.closePath();
}

export const ISLAND_THEMES = {
  1: { sea: ['#64d1c8', '#2b8ea0'], shore: '#f6e2a8', land: '#6fc48a', landD: '#4c9f6c', sky: ['#9fe3ff', '#d9f6ff'] },
  2: { sea: ['#5fc9d4', '#2a8aa5'], shore: '#ffe0a3', land: '#f0bf6e', landD: '#d39a4e', sky: ['#ffd7a0', '#fff1d0'] },
  3: { sea: ['#7cc6e8', '#356e9a'], shore: '#e8f7ff', land: '#cfe9f7', landD: '#9fc8e3', sky: ['#bfe3ff', '#eff9ff'] },
  4: { sea: ['#5a6a8f', '#2d2f55'], shore: '#9b93b8', land: '#7a7099', landD: '#5c5380', sky: ['#7f6aa8', '#c6b2e6'] },
  5: { sea: ['#2a2366', '#140f3a'], shore: '#ffe9a6', land: '#ffd76a', landD: '#e0ad3c', sky: ['#1c1640', '#3b2d7a'] },
};

/** Island illustration for the world map, drawn inside rect {x,y,w,h}. */
export function drawIsland(g, world, rect, t, opts = {}) {
  const th = ISLAND_THEMES[world] || ISLAND_THEMES[1];
  const { x, y, w, h } = rect;
  const cx = x + w / 2, cy = y + h / 2;
  // shallow-water ring
  g.fillStyle = 'rgba(255,255,255,0.18)'; blob(g, cx, cy + h * 0.02, w * 0.5, h * 0.48, world * 13, 0.1); g.fill();
  g.fillStyle = th.shore; blob(g, cx, cy, w * 0.46, h * 0.43, world * 13, 0.1); g.fill();
  g.fillStyle = th.landD; blob(g, cx, cy + h * 0.02, w * 0.41, h * 0.37, world * 29, 0.12); g.fill();
  g.fillStyle = th.land; blob(g, cx, cy - h * 0.01, w * 0.40, h * 0.35, world * 29, 0.12); g.fill();
  const R = rand(world * 101);
  const s = Math.min(w, h) / 420;
  const deco = [];
  for (let i = 0; i < 22; i++) {
    const a = R() * TAU, rr = 0.55 + R() * 0.42;
    deco.push([cx + Math.cos(a) * w * 0.36 * rr, cy + Math.sin(a) * h * 0.30 * rr, 0.6 + R() * 0.5]);
  }
  deco.sort((a, b) => a[1] - b[1]);
  const avoid = opts.avoid || [];
  for (const [dx, dy, k] of deco) {
    if (avoid.some(([ax, ay]) => Math.hypot(ax - dx, ay - dy) < 40 * s + 12)) continue;
    switch (world) {
      case 1: palm(g, dx, dy, 0.35 * s * k, t + dx, 0.1 + (k - 0.8)); break;
      case 2: if (k > 0.85) cactus(g, dx, dy, 0.45 * s * k); else dune(g, dx, dy, 40 * s, 18 * s, '#e6a75a'); break;
      case 3: pine(g, dx, dy, 0.55 * s * k); break;
      case 4:
        if (k > 0.72) factory(g, dx, dy, 0.42 * s, t + dx);
        else { // pipe with a valve wheel
          g.strokeStyle = '#5c5380'; g.lineWidth = 9 * s; g.lineCap = 'round';
          g.beginPath(); g.moveTo(dx - 26 * s, dy); g.lineTo(dx - 26 * s, dy - 30 * s * k); g.lineTo(dx + 20 * s, dy - 30 * s * k); g.lineTo(dx + 20 * s, dy); g.stroke();
          ell(g, dx - 3 * s, dy - 30 * s * k, 8 * s, 8 * s, '#e2574c'); ell(g, dx - 3 * s, dy - 30 * s * k, 3 * s, 3 * s, '#3a3352');
        }
        break;
      case 5: star4(g, dx, dy - 10 * s, 10 * s * k, '#fff6c8'); break;
      default: break;
    }
  }
  if (world === 2) { // little blue houses of Sidi Bou Saïd
    for (let i = 0; i < 3; i++) { const hx = cx + w * (0.14 + i * 0.05), hy = cy - h * 0.18 + i * 6; g.fillStyle = '#fff'; g.fillRect(hx, hy - 16 * s, 22 * s, 16 * s); g.fillStyle = '#3b7dd8'; g.fillRect(hx + 7 * s, hy - 10 * s, 7 * s, 10 * s); ell(g, hx + 11 * s, hy - 17 * s, 9 * s, 6 * s, '#3b7dd8'); }
  }
  if (world === 3) { iceberg(g, x + w * 0.12, y + h * 0.88, 0.5 * s); iceberg(g, x + w * 0.9, y + h * 0.16, 0.35 * s); }
  if (world === 5) moon(g, x + w * 0.85, y + h * 0.12, 30 * s);
}

/** Leaf garland / sparkles used as decorative frame. */
export function sparkles(g, w, h, t, n = 14, seed = 3, color = '#fff6d8') {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, s = 2 + R() * 4, ph = R() * 6;
    g.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 1.2 + ph));
    star4(g, x, y + Math.sin(t + ph) * 6, s, color);
  }
  g.globalAlpha = 1;
}

export { leaf, line };
