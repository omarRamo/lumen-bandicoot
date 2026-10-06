// Lumen Bandicoot — 2D canvas art for the UI: characters (Lumen, Zina, Oku Oku, Dr Néo Cortisol, Stressotron),
// props (crates, socks, spoons, fireflies) and cached icon data-URLs. LUMEN curves (cf. lumen-kart drawLumenPortrait).
import { PALETTE as P, SOCK_COLORS, SPOON_COLORS } from './util.js';

const TAU = Math.PI * 2;
const PI = Math.PI;

// ------------------------------------------------------------------ primitives
export function ell(g, x, y, rx, ry, color, rot = 0) {
  g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
  if (color) { g.fillStyle = color; g.fill(); }
}
export function star4(g, x, y, size, color, pinch = 0.18) {
  g.fillStyle = color; g.beginPath(); g.moveTo(x, y - size);
  g.quadraticCurveTo(x + size * pinch, y - size * pinch, x + size, y);
  g.quadraticCurveTo(x + size * pinch, y + size * pinch, x, y + size);
  g.quadraticCurveTo(x - size * pinch, y + size * pinch, x - size, y);
  g.quadraticCurveTo(x - size * pinch, y - size * pinch, x, y - size); g.fill();
}
export function leaf(g, x, y, size, angle, color, w = 1) {
  g.save(); g.translate(x, y); g.rotate(angle); g.fillStyle = color;
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-size * 0.6 * w, -size * 0.4, -size * 0.5 * w, -size, 0, -size * 1.5);
  g.bezierCurveTo(size * 0.5 * w, -size, size * 0.6 * w, -size * 0.4, 0, 0); g.fill(); g.restore();
}
export function line(g, pts, color, width = 2, dash = null) {
  g.save();
  if (dash) g.setLineDash(dash);
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  g.restore();
}
export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function starPath(g, cx, cy, r1, r2, n = 5, rot = -PI / 2) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * PI) / n, r = i % 2 === 0 ? r1 : r2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}
function arcStroke(g, x, y, r, a0, a1, color, w, ccw = false) {
  g.beginPath(); g.arc(x, y, r, a0, a1, ccw); g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
}

// ------------------------------------------------------------------ shared head pieces (portrait coordinates)
function eyes(g, mood, t, x1, x2, y, iris = '#25575b', blinkSeed = 0) {
  const blink = ((t + blinkSeed) % 3.4) < 0.11;
  if (mood === 'happy' || blink) {
    for (const x of [x1, x2]) arcStroke(g, x, y + (blink ? 0.5 : 1.5), 2.6, PI + 0.3, TAU - 0.3, iris, 1.6);
    return;
  }
  if (mood === 'shock') {
    for (const x of [x1, x2]) { ell(g, x, y, 3.6, 4.6, '#fff'); g.lineWidth = 0.8; g.strokeStyle = iris; g.stroke(); ell(g, x + 0.4, y, 1.3, 1.6, iris); }
    return;
  }
  for (const x of [x1, x2]) { ell(g, x, y, 2.4, 4, iris); ell(g, x + 0.7, y - 1.4, 0.8, 1.1, '#ffffff'); }
  if (mood === 'determined' || mood === 'angry') {
    line(g, [[x1 - 3.5, y - 6.5], [x1 + 2.5, y - 4.6]], iris, 1.4);
    line(g, [[x2 + 3.5, y - 6.5], [x2 - 2.5, y - 4.6]], iris, 1.4);
  }
  if (mood === 'sad') {
    line(g, [[x1 - 3, y - 4.8], [x1 + 2.5, y - 6.6]], iris, 1.2);
    line(g, [[x2 + 3, y - 4.8], [x2 - 2.5, y - 6.6]], iris, 1.2);
  }
}
function mouth(g, mood, x, y, t) {
  if (mood === 'shock' || mood === 'shout') {
    ell(g, x, y + 1, 3.2, mood === 'shout' ? 3.6 + Math.sin(t * 20) * 0.6 : 2.8, '#7a2f35'); ell(g, x, y + 2.6, 2, 1, '#e98c73');
  } else if (mood === 'sad') {
    arcStroke(g, x, y + 3, 4, PI + 0.5, TAU - 0.5, '#c97a5c', 1.8);
  } else if (mood === 'happy' || mood === 'wave') {
    g.fillStyle = '#7a2f35'; g.beginPath(); g.ellipse(x, y, 5, 3.4, 0, 0, PI); g.fill(); ell(g, x, y + 2.2, 2.4, 1, '#e98c73');
  } else {
    arcStroke(g, x, y, 5, 0.15, PI - 0.15, '#ed9b77', 2.2);
  }
}

// ------------------------------------------------------------------ LUMEN (feet at 0,0 — ~100 units tall, faces right)
/**
 * @param {object} o { t, pose: stand|run|jump|wave|shock|sad|point|victory|walk, mood, scarf, flip, noShadow }
 */
