// Crate & pickup art: canvas textures, shared geometries and materials (module caches, never per entity).
// Everything is procedural. Faces are painted on a 256-unit canvas (128 px on low quality).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SOCK_COLORS } from './crate-logic.js';

let PX = 256;
/** Pick texture resolution once (first level decides). */
export function setArtQuality(level) { if (!texCache.size) PX = level === 0 ? 128 : 256; }

const FONT = '"Baloo 2", "Trebuchet MS", "Arial Black", system-ui, sans-serif';
const texCache = new Map();

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function canvasTex(key, draw, { w = 256, h = 256, scale = PX / 256 } = {}) {
  let t = texCache.get(key);
  if (t) return t;
  const c = makeCanvas(Math.round(w * scale), Math.round(h * scale));
  const g = c.getContext('2d');
  g.scale(scale, scale);
  draw(g, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// deterministic pseudo random for wood grain
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ painting helpers
function wood(g, { base = '#d98c3a', dark = '#8e4c1c', light = '#f0ae5a', frame = '#b86a28', seed = 7 } = {}) {
  const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // inner planks (horizontal)
  for (let i = 0; i < 5; i++) {
    const y = 26 + i * 40.8;
    g.fillStyle = i % 2 ? base : shade(base, 0.92 + r() * 0.1);
    g.fillRect(26, y, 204, 41);
    g.strokeStyle = shade(dark, 1.1); g.globalAlpha = 0.35; g.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) {
      const yy = y + 6 + r() * 30;
      g.beginPath(); g.moveTo(26, yy);
      g.bezierCurveTo(90, yy + (r() - 0.5) * 8, 160, yy + (r() - 0.5) * 8, 230, yy + (r() - 0.5) * 4);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = dark; g.fillRect(26, y + 39, 204, 3);
    g.fillStyle = light; g.globalAlpha = 0.35; g.fillRect(26, y + 1, 204, 3); g.globalAlpha = 1;
  }
  // frame boards
  g.fillStyle = frame;
  g.fillRect(0, 0, 256, 26); g.fillRect(0, 230, 256, 26); g.fillRect(0, 0, 26, 256); g.fillRect(230, 0, 26, 256);
  g.fillStyle = light; g.globalAlpha = 0.45;
  g.fillRect(0, 0, 256, 4); g.fillRect(0, 0, 4, 256);
  g.globalAlpha = 1;
  g.strokeStyle = dark; g.lineWidth = 4;
  g.strokeRect(2, 2, 252, 252); g.strokeRect(26, 26, 204, 204);
}

function corners(g, color = '#9aa3a8', dark = '#4b5257') {
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [256, 0, -1, 1], [0, 256, 1, -1], [256, 256, -1, -1]]) {
    g.save(); g.translate(x, y); g.scale(sx, sy);
    g.fillStyle = color; g.strokeStyle = dark; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(58, 0); g.lineTo(58, 16); g.lineTo(16, 16); g.lineTo(16, 58); g.lineTo(0, 58); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = dark;
    for (const [nx, ny] of [[8, 8], [40, 8], [8, 40]]) { g.beginPath(); g.arc(nx, ny, 3.4, 0, 7); g.fill(); }
    g.restore();
  }
}

function nails(g, color = '#5a3414') {
  g.fillStyle = color;
  for (const [x, y] of [[13, 128], [243, 128], [128, 13], [128, 243]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) * k) | 0, gg = Math.min(255, ((n >> 8) & 255) * k) | 0, b = Math.min(255, (n & 255) * k) | 0;
  return `rgb(${r},${gg},${b})`;
}

