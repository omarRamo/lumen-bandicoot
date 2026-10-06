// Lumen Bandicoot — cinematics: illustrated canvas panels + typed caption. Skippable (jump/click/tap = next).
import { drawLumen, drawZina, drawOku, drawCortisol, drawStressotron, drawCrate, ell, line, rrect, star4, makeCanvas, iconURL, drawFirefly } from './art.js';
import { sky, sun, sea, palm, cactus, cloud, dune, iceberg, pine, factory, moon, stars, sparkles } from './scenery.js';
import { STORIES } from './story-data.js';
import { SPEAKERS, STR } from './i18n.js';
import { PALETTE as P, tr, rand } from './util.js';

const VW = 1600, VH = 900;
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ helpers
function put(g, x, y, s, fn) { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); }
function fillVis(g, v, color) { g.fillStyle = color; g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0); }
function skyVis(g, v, stops) { g.save(); g.translate(v.x0, v.y0); sky(g, v.x1 - v.x0, Math.max(10, 560 - v.y0), stops); g.restore(); }
function ground(g, v, y, color, top) {
  g.fillStyle = color; g.beginPath(); g.moveTo(v.x0, y + 20);
  for (let x = v.x0; x <= v.x1 + 40; x += 80) g.quadraticCurveTo(x + 20, y - 10, x + 40, y + 4);
  g.lineTo(v.x1 + 40, v.y1); g.lineTo(v.x0, v.y1); g.closePath(); g.fill();
  if (top) { g.fillStyle = top; g.fillRect(v.x0, y + 40, v.x1 - v.x0, 8); }
}
function seaVis(g, v, y, t, a, b) { g.save(); g.translate(v.x0, 0); sea(g, y, v.x1 - v.x0, v.y1, t, a, b); g.restore(); }
function fireflies(g, t, n = 10, seed = 5, area = [300, 150, 1300, 600]) {
  const R = rand(seed);
  for (let i = 0; i < n; i++) {
    const bx = area[0] + R() * (area[2] - area[0]), by = area[1] + R() * (area[3] - area[1]), ph = R() * 6;
    put(g, bx + Math.sin(t * 0.8 + ph) * 30, by + Math.cos(t * 1.1 + ph) * 18, 0.32, () => drawFirefly(g, 100, t + ph));
  }
}
function airship(g, t, withCortisol = true) {
  // zeppelin of Dr Cortisol: local origin = envelope centre
  ell(g, 0, 6, 250, 92, '#4b3f86');
  ell(g, 0, 0, 250, 90, '#6a5aa8');
  g.save(); g.beginPath(); g.ellipse(0, 0, 250, 90, 0, 0, TAU); g.clip();
  g.fillStyle = 'rgba(255,255,255,0.08)'; for (let x = -240; x < 260; x += 60) g.fillRect(x, -100, 26, 200);
  g.restore();
  ell(g, -70, -40, 120, 26, 'rgba(255,255,255,0.18)', -0.08);
  // fins
  g.fillStyle = '#4b3f86'; g.beginPath(); g.moveTo(200, -20); g.lineTo(290, -90); g.lineTo(270, -10); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(200, 20); g.lineTo(290, 90); g.lineTo(270, 10); g.closePath(); g.fill();
  // big C logo
  ell(g, -20, 0, 52, 52, P.gold);
  g.beginPath(); g.arc(-20, 0, 30, 0.8, TAU - 0.8); g.strokeStyle = P.night; g.lineWidth = 16; g.lineCap = 'round'; g.stroke();
  // ropes + gondola
  line(g, [[-80, 70], [-90, 206]], '#2a2440', 3); line(g, [[80, 70], [90, 206]], '#2a2440', 3);
  if (withCortisol) put(g, -6, 262, 0.95, () => drawCortisol(g, { t, mood: 'laugh', noShadow: true }));
  g.fillStyle = '#3a3352'; rrect(g, -110, 204, 220, 70, 16); g.fill();
  g.fillStyle = '#5f5684'; rrect(g, -100, 212, 200, 54, 12); g.fill();
  for (let i = 0; i < 3; i++) ell(g, -60 + i * 60, 239, 11, 11, Math.floor(t * 3 + i) % 2 ? '#ffd76a' : '#b8a0ff');
  // propeller
  const pr = Math.sin(t * 30);
  ell(g, -258, 0, 10, 14, '#3a3352'); ell(g, -268, 0, 6, 60 * Math.abs(pr) + 4, 'rgba(220,220,240,0.7)');
}
function tvScreen(g, t, mood) {
  g.fillStyle = '#3a3352'; g.fillRect(-12, 120, 24, 260);
  g.fillStyle = '#2a2440'; rrect(g, -200, -140, 400, 280, 26); g.fill();
  g.fillStyle = '#1b3b46'; rrect(g, -178, -118, 356, 236, 14); g.fill();
  g.save(); rrect(g, -178, -118, 356, 236, 14); g.clip();
  put(g, 0, 172, 1.4, () => drawCortisol(g, { t, mood, noShadow: true }));
  g.fillStyle = 'rgba(160,255,230,0.08)'; for (let y = -118; y < 120; y += 6) g.fillRect(-178, y + ((t * 40) % 6), 356, 2);
  g.restore();
  ell(g, -150, 126, 7, 7, Math.floor(t * 2) % 2 ? '#ff6b6b' : '#5a1f2a');
}
function penguin(g, t, ph = 0) {
  const b = Math.sin(t * 3 + ph) * 2;
  g.save(); g.translate(0, b);
  ell(g, 0, -40, 28, 42, '#2a2c44'); ell(g, 4, -36, 18, 32, '#f6fbff');
  ell(g, 12, -66, 9, 5, '#ffb347'); ell(g, -2, -72, 3, 4, '#fff'); ell(g, -1, -71, 1.6, 2.2, '#111');
  line(g, [[-8, -80], [4, -76]], '#111', 3);
  ell(g, -10, -2, 9, 4, '#ffb347'); ell(g, 10, -2, 9, 4, '#ffb347');
  g.restore();
}
function camel(g, t) {
  g.fillStyle = '#d69a58';
  ell(g, 0, -90, 80, 44, '#d69a58'); ell(g, -10, -128, 34, 30, '#c98a48');
  for (const x of [-50, -24, 30, 54]) { g.fillStyle = '#c98a48'; g.fillRect(x - 6, -60, 12, 60); }
  line(g, [[60, -100], [96, -160]], '#d69a58', 26);
  ell(g, 112, -170, 34, 20, '#d69a58');
  ell(g, 112, -178, 7, 4 + (Math.sin(t * 0.7) > 0.95 ? 0 : 1.5), '#3a1d08');
  line(g, [[104, -186], [120, -184]], '#3a1d08', 3);
  ell(g, 140, -164, 4, 3, '#3a1d08');
}
function hearts(g, t, x, y) {
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.4 + i / 4) % 1;
    g.globalAlpha = 1 - k;
    put(g, x + Math.sin(k * 6 + i) * 30, y - k * 160, 0.8 + k * 0.4, () => {
      g.fillStyle = P.coral; g.beginPath(); g.moveTo(0, 8); g.bezierCurveTo(-18, -6, -8, -20, 0, -10); g.bezierCurveTo(8, -20, 18, -6, 0, 8); g.fill();
    });
  }
  g.globalAlpha = 1;
}
function bigWord(g, text, x, y, size, rot = -0.04) {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.font = `${size}px "Lilita One", "Baloo 2", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = size * 0.22; g.strokeStyle = P.ink; g.strokeText(text, 0, size * 0.08); g.strokeText(text, 0, 0);
  const gr = g.createLinearGradient(0, -size / 2, 0, size / 2); gr.addColorStop(0, '#ffd25e'); gr.addColorStop(0.55, '#ff8a1e'); gr.addColorStop(1, '#d4500b');
  g.fillStyle = gr; g.fillText(text, 0, 0);
  g.restore();
}
function lab(g, v, t) {
  fillVis(g, v, '#2a2148');
  g.fillStyle = '#342a5c'; for (let x = Math.floor(v.x0 / 160) * 160; x < v.x1; x += 160) g.fillRect(x, v.y0, 70, 640 - v.y0);
  for (let i = 0; i < 4; i++) { line(g, [[v.x0, 140 + i * 40], [v.x1, 120 + i * 40]], i % 2 ? '#4b3f86' : '#5f5684', 14); }
  for (let i = 0; i < 6; i++) { const x = 200 + i * 240; ell(g, x, 200, 16, 16, Math.floor(t * 2 + i) % 3 ? '#7ad7c4' : '#ff6b6b'); }
  ground(g, v, 650, '#1c1640', '#4b3f86');
}
function beachDay(g, v, t, stops = ['#8fdcff', '#d9f6ff', '#fff1d0']) {
  skyVis(g, v, stops); fillVis(g, { ...v, y0: 500 }, '#ffe7b0');
  sun(g, 1260, 170, 60, '#fff1b0', t); cloud(g, 300 + (t * 8) % 300, 160, 1); cloud(g, 900 - (t * 5) % 200, 120, 0.7);
  seaVis(g, v, 470, t);
  ground(g, v, 600, '#f6e2a8');
}

// ------------------------------------------------------------------ scenes
const SCENES = {
  picnic(g, v, t) {
    beachDay(g, v, t);
    palm(g, 250, 640, 1.6, t, 0.25); palm(g, 1400, 650, 1.3, t, -0.2);
    g.fillStyle = P.coral; g.beginPath(); g.ellipse(820, 680, 230, 46, 0, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.ellipse(820, 680, 230, 46, 0, 0, TAU); g.clip();
    g.fillStyle = '#fff7dc'; for (let x = 590; x < 1060; x += 46) for (let y = 630; y < 730; y += 46) if (((x - 590) / 46 + (y - 630) / 46) % 2 < 1) g.fillRect(x, y, 23, 23);
    g.restore();
    put(g, 900, 650, 1, () => { g.fillStyle = '#b8792f'; rrect(g, -50, -50, 100, 60, 10); g.fill(); line(g, [[-40, -50], [0, -90], [40, -50]], '#8a5a2e', 6); g.fillStyle = '#fff7dc'; g.fillRect(-30, -62, 30, 14); });
    put(g, 660, 690, 2.4, () => drawLumen(g, { t, pose: 'stand', mood: 'happy' }));
    put(g, 1040, 690, 2.3, () => drawZina(g, { t, flip: true, mood: 'normal' }));
    fireflies(g, t, 6, 3);
  },
  cortisol_arrives(g, v, t) {
    skyVis(g, v, ['#3b2d7a', '#8a5aa8', '#e98c73']); fillVis(g, { ...v, y0: 500 }, '#e8c08a');
    sun(g, 300, 380, 50, '#ffc193', t);
    seaVis(g, v, 470, t, '#7d6aa8', '#3b2d7a');
    ground(g, v, 600, '#e8c08a');
    put(g, 1060, 190 + Math.sin(t * 1.4) * 14, 0.95, () => airship(g, t));
    put(g, 470, 690, 2.3, () => drawLumen(g, { t, pose: 'shock' }));
    put(g, 640, 690, 2.2, () => drawZina(g, { t, pose: 'shock' }));
    put(g, 1060, 560, 1, () => { for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - k; g.strokeStyle = P.comet; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 80 + k * 300, 20 + k * 80, 0, 0, TAU); g.stroke(); } g.globalAlpha = 1; });
  },
  kidnap(g, v, t) {
    skyVis(g, v, ['#3b2d7a', '#8a5aa8', '#e98c73']); fillVis(g, { ...v, y0: 500 }, '#e8c08a');
    seaVis(g, v, 470, t, '#7d6aa8', '#3b2d7a');
    ground(g, v, 600, '#e8c08a');
    const lift = (t * 30) % 60;
    const sy = 110 + Math.sin(t * 1.2) * 10;
    put(g, 1180, sy, 0.7, () => airship(g, t));
    const cx = 1060, cy = 560 - lift;
    line(g, [[1180, sy + 190], [cx, cy - 250]], '#2a2440', 4);
    put(g, cx, cy, 2.1, () => { g.rotate(Math.sin(t * 3) * 0.1); drawZina(g, { t, pose: 'shock', noShadow: true }); });
    line(g, [[cx - 40, cy - 170], [cx - 50, cy - 230], [cx, cy - 250], [cx + 50, cy - 230], [cx + 40, cy - 170]], '#8a7fb0', 9);
    put(g, cx + 110, cy - 60, 0.9, () => { g.fillStyle = '#b8792f'; rrect(g, -50, -50, 100, 60, 10); g.fill(); });
    put(g, 560, 690, 2.4, () => drawLumen(g, { t, pose: 'jump', mood: 'shock' }));
    for (let i = 0; i < 4; i++) line(g, [[700, 380 + i * 30], [780 + Math.sin(t * 10 + i) * 10, 360 + i * 30]], 'rgba(255,255,255,0.6)', 4);
  },
  oku_appears(g, v, t) {
    beachDay(g, v, t, ['#7fd4c8', '#c9f3e6', '#fff1d0']);
    palm(g, 260, 640, 1.5, t, 0.2);
    put(g, 940, 690, 1, () => { for (const [x, y, r] of [[-90, 0, 0.4], [80, -10, -0.5], [-30, 10, 1.1], [40, 6, 0.2]]) { g.save(); g.translate(x, y); g.rotate(r); drawCrate(g, 60); g.restore(); } });
    const glow = g.createRadialGradient(940, 420, 10, 940, 420, 260); glow.addColorStop(0, 'rgba(255,240,170,0.75)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(940, 420, 260, 0, TAU); g.fill();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.3; line(g, [[940 + Math.cos(a) * 150, 420 + Math.sin(a) * 150], [940 + Math.cos(a) * 220, 420 + Math.sin(a) * 220]], 'rgba(255,246,200,0.6)', 5); }
    put(g, 940, 420, 2.9, () => drawOku(g, { t, mood: 'talk' }));
    put(g, 520, 690, 2.4, () => drawLumen(g, { t, pose: 'shock' }));
    sparkles(g, VW, 700, t, 20, 9);
  },
  departure(g, v, t) {
    skyVis(g, v, ['#ffc193', '#ffe2b8', '#b5f3d0']);
    sun(g, 1150, 470, 90, '#fff1b0', t);
    seaVis(g, v, 480, t, '#7cc6c8', '#2a7f8f');
    const isl = [[880, '#7cb88e'], [1080, '#e6b072'], [1290, '#cfe3f0'], [1460, '#8a7fb0']];
    for (const [x, c] of isl) { g.fillStyle = c; g.beginPath(); g.ellipse(x, 490, 70, 26, 0, Math.PI, TAU); g.fill(); }
    g.fillStyle = '#7a8a6a'; g.beginPath(); g.ellipse(560, 720, 300, 120, 0, Math.PI, TAU); g.fill();
    fillVis(g, { ...v, y0: 720 }, '#7a8a6a');
    put(g, 540, 640, 2.5, () => drawLumen(g, { t, pose: 'point', mood: 'determined' }));
    put(g, 380, 420, 1.4, () => drawOku(g, { t, mood: 'talk', look: 1 }));
    for (let i = 0; i < 5; i++) { const k = (t * 0.6 + i / 5) % 1; line(g, [[200 + k * 1300, 300 + i * 50], [260 + k * 1300, 300 + i * 50]], 'rgba(255,255,255,0.5)', 3); }
  },
  monitor_desert(g, v, t) {
    skyVis(g, v, ['#ffb36b', '#ffd7a0', '#fff1d0']); fillVis(g, { ...v, y0: 520 }, '#f0bf6e');
    sun(g, 300, 160, 70, '#fff3c0', t);
    dune(g, 300, 600, 400, 120, '#e6a75a'); dune(g, 1300, 600, 500, 160, '#e0a050');
    ground(g, v, 610, '#f0bf6e');
    cactus(g, 220, 660, 1.6);
    put(g, 1080, 330, 1, () => tvScreen(g, t, 'stressed'));
    put(g, 540, 690, 2.4, () => drawLumen(g, { t, pose: 'stand', mood: 'determined' }));
    put(g, 690, 450, 1.3, () => drawOku(g, { t, mood: 'laugh', look: 1 }));
  },
  oku_desert(g, v, t) {
    skyVis(g, v, ['#ffb36b', '#ffd7a0', '#fff1d0']); fillVis(g, { ...v, y0: 520 }, '#f0bf6e');
    sun(g, 1300, 150, 70, '#fff3c0', t);
    dune(g, 200, 600, 400, 140, '#e6a75a'); dune(g, 1100, 600, 450, 110, '#e0a050');
    ground(g, v, 610, '#f0bf6e');
    put(g, 1150, 660, 1.5, () => camel(g, t));
    cactus(g, 1420, 650, 1.3);
    put(g, 520, 690, 2.4, () => drawLumen(g, { t, pose: 'stand' }));
    put(g, 800, 420, 2.2, () => drawOku(g, { t, mood: 'talk' }));
  },
  monitor_ice(g, v, t) {
    skyVis(g, v, ['#9fd0f0', '#d8efff', '#f4fbff']); fillVis(g, { ...v, y0: 520 }, '#eaf6ff');
    iceberg(g, 220, 600, 2.2); iceberg(g, 1420, 600, 1.6);
    ground(g, v, 610, '#f4fbff');
    put(g, 1060, 330, 1, () => tvScreen(g, t, 'evil'));
    put(g, 540, 690, 2.4, () => { g.translate(Math.sin(t * 40) * 1.5, 0); drawLumen(g, { t, pose: 'sad', mood: 'sad' }); });
    snow(g, v, t);
  },
  ice_arrival(g, v, t) {
    skyVis(g, v, ['#9fd0f0', '#d8efff', '#f4fbff']); fillVis(g, { ...v, y0: 520 }, '#eaf6ff');
    pine(g, 180, 630, 2.4); pine(g, 1450, 620, 2); iceberg(g, 760, 560, 1.4);
    ground(g, v, 610, '#f4fbff');
    for (const [x, ph] of [[1000, 0], [1130, 1], [1260, 2]]) put(g, x, 690, 1.7, () => { g.scale(-1, 1); penguin(g, t, ph); });
    put(g, 560, 690, 2.4, () => { g.translate(Math.sin(t * 40) * 1.5, 0); drawLumen(g, { t, pose: 'stand', mood: 'shock' }); });
    put(g, 400, 440, 1.3, () => drawOku(g, { t, mood: 'laugh' }));
    snow(g, v, t);
  },
  factory_view(g, v, t) {
    skyVis(g, v, ['#1c1640', '#4b3f86', '#a07ab8']);
    stars(g, VW, 300, t, 40, 4);
    moon(g, 1350, 140, 46, '#e9dcff');
    factory(g, 900, 560, 3, t); factory(g, 1300, 560, 2.2, t + 1); factory(g, 600, 560, 1.6, t + 2);
    fillVis(g, { ...v, y0: 560 }, '#3a3352');
    g.fillStyle = '#5c5380'; g.beginPath(); g.moveTo(v.x0, 720); g.lineTo(560, 640); g.lineTo(700, 760); g.lineTo(v.x0, v.y1); g.closePath(); g.fill();
    g.fillStyle = '#2a2440'; g.beginPath(); g.moveTo(v.x0, 690); g.lineTo(520, 660); g.lineTo(620, v.y1); g.lineTo(v.x0, v.y1); g.closePath(); g.fill();
    put(g, 400, 670, 2.2, () => drawLumen(g, { t, pose: 'stand', mood: 'determined' }));
    put(g, 260, 460, 1.2, () => drawOku(g, { t, mood: 'talk', look: 1 }));
  },
  cortisol_lab(g, v, t) {
    lab(g, v, t);
    put(g, 400, 690, 1, () => { put(g, 0, 0, 1.9, () => drawZina(g, { t, pose: 'sad', mood: 'sad' })); g.strokeStyle = '#8a7fb0'; g.lineWidth = 8; for (let x = -100; x <= 100; x += 33) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x, -260); g.stroke(); } rrect(g, -110, -280, 220, 300, 20); g.stroke(); });
    put(g, 1170, 700, 1.7, () => drawStressotron(g, { t }));
    put(g, 790, 700, 2.1, () => drawCortisol(g, { t, mood: 'laugh' }));
  },
  stressotron_broken(g, v, t) {
    lab(g, v, t);
    put(g, 900, 700, 2.1, () => drawStressotron(g, { t, broken: true }));
    put(g, 420, 690, 2.4, () => drawLumen(g, { t, pose: 'victory' }));
    put(g, 300, 400, 1.2, () => drawOku(g, { t, mood: 'laugh' }));
  },
  cortisol_flee(g, v, t) {
    skyVis(g, v, ['#3b2d7a', '#e98c73', '#ffc193']); fillVis(g, { ...v, y0: 520 }, '#e8c08a');
    seaVis(g, v, 500, t, '#7d6aa8', '#3b2d7a');
    ground(g, v, 630, '#e8c08a');
    const k = (t * 0.12) % 1;
    const rx = 600 + k * 900, ry = 520 - k * 420;
    for (let i = 1; i < 14; i++) { g.globalAlpha = 0.5 * (1 - i / 14); ell(g, rx - i * 34, ry + i * 16, 14 + i * 3, 12 + i * 2, '#fff7dc'); }
    g.globalAlpha = 1;
    put(g, rx, ry, 1, () => {
      g.rotate(-0.42);
      g.fillStyle = '#c99a5c'; rrect(g, -90, -34, 170, 68, 30); g.fill();
      g.fillStyle = P.coral; g.beginPath(); g.moveTo(80, -30); g.lineTo(130, 0); g.lineTo(80, 30); g.closePath(); g.fill();
      ell(g, -100, 0, 18 + Math.random() * 6, 12, '#ffb347');
      put(g, 0, -10, 0.55, () => drawCortisol(g, { t, mood: 'stressed', noShadow: true }));
    });
    put(g, 520, 700, 2.1, () => drawLumen(g, { t, pose: 'wave' }));
    put(g, 680, 700, 2, () => drawZina(g, { t, pose: 'wave' }));
  },
  reunion(g, v, t) {
    beachDay(g, v, t, ['#ffc193', '#ffe2b8', '#fff1d0']);
    palm(g, 260, 640, 1.6, t, 0.25); palm(g, 1360, 650, 1.5, t, -0.25);
    put(g, 720, 690, 2.5, () => drawLumen(g, { t, pose: 'victory' }));
    put(g, 900, 690, 2.4, () => drawZina(g, { t, pose: 'hug', mood: 'happy', flip: true }));
    hearts(g, t, 810, 380);
    put(g, 1120, 380, 1.4, () => drawOku(g, { t, mood: 'laugh', look: -1 }));
    fireflies(g, t, 8, 11);
  },
  fin(g, v, t) {
    skyVis(g, v, ['#1c1640', '#3b2d7a', '#e98c73']);
    stars(g, VW, 400, t, 70, 12);
    fireflies(g, t, 16, 21, [200, 120, 1400, 640]);
    ground(g, v, 640, '#2a2148');
    put(g, 800, 700, 2.3, () => drawLumen(g, { t, pose: 'victory' }));
    put(g, 580, 700, 2.1, () => drawZina(g, { t, pose: 'wave' }));
    put(g, 1040, 500, 1.3, () => drawOku(g, { t, mood: 'laugh' }));
    bigWord(g, tr({ fr: 'FIN', en: 'THE END' }, this.lang), 800, 280, 150);
  },
  golden_moon(g, v, t) {
    skyVis(g, v, ['#0f0b2a', '#1c1640', '#3b2d7a']);
    stars(g, VW, 500, t, 90, 31);
    const rise = Math.min(1, t / 3);
    moon(g, 820, 520 - rise * 160, 170, '#ffd76a');
    seaVis(g, v, 520, t, '#2a2366', '#140f3a');
    ground(g, v, 640, '#1c1640');
    put(g, 470, 700, 2.3, () => drawLumen(g, { t, pose: 'shock' }));
    put(g, 640, 470, 1.3, () => drawOku(g, { t, mood: 'talk', look: 1 }));
  },
  golden_cortisol(g, v, t) {
    fillVis(g, v, '#140f3a');
    const gl = g.createRadialGradient(800, 400, 30, 800, 400, 700); gl.addColorStop(0, '#ffe9a6'); gl.addColorStop(0.35, '#b8862b'); gl.addColorStop(1, '#140f3a');
    g.fillStyle = gl; g.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + t * 0.15; line(g, [[800, 400], [800 + Math.cos(a) * 1200, 400 + Math.sin(a) * 1200]], 'rgba(255,240,180,0.12)', 40); }
    ground(g, v, 660, '#2a2148');
    put(g, 800, 720, 2.5, () => drawCortisol(g, { t, mood: 'laugh', golden: true }));
    sparkles(g, VW, 700, t, 30, 17, '#fff6c8');
  },
  hammock(g, v, t) {
    beachDay(g, v, t, ['#ffc193', '#ffe2b8', '#fff1d0']);
    palm(g, 700, 660, 1.7, t, -0.15); palm(g, 1300, 660, 1.7, t, 0.15);
    const sw = Math.sin(t * 1.2) * 10;
    put(g, 1000 + sw, 566, 1.25, () => drawCortisol(g, { t, mood: 'relaxed', golden: true, noShadow: true }));
    g.fillStyle = P.coral; g.beginPath(); g.moveTo(690, 440); g.quadraticCurveTo(1000 + sw, 640, 1290, 440); g.quadraticCurveTo(1000 + sw, 560, 690, 440); g.fill();
    g.strokeStyle = '#fff7dc'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(760 + i * 110, 470 + Math.abs(2 - i) * -12); g.lineTo(780 + i * 110 + sw * 0.5, 540 - Math.abs(2 - i) * 18); g.stroke(); }
    put(g, 360, 690, 2.3, () => drawLumen(g, { t, pose: 'stand', mood: 'happy' }));
    put(g, 520, 690, 2.2, () => drawZina(g, { t, pose: 'stand', mood: 'normal' }));
    put(g, 200, 430, 1.2, () => drawOku(g, { t, mood: 'talk', look: 1 }));
  },
  true_end(g, v, t) {
    skyVis(g, v, ['#0f0b2a', '#1c1640', '#3b2d7a']);
    stars(g, VW, 500, t, 80, 41);
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.5 + i * 0.27) % 1, cx = 300 + i * 340, cy = 260 - (i % 2) * 60;
      const cols = [P.coral, P.gold, P.aurora, P.comet];
      for (let j = 0; j < 14; j++) { const a = j / 14 * TAU; g.globalAlpha = 1 - k; star4(g, cx + Math.cos(a) * k * 160, cy + Math.sin(a) * k * 160 + k * k * 40, 7, cols[i]); }
    }
    g.globalAlpha = 1;
    ground(g, v, 640, '#2a2148');
    put(g, 640, 700, 2.2, () => drawLumen(g, { t, pose: 'victory' }));
    put(g, 820, 700, 2.1, () => drawZina(g, { t, pose: 'wave' }));
    put(g, 1060, 700, 1.3, () => drawCortisol(g, { t, mood: 'relaxed', golden: true }));
    put(g, 420, 520, 1.2, () => drawOku(g, { t, mood: 'laugh' }));
    bigWord(g, tr({ fr: 'VRAIE FIN', en: 'TRUE ENDING' }, this.lang), 800, 290, 120);
  },
};
function snow(g, v, t) {
  const R = rand(77);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 70; i++) {
    const x = v.x0 + ((R() * (v.x1 - v.x0) + t * (20 + R() * 30)) % (v.x1 - v.x0));
    const y = v.y0 + ((R() * 900 + t * (60 + R() * 60)) % 900);
    g.beginPath(); g.arc(x, y, 2 + R() * 3, 0, TAU); g.fill();
  }
}

// ------------------------------------------------------------------ player
export function playStory(env, id) {
  const panels = STORIES[id];
  if (!panels || !panels.length) return Promise.resolve();
  const { root, nav, save } = env;
  const lang = () => save.lang || 'fr';
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'lb-story lb-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Cinématique');
    el.innerHTML = `
      <div class="lb-story-frame"></div>
      <button class="lb-btn lb-btn-ghost lb-story-skip" type="button"><span></span> <b aria-hidden="true">▸▸</b></button>
      <div class="lb-story-box">
        <div class="lb-story-who"><img alt="" /><span></span></div>
        <p class="lb-story-text" aria-live="polite"></p>
        <div class="lb-story-foot"><div class="lb-story-dots"></div><span class="lb-story-next" aria-hidden="true">▼</span></div>
      </div>`;
    root.appendChild(el);
    const cv = makeCanvas('lb-story-canvas', 1.5);
    el.querySelector('.lb-story-frame').appendChild(cv.canvas);
    const skipBtn = el.querySelector('.lb-story-skip');
    skipBtn.querySelector('span').textContent = tr(STR.skip, lang());
    const whoImg = el.querySelector('.lb-story-who img');
    const whoName = el.querySelector('.lb-story-who span');
    const textEl = el.querySelector('.lb-story-text');
    const dots = el.querySelector('.lb-story-dots');
    const box = el.querySelector('.lb-story-box');
    dots.innerHTML = panels.map(() => '<i></i>').join('');
    let idx = -1, typed = 0, full = '', time = 0, panelT = 0, closing = false, fade = 0, lastDt = 1 / 60;
    const reduce = () => !!save.settings?.reduceMotion;
    const CPS = 48;

    function show(i) {
      idx = i; typed = 0; panelT = 0;
      const p = panels[i];
      full = tr(p.text, lang());
      const sp = p.speaker || 'narrator';
      box.dataset.speaker = sp;
      whoName.textContent = tr(SPEAKERS[sp], lang());
      const icon = { lumen: 'lumen', zina: 'zina', oku: 'oku', cortisol: 'cortisol' }[sp];
      if (icon) { whoImg.src = iconURL(icon + (sp === 'cortisol' && /golden|hammock/.test(p.scene) ? '' : ''), 128); whoImg.hidden = false; } else whoImg.hidden = true;
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
      textEl.textContent = '';
      box.classList.remove('is-done');
      box.classList.remove('lb-pop'); void box.offsetWidth; box.classList.add('lb-pop');
      if (reduce()) typed = full.length;
      if (i > 0 && panels[i - 1].scene !== p.scene) fade = 1;
    }
    function advance() {
      if (closing) return;
      if (typed < full.length) { typed = full.length; return; }
      env.sfx('menu_ok');
      if (idx + 1 < panels.length) show(idx + 1); else finish();
    }
    function finish() {
      if (closing) return;
      closing = true;
      pop();
      el.classList.add('lb-out');
      setTimeout(() => { el.remove(); resolve(); }, 260);
    }
    const pop = nav.push({
      tick(dt) {
        time += dt; panelT += dt; lastDt = dt;
        if (typed < full.length) {
          const before = Math.floor(typed);
          typed = Math.min(full.length, typed + dt * CPS);
          if (Math.floor(typed) !== before) textEl.textContent = full.slice(0, Math.floor(typed));
          if (typed >= full.length) { textEl.textContent = full; box.classList.add('is-done'); }
        } else if (!box.classList.contains('is-done')) { textEl.textContent = full; box.classList.add('is-done'); }
        draw();
      },
      onConfirm: advance,
      onBack: finish,
      onPause: finish,
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.lb-story-skip')) return;
      e.preventDefault();
      advance();
    });
    skipBtn.addEventListener('click', (e) => { e.stopPropagation(); finish(); });

    function draw() {
      cv.resize();
      const { g, w, h } = cv;
      const boxH = box.getBoundingClientRect().height || 140;
      const areaH = Math.max(120, h - boxH * 0.72);
      const s = Math.max(w / VW, areaH / VH);
      const ox = (w - VW * s) / 2;
      const oy = areaH - 770 * s;
      const v = { x0: -ox / s, x1: (w - ox) / s, y0: -oy / s, y1: (h - oy) / s };
      g.save();
      g.translate(ox, oy); g.scale(s, s);
      const scene = SCENES[panels[idx]?.scene] || SCENES.picnic;
      try { scene.call({ lang: lang() }, g, v, time); } catch (err) { console.error('[story]', err); }
      g.restore();
      if (fade > 0) { g.fillStyle = `rgba(28,22,64,${fade})`; g.fillRect(0, 0, w, h); fade = Math.max(0, fade - lastDt * 3.5); }
      // comic halftone vignette
      const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.4, w / 2, h * 0.45, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(28,22,64,0)'); vg.addColorStop(1, 'rgba(28,22,64,0.45)');
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    }
    show(0);
  });
}

export const STORY_SCENES = Object.keys(SCENES);
export const __SCENES = SCENES; // dev tools only