export function drawLumen(g, o = {}) {
  const t = o.t || 0, pose = o.pose || 'stand', scarf = o.scarf || P.coral;
  const mood = o.mood || ({ shock: 'shock', sad: 'sad', victory: 'happy', wave: 'happy', jump: 'happy' }[pose] || 'normal');
  const running = pose === 'run' || pose === 'walk';
  const sp = pose === 'run' ? 13 : 7;
  const ph = Math.sin(t * sp);
  const air = pose === 'jump' || pose === 'victory';
  g.save();
  if (o.flip) g.scale(-1, 1);
  if (!o.noShadow) ell(g, 0, 0, 22, 4.5, 'rgba(0,0,0,0.16)');
  const bob = running ? -Math.abs(ph) * 4 : air ? -10 - Math.sin(t * 5) * 3 : Math.sin(t * 2.4) * 1.1;
  g.translate(0, bob);
  const lean = pose === 'run' ? 0.12 : 0;
  g.rotate(lean);

  // tail
  g.save(); g.translate(-11, -24); g.rotate(-1.05 + Math.sin(t * (running ? 10 : 3)) * (running ? 0.18 : 0.1));
  leaf(g, 0, 0, 22, 0, P.teal, 1.5); leaf(g, 0, -20, 8, 0, '#a6dfc6', 1.6); ell(g, 0, -31, 3.5, 4, P.cream);
  g.restore();

  // legs
  const legC = '#2f6b66', footC = P.deep;
  let feet;
  if (running) feet = [[-4 + ph * 9, -Math.max(0, -ph) * 7], [4 - ph * 9, -Math.max(0, ph) * 7]];
  else if (air) feet = [[-8, -7], [7, -4]];
  else feet = [[-7, 0], [7, 0]];
  for (const [fx, fy] of feet) { line(g, [[fx * 0.5, -17], [fx, fy - 3]], legC, 7); ell(g, fx + 2, fy - 2.5, 7, 3.6, footC); }

  // body
  ell(g, 0, -28, 14, 17, P.teal);
  ell(g, 2.5, -26, 8.5, 12, P.mint);
  star4(g, 3, -27, 3.4, '#f3d096'); ell(g, 3, -27, 1.2, 1.2, '#fff0ce');

  // arms
  const sh = [[-9, -37], [10, -37]];
  let hands;
  switch (pose) {
    case 'run': case 'walk': hands = [[-12 - ph * 8, -26 + Math.abs(ph) * 2], [14 + ph * 8, -26 + Math.abs(ph) * 2]]; break;
    case 'jump': case 'victory': hands = [[-20, -58 + Math.sin(t * 8) * 2], [22, -60 - Math.sin(t * 8) * 2]]; break;
    case 'wave': hands = [[-15, -22], [22 + Math.sin(t * 9) * 4, -58]]; break;
    case 'shock': hands = [[-22, -50], [24, -50]]; break;
    case 'point': hands = [[-14, -22], [30, -42]]; break;
    case 'sad': hands = [[-11, -20], [12, -20]]; break;
    default: hands = [[-15, -23], [16, -23]];
  }
  for (let i = 0; i < 2; i++) { line(g, [sh[i], hands[i]], P.teal, 6); ell(g, hands[i][0], hands[i][1], 3.6, 3.6, legC); }

  // scarf (streaming tail + wrap)
  const wv = Math.sin(t * (running ? 14 : 4));
  g.fillStyle = scarf; g.beginPath(); g.moveTo(-3, -46);
  g.bezierCurveTo(-14, -47 + wv * 2, -24, -40 - wv * 3, -36, -44 + wv * 4); g.lineTo(-31, -36 + wv * 3);
  g.bezierCurveTo(-21, -33, -12, -38, -2, -40); g.fill();
  line(g, [[-12, -42], [-22, -40 + wv], [-30, -40 + wv * 3]], '#ffe2ac', 0.9, [1.6, 1.5]);
  ell(g, 0, -45, 12.5, 4.3, scarf);
  line(g, [[-10, -45], [10, -45]], '#ffe2ac', 0.8, [1.4, 1.6]);

  // head (portrait coordinates, faces right)
  g.save(); g.translate(2, -62); g.scale(1.35, 1.35); g.translate(0, 33);
  const tilt = pose === 'shock' ? -0.05 : pose === 'sad' ? 0.08 : Math.sin(t * 1.7) * 0.03;
  g.rotate(tilt);
  const earW = Math.sin(t * 3.1) * 0.06;
  leaf(g, -9, -36, 17, -0.56 + earW, '#306f70'); leaf(g, 9, -36, 17, 0.5 - earW, '#306f70');
  leaf(g, -10, -39, 11, -0.56 + earW, '#a6dfc6'); leaf(g, 10, -39, 11, 0.5 - earW, '#a6dfc6');
  g.fillStyle = P.cream; g.beginPath(); g.moveTo(-17, -33);
  g.bezierCurveTo(-25, -48, 3, -56, 17, -42); g.bezierCurveTo(28, -33, 15, -21, 0, -22);
  g.bezierCurveTo(-9, -21, -17, -25, -17, -33); g.fill();
  ell(g, 20.5, -35.5, 2.6, 2, '#25575b'); // nose tip
  eyes(g, mood, t, -5, 6, -35);
  ell(g, -12, -30, 3, 1.7, '#edba9c'); ell(g, 12, -29, 3, 1.7, '#edba9c');
  star4(g, 0, -47, 3.6, P.gold);
  mouth(g, mood, 1, -27.5, t);
  g.restore();
  g.restore();
}