function bigText(g, str, { x = 128, y = 132, px = 150, fill = '#4a2410', stroke = null, lw = 10, alpha = 0.9, font = FONT, weight = 900 } = {}) {
  g.save();
  g.globalAlpha = alpha;
  g.font = `${weight} ${px}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = stroke; g.strokeText(str, x, y); }
  g.fillStyle = fill; g.fillText(str, x, y);
  g.restore();
}

function firefly(g, x, y, s, color = '#4a2410', glow = null) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (glow) {
    const gr = g.createRadialGradient(0, 14, 2, 0, 14, 34);
    gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 14, 34, 0, 7); g.fill();
  }
  g.fillStyle = color; g.strokeStyle = color; g.lineWidth = 3;
  // wings
  g.globalAlpha *= 0.75;
  g.beginPath(); g.ellipse(-16, -8, 17, 9, -0.5, 0, 7); g.fill();
  g.beginPath(); g.ellipse(16, -8, 17, 9, 0.5, 0, 7); g.fill();
  g.globalAlpha /= 0.75;
  // body + glowing tail
  g.beginPath(); g.ellipse(0, -4, 7, 12, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(0, -19, 6, 0, 7); g.fill();
  g.beginPath(); g.arc(0, 15, 11, 0, 7);
  if (glow) { g.fillStyle = '#ffe066'; g.fill(); g.strokeStyle = color; g.stroke(); g.fillStyle = color; } else g.fill();
  // antennae
  g.beginPath(); g.moveTo(-2, -23); g.quadraticCurveTo(-8, -34, -13, -33); g.moveTo(2, -23); g.quadraticCurveTo(8, -34, 13, -33); g.stroke();
  g.restore();
}

function lumenHead(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineJoin = 'round'; g.strokeStyle = '#1c1640'; g.lineWidth = 5;
  // ears
  g.fillStyle = '#3fc1b4';
  for (const sx of [-1, 1]) {
    g.beginPath(); g.moveTo(sx * 18, -30); g.lineTo(sx * 52, -78); g.lineTo(sx * 50, -18); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffd1c1'; g.beginPath(); g.moveTo(sx * 24, -32); g.lineTo(sx * 46, -66); g.lineTo(sx * 44, -26); g.closePath(); g.fill();
    g.fillStyle = '#3fc1b4';
  }
  // head
  g.beginPath(); g.ellipse(0, 0, 54, 46, 0, 0, 7); g.fill(); g.stroke();
  // muzzle
  g.fillStyle = '#fff6ea';
  g.beginPath(); g.moveTo(-34, 6); g.quadraticCurveTo(0, 56, 34, 6); g.quadraticCurveTo(0, 22, -34, 6); g.fill();
  // eyes
  for (const sx of [-1, 1]) {
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(sx * 19, -8, 11, 14, 0, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#1c1640'; g.beginPath(); g.arc(sx * 17, -5, 6, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * 15, -8, 2, 0, 7); g.fill();
  }
  // nose + grin
  g.fillStyle = '#1c1640'; g.beginPath(); g.ellipse(0, 14, 7, 5, 0, 0, 7); g.fill();
  g.beginPath(); g.lineWidth = 3.5; g.moveTo(-14, 24); g.quadraticCurveTo(0, 36, 14, 24); g.stroke();
  // coral scarf
  g.fillStyle = '#ff7f6a'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-44, 36); g.quadraticCurveTo(0, 58, 44, 36); g.lineTo(46, 52); g.quadraticCurveTo(0, 74, -46, 52); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function okuMask(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.lineJoin = 'round'; g.strokeStyle = '#2a160a'; g.lineWidth = 5;
  // feathers
  const fc = ['#ff5a5a', '#ffd34a', '#4ad66a', '#4a8cff', '#ff7aa8'];
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    g.save(); g.rotate(a); g.fillStyle = fc[i];
    g.beginPath(); g.ellipse(0, -70, 11, 30, 0, 0, 7); g.fill(); g.stroke(); g.restore();
  }
  // cardboard face
  g.fillStyle = '#c98a4a';
  g.beginPath(); g.moveTo(-40, -50); g.quadraticCurveTo(0, -66, 40, -50); g.lineTo(46, 30); g.quadraticCurveTo(0, 74, -46, 30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#e3a865'; g.beginPath(); g.ellipse(0, -30, 30, 10, 0, 0, 7); g.fill();
  // googly eyes
  for (const [sx, px] of [[-1, 4], [1, -3]]) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(sx * 20, -14, 15, 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(sx * 20 + px, -10, 7, 0, 7); g.fill();
  }
  // zigzag mouth
  g.fillStyle = '#2a160a';
  g.beginPath(); g.moveTo(-28, 22); for (let i = 0; i <= 8; i++) g.lineTo(-28 + i * 7, 22 + (i % 2 ? 10 : 0)); g.lineTo(28, 36); g.lineTo(-28, 36); g.closePath(); g.fill();
  g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(-24 + i * 14, 26, 6, 6);
  g.restore();
}

function arrows(g, color = '#ffd34a', stroke = '#5a3414') {
  g.save(); g.lineJoin = 'round'; g.lineWidth = 8; g.strokeStyle = stroke; g.fillStyle = color;
  for (const y of [70, 140]) {
    g.beginPath(); g.moveTo(128, y - 40); g.lineTo(196, y + 22); g.lineTo(166, y + 22); g.lineTo(128, y - 12); g.lineTo(90, y + 22); g.lineTo(60, y + 22); g.closePath();
    g.stroke(); g.fill();
  }
  g.restore();
}

function metal(g, { base = '#8f989f', light = '#c4ccd1', dark = '#4b5257' } = {}) {
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, light); gr.addColorStop(0.5, base); gr.addColorStop(1, dark);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = shade(base, 0.85); g.fillRect(30, 30, 196, 196);
  g.strokeStyle = dark; g.lineWidth = 5; g.strokeRect(3, 3, 250, 250); g.strokeRect(30, 30, 196, 196);
  g.strokeStyle = light; g.lineWidth = 2; g.strokeRect(33, 33, 190, 190);
  g.fillStyle = dark;
  for (let i = 0; i < 6; i++) for (const [x, y] of [[15, 15 + i * 45], [241, 15 + i * 45], [15 + i * 45, 15], [15 + i * 45, 241]]) {
    g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
  }
  g.fillStyle = light;
  for (let i = 0; i < 6; i++) for (const [x, y] of [[14, 14 + i * 45], [240, 14 + i * 45], [14 + i * 45, 14], [14 + i * 45, 240]]) {
    g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
  }
}

function boumBand(g, label, { bg = '#ffd34a', fg = '#1c1640', px = 74 } = {}) {
  g.save();
  g.fillStyle = bg; g.strokeStyle = '#1c1640'; g.lineWidth = 6;
  g.beginPath(); g.rect(20, 82, 216, 92); g.fill(); g.stroke();
  // hazard stripes only at the very ends of the band
  g.fillStyle = '#1c1640';
  for (const x0 of [20, 214]) {
    g.save(); g.beginPath(); g.rect(x0, 82, 22, 92); g.clip();
    for (let i = -1; i < 5; i++) { g.beginPath(); g.moveTo(x0 - 10, 102 + i * 24); g.lineTo(x0 + 32, 82 + i * 24); g.lineTo(x0 + 32, 92 + i * 24); g.lineTo(x0 - 10, 112 + i * 24); g.fill(); }
    g.restore();
  }
  g.strokeRect(20, 82, 216, 92);
  g.save();
  g.font = `900 ${px}px ${FONT}`;
  const w = g.measureText(label).width;
  g.restore();
  bigText(g, label, { y: 131, px: w > 160 ? Math.floor(px * 160 / w) : px, fill: fg, alpha: 1 });
  g.restore();
}

// ------------------------------------------------------------------ crate faces
const FACES = {
  basic: (g) => { wood(g); corners(g); nails(g); firefly(g, 128, 128, 1.4, 'rgba(74,36,16,0.82)', 'rgba(255,230,120,0.55)'); },
  lights: (g) => { wood(g, { seed: 11 }); corners(g); bigText(g, '?', { px: 190, fill: '#fff1b0', stroke: '#4a2410', lw: 14, alpha: 1 }); firefly(g, 196, 196, 0.6, '#4a2410'); },
  bounce: (g) => {
    wood(g, { seed: 3 });
    g.fillStyle = '#9aa3a8'; g.fillRect(0, 0, 256, 22); g.fillRect(0, 234, 256, 22);
    g.strokeStyle = '#4b5257'; g.lineWidth = 3; g.strokeRect(0, 0, 256, 22); g.strokeRect(0, 234, 256, 22);
    arrows(g);
  },
  life: (g) => { wood(g, { seed: 5 }); corners(g); lumenHead(g, 128, 140, 1.25); },
  mask: (g) => { wood(g, { seed: 9 }); corners(g); okuMask(g, 128, 150, 1.05); },
  checkpoint: (g) => {
    wood(g, { seed: 13 }); corners(g, '#ffd76a', '#8a6a10');
    g.fillStyle = '#fff1c4'; g.strokeStyle = '#4a2410'; g.lineWidth = 8;
    g.beginPath(); g.arc(128, 128, 78, 0, 7); g.fill(); g.stroke();
    bigText(g, 'C', { px: 150, fill: '#e04a3a', stroke: '#4a2410', lw: 8, alpha: 1, y: 136 });
  },
  iron: (g) => {
    metal(g);
    g.strokeStyle = '#5c656b'; g.lineWidth = 16; g.beginPath(); g.moveTo(44, 44); g.lineTo(212, 212); g.moveTo(212, 44); g.lineTo(44, 212); g.stroke();
    g.strokeStyle = '#b6bec4'; g.lineWidth = 4; g.beginPath(); g.moveTo(44, 38); g.lineTo(218, 212); g.stroke();
  },
  ironBounce: (g) => { metal(g); arrows(g, '#ffd34a', '#1c1640'); },
  tnt: (g) => { wood(g, { base: '#d8452e', frame: '#a82e1c', dark: '#5a1408', light: '#ff8a6a', seed: 17 }); corners(g, '#2a2a2a', '#000'); boumBand(g, 'BOUM'); },
  tnt3: (g) => { wood(g, { base: '#e8553a', frame: '#b8301c', dark: '#5a1408', light: '#ffaa8a', seed: 17 }); corners(g, '#2a2a2a', '#000'); boumBand(g, '3', { px: 120, bg: '#fff1c4' }); },
  tnt2: (g) => { wood(g, { base: '#e8553a', frame: '#b8301c', dark: '#5a1408', light: '#ffaa8a', seed: 17 }); corners(g, '#2a2a2a', '#000'); boumBand(g, '2', { px: 120, bg: '#ffe08a' }); },
  tnt1: (g) => { wood(g, { base: '#ff6a40', frame: '#c8301c', dark: '#5a1408', light: '#ffc0a0', seed: 17 }); corners(g, '#2a2a2a', '#000'); boumBand(g, '1', { px: 120, bg: '#ff5a3a', fg: '#fff' }); },
  nitro: (g) => {
    g.fillStyle = '#1f4a1c'; g.fillRect(0, 0, 256, 256);
    wood(g, { base: '#2f6b2a', frame: '#244f20', dark: '#0e260c', light: '#5aa04a', seed: 23 });
    g.save(); g.shadowColor = '#9dff6a'; g.shadowBlur = 18;
    bigText(g, 'PAF', { px: 96, fill: '#b6ff7a', stroke: '#0e260c', lw: 10, alpha: 1, y: 134 });
    g.restore();
    g.strokeStyle = '#b6ff7a'; g.lineWidth = 3;
    for (const [x, y] of [[44, 56], [206, 200], [60, 196], [196, 60]]) { g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x, y - 8); g.lineTo(x + 2, y + 6); g.lineTo(x + 12, y - 2); g.stroke(); }
  },
  nitroSwitch: (g) => {
    metal(g, { base: '#5d7a5a', light: '#9ec29a', dark: '#2a3a28' });
    g.fillStyle = '#2f6b2a'; g.strokeStyle = '#0e260c'; g.lineWidth = 8;
    g.beginPath(); g.arc(128, 128, 72, 0, 7); g.fill(); g.stroke();
    g.save(); g.shadowColor = '#9dff6a'; g.shadowBlur = 14;
    bigText(g, '!', { px: 150, fill: '#b6ff7a', stroke: '#0e260c', lw: 8, alpha: 1, y: 134 });
    g.restore();
  },
  switch: (g) => {
    wood(g, { seed: 29 }); corners(g, '#c4ccd1', '#4b5257');
    g.fillStyle = '#3a7bd5'; g.strokeStyle = '#1c1640'; g.lineWidth = 8;
    g.beginPath(); g.arc(128, 128, 70, 0, 7); g.fill(); g.stroke();
    bigText(g, '!', { px: 150, fill: '#fff', stroke: '#1c1640', lw: 8, alpha: 1, y: 134 });
  },
  outline: (g) => {
    g.clearRect(0, 0, 256, 256);
    g.save(); g.shadowColor = '#bfefff'; g.shadowBlur = 10;
    g.strokeStyle = '#d8f6ff'; g.lineWidth = 10; g.setLineDash([26, 14]);
    g.strokeRect(8, 8, 240, 240);
    g.setLineDash([]); g.lineWidth = 6;
    for (const [x, y, sx, sy] of [[8, 8, 1, 1], [248, 8, -1, 1], [8, 248, 1, -1], [248, 248, -1, -1]]) {
      g.beginPath(); g.moveTo(x, y + sy * 46); g.lineTo(x, y); g.lineTo(x + sx * 46, y); g.stroke();
    }
    g.globalAlpha = 0.35; g.lineWidth = 3;
    g.beginPath(); g.moveTo(40, 40); g.lineTo(216, 216); g.moveTo(216, 40); g.lineTo(40, 216); g.stroke();
    g.restore();
  },
  time1: (g) => timeFace(g, '1'),
  time2: (g) => timeFace(g, '2'),
  time3: (g) => timeFace(g, '3'),
  legs: (g) => {
    wood(g, { seed: 31 }); corners(g);
    for (const [x, px] of [[92, 6], [164, -4]]) {
      g.fillStyle = '#fff'; g.strokeStyle = '#1c1640'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, 112, 30, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#1c1640'; g.beginPath(); g.arc(x + px, 120, 13, 0, 7); g.fill();
    }
    g.fillStyle = '#1c1640'; g.beginPath(); g.ellipse(128, 184, 22, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(128, 190, 12, 7, 0, 0, 7); g.fill();
  },
  mystery: (g) => {
    const cols = ['#ff5a5a', '#ffa64a', '#ffe14a', '#5ad66a', '#4a9cff', '#9a6aff'];
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(0, i * 256 / 6, 256, 256 / 6 + 1); }
    g.strokeStyle = '#ffd76a'; g.lineWidth = 14; g.strokeRect(7, 7, 242, 242);
    corners(g, '#ffd76a', '#8a6a10');
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[56, 60, 10], [200, 70, 8], [190, 196, 11], [60, 190, 7]]) star(g, x, y, r);
    bigText(g, '?', { px: 180, fill: '#fff', stroke: '#1c1640', lw: 14, alpha: 1 });
  },
};

function timeFace(g, n) {
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#f0b81a'; g.fillRect(26, 26, 204, 204);
  g.strokeStyle = '#7a5208'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250); g.strokeRect(26, 26, 204, 204);
  corners(g, '#3a7bd5', '#1c1640');
  g.fillStyle = '#fff8e0'; g.strokeStyle = '#1c1640'; g.lineWidth = 7;
  g.beginPath(); g.arc(128, 128, 76, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = '#1c1640'; g.lineWidth = 4;
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.beginPath(); g.moveTo(128 + Math.cos(a) * 62, 128 + Math.sin(a) * 62); g.lineTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70); g.stroke(); }
  bigText(g, n, { px: 120, fill: '#2a6fd6', stroke: '#fff8e0', lw: 6, alpha: 1, y: 136 });
}

function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

export const CRATE_LOOKS = Object.keys(FACES);
export function crateTexture(look) { return canvasTex(`crate:${look}`, FACES[look] || FACES.basic); }

// ------------------------------------------------------------------ geometries
const geoCache = new Map();
function cachedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const crateGeometry = () => cachedGeo('crate', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.045));
export const debrisGeometry = () => cachedGeo('debris', () => new THREE.BoxGeometry(0.42, 0.07, 0.15));
export const lightBodyGeometry = () => cachedGeo('lightBody', () => new THREE.IcosahedronGeometry(0.12, 1));
export const haloGeometry = () => cachedGeo('halo', () => new THREE.PlaneGeometry(1, 1));
export const wingsGeometry = () => cachedGeo('wings', () => {
  // two wings hinged on the body, tilted up 20°, spanning ±X
  const g = new THREE.BufferGeometry();
  const t = Math.tan(0.35);
  const L = 0.3, W = 0.16;
  const p = [
    0, 0, -W / 2, -L, L * t, -W / 2, -L, L * t, W / 2, 0, 0, W / 2,
    0, 0, -W / 2, L, L * t, -W / 2, L, L * t, W / 2, 0, 0, W / 2,
  ];
  const uv = [1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  g.computeVertexNormals();
  return g;
});

// ------------------------------------------------------------------ materials
const matCache = new Map();
export function cachedMat(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}

export function crateMaterial(look) {
  return cachedMat(`crate:${look}`, () => {
    const map = crateTexture(look);
    if (look === 'outline') {
      return new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: 0xcff4ff, toneMapped: false });
    }
    const m = new THREE.MeshLambertMaterial({ map });
    if (look === 'nitro' || look === 'nitroSwitch') { m.emissive.set(0x5aff3a); m.emissiveMap = map; m.emissiveIntensity = 0.35; }
    if (look === 'tnt1' || look === 'tnt2' || look === 'tnt3') { m.emissive.set(0xff6a2a); m.emissiveMap = map; m.emissiveIntensity = 0.25; }
    if (look === 'mystery') { m.emissive.set(0xffffff); m.emissiveMap = map; m.emissiveIntensity = 0.18; }
    if (look === 'checkpoint') { m.emissive.set(0xffd76a); m.emissiveMap = map; m.emissiveIntensity = 0.08; }
    return m;
  });
}

export const debrisMaterial = () => cachedMat('debris', () => new THREE.MeshLambertMaterial({ color: 0xffffff }));
export const lightBodyMaterial = () => cachedMat('lightBody', () => new THREE.MeshBasicMaterial({ color: 0xfff1a0, toneMapped: false }));

export function haloTexture(key = 'halo', inner = 'rgba(255,246,170,0.95)', mid = 'rgba(255,214,90,0.35)') {
  return canvasTex(`halo:${key}`, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }, { w: 128, h: 128, scale: 1 });
}
export const haloMaterial = () => cachedMat('halo', () => new THREE.MeshBasicMaterial({
  map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
}));
export const wingsMaterial = () => cachedMat('wings', () => new THREE.MeshBasicMaterial({
  map: canvasTex('wings', (g) => {
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = 'rgba(230,248,255,0.85)'; g.strokeStyle = 'rgba(120,170,220,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.ellipse(64, 32, 60, 28, 0, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(124, 32); g.lineTo(20, 20); g.moveTo(124, 32); g.lineTo(24, 44); g.stroke();
  }, { w: 128, h: 64, scale: 1 }),
  transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.8,
}));

/** Sprite textures for pop-ups (life head, mask, chicken…). */
export function iconTexture(kind) {
  return canvasTex(`icon:${kind}`, (g) => {
    g.clearRect(0, 0, 256, 256);
    if (kind === 'life') lumenHead(g, 128, 140, 1.5);
    else if (kind === 'mask') okuMask(g, 128, 150, 1.2);
    else if (kind === 'clock') {
      g.fillStyle = '#fff8e0'; g.strokeStyle = '#1c1640'; g.lineWidth = 10;
      g.beginPath(); g.arc(128, 128, 100, 0, 7); g.fill(); g.stroke();
      g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 60); g.moveTo(128, 128); g.lineTo(176, 140); g.stroke();
      g.fillStyle = '#9fd8ff'; g.globalAlpha = 0.5; g.beginPath(); g.arc(128, 128, 90, 0, 7); g.fill();
    }
  }, { w: 256, h: 256, scale: 0.5 });
}
export function spriteMaterial(kind) {
  return cachedMat(`sprite:${kind}`, () => new THREE.SpriteMaterial({ map: iconTexture(kind), transparent: true, depthTest: false, toneMapped: false }));
}

// ------------------------------------------------------------------ misc shared meshes bits
export const basicMat = (hex, opts = {}) => cachedMat(`basic:${hex}:${opts.transparent ? 1 : 0}:${opts.add ? 1 : 0}`, () => new THREE.MeshBasicMaterial({
  color: hex, toneMapped: false, transparent: !!opts.transparent || !!opts.add, opacity: opts.opacity ?? 1,
  depthWrite: !(opts.transparent || opts.add), blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  side: opts.side ?? THREE.FrontSide,
}));
export const lambertMat = (hex, opts = {}) => cachedMat(`lambert:${hex}:${opts.emissive ?? 0}:${opts.flat ? 1 : 0}`, () => {
  const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: !!opts.flat });
  if (opts.emissive) { m.emissive.set(opts.emissive); m.emissiveIntensity = opts.ei ?? 0.6; }
  return m;
});
export const geo = (key, make) => cachedGeo(key, make);

/** Sock outline (extruded), shared per colour. */
export function sockGeometry() {
  return cachedGeo('sock', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.14, 0.42); s.lineTo(0.12, 0.42); s.lineTo(0.12, 0.02);
    s.quadraticCurveTo(0.12, -0.16, 0.3, -0.16); s.lineTo(0.36, -0.16);
    s.quadraticCurveTo(0.46, -0.16, 0.46, -0.26); s.quadraticCurveTo(0.46, -0.36, 0.34, -0.36);
    s.lineTo(-0.02, -0.36); s.quadraticCurveTo(-0.14, -0.36, -0.14, -0.22); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 6 });
    g.translate(-0.12, 0, -0.06);
    return g;
  });
}
export function sockMaterial(color) {
  if (color === 'gold') return cachedMat('sock:gold', () => { const m = new THREE.MeshStandardMaterial({ color: 0xffd34a, metalness: 0.8, roughness: 0.25 }); m.emissive.set(0x8a5a00); m.emissiveIntensity = 0.5; return m; });
  const hex = SOCK_COLORS[color] ?? 0xff5a5a;
  return cachedMat(`sock:${color}`, () => {
    const t = canvasTex(`sockstripes:${color}`, (g) => {
      g.fillStyle = `#${hex.toString(16).padStart(6, '0')}`; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) g.fillRect(0, 4 + i * 16, 64, 6);
    }, { w: 64, h: 64, scale: 1 });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
    const m = new THREE.MeshLambertMaterial({ map: t }); m.emissive.set(hex); m.emissiveIntensity = 0.25;
    return m;
  });
}

