// Procedural canvas textures for platform surfaces + the surface "styles" (top / side / band materials).
// Everything is cached at module level and shared between levels (never disposed by a level).
import * as THREE from 'three';
import { makeCanvas, canvasTex, rng, wrapDraw, css, cssA, mixHex, mulHex, FONT, roundRect } from './env-util.js';

const S = 256; // texture size

// ---------------------------------------------------------------- painting helpers
function fill(ctx, col) { ctx.fillStyle = css(col); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); }
function blotches(ctx, r, n, cols, rMin, rMax, alpha = 0.25) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = rMin + r() * (rMax - rMin);
    const col = cols[Math.floor(r() * cols.length)];
    wrapDraw(W, H, x, y, rad, (xx, yy) => {
      const g = ctx.createRadialGradient(xx, yy, 0, xx, yy, rad);
      g.addColorStop(0, cssA(col, alpha)); g.addColorStop(1, cssA(col, 0));
      ctx.fillStyle = g; ctx.fillRect(xx - rad, yy - rad, rad * 2, rad * 2);
    });
  }
}
function speckle(ctx, r, n, cols, s0 = 1, s1 = 2.5, alpha = 0.6) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cssA(cols[Math.floor(r() * cols.length)], alpha);
    const s = s0 + r() * (s1 - s0);
    ctx.fillRect(r() * W, r() * H, s, s);
  }
}
/** stroke a polyline at the 9 wrapped offsets (seamless) */
function wrapStroke(ctx, pts) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx * W, y + dy * H) : ctx.moveTo(x + dx * W, y + dy * H)));
    ctx.stroke();
  }
}
function wrapPath(ctx, W, H, x, y, rad, build, style) {
  wrapDraw(W, H, x, y, rad, (xx, yy) => { ctx.beginPath(); build(xx, yy); style(); });
}