/** Lumen bust (portrait) centred in a box of `size` px (used for HUD lives icon and dialog portraits). */
export function drawLumenHead(g, size, o = {}) {
  g.save(); g.translate(size / 2, size / 2); const s = size / 64; g.scale(s, s);
  g.translate(-2, 26);
  const t = o.t || 0;
  leaf(g, -9, -36, 17, -0.56, '#306f70'); leaf(g, 9, -36, 17, 0.5, '#306f70');
  leaf(g, -10, -39, 11, -0.56, '#a6dfc6'); leaf(g, 10, -39, 11, 0.5, '#a6dfc6');
  ell(g, 0, -20, 12, 4, o.scarf || P.coral);
  g.fillStyle = P.cream; g.beginPath(); g.moveTo(-17, -33);
  g.bezierCurveTo(-25, -48, 3, -56, 17, -42); g.bezierCurveTo(28, -33, 15, -21, 0, -22);
  g.bezierCurveTo(-9, -21, -17, -25, -17, -33); g.fill();
  ell(g, 20.5, -35.5, 2.6, 2, '#25575b');
  eyes(g, o.mood || 'normal', t, -5, 6, -35);
  ell(g, -12, -30, 3, 1.7, '#edba9c'); ell(g, 12, -29, 3, 1.7, '#edba9c');
  star4(g, 0, -47, 3.6, P.gold);
  mouth(g, o.mood || 'happy', 1, -27.5, t);
  g.restore();
}

// ------------------------------------------------------------------ ZINA the fennec (feet at 0,0, ~100 tall)
export function drawZina(g, o = {}) {
  const t = o.t || 0, pose = o.pose || 'stand';
  const mood = o.mood || ({ shock: 'shock', sad: 'sad', wave: 'happy', jump: 'happy' }[pose] || 'normal');
  const sand = '#efbd83', sandD = '#d99a5e', light = '#fff1d6';
  g.save();
  if (o.flip) g.scale(-1, 1);
  if (!o.noShadow) ell(g, 0, 0, 20, 4.5, 'rgba(0,0,0,0.16)');
  const bob = pose === 'jump' ? -10 - Math.sin(t * 6) * 3 : Math.sin(t * 2.6 + 1) * 1.1;
  g.translate(0, bob);
  g.save(); g.translate(-10, -22); g.rotate(-1.15 + Math.sin(t * 3.4) * 0.12);
  leaf(g, 0, 0, 20, 0, sand, 1.5); ell(g, 0, -28, 4.5, 6, '#7a4a2a'); g.restore();
  for (const fx of [-6, 6]) { line(g, [[fx * 0.5, -16], [fx, -3]], sandD, 6.5); ell(g, fx + 2, -2.5, 6.5, 3.4, '#b97a46'); }
  // dress
  g.fillStyle = P.comet; g.beginPath(); g.moveTo(-12, -38); g.lineTo(12, -38); g.lineTo(16, -13); g.quadraticCurveTo(0, -9, -16, -13); g.closePath(); g.fill();
  for (let i = -1; i <= 1; i++) ell(g, i * 8, -16, 2, 2, '#fff7dc');
  const sh = [[-9, -35], [9, -35]];
  let hands;
  if (pose === 'wave') hands = [[-14, -20], [20 + Math.sin(t * 9) * 4, -56]];
  else if (pose === 'shock' || pose === 'jump') hands = [[-21, -52], [21, -54]];
  else if (pose === 'hug') hands = [[16, -32], [22, -36]];
  else hands = [[-13, -21], [13, -21]];
  for (let i = 0; i < 2; i++) { line(g, [sh[i], hands[i]], sand, 5.5); ell(g, hands[i][0], hands[i][1], 3.3, 3.3, sandD); }
  // head
  g.save(); g.translate(1, -58); g.scale(1.3, 1.3); g.translate(0, 33);
  const ew = Math.sin(t * 2.7) * 0.07;
  leaf(g, -10, -38, 21, -0.5 + ew, sand, 1.45); leaf(g, 10, -38, 21, 0.5 - ew, sand, 1.45);
  leaf(g, -11, -41, 14, -0.5 + ew, '#ffd3b0', 1.4); leaf(g, 11, -41, 14, 0.5 - ew, '#ffd3b0', 1.4);
  g.fillStyle = sand; g.beginPath(); g.moveTo(-16, -33);
  g.bezierCurveTo(-23, -48, 3, -54, 15, -42); g.bezierCurveTo(26, -33, 14, -21, 0, -22);
  g.bezierCurveTo(-9, -21, -16, -25, -16, -33); g.fill();
  ell(g, 6, -28, 10, 6, light);
  ell(g, 19, -35, 2.4, 1.9, '#4a2b1a');
  eyes(g, mood, t, -5, 6, -36, '#4a2b1a', 1.3);
  ell(g, -11, -30, 2.6, 1.5, '#f0a08a'); ell(g, 13, -29, 2.6, 1.5, '#f0a08a');
  mouth(g, mood, 2, -26.5, t);
  // flower
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + t * 0.5; ell(g, -14 + Math.cos(a) * 3.2, -44 + Math.sin(a) * 3.2, 2.4, 2.4, P.comet); }
  ell(g, -14, -44, 1.8, 1.8, P.gold);
  g.restore();
  g.restore();
}