/** Sign board texture (unique text → owned by the entity, disposed with it). */
export function signTexture(lines, lang) {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  const r = rng(lines.join('').length + 3);
  g.fillStyle = '#c98a45'; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#c98a45' : '#be7f3c'; g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = '#7a4518'; g.fillRect(0, i * 64 + 61, 512, 3);
    g.strokeStyle = 'rgba(110,60,20,0.3)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { const y = i * 64 + 10 + r() * 44; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 6, 340, y - 6, 512, y + 3); g.stroke(); }
  }
  g.strokeStyle = '#5a3010'; g.lineWidth = 12; g.strokeRect(6, 6, 500, 244);
  g.fillStyle = '#4a2410';
  for (const [x, y] of [[22, 22], [490, 22], [22, 234], [490, 234]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
  const n = lines.length;
  const px = n <= 2 ? 50 : n === 3 ? 42 : 34;
  g.font = `800 ${px}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lh = px * 1.12, y0 = 128 - (n - 1) * lh / 2;
  lines.forEach((l, i) => {
    g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillText(l, 257, y0 + i * lh + 2);
    g.fillStyle = '#2a1206'; g.fillText(l, 256, y0 + i * lh);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function measureSign(px = 42) {
  const c = makeCanvas(8, 8).getContext('2d');
  c.font = `800 ${px}px ${FONT}`;
  return (s) => c.measureText(s).width;
}

/** Portal swirl texture. */
export function swirlTexture() {
  return canvasTex('swirl', (g) => {
    g.clearRect(0, 0, 256, 256);
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.35, 'rgba(255,215,120,0.75)');
    gr.addColorStop(0.75, 'rgba(120,230,210,0.45)'); gr.addColorStop(1, 'rgba(120,230,210,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.lineCap = 'round';
    for (let arm = 0; arm < 5; arm++) {
      g.strokeStyle = arm % 2 ? 'rgba(255,255,255,0.75)' : 'rgba(255,190,120,0.7)';
      g.lineWidth = 7;
      g.beginPath();
      for (let i = 0; i < 60; i++) {
        const t = i / 60, a = arm * Math.PI * 2 / 5 + t * 5.5, rr = 8 + t * 112;
        g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr);
      }
      g.stroke();
    }
  }, { w: 256, h: 256, scale: 1 });
}
export function flagTexture() {
  return canvasTex('flagC', (g) => {
    g.fillStyle = '#ff7f6a'; g.fillRect(0, 0, 128, 96);
    g.fillStyle = '#ffd76a'; g.fillRect(0, 80, 128, 16);
    bigText(g, 'C', { x: 60, y: 46, px: 70, fill: '#fff8e0', stroke: '#7a2010', lw: 6, alpha: 1 });
  }, { w: 128, h: 96, scale: 1 });
}