// ---------------------------------------------------------------- generators (each returns a canvas)
const GEN = {
  grassTop({ a, b, c, flowers = [], blades = 900 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    blotches(ctx, r, 26, [b, c], 18, 60, 0.45);
    ctx.lineCap = 'round';
    for (let i = 0; i < blades; i++) {
      const x = r() * S, y = r() * S, l = 3 + r() * 6, ang = -Math.PI / 2 + (r() - 0.5) * 0.9;
      const col = r() < 0.5 ? mixHex(b, 0xffffff, 0.25) : mulHex(c, 0.85);
      ctx.strokeStyle = cssA(col, 0.55); ctx.lineWidth = 1.2 + r();
      wrapDraw(S, S, x, y, l, (xx, yy) => { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + Math.cos(ang) * l, yy + Math.sin(ang) * l); ctx.stroke(); });
    }
    for (let i = 0; i < flowers.length * 7; i++) {
      const x = r() * S, y = r() * S, col = flowers[i % flowers.length];
      wrapDraw(S, S, x, y, 4, (xx, yy) => {
        ctx.fillStyle = css(col);
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(xx + Math.cos(k * 1.256) * 2.2, yy + Math.sin(k * 1.256) * 2.2, 1.7, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(xx, yy, 1.3, 0, 7); ctx.fill();
      });
    }
    return cv;
  },
  dirtSide({ a, b, c, pebble = 0xb79a7a, roots = 0x4a2f22 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    // wavy strata
    for (let i = 0; i < 6; i++) {
      const y0 = (i + r() * 0.6) * S / 6, amp = 3 + r() * 5, ph = r() * 6, th = 6 + r() * 14;
      ctx.fillStyle = cssA(i % 2 ? b : c, 0.45);
      ctx.beginPath(); ctx.moveTo(0, y0);
      for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y0 + Math.sin(x / S * Math.PI * 2 * 2 + ph) * amp);
      for (let x = S; x >= 0; x -= 8) ctx.lineTo(x, y0 + th + Math.sin(x / S * Math.PI * 2 * 2 + ph + 1) * amp);
      ctx.fill();
    }
    blotches(ctx, r, 16, [b, c], 10, 30, 0.35);
    speckle(ctx, r, 500, [b, c, mulHex(a, 1.25)], 1, 3, 0.5);
    for (let i = 0; i < 26; i++) {
      const x = r() * S, y = r() * S, w = 4 + r() * 9, h = 3 + r() * 6;
      wrapDraw(S, S, x, y, w, (xx, yy) => {
        ctx.fillStyle = css(mulHex(pebble, 0.75)); ctx.beginPath(); ctx.ellipse(xx, yy + 1, w, h, 0, 0, 7); ctx.fill();
        ctx.fillStyle = css(pebble); ctx.beginPath(); ctx.ellipse(xx, yy, w * 0.92, h * 0.85, 0, 0, 7); ctx.fill();
        ctx.fillStyle = cssA(0xffffff, 0.35); ctx.beginPath(); ctx.ellipse(xx - w * 0.3, yy - h * 0.35, w * 0.35, h * 0.25, 0, 0, 7); ctx.fill();
      });
    }
    ctx.strokeStyle = cssA(roots, 0.55); ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      let x = r() * S, y = r() * S * 0.3;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 14; y += 6 + r() * 8; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return cv;
  },
  /** horizontal fringe band with alpha (grass tufts, sand/snow drips, painted trims, hazard stripes) */
  band({ shape = 'grass', a, b, c = 0x000000, h = 64 }, r) {
    const W = S, H = h;
    const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
    if (shape === 'stripe') {
      ctx.fillStyle = css(a); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = css(b);
      for (let x = -H; x < W + H; x += 32) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 16, H); ctx.lineTo(x + 16 + H * 0.6, 0); ctx.lineTo(x + H * 0.6, 0); ctx.fill(); }
      ctx.fillStyle = css(c); ctx.fillRect(0, 0, W, 4); ctx.fillRect(0, H - 4, W, 4);
      return cv;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, css(mixHex(a, 0xffffff, 0.12))); grad.addColorStop(0.45, css(a)); grad.addColorStop(1, css(b));
    if (shape === 'grass') {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.34);
      // tufts: pointy blades hanging down
      for (let x = -6; x < W + 6; x += 5 + r() * 5) {
        const len = H * (0.42 + r() * 0.52), w = 6 + r() * 7;
        ctx.beginPath(); ctx.moveTo(x - w / 2, H * 0.3); ctx.quadraticCurveTo(x + (r() - 0.5) * 4, H * 0.3 + len * 0.6, x + (r() - 0.5) * 5, H * 0.3 + len * 0.98 > H - 1 ? H - 1 : H * 0.3 + len * 0.98);
        ctx.quadraticCurveTo(x + 1, H * 0.3 + len * 0.5, x + w / 2, H * 0.3); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = cssA(mulHex(b, 0.7), 0.6); ctx.lineWidth = 1;
      for (let i = 0; i < 70; i++) { const x = r() * W, y = r() * H * 0.3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 4 + r() * 6); ctx.stroke(); }
      ctx.fillStyle = cssA(0xffffff, 0.22); ctx.fillRect(0, 0, W, 3);
    } else if (shape === 'drip') {
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H * 0.38);
      for (let x = 0; x < W; x += 14 + r() * 18) {
        const len = H * (0.2 + r() * 0.55), w = 8 + r() * 12;
        ctx.beginPath(); ctx.ellipse(x, H * 0.36 + len * 0.5, w / 2, len * 0.55, 0, 0, 7); ctx.fill();
        if (x < 20) { ctx.beginPath(); ctx.ellipse(x + W, H * 0.36 + len * 0.5, w / 2, len * 0.55, 0, 0, 7); ctx.fill(); }
        if (x > W - 20) { ctx.beginPath(); ctx.ellipse(x - W, H * 0.36 + len * 0.5, w / 2, len * 0.55, 0, 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = cssA(0xffffff, 0.35); ctx.fillRect(0, 0, W, 4);
    } else if (shape === 'trim') {
      ctx.fillStyle = css(a); ctx.fillRect(0, 0, W, H * 0.62);
      ctx.fillStyle = css(b); ctx.fillRect(0, H * 0.5, W, H * 0.12);
      for (let x = 8; x < W; x += 16) { ctx.beginPath(); ctx.arc(x, H * 0.62, 7, 0, Math.PI); ctx.fill(); }
      ctx.fillStyle = cssA(0xffffff, 0.3); ctx.fillRect(0, 0, W, 4);
    } else if (shape === 'gold') {
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H * 0.6);
      ctx.fillStyle = css(c);
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, H * 0.6); ctx.lineTo(x + 16, H * 0.98); ctx.lineTo(x + 32, H * 0.6); ctx.fill(); }
      ctx.fillStyle = css(b);
      for (let x = 16; x < W; x += 32) { ctx.beginPath(); ctx.arc(x, H * 0.3, 6, 0, 7); ctx.fill(); }
      ctx.fillStyle = cssA(0xffffff, 0.5); ctx.fillRect(0, 0, W, 3);
    }
    return cv;
  },
  sandTop({ a, b, c, shells = false }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    blotches(ctx, r, 22, [b, c], 20, 60, 0.4);
    // ripples
    for (let i = 0; i < 16; i++) {
      const y0 = i * S / 16 + r() * 6, ph = r() * 6.28;
      ctx.strokeStyle = cssA(i % 2 ? c : mixHex(a, 0xffffff, 0.4), 0.45); ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= S; x += 6) ctx.lineTo(x, y0 + Math.sin(x / S * Math.PI * 4 + ph) * 4);
      ctx.stroke();
    }
    speckle(ctx, r, 900, [b, c, 0xffffff], 1, 2, 0.5);
    if (shells) {
      for (let i = 0; i < 7; i++) {
        const x = r() * S, y = r() * S, k = r();
        wrapDraw(S, S, x, y, 8, (xx, yy) => {
          if (k < 0.5) { // shell
            ctx.fillStyle = css(r() < 0.5 ? 0xffd2c0 : 0xfff0e0); ctx.beginPath(); ctx.arc(xx, yy, 5, Math.PI, 0); ctx.lineTo(xx, yy + 4); ctx.fill();
            ctx.strokeStyle = cssA(0xc08070, 0.6); ctx.lineWidth = 0.8; for (let s = -2; s <= 2; s++) { ctx.beginPath(); ctx.moveTo(xx, yy + 3); ctx.lineTo(xx + s * 2, yy - 4); ctx.stroke(); }
          } else { // starfish
            ctx.fillStyle = css(0xf08a5a); ctx.beginPath();
            for (let s = 0; s < 10; s++) { const rr = s % 2 ? 2 : 6, an = s * Math.PI / 5; ctx.lineTo(xx + Math.cos(an) * rr, yy + Math.sin(an) * rr); }
            ctx.fill();
          }
        });
      }
    }
    return cv;
  },
  /** horizontal layered rock (sandstone, ice cliffs, basalt) */
  strata({ cols, cracks = 0x000000, crackA = 0.25, glow = null }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, cols[0]);
    let y = 0, i = 0;
    while (y < S) {
      const th = 10 + r() * 26, ph = r() * 6.28, amp = 2 + r() * 4;
      ctx.fillStyle = css(cols[i % cols.length]);
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x / S * Math.PI * 2 + ph) * amp);
      for (let x = S; x >= 0; x -= 8) ctx.lineTo(x, y + th + Math.sin(x / S * Math.PI * 2 + ph * 1.3) * amp);
      ctx.fill();
      ctx.strokeStyle = cssA(0xffffff, 0.18); ctx.lineWidth = 1.5;
      ctx.beginPath(); for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x / S * Math.PI * 2 + ph) * amp + 1); ctx.stroke();
      y += th; i++;
    }
    blotches(ctx, r, 14, [cols[1 % cols.length], cols[0]], 10, 34, 0.3);
    speckle(ctx, r, 500, [0xffffff, cracks], 1, 2.5, 0.25);
    ctx.strokeStyle = cssA(cracks, crackA); ctx.lineWidth = 1.5;
    for (let k = 0; k < 12; k++) {
      let x = r() * S, yy = r() * S;
      ctx.beginPath(); ctx.moveTo(x, yy);
      for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 10; yy += 5 + r() * 10; ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    if (glow) {
      ctx.shadowColor = css(glow); ctx.shadowBlur = 8;
      ctx.strokeStyle = css(glow); ctx.lineWidth = 2.5;
      for (let k = 0; k < 9; k++) {
        let x = r() * S, yy = r() * S;
        ctx.beginPath(); ctx.moveTo(x, yy);
        for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 30; yy += (r() - 0.5) * 30; ctx.lineTo(x, yy); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    return cv;
  },
  /** stone blocks / bricks / tiles with mortar & bevels. rows×cols per tile, random widths if `irregular` */
  blocks({ base, vary = [], mortar, rows = 4, cols = 2, offset = 0.5, bevel = 3, irregular = false, moss = null, gap = 3, round = 3, sparkle = false, cracks = 0.3 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, mortar);
    const rh = S / rows;
    for (let j = 0; j < rows; j++) {
      let xs = [];
      if (irregular) {
        let x = (r() * 0.5) * S / cols;
        const x0 = x;
        while (x < S + x0 - 12) { const w = S / cols * (0.55 + r() * 0.9); xs.push([x, Math.min(w, S + x0 - x)]); x += w; }
      } else {
        const off = (j % 2) * offset * S / cols;
        for (let i = -1; i < cols; i++) xs.push([off + i * S / cols, S / cols]);
      }
      for (const [x, w] of xs) {
        const col = vary.length ? vary[Math.floor(r() * vary.length)] : base;
        const k = 0.9 + r() * 0.2;
        const c0 = mulHex(col, k);
        const y = j * rh;
        const drawOne = (xx) => {
          roundRect(ctx, xx + gap / 2, y + gap / 2, w - gap, rh - gap, round);
          ctx.fillStyle = css(c0); ctx.fill();
          if (bevel) {
            ctx.fillStyle = cssA(0xffffff, 0.22); ctx.fillRect(xx + gap / 2 + 2, y + gap / 2 + 1, w - gap - 4, bevel);
            ctx.fillStyle = cssA(0x000000, 0.18); ctx.fillRect(xx + gap / 2 + 2, y + rh - gap / 2 - bevel - 1, w - gap - 4, bevel);
          }
          // speckle inside
          ctx.fillStyle = cssA(mulHex(c0, 0.8), 0.5);
          for (let s = 0; s < w * rh / 120; s++) ctx.fillRect(xx + gap + r() * (w - gap * 2), y + gap + r() * (rh - gap * 2), 1.5, 1.5);
          if (r() < cracks) {
            ctx.strokeStyle = cssA(0x000000, 0.25); ctx.lineWidth = 1;
            let cx = xx + w * (0.2 + r() * 0.6), cy = y + gap;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            for (let s = 0; s < 3; s++) { cx += (r() - 0.5) * 10; cy += rh / 4; ctx.lineTo(cx, cy); }
            ctx.stroke();
          }
          if (sparkle && r() < 0.5) {
            const sx = xx + w * r(), sy = y + rh * r();
            ctx.fillStyle = cssA(0xffffff, 0.9);
            ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx + 1.2, sy - 1.2); ctx.lineTo(sx + 5, sy); ctx.lineTo(sx + 1.2, sy + 1.2); ctx.lineTo(sx, sy + 5); ctx.lineTo(sx - 1.2, sy + 1.2); ctx.lineTo(sx - 5, sy); ctx.lineTo(sx - 1.2, sy - 1.2); ctx.fill();
          }
        };
        drawOne(x);
        if (x + w > S) drawOne(x - S);
        if (x < 0) drawOne(x + S);
      }
    }
    if (moss) blotches(ctx, r, 12, [moss], 8, 26, 0.55);
    return cv;
  },
  planks({ base, dark, n = 4, nails = true, gaps = false, vary = 0.12 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    if (!gaps) fill(ctx, dark); else ctx.clearRect(0, 0, S, S);
    const pw = S / n;
    for (let i = 0; i < n; i++) {
      const x = i * pw, k = 1 - vary + r() * vary * 2;
      const c0 = mulHex(base, k);
      const g = gaps ? 6 : 2;
      ctx.fillStyle = css(c0); ctx.fillRect(x + g / 2, 0, pw - g, S);
      // grain
      for (let s = 0; s < 14; s++) {
        ctx.strokeStyle = cssA(mulHex(c0, 0.72), 0.5); ctx.lineWidth = 1;
        const gx = x + g / 2 + 3 + r() * (pw - g - 6), ph = r() * 6;
        ctx.beginPath(); for (let y = 0; y <= S; y += 8) ctx.lineTo(gx + Math.sin(y / 40 + ph) * 2, y); ctx.stroke();
      }
      // knots
      for (let s = 0; s < 2; s++) {
        const kx = x + pw * (0.3 + r() * 0.4), ky = r() * S;
        ctx.strokeStyle = cssA(mulHex(c0, 0.6), 0.7); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(kx, ky, 3, 6, 0, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = cssA(0xffffff, 0.18); ctx.fillRect(x + g / 2, 0, 3, S);
      ctx.fillStyle = cssA(0x000000, 0.18); ctx.fillRect(x + pw - g / 2 - 3, 0, 3, S);
      // cross cut
      const cy = r() * S;
      ctx.fillStyle = css(dark); ctx.fillRect(x + g / 2, cy, pw - g, 2);
      if (nails) {
        ctx.fillStyle = '#6a6a72';
        for (const yy of [cy - 8, cy + 10]) { ctx.beginPath(); ctx.arc(x + pw * 0.3, (yy + S) % S, 2.2, 0, 7); ctx.arc(x + pw * 0.7, (yy + S) % S, 2.2, 0, 7); ctx.fill(); }
      }
    }
    return cv;
  },
  diamondPlate({ base }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, css(mixHex(base, 0xffffff, 0.12))); g.addColorStop(0.5, css(base)); g.addColorStop(1, css(mixHex(base, 0xffffff, 0.08)));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) {
      const ox = (y / 16) % 2 ? 8 : 0;
      ctx.save(); ctx.translate(x + ox + 4, y + 8); ctx.rotate(((x + y) / 16) % 2 ? 0.7 : -0.7);
      ctx.fillStyle = cssA(0x000000, 0.25); ctx.fillRect(-5, -1, 10, 3);
      ctx.fillStyle = cssA(0xffffff, 0.45); ctx.fillRect(-5, -2, 10, 2);
      ctx.restore();
    }
    blotches(ctx, r, 10, [0x000000], 10, 40, 0.12);
    ctx.strokeStyle = cssA(0x000000, 0.35); ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
    ctx.fillStyle = '#d8d8e0';
    for (const [x, y] of [[8, 8], [S - 8, 8], [8, S - 8], [S - 8, S - 8]]) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); }
    return cv;
  },
  panel({ base, line, rivets = true, glow = null, n = 2 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, base);
    const p = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * p, y = j * p;
      const gr = ctx.createLinearGradient(x, y, x, y + p);
      gr.addColorStop(0, css(mixHex(base, 0xffffff, 0.1 + r() * 0.05))); gr.addColorStop(1, css(mulHex(base, 0.88)));
      ctx.fillStyle = gr; ctx.fillRect(x + 3, y + 3, p - 6, p - 6);
      ctx.strokeStyle = css(line); ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, y + 1.5, p - 3, p - 3);
      if (rivets) {
        ctx.fillStyle = css(mixHex(base, 0xffffff, 0.35));
        for (const [a, b] of [[10, 10], [p - 10, 10], [10, p - 10], [p - 10, p - 10]]) { ctx.beginPath(); ctx.arc(x + a, y + b, 3, 0, 7); ctx.fill(); }
      }
      if (r() < 0.35) { // vent or label
        ctx.fillStyle = cssA(0x000000, 0.25);
        for (let k = 0; k < 4; k++) ctx.fillRect(x + p * 0.3, y + p * 0.35 + k * 8, p * 0.4, 3);
      }
    }
    if (glow) {
      ctx.shadowColor = css(glow); ctx.shadowBlur = 10; ctx.strokeStyle = css(glow); ctx.lineWidth = 2;
      for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * p, 0); ctx.lineTo(i * p, S); ctx.moveTo(0, i * p); ctx.lineTo(S, i * p); ctx.stroke(); }
      ctx.shadowBlur = 0;
    }
    blotches(ctx, r, 8, [0x000000], 10, 30, 0.08);
    return cv;
  },
  ice({ a, b }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, mixHex(a, b, 0.4));
    blotches(ctx, r, 22, [a, b], 25, 70, 0.55);
    blotches(ctx, r, 14, [0xffffff], 15, 45, 0.25);
    ctx.strokeStyle = cssA(0xffffff, 0.8); ctx.lineWidth = 1.4;
    for (let k = 0; k < 10; k++) {
      const pts = [[r() * S, r() * S]];
      for (let s = 0; s < 5; s++) pts.push([pts[s][0] + (r() - 0.5) * 50, pts[s][1] + (r() - 0.5) * 50]);
      wrapStroke(ctx, pts);
    }
    ctx.strokeStyle = cssA(0xffffff, 0.3); ctx.lineWidth = 6;
    for (let k = 0; k < 3; k++) { const x = r() * S; wrapStroke(ctx, [[x, 0], [x + S / 4, S]]); }
    return cv;
  },
  snowTop({ a, b }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    blotches(ctx, r, 30, [b], 12, 50, 0.35);
    speckle(ctx, r, 500, [0xffffff], 1, 2, 0.9);
    for (let k = 0; k < 30; k++) {
      const x = r() * S, y = r() * S;
      ctx.fillStyle = cssA(b, 0.4); ctx.beginPath(); ctx.ellipse(x, y, 4 + r() * 6, 2, 0, 0, 7); ctx.fill();
    }
    for (let k = 0; k < 25; k++) {
      const x = r() * S, y = r() * S;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + 0.8, y); ctx.lineTo(x, y + 3); ctx.lineTo(x - 0.8, y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x, y + 0.8); ctx.lineTo(x + 3, y); ctx.lineTo(x, y - 0.8); ctx.fill();
    }
    return cv;
  },
  zellige({ cols, grout = 0xf4ecd8 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, grout);
    const n = 4, p = S / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const cx = i * p + p / 2, cy = j * p + p / 2;
      // eight point star
      ctx.fillStyle = css(cols[(i + j) % cols.length]);
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const rr = k % 2 ? p * 0.27 : p * 0.45, an = k * Math.PI / 8; ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); }
      ctx.fill();
      ctx.fillStyle = css(cols[(i + j + 2) % cols.length]);
      ctx.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + Math.PI / 8; ctx.lineTo(cx + Math.cos(an) * p * 0.2, cy + Math.sin(an) * p * 0.2); } ctx.fill();
      // corner diamonds
      ctx.fillStyle = css(cols[(i + j + 1) % cols.length]);
      const x0 = i * p, y0 = j * p;
      ctx.beginPath(); ctx.moveTo(x0, y0 - 9); ctx.lineTo(x0 + 9, y0); ctx.lineTo(x0, y0 + 9); ctx.lineTo(x0 - 9, y0); ctx.fill();
    }
    ctx.fillStyle = cssA(0xffffff, 0.15); for (let k = 0; k < 60; k++) ctx.fillRect(r() * S, r() * S, 6, 2);
    return cv;
  },
  plaster({ a, b, cracks = 0.2 }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    blotches(ctx, r, 26, [b, mixHex(a, 0xffffff, 0.5)], 14, 46, 0.35);
    speckle(ctx, r, 400, [b], 1, 2, 0.3);
    ctx.strokeStyle = cssA(mulHex(b, 0.7), cracks); ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      let x = r() * S, y = r() * S;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (r() - 0.5) * 18; y += 4 + r() * 8; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    return cv;
  },
  crystal({ cols }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, cols[0]);
    for (let k = 0; k < 40; k++) {
      const x = r() * S, y = r() * S, rad = 20 + r() * 40, col = cols[Math.floor(r() * cols.length)];
      wrapDraw(S, S, x, y, rad, (xx, yy) => {
        ctx.beginPath();
        const n = 3 + Math.floor(r() * 3), a0 = r() * 6;
        for (let s = 0; s < n; s++) { const an = a0 + s * Math.PI * 2 / n; ctx.lineTo(xx + Math.cos(an) * rad, yy + Math.sin(an) * rad); }
        ctx.closePath();
        const g = ctx.createLinearGradient(xx - rad, yy - rad, xx + rad, yy + rad);
        g.addColorStop(0, cssA(mixHex(col, 0xffffff, 0.35), 0.75)); g.addColorStop(1, cssA(col, 0.55));
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = cssA(0xffffff, 0.45); ctx.lineWidth = 1.2; ctx.stroke();
      });
    }
    return cv;
  },
  cloud({ a, b }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, a);
    blotches(ctx, r, 30, [b], 20, 60, 0.35);
    blotches(ctx, r, 30, [0xffffff], 14, 40, 0.6);
    return cv;
  },
  conveyor({ belt, arrow, rail }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, belt);
    // ribs across the belt (perpendicular to v)
    for (let y = 0; y < S; y += 16) { ctx.fillStyle = cssA(0x000000, 0.35); ctx.fillRect(0, y, S, 3); ctx.fillStyle = cssA(0xffffff, 0.08); ctx.fillRect(0, y + 3, S, 2); }
    // chevrons pointing to -v (the texture scrolls toward +world direction after UV mapping, see platforms)
    ctx.fillStyle = css(arrow);
    for (let y = 0; y < S; y += 128) {
      ctx.beginPath();
      ctx.moveTo(S * 0.5, y + 20); ctx.lineTo(S * 0.8, y + 80); ctx.lineTo(S * 0.68, y + 80); ctx.lineTo(S * 0.5, y + 44); ctx.lineTo(S * 0.32, y + 80); ctx.lineTo(S * 0.2, y + 80);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = css(rail); ctx.fillRect(0, 0, 14, S); ctx.fillRect(S - 14, 0, 14, S);
    ctx.fillStyle = cssA(0x000000, 0.4); ctx.fillRect(14, 0, 3, S); ctx.fillRect(S - 17, 0, 3, S);
    return cv;
  },
  glass({ tint, frame }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    ctx.fillStyle = cssA(tint, 0.35); ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = cssA(0xffffff, 0.55); ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(30, S); ctx.lineTo(S, 30); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(70, S); ctx.lineTo(S, 70); ctx.stroke();
    ctx.strokeStyle = css(frame); ctx.lineWidth = 10; ctx.strokeRect(5, 5, S - 10, S - 10);
    ctx.strokeStyle = cssA(0xffffff, 0.6); ctx.lineWidth = 2; ctx.strokeRect(11, 11, S - 22, S - 22);
    return cv;
  },
  lava({ hot, mid, crust }, r) {
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    fill(ctx, mid);
    blotches(ctx, r, 24, [hot], 20, 60, 0.7);
    blotches(ctx, r, 20, [0xfff2a0], 10, 40, 0.6);
    for (let k = 0; k < 26; k++) {
      const x = r() * S, y = r() * S, rad = 10 + r() * 24;
      wrapPath(ctx, S, S, x, y, rad, (xx, yy) => {
        const n = 7; for (let s = 0; s < n; s++) { const an = s * Math.PI * 2 / n, rr = rad * (0.7 + r() * 0.3); ctx.lineTo(xx + Math.cos(an) * rr, yy + Math.sin(an) * rr * 0.7); }
        ctx.closePath();
      }, () => { ctx.fillStyle = cssA(crust, 0.8); ctx.fill(); ctx.strokeStyle = cssA(0xffd070, 0.7); ctx.lineWidth = 2; ctx.stroke(); });
    }
    return cv;
  },
  detail({ lo = 205 }, r) {
    // greyscale detail texture for the terrain (vertex colours carry the hue)
    const cv = makeCanvas(S), ctx = cv.getContext('2d');
    ctx.fillStyle = `rgb(${lo + 30},${lo + 30},${lo + 30})`; ctx.fillRect(0, 0, S, S);
    const grey = (v) => (v << 16) | (v << 8) | v;
    blotches(ctx, r, 40, [grey(lo - 30), grey(255)], 10, 50, 0.4);
    speckle(ctx, r, 1600, [grey(lo - 50), grey(255)], 1, 3, 0.45);
    ctx.lineCap = 'round';
    for (let i = 0; i < 500; i++) {
      const x = r() * S, y = r() * S, l = 3 + r() * 5;
      ctx.strokeStyle = cssA(r() < 0.5 ? grey(255) : grey(lo - 40), 0.35); ctx.lineWidth = 1.2;
      wrapDraw(S, S, x, y, l, (xx, yy) => { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (r() - 0.5) * 3, yy - l); ctx.stroke(); });
    }
    return cv;
  },
};