// ------------------------------------------------------------------ OKU OKU (cardboard tiki mask; centre at 0,0, ~80 tall)
export function drawOku(g, o = {}) {
  const t = o.t || 0, mood = o.mood || 'talk';
  const cb = '#c99a5c', cbD = '#9a6c3a', cbL = '#e2b97c';
  g.save();
  g.translate(0, Math.sin(t * 2.2) * 3);
  g.rotate(Math.sin(t * 1.6) * 0.06);
  // feathers
  const fc = [P.coral, P.gold, P.teal, P.mint, P.comet];
  for (let i = 0; i < 5; i++) {
    const a = -0.7 + i * 0.35 + Math.sin(t * 3 + i) * 0.05;
    leaf(g, Math.sin(a) * 12, -30, 14 + (i === 2 ? 4 : 0), a, fc[i], 0.9);
  }
  // mask shape
  g.fillStyle = cbD; g.beginPath();
  g.moveTo(-24, -30); g.quadraticCurveTo(0, -40, 24, -30); g.lineTo(27, 18); g.quadraticCurveTo(0, 46, -27, 18); g.closePath(); g.fill();
  g.fillStyle = cb; g.beginPath();
  g.moveTo(-22, -28); g.quadraticCurveTo(0, -37, 22, -28); g.lineTo(24, 16); g.quadraticCurveTo(0, 42, -24, 16); g.closePath(); g.fill();
  // corrugated stripes
  g.save(); g.clip();
  g.strokeStyle = 'rgba(120,80,40,0.18)'; g.lineWidth = 1.2;
  for (let x = -26; x < 28; x += 3.2) { g.beginPath(); g.moveTo(x, -40); g.lineTo(x + 2, 46); g.stroke(); }
  g.restore();
  // painted brows (coral) + cheeks stripes
  line(g, [[-19, -16], [-11, -21], [-3, -16]], P.coral, 3.2);
  line(g, [[3, -16], [11, -21], [19, -16]], P.coral, 3.2);
  line(g, [[-20, 8], [-13, 10]], P.teal, 2.4); line(g, [[-20, 12], [-13, 14]], P.teal, 2.4);
  line(g, [[20, 8], [13, 10]], P.teal, 2.4); line(g, [[20, 12], [13, 14]], P.teal, 2.4);
  // nose
  g.fillStyle = cbD; g.beginPath(); g.moveTo(0, -12); g.lineTo(5, 4); g.lineTo(-5, 4); g.closePath(); g.fill();
  // googly eyes
  const jx = Math.sin(t * 7.3) * 2 + (o.look || 0) * 2.5, jy = Math.cos(t * 5.1) * 1.6;
  for (const [ex, ph] of [[-11, 0], [11, 1.7]]) {
    ell(g, ex, -8, 8, 8, '#fff'); g.lineWidth = 1.2; g.strokeStyle = '#3a2a1a'; g.stroke();
    ell(g, ex + jx * (ph ? -0.7 : 1) + 1, -8 + jy * (ph ? 1.2 : -0.8) + 2, 3.6, 3.6, '#1c1640');
  }
  // mouth
  const open = mood === 'laugh' ? 4 + Math.abs(Math.sin(t * 16)) * 4 : mood === 'talk' ? 3 + Math.abs(Math.sin(t * 11)) * 3 : 3;
  g.fillStyle = '#5a2a20'; g.beginPath(); g.ellipse(0, 20, 13, open, 0, 0, PI); g.lineTo(-13, 20); g.fill();
  g.fillStyle = '#fff7dc'; for (let i = -2; i <= 2; i++) g.fillRect(i * 4.6 - 1.8, 20, 3.6, 2.8);
  // tape
  g.save(); g.translate(16, -26); g.rotate(0.6); g.fillStyle = 'rgba(255,247,220,0.78)'; g.fillRect(-9, -3.5, 18, 7); g.restore();
  g.restore();
}

// ------------------------------------------------------------------ DR NEO CORTISOL (feet at 0,0, ~160 tall, huge head)
export function drawCortisol(g, o = {}) {
  const t = o.t || 0, mood = o.mood || 'evil', golden = !!o.golden;
  const skin = golden ? '#ffd76a' : '#f2d27a', skinD = golden ? '#d9a93a' : '#d6b05a';
  const coat = golden ? '#fff2b8' : '#ffffff';
  g.save();
  if (o.flip) g.scale(-1, 1);
  if (!o.noShadow) ell(g, 0, 0, 30, 6, 'rgba(0,0,0,0.18)');
  const jitter = mood === 'stressed' ? Math.sin(t * 40) * 1.2 : 0;
  g.translate(jitter, Math.sin(t * 2) * 1.5);
  // legs + shoes
  for (const fx of [-7, 7]) { line(g, [[fx * 0.6, -34], [fx, -4]], '#2a2440', 5); ell(g, fx + 4, -3, 9, 4, '#1c1640'); }
  // shirt
  g.fillStyle = P.night; rrect(g, -14, -60, 28, 30, 6); g.fill();
  g.strokeStyle = '#4b3f86'; g.lineWidth = 2; for (let y = -56; y < -32; y += 5) { g.beginPath(); g.moveTo(-13, y); g.lineTo(13, y); g.stroke(); }
  // coat (too short)
  g.fillStyle = coat; g.beginPath(); g.moveTo(-17, -64); g.lineTo(-20, -38); g.lineTo(-7, -40); g.lineTo(-4, -60); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(17, -64); g.lineTo(20, -38); g.lineTo(7, -40); g.lineTo(4, -60); g.closePath(); g.fill();
  if (!golden) { g.fillStyle = '#7ad7c4'; g.fillRect(9, -55, 6, 2); } // pen in pocket
  // arms
  let hands;
  if (mood === 'evil' || mood === 'laugh') hands = [[-30, -76 + Math.sin(t * 9) * 3], [30, -76 - Math.sin(t * 9) * 3]];
  else if (mood === 'defeated' || mood === 'relaxed') hands = [[-22, -38], [22, -38]];
  else hands = [[-26, -52], [26, -48]];
  for (const [i, h] of hands.entries()) { line(g, [[i ? 15 : -15, -60], h], coat, 6); ell(g, h[0], h[1], 4.6, 4.6, golden ? '#ffd76a' : '#a6e0ff'); }
  // head
  const hy = -112;
  ell(g, 0, hy + 4, 50, 43, skinD);
  ell(g, 0, hy, 50, 43, skin);
  ell(g, -16, hy - 20, 20, 10, 'rgba(255,255,255,0.22)', -0.3);
  // stressed hair tufts
  for (const [x, a] of [[-8, -0.3], [0, 0], [8, 0.35]]) line(g, [[x, hy - 41], [x + Math.sin(a) * 9 + Math.sin(t * 6 + x) * 1.5, hy - 54]], '#3b2f5a', 2.2);
  // the C
  arcStroke(g, 0, hy - 20, 11, 0.8, TAU - 0.8, golden ? '#b8860b' : P.night, 6);
  // veins
  if (mood !== 'relaxed') {
    const vp = 1 + Math.sin(t * 8) * 0.08;
    // anime "anger vein": four little arcs bulging out of a cross
    g.save(); g.translate(-32, hy - 16); g.scale(vp, vp);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const a0 = Math.atan2(sy, sx);
      arcStroke(g, sx * 5, sy * 5, 4, a0 + Math.PI * 0.55, a0 + Math.PI * 1.45, '#e2574c', 2.2);
    }
    g.restore();
  }
  // glasses + eyes
  for (const ex of [-14, 14]) {
    ell(g, ex, hy + 4, 10, 10, '#e9fbff'); g.lineWidth = 2.6; g.strokeStyle = '#2a2440'; g.stroke();
    if (mood === 'defeated') { line(g, [[ex - 4, hy], [ex + 4, hy + 8]], '#2a2440', 2); line(g, [[ex + 4, hy], [ex - 4, hy + 8]], '#2a2440', 2); }
    else if (mood === 'relaxed') arcStroke(g, ex, hy + 6, 4, PI + 0.4, TAU - 0.4, '#2a2440', 2);
    else ell(g, ex + Math.sin(t * 3) * 1.5, hy + 5, 2.6, 2.6, '#2a2440');
    ell(g, ex, hy + 15, 6, 2, 'rgba(120,80,160,0.35)');
  }
  line(g, [[-4, hy + 4], [4, hy + 4]], '#2a2440', 2.2);
  if (mood === 'evil' || mood === 'laugh' || mood === 'stressed') {
    line(g, [[-24, hy - 9], [-6, hy - 4]], '#2a2440', 3); line(g, [[24, hy - 9], [6, hy - 4]], '#2a2440', 3);
  }
  // nose
  ell(g, 2, hy + 16, 7, 6, skinD);
  // mouth
  if (mood === 'evil' || mood === 'laugh') {
    const op = mood === 'laugh' ? 6 + Math.abs(Math.sin(t * 14)) * 5 : 6;
    g.fillStyle = '#5a1f2a'; g.beginPath(); g.moveTo(-18, hy + 26); g.quadraticCurveTo(0, hy + 30 + op * 2, 18, hy + 24); g.quadraticCurveTo(0, hy + 30, -18, hy + 26); g.fill();
    g.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) g.fillRect(i * 4.6 - 1.6, hy + 26 + (i % 2 ? 0 : 1), 3.2, 3.4);
  } else if (mood === 'stressed') {
    line(g, [[-14, hy + 28], [-9, hy + 25], [-4, hy + 29], [1, hy + 25], [6, hy + 29], [11, hy + 25], [16, hy + 28]], '#5a1f2a', 2.4);
  } else if (mood === 'relaxed') {
    arcStroke(g, 0, hy + 22, 10, 0.3, PI - 0.3, '#5a1f2a', 2.6);
  } else {
    arcStroke(g, 0, hy + 34, 10, PI + 0.4, TAU - 0.4, '#5a1f2a', 2.6);
  }
  // sweat drops
  if (mood === 'stressed' || mood === 'defeated' || mood === 'evil') {
    for (let i = 0; i < 2; i++) {
      const k = (t * 0.8 + i * 0.5) % 1;
      const x = i ? 46 : -46, y = hy - 10 + k * 40;
      g.globalAlpha = 1 - k; g.fillStyle = '#9fd8ff'; g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 4, y + 2, x, y + 3); g.quadraticCurveTo(x - 4, y + 2, x, y - 6); g.fill();
      g.globalAlpha = 1;
    }
  }
  if (mood === 'defeated') { g.fillStyle = '#fff7dc'; g.save(); g.translate(26, hy - 26); g.rotate(0.5); g.fillRect(-10, -3, 20, 6); g.restore(); }
  if (golden) for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.6; star4(g, Math.cos(a) * 62, hy + Math.sin(a) * 50, 4 + Math.sin(t * 5 + i) * 1.5, '#fff6c8'); }
  g.restore();
}