// ---------------------------------------------------------------- texture cache
const texCache = new Map();
export function getTex(gen, params, opts) {
  const key = gen + JSON.stringify(params) + (opts ? JSON.stringify(opts) : '');
  let t = texCache.get(key);
  if (!t) {
    const cv = GEN[gen](params, rng(key.length * 7919 + key.charCodeAt(3)));
    t = canvasTex(cv, opts);
    texCache.set(key, t);
  }
  return t;
}

// ---------------------------------------------------------------- surface styles
// top/side: [generator, params]; ts/ss = metres per texture repeat; band = fringe on top of the sides.
// mat: lambert | phong | ice | glass | crystal | lava | cloud | basalt
export const STYLES = {
  grass: { top: ['grassTop', { a: 0x6cc24a, b: 0x8fd85a, c: 0x4fa83e, flowers: [0xfff7dc, 0xffd76a] }], side: ['dirtSide', { a: 0x9a6a42, b: 0x7f5434, c: 0xb07e50 }], band: ['band', { shape: 'grass', a: 0x72c84c, b: 0x3f9a3a }], ts: 4, ss: 3 },
  grass_jungle: { top: ['grassTop', { a: 0x58b048, b: 0x7dcc58, c: 0x3c9440, flowers: [0xe98c73, 0xffd76a, 0xdbb2f6] }], side: ['dirtSide', { a: 0x8a5a3a, b: 0x6a4228, c: 0xa6704a, pebble: 0xa89a80 }], band: ['band', { shape: 'grass', a: 0x60b84a, b: 0x2f7f38 }], ts: 4, ss: 3 },
  grass_dry: { top: ['grassTop', { a: 0xb8c060, b: 0xd2cf78, c: 0x98a24a, flowers: [] }], side: ['dirtSide', { a: 0xb07a4a, b: 0x93603a, c: 0xc89060 }], band: ['band', { shape: 'grass', a: 0xb8c060, b: 0x8a8a3a }], ts: 4, ss: 3 },
  grass_night: { top: ['grassTop', { a: 0x4f9a7a, b: 0x6ab89a, c: 0x3a7f6a, flowers: [0xb5f3d0, 0xdbb2f6] }], side: ['dirtSide', { a: 0x4a4070, b: 0x3a3060, c: 0x5a5080, pebble: 0x8a80b0, roots: 0x2a2048 }], band: ['band', { shape: 'grass', a: 0x5aa888, b: 0x2f6a5a }], ts: 4, ss: 3 },
  sand_beach: { top: ['sandTop', { a: 0xf6e2ae, b: 0xeed39a, c: 0xe0c084, shells: true }], side: ['strata', { cols: [0xe8c890, 0xd8b078, 0xf0d6a0, 0xc89a66], cracks: 0x8a6040 }], band: ['band', { shape: 'drip', a: 0xf4dca6, b: 0xe2c286 }], ts: 5, ss: 4 },
  sand_desert: { top: ['sandTop', { a: 0xf2c886, b: 0xe8b46e, c: 0xd99e5a }], side: ['strata', { cols: [0xd88a54, 0xc0703e, 0xe8a066, 0xb05e36], cracks: 0x6a3018 }], band: ['band', { shape: 'drip', a: 0xf0c27e, b: 0xd8a060 }], ts: 5, ss: 4 },
  stone: { top: ['blocks', { base: 0xb8b0a0, vary: [0xb8b0a0, 0xa8a094, 0xc4bcaa], mortar: 0x7a7468, rows: 4, cols: 3, irregular: true }], side: ['blocks', { base: 0x9a9284, vary: [0x9a9284, 0x8a8478, 0xaaa294], mortar: 0x5f5a50, rows: 4, cols: 2 }], ts: 3, ss: 3 },
  stone_mossy: { top: ['blocks', { base: 0xa8a890, vary: [0xa8a890, 0x98a088, 0xb4b29a], mortar: 0x6a7058, rows: 4, cols: 3, irregular: true, moss: 0x5aa048 }], side: ['blocks', { base: 0x8a8a78, vary: [0x8a8a78, 0x7a8070, 0x9a9a84], mortar: 0x585c4a, rows: 4, cols: 2, moss: 0x4f9040 }], band: ['band', { shape: 'grass', a: 0x5aa848, b: 0x2f7a38 }], ts: 3, ss: 3 },
  stone_sand: { top: ['blocks', { base: 0xe2c08c, vary: [0xe2c08c, 0xd8b07a, 0xeccb98], mortar: 0xb08a5a, rows: 4, cols: 2, irregular: true }], side: ['blocks', { base: 0xd4a46c, vary: [0xd4a46c, 0xc8965e, 0xdcb078], mortar: 0x9a7048, rows: 3, cols: 2 }], ts: 3, ss: 3 },
  stone_ice: { top: ['blocks', { base: 0xc8d8ec, vary: [0xc8d8ec, 0xb8cae2, 0xd8e6f6], mortar: 0x8aa0c0, rows: 4, cols: 3, irregular: true }], side: ['blocks', { base: 0x9ab0d0, vary: [0x9ab0d0, 0x8aa2c4, 0xaabedc], mortar: 0x6a80a8, rows: 4, cols: 2 }], band: ['band', { shape: 'drip', a: 0xffffff, b: 0xdce8f8 }], ts: 3, ss: 3 },
  stone_cave: { top: ['blocks', { base: 0x9a8ac4, vary: [0x9a8ac4, 0x8a7cb4, 0xaa9ad0], mortar: 0x4a3e6a, rows: 4, cols: 3, irregular: true, moss: 0x5ad0b0 }], side: ['strata', { cols: [0x5a4a7a, 0x4a3c6a, 0x6a5a8a, 0x3e3260], cracks: 0x1c1640 }], ts: 3, ss: 4 },
  stone_dark: { top: ['blocks', { base: 0x6a6478, vary: [0x6a6478, 0x5a5468, 0x787088], mortar: 0x3a3448, rows: 4, cols: 3, irregular: true }], side: ['blocks', { base: 0x5a546a, vary: [0x5a546a, 0x4c4860, 0x686078], mortar: 0x2e2a3c, rows: 4, cols: 2 }], ts: 3, ss: 3 },
  wood: { top: ['planks', { base: 0xc08a52, dark: 0x6a4428 }], side: ['planks', { base: 0xa87444, dark: 0x5a3820, n: 3, nails: false }], ts: 3, ss: 3, plankAlong: true },
  wood_pale: { top: ['planks', { base: 0xd8b07a, dark: 0x8a6a48 }], side: ['planks', { base: 0xc49a66, dark: 0x7a5a3c, n: 3, nails: false }], ts: 3, ss: 3, plankAlong: true },
  metal: { top: ['diamondPlate', { base: 0x9aa2ae }], side: ['panel', { base: 0x7a8494, line: 0x4a5260 }], band: ['band', { shape: 'stripe', a: 0xedc371, b: 0x2a2630, c: 0x2a2630, h: 32 }], mat: 'phong', ts: 2, ss: 2, bandH: 0.25 },
  metal_dark: { top: ['diamondPlate', { base: 0x6a6480 }], side: ['panel', { base: 0x4a4460, line: 0x2a2440 }], band: ['band', { shape: 'stripe', a: 0xe98c73, b: 0x241c34, c: 0x241c34, h: 32 }], mat: 'phong', ts: 2, ss: 2, bandH: 0.25 },
  panel_space: { top: ['panel', { base: 0x8a86b0, line: 0x4a4478, glow: 0x7ff0e0, n: 2 }], side: ['panel', { base: 0x5a5488, line: 0x34305a, n: 2 }], band: ['band', { shape: 'stripe', a: 0x7ff0e0, b: 0x34305a, c: 0x1c1640, h: 32 }], mat: 'phong', ts: 3, ss: 3, bandH: 0.22 },
  ice: { top: ['ice', { a: 0xd8f4ff, b: 0x9fd8f4 }], side: ['ice', { a: 0x9ed4f0, b: 0x5fa8dc }], band: ['band', { shape: 'drip', a: 0xffffff, b: 0xd8f0ff }], mat: 'ice', ts: 4, ss: 3 },
  snow: { top: ['snowTop', { a: 0xf6faff, b: 0xc8daf0 }], side: ['strata', { cols: [0xb8d0ec, 0xa6c2e4, 0xcadcf2, 0x94b4dc], cracks: 0x5a78a8 }], band: ['band', { shape: 'drip', a: 0xffffff, b: 0xe0ecfa }], ts: 4, ss: 3 },
  snow_night: { top: ['snowTop', { a: 0xe6eeff, b: 0xb0bce8 }], side: ['strata', { cols: [0x6a78b0, 0x5a689e, 0x7a88c0, 0x4e5a90], cracks: 0x2a3060 }], band: ['band', { shape: 'drip', a: 0xf4f8ff, b: 0xccd6f4 }], ts: 4, ss: 3 },
  tile_terracotta: { top: ['blocks', { base: 0xd27a50, vary: [0xd27a50, 0xc86e46, 0xdc8a5c], mortar: 0xf0dcc0, rows: 4, cols: 4, offset: 0, round: 2, cracks: 0.1 }], side: ['plaster', { a: 0xe8c89a, b: 0xc8a070 }], ts: 2.5, ss: 3 },
  tile_zellige: { top: ['zellige', { cols: [0x2a6fb0, 0x387d76, 0xedc371, 0xfff7dc, 0xe98c73] }], side: ['plaster', { a: 0xe4c08c, b: 0xc09868 }], band: ['band', { shape: 'trim', a: 0x387d76, b: 0x2a5f58 }], ts: 2.5, ss: 3, bandH: 0.3 },
  tile_lab: { top: ['blocks', { base: 0xeef4f2, vary: [0xeef4f2, 0xe2ecea, 0xf6faf8], mortar: 0x9ab8b4, rows: 4, cols: 4, offset: 0, round: 1, bevel: 2, cracks: 0.05 }], side: ['panel', { base: 0xb8c8c8, line: 0x6a8484 }], band: ['band', { shape: 'stripe', a: 0x99d1b7, b: 0x387d76, c: 0x1f4a46, h: 32 }], mat: 'phong', ts: 2, ss: 2, bandH: 0.2 },
  whitewash: { top: ['blocks', { base: 0xf6f2ea, vary: [0xf6f2ea, 0xeee8dc, 0xfaf8f2], mortar: 0xd8d0c0, rows: 3, cols: 2, irregular: true, cracks: 0.05 }], side: ['plaster', { a: 0xfbf8f0, b: 0xe2dccc, cracks: 0.1 }], band: ['band', { shape: 'trim', a: 0x2a6fd0, b: 0x1a4fa0 }], ts: 3, ss: 3, bandH: 0.3 },
  brick: { top: ['blocks', { base: 0xb8644a, vary: [0xb8644a, 0xa85a42, 0xc8705a], mortar: 0xd8c4a8, rows: 8, cols: 4, cracks: 0.05, bevel: 2 }], side: ['blocks', { base: 0xb05a40, vary: [0xb05a40, 0x9c4e38, 0xc06850, 0xa86048], mortar: 0xd0bca0, rows: 8, cols: 4, bevel: 2, cracks: 0.05 }], ts: 2, ss: 2 },
  crystal: { top: ['crystal', { cols: [0x8a6ad8, 0xb88af0, 0x6ad8d0, 0xdbb2f6] }], side: ['crystal', { cols: [0x5a40a8, 0x7a5ad0, 0x40a8b0, 0x9a7ae0] }], mat: 'crystal', ts: 3, ss: 3 },
  cloud: { top: ['cloud', { a: 0xffffff, b: 0xd8dcf4 }], side: ['cloud', { a: 0xf0f2ff, b: 0xc0c4e8 }], mat: 'cloud', ts: 4, ss: 3 },
  cloud_gold: { top: ['cloud', { a: 0xfff4d0, b: 0xf0d080 }], side: ['cloud', { a: 0xffeec0, b: 0xe8c070 }], mat: 'cloud', ts: 4, ss: 3 },
  conveyor: { top: ['conveyor', { belt: 0x34303c, arrow: 0xedc371, rail: 0x8a92a0 }], side: ['panel', { base: 0x6a7280, line: 0x3a4048 }], band: ['band', { shape: 'stripe', a: 0xedc371, b: 0x2a2630, c: 0x2a2630, h: 32 }], mat: 'conveyor', ts: 2, ss: 2, bandH: 0.25 },
  glass: { top: ['glass', { tint: 0xb8f0ff, frame: 0x8ad0e0 }], side: ['glass', { tint: 0x9ae0f0, frame: 0x6ab0c8 }], mat: 'glass', ts: 2, ss: 2 },
  lava_rock: { top: ['strata', { cols: [0x3a2a30, 0x2c2028, 0x4a343a], cracks: 0x000000, glow: 0xff7a2a }], side: ['strata', { cols: [0x342630, 0x281c24, 0x40303a], cracks: 0x000000, glow: 0xff6a2a }], mat: 'basalt', ts: 3, ss: 3 },
  lava: { top: ['lava', { hot: 0xffa030, mid: 0xff5a1a, crust: 0x5a1a10 }], side: ['strata', { cols: [0x342630, 0x281c24, 0x40303a], cracks: 0x000000, glow: 0xff6a2a }], mat: 'lava', ts: 4, ss: 3 },
  bridge: { top: ['planks', { base: 0xb8844c, dark: 0x5a3820, n: 4, gaps: true }], side: ['planks', { base: 0x8a5a34, dark: 0x4a2c18, n: 2, nails: false }], mat: 'bridge', ts: 2.4, ss: 2, plankAlong: false },
  gold: { top: ['blocks', { base: 0xf0c860, vary: [0xf0c860, 0xe8b850, 0xf8d878, 0xffe08a], mortar: 0xb08030, rows: 4, cols: 4, offset: 0, sparkle: true, cracks: 0 }], side: ['blocks', { base: 0xd8a848, vary: [0xd8a848, 0xc89838, 0xe8b858], mortar: 0x8a6020, rows: 4, cols: 2, sparkle: true, cracks: 0 }], band: ['band', { shape: 'gold', a: 0xffe08a, b: 0xdbb2f6, c: 0xe8b850 }], mat: 'gold', ts: 3, ss: 3, bandH: 0.32 },
  moon: { top: ['sandTop', { a: 0xc8c0d8, b: 0xb0a8c8, c: 0x9a92b8 }], side: ['strata', { cols: [0x8a82a8, 0x7a7298, 0x9a92b8, 0x6a6290], cracks: 0x3a3460 }], band: ['band', { shape: 'drip', a: 0xd0c8e0, b: 0xa8a0c4 }], ts: 5, ss: 4 },
};