// ------------------------------------------------------------------ STRESSOTRON (base at 0,0, ~170 tall, ~150 wide)
export function drawStressotron(g, o = {}) {
  const t = o.t || 0, broken = !!o.broken;
  g.save();
  if (broken) g.rotate(-0.08);
  ell(g, 0, 0, 80, 10, 'rgba(0,0,0,0.2)');
  // legs
  for (const x of [-50, 50]) { g.fillStyle = '#3a3352'; g.fillRect(x - 8, -24, 16, 24); }
  // body
  g.fillStyle = '#4b4366'; rrect(g, -72, -130, 144, 110, 14); g.fill();
  g.fillStyle = '#5f5684'; rrect(g, -64, -122, 128, 94, 10); g.fill();
  g.fillStyle = '#8a7fb0'; for (const [x, y] of [[-66, -124], [66, -124], [-66, -26], [66, -26]]) ell(g, x, y, 3, 3, '#8a7fb0');
  // screen
  g.fillStyle = broken ? '#1d2a2a' : '#12302c'; rrect(g, -50, -78, 100, 40, 6); g.fill();
  g.fillStyle = broken ? '#7ad7c4' : '#ff6b6b'; g.font = 'bold 13px "Lilita One", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(broken ? 'ZEN : 100%' : `STRESS : ${90 + Math.floor((t * 7) % 10)}%`, 0, -58);
  // buttons
  const bc = ['#ff6b6b', P.gold, '#6fe08a'];
  for (let i = 0; i < 3; i++) ell(g, -30 + i * 30, -100, 7, 7, broken ? '#555' : (Math.floor(t * 4 + i) % 3 === 0 ? '#fff' : bc[i]));
  // gauge on top
  ell(g, 0, -146, 34, 34, '#3a3352'); ell(g, 0, -146, 28, 28, '#fff7dc');
  for (let i = 0; i <= 6; i++) { const a = PI + (i / 6) * PI; line(g, [[Math.cos(a) * 22, -146 + Math.sin(a) * 22], [Math.cos(a) * 27, -146 + Math.sin(a) * 27]], i > 4 ? '#e2574c' : '#3a3352', 2); }
  const na = broken ? PI + 0.15 : TAU - 0.35 + Math.sin(t * 13) * 0.12;
  line(g, [[0, -146], [Math.cos(na) * 22, -146 + Math.sin(na) * 22]], '#e2574c', 3);
  ell(g, 0, -146, 3.5, 3.5, '#3a3352');
  // antenna
  line(g, [[40, -130], [52, -186]], '#8a7fb0', 4);
  ell(g, 52, -190, 8, 8, broken ? '#666' : P.comet);
  if (!broken) for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; line(g, [[52, -190], [52 + Math.cos(a) * 18, -190 + Math.sin(a) * 18]], '#fff6c8', 1.5); }
  // horn/funnel
  g.fillStyle = '#8a7fb0'; g.beginPath(); g.moveTo(72, -96); g.lineTo(108, -118); g.lineTo(108, -54); g.lineTo(72, -76); g.closePath(); g.fill();
  if (broken) {
    // daisy in the funnel + smoke
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ell(g, 104 + Math.cos(a) * 6, -86 + Math.sin(a) * 6, 4, 4, '#fff'); }
    ell(g, 104, -86, 3.6, 3.6, P.gold);
    for (let i = 0; i < 4; i++) { const k = (t * 0.4 + i * 0.25) % 1; g.globalAlpha = 0.5 * (1 - k); ell(g, -30 + Math.sin(k * 6 + i) * 10, -140 - k * 90, 12 + k * 20, 10 + k * 16, '#888'); }
    g.globalAlpha = 1;
  } else {
    // stress waves
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.9 + i / 3) % 1;
      g.globalAlpha = 1 - k; g.strokeStyle = P.comet; g.lineWidth = 3;
      g.beginPath(); const x = 112 + k * 120;
      for (let y = -130; y <= -42; y += 8) g.lineTo(x + ((y / 8) % 2 ? 6 : -6), y);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.restore();
}