const matCache = new Map();
/** { top, side, band|null, style } materials for a style id (cached). */
export function styleMaterials(id) {
  let m = matCache.get(id);
  if (m) return m;
  const st = STYLES[id] || STYLES.grass;
  const top = getTex(st.top[0], st.top[1]);
  const side = getTex(st.side[0], st.side[1]);
  const mk = (map, isTop) => {
    switch (st.mat) {
      case 'phong': return new THREE.MeshPhongMaterial({ map, shininess: 50, specular: 0x555560 });
      case 'gold': return new THREE.MeshPhongMaterial({ map, shininess: 80, specular: 0xffe0a0, emissive: 0x3a2400 });
      case 'ice': return new THREE.MeshPhongMaterial({ map, shininess: 110, specular: 0xffffff, transparent: true, opacity: isTop ? 0.96 : 0.86, emissive: 0x16304a });
      case 'glass': return new THREE.MeshPhongMaterial({ map, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
      case 'crystal': return new THREE.MeshPhongMaterial({ map, shininess: 90, specular: 0xffffff, emissive: 0x2a1a5a, emissiveMap: map });
      case 'cloud': return new THREE.MeshLambertMaterial({ map, emissive: 0x4a4a68 });
      case 'basalt': return new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.35 });
      case 'lava': return isTop ? new THREE.MeshBasicMaterial({ map, toneMapped: false }) : new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.35 });
      case 'bridge': return new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
      default: return new THREE.MeshLambertMaterial({ map });
    }
  };
  let band = null;
  if (st.band) {
    const bt = getTex(st.band[0], st.band[1], { repeat: true });
    bt.wrapT = THREE.ClampToEdgeWrapping;
    band = new THREE.MeshLambertMaterial({ map: bt, alphaTest: 0.5, side: THREE.DoubleSide });
    if (st.mat === 'phong' || st.mat === 'conveyor') band = new THREE.MeshPhongMaterial({ map: bt, alphaTest: 0.5, side: THREE.DoubleSide, shininess: 40 });
  }
  m = { top: mk(top, true), side: mk(side, false), band, style: st, id };
  matCache.set(id, m);
  return m;
}

/** conveyor top material for a given scroll speed (per level, disposed by the level; texture clone). */
export function conveyorMaterial() {
  const st = STYLES.conveyor;
  const base = getTex(st.top[0], st.top[1]);
  const t = base.clone();
  t.needsUpdate = true;
  return new THREE.MeshPhongMaterial({ map: t, shininess: 30, specular: 0x333333 });
}

// ---------------------------------------------------------------- terrain / generic
export function terrainDetailTex() { return getTex('detail', { lo: 205 }); }

// ---------------------------------------------------------------- billboard / poster textures (text gags)
const signCache = new Map();
/**
 * spec = { title, sub, small, bg, fg, accent, icon, w, h, style:'board'|'poster'|'sign'|'neon' }
 */
export function signTexture(spec) {
  const key = JSON.stringify(spec);
  let t = signCache.get(key);
  if (t) return t;
  const W = spec.w || 512, H = spec.h || 256;
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d');
  const bg = spec.bg ?? 0xfff7dc, fg = spec.fg ?? 0x1c1640, ac = spec.accent ?? 0xe98c73;
  const r = rng(key.length);
  // background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(mixHex(bg, 0xffffff, 0.15))); g.addColorStop(1, css(mulHex(bg, 0.9)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (spec.style === 'poster') {
    // paper wear
    blotches(ctx, r, 8, [0x8a6a40], 20, 60, 0.12);
    ctx.fillStyle = cssA(ac, 1); ctx.fillRect(0, 0, W, H * 0.08); ctx.fillRect(0, H * 0.92, W, H * 0.08);
  } else if (spec.style === 'sign') {
    ctx.fillStyle = css(ac); roundRect(ctx, 8, 8, W - 16, H - 16, 24); ctx.lineWidth = 14; ctx.strokeStyle = css(ac); ctx.stroke();
  } else {
    // sunburst rays for that cheap advert vibe
    ctx.save(); ctx.translate(W * 0.18, H * 0.55);
    for (let k = 0; k < 16; k++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = cssA(ac, 0.12); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, -40); ctx.lineTo(W, 40); ctx.fill(); }
    ctx.restore();
    ctx.lineWidth = 12; ctx.strokeStyle = css(fg); ctx.strokeRect(6, 6, W - 12, H - 12);
  }
  // icon
  const iconW = spec.icon ? Math.min(H * 0.62, W * 0.26) : 0;
  if (spec.icon) drawIcon(ctx, spec.icon, 22 + iconW / 2, H * 0.52, iconW * 0.5, { fg, ac, bg });
  // text
  const tx = iconW ? (iconW + 44 + W) / 2 : W / 2, align = 'center', maxW = W - (iconW ? iconW + 66 : 50);
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const fit = (text, size, weight = 'bold') => {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (ctx.measureText(text).width > maxW && s > 10) { s -= 2; ctx.font = `${weight} ${s}px ${FONT}`; }
    return s;
  };
  const lines = [];
  if (spec.title) lines.push([spec.title, H * 0.25, fg, 'bold']);
  if (spec.sub) lines.push([spec.sub, H * 0.15, mulHex(fg, 1), 'bold']);
  if (spec.small) lines.push([spec.small, H * 0.105, mixHex(fg, bg, 0.3), 'bold']);
  const tot = lines.reduce((a, l) => a + l[1] * 1.25, 0);
  let y = H / 2 - tot / 2;
  for (const [text, size, col, wgt] of lines) {
    const s = fit(text, size, wgt);
    y += s * 0.625;
    if (spec.style !== 'poster') { ctx.fillStyle = cssA(0x000000, 0.18); ctx.fillText(text, tx + 3, y + 3); }
    ctx.fillStyle = css(col); ctx.fillText(text, tx, y);
    y += size * 1.25 - s * 0.625;
  }
  t = canvasTex(cv, { repeat: false });
  signCache.set(key, t);
  return t;
}