// ------------------------------------------------------------------ props
export function drawCrate(g, s, kind = 'basic') {
  // centred square crate of size s
  const h = s / 2;
  const base = kind === 'tnt' ? '#e2574c' : kind === 'nitro' ? '#6fe08a' : '#d99a50';
  const dark = kind === 'tnt' ? '#9b2a22' : kind === 'nitro' ? '#2c8a46' : '#8f5622';
  g.fillStyle = dark; rrect(g, -h, -h, s, s, s * 0.08); g.fill();
  g.fillStyle = base; rrect(g, -h + s * 0.08, -h + s * 0.08, s * 0.84, s * 0.84, s * 0.05); g.fill();
  g.strokeStyle = dark; g.lineWidth = s * 0.07;
  g.beginPath(); g.moveTo(-h + s * 0.12, -h + s * 0.12); g.lineTo(h - s * 0.12, h - s * 0.12); g.stroke();
  for (const y of [-h * 0.33, h * 0.33]) { g.lineWidth = s * 0.03; g.beginPath(); g.moveTo(-h + s * 0.1, y); g.lineTo(h - s * 0.1, y); g.stroke(); }
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ell(g, x * h * 0.78, y * h * 0.78, s * 0.04, s * 0.04, '#5a3410');
  if (kind === 'tnt' || kind === 'nitro') {
    g.fillStyle = '#fff7dc'; g.font = `${Math.round(s * 0.28)}px "Lilita One", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind === 'tnt' ? 'BOUM' : 'PAF', 0, 0);
  }
}

export function drawSock(g, s, color = 'red') {
  const c = SOCK_COLORS[color] || color;
  g.save(); g.scale(s / 100, s / 100);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.moveTo(-14, -42); g.lineTo(18, -42); g.lineTo(18, 14); g.quadraticCurveTo(46, 18, 44, 34); g.quadraticCurveTo(40, 50, 6, 46); g.quadraticCurveTo(-18, 44, -14, 16); g.closePath(); g.fill();
  g.translate(-3, -3);
  g.fillStyle = c; g.beginPath(); g.moveTo(-14, -42); g.lineTo(18, -42); g.lineTo(18, 14); g.quadraticCurveTo(46, 18, 44, 34); g.quadraticCurveTo(40, 50, 6, 46); g.quadraticCurveTo(-18, 44, -14, 16); g.closePath(); g.fill();
  g.lineWidth = 4; g.strokeStyle = '#3a1d08'; g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-14, -42, 32, 10);
  g.fillStyle = 'rgba(255,255,255,0.35)'; for (const y of [-18, -4]) g.fillRect(-14, y, 32, 5);
  ell(g, 34, 36, 9, 6, 'rgba(255,255,255,0.35)');
  if (color === 'gold') { star4(g, -2, 4, 9, '#fff6c8'); star4(g, 28, -20, 6, '#fff6c8'); }
  g.restore();
}

export function drawSpoon(g, s, tier = 'gold') {
  const c = SPOON_COLORS[tier] || tier;
  g.save(); g.scale(s / 100, s / 100); g.rotate(-0.6);
  g.strokeStyle = '#3a1d08'; g.lineWidth = 4;
  g.fillStyle = c; rrect(g, -5, -6, 10, 52, 5); g.fill(); g.stroke();
  ell(g, 0, -24, 16, 22, c); g.stroke();
  ell(g, -5, -30, 5, 9, 'rgba(255,255,255,0.6)', -0.2);
  g.restore();
}

export function drawFirefly(g, s, t = 0) {
  g.save(); g.scale(s / 100, s / 100);
  const glow = g.createRadialGradient(0, 8, 2, 0, 8, 46);
  glow.addColorStop(0, 'rgba(255,240,150,0.95)'); glow.addColorStop(0.45, 'rgba(255,200,80,0.45)'); glow.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(0, 8, 46, 0, TAU); g.fill();
  const flap = Math.sin(t * 30) * 0.25;
  ell(g, -14, -14, 15, 9, 'rgba(220,245,255,0.85)', -0.5 - flap); ell(g, 14, -14, 15, 9, 'rgba(220,245,255,0.85)', 0.5 + flap);
  ell(g, 0, -10, 9, 10, P.deep);
  ell(g, 0, 12, 14, 17, '#fff27a'); ell(g, 0, 14, 9, 11, '#ffffff');
  ell(g, -3, -12, 2.4, 2.4, '#fff'); ell(g, 4, -12, 2.4, 2.4, '#fff');
  line(g, [[-3, -18], [-9, -30]], P.deep, 2.5); line(g, [[3, -18], [9, -30]], P.deep, 2.5);
  g.restore();
}

export function drawLock(g, s) {
  g.save(); g.scale(s / 100, s / 100);
  g.strokeStyle = '#3a1d08'; g.lineWidth = 12; g.beginPath(); g.arc(0, -10, 22, PI, TAU); g.stroke();
  g.strokeStyle = '#b9b2c9'; g.lineWidth = 7; g.beginPath(); g.arc(0, -10, 22, PI, TAU); g.stroke();
  g.fillStyle = '#3a1d08'; rrect(g, -32, -14, 64, 52, 10); g.fill();
  g.fillStyle = P.gold; rrect(g, -27, -9, 54, 42, 8); g.fill();
  ell(g, 0, 8, 6, 6, '#3a1d08'); g.fillStyle = '#3a1d08'; g.fillRect(-3, 8, 6, 14);
  g.restore();
}

/** Oku Oku small head (for HUD masks and dialog portraits). */
export function drawOkuIcon(g, size, t = 0, mood = 'talk') {
  g.save(); g.translate(size / 2, size / 2 + size * 0.06); g.scale(size / 92, size / 92); drawOku(g, { t, mood }); g.restore();
}
export function drawZinaHead(g, size, t = 0) {
  g.save(); g.translate(size / 2, size * 1.02); g.scale(size / 72, size / 72); drawZina(g, { t, noShadow: true, mood: 'happy' }); g.restore();
}
export function drawCortisolHead(g, size, t = 0, mood = 'evil') {
  g.save(); g.translate(size / 2, size * 1.58); g.scale(size / 112, size / 112); drawCortisol(g, { t, mood, noShadow: true }); g.restore();
}

// ------------------------------------------------------------------ cached icons (data URLs)
const cache = new Map();
export function iconURL(name, size = 128) {
  const key = `${name}@${size}`;
  if (cache.has(key)) return cache.get(key);
  let url = '';
  try {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const [kind, arg] = name.split(':');
    const m = size / 2;
    switch (kind) {
      case 'firefly': g.translate(m, m); drawFirefly(g, size * 0.95); break;
      case 'lumen': drawLumenHead(g, size, { mood: arg || 'happy' }); break;
      case 'zina': drawZinaHead(g, size); break;
      case 'oku': drawOkuIcon(g, size, 0.3, arg || 'talk'); break;
      case 'cortisol': drawCortisolHead(g, size, 0.2, arg || 'evil'); break;
      case 'crate': g.translate(m, m); drawCrate(g, size * 0.78, arg || 'basic'); break;
      case 'sock': g.translate(m, m + size * 0.02); drawSock(g, size * 0.9, arg || 'red'); break;
      case 'spoon': g.translate(m, m + size * 0.04); drawSpoon(g, size * 0.85, arg || 'gold'); break;
      case 'lock': g.translate(m, m); drawLock(g, size * 0.8); break;
      case 'emoji': {
        g.fillStyle = '#fff7dc'; g.beginPath(); g.arc(m, m, m * 0.96, 0, Math.PI * 2); g.fill();
        g.font = `${Math.round(size * 0.62)}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name.slice(6), m, m * 1.06);
        break;
      }
      default: break;
    }
    url = c.toDataURL('image/png');
  } catch (err) { url = ''; }
  cache.set(key, url);
  return url;
}

/** Creates a crisp canvas sized to its CSS box (DPR capped). Returns { canvas, g, w, h, resize() }. */
export function makeCanvas(cls, maxDpr = 2) {
  const canvas = document.createElement('canvas');
  if (cls) canvas.className = cls;
  const g = canvas.getContext('2d');
  const state = { canvas, g, w: 0, h: 0, dpr: 1 };
  state.resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== state.w || h !== state.h || dpr !== state.dpr) {
      state.w = w; state.h = h; state.dpr = dpr;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return state;
  };
  return state;
}