function drawIcon(ctx, icon, x, y, R, { fg, ac }) {
  ctx.save(); ctx.translate(x, y);
  if (icon === 'cortisol') {
    // huge head with a C on the forehead
    ctx.fillStyle = '#f4d8b8'; ctx.beginPath(); ctx.ellipse(0, -R * 0.1, R * 0.95, R * 0.85, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = css(fg); ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#e94f4f'; ctx.font = `bold ${R * 0.7}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('C', 0, -R * 0.45);
    ctx.fillStyle = css(fg);
    ctx.beginPath(); ctx.arc(-R * 0.3, R * 0.1, R * 0.09, 0, 7); ctx.arc(R * 0.3, R * 0.1, R * 0.09, 0, 7); ctx.fill();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, R * 0.55, R * 0.3, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); // frown
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; // tiny lab coat collar
    ctx.beginPath(); ctx.moveTo(-R * 0.5, R * 0.75); ctx.lineTo(0, R * 0.95); ctx.lineTo(R * 0.5, R * 0.75); ctx.stroke();
  } else if (icon === 'nobandicoot') {
    // orange creature silhouette crossed in a red circle
    ctx.fillStyle = '#e8873a';
    ctx.beginPath(); ctx.ellipse(0, R * 0.15, R * 0.35, R * 0.5, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -R * 0.45, R * 0.3, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-R * 0.25, -R * 0.6); ctx.lineTo(-R * 0.45, -R * 0.95); ctx.lineTo(-R * 0.05, -R * 0.7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R * 0.15, -R * 0.65); ctx.lineTo(R * 0.4, -R * 0.95); ctx.lineTo(R * 0.3, -R * 0.55); ctx.fill();
    ctx.strokeStyle = '#d92b2b'; ctx.lineWidth = R * 0.16;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.64, -R * 0.64); ctx.lineTo(R * 0.64, R * 0.64); ctx.stroke();
  } else if (icon === 'sun') {
    ctx.fillStyle = '#ffcf4a';
    for (let k = 0; k < 12; k++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.1); ctx.lineTo(R * 0.95, 0); ctx.lineTo(R * 0.55, R * 0.1); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = css(fg); ctx.fillRect(-R * 0.35, -R * 0.12, R * 0.3, R * 0.14); ctx.fillRect(R * 0.05, -R * 0.12, R * 0.3, R * 0.14); // sunglasses
  } else if (icon === 'camel') {
    ctx.fillStyle = '#d8a060';
    ctx.beginPath(); ctx.ellipse(0, R * 0.1, R * 0.6, R * 0.32, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-R * 0.15, -R * 0.15, R * 0.25, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(R * 0.25, -R * 0.12, R * 0.22, Math.PI, 0); ctx.fill();
    ctx.fillRect(R * 0.5, -R * 0.55, R * 0.14, R * 0.6);
    ctx.beginPath(); ctx.ellipse(R * 0.66, -R * 0.58, R * 0.2, R * 0.12, 0, 0, 7); ctx.fill();
    for (const lx of [-0.4, -0.15, 0.2, 0.42]) ctx.fillRect(lx * R, R * 0.3, R * 0.09, R * 0.5);
    ctx.fillStyle = css(fg); ctx.fillRect(R * 0.62, -R * 0.66, R * 0.22, R * 0.07);
    ctx.fillStyle = css(ac); ctx.beginPath(); ctx.moveTo(-R * 0.9, -R * 0.2); ctx.quadraticCurveTo(-R * 0.6, -R * 1.1, -R * 0.1, -R * 0.75); ctx.lineTo(-R * 0.5, -R * 0.5); ctx.fill(); // parasol
  } else if (icon === 'cat') {
    ctx.fillStyle = '#f4f0e8'; ctx.strokeStyle = css(fg); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, R * 0.25, R * 0.7, R * 0.35, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-R * 0.55, 0, R * 0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.8, -R * 0.15); ctx.lineTo(-R * 0.75, -R * 0.45); ctx.lineTo(-R * 0.58, -R * 0.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R * 0.45, -R * 0.28); ctx.lineTo(-R * 0.3, -R * 0.45); ctx.lineTo(-R * 0.28, -R * 0.15); ctx.fill(); ctx.stroke();
    ctx.font = `bold ${R * 0.4}px ${FONT}`; ctx.fillStyle = css(ac); ctx.fillText('z', R * 0.1, -R * 0.4); ctx.fillText('Z', R * 0.4, -R * 0.75);
  } else if (icon === 'penguin') {
    ctx.fillStyle = '#2a2a3a'; ctx.beginPath(); ctx.ellipse(0, R * 0.1, R * 0.5, R * 0.75, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(0, R * 0.25, R * 0.33, R * 0.55, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffa030'; ctx.beginPath(); ctx.moveTo(-R * 0.1, -R * 0.3); ctx.lineTo(R * 0.1, -R * 0.3); ctx.lineTo(0, -R * 0.15); ctx.fill();
    ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-R * 0.25, -R * 0.5); ctx.lineTo(-R * 0.05, -R * 0.42); ctx.moveTo(R * 0.25, -R * 0.5); ctx.lineTo(R * 0.05, -R * 0.42); ctx.stroke(); // angry brows
  } else if (icon === 'rocket') {
    ctx.fillStyle = '#c8a070'; roundRect(ctx, -R * 0.25, -R * 0.8, R * 0.5, R * 1.3, R * 0.2); ctx.fill();
    ctx.fillStyle = css(ac); ctx.beginPath(); ctx.moveTo(-R * 0.25, -R * 0.6); ctx.lineTo(0, -R); ctx.lineTo(R * 0.25, -R * 0.6); ctx.fill();
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.5); ctx.lineTo(0, R * 0.95); ctx.lineTo(R * 0.2, R * 0.5); ctx.fill();
    ctx.fillStyle = '#8ad0f0'; ctx.beginPath(); ctx.arc(0, -R * 0.25, R * 0.13, 0, 7); ctx.fill();
  } else if (icon === 'sock') {
    ctx.fillStyle = '#ffd76a'; ctx.strokeStyle = css(fg); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-R * 0.2, -R * 0.8); ctx.lineTo(R * 0.2, -R * 0.8); ctx.lineTo(R * 0.2, R * 0.2); ctx.lineTo(R * 0.6, R * 0.35); ctx.quadraticCurveTo(R * 0.8, R * 0.75, R * 0.3, R * 0.75); ctx.lineTo(-R * 0.2, R * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = css(ac); ctx.fillRect(-R * 0.2, -R * 0.8, R * 0.4, R * 0.2);
  } else if (icon === 'skull') {
    ctx.fillStyle = '#f4f4f0'; ctx.beginPath(); ctx.arc(0, -R * 0.15, R * 0.6, 0, 7); ctx.fill(); ctx.fillRect(-R * 0.35, R * 0.2, R * 0.7, R * 0.4);
    ctx.fillStyle = css(fg); ctx.beginPath(); ctx.arc(-R * 0.22, -R * 0.15, R * 0.15, 0, 7); ctx.arc(R * 0.22, -R * 0.15, R * 0.15, 0, 7); ctx.fill();
  } else if (icon === 'crab') {
    ctx.fillStyle = '#e8573a'; ctx.beginPath(); ctx.ellipse(0, R * 0.2, R * 0.6, R * 0.35, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(-R * 0.75, -R * 0.25, R * 0.22, 0, 7); ctx.arc(R * 0.75, -R * 0.25, R * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 0.2); ctx.lineTo(-R * 0.3, -R * 0.55); ctx.lineTo(-R * 0.15, -R * 0.35); ctx.lineTo(0, -R * 0.6); ctx.lineTo(R * 0.15, -R * 0.35); ctx.lineTo(R * 0.3, -R * 0.55); ctx.lineTo(R * 0.3, -R * 0.2); ctx.fill(); // crown
  }
  ctx.restore();
}
